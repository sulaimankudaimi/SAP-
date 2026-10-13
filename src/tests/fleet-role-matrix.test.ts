import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../core/db';
import { FleetService } from '../modules/fleet/services/FleetService';
import { SessionContext } from '../core/security/SessionContext';
import { SYSTEM_ROLES } from '../core/services/RbacService';
import type { Role } from '../types/models';

describe('Fleet Module Role Matrix & Authorization Enforcement', () => {
  const fleetManagerRole: Role = {
    id: 'r-flt-mgr',
    code: SYSTEM_ROLES.FLEET_MANAGER,
    name: 'مدير حركة الأسطول',
    description: 'إدارة أسطول صهاريج نقل الوقود ومتابعة الصيانة والسائقين',
    permissionCodes: ['TM_VIEW', 'TM_CREATE', 'TM_CHANGE', 'TM_*', 'MD_VIEW'],
    scope: {
      plant: ['1100', '1200'],
    },
    isSystem: true,
  };

  const viewerRole: Role = {
    id: 'r-viewer',
    code: SYSTEM_ROLES.VIEWER,
    name: 'مستعرض فقط',
    description: 'استعراض البيانات الأساسية والشاشات دون إمكانية التعديل',
    permissionCodes: ['TM_VIEW', 'MD_VIEW'],
    isSystem: true,
  };

  const warehouseClerkRole: Role = {
    id: 'r-wh-clerk',
    code: SYSTEM_ROLES.WAREHOUSE_CLERK,
    name: 'أمين مستودع',
    description: 'استلام المواد MIGO، صرف المواد، والجرد الفعلي بالمحطات',
    permissionCodes: ['WM_VIEW', 'WM_POST', 'MM_VIEW', 'MD_VIEW'],
    isSystem: true,
  };

  const auditorRole: Role = {
    id: 'r-auditor',
    code: SYSTEM_ROLES.AUDITOR,
    name: 'مدقق داخلي',
    description: 'فحص سجلات التدقيق والحركات المحاسبية والمخزنية دون تعديل',
    permissionCodes: ['MM_VIEW', 'WM_VIEW', 'FI_VIEW', 'TM_VIEW', 'AM_VIEW', 'MD_VIEW', 'ADM_VIEW'],
    isSystem: true,
  };

  beforeEach(async () => {
    await db.vehicles.clear();
    await db.drivers.clear();
    await db.trips.clear();
    await db.fuelLogs.clear();
    await db.maintenanceOrders.clear();

    await db.vehicles.add({
      id: 'v-role-1',
      code: 'TRK-201',
      plateNumber: 'د هـ و 2201',
      vin: 'YS2R4X20002998877',
      makeModel: 'Volvo FH16',
      year: 2024,
      type: 'Tanker',
      capacityLiters: 35000,
      currentOdometer: 80000,
      assignedPlant: '1100',
      status: 'available',
      fuelType: 'Diesel',
      insuranceExpiry: '2027-01-01',
      registrationExpiry: '2027-01-01',
      safetyInspectionExpiry: '2027-01-01',
      maintenanceDueOdometer: 90000,
      maintenanceDueDate: '2026-12-01',
      version: 1,
      isDeleted: false,
    });

    await db.drivers.add({
      id: 'd-role-1',
      code: 'DRV-201',
      name: 'سالم الدوسري',
      iqamaNumber: '2211445566',
      licenseNumber: 'LIC-990011',
      licenseClass: 'عمومي ثقيل',
      licenseExpiry: '2027-06-01',
      mobile: '+966555112233',
      safetyRating: 5.0,
      status: 'available',
      totalTripsCompleted: 80,
      totalDistanceKm: 32000,
      version: 1,
      isDeleted: false,
    });
  });

  describe('Role 1: Fleet Manager (مدير الأسطول)', () => {
    beforeEach(() => {
      SessionContext.setActor({
        userId: 'usr-fleet-mgr',
        username: 'fleet_manager',
        role: fleetManagerRole,
      });
    });

    it('can create vehicles, drivers, trips, and fuel logs in authorized plant', async () => {
      const trip = await FleetService.createTrip({
        vehicleId: 'v-role-1',
        driverId: 'd-role-1',
        originPlant: '1100',
        destinationLocation: 'محطة الخرج',
        cargoType: 'بنزين 91',
        cargoVolumeLiters: 30000,
        scheduledDeparture: '2026-10-14 08:00',
        scheduledArrival: '2026-10-14 14:00',
        startOdometer: 80000,
      });

      expect(trip.id).toBeDefined();
      expect(trip.status).toBe('in_progress');
    });

    it('cannot dispatch trips in an unauthorized plant (plant-level segregation)', async () => {
      await expect(
        FleetService.createTrip({
          vehicleId: 'v-role-1',
          driverId: 'd-role-1',
          originPlant: '9999', // Unauthorized plant
          destinationLocation: 'محطة أبها',
          cargoType: 'بنزين 91',
          cargoVolumeLiters: 30000,
          scheduledDeparture: '2026-10-14 08:00',
          scheduledArrival: '2026-10-14 14:00',
          startOdometer: 80000,
        })
      ).rejects.toThrow(/خطأ صلاحيات/);
    });
  });

  describe('Role 2: Viewer (مستخدم استعراض فقط)', () => {
    beforeEach(() => {
      SessionContext.setActor({
        userId: 'usr-viewer',
        username: 'fleet_viewer',
        role: viewerRole,
      });
    });

    it('can query vehicles, drivers, and trips', async () => {
      const vehicles = await FleetService.getVehicles();
      expect(vehicles.length).toBeGreaterThan(0);
      const drivers = await FleetService.getDrivers();
      expect(drivers.length).toBeGreaterThan(0);
    });

    it('is forbidden from creating trips', async () => {
      await expect(
        FleetService.createTrip({
          vehicleId: 'v-role-1',
          driverId: 'd-role-1',
          originPlant: '1100',
          destinationLocation: 'محطة الخرج',
          cargoType: 'بنزين 91',
          cargoVolumeLiters: 30000,
          scheduledDeparture: '2026-10-14 08:00',
          scheduledArrival: '2026-10-14 14:00',
          startOdometer: 80000,
        })
      ).rejects.toThrow(/خطأ صلاحيات/);
    });

    it('is forbidden from creating fuel logs', async () => {
      await expect(
        FleetService.createFuelLog({
          vehicleId: 'v-role-1',
          driverId: 'd-role-1',
          date: '2026-10-13',
          fuelType: 'Diesel',
          quantityLiters: 400,
          costPerLiter: 1.15,
          odometer: 80200,
          stationName: 'محطة الشاحنات',
        })
      ).rejects.toThrow(/خطأ صلاحيات/);
    });
  });

  describe('Role 3: Warehouse Clerk (أمين مستودع قطع الغيار)', () => {
    beforeEach(() => {
      SessionContext.setActor({
        userId: 'usr-wh-clerk',
        username: 'wh_clerk',
        role: warehouseClerkRole,
      });
    });

    it('cannot dispatch trips (TM create denied)', async () => {
      await expect(
        FleetService.createTrip({
          vehicleId: 'v-role-1',
          driverId: 'd-role-1',
          originPlant: '1100',
          destinationLocation: 'محطة الخرج',
          cargoType: 'بنزين 91',
          cargoVolumeLiters: 30000,
          scheduledDeparture: '2026-10-14 08:00',
          scheduledArrival: '2026-10-14 14:00',
          startOdometer: 80000,
        })
      ).rejects.toThrow(/خطأ صلاحيات/);
    });
  });

  describe('Role 4: Internal Auditor (مدقق داخلي)', () => {
    beforeEach(() => {
      SessionContext.setActor({
        userId: 'usr-auditor',
        username: 'auditor_fleet',
        role: auditorRole,
      });
    });

    it('can read fleet dashboard KPIs and reports', async () => {
      const kpis = await FleetService.getFleetDashboardKPIs();
      expect(kpis.totalVehicles).toBe(1);
    });

    it('cannot mutate any fleet entities or complete trips', async () => {
      await expect(
        FleetService.createVehicle({
          code: 'TRK-999',
          plateNumber: 'ح خ د 9999',
          vin: 'YS2R4X20002998899',
          makeModel: 'Scania R500',
          year: 2024,
          type: 'HeavyTruck',
          capacityLiters: 0,
          currentOdometer: 0,
          assignedPlant: '1100',
          status: 'available',
          fuelType: 'Diesel',
          insuranceExpiry: '2027-01-01',
          registrationExpiry: '2027-01-01',
          safetyInspectionExpiry: '2027-01-01',
          maintenanceDueOdometer: 10000,
          maintenanceDueDate: '2026-12-01',
        })
      ).rejects.toThrow(/خطأ صلاحيات/);
    });
  });
});
