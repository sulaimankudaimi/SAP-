import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createFreshDatabase,
  destroyDatabase,
  asUser,
  createProfile,
  type TestDatabaseHandle,
} from './helpers';
import { seedReferenceData, type SeededFixtures } from './fixtures';

describe('Fleet Server Commands & Domain Invariants', () => {
  let dbHandle: TestDatabaseHandle;
  let fixtures: SeededFixtures;
  let fleetMgrId: string;
  let whClerkId: string;

  beforeAll(async () => {
    dbHandle = await createFreshDatabase('fleet_cmd_suite');
    fixtures = await seedReferenceData(dbHandle.adminClient);

    fleetMgrId = await createProfile(dbHandle.adminClient, {
      username: 'flt_mgr_cmds',
      roleCode: 'FLEET_MANAGER',
      plantCodes: ['1100', '1200'],
    });

    whClerkId = await createProfile(dbHandle.adminClient, {
      username: 'wh_clerk_cmds',
      roleCode: 'WAREHOUSE_CLERK',
      plantCodes: ['1100'],
    });
  });

  afterAll(async () => {
    if (dbHandle) {
      await destroyDatabase(dbHandle);
    }
  });

  it('Invariant: odometer decreases rejected', async () => {
    await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      // Vehicle current odometer is 150,000 km. An attempt to dispatch trip with 149,000 km must reject
      await expect(
        client.query(
          'SELECT public.create_trip($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);',
          [
            crypto.randomUUID(),
            fixtures.vehicles.riyadhTankerId,
            fixtures.drivers.validDriver1Id,
            '1100',
            'Terminal A',
            'Diesel',
            25000,
            new Date().toISOString(),
            new Date().toISOString(),
            149000, // Lower than current 150000
            null,
            null,
          ]
        )
      ).rejects.toThrow(/عداد بداية الرحلة.*لا يمكن أن يكون أقل/);

      // Attempting fuel log with lower odometer also rejects
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
            148000, // Lower than current 150000
            'Station Petromin',
            '1100',
            null,
          ]
        )
      ).rejects.toThrow(/قراءة عداد المسافات.*أقل/);
    });
  });

  it('Invariant: chronological rule for late offline readings and fuel logs', async () => {
    await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const now = Date.now();
      const t1 = new Date(now - 3600000 * 3).toISOString(); // 3 hours ago
      const t2 = new Date(now - 3600000 * 2).toISOString(); // 2 hours ago
      const t3 = new Date(now - 3600000 * 1).toISOString(); // 1 hour ago

      // 1. Ingest reading at T1 (150,100 km)
      await client.query(
        'SELECT public.record_odometer_reading($1, $2, $3, $4, $5);',
        [crypto.randomUUID(), fixtures.vehicles.riyadhTankerId, 150100, t1, 'mobile']
      );

      // 2. Ingest reading at T3 (150,500 km)
      await client.query(
        'SELECT public.record_odometer_reading($1, $2, $3, $4, $5);',
        [crypto.randomUUID(), fixtures.vehicles.riyadhTankerId, 150500, t3, 'mobile']
      );

      // 3. Late arriving reading captured at T2 (between T1 and T3)
      // If reading is 150,600 km (greater than reading at later time T3), it must be rejected!
      await expect(
        client.query(
          'SELECT public.record_odometer_reading($1, $2, $3, $4, $5);',
          [crypto.randomUUID(), fixtures.vehicles.riyadhTankerId, 150600, t2, 'offline_sync']
        )
      ).rejects.toThrow(/خطأ تسلسل العداد الزمني/);

      // If reading is validly between T1 and T3 (e.g. 150,300 km), it succeeds
      const validLateReading = await client.query(
        'SELECT public.record_odometer_reading($1, $2, $3, $4, $5) AS res;',
        [crypto.randomUUID(), fixtures.vehicles.riyadhTankerId, 150300, t2, 'offline_sync']
      );
      expect(validLateReading.rows[0].res).toBeDefined();
    });
  });

  it('Invariant: trip_event can never create or complete a trip', async () => {
    // 1. Dispatch a valid trip
    let tripId = '';
    await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const res = await client.query(
        'SELECT public.create_trip($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) AS trip;',
        [
          crypto.randomUUID(),
          fixtures.vehicles.riyadhTankerId,
          fixtures.drivers.validDriver1Id,
          '1100',
          'Dammam Port',
          'Diesel',
          25000,
          new Date().toISOString(),
          new Date().toISOString(),
          150500,
          null,
          null,
        ]
      );
      tripId = (res.rows[0].trip as { id: string }).id;
    });

    // 2. Record telemetry events (departed, arrived)
    await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      await client.query(
        'SELECT public.record_trip_event($1, $2, $3, $4, $5, $6);',
        [crypto.randomUUID(), tripId, fixtures.vehicles.riyadhTankerId, 'departed', new Date().toISOString(), JSON.stringify({ speed: 65 })]
      );

      await client.query(
        'SELECT public.record_trip_event($1, $2, $3, $4, $5, $6);',
        [crypto.randomUUID(), tripId, fixtures.vehicles.riyadhTankerId, 'arrived', new Date().toISOString(), JSON.stringify({ speed: 0 })]
      );
    });

    // 3. Verify trip status remains 'in_transit' and is NOT completed by event telemetry
    const checkTripRes = await dbHandle.adminClient.query('SELECT status FROM public.trips WHERE id = $1;', [tripId]);
    expect(checkTripRes.rows[0].status).toBe('in_transit');
  });

  it('Invariant: completing a trip twice is rejected', async () => {
    let tripId = '';
    await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const res = await client.query(
        'SELECT public.create_trip($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) AS trip;',
        [
          crypto.randomUUID(),
          fixtures.vehicles.riyadhTankerId,
          fixtures.drivers.validDriver1Id,
          '1100',
          'Al-Kharj Depo',
          'Diesel',
          25000,
          new Date().toISOString(),
          new Date().toISOString(),
          150500,
          null,
          null,
        ]
      );
      tripId = (res.rows[0].trip as { id: string }).id;
    });

    // 1. First completion succeeds
    await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const compRes = await client.query(
        'SELECT public.complete_trip($1, $2, $3, $4, $5, $6, $7, $8, $9) AS res;',
        [
          crypto.randomUUID(),
          tripId,
          new Date().toISOString(),
          150900,
          180,
          207.00,
          150.00,
          null,
          null,
        ]
      );
      expect(compRes.rows[0].res).toBeDefined();
    });

    // 2. Second completion on same trip must reject
    await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      await expect(
        client.query(
          'SELECT public.complete_trip($1, $2, $3, $4, $5, $6, $7, $8, $9);',
          [
            crypto.randomUUID(),
            tripId,
            new Date().toISOString(),
            150900,
            180,
            207.00,
            150.00,
            null,
            null,
          ]
        )
      ).rejects.toThrow(/تم إغلاق واعتماد هذه الرحلة مسبقاً/);
    });
  });

  it('Invariant: maintenance completion posts a balanced journal', async () => {
    const moDocNumber = `MO-2026-${Math.floor(Math.random() * 900000 + 100000)}`;

    // Create Maintenance Order
    await dbHandle.adminClient.query(`
      INSERT INTO public.maintenance_orders (
        id, doc_number, vehicle_id, vehicle_plate, order_type, description, start_date, created_by
      ) VALUES (
        $1, $2, $3, 'أ ب ج 1101', 'Preventive', 'Scheduled Service', current_date, 'system'
      );
    `, [crypto.randomUUID(), moDocNumber, fixtures.vehicles.riyadhTankerId]);

    // Issue parts (Movement 261)
    await asUser(dbHandle.pool, whClerkId, async (client) => {
      await client.query(
        'SELECT public.issue_parts_to_maintenance_order($1, $2, $3, $4, $5, $6, $7);',
        [
          crypto.randomUUID(),
          moDocNumber,
          '1100',
          'SL01',
          'Parts for 10k service',
          JSON.stringify([{ material_code: fixtures.materials.filter, quantity: 2 }]),
          null,
        ]
      );
    });

    // Complete Maintenance Order
    let jeDocNumber = '';
    await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const res = await client.query(
        'SELECT public.complete_maintenance_order($1, $2, $3, $4, $5, $6, $7, $8) AS mo;',
        [
          crypto.randomUUID(),
          moDocNumber,
          currentDateString(),
          4.0, // 4 hours labor
          80.00, // 80 SAR/hr
          2.0, // 2 hours downtime
          null,
          null,
        ]
      );
      const mo = res.rows[0].mo as { jeDocNumber?: string; je_doc_number?: string };
      jeDocNumber = (mo.jeDocNumber || mo.je_doc_number || '') as string;
    });

    expect(jeDocNumber).toBeTruthy();

    // Verify journal entry in database is strictly balanced
    const jeRes = await dbHandle.adminClient.query(
      'SELECT total_debit, total_credit FROM public.journal_entries WHERE doc_number = $1;',
      [jeDocNumber]
    );
    expect(jeRes.rows.length).toBe(1);
    const debit = parseFloat(jeRes.rows[0].total_debit);
    const credit = parseFloat(jeRes.rows[0].total_credit);
    expect(debit).toBeGreaterThan(0);
    expect(Math.abs(debit - credit)).toBeLessThan(0.001);
  });

  it('Invariant: vehicles and drivers can be created, updated with version check, deactivated, never deleted', async () => {
    let newVehicleId = '';

    // 1. Create vehicle
    await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const res = await client.query(
        'SELECT public.create_vehicle($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) AS veh;',
        [
          crypto.randomUUID(),
          'TRK-NEW-01',
          'ق ف ك 7788',
          'HeavyTruck',
          'Scania R450',
          '1100',
          'CC-1100',
          'YS2R4X2000NEW7788',
          2024,
          0,
          10000,
          'Diesel',
          null,
          '2027-12-31',
          '2027-12-31',
        ]
      );
      newVehicleId = (res.rows[0].veh as { id: string }).id;
    });

    expect(newVehicleId).toBeDefined();

    // 2. Update vehicle with version check
    await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const res = await client.query(
        'SELECT public.update_vehicle($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) AS veh;',
        [
          crypto.randomUUID(),
          newVehicleId,
          1, // expected_version
          'TRK-NEW-01',
          'ق ف ك 7788',
          'HeavyTruck',
          'Scania R450 Super Edition',
          'YS2R4X2000NEW7788',
          2024,
          0,
          'Diesel',
          '1100',
          'CC-1100',
          null,
        ]
      );
      expect((res.rows[0].veh as { makeModel?: string; make_model?: string }).make_model || (res.rows[0].veh as { makeModel?: string }).makeModel).toBe('Scania R450 Super Edition');
    });

    // 3. Deactivate vehicle (soft-deactivation sets is_deleted=true and status='out_of_service')
    await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const deactRes = await client.query(
        'SELECT public.set_vehicle_active($1, $2, $3) AS res;',
        [crypto.randomUUID(), newVehicleId, false]
      );
      expect(deactRes.rows[0].res).toBeDefined();
    });

    // 4. Verify physical row still exists in database (NEVER deleted)
    const checkRow = await dbHandle.adminClient.query('SELECT is_deleted, status FROM public.vehicles WHERE id = $1;', [
      newVehicleId,
    ]);
    expect(checkRow.rows.length).toBe(1);
    expect(checkRow.rows[0].is_deleted).toBe(true);
    expect(checkRow.rows[0].status).toBe('out_of_service');
  });

  it('Invariant: fuel anomaly alert created at the 25 percent threshold', async () => {
    // 1. Seed 10 baseline fuel logs with normal ~35 L/100km consumption rate
    const vId = fixtures.vehicles.riyadhTankerId;
    let odometer = 151000;

    for (let i = 1; i <= 10; i++) {
      odometer += 500; // 500 km
      const liters = 175; // 35 L/100km
      await dbHandle.adminClient.query(`
        INSERT INTO public.fuel_logs (
          id, doc_number, vehicle_id, driver_id, fuel_type, liters, unit_price, total_cost,
          odometer, station_name, plant_code, logged_at, created_by
        ) VALUES (
          $1, $2, $3, $4, 'Diesel', $5, 1.15, $6, $7, 'Normal Station', '1100', now() - ($8 || ' hours')::interval, 'system'
        );
      `, [crypto.randomUUID(), `FL-BASELINE-${i}`, vId, fixtures.drivers.validDriver1Id, liters, liters * 1.15, odometer, 20 - i]);
    }

    // 2. Ingest an anomalous fuel entry (e.g. 50 L/100km, which is +42.8% deviation > 25% threshold)
    odometer += 500;
    const anomalyLiters = 250; // 50 L/100km vs 35 L/100km baseline
    const anomalyLogDoc = `FL-ANOMALY-${Date.now()}`;

    await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      await client.query(
        'SELECT public.create_fuel_log($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);',
        [
          crypto.randomUUID(),
          vId,
          fixtures.drivers.validDriver1Id,
          'Diesel',
          anomalyLiters,
          1.15,
          odometer,
          'Suspicious High Station',
          '1100',
          null,
        ]
      );
    });

    // 3. Verify an anomaly alert row was automatically created
    const alertRes = await dbHandle.adminClient.query(
      'SELECT * FROM public.fuel_anomaly_alerts WHERE vehicle_id = $1 ORDER BY created_at DESC LIMIT 1;',
      [vId]
    );

    expect(alertRes.rows.length).toBe(1);
    const alert = alertRes.rows[0];
    expect(parseFloat(alert.deviationPercentage || alert.deviation_percentage)).toBeGreaterThan(25);
    expect(alert.status).toBe('active');
  });
});

function currentDateString(): string {
  return new Date().toISOString().slice(0, 10);
}
