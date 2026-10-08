import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BackupService, type BackupContainer, type BackupHeader } from '../modules/admin/services/BackupService';
import { WorkflowService } from '../modules/admin/services/WorkflowService';
import { TCodeService } from '../core/services/TCodeService';
import { SessionContext } from '../core/security/SessionContext';
import { SYSTEM_ROLES } from '../core/services/RbacService';
import type { Role, ApprovalRule } from '../types/models';

// Mock fileDownloader so tests don't touch browser DOM APIs
vi.mock('../core/utils/fileDownloader', () => ({
  saveFileUniversal: vi.fn().mockResolvedValue(undefined),
  downloadCsvFile: vi.fn().mockResolvedValue(undefined),
  downloadJsonFile: vi.fn().mockResolvedValue(undefined),
}));

describe('Admin Part 2 Unit Tests & Acceptance Criteria', () => {
  const adminRole: Role = {
    id: 'role-admin',
    code: SYSTEM_ROLES.ADMIN,
    name: 'مدير النظام',
    description: 'مدير النظام بصلاحيات كاملة',
    permissionCodes: ['*'],
    isSystem: true,
  };

  const warehouseRole: Role = {
    id: 'role-wm',
    code: SYSTEM_ROLES.WAREHOUSE_CLERK,
    name: 'أمين مستودع',
    description: 'أمين المستودع',
    permissionCodes: ['WM_VIEW', 'WM_CREATE', 'WM_POST', 'MD_VIEW'],
    isSystem: false,
  };

  const procurementRole: Role = {
    id: 'role-proc',
    code: SYSTEM_ROLES.PROCUREMENT_MANAGER,
    name: 'مدير المشتريات',
    description: 'مدير المشتريات',
    permissionCodes: ['MM_VIEW', 'MM_CREATE', 'MM_CHANGE', 'MM_APPROVE', 'MD_VIEW'],
    isSystem: false,
  };

  beforeEach(() => {
    SessionContext.setActor({
      userId: 'test-admin-id',
      username: 'admin',
      role: adminRole,
    });
  });

  // --------------------------------------------------------------------------
  // 1. BACKUP & RESTORE ENCRYPTION ROUND-TRIP
  // --------------------------------------------------------------------------
  describe('1. Encrypted Backup Round-Trip & Record Count Identity', () => {
    it('creates AES-256-GCM encrypted backup with PBKDF2 >= 210,000 iterations and recovers identical record counts', async () => {
      const passphrase = 'SuperSecretEnterprisePassword2026!';
      const res = await BackupService.createEncryptedBackup(passphrase, 'test_backup.gerp');

      expect(res.filename).toBe('test_backup.gerp');
      expect(res.container).toBeDefined();
      expect(res.container.header.magic).toBe('GULF_ERP_ENCRYPTED_BACKUP');
      expect(res.container.header.version).toBe('2.4');
      expect(res.container.header.iterations).toBeGreaterThanOrEqual(210000);
      expect(res.container.header.saltHex).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(res.container.header.ivHex).toHaveLength(24); // 12 bytes = 24 hex chars
      expect(res.container.header.checksumSha256).toHaveLength(64); // SHA-256 = 64 hex chars
      expect(typeof res.container.ciphertextHex).toBe('string');
      expect(res.container.ciphertextHex.length).toBeGreaterThan(0);

      // Decrypt and preview with correct passphrase
      const backupJsonString = JSON.stringify(res.container);
      const { preview, decryptedPayload } = await BackupService.previewBackup(backupJsonString, passphrase);

      expect(preview.backupVersion).toBe('2.4');
      expect(preview.totalBackupRecords).toBe(res.totalRecords);
      expect(Object.keys(decryptedPayload).length).toBe(Object.keys(res.tableCounts).length);

      // Verify each table count matches the backup exactly
      for (const [table, count] of Object.entries(res.tableCounts)) {
        expect(decryptedPayload[table]?.length || 0).toBe(count);
      }
    });

    it('serializes and deserializes binary blobs into base64 and restores them identically', async () => {
      // Test serialization of attachment blobs and binary data
      const sampleBlobData = 'PDF_DOCUMENT_MOCK_ATTACHMENT_BYTES_12345';
      const sampleBlob = new Blob([sampleBlobData], { type: 'application/pdf' });
      const sampleRecord = {
        id: 'att-01',
        filename: 'invoice.pdf',
        fileBlob: sampleBlob,
        binaryFlag: new Uint8Array([10, 20, 30, 40, 50]),
      };

      // Call internal serializeRecord
      const serialized = await BackupService['serializeRecord'](sampleRecord);
      const serializedBlob = serialized.fileBlob as Record<string, unknown>;
      const serializedBinary = serialized.binaryFlag as Record<string, unknown>;
      expect(serializedBlob.__isSerializedBlob).toBe(true);
      expect(typeof serializedBlob.base64).toBe('string');
      expect(serializedBinary.__isSerializedBinary).toBe(true);

      // Deserialize record
      const deserialized = BackupService['deserializeRecord'](serialized);
      expect(deserialized.fileBlob instanceof Blob).toBe(true);
      const restoredBlob = deserialized.fileBlob as Blob;
      expect(restoredBlob.type).toBe('application/pdf');
      const restoredText = await restoredBlob.text();
      expect(restoredText).toBe(sampleBlobData);

      const restoredUint = deserialized.binaryFlag as Uint8Array;
      expect(Array.from(restoredUint)).toEqual([10, 20, 30, 40, 50]);
    });
  });

  // --------------------------------------------------------------------------
  // 2. WRONG PASSPHRASE FAILS CLEANLY
  // --------------------------------------------------------------------------
  describe('2. Wrong Passphrase Clean Failure & Tamper Resistance', () => {
    it('fails cleanly without throwing uncaught errors when incorrect passphrase is provided', async () => {
      const correctPass = 'CorrectPassword_2026!';
      const wrongPass = 'IncorrectPassword_9999!';

      const res = await BackupService.createEncryptedBackup(correctPass);
      const fileString = JSON.stringify(res.container);

      // Attempt preview with wrong passphrase
      await expect(BackupService.previewBackup(fileString, wrongPass)).rejects.toThrow(
        /كلمة المرور غير صحيحة|Decryption Failed/i
      );
    });

    it('rejects passwords shorter than 8 characters during backup creation', async () => {
      await expect(BackupService.createEncryptedBackup('short')).rejects.toThrow(
        /8 خانات/i
      );
    });
  });

  // --------------------------------------------------------------------------
  // 3. CORRUPTED FILE REJECTION
  // --------------------------------------------------------------------------
  describe('3. Corrupted File Strict Rejection', () => {
    it('rejects malformed JSON file content', async () => {
      const corruptedJson = '{ invalid_json: true, broken: ';
      await expect(BackupService.previewBackup(corruptedJson, 'AnyPassword123!')).rejects.toThrow(
        /JSON parse failed|غير صالح أو تالف/i
      );
    });

    it('rejects files with invalid or missing magic header', async () => {
      const badHeaderContainer = {
        header: {
          magic: 'INVALID_HEADER_MAGIC',
          version: '2.4',
        },
        ciphertextHex: 'deadbeef',
      };
      await expect(
        BackupService.previewBackup(JSON.stringify(badHeaderContainer), 'AnyPassword123!')
      ).rejects.toThrow(/تنسيق ملف النسخة الاحتياطية غير معتمد|Invalid Magic Header/i);
    });

    it('detects and rejects ciphertext tampering via AES-GCM authentication tag', async () => {
      const pass = 'TamperProofPassphrase2026!';
      const res = await BackupService.createEncryptedBackup(pass);

      // Tamper with the ciphertext by flipping characters in the middle
      const originalHex = res.container.ciphertextHex;
      const mid = Math.floor(originalHex.length / 2);
      const flippedDigit = originalHex[mid] === 'a' ? 'b' : 'a';
      const tamperedHex = originalHex.slice(0, mid) + flippedDigit + originalHex.slice(mid + 1);

      const tamperedContainer: BackupContainer = {
        ...res.container,
        ciphertextHex: tamperedHex,
      };

      await expect(
        BackupService.previewBackup(JSON.stringify(tamperedContainer), pass)
      ).rejects.toThrow(/Decryption Failed|كلمة المرور غير صحيحة/i);
    });

    it('detects checksum mismatch if header checksum does not match payload', async () => {
      const pass = 'ChecksumTestPassphrase2026!';
      const res = await BackupService.createEncryptedBackup(pass);

      // Falsify the checksum in the header
      const falsifiedContainer: BackupContainer = {
        ...res.container,
        header: {
          ...res.container.header,
          checksumSha256: '0000000000000000000000000000000000000000000000000000000000000000',
        },
      };

      await expect(
        BackupService.previewBackup(JSON.stringify(falsifiedContainer), pass)
      ).rejects.toThrow(/Checksum Mismatch|فشل فحص البصمة الرقمية/i);
    });
  });

  // --------------------------------------------------------------------------
  // 4. T-CODE RESOLVER RESPECTS PERMISSIONS
  // --------------------------------------------------------------------------
  describe('4. SAP T-Code Resolver & Security Authorization', () => {
    it('normalizes T-codes stripping leading /n or /N and uppercase conversion', () => {
      expect(TCodeService.normalizeCode('/nme21n')).toBe('ME21N');
      expect(TCodeService.normalizeCode('/Nmigo')).toBe('MIGO');
      expect(TCodeService.normalizeCode('fb50')).toBe('FB50');
      expect(TCodeService.normalizeCode('   /Nbr01   ')).toBe('BR01');
    });

    it('allows administrator to navigate to any registered T-code', () => {
      // Master Data MM03
      const resMat = TCodeService.resolveCode('MM03', adminRole);
      expect(resMat.success).toBe(true);
      expect(resMat.targetPath).toBe('/masterdata/materials');

      // Goods Movement MIGO
      const resMigo = TCodeService.resolveCode('MIGO', adminRole);
      expect(resMigo.success).toBe(true);
      expect(resMigo.targetPath).toBe('/inventory/movements');

      // Admin Backup BR01
      const resBackup = TCodeService.resolveCode('BR01', adminRole);
      expect(resBackup.success).toBe(true);
      expect(resBackup.targetPath).toBe('/admin/backup');

      // Workflow SWDD
      const resWf = TCodeService.resolveCode('SWDD', adminRole);
      expect(resWf.success).toBe(true);
      expect(resWf.targetPath).toBe('/admin/workflow');

      // Approvals SBWP
      const resInbox = TCodeService.resolveCode('SBWP', adminRole);
      expect(resInbox.success).toBe(true);
      expect(resInbox.targetPath).toBe('/approvals');
    });

    it('strictly denies navigation to unauthorized screens for restricted roles', () => {
      // Warehouse officer attempting to access Backup BR01 (requires ADM_CREATE)
      const resBackup = TCodeService.resolveCode('BR01', warehouseRole);
      expect(resBackup.success).toBe(false);
      expect(resBackup.targetPath).toBeUndefined();
      expect(resBackup.error).toMatch(/خطأ صلاحيات/);

      // Warehouse officer attempting to access Financial GL FB50 (requires FI_POST)
      const resGl = TCodeService.resolveCode('FB50', warehouseRole);
      expect(resGl.success).toBe(false);
      expect(resGl.error).toMatch(/خطأ صلاحيات/);

      // Warehouse officer executing permitted MIGO
      const resMigo = TCodeService.resolveCode('MIGO', warehouseRole);
      expect(resMigo.success).toBe(true);
      expect(resMigo.targetPath).toBe('/inventory/movements');
    });

    it('rejects unknown or invalid transaction codes with descriptive error', () => {
      const res = TCodeService.resolveCode('ZZZ_INVALID_CODE', adminRole);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/غير معروف أو غير مسجل/);
    });

    it('filters autocomplete suggestions by role permissions', () => {
      const allSuggestions = TCodeService.searchCodes('M', null);
      const warehouseSuggestions = TCodeService.searchCodes('M', warehouseRole);

      // Warehouse officer cannot see ADM or FI codes in suggestions
      const hasAdmInWh = warehouseSuggestions.some((s) => s.module === 'ADM' || s.module === 'FI');
      expect(hasAdmInWh).toBe(false);

      // But can see warehouse codes like MMBE or MIGO
      const hasWmInWh = warehouseSuggestions.some((s) => s.module === 'WM');
      expect(hasWmInWh).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 5. APPROVAL RULE GAP / OVERLAP VALIDATION
  // --------------------------------------------------------------------------
  describe('5. Workflow Approval Rule Gap & Overlap Validation', () => {
    it('accepts a contiguous, gap-free, overlap-free chain of approval rules starting at 0', () => {
      const validRules: ApprovalRule[] = [
        {
          id: 'r1',
          documentType: 'PO',
          minAmount: 0,
          maxAmount: 50000,
          steps: [{ stepNumber: 1, roleCode: SYSTEM_ROLES.PROCUREMENT_MANAGER, roleName: 'مدير المشتريات' }],
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isDeleted: false,
        },
        {
          id: 'r2',
          documentType: 'PO',
          minAmount: 50000.01,
          maxAmount: 250000,
          steps: [
            { stepNumber: 1, roleCode: SYSTEM_ROLES.PROCUREMENT_MANAGER, roleName: 'مدير المشتريات' },
            { stepNumber: 2, roleCode: SYSTEM_ROLES.FINANCE_MANAGER, roleName: 'المدير المالي' },
          ],
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isDeleted: false,
        },
        {
          id: 'r3',
          documentType: 'PO',
          minAmount: 250000.01,
          maxAmount: 999999999,
          steps: [
            { stepNumber: 1, roleCode: SYSTEM_ROLES.PROCUREMENT_MANAGER, roleName: 'مدير المشتريات' },
            { stepNumber: 2, roleCode: SYSTEM_ROLES.FINANCE_MANAGER, roleName: 'المدير المالي' },
            { stepNumber: 3, roleCode: SYSTEM_ROLES.ADMIN, roleName: 'المدير العام' },
          ],
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isDeleted: false,
        },
      ];

      const validation = WorkflowService.validateRules(validRules);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('detects monetary gaps between consecutive approval rules', () => {
      const gappedRules: ApprovalRule[] = [
        {
          id: 'r1',
          documentType: 'PO',
          minAmount: 0,
          maxAmount: 50000,
          steps: [{ stepNumber: 1, roleCode: SYSTEM_ROLES.PROCUREMENT_MANAGER, roleName: 'مدير المشتريات' }],
          isActive: true,
          createdAt: '',
          updatedAt: '',
          isDeleted: false,
        },
        {
          id: 'r2',
          documentType: 'PO',
          minAmount: 80000, // GAP between 50,000 and 80,000
          maxAmount: 200000,
          steps: [{ stepNumber: 1, roleCode: SYSTEM_ROLES.FINANCE_MANAGER, roleName: 'المدير المالي' }],
          isActive: true,
          createdAt: '',
          updatedAt: '',
          isDeleted: false,
        },
      ];

      const validation = WorkflowService.validateRules(gappedRules);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e) => e.includes('فجوة') || e.includes('Gap'))).toBe(true);
    });

    it('detects monetary overlaps between consecutive approval rules', () => {
      const overlappingRules: ApprovalRule[] = [
        {
          id: 'r1',
          documentType: 'PO',
          minAmount: 0,
          maxAmount: 100000,
          steps: [{ stepNumber: 1, roleCode: SYSTEM_ROLES.PROCUREMENT_MANAGER, roleName: 'مدير المشتريات' }],
          isActive: true,
          createdAt: '',
          updatedAt: '',
          isDeleted: false,
        },
        {
          id: 'r2',
          documentType: 'PO',
          minAmount: 70000, // OVERLAP with r1 (70,000 < 100,000)
          maxAmount: 250000,
          steps: [{ stepNumber: 1, roleCode: SYSTEM_ROLES.FINANCE_MANAGER, roleName: 'المدير المالي' }],
          isActive: true,
          createdAt: '',
          updatedAt: '',
          isDeleted: false,
        },
      ];

      const validation = WorkflowService.validateRules(overlappingRules);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e) => e.includes('تداخل') || e.includes('Overlap'))).toBe(true);
    });

    it('rejects rules when the first tier does not begin at zero', () => {
      const nonZeroStartRules: ApprovalRule[] = [
        {
          id: 'r1',
          documentType: 'PO',
          minAmount: 5000, // Must start at 0
          maxAmount: 50000,
          steps: [{ stepNumber: 1, roleCode: SYSTEM_ROLES.PROCUREMENT_MANAGER, roleName: 'مدير المشتريات' }],
          isActive: true,
          createdAt: '',
          updatedAt: '',
          isDeleted: false,
        },
      ];

      const validation = WorkflowService.validateRules(nonZeroStartRules);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e) => e.includes('الصفر'))).toBe(true);
    });

    it('rejects rules with negative min amounts or inverted bounds (max <= min)', () => {
      const invalidBounds: ApprovalRule[] = [
        {
          id: 'r1',
          documentType: 'PO',
          minAmount: 50000,
          maxAmount: 20000, // Inverted: max < min
          steps: [{ stepNumber: 1, roleCode: SYSTEM_ROLES.PROCUREMENT_MANAGER, roleName: 'مدير المشتريات' }],
          isActive: true,
          createdAt: '',
          updatedAt: '',
          isDeleted: false,
        },
      ];

      const validation = WorkflowService.validateRules(invalidBounds);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e) => e.includes('أكبر من الحد الأدنى') || e.includes('الصفر'))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 6. THRESHOLD EDIT DYNAMICALLY ALTERS APPROVAL STEPS FOR NEW PO
  // --------------------------------------------------------------------------
  describe('6. Dynamic Workflow Release Strategy Evaluation', () => {
    it('evaluates approval steps based on configurable rules', async () => {
      // Under default rules:
      // PO <= 50,000 SAR -> 1 step (Procurement Manager)
      // PO 50,000.01 - 250,000 SAR -> 2 steps (Procurement Manager + Finance Manager)
      // PO > 250,000 SAR -> 3 steps (Procurement + Finance + Admin)
      const stepsLow = await WorkflowService.determineSteps('PO', 35000);
      expect(stepsLow).toHaveLength(1);
      expect(stepsLow[0].roleCode).toBe(SYSTEM_ROLES.PROCUREMENT_MANAGER);

      const stepsMid = await WorkflowService.determineSteps('PO', 150000);
      expect(stepsMid).toHaveLength(2);
      expect(stepsMid[0].roleCode).toBe(SYSTEM_ROLES.PROCUREMENT_MANAGER);
      expect(stepsMid[1].roleCode).toBe(SYSTEM_ROLES.FINANCE_MANAGER);

      const stepsHigh = await WorkflowService.determineSteps('PO', 500000);
      expect(stepsHigh).toHaveLength(3);
      expect(stepsHigh[2].roleCode).toBe(SYSTEM_ROLES.ADMIN);
    });
  });
});
