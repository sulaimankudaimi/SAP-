import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createFreshDatabase,
  destroyDatabase,
  asUser,
  createProfile,
  type TestDatabaseHandle,
} from './helpers';
import { seedReferenceData, type SeededFixtures } from './fixtures';

describe('Database Concurrency & Locking Invariants', () => {
  let dbHandle: TestDatabaseHandle;
  let fixtures: SeededFixtures;
  let fleetMgrId: string;
  let whClerkId: string;

  beforeAll(async () => {
    dbHandle = await createFreshDatabase('concurrency_suite');
    fixtures = await seedReferenceData(dbHandle.adminClient);

    fleetMgrId = await createProfile(dbHandle.adminClient, {
      username: 'flt_mgr_conc',
      roleCode: 'FLEET_MANAGER',
      plantCodes: ['1100', '1200'],
    });

    whClerkId = await createProfile(dbHandle.adminClient, {
      username: 'wh_clerk_conc',
      roleCode: 'WAREHOUSE_CLERK',
      plantCodes: ['1100'],
    });
  });

  afterAll(async () => {
    if (dbHandle) {
      await destroyDatabase(dbHandle);
    }
  });

  it('Invariant: 50 parallel next_doc_number-backed commands give 50 distinct, gap-free numbers', async () => {
    // Execute 50 parallel calls across pooled connections
    const tasks = Array.from({ length: 50 }).map(() =>
      asUser(dbHandle.pool, fleetMgrId, async (client) => {
        const res = await client.query("SELECT public.next_doc_number('TRIP', '2026') AS num;");
        return res.rows[0].num as string;
      })
    );

    const generatedNumbers = await Promise.all(tasks);

    // 1. Verify exactly 50 numbers generated
    expect(generatedNumbers.length).toBe(50);

    // 2. Verify all 50 are distinct
    const uniqueNumbers = new Set(generatedNumbers);
    expect(uniqueNumbers.size).toBe(50);

    // 3. Extract suffixes and verify gap-free sequence
    const parsedSeq = generatedNumbers
      .map((n) => parseInt(n.replace('TRIP-2026-', ''), 10))
      .sort((a, b) => a - b);

    for (let i = 0; i < parsedSeq.length - 1; i++) {
      expect(parsedSeq[i + 1] - parsedSeq[i]).toBe(1);
    }
  });

  it('Invariant: 20 parallel parts issues for the last unit succeed exactly once and stock never goes negative', async () => {
    // Create maintenance order for test
    const moDocNumber = 'MO-CONC-LAST-UNIT';
    await dbHandle.adminClient.query(`
      INSERT INTO public.maintenance_orders (id, doc_number, vehicle_id, vehicle_plate, order_type, description, start_date, created_by)
      VALUES ($1, $2, $3, 'أ ب ج 1101', 'Corrective', 'Tire replacement', current_date, 'system');
    `, [crypto.randomUUID(), moDocNumber, fixtures.vehicles.riyadhTankerId]);

    // Material MAT-TIRE-HEAVY currently has exactly 1.000 in unrestricted_qty
    const initialBalRes = await dbHandle.adminClient.query(
      `SELECT unrestricted_qty FROM public.stock_balances WHERE id = 'bal-MAT-TIRE-HEAVY-1100-SL01';`
    );
    expect(parseFloat(initialBalRes.rows[0].unrestricted_qty)).toBe(1);

    // Attempt 20 concurrent issues of 1 unit
    const results = await Promise.allSettled(
      Array.from({ length: 20 }).map((_, idx) =>
        asUser(dbHandle.pool, whClerkId, async (client) => {
          return await client.query(
            'SELECT public.issue_parts_to_maintenance_order($1, $2, $3, $4, $5, $6, $7) AS doc;',
            [
              crypto.randomUUID(),
              moDocNumber,
              '1100',
              'SL01',
              `Concurrent issue attempt ${idx}`,
              JSON.stringify([{ material_code: fixtures.materials.tire, quantity: 1 }]),
              null,
            ]
          );
        })
      )
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    // Exactly 1 must succeed, 19 must fail
    expect(succeeded.length).toBe(1);
    expect(failed.length).toBe(19);

    // Stock must be exactly 0.000, never negative
    const finalBalRes = await dbHandle.adminClient.query(
      `SELECT unrestricted_qty FROM public.stock_balances WHERE id = 'bal-MAT-TIRE-HEAVY-1100-SL01';`
    );
    expect(parseFloat(finalBalRes.rows[0].unrestricted_qty)).toBe(0);
  });

  it('Invariant: two updates with the same expected version produce one winner and one conflict error', async () => {
    // 1. Get current vehicle and version
    const vehRes = await dbHandle.adminClient.query(
      'SELECT id, version, make_model FROM public.vehicles WHERE id = $1;',
      [fixtures.vehicles.riyadhTankerId]
    );
    const initialVersion = vehRes.rows[0].version as number;

    // 2. Launch 2 concurrent updates with the same initialVersion
    const update1 = asUser(dbHandle.pool, fleetMgrId, (client) =>
      client.query(
        'SELECT public.update_vehicle($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);',
        [
          crypto.randomUUID(),
          fixtures.vehicles.riyadhTankerId,
          initialVersion,
          'TRK-101',
          'أ ب ج 1101',
          'Tanker',
          'Actros Updated A',
          'WDB9634031L110101',
          2023,
          32000,
          'Diesel',
          '1100',
          'CC-1100',
          null,
        ]
      )
    );

    const update2 = asUser(dbHandle.pool, fleetMgrId, (client) =>
      client.query(
        'SELECT public.update_vehicle($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);',
        [
          crypto.randomUUID(),
          fixtures.vehicles.riyadhTankerId,
          initialVersion,
          'TRK-101',
          'أ ب ج 1101',
          'Tanker',
          'Actros Updated B',
          'WDB9634031L110101',
          2023,
          32000,
          'Diesel',
          '1100',
          'CC-1100',
          null,
        ]
      )
    );

    const outcomes = await Promise.allSettled([update1, update2]);
    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    const rejected = outcomes.filter((o) => o.status === 'rejected');

    // Exactly 1 winner and 1 conflict error
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    if (rejected[0].status === 'rejected') {
      const err = rejected[0].reason as Error;
      expect(err.message).toMatch(/تضارب في البيانات|version conflict|تعديل/i);
    }
  });

  it('Invariant: no deadlocks in a mixed run of 100 random commands', async () => {
    // Run 100 interleaved commands concurrently across connections
    const operations = Array.from({ length: 100 }).map((_, idx) =>
      asUser(dbHandle.pool, fleetMgrId, async (client) => {
        const opType = idx % 4;
        if (opType === 0) {
          // Number generation
          return await client.query("SELECT public.next_doc_number('FUEL', '2026');");
        } else if (opType === 1) {
          // Check vehicle details
          return await client.query('SELECT * FROM public.vehicles WHERE id = $1;', [
            fixtures.vehicles.riyadhTankerId,
          ]);
        } else if (opType === 2) {
          // Query stock balance
          return await client.query(
            "SELECT * FROM public.stock_balances WHERE plant_code = '1100';"
          );
        } else {
          // Read ledger or journal
          return await client.query(
            'SELECT * FROM public.journal_entries ORDER BY created_at DESC LIMIT 5;'
          );
        }
      })
    );

    // None should throw a PostgreSQL deadlock error (40P01)
    const results = await Promise.allSettled(operations);
    for (const r of results) {
      if (r.status === 'rejected') {
        const err = r.reason as { code?: string };
        expect(err.code).not.toBe('40P01'); // 40P01 = deadlock_detected
      }
    }
  });
});
