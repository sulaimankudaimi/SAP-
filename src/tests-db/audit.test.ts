import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createFreshDatabase,
  destroyDatabase,
  asUser,
  createProfile,
  type TestDatabaseHandle,
} from './helpers';
import { seedReferenceData, type SeededFixtures } from './fixtures';

describe('Database Audit Chain & Immutability Invariants', () => {
  let dbHandle: TestDatabaseHandle;
  let fixtures: SeededFixtures;
  let fleetMgrId: string;
  let adminUserId: string;

  beforeAll(async () => {
    dbHandle = await createFreshDatabase('audit_suite');
    fixtures = await seedReferenceData(dbHandle.adminClient);

    fleetMgrId = await createProfile(dbHandle.adminClient, {
      username: 'flt_mgr_audit',
      roleCode: 'FLEET_MANAGER',
      plantCodes: ['1100'],
    });

    adminUserId = await createProfile(dbHandle.adminClient, {
      username: 'admin_audit',
      roleCode: 'ADMIN',
      plantCodes: ['1100', '1200', '1300'],
    });
  });

  afterAll(async () => {
    if (dbHandle) {
      await destroyDatabase(dbHandle);
    }
  });

  it('Invariant: every command writes audit rows with the real actor', async () => {
    // Dispatch a trip command under fleetMgrId
    const res = await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      return await client.query(
        'SELECT public.create_trip($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) AS trip;',
        [
          crypto.randomUUID(),
          fixtures.vehicles.riyadhTankerId,
          fixtures.drivers.validDriver1Id,
          '1100',
          'Audit Check Terminal',
          'Diesel',
          25000,
          new Date().toISOString(),
          new Date().toISOString(),
          150000,
          null,
          null,
        ]
      );
    });

    const trip = res.rows[0].trip as { id: string; docNumber?: string; doc_number?: string };
    const tripId = trip.id;

    // Check audit_logs row for this trip
    const auditRes = await dbHandle.adminClient.query(
      `SELECT * FROM public.audit_logs WHERE entity = 'Trip' AND entity_id = $1 ORDER BY seq DESC LIMIT 1;`,
      [tripId]
    );

    expect(auditRes.rows.length).toBe(1);
    const auditRow = auditRes.rows[0];
    expect(auditRow.user_id).toBe(fleetMgrId);
    expect(auditRow.username).toBe('flt_mgr_audit');
    expect(auditRow.action).toBe('CREATE');
    expect(auditRow.prev_hash).toBeDefined();
    expect(auditRow.hash).toBeDefined();
  });

  it('Invariant: UPDATE and DELETE on audit_logs are impossible for every role', async () => {
    // Even an ADMIN user must be denied direct UPDATE or DELETE on audit_logs
    await asUser(dbHandle.pool, adminUserId, async (client) => {
      await expect(
        client.query(`UPDATE public.audit_logs SET action = 'TAMPERED';`)
      ).rejects.toThrow(/permission denied|violates row-level security/i);

      await expect(
        client.query(`DELETE FROM public.audit_logs;`)
      ).rejects.toThrow(/permission denied|violates row-level security/i);

      await expect(
        client.query(`TRUNCATE TABLE public.audit_logs;`)
      ).rejects.toThrow(/permission denied|cannot truncate/i);
    });
  });

  it('Invariant: verify_audit_chain() returns clean, and after a superuser tampers with one row it reports exactly that row', async () => {
    // 1. Generate a sequence of audit events
    await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      for (let i = 1; i <= 5; i++) {
        await client.query(
          'SELECT public.create_fuel_log($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);',
          [
            crypto.randomUUID(),
            fixtures.vehicles.riyadhTankerId,
            fixtures.drivers.validDriver1Id,
            'Diesel',
            200 + i * 10,
            1.15,
            150100 + i * 50,
            `Audit Test Station ${i}`,
            '1100',
            null,
          ]
        );
      }
    });

    // 2. verify_audit_chain() must be clean (is_valid = true)
    const initialVerify = await dbHandle.adminClient.query('SELECT * FROM public.verify_audit_chain();');
    expect(initialVerify.rows.length).toBe(1);
    expect(initialVerify.rows[0].is_valid).toBe(true);
    expect(parseInt(initialVerify.rows[0].total_records, 10)).toBeGreaterThanOrEqual(6);

    // 3. Superuser tampers with row #3 directly via superuser bypass
    const targetRowRes = await dbHandle.adminClient.query('SELECT seq, id FROM public.audit_logs WHERE seq = 3;');
    const tamperedSeq = targetRowRes.rows[0].seq;
    const tamperedId = targetRowRes.rows[0].id;

    // Tamper the payload of seq=3
    await dbHandle.adminClient.query(
      `UPDATE public.audit_logs SET action = 'UNAUTHORIZED_TAMPER' WHERE seq = $1;`,
      [tamperedSeq]
    );

    // 4. verify_audit_chain() must now report invalid and identify the exact broken row
    const postTamperVerify = await dbHandle.adminClient.query('SELECT * FROM public.verify_audit_chain();');
    expect(postTamperVerify.rows.length).toBe(1);
    expect(postTamperVerify.rows[0].is_valid).toBe(false);
    expect(postTamperVerify.rows[0].broken_id).toBe(tamperedId);
    expect(parseInt(postTamperVerify.rows[0].broken_seq, 10)).toBe(parseInt(tamperedSeq, 10));
    expect(postTamperVerify.rows[0].error_message).toMatch(/تطابق الهاش|hash mismatch|prev_hash/i);
  });
});
