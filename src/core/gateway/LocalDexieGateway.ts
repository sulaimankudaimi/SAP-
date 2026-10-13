import { db } from '../db';
import type {
  Trip,
  Vehicle,
  Driver,
  FuelLog,
  MaintenanceOrder,
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
import { AuthService, type AuthSession } from '../services/AuthService';
import { useAuthStore } from '../auth/useAuthStore';

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
    const res = await FleetService.createFuelLog(
      {
        vehicleId: cmd.vehicleId,
        driverId: cmd.driverId,
        fuelType: cmd.fuelType,
        date: cmd.date,
        odometer: cmd.odometer,
        quantityLiters: cmd.quantityLiters,
        costPerLiter: cmd.costPerLiter,
        stationName: cmd.stationName,
      },
      cmd.userId
    );
    return res.fuelLog;
  }

  async issuePartsToMaintenanceOrder(
    cmd: IssuePartsCommand
  ): Promise<{ order: MaintenanceOrder; materialDocNumber: string }> {
    return await FleetService.issuePartsToMaintenanceOrder(
      cmd.orderId,
      cmd.parts.map((p, idx) => ({
        lineItem: p.lineItem || (idx + 1) * 10,
        materialCode: p.materialCode,
        materialName: p.materialName || p.materialCode,
        quantity: p.quantity,
        unit: p.unit || 'EA',
        unitPrice: p.unitPrice || 0,
        totalCost: p.totalCost || (p.quantity * (p.unitPrice || 0)),
        storageLocation: p.storageLocation || 'SL01',
      })),
      cmd.plantCode,
      cmd.userId
    );
  }

  async completeMaintenanceOrder(cmd: CompleteMaintenanceOrderCommand): Promise<MaintenanceOrder> {
    return await FleetService.completeMaintenanceOrder(
      cmd.orderId,
      {
        laborHours: cmd.laborHours,
        laborRatePerHour: cmd.laborRatePerHour,
        downtimeHours: cmd.downtimeHours,
        completionDate: cmd.completionDate,
      },
      cmd.userId
    );
  }

  async postJournal(cmd: PostJournalCommand): Promise<{ docNumber: string; jeId: string }> {
    const je = await FinanceService.createJournalEntry({
      companyCode: cmd.companyCode,
      fiscalYear: cmd.fiscalYear,
      period: cmd.period,
      postingDate: cmd.postingDate,
      documentDate: cmd.documentDate,
      documentType: cmd.documentType as import('../../types/models').SAPDocumentType,
      headerText: cmd.headerText,
      reference: cmd.reference,
      lines: cmd.lines,
      createdBy: cmd.userId || 'admin',
    });
    return { docNumber: je.docNumber, jeId: je.id };
  }

  async createVehicle(vehicle: Partial<Vehicle>): Promise<Vehicle> {
    return await FleetService.createVehicle(vehicle as Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted'>);
  }

  async updateVehicle(id: string, updates: Partial<Vehicle>): Promise<Vehicle> {
    return await FleetService.updateVehicle(id, updates);
  }

  async createDriver(driver: Partial<Driver>): Promise<Driver> {
    return await FleetService.createDriver(driver as Omit<Driver, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted'>);
  }

  async updateDriver(id: string, updates: Partial<Driver>): Promise<Driver> {
    return await FleetService.updateDriver(id, updates);
  }

  async createMaintenanceOrder(order: Partial<MaintenanceOrder>): Promise<MaintenanceOrder> {
    return await FleetService.createMaintenanceOrder(order as unknown as Parameters<typeof FleetService.createMaintenanceOrder>[0]);
  }

  async resolveFuelAnomalyAlert(id: string, notes: string): Promise<void> {
    return await FleetService.resolveFuelAnomalyAlert(id, notes);
  }

  // Fleet Queries
  async getVehicles(filters?: VehicleFilters): Promise<Vehicle[]> {
    return await FleetService.getVehicles(filters);
  }

  async getVehicleById(id: string): Promise<Vehicle | null> {
    return await FleetService.getVehicleById(id);
  }

  async getDrivers(filters?: DriverFilters): Promise<Driver[]> {
    return await FleetService.getDrivers(filters);
  }

  async getDriverById(id: string): Promise<Driver | null> {
    return await FleetService.getDriverById(id);
  }

  async getTrips(filters?: TripFilters): Promise<Trip[]> {
    return await FleetService.getTrips(filters);
  }

  async getTripById(id: string): Promise<Trip | null> {
    const trip = await db.trips.get(id);
    return trip ?? null;
  }

  async getFuelLogs(filtersOrVehicleId?: string | FuelLogFilters): Promise<FuelLog[]> {
    if (typeof filtersOrVehicleId === 'string') {
      return await FleetService.getFuelLogs(filtersOrVehicleId);
    }
    if (filtersOrVehicleId && typeof filtersOrVehicleId === 'object') {
      const res = await this.getPaginatedFuelLogs(filtersOrVehicleId);
      return res.data;
    }
    return await FleetService.getFuelLogs();
  }

  async getPaginatedFuelLogs(filters: FuelLogFilters): Promise<PaginatedResult<FuelLog>> {
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.max(1, Math.min(200, filters.pageSize || 25));

    let items = await db.fuelLogs.filter((f) => !f.isDeleted).toArray();

    if (filters.vehicleId) {
      items = items.filter((f) => f.vehicleId === filters.vehicleId);
    }
    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      items = items.filter(
        (f) =>
          f.vehiclePlate.toLowerCase().includes(q) ||
          f.driverName.toLowerCase().includes(q) ||
          f.stationName.toLowerCase().includes(q)
      );
    }
    if (filters.startDate) {
      items = items.filter((f) => f.date >= filters.startDate!);
    }
    if (filters.endDate) {
      items = items.filter((f) => f.date <= filters.endDate!);
    }

    const totalCount = items.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    items.sort((a, b) => b.date.localeCompare(a.date) || b.odometer - a.odometer);
    const offset = (page - 1) * pageSize;
    const data = items.slice(offset, offset + pageSize);

    return {
      data,
      totalCount,
      page,
      pageSize,
      totalPages,
    };
  }

  async getCostCenterFleetReconciliation(): Promise<CostCenterReconciliation[]> {
    const vehicles = await db.vehicles.filter((v) => !v.isDeleted).toArray();
    const plantCodes = Array.from(new Set(vehicles.map((v) => v.plantCode || '1100')));
    const result: CostCenterReconciliation[] = [];

    for (const plant of plantCodes) {
      const costCenter = `CC-${plant}`;
      const plantVehicles = vehicles.filter((v) => (v.plantCode || '1100') === plant);
      const vehicleIds = plantVehicles.map((v) => v.id);

      const fuelLogs = await db.fuelLogs.filter((f) => !f.isDeleted && vehicleIds.includes(f.vehicleId)).toArray();
      const totalFuel = fuelLogs.reduce((acc, curr) => acc + curr.totalCost, 0);

      const maintOrders = await db.maintenanceOrders.filter((m) => !m.isDeleted && m.status === 'completed' && vehicleIds.includes(m.vehicleId)).toArray();
      const totalMaintenance = maintOrders.reduce((acc, curr) => acc + curr.actualCost, 0);

      const trips = await db.trips.filter((t) => !t.isDeleted && t.status === 'completed' && vehicleIds.includes(t.vehicleId)).toArray();
      const totalAllowance = trips.reduce((acc, curr) => acc + (curr.driverAllowanceCost || 0), 0);

      const operationalTotalCost = totalFuel + totalMaintenance + totalAllowance;

      const journals = await db.journalEntries.filter((j) => j.status === 'posted').toArray();
      let journalTotalDebit = 0;
      for (const j of journals) {
        const lines = j.lines || [];
        for (const l of lines) {
          if (l.costCenter === costCenter && ['601010', '602010', '603010'].includes(l.accountNumber)) {
            journalTotalDebit += l.debit || 0;
          }
        }
      }

      result.push({
        costCenter,
        totalFuel,
        totalMaintenance,
        totalAllowance,
        operationalTotalCost,
        journalTotalDebit,
        variance: Math.round((operationalTotalCost - journalTotalDebit) * 100) / 100,
      });
    }

    return result;
  }

  async getMaintenanceOrders(filtersOrVehicleId?: string | MaintenanceFilters): Promise<MaintenanceOrder[]> {
    const vehicleId = typeof filtersOrVehicleId === 'string' ? filtersOrVehicleId : filtersOrVehicleId?.vehicleId;
    return await FleetService.getMaintenanceOrders(vehicleId);
  }

  async getMaintenanceOrderById(id: string): Promise<MaintenanceOrder | null> {
    const order = await db.maintenanceOrders.get(id);
    return order ?? null;
  }

  async getPreventiveSchedules(vehicleId?: string): Promise<PreventiveSchedule[]> {
    return await FleetService.getPreventiveSchedules(vehicleId);
  }

  async getFuelAnomalyAlerts(): Promise<FuelAnomalyAlert[]> {
    return await FleetService.getFuelAnomalyAlerts();
  }

  async getVehicleExpiryAlerts(): Promise<ExpiryAlert[]> {
    return await FleetService.getVehicleExpiryAlerts();
  }

  async getVehicleCostReport(vehicleId: string): Promise<VehicleCostReport> {
    return await FleetService.getVehicleCostReport(vehicleId);
  }

  async getFleetDashboardKPIs(): Promise<FleetSummaryKPIs> {
    return await FleetService.getFleetDashboardKPIs();
  }

  // Authentication in Local Mode
  async signIn(username: string, password: string): Promise<AuthSession> {
    return await AuthService.login(username, password);
  }

  async signOut(): Promise<void> {
    useAuthStore.getState().logout();
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    await AuthService.changePassword(userId, currentPassword, newPassword);
  }

  async restoreSession(): Promise<AuthSession | null> {
    const restored = await useAuthStore.getState().restoreSession();
    if (!restored) return null;
    const user = useAuthStore.getState().user;
    const role = useAuthStore.getState().role;
    const token = useAuthStore.getState().token;
    const expiresAt = useAuthStore.getState().expiresAt;
    if (user && role && token && expiresAt) {
      return { user, role, token, expiresAt };
    }
    return null;
  }

  // Realtime in Local Mode (no external websocket needed)
  subscribeFleet(
    tables: string[],
    onChange: RealtimeChangeCallback
  ): () => void {
    const interval = setInterval(() => {
      // In local mode, Dexie live queries handle component updates; this keeps contract active
      for (const t of tables) {
        onChange(t, 'UPDATE', {});
      }
    }, 30000);

    return () => clearInterval(interval);
  }
}
