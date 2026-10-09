import { db } from '../db';
import { AuditService } from './AuditService';
import { redactSnapshot } from '../security/auditRedaction';
import { DiagnosticLogger } from './DiagnosticLogger';
import type { AuditLog } from '../../types/models';

/**
 * SecurityMigrationService:
 * Executes one-time system boot migrations.
 * Scans for and cleans up legacy plain text credential records (such as INITIAL_ADMIN_OTP).
 * Scrubs historical audit logs of sensitive credentials, hashes, and salts.
 * Uses system action context for all audit operations.
 */
export class SecurityMigrationService {
  private static MIGRATION_SETTING_ID = 'set-migration-initial-otp-cleanup';
  private static AUDIT_SCRUB_SETTING_ID = 'set-migration-audit-scrub';

  static async run(): Promise<void> {
    await this.runOtpCleanupMigration();
    await this.runAuditScrubMigration();
  }

  private static async runOtpCleanupMigration(): Promise<void> {
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
      DiagnosticLogger.error('SecurityMigrationService', 'OTP cleanup migration failed', err);
    }
  }

  /**
   * This is the single sanctioned exception to the audit-is-append-only rule
   * and must run before any future hash chain is introduced.
   */
  static async runAuditScrubMigration(): Promise<number> {
    try {
      const alreadyRun = await db.settings.get(this.AUDIT_SCRUB_SETTING_ID);
      if (alreadyRun && alreadyRun.value === 'COMPLETED') {
        return 0;
      }

      let offset = 0;
      const batchSize = 500;
      let scrubbedRows = 0;

      while (true) {
        const batch = await db.auditLogs.offset(offset).limit(batchSize).toArray();
        if (batch.length === 0) break;

        const modifiedBatch: AuditLog[] = [];

        for (const row of batch) {
          if (row.before || row.after) {
            const { before: scrubbedBefore, after: scrubbedAfter } = redactSnapshot(
              row.before,
              row.after,
              { scrubMode: true }
            );

            const changed =
              JSON.stringify(row.before) !== JSON.stringify(scrubbedBefore) ||
              JSON.stringify(row.after) !== JSON.stringify(scrubbedAfter);

            if (changed) {
              row.before = (scrubbedBefore as Record<string, unknown> | null) ?? null;
              row.after = (scrubbedAfter as Record<string, unknown> | null) ?? null;
              modifiedBatch.push(row);
              scrubbedRows++;
            }
          }
        }

        if (modifiedBatch.length > 0) {
          await db.auditLogs.bulkPut(modifiedBatch);
        }

        offset += batch.length;
      }

      // Mark migration as completed
      await db.settings.put({
        id: this.AUDIT_SCRUB_SETTING_ID,
        key: 'SECURITY_MIGRATION_AUDIT_SCRUB',
        value: 'COMPLETED',
        category: 'security',
        description: 'تنقيح وتطهير سجلات التدقيق التاريخية من أسرار وبيانات الاعتماد',
        updatedAt: new Date().toISOString(),
        isDeleted: false,
      });

      // Write ONE summary audit entry with system context
      await AuditService.log({
        action: 'UPDATE',
        entity: 'auditLogs',
        entityId: 'audit-scrub-migration',
        system: true,
        userName: 'SecurityMigrationService',
        after: { scrubbedRows },
      });

      return scrubbedRows;
    } catch (err) {
      DiagnosticLogger.error('SecurityMigrationService', 'Audit scrub migration failed', err);
      return 0;
    }
  }
}
