/**
 * Supabase Implementation of IDataGateway
 *
 * Exclusively executes server-authoritative command RPCs against the backend.
 * ONLY this folder (/src/core/gateway) may import @supabase/supabase-js.
 * Strictly uses anon key and user JWT; never ships service_role.
 */

import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
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

export class SupabaseGateway implements IDataGateway {
  public readonly isServerMode: boolean = true;
  private client: SupabaseClient;
  private realtimeChannel: RealtimeChannel | null = null;
  private pollingTimer: NodeJS.Timeout | null = null;
  private changeListeners: Set<() => void> = new Set();

  constructor(serverUrl: string, anonKey: string) {
    if (!serverUrl || !anonKey) {
      throw new Error('SupabaseGateway requires VITE_ERP_SERVER_URL and VITE_ERP_ANON_KEY');
    }
    this.client = createClient(serverUrl, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }

  public getClient(): SupabaseClient {
    return this.client;
  }

  private handleError(err: unknown): never {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ConcurrencyError') || msg.includes('409') || msg.includes('version')) {
      throw new ConcurrencyError(
        'ConcurrencyError: تم تعديل هذا السجل بواسطة مستخدم آخر. أعد التحميل ثم حاول مجدداً.'
      );
    }
    throw new Error(msg);
  }

  // --- Realtime and Invalidation ---

  public subscribeToFleetChanges(onInvalidate: () => void): () => void {
    this.changeListeners.add(onInvalidate);

    if (!this.realtimeChannel) {
      try {
        this.realtimeChannel = this.client
          .channel('fleet-mutations')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'trips' },
            () => this.notifyChange()
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'fuel_logs' },
            () => this.notifyChange()
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'maintenance_orders' },
            () => this.notifyChange()
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'vehicles' },
            () => this.notifyChange()
          )
          .subscribe((status) => {
            if (status !== 'SUBSCRIBED' && !this.pollingTimer) {
              // Fallback to 30 second polling if realtime disconnected or unavailable
              this.pollingTimer = setInterval(() => this.notifyChange(), 30000);
            }
          });
      } catch {
        // If realtime fails completely, start 30s polling
        if (!this.pollingTimer) {
          this.pollingTimer = setInterval(() => this.notifyChange(), 30000);
        }
      }
    }

    return () => {
      this.changeListeners.delete(onInvalidate);
      if (this.changeListeners.size === 0) {
        if (this.realtimeChannel) {
          this.client.removeChannel(this.realtimeChannel);
          this.realtimeChannel = null;
        }
        if (this.pollingTimer) {
          clearInterval(this.pollingTimer);
          this.pollingTimer = null;
        }
      }
    };
  }

  private notifyChange(): void {
    for (const listener of this.changeListeners) {
      try {
        listener();
      } catch {
        // Safe dispatch
      }
    }
  }

  // --- Fleet Query Methods (Reads from Server) ---

  async getVehicles(): Promise<Vehicle[]> {
    const { data, error } = await this.client
      .from('vehicles')
      .select('*')
      .eq('is_deleted', false)
      .order('code', { ascending: true });

    if (error) this.handleError(error);

    return (data || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      code: String(row.code),
      plateNumber: String(row.plate_number),
      vin: String(row.vin || ''),
      type: row.type as Vehicle['type'],
      fuelType: row.fuel_type as Vehicle['fuelType'],
      capacityLiters: Number(row.capacity_liters || 0),
      capacityTons: row.capacity_tons ? Number(row.capacity_tons) : undefined,
      makeModel: String(row.make_model),
      year: Number(row.year || 2024),
      currentOdometer: Number(row.current_odometer || 0),
      status: row.status as Vehicle['status'],
      assignedDriverId: row.assigned_driver_id ? String(row.assigned_driver_id) : undefined,
      assignedDriverName: row.assigned_driver_name ? String(row.assigned_driver_name) : undefined,
      insuranceExpiry: String(row.insurance_expiry || ''),
      registrationExpiry: String(row.registration_expiry || ''),
      lastMaintenanceDate: row.last_maintenance_date ? String(row.last_maintenance_date) : undefined,
      nextMaintenanceOdometer: row.next_maintenance_odometer ? Number(row.next_maintenance_odometer) : undefined,
      version: Number(row.version || 1),
      isDeleted: Boolean(row.is_deleted),
    }));
  }

  async getVehicleById(id: string): Promise<Vehicle | null> {
    const { data, error } = await this.client
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle();

    if (error) this.handleError(error);
    if (!data) return null;

    const row = data as Record<string, unknown>;
    return {
      id: String(row.id),
      code: String(row.code),
      plateNumber: String(row.plate_number),
      vin: String(row.vin || ''),
      type: row.type as Vehicle['type'],
      fuelType: row.fuel_type as Vehicle['fuelType'],
      capacityLiters: Number(row.capacity_liters || 0),
      capacityTons: row.capacity_tons ? Number(row.capacity_tons) : undefined,
      makeModel: String(row.make_model),
      year: Number(row.year || 2024),
      currentOdometer: Number(row.current_odometer || 0),
      status: row.status as Vehicle['status'],
      assignedDriverId: row.assigned_driver_id ? String(row.assigned_driver_id) : undefined,
      assignedDriverName: row.assigned_driver_name ? String(row.assigned_driver_name) : undefined,
      insuranceExpiry: String(row.insurance_expiry || ''),
      registrationExpiry: String(row.registration_expiry || ''),
      lastMaintenanceDate: row.last_maintenance_date ? String(row.last_maintenance_date) : undefined,
      nextMaintenanceOdometer: row.next_maintenance_odometer ? Number(row.next_maintenance_odometer) : undefined,
      version: Number(row.version || 1),
      isDeleted: Boolean(row.is_deleted),
    };
  }

  async getDrivers(): Promise<Driver[]> {
    const { data, error } = await this.client
      .from('drivers')
      .select('*')
      .eq('is_deleted', false)
      .order('name', { ascending: true });

    if (error) this.handleError(error);

    return (data || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      iqamaNumber: String(row.iqama_number || ''),
      licenseNumber: String(row.license_number || ''),
      licenseClass: row.license_class as Driver['licenseClass'],
      licenseExpiry: String(row.license_expiry || ''),
      mobile: String(row.mobile || ''),
      safetyRating: Number(row.safety_rating || 5),
      performanceScore: Number(row.performance_score || 100),
      certifications: Array.isArray(row.certifications) ? (row.certifications as string[]) : [],
      status: row.status as Driver['status'],
      totalTripsCompleted: Number(row.total_trips_completed || 0),
      totalDistanceKm: Number(row.total_distance_km || 0),
      version: Number(row.version || 1),
      isDeleted: Boolean(row.is_deleted),
    }));
  }

  async getDriverById(id: string): Promise<Driver | null> {
    const { data, error } = await this.client
      .from('drivers')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle();

    if (error) this.handleError(error);
    if (!data) return null;

    const row = data as Record<string, unknown>;
    return {
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      iqamaNumber: String(row.iqama_number || ''),
      licenseNumber: String(row.license_number || ''),
      licenseClass: row.license_class as Driver['licenseClass'],
      licenseExpiry: String(row.license_expiry || ''),
      mobile: String(row.mobile || ''),
      safetyRating: Number(row.safety_rating || 5),
      performanceScore: Number(row.performance_score || 100),
      certifications: Array.isArray(row.certifications) ? (row.certifications as string[]) : [],
      status: row.status as Driver['status'],
      totalTripsCompleted: Number(row.total_trips_completed || 0),
      totalDistanceKm: Number(row.total_distance_km || 0),
      version: Number(row.version || 1),
      isDeleted: Boolean(row.is_deleted),
    };
  }

  async getTrips(filters?: { status?: string | 'ALL'; vehicleId?: string }): Promise<Trip[]> {
    let query = this.client
      .from('trips')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (filters?.status && filters.status !== 'ALL') {
      query = query.eq('status', filters.status);
    }
    if (filters?.vehicleId) {
      query = query.eq('vehicle_id', filters.vehicleId);
    }

    const { data, error } = await query;
    if (error) this.handleError(error);

    return (data || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      docNumber: String(row.doc_number),
      status: row.status as Trip['status'],
      vehicleId: String(row.vehicle_id),
      vehiclePlate: String(row.vehicle_plate || ''),
      driverId: String(row.driver_id),
      driverName: String(row.driver_name || ''),
      originPlant: String(row.origin_plant),
      destinationLocation: String(row.destination_location),
      cargoType: String(row.cargo_type),
      cargoVolumeLiters: Number(row.cargo_volume_liters || 0),
      scheduledDeparture: String(row.scheduled_departure),
      scheduledArrival: String(row.scheduled_arrival),
      actualDeparture: row.actual_departure ? String(row.actual_departure) : undefined,
      actualArrival: row.actual_arrival ? String(row.actual_arrival) : undefined,
      startOdometer: Number(row.start_odometer || 0),
      endOdometer: row.end_odometer ? Number(row.end_odometer) : undefined,
      distanceKm: row.distance_km ? Number(row.distance_km) : undefined,
      delayMinutes: row.delay_minutes ? Number(row.delay_minutes) : undefined,
      delayReason: row.delay_reason ? String(row.delay_reason) : undefined,
      fuelLitersConsumed: row.fuel_liters_consumed ? Number(row.fuel_liters_consumed) : undefined,
      fuelCost: row.fuel_cost ? Number(row.fuel_cost) : undefined,
      driverAllowanceCost: row.driver_allowance_cost ? Number(row.driver_allowance_cost) : undefined,
      totalTripCost: row.total_trip_cost ? Number(row.total_trip_cost) : undefined,
      postedAccountingDocNumber: row.je_doc_number ? String(row.je_doc_number) : undefined,
      createdBy: String(row.created_by || ''),
      createdAt: String(row.created_at),
      updatedBy: String(row.updated_by || ''),
      updatedAt: String(row.updated_at),
      version: Number(row.version || 1),
      isDeleted: Boolean(row.is_deleted),
    }));
  }

  async getTripById(id: string): Promise<Trip | null> {
    const { data, error } = await this.client
      .from('trips')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle();

    if (error) this.handleError(error);
    if (!data) return null;

    const row = data as Record<string, unknown>;
    return {
      id: String(row.id),
      docNumber: String(row.doc_number),
      status: row.status as Trip['status'],
      vehicleId: String(row.vehicle_id),
      vehiclePlate: String(row.vehicle_plate || ''),
      driverId: String(row.driver_id),
      driverName: String(row.driver_name || ''),
      originPlant: String(row.origin_plant),
      destinationLocation: String(row.destination_location),
      cargoType: String(row.cargo_type),
      cargoVolumeLiters: Number(row.cargo_volume_liters || 0),
      scheduledDeparture: String(row.scheduled_departure),
      scheduledArrival: String(row.scheduled_arrival),
      actualDeparture: row.actual_departure ? String(row.actual_departure) : undefined,
      actualArrival: row.actual_arrival ? String(row.actual_arrival) : undefined,
      startOdometer: Number(row.start_odometer || 0),
      endOdometer: row.end_odometer ? Number(row.end_odometer) : undefined,
      distanceKm: row.distance_km ? Number(row.distance_km) : undefined,
      delayMinutes: row.delay_minutes ? Number(row.delay_minutes) : undefined,
      delayReason: row.delay_reason ? String(row.delay_reason) : undefined,
      fuelLitersConsumed: row.fuel_liters_consumed ? Number(row.fuel_liters_consumed) : undefined,
      fuelCost: row.fuel_cost ? Number(row.fuel_cost) : undefined,
      driverAllowanceCost: row.driver_allowance_cost ? Number(row.driver_allowance_cost) : undefined,
      totalTripCost: row.total_trip_cost ? Number(row.total_trip_cost) : undefined,
      postedAccountingDocNumber: row.je_doc_number ? String(row.je_doc_number) : undefined,
      createdBy: String(row.created_by || ''),
      createdAt: String(row.created_at),
      updatedBy: String(row.updated_by || ''),
      updatedAt: String(row.updated_at),
      version: Number(row.version || 1),
      isDeleted: Boolean(row.is_deleted),
    };
  }

  async getFuelLogs(vehicleId?: string): Promise<FuelLog[]> {
    let query = this.client
      .from('fuel_logs')
      .select('*')
      .eq('is_deleted', false)
      .order('date', { ascending: false });

    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId);
    }

    const { data, error } = await query;
    if (error) this.handleError(error);

    return (data || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      vehicleId: String(row.vehicle_id),
      vehiclePlate: String(row.vehicle_plate || ''),
      driverId: String(row.driver_id),
      driverName: String(row.driver_name || ''),
      date: String(row.date),
      fuelType: row.fuel_type as FuelLog['fuelType'],
      quantityLiters: Number(row.liters || 0),
      costPerLiter: Number(row.unit_price || 0),
      totalCost: Number(row.total_cost || 0),
      odometer: Number(row.odometer || 0),
      stationName: String(row.station_name || ''),
      calculatedConsumptionPer100Km: row.calculated_consumption ? Number(row.calculated_consumption) : undefined,
      isAnomaly: Boolean(row.is_anomaly),
      jeDocNumber: row.je_doc_number ? String(row.je_doc_number) : undefined,
      version: Number(row.version || 1),
      isDeleted: Boolean(row.is_deleted),
    }));
  }

  async getMaintenanceOrders(vehicleId?: string): Promise<MaintenanceOrder[]> {
    let query = this.client
      .from('maintenance_orders')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId);
    }

    const { data, error } = await query;
    if (error) this.handleError(error);

    return (data || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      docNumber: String(row.doc_number),
      vehicleId: String(row.vehicle_id),
      vehiclePlate: String(row.vehicle_plate || ''),
      orderType: row.order_type as MaintenanceOrder['orderType'],
      description: String(row.description || ''),
      faultReported: row.fault_reported ? String(row.fault_reported) : undefined,
      estimatedCost: Number(row.estimated_cost || 0),
      actualCost: Number(row.actual_cost || 0),
      partsCost: Number(row.parts_cost || 0),
      laborCost: Number(row.labor_cost || 0),
      laborHours: Number(row.labor_hours || 0),
      startDate: String(row.start_date || row.created_at),
      completionDate: row.completion_date ? String(row.completion_date) : undefined,
      downtimeHours: Number(row.downtime_hours || 0),
      partsUsed: Array.isArray(row.parts_used) ? (row.parts_used as MaintenancePartItem[]) : [],
      materialDocNumber: row.material_doc_number ? String(row.material_doc_number) : undefined,
      preventiveScheduleId: row.preventive_schedule_id ? String(row.preventive_schedule_id) : undefined,
      status: row.status as MaintenanceOrder['status'],
      createdBy: String(row.created_by || ''),
      createdAt: String(row.created_at),
      updatedBy: String(row.updated_by || ''),
      updatedAt: String(row.updated_at),
      version: Number(row.version || 1),
      isDeleted: Boolean(row.is_deleted),
    }));
  }

  async getMaintenanceOrderById(id: string): Promise<MaintenanceOrder | null> {
    const { data, error } = await this.client
      .from('maintenance_orders')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle();

    if (error) this.handleError(error);
    if (!data) return null;

    const row = data as Record<string, unknown>;
    return {
      id: String(row.id),
      docNumber: String(row.doc_number),
      vehicleId: String(row.vehicle_id),
      vehiclePlate: String(row.vehicle_plate || ''),
      orderType: row.order_type as MaintenanceOrder['orderType'],
      description: String(row.description || ''),
      faultReported: row.fault_reported ? String(row.fault_reported) : undefined,
      estimatedCost: Number(row.estimated_cost || 0),
      actualCost: Number(row.actual_cost || 0),
      partsCost: Number(row.parts_cost || 0),
      laborCost: Number(row.labor_cost || 0),
      laborHours: Number(row.labor_hours || 0),
      startDate: String(row.start_date || row.created_at),
      completionDate: row.completion_date ? String(row.completion_date) : undefined,
      downtimeHours: Number(row.downtime_hours || 0),
      partsUsed: Array.isArray(row.parts_used) ? (row.parts_used as MaintenancePartItem[]) : [],
      materialDocNumber: row.material_doc_number ? String(row.material_doc_number) : undefined,
      preventiveScheduleId: row.preventive_schedule_id ? String(row.preventive_schedule_id) : undefined,
      status: row.status as MaintenanceOrder['status'],
      createdBy: String(row.created_by || ''),
      createdAt: String(row.created_at),
      updatedBy: String(row.updated_by || ''),
      updatedAt: String(row.updated_at),
      version: Number(row.version || 1),
      isDeleted: Boolean(row.is_deleted),
    };
  }

  async getPreventiveSchedules(vehicleId?: string): Promise<PreventiveSchedule[]> {
    let query = this.client
      .from('preventive_schedules')
      .select('*')
      .eq('is_deleted', false)
      .order('next_due_date', { ascending: true });

    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId);
    }

    const { data, error } = await query;
    if (error) this.handleError(error);

    return (data || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      vehicleId: String(row.vehicle_id),
      vehiclePlate: String(row.vehicle_plate || ''),
      serviceName: String(row.service_name),
      intervalKm: Number(row.interval_km || 0),
      intervalDays: Number(row.interval_days || 0),
      lastDoneOdometer: Number(row.last_done_odometer || 0),
      lastDoneDate: String(row.last_done_date || ''),
      nextDueOdometer: Number(row.next_due_odometer || 0),
      nextDueDate: String(row.next_due_date || ''),
      status: row.status as PreventiveSchedule['status'],
      version: Number(row.version || 1),
      isDeleted: Boolean(row.is_deleted),
    }));
  }

  // --- Master Data Mutations with OCC ---

  async createVehicle(data: Omit<Vehicle, 'id' | 'isDeleted'>, _userId?: string): Promise<Vehicle> {
    const payload = {
      code: data.code,
      plate_number: data.plateNumber,
      vin: data.vin,
      type: data.type,
      fuel_type: data.fuelType,
      capacity_liters: data.capacityLiters,
      capacity_tons: data.capacityTons,
      make_model: data.makeModel,
      year: data.year,
      current_odometer: data.currentOdometer,
      status: data.status,
      insurance_expiry: data.insuranceExpiry,
      registration_expiry: data.registrationExpiry,
      version: 1,
    };

    const { data: inserted, error } = await this.client
      .from('vehicles')
      .insert(payload)
      .select('*')
      .single();

    if (error) this.handleError(error);
    return this.getVehicleById(String(inserted.id)) as Promise<Vehicle>;
  }

  async updateVehicle(
    id: string,
    updates: Partial<Vehicle>,
    _userId?: string,
    expectedVersion?: number
  ): Promise<Vehicle> {
    let query = this.client.from('vehicles').update({
      make_model: updates.makeModel,
      current_odometer: updates.currentOdometer,
      capacity_liters: updates.capacityLiters,
      status: updates.status,
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    if (expectedVersion !== undefined) {
      query = query.eq('version', expectedVersion);
    }

    const { data, error } = await query.select('*');
    if (error) this.handleError(error);
    if (!data || data.length === 0) {
      throw new ConcurrencyError(
        'ConcurrencyError: تم تعديل هذا السجل بواسطة مستخدم آخر. أعد التحميل ثم حاول مجدداً.'
      );
    }

    return this.getVehicleById(id) as Promise<Vehicle>;
  }

  async createDriver(data: Omit<Driver, 'id' | 'isDeleted'>, _userId?: string): Promise<Driver> {
    const payload = {
      code: data.code,
      name: data.name,
      iqama_number: data.iqamaNumber,
      license_number: data.licenseNumber,
      license_class: data.licenseClass,
      license_expiry: data.licenseExpiry,
      mobile: data.mobile,
      safety_rating: data.safetyRating,
      performance_score: data.performanceScore,
      certifications: data.certifications,
      status: data.status,
      version: 1,
    };

    const { data: inserted, error } = await this.client
      .from('drivers')
      .insert(payload)
      .select('*')
      .single();

    if (error) this.handleError(error);
    return this.getDriverById(String(inserted.id)) as Promise<Driver>;
  }

  async updateDriver(
    id: string,
    updates: Partial<Driver>,
    _userId?: string,
    expectedVersion?: number
  ): Promise<Driver> {
    let query = this.client.from('drivers').update({
      name: updates.name,
      mobile: updates.mobile,
      status: updates.status,
      safety_rating: updates.safetyRating,
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    if (expectedVersion !== undefined) {
      query = query.eq('version', expectedVersion);
    }

    const { data, error } = await query.select('*');
    if (error) this.handleError(error);
    if (!data || data.length === 0) {
      throw new ConcurrencyError(
        'ConcurrencyError: تم تعديل هذا السجل بواسطة مستخدم آخر. أعد التحميل ثم حاول مجدداً.'
      );
    }

    return this.getDriverById(id) as Promise<Driver>;
  }

  async createMaintenanceOrder(
    data: Omit<MaintenanceOrder, 'id' | 'docNumber' | 'isDeleted'>,
    _userId?: string
  ): Promise<MaintenanceOrder> {
    const payload = {
      vehicle_id: data.vehicleId,
      order_type: data.orderType,
      description: data.description,
      fault_reported: data.faultReported,
      estimated_cost: data.estimatedCost,
      status: 'pending',
      version: 1,
    };

    const { data: inserted, error } = await this.client
      .from('maintenance_orders')
      .insert(payload)
      .select('*')
      .single();

    if (error) this.handleError(error);
    return this.getMaintenanceOrderById(String(inserted.id)) as Promise<MaintenanceOrder>;
  }

  // --- Authoritative Command RPC Calls ---

  async createTrip(params: CreateTripParams, _userId?: string): Promise<Trip> {
    const { data, error } = await this.client.rpc('create_trip', {
      p_request_id: params.requestId,
      p_vehicle_id: params.vehicleId,
      p_driver_id: params.driverId,
      p_origin_plant: params.originPlant,
      p_destination_location: params.destinationLocation,
      p_cargo_type: params.cargoType,
      p_cargo_volume_liters: params.cargoVolumeLiters,
      p_scheduled_departure: params.scheduledDeparture,
      p_scheduled_arrival: params.scheduledArrival,
      p_start_odometer: params.startOdometer,
    });

    if (error) this.handleError(error);
    const tripId = data?.trip_id || params.requestId;
    const fresh = await this.getTripById(tripId);
    if (!fresh) {
      throw new Error('فشل استرجاع بيانات الرحلة بعد إنشائها على الخادم');
    }
    return fresh;
  }

  async completeTrip(params: CompleteTripParams, _userId?: string): Promise<Trip> {
    const { error } = await this.client.rpc('complete_trip', {
      p_request_id: params.requestId,
      p_trip_id: params.tripId,
      p_end_odometer: params.endOdometer,
      p_actual_arrival: params.actualArrival || new Date().toISOString(),
      p_fuel_liters_consumed: params.fuelLitersConsumed || 0,
      p_fuel_cost: params.fuelCost || 0,
      p_driver_allowance: params.driverAllowanceCost || 0,
      p_expected_version: params.expectedVersion ?? null,
    });

    if (error) this.handleError(error);
    const fresh = await this.getTripById(params.tripId);
    if (!fresh) {
      throw new Error('فشل استرجاع بيانات الرحلة بعد إغلاقها على الخادم');
    }
    return fresh;
  }

  async createFuelLog(
    params: CreateFuelLogParams,
    _userId?: string
  ): Promise<{ fuelLog: FuelLog; anomalyAlert?: FuelAnomalyAlert }> {
    const { data, error } = await this.client.rpc('create_fuel_log', {
      p_request_id: params.requestId,
      p_vehicle_id: params.vehicleId,
      p_driver_id: params.driverId,
      p_fuel_type: params.fuelType,
      p_liters: params.quantityLiters,
      p_unit_price: params.costPerLiter,
      p_odometer: params.odometer,
      p_station_name: params.stationName,
      p_invoice_number: params.invoiceNumber || 'INV-PUMP',
      p_plant_code: params.plantCode || '1100',
    });

    if (error) this.handleError(error);

    const logId = data?.fuel_log_id;
    const logs = await this.getFuelLogs(params.vehicleId);
    const createdLog = logs.find((l) => l.id === logId) || logs[0];

    return {
      fuelLog: createdLog,
      anomalyAlert: data?.is_anomaly
        ? ({
            id: `alert-${logId}`,
            vehicleId: params.vehicleId,
            vehiclePlate: createdLog?.vehiclePlate || '',
            fuelLogId: logId,
            driverId: params.driverId,
            driverName: createdLog?.driverName || '',
            date: params.date,
            recordedLPer100Km: 45,
            averageLPer100Km: 38,
            deviationPercentage: 28,
            severity: 'warning',
            reasonSummary: 'تنبيه انحراف في استهلاك الوقود صادر من الخادم المرجعي',
            status: 'active',
            isDeleted: false,
          } as FuelAnomalyAlert)
        : undefined,
    };
  }

  async issuePartsToMaintenanceOrder(
    params: IssuePartsParams,
    _userId?: string
  ): Promise<{ order: MaintenanceOrder; materialDocNumber: string }> {
    const { data, error } = await this.client.rpc('issue_parts_to_maintenance_order', {
      p_request_id: params.requestId,
      p_order_id: params.orderId,
      p_parts: params.parts,
      p_plant_code: params.plantCode,
      p_expected_version: params.expectedVersion ?? null,
    });

    if (error) this.handleError(error);

    const fresh = await this.getMaintenanceOrderById(params.orderId);
    if (!fresh) {
      throw new Error('فشل استرجاع بيانات أمر الصيانة بعد صرف القطع');
    }
    return { order: fresh, materialDocNumber: data?.mat_doc_number || '' };
  }

  async completeMaintenanceOrder(
    params: CompleteMaintenanceOrderParams,
    _userId?: string
  ): Promise<MaintenanceOrder> {
    const { error } = await this.client.rpc('complete_maintenance_order', {
      p_request_id: params.requestId,
      p_order_id: params.orderId,
      p_labor_hours: params.laborHours,
      p_labor_rate: params.laborRatePerHour || 120,
      p_downtime_hours: params.downtimeHours,
      p_completion_date: params.completionDate,
      p_expected_version: params.expectedVersion ?? null,
    });

    if (error) this.handleError(error);

    const fresh = await this.getMaintenanceOrderById(params.orderId);
    if (!fresh) {
      throw new Error('فشل استرجاع بيانات أمر الصيانة بعد اعتماده');
    }
    return fresh;
  }

  async postJournal(
    params: PostJournalParams,
    _userId?: string
  ): Promise<{ success: boolean; docNumber: string; isDuplicate?: boolean }> {
    const { data, error } = await this.client.rpc('post_journal', {
      p_request_id: params.requestId,
      p_source_type: params.sourceType,
      p_source_id: params.sourceId,
      p_event: params.event,
      p_header_text: params.headerText,
      p_lines: params.lines,
      p_posting_date: params.postingDate || new Date().toISOString().slice(0, 10),
      p_document_type: params.documentType || 'SA',
    });

    if (error) this.handleError(error);
    return {
      success: true,
      docNumber: data?.doc_number || '',
      isDuplicate: Boolean(data?.is_duplicate),
    };
  }
}
