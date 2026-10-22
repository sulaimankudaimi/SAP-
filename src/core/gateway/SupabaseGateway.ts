import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
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
  RecordTripEventCommand,
  RecordOdometerReadingCommand,
  RecordInspectionCommand,
  VehicleFilters,
  DriverFilters,
  TripFilters,
  FuelLogFilters,
  MaintenanceFilters,
  PaginatedResult,
  CostCenterReconciliation,
  RealtimeChangeCallback,
} from './IDataGateway';
import { getServerUrl, getServerAnonKey } from './connectivity';
import {
  ConcurrencyError,
  PermissionError,
  ValidationError,
  AlreadyProcessed,
  ChronologyError,
  GenericServerError,
} from '../errors';
import { DiagnosticLogger } from '../services/DiagnosticLogger';
import { READ_SPECS, type ReadSpec } from './readSpecs';
import {
  mapRow,
  mapRows,
  mapFleetDashboardKpis,
  mapVehicleCostReport,
  mapVehicleExpiryAlerts,
  mapResolveFuelAnomalyResult,
  type ServerProfile,
  type ServerRole,
  type ServerRolePermission,
} from './rowMappers';

export interface PostgrestQueryLike {
  eq(column: string, value: unknown): this;
  neq(column: string, value: unknown): this;
  gt(column: string, value: unknown): this;
  gte(column: string, value: unknown): this;
  lt(column: string, value: unknown): this;
  lte(column: string, value: unknown): this;
  in(column: string, values: unknown[]): this;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this;
  range(from: number, to: number): this;
  maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
  then<TResult1 = { data: Record<string, unknown>[] | null; error: { message: string } | null; count?: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Record<string, unknown>[] | null; error: { message: string } | null; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>;
}

export class SupabaseGateway implements IDataGateway {
  readonly mode = 'server' as const;
  private client: SupabaseClient;

  public get supabaseClient(): SupabaseClient {
    return this.client;
  }

  constructor() {
    const url = getServerUrl() || 'https://placeholder-erp.supabase.co';
    const anonKey = getServerAnonKey() || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

    const safeStorage = {
      getItem: (key: string): string | null => {
        try {
          return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
        } catch {
          return null;
        }
      },
      setItem: (key: string, value: string): void => {
        try {
          if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
        } catch {
          // Ignore
        }
      },
      removeItem: (key: string): void => {
        try {
          if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
        } catch {
          // Ignore
        }
      },
    };

    this.client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        storage: safeStorage,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  getSupabaseClient(): SupabaseClient {
    return this.client;
  }

  /**
   * Applies the select columns, static filters, and ordering from a declarative ReadSpec.
   */
  private applySpec(
    query: { select: (columns?: string, options?: { count?: 'exact' | 'planned' | 'estimated' }) => unknown },
    spec: ReadSpec,
    options?: {
      count?: 'exact' | 'planned' | 'estimated';
      applyFilters?: (
        builder: PostgrestQueryLike
      ) => PostgrestQueryLike;
    }
  ): PostgrestQueryLike {
    let q = query.select(
      spec.columns.join(', '),
      options?.count ? { count: options.count } : undefined
    ) as unknown as PostgrestQueryLike;
    for (const [column, op, value] of spec.filters) {
      if (op === 'eq') q = q.eq(column, value);
      else if (op === 'neq') q = q.neq(column, value);
      else if (op === 'gt') q = q.gt(column, value);
      else if (op === 'gte') q = q.gte(column, value);
      else if (op === 'lt') q = q.lt(column, value);
      else if (op === 'lte') q = q.lte(column, value);
      else if (op === 'in') q = q.in(column, value as unknown[]);
    }
    if (options?.applyFilters) {
      q = options.applyFilters(q);
    }
    let res = q;
    if (spec.order) {
      for (const [column, direction] of spec.order) {
        res = res.order(column, { ascending: direction === 'asc' });
      }
    }
    return res;
  }

  /**
   * Helper to map server/RPC errors into typed Arabic errors without leaking raw SQL internals
   */
  private handleRpcError(err: unknown, entityName: string, entityId: string, expectedVersion?: number): never {
    const rawMsg = err instanceof Error ? err.message : String(err);

    // 1. Concurrency / Version conflict
    const isConflict =
      rawMsg.includes('conflict') ||
      rawMsg.includes('concurrency') ||
      rawMsg.includes('version mismatch') ||
      rawMsg.includes('P0001') ||
      rawMsg.includes('تعارض');

    if (isConflict) {
      throw new ConcurrencyError({
        entityName,
        entityId,
        expectedVersion: expectedVersion ?? 1,
        message: rawMsg || 'تعارض في التعديل المتزامن: تم تعديل هذا السجل بواسطة مستخدم آخر على الخادم.',
      });
    }

    // 2. Permission / Authorization failure
    if (
      rawMsg.includes('permission') ||
      rawMsg.includes('غير مصرح') ||
      rawMsg.includes('permission denied') ||
      rawMsg.includes('42501')
    ) {
      throw new PermissionError(rawMsg);
    }

    // 3. Chronology / Past event or odometer rollback
    if (
      rawMsg.includes('chronology') ||
      rawMsg.includes('تناقص') ||
      rawMsg.includes('يسبق') ||
      (rawMsg.includes('odometer') && rawMsg.includes('less'))
    ) {
      throw new ChronologyError(rawMsg);
    }

    // 4. Validation / Business rule check violation
    if (
      rawMsg.includes('validation') ||
      rawMsg.includes('غير صالح') ||
      rawMsg.includes('تتجاوز سعة') ||
      rawMsg.includes('منتهية الصلاحية') ||
      rawMsg.includes('لا يمكن إغلاق') ||
      rawMsg.includes('لا يمكن صرف') ||
      rawMsg.includes('23514')
    ) {
      throw new ValidationError(rawMsg);
    }

    // 5. Idempotency duplicate already processed
    if (
      rawMsg.includes('already processed') ||
      rawMsg.includes('مكرر') ||
      rawMsg.includes('سبق تنفيذه')
    ) {
      throw new AlreadyProcessed(rawMsg);
    }

    // 6. Generic safe server error (never leak raw SQL syntax / table internals)
    throw new GenericServerError('حدث خطأ في معالجة الطلب على الخادم. يرجى مراجعة إدارة النظام.');
  }

  // --------------------------------------------------------------------------
  // Core Operational Commands
  // --------------------------------------------------------------------------

  async createTrip(cmd: CreateTripCommand): Promise<Trip> {
    const { data, error } = await this.client.rpc('create_trip', {
      p_request_id: cmd.requestId,
      p_vehicle_id: cmd.vehicleId,
      p_driver_id: cmd.driverId,
      p_origin_plant: cmd.originPlant,
      p_destination_location: cmd.destinationLocation,
      p_cargo_type: cmd.cargoType,
      p_cargo_volume_liters: cmd.cargoVolumeLiters,
      p_scheduled_departure: cmd.scheduledDeparture,
      p_scheduled_arrival: cmd.scheduledArrival,
      p_start_odometer: cmd.startOdometer,
      p_expected_version: cmd.expectedVersion ?? null,
    });

    if (error) {
      this.handleRpcError(error, 'Trip', cmd.vehicleId, cmd.expectedVersion);
    }

    return mapRow('trips', (data || {}) as Record<string, unknown>);
  }

  async completeTrip(cmd: CompleteTripCommand): Promise<Trip> {
    const { data, error } = await this.client.rpc('complete_trip', {
      p_request_id: cmd.requestId,
      p_trip_id: cmd.tripId,
      p_end_odometer: cmd.endOdometer,
      p_actual_arrival: cmd.actualArrival || new Date().toISOString(),
      p_fuel_liters_consumed: cmd.fuelLitersConsumed ?? 0,
      p_fuel_cost: cmd.fuelCost ?? 0,
      p_driver_allowance_cost: cmd.driverAllowanceCost ?? 0,
      p_expected_version: cmd.expectedVersion ?? null,
    });

    if (error) {
      this.handleRpcError(error, 'Trip', cmd.tripId, cmd.expectedVersion);
    }

    return mapRow('trips', (data || {}) as Record<string, unknown>);
  }

  async createFuelLog(cmd: CreateFuelLogCommand): Promise<FuelLog> {
    const occurredAt = cmd.occurredAt || new Date().toISOString();
    const { data, error } = await this.client.rpc('create_fuel_log', {
      p_request_id: cmd.requestId,
      p_vehicle_id: cmd.vehicleId,
      p_driver_id: cmd.driverId || null,
      p_fuel_type: cmd.fuelType,
      p_odometer: cmd.currentOdometer ?? cmd.odometer ?? 0,
      p_quantity_liters: cmd.liters ?? cmd.quantityLiters ?? 0,
      p_cost_per_liter: cmd.cost && cmd.liters ? cmd.cost / cmd.liters : (cmd.costPerLiter ?? 0),
      p_station_name: cmd.vendorName || cmd.stationLocation || cmd.stationName || 'محطة المحروقات',
      p_date: cmd.date || occurredAt.substring(0, 10),
      p_expected_version: cmd.expectedVersion ?? null,
      p_occurred_at: occurredAt,
      p_liters: cmd.liters ?? cmd.quantityLiters ?? 0,
      p_unit_price: cmd.cost && cmd.liters ? cmd.cost / cmd.liters : (cmd.costPerLiter ?? 0),
      p_invoice_number: cmd.invoiceNumber || null,
      p_plant_code: null,
    });

    if (error) {
      this.handleRpcError(error, 'FuelLog', cmd.vehicleId, cmd.expectedVersion);
    }

    return mapRow('fuelLogs', (data || {}) as Record<string, unknown>);
  }

  async issuePartsToMaintenanceOrder(
    cmd: IssuePartsCommand
  ): Promise<{ order: MaintenanceOrder; materialDocNumber: string }> {
    const { data, error } = await this.client.rpc('issue_parts_to_maintenance_order', {
      p_request_id: cmd.requestId,
      p_order_id: cmd.orderId,
      p_plant_code: cmd.items?.[0]?.plantCode || '1100',
      p_parts: cmd.items,
      p_expected_version: cmd.expectedVersion ?? null,
    });

    if (error) {
      this.handleRpcError(error, 'MaintenanceOrder', cmd.orderId, cmd.expectedVersion);
    }

    const res = (data || {}) as Record<string, unknown>;
    return {
      order: mapRow('maintenanceOrders', (res.order || {}) as Record<string, unknown>),
      materialDocNumber: String(res.materialDocNumber || ''),
    };
  }

  async completeMaintenanceOrder(cmd: CompleteMaintenanceOrderCommand): Promise<MaintenanceOrder> {
    const { data, error } = await this.client.rpc('complete_maintenance_order', {
      p_request_id: cmd.requestId,
      p_order_id: cmd.orderId,
      p_labor_hours: cmd.actualLaborHours ?? 0,
      p_labor_rate_per_hour:
        cmd.actualLaborCost && cmd.actualLaborHours
          ? cmd.actualLaborCost / cmd.actualLaborHours
          : 120,
      p_downtime_hours: cmd.downtimeHours ?? 0,
      p_completion_date: cmd.completionDate ? cmd.completionDate.substring(0, 10) : new Date().toISOString().substring(0, 10),
      p_expected_version: cmd.expectedVersion ?? null,
    });

    if (error) {
      this.handleRpcError(error, 'MaintenanceOrder', cmd.orderId, cmd.expectedVersion);
    }

    return mapRow('maintenanceOrders', (data || {}) as Record<string, unknown>);
  }

  async postJournal(cmd: PostJournalCommand): Promise<{ docNumber: string; jeId: string }> {
    const { data, error } = await this.client.rpc('post_journal', {
      p_request_id: cmd.requestId,
      p_source_type: cmd.sourceType,
      p_source_id: cmd.sourceId,
      p_company_code: cmd.companyCode,
      p_fiscal_year: cmd.fiscalYear,
      p_period: cmd.period,
      p_posting_date: cmd.postingDate,
      p_document_date: cmd.documentDate,
      p_document_type: cmd.documentType,
      p_header_text: cmd.headerText,
      p_reference: cmd.reference || null,
      p_lines: cmd.lines,
      p_expected_version: cmd.expectedVersion ?? null,
      p_event: 'POST',
    });

    if (error) {
      this.handleRpcError(error, 'JournalEntry', cmd.sourceId, cmd.expectedVersion);
    }

    const res = (data || {}) as Record<string, unknown>;
    return {
      docNumber: String(res.docNumber || ''),
      jeId: String(res.jeId || ''),
    };
  }

  // --------------------------------------------------------------------------
  // Field Telemetry Commands (Whitelisted Offline Sync)
  // --------------------------------------------------------------------------

  async recordTripEvent(cmd: RecordTripEventCommand): Promise<{ requestId: string; tripId: string; eventType: string }> {
    const { data, error } = await this.client.rpc('record_trip_event', {
      p_request_id: cmd.requestId,
      p_trip_id: cmd.tripId,
      p_vehicle_id: cmd.vehicleId,
      p_event_type: cmd.eventType,
      p_occurred_at: cmd.occurredAt,
      p_payload: cmd.payload || {},
    });

    if (error) {
      this.handleRpcError(error, 'TripEvent', cmd.tripId);
    }

    const res = (data || {}) as Record<string, unknown>;
    return {
      requestId: String(res.requestId || ''),
      tripId: String(res.tripId || ''),
      eventType: String(res.eventType || ''),
    };
  }

  async recordOdometerReading(cmd: RecordOdometerReadingCommand): Promise<{ requestId: string; vehicleId: string; readingKm: number }> {
    const { data, error } = await this.client.rpc('record_odometer_reading', {
      p_request_id: cmd.requestId,
      p_vehicle_id: cmd.vehicleId,
      p_reading_km: cmd.readingKm,
      p_captured_at: cmd.capturedAt,
      p_source: cmd.source || 'driver_check_in',
    });

    if (error) {
      this.handleRpcError(error, 'OdometerReading', cmd.vehicleId);
    }

    const res = (data || {}) as Record<string, unknown>;
    return {
      requestId: String(res.requestId || ''),
      vehicleId: String(res.vehicleId || ''),
      readingKm: Number(res.readingKm || 0),
    };
  }

  async recordInspection(cmd: RecordInspectionCommand): Promise<{ requestId: string; vehicleId: string; result: string }> {
    const { data, error } = await this.client.rpc('record_inspection', {
      p_request_id: cmd.requestId,
      p_vehicle_id: cmd.vehicleId,
      p_inspected_at: cmd.inspectedAt,
      p_result: cmd.result,
      p_notes: cmd.notes || null,
      p_checklist: cmd.checklist || {},
    });

    if (error) {
      this.handleRpcError(error, 'VehicleInspection', cmd.vehicleId);
    }

    const res = (data || {}) as Record<string, unknown>;
    return {
      requestId: String(res.requestId || ''),
      vehicleId: String(res.vehicleId || ''),
      result: String(res.result || ''),
    };
  }

  // --------------------------------------------------------------------------
  // Master Data Commands (Vehicles & Drivers)
  // --------------------------------------------------------------------------

  async createVehicle(vehicle: Partial<Vehicle>, requestId?: string): Promise<Vehicle> {
    const reqId = requestId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined);
    const { data, error } = await this.client.rpc('create_vehicle', {
      p_request_id: reqId,
      p_code: vehicle.code || vehicle.plateNumber,
      p_plate_number: vehicle.plateNumber,
      p_type: vehicle.type,
      p_make_model: vehicle.makeModel || '',
      p_plant_code: vehicle.plantCode || '1100',
      p_cost_center: vehicle.costCenter || 'CC-FLT-1100',
      p_vin: vehicle.vin || null,
      p_year: vehicle.year || null,
      p_capacity_liters: vehicle.capacityLiters || 0,
      p_current_odometer: vehicle.currentOdometer || 0,
      p_fuel_type: vehicle.fuelType || 'Diesel',
      p_assigned_driver_id: vehicle.assignedDriverId || null,
      p_insurance_expiry: vehicle.insuranceExpiry || null,
      p_registration_expiry: vehicle.registrationExpiry || null,
    });

    if (error) {
      this.handleRpcError(error, 'Vehicle', vehicle.plateNumber || 'new');
    }

    return mapRow('vehicles', (data || {}) as Record<string, unknown>);
  }

  async updateVehicle(
    id: string,
    updates: Partial<Vehicle>,
    expectedVersion?: number,
    requestId?: string
  ): Promise<Vehicle> {
    const reqId = requestId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined);
    const { data, error } = await this.client.rpc('update_vehicle', {
      p_request_id: reqId,
      p_id: id,
      p_expected_version: expectedVersion ?? null,
      p_plate_number: updates.plateNumber ?? null,
      p_make_model: updates.makeModel ?? null,
      p_type: updates.type ?? null,
      p_fuel_type: updates.fuelType ?? null,
      p_capacity_liters: updates.capacityLiters ?? null,
      p_assigned_driver_id: updates.assignedDriverId ?? null,
      p_plant_code: updates.plantCode ?? null,
      p_cost_center: updates.costCenter ?? null,
      p_status: updates.status ?? null,
      p_insurance_expiry: updates.insuranceExpiry ?? null,
      p_registration_expiry: updates.registrationExpiry ?? null,
    });

    if (error) {
      this.handleRpcError(error, 'Vehicle', id, expectedVersion);
    }

    return mapRow('vehicles', (data || {}) as Record<string, unknown>);
  }

  async setVehicleActive(
    id: string,
    isActive: boolean,
    expectedVersion?: number,
    requestId?: string
  ): Promise<Vehicle> {
    const reqId = requestId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined);
    const { data, error } = await this.client.rpc('set_vehicle_active', {
      p_request_id: reqId,
      p_id: id,
      p_is_active: isActive,
      p_expected_version: expectedVersion ?? null,
    });

    if (error) {
      this.handleRpcError(error, 'Vehicle', id, expectedVersion);
    }

    return mapRow('vehicles', (data || {}) as Record<string, unknown>);
  }

  async createDriver(driver: Partial<Driver>, requestId?: string): Promise<Driver> {
    const reqId = requestId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined);
    const { data, error } = await this.client.rpc('create_driver', {
      p_request_id: reqId,
      p_code: driver.code || driver.iqamaNumber || 'DRV-NEW',
      p_name: driver.name,
      p_iqama_number: driver.iqamaNumber,
      p_mobile: driver.mobile,
      p_license_number: driver.licenseNumber,
      p_license_class: driver.licenseClass || 'Heavy',
      p_license_expiry: driver.licenseExpiry,
      p_plant_code: driver.plantCode || '1100',
      p_safety_rating: driver.safetyRating || 5.0,
    });

    if (error) {
      this.handleRpcError(error, 'Driver', driver.name || 'new');
    }

    return mapRow('drivers', (data || {}) as Record<string, unknown>);
  }

  async updateDriver(
    id: string,
    updates: Partial<Driver>,
    expectedVersion?: number,
    requestId?: string
  ): Promise<Driver> {
    const reqId = requestId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined);
    const { data, error } = await this.client.rpc('update_driver', {
      p_request_id: reqId,
      p_id: id,
      p_expected_version: expectedVersion ?? null,
      p_name: updates.name ?? null,
      p_mobile: updates.mobile ?? null,
      p_license_number: updates.licenseNumber ?? null,
      p_license_class: updates.licenseClass ?? null,
      p_license_expiry: updates.licenseExpiry ?? null,
      p_plant_code: updates.plantCode ?? null,
      p_status: updates.status ?? null,
      p_safety_rating: updates.safetyRating ?? null,
    });

    if (error) {
      this.handleRpcError(error, 'Driver', id, expectedVersion);
    }

    return mapRow('drivers', (data || {}) as Record<string, unknown>);
  }

  async setDriverActive(
    id: string,
    isActive: boolean,
    expectedVersion?: number,
    requestId?: string
  ): Promise<Driver> {
    const reqId = requestId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined);
    const { data, error } = await this.client.rpc('set_driver_active', {
      p_request_id: reqId,
      p_id: id,
      p_is_active: isActive,
      p_expected_version: expectedVersion ?? null,
    });

    if (error) {
      this.handleRpcError(error, 'Driver', id, expectedVersion);
    }

    return mapRow('drivers', (data || {}) as Record<string, unknown>);
  }

  async createMaintenanceOrder(order: Partial<MaintenanceOrder>): Promise<MaintenanceOrder> {
    const { data, error } = await this.client
      .from('maintenance_orders')
      .insert({
        vehicle_id: order.vehicleId,
        order_type: order.orderType,
        priority: order.priority || 'medium',
        plant_code: order.plantCode || '1100',
        description: order.description,
        start_date: order.startDate || new Date().toISOString().substring(0, 10),
        status: 'pending',
        version: 1,
      })
      .select()
      .single();

    if (error) {
      this.handleRpcError(error, 'MaintenanceOrder', order.vehicleId || 'new');
    }

    return mapRow('maintenanceOrders', (data || {}) as Record<string, unknown>);
  }

  // --------------------------------------------------------------------------
  // Fleet Query Methods
  // --------------------------------------------------------------------------

  async getVehicles(filters?: VehicleFilters): Promise<Vehicle[]> {
    const query = this.applySpec(this.client.from(READ_SPECS.vehicles.table), READ_SPECS.vehicles, {
      applyFilters: (q) => {
        let modified = q;
        if (filters?.status) modified = modified.eq('status', filters.status);
        if (filters?.vehicleType) modified = modified.eq('type', filters.vehicleType);
        if (filters?.assignedPlant) modified = modified.eq('plant_code', filters.assignedPlant);
        return modified;
      },
    });

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return mapRows('vehicles', (data || []) as Record<string, unknown>[]);
  }

  async getVehicleById(id: string): Promise<Vehicle | null> {
    const query = this.applySpec(this.client.from(READ_SPECS.vehicles.table), READ_SPECS.vehicles, {
      applyFilters: (q) => q.eq('id', id),
    });
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRow('vehicles', data as Record<string, unknown>) : null;
  }

  async getDrivers(filters?: DriverFilters): Promise<Driver[]> {
    const query = this.applySpec(this.client.from(READ_SPECS.drivers.table), READ_SPECS.drivers, {
      applyFilters: (q) => {
        let modified = q;
        if (filters?.status) modified = modified.eq('status', filters.status);
        if (filters?.assignedPlant) modified = modified.eq('plant_code', filters.assignedPlant);
        return modified;
      },
    });

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return mapRows('drivers', (data || []) as Record<string, unknown>[]);
  }

  async getDriverById(id: string): Promise<Driver | null> {
    const query = this.applySpec(this.client.from(READ_SPECS.drivers.table), READ_SPECS.drivers, {
      applyFilters: (q) => q.eq('id', id),
    });
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRow('drivers', data as Record<string, unknown>) : null;
  }

  async getTrips(filters?: TripFilters): Promise<Trip[]> {
    const query = this.applySpec(this.client.from(READ_SPECS.trips.table), READ_SPECS.trips, {
      applyFilters: (q) => {
        let modified = q;
        if (filters?.status) modified = modified.eq('status', filters.status);
        if (filters?.vehicleId) modified = modified.eq('vehicle_id', filters.vehicleId);
        if (filters?.driverId) modified = modified.eq('driver_id', filters.driverId);
        if (filters?.originPlant) modified = modified.eq('origin_plant', filters.originPlant);
        if (filters?.startDate) modified = modified.gte('scheduled_departure', filters.startDate);
        if (filters?.endDate) modified = modified.lte('scheduled_departure', filters.endDate);
        return modified;
      },
    });

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return mapRows('trips', (data || []) as Record<string, unknown>[]);
  }

  async getTripById(id: string): Promise<Trip | null> {
    const query = this.applySpec(this.client.from(READ_SPECS.trips.table), READ_SPECS.trips, {
      applyFilters: (q) => q.eq('id', id),
    });
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRow('trips', data as Record<string, unknown>) : null;
  }

  async getFuelLogs(filtersOrVehicleId?: string | FuelLogFilters): Promise<FuelLog[]> {
    const query = this.applySpec(this.client.from(READ_SPECS.fuelLogs.table), READ_SPECS.fuelLogs, {
      applyFilters: (q) => {
        let modified = q;
        if (typeof filtersOrVehicleId === 'string') {
          modified = modified.eq('vehicle_id', filtersOrVehicleId);
        } else if (filtersOrVehicleId) {
          if (filtersOrVehicleId.vehicleId) modified = modified.eq('vehicle_id', filtersOrVehicleId.vehicleId);
          if (filtersOrVehicleId.driverId) modified = modified.eq('driver_id', filtersOrVehicleId.driverId);
          if (filtersOrVehicleId.startDate) modified = modified.gte('date', filtersOrVehicleId.startDate);
          if (filtersOrVehicleId.endDate) modified = modified.lte('date', filtersOrVehicleId.endDate);
        }
        return modified;
      },
    });

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return mapRows('fuelLogs', (data || []) as Record<string, unknown>[]);
  }

  async getPaginatedFuelLogs(filters: FuelLogFilters): Promise<PaginatedResult<FuelLog>> {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 25;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const query = this.applySpec(this.client.from(READ_SPECS.fuelLogs.table), READ_SPECS.fuelLogs, {
      count: 'exact',
      applyFilters: (q) => {
        let modified = q;
        if (filters.vehicleId) modified = modified.eq('vehicle_id', filters.vehicleId);
        if (filters.driverId) modified = modified.eq('driver_id', filters.driverId);
        if (filters.startDate) modified = modified.gte('date', filters.startDate);
        if (filters.endDate) modified = modified.lte('date', filters.endDate);
        return modified;
      },
    });

    const { data, count, error } = await query.range(from, to);
    if (error) throw new Error(error.message);

    const totalCount = count || 0;
    return {
      data: mapRows('fuelLogs', (data || []) as Record<string, unknown>[]),
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  }

  async getMaintenanceOrders(filtersOrVehicleId?: string | MaintenanceFilters): Promise<MaintenanceOrder[]> {
    const query = this.applySpec(this.client.from(READ_SPECS.maintenanceOrders.table), READ_SPECS.maintenanceOrders, {
      applyFilters: (q) => {
        let modified = q;
        if (typeof filtersOrVehicleId === 'string') {
          modified = modified.eq('vehicle_id', filtersOrVehicleId);
        } else if (filtersOrVehicleId) {
          if (filtersOrVehicleId.vehicleId) modified = modified.eq('vehicle_id', filtersOrVehicleId.vehicleId);
          if (filtersOrVehicleId.status) modified = modified.eq('status', filtersOrVehicleId.status);
          if (filtersOrVehicleId.orderType) modified = modified.eq('order_type', filtersOrVehicleId.orderType);
        }
        return modified;
      },
    });

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return mapRows('maintenanceOrders', (data || []) as Record<string, unknown>[]);
  }

  async getMaintenanceOrderById(id: string): Promise<MaintenanceOrder | null> {
    const query = this.applySpec(this.client.from(READ_SPECS.maintenanceOrders.table), READ_SPECS.maintenanceOrders, {
      applyFilters: (q) => q.eq('id', id),
    });
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRow('maintenanceOrders', data as Record<string, unknown>) : null;
  }

  async getPreventiveSchedules(vehicleId?: string): Promise<PreventiveSchedule[]> {
    const query = this.applySpec(this.client.from(READ_SPECS.preventiveSchedules.table), READ_SPECS.preventiveSchedules, {
      applyFilters: (q) => {
        if (vehicleId) return q.eq('vehicle_id', vehicleId);
        return q;
      },
    });
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return mapRows('preventiveSchedules', (data || []) as Record<string, unknown>[]);
  }

  async getFuelAnomalyAlerts(): Promise<FuelAnomalyAlert[]> {
    const query = this.applySpec(this.client.from(READ_SPECS.fuelAnomalyAlerts.table), READ_SPECS.fuelAnomalyAlerts);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return mapRows('fuelAnomalyAlerts', (data || []) as Record<string, unknown>[]);
  }

  async resolveFuelAnomalyAlert(
    id: string,
    notes?: string,
    expectedVersion?: number,
    requestId?: string
  ): Promise<void> {
    const reqId =
      requestId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined);
    const { data, error } = await this.client.rpc('resolve_fuel_anomaly', {
      p_request_id: reqId,
      p_alert_id: id,
      p_notes: notes || null,
      p_expected_version: expectedVersion ?? null,
    });
    if (error) {
      this.handleRpcError(error, 'FuelAnomalyAlert', id, expectedVersion);
    }
    mapResolveFuelAnomalyResult((data || {}) as Record<string, unknown>);
  }

  async getVehicleExpiryAlerts(): Promise<ExpiryAlert[]> {
    const { data, error } = await this.client.rpc('get_vehicle_expiry_alerts', { p_days: 30 });
    if (error) throw new Error(error.message);
    return mapVehicleExpiryAlerts((data || []) as unknown[]);
  }

  async getVehicleCostReport(vehicleId: string): Promise<VehicleCostReport> {
    const { data, error } = await this.client.rpc('get_vehicle_cost_report', { p_vehicle_id: vehicleId });
    if (error) throw new Error(error.message);
    return mapVehicleCostReport((data || {}) as Record<string, unknown>);
  }

  async getCostCenterFleetReconciliation(): Promise<CostCenterReconciliation[]> {
    const query = this.applySpec(
      this.client.from(READ_SPECS.v_cost_center_fleet_reconciliation.table),
      READ_SPECS.v_cost_center_fleet_reconciliation
    );
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return mapRows('v_cost_center_fleet_reconciliation', (data || []) as Record<string, unknown>[]);
  }

  async getFleetDashboardKPIs(): Promise<FleetSummaryKPIs> {
    const { data, error } = await this.client.rpc('get_fleet_dashboard_kpis');
    if (error) throw new Error(error.message);
    return mapFleetDashboardKpis((data || {}) as Record<string, unknown>);
  }

  async getProfiles(): Promise<ServerProfile[]> {
    const query = this.applySpec(this.client.from(READ_SPECS.profiles.table), READ_SPECS.profiles);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return mapRows('profiles', (data || []) as Record<string, unknown>[]);
  }

  async getRoles(): Promise<ServerRole[]> {
    const query = this.applySpec(this.client.from(READ_SPECS.roles.table), READ_SPECS.roles);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return mapRows('roles', (data || []) as Record<string, unknown>[]);
  }

  async getRolePermissions(): Promise<ServerRolePermission[]> {
    const query = this.applySpec(this.client.from(READ_SPECS.role_permissions.table), READ_SPECS.role_permissions);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return mapRows('role_permissions', (data || []) as Record<string, unknown>[]);
  }

  // --------------------------------------------------------------------------
  // Realtime Subscriptions
  // --------------------------------------------------------------------------

  subscribeFleet(
    tables: string[],
    onChange: RealtimeChangeCallback
  ): () => void {
    let channel: RealtimeChannel | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    try {
      const channelName = `fleet-changes-${Date.now()}`;
      channel = this.client.channel(channelName);

      for (const table of tables) {
        channel = channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (payload) => {
            const ev = (payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE') || 'UPDATE';
            const row = (payload.new || payload.old || {}) as Record<string, unknown>;
            onChange(table, ev, row);
          }
        );
      }

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          DiagnosticLogger.info('SupabaseGateway', `Realtime subscribed to [${tables.join(', ')}]`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          DiagnosticLogger.warn(
            'SupabaseGateway',
            `Realtime channel ${status}, falling back to 30-second polling`
          );
          if (!fallbackInterval) {
            fallbackInterval = setInterval(() => {
              for (const table of tables) {
                onChange(table, 'UPDATE', {});
              }
            }, 30000);
          }
        }
      });
    } catch (err) {
      DiagnosticLogger.warn(
        'SupabaseGateway',
        `Realtime setup failed, starting 30s polling fallback: ${err instanceof Error ? err.message : String(err)}`
      );
      fallbackInterval = setInterval(() => {
        for (const table of tables) {
          onChange(table, 'UPDATE', {});
        }
      }, 30000);
    }

    return () => {
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
        fallbackInterval = null;
      }
      if (channel) {
        this.client.removeChannel(channel).catch(() => {});
        channel = null;
      }
    };
  }
}
