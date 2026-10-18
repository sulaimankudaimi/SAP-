import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createFreshDatabase,
  destroyDatabase,
  asUser,
  createProfile,
  type TestDatabaseHandle,
} from './helpers';
import { seedReferenceData, type SeededFixtures } from './fixtures';

describe('Database Role Matrix & Permission Invariants', () => {
  let dbHandle: TestDatabaseHandle;
  let fixtures: SeededFixtures;

  let fleetMgrId: string;
  let accountantId: string;
  let whClerkId: string;
  let viewerId: string;
  let auditorId: string;

  beforeAll(async () => {
    dbHandle = await createFreshDatabase('perm_suite');
    fixtures = await seedReferenceData(dbHandle.adminClient);

    fleetMgrId = await createProfile(dbHandle.adminClient, {
      username: 'flt_mgr_perm',
      roleCode: 'FLEET_MANAGER',
      plantCodes: ['1100'],
    });

    accountantId = await createProfile(dbHandle.adminClient, {
      username: 'acc_perm',
      roleCode: 'ACCOUNTANT',
      plantCodes: ['1100', '1200'],
    });

    whClerkId = await createProfile(dbHandle.adminClient, {
      username: 'wh_clerk_perm',
      roleCode: 'WAREHOUSE_CLERK',
      plantCodes: ['1100'],
    });

    viewerId = await createProfile(dbHandle.adminClient, {
      username: 'viewer_perm',
      roleCode: 'VIEWER',
      plantCodes: ['1100'],
    });

    auditorId = await createProfile(dbHandle.adminClient, {
      username: 'auditor_perm',
      roleCode: 'AUDITOR',
      plantCodes: ['1100', '1200', '1300'],
    });
  });

  afterAll(async () => {
    if (dbHandle) {
      await destroyDatabase(dbHandle);
    }
  });

  it('Invariant: fleet manager can dispatch trips, create fuel logs, and report maintenance', async () => {
    await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      // 1. Create trip - ALLOWED
      const tripRes = await client.query(
        'SELECT public.create_trip($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) AS trip;',
        [
          crypto.randomUUID(),
          fixtures.vehicles.riyadhTankerId,
          fixtures.drivers.validDriver1Id,
          '1100',
          'Riyadh Terminal',
          'Diesel',
          30000,
          new Date().toISOString(),
          new Date().toISOString(),
          150000,
          null,
          null,
        ]
      );
      expect(tripRes.rows[0].trip).toBeDefined();

      // 2. Create fuel log - ALLOWED
      const fuelRes = await client.query(
        'SELECT public.create_fuel_log($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) AS fuel;',
        [
          crypto.randomUUID(),
          fixtures.vehicles.riyadhTankerId,
          fixtures.drivers.validDriver1Id,
          'Diesel',
          400,
          1.15,
          150100,
          'Station 1',
          '1100',
          null,
        ]
      );
      expect(fuelRes.rows[0].fuel).toBeDefined();

      // 3. Post manual journal directly - DENIED (Requires FI_POST)
      await expect(
        client.query(
          'SELECT public.post_journal($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);',
          [
            crypto.randomUUID(),
            '1000',
            '2026',
            10,
            currentDateString(),
            currentDateString(),
            'SA',
            'Test Manual Journal',
            null,
            JSON.stringify([
              { line_number: 1, posting_key: '40', account_number: '601010', debit: 500, credit: 0 },
              { line_number: 2, posting_key: '50', account_number: '101010', debit: 0, credit: 500 },
            ]),
          ]
        )
      ).rejects.toThrow(/غير مصرح|صلاحيات|permission/i);
    });
  });

  it('Invariant: accountant can post journals and read fleet data, but cannot dispatch trips', async () => {
    await asUser(dbHandle.pool, accountantId, async (client) => {
      // 1. Post journal - ALLOWED
      const jeRes = await client.query(
        'SELECT public.post_journal($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) AS je;',
        [
          crypto.randomUUID(),
          '1000',
          '2026',
          10,
          currentDateString(),
          currentDateString(),
          'SA',
          'Accountant Test Entry',
          'REF-ACC-01',
          JSON.stringify([
            { line_number: 1, posting_key: '40', account_number: '601010', debit: 1200, credit: 0 },
            { line_number: 2, posting_key: '50', account_number: '201010', debit: 0, credit: 1200 },
          ]),
        ]
      );
      expect(jeRes.rows[0].je).toBeDefined();

      // 2. Dispatch trip - DENIED (Requires TM_CREATE)
      await expect(
        client.query(
          'SELECT public.create_trip($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);',
          [
            crypto.randomUUID(),
            fixtures.vehicles.riyadhTankerId,
            fixtures.drivers.validDriver1Id,
            '1100',
            'Al-Kharj',
            'Diesel',
            30000,
            new Date().toISOString(),
            new Date().toISOString(),
            150000,
            null,
            null,
          ]
        )
      ).rejects.toThrow(/غير مصرح|صلاحيات|permission/i);
    });
  });

  it('Invariant: warehouse clerk can issue parts to maintenance order but cannot dispatch trips or post journals', async () => {
    // First, create a maintenance order as admin/system
    const moId = crypto.randomUUID();
    await dbHandle.adminClient.query(`
      INSERT INTO public.maintenance_orders (id, doc_number, vehicle_id, vehicle_plate, order_type, description, start_date, created_by)
      VALUES ($1, 'MO-TEST-WH', $2, 'أ ب ج 1101', 'Corrective', 'Brake overhaul', current_date, 'system');
    `, [moId, fixtures.vehicles.riyadhTankerId]);

    await asUser(dbHandle.pool, whClerkId, async (client) => {
      // 1. Issue parts to maintenance order - ALLOWED (WM_POST)
      const issueRes = await client.query(
        'SELECT public.issue_parts_to_maintenance_order($1, $2, $3, $4, $5, $6, $7) AS doc;',
        [
          crypto.randomUUID(),
          'MO-TEST-WH',
          '1100',
          'SL01',
          'Issue parts for brakes',
          JSON.stringify([
            { material_code: fixtures.materials.filter, quantity: 2 },
          ]),
          null,
        ]
      );
      expect(issueRes.rows[0].doc).toBeDefined();

      // 2. Dispatch trip - DENIED
      await expect(
        client.query(
          'SELECT public.create_trip($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);',
          [
            crypto.randomUUID(),
            fixtures.vehicles.riyadhTankerId,
            fixtures.drivers.validDriver1Id,
            '1100',
            'Yanbu',
            'Diesel',
            30000,
            new Date().toISOString(),
            new Date().toISOString(),
            150000,
            null,
            null,
          ]
        )
      ).rejects.toThrow(/غير مصرح|صلاحيات|permission/i);
    });
  });

  it('Invariant: viewer has read-only access to authorized plant data and cannot mutate any tables', async () => {
    await asUser(dbHandle.pool, viewerId, async (client) => {
      // 1. Read vehicles - ALLOWED
      const res = await client.query('SELECT count(*) FROM public.vehicles;');
      expect(parseInt(res.rows[0].count, 10)).toBeGreaterThan(0);

      // 2. Dispatch trip - DENIED
      await expect(
        client.query(
          'SELECT public.create_trip($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);',
          [
            crypto.randomUUID(),
            fixtures.vehicles.riyadhTankerId,
            fixtures.drivers.validDriver1Id,
            '1100',
            'Al-Kharj',
            'Diesel',
            30000,
            new Date().toISOString(),
            new Date().toISOString(),
            150000,
            null,
            null,
          ]
        )
      ).rejects.toThrow(/غير مصرح|صلاحيات|permission/i);

      // 3. Create fuel log - DENIED
      await expect(
        client.query(
          'SELECT public.create_fuel_log($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);',
          [
            crypto.randomUUID(),
            fixtures.vehicles.riyadhTankerId,
            fixtures.drivers.validDriver1Id,
            'Diesel',
            300,
            1.15,
            150200,
            'Station 1',
            '1100',
            null,
          ]
        )
      ).rejects.toThrow(/غير مصرح|صلاحيات|permission/i);
    });
  });

  it('Invariant: auditor can inspect audit logs, integrity reports, and operational records without write access', async () => {
    await asUser(dbHandle.pool, auditorId, async (client) => {
      // 1. Read audit logs - ALLOWED
      const auditRes = await client.query('SELECT count(*) FROM public.audit_logs;');
      expect(auditRes.rows).toBeDefined();

      // 2. Read integrity report - ALLOWED
      const reportRes = await client.query('SELECT public.integrity_report() AS report;');
      expect(reportRes.rows[0].report).toBeDefined();

      // 3. Mutate data - DENIED
      await expect(
        client.query(
          'SELECT public.create_trip($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);',
          [
            crypto.randomUUID(),
            fixtures.vehicles.riyadhTankerId,
            fixtures.drivers.validDriver1Id,
            '1100',
            'Yanbu',
            'Diesel',
            30000,
            new Date().toISOString(),
            new Date().toISOString(),
            150000,
            null,
            null,
          ]
        )
      ).rejects.toThrow(/غير مصرح|صلاحيات|permission/i);
    });
  });

  it('Invariant: plant-restricted user cannot omit the plant to bypass the restriction', async () => {
    // User fleetMgrId has plant_codes = ['1100']
    await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      // 1. Calling command with another plant '1200' is DENIED
      await expect(
        client.query(
          'SELECT public.create_trip($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);',
          [
            crypto.randomUUID(),
            fixtures.vehicles.yanbuTankerId,
            fixtures.drivers.validDriver2Id,
            '1200', // Unauthorized plant
            'Jeddah Terminal',
            'Diesel',
            30000,
            new Date().toISOString(),
            new Date().toISOString(),
            80000,
            null,
            null,
          ]
        )
      ).rejects.toThrow(/غير مصرح لك بالعمل على المحطة|صلاحيات|permission/i);

      // 2. Checking has_permission directly with NULL plant fails closed
      const checkNullRes = await client.query(
        "SELECT public.has_permission('TM', 'create', NULL) AS allowed;"
      );
      expect(checkNullRes.rows[0].allowed).toBe(false);

      // 3. Checking has_permission with allowed plant '1100' succeeds
      const checkAllowedRes = await client.query(
        "SELECT public.has_permission('TM', 'create', '1100') AS allowed;"
      );
      expect(checkAllowedRes.rows[0].allowed).toBe(true);
    });
  });
});

function currentDateString(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
