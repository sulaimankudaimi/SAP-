/**
 * Declarative Read Specifications for Server-Side PostgREST Queries
 *
 * Each entry specifies:
 * - table: Exact database table or view name
 * - columns: Exact SQL column names to select (1:1 with row mapper definitions)
 * - filters: Static filters applied to all reads for this entity
 * - order: Default sorting columns and directions
 *
 * Architectural Invariant:
 * Operational documents (trips, fuel_logs, maintenance_orders) have NO is_deleted filter.
 * Preventive schedules filter by status = 'Active' (no is_active column).
 * Fuel anomaly alerts filter by status = 'active' (no is_resolved column).
 */

export type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
export type FilterTuple = [column: string, op: FilterOp, value: unknown];
export type OrderTuple = [column: string, direction: 'asc' | 'desc'];

export interface ReadSpec {
  readonly table: string;
  readonly columns: readonly string[];
  readonly filters: readonly FilterTuple[];
  readonly order?: readonly OrderTuple[];
}

export const READ_SPECS = {
  vehicles: {
    table: 'vehicles',
    columns: [
      'id',
      'code',
      'plate_number',
      'type',
      'make_model',
      'vin',
      'year',
      'capacity_liters',
      'current_odometer',
      'fuel_type',
      'assigned_driver_id',
      'plant_code',
      'cost_center',
      'status',
      'insurance_expiry',
      'registration_expiry',
      'is_deleted',
      'created_by',
      'created_at',
      'updated_at',
      'version',
    ],
    filters: [['is_deleted', 'eq', false]],
    order: [['created_at', 'desc']],
  },

  drivers: {
    table: 'drivers',
    columns: [
      'id',
      'code',
      'name',
      'iqama_number',
      'mobile',
      'license_number',
      'license_class',
      'license_expiry',
      'plant_code',
      'status',
      'safety_rating',
      'total_trips_completed',
      'total_distance_km',
      'is_deleted',
      'created_by',
      'created_at',
      'updated_at',
      'version',
    ],
    filters: [['is_deleted', 'eq', false]],
    order: [['name', 'asc']],
  },

  trips: {
    table: 'trips',
    columns: [
      'id',
      'doc_number',
      'status',
      'vehicle_id',
      'driver_id',
      'origin_plant',
      'destination_location',
      'cargo_type',
      'cargo_volume_liters',
      'scheduled_departure',
      'scheduled_arrival',
      'actual_departure',
      'actual_arrival',
      'start_odometer',
      'end_odometer',
      'distance_km',
      'fuel_liters_consumed',
      'fuel_cost',
      'driver_allowance_cost',
      'total_trip_cost',
      'cost_per_km',
      'is_delayed',
      'delay_minutes',
      'je_doc_number',
      'cancelled_by_document',
      'cancellation_reason',
      'created_by',
      'created_at',
      'updated_at',
      'version',
    ],
    // Documents are immutable and never deleted; NO is_deleted filter
    filters: [],
    order: [['scheduled_departure', 'desc']],
  },

  fuelLogs: {
    table: 'fuel_logs',
    columns: [
      'id',
      'doc_number',
      'vehicle_id',
      'driver_id',
      'fuel_type',
      'liters',
      'unit_price',
      'total_cost',
      'odometer',
      'station_name',
      'invoice_number',
      'plant_code',
      'logged_at',
      'is_anomaly',
      'anomaly_reason',
      'je_doc_number',
      'created_by',
      'created_at',
      'updated_at',
      'version',
    ],
    // Documents are immutable; NO is_deleted filter
    filters: [],
    order: [['odometer', 'desc']],
  },

  maintenanceOrders: {
    table: 'maintenance_orders',
    columns: [
      'id',
      'doc_number',
      'status',
      'vehicle_id',
      'vehicle_plate',
      'order_type',
      'description',
      'fault_reported',
      'estimated_cost',
      'parts_cost',
      'labor_hours',
      'labor_cost',
      'actual_cost',
      'downtime_hours',
      'start_date',
      'completion_date',
      'preventive_schedule_id',
      'je_doc_number',
      'cancelled_by_document',
      'cancellation_reason',
      'created_by',
      'created_at',
      'updated_at',
      'version',
    ],
    // Documents are immutable; NO is_deleted filter
    filters: [],
    order: [['start_date', 'desc']],
  },

  preventiveSchedules: {
    table: 'preventive_schedules',
    columns: [
      'id',
      'vehicle_id',
      'title',
      'interval_km',
      'interval_days',
      'last_performed_date',
      'last_performed_odometer',
      'next_due_date',
      'next_due_odometer',
      'status',
      'created_by',
      'created_at',
      'updated_at',
      'version',
    ],
    // Filter by SQL status column; NO is_active column exists
    filters: [['status', 'eq', 'Active']],
    order: [['created_at', 'desc']],
  },

  fuelAnomalyAlerts: {
    table: 'fuel_anomaly_alerts',
    columns: [
      'id',
      'vehicle_id',
      'vehicle_plate',
      'fuel_log_id',
      'date',
      'liters',
      'recorded_l_per_100km',
      'average_l_per_100km',
      'deviation_percentage',
      'severity',
      'reason_summary',
      'status',
      'resolved_notes',
      'resolved_at',
      'resolved_by',
      'updated_at',
      'version',
      'is_deleted',
      'created_at',
    ],
    // Filter by status vocabulary; NO is_resolved column exists
    filters: [
      ['is_deleted', 'eq', false],
      ['status', 'eq', 'active'],
    ],
    order: [['date', 'desc']],
  },

  v_cost_center_fleet_reconciliation: {
    table: 'v_cost_center_fleet_reconciliation',
    columns: [
      'cost_center',
      'total_fuel',
      'total_maintenance',
      'total_allowance',
      'operational_total_cost',
      'journal_total_debit',
      'variance',
    ],
    filters: [],
    order: [['cost_center', 'asc']],
  },

  profiles: {
    table: 'profiles',
    columns: [
      'user_id',
      'username',
      'full_name',
      'role_code',
      'plant_codes',
      'is_active',
      'must_change_password',
      'created_at',
      'updated_at',
    ],
    filters: [['is_active', 'eq', true]],
    order: [['username', 'asc']],
  },

  roles: {
    table: 'roles',
    columns: ['code', 'name', 'description', 'is_system', 'created_at'],
    filters: [],
    order: [['code', 'asc']],
  },

  role_permissions: {
    table: 'role_permissions',
    columns: [
      'id',
      'role_code',
      'module',
      'activity',
      'plant_limit',
      'cost_center_limit',
      'amount_limit',
      'created_at',
    ],
    filters: [],
    order: [['role_code', 'asc']],
  },
} as const satisfies Record<string, ReadSpec>;

export type ReadSpecKey = keyof typeof READ_SPECS;
