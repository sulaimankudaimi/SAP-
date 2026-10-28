import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createFreshDatabase,
  destroyDatabase,
  asUser,
  createProfile,
  type TestDatabaseHandle,
} from './helpers';
import { seedReferenceData, type SeededFixtures } from './fixtures';

describe('Database Integrity Auditing & Nightly Checker Invariants', () => {
  let dbHandle: TestDatabaseHandle;
  let fixtures: SeededFixtures;
  let auditorId: string;

  beforeAll(async () => {
    dbHandle = await createFreshDatabase('integrity_suite');
    fixtures = await seedReferenceData(dbHandle.adminClient);

    auditorId = await createProfile(dbHandle.adminClient, {
      username: 'auditor_integ',
      roleCode: 'AUDITOR',
      plantCodes: ['1100', '1200', '1300'],
    });
  });

  afterAll(async () => {
    if (dbHandle) {
      await destroyDatabase(dbHandle);
    }
  });

  it('Invariant: integrity_report() is clean after a legitimate workload', async () => {
    // Synchronize initial stock balances to match empty ledger
    await dbHandle.adminClient.query(`
      INSERT INTO public.stock_ledger (
        id, material_doc_number, posting_date, material_code, plant_code, storage_location,
        movement_type, quantity, unit, unit_price, total_amount, balance_after, created_by
      ) VALUES
      (gen_random_uuid(), 'MD-INIT-01', current_date, 'MAT-OIL-FILTER', '1100', 'SL01', '101', 50.000, 'PC', 150.00, 7500.00, 50.000, 'system'),
      (gen_random_uuid(), 'MD-INIT-02', current_date, 'MAT-TIRE-HEAVY', '1100', 'SL01', '101', 1.000, 'PC', 1200.00, 1200.00, 1.000, 'system');
    `);

    const reportRes = await asUser(dbHandle.pool, auditorId, async (client) => {
      return await client.query('SELECT * FROM public.integrity_report() ORDER BY invariant_number ASC;');
    });

    expect(reportRes.rows.length).toBeGreaterThanOrEqual(6);
    for (const inv of reportRes.rows as Array<{ invariant_number: number; status: string; violations_count: string }>) {
      expect(inv.status).toBe('PASS');
      expect(parseInt(inv.violations_count, 10)).toBe(0);
    }
  });

  it('Invariant: duplicate number violation is detected with sample ids', async () => {
    // Seed duplicate doc_number by disabling unique constraint temporarily on admin client
    await dbHandle.adminClient.query('ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_doc_number_key;');
    const dupDoc = 'DUP-TRIP-999999';

    await dbHandle.adminClient.query(`
      INSERT INTO public.trips (
        id, doc_number, status, vehicle_id, driver_id, origin_plant, destination_location,
        cargo_type, cargo_volume_liters, scheduled_departure, scheduled_arrival, start_odometer, created_by
      ) VALUES
      (gen_random_uuid(), $1, 'scheduled', $2, $3, '1100', 'Dest A', 'Diesel', 10000, now(), now(), 150000, 'admin'),
      (gen_random_uuid(), $1, 'scheduled', $2, $3, '1100', 'Dest B', 'Diesel', 10000, now(), now(), 150000, 'admin');
    `, [dupDoc, fixtures.vehicles.riyadhTankerId, fixtures.drivers.validDriver1Id]);

    const reportRes = await dbHandle.adminClient.query('SELECT * FROM public.integrity_report() WHERE invariant_number = 1;');
    expect(reportRes.rows.length).toBe(1);
    const inv1 = reportRes.rows[0];
    expect(inv1.status).toBe('FAIL');
    expect(parseInt(inv1.violations_count, 10)).toBeGreaterThan(0);
    expect(inv1.sample_ids).toContain(dupDoc);

    // Clean up duplicate rows and restore constraint
    await dbHandle.adminClient.query(`DELETE FROM public.trips WHERE doc_number = $1;`, [dupDoc]);
    await dbHandle.adminClient.query('ALTER TABLE public.trips ADD CONSTRAINT trips_doc_number_key UNIQUE(doc_number);');
  });

  it('Invariant: unbalanced journal is detected with sample ids', async () => {
    // Seed unbalanced lines in journal
    const fakeJeId = crypto.randomUUID();
    const fakeJeDoc = 'JE-UNBALANCED-TEST';

    // Disable trigger/check to simulate an inconsistent bypass
    await dbHandle.adminClient.query('ALTER TABLE public.journal_entries DROP CONSTRAINT IF EXISTS chk_journal_balanced;');
    await dbHandle.adminClient.query(`
      INSERT INTO public.journal_entries (
        id, doc_number, company_code, fiscal_year, period, posting_date, document_date, header_text, total_debit, total_credit, created_by
      ) VALUES (
        $1, $2, '1000', '2026', 10, current_date, current_date, 'Unbalanced Test', 1000.00, 800.00, 'system'
      );
    `, [fakeJeId, fakeJeDoc]);

    await dbHandle.adminClient.query(`
      INSERT INTO public.journal_lines (id, journal_entry_id, line_number, posting_key, account_number, account_name, debit, credit)
      VALUES
      (gen_random_uuid(), $1, 1, '40', '601010', 'Expense', 1000.00, 0.00),
      (gen_random_uuid(), $1, 2, '50', '201010', 'Liability', 0.00, 800.00);
    `, [fakeJeId]);

    const reportRes = await dbHandle.adminClient.query('SELECT * FROM public.integrity_report() WHERE invariant_number = 3;');
    expect(reportRes.rows.length).toBe(1);
    const inv3 = reportRes.rows[0];
    expect(inv3.status).toBe('FAIL');
    expect(parseInt(inv3.violations_count, 10)).toBeGreaterThan(0);

    // Clean up
    await dbHandle.adminClient.query('DELETE FROM public.journal_entries WHERE id = $1;', [fakeJeId]);
    await dbHandle.adminClient.query('ALTER TABLE public.journal_entries ADD CONSTRAINT chk_journal_balanced CHECK (abs(total_debit - total_credit) < 0.001);');
  });

  it('Invariant: stock balance not equal to ledger sum is detected with sample ids', async () => {
    // Tamper with unrestricted_qty on stock balance
    const targetBalId = 'bal-MAT-OIL-FILTER-1100-SL01';
    await dbHandle.adminClient.query(`
      UPDATE public.stock_balances
      SET unrestricted_qty = unrestricted_qty + 50.000
      WHERE id = $1;
    `, [targetBalId]);

    const reportRes = await dbHandle.adminClient.query('SELECT * FROM public.integrity_report() WHERE invariant_number = 4;');
    expect(reportRes.rows.length).toBe(1);
    const inv4 = reportRes.rows[0];
    expect(inv4.status).toBe('FAIL');
    expect(parseInt(inv4.violations_count, 10)).toBeGreaterThan(0);
    expect(inv4.sample_ids.length).toBeGreaterThan(0);

    // Restore accurate balance
    await dbHandle.adminClient.query(`
      UPDATE public.stock_balances
      SET unrestricted_qty = unrestricted_qty - 50.000
      WHERE id = $1;
    `, [targetBalId]);
  });

  it('Invariant: orphan reference is detected with sample ids', async () => {
    // Seed a completed trip referencing a non-existent journal entry
    const orphanTripDoc = 'TRIP-ORPHAN-01';
    await dbHandle.adminClient.query(`
      INSERT INTO public.trips (
        id, doc_number, status, vehicle_id, driver_id, origin_plant, destination_location,
        cargo_type, cargo_volume_liters, scheduled_departure, scheduled_arrival, start_odometer,
        total_trip_cost, je_doc_number, created_by
      ) VALUES (
        gen_random_uuid(), $1, 'completed', $2, $3, '1100', 'حمص', 'Diesel', 30000,
        now(), now(), 150000, 225000.00, 'NON_EXISTENT_JE_DOC_9999', 'admin'
      );
    `, [orphanTripDoc, fixtures.vehicles.riyadhTankerId, fixtures.drivers.validDriver1Id]);

    const reportRes = await dbHandle.adminClient.query('SELECT * FROM public.integrity_report() WHERE invariant_number = 2;');
    expect(reportRes.rows.length).toBe(1);
    const inv2 = reportRes.rows[0];
    expect(inv2.status).toBe('FAIL');
    expect(parseInt(inv2.violations_count, 10)).toBeGreaterThan(0);
    expect(inv2.sample_ids).toContain(orphanTripDoc);

    // Clean up
    await dbHandle.adminClient.query(`DELETE FROM public.trips WHERE doc_number = $1;`, [orphanTripDoc]);
  });

  it('Invariant: run_nightly_integrity_check stores a result and works without pg_cron', async () => {
    // Call stored procedure directly
    const runRes = await dbHandle.adminClient.query("SELECT public.run_nightly_integrity_check('test_manual') AS run_id;");
    const runId = runRes.rows[0].run_id as string;
    expect(runId).toBeDefined();

    // Verify stored record in integrity_runs table
    const storedRunRes = await dbHandle.adminClient.query(
      'SELECT id, triggered_by, status, total_violations, report FROM public.integrity_runs WHERE id = $1;',
      [runId]
    );

    expect(storedRunRes.rows.length).toBe(1);
    const record = storedRunRes.rows[0];
    expect(record.triggered_by).toBe('test_manual');
    expect(record.report).toBeDefined();
    expect(record.report.invariants).toBeDefined();
    expect(record.report.auditChain).toBeDefined();
  });
});
