import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../core/db';
import { FleetService } from '../modules/fleet/services/FleetService';
import { SessionContext } from '../core/security/SessionContext';
import { SYSTEM_ROLES } from '../core/services/RbacService';
import { ServerCommandUnavailableError } from '../core/errors';
import { useConnectivityStore } from '../core/gateway/connectivity';
import type { IDataGateway } from '../core/gateway/IDataGateway';

describe('Fail-Closed Multi-User Gateway Security & Invariant Tests', () => {
  // ---------------------------------------------------------------------------
  // (a) Static Guard: Verify every isServerMode() block ends in return or throw
  // ---------------------------------------------------------------------------
  describe('(a) Static Guard: Server Mode Non-Fallthrough Analysis', () => {
    it('verifies that every isServerMode() block in FleetService and other services terminates with return or throw', () => {
      const fleetServicePath = path.resolve(__dirname, '../modules/fleet/services/FleetService.ts');
      const content = fs.readFileSync(fleetServicePath, 'utf-8');

      // Find all "if (isServerMode())" occurrences and analyze their block contents
      const regex = /if\s*\(\s*isServerMode\(\)\s*\)\s*\{/g;
      let match: RegExpExecArray | null;
      let blockCount = 0;

      while ((match = regex.exec(content)) !== null) {
        blockCount++;
        const startIndex = match.index + match[0].length;

        // Extract balanced { ... } block
        let depth = 1;
        let endIndex = startIndex;
        for (let i = startIndex; i < content.length; i++) {
          if (content[i] === '{') depth++;
          else if (content[i] === '}') {
            depth--;
            if (depth === 0) {
              endIndex = i;
              break;
            }
          }
        }

        const blockBody = content.substring(startIndex, endIndex).trim();

        // Check if the block body terminates all paths (ends with return or throw at outermost level,
        // or every branch returns/throws)
        const hasReturn = /\breturn\b/.test(blockBody);
        const hasThrow = /\bthrow\b/.test(blockBody);

        expect(
          hasReturn || hasThrow,
          `Block #${blockCount} starting at char ${match.index} in FleetService.ts must contain return or throw`
        ).toBe(true);

        // Additionally verify the end of the block body is a return or throw statement
        const statements = blockBody
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean);
        const lastStatement = statements[statements.length - 1];
        const isTerminating =
          lastStatement.startsWith('return') ||
          lastStatement.startsWith('throw') ||
          lastStatement.includes('throw new') ||
          /(\breturn\b|\bthrow\b)/.test(lastStatement);

        expect(
          isTerminating,
          `Block #${blockCount} in FleetService.ts must end with a return or throw statement, but ended with: "${lastStatement}"`
        ).toBe(true);
      }

      expect(blockCount).toBeGreaterThanOrEqual(20);
    });
  });

  // ---------------------------------------------------------------------------
  // (b) Runtime Guard: Server mode ON, stub gateway lacking methods -> zero writes
  // ---------------------------------------------------------------------------
  describe('(b) Runtime Guard: Stub Gateway Server Rejections & Zero Local Mutations', () => {
    beforeEach(async () => {
      // Clear operational tables
      await db.vehicles.clear();
      await db.drivers.clear();
      await db.trips.clear();
      await db.fuelLogs.clear();
      await db.maintenanceOrders.clear();
      await db.stockBalances.clear();
      await db.stockLedger.clear();
      await db.materialDocuments.clear();
      await db.journalEntries.clear();
      await db.postingRegistry.clear();

      // Setup actor with full permissions
      SessionContext.setActor({
        userId: 'u-audit-admin',
        username: 'admin',
        role: {
          id: 'r-admin',
          code: SYSTEM_ROLES.ADMIN,
          name: 'مدير النظام',
          description: 'Full admin',
          permissionCodes: ['*'],
          isSystem: true,
        },
      });

      // Save original gateway and set online status
      useConnectivityStore.getState().setOnline(true);
      vi.stubEnv('VITE_SERVER_MODE', 'true');

      // Install stub gateway lacking all write methods
      const stubGateway: IDataGateway = {
        mode: 'server',
        createTrip: undefined as unknown as IDataGateway['createTrip'],
        completeTrip: undefined as unknown as IDataGateway['completeTrip'],
        createFuelLog: undefined as unknown as IDataGateway['createFuelLog'],
        issuePartsToMaintenanceOrder: undefined as unknown as IDataGateway['issuePartsToMaintenanceOrder'],
        completeMaintenanceOrder: undefined as unknown as IDataGateway['completeMaintenanceOrder'],
        postJournal: undefined as unknown as IDataGateway['postJournal'],
        recordTripEvent: undefined as unknown as IDataGateway['recordTripEvent'],
        recordOdometerReading: undefined as unknown as IDataGateway['recordOdometerReading'],
        recordInspection: undefined as unknown as IDataGateway['recordInspection'],
        getVehicles: async () => [],
        getVehicleById: async () => null,
        getDrivers: async () => [],
        getDriverById: async () => null,
        getTrips: async () => [],
        getTripById: async () => null,
        getFuelLogs: async () => [],
        getMaintenanceOrders: async () => [],
        getMaintenanceOrderById: async () => null,
        getPreventiveSchedules: async () => [],
        getFuelAnomalyAlerts: async () => [],
        getVehicleExpiryAlerts: async () => [],
        getVehicleCostReport: async () => ({} as never),
        getFleetDashboardKPIs: async () => ({} as never),
        subscribeFleet: () => () => {},
      };

      const { _setGatewayInstanceForTesting } = await import('../core/gateway/ServerGateway');
      _setGatewayInstanceForTesting(stubGateway);
    });

    afterEach(async () => {
      // Restore original gateway and env
      const { _setGatewayInstanceForTesting } = await import('../core/gateway/ServerGateway');
      _setGatewayInstanceForTesting(null);
      vi.unstubAllEnvs();
    });

    it('rejects all public Fleet write methods with ServerCommandUnavailableError and writes 0 rows to all 10 tables', async () => {
      // 1. createVehicle
      await expect(
        FleetService.createVehicle({
          code: 'V-TEST-99',
          plateNumber: 'ABC 9999',
          type: 'Tanker',
          makeModel: 'Mercedes Actros',
          plantCode: '1100',
          costCenter: 'CC-1100',
          capacityLiters: 35000,
          currentOdometer: 100000,
          fuelType: 'Diesel',
          status: 'available',
          version: 1,
          vin: 'VIN1234567890',
          year: 2024,
          insuranceExpiry: '2026-12-31',
          registrationExpiry: '2026-12-31',
        })
      ).rejects.toThrow(ServerCommandUnavailableError);

      // 2. updateVehicle
      await expect(
        FleetService.updateVehicle('v-1', { makeModel: 'Updated' }, undefined, 1)
      ).rejects.toThrow(ServerCommandUnavailableError);

      // 3. setVehicleActive
      await expect(
        FleetService.setVehicleActive('v-1', false, undefined, 1)
      ).rejects.toThrow(ServerCommandUnavailableError);

      // 4. createDriver
      await expect(
        FleetService.createDriver({
          code: 'DRV-99',
          name: 'Tariq',
          nationalId: '01098765432',
          licenseNumber: 'LIC-99',
          licenseClass: 'عمومي ثقيل',
          licenseExpiry: '2028-01-01',
          mobile: '+963930000000',
          plantCode: '1100',
          status: 'available',
          totalTripsCompleted: 0,
          totalDistanceKm: 0,
          safetyRating: 5,
          version: 1,
        })
      ).rejects.toThrow(ServerCommandUnavailableError);

      // 5. updateDriver
      await expect(
        FleetService.updateDriver('d-1', { name: 'Ahmed Updated' }, undefined, 1)
      ).rejects.toThrow(ServerCommandUnavailableError);

      // 6. setDriverActive
      await expect(
        FleetService.setDriverActive('d-1', false, undefined, 1)
      ).rejects.toThrow(ServerCommandUnavailableError);

      // 7. createTrip
      await expect(
        FleetService.createTrip({
          vehicleId: 'v-1',
          driverId: 'd-1',
          originPlant: '1100',
          destinationLocation: 'LOC-1',
          cargoType: 'Fuel',
          cargoVolumeLiters: 30000,
          scheduledDeparture: new Date().toISOString(),
          scheduledArrival: new Date().toISOString(),
          startOdometer: 100000,
        })
      ).rejects.toThrow(ServerCommandUnavailableError);

      // 8. completeTrip
      await expect(
        FleetService.completeTrip('t-1', {
          endOdometer: 100500,
          fuelLitersConsumed: 150,
          actualArrival: new Date().toISOString(),
        })
      ).rejects.toThrow(ServerCommandUnavailableError);

      // 9. createFuelLog
      await expect(
        FleetService.createFuelLog({
          vehicleId: 'v-1',
          driverId: 'd-1',
          fuelType: 'Diesel',
          odometer: 100500,
          quantityLiters: 150,
          costPerLiter: 0.75,
          stationName: 'Station 1',
          date: new Date().toISOString(),
        })
      ).rejects.toThrow(ServerCommandUnavailableError);

      // 10. createMaintenanceOrder
      await expect(
        FleetService.createMaintenanceOrder({
          vehicleId: 'v-1',
          orderType: 'Corrective',
          estimatedCost: 1000,
          description: 'Brake overhaul',
          startDate: '2026-03-01',
        })
      ).rejects.toThrow(ServerCommandUnavailableError);

      // 11. issuePartsToMaintenanceOrder
      await expect(
        FleetService.issuePartsToMaintenanceOrder(
          'mo-1',
          [{ lineItem: 1, materialCode: 'MAT-1', materialName: 'Brake Pad', unit: 'EA', quantity: 2, unitPrice: 200, totalCost: 400, storageLocation: '1101' }],
          '1100'
        )
      ).rejects.toThrow(ServerCommandUnavailableError);

      // 12. completeMaintenanceOrder
      await expect(
        FleetService.completeMaintenanceOrder('mo-1', {
          laborHours: 4,
          laborRatePerHour: 100,
          downtimeHours: 5,
          completionDate: new Date().toISOString(),
        })
      ).rejects.toThrow(ServerCommandUnavailableError);

      // 13. resolveFuelAnomalyAlert
      await expect(
        FleetService.resolveFuelAnomalyAlert('alert-1', 'Approved', undefined, 1)
      ).rejects.toThrow(ServerCommandUnavailableError);

      // Assert that EXACTLY ZERO rows were written to all 10 tables!
      const counts = {
        vehicles: await db.vehicles.count(),
        drivers: await db.drivers.count(),
        trips: await db.trips.count(),
        fuelLogs: await db.fuelLogs.count(),
        maintenanceOrders: await db.maintenanceOrders.count(),
        stockBalances: await db.stockBalances.count(),
        stockLedger: await db.stockLedger.count(),
        materialDocuments: await db.materialDocuments.count(),
        journalEntries: await db.journalEntries.count(),
        postingRegistry: await db.postingRegistry.count(),
      };

      expect(counts.vehicles).toBe(0);
      expect(counts.drivers).toBe(0);
      expect(counts.trips).toBe(0);
      expect(counts.fuelLogs).toBe(0);
      expect(counts.maintenanceOrders).toBe(0);
      expect(counts.stockBalances).toBe(0);
      expect(counts.stockLedger).toBe(0);
      expect(counts.materialDocuments).toBe(0);
      expect(counts.journalEntries).toBe(0);
      expect(counts.postingRegistry).toBe(0);
    });
  });
});
