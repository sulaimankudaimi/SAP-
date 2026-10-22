import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createFreshDatabase,
  destroyDatabase,
  asUser,
  createProfile,
  type TestDatabaseHandle,
} from './helpers';
import { seedReferenceData, type SeededFixtures } from './fixtures';
import { READ_SPECS, type ReadSpec } from '../core/gateway/readSpecs';
import { mapRow, mapRows } from '../core/gateway/rowMappers';
import type {
  Vehicle,
  Driver,
  Trip,
  FuelLog,
  MaintenanceOrder,
  PreventiveSchedule,
  FuelAnomalyAlert,
} from '../types/models';

/**
 * Small SQL translator that turns declarative ReadSpec into executable PostgreSQL query
 */
function translateSpecToSql(spec: ReadSpec): { text: string; values: unknown[] } {
  const selectedCols = spec.columns.map((c) => (c.includes('"') ? c : `"${c}"`)).join(', ');
  let sql = `SELECT ${selectedCols} FROM public."${spec.table}"`;
  const values: unknown[] = [];

  if (spec.filters && spec.filters.length > 0) {
    const whereClauses: string[] = [];
    for (const [col, op, val] of spec.filters) {
      const colName = col.includes('"') ? col : `"${col}"`;
      if (op === 'eq') {
        values.push(val);
        whereClauses.push(`${colName} = $${values.length}`);
      } else if (op === 'neq') {
        values.push(val);
        whereClauses.push(`${colName} <> $${values.length}`);
      } else if (op === 'gt') {
        values.push(val);
        whereClauses.push(`${colName} > $${values.length}`);
      } else if (op === 'gte') {
        values.push(val);
        whereClauses.push(`${colName} >= $${values.length}`);
      } else if (op === 'lt') {
        values.push(val);
        whereClauses.push(`${colName} < $${values.length}`);
      } else if (op === 'lte') {
        values.push(val);
        whereClauses.push(`${colName} <= $${values.length}`);
      } else if (op === 'in') {
        const arr = val as unknown[];
        if (arr.length === 0) {
          whereClauses.push('1 = 0');
        } else {
          const placeholders = arr.map((item) => {
            values.push(item);
            return `$${values.length}`;
          });
          whereClauses.push(`${colName} IN (${placeholders.join(', ')})`);
        }
      }
    }
    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }
  }

  if (spec.order && spec.order.length > 0) {
    const orderClauses = spec.order.map(([col, dir]) => {
      const colName = col.includes('"') ? col : `"${col}"`;
      return `${colName} ${dir.toUpperCase()}`;
    });
    sql += ` ORDER BY ${orderClauses.join(', ')}`;
  }

  return { text: sql, values };
}

describe('Contract Reads: READ_SPECS, RowMappers, & Schema Invariants', () => {
  let dbHandle: TestDatabaseHandle;
  let fixtures: SeededFixtures;
  let adminUserId: string;
  let fleetMgrId: string;

  beforeAll(async () => {
    dbHandle = await createFreshDatabase('contract_reads_suite');
    fixtures = await seedReferenceData(dbHandle.adminClient);

    adminUserId = await createProfile(dbHandle.adminClient, {
      username: 'admin_reads',
      roleCode: 'ADMIN',
      plantCodes: ['1100', '1200'],
    });

    fleetMgrId = await createProfile(dbHandle.adminClient, {
      username: 'flt_reads',
      roleCode: 'FLEET_MANAGER',
      plantCodes: ['1100'],
    });
  });

  afterAll(async () => {
    if (dbHandle) {
      await destroyDatabase(dbHandle);
    }
  });

  // --------------------------------------------------------------------------
  // 1. Schema Invariants: Every column in READ_SPECS exists in information_schema.columns
  // --------------------------------------------------------------------------
  it('asserts that every column named in every READ_SPECS entry exists in information_schema.columns', async () => {
    const res = await dbHandle.adminClient.query<{ table_name: string; column_name: string }>(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public';
    `);

    const tableColsMap = new Map<string, Set<string>>();
    for (const r of res.rows) {
      if (!tableColsMap.has(r.table_name)) {
        tableColsMap.set(r.table_name, new Set());
      }
      tableColsMap.get(r.table_name)!.add(r.column_name);
    }

    for (const [specKey, spec] of Object.entries(READ_SPECS)) {
      const validCols = tableColsMap.get(spec.table);
      expect(
        validCols,
        `Table/View "${spec.table}" referenced by READ_SPECS.${specKey} must exist in public schema`
      ).toBeDefined();

      for (const col of spec.columns) {
        // Strip quotes if present
        const cleanCol = col.replace(/"/g, '');
        expect(
          validCols!.has(cleanCol),
          `Column "${cleanCol}" in READ_SPECS.${specKey} does not exist in table "${spec.table}"`
        ).toBe(true);
      }
    }
  });

  // --------------------------------------------------------------------------
  // 2. RPC Arguments: Every argument sent by client exists in information_schema.parameters
  // --------------------------------------------------------------------------
  it('asserts that every RPC argument name the client sends exists in information_schema.parameters', async () => {
    const res = await dbHandle.adminClient.query<{ specific_name: string; parameter_name: string }>(`
      SELECT specific_name, parameter_name
      FROM information_schema.parameters
      WHERE specific_schema = 'public'
        AND parameter_mode = 'IN';
    `);

    const fnParamsMap = new Map<string, Set<string>>();
    for (const r of res.rows) {
      const baseFn = r.specific_name.replace(/_[0-9]+$/, '');
      if (!fnParamsMap.has(baseFn)) {
        fnParamsMap.set(baseFn, new Set());
      }
      if (r.parameter_name) {
        fnParamsMap.get(baseFn)!.add(r.parameter_name);
      }
    }

    // Client RPC parameter map (what SupabaseGateway sends)
    const clientRpcArgs: Record<string, string[]> = {
      create_trip: [
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
      ],
      complete_trip: [
        'p_request_id',
        'p_trip_id',
        'p_end_odometer',
        'p_actual_arrival',
        'p_fuel_liters_consumed',
        'p_expected_version',
      ],
      create_fuel_log: [
        'p_request_id',
        'p_vehicle_id',
        'p_driver_id',
        'p_fuel_type',
        'p_odometer',
        'p_liters',
        'p_unit_price',
        'p_station_name',
        'p_invoice_number',
        'p_logged_at',
        'p_expected_version',
      ],
      issue_parts_to_maintenance_order: [
        'p_request_id',
        'p_order_id',
        'p_plant_code',
        'p_parts',
        'p_expected_version',
      ],
      complete_maintenance_order: [
        'p_request_id',
        'p_order_id',
        'p_labor_hours',
        'p_labor_rate_per_hour',
        'p_downtime_hours',
        'p_completion_date',
        'p_expected_version',
      ],
      post_journal: [
        'p_request_id',
        'p_source_type',
        'p_source_id',
        'p_company_code',
        'p_fiscal_year',
        'p_period',
        'p_posting_date',
        'p_document_date',
        'p_document_type',
        'p_header_text',
        'p_reference',
        'p_lines',
        'p_expected_version',
        'p_event',
      ],
      resolve_fuel_anomaly: ['p_request_id', 'p_alert_id', 'p_notes', 'p_expected_version'],
      get_vehicle_expiry_alerts: ['p_days'],
      get_vehicle_cost_report: ['p_vehicle_id'],
      get_fleet_dashboard_kpis: [],
    };

    for (const [rpcName, args] of Object.entries(clientRpcArgs)) {
      const validParams = fnParamsMap.get(rpcName) || new Set<string>();
      for (const arg of args) {
        expect(
          validParams.has(arg),
          `RPC parameter "${arg}" sent to "${rpcName}" does not exist in PostgreSQL parameter definition for ${rpcName}`
        ).toBe(true);
      }
    }
  });

  // --------------------------------------------------------------------------
  // 3. Translated SQL Queries Executed Under RLS and Passed Through Row Mappers
  // --------------------------------------------------------------------------
  it('translates READ_SPECS to SQL, runs via asUser under RLS, and asserts typed row mapper fields', async () => {
    // A. vehicles
    await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const q = translateSpecToSql(READ_SPECS.vehicles);
      const res = await client.query(q.text, q.values);
      expect(res.rows.length).toBeGreaterThanOrEqual(1);

      const mapped = mapRows('vehicles', res.rows as Record<string, unknown>[]) as Vehicle[];
      const first = mapped[0];
      expect(typeof first.id).toBe('string');
      expect(typeof first.plateNumber).toBe('string');
      expect(typeof first.type).toBe('string');
      expect(typeof first.version).toBe('number');
      expect(first.isDeleted).toBe(false);
    });

    // B. drivers
    await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const q = translateSpecToSql(READ_SPECS.drivers);
      const res = await client.query(q.text, q.values);
      expect(res.rows.length).toBeGreaterThanOrEqual(1);

      const mapped = mapRows('drivers', res.rows as Record<string, unknown>[]) as Driver[];
      const first = mapped[0];
      expect(typeof first.id).toBe('string');
      expect(typeof first.name).toBe('string');
      expect(typeof first.iqamaNumber).toBe('string');
      expect(typeof first.version).toBe('number');
      expect(first.isDeleted).toBe(false);
    });

    // C. trips
    await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const q = translateSpecToSql(READ_SPECS.trips);
      const res = await client.query(q.text, q.values);
      const mapped = mapRows('trips', res.rows as Record<string, unknown>[]) as Trip[];
      if (mapped.length > 0) {
        const first = mapped[0];
        expect(typeof first.id).toBe('string');
        expect(typeof first.docNumber).toBe('string');
        expect(typeof first.status).toBe('string');
        expect(typeof first.version).toBe('number');
      }
    });

    // D. fuelLogs
    await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const q = translateSpecToSql(READ_SPECS.fuelLogs);
      const res = await client.query(q.text, q.values);
      const mapped = mapRows('fuelLogs', res.rows as Record<string, unknown>[]) as FuelLog[];
      if (mapped.length > 0) {
        const first = mapped[0];
        expect(typeof first.id).toBe('string');
        expect(typeof first.docNumber).toBe('string');
        expect(typeof first.quantityLiters).toBe('number');
        expect(typeof (first as unknown as { version?: number }).version).toBe('number');
      }
    });

    // E. maintenanceOrders
    await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const q = translateSpecToSql(READ_SPECS.maintenanceOrders);
      const res = await client.query(q.text, q.values);
      const mapped = mapRows('maintenanceOrders', res.rows as Record<string, unknown>[]) as MaintenanceOrder[];
      if (mapped.length > 0) {
        const first = mapped[0];
        expect(typeof first.id).toBe('string');
        expect(typeof first.docNumber).toBe('string');
        expect(typeof first.status).toBe('string');
        expect(typeof first.version).toBe('number');
      }
    });

    // F. fuelAnomalyAlerts
    await asUser(dbHandle.pool, fleetMgrId, async (client) => {
      const q = translateSpecToSql(READ_SPECS.fuelAnomalyAlerts);
      const res = await client.query(q.text, q.values);
      const mapped = mapRows('fuelAnomalyAlerts', res.rows as Record<string, unknown>[]) as FuelAnomalyAlert[];
      // Filter applied properly: status IN ('active', 'investigated')
      for (const alert of mapped) {
        expect(['active', 'investigated']).toContain(alert.status);
      }
    });
  });
});
