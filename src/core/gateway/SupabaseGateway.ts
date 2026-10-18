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
      p_vehicle_id: cmd.vehicleId,
      p_driver_id: cmd.driverId,
      p_origin_plant: cmd.originPlant,
      p_destination_location: cmd.destinationLocation,
      p_cargo_type: cmd.cargoType,
      p_cargo_volume_liters: cmd.cargoVolumeLiters,
      p_scheduled_departure: cmd.scheduledDeparture,
      p_scheduled_arrival: cmd.scheduledArrival,
      p_start_odometer: cmd.startOdometer,
      p_request_id: cmd.requestId,
      p_expected_version: cmd.expectedVersion,
    });

    if (error) {
      this.handleRpcError(error, 'Trip', cmd.vehicleId, cmd.expectedVersion);
    }

    return data as Trip;
  }

  async completeTrip(cmd: CompleteTripCommand): Promise<Trip> {
    const { data, error } = await this.client.rpc('complete_trip', {
      p_trip_id: cmd.tripId,
      p_end_odometer: cmd.endOdometer,
      p_fuel_liters_consumed: cmd.fuelLitersConsumed,
      p_fuel_cost: cmd.fuelCost,
      p_driver_allowance_cost: cmd.driverAllowanceCost,
      p_actual_arrival: cmd.actualArrival,
      p_request_id: cmd.requestId,
      p_expected_version: cmd.expectedVersion,
    });

    if (error) {
      this.handleRpcError(error, 'Trip', cmd.tripId, cmd.expectedVersion);
    }

    return data as Trip;
  }

  async createFuelLog(cmd: CreateFuelLogCommand): Promise<FuelLog> {
    const occurredAt = cmd.occurredAt || new Date().toISOString();
    const { data, error } = await this.client.rpc('create_fuel_log', {
      p_request_id: cmd.requestId,
      p_vehicle_id: cmd.vehicleId,
      p_driver_id: cmd.driverId || null,
      p_fuel_type: cmd.fuelType,
      p_odometer: cmd.currentOdometer,
      p_quantity_liters: cmd.liters,
      p_cost_per_liter: cmd.cost && cmd.liters ? cmd.cost / cmd.liters : 0,
      p_station_name: cmd.vendorName || cmd.stationLocation || 'محطة المحروقات',
      p_date: occurredAt.substring(0, 10),
      p_expected_version: cmd.expectedVersion ?? null,
      p_occurred_at: occurredAt,
      p_liters: cmd.liters,
      p_unit_price: cmd.cost && cmd.liters ? cmd.cost / cmd.liters : 0,
      p_invoice_number: cmd.invoiceNumber || null,
    });

    if (error) {
      this.handleRpcError(error, 'FuelLog', cmd.vehicleId, cmd.expectedVersion);
    }

    return data as FuelLog;
  }

  async issuePartsToMaintenanceOrder(
    cmd: IssuePartsCommand
  ): Promise<{ order: MaintenanceOrder; materialDocNumber: string }> {
    const { data, error } = await this.client.rpc('issue_parts_to_maintenance_order', {
      p_order_id: cmd.orderId,
      p_plant_code: cmd.items?.[0]?.plantCode || '1100',
      p_parts: cmd.items,
      p_request_id: cmd.requestId,
      p_expected_version: cmd.expectedVersion,
    });

    if (error) {
      this.handleRpcError(error, 'MaintenanceOrder', cmd.orderId, cmd.expectedVersion);
    }

    return data as { order: MaintenanceOrder; materialDocNumber: string };
  }

  async completeMaintenanceOrder(cmd: CompleteMaintenanceOrderCommand): Promise<MaintenanceOrder> {
    const { data, error } = await this.client.rpc('complete_maintenance_order', {
      p_order_id: cmd.orderId,
      p_labor_hours: cmd.actualLaborHours,
      p_labor_rate_per_hour: cmd.actualLaborCost && cmd.actualLaborHours ? cmd.actualLaborCost / cmd.actualLaborHours : 0,
      p_downtime_hours: 0,
      p_completion_date: cmd.completionDate,
      p_request_id: cmd.requestId,
      p_expected_version: cmd.expectedVersion,
    });

    if (error) {
      this.handleRpcError(error, 'MaintenanceOrder', cmd.orderId, cmd.expectedVersion);
    }

    return data as MaintenanceOrder;
  }

  async postJournal(cmd: PostJournalCommand): Promise<{ docNumber: string; jeId: string }> {
    const { data, error } = await this.client.rpc('post_journal', {
      p_source_type: cmd.sourceType,
      p_source_id: cmd.sourceId,
      p_company_code: cmd.companyCode,
      p_fiscal_year: cmd.fiscalYear,
      p_period: cmd.period,
      p_posting_date: cmd.postingDate,
      p_document_date: cmd.documentDate,
      p_document_type: cmd.documentType,
      p_header_text: cmd.headerText,
      p_reference: cmd.reference,
      p_lines: cmd.lines,
      p_request_id: cmd.requestId,
      p_expected_version: cmd.expectedVersion,
    });

    if (error) {
      this.handleRpcError(error, 'JournalEntry', cmd.sourceId, cmd.expectedVersion);
    }

    return data as { docNumber: string; jeId: string };
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

    return data as { requestId: string; tripId: string; eventType: string };
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

    return data as { requestId: string; vehicleId: string; readingKm: number };
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

    return data as { requestId: string; vehicleId: string; result: string };
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
      p_make_model: vehicle.makeModel || `${vehicle.make || ''} ${vehicle.model || ''}`.trim(),
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

    return data as Vehicle;
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
      p_make_model: updates.makeModel ?? (updates.make || updates.model ? `${updates.make || ''} ${updates.model || ''}`.trim() : null),
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

    return data as Vehicle;
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

    return data as Vehicle;
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

    return data as Driver;
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

    return data as Driver;
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

    return data as Driver;
  }

  async createMaintenanceOrder(order: Partial<MaintenanceOrder>): Promise<MaintenanceOrder> {
    const { data, error } = await this.client.from('maintenance_orders').insert({
      vehicle_id: order.vehicleId,
      order_type: order.orderType,
      priority: order.priority || 'medium',
      plant_code: order.plantCode || '1100',
      description: order.description,
      scheduled_date: order.scheduledDate || new Date().toISOString(),
      status: 'pending',
      version: 1,
    }).select().single();

    if (error) {
      this.handleRpcError(error, 'MaintenanceOrder', order.vehicleId || 'new');
    }

    return data as MaintenanceOrder;
  }

  // --------------------------------------------------------------------------
  // Fleet Query Methods
  // --------------------------------------------------------------------------

  async getVehicles(filters?: VehicleFilters): Promise<Vehicle[]> {
    let query = this.client.from('vehicles').select('*').eq('is_deleted', false);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.vehicleType) query = query.eq('type', filters.vehicleType);
    if (filters?.assignedPlant) query = query.eq('plant_code', filters.assignedPlant);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data as Vehicle[];
  }

  async getVehicleById(id: string): Promise<Vehicle | null> {
    const { data, error } = await this.client.from('vehicles').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data as Vehicle | null;
  }

  async getDrivers(filters?: DriverFilters): Promise<Driver[]> {
    let query = this.client.from('drivers').select('*').eq('is_deleted', false);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.assignedPlant) query = query.eq('plant_code', filters.assignedPlant);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data as Driver[];
  }

  async getDriverById(id: string): Promise<Driver | null> {
    const { data, error } = await this.client.from('drivers').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data as Driver | null;
  }

  async getTrips(filters?: TripFilters): Promise<Trip[]> {
    let query = this.client.from('trips').select('*').eq('is_deleted', false);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.vehicleId) query = query.eq('vehicle_id', filters.vehicleId);
    if (filters?.driverId) query = query.eq('driver_id', filters.driverId);
    if (filters?.originPlant) query = query.eq('origin_plant', filters.originPlant);
    if (filters?.startDate) query = query.gte('scheduled_departure', filters.startDate);
    if (filters?.endDate) query = query.lte('scheduled_departure', filters.endDate);

    const { data, error } = await query.order('scheduled_departure', { ascending: false });
    if (error) throw new Error(error.message);
    return data as Trip[];
  }

  async getTripById(id: string): Promise<Trip | null> {
    const { data, error } = await this.client.from('trips').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data as Trip | null;
  }

  async getFuelLogs(filtersOrVehicleId?: string | FuelLogFilters): Promise<FuelLog[]> {
    let query = this.client.from('fuel_logs').select('*').eq('is_deleted', false);
    if (typeof filtersOrVehicleId === 'string') {
      query = query.eq('vehicle_id', filtersOrVehicleId);
    } else if (filtersOrVehicleId) {
      if (filtersOrVehicleId.vehicleId) query = query.eq('vehicle_id', filtersOrVehicleId.vehicleId);
      if (filtersOrVehicleId.driverId) query = query.eq('driver_id', filtersOrVehicleId.driverId);
      if (filtersOrVehicleId.startDate) query = query.gte('date', filtersOrVehicleId.startDate);
      if (filtersOrVehicleId.endDate) query = query.lte('date', filtersOrVehicleId.endDate);
    }

    const { data, error } = await query.order('odometer', { ascending: false });
    if (error) throw new Error(error.message);
    return data as FuelLog[];
  }

  async getPaginatedFuelLogs(filters: FuelLogFilters): Promise<PaginatedResult<FuelLog>> {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 25;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.client.from('fuel_logs').select('*', { count: 'exact' }).eq('is_deleted', false);
    if (filters.vehicleId) query = query.eq('vehicle_id', filters.vehicleId);
    if (filters.driverId) query = query.eq('driver_id', filters.driverId);
    if (filters.startDate) query = query.gte('date', filters.startDate);
    if (filters.endDate) query = query.lte('date', filters.endDate);

    const { data, count, error } = await query.order('odometer', { ascending: false }).range(from, to);
    if (error) throw new Error(error.message);

    const totalCount = count || 0;
    return {
      data: (data || []) as FuelLog[],
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  }

  async getMaintenanceOrders(filtersOrVehicleId?: string | MaintenanceFilters): Promise<MaintenanceOrder[]> {
    let query = this.client.from('maintenance_orders').select('*').eq('is_deleted', false);
    if (typeof filtersOrVehicleId === 'string') {
      query = query.eq('vehicle_id', filtersOrVehicleId);
    } else if (filtersOrVehicleId) {
      if (filtersOrVehicleId.vehicleId) query = query.eq('vehicle_id', filtersOrVehicleId.vehicleId);
      if (filtersOrVehicleId.status) query = query.eq('status', filtersOrVehicleId.status);
      if (filtersOrVehicleId.orderType) query = query.eq('order_type', filtersOrVehicleId.orderType);
    }

    const { data, error } = await query.order('scheduled_date', { ascending: false });
    if (error) throw new Error(error.message);
    return data as MaintenanceOrder[];
  }

  async getMaintenanceOrderById(id: string): Promise<MaintenanceOrder | null> {
    const { data, error } = await this.client.from('maintenance_orders').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data as MaintenanceOrder | null;
  }

  async getPreventiveSchedules(vehicleId?: string): Promise<PreventiveSchedule[]> {
    let query = this.client.from('preventive_schedules').select('*').eq('is_active', true);
    if (vehicleId) query = query.eq('vehicle_id', vehicleId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data as PreventiveSchedule[];
  }

  async getFuelAnomalyAlerts(): Promise<FuelAnomalyAlert[]> {
    const { data, error } = await this.client.from('fuel_anomaly_alerts').select('*').eq('is_resolved', false);
    if (error) throw new Error(error.message);
    return data as FuelAnomalyAlert[];
  }

  async resolveFuelAnomalyAlert(id: string, notes: string): Promise<void> {
    const { error } = await this.client
      .from('fuel_anomaly_alerts')
      .update({ is_resolved: true, resolution_notes: notes, resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async getVehicleExpiryAlerts(): Promise<ExpiryAlert[]> {
    const { data, error } = await this.client.rpc('get_vehicle_expiry_alerts', { p_days_ahead: 30 });
    if (error) throw new Error(error.message);
    return (data || []) as ExpiryAlert[];
  }

  async getVehicleCostReport(vehicleId: string): Promise<VehicleCostReport> {
    const { data, error } = await this.client.rpc('get_vehicle_cost_report', { p_vehicle_id: vehicleId });
    if (error) throw new Error(error.message);
    return data as VehicleCostReport;
  }

  async getCostCenterFleetReconciliation(): Promise<CostCenterReconciliation[]> {
    const { data, error } = await this.client.from('v_cost_center_fleet_reconciliation').select('*');
    if (error) throw new Error(error.message);
    return (data || []) as CostCenterReconciliation[];
  }

  async getFleetDashboardKPIs(): Promise<FleetSummaryKPIs> {
    const { data, error } = await this.client.rpc('get_fleet_dashboard_kpis');
    if (error) throw new Error(error.message);
    return data as FleetSummaryKPIs;
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
