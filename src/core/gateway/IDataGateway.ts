/**
 * Unified Data Gateway Interface for Gulf Energy ERP
 *
 * Implements the server-authoritative command pattern defined in ADR 0001.
 * In server mode, clients never compute document numbers, balances, or journals.
 * All mutations execute via authoritative command methods mapping 1:1 to SQL RPCs.
 */

import type {
  Vehicle,
  Driver,
  Trip,
  FuelLog,
  FuelAnomalyAlert,
  MaintenanceOrder,
  MaintenancePartItem,
  PreventiveSchedule,
} from '../../types/models';

export interface CreateTripParams {
  requestId: string;
  vehicleId: string;
  driverId: string;
  originPlant: string;
  destinationLocation: string;
  cargoType: string;
  cargoVolumeLiters: number;
  scheduledDeparture: string;
  scheduledArrival: string;
  startOdometer: number;
}

export interface CompleteTripParams {
  requestId: string;
  tripId: string;
  endOdometer: number;
  actualArrival?: string;
  fuelLitersConsumed?: number;
  fuelCost?: number;
  driverAllowanceCost?: number;
  expectedVersion?: number;
}

export interface CreateFuelLogParams {
  requestId: string;
  vehicleId: string;
  driverId: string;
  date: string;
  fuelType: 'Diesel' | 'Gasoline95' | 'Gasoline91';
  quantityLiters: number;
  costPerLiter: number;
  odometer: number;
  stationName: string;
  invoiceNumber?: string;
  plantCode?: string;
}

export interface IssuePartsParams {
  requestId: string;
  orderId: string;
  parts: MaintenancePartItem[];
  plantCode: string;
  expectedVersion?: number;
}

export interface CompleteMaintenanceOrderParams {
  requestId: string;
  orderId: string;
  laborHours: number;
  laborRatePerHour?: number;
  downtimeHours: number;
  completionDate: string;
  expectedVersion?: number;
}

export interface PostJournalLineParam {
  postingKey: string;
  accountNumber: string;
  accountName: string;
  debit: number;
  credit: number;
  costCenter?: string;
  lineText?: string;
}

export interface PostJournalParams {
  requestId: string;
  sourceType: string;
  sourceId: string;
  event: string;
  headerText: string;
  lines: PostJournalLineParam[];
  postingDate?: string;
  documentType?: string;
}

export interface IDataGateway {
  readonly isServerMode: boolean;

  // --- Fleet Query Methods (Reads) ---
  getVehicles(): Promise<Vehicle[]>;
  getVehicleById(id: string): Promise<Vehicle | null>;
  getDrivers(): Promise<Driver[]>;
  getDriverById(id: string): Promise<Driver | null>;
  getTrips(filters?: { status?: string | 'ALL'; vehicleId?: string }): Promise<Trip[]>;
  getTripById(id: string): Promise<Trip | null>;
  getFuelLogs(vehicleId?: string): Promise<FuelLog[]>;
  getMaintenanceOrders(vehicleId?: string): Promise<MaintenanceOrder[]>;
  getMaintenanceOrderById(id: string): Promise<MaintenanceOrder | null>;
  getPreventiveSchedules(vehicleId?: string): Promise<PreventiveSchedule[]>;

  // Master Data Mutators (with OCC expectedVersion)
  createVehicle(data: Omit<Vehicle, 'id' | 'isDeleted'>, userId?: string): Promise<Vehicle>;
  updateVehicle(id: string, updates: Partial<Vehicle>, userId?: string, expectedVersion?: number): Promise<Vehicle>;
  createDriver(data: Omit<Driver, 'id' | 'isDeleted'>, userId?: string): Promise<Driver>;
  updateDriver(id: string, updates: Partial<Driver>, userId?: string, expectedVersion?: number): Promise<Driver>;
  createMaintenanceOrder(data: Omit<MaintenanceOrder, 'id' | 'docNumber' | 'isDeleted'>, userId?: string): Promise<MaintenanceOrder>;

  // --- 6 Authoritative Command RPCs (1:1 with PostgreSQL Functions) ---
  createTrip(params: CreateTripParams, userId?: string): Promise<Trip>;
  completeTrip(params: CompleteTripParams, userId?: string): Promise<Trip>;
  createFuelLog(params: CreateFuelLogParams, userId?: string): Promise<{ fuelLog: FuelLog; anomalyAlert?: FuelAnomalyAlert }>;
  issuePartsToMaintenanceOrder(params: IssuePartsParams, userId?: string): Promise<{ order: MaintenanceOrder; materialDocNumber: string }>;
  completeMaintenanceOrder(params: CompleteMaintenanceOrderParams, userId?: string): Promise<MaintenanceOrder>;
  postJournal(params: PostJournalParams, userId?: string): Promise<{ success: boolean; docNumber: string; isDuplicate?: boolean }>;
}
