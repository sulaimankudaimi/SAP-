import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../core/db';
import { userRepository, roleRepository } from '../core/repositories';
import { AuthService, _resetThrottleMapForTesting } from '../core/services/AuthService';
import { AuditService } from '../core/services/AuditService';
import { CryptoService } from '../core/services/crypto';
import { SessionContext } from '../core/security/SessionContext';
import { SecurityMigrationService } from '../core/services/SecurityMigrationService';
import { redactSnapshot, isSensitiveKey } from '../core/security/auditRedaction';
import { useAuthStore } from '../core/auth/useAuthStore';
import type { User, Role } from '../types/models';

describe('Audit Redaction & Security Hardening Tests (D1)', () => {
  const initialPassword = 'SecretPass123!@';
  const newPassword = 'NewSecretPass987#$';
  let testUser: User;
  let testRole: Role;
  let initialSalt: string;
  let initialHash: string;

  beforeEach(async () => {
    SessionContext.clearActor();
    _resetThrottleMapForTesting();
    await db.users.clear();
    await db.roles.clear();
    await db.auditLogs.clear();
    await db.settings.clear();

    initialSalt = CryptoService.generateSalt();
    initialHash = await CryptoService.hashPassword(initialPassword, initialSalt);

    testRole = {
      id: 'r-admin',
      code: 'ADMIN',
      name: 'مدير النظام',
      description: 'System Administrator',
      permissionCodes: ['*'],
      isSystem: true,
    };
    await roleRepository.create(testRole, { system: true, userName: 'SYSTEM' });

    testUser = {
      id: 'u-audit-test',
      username: 'audit.tester',
      fullName: 'خالد التدقيق',
      email: 'audit@gulfenergy.sa',
      roleId: testRole.id,
      roleCode: testRole.code,
      roleName: testRole.name,
      companyCode: '1000',
      plantCode: '1100',
      passwordSalt: initialSalt,
      passwordHash: initialHash,
      failedLoginAttempts: 0,
      isLocked: false,
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    };
    await db.users.put(testUser);
  });

  it("updates a user's password through userRepository.update and redacts hashes and salts with [REDACTED:CHANGED]", async () => {
    const updatedSalt = CryptoService.generateSalt();
    const updatedHash = await CryptoService.hashPassword(newPassword, updatedSalt);

    await userRepository.update(
      testUser.id,
      {
        passwordSalt: updatedSalt,
        passwordHash: updatedHash,
        mustChangePassword: false,
      },
      { userId: testUser.id, userName: testUser.username }
    );

    const allAuditLogs = await db.auditLogs.toArray();
    expect(allAuditLogs.length).toBeGreaterThan(0);

    for (const log of allAuditLogs) {
      const serialized = JSON.stringify(log);
      expect(serialized).not.toContain(initialHash);
      expect(serialized).not.toContain(updatedHash);
      expect(serialized).not.toContain(initialSalt);
      expect(serialized).not.toContain(updatedSalt);
      expect(serialized).not.toContain(initialPassword);
      expect(serialized).not.toContain(newPassword);
    }

    const updateLog = allAuditLogs.find((l) => l.action === 'UPDATE' && l.entity === 'users');
    expect(updateLog).toBeDefined();
    expect(updateLog?.after?.passwordHash).toBe('[REDACTED:CHANGED]');
    expect(updateLog?.after?.passwordSalt).toBe('[REDACTED:CHANGED]');
    expect(updateLog?.before?.passwordHash).toBe('[REDACTED]');
    expect(updateLog?.before?.passwordSalt).toBe('[REDACTED]');
  });

  it('redacts deeply nested objects and arrays without mutating inputs or crashing on circular references', () => {
    const rawBefore = {
      user: {
        credentials: {
          passwordHash: 'hash-abc',
          passwordSalt: 'salt-123',
          apiKey: 'secret-key-xyz',
        },
        meta: {
          name: 'Ahmed',
        },
      },
      tokens: ['token-1', 'token-2'],
      hash: 'plain-hash-value',
      checksum: 'sha256-file-checksum',
    };

    const rawAfter = {
      user: {
        credentials: {
          passwordHash: 'hash-xyz', // changed
          passwordSalt: 'salt-123', // unchanged
          apiKey: 'secret-key-xyz', // unchanged
        },
        meta: {
          name: 'Ahmed Updated',
        },
      },
      tokens: ['token-3'], // changed
      hash: 'plain-hash-value',
      checksum: 'sha256-file-checksum',
    };

    const beforeBackup = JSON.parse(JSON.stringify(rawBefore));
    const afterBackup = JSON.parse(JSON.stringify(rawAfter));

    const { before, after } = redactSnapshot(rawBefore, rawAfter);

    // Assert inputs were not mutated
    expect(rawBefore).toEqual(beforeBackup);
    expect(rawAfter).toEqual(afterBackup);

    // Assert deep redaction
    interface NestedUserCreds {
      user: {
        credentials: {
          passwordHash: string;
          passwordSalt: string;
          apiKey: string;
        };
        meta: {
          name: string;
        };
      };
      tokens: string[];
      hash: string;
      checksum: string;
    }

    const bObj = before as NestedUserCreds;
    const aObj = after as NestedUserCreds;

    expect(bObj.user.credentials.passwordHash).toBe('[REDACTED]');
    expect(bObj.user.credentials.passwordSalt).toBe('[REDACTED]');
    expect(bObj.user.credentials.apiKey).toBe('[REDACTED]');
    expect(bObj.user.meta.name).toBe('Ahmed');

    expect(aObj.user.credentials.passwordHash).toBe('[REDACTED:CHANGED]');
    expect(aObj.user.credentials.passwordSalt).toBe('[REDACTED]');
    expect(aObj.user.credentials.apiKey).toBe('[REDACTED]');
    expect(aObj.user.meta.name).toBe('Ahmed Updated');

    // Circular references handling
    const circularObj: Record<string, unknown> = { username: 'test', passwordHash: 'secret' };
    circularObj.self = circularObj;

    expect(() => {
      const res = redactSnapshot(circularObj, circularObj);
      const bRes = res.before as Record<string, unknown>;
      const aRes = res.after as Record<string, unknown>;
      expect(bRes.passwordHash).toBe('[REDACTED]');
      expect(aRes.passwordHash).toBe('[REDACTED]');
    }).not.toThrow();
  });

  it('preserves non-sensitive keys such as checksum and exact key hash', () => {
    expect(isSensitiveKey('hash')).toBe(false);
    expect(isSensitiveKey('checksum')).toBe(false);
    expect(isSensitiveKey('fileHash')).toBe(false);
    expect(isSensitiveKey('chainChecksum')).toBe(false);

    expect(isSensitiveKey('password')).toBe(true);
    expect(isSensitiveKey('passwordHash')).toBe(true);
    expect(isSensitiveKey('passwordSalt')).toBe(true);
    expect(isSensitiveKey('apiToken')).toBe(true);
    expect(isSensitiveKey('secret')).toBe(true);
    expect(isSensitiveKey('passphrase')).toBe(true);
    expect(isSensitiveKey('privateKey')).toBe(true);

    const snapshot = {
      hash: 'sha256-block-hash-12345',
      checksum: '98765-checksum-valid',
      auditBlockNumber: 42,
      passwordHash: 'secret-hash-hidden',
    };

    const { before: _b, after } = redactSnapshot(null, snapshot);
    const result = after as Record<string, unknown>;

    expect(result.hash).toBe('sha256-block-hash-12345');
    expect(result.checksum).toBe('98765-checksum-valid');
    expect(result.auditBlockNumber).toBe(42);
    expect(result.passwordHash).toBe('[REDACTED]');
  });

  it('ensures that entire auth lifecycle (login, failed login x5, unlock, changePassword, regenerateInitialAdminPassword) never leaks secrets into auditLogs', async () => {
    // 1. Successful login
    const session = await AuthService.login(testUser.username, initialPassword);
    useAuthStore.getState().setSession(session);

    // 2. Failed logins x5 until locked
    for (let i = 0; i < 5; i++) {
      await expect(
        AuthService.login(testUser.username, 'WrongPassword123!')
      ).rejects.toThrow();
    }

    // 3. Unlock via useAuthStore
    const unlockRes = await useAuthStore.getState().unlock(initialPassword);
    expect(typeof unlockRes).toBe('boolean');

    // 4. Change password
    await AuthService.changePassword(testUser.id, initialPassword, newPassword);

    // 5. Admin user setup for regenerateInitialAdminPassword
    const adminUserRow: User = {
      id: 'admin',
      username: 'admin',
      fullName: 'مدير النظام الأصلي',
      email: 'admin@gulfenergy.sa',
      roleId: testRole.id,
      roleCode: testRole.code,
      roleName: testRole.name,
      companyCode: '1000',
      plantCode: '1100',
      passwordSalt: initialSalt,
      passwordHash: initialHash,
      failedLoginAttempts: 0,
      isLocked: false,
      mustChangePassword: true,
      lastLoginAt: undefined, // Never logged in
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    };
    await db.users.put(adminUserRow);

    const regenOtp = await AuthService.regenerateInitialAdminPassword();
    expect(regenOtp).toHaveLength(16);

    // Scan ALL audit logs in database
    const allLogs = await db.auditLogs.toArray();
    expect(allLogs.length).toBeGreaterThan(5);

    const secretsToProbe = [
      initialPassword,
      newPassword,
      regenOtp,
      initialHash,
      initialSalt,
      'WrongPassword123!',
    ];

    for (const log of allLogs) {
      const serialized = JSON.stringify(log);
      for (const secret of secretsToProbe) {
        expect(serialized).not.toContain(secret);
      }
    }
  });

  it('performs idempotent audit scrub migration on legacy audit records and records summary entry', async () => {
    const legacySalt1 = 'legacy-salt-val-1';
    const legacyHash1 = 'legacy-hash-val-1';
    const legacySalt2 = 'legacy-salt-val-2';
    const legacyHash2 = 'legacy-hash-val-2';

    // Insert legacy unredacted audit rows
    await db.auditLogs.bulkAdd([
      {
        id: 'aud-legacy-1',
        action: 'UPDATE',
        entity: 'users',
        entityId: 'u-1',
        userId: 'u-1',
        userName: 'legacyUser',
        timestamp: new Date().toISOString(),
        ipAddress: '127.0.0.1',
        before: { username: 'legacyUser', passwordHash: legacyHash1, passwordSalt: legacySalt1 },
        after: { username: 'legacyUser', passwordHash: legacyHash2, passwordSalt: legacySalt2 },
      },
      {
        id: 'aud-legacy-2',
        action: 'CREATE',
        entity: 'users',
        entityId: 'u-2',
        userId: 'SYSTEM',
        userName: 'SYSTEM',
        timestamp: new Date().toISOString(),
        ipAddress: '127.0.0.1',
        before: null,
        after: { username: 'user2', passwordHash: legacyHash1 },
      },
    ]);

    // 1. Run scrub migration
    const scrubbedCount = await SecurityMigrationService.runAuditScrubMigration();
    expect(scrubbedCount).toBe(2);

    // Verify records are redacted
    const row1 = await db.auditLogs.get('aud-legacy-1');
    const row2 = await db.auditLogs.get('aud-legacy-2');

    expect(JSON.stringify(row1)).not.toContain(legacyHash1);
    expect(JSON.stringify(row1)).not.toContain(legacyHash2);
    expect(JSON.stringify(row1)).not.toContain(legacySalt1);
    expect(JSON.stringify(row1)).not.toContain(legacySalt2);

    expect(row1?.before?.passwordHash).toBe('[REDACTED]');
    expect(row1?.after?.passwordHash).toBe('[REDACTED]');

    expect(row2?.after?.passwordHash).toBe('[REDACTED]');

    // Verify summary audit entry was logged
    const summaryLog = await db.auditLogs
      .where({ entityId: 'audit-scrub-migration' })
      .first();
    expect(summaryLog).toBeDefined();
    expect(summaryLog?.userName).toBe('SecurityMigrationService');
    expect(summaryLog?.after?.scrubbedRows).toBe(2);

    // 2. Idempotency: Second run changes nothing
    const secondRunCount = await SecurityMigrationService.runAuditScrubMigration();
    expect(secondRunCount).toBe(0);

    const summaryLogsTotal = await db.auditLogs
      .where({ entityId: 'audit-scrub-migration' })
      .toArray();
    expect(summaryLogsTotal).toHaveLength(1);
  });
});
