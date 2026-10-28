import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../core/db';
import { FleetService } from '../modules/fleet/services/FleetService';
import { SessionContext } from '../core/security/SessionContext';
import { SYSTEM_ROLES } from '../core/services/RbacService';
import type { Role } from '../types/models';

describe('Fleet Hardening & Business Invariants Test Suite', () => {
  const fleetManagerRole: Role = {
    id: 'r-flt-mgr',
    code: SYSTEM_ROLES.FLEET_MANAGER,
    name: 'مدير حركة الأسطول',
    description: 'إدارة أسطول صهاريج نقل الوقود ومتابعة الصيانة والسائقين',
    permissionCodes: ['TM_VIEW', 'TM_CREATE', 'TM_CHANGE', 'TM_*', 'MD_VIEW', 'FI_POST', 'FI_VIEW'],
    isSystem: true,
  };

  beforeEach(async () => {
    // Reset database state for clean test run
    await db.vehicles.clear();
    await db.drivers.clear();
    await db.trips.clear();
    await db.fuelLogs.clear();
    await db.maintenanceOrders.clear();
    await db.numberRanges.clear();
    await db.auditLogs.clear();

    // Setup active fleet manager actor with TM permissions
    SessionContext.setActor({
      userId: 'usr-fleet-mgr',
      username: 'fleet_mgr',
      role: fleetManagerRole,
    });

    // Seed test vehicle
    await db.vehicles.add({
      id: 'v-test-1',
      code: 'TRK-101',
      plateNumber: 'أ ب ج 1101',
      vin: 'WDB9634031L123456',
      makeModel: 'Mercedes-Benz Actros 3340',
      year: 2023,
      type: 'Tanker',
      capacityLiters: 32000,
      currentOdometer: 150000,
      assignedPlant: '1100',
      status: 'available',
      fuelType: 'Diesel',
      insuranceExpiry: '2026-12-31',
      registrationExpiry: '2026-12-31',
      safetyInspectionExpiry: '2026-12-31',
      maintenanceDueOdometer: 160000,
      maintenanceDueDate: '2026-11-01',
      version: 1,
      isDeleted: false,
    });

    // Seed test driver with valid license
    await db.drivers.add({
      id: 'd-test-1',
      code: 'DRV-101',
      name: 'طارق الحلبي',
      nationalId: '01010998877',
      licenseNumber: 'LIC-778899',
      licenseClass: 'نقل مواد خطرة (HazMat)',
      licenseExpiry: '2027-01-01',
      mobile: '+963931112233',
      safetyRating: 4.9,
      status: 'available',
      totalTripsCompleted: 120,
      totalDistanceKm: 45000,
      version: 1,
      isDeleted: false,
    });
  });

  describe('Invariant 1: Monotonic Odometer & Vehicle Status', () => {
    it('rejects dispatching a trip with start odometer lower than vehicle current odometer', async () => {
      await expect(
        FleetService.createTrip({
          vehicleId: 'v-test-1',
          driverId: 'd-test-1',
          originPlant: '1100',
          destinationLocation: 'مستودع دمشق',
          cargoType: 'بنزين 95 سوبر',
          cargoVolumeLiters: 30000,
          scheduledDeparture: '2026-10-15 08:00',
          scheduledArrival: '2026-10-15 14:00',
          startOdometer: 149900, // Less than current 150,000 km
        })
      ).rejects.toThrow(/عداد بداية الرحلة.*لا يمكن أن يكون أقل/);
    });

    it('rejects assigning a vehicle that is not available (e.g. on trip or in maintenance)', async () => {
      await db.vehicles.update('v-test-1', { status: 'maintenance' });

      await expect(
        FleetService.createTrip({
          vehicleId: 'v-test-1',
          driverId: 'd-test-1',
          originPlant: '1100',
          destinationLocation: 'مرفأ اللاذقية',
          cargoType: 'ديزل صناعي',
          cargoVolumeLiters: 30000,
          scheduledDeparture: '2026-10-15 08:00',
          scheduledArrival: '2026-10-15 14:00',
          startOdometer: 150000,
        })
      ).rejects.toThrow(/غير متاحة للرحلة/);
    });
  });

  describe('Invariant 2: Driver Status & License Validity', () => {
    it('blocks trip creation if driver license is expired', async () => {
      await db.drivers.update('d-test-1', { licenseExpiry: '2024-01-01' });

      await expect(
        FleetService.createTrip({
          vehicleId: 'v-test-1',
          driverId: 'd-test-1',
          originPlant: '1100',
          destinationLocation: 'محطة الخرج',
          cargoType: 'بنزين 91',
          cargoVolumeLiters: 30000,
          scheduledDeparture: '2026-10-15 08:00',
          scheduledArrival: '2026-10-15 14:00',
          startOdometer: 150000,
        })
      ).rejects.toThrow(/منتهية الصلاحية/);
    });

    it('blocks trip creation if driver is already on trip', async () => {
      await db.drivers.update('d-test-1', { status: 'on_trip' });

      await expect(
        FleetService.createTrip({
          vehicleId: 'v-test-1',
          driverId: 'd-test-1',
          originPlant: '1100',
          destinationLocation: 'محطة الخرج',
          cargoType: 'بنزين 91',
          cargoVolumeLiters: 30000,
          scheduledDeparture: '2026-10-15 08:00',
          scheduledArrival: '2026-10-15 14:00',
          startOdometer: 150000,
        })
      ).rejects.toThrow(/غير متاح حالياً/);
    });
  });

  describe('Invariant 3: Fuel Capacity & Non-Decreasing Odometer', () => {
    it('rejects fuel entry exceeding vehicle fuel tank capacity', async () => {
      await expect(
        FleetService.createFuelLog({
          vehicleId: 'v-test-1',
          driverId: 'd-test-1',
          date: '2026-10-13',
          fuelType: 'Diesel',
          quantityLiters: 35000,
          costPerLiter: 1.15,
          odometer: 150500,
          stationName: 'محطة بترومين المركزية',
        })
      ).rejects.toThrow(/تتجاوز سعة خزان الوقود/);
    });

    it('rejects fuel entry with odometer lower than current vehicle odometer', async () => {
      await expect(
        FleetService.createFuelLog({
          vehicleId: 'v-test-1',
          driverId: 'd-test-1',
          date: '2026-10-13',
          fuelType: 'Diesel',
          quantityLiters: 500,
          costPerLiter: 1.15,
          odometer: 149000, // lower than 150,000
          stationName: 'محطة بترومين المركزية',
        })
      ).rejects.toThrow(/لا يمكن أن تكون أقل من قراءة المركبة الحالية/);
    });
  });

  describe('Invariant 4: Trip Completion Lifecycle & Single Closure', () => {
    it('prevents completing the same trip twice', async () => {
      const trip = await FleetService.createTrip({
        vehicleId: 'v-test-1',
        driverId: 'd-test-1',
        originPlant: '1100',
        destinationLocation: 'محطة القصيم',
        cargoType: 'ديزل نقل',
        cargoVolumeLiters: 30000,
        scheduledDeparture: '2026-10-15 08:00',
        scheduledArrival: '2026-10-15 16:00',
        startOdometer: 150000,
      });

      await FleetService.completeTrip(trip.id, {
        endOdometer: 150450,
        fuelLitersConsumed: 180,
        fuelCost: 207,
        driverAllowanceCost: 157.5,
      });

      await expect(
        FleetService.completeTrip(trip.id, {
          endOdometer: 150500,
        })
      ).rejects.toThrow(/تم إغلاق واعتماد هذه الرحلة مسبقاً/);
    });
  });

  describe('Invariant 5: Maintenance Order Closure Requirements', () => {
    it('rejects completing maintenance order with zero parts and zero labor', async () => {
      await db.maintenanceOrders.add({
        id: 'mo-test-1',
        docNumber: 'MO-2026-0001',
        vehicleId: 'v-test-1',
        vehiclePlate: 'أ ب ج 1101',
        orderType: 'Corrective',
        description: 'إصلاح دورة التبريد والمشع',
        status: 'in_progress',
        startDate: '2026-10-12',
        plantCode: '1100',
        partsCost: 0,
        laborCost: 0,
        actualCost: 0,
        partsUsed: [],
        estimatedCost: 1000,
        laborHours: 0,
        downtimeHours: 0,
        version: 1,
        isDeleted: false,
        createdBy: 'usr-fleet-mgr',
        createdAt: '2026-10-12T08:00:00Z',
        updatedBy: 'usr-fleet-mgr',
        updatedAt: '2026-10-12T08:00:00Z',
      });

      await expect(
        FleetService.completeMaintenanceOrder('mo-test-1', {
          laborHours: 0,
          downtimeHours: 4,
          completionDate: '2026-10-13',
        })
      ).rejects.toThrow(/لا يمكن إغلاق أمر الصيانة بدون تسجيل ساعات عمل فنية أو صرف قطع غيار/);
    });
  });
});
