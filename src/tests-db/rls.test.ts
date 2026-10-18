import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createFreshDatabase,
  destroyDatabase,
  asUser,
  asAnon,
  createProfile,
  type TestDatabaseHandle,
} from './helpers';
import { seedReferenceData, type SeededFixtures } from './fixtures';

describe('Database RLS & Access Control Invariants', () => {
  let dbHandle: TestDatabaseHandle;
  let fixtures: SeededFixtures;

  let adminUserId: string;
  let viewerRiyadhUserId: string;
  let unprivilegedUserId: string;
  let mustChangePasswordUserId: string;

  beforeAll(async () => {
    dbHandle = await createFreshDatabase('rls_suite');
    fixtures = await seedReferenceData(dbHandle.adminClient);

    // Setup test users
    adminUserId = await createProfile(dbHandle.adminClient, {
      username: 'admin_rls',
      roleCode: 'ADMIN',
      plantCodes: ['1100', '1200', '1300'],
    });

    viewerRiyadhUserId = await createProfile(dbHandle.adminClient, {
      username: 'viewer_riyadh',
      roleCode: 'VIEWER',
      plantCodes: ['1100'],
    });

    // User with no permissions (custom role or viewer with no plants)
    unprivilegedUserId = await createProfile(dbHandle.adminClient, {
      username: 'unprivileged_user',
      roleCode: 'VIEWER',
      plantCodes: [],
    });

    // User flagged with must_change_password
    mustChangePasswordUserId = await createProfile(dbHandle.adminClient, {
      username: 'pwd_change_user',
      roleCode: 'FLEET_MANAGER',
      plantCodes: ['1100'],
      mustChangePassword: true,
    });
  });

  afterAll(async () => {
    if (dbHandle) {
      await destroyDatabase(dbHandle);
    }
  });

  it('Invariant: anon cannot select any table nor call any RPC', async () => {
    await asAnon(dbHandle.pool, async (client) => {
      // 1. Direct table selects must fail or return empty/permission denied
      await expect(client.query('SELECT * FROM public.vehicles;')).rejects.toThrow();
      await expect(client.query('SELECT * FROM public.trips;')).rejects.toThrow();
      await expect(client.query('SELECT * FROM public.audit_logs;')).rejects.toThrow();
      await expect(client.query('SELECT * FROM public.stock_balances;')).rejects.toThrow();
      await expect(client.query('SELECT * FROM public.journal_entries;')).rejects.toThrow();

      // 2. RPC execution must be rejected for anon
      await expect(
        client.query('SELECT public.create_trip($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);', [
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
        ])
      ).rejects.toThrow();
    });
  });

  it('Invariant: authenticated without permission is denied', async () => {
    await asUser(dbHandle.pool, unprivilegedUserId, async (client) => {
      // Querying plants where user has no plant code assigned must return 0 rows
      const plantsRes = await client.query('SELECT * FROM public.plants;');
      expect(plantsRes.rows.length).toBe(0);

      // Querying vehicles where user has no plant permission must return 0 rows
      const vehiclesRes = await client.query('SELECT * FROM public.vehicles;');
      expect(vehiclesRes.rows.length).toBe(0);

      // Calling commands without required permission must throw authorization error
      await expect(
        client.query('SELECT public.create_trip($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);', [
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
        ])
      ).rejects.toThrow(/غير مصرح|صلاحيات|permission/i);
    });
  });

  it('Invariant: direct INSERT/UPDATE/DELETE on every table fails for every role including ADMIN', async () => {
    // Under strict RLS, no INSERT/UPDATE/DELETE policies exist on data tables for authenticated users.
    // All writes must go through validated SECURITY DEFINER RPC commands.
    await asUser(dbHandle.pool, adminUserId, async (client) => {
      // 1. Vehicles table
      await expect(
        client.query(`
          INSERT INTO public.vehicles (code, plate_number, type, make_model, plant_code, cost_center, current_odometer)
          VALUES ('HACK-TRK', 'HACK 999', 'Tanker', 'Volvo', '1100', 'CC-1100', 100);
        `)
      ).rejects.toThrow(/violates row-level security|permission denied/i);
      await expect(
        client.query(`UPDATE public.vehicles SET current_odometer = 999999 WHERE code = 'TRK-101';`)
      ).rejects.toThrow(/violates row-level security|permission denied/i);
      await expect(
        client.query(`DELETE FROM public.vehicles WHERE code = 'TRK-101';`)
      ).rejects.toThrow(/violates row-level security|permission denied/i);

      // 2. Drivers table
      await expect(
        client.query(`
          INSERT INTO public.drivers (code, name, iqama_number, mobile, license_number, license_class, license_expiry, plant_code)
          VALUES ('HACK-DRV', 'Hacked Driver', '2999999999', '+966500000000', 'LIC-HACK', 'Heavy', '2028-01-01', '1100');
        `)
      ).rejects.toThrow(/violates row-level security|permission denied/i);
      await expect(
        client.query(`UPDATE public.drivers SET status = 'suspended' WHERE code = 'DRV-101';`)
      ).rejects.toThrow(/violates row-level security|permission denied/i);
      await expect(
        client.query(`DELETE FROM public.drivers WHERE code = 'DRV-101';`)
      ).rejects.toThrow(/violates row-level security|permission denied/i);

      // 3. Trips table
      await expect(
        client.query(`
          INSERT INTO public.trips (doc_number, status, vehicle_id, driver_id, origin_plant, destination_location, cargo_type, cargo_volume_liters, scheduled_departure, scheduled_arrival, start_odometer, created_by)
          VALUES ('HACK-TRIP', 'scheduled', $1, $2, '1100', 'Dest', 'Diesel', 1000, now(), now(), 1000, 'admin');
        `, [fixtures.vehicles.riyadhTankerId, fixtures.drivers.validDriver1Id])
      ).rejects.toThrow(/violates row-level security|permission denied/i);
      await expect(
        client.query(`UPDATE public.trips SET status = 'completed';`)
      ).rejects.toThrow(/violates row-level security|permission denied/i);
      await expect(
        client.query(`DELETE FROM public.trips;`)
      ).rejects.toThrow(/violates row-level security|permission denied/i);

      // 4. Balances table (stock_balances)
      await expect(
        client.query(`
          INSERT INTO public.stock_balances (id, material_code, plant_code, storage_location, unrestricted_qty, total_valuation, moving_average_price, unit)
          VALUES ('bal-HACK', 'MAT-OIL-FILTER', '1100', 'SL01', 100, 15000, 150, 'PC');
        `)
      ).rejects.toThrow(/violates row-level security|permission denied/i);
      await expect(
        client.query(`UPDATE public.stock_balances SET unrestricted_qty = 9999;`)
      ).rejects.toThrow(/violates row-level security|permission denied/i);
      await expect(
        client.query(`DELETE FROM public.stock_balances;`)
      ).rejects.toThrow(/violates row-level security|permission denied/i);

      // 5. Ledgers table (stock_ledger)
      await expect(
        client.query(`
          INSERT INTO public.stock_ledger (material_doc_number, posting_date, material_code, plant_code, storage_location, movement_type, quantity, unit, unit_price, total_amount, balance_after, created_by)
          VALUES ('FAKE-MD', current_date, 'MAT-OIL-FILTER', '1100', 'SL01', '101', 10, 'PC', 100, 1000, 60, 'admin');
        `)
      ).rejects.toThrow(/violates row-level security|permission denied/i);
      await expect(
        client.query(`UPDATE public.stock_ledger SET quantity = 999;`)
      ).rejects.toThrow(/violates row-level security|permission denied/i);
      await expect(
        client.query(`DELETE FROM public.stock_ledger;`)
      ).rejects.toThrow(/violates row-level security|permission denied/i);

      // 6. Journals table (journal_entries)
      await expect(
        client.query(`
          INSERT INTO public.journal_entries (doc_number, fiscal_year, period, posting_date, document_date, header_text, total_debit, total_credit, created_by)
          VALUES ('FAKE-JE', '2026', 10, current_date, current_date, 'Hack Journal', 100, 100, 'admin');
        `)
      ).rejects.toThrow(/violates row-level security|permission denied/i);
      await expect(
        client.query(`UPDATE public.journal_entries SET total_debit = 999999;`)
      ).rejects.toThrow(/violates row-level security|permission denied/i);
      await expect(
        client.query(`DELETE FROM public.journal_entries;`)
      ).rejects.toThrow(/violates row-level security|permission denied/i);

      // 7. Registry table (posting_registry)
      await expect(
        client.query(`
          INSERT INTO public.posting_registry (source_type, source_id, doc_number, company_code, fiscal_year, period, je_doc_number, total_amount)
          VALUES ('HACK', 'id-1', 'DOC-1', '1000', '2026', 10, 'JE-1', 100);
        `)
      ).rejects.toThrow(/violates row-level security|permission denied/i);
      await expect(
        client.query(`UPDATE public.posting_registry SET total_amount = 0;`)
      ).rejects.toThrow(/violates row-level security|permission denied/i);
      await expect(
        client.query(`DELETE FROM public.posting_registry;`)
      ).rejects.toThrow(/violates row-level security|permission denied/i);

      // 8. Numbers table (number_ranges)
      await expect(
        client.query(`
          INSERT INTO public.number_ranges (object_type, fiscal_year, prefix, current_number, from_number, to_number)
          VALUES ('HACK', '2026', 'HACK-', 1, 1, 999);
        `)
      ).rejects.toThrow(/violates row-level security|permission denied/i);
      await expect(
        client.query(`UPDATE public.number_ranges SET current_number = 999999;`)
      ).rejects.toThrow(/violates row-level security|permission denied/i);
      await expect(
        client.query(`DELETE FROM public.number_ranges;`)
      ).rejects.toThrow(/violates row-level security|permission denied/i);

      // 9. Audit table (audit_logs)
      await expect(
        client.query(`
          INSERT INTO public.audit_logs (user_id, action, entity, entity_id, prev_hash, record_hash)
          VALUES ($1, 'FAKE_ACTION', 'test', '1', 'prev', 'curr');
        `, [adminUserId])
      ).rejects.toThrow(/violates row-level security|permission denied/i);
      await expect(
        client.query(`UPDATE public.audit_logs SET action = 'MODIFIED';`)
      ).rejects.toThrow(/violates row-level security|permission denied/i);
      await expect(
        client.query(`DELETE FROM public.audit_logs;`)
      ).rejects.toThrow(/violates row-level security|permission denied/i);
    });
  });

  it('Invariant: viewer sees only allowed plants', async () => {
    await asUser(dbHandle.pool, viewerRiyadhUserId, async (client) => {
      // User viewerRiyadhUserId is restricted to plant '1100'
      const plantsRes = await client.query('SELECT code FROM public.plants;');
      const visiblePlantCodes = plantsRes.rows.map((r: { code: string }) => r.code);
      expect(visiblePlantCodes).toContain('1100');
      expect(visiblePlantCodes).not.toContain('1200');
      expect(visiblePlantCodes).not.toContain('1300');

      // Vehicles list should only show vehicles belonging to plant '1100'
      const vehiclesRes = await client.query('SELECT code, plant_code FROM public.vehicles;');
      expect(vehiclesRes.rows.length).toBeGreaterThan(0);
      for (const row of vehiclesRes.rows as Array<{ code: string; plant_code: string }>) {
        expect(row.plant_code).toBe('1100');
      }
    });
  });

  it('Invariant: user with must_change_password=true cannot read business tables or run commands but can call complete_password_change', async () => {
    await asUser(dbHandle.pool, mustChangePasswordUserId, async (client) => {
      // 1. Reading business tables must return zero rows (has_permission returns false when must_change_password = true)
      const vehiclesRes = await client.query('SELECT * FROM public.vehicles;');
      expect(vehiclesRes.rows.length).toBe(0);

      const tripsRes = await client.query('SELECT * FROM public.trips;');
      expect(tripsRes.rows.length).toBe(0);

      // 2. Executing business commands must be rejected
      await expect(
        client.query('SELECT public.create_trip($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);', [
          crypto.randomUUID(),
          fixtures.vehicles.riyadhTankerId,
          fixtures.drivers.validDriver1Id,
          '1100',
          'Riyadh Depot',
          'Diesel',
          30000,
          new Date().toISOString(),
          new Date().toISOString(),
          150000,
          null,
          null,
        ])
      ).rejects.toThrow();

      // 3. Can call complete_password_change() successfully
      const changeRes = await client.query('SELECT public.complete_password_change() AS success;');
      expect(changeRes.rows[0].success).toBe(true);

      // Verify profile now has must_change_password = false
      const profileRes = await client.query('SELECT must_change_password FROM public.profiles WHERE user_id = $1;', [
        mustChangePasswordUserId,
      ]);
      expect(profileRes.rows[0].must_change_password).toBe(false);

      // After password change, business table reads succeed
      const postVehiclesRes = await client.query('SELECT * FROM public.vehicles;');
      expect(postVehiclesRes.rows.length).toBeGreaterThan(0);
    });
  });
});
