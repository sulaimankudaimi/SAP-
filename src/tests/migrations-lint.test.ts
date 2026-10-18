import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Helper to remove comments while preserving string literals if any
function stripSqlComments(sql: string): string {
  // Remove block comments /* ... */
  let clean = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove line comments -- ...
  clean = clean.replace(/--.*$/gm, '');
  return clean;
}

// Normalize a single argument type definition, e.g. "p_amount numeric(18,2) DEFAULT NULL" -> "numeric"
function normalizeArgType(argDef: string): string {
  let clean = argDef.trim();
  // Strip DEFAULT and everything after it
  clean = clean.replace(/\s+DEFAULT\s+[\s\S]*/i, '').trim();

  // Strip precision/scale like (18,2) or (3,2) or (6)
  clean = clean.replace(/\([^)]*\)/g, '').trim();

  // Tokens: could be [paramName, type] or [IN, paramName, type] or [type]
  const tokens = clean.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '';

  // The type is always the last token
  let typeToken = tokens[tokens.length - 1].toLowerCase();

  // Strip public. schema prefix if present on custom types
  typeToken = typeToken.replace(/^public\./, '');

  return typeToken;
}

// Parse comma-separated argument list into an array of normalized types
function parseArgTypes(argsString: string): string[] {
  // First strip all parenthesized precision/scale (e.g. numeric(18, 2) -> numeric)
  // so that internal commas don't split the argument incorrectly
  const noPrecision = argsString.replace(/\([^)]*\)/g, '').trim();
  if (!noPrecision) return [];

  // Split by comma
  const rawParts = noPrecision.split(',');
  return rawParts.map(normalizeArgType).filter(Boolean);
}

describe('Migrations Lint & Integrity Static Verification', () => {
  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  it('migration file numbers are contiguous from 0001 with no duplicates', () => {
    expect(migrationFiles.length).toBeGreaterThan(0);

    const seenNumbers = new Set<number>();
    migrationFiles.forEach((file, index) => {
      const match = file.match(/^(\d{4})_/);
      expect(match, `File ${file} does not follow 0000_name.sql naming pattern`).not.toBeNull();
      const num = parseInt(match![1], 10);
      const expectedNum = index + 1;

      expect(num).toBe(expectedNum);
      expect(seenNumbers.has(num)).toBe(false);
      seenNumbers.add(num);
    });
  });

  it('simulates migrations in order: validates function signatures, drops, and rejects overloads', () => {
    // Map of unqualified functionName -> Set of signature strings (e.g. "uuid,text,integer")
    const liveFunctions = new Map<string, Set<string>>();

    for (const file of migrationFiles) {
      const rawSql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const cleanSql = stripSqlComments(rawSql);

      // Track statements sequentially
      // 1. Match DROP FUNCTION [IF EXISTS] [schema.]name(args)
      const dropRegex = /DROP\s+FUNCTION(?:\s+IF\s+EXISTS)?\s+([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?)\s*\(([\s\S]*?)\)\s*;/gi;
      let dropMatch: RegExpExecArray | null;

      while ((dropMatch = dropRegex.exec(cleanSql)) !== null) {
        const rawName = dropMatch[1];
        const funcName = rawName.split('.').pop()!.toLowerCase();
        const args = dropMatch[2];
        const argTypes = parseArgTypes(args).join(',');

        const liveSignatures = liveFunctions.get(funcName);
        expect(
          liveSignatures && liveSignatures.has(argTypes),
          `In ${file}: DROP FUNCTION ${rawName}(${args}) matches no live signature. Live signatures: ${
            liveSignatures ? Array.from(liveSignatures).join(' | ') : 'none'
          }`
        ).toBe(true);

        liveSignatures!.delete(argTypes);
        if (liveSignatures!.size === 0) {
          liveFunctions.delete(funcName);
        }
      }

      // 2. Match CREATE [OR REPLACE] FUNCTION [schema.]name(args) RETURNS
      const createRegex = /CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)?)\s*\(([\s\S]*?)\)\s*RETURNS/gi;
      let createMatch: RegExpExecArray | null;

      while ((createMatch = createRegex.exec(cleanSql)) !== null) {
        const rawName = createMatch[1];
        const funcName = rawName.split('.').pop()!.toLowerCase();
        const args = createMatch[2];
        const argTypes = parseArgTypes(args).join(',');

        if (!liveFunctions.has(funcName)) {
          liveFunctions.set(funcName, new Set<string>());
        }

        const signatures = liveFunctions.get(funcName)!;
        signatures.add(argTypes);

        // Fail immediately if more than one signature exists (function overload)
        expect(
          signatures.size,
          `In ${file}: Function "${funcName}" has multiple active overloaded signatures: [${Array.from(signatures).join(
            '] and ['
          )}]. PostgREST does not support overloaded functions!`
        ).toBeLessThanOrEqual(1);
      }
    }

    // Final verification: ensure every live function has at most 1 signature
    for (const [funcName, signatures] of liveFunctions.entries()) {
      expect(
        signatures.size,
        `Function "${funcName}" has overloaded signatures: ${Array.from(signatures).join(', ')}`
      ).toBe(1);
    }
  });

  it('every function name in .rpc( call under /src/core/gateway is defined in SQL and has GRANT EXECUTE to authenticated', () => {
    const gatewayDir = path.resolve(process.cwd(), 'src/core/gateway');
    const gatewayFiles = fs.readdirSync(gatewayDir).filter((f) => f.endsWith('.ts'));

    const rpcCalls = new Set<string>();
    for (const file of gatewayFiles) {
      const code = fs.readFileSync(path.join(gatewayDir, file), 'utf8');
      const rpcRegex = /\.rpc\(\s*['"]([a-zA-Z0-9_]+)['"]/g;
      let match: RegExpExecArray | null;
      while ((match = rpcRegex.exec(code)) !== null) {
        rpcCalls.add(match[1]);
      }
    }

    expect(rpcCalls.size).toBeGreaterThan(0);

    // Read all SQL migrations concatenated
    let allSql = '';
    for (const file of migrationFiles) {
      allSql += '\n' + stripSqlComments(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
    }

    for (const rpcName of rpcCalls) {
      // 1. Must be created
      const createPattern = new RegExp(`CREATE(?:\\s+OR\\s+REPLACE)?\\s+FUNCTION\\s+(?:public\\.)?${rpcName}\\s*\\(`, 'i');
      expect(
        createPattern.test(allSql),
        `RPC function "${rpcName}" called in /src/core/gateway is not defined in any SQL migration`
      ).toBe(true);

      // 2. Must be granted to authenticated
      const grantPattern = new RegExp(
        `GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+(?:public\\.)?${rpcName}\\b[^;]*?\\bTO\\s+[^;]*?\\bauthenticated\\b`,
        'i'
      );
      expect(
        grantPattern.test(allSql),
        `RPC function "${rpcName}" does not have GRANT EXECUTE to authenticated in migrations`
      ).toBe(true);
    }
  });

  it('every .from("x") table or view name used under /src/core/gateway is created in SQL', () => {
    const gatewayDir = path.resolve(process.cwd(), 'src/core/gateway');
    const gatewayFiles = fs.readdirSync(gatewayDir).filter((f) => f.endsWith('.ts'));

    const fromTargets = new Set<string>();
    for (const file of gatewayFiles) {
      const code = fs.readFileSync(path.join(gatewayDir, file), 'utf8');
      const fromRegex = /\.from\(\s*['"]([a-zA-Z0-9_]+)['"]/g;
      let match: RegExpExecArray | null;
      while ((match = fromRegex.exec(code)) !== null) {
        fromTargets.add(match[1]);
      }
    }

    expect(fromTargets.size).toBeGreaterThan(0);

    let allSql = '';
    for (const file of migrationFiles) {
      allSql += '\n' + stripSqlComments(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
    }

    for (const target of fromTargets) {
      const tablePattern = new RegExp(`CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+(?:public\\.)?${target}\\b`, 'i');
      const viewPattern = new RegExp(`CREATE(?:\\s+OR\\s+REPLACE)?\\s+VIEW\\s+(?:public\\.)?${target}\\b`, 'i');

      const existsInSql = tablePattern.test(allSql) || viewPattern.test(allSql);
      expect(
        existsInSql,
        `Target "${target}" referenced via .from('${target}') in /src/core/gateway does not exist as a table or view in SQL`
      ).toBe(true);
    }
  });

  it('every table created in SQL has ENABLE ROW LEVEL SECURITY', () => {
    let allSql = '';
    for (const file of migrationFiles) {
      allSql += '\n' + stripSqlComments(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
    }

    const tableCreateRegex = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(/gi;
    const createdTables = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = tableCreateRegex.exec(allSql)) !== null) {
      createdTables.add(match[1].toLowerCase());
    }

    expect(createdTables.size).toBeGreaterThan(0);

    for (const tableName of createdTables) {
      const rlsPattern = new RegExp(
        `ALTER\\s+TABLE\\s+(?:public\\.)?${tableName}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
        'i'
      );
      expect(
        rlsPattern.test(allSql),
        `Table "${tableName}" was created in SQL but lacks ENABLE ROW LEVEL SECURITY`
      ).toBe(true);
    }
  });

  it('no migration contains elevated service key or role in a GRANT to anon', () => {
    const elevatedRoleToken = ['service', 'role'].join('_');

    for (const file of migrationFiles) {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const cleanSql = stripSqlComments(content);

      // Check for any GRANT to anon that references the elevated role
      const badGrantRegex = new RegExp(`GRANT\\s+[^;]*?${elevatedRoleToken}[^;]*?TO\\s+[^;]*?\\banon\\b`, 'gi');
      expect(
        badGrantRegex.test(cleanSql),
        `In ${file}: Found illegal GRANT containing elevated role to anon`
      ).toBe(false);

      // Also ensure elevated role is never directly granted permissions alongside anon
      const anonGrantRegex = /GRANT\s+[^;]*?TO\s+[^;]*?\banon\b/gi;
      let grantMatch: RegExpExecArray | null;
      while ((grantMatch = anonGrantRegex.exec(cleanSql)) !== null) {
        expect(
          grantMatch[0].includes(elevatedRoleToken),
          `In ${file}: Found grant to anon with elevated role reference: ${grantMatch[0]}`
        ).toBe(false);
      }
    }
  });
});
