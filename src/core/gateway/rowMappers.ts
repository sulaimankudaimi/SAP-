/**
 * Server Row Mappers for Gulf Energy ERP
 *
 * Provides bidirectional translation between snake_case PostgREST SQL rows / RPC JSON
 * and camelCase strictly typed TypeScript models.
 *
 * Each entity possesses a field mapping table checked at compile-time with:
 * `satisfies EntityFieldMapping<T>`
 * This guarantees that adding a field to any TypeScript model without mapping it
 * fails `tsc --noEmit`. Fields with no database column are explicitly declared with a reason.
 */

import type {
  Vehicle,
  Driver,
  Trip,
  FuelLog,
  MaintenanceOrder,
  PreventiveSchedule,
  FuelAnomalyAlert,
  ExpiryAlert,
  VehicleCostReport,
  FleetSummaryKPIs,
} from '../../types/models';
import type { CostCenterReconciliation } from './IDataGateway';

export type FieldSource =
  | { readonly kind: 'column'; readonly column: string }
  | { readonly kind: 'no_column'; readonly reason: string };

export type EntityFieldMapping<T> = Record<keyof T, FieldSource>;

// ----------------------------------------------------------------------------
// Safe Coercion Helpers
// ----------------------------------------------------------------------------

export function coerceNumber(val: unknown, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  const num = Number(val);
  return Number.isNaN(num) ? fallback : num;
}

export function coerceBoolean(val: unknown, fallback = false): boolean {
  if (typeof val === 'boolean') return val;
  if (val === 't' || val === 'true' || val === 1 || val === '1') return true;
  if (val === 'f' || val === 'false' || val === 0 || val === '0') return false;
  return fallback;
}

export function coerceString(val: unknown, fallback = ''): string {
  if (val === null || val === undefined) return fallback;
  return String(val);
}

export function coerceIsoDate(val: unknown, fallback?: string): string {
  if (!val) return fallback || '';
  const str = String(val);
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? str : d.toISOString();
}

// ----------------------------------------------------------------------------
// 1. Vehicle Field Mapping & Mapper
// ----------------------------------------------------------------------------

export const VEHICLE_FIELD_MAP = {
  id: { kind: 'column', column: 'id' },
  code: { kind: 'column', column: 'code' },
  plateNumber: { kind: 'column', column: 'plate_number' },
  vin: { kind: 'column', column: 'vin' },
  type: { kind: 'column', column: 'type' },
  fuelType: { kind: 'column', column: 'fuel_type' },
  capacityLiters: { kind: 'column', column: 'capacity_liters' },
  capacityTons: { kind: 'no_column', reason: 'Derived in UI from capacityLiters' },
  makeModel: { kind: 'column', column: 'make_model' },
  year: { kind: 'column', column: 'year' },
  currentOdometer: { kind: 'column', column: 'current_odometer' },
  status: { kind: 'column', column: 'status' },
  assignedDriverId: { kind: 'column', column: 'assigned_driver_id' },
  assignedDriverName: { kind: 'no_column', reason: 'Populated in UI via driver lookup' },
  plantCode: { kind: 'column', column: 'plant_code' },
  assignedPlant: { kind: 'column', column: 'plant_code' },
  costCenter: { kind: 'column', column: 'cost_center' },
  safetyInspectionExpiry: { kind: 'no_column', reason: 'Optional client field' },
  maintenanceDueOdometer: { kind: 'no_column', reason: 'Derived from preventive_schedules' },
  maintenanceDueDate: { kind: 'no_column', reason: 'Derived from preventive_schedules' },
  insuranceExpiry: { kind: 'column', column: 'insurance_expiry' },
  registrationExpiry: { kind: 'column', column: 'registration_expiry' },
  lastMaintenanceDate: { kind: 'no_column', reason: 'Derived from maintenance_orders' },
  nextMaintenanceOdometer: { kind: 'no_column', reason: 'Derived from preventive_schedules' },
  version: { kind: 'column', column: 'version' },
  createdAt: { kind: 'column', column: 'created_at' },
  updatedAt: { kind: 'column', column: 'updated_at' },
  isDeleted: { kind: 'column', column: 'is_deleted' },
} as const satisfies EntityFieldMapping<Vehicle>;

export function mapVehicleRow(row: Record<string, unknown>): Vehicle {
  return {
    id: coerceString(row.id),
    code: coerceString(row.code),
    plateNumber: coerceString(row.plate_number ?? row.plateNumber),
    vin: coerceString(row.vin),
    type: (row.type as Vehicle['type']) || 'HeavyTruck',
    fuelType: (row.fuel_type as Vehicle['fuelType']) || 'Diesel',
    capacityLiters: coerceNumber(row.capacity_liters ?? row.capacityLiters),
    capacityTons: row.capacity_tons ? coerceNumber(row.capacity_tons) : undefined,
    makeModel: coerceString(row.make_model ?? row.makeModel),
    year: coerceNumber(row.year),
    currentOdometer: coerceNumber(row.current_odometer ?? row.currentOdometer),
    status: (row.status as Vehicle['status']) || 'available',
    assignedDriverId: row.assigned_driver_id ? coerceString(row.assigned_driver_id) : undefined,
    assignedDriverName: row.assigned_driver_name ? coerceString(row.assigned_driver_name) : undefined,
    plantCode: coerceString(row.plant_code ?? row.plantCode),
    assignedPlant: coerceString(row.plant_code ?? row.assignedPlant),
    costCenter: row.cost_center ? coerceString(row.cost_center) : undefined,
    safetyInspectionExpiry: row.safety_inspection_expiry ? coerceIsoDate(row.safety_inspection_expiry) : undefined,
    maintenanceDueOdometer: row.maintenance_due_odometer ? coerceNumber(row.maintenance_due_odometer) : undefined,
    maintenanceDueDate: row.maintenance_due_date ? coerceIsoDate(row.maintenance_due_date) : undefined,
    insuranceExpiry: coerceIsoDate(row.insurance_expiry ?? row.insuranceExpiry),
    registrationExpiry: coerceIsoDate(row.registration_expiry ?? row.registrationExpiry),
    lastMaintenanceDate: row.last_maintenance_date ? coerceIsoDate(row.last_maintenance_date) : undefined,
    nextMaintenanceOdometer: row.next_maintenance_odometer ? coerceNumber(row.next_maintenance_odometer) : undefined,
    version: coerceNumber(row.version, 1),
    createdAt: row.created_at ? coerceIsoDate(row.created_at) : undefined,
    updatedAt: row.updated_at ? coerceIsoDate(row.updated_at) : undefined,
    isDeleted: coerceBoolean(row.is_deleted, false),
  };
}

// ----------------------------------------------------------------------------
// 2. Driver Field Mapping & Mapper
// ----------------------------------------------------------------------------

export const DRIVER_FIELD_MAP = {
  id: { kind: 'column', column: 'id' },
  code: { kind: 'column', column: 'code' },
  name: { kind: 'column', column: 'name' },
  iqamaNumber: { kind: 'column', column: 'iqama_number' },
  licenseNumber: { kind: 'column', column: 'license_number' },
  licenseClass: { kind: 'column', column: 'license_class' },
  licenseExpiry: { kind: 'column', column: 'license_expiry' },
  mobile: { kind: 'column', column: 'mobile' },
  safetyRating: { kind: 'column', column: 'safety_rating' },
  performanceScore: { kind: 'no_column', reason: 'Derived score computed client-side' },
  certifications: { kind: 'no_column', reason: 'HazMat certification stored in license_class' },
  status: { kind: 'column', column: 'status' },
  assignedPlant: { kind: 'column', column: 'plant_code' },
  plantCode: { kind: 'column', column: 'plant_code' },
  totalTripsCompleted: { kind: 'column', column: 'total_trips_completed' },
  totalDistanceKm: { kind: 'column', column: 'total_distance_km' },
  version: { kind: 'column', column: 'version' },
  createdAt: { kind: 'column', column: 'created_at' },
  updatedAt: { kind: 'column', column: 'updated_at' },
  isDeleted: { kind: 'column', column: 'is_deleted' },
} as const satisfies EntityFieldMapping<Driver>;

export function mapDriverRow(row: Record<string, unknown>): Driver {
  return {
    id: coerceString(row.id),
    code: coerceString(row.code),
    name: coerceString(row.name),
    iqamaNumber: coerceString(row.iqama_number ?? row.iqamaNumber),
    licenseNumber: coerceString(row.license_number ?? row.licenseNumber),
    licenseClass: (row.license_class as Driver['licenseClass']) || 'عمومي ثقيل',
    licenseExpiry: coerceIsoDate(row.license_expiry ?? row.licenseExpiry),
    mobile: coerceString(row.mobile),
    safetyRating: coerceNumber(row.safety_rating ?? row.safetyRating, 5.0),
    performanceScore: row.performance_score ? coerceNumber(row.performance_score) : undefined,
    certifications: Array.isArray(row.certifications) ? (row.certifications as string[]) : undefined,
    status: (row.status as Driver['status']) || 'available',
    assignedPlant: coerceString(row.plant_code ?? row.assignedPlant),
    plantCode: coerceString(row.plant_code ?? row.plantCode),
    totalTripsCompleted: coerceNumber(row.total_trips_completed ?? row.totalTripsCompleted, 0),
    totalDistanceKm: coerceNumber(row.total_distance_km ?? row.totalDistanceKm, 0),
    version: coerceNumber(row.version, 1),
    createdAt: row.created_at ? coerceIsoDate(row.created_at) : undefined,
    updatedAt: row.updated_at ? coerceIsoDate(row.updated_at) : undefined,
    isDeleted: coerceBoolean(row.is_deleted, false),
  };
}

// ----------------------------------------------------------------------------
// 3. Trip Field Mapping & Mapper
// ----------------------------------------------------------------------------

export const TRIP_FIELD_MAP = {
  id: { kind: 'column', column: 'id' },
  docNumber: { kind: 'column', column: 'doc_number' },
  status: { kind: 'column', column: 'status' },
  vehicleId: { kind: 'column', column: 'vehicle_id' },
  vehiclePlate: { kind: 'no_column', reason: 'Joined in UI or local state' },
  driverId: { kind: 'column', column: 'driver_id' },
  driverName: { kind: 'no_column', reason: 'Joined in UI or local state' },
  originPlant: { kind: 'column', column: 'origin_plant' },
  destinationLocation: { kind: 'column', column: 'destination_location' },
  cargoType: { kind: 'column', column: 'cargo_type' },
  cargoVolumeLiters: { kind: 'column', column: 'cargo_volume_liters' },
  scheduledDeparture: { kind: 'column', column: 'scheduled_departure' },
  scheduledArrival: { kind: 'column', column: 'scheduled_arrival' },
  actualDeparture: { kind: 'column', column: 'actual_departure' },
  actualArrival: { kind: 'column', column: 'actual_arrival' },
  startOdometer: { kind: 'column', column: 'start_odometer' },
  endOdometer: { kind: 'column', column: 'end_odometer' },
  distanceKm: { kind: 'column', column: 'distance_km' },
  delayMinutes: { kind: 'column', column: 'delay_minutes' },
  delayReason: { kind: 'column', column: 'cancellation_reason' },
  fuelLitersConsumed: { kind: 'column', column: 'fuel_liters_consumed' },
  fuelCost: { kind: 'column', column: 'fuel_cost' },
  driverAllowanceCost: { kind: 'column', column: 'driver_allowance_cost' },
  totalTripCost: { kind: 'column', column: 'total_trip_cost' },
  postedAccountingDocNumber: { kind: 'column', column: 'je_doc_number' },
  createdAt: { kind: 'column', column: 'created_at' },
  createdBy: { kind: 'column', column: 'created_by' },
  updatedAt: { kind: 'column', column: 'updated_at' },
  updatedBy: { kind: 'no_column', reason: 'Not tracked separately on trips' },
  version: { kind: 'column', column: 'version' },
  isDeleted: { kind: 'no_column', reason: 'Trips are immutable operational documents' },
} as const satisfies EntityFieldMapping<Trip>;

export function mapTripRow(row: Record<string, unknown>): Trip {
  return {
    id: coerceString(row.id),
    docNumber: coerceString(row.doc_number ?? row.docNumber),
    status: (row.status as Trip['status']) || 'scheduled',
    vehicleId: coerceString(row.vehicle_id ?? row.vehicleId),
    vehiclePlate: coerceString(row.vehicle_plate ?? row.vehiclePlate),
    driverId: coerceString(row.driver_id ?? row.driverId),
    driverName: coerceString(row.driver_name ?? row.driverName),
    originPlant: coerceString(row.origin_plant ?? row.originPlant),
    destinationLocation: coerceString(row.destination_location ?? row.destinationLocation),
    cargoType: coerceString(row.cargo_type ?? row.cargoType),
    cargoVolumeLiters: coerceNumber(row.cargo_volume_liters ?? row.cargoVolumeLiters),
    scheduledDeparture: coerceIsoDate(row.scheduled_departure ?? row.scheduledDeparture),
    scheduledArrival: coerceIsoDate(row.scheduled_arrival ?? row.scheduledArrival),
    actualDeparture: row.actual_departure ? coerceIsoDate(row.actual_departure) : undefined,
    actualArrival: row.actual_arrival ? coerceIsoDate(row.actual_arrival) : undefined,
    startOdometer: coerceNumber(row.start_odometer ?? row.startOdometer),
    endOdometer: row.end_odometer !== undefined && row.end_odometer !== null ? coerceNumber(row.end_odometer) : undefined,
    distanceKm: row.distance_km !== undefined && row.distance_km !== null ? coerceNumber(row.distance_km) : undefined,
    delayMinutes: row.delay_minutes ? coerceNumber(row.delay_minutes) : undefined,
    delayReason: row.cancellation_reason ? coerceString(row.cancellation_reason) : undefined,
    fuelLitersConsumed: row.fuel_liters_consumed ? coerceNumber(row.fuel_liters_consumed) : undefined,
    fuelCost: row.fuel_cost ? coerceNumber(row.fuel_cost) : undefined,
    driverAllowanceCost: row.driver_allowance_cost ? coerceNumber(row.driver_allowance_cost) : undefined,
    totalTripCost: row.total_trip_cost ? coerceNumber(row.total_trip_cost) : undefined,
    postedAccountingDocNumber: row.je_doc_number ? coerceString(row.je_doc_number) : undefined,
    createdAt: coerceIsoDate(row.created_at ?? row.createdAt),
    createdBy: coerceString(row.created_by ?? row.createdBy),
    updatedAt: coerceIsoDate(row.updated_at ?? row.updatedAt),
    updatedBy: coerceString(row.updated_by ?? row.updatedBy, 'system'),
    version: coerceNumber(row.version, 1),
    isDeleted: false,
  };
}

// ----------------------------------------------------------------------------
// 4. FuelLog Field Mapping & Mapper
// ----------------------------------------------------------------------------

export const FUEL_LOG_FIELD_MAP = {
  id: { kind: 'column', column: 'id' },
  docNumber: { kind: 'column', column: 'doc_number' },
  vehicleId: { kind: 'column', column: 'vehicle_id' },
  vehiclePlate: { kind: 'no_column', reason: 'Joined in UI or local state' },
  driverId: { kind: 'column', column: 'driver_id' },
  driverName: { kind: 'no_column', reason: 'Joined in UI or local state' },
  date: { kind: 'column', column: 'logged_at' },
  fuelType: { kind: 'column', column: 'fuel_type' },
  quantityLiters: { kind: 'column', column: 'liters' },
  costPerLiter: { kind: 'column', column: 'unit_price' },
  totalCost: { kind: 'column', column: 'total_cost' },
  odometer: { kind: 'column', column: 'odometer' },
  stationName: { kind: 'column', column: 'station_name' },
  calculatedConsumptionPer100Km: { kind: 'no_column', reason: 'Calculated in query or anomaly trigger' },
  isAnomaly: { kind: 'column', column: 'is_anomaly' },
  anomalyDeviationPercentage: { kind: 'no_column', reason: 'Stored in fuel_anomaly_alerts' },
  status: { kind: 'no_column', reason: 'Logs are immutable' },
  postedAccountingDocNumber: { kind: 'column', column: 'je_doc_number' },
  createdBy: { kind: 'column', column: 'created_by' },
  createdAt: { kind: 'column', column: 'created_at' },
  isDeleted: { kind: 'no_column', reason: 'Fuel logs are immutable documents' },
} as const satisfies EntityFieldMapping<FuelLog>;

export function mapFuelLogRow(row: Record<string, unknown>): FuelLog {
  const liters = coerceNumber(row.liters ?? row.quantityLiters);
  const totalCost = coerceNumber(row.total_cost ?? row.totalCost);
  const unitPrice = row.unit_price ? coerceNumber(row.unit_price) : (liters > 0 ? totalCost / liters : 0);

  return {
    id: coerceString(row.id),
    docNumber: row.doc_number ? coerceString(row.doc_number) : undefined,
    vehicleId: coerceString(row.vehicle_id ?? row.vehicleId),
    vehiclePlate: coerceString(row.vehicle_plate ?? row.vehiclePlate),
    driverId: coerceString(row.driver_id ?? row.driverId),
    driverName: coerceString(row.driver_name ?? row.driverName),
    date: coerceIsoDate(row.logged_at ?? row.date),
    fuelType: (row.fuel_type as FuelLog['fuelType']) || 'Diesel',
    quantityLiters: liters,
    costPerLiter: unitPrice,
    totalCost,
    odometer: coerceNumber(row.odometer),
    stationName: coerceString(row.station_name ?? row.stationName),
    calculatedConsumptionPer100Km: row.calculated_consumption ? coerceNumber(row.calculated_consumption) : undefined,
    isAnomaly: coerceBoolean(row.is_anomaly ?? row.isAnomaly, false),
    postedAccountingDocNumber: row.je_doc_number ? coerceString(row.je_doc_number) : undefined,
    createdBy: row.created_by ? coerceString(row.created_by) : undefined,
    createdAt: row.created_at ? coerceIsoDate(row.created_at) : undefined,
    isDeleted: false,
  };
}

// ----------------------------------------------------------------------------
// 5. MaintenanceOrder Field Mapping & Mapper
// ----------------------------------------------------------------------------

export const MAINTENANCE_ORDER_FIELD_MAP = {
  id: { kind: 'column', column: 'id' },
  docNumber: { kind: 'column', column: 'doc_number' },
  status: { kind: 'column', column: 'status' },
  vehicleId: { kind: 'column', column: 'vehicle_id' },
  vehiclePlate: { kind: 'column', column: 'vehicle_plate' },
  orderType: { kind: 'column', column: 'order_type' },
  description: { kind: 'column', column: 'description' },
  faultReported: { kind: 'column', column: 'fault_reported' },
  estimatedCost: { kind: 'column', column: 'estimated_cost' },
  actualCost: { kind: 'column', column: 'actual_cost' },
  partsCost: { kind: 'column', column: 'parts_cost' },
  laborCost: { kind: 'column', column: 'labor_cost' },
  laborHours: { kind: 'column', column: 'labor_hours' },
  startDate: { kind: 'column', column: 'start_date' },
  completionDate: { kind: 'column', column: 'completion_date' },
  downtimeHours: { kind: 'column', column: 'downtime_hours' },
  partsUsed: { kind: 'no_column', reason: 'Parts tracked via material_documents' },
  materialDocNumber: { kind: 'no_column', reason: 'Linked via material_documents' },
  preventiveScheduleId: { kind: 'column', column: 'preventive_schedule_id' },
  createdAt: { kind: 'column', column: 'created_at' },
  createdBy: { kind: 'column', column: 'created_by' },
  updatedAt: { kind: 'column', column: 'updated_at' },
  updatedBy: { kind: 'no_column', reason: 'Not tracked separately on orders' },
  version: { kind: 'column', column: 'version' },
  isDeleted: { kind: 'no_column', reason: 'Maintenance orders are immutable documents' },
} as const satisfies EntityFieldMapping<MaintenanceOrder>;

export function mapMaintenanceOrderRow(row: Record<string, unknown>): MaintenanceOrder {
  return {
    id: coerceString(row.id),
    docNumber: coerceString(row.doc_number ?? row.docNumber),
    status: (row.status as MaintenanceOrder['status']) || 'in_progress',
    vehicleId: coerceString(row.vehicle_id ?? row.vehicleId),
    vehiclePlate: coerceString(row.vehicle_plate ?? row.vehiclePlate),
    orderType: (row.order_type as MaintenanceOrder['orderType']) || 'Preventive',
    description: coerceString(row.description),
    faultReported: row.fault_reported ? coerceString(row.fault_reported) : undefined,
    estimatedCost: coerceNumber(row.estimated_cost ?? row.estimatedCost),
    actualCost: coerceNumber(row.actual_cost ?? row.actualCost),
    partsCost: coerceNumber(row.parts_cost ?? row.partsCost),
    laborCost: coerceNumber(row.labor_cost ?? row.laborCost),
    laborHours: coerceNumber(row.labor_hours ?? row.laborHours),
    startDate: coerceIsoDate(row.start_date ?? row.startDate),
    completionDate: row.completion_date ? coerceIsoDate(row.completion_date) : undefined,
    downtimeHours: coerceNumber(row.downtime_hours ?? row.downtimeHours),
    partsUsed: [],
    materialDocNumber: row.material_doc_number ? coerceString(row.material_doc_number) : undefined,
    preventiveScheduleId: row.preventive_schedule_id ? coerceString(row.preventive_schedule_id) : undefined,
    createdAt: coerceIsoDate(row.created_at ?? row.createdAt),
    createdBy: coerceString(row.created_by ?? row.createdBy),
    updatedAt: coerceIsoDate(row.updated_at ?? row.updatedAt),
    updatedBy: coerceString(row.updated_by ?? row.updatedBy, 'system'),
    version: coerceNumber(row.version, 1),
    isDeleted: false,
  };
}

// ----------------------------------------------------------------------------
// 6. PreventiveSchedule Field Mapping & Mapper
// ----------------------------------------------------------------------------

export const PREVENTIVE_SCHEDULE_FIELD_MAP = {
  id: { kind: 'column', column: 'id' },
  vehicleId: { kind: 'column', column: 'vehicle_id' },
  vehiclePlate: { kind: 'no_column', reason: 'Derived from vehicle relation' },
  serviceName: { kind: 'column', column: 'title' },
  intervalKm: { kind: 'column', column: 'interval_km' },
  intervalDays: { kind: 'column', column: 'interval_days' },
  lastDoneOdometer: { kind: 'column', column: 'last_performed_odometer' },
  lastDoneDate: { kind: 'column', column: 'last_performed_date' },
  nextDueOdometer: { kind: 'column', column: 'next_due_odometer' },
  nextDueDate: { kind: 'column', column: 'next_due_date' },
  status: { kind: 'column', column: 'status' },
  isDeleted: { kind: 'no_column', reason: 'Filtered by status' },
} as const satisfies EntityFieldMapping<PreventiveSchedule>;

export function mapPreventiveScheduleRow(row: Record<string, unknown>): PreventiveSchedule {
  let mappedStatus: PreventiveSchedule['status'] = 'due';
  const rawStatus = String(row.status || '').toLowerCase();
  if (rawStatus === 'active') mappedStatus = 'due';
  else if (rawStatus === 'soon') mappedStatus = 'soon';
  else if (rawStatus === 'completed') mappedStatus = 'completed';

  return {
    id: coerceString(row.id),
    vehicleId: coerceString(row.vehicle_id ?? row.vehicleId),
    vehiclePlate: coerceString(row.vehicle_plate ?? row.vehiclePlate),
    serviceName: coerceString(row.title ?? row.serviceName),
    intervalKm: coerceNumber(row.interval_km ?? row.intervalKm),
    intervalDays: coerceNumber(row.interval_days ?? row.intervalDays),
    lastDoneOdometer: coerceNumber(row.last_performed_odometer ?? row.lastDoneOdometer),
    lastDoneDate: coerceIsoDate(row.last_performed_date ?? row.lastDoneDate),
    nextDueOdometer: coerceNumber(row.next_due_odometer ?? row.nextDueOdometer),
    nextDueDate: coerceIsoDate(row.next_due_date ?? row.nextDueDate),
    status: mappedStatus,
    isDeleted: false,
  };
}

// ----------------------------------------------------------------------------
// 7. FuelAnomalyAlert Field Mapping & Mapper
// ----------------------------------------------------------------------------

export const FUEL_ANOMALY_ALERT_FIELD_MAP = {
  id: { kind: 'column', column: 'id' },
  vehicleId: { kind: 'column', column: 'vehicle_id' },
  vehiclePlate: { kind: 'column', column: 'vehicle_plate' },
  fuelLogId: { kind: 'column', column: 'fuel_log_id' },
  driverId: { kind: 'no_column', reason: 'Joined from fuel_logs if needed' },
  date: { kind: 'column', column: 'date' },
  liters: { kind: 'column', column: 'liters' },
  recordedLPer100Km: { kind: 'column', column: 'recorded_l_per_100km' },
  averageLPer100Km: { kind: 'column', column: 'average_l_per_100km' },
  deviationPercentage: { kind: 'column', column: 'deviation_percentage' },
  severity: { kind: 'column', column: 'severity' },
  reasonSummary: { kind: 'column', column: 'reason_summary' },
  status: { kind: 'column', column: 'status' },
  resolvedNotes: { kind: 'column', column: 'resolved_notes' },
  resolvedAt: { kind: 'column', column: 'resolved_at' },
  resolvedBy: { kind: 'column', column: 'resolved_by' },
  version: { kind: 'column', column: 'version' },
  createdAt: { kind: 'column', column: 'created_at' },
  updatedAt: { kind: 'column', column: 'updated_at' },
  isDeleted: { kind: 'column', column: 'is_deleted' },
} as const satisfies EntityFieldMapping<FuelAnomalyAlert>;

export function mapFuelAnomalyAlertRow(row: Record<string, unknown>): FuelAnomalyAlert {
  return {
    id: coerceString(row.id),
    vehicleId: coerceString(row.vehicle_id ?? row.vehicleId),
    vehiclePlate: coerceString(row.vehicle_plate ?? row.vehiclePlate),
    fuelLogId: coerceString(row.fuel_log_id ?? row.fuelLogId),
    driverId: row.driver_id ? coerceString(row.driver_id) : undefined,
    date: coerceIsoDate(row.date),
    liters: coerceNumber(row.liters),
    recordedLPer100Km: coerceNumber(row.recorded_l_per_100km ?? row.recordedLPer100Km),
    averageLPer100Km: coerceNumber(row.average_l_per_100km ?? row.averageLPer100Km),
    deviationPercentage: coerceNumber(row.deviation_percentage ?? row.deviationPercentage),
    severity: (row.severity as FuelAnomalyAlert['severity']) || 'warning',
    reasonSummary: coerceString(row.reason_summary ?? row.reasonSummary),
    status: (row.status as FuelAnomalyAlert['status']) || 'active',
    resolvedNotes: row.resolved_notes ? coerceString(row.resolved_notes) : undefined,
    resolvedAt: row.resolved_at ? coerceIsoDate(row.resolved_at) : undefined,
    resolvedBy: row.resolved_by ? coerceString(row.resolved_by) : undefined,
    version: coerceNumber(row.version, 1),
    createdAt: row.created_at ? coerceIsoDate(row.created_at) : undefined,
    updatedAt: row.updated_at ? coerceIsoDate(row.updated_at) : undefined,
    isDeleted: coerceBoolean(row.is_deleted, false),
  };
}

// ----------------------------------------------------------------------------
// 8. CostCenterReconciliation Field Mapping & Mapper
// ----------------------------------------------------------------------------

export const COST_CENTER_RECONCILIATION_FIELD_MAP = {
  costCenter: { kind: 'column', column: 'cost_center' },
  totalFuel: { kind: 'column', column: 'total_fuel' },
  totalMaintenance: { kind: 'column', column: 'total_maintenance' },
  totalAllowance: { kind: 'column', column: 'total_allowance' },
  operationalTotalCost: { kind: 'column', column: 'operational_total_cost' },
  journalTotalDebit: { kind: 'column', column: 'journal_total_debit' },
  variance: { kind: 'column', column: 'variance' },
} as const satisfies EntityFieldMapping<CostCenterReconciliation>;

export function mapCostCenterReconciliationRow(row: Record<string, unknown>): CostCenterReconciliation {
  return {
    costCenter: coerceString(row.cost_center ?? row.costCenter),
    totalFuel: coerceNumber(row.total_fuel ?? row.totalFuel),
    totalMaintenance: coerceNumber(row.total_maintenance ?? row.totalMaintenance),
    totalAllowance: coerceNumber(row.total_allowance ?? row.totalAllowance),
    operationalTotalCost: coerceNumber(row.operational_total_cost ?? row.operationalTotalCost),
    journalTotalDebit: coerceNumber(row.journal_total_debit ?? row.journalTotalDebit),
    variance: coerceNumber(row.variance),
  };
}

// ----------------------------------------------------------------------------
// Universal Entity Dispatch Mappers
// ----------------------------------------------------------------------------

export interface EntityMap {
  vehicles: Vehicle;
  drivers: Driver;
  trips: Trip;
  fuelLogs: FuelLog;
  maintenanceOrders: MaintenanceOrder;
  preventiveSchedules: PreventiveSchedule;
  fuelAnomalyAlerts: FuelAnomalyAlert;
  v_cost_center_fleet_reconciliation: CostCenterReconciliation;
}

export function mapRow<K extends keyof EntityMap>(entity: K, row: Record<string, unknown>): EntityMap[K] {
  switch (entity) {
    case 'vehicles':
      return mapVehicleRow(row) as EntityMap[K];
    case 'drivers':
      return mapDriverRow(row) as EntityMap[K];
    case 'trips':
      return mapTripRow(row) as EntityMap[K];
    case 'fuelLogs':
      return mapFuelLogRow(row) as EntityMap[K];
    case 'maintenanceOrders':
      return mapMaintenanceOrderRow(row) as EntityMap[K];
    case 'preventiveSchedules':
      return mapPreventiveScheduleRow(row) as EntityMap[K];
    case 'fuelAnomalyAlerts':
      return mapFuelAnomalyAlertRow(row) as EntityMap[K];
    case 'v_cost_center_fleet_reconciliation':
      return mapCostCenterReconciliationRow(row) as EntityMap[K];
    default:
      throw new Error(`تعذر تحويل بيانات الكيان: لا يوجد مخطط مخصص لـ [${String(entity)}]`);
  }
}

export function mapRows<K extends keyof EntityMap>(entity: K, rows: Record<string, unknown>[]): EntityMap[K][] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => mapRow(entity, r));
}

// ----------------------------------------------------------------------------
// RPC Result Mappers
// ----------------------------------------------------------------------------

export function mapFleetDashboardKpis(raw: Record<string, unknown>): FleetSummaryKPIs {
  return {
    totalVehicles: coerceNumber(raw.totalVehicles),
    onRoadCount: coerceNumber(raw.onRoadCount),
    availableCount: coerceNumber(raw.availableCount),
    maintenanceCount: coerceNumber(raw.maintenanceCount),
    outOfServiceCount: coerceNumber(raw.outOfServiceCount),
    fleetUtilizationRate: coerceNumber(raw.fleetUtilizationRate),
    fuelConsumedTodayLiters: coerceNumber(raw.fuelConsumedTodayLiters),
    fuelCostTodaySar: coerceNumber(raw.fuelCostTodaySar),
    fuelVsYesterdayChangePct: coerceNumber(raw.fuelVsYesterdayChangePct),
    activeTripsCount: coerceNumber(raw.activeTripsCount ?? raw.openTrips),
    pendingMaintenanceCount: coerceNumber(raw.pendingMaintenanceCount ?? raw.openMaintenanceOrders),
    criticalAnomaliesCount: coerceNumber(raw.criticalAnomaliesCount),
  };
}

export function mapVehicleCostReport(raw: Record<string, unknown>): VehicleCostReport {
  return {
    vehicleId: coerceString(raw.vehicleId),
    vehiclePlate: coerceString(raw.vehiclePlate),
    vehicleCode: coerceString(raw.vehicleCode),
    makeModel: coerceString(raw.makeModel),
    totalDistanceKm: coerceNumber(raw.totalDistanceKm),
    fuelCostTotal: coerceNumber(raw.fuelCostTotal),
    maintenanceCostTotal: coerceNumber(raw.maintenanceCostTotal),
    driverAllowanceTotal: coerceNumber(raw.driverAllowanceTotal),
    depreciationCostTotal: coerceNumber(raw.depreciationCostTotal),
    grandTotalCost: coerceNumber(raw.grandTotalCost),
    costPerKm: coerceNumber(raw.costPerKm),
  };
}

export function mapVehicleExpiryAlerts(raw: unknown[]): ExpiryAlert[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      id: coerceString(row.id),
      vehicleId: coerceString(row.vehicleId),
      vehiclePlate: coerceString(row.vehiclePlate),
      vehicleCode: coerceString(row.vehicleCode),
      alertType: (row.alertType as ExpiryAlert['alertType']) || 'insurance',
      title: coerceString(row.title),
      expiryDate: coerceIsoDate(row.expiryDate) || coerceString(row.expiryDate),
      daysRemaining: coerceNumber(row.daysRemaining),
      isExpired: coerceBoolean(row.isExpired),
    };
  });
}

export function mapResolveFuelAnomalyResult(raw: Record<string, unknown>): {
  id: string;
  status: string;
  version: number;
  resolvedNotes?: string;
  resolvedAt?: string;
  resolvedBy?: string;
} {
  return {
    id: coerceString(raw.id),
    status: coerceString(raw.status, 'resolved'),
    version: coerceNumber(raw.version, 1),
    resolvedNotes: raw.resolvedNotes ? coerceString(raw.resolvedNotes) : undefined,
    resolvedAt: raw.resolvedAt ? coerceIsoDate(raw.resolvedAt) : undefined,
    resolvedBy: raw.resolvedBy ? coerceString(raw.resolvedBy) : undefined,
  };
}
