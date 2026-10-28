import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createFreshDatabase,
  destroyDatabase,
  asUser,
  createProfile,
  type TestDatabaseHandle,
} from './helpers';
import { seedReferenceData, type SeededFixtures } from './fixtures';

describe('Database Client-Server Contract & Schema Invariants', () => {
  let dbHandle: TestDatabaseHandle;
  let fixtures: SeededFixtures;
  let adminUserId: string;
  let fleetMgrId: string;
  let whClerkId: string;
  let accountantId: string;

  beforeAll(async () => {
    dbHandle = await createFreshDatabase('contract_suite');
    fixtures = await seedReferenceData(dbHandle.adminClient);

    adminUserId = await createProfile(dbHandle.adminClient, {
      username: 'admin_contract',
      roleCode: 'ADMIN',
      plantCodes: ['1100', '1200', '1300'],
    });

    fleetMgrId = await createProfile(dbHandle.adminClient, {
      username: 'flt_mgr_contract',
      roleCode: 'FLEET_MANAGER',
      plantCodes: ['1100', '1200'],
    });

    whClerkId = await createProfile(dbHandle.adminClient, {
      username: 'wh_clerk_contract',
      roleCode: 'WAREHOUSE_CLERK',
      plantCodes: ['1100'],
    });

    accountantId = await createProfile(dbHandle.adminClient, {
      username: 'acc_contract',
      roleCode: 'ACCOUNTANT',
      plantCodes: ['1100', '1200'],
    });
  });

  afterAll(async () => {
    if (dbHandle) {
      await destroyDatabase(dbHandle);
    }
  });

  // Helper to query function parameters from PostgreSQL information_schema
  async function getFunctionParamNames(functionName: string): Promise<string[]> {
    const res = await dbHandle.adminClient.query<{ parameter_name: string }>(
      `
      SELECT parameter_name
      FROM information_schema.parameters
      WHERE specific_schema = 'public'
        AND specific_name LIKE $1
        AND parameter_mode = 'IN'
      ORDER BY ordinal_position;
    `,
      [`${functionName}%`]
    );
    return res.rows.map((r) => r.parameter_name);
  }

  // --------------------------------------------------------------------------
  // 1. RPC Contract Invariants: Trip Commands
  // --------------------------------------------------------------------------

  it('Invariant: contract RPC create_trip exists with matching arguments and returns all Trip fields', async () => {
    const params = await getFunctionParamNames('create_trip');
    const expectedArgs = [
      'p_request_id',
      'p_vehicle_id',
      'p_driver_id',
      'p_origin_plant',
      'p_destination_location',
      'p_cargo_type',
      'p_cargo_volume_liters',
      'p_scheduled_departure',
      'p_scheduled_arrival',
      'p_start_odometer',
      'p_expected_version',
    ];
    for (const arg of expectedArgs) {
      expect(params).toContain(arg);
    }

    const trip = await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const res = await client.query<{ trip: Record<string, unknown> }>(
        'SELECT public.create_trip($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) AS trip;',
        [
          crypto.randomUUID(),
          fixtures.vehicles.riyadhTankerId,
          fixtures.drivers.validDriver1Id,
          '1100',
          'Contract Destination',
          'Diesel',
          30000,
          new Date().toISOString(),
          new Date().toISOString(),
          150000,
          null,
          null,
        ]
      );
      return res.rows[0].trip;
    });

    // Assert all fields required by Trip TypeScript model are present
    expect(trip).toBeDefined();
    expect(trip.id).toBeDefined();
    expect(trip.doc_number || trip.docNumber).toBeDefined();
    expect(trip.status).toBe('in_transit');
    expect(trip.vehicle_id || trip.vehicleId).toBe(fixtures.vehicles.riyadhTankerId);
    expect(trip.driver_id || trip.driverId).toBe(fixtures.drivers.validDriver1Id);
    expect(trip.origin_plant || trip.originPlant).toBe('1100');
    expect(trip.destination_location || trip.destinationLocation).toBe('Contract Destination');
    expect(trip.cargo_type || trip.cargoType).toBe('Diesel');
    expect(trip.cargo_volume_liters || trip.cargoVolumeLiters).toBeDefined();
    expect(trip.start_odometer || trip.startOdometer).toBeDefined();
    expect(trip.version).toBeDefined();
  });

  it('Invariant: contract RPC complete_trip exists with matching arguments and returns all Trip fields', async () => {
    // Dispatch a trip first
    let tripId = '';
    await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const res = await client.query<{ trip: { id: string } }>(
        'SELECT public.create_trip($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) AS trip;',
        [
          crypto.randomUUID(),
          fixtures.vehicles.riyadhTankerId,
          fixtures.drivers.validDriver1Id,
          '1100',
          'Contract Dest 2',
          'Diesel',
          25000,
          new Date().toISOString(),
          new Date().toISOString(),
          150000,
          null,
          null,
        ]
      );
      tripId = res.rows[0].trip.id;
    });

    const params = await getFunctionParamNames('complete_trip');
    const expectedArgs = [
      'p_request_id',
      'p_trip_id',
      'p_actual_arrival',
      'p_end_odometer',
      'p_fuel_liters_consumed',
      'p_fuel_cost',
      'p_driver_allowance_cost',
      'p_expected_version',
    ];
    for (const arg of expectedArgs) {
      expect(params).toContain(arg);
    }

    const completedTrip = await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const res = await client.query<{ trip: Record<string, unknown> }>(
        'SELECT public.complete_trip($1, $2, $3, $4, $5, $6, $7, $8, $9) AS trip;',
        [
          crypto.randomUUID(),
          tripId,
          new Date().toISOString(),
          150450,
          150,
          172.50,
          200.00,
          null,
          null,
        ]
      );
      return res.rows[0].trip;
    });

    expect(completedTrip).toBeDefined();
    expect(completedTrip.id).toBe(tripId);
    expect(completedTrip.status).toBe('completed');
    expect(completedTrip.end_odometer || completedTrip.endOdometer).toBeDefined();
    expect(completedTrip.distance_km || completedTrip.distanceKm).toBeDefined();
    expect(completedTrip.total_trip_cost || completedTrip.totalTripCost).toBeDefined();
    expect(completedTrip.je_doc_number || completedTrip.jeDocNumber || completedTrip.postedAccountingDocNumber).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 2. RPC Contract Invariants: Fuel Log Commands
  // --------------------------------------------------------------------------

  it('Invariant: contract RPC create_fuel_log exists with matching arguments and returns all FuelLog fields', async () => {
    const params = await getFunctionParamNames('create_fuel_log');
    const expectedArgs = [
      'p_request_id',
      'p_vehicle_id',
      'p_fuel_type',
      'p_quantity_liters',
      'p_cost_per_liter',
      'p_odometer',
      'p_station_name',
      'p_plant_code',
    ];
    for (const arg of expectedArgs) {
      expect(params).toContain(arg);
    }

    const fuelLog = await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const res = await client.query<{ fuel: Record<string, unknown> }>(
        'SELECT public.create_fuel_log($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) AS fuel;',
        [
          crypto.randomUUID(),
          fixtures.vehicles.riyadhTankerId,
          fixtures.drivers.validDriver1Id,
          'Diesel',
          200,
          520.00,
          150600,
          'محطة وقود حمص المركزية #5 (تجريبي)',
          '1100',
          null,
        ]
      );
      return res.rows[0].fuel;
    });

    expect(fuelLog).toBeDefined();
    expect(fuelLog.id).toBeDefined();
    expect(fuelLog.doc_number || fuelLog.docNumber).toBeDefined();
    expect(fuelLog.vehicle_id || fuelLog.vehicleId).toBe(fixtures.vehicles.riyadhTankerId);
    expect(fuelLog.liters || fuelLog.quantityLiters).toBeDefined();
    expect(fuelLog.total_cost || fuelLog.totalCost).toBeDefined();
    expect(fuelLog.odometer).toBeDefined();
    expect(fuelLog.station_name || fuelLog.stationName).toBe('محطة وقود حمص المركزية #5 (تجريبي)');
  });

  // --------------------------------------------------------------------------
  // 3. RPC Contract Invariants: Maintenance Commands
  // --------------------------------------------------------------------------

  it('Invariant: contract RPC issue_parts_to_maintenance_order exists with matching arguments and returns order and materialDocNumber', async () => {
    const moDocNumber = `MO-2026-CTR-${Math.floor(Math.random() * 900000 + 100000)}`;
    await dbHandle.adminClient.query(`
      INSERT INTO public.maintenance_orders (
        id, doc_number, vehicle_id, vehicle_plate, order_type, description, start_date, created_by
      ) VALUES (
        gen_random_uuid(), $1, $2, 'أ ب ج 1101', 'Preventive', 'Service 20K', current_date, 'system'
      );
    `, [moDocNumber, fixtures.vehicles.riyadhTankerId]);

    const params = await getFunctionParamNames('issue_parts_to_maintenance_order');
    const expectedArgs = [
      'p_request_id',
      'p_order_id',
      'p_plant_code',
      'p_storage_location',
      'p_description',
      'p_parts',
    ];
    for (const arg of expectedArgs) {
      expect(params).toContain(arg);
    }

    const doc = await asUser(dbHandle.pool, whClerkId, async (client) => {
      const res = await client.query<{ doc: Record<string, unknown> }>(
        'SELECT public.issue_parts_to_maintenance_order($1, $2, $3, $4, $5, $6, $7) AS doc;',
        [
          crypto.randomUUID(),
          moDocNumber,
          '1100',
          'SL01',
          'Filters issue',
          JSON.stringify([{ material_code: fixtures.materials.filter, quantity: 1 }]),
          null,
        ]
      );
      return res.rows[0].doc;
    });

    expect(doc).toBeDefined();
    expect(doc.materialDocNumber || doc.material_doc_number).toBeDefined();
    expect(doc.order).toBeDefined();
  });

  it('Invariant: contract RPC complete_maintenance_order exists with matching arguments and returns all MaintenanceOrder fields', async () => {
    const moDocNumber = `MO-2026-CTR2-${Math.floor(Math.random() * 900000 + 100000)}`;
    await dbHandle.adminClient.query(`
      INSERT INTO public.maintenance_orders (
        id, doc_number, vehicle_id, vehicle_plate, order_type, description, start_date, created_by
      ) VALUES (
        gen_random_uuid(), $1, $2, 'أ ب ج 1101', 'Corrective', 'Inspection Complete', current_date, 'system'
      );
    `, [moDocNumber, fixtures.vehicles.riyadhTankerId]);

    const params = await getFunctionParamNames('complete_maintenance_order');
    const expectedArgs = [
      'p_request_id',
      'p_order_id',
      'p_completion_date',
      'p_labor_hours',
      'p_labor_rate_per_hour',
      'p_downtime_hours',
    ];
    for (const arg of expectedArgs) {
      expect(params).toContain(arg);
    }

    const completedMo = await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const res = await client.query<{ mo: Record<string, unknown> }>(
        'SELECT public.complete_maintenance_order($1, $2, $3, $4, $5, $6, $7, $8) AS mo;',
        [
          crypto.randomUUID(),
          moDocNumber,
          new Date().toISOString().slice(0, 10),
          3.5,
          100.00,
          1.5,
          null,
          null,
        ]
      );
      return res.rows[0].mo;
    });

    expect(completedMo).toBeDefined();
    expect(completedMo.id).toBeDefined();
    expect(completedMo.status).toBe('completed');
    expect(completedMo.labor_cost || completedMo.laborCost).toBeDefined();
    expect(completedMo.actual_cost || completedMo.actualCost).toBeDefined();
    expect(completedMo.je_doc_number || completedMo.jeDocNumber).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 4. RPC Contract Invariants: Finance Posting Commands
  // --------------------------------------------------------------------------

  it('Invariant: contract RPC post_journal exists with matching arguments and returns docNumber and jeId', async () => {
    const params = await getFunctionParamNames('post_journal');
    const expectedArgs = [
      'p_request_id',
      'p_company_code',
      'p_fiscal_year',
      'p_period',
      'p_posting_date',
      'p_document_date',
      'p_document_type',
      'p_header_text',
      'p_lines',
    ];
    for (const arg of expectedArgs) {
      expect(params).toContain(arg);
    }

    const je = await asUser(dbHandle.pool, accountantId, async (client) => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await client.query<{ je: Record<string, unknown> }>(
        'SELECT public.post_journal($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) AS je;',
        [
          crypto.randomUUID(),
          '1000',
          '2026',
          10,
          today,
          today,
          'SA',
          'Contract Verification Journal',
          'CTR-REF-01',
          JSON.stringify([
            { line_number: 1, posting_key: '40', account_number: '601010', debit: 500, credit: 0 },
            { line_number: 2, posting_key: '50', account_number: '201010', debit: 0, credit: 500 },
          ]),
        ]
      );
      return res.rows[0].je;
    });

    expect(je).toBeDefined();
    expect(je.docNumber || je.doc_number).toBeDefined();
    expect(je.jeId || je.id).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 5. RPC Contract Invariants: Field Telemetry Commands
  // --------------------------------------------------------------------------

  it('Invariant: contract RPC record_trip_event exists with matching arguments and returns event payload', async () => {
    const params = await getFunctionParamNames('record_trip_event');
    const expectedArgs = [
      'p_request_id',
      'p_trip_id',
      'p_vehicle_id',
      'p_event_type',
      'p_occurred_at',
      'p_payload',
    ];
    for (const arg of expectedArgs) {
      expect(params).toContain(arg);
    }

    const event = await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const res = await client.query<{ res: Record<string, unknown> }>(
        'SELECT public.record_trip_event($1, $2, $3, $4, $5, $6) AS res;',
        [
          crypto.randomUUID(),
          crypto.randomUUID(),
          fixtures.vehicles.riyadhTankerId,
          'checkpoint_passed',
          new Date().toISOString(),
          JSON.stringify({ location: 'Al-Kharj Road Checkpoint', speed: 80 }),
        ]
      );
      return res.rows[0].res;
    });

    expect(event).toBeDefined();
    expect(event.requestId || event.request_id).toBeDefined();
    expect(event.vehicleId || event.vehicle_id).toBe(fixtures.vehicles.riyadhTankerId);
  });

  it('Invariant: contract RPC record_odometer_reading exists with matching arguments and returns reading payload', async () => {
    const params = await getFunctionParamNames('record_odometer_reading');
    const expectedArgs = [
      'p_request_id',
      'p_vehicle_id',
      'p_reading_km',
      'p_captured_at',
      'p_source',
    ];
    for (const arg of expectedArgs) {
      expect(params).toContain(arg);
    }

    const reading = await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const res = await client.query<{ res: Record<string, unknown> }>(
        'SELECT public.record_odometer_reading($1, $2, $3, $4, $5) AS res;',
        [
          crypto.randomUUID(),
          fixtures.vehicles.riyadhTankerId,
          150700,
          new Date().toISOString(),
          'driver_check_in',
        ]
      );
      return res.rows[0].res;
    });

    expect(reading).toBeDefined();
    expect(reading.readingKm || reading.reading_km).toBe(150700);
    expect(reading.vehicleId || reading.vehicle_id).toBe(fixtures.vehicles.riyadhTankerId);
  });

  it('Invariant: contract RPC record_inspection exists with matching arguments and returns inspection payload', async () => {
    const params = await getFunctionParamNames('record_inspection');
    const expectedArgs = [
      'p_request_id',
      'p_vehicle_id',
      'p_inspected_at',
      'p_result',
      'p_notes',
      'p_checklist',
    ];
    for (const arg of expectedArgs) {
      expect(params).toContain(arg);
    }

    const inspection = await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const res = await client.query<{ res: Record<string, unknown> }>(
        'SELECT public.record_inspection($1, $2, $3, $4, $5, $6) AS res;',
        [
          crypto.randomUUID(),
          fixtures.vehicles.riyadhTankerId,
          new Date().toISOString(),
          'passed',
          'All safety valves and tire pressures optimal',
          JSON.stringify({ tires: true, brakes: true, emergencyValves: true }),
        ]
      );
      return res.rows[0].res;
    });

    expect(inspection).toBeDefined();
    expect(inspection.result).toBe('passed');
    expect(inspection.vehicleId || inspection.vehicle_id).toBe(fixtures.vehicles.riyadhTankerId);
  });

  // --------------------------------------------------------------------------
  // 6. RPC Contract Invariants: Master Data (Vehicles & Drivers)
  // --------------------------------------------------------------------------

  it('Invariant: contract RPCs create_vehicle, update_vehicle, set_vehicle_active exist and return Vehicle fields', async () => {
    const createParams = await getFunctionParamNames('create_vehicle');
    expect(createParams).toContain('p_request_id');
    expect(createParams).toContain('p_code');
    expect(createParams).toContain('p_plate_number');
    expect(createParams).toContain('p_plant_code');
    expect(createParams).toContain('p_cost_center');

    let createdId = '';
    const newVeh = await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const res = await client.query<{ veh: Record<string, unknown> }>(
        'SELECT public.create_vehicle($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) AS veh;',
        [
          crypto.randomUUID(),
          'TRK-CTR-01',
          'ط ي ع 9911',
          'HeavyTruck',
          'MAN TGX 26.540',
          '1100',
          'CC-1100',
          'WMA06XZZ89M119911',
          2024,
          0,
          5000,
          'Diesel',
          null,
          '2027-12-31',
          '2027-12-31',
        ]
      );
      return res.rows[0].veh;
    });

    expect(newVeh).toBeDefined();
    expect(newVeh.id).toBeDefined();
    createdId = newVeh.id as string;
    expect(newVeh.plate_number || newVeh.plateNumber).toBe('ط ي ع 9911');
    expect(newVeh.status).toBe('available');

    // Update Vehicle
    const updatedVeh = await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const res = await client.query<{ veh: Record<string, unknown> }>(
        'SELECT public.update_vehicle($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) AS veh;',
        [
          crypto.randomUUID(),
          createdId,
          1,
          'TRK-CTR-01',
          'ط ي ع 9911',
          'HeavyTruck',
          'MAN TGX 26.540 Euro 6',
          'WMA06XZZ89M119911',
          2024,
          0,
          'Diesel',
          '1100',
          'CC-1100',
          null,
        ]
      );
      return res.rows[0].veh;
    });

    expect(updatedVeh.version).toBe(2);

    // Deactivate Vehicle
    const deactivatedVeh = await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const res = await client.query<{ res: Record<string, unknown> }>(
        'SELECT public.set_vehicle_active($1, $2, $3) AS res;',
        [crypto.randomUUID(), createdId, false]
      );
      return res.rows[0].res;
    });

    expect(deactivatedVeh).toBeDefined();
  });

  it('Invariant: contract RPCs create_driver, update_driver, set_driver_active exist and return Driver fields', async () => {
    const createParams = await getFunctionParamNames('create_driver');
    expect(createParams).toContain('p_request_id');
    expect(createParams).toContain('p_code');
    expect(createParams).toContain('p_name');
    expect(createParams).toContain('p_national_id');
    expect(createParams).toContain('p_license_number');

    let driverId = '';
    const newDrv = await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const res = await client.query<{ drv: Record<string, unknown> }>(
        'SELECT public.create_driver($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) AS drv;',
        [
          crypto.randomUUID(),
          'DRV-CTR-01',
          'فراس الحموي',
          '05014555666',
          '+963944001122',
          'LIC-CTR-01',
          'عمومي ثقيل',
          '2028-12-31',
          '1100',
          5.0,
        ]
      );
      return res.rows[0].drv;
    });

    expect(newDrv).toBeDefined();
    expect(newDrv.id).toBeDefined();
    driverId = newDrv.id as string;
    expect(newDrv.name).toBe('فراس الحموي');
    expect(newDrv.status).toBe('available');

    // Update Driver
    const updatedDrv = await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const res = await client.query<{ drv: Record<string, unknown> }>(
        'SELECT public.update_driver($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) AS drv;',
        [
          crypto.randomUUID(),
          driverId,
          1,
          'فراس عبد الله الحموي',
          '+963944001133',
          'LIC-CTR-01',
          'عمومي ثقيل',
          '2028-12-31',
          '1100',
          5.0,
        ]
      );
      return res.rows[0].drv;
    });

    expect(updatedDrv.version).toBe(2);

    // Deactivate Driver
    const deactivatedDrv = await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const res = await client.query<{ res: Record<string, unknown> }>(
        'SELECT public.set_driver_active($1, $2, $3) AS res;',
        [crypto.randomUUID(), driverId, false]
      );
      return res.rows[0].res;
    });

    expect(deactivatedDrv).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 7. RPC Contract Invariants: Fleet Reporting & KPIs
  // --------------------------------------------------------------------------

  it('Invariant: contract RPC get_vehicle_expiry_alerts returns ExpiryAlert fields', async () => {
    const alerts = await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const res = await client.query<Record<string, unknown>>(
        'SELECT * FROM public.get_vehicle_expiry_alerts($1);',
        [60]
      );
      return res.rows;
    });

    expect(Array.isArray(alerts)).toBe(true);
    if (alerts.length > 0) {
      const alert = alerts[0];
      expect(alert.id).toBeDefined();
      expect(alert.vehicle_id || alert.vehicleId).toBeDefined();
      expect(alert.alert_type || alert.alertType).toBeDefined();
      expect(alert.expiry_date || alert.expiryDate).toBeDefined();
      expect(alert.days_remaining !== undefined || alert.daysRemaining !== undefined).toBe(true);
    }
  });

  it('Invariant: contract RPC get_vehicle_cost_report returns VehicleCostReport fields', async () => {
    const report = await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const res = await client.query<Record<string, unknown>>(
        'SELECT * FROM public.get_vehicle_cost_report($1);',
        [fixtures.vehicles.riyadhTankerId]
      );
      return res.rows[0];
    });

    expect(report).toBeDefined();
    expect(report.vehicle_id || report.vehicleId).toBe(fixtures.vehicles.riyadhTankerId);
    expect(report.total_distance_km !== undefined || report.totalDistanceKm !== undefined).toBe(true);
    expect(report.fuel_cost_total !== undefined || report.fuelCostTotal !== undefined).toBe(true);
    expect(report.grand_total_cost !== undefined || report.grandTotalCost !== undefined).toBe(true);
    expect(report.cost_per_km !== undefined || report.costPerKm !== undefined).toBe(true);
  });

  it('Invariant: contract RPC get_fleet_dashboard_kpis returns all FleetSummaryKPIs fields', async () => {
    const kpis = await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const res = await client.query<Record<string, unknown>>(
        'SELECT * FROM public.get_fleet_dashboard_kpis();'
      );
      return res.rows[0];
    });

    expect(kpis).toBeDefined();
    expect(kpis.total_vehicles !== undefined || kpis.totalVehicles !== undefined).toBe(true);
    expect(kpis.on_road_count !== undefined || kpis.onRoadCount !== undefined).toBe(true);
    expect(kpis.available_count !== undefined || kpis.availableCount !== undefined).toBe(true);
    expect(kpis.maintenance_count !== undefined || kpis.maintenanceCount !== undefined).toBe(true);
    expect(kpis.fleet_utilization_rate !== undefined || kpis.fleetUtilizationRate !== undefined).toBe(true);
    expect(kpis.active_trips_count !== undefined || kpis.activeTripsCount !== undefined).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 8. Table/View Schema Invariants (.from('...'))
  // --------------------------------------------------------------------------

  it('Invariant: contract table schemas for vehicles, drivers, trips, fuel_logs, maintenance_orders, preventive_schedules, alerts, and views contain all client-mapped columns', async () => {
    async function getColumns(tableName: string): Promise<string[]> {
      const res = await dbHandle.adminClient.query<{ column_name: string }>(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1;
      `,
        [tableName]
      );
      return res.rows.map((r) => r.column_name);
    }

    // 1. vehicles table
    const vehicleCols = await getColumns('vehicles');
    const expectedVehicleCols = [
      'id', 'code', 'plate_number', 'type', 'fuel_type', 'capacity_liters',
      'make_model', 'year', 'current_odometer', 'status', 'plant_code',
      'cost_center', 'insurance_expiry', 'registration_expiry', 'version', 'is_deleted'
    ];
    for (const c of expectedVehicleCols) {
      expect(vehicleCols).toContain(c);
    }

    // 2. drivers table
    const driverCols = await getColumns('drivers');
    const expectedDriverCols = [
      'id', 'code', 'name', 'national_id', 'license_number', 'license_class',
      'license_expiry', 'mobile', 'safety_rating', 'status', 'plant_code', 'version', 'is_deleted'
    ];
    for (const c of expectedDriverCols) {
      expect(driverCols).toContain(c);
    }

    // 3. trips table
    const tripCols = await getColumns('trips');
    const expectedTripCols = [
      'id', 'doc_number', 'status', 'vehicle_id', 'driver_id', 'origin_plant',
      'destination_location', 'cargo_type', 'cargo_volume_liters', 'scheduled_departure',
      'scheduled_arrival', 'start_odometer', 'end_odometer', 'distance_km',
      'fuel_liters_consumed', 'fuel_cost', 'total_trip_cost', 'je_doc_number', 'version', 'is_deleted'
    ];
    for (const c of expectedTripCols) {
      expect(tripCols).toContain(c);
    }

    // 4. fuel_logs table
    const fuelCols = await getColumns('fuel_logs');
    const expectedFuelCols = [
      'id', 'doc_number', 'vehicle_id', 'driver_id', 'fuel_type', 'liters',
      'unit_price', 'total_cost', 'odometer', 'station_name', 'plant_code', 'version', 'is_deleted'
    ];
    for (const c of expectedFuelCols) {
      expect(fuelCols).toContain(c);
    }

    // 5. maintenance_orders table
    const moCols = await getColumns('maintenance_orders');
    const expectedMoCols = [
      'id', 'doc_number', 'vehicle_id', 'order_type', 'description',
      'estimated_cost', 'actual_cost', 'parts_cost', 'labor_cost', 'labor_hours',
      'start_date', 'completion_date', 'status', 'version', 'is_deleted'
    ];
    for (const c of expectedMoCols) {
      expect(moCols).toContain(c);
    }

    // 6. preventive_schedules table
    const psCols = await getColumns('preventive_schedules');
    const expectedPsCols = [
      'id', 'vehicle_id', 'service_name', 'interval_km', 'interval_days',
      'last_done_odometer', 'last_done_date', 'next_due_odometer', 'next_due_date', 'is_active'
    ];
    for (const c of expectedPsCols) {
      expect(psCols).toContain(c);
    }

    // 7. fuel_anomaly_alerts table
    const alertCols = await getColumns('fuel_anomaly_alerts');
    const expectedAlertCols = [
      'id', 'vehicle_id', 'fuel_log_id', 'liters', 'recorded_consumption',
      'baseline_consumption', 'deviation_percentage', 'severity', 'status', 'is_resolved'
    ];
    for (const c of expectedAlertCols) {
      expect(alertCols).toContain(c);
    }

    // 8. v_cost_center_fleet_reconciliation view
    const reconCols = await getColumns('v_cost_center_fleet_reconciliation');
    const expectedReconCols = [
      'cost_center', 'total_fleet_cost', 'total_gl_cost', 'variance'
    ];
    for (const c of expectedReconCols) {
      expect(reconCols).toContain(c);
    }
  });
});
