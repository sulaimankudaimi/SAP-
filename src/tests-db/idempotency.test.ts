import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createFreshDatabase,
  destroyDatabase,
  asUser,
  createProfile,
  type TestDatabaseHandle,
} from './helpers';
import { seedReferenceData, type SeededFixtures } from './fixtures';

describe('Database Command Idempotency Invariants', () => {
  let dbHandle: TestDatabaseHandle;
  let fixtures: SeededFixtures;
  let fleetMgrId: string;

  beforeAll(async () => {
    dbHandle = await createFreshDatabase('idempotency_suite');
    fixtures = await seedReferenceData(dbHandle.adminClient);

    fleetMgrId = await createProfile(dbHandle.adminClient, {
      username: 'flt_mgr_idemp',
      roleCode: 'FLEET_MANAGER',
      plantCodes: ['1100'],
    });
  });

  afterAll(async () => {
    if (dbHandle) {
      await destroyDatabase(dbHandle);
    }
  });

  it('Invariant: identical request_id sent 10 times in parallel creates exactly one record and one journal, all callers receive same result', async () => {
    const fixedRequestId = crypto.randomUUID();
    const initialTripsCountRes = await dbHandle.adminClient.query('SELECT count(*) FROM public.trips;');
    const initialCount = parseInt(initialTripsCountRes.rows[0].count, 10);

    // Dispatch 10 parallel calls across separate pooled connections with the exact same request_id
    const parallelCalls = Array.from({ length: 10 }).map(() =>
      asUser(dbHandle.pool, fleetMgrId, async (client) => {
        const res = await client.query(
          'SELECT public.create_trip($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) AS trip;',
          [
            fixedRequestId,
            fixtures.vehicles.riyadhTankerId,
            fixtures.drivers.validDriver1Id,
            '1100',
            'Concurrent Terminal',
            'Diesel',
            28000,
            new Date().toISOString(),
            new Date().toISOString(),
            150000,
            null,
            null,
          ]
        );
        return res.rows[0].trip as { id: string; doc_number: string };
      })
    );

    const results = await Promise.all(parallelCalls);

    // 1. Verify all 10 callers received identical trip id and docNumber
    const firstTripId = results[0].id;
    const firstDocNumber = results[0].doc_number;
    expect(firstTripId).toBeDefined();
    expect(firstDocNumber).toBeDefined();

    for (const r of results) {
      expect(r.id).toBe(firstTripId);
      expect(r.doc_number).toBe(firstDocNumber);
    }

    // 2. Exactly one trip was created in the database
    const postTripsCountRes = await dbHandle.adminClient.query('SELECT count(*) FROM public.trips;');
    const postCount = parseInt(postTripsCountRes.rows[0].count, 10);
    expect(postCount).toBe(initialCount + 1);

    // 3. Exactly one command_requests entry exists with status 'done'
    const cmdRes = await dbHandle.adminClient.query(
      'SELECT status FROM public.command_requests WHERE request_id = $1;',
      [fixedRequestId]
    );
    expect(cmdRes.rows.length).toBe(1);
    expect(cmdRes.rows[0].status).toBe('done');
  });

  it('Invariant: failed first attempt leaves no command_requests row and retry succeeds', async () => {
    const retryRequestId = crypto.randomUUID();

    // 1. Attempt call with invalid input (e.g. start_odometer < current_odometer) to trigger exception
    let firstAttemptFailed = false;
    try {
      await asUser(dbHandle.pool, fleetMgrId, async (client) => {
        await client.query(
          'SELECT public.create_trip($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);',
          [
            retryRequestId,
            fixtures.vehicles.riyadhTankerId,
            fixtures.drivers.validDriver1Id,
            '1100',
            'Invalid Trip',
            'Diesel',
            28000,
            new Date().toISOString(),
            new Date().toISOString(),
            100, // Invalid odometer (lower than 150,000)
            null,
            null,
          ]
        );
      });
    } catch {
      firstAttemptFailed = true;
    }
    expect(firstAttemptFailed).toBe(true);

    // 2. Transaction rollback ensured NO residual command_requests row remains
    const cmdCheck = await dbHandle.adminClient.query(
      'SELECT * FROM public.command_requests WHERE request_id = $1;',
      [retryRequestId]
    );
    expect(cmdCheck.rows.length).toBe(0);

    // 3. Subsequent retry with corrected parameters and same request_id succeeds
    const retryResult = await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const res = await client.query(
        'SELECT public.create_trip($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) AS trip;',
        [
          retryRequestId,
          fixtures.vehicles.riyadhTankerId,
          fixtures.drivers.validDriver1Id,
          '1100',
          'Valid Retried Destination',
          'Diesel',
          28000,
          new Date().toISOString(),
          new Date().toISOString(),
          150000,
          null,
          null,
        ]
      );
      return res.rows[0].trip as { id: string; doc_number: string };
    });

    expect(retryResult.id).toBeDefined();

    // 4. Now command_requests records the successful completion
    const finalCmdCheck = await dbHandle.adminClient.query(
      'SELECT status FROM public.command_requests WHERE request_id = $1;',
      [retryRequestId]
    );
    expect(finalCmdCheck.rows.length).toBe(1);
    expect(finalCmdCheck.rows[0].status).toBe('done');
  });
});
