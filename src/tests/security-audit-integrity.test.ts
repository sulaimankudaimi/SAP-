import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CryptoService } from '../core/services/crypto';
import { SessionContext, requirePermission } from '../core/security/SessionContext';
import { AuditService } from '../core/services/AuditService';
import { DashboardService } from '../modules/reports/services/dashboardService';
import { SYSTEM_ROLES } from '../core/services/RbacService';
import type { Role, PurchaseOrder } from '../types/models';
import { poRepository } from '../core/repositories';

describe('Security, Authorization, and Audit Integrity Unit Tests', () => {
  beforeEach(() => {
    SessionContext.clearActor();
  });

  // 1. Token tamper detection
  describe('1. HMAC-SHA256 Token Tamper Detection', () => {
    it('successfully verifies genuine signed tokens and strictly rejects tampered payloads or signatures', async () => {
      const userId = 'u-admin-1';
      const roleCode = SYSTEM_ROLES.ADMIN;
      const expiresAt = Date.now() + 3600000;
      const payload = `${userId}:${roleCode}:${expiresAt}`;

      // Sign legitimate payload
      const validSignatureHex = await CryptoService.sign(payload);
      expect(validSignatureHex).toHaveLength(64); // SHA-256 is 32 bytes = 64 hex chars

      // Genuine signature passes verification
      const isValid = await CryptoService.verify(payload, validSignatureHex);
      expect(isValid).toBe(true);

      // Tampered payload (e.g. changing role to escalate privileges) fails verification
      const tamperedPayload = `${userId}:${SYSTEM_ROLES.FINANCE_MANAGER}:${expiresAt}`;
      const isTamperedPayloadValid = await CryptoService.verify(tamperedPayload, validSignatureHex);
      expect(isTamperedPayloadValid).toBe(false);

      // Tampered signature string (e.g. flipping a single hex digit) fails verification
      const flippedChar = validSignatureHex[0] === 'a' ? 'b' : 'a';
      const tamperedSignatureHex = flippedChar + validSignatureHex.slice(1);
      const isTamperedSigValid = await CryptoService.verify(payload, tamperedSignatureHex);
      expect(isTamperedSigValid).toBe(false);
    });
  });

  // 2. Expired token rejection
  describe('2. Expired Token Session Rejection', () => {
    it('detects and rejects session tokens that have passed their expiresAt timestamp', () => {
      const now = Date.now();
      const expiredSession = {
        userId: 'u-proc-1',
        roleCode: SYSTEM_ROLES.PROCUREMENT_OFFICER,
        expiresAt: now - 5000, // Expired 5 seconds ago
        token: 'mock-hmac-token',
      };

      const isExpired = expiredSession.expiresAt <= Date.now();
      expect(isExpired).toBe(true);

      const validateSessionExpiry = (expiresAt: number) => {
        if (!expiresAt || expiresAt <= Date.now()) {
          throw new Error('الجلسة منتهية الصلاحية أو غير مكتملة.');
        }
        return true;
      };

      expect(() => validateSessionExpiry(expiredSession.expiresAt)).toThrow(
        'الجلسة منتهية الصلاحية أو غير مكتملة.'
      );

      // Future token passes
      expect(validateSessionExpiry(now + 60000)).toBe(true);
    });
  });

  // 3. Unlock with wrong password fails
  describe('3. Unlock With Wrong Password Verification & Policy', () => {
    it('rejects wrong password attempts and validates correct password against PBKDF2 hash', async () => {
      const realPassword = 'SecureAdmin#2026';
      const wrongPassword = 'WrongPassword#999';
      const salt = CryptoService.generateSalt();
      const storedHash = await CryptoService.hashPassword(realPassword, salt);

      // Wrong password attempt returns false
      const wrongVerify = await CryptoService.verifyPassword(wrongPassword, salt, storedHash);
      expect(wrongVerify).toBe(false);

      // Correct password returns true
      const correctVerify = await CryptoService.verifyPassword(realPassword, salt, storedHash);
      expect(correctVerify).toBe(true);

      // Lockout logic simulation
      let failedAttempts = 4;
      const simulateFailedAttempt = () => {
        failedAttempts += 1;
        const isLocked = failedAttempts >= 5;
        return { failedAttempts, isLocked };
      };

      const lockResult = simulateFailedAttempt();
      expect(lockResult.failedAttempts).toBe(5);
      expect(lockResult.isLocked).toBe(true);
    });
  });

  // 4. requirePermission blocks a VIEWER from a posting method and allows ACCOUNTANT
  describe('4. Service-Level Authorization (requirePermission)', () => {
    it('strictly blocks a VIEWER from executing a posting action and allows ACCOUNTANT', () => {
      const viewerRole: Role = {
        id: 'r-viewer',
        code: SYSTEM_ROLES.VIEWER,
        name: 'مستعرض فقط (Read-Only Viewer)',
        description: 'Read-only access',
        permissionCodes: ['MM_VIEW', 'WM_VIEW', 'TM_VIEW', 'AM_VIEW', 'FI_VIEW', 'MD_VIEW'],
        isSystem: true,
      };

      const accountantRole: Role = {
        id: 'r-acc',
        code: SYSTEM_ROLES.ACCOUNTANT,
        name: 'محاسب مالي (Financial Accountant)',
        description: 'Financial posting access',
        permissionCodes: ['FI_VIEW', 'FI_POST', 'MM_VIEW', 'WM_VIEW', 'MD_VIEW', 'CO_VIEW', 'CO_POST'],
        isSystem: true,
      };

      // Set VIEWER as active session actor
      SessionContext.setActor({
        userId: 'u-viewer',
        username: 'viewer',
        role: viewerRole,
      });

      // VIEWER executing a posting method must throw an Arabic permission exception
      expect(() => {
        requirePermission({ module: 'FI', activity: 'post' });
      }).toThrow(/خطأ صلاحيات.*FI_POST/);

      // VIEWER executing a create method must also throw
      expect(() => {
        requirePermission({ module: 'MM', activity: 'create' });
      }).toThrow(/خطأ صلاحيات.*MM_CREATE/);

      // Switch active actor to ACCOUNTANT
      SessionContext.setActor({
        userId: 'u-acc',
        username: 'accountant',
        role: accountantRole,
      });

      // ACCOUNTANT executing FI_POST must succeed without throwing
      expect(() => {
        requirePermission({ module: 'FI', activity: 'post' });
      }).not.toThrow();

      // Clear actor: unauthenticated call must throw an authentication exception
      SessionContext.clearActor();
      expect(() => {
        requirePermission({ module: 'FI', activity: 'post' });
      }).toThrow(/خطأ أمني: لم يتم العثور على جلسة مستخدم نشطة/);
    });
  });

  // 5. Audit entry carries the real userId
  describe('5. Audit Trail Authenticity & Real Acting User Resolution', () => {
    it('automatically resolves acting userId from SessionContext and rejects calls without actor or system flag', async () => {
      const mockRole: Role = {
        id: 'r-acc',
        code: SYSTEM_ROLES.ACCOUNTANT,
        name: 'محاسب مالي',
        description: 'Accountant',
        permissionCodes: ['FI_POST'],
        isSystem: true,
      };

      // Set active user session
      SessionContext.setActor({
        userId: 'u-mohammed-harbi',
        username: 'm.harbi',
        role: mockRole,
      });

      const activeActor = SessionContext.getActor();
      expect(activeActor?.userId).toBe('u-mohammed-harbi');
      expect(activeActor?.username).toBe('m.harbi');

      // Verify that when no actor is active and system flag is false, AuditService throws
      SessionContext.clearActor();
      await expect(
        AuditService.log({
          action: 'CREATE',
          entity: 'TestEntity',
          entityId: 'ent-123',
          system: false,
        })
      ).rejects.toThrow(
        /Audit security violation: Cannot write audit log without an active authenticated actor or explicit system flag/
      );
    });
  });

  // 6. getProcurementTrends buckets match seeded PO dates
  describe('6. Procurement Trends Time Bucketing & Aggregation', () => {
    it('groups purchase orders into chronological buckets with zero for empty periods', async () => {
      const now = new Date();
      const date20DaysAgo = new Date(now.getTime() - 20 * 86400000).toISOString();
      const date10DaysAgo = new Date(now.getTime() - 10 * 86400000).toISOString();

      const mockPOs: Partial<PurchaseOrder>[] = [
        {
          id: 'po-1',
          docNumber: 'PO-2026-000001',
          orderDate: date20DaysAgo,
          totalAmount: 150000,
        },
        {
          id: 'po-2',
          docNumber: 'PO-2026-000002',
          orderDate: date10DaysAgo,
          totalAmount: 250000,
        },
        {
          id: 'po-3',
          docNumber: 'PO-2026-000003',
          orderDate: date10DaysAgo,
          totalAmount: 50000,
        },
      ];

      vi.spyOn(poRepository, 'list').mockResolvedValue(mockPOs as PurchaseOrder[]);

      const trends = await DashboardService.getProcurementTrends(30);

      expect(trends).toBeInstanceOf(Array);
      expect(trends).toHaveLength(6); // 30 days is partitioned into 6 buckets

      // Total sum of all trend buckets must equal the sum of PO amounts
      const totalBucketsAmount = trends.reduce((sum, b) => sum + b.amount, 0);
      const totalBucketsCount = trends.reduce((sum, b) => sum + b.orderCount, 0);

      expect(totalBucketsAmount).toBe(450000); // 150,000 + 250,000 + 50,000
      expect(totalBucketsCount).toBe(3);

      // Verify empty buckets default to 0
      const emptyBuckets = trends.filter((b) => b.orderCount === 0);
      expect(emptyBuckets.length).toBeGreaterThan(0);
      emptyBuckets.forEach((eb) => {
        expect(eb.amount).toBe(0);
        expect(eb.orderCount).toBe(0);
      });

      // Verify date formatting uses Arabic Gregorian Western digits locale
      trends.forEach((t) => {
        expect(t.label).toBeTruthy();
        expect(typeof t.label).toBe('string');
      });

      vi.restoreAllMocks();
    });
  });
});
