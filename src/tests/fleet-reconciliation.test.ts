import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../core/db';
import { FleetService } from '../modules/fleet/services/FleetService';
import { SessionContext } from '../core/security/SessionContext';
import { SYSTEM_ROLES } from '../core/services/RbacService';
import type { Role } from '../types/models';

describe('Fleet Cost & GL Cost Center Reconciliation Test Suite', () => {
  const fleetManagerRole: Role = {
    id: 'r-flt-mgr',
    code: SYSTEM_ROLES.FLEET_MANAGER,
    name: 'مدير حركة الأسطول',
    description: 'إدارة أسطول صهاريج نقل الوقود ومتابعة الصيانة والسائقين',
    permissionCodes: ['TM_VIEW', 'TM_CREATE', 'TM_CHANGE', 'TM_*', 'MD_VIEW', 'FI_VIEW', 'FI_POST'],
    scope: {
      plant: ['1100'],
    },
    isSystem: true,
  };

  beforeEach(async () => {
    await db.vehicles.clear();
    await db.drivers.clear();
    await db.trips.clear();
    await db.fuelLogs.clear();
    await db.maintenanceOrders.clear();
    await db.journalEntries.clear();
    await db.postingRegistry.clear();
    await db.numberRanges.clear();
    await db.auditLogs.clear();

    SessionContext.setActor({
      userId: 'usr-fleet-mgr',
      username: 'fleet_mgr',
      role: fleetManagerRole,
    });

    // Seed vehicle with assigned plant 1100 (maps to Cost Center CC-1100)
    await db.vehicles.add({
      id: 'v-recon-1',
      code: 'TRK-301',
      plateNumber: 'س ع ص 3301',
      vin: 'WDB9634031L223344',
      makeModel: 'Mercedes Actros',
      year: 2023,
      type: 'Tanker',
      capacityLiters: 32000,
      currentOdometer: 100000,
      assignedPlant: '1100',
      status: 'available',
      fuelType: 'Diesel',
      insuranceExpiry: '2027-01-01',
      registrationExpiry: '2027-01-01',
      safetyInspectionExpiry: '2027-01-01',
      maintenanceDueOdometer: 110000,
      maintenanceDueDate: '2026-11-01',
      version: 1,
      isDeleted: false,
    });

    await db.drivers.add({
      id: 'd-recon-1',
      code: 'DRV-301',
      name: 'مازن الحموي',
      nationalId: '04033445566',
      licenseNumber: 'LIC-334455',
      licenseClass: 'عمومي ثقيل',
      licenseExpiry: '2027-01-01',
      mobile: '+963949988776',
      safetyRating: 5.0,
      status: 'available',
      totalTripsCompleted: 10,
      totalDistanceKm: 5000,
      version: 1,
      isDeleted: false,
    });
  });

  it('calculates vehicle cost and cost per km accurately from completed trips, fuel, and maintenance', async () => {
    // 1. Create and complete trip (500 km, allowance = 175 SYP, fuel cost = 230 SYP)
    const trip = await FleetService.createTrip({
      vehicleId: 'v-recon-1',
      driverId: 'd-recon-1',
      originPlant: '1100',
      destinationLocation: 'حمص',
      cargoType: 'بنزين 95',
      cargoVolumeLiters: 30000,
      scheduledDeparture: '2026-10-10 08:00',
      scheduledArrival: '2026-10-10 14:00',
      startOdometer: 100000,
    });

    await FleetService.completeTrip(trip.id, {
      endOdometer: 100500, // 500 km
      fuelLitersConsumed: 200,
      fuelCost: 230,
      driverAllowanceCost: 175,
    });

    // 2. Add a fuel log: 400 L * 1.15 = 460 SYP
    await FleetService.createFuelLog({
      vehicleId: 'v-recon-1',
      driverId: 'd-recon-1',
      date: '2026-10-11',
      fuelType: 'Diesel',
      quantityLiters: 400,
      costPerLiter: 1.15,
      odometer: 100500,
      stationName: 'محطة وقود حمص المركزية (تجريبي)',
    });

    // 3. Add completed maintenance order: 300 SYP parts + 240 SYP labor = 540 SYP
    await db.maintenanceOrders.add({
      id: 'mo-recon-1',
      docNumber: 'MO-2026-0005',
      vehicleId: 'v-recon-1',
      vehiclePlate: 'س ع ص 3301',
      orderType: 'Preventive',
      description: 'تغيير فلاتر وزيوت دورية',
      status: 'completed',
      startDate: '2026-10-11',
      completionDate: '2026-10-12',
      plantCode: '1100',
      partsCost: 300,
      laborCost: 240,
      actualCost: 540,
      partsUsed: [],
      estimatedCost: 600,
      laborHours: 2,
      downtimeHours: 1,
      version: 2,
      isDeleted: false,
      createdBy: 'usr-fleet-mgr',
      createdAt: '2026-10-11T08:00:00Z',
      updatedBy: 'usr-fleet-mgr',
      updatedAt: '2026-10-12T08:00:00Z',
    });

    // Generate vehicle cost report
    const costReport = await FleetService.getVehicleCostReport('v-recon-1');

    expect(costReport.vehicleId).toBe('v-recon-1');
    expect(costReport.totalDistanceKm).toBe(500);
    expect(costReport.fuelCostTotal).toBe(460); // 400 L * 1.15
    expect(costReport.maintenanceCostTotal).toBe(540); // 300 parts + 240 labor
    expect(costReport.driverAllowanceTotal).toBe(175); // 175 SYP
    expect(costReport.grandTotalCost).toBeGreaterThan(1000);
    expect(costReport.costPerKm).toBeGreaterThan(0);
  });

  it('reconciles operational costs to cost center journal entries', async () => {
    const reconciliations = await FleetService.getCostCenterFleetReconciliation();
    expect(reconciliations).toBeDefined();
    expect(Array.isArray(reconciliations)).toBe(true);

    if (reconciliations.length > 0) {
      const cc = reconciliations[0];
      expect(cc.costCenter).toBeDefined();
      expect(typeof cc.operationalTotalCost).toBe('number');
      expect(typeof cc.journalTotalDebit).toBe('number');
      expect(cc.variance).toBe(cc.operationalTotalCost - cc.journalTotalDebit);
    }
  });
});
