import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { generateRolesSql } from '../../scripts/generate-roles-sql';

describe('Role Drift & Migration 0013 Synchronization Test', () => {
  it('regenerates roles SQL in memory and matches committed 0013_roles_sync.sql exactly', () => {
    const generatedSql = generateRolesSql();
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/0013_roles_sync.sql');
    
    expect(fs.existsSync(migrationPath)).toBe(true);

    const committedSql = fs.readFileSync(migrationPath, 'utf8');

    // Normalize potential CRLF vs LF line endings
    const normalize = (str: string) => str.replace(/\r\n/g, '\n').trim();

    expect(normalize(generatedSql)).toBe(normalize(committedSql));
  });
});
