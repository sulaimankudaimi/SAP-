import { db } from '../db';
import type {
  Trip,
  Vehicle,
  Driver,
  FuelLog,
  MaintenanceOrder,
  MaintenancePartItem,
  PreventiveSchedule,
  FuelAnomalyAlert,
  ExpiryAlert,
  VehicleCostReport,
  FleetSummaryKPIs,
} from '../../types/models';
import type {
  IDataGateway,
  CreateTripCommand,
  CompleteTripCommand,
  CreateFuelLogCommand,
  IssuePartsCommand,
  CompleteMaintenanceOrderCommand,
  PostJournalCommand,
  RecordTripEventCommand,
  RecordOdometerReadingCommand,
  RecordInspectionCommand,
  VehicleFilters,
  DriverFilters,
  TripFilters,
  MaintenanceFilters,
  FuelLogFilters,
  PaginatedResult,
  CostCenterReconciliation,
  RealtimeChangeCallback,
} from './IDataGateway';
import { FleetService } from '../../modules/fleet/services/FleetService';
import { FinanceService } from '../../modules/finance/services/FinanceService';

export class LocalDexieGateway implements IDataGateway {
  readonly mode = 'local' as const;

  // Command Methods
  async createTrip(cmd: CreateTripCommand): Promise<Trip> {
    return await FleetService.createTrip(cmd, cmd.userId);
  }

  async completeTrip(cmd: CompleteTripCommand): Promise<Trip> {
    return await FleetService.completeTrip(
      cmd.tripId,
      {
        endOdometer: cmd.endOdometer,
        fuelLitersConsumed: cmd.fuelLitersConsumed,
        fuelCost: cmd.fuelCost,
        driverAllowanceCost: cmd.driverAllowanceCost,
      },
      cmd.userId
    );
  }

  async createFuelLog(cmd: CreateFuelLogCommand): Promise<FuelLog> {
    const liters = cmd.liters ?? cmd.quantityLiters ?? 0;
    const costPerLiter = cmd.costPerLiter ?? (liters > 0 && cmd.cost ? cmd.cost / liters : 1.15);
    const odometer = cmd.odometer ?? cmd.currentOdometer ?? 0;
    const date = cmd.date ?? cmd.occurredAt ?? new Date().toISOString().split('T')[0];
    const stationName = cmd.stationName ?? cmd.stationLocation ?? cmd.vendorName ?? 'محطة المحروقات';
    const fuelType = (cmd.fuelType as 'Diesel' | 'Gasoline91' | 'Gasoline95') || 'Diesel';

    const res = await FleetService.createFuelLog(
      {
        vehicleId: cmd.vehicleId,
        driverId: cmd.driverId || 'DRV-UNKNOWN',
        date,
        fuelType,
        quantityLiters: liters,
        costPerLiter,
        odometer,
        stationName,
      },
      cmd.userId
    );
    return res.fuelLog;
  }

  async issuePartsToMaintenanceOrder(
    cmd: IssuePartsCommand
  ): Promise<{ order: MaintenanceOrder; materialDocNumber: string }> {
    const parts: MaintenancePartItem[] = (cmd.items || []).map((item, index) => ({
      lineItem: index + 1,
      materialCode: item.materialCode,
      materialName: item.materialCode,
      quantity: item.quantity,
      unit: 'EA',
      unitPrice: 0,
      totalCost: 0,
      storageLocation: item.storageLocationCode || 'SL01',
    }));
    return await FleetService.issuePartsToMaintenanceOrder(
      cmd.orderId,
      parts,
      cmd.items?.[0]?.plantCode || '1100',
      cmd.userId
    );
  }

  async completeMaintenanceOrder(cmd: CompleteMaintenanceOrderCommand): Promise<MaintenanceOrder> {
    return await FleetService.completeMaintenanceOrder(
      cmd.orderId,
      {
        laborHours: cmd.actualLaborHours ?? 0,
        laborRatePerHour: cmd.actualLaborCost && cmd.actualLaborHours ? cmd.actualLaborCost / cmd.actualLaborHours : undefined,
        downtimeHours: cmd.downtimeHours ?? 0,
        completionDate: cmd.completionDate,
      },
      cmd.userId
    );
  }

  async postJournal(cmd: PostJournalCommand): Promise<{ docNumber: string; jeId: string }> {
    const postDate = cmd.postingDate || new Date().toISOString().split('T')[0];
    const dateObj = new Date(postDate);
    const je = await FinanceService.createJournalEntry({
      headerText: cmd.headerText,
      companyCode: cmd.companyCode || '1000',
      fiscalYear: cmd.fiscalYear || dateObj.getFullYear().toString(),
      period: cmd.period || dateObj.getMonth() + 1,
      documentType: 'SA',
      documentDate: cmd.documentDate || postDate,
      postingDate: postDate,
      reference: cmd.reference,
      createdBy: cmd.userId || 'system',
      lines: cmd.lines.map((l) => ({
        accountNumber: l.accountNumber,
        accountName: l.accountName,
        debit: l.debit,
        credit: l.credit,
        costCenter: l.costCenter,
        lineText: l.lineText,
      })),
    });
    return { docNumber: je.docNumber, jeId: je.id };
  }

  // Field Telemetry Commands
  async recordTripEvent(cmd: RecordTripEventCommand): Promise<{ requestId: string; tripId: string; eventType: string }> {
    return { requestId: cmd.requestId, tripId: cmd.tripId, eventType: cmd.eventType };
  }

  async recordOdometerReading(cmd: RecordOdometerReadingCommand): Promise<{ requestId: string; vehicleId: string; readingKm: number }> {
    const v = await db.vehicles.get(cmd.vehicleId);
    if (v && cmd.readingKm > (v.currentOdometer || 0)) {
      await db.vehicles.update(cmd.vehicleId, { currentOdometer: cmd.readingKm, updatedAt: new Date().toISOString() });
    }
    return { requestId: cmd.requestId, vehicleId: cmd.vehicleId, readingKm: cmd.readingKm };
  }

  async recordInspection(cmd: RecordInspectionCommand): Promise<{ requestId: string; vehicleId: string; result: string }> {
    return { requestId: cmd.requestId, vehicleId: cmd.vehicleId, result: cmd.result };
  }

  // Master Data Commands
  async createVehicle(vehicle: Partial<Vehicle>): Promise<Vehicle> {
    return await FleetService.createVehicle(vehicle as Omit<Vehicle, 'id' | 'isDeleted'>);
  }

  async updateVehicle(id: string, updates: Partial<Vehicle>, expectedVersion?: number): Promise<Vehicle> {
    return await FleetService.updateVehicle(id, updates, undefined, expectedVersion);
  }

  async setVehicleActive(id: string, isActive: boolean, expectedVersion?: number): Promise<Vehicle> {
    return await FleetService.setVehicleActive(id, isActive, undefined, expectedVersion);
  }

  async createDriver(driver: Partial<Driver>): Promise<Driver> {
    return await FleetService.createDriver(driver as Omit<Driver, 'id' | 'isDeleted'>);
  }

  async updateDriver(id: string, updates: Partial<Driver>, expectedVersion?: number): Promise<Driver> {
    return await FleetService.updateDriver(id, updates, undefined, expectedVersion);
  }

  async setDriverActive(id: string, isActive: boolean, expectedVersion?: number): Promise<Driver> {
    return await FleetService.setDriverActive(id, isActive, undefined, expectedVersion);
  }

  // Query Methods (Backed by Local Dexie Tables)
  async getVehicles(filters?: VehicleFilters): Promise<Vehicle[]> {
    let collection = db.vehicles.filter((v) => !v.isDeleted);
    if (filters?.status) {
      collection = collection.filter((v) => v.status === filters.status);
    }
    if (filters?.vehicleType) {
      collection = collection.filter((v) => v.type === filters.vehicleType);
    }
    if (filters?.assignedPlant) {
      collection = collection.filter((v) => (v as unknown as { plantCode?: string }).plantCode === filters.assignedPlant);
    }
    return await collection.toArray();
  }

  async getVehicleById(id: string): Promise<Vehicle | null> {
    const v = await db.vehicles.get(id);
    return v && !v.isDeleted ? v : null;
  }

  async getDrivers(filters?: DriverFilters): Promise<Driver[]> {
    let collection = db.drivers.filter((d) => !d.isDeleted);
    if (filters?.status) {
      collection = collection.filter((d) => d.status === filters.status);
    }
    return await collection.toArray();
  }

  async getDriverById(id: string): Promise<Driver | null> {
    const d = await db.drivers.get(id);
    return d && !d.isDeleted ? d : null;
  }

  async getTrips(filters?: TripFilters): Promise<Trip[]> {
    let collection = db.trips.filter((t) => !t.isDeleted);
    if (filters?.status) {
      collection = collection.filter((t) => t.status === filters.status);
    }
    if (filters?.vehicleId) {
      collection = collection.filter((t) => t.vehicleId === filters.vehicleId);
    }
    if (filters?.driverId) {
      collection = collection.filter((t) => t.driverId === filters.driverId);
    }
    return await collection.toArray();
  }

  async getTripById(id: string): Promise<Trip | null> {
    const t = await db.trips.get(id);
    return t && !t.isDeleted ? t : null;
  }

  async getFuelLogs(filtersOrVehicleId?: string | FuelLogFilters): Promise<FuelLog[]> {
    let collection = db.fuelLogs.filter((f) => !f.isDeleted);
    if (typeof filtersOrVehicleId === 'string') {
      collection = collection.filter((f) => f.vehicleId === filtersOrVehicleId);
    } else if (filtersOrVehicleId) {
      if (filtersOrVehicleId.vehicleId) {
        collection = collection.filter((f) => f.vehicleId === filtersOrVehicleId.vehicleId);
      }
      if (filtersOrVehicleId.driverId) {
        collection = collection.filter((f) => f.driverId === filtersOrVehicleId.driverId);
      }
      if (filtersOrVehicleId.search) {
        const s = filtersOrVehicleId.search.toLowerCase();
        collection = collection.filter((f) =>
          Boolean(
            (f.vehiclePlate && f.vehiclePlate.toLowerCase().includes(s)) ||
              (f.stationName && f.stationName.toLowerCase().includes(s)) ||
              (f.driverName && f.driverName.toLowerCase().includes(s))
          )
        );
      }
    }
    return await collection.reverse().sortBy('date');
  }

  async getPaginatedFuelLogs(filters: FuelLogFilters): Promise<PaginatedResult<FuelLog>> {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 25;
    const all = await this.getFuelLogs(filters);
    const totalCount = all.length;
    const from = (page - 1) * pageSize;
    const data = all.slice(from, from + pageSize);

    return {
      data,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  }

  async getMaintenanceOrders(filtersOrVehicleId?: string | MaintenanceFilters): Promise<MaintenanceOrder[]> {
    let collection = db.maintenanceOrders.filter((m) => !m.isDeleted);
    if (typeof filtersOrVehicleId === 'string') {
      collection = collection.filter((m) => m.vehicleId === filtersOrVehicleId);
    } else if (filtersOrVehicleId) {
      if (filtersOrVehicleId.vehicleId) {
        collection = collection.filter((m) => m.vehicleId === filtersOrVehicleId.vehicleId);
      }
      if (filtersOrVehicleId.status) {
        collection = collection.filter((m) => m.status === filtersOrVehicleId.status);
      }
      if (filtersOrVehicleId.orderType) {
        collection = collection.filter((m) => m.orderType === filtersOrVehicleId.orderType);
      }
    }
    return await collection.toArray();
  }

  async getMaintenanceOrderById(id: string): Promise<MaintenanceOrder | null> {
    const m = await db.maintenanceOrders.get(id);
    return m && !m.isDeleted ? m : null;
  }

  async getPreventiveSchedules(vehicleId?: string): Promise<PreventiveSchedule[]> {
    let collection = db.preventiveSchedules.filter((s) => !s.isDeleted);
    if (vehicleId) {
      collection = collection.filter((s) => s.vehicleId === vehicleId);
    }
    return await collection.toArray();
  }

  async getFuelAnomalyAlerts(): Promise<FuelAnomalyAlert[]> {
    return await FleetService.getFuelAnomalyAlerts();
  }

  async getVehicleExpiryAlerts(): Promise<ExpiryAlert[]> {
    return await FleetService.getVehicleExpiryAlerts(30);
  }

  async getVehicleCostReport(vehicleId: string): Promise<VehicleCostReport> {
    return await FleetService.getVehicleCostReport(vehicleId);
  }

  async getCostCenterFleetReconciliation(): Promise<CostCenterReconciliation[]> {
    const vehicles = await db.vehicles.filter((v) => !v.isDeleted).toArray();
    const plantCodes = Array.from(new Set(vehicles.map((v) => (v as unknown as { plantCode?: string }).plantCode || '1100')));
    
    const results: CostCenterReconciliation[] = [];
    for (const plant of plantCodes) {
      const cc = `CC-FLT-${plant}`;
      const plantVehicles = vehicles.filter((v) => ((v as unknown as { plantCode?: string }).plantCode || '1100') === plant);
      const vehicleIds = plantVehicles.map((v) => v.id);

      const fuel = await db.fuelLogs
        .filter((f) => !f.isDeleted && vehicleIds.includes(f.vehicleId))
        .toArray();
      const totalFuel = fuel.reduce((acc, f) => acc + (f.totalCost || 0), 0);

      const orders = await db.maintenanceOrders
        .filter((m) => !m.isDeleted && vehicleIds.includes(m.vehicleId) && m.status === 'completed')
        .toArray();
      const totalMaintenance = orders.reduce((acc, o) => acc + (o.actualCost || 0), 0);

      const trips = await db.trips
        .filter((t) => !t.isDeleted && vehicleIds.includes(t.vehicleId) && t.status === 'completed')
        .toArray();
      const totalAllowance = trips.reduce((acc, t) => acc + (t.driverAllowanceCost || 0), 0);

      const operationalTotal = totalFuel + totalMaintenance + totalAllowance;

      const journals = await db.journalEntries.filter((j) => !j.isDeleted && j.status === 'posted').toArray();
      let journalTotalDebit = 0;
      for (const j of journals) {
        for (const line of j.lines || []) {
          if (line.costCenter === cc) {
            journalTotalDebit += line.debit || 0;
          }
        }
      }

      results.push({
        costCenter: cc,
        totalFuel,
        totalMaintenance,
        totalAllowance,
        operationalTotalCost: operationalTotal,
        journalTotalDebit,
        variance: operationalTotal - journalTotalDebit,
      });
    }

    return results;
  }

  async getFleetDashboardKPIs(): Promise<FleetSummaryKPIs> {
    return await FleetService.getFleetDashboardKPIs();
  }

  // Realtime in Local Mode
  subscribeFleet(
    tables: string[],
    onChange: RealtimeChangeCallback
  ): () => void {
    const interval = setInterval(() => {
      for (const t of tables) {
        onChange(t, 'UPDATE', {});
      }
    }, 30000);

    return () => clearInterval(interval);
  }
}
