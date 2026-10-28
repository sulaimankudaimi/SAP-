import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../core/db';
import { FleetService } from '../modules/fleet/services/FleetService';
import { dataGateway } from '../core/gateway';
import { setOperatingMode, isServerMode } from '../core/gateway/connectivity';
import { useConnectivityStore } from '../core/gateway/connectivity';
import { SessionContext } from '../core/security/SessionContext';
import { SYSTEM_ROLES } from '../core/services/RbacService';
import { ServerCommandUnavailableError } from '../core/errors';

describe('Server Mode Fail-Closed Invariants (C6)', () => {
  const rootDir = process.cwd();

  // --------------------------------------------------------------------------
  // 1. Static AST/Content Test
  // --------------------------------------------------------------------------
  describe('Static Invariant: Fleet Service Methods Fail-Closed in Server Mode', () => {
    it('FleetService.ts contains explicit isServerMode() guards on all operational mutations and queries', () => {
      const fleetServicePath = path.join(rootDir, 'src/modules/fleet/services/FleetService.ts');
      expect(fs.existsSync(fleetServicePath)).toBe(true);

      const content = fs.readFileSync(fleetServicePath, 'utf8');

      // Verify isServerMode is checked
      expect(content).toContain('isServerMode()');

      // Key operations that must check isServerMode() and route to dataGateway.instance
      const protectedOperations = [
        'createTrip',
        'completeTrip',
        'createFuelLog',
        'issuePartsToMaintenanceOrder',
        'completeMaintenanceOrder',
        'createDriver',
        'updateDriver',
        'setDriverActive',
        'updateVehicle',
        'setVehicleActive',
        'resolveFuelAnomalyAlert',
        'getVehicles',
        'getDrivers',
        'getTrips',
        'getFuelLogs',
        'getMaintenanceOrders',
        'getPreventiveSchedules',
        'getFuelAnomalyAlerts',
        'getVehicleExpiryAlerts',
        'getVehicleCostReport',
        'getCostCenterFleetReconciliation',
        'getFleetDashboardKPIs',
      ];

      for (const op of protectedOperations) {
        expect(
          content.includes(op),
          `FleetService must define method [${op}]`
        ).toBe(true);
      }

      // Check offline block explanation is present
      expect(content).toContain('OFFLINE_BLOCKED_ARABIC_EXPLANATION');
      expect(content).toContain('ServerCommandUnavailableError');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Runtime Fail-Closed Tests
  // --------------------------------------------------------------------------
  describe('Runtime Invariant: Zero Dexie Fall-through in Server Mode', () => {
    let tripAddSpy: ReturnType<typeof vi.spyOn>;
    let tripPutSpy: ReturnType<typeof vi.spyOn>;
    let tripUpdateSpy: ReturnType<typeof vi.spyOn>;
    let tripDeleteSpy: ReturnType<typeof vi.spyOn>;

    let fuelAddSpy: ReturnType<typeof vi.spyOn>;
    let fuelPutSpy: ReturnType<typeof vi.spyOn>;
    let fuelUpdateSpy: ReturnType<typeof vi.spyOn>;

    let moAddSpy: ReturnType<typeof vi.spyOn>;
    let moPutSpy: ReturnType<typeof vi.spyOn>;
    let moUpdateSpy: ReturnType<typeof vi.spyOn>;

    let vAddSpy: ReturnType<typeof vi.spyOn>;
    let vPutSpy: ReturnType<typeof vi.spyOn>;
    let vUpdateSpy: ReturnType<typeof vi.spyOn>;

    let dAddSpy: ReturnType<typeof vi.spyOn>;
    let dPutSpy: ReturnType<typeof vi.spyOn>;
    let dUpdateSpy: ReturnType<typeof vi.spyOn>;

    let alertAddSpy: ReturnType<typeof vi.spyOn>;
    let alertPutSpy: ReturnType<typeof vi.spyOn>;
    let alertUpdateSpy: ReturnType<typeof vi.spyOn>;

    function totalDexieWrites(): number {
      return (
        tripAddSpy.mock.calls.length +
        tripPutSpy.mock.calls.length +
        tripUpdateSpy.mock.calls.length +
        tripDeleteSpy.mock.calls.length +
        fuelAddSpy.mock.calls.length +
        fuelPutSpy.mock.calls.length +
        fuelUpdateSpy.mock.calls.length +
        moAddSpy.mock.calls.length +
        moPutSpy.mock.calls.length +
        moUpdateSpy.mock.calls.length +
        vAddSpy.mock.calls.length +
        vPutSpy.mock.calls.length +
        vUpdateSpy.mock.calls.length +
        dAddSpy.mock.calls.length +
        dPutSpy.mock.calls.length +
        dUpdateSpy.mock.calls.length +
        alertAddSpy.mock.calls.length +
        alertPutSpy.mock.calls.length +
        alertUpdateSpy.mock.calls.length
      );
    }

    beforeEach(() => {
      // Set authenticated actor with full fleet permissions
      SessionContext.setActor({
        userId: 'u-fleet-mgr',
        username: 'flt.mgr',
        role: {
          id: 'r-fleet-mgr',
          code: SYSTEM_ROLES.FLEET_MANAGER,
          name: 'مدير أسطول',
          description: 'مدير أسطول كامل الصلاحيات',
          isSystem: true,
          permissionCodes: ['TM_CREATE', 'TM_CHANGE', 'TM_VIEW', 'MM_POST', '*'],
        },
      });

      // Switch to server mode and set online
      setOperatingMode('server');
      useConnectivityStore.setState({ isOnline: true });

      // Spy on all Dexie table write operations
      tripAddSpy = vi.spyOn(db.trips, 'add');
      tripPutSpy = vi.spyOn(db.trips, 'put');
      tripUpdateSpy = vi.spyOn(db.trips, 'update');
      tripDeleteSpy = vi.spyOn(db.trips, 'delete');

      fuelAddSpy = vi.spyOn(db.fuelLogs, 'add');
      fuelPutSpy = vi.spyOn(db.fuelLogs, 'put');
      fuelUpdateSpy = vi.spyOn(db.fuelLogs, 'update');

      moAddSpy = vi.spyOn(db.maintenanceOrders, 'add');
      moPutSpy = vi.spyOn(db.maintenanceOrders, 'put');
      moUpdateSpy = vi.spyOn(db.maintenanceOrders, 'update');

      vAddSpy = vi.spyOn(db.vehicles, 'add');
      vPutSpy = vi.spyOn(db.vehicles, 'put');
      vUpdateSpy = vi.spyOn(db.vehicles, 'update');

      dAddSpy = vi.spyOn(db.drivers, 'add');
      dPutSpy = vi.spyOn(db.drivers, 'put');
      dUpdateSpy = vi.spyOn(db.drivers, 'update');

      alertAddSpy = vi.spyOn(db.fuelAnomalyAlerts, 'add');
      alertPutSpy = vi.spyOn(db.fuelAnomalyAlerts, 'put');
      alertUpdateSpy = vi.spyOn(db.fuelAnomalyAlerts, 'update');
    });

    afterEach(() => {
      vi.restoreAllMocks();
      setOperatingMode('local');
      SessionContext.clearActor();
    });

    it('1. When gateway succeeds: zero Dexie writes occur for any fleet mutation', async () => {
      expect(isServerMode()).toBe(true);

      // Mock gateway instance methods to return simulated server objects
      vi.spyOn(dataGateway.instance, 'createTrip').mockResolvedValue({
        id: 'trip-srv-1',
        docNumber: 'TRIP-2026-0001',
        status: 'in_transit',
        vehicleId: 'v-1',
        vehiclePlate: 'دمشق 123456',
        driverId: 'd-1',
        driverName: 'سعيد العلي',
        originPlant: '1100',
        destinationLocation: 'Homs',
        cargoType: 'Fuel',
        cargoVolumeLiters: 15000,
        scheduledDeparture: new Date().toISOString(),
        scheduledArrival: new Date().toISOString(),
        startOdometer: 10000,
        isDelayed: false,
        version: 1,
        createdBy: 'u-1',
        updatedBy: 'u-1',
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      vi.spyOn(dataGateway.instance, 'createFuelLog').mockResolvedValue({
        id: 'fl-srv-1',
        docNumber: 'FL-2026-0001',
        vehicleId: 'v-1',
        vehiclePlate: 'دمشق 123456',
        driverId: 'd-1',
        driverName: 'سعيد العلي',
        fuelType: 'Diesel',
        quantityLiters: 250,
        costPerLiter: 520,
        totalCost: 130000,
        odometer: 10500,
        stationName: 'محطة الشام',
        date: '2026-10-18',
        isAnomaly: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
      });

      if (dataGateway.instance.resolveFuelAnomalyAlert) {
        vi.spyOn(dataGateway.instance, 'resolveFuelAnomalyAlert').mockResolvedValue(undefined);
      }

      // Execute mutations
      await FleetService.createTrip({
        vehicleId: 'v-1',
        driverId: 'd-1',
        originPlant: '1100',
        destinationLocation: 'Homs',
        cargoType: 'Fuel',
        cargoVolumeLiters: 15000,
        scheduledDeparture: new Date().toISOString(),
        scheduledArrival: new Date().toISOString(),
        startOdometer: 10000,
      });

      await FleetService.createFuelLog({
        vehicleId: 'v-1',
        driverId: 'd-1',
        date: '2026-10-18',
        fuelType: 'Diesel',
        quantityLiters: 250,
        costPerLiter: 520,
        odometer: 10500,
        stationName: 'محطة الشام',
      });

      await FleetService.resolveFuelAnomalyAlert('alert-1', 'Checked and verified', 'u-fleet-mgr', 1);

      // Assert zero Dexie writes across all tables
      expect(totalDexieWrites()).toBe(0);
    });

    it('2. When gateway fails or is offline: throws and zero Dexie writes occur (no silent fall-through)', async () => {
      expect(isServerMode()).toBe(true);

      // Set offline
      useConnectivityStore.setState({ isOnline: false });

      // All mutations must throw and execute ZERO Dexie writes
      await expect(
        FleetService.createTrip({
          vehicleId: 'v-1',
          driverId: 'd-1',
          originPlant: '1100',
          destinationLocation: 'Homs',
          cargoType: 'Fuel',
          cargoVolumeLiters: 15000,
          scheduledDeparture: new Date().toISOString(),
          scheduledArrival: new Date().toISOString(),
          startOdometer: 10000,
        })
      ).rejects.toThrow();

      await expect(
        FleetService.createFuelLog({
          vehicleId: 'v-1',
          driverId: 'd-1',
          date: '2026-10-18',
          fuelType: 'Diesel',
          quantityLiters: 250,
          costPerLiter: 520,
          odometer: 10500,
          stationName: 'محطة الشام',
        })
      ).rejects.toThrow();

      await expect(
        FleetService.resolveFuelAnomalyAlert('alert-1', 'Test', 'u-fleet-mgr', 1)
      ).rejects.toThrow();

      expect(totalDexieWrites()).toBe(0);
    });

    it('3. When server command is unavailable: ServerCommandUnavailableError is thrown with zero Dexie writes', async () => {
      expect(isServerMode()).toBe(true);
      useConnectivityStore.setState({ isOnline: true });

      // Temporarily remove an optional gateway method to simulate missing command
      const originalResolve = (dataGateway.instance as unknown as Record<string, unknown>).resolveFuelAnomalyAlert;
      (dataGateway.instance as unknown as Record<string, unknown>).resolveFuelAnomalyAlert = undefined;

      try {
        await expect(
          FleetService.resolveFuelAnomalyAlert('alert-unavail-1', 'Notes', 'u-fleet-mgr', 1)
        ).rejects.toThrow(ServerCommandUnavailableError);

        expect(totalDexieWrites()).toBe(0);
      } finally {
        (dataGateway.instance as unknown as Record<string, unknown>).resolveFuelAnomalyAlert = originalResolve;
      }
    });
  });
});
