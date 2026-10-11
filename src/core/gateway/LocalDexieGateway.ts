/**
 * Local Dexie Implementation of IDataGateway
 * Preserves 100% offline standalone operation when VITE_SERVER_MODE=false.
 */

import { db } from '../db';
import { NumberRangeService } from '../services/NumberRangeService';
import { AuditService } from '../services/AuditService';
import { InventoryService } from '../../modules/inventory/services/InventoryService';
import { AutomaticPostingEngine } from '../../modules/finance/services/AutomaticPostingEngine';
import { ConcurrencyError } from '../errors';
import type {
  IDataGateway,
  CreateTripParams,
  CompleteTripParams,
  CreateFuelLogParams,
  IssuePartsParams,
  CompleteMaintenanceOrderParams,
  PostJournalParams,
} from './IDataGateway';
import type {
  Vehicle,
  Driver,
  Trip,
  FuelLog,
  FuelAnomalyAlert,
  MaintenanceOrder,
  PreventiveSchedule,
} from '../../types/models';

export class LocalDexieGateway implements IDataGateway {
  public readonly isServerMode: boolean = false;

  async getVehicles(): Promise<Vehicle[]> {
    return (await db.vehicles.filter((v) => !v.isDeleted).toArray()).sort((a, b) =>
      a.code.localeCompare(b.code)
    );
  }

  async getVehicleById(id: string): Promise<Vehicle | null> {
    const v = await db.vehicles.get(id);
    return v && !v.isDeleted ? v : null;
  }

  async getDrivers(): Promise<Driver[]> {
    return (await db.drivers.filter((d) => !d.isDeleted).toArray()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  async getDriverById(id: string): Promise<Driver | null> {
    const d = await db.drivers.get(id);
    return d && !d.isDeleted ? d : null;
  }

  async getTrips(filters?: { status?: string | 'ALL'; vehicleId?: string }): Promise<Trip[]> {
    let trips = await db.trips.filter((t) => !t.isDeleted).toArray();
    if (filters?.status && filters.status !== 'ALL') {
      trips = trips.filter((t) => t.status === filters.status);
    }
    if (filters?.vehicleId) {
      trips = trips.filter((t) => t.vehicleId === filters.vehicleId);
    }
    return trips.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getTripById(id: string): Promise<Trip | null> {
    const t = await db.trips.get(id);
    return t && !t.isDeleted ? t : null;
  }

  async getFuelLogs(vehicleId?: string): Promise<FuelLog[]> {
    let logs = await db.fuelLogs.filter((f) => !f.isDeleted).toArray();
    if (vehicleId) {
      logs = logs.filter((f) => f.vehicleId === vehicleId);
    }
    return logs.sort((a, b) => b.date.localeCompare(a.date));
  }

  async getMaintenanceOrders(vehicleId?: string): Promise<MaintenanceOrder[]> {
    let orders = await db.maintenanceOrders.filter((m) => !m.isDeleted).toArray();
    if (vehicleId) {
      orders = orders.filter((m) => m.vehicleId === vehicleId);
    }
    return orders.sort((a, b) => b.startDate.localeCompare(a.startDate));
  }

  async getMaintenanceOrderById(id: string): Promise<MaintenanceOrder | null> {
    const m = await db.maintenanceOrders.get(id);
    return m && !m.isDeleted ? m : null;
  }

  async getPreventiveSchedules(vehicleId?: string): Promise<PreventiveSchedule[]> {
    let schedules = await db.preventiveSchedules.filter((s) => !s.isDeleted).toArray();
    if (vehicleId) {
      schedules = schedules.filter((s) => s.vehicleId === vehicleId);
    }
    return schedules.sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
  }

  async createVehicle(data: Omit<Vehicle, 'id' | 'isDeleted'>, userId: string = 'u-flt-mgr'): Promise<Vehicle> {
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

  async updateVehicle(
    id: string,
    updates: Partial<Vehicle>,
    userId: string = 'u-flt-mgr',
    expectedVersion?: number
  ): Promise<Vehicle> {
    const current = await db.vehicles.get(id);
    if (!current || current.isDeleted) throw new Error('المركبة غير موجودة');

    if (expectedVersion !== undefined) {
      const storedVer = typeof current.version === 'number' ? current.version : 1;
      if (storedVer !== expectedVersion) {
        throw new ConcurrencyError('تم تعديل هذا السجل بواسطة مستخدم آخر. أعد التحميل ثم حاول مجدداً.');
      }
    }

    const nextVersion = (typeof current.version === 'number' ? current.version : 1) + 1;
    const updated: Vehicle = {
      ...current,
      ...updates,
      version: nextVersion,
    };

    await db.vehicles.put(updated);
    await AuditService.log({
      userId,
      action: 'UPDATE',
      entity: 'Vehicle',
      entityId: id,
      before: current as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });
    return updated;
  }

  async createDriver(data: Omit<Driver, 'id' | 'isDeleted'>, userId: string = 'u-flt-mgr'): Promise<Driver> {
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

  async updateDriver(
    id: string,
    updates: Partial<Driver>,
    userId: string = 'u-flt-mgr',
    expectedVersion?: number
  ): Promise<Driver> {
    const current = await db.drivers.get(id);
    if (!current || current.isDeleted) throw new Error('السائق غير موجود');

    if (expectedVersion !== undefined) {
      const storedVer = typeof current.version === 'number' ? current.version : 1;
      if (storedVer !== expectedVersion) {
        throw new ConcurrencyError('تم تعديل هذا السجل بواسطة مستخدم آخر. أعد التحميل ثم حاول مجدداً.');
      }
    }

    const nextVersion = (typeof current.version === 'number' ? current.version : 1) + 1;
    const updated: Driver = {
      ...current,
      ...updates,
      version: nextVersion,
    };

    await db.drivers.put(updated);
    await AuditService.log({
      userId,
      action: 'UPDATE',
      entity: 'Driver',
      entityId: id,
      before: current as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });
    return updated;
  }

  async createMaintenanceOrder(
    data: Omit<MaintenanceOrder, 'id' | 'docNumber' | 'isDeleted'>,
    userId: string = 'u-flt-mgr'
  ): Promise<MaintenanceOrder> {
    const vehicle = await db.vehicles.get(data.vehicleId);
    if (!vehicle) throw new Error('المركبة المحددة غير موجودة');

    let order!: MaintenanceOrder;
    await db.transaction('rw', [db.maintenanceOrders, db.vehicles, db.numberRanges, db.auditLogs], async () => {
      const docNumber = await NumberRangeService.getNextNumber('PM_ORDER', '2026');
      const id = `mo-${Date.now()}`;
      order = {
        ...data,
        id,
        docNumber,
        version: 1,
        isDeleted: false,
      };

      await db.maintenanceOrders.add(order);
      await db.vehicles.update(vehicle.id, { status: 'maintenance' });

      await AuditService.log({
        userId,
        action: 'CREATE',
        entity: 'MaintenanceOrder',
        entityId: id,
        after: order as unknown as Record<string, unknown>,
      });
    });

    return order;
  }

  // --- Authoritative Commands ---

  async createTrip(params: CreateTripParams, userId: string = 'u-flt-mgr'): Promise<Trip> {
    const vehicle = await db.vehicles.get(params.vehicleId);
    if (!vehicle) throw new Error('المركبة المحددة غير موجودة');
    const driver = await db.drivers.get(params.driverId);
    if (!driver) throw new Error('السائق المحدد غير موجود');

    const now = new Date().toISOString();
    let trip!: Trip;

    await db.transaction('rw', [db.trips, db.vehicles, db.drivers, db.numberRanges, db.auditLogs], async () => {
      const docNumber = await NumberRangeService.getNextNumber('TRIP', '2026');
      trip = {
        id: `trip-${Date.now()}`,
        docNumber,
        status: 'in_progress',
        vehicleId: params.vehicleId,
        vehiclePlate: vehicle.plateNumber,
        driverId: params.driverId,
        driverName: driver.name,
        originPlant: params.originPlant,
        destinationLocation: params.destinationLocation,
        cargoType: params.cargoType,
        cargoVolumeLiters: params.cargoVolumeLiters,
        scheduledDeparture: params.scheduledDeparture,
        scheduledArrival: params.scheduledArrival,
        actualDeparture: now.slice(0, 16).replace('T', ' '),
        startOdometer: params.startOdometer,
        createdBy: userId,
        createdAt: now,
        updatedBy: userId,
        updatedAt: now,
        version: 1,
        isDeleted: false,
      };

      await db.vehicles.update(vehicle.id, {
        status: 'on_trip',
        assignedDriverId: driver.id,
        assignedDriverName: driver.name,
      });

      await db.drivers.update(driver.id, { status: 'on_trip' });
      await db.trips.add(trip);

      await AuditService.log({
        userId,
        action: 'CREATE',
        entity: 'Trip',
        entityId: trip.id,
        after: trip as unknown as Record<string, unknown>,
      });
    });

    return trip;
  }

  async completeTrip(params: CompleteTripParams, userId: string = 'u-flt-mgr'): Promise<Trip> {
    const trip = await db.trips.get(params.tripId);
    if (!trip) throw new Error('الرحلة غير موجودة');

    if (params.expectedVersion !== undefined) {
      const storedVer = typeof trip.version === 'number' ? trip.version : 1;
      if (storedVer !== params.expectedVersion) {
        throw new ConcurrencyError('تم تعديل هذا السجل بواسطة مستخدم آخر. أعد التحميل ثم حاول مجدداً.');
      }
    }

    if (params.endOdometer < trip.startOdometer) {
      throw new Error(
        `عداد النهاية (${params.endOdometer}) لا يمكن أن يكون أقل من عداد البداية (${trip.startOdometer})`
      );
    }

    const distanceKm = params.endOdometer - trip.startOdometer;
    const now = new Date().toISOString();
    const arrivalTime = params.actualArrival || now.slice(0, 16).replace('T', ' ');

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

    const fuelCost = params.fuelCost || (params.fuelLitersConsumed ? params.fuelLitersConsumed * 1.15 : 0);
    const allowance = params.driverAllowanceCost || Math.round(distanceKm * 0.35);
    const totalTripCost = fuelCost + allowance;

    const updatedTrip: Trip = {
      ...trip,
      status: 'completed',
      actualArrival: arrivalTime,
      endOdometer: params.endOdometer,
      distanceKm,
      delayMinutes,
      delayReason,
      fuelLitersConsumed: params.fuelLitersConsumed || Math.round(distanceKm * 0.38),
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
      const currentTrip = await db.trips.get(params.tripId);
      if (!currentTrip || currentTrip.status === 'completed') {
        return;
      }

      if (totalTripCost > 0) {
        const postingResult = await AutomaticPostingEngine.postTripCost(
          {
            id: currentTrip.id,
            docNumber: currentTrip.docNumber,
            originPlant: currentTrip.originPlant,
            totalCost: totalTripCost,
          },
          userId
        );
        updatedTrip.postedAccountingDocNumber = postingResult.jeDocNumber;
      }

      await db.trips.put(updatedTrip);

      const vehicle = await db.vehicles.get(currentTrip.vehicleId);
      if (vehicle) {
        await db.vehicles.update(vehicle.id, {
          status: 'available',
          currentOdometer: Math.max(vehicle.currentOdometer, params.endOdometer),
          assignedDriverId: undefined,
          assignedDriverName: undefined,
        });
      }

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

  async createFuelLog(
    params: CreateFuelLogParams,
    userId: string = 'u-flt-mgr'
  ): Promise<{ fuelLog: FuelLog; anomalyAlert?: FuelAnomalyAlert }> {
    const vehicle = await db.vehicles.get(params.vehicleId);
    if (!vehicle) throw new Error('المركبة غير موجودة');
    const driver = await db.drivers.get(params.driverId);
    if (!driver) throw new Error('السائق غير موجود');

    const totalCost = params.quantityLiters * params.costPerLiter;

    const prevLogs = await db.fuelLogs
      .where('vehicleId')
      .equals(params.vehicleId)
      .filter((f) => !f.isDeleted && f.odometer < params.odometer)
      .sortBy('odometer');

    const lastLog = prevLogs.length > 0 ? prevLogs[prevLogs.length - 1] : null;

    let calculatedLPer100Km = 38.0;
    if (lastLog && params.odometer > lastLog.odometer) {
      const deltaKm = params.odometer - lastLog.odometer;
      if (deltaKm > 0) {
        calculatedLPer100Km = Math.round((params.quantityLiters / deltaKm) * 100 * 10) / 10;
      }
    }

    const allVehicleLogs = await db.fuelLogs
      .where('vehicleId')
      .equals(params.vehicleId)
      .filter((f) => !f.isDeleted && !!f.calculatedConsumptionPer100Km)
      .toArray();

    const historicalAvg =
      allVehicleLogs.length > 0
        ? allVehicleLogs.reduce((acc, curr) => acc + (curr.calculatedConsumptionPer100Km || 38), 0) /
          allVehicleLogs.length
        : 38.0;

    const deviationPct = Math.round(((calculatedLPer100Km - historicalAvg) / historicalAvg) * 100);
    const isAnomaly = deviationPct > 25 && calculatedLPer100Km > 45;

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

    let log!: FuelLog;
    let alert: FuelAnomalyAlert | undefined = undefined;

    await db.transaction('rw', txTables, async () => {
      const id = `fl-${Date.now()}`;
      log = {
        id,
        vehicleId: params.vehicleId,
        vehiclePlate: vehicle.plateNumber,
        driverId: params.driverId,
        driverName: driver.name,
        date: params.date,
        fuelType: params.fuelType,
        quantityLiters: params.quantityLiters,
        costPerLiter: params.costPerLiter,
        totalCost,
        odometer: params.odometer,
        stationName: params.stationName,
        calculatedConsumptionPer100Km: calculatedLPer100Km,
        isAnomaly,
        jeDocNumber: '',
        version: 1,
        isDeleted: false,
      };

      if (totalCost > 0) {
        const postingResult = await AutomaticPostingEngine.postFuelLogCost(
          {
            id: log.id,
            vehiclePlate: vehicle.plateNumber,
            stationName: params.stationName,
            totalCost,
          },
          userId
        );
        log.jeDocNumber = postingResult.jeDocNumber;
      }

      await db.fuelLogs.add(log);

      await db.vehicles.update(vehicle.id, {
        currentOdometer: Math.max(vehicle.currentOdometer, params.odometer),
      });

      if (isAnomaly) {
        alert = {
          id: `falert-${Date.now()}`,
          vehicleId: vehicle.id,
          vehiclePlate: vehicle.plateNumber,
          fuelLogId: log.id,
          driverId: driver.id,
          driverName: driver.name,
          date: params.date,
          recordedLPer100Km: calculatedLPer100Km,
          averageLPer100Km: Math.round(historicalAvg * 10) / 10,
          deviationPercentage: deviationPct,
          severity: deviationPct > 40 ? 'critical' : 'warning',
          reasonSummary: `انحراف في استهلاك الوقود بنسبة ${deviationPct}% عن المعدل الطبيعي (${Math.round(historicalAvg)} لتر/100كم)`,
          status: 'active',
          isDeleted: false,
        };
        await db.fuelAnomalyAlerts.add(alert);
      }

      await AuditService.log({
        userId,
        action: 'CREATE',
        entity: 'FuelLog',
        entityId: id,
        after: log as unknown as Record<string, unknown>,
      });
    });

    return { fuelLog: log, anomalyAlert: alert };
  }

  async issuePartsToMaintenanceOrder(
    params: IssuePartsParams,
    userId: string = 'u-flt-mgr'
  ): Promise<{ order: MaintenanceOrder; materialDocNumber: string }> {
    const order = await db.maintenanceOrders.get(params.orderId);
    if (!order) throw new Error('أمر الصيانة غير موجود');

    if (params.expectedVersion !== undefined) {
      const storedVer = typeof order.version === 'number' ? order.version : 1;
      if (storedVer !== params.expectedVersion) {
        throw new ConcurrencyError('تم تعديل هذا السجل بواسطة مستخدم آخر. أعد التحميل ثم حاول مجدداً.');
      }
    }

    if (params.parts.length === 0) {
      throw new Error('يرجى تحديد قطعة غيار واحدة على الأقل للصرف');
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
      const movementResult = await InventoryService.postMaterialDocument({
        movementType: '261',
        plantCode: params.plantCode,
        storageLocation: params.parts[0]?.storageLocation || 'SL01',
        headerText: `صرف قطع غيار لأمر صيانة الشاحنة [${order.vehiclePlate}] - أمر: ${order.docNumber}`,
        items: params.parts.map((p) => ({
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

      const newPartsCost = params.parts.reduce((acc, curr) => acc + curr.totalCost, 0);
      const updatedPartsUsed = [...order.partsUsed, ...params.parts];
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

  async completeMaintenanceOrder(
    params: CompleteMaintenanceOrderParams,
    userId: string = 'u-flt-mgr'
  ): Promise<MaintenanceOrder> {
    const order = await db.maintenanceOrders.get(params.orderId);
    if (!order) throw new Error('أمر الصيانة غير موجود');

    if (params.expectedVersion !== undefined) {
      const storedVer = typeof order.version === 'number' ? order.version : 1;
      if (storedVer !== params.expectedVersion) {
        throw new ConcurrencyError('تم تعديل هذا السجل بواسطة مستخدم آخر. أعد التحميل ثم حاول مجدداً.');
      }
    }

    const laborRate = params.laborRatePerHour || 120;
    const laborCost = params.laborHours * laborRate;
    const actualCost = order.partsCost + laborCost;

    const updatedOrder: MaintenanceOrder = {
      ...order,
      status: 'completed',
      laborHours: params.laborHours,
      laborCost,
      actualCost,
      downtimeHours: params.downtimeHours,
      completionDate: params.completionDate,
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
      const currentOrder = await db.maintenanceOrders.get(params.orderId);
      if (!currentOrder || currentOrder.status === 'completed') {
        return;
      }

      if (laborCost > 0) {
        const postingResult = await AutomaticPostingEngine.postMaintenanceLaborCost(
          {
            id: currentOrder.id,
            docNumber: currentOrder.docNumber,
            laborCost,
          },
          userId
        );
        updatedOrder.postedAccountingDocNumber = postingResult.jeDocNumber;
      }

      await db.maintenanceOrders.put(updatedOrder);

      const vehicle = await db.vehicles.get(currentOrder.vehicleId);
      if (vehicle) {
        await db.vehicles.update(vehicle.id, {
          status: 'available',
          lastMaintenanceDate: params.completionDate,
        });
      }

      await AuditService.log({
        userId,
        action: 'STATUS_CHANGE',
        entity: 'MaintenanceOrder',
        entityId: currentOrder.id,
        before: currentOrder as unknown as Record<string, unknown>,
        after: updatedOrder as unknown as Record<string, unknown>,
      });
    });

    return updatedOrder;
  }

  async postJournal(
    params: PostJournalParams,
    userId: string = 'admin'
  ): Promise<{ success: boolean; docNumber: string; isDuplicate?: boolean }> {
    const regKey = `[${params.sourceType}+${params.sourceId}+${params.event}]`;
    const existing = await db.postingRegistry
      .where('[sourceType+sourceId+event]')
      .equals([params.sourceType, params.sourceId, params.event])
      .first();

    if (existing) {
      return { success: true, docNumber: existing.journalDocNumber, isDuplicate: true };
    }

    const docNumber = await NumberRangeService.getNextNumber('JE', '2026');
    const jeId = `je-${Date.now()}`;
    const now = new Date().toISOString();

    const totalDebit = params.lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = params.lines.reduce((s, l) => s + (l.credit || 0), 0);

    await db.transaction('rw', [db.journalEntries, db.postingRegistry, db.auditLogs], async () => {
      await db.journalEntries.add({
        id: jeId,
        docNumber,
        companyCode: '1000',
        fiscalYear: '2026',
        period: 4,
        documentDate: params.postingDate || now.slice(0, 10),
        postingDate: params.postingDate || now.slice(0, 10),
        documentType: (params.documentType as import('../../types/models').JournalDocumentType) || 'SA',
        reference: params.sourceId,
        headerText: params.headerText,
        lines: params.lines.map((l, idx) => ({
          lineNumber: idx + 1,
          glAccount: l.accountNumber,
          glAccountName: l.accountName,
          costCenter: l.costCenter,
          debit: l.debit,
          credit: l.credit,
          currency: 'SAR',
          description: l.lineText || params.headerText,
          postingKey: l.postingKey,
        })),
        totalDebit,
        totalCredit,
        status: 'posted',
        isParked: false,
        createdBy: userId,
        createdAt: now,
        updatedBy: userId,
        updatedAt: now,
        version: 1,
        isDeleted: false,
      });

      await db.postingRegistry.add({
        id: `reg-${Date.now()}`,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        event: params.event,
        journalDocNumber: docNumber,
        createdAt: now,
      });
    });

    return { success: true, docNumber, isDuplicate: false };
  }
}
