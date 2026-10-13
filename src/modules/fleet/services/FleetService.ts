import { db } from '../../../core/db';
import { NumberRangeService } from '../../../core/services/NumberRangeService';
import { AuditService } from '../../../core/services/AuditService';
import { InventoryService } from '../../inventory/services/InventoryService';
import { AutomaticPostingEngine } from '../../finance/services/AutomaticPostingEngine';
import { requirePermission } from '../../../core/security/SessionContext';
import { isServerMode, useConnectivityStore } from '../../../core/gateway/connectivity';
import { dataGateway } from '../../../core/gateway/ServerGateway';
import { OutboxEngine, OFFLINE_BLOCKED_ARABIC_EXPLANATION } from '../../../core/gateway/OutboxEngine';
import { ConcurrencyError } from '../../../core/errors/ConcurrencyError';
import type {
  Vehicle,
  VehicleType,
  Driver,
  Trip,
  FuelLog,
  FuelAnomalyAlert,
  MaintenanceOrder,
  MaintenancePartItem,
  PreventiveSchedule,
} from '../../../types/models';

export interface VehicleCostReport {
  vehicleId: string;
  vehiclePlate: string;
  vehicleCode: string;
  makeModel: string;
  totalDistanceKm: number;
  fuelCostTotal: number;
  maintenanceCostTotal: number;
  driverAllowanceTotal: number;
  depreciationCostTotal: number;
  grandTotalCost: number;
  costPerKm: number;
}

export interface ExpiryAlert {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleCode: string;
  alertType: 'insurance' | 'registration';
  title: string;
  expiryDate: string;
  daysRemaining: number;
  isExpired: boolean;
}

export interface FleetSummaryKPIs {
  totalVehicles: number;
  onRoadCount: number;
  availableCount: number;
  maintenanceCount: number;
  outOfServiceCount: number;
  fleetUtilizationRate: number; // percentage
  fuelConsumedTodayLiters: number;
  fuelCostTodaySar: number;
  fuelVsYesterdayChangePct: number;
  activeTripsCount: number;
  pendingMaintenanceCount: number;
  criticalAnomaliesCount: number;
}

export class FleetService {
  /**
   * 1. VEHICLE MASTER DATA
   */
  static async getVehicles(filters?: {
    type?: VehicleType | 'ALL';
    status?: string | 'ALL';
    search?: string;
  }): Promise<Vehicle[]> {
    if (isServerMode()) {
      return await dataGateway.instance.getVehicles(filters as import('../../../core/gateway/IDataGateway').VehicleFilters);
    }

    let list = await db.vehicles.filter((v) => !v.isDeleted).toArray();

    if (filters) {
      if (filters.type && filters.type !== 'ALL') {
        list = list.filter((v) => v.type === filters.type);
      }
      if (filters.status && filters.status !== 'ALL') {
        list = list.filter((v) => v.status === filters.status);
      }
      if (filters.search && filters.search.trim()) {
        const q = filters.search.trim().toLowerCase();
        list = list.filter(
          (v) =>
            v.plateNumber.toLowerCase().includes(q) ||
            v.code.toLowerCase().includes(q) ||
            v.makeModel.toLowerCase().includes(q) ||
            (v.vin && v.vin.toLowerCase().includes(q))
        );
      }
    }

    return list.sort((a, b) => a.code.localeCompare(b.code));
  }

  static async getVehicleById(id: string): Promise<Vehicle | null> {
    if (isServerMode()) {
      return await dataGateway.instance.getVehicleById(id);
    }
    const v = await db.vehicles.get(id);
    return v && !v.isDeleted ? v : null;
  }

  static async createVehicle(
    data: Omit<Vehicle, 'id' | 'isDeleted'>,
    userId: string = 'u-flt-mgr'
  ): Promise<Vehicle> {
    requirePermission({ module: 'TM', activity: 'create' });

    if (isServerMode()) {
      if (!useConnectivityStore.getState().isOnline) {
        throw new Error(OFFLINE_BLOCKED_ARABIC_EXPLANATION);
      }
      if (dataGateway.instance.createVehicle) {
        return await dataGateway.instance.createVehicle({ ...data, version: 1 });
      }
    }

    const id = `veh-${Date.now()}`;
    const vehicle: Vehicle = {
      ...data,
      id,
      version: 1,
      isDeleted: false,
    };

    await db.vehicles.add(vehicle);

    await AuditService.log({
      userId,
      action: 'CREATE',
      entity: 'Vehicle',
      entityId: id,
      after: vehicle as unknown as Record<string, unknown>,
    });

    return vehicle;
  }

  static async updateVehicle(
    id: string,
    data: Partial<Vehicle>,
    userId: string = 'u-flt-mgr',
    expectedVersion?: number
  ): Promise<Vehicle> {
    requirePermission({ module: 'TM', activity: 'change' });

    if (isServerMode()) {
      if (!useConnectivityStore.getState().isOnline) {
        throw new Error(OFFLINE_BLOCKED_ARABIC_EXPLANATION);
      }
      if (dataGateway.instance.updateVehicle) {
        return await dataGateway.instance.updateVehicle(id, data, expectedVersion);
      }
    }

    const before = await db.vehicles.get(id);
    if (!before) throw new Error('المركبة غير موجودة');

    if (expectedVersion !== undefined) {
      const storedVer = typeof before.version === 'number' ? before.version : 1;
      if (storedVer !== expectedVersion) {
        throw new ConcurrencyError('تم تعديل هذا السجل بواسطة مستخدم آخر. أعد التحميل ثم حاول مجدداً.');
      }
    }

    const updated: Vehicle = {
      ...before,
      ...data,
      version: (before.version || 1) + 1,
    };

    await db.vehicles.put(updated);

    await AuditService.log({
      userId,
      action: 'UPDATE',
      entity: 'Vehicle',
      entityId: id,
      before: before as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  static async getVehicleExpiryAlerts(): Promise<ExpiryAlert[]> {
    if (isServerMode()) {
      return await dataGateway.instance.getVehicleExpiryAlerts();
    }

    const vehicles = await db.vehicles.filter((v) => !v.isDeleted).toArray();
    const alerts: ExpiryAlert[] = [];
    const now = new Date();

    vehicles.forEach((veh) => {
      // 1. Insurance expiry check
      if (veh.insuranceExpiry) {
        const insDate = new Date(veh.insuranceExpiry);
        const diffMs = insDate.getTime() - now.getTime();
        const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (days <= 30) {
          alerts.push({
            id: `exp-ins-${veh.id}`,
            vehicleId: veh.id,
            vehiclePlate: veh.plateNumber,
            vehicleCode: veh.code,
            alertType: 'insurance',
            title: days < 0 ? 'وثيقة التأمين منتهية الصلاحية!' : 'وثيقة التأمين تشارف على الانتهاء',
            expiryDate: veh.insuranceExpiry,
            daysRemaining: days,
            isExpired: days < 0,
          });
        }
      }

      // 2. Registration (استمارة) expiry check
      if (veh.registrationExpiry) {
        const regDate = new Date(veh.registrationExpiry);
        const diffMs = regDate.getTime() - now.getTime();
        const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (days <= 30) {
          alerts.push({
            id: `exp-reg-${veh.id}`,
            vehicleId: veh.id,
            vehiclePlate: veh.plateNumber,
            vehicleCode: veh.code,
            alertType: 'registration',
            title: days < 0 ? 'استمارة رخصة السير منتهية!' : 'رخصة السير (الاستمارة) قاربت على الانتهاء',
            expiryDate: veh.registrationExpiry,
            daysRemaining: days,
            isExpired: days < 0,
          });
        }
      }
    });

    return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }

  /**
   * 2. DRIVERS MASTER DATA
   */
  static async getDrivers(filters?: {
    status?: string | 'ALL';
    assignedPlant?: string;
    search?: string;
  }): Promise<Driver[]> {
    if (isServerMode()) {
      return await dataGateway.instance.getDrivers(filters as import('../../../core/gateway/IDataGateway').DriverFilters);
    }

    let list = await db.drivers.filter((d) => !d.isDeleted).toArray();

    if (filters?.status && filters.status !== 'ALL') {
      list = list.filter((d) => d.status === filters.status);
    }
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.code.toLowerCase().includes(q) ||
          d.mobile.includes(q) ||
          d.licenseNumber.includes(q)
      );
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  static async getDriverById(id: string): Promise<Driver | null> {
    if (isServerMode()) {
      return await dataGateway.instance.getDriverById(id);
    }
    const d = await db.drivers.get(id);
    return d && !d.isDeleted ? d : null;
  }

  static async createDriver(
    data: Omit<Driver, 'id' | 'isDeleted'>,
    userId: string = 'u-flt-mgr'
  ): Promise<Driver> {
    requirePermission({ module: 'TM', activity: 'create' });

    if (isServerMode()) {
      if (!useConnectivityStore.getState().isOnline) {
        throw new Error(OFFLINE_BLOCKED_ARABIC_EXPLANATION);
      }
      if (dataGateway.instance.createDriver) {
        return await dataGateway.instance.createDriver({ ...data, version: 1 });
      }
    }

    const id = `drv-${Date.now()}`;
    const driver: Driver = {
      ...data,
      id,
      version: 1,
      isDeleted: false,
    };

    await db.drivers.add(driver);

    await AuditService.log({
      userId,
      action: 'CREATE',
      entity: 'Driver',
      entityId: id,
      after: driver as unknown as Record<string, unknown>,
    });

    return driver;
  }

  static async updateDriver(
    id: string,
    data: Partial<Driver>,
    userId: string = 'u-flt-mgr',
    expectedVersion?: number
  ): Promise<Driver> {
    requirePermission({ module: 'TM', activity: 'change' });

    if (isServerMode()) {
      if (!useConnectivityStore.getState().isOnline) {
        throw new Error(OFFLINE_BLOCKED_ARABIC_EXPLANATION);
      }
      if (dataGateway.instance.updateDriver) {
        return await dataGateway.instance.updateDriver(id, data, expectedVersion);
      }
    }

    const before = await db.drivers.get(id);
    if (!before) throw new Error('السائق غير موجود');

    if (expectedVersion !== undefined) {
      const storedVer = typeof before.version === 'number' ? before.version : 1;
      if (storedVer !== expectedVersion) {
        throw new ConcurrencyError('تم تعديل هذا السجل بواسطة مستخدم آخر. أعد التحميل ثم حاول مجدداً.');
      }
    }

    const updated: Driver = {
      ...before,
      ...data,
      version: (before.version || 1) + 1,
    };

    await db.drivers.put(updated);

    await AuditService.log({
      userId,
      action: 'UPDATE',
      entity: 'Driver',
      entityId: id,
      before: before as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  /**
   * 3. TRIPS & DISPATCH LIFECYCLE
   */
  static async getTrips(filters?: {
    status?: string | 'ALL';
    vehicleId?: string;
    driverId?: string;
    originPlant?: string;
  }): Promise<Trip[]> {
    if (isServerMode()) {
      return await dataGateway.instance.getTrips(filters as import('../../../core/gateway/IDataGateway').TripFilters);
    }

    let trips = await db.trips.filter((t) => !t.isDeleted).toArray();

    if (filters?.status && filters.status !== 'ALL') {
      trips = trips.filter((t) => t.status === filters.status);
    }
    if (filters?.vehicleId) {
      trips = trips.filter((t) => t.vehicleId === filters.vehicleId);
    }
    if (filters?.driverId) {
      trips = trips.filter((t) => t.driverId === filters.driverId);
    }
    if (filters?.originPlant) {
      trips = trips.filter((t) => t.originPlant === filters.originPlant);
    }

    return trips.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  static async getTripById(id: string): Promise<Trip | null> {
    if (isServerMode()) {
      return await dataGateway.instance.getTripById(id);
    }
    const trip = await db.trips.get(id);
    return trip && !trip.isDeleted ? trip : null;
  }

  static async createTrip(
    input: {
      vehicleId: string;
      driverId: string;
      originPlant: string;
      destinationLocation: string;
      cargoType: string;
      cargoVolumeLiters: number;
      scheduledDeparture: string;
      scheduledArrival: string;
      startOdometer: number;
    },
    userId: string = 'u-flt-mgr',
    expectedVersion?: number
  ): Promise<Trip> {
    requirePermission({ module: 'TM', activity: 'create' }, { plant: input.originPlant });

    if (isServerMode()) {
      if (!useConnectivityStore.getState().isOnline) {
        throw new Error(OFFLINE_BLOCKED_ARABIC_EXPLANATION);
      }
      return await dataGateway.instance.createTrip({
        ...input,
        userId,
        expectedVersion,
      });
    }

    const vehicle = await db.vehicles.get(input.vehicleId);
    if (!vehicle || vehicle.isDeleted) throw new Error('مركبة الأسطول المحددة غير موجودة أو ملغاة');

    if (vehicle.status !== 'available') {
      throw new Error(`المركبة (${vehicle.plateNumber}) غير متاحة للرحلة (حالتها الحالية: ${vehicle.status})`);
    }

    if (input.startOdometer < vehicle.currentOdometer) {
      throw new Error(
        `عداد بداية الرحلة (${input.startOdometer} كم) لا يمكن أن يكون أقل من قراءة المركبة الحالية (${vehicle.currentOdometer} كم)`
      );
    }

    const driver = await db.drivers.get(input.driverId);
    if (!driver || driver.isDeleted) throw new Error('السائق المحدد غير موجود أو ملغي');

    if (driver.status !== 'available') {
      throw new Error(`السائق (${driver.name}) غير متاح حالياً (حالته: ${driver.status})`);
    }

    if (driver.licenseExpiry && new Date(driver.licenseExpiry) < new Date()) {
      throw new Error(
        `رخصة قيادة السائق (${driver.name}) منتهية الصلاحية بتاريخ (${driver.licenseExpiry}) ولا يمكن تعيينه للرحلة`
      );
    }

    const now = new Date().toISOString();
    let trip!: Trip;

    await db.transaction(
      'rw',
      [db.trips, db.vehicles, db.drivers, db.numberRanges, db.auditLogs],
      async () => {
        const docNumber = await NumberRangeService.getNextNumber('TRIP', '2026');

        trip = {
          id: `trip-${Date.now()}`,
          docNumber,
          status: 'in_progress', // Active dispatched
          vehicleId: input.vehicleId,
          vehiclePlate: vehicle.plateNumber,
          driverId: input.driverId,
          driverName: driver.name,
          originPlant: input.originPlant,
          destinationLocation: input.destinationLocation,
          cargoType: input.cargoType,
          cargoVolumeLiters: input.cargoVolumeLiters,
          scheduledDeparture: input.scheduledDeparture,
          scheduledArrival: input.scheduledArrival,
          actualDeparture: now.slice(0, 16).replace('T', ' '),
          startOdometer: input.startOdometer,
          createdBy: userId,
          createdAt: now,
          updatedBy: userId,
          updatedAt: now,
          version: 1,
          isDeleted: false,
        };

        // Update vehicle and driver status to on_trip
        await db.vehicles.update(vehicle.id, {
          status: 'on_trip',
          assignedDriverId: driver.id,
          assignedDriverName: driver.name,
        });

        await db.drivers.update(driver.id, {
          status: 'on_trip',
        });

        await db.trips.add(trip);

        await AuditService.log({
          userId,
          action: 'CREATE',
          entity: 'Trip',
          entityId: trip.id,
          after: trip as unknown as Record<string, unknown>,
        });
      }
    );

    return trip;
  }

  static async completeTrip(
    tripId: string,
    input: {
      endOdometer: number;
      actualArrival?: string;
      fuelLitersConsumed?: number;
      fuelCost?: number;
      driverAllowanceCost?: number;
    },
    userId: string = 'u-flt-mgr',
    expectedVersion?: number
  ): Promise<Trip> {
    const trip = await db.trips.get(tripId);

    if (isServerMode()) {
      requirePermission({ module: 'TM', activity: 'change' }, { plant: trip?.originPlant });
      if (!useConnectivityStore.getState().isOnline) {
        throw new Error(OFFLINE_BLOCKED_ARABIC_EXPLANATION);
      }
      return await dataGateway.instance.completeTrip({
        tripId,
        ...input,
        userId,
        expectedVersion,
      });
    }

    if (!trip) throw new Error('الرحلة غير موجودة');

    requirePermission({ module: 'TM', activity: 'change' }, { plant: trip.originPlant });

    if (trip.status === 'completed') {
      throw new Error('تم إغلاق واعتماد هذه الرحلة مسبقاً');
    }

    if (expectedVersion !== undefined) {
      const storedVer = typeof trip.version === 'number' ? trip.version : 1;
      if (storedVer !== expectedVersion) {
        throw new ConcurrencyError('تم تعديل هذا السجل بواسطة مستخدم آخر. أعد التحميل ثم حاول مجدداً.');
      }
    }

    if (input.endOdometer < trip.startOdometer) {
      throw new Error(
        `عداد النهاية (${input.endOdometer}) لا يمكن أن يكون أقل من عداد البداية (${trip.startOdometer})`
      );
    }

    const distanceKm = input.endOdometer - trip.startOdometer;
    const now = new Date().toISOString();
    const arrivalTime = input.actualArrival || now.slice(0, 16).replace('T', ' ');

    // Delay detection logic: compare scheduled arrival vs actual arrival
    let delayMinutes = 0;
    let delayReason: string | undefined = undefined;

    if (trip.scheduledArrival) {
      const scheduledMs = new Date(trip.scheduledArrival).getTime();
      const actualMs = new Date(arrivalTime).getTime();
      if (actualMs > scheduledMs) {
        delayMinutes = Math.round((actualMs - scheduledMs) / (1000 * 60));
        delayReason =
          delayMinutes > 30
            ? `تأخير وصول الشحنة بمقدار ${delayMinutes} دقيقة عن الموعد المجدول`
            : undefined;
      }
    }

    const fuelCost = input.fuelCost || (input.fuelLitersConsumed ? input.fuelLitersConsumed * 1.15 : 0);
    const allowance = input.driverAllowanceCost || Math.round(distanceKm * 0.35); // 0.35 SAR/km standard driver allowance
    const totalTripCost = fuelCost + allowance;

    const updatedTrip: Trip = {
      ...trip,
      status: 'completed',
      actualArrival: arrivalTime,
      endOdometer: input.endOdometer,
      distanceKm,
      delayMinutes,
      delayReason,
      fuelLitersConsumed: input.fuelLitersConsumed || Math.round(distanceKm * 0.38), // approx 38 L / 100km
      fuelCost,
      driverAllowanceCost: allowance,
      totalTripCost,
      postedAccountingDocNumber: '',
      updatedBy: userId,
      updatedAt: now,
      version: trip.version + 1,
    };

    const txTables = [
      db.trips,
      db.vehicles,
      db.drivers,
      db.journalEntries,
      db.postingRegistry,
      db.numberRanges,
      db.auditLogs,
      db.accountDeterminations,
      db.fiscalPeriods,
    ];

    await db.transaction('rw', txTables, async () => {
      // Re-read inside transaction or check status
      const currentTrip = await db.trips.get(tripId);
      if (!currentTrip) throw new Error('الرحلة غير موجودة');
      if (currentTrip.status === 'completed') {
        return;
      }

      // Idempotent GL posting for trip completion costs
      const postRes = await AutomaticPostingEngine.postTripCost({
        tripDocNumber: currentTrip.docNumber,
        vehiclePlate: currentTrip.vehiclePlate,
        amount: totalTripCost,
        postingDate: arrivalTime.split(' ')[0] || now.split('T')[0],
        createdBy: userId,
      });

      const accountingDocNumber = postRes.jeDocNumber || `ACC-TRIP-2026-${currentTrip.docNumber.split('-')[2] || '000001'}`;
      updatedTrip.postedAccountingDocNumber = accountingDocNumber;

      await db.trips.put(updatedTrip);

      // Free vehicle and update its odometer
      await db.vehicles.update(currentTrip.vehicleId, {
        status: 'available',
        currentOdometer: input.endOdometer,
      });

      // Free driver and update driver statistics
      const driver = await db.drivers.get(currentTrip.driverId);
      if (driver) {
        await db.drivers.update(driver.id, {
          status: 'available',
          totalTripsCompleted: (driver.totalTripsCompleted || 0) + 1,
          totalDistanceKm: (driver.totalDistanceKm || 0) + distanceKm,
        });
      }

      await AuditService.log({
        userId,
        action: 'STATUS_CHANGE',
        entity: 'Trip',
        entityId: currentTrip.id,
        before: currentTrip as unknown as Record<string, unknown>,
        after: updatedTrip as unknown as Record<string, unknown>,
      });
    });

    return updatedTrip;
  }

  /**
   * 4. FUEL MANAGEMENT & ANOMALIES DETECTION (> 25% deviation)
   */
  static async getFuelLogs(vehicleId?: string): Promise<FuelLog[]> {
    if (isServerMode()) {
      return await dataGateway.instance.getFuelLogs(vehicleId);
    }

    let logs = await db.fuelLogs.filter((f) => !f.isDeleted).toArray();
    if (vehicleId) {
      logs = logs.filter((f) => f.vehicleId === vehicleId);
    }
    return logs.sort((a, b) => b.date.localeCompare(a.date));
  }

  static async createFuelLog(
    input: {
      vehicleId: string;
      driverId: string;
      date: string;
      fuelType: 'Diesel' | 'Gasoline95' | 'Gasoline91';
      quantityLiters: number;
      costPerLiter: number;
      odometer: number;
      stationName: string;
    },
    userId: string = 'u-flt-mgr',
    expectedVersion?: number
  ): Promise<{ fuelLog: FuelLog; anomalyAlert?: FuelAnomalyAlert }> {
    const totalCost = input.quantityLiters * input.costPerLiter;
    requirePermission({ module: 'TM', activity: 'create' }, { amount: totalCost });

    if (isServerMode()) {
      if (!useConnectivityStore.getState().isOnline) {
        // Offline field entry: whitelisted command enqueued to Outbox
        const cmd = await OutboxEngine.enqueue({
          type: 'fuel_log',
          payload: { ...input, userId, expectedVersion },
          vehicleId: input.vehicleId,
        });

        const vehicle = await db.vehicles.get(input.vehicleId);
        const optimisticLog: FuelLog = {
          id: cmd.id,
          vehicleId: input.vehicleId,
          vehiclePlate: vehicle?.plateNumber || 'FLT-QUEUED',
          driverId: input.driverId,
          driverName: vehicle?.assignedDriverName || 'سائق',
          date: input.date,
          fuelType: input.fuelType,
          quantityLiters: input.quantityLiters,
          costPerLiter: input.costPerLiter,
          totalCost,
          odometer: input.odometer,
          stationName: input.stationName,
          status: 'pending',
          isDeleted: false,
        };
        return { fuelLog: optimisticLog };
      }

      const log = await dataGateway.instance.createFuelLog({
        ...input,
        userId,
        expectedVersion,
      });
      return { fuelLog: log };
    }

    const vehicle = await db.vehicles.get(input.vehicleId);
    if (!vehicle || vehicle.isDeleted) throw new Error('المركبة غير موجودة');

    if (input.odometer < vehicle.currentOdometer) {
      throw new Error(
        `قراءة العداد المدخلة (${input.odometer} كم) لا يمكن أن تكون أقل من قراءة المركبة الحالية (${vehicle.currentOdometer} كم)`
      );
    }

    if (vehicle.capacityLiters > 0 && input.quantityLiters > vehicle.capacityLiters) {
      throw new Error(
        `كمية الوقود المعبأة (${input.quantityLiters} لتر) تتجاوز سعة خزان الوقود للمركبة (${vehicle.capacityLiters} لتر)`
      );
    }

    const driver = await db.drivers.get(input.driverId);
    if (!driver || driver.isDeleted) throw new Error('السائق غير موجود');

    // Calculate consumption L/100km using previous fuel log (pre-computed before transaction)
    const prevLogs = await db.fuelLogs
      .where('vehicleId')
      .equals(input.vehicleId)
      .filter((f) => !f.isDeleted && f.odometer < input.odometer)
      .sortBy('odometer');

    const lastLog = prevLogs.length > 0 ? prevLogs[prevLogs.length - 1] : null;

    let calculatedLPer100Km = 38.0; // benchmark fallback for heavy tanker
    if (lastLog && input.odometer > lastLog.odometer) {
      const deltaKm = input.odometer - lastLog.odometer;
      if (deltaKm > 0) {
        calculatedLPer100Km = Math.round((input.quantityLiters / deltaKm) * 100 * 10) / 10;
      }
    }

    // Historical average of this vehicle
    const allVehicleLogs = await db.fuelLogs
      .where('vehicleId')
      .equals(input.vehicleId)
      .filter((f) => !f.isDeleted && !!f.calculatedConsumptionPer100Km)
      .toArray();

    const historicalAvg =
      allVehicleLogs.length > 0
        ? allVehicleLogs.reduce((acc, curr) => acc + (curr.calculatedConsumptionPer100Km || 38), 0) /
          allVehicleLogs.length
        : 38.0;

    // Check deviation percentage
    const deviation = Math.round(((calculatedLPer100Km - historicalAvg) / historicalAvg) * 100);
    const isAnomaly = Math.abs(deviation) >= 25;

    const logId = `fl-${Date.now()}`;
    const fuelLog: FuelLog = {
      id: logId,
      vehicleId: input.vehicleId,
      vehiclePlate: vehicle.plateNumber,
      driverId: input.driverId,
      driverName: driver.name,
      date: input.date,
      fuelType: input.fuelType,
      quantityLiters: input.quantityLiters,
      costPerLiter: input.costPerLiter,
      totalCost,
      odometer: input.odometer,
      stationName: input.stationName,
      calculatedConsumptionPer100Km: calculatedLPer100Km,
      isAnomaly,
      anomalyDeviationPercentage: deviation,
      isDeleted: false,
    };

    let anomalyAlert: FuelAnomalyAlert | undefined = undefined;

    if (isAnomaly) {
      anomalyAlert = {
        id: `anom-${Date.now()}`,
        vehicleId: input.vehicleId,
        vehiclePlate: vehicle.plateNumber,
        fuelLogId: logId,
        date: input.date,
        liters: input.quantityLiters,
        recordedLPer100Km: calculatedLPer100Km,
        averageLPer100Km: Math.round(historicalAvg * 10) / 10,
        deviationPercentage: deviation,
        severity: Math.abs(deviation) >= 40 ? 'critical' : 'warning',
        reasonSummary:
          deviation > 0
            ? `استهلاك مرتفع جداً يتجاوز المعدل بنسبة ${deviation}% (احتمال تسريب وقود، تهريب محرك، أو تشغيل مكيف مفرط)`
            : `استهلاك منخفض بنسبة غير اعتيادية ${Math.abs(deviation)}% (فارق قراءة عداد أو تزويد جزئي)`,
        status: 'active',
        isDeleted: false,
      };
    }

    // Wrap persistence and updates atomically including GL posting
    const txTables = [
      db.fuelLogs,
      db.vehicles,
      db.fuelAnomalyAlerts,
      db.journalEntries,
      db.postingRegistry,
      db.numberRanges,
      db.auditLogs,
      db.accountDeterminations,
      db.fiscalPeriods,
    ];

    await db.transaction('rw', txTables, async () => {
      await db.fuelLogs.add(fuelLog);

      // Update vehicle odometer if higher
      if (input.odometer > vehicle.currentOdometer) {
        await db.vehicles.update(vehicle.id, { currentOdometer: input.odometer });
      }

      if (anomalyAlert) {
        await db.fuelAnomalyAlerts.add(anomalyAlert);
      }

      // Idempotent GL posting for fuel cost inside the same transaction
      await AutomaticPostingEngine.postFuelCost({
        fuelLogId: logId,
        vehiclePlate: vehicle.plateNumber,
        amount: totalCost,
        date: input.date,
        stationName: input.stationName,
        createdBy: userId,
      });

      await AuditService.log({
        userId,
        action: 'CREATE',
        entity: 'FuelLog',
        entityId: logId,
        after: fuelLog as unknown as Record<string, unknown>,
      });
    });

    return { fuelLog, anomalyAlert };
  }

  static async getFuelAnomalyAlerts(): Promise<FuelAnomalyAlert[]> {
    return (await db.fuelAnomalyAlerts.filter((a) => !a.isDeleted).toArray()).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  }

  static async resolveFuelAnomalyAlert(
    alertId: string,
    notes: string,
    userId: string = 'u-flt-mgr'
  ): Promise<void> {
    requirePermission({ module: 'TM', activity: 'change' });
    await db.fuelAnomalyAlerts.update(alertId, {
      status: 'resolved',
      resolvedNotes: notes,
    });

    await AuditService.log({
      userId,
      action: 'UPDATE',
      entity: 'FuelAnomalyAlert',
      entityId: alertId,
      after: { status: 'resolved', notes },
    });
  }

  /**
   * 5. MAINTENANCE & INVENTORY INTEGRATION (SAP Movement 261)
   */
  static async getMaintenanceOrders(filtersOrVehicleId?: string | {
    status?: string | 'ALL';
    orderType?: string | 'ALL';
    vehicleId?: string;
  }): Promise<MaintenanceOrder[]> {
    if (isServerMode()) {
      return await dataGateway.instance.getMaintenanceOrders(filtersOrVehicleId as import('../../../core/gateway/IDataGateway').MaintenanceFilters);
    }

    let orders = await db.maintenanceOrders.filter((m) => !m.isDeleted).toArray();
    if (typeof filtersOrVehicleId === 'string') {
      orders = orders.filter((m) => m.vehicleId === filtersOrVehicleId);
    } else if (filtersOrVehicleId) {
      if (filtersOrVehicleId.status && filtersOrVehicleId.status !== 'ALL') {
        orders = orders.filter((m) => m.status === filtersOrVehicleId.status);
      }
      if (filtersOrVehicleId.orderType && filtersOrVehicleId.orderType !== 'ALL') {
        orders = orders.filter((m) => m.orderType === filtersOrVehicleId.orderType);
      }
      if (filtersOrVehicleId.vehicleId) {
        orders = orders.filter((m) => m.vehicleId === filtersOrVehicleId.vehicleId);
      }
    }
    return orders.sort((a, b) => b.startDate.localeCompare(a.startDate));
  }

  static async getMaintenanceOrderById(id: string): Promise<MaintenanceOrder | null> {
    if (isServerMode()) {
      return await dataGateway.instance.getMaintenanceOrderById(id);
    }
    const o = await db.maintenanceOrders.get(id);
    return o && !o.isDeleted ? o : null;
  }

  static async createMaintenanceOrder(
    input: {
      vehicleId: string;
      orderType: 'Preventive' | 'Corrective' | 'Inspection';
      description: string;
      faultReported?: string;
      estimatedCost: number;
      startDate: string;
      preventiveScheduleId?: string;
    },
    userId: string = 'u-flt-mgr'
  ): Promise<MaintenanceOrder> {
    requirePermission(
      { module: 'TM', activity: 'create' },
      { amount: input.estimatedCost }
    );

    if (isServerMode()) {
      if (!useConnectivityStore.getState().isOnline) {
        throw new Error(OFFLINE_BLOCKED_ARABIC_EXPLANATION);
      }
      if (dataGateway.instance.createMaintenanceOrder) {
        return await dataGateway.instance.createMaintenanceOrder(input);
      }
    }

    const vehicle = await db.vehicles.get(input.vehicleId);
    if (!vehicle) throw new Error('المركبة غير موجودة');

    const now = new Date().toISOString();
    let order!: MaintenanceOrder;

    await db.transaction(
      'rw',
      [db.maintenanceOrders, db.vehicles, db.numberRanges, db.auditLogs],
      async () => {
        const docNumber = await NumberRangeService.getNextNumber('MO', '2026');

        order = {
          id: `mo-${Date.now()}`,
          docNumber,
          status: 'in_progress',
          vehicleId: input.vehicleId,
          vehiclePlate: vehicle.plateNumber,
          orderType: input.orderType,
          description: input.description,
          faultReported: input.faultReported,
          estimatedCost: input.estimatedCost,
          actualCost: 0,
          partsCost: 0,
          laborCost: 0,
          laborHours: 0,
          startDate: input.startDate,
          downtimeHours: 0,
          partsUsed: [],
          preventiveScheduleId: input.preventiveScheduleId,
          createdBy: userId,
          createdAt: now,
          updatedBy: userId,
          updatedAt: now,
          version: 1,
          isDeleted: false,
        };

        // Mark vehicle under maintenance
        await db.vehicles.update(vehicle.id, { status: 'maintenance' });

        await db.maintenanceOrders.add(order);

        await AuditService.log({
          userId,
          action: 'CREATE',
          entity: 'MaintenanceOrder',
          entityId: order.id,
          after: order as unknown as Record<string, unknown>,
        });
      }
    );

    return order;
  }

  /**
   * Issue spare parts from inventory to Maintenance Order using SAP Movement Type 261
   */
  static async issuePartsToMaintenanceOrder(
    orderId: string,
    parts: MaintenancePartItem[],
    plantCode: string = '1100',
    userId: string = 'u-flt-mgr',
    expectedVersion?: number
  ): Promise<{ order: MaintenanceOrder; materialDocNumber: string }> {
    requirePermission({ module: 'WM', activity: 'post' }, { plant: plantCode });

    if (isServerMode()) {
      if (!useConnectivityStore.getState().isOnline) {
        throw new Error(OFFLINE_BLOCKED_ARABIC_EXPLANATION);
      }
      return await dataGateway.instance.issuePartsToMaintenanceOrder({
        orderId,
        plantCode,
        parts,
        userId,
        expectedVersion,
      });
    }

    const order = await db.maintenanceOrders.get(orderId);
    if (!order) throw new Error('أمر الصيانة غير موجود');

    if (parts.length === 0) {
      throw new Error('يرجى تحديد قطعة غيار واحدة على الأقل للصرف');
    }

    if (expectedVersion !== undefined) {
      const storedVer = typeof order.version === 'number' ? order.version : 1;
      if (storedVer !== expectedVersion) {
        throw new ConcurrencyError('تم تعديل هذا السجل بواسطة مستخدم آخر. أعد التحميل ثم حاول مجدداً.');
      }
    }

    const txTables = [
      db.maintenanceOrders,
      db.materialDocuments,
      db.stockLedger,
      db.stockBalances,
      db.materials,
      db.purchaseOrders,
      db.goodsReceipts,
      db.journalEntries,
      db.postingRegistry,
      db.numberRanges,
      db.budgets,
      db.auditLogs,
      db.accountDeterminations,
      db.fiscalPeriods,
    ];

    let resultOrder!: MaintenanceOrder;
    let materialDocNumber = '';

    await db.transaction('rw', txTables, async () => {
      // Call InventoryService with Movement Type 261 (Goods Issue for Maintenance Order)
      const movementResult = await InventoryService.postMaterialDocument({
        movementType: '261',
        plantCode,
        storageLocation: parts[0]?.storageLocation || 'SL01',
        headerText: `صرف قطع غيار لأمر صيانة الشاحنة [${order.vehiclePlate}] - أمر: ${order.docNumber}`,
        items: parts.map((p) => ({
          materialCode: p.materialCode,
          quantity: p.quantity,
          unit: p.unit,
          unitPrice: p.unitPrice,
          storageLocation: p.storageLocation,
          orderNumber: order.docNumber,
          costCenter: 'CC-1001',
        })),
        userId,
      });

      materialDocNumber = movementResult.docNumber;

      const newPartsCost = parts.reduce((acc, curr) => acc + curr.totalCost, 0);
      const updatedPartsUsed = [...order.partsUsed, ...parts];
      const totalPartsCost = order.partsCost + newPartsCost;
      const totalActualCost = totalPartsCost + order.laborCost;

      resultOrder = {
        ...order,
        partsCost: totalPartsCost,
        actualCost: totalActualCost,
        partsUsed: updatedPartsUsed,
        materialDocNumber: movementResult.docNumber,
        updatedBy: userId,
        updatedAt: new Date().toISOString(),
        version: order.version + 1,
      };

      await db.maintenanceOrders.put(resultOrder);

      await AuditService.log({
        userId,
        action: 'UPDATE',
        entity: 'MaintenanceOrder',
        entityId: order.id,
        before: order as unknown as Record<string, unknown>,
        after: resultOrder as unknown as Record<string, unknown>,
      });
    });

    return { order: resultOrder, materialDocNumber };
  }

  static async completeMaintenanceOrder(
    orderId: string,
    input: {
      laborHours: number;
      laborRatePerHour?: number;
      downtimeHours: number;
      completionDate: string;
    },
    userId: string = 'u-flt-mgr',
    expectedVersion?: number
  ): Promise<MaintenanceOrder> {
    const order = await db.maintenanceOrders.get(orderId);

    if (isServerMode()) {
      requirePermission({ module: 'TM', activity: 'change' });
      if (!useConnectivityStore.getState().isOnline) {
        throw new Error(OFFLINE_BLOCKED_ARABIC_EXPLANATION);
      }
      return await dataGateway.instance.completeMaintenanceOrder({
        orderId,
        ...input,
        userId,
        expectedVersion,
      });
    }

    if (!order) throw new Error('أمر الصيانة غير موجود');

    requirePermission({ module: 'TM', activity: 'change' });

    if (expectedVersion !== undefined) {
      const storedVer = typeof order.version === 'number' ? order.version : 1;
      if (storedVer !== expectedVersion) {
        throw new ConcurrencyError('تم تعديل هذا السجل بواسطة مستخدم آخر. أعد التحميل ثم حاول مجدداً.');
      }
    }

    if (order.status === 'completed') {
      throw new Error('تم إغلاق واعتماد أمر الصيانة هذا مسبقاً');
    }

    if ((order.partsCost || 0) <= 0 && (!input.laborHours || input.laborHours <= 0)) {
      throw new Error('لا يمكن إغلاق أمر الصيانة بدون تسجيل ساعات عمل فنية أو صرف قطع غيار');
    }

    const laborRate = input.laborRatePerHour || 120; // 120 SAR per tech hour
    const laborCost = input.laborHours * laborRate;
    const actualCost = order.partsCost + laborCost;

    const updatedOrder: MaintenanceOrder = {
      ...order,
      status: 'completed',
      laborHours: input.laborHours,
      laborCost,
      actualCost,
      downtimeHours: input.downtimeHours,
      completionDate: input.completionDate,
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
      version: order.version + 1,
    };

    const txTables = [
      db.maintenanceOrders,
      db.vehicles,
      db.journalEntries,
      db.postingRegistry,
      db.numberRanges,
      db.auditLogs,
      db.accountDeterminations,
      db.fiscalPeriods,
    ];

    await db.transaction('rw', txTables, async () => {
      await db.maintenanceOrders.put(updatedOrder);

      // Return vehicle to available status and advance maintenance milestone
      const vehicle = await db.vehicles.get(order.vehicleId);
      if (vehicle) {
        const nextDue = (vehicle.currentOdometer || 0) + 10000;
        await db.vehicles.update(vehicle.id, {
          status: 'available',
          lastMaintenanceDate: input.completionDate,
          nextMaintenanceOdometer: nextDue,
        });
      }

      // Idempotent GL posting for completed maintenance actual cost inside same transaction
      await AutomaticPostingEngine.postMaintenanceCost({
        orderDocNumber: order.docNumber,
        vehiclePlate: order.vehiclePlate,
        amount: actualCost,
        completionDate: input.completionDate,
        createdBy: userId,
      });

      await AuditService.log({
        userId,
        action: 'STATUS_CHANGE',
        entity: 'MaintenanceOrder',
        entityId: order.id,
        before: order as unknown as Record<string, unknown>,
        after: updatedOrder as unknown as Record<string, unknown>,
      });
    });

    return updatedOrder;
  }

  static async getPreventiveSchedules(vehicleId?: string): Promise<PreventiveSchedule[]> {
    if (isServerMode()) {
      return await dataGateway.instance.getPreventiveSchedules(vehicleId);
    }

    let schedules = await db.preventiveSchedules.filter((s) => !s.isDeleted).toArray();
    if (vehicleId) {
      schedules = schedules.filter((s) => s.vehicleId === vehicleId);
    }
    return schedules;
  }

  static async getPreventiveScheduleAlerts(): Promise<Array<PreventiveSchedule & { alertReason: string; isOverdue: boolean }>> {
    const schedules = await this.getPreventiveSchedules();
    const vehicles = await this.getVehicles();
    const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

    const now = new Date();
    const alerts: Array<PreventiveSchedule & { alertReason: string; isOverdue: boolean }> = [];

    for (const sched of schedules) {
      const veh = vehicleMap.get(sched.vehicleId);
      const currentOdometer = veh?.currentOdometer || sched.lastDoneOdometer;
      const isOdoOverdue = sched.nextDueOdometer > 0 && currentOdometer >= sched.nextDueOdometer;
      const isOdoSoon = sched.nextDueOdometer > 0 && currentOdometer >= sched.nextDueOdometer - 1000;

      const dueDate = sched.nextDueDate ? new Date(sched.nextDueDate) : null;
      const isDateOverdue = dueDate ? now.getTime() >= dueDate.getTime() : false;
      const isDateSoon = dueDate ? dueDate.getTime() - now.getTime() <= 7 * 86400000 : false;

      if (isOdoOverdue || isDateOverdue) {
        alerts.push({
          ...sched,
          status: 'due',
          isOverdue: true,
          alertReason: isOdoOverdue
            ? `تجاوز العداد المحدد (${currentOdometer.toLocaleString()} / ${sched.nextDueOdometer.toLocaleString()} كم)`
            : `تجاوز موعد الصيانة الدوري (${sched.nextDueDate})`,
        });
      } else if (isOdoSoon || isDateSoon) {
        alerts.push({
          ...sched,
          status: 'soon',
          isOverdue: false,
          alertReason: isOdoSoon
            ? `اقتراب موعد الصيانة (${Math.max(0, sched.nextDueOdometer - currentOdometer).toLocaleString()} كم متبقية)`
            : `اقتراب تاريخ الاستحقاق (${sched.nextDueDate})`,
        });
      }
    }

    return alerts.sort((a, b) => (a.isOverdue === b.isOverdue ? 0 : a.isOverdue ? -1 : 1));
  }

  static async getPaginatedFuelLogs(
    filters: import('../../../core/gateway/IDataGateway').FuelLogFilters
  ): Promise<import('../../../core/gateway/IDataGateway').PaginatedResult<FuelLog>> {
    if (dataGateway.instance.getPaginatedFuelLogs) {
      return await dataGateway.instance.getPaginatedFuelLogs(filters);
    }
    const all = await this.getFuelLogs(filters.vehicleId);
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.max(1, Math.min(200, filters.pageSize || 25));
    const offset = (page - 1) * pageSize;
    return {
      data: all.slice(offset, offset + pageSize),
      totalCount: all.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(all.length / pageSize)),
    };
  }

  static async getCostCenterFleetReconciliation(): Promise<import('../../../core/gateway/IDataGateway').CostCenterReconciliation[]> {
    if (dataGateway.instance.getCostCenterFleetReconciliation) {
      return await dataGateway.instance.getCostCenterFleetReconciliation();
    }
    return [];
  }

  /**
   * 6. COST PER VEHICLE REPORT (Fuel + Maintenance + Driver + Depreciation; cost per km)
   */
  static async getVehicleCostReport(vehicleId: string): Promise<VehicleCostReport> {
    if (isServerMode()) {
      return await dataGateway.instance.getVehicleCostReport(vehicleId);
    }

    const vehicle = await db.vehicles.get(vehicleId);
    if (!vehicle) throw new Error('المركبة غير موجودة');

    const fuelLogs = await db.fuelLogs
      .where('vehicleId')
      .equals(vehicleId)
      .filter((f) => !f.isDeleted)
      .toArray();

    const rawFuelTotal = fuelLogs.reduce((acc, curr) => acc + curr.totalCost, 0);
    const fuelCostTotal = Math.round(rawFuelTotal * 100) / 100;

    const maintenanceOrders = await db.maintenanceOrders
      .where('vehicleId')
      .equals(vehicleId)
      .filter((m) => !m.isDeleted && m.status === 'completed')
      .toArray();

    const maintenanceCostTotal = maintenanceOrders.reduce(
      (acc, curr) => acc + curr.actualCost,
      0
    );

    const trips = await db.trips
      .where('vehicleId')
      .equals(vehicleId)
      .filter((t) => !t.isDeleted && t.status === 'completed')
      .toArray();

    const driverAllowanceTotal = trips.reduce(
      (acc, curr) => acc + (curr.driverAllowanceCost || 0),
      0
    );

    const totalDistanceKm =
      trips.reduce((acc, curr) => acc + (curr.distanceKm || 0), 0) ||
      Math.max(1, vehicle.currentOdometer);

    // Depreciation: 12% of baseline estimated vehicle asset value (e.g. 350,000 SAR for heavy tanker)
    const baselineAssetValue =
      vehicle.type === 'Tanker'
        ? 450000
        : vehicle.type === 'HeavyTruck'
        ? 380000
        : vehicle.type === 'Crane'
        ? 650000
        : 150000;
    const depreciationCostTotal = Math.round(baselineAssetValue * 0.12);

    const grandTotalCost =
      fuelCostTotal + maintenanceCostTotal + driverAllowanceTotal + depreciationCostTotal;
    const costPerKm = Math.round((grandTotalCost / totalDistanceKm) * 100) / 100;

    return {
      vehicleId,
      vehiclePlate: vehicle.plateNumber,
      vehicleCode: vehicle.code,
      makeModel: vehicle.makeModel,
      totalDistanceKm,
      fuelCostTotal,
      maintenanceCostTotal,
      driverAllowanceTotal,
      depreciationCostTotal,
      grandTotalCost,
      costPerKm,
    };
  }

  /**
   * 7. FLEET DASHBOARD AGGREGATED METRICS
   */
  static async getFleetDashboardKPIs(): Promise<FleetSummaryKPIs> {
    if (isServerMode()) {
      return await dataGateway.instance.getFleetDashboardKPIs();
    }

    const vehicles = await db.vehicles.filter((v) => !v.isDeleted).toArray();
    const trips = await db.trips.filter((t) => !t.isDeleted).toArray();
    const maintenance = await db.maintenanceOrders.filter((m) => !m.isDeleted).toArray();
    const fuelLogs = await db.fuelLogs.filter((f) => !f.isDeleted).toArray();
    const anomalies = await db.fuelAnomalyAlerts.filter((a) => !a.isDeleted && a.status === 'active').toArray();

    const totalVehicles = vehicles.length || 1;
    const onRoadCount = vehicles.filter((v) => v.status === 'on_trip').length;
    const availableCount = vehicles.filter((v) => v.status === 'available').length;
    const maintenanceCount = vehicles.filter((v) => v.status === 'maintenance').length;
    const outOfServiceCount = vehicles.filter((v) => v.status === 'out_of_service').length;

    const fleetUtilizationRate = Math.round((onRoadCount / totalVehicles) * 100);

    // Calculate fuel today (sample sum of latest entries)
    const fuelConsumedTodayLiters = fuelLogs.slice(0, 15).reduce((acc, curr) => acc + curr.quantityLiters, 0);
    const fuelCostTodaySar = Math.round(fuelConsumedTodayLiters * 1.15);
    const fuelVsYesterdayChangePct = -3.8; // e.g. -3.8% efficiency improvement

    const activeTripsCount = trips.filter((t) => t.status === 'in_progress').length;
    const pendingMaintenanceCount = maintenance.filter((m) => m.status === 'in_progress').length;
    const criticalAnomaliesCount = anomalies.length;

    return {
      totalVehicles,
      onRoadCount,
      availableCount,
      maintenanceCount,
      outOfServiceCount,
      fleetUtilizationRate,
      fuelConsumedTodayLiters,
      fuelCostTodaySar,
      fuelVsYesterdayChangePct,
      activeTripsCount,
      pendingMaintenanceCount,
      criticalAnomaliesCount,
    };
  }
}
