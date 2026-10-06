import { db } from '../../../core/db';
import { requirePermission } from '../../../core/security/SessionContext';
import { AuditService } from '../../../core/services/AuditService';
import { saveFileUniversal } from '../../../core/utils/fileDownloader';

export interface BackupHeader {
  magic: 'GULF_ERP_ENCRYPTED_BACKUP';
  version: '2.4';
  createdAt: string;
  saltHex: string;
  ivHex: string;
  iterations: number;
  checksumSha256: string;
  tableCounts: Record<string, number>;
  totalRecords: number;
}

export interface BackupContainer {
  header: BackupHeader;
  ciphertextHex: string;
}

export interface RestorePreview {
  tableCounts: Record<string, { current: number; backup: number }>;
  totalBackupRecords: number;
  totalCurrentRecords: number;
  backupDate: string;
  backupVersion: string;
}

function getWebCrypto(): Crypto {
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  throw new Error('Web Crypto API is not available in this environment');
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(data: string): Promise<string> {
  const cryptoApi = getWebCrypto();
  const buffer = new TextEncoder().encode(data);
  const hashBuffer = await cryptoApi.subtle.digest('SHA-256', buffer);
  return bytesToHex(new Uint8Array(hashBuffer));
}

async function deriveAesKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const cryptoApi = getWebCrypto();
  const enc = new TextEncoder();
  const baseKey = await cryptoApi.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return cryptoApi.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export class BackupService {
  private static readonly MAGIC = 'GULF_ERP_ENCRYPTED_BACKUP';
  private static readonly FORMAT_VERSION = '2.4';
  private static readonly PBKDF2_ITERATIONS = 210000; // Spec requirement: >= 210,000 iterations

  /**
   * Serializes a record converting Blobs or ArrayBuffers to base64
   */
  private static async serializeRecord(record: Record<string, unknown>): Promise<Record<string, unknown>> {
    const copy = { ...record };
    for (const [key, value] of Object.entries(copy)) {
      if (value instanceof Blob) {
        const buffer = await value.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        copy[key] = {
          __isSerializedBlob: true,
          mimeType: value.type,
          base64,
        };
      } else if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
        const uint = value instanceof Uint8Array ? value : new Uint8Array(value);
        const base64 = btoa(String.fromCharCode(...uint));
        copy[key] = {
          __isSerializedBinary: true,
          base64,
        };
      }
    }
    return copy;
  }

  /**
   * Deserializes a record converting base64 back to Blobs or Uint8Arrays
   */
  private static deserializeRecord(record: Record<string, unknown>): Record<string, unknown> {
    const copy = { ...record };
    for (const [key, value] of Object.entries(copy)) {
      if (value && typeof value === 'object') {
        const valObj = value as Record<string, unknown>;
        if (valObj.__isSerializedBlob && typeof valObj.base64 === 'string') {
          const binaryStr = atob(valObj.base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          copy[key] = new Blob([bytes], { type: String(valObj.mimeType || '') });
        } else if (valObj.__isSerializedBinary && typeof valObj.base64 === 'string') {
          const binaryStr = atob(valObj.base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          copy[key] = bytes;
        }
      }
    }
    return copy;
  }

  /**
   * Exports all Dexie tables encrypted with AES-256-GCM.
   */
  static async createEncryptedBackup(passphrase: string, filename?: string): Promise<{
    filename: string;
    container: BackupContainer;
    totalRecords: number;
    tableCounts: Record<string, number>;
  }> {
    requirePermission({ module: 'ADM', activity: 'create' });

    if (!passphrase || passphrase.length < 8) {
      throw new Error('كلمة مرور التشفير يجب أن لا تقل عن 8 خانات.');
    }

    const cryptoApi = getWebCrypto();
    const tableCounts: Record<string, number> = {};
    const databaseDump: Record<string, Record<string, unknown>[]> = {};
    let totalRecords = 0;

    // 1. Extract all tables from Dexie
    for (const table of db.tables) {
      const rows = await table.toArray();
      tableCounts[table.name] = rows.length;
      totalRecords += rows.length;

      const serializedRows: Record<string, unknown>[] = [];
      for (const row of rows) {
        serializedRows.push(await this.serializeRecord(row as unknown as Record<string, unknown>));
      }
      databaseDump[table.name] = serializedRows;
    }

    // 2. Compute payload JSON and SHA-256 checksum
    const jsonPayload = JSON.stringify(databaseDump);
    const checksumSha256 = await sha256Hex(jsonPayload);

    // 3. Generate salt & IV
    const salt = new Uint8Array(new ArrayBuffer(16));
    const iv = new Uint8Array(new ArrayBuffer(12)); // Standard 96-bit IV for AES-GCM
    cryptoApi.getRandomValues(salt);
    cryptoApi.getRandomValues(iv);

    // 4. Derive AES-GCM-256 key via PBKDF2
    const key = await deriveAesKey(passphrase, salt, this.PBKDF2_ITERATIONS);

    // 5. Encrypt with AES-GCM
    const ciphertextBuffer = await cryptoApi.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(jsonPayload)
    );
    const ciphertextHex = bytesToHex(new Uint8Array(ciphertextBuffer));

    const now = new Date().toISOString();
    const header: BackupHeader = {
      magic: this.MAGIC,
      version: this.FORMAT_VERSION,
      createdAt: now,
      saltHex: bytesToHex(salt),
      ivHex: bytesToHex(iv),
      iterations: this.PBKDF2_ITERATIONS,
      checksumSha256,
      tableCounts,
      totalRecords,
    };

    const container: BackupContainer = {
      header,
      ciphertextHex,
    };

    const defaultFilename = `gulf_erp_backup_${now.slice(0, 10)}_${Date.now()}.gerp`;
    const targetFilename = filename || defaultFilename;

    // 6. Save via Universal File Downloader
    const backupJsonString = JSON.stringify(container, null, 2);
    await saveFileUniversal(targetFilename, backupJsonString, [
      { name: 'Gulf Energy ERP Encrypted Backup', extensions: ['gerp', 'bak', 'json'] },
    ]);

    // 7. Update last backup timestamp setting
    await db.settings.put({
      id: 'set-last-backup-timestamp',
      key: 'LAST_BACKUP_TIMESTAMP',
      value: now,
      category: 'system',
      description: 'تاريخ آخر نسخة احتياطية مشفرة للنظام',
      updatedAt: now,
      isDeleted: false,
    });

    await AuditService.log({
      action: 'CREATE',
      entity: 'DatabaseBackup',
      entityId: targetFilename,
      after: {
        totalRecords,
        tablesCount: Object.keys(tableCounts).length,
        checksum: checksumSha256,
      },
    });

    return {
      filename: targetFilename,
      container,
      totalRecords,
      tableCounts,
    };
  }

  /**
   * Decrypts and validates backup container without executing restore,
   * returning a table-by-table record count comparison preview.
   */
  static async previewBackup(
    backupFileContent: string,
    passphrase: string
  ): Promise<{ preview: RestorePreview; decryptedPayload: Record<string, Record<string, unknown>[]> }> {
    requirePermission({ module: 'ADM', activity: 'view' });

    let container: BackupContainer;
    try {
      container = JSON.parse(backupFileContent);
    } catch {
      throw new Error('ملف النسخة الاحتياطية غير صالح أو تالف (JSON parse failed).');
    }

    const { header, ciphertextHex } = container;
    if (!header || header.magic !== this.MAGIC) {
      throw new Error('تنسيق ملف النسخة الاحتياطية غير معتمد (Invalid Magic Header).');
    }

    if (!ciphertextHex || !header.saltHex || !header.ivHex) {
      throw new Error('بيانات التشفير أو الترويسة ناقصة في الملف.');
    }

    const cryptoApi = getWebCrypto();
    const salt = hexToBytes(header.saltHex);
    const iv = hexToBytes(header.ivHex);
    const ciphertext = hexToBytes(ciphertextHex);

    // Derive key with given passphrase
    const key = await deriveAesKey(passphrase, salt, header.iterations || this.PBKDF2_ITERATIONS);

    // Decrypt AES-GCM
    let decryptedBuffer: ArrayBuffer;
    try {
      decryptedBuffer = await cryptoApi.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );
    } catch {
      throw new Error('كلمة المرور غير صحيحة، أو الملف المشفر تم العبث به (Decryption Failed).');
    }

    const jsonPayload = new TextDecoder().decode(decryptedBuffer);

    // Verify Checksum
    const computedChecksum = await sha256Hex(jsonPayload);
    if (computedChecksum !== header.checksumSha256) {
      throw new Error('فشل فحص البصمة الرقمية (Checksum Mismatch): محتوى الملف لا يطابق البصمة.');
    }

    const databaseDump = JSON.parse(jsonPayload) as Record<string, Record<string, unknown>[]>;

    // Calculate current counts
    const tableCounts: Record<string, { current: number; backup: number }> = {};
    let totalCurrent = 0;
    let totalBackup = 0;

    for (const table of db.tables) {
      const currentCount = await table.count();
      const backupCount = databaseDump[table.name]?.length || 0;
      tableCounts[table.name] = { current: currentCount, backup: backupCount };
      totalCurrent += currentCount;
      totalBackup += backupCount;
    }

    return {
      preview: {
        tableCounts,
        totalBackupRecords: totalBackup,
        totalCurrentRecords: totalCurrent,
        backupDate: header.createdAt,
        backupVersion: header.version,
      },
      decryptedPayload: databaseDump,
    };
  }

  /**
   * Restores database from decrypted payload inside a single Dexie transaction,
   * taking an automatic pre-restore snapshot and rolling back on any failure.
   */
  static async executeRestore(
    decryptedPayload: Record<string, Record<string, unknown>[]>,
    backupDate: string
  ): Promise<{ success: boolean; restoredTables: number; restoredRecords: number }> {
    requirePermission({ module: 'ADM', activity: 'create' });

    // 1. Take in-memory pre-restore snapshot of all tables
    const preRestoreSnapshot: Record<string, unknown[]> = {};
    for (const table of db.tables) {
      preRestoreSnapshot[table.name] = await table.toArray();
    }

    let restoredRecords = 0;
    let restoredTables = 0;

    try {
      // 2. Perform restoration inside a single atomic Dexie transaction
      await db.transaction('rw', db.tables, async () => {
        for (const table of db.tables) {
          const rows = decryptedPayload[table.name];
          if (rows && Array.isArray(rows)) {
            await table.clear();
            const deserializedRows = rows.map((r) => this.deserializeRecord(r));
            if (deserializedRows.length > 0) {
              await table.bulkAdd(deserializedRows);
            }
            restoredRecords += deserializedRows.length;
            restoredTables++;
          }
        }
      });

      await AuditService.log({
        action: 'UPDATE',
        entity: 'DatabaseRestore',
        entityId: `RESTORE-${Date.now()}`,
        after: {
          restoredTables,
          restoredRecords,
          backupDate,
        },
      });

      return {
        success: true,
        restoredTables,
        restoredRecords,
      };
    } catch (restoreErr) {
      console.error('Database restore transaction failed, initiating automatic rollback...', restoreErr);

      // Rollback to pre-restore snapshot
      try {
        await db.transaction('rw', db.tables, async () => {
          for (const table of db.tables) {
            const originalRows = preRestoreSnapshot[table.name];
            await table.clear();
            if (originalRows && originalRows.length > 0) {
              await table.bulkAdd(originalRows);
            }
          }
        });
      } catch (rollbackErr) {
        console.error('Critical rollback failure:', rollbackErr);
      }

      const msg = restoreErr instanceof Error ? restoreErr.message : 'فشل غير متوقع أثناء استعادة البيانات';
      throw new Error(`فشلت عملية الاستعادة وتم التراجع تلقائياً عن التغييرات: ${msg}`);
    }
  }

  /**
   * Checks if backup reminder is due (older than N days or never backed up).
   */
  static async checkBackupReminder(): Promise<{
    needsReminder: boolean;
    daysSinceLastBackup: number | null;
    reminderDays: number;
    lastBackupDate: string | null;
  }> {
    const lastBackupSetting = await db.settings.where('key').equals('LAST_BACKUP_TIMESTAMP').first();
    const reminderSetting = await db.settings.where('key').equals('BACKUP_REMINDER_DAYS').first();

    const reminderDays = reminderSetting?.value ? parseInt(reminderSetting.value, 10) : 7;
    const lastBackupDate = lastBackupSetting?.value || null;

    if (!lastBackupDate) {
      return {
        needsReminder: true,
        daysSinceLastBackup: null,
        reminderDays,
        lastBackupDate: null,
      };
    }

    const diffMs = Date.now() - new Date(lastBackupDate).getTime();
    const daysSince = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return {
      needsReminder: daysSince >= reminderDays,
      daysSinceLastBackup: daysSince,
      reminderDays,
      lastBackupDate,
    };
  }
}
