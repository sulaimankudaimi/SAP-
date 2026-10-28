import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseGateway } from '../core/gateway/SupabaseGateway';

interface ParsedRpcParam {
  name: string;
  type: string;
  hasDefault: boolean;
}

interface ParsedRpcFunction {
  name: string;
  file: string;
  parameters: ParsedRpcParam[];
}

/**
 * Parses all CREATE OR REPLACE FUNCTION public.<name>(...) signatures from SQL migrations.
 */
function parseMigrationRpcSignatures(migrationsDir: string): Map<string, ParsedRpcFunction> {
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const functionsMap = new Map<string, ParsedRpcFunction>();

  const functionHeaderRegex = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.([a-z0-9_]+)\s*\(([\s\S]*?)\)\s*RETURNS/gi;

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    let match: RegExpExecArray | null;
    while ((match = functionHeaderRegex.exec(content)) !== null) {
      const fnName = match[1];
      const rawParams = match[2].trim();

      const params: ParsedRpcParam[] = [];
      if (rawParams.length > 0) {
        // Split parameters by comma outside parentheses (e.g. numeric(18,3))
        const parts: string[] = [];
        let current = '';
        let parenDepth = 0;
        for (let i = 0; i < rawParams.length; i++) {
          const ch = rawParams[i];
          if (ch === '(') parenDepth++;
          else if (ch === ')') parenDepth--;
          else if (ch === ',' && parenDepth === 0) {
            parts.push(current.trim());
            current = '';
            continue;
          }
          current += ch;
        }
        if (current.trim().length > 0) {
          parts.push(current.trim());
        }

        for (const part of parts) {
          const paramMatch = part.match(/^(p_[a-z0-9_]+)\s+([a-z0-9_\[\]]+(?:\([0-9,\s]+\))?)(?:\s+DEFAULT\s+[\s\S]+)?$/i);
          if (paramMatch) {
            params.push({
              name: paramMatch[1],
              type: paramMatch[2],
              hasDefault: /DEFAULT/i.test(part),
            });
          }
        }
      }

      // Later migrations override earlier definitions
      functionsMap.set(fnName, {
        name: fnName,
        file,
        parameters: params,
      });
    }
  }

  return functionsMap;
}

describe('RPC Signatures & SQL Contract Alignment (Unit Test - FS only)', () => {
  const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
  const sqlFunctions = parseMigrationRpcSignatures(migrationsDir);

  it('parses expected core RPCs from migration files', () => {
    expect(sqlFunctions.has('create_trip')).toBe(true);
    expect(sqlFunctions.has('complete_trip')).toBe(true);
    expect(sqlFunctions.has('create_fuel_log')).toBe(true);
    expect(sqlFunctions.has('issue_parts_to_maintenance_order')).toBe(true);
    expect(sqlFunctions.has('complete_maintenance_order')).toBe(true);
    expect(sqlFunctions.has('post_journal')).toBe(true);
    expect(sqlFunctions.has('resolve_fuel_anomaly')).toBe(true);
    expect(sqlFunctions.has('get_vehicle_expiry_alerts')).toBe(true);
    expect(sqlFunctions.has('get_vehicle_cost_report')).toBe(true);
    expect(sqlFunctions.has('get_fleet_dashboard_kpis')).toBe(true);
  });

  it('proves get_vehicle_expiry_alerts declares p_days and NOT p_days_ahead in SQL', () => {
    const fn = sqlFunctions.get('get_vehicle_expiry_alerts');
    expect(fn).toBeDefined();
    const paramNames = fn!.parameters.map((p) => p.name);
    expect(paramNames).toContain('p_days');
    expect(paramNames).not.toContain('p_days_ahead');
  });

  it('asserts the exact argument names of EVERY rpc call from SupabaseGateway against SQL signatures', async () => {
    const capturedCalls: { name: string; args?: Record<string, unknown> }[] = [];

    // Create SupabaseGateway and mock client.rpc
    const gateway = new SupabaseGateway();
    const client = (gateway as unknown as { client: { rpc: unknown } }).client;

    client.rpc = (fnName: string, args?: Record<string, unknown>) => {
      capturedCalls.push({ name: fnName, args });
      // Return plausible empty/typed structure so mappers do not fail
      if (fnName === 'get_fleet_dashboard_kpis') {
        return Promise.resolve({
          data: {
            activeVehicles: 0,
            maintenanceVehicles: 0,
            activeDrivers: 0,
            onTripDrivers: 0,
            activeTrips: 0,
            monthFuelCost: 0,
            monthMaintenanceCost: 0,
            openAnomalies: 0,
          },
          error: null,
        });
      }
      if (fnName === 'get_vehicle_cost_report') {
        return Promise.resolve({
          data: {
            vehicleId: 'v-1',
            plateNumber: 'ABC 123',
            makeModel: 'Model X',
            totalFuelCost: 0,
            totalMaintenanceCost: 0,
            totalDriverCost: 0,
            totalCost: 0,
            totalDistanceKm: 0,
            costPerKm: 0,
            fuelLiters: 0,
            tripsCount: 0,
            maintenanceOrdersCount: 0,
          },
          error: null,
        });
      }
      if (fnName === 'get_vehicle_expiry_alerts') {
        return Promise.resolve({ data: [], error: null });
      }
      if (fnName === 'resolve_fuel_anomaly') {
        return Promise.resolve({
          data: {
            id: args?.p_alert_id,
            status: 'resolved',
            version: 2,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: { id: 'test-id', version: 1 }, error: null });
    };

    // Invoke every operational command and RPC method
    await gateway.createTrip({
      requestId: 'req-1',
      vehicleId: 'v-1',
      driverId: 'd-1',
      originPlant: '1100',
      destinationLocation: 'LOC-1',
      cargoType: 'Fuel',
      cargoVolumeLiters: 1000,
      scheduledDeparture: new Date().toISOString(),
      scheduledArrival: new Date().toISOString(),
      startOdometer: 10000,
      expectedVersion: 1,
    });

    await gateway.completeTrip({
      requestId: 'req-2',
      tripId: 't-1',
      endOdometer: 10500,
      actualArrival: new Date().toISOString(),
      fuelLitersConsumed: 120,
      expectedVersion: 1,
    });

    await gateway.createFuelLog({
      requestId: 'req-3',
      vehicleId: 'v-1',
      driverId: 'd-1',
      fuelType: 'Diesel',
      odometer: 10500,
      liters: 120,
      costPerLiter: 0.75,
      cost: 90,
      stationName: 'Station 1',
      invoiceNumber: 'INV-1',
      date: new Date().toISOString(),
      expectedVersion: 1,
    });

    await gateway.issuePartsToMaintenanceOrder({
      requestId: 'req-4',
      orderId: 'mo-1',
      items: [{ materialCode: 'MAT-1', plantCode: '1100', storageLocationCode: '1101', quantity: 2 }],
      expectedVersion: 1,
    });

    await gateway.completeMaintenanceOrder({
      requestId: 'req-5',
      orderId: 'mo-1',
      actualLaborHours: 5,
      actualLaborCost: 600,
      downtimeHours: 6,
      completionDate: new Date().toISOString(),
      expectedVersion: 1,
    });

    await gateway.postJournal({
      requestId: 'req-6',
      sourceType: 'FLEET_FUEL',
      sourceId: 'src-1',
      companyCode: '1000',
      fiscalYear: '2026',
      period: 1,
      postingDate: '2026-01-01',
      documentDate: '2026-01-01',
      documentType: 'SA',
      headerText: 'Fuel Log',
      lines: [],
      expectedVersion: 1,
    });

    await gateway.recordTripEvent({
      requestId: 'req-7',
      tripId: 't-1',
      vehicleId: 'v-1',
      eventType: 'departed',
      occurredAt: new Date().toISOString(),
    });

    await gateway.recordOdometerReading({
      requestId: 'req-8',
      vehicleId: 'v-1',
      readingKm: 10500,
      capturedAt: new Date().toISOString(),
      source: 'test',
    });

    await gateway.recordInspection({
      requestId: 'req-9',
      vehicleId: 'v-1',
      inspectedAt: new Date().toISOString(),
      result: 'pass',
      notes: 'ok',
    });

    if (gateway.createVehicle) {
      await gateway.createVehicle({
        code: 'V-100',
        plateNumber: 'XYZ 999',
        type: 'Tanker',
        plantCode: '1100',
        costCenter: 'CC-100',
      });
    }

    if (gateway.updateVehicle) {
      await gateway.updateVehicle('v-1', { makeModel: 'New Model' }, 1, 'req-10');
    }

    if (gateway.setVehicleActive) {
      await gateway.setVehicleActive('v-1', true, 1, 'req-11');
    }

    if (gateway.createDriver) {
      await gateway.createDriver({
        code: 'DRV-1',
        name: 'Driver 1',
        nationalId: '01012345678',
        plantCode: '1100',
      });
    }

    if (gateway.updateDriver) {
      await gateway.updateDriver('d-1', { name: 'Driver Updated' }, 1, 'req-12');
    }

    if (gateway.setDriverActive) {
      await gateway.setDriverActive('d-1', true, 1, 'req-13');
    }

    if (gateway.resolveFuelAnomalyAlert) {
      await gateway.resolveFuelAnomalyAlert('alert-1', 'Approved notes', 1, 'req-14');
    }

    await gateway.getVehicleExpiryAlerts();
    await gateway.getVehicleCostReport('v-1');
    await gateway.getFleetDashboardKPIs();

    expect(capturedCalls.length).toBeGreaterThanOrEqual(18);

    // Verify each call against SQL signature
    for (const call of capturedCalls) {
      const sqlDef = sqlFunctions.get(call.name);
      expect(sqlDef, `RPC function "${call.name}" called by client must exist in SQL migrations`).toBeDefined();

      const validSqlParams = new Set(sqlDef!.parameters.map((p) => p.name));

      if (call.args) {
        for (const sentArg of Object.keys(call.args)) {
          expect(
            validSqlParams.has(sentArg),
            `Argument "${sentArg}" sent to rpc("${call.name}") does not exist in SQL parameter definition: [${Array.from(validSqlParams).join(', ')}] in migration ${sqlDef!.file}`
          ).toBe(true);
        }
      }
    }

    // Specific assertions required by spec:
    const expiryCall = capturedCalls.find((c) => c.name === 'get_vehicle_expiry_alerts');
    expect(expiryCall).toBeDefined();
    expect(expiryCall?.args).toHaveProperty('p_days');
    expect(expiryCall?.args).not.toHaveProperty('p_days_ahead');

    const resolveAnomalyCall = capturedCalls.find((c) => c.name === 'resolve_fuel_anomaly');
    expect(resolveAnomalyCall).toBeDefined();
    expect(resolveAnomalyCall?.args).toEqual({
      p_request_id: 'req-14',
      p_alert_id: 'alert-1',
      p_notes: 'Approved notes',
      p_expected_version: 1,
    });
  });
});
