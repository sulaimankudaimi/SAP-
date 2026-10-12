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
import type { AuthSession } from '../services/AuthService';

export interface CreateTripCommand {
  vehicleId: string;
  driverId: string;
  originPlant: string;
  destinationLocation: string;
  cargoType: string;
  cargoVolumeLiters: number;
  scheduledDeparture: string;
  scheduledArrival: string;
  startOdometer: number;
  userId?: string;
  requestId?: string;
  expectedVersion?: number;
}

export interface CompleteTripCommand {
  tripId: string;
  endOdometer: number;
  fuelLitersConsumed?: number;
  fuelCost?: number;
  driverAllowanceCost?: number;
  actualArrival?: string;
  userId?: string;
  requestId?: string;
  expectedVersion?: number;
}

export interface CreateFuelLogCommand {
  vehicleId: string;
  driverId: string;
  fuelType: 'Diesel' | 'Gasoline95' | 'Gasoline91';
  date: string;
  odometer: number;
  quantityLiters: number;
  costPerLiter: number;
  stationName: string;
  userId?: string;
  requestId?: string;
  expectedVersion?: number;
}

export interface IssuePartsCommand {
  orderId: string;
  plantCode: string;
  parts: Array<{
    lineItem?: number;
    materialCode: string;
    materialName?: string;
    quantity: number;
    unit?: string;
    unitPrice?: number;
    totalCost?: number;
    storageLocation?: string;
    costCenter?: string;
  }>;
  userId?: string;
  requestId?: string;
  expectedVersion?: number;
}

export interface CompleteMaintenanceOrderCommand {
  orderId: string;
  laborHours: number;
  laborRatePerHour?: number;
  downtimeHours: number;
  completionDate: string;
  userId?: string;
  requestId?: string;
  expectedVersion?: number;
}

export interface PostJournalCommand {
  sourceType: string;
  sourceId: string;
  companyCode: string;
  fiscalYear: string;
  period: number;
  postingDate: string;
  documentDate: string;
  documentType: string;
  headerText: string;
  reference?: string;
  lines: Array<{
    accountNumber: string;
    accountName: string;
    debit: number;
    credit: number;
    costCenter?: string;
    lineText?: string;
  }>;
  userId?: string;
  requestId?: string;
  expectedVersion?: number;
}

export interface VehicleFilters {
  status?: string;
  vehicleType?: string;
  assignedPlant?: string;
  search?: string;
}

export interface DriverFilters {
  status?: string;
  assignedPlant?: string;
  search?: string;
}

export interface TripFilters {
  status?: string;
  vehicleId?: string;
  driverId?: string;
  originPlant?: string;
}

export interface MaintenanceFilters {
  vehicleId?: string;
  status?: string;
  orderType?: string;
}

export type RealtimeChangeCallback = (
  table: string,
  event: 'INSERT' | 'UPDATE' | 'DELETE',
  payload: Record<string, unknown>
) => void;

export interface IDataGateway {
  readonly mode: 'local' | 'server';

  // Command Methods (1:1 with Server SQL RPCs)
  createTrip(cmd: CreateTripCommand): Promise<Trip>;
  completeTrip(cmd: CompleteTripCommand): Promise<Trip>;
  createFuelLog(cmd: CreateFuelLogCommand): Promise<FuelLog>;
  issuePartsToMaintenanceOrder(cmd: IssuePartsCommand): Promise<{ order: MaintenanceOrder; materialDocNumber: string }>;
  completeMaintenanceOrder(cmd: CompleteMaintenanceOrderCommand): Promise<MaintenanceOrder>;
  postJournal(cmd: PostJournalCommand): Promise<{ docNumber: string; jeId: string }>;

  // Additional Fleet Commands (Vehicles, Drivers, Orders)
  createVehicle?(vehicle: Partial<Vehicle>): Promise<Vehicle>;
  updateVehicle?(id: string, updates: Partial<Vehicle>, expectedVersion?: number): Promise<Vehicle>;
  createDriver?(driver: Partial<Driver>): Promise<Driver>;
  updateDriver?(id: string, updates: Partial<Driver>, expectedVersion?: number): Promise<Driver>;
  createMaintenanceOrder?(order: Partial<MaintenanceOrder>): Promise<MaintenanceOrder>;
  resolveFuelAnomalyAlert?(id: string, notes: string): Promise<void>;

  // Fleet Query Methods
  getVehicles(filters?: VehicleFilters): Promise<Vehicle[]>;
  getVehicleById(id: string): Promise<Vehicle | null>;
  getDrivers(filters?: DriverFilters): Promise<Driver[]>;
  getDriverById(id: string): Promise<Driver | null>;
  getTrips(filters?: TripFilters): Promise<Trip[]>;
  getTripById(id: string): Promise<Trip | null>;
  getFuelLogs(vehicleId?: string): Promise<FuelLog[]>;
  getMaintenanceOrders(filtersOrVehicleId?: string | MaintenanceFilters): Promise<MaintenanceOrder[]>;
  getMaintenanceOrderById(id: string): Promise<MaintenanceOrder | null>;
  getPreventiveSchedules(vehicleId?: string): Promise<PreventiveSchedule[]>;
  getFuelAnomalyAlerts(): Promise<FuelAnomalyAlert[]>;
  getVehicleExpiryAlerts(): Promise<ExpiryAlert[]>;
  getVehicleCostReport(vehicleId: string): Promise<VehicleCostReport>;
  getFleetDashboardKPIs(): Promise<FleetSummaryKPIs>;

  // Authentication
  signIn(username: string, password: string): Promise<AuthSession>;
  signOut(): Promise<void>;
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
  restoreSession(): Promise<AuthSession | null>;

  // Realtime Subscriptions
  subscribeFleet(
    tables: string[],
    onChange: RealtimeChangeCallback
  ): () => void;
}
