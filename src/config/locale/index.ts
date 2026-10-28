import {
  SYRIA_LOCALE,
  type LocalePack,
  type GovernorateInfo,
  type LocalePlantInfo,
  type LocaleStorageLocationInfo,
  type LocaleSiteInfo,
  type LocaleSiteType,
} from './syria';

export const LOCALE: LocalePack = SYRIA_LOCALE;

export interface TechnicalIdEntry {
  readonly identifier: string;
  readonly location: string;
  readonly reason: string;
}

/**
 * Technical identifiers preserved strictly per specification.
 * These identifiers must NOT be renamed to prevent breaking existing client storage,
 * desktop build identifiers, and backup compatibility.
 */
export const TECHNICAL_IDS_ALLOWLIST: readonly TechnicalIdEntry[] = [
  {
    identifier: 'gulf_erp',
    location: 'src/core/db/index.ts',
    reason: 'IndexedDB Dexie database name; kept to preserve existing client-side offline storage without breaking active installations.',
  },
  {
    identifier: 'gulf-energy-erp',
    location: 'package.json',
    reason: 'npm package name in package.json; preserved for packaging scripts, build tools, and dependency stability.',
  },
  {
    identifier: 'com.gulfenergy.erp',
    location: 'package.json',
    reason: 'Electron native application ID; preserved for desktop OS bundle identification and application signature stability.',
  },
  {
    identifier: 'gerp',
    location: 'src/modules/admin/services/BackupService.ts',
    reason: 'Backup file extension (.gerp); preserved for backward compatibility of encrypted backup archives.',
  },
] as const;

export type {
  LocalePack,
  GovernorateInfo,
  LocalePlantInfo,
  LocaleStorageLocationInfo,
  LocaleSiteInfo,
  LocaleSiteType,
};
