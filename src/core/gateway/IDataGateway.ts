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
  driverId?: string;
  liters: number;
  cost: number;
  fuelType: string;
  vendorName: string;
  invoiceNumber?: string;
  currentOdometer: number;
  odometer?: number;
  stationLocation?: string;
  date?: string;
  occurredAt?: string;
  userId?: string;
  requestId?: string;
  expectedVersion?: number;
}

export interface IssuePartsCommand {
  orderId: string;
  items: Array<{
    materialCode: string;
    plantCode: string;
    storageLocationCode: string;
    quantity: number;
  }>;
  userId?: string;
  requestId?: string;
  expectedVersion?: number;
}

export interface CompleteMaintenanceOrderCommand {
  orderId: string;
  actualLaborHours?: number;
  actualLaborCost?: number;
  downtimeHours?: number;
  notes?: string;
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

export interface RecordTripEventCommand {
  requestId: string;
  tripId: string;
  vehicleId: string;
  eventType: 'departed' | 'arrived' | 'delayed' | 'incident';
  occurredAt: string;
  payload?: Record<string, unknown>;
}

export interface RecordOdometerReadingCommand {
  requestId: string;
  vehicleId: string;
  readingKm: number;
  capturedAt: string;
  source?: string;
}

export interface RecordInspectionCommand {
  requestId: string;
  vehicleId: string;
  inspectedAt: string;
  result: 'pass' | 'fail' | 'warning';
  notes?: string;
  checklist?: Record<string, unknown>;
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
  startDate?: string;
  endDate?: string;
}

export interface FuelLogFilters {
  vehicleId?: string;
  driverId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface MaintenanceFilters {
  vehicleId?: string;
  status?: string;
  orderType?: string;
  startDate?: string;
  endDate?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CostCenterReconciliation {
  costCenter: string;
  totalFuel: number;
  totalMaintenance: number;
  totalAllowance: number;
  operationalTotalCost: number;
  journalTotalDebit: number;
  variance: number;
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

  // Field & Operational Telemetry RPCs
  recordTripEvent(cmd: RecordTripEventCommand): Promise<{ requestId: string; tripId: string; eventType: string }>;
  recordOdometerReading(cmd: RecordOdometerReadingCommand): Promise<{ requestId: string; vehicleId: string; readingKm: number }>;
  recordInspection(cmd: RecordInspectionCommand): Promise<{ requestId: string; vehicleId: string; result: string }>;

  // Master Data Commands (Vehicles & Drivers)
  createVehicle?(vehicle: Partial<Vehicle>, requestId?: string): Promise<Vehicle>;
  updateVehicle?(id: string, updates: Partial<Vehicle>, expectedVersion?: number, requestId?: string): Promise<Vehicle>;
  setVehicleActive?(id: string, isActive: boolean, expectedVersion?: number, requestId?: string): Promise<Vehicle>;
  createDriver?(driver: Partial<Driver>, requestId?: string): Promise<Driver>;
  updateDriver?(id: string, updates: Partial<Driver>, expectedVersion?: number, requestId?: string): Promise<Driver>;
  setDriverActive?(id: string, isActive: boolean, expectedVersion?: number, requestId?: string): Promise<Driver>;
  createMaintenanceOrder?(order: Partial<MaintenanceOrder>): Promise<MaintenanceOrder>;
  resolveFuelAnomalyAlert?(
    id: string,
    notes?: string,
    expectedVersion?: number,
    requestId?: string
  ): Promise<void>;

  // Fleet Query Methods
  getVehicles(filters?: VehicleFilters): Promise<Vehicle[]>;
  getVehicleById(id: string): Promise<Vehicle | null>;
  getDrivers(filters?: DriverFilters): Promise<Driver[]>;
  getDriverById(id: string): Promise<Driver | null>;
  getTrips(filters?: TripFilters): Promise<Trip[]>;
  getTripById(id: string): Promise<Trip | null>;
  getFuelLogs(filtersOrVehicleId?: string | FuelLogFilters): Promise<FuelLog[]>;
  getPaginatedFuelLogs?(filters: FuelLogFilters): Promise<PaginatedResult<FuelLog>>;
  getMaintenanceOrders(filtersOrVehicleId?: string | MaintenanceFilters): Promise<MaintenanceOrder[]>;
  getMaintenanceOrderById(id: string): Promise<MaintenanceOrder | null>;
  getPreventiveSchedules(vehicleId?: string): Promise<PreventiveSchedule[]>;
  getFuelAnomalyAlerts(): Promise<FuelAnomalyAlert[]>;
  getVehicleExpiryAlerts(): Promise<ExpiryAlert[]>;
  getVehicleCostReport(vehicleId: string): Promise<VehicleCostReport>;
  getCostCenterFleetReconciliation?(): Promise<CostCenterReconciliation[]>;
  getFleetDashboardKPIs(): Promise<FleetSummaryKPIs>;

  // Realtime Subscriptions
  subscribeFleet(
    tables: string[],
    onChange: RealtimeChangeCallback
  ): () => void;
}
