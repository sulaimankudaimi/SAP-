import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SYSTEM_ROLE_DEFINITIONS } from '../src/core/rbac/roleCatalog';

export function generateRolesSql(): string {
  const rolesList = Object.values(SYSTEM_ROLE_DEFINITIONS);

  const roleValues = rolesList
    .map(
      (r) =>
        `('${r.code}', '${r.name.replace(/'/g, "''")}', '${r.description.replace(/'/g, "''")}', ${r.isSystem})`
    )
    .join(',\n');

  const permRows: string[] = [];
  const validConditionPairs: string[] = [];

  for (const r of rolesList) {
    for (const p of r.permissions) {
      const amountStr = p.amountLimit !== undefined ? p.amountLimit.toFixed(2) : 'NULL';
      const plantLimitStr =
        p.plantLimit && p.plantLimit.length > 0
          ? `ARRAY[${p.plantLimit.map((pl) => `'${pl}'`).join(', ')}]`
          : 'NULL';
      const ccLimitStr =
        p.costCenterLimit && p.costCenterLimit.length > 0
          ? `ARRAY[${p.costCenterLimit.map((cc) => `'${cc}'`).join(', ')}]`
          : 'NULL';

      permRows.push(
        `('${r.code}', '${p.module}', '${p.activity}', ${plantLimitStr}, ${ccLimitStr}, ${amountStr})`
      );

      validConditionPairs.push(
        `(role_code = '${r.code}' AND module = '${p.module}' AND activity = '${p.activity}')`
      );
    }
  }

  const systemRoleCodes = rolesList.map((r) => `'${r.code}'`).join(', ');

  const sql = `-- ============================================================================
-- Migration: 0013_roles_sync.sql
-- Description: Deterministic synchronization of system roles and permissions
--              Generated automatically by scripts/generate-roles-sql.ts
-- Database: PostgreSQL 15+ (Supabase / Self-Hosted)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Idempotent Upsert of System Roles
-- ----------------------------------------------------------------------------
INSERT INTO public.roles (code, name, description, is_system) VALUES
${roleValues}
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_system = EXCLUDED.is_system;

-- ----------------------------------------------------------------------------
-- 2. Idempotent Upsert of Role Permissions
-- ----------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_code, module, activity, plant_limit, cost_center_limit, amount_limit) VALUES
${permRows.join(',\n')}
ON CONFLICT (role_code, module, activity) DO UPDATE SET
    plant_limit = EXCLUDED.plant_limit,
    cost_center_limit = EXCLUDED.cost_center_limit,
    amount_limit = EXCLUDED.amount_limit;

-- ----------------------------------------------------------------------------
-- 3. Cleanup: Remove Stale Permissions for Managed System Roles
-- ----------------------------------------------------------------------------
DELETE FROM public.role_permissions
WHERE role_code IN (${systemRoleCodes})
  AND NOT (
      ${validConditionPairs.join('\n      OR ')}
  );
`;

  return sql;
}

// CLI Execution Entry Point
const currentFilePath = fileURLToPath(import.meta.url);
const invokedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (currentFilePath === invokedFilePath) {
  const sql = generateRolesSql();
  const outputPath = path.resolve(process.cwd(), 'supabase/migrations/0013_roles_sync.sql');
  fs.writeFileSync(outputPath, sql, 'utf8');
  console.log(`✓ Migration generated successfully: ${outputPath}`);
}
