import { db } from '../db';
import { AuditService } from './AuditService';

/**
 * SecurityMigrationService:
 * Executes one-time system boot migrations.
 * Scans for and cleans up legacy plain text credential records (such as INITIAL_ADMIN_OTP).
 * Uses system action context for all audit operations.
 */
export class SecurityMigrationService {
  private static MIGRATION_SETTING_ID = 'set-migration-initial-otp-cleanup';

  static async run(): Promise<void> {
    try {
      const alreadyRun = await db.settings.get(this.MIGRATION_SETTING_ID);
      if (alreadyRun && alreadyRun.value === 'COMPLETED') {
        return;
      }

      // Check if legacy INITIAL_ADMIN_OTP setting exists in db.settings
      const legacyOtpSetting = await db.settings.get('set-initial-admin-otp');
      if (legacyOtpSetting) {
        await db.settings.delete('set-initial-admin-otp');

        await AuditService.log({
          action: 'DELETE',
          entity: 'settings',
          entityId: 'set-initial-admin-otp',
          system: true,
          userName: 'SecurityMigrationService',
          before: { key: 'INITIAL_ADMIN_OTP' },
          after: null,
        });
      }

      // Also clean up by key if there are other records with key INITIAL_ADMIN_OTP
      const otherOtpSettings = await db.settings.where({ key: 'INITIAL_ADMIN_OTP' }).toArray();
      for (const row of otherOtpSettings) {
        await db.settings.delete(row.id);
      }

      // Mark migration as completed
      await db.settings.put({
        id: this.MIGRATION_SETTING_ID,
        key: 'SECURITY_MIGRATION_OTP_CLEANUP',
        value: 'COMPLETED',
        category: 'security',
        description: 'إزالة سجلات كلمات المرور النصية القديمة من قواعد البيانات',
        updatedAt: new Date().toISOString(),
        isDeleted: false,
      });
    } catch (err) {
      console.warn('SecurityMigrationService warning:', err);
    }
  }
}
