import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../core/db';
import { BackupService, BackupContainer } from '../modules/admin/services/BackupService';
import { WorkflowService } from '../modules/admin/services/WorkflowService';
import { TCodeService } from '../core/services/TCodeService';
import { SessionContext } from '../core/security/SessionContext';
import { SYSTEM_ROLES } from '../core/services/RbacService';
import type { User, Role, ApprovalRule } from '../types/models';

describe('Admin Part 2 - Comprehensive Integration & Acceptance Tests', () => {
  const adminRole: Role = {
    id: 'role-admin',
    code: SYSTEM_ROLES.ADMIN,
    name: 'مدير النظام',
    description: 'صلاحيات كاملة',
    permissionCodes: ['*'],
    isSystem: true,
  };

  const adminUser: User = {
    id: 'usr-admin-test',
    username: 'admin_tester',
    email: 'admin@test.com',
    fullName: 'مدير النظام التجريبي',
    roleId: adminRole.id,
    roleCode: adminRole.code,
    roleName: adminRole.name,
    roles: [adminRole],
    companyCode: '1000',
    plantCode: '1010',
    passwordHash: 'hash',
    passwordSalt: 'salt',
    failedLoginAttempts: 0,
    isLocked: false,
    mustChangePassword: false,
    isActive: true,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const regularRole: Role = {
    id: 'role-viewer',
    code: SYSTEM_ROLES.AUDITOR,
    name: 'مراجع داخلي',
    description: 'استعراض فقط',
    permissionCodes: ['ADM_VIEW', 'MM_VIEW'],
    isSystem: false,
  };

  beforeEach(() => {
    // Set active session context to admin
    SessionContext.setActor({
      userId: adminUser.id,
      username: adminUser.username,
      role: adminRole,
    });
  });

  // -------------------------------------------------------------
  // 1. Backup & Restore AES-256-GCM Round Trip & Passphrase Security
  // -------------------------------------------------------------
  describe('1. Backup & Restore (AES-256-GCM, PBKDF2, Checksum)', () => {
    it('executes a complete round trip: export -> decrypt preview -> count check', async () => {
      // 1. Ensure some dummy data in DB
      await db.settings.put({
        id: 'test-setting-1',
        key: 'TEST_KEY_ALPHA',
        value: 'VALUE_ALPHA',
        category: 'general',
        description: 'Testing backup',
        updatedAt: new Date().toISOString(),
        isDeleted: false,
      });

      const passphrase = 'UltraSecurePassphrase2026!';
      const exportResult = await BackupService.createEncryptedBackup(passphrase);

      expect(exportResult.container).toBeDefined();
      expect(exportResult.container.header.magic).toBe('GULF_ERP_ENCRYPTED_BACKUP');
      expect(exportResult.container.header.version).toBe('2.4');
      expect(exportResult.container.header.iterations).toBeGreaterThanOrEqual(210000);
      expect(exportResult.container.header.saltHex).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(exportResult.container.header.ivHex).toHaveLength(24);   // 12 bytes = 24 hex chars
      expect(exportResult.container.header.checksumSha256).toBeDefined();

      const backupString = JSON.stringify(exportResult.container);

      // Decrypt & Preview
      const previewRes = await BackupService.previewBackup(backupString, passphrase);
      expect(previewRes.preview.totalBackupRecords).toBe(exportResult.totalRecords);
      expect(previewRes.decryptedPayload['settings']).toBeDefined();

      // Find setting in payload
      const foundSetting = previewRes.decryptedPayload['settings'].find(
        (s) => s.id === 'test-setting-1'
      );
      expect(foundSetting).toBeDefined();
      expect(foundSetting?.key).toBe('TEST_KEY_ALPHA');

      // Test Restore Execution
      const restoreRes = await BackupService.executeRestore(
        previewRes.decryptedPayload,
        previewRes.preview.backupDate
      );
      expect(restoreRes.success).toBe(true);
      expect(restoreRes.restoredRecords).toBeGreaterThan(0);

      // Verify DB record retained
      const retrieved = await db.settings.get('test-setting-1');
      expect(retrieved?.value).toBe('VALUE_ALPHA');
    });

    it('fails cleanly when decrypting with wrong passphrase', async () => {
      const passphrase = 'CorrectPassphrase123!';
      const wrongPassphrase = 'IncorrectPassword999!';
      const exportResult = await BackupService.createEncryptedBackup(passphrase);
      const backupString = JSON.stringify(exportResult.container);

      await expect(BackupService.previewBackup(backupString, wrongPassphrase)).rejects.toThrow(
        /كلمة المرور غير صحيحة/
      );
    });

    it('rejects corrupted backup file (tampered ciphertext)', async () => {
      const passphrase = 'StrongPassphrase2026!';
      const exportResult = await BackupService.createEncryptedBackup(passphrase);
      const container = exportResult.container;

      // Tamper ciphertext
      const originalCipher = container.ciphertextHex;
      const tamperedCipher = 'ab' + originalCipher.substring(2);
      const corruptedContainer: BackupContainer = {
        ...container,
        ciphertextHex: tamperedCipher,
      };

      await expect(
        BackupService.previewBackup(JSON.stringify(corruptedContainer), passphrase)
      ).rejects.toThrow();
    });

    it('rejects corrupted backup file with invalid JSON or header', async () => {
      await expect(
        BackupService.previewBackup('NOT_A_JSON_STRING', 'any-pass')
      ).rejects.toThrow(/غير صالح أو تالف/);

      const invalidHeader = JSON.stringify({
        header: { magic: 'WRONG_MAGIC', version: '1.0' },
        ciphertextHex: 'deadbeef',
      });
      await expect(
        BackupService.previewBackup(invalidHeader, 'any-pass')
      ).rejects.toThrow(/غير معتمد/);
    });
  });

  // -------------------------------------------------------------
  // 2. SAP T-Code Resolver & Access Enforcement
  // -------------------------------------------------------------
  describe('2. SAP T-Code Resolver & Access Enforcement', () => {
    it('resolves valid T-Codes to correct routes for authorized users', () => {
      // ME51N -> /procurement/pr
      const resPr = TCodeService.resolveCode('ME51N', adminRole);
      expect(resPr.success).toBe(true);
      expect(resPr.targetPath).toBe('/procurement/pr');

      // ME21N -> /procurement/po
      const resPo = TCodeService.resolveCode('ME21N', adminRole);
      expect(resPo.success).toBe(true);
      expect(resPo.targetPath).toBe('/procurement/po');

      // FB50 -> /finance/journal-entries
      const resFb50 = TCodeService.resolveCode('FB50', adminRole);
      expect(resFb50.success).toBe(true);
      expect(resFb50.targetPath).toBe('/finance/journal-entries');

      // AS01 -> /assets/register
      const resAs01 = TCodeService.resolveCode('AS01', adminRole);
      expect(resAs01.success).toBe(true);
      expect(resAs01.targetPath).toBe('/assets/register');
    });

    it('supports SAP /n prefix standard notation', () => {
      const res = TCodeService.resolveCode('/nME21N', adminRole);
      expect(res.success).toBe(true);
      expect(res.targetPath).toBe('/procurement/po');
    });

    it('strictly forbids navigation when user role lacks required permission', () => {
      // regularRole has only ADM:view and MM:view
      // ME21N requires MM:create -> must be denied
      const deniedPo = TCodeService.resolveCode('ME21N', regularRole);
      expect(deniedPo.success).toBe(false);
      expect(deniedPo.error).toContain('خطأ صلاحيات');

      // FB50 requires FI:post -> must be denied
      const deniedFi = TCodeService.resolveCode('FB50', regularRole);
      expect(deniedFi.success).toBe(false);
      expect(deniedFi.error).toContain('خطأ صلاحيات');
    });

    it('returns informative error for unregistered T-Codes', () => {
      const res = TCodeService.resolveCode('UNKNOWN_CODE_999', adminRole);
      expect(res.success).toBe(false);
      expect(res.error).toContain('غير معروف أو غير مسجل');
    });
  });

  // -------------------------------------------------------------
  // 3. Workflow Approval Rules: Gap & Overlap Validation
  // -------------------------------------------------------------
  describe('3. Workflow Approval Rules: Gap & Overlap Validation', () => {
    it('validates healthy, continuous approval rules starting at 0 without gaps/overlaps', () => {
      const validRules: ApprovalRule[] = [
        {
          id: 'r1',
          documentType: 'PO',
          minAmount: 0,
          maxAmount: 50000,
          steps: [{ stepNumber: 1, roleCode: 'PM', roleName: 'مدير المشتريات' }],
          isActive: true,
          createdAt: '',
          updatedAt: '',
          isDeleted: false,
        },
        {
          id: 'r2',
          documentType: 'PO',
          minAmount: 50000,
          maxAmount: 200000,
          steps: [
            { stepNumber: 1, roleCode: 'PM', roleName: 'مدير المشتريات' },
            { stepNumber: 2, roleCode: 'FM', roleName: 'المدير المالي' },
          ],
          isActive: true,
          createdAt: '',
          updatedAt: '',
          isDeleted: false,
        },
      ];

      const validation = WorkflowService.validateRules(validRules);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('detects and flags starting threshold > 0', () => {
      const gapAtZero: ApprovalRule[] = [
        {
          id: 'r1',
          documentType: 'PO',
          minAmount: 1000,
          maxAmount: 50000,
          steps: [{ stepNumber: 1, roleCode: 'PM', roleName: 'مدير المشتريات' }],
          isActive: true,
          createdAt: '',
          updatedAt: '',
          isDeleted: false,
        },
      ];

      const res = WorkflowService.validateRules(gapAtZero);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('القاعدة الأولى يجب أن تبدأ من الصفر'))).toBe(true);
    });

    it('detects and flags financial gaps between approval rules', () => {
      const gapRules: ApprovalRule[] = [
        {
          id: 'r1',
          documentType: 'PO',
          minAmount: 0,
          maxAmount: 50000,
          steps: [{ stepNumber: 1, roleCode: 'PM', roleName: 'مدير المشتريات' }],
          isActive: true,
          createdAt: '',
          updatedAt: '',
          isDeleted: false,
        },
        {
          id: 'r2',
          documentType: 'PO',
          minAmount: 70000, // GAP between 50,000 and 70,000
          maxAmount: 200000,
          steps: [{ stepNumber: 1, roleCode: 'FM', roleName: 'المدير المالي' }],
          isActive: true,
          createdAt: '',
          updatedAt: '',
          isDeleted: false,
        },
      ];

      const res = WorkflowService.validateRules(gapRules);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('فجوة غير مغطاة') || e.includes('Gap'))).toBe(true);
    });

    it('detects and flags financial overlaps between approval rules', () => {
      const overlapRules: ApprovalRule[] = [
        {
          id: 'r1',
          documentType: 'PO',
          minAmount: 0,
          maxAmount: 100000,
          steps: [{ stepNumber: 1, roleCode: 'PM', roleName: 'مدير المشتريات' }],
          isActive: true,
          createdAt: '',
          updatedAt: '',
          isDeleted: false,
        },
        {
          id: 'r2',
          documentType: 'PO',
          minAmount: 80000, // OVERLAP between 80,000 and 100,000
          maxAmount: 300000,
          steps: [{ stepNumber: 1, roleCode: 'FM', roleName: 'المدير المالي' }],
          isActive: true,
          createdAt: '',
          updatedAt: '',
          isDeleted: false,
        },
      ];

      const res = WorkflowService.validateRules(overlapRules);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('تداخل') || e.includes('Overlap'))).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // 4. Dynamic Workflow Rules Reading
  // -------------------------------------------------------------
  describe('4. Dynamic Approval Steps Calculation from DB', () => {
    it('reads customized thresholds and changes approval chain for documents', async () => {
      // Modify or add a custom rule for PO in DB
      await db.approvalRules.put({
        id: 'custom-po-rule-low',
        documentType: 'PO',
        minAmount: 0,
        maxAmount: 15000,
        steps: [
          { stepNumber: 1, roleCode: SYSTEM_ROLES.WAREHOUSE_CLERK, roleName: 'أمين المستودع' },
        ],
        isActive: true,
        description: 'قاعدة مخصصة للاختبار',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDeleted: false,
      });

      const steps = await WorkflowService.determineSteps('PO', 10000);
      expect(steps).toBeDefined();
      expect(steps.length).toBeGreaterThan(0);
      expect(steps[0].roleCode).toBe(SYSTEM_ROLES.WAREHOUSE_CLERK);
    });
  });
});
