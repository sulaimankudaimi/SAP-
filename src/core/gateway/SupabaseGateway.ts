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
  User,
  Role,
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
  RealtimeChangeCallback,
} from './IDataGateway';
import { getServerUrl, getServerAnonKey } from './connectivity';
import { ConcurrencyError } from '../errors/ConcurrencyError';
import { DiagnosticLogger } from '../services/DiagnosticLogger';
import { SessionContext } from '../security/SessionContext';
import { useAuthStore } from '../auth/useAuthStore';
import type { AuthSession } from '../services/AuthService';

interface ProfileRow {
  id: string;
  username: string;
  full_name?: string;
  role_code: string;
  role_name?: string;
  assigned_plants?: string[];
  company_code?: string;
  must_change_password?: boolean;
  is_locked?: boolean;
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

    // Safe custom storage wrapper with try/catch to satisfy storage security requirements
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
          // Ignore write failure
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

  getSupabaseClient(): SupabaseClient {
    return this.client;
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  // Helper to handle and map RPC errors
  private handleRpcError(err: unknown, entityName: string, entityId: string, expectedVersion?: number): never {
    const msg = err instanceof Error ? err.message : String(err);
    const isConflict =
      msg.includes('conflict') ||
      msg.includes('concurrency') ||
      msg.includes('version mismatch') ||
      msg.includes('P0001') ||
      msg.includes('تعارض');

    if (isConflict && expectedVersion !== undefined) {
      throw new ConcurrencyError({
        entityName,
        entityId,
        expectedVersion,
        message: msg,
      });
    }

    throw new Error(msg);
  }

  // 1. Command: createTrip -> RPC create_trip
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

  // 2. Command: completeTrip -> RPC complete_trip
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

  // 3. Command: createFuelLog -> RPC create_fuel_log
  async createFuelLog(cmd: CreateFuelLogCommand): Promise<FuelLog> {
    const { data, error } = await this.client.rpc('create_fuel_log', {
      p_vehicle_id: cmd.vehicleId,
      p_driver_id: cmd.driverId,
      p_fuel_type: cmd.fuelType,
      p_date: cmd.date,
      p_odometer: cmd.odometer,
      p_quantity_liters: cmd.quantityLiters,
      p_cost_per_liter: cmd.costPerLiter,
      p_station_name: cmd.stationName,
      p_request_id: cmd.requestId,
      p_expected_version: cmd.expectedVersion,
    });

    if (error) {
      this.handleRpcError(error, 'FuelLog', cmd.vehicleId, cmd.expectedVersion);
    }

    return data as FuelLog;
  }

  // 4. Command: issuePartsToMaintenanceOrder -> RPC issue_parts_to_maintenance_order
  async issuePartsToMaintenanceOrder(
    cmd: IssuePartsCommand
  ): Promise<{ order: MaintenanceOrder; materialDocNumber: string }> {
    const { data, error } = await this.client.rpc('issue_parts_to_maintenance_order', {
      p_order_id: cmd.orderId,
      p_plant_code: cmd.plantCode,
      p_parts: cmd.parts,
      p_request_id: cmd.requestId,
      p_expected_version: cmd.expectedVersion,
    });

    if (error) {
      this.handleRpcError(error, 'MaintenanceOrder', cmd.orderId, cmd.expectedVersion);
    }

    const res = data as { order: MaintenanceOrder; materialDocNumber: string };
    return res;
  }

  // 5. Command: completeMaintenanceOrder -> RPC complete_maintenance_order
  async completeMaintenanceOrder(cmd: CompleteMaintenanceOrderCommand): Promise<MaintenanceOrder> {
    const { data, error } = await this.client.rpc('complete_maintenance_order', {
      p_order_id: cmd.orderId,
      p_labor_hours: cmd.laborHours,
      p_labor_rate_per_hour: cmd.laborRatePerHour,
      p_downtime_hours: cmd.downtimeHours,
      p_completion_date: cmd.completionDate,
      p_request_id: cmd.requestId,
      p_expected_version: cmd.expectedVersion,
    });

    if (error) {
      this.handleRpcError(error, 'MaintenanceOrder', cmd.orderId, cmd.expectedVersion);
    }

    return data as MaintenanceOrder;
  }

  // 6. Command: postJournal -> RPC post_journal
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

    const res = data as { docNumber: string; jeId: string };
    return res;
  }

  // Fleet Queries
  async getVehicles(filters?: VehicleFilters): Promise<Vehicle[]> {
    let query = this.client.from('vehicles').select('*');
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.vehicleType) query = query.eq('vehicle_type', filters.vehicleType);
    if (filters?.assignedPlant) query = query.eq('assigned_plant', filters.assignedPlant);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []) as Vehicle[];
  }

  async getVehicleById(id: string): Promise<Vehicle | null> {
    const { data, error } = await this.client.from('vehicles').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Vehicle) ?? null;
  }

  async getDrivers(filters?: DriverFilters): Promise<Driver[]> {
    let query = this.client.from('drivers').select('*');
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.assignedPlant) query = query.eq('assigned_plant', filters.assignedPlant);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []) as Driver[];
  }

  async getDriverById(id: string): Promise<Driver | null> {
    const { data, error } = await this.client.from('drivers').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Driver) ?? null;
  }

  async getTrips(filters?: TripFilters): Promise<Trip[]> {
    let query = this.client.from('trips').select('*').order('created_at', { ascending: false });
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.vehicleId) query = query.eq('vehicle_id', filters.vehicleId);
    if (filters?.driverId) query = query.eq('driver_id', filters.driverId);
    if (filters?.originPlant) query = query.eq('origin_plant', filters.originPlant);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []) as Trip[];
  }

  async getTripById(id: string): Promise<Trip | null> {
    const { data, error } = await this.client.from('trips').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Trip) ?? null;
  }

  async getFuelLogs(vehicleId?: string): Promise<FuelLog[]> {
    let query = this.client.from('fuel_logs').select('*').order('date', { ascending: false });
    if (vehicleId) query = query.eq('vehicle_id', vehicleId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []) as FuelLog[];
  }

  async getMaintenanceOrders(filtersOrVehicleId?: string | MaintenanceFilters): Promise<MaintenanceOrder[]> {
    const vehicleId = typeof filtersOrVehicleId === 'string' ? filtersOrVehicleId : filtersOrVehicleId?.vehicleId;
    let query = this.client.from('maintenance_orders').select('*').order('created_at', { ascending: false });
    if (vehicleId) query = query.eq('vehicle_id', vehicleId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []) as MaintenanceOrder[];
  }

  async getMaintenanceOrderById(id: string): Promise<MaintenanceOrder | null> {
    const { data, error } = await this.client.from('maintenance_orders').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as MaintenanceOrder) ?? null;
  }

  async getPreventiveSchedules(vehicleId?: string): Promise<PreventiveSchedule[]> {
    let query = this.client.from('preventive_schedules').select('*');
    if (vehicleId) query = query.eq('vehicle_id', vehicleId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []) as PreventiveSchedule[];
  }

  async getFuelAnomalyAlerts(): Promise<FuelAnomalyAlert[]> {
    const { data, error } = await this.client.from('fuel_anomaly_alerts').select('*').order('date', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []) as FuelAnomalyAlert[];
  }

  async getVehicleExpiryAlerts(): Promise<ExpiryAlert[]> {
    const { data, error } = await this.client.rpc('get_vehicle_expiry_alerts');
    if (error) throw new Error(error.message);
    return (data || []) as ExpiryAlert[];
  }

  async getVehicleCostReport(vehicleId: string): Promise<VehicleCostReport> {
    const { data, error } = await this.client.rpc('get_vehicle_cost_report', { p_vehicle_id: vehicleId });
    if (error) throw new Error(error.message);
    return data as VehicleCostReport;
  }

  async getPaginatedFuelLogs(filters: import('./IDataGateway').FuelLogFilters): Promise<import('./IDataGateway').PaginatedResult<FuelLog>> {
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.max(1, Math.min(200, filters.pageSize || 25));
    const offset = (page - 1) * pageSize;

    let query = this.client
      .from('fuel_logs')
      .select('*', { count: 'exact' })
      .order('date', { ascending: false });

    if (filters.vehicleId) {
      query = query.eq('vehicle_id', filters.vehicleId);
    }
    if (filters.search && filters.search.trim()) {
      query = query.ilike('vehicle_plate', `%${filters.search.trim()}%`);
    }

    const { data, count, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);

    const totalCount = count || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    return {
      data: (data || []) as FuelLog[],
      totalCount,
      page,
      pageSize,
      totalPages,
    };
  }

  async getCostCenterFleetReconciliation(): Promise<import('./IDataGateway').CostCenterReconciliation[]> {
    const { data, error } = await this.client.from('v_cost_center_fleet_reconciliation').select('*');
    if (error) throw new Error(error.message);
    return (data || []).map((row: Record<string, unknown>) => ({
      costCenter: String(row.cost_center || ''),
      totalFuel: Number(row.total_fuel || 0),
      totalMaintenance: Number(row.total_maintenance || 0),
      totalAllowance: Number(row.total_allowance || 0),
      operationalTotalCost: Number(row.operational_total_cost || 0),
      journalTotalDebit: Number(row.journal_total_debit || 0),
      variance: Number(row.variance || 0),
    }));
  }

  async getFleetDashboardKPIs(): Promise<FleetSummaryKPIs> {
    const { data, error } = await this.client.rpc('get_fleet_dashboard_kpis');
    if (error) throw new Error(error.message);
    return data as FleetSummaryKPIs;
  }

  // Authentication against Supabase Auth
  async signIn(username: string, password: string): Promise<AuthSession> {
    const syntheticEmail = `${username.toLowerCase().trim()}@erp.local`;

    const { data: authData, error: authError } = await this.client.auth.signInWithPassword({
      email: syntheticEmail,
      password,
    });

    if (authError || !authData.user) {
      throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة، أو تعذر الاتصال بالخادم.');
    }

    // Load profile (roles and plants) from profiles table
    const { data: profileData, error: profileError } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profileError || !profileData) {
      throw new Error('لم يتم العثور على ملف تعريف المستخدم أو الصلاحيات على الخادم.');
    }

    const profile = profileData as ProfileRow;
    const role: Role = {
      id: `role-${profile.role_code.toLowerCase()}`,
      code: profile.role_code,
      name: profile.role_name || profile.role_code,
      description: `الدور الوظيفي للمستخدم: ${profile.role_code}`,
      permissionCodes: [],
      isSystem: false,
      isDeleted: false,
    };

    const user: User = {
      id: profile.id,
      username: profile.username || username,
      fullName: profile.full_name || username,
      email: `${profile.username || username}@erp.local`,
      roleId: role.id,
      roleCode: profile.role_code,
      roleName: role.name,
      companyCode: profile.company_code || '1000',
      plantCode: profile.assigned_plants?.[0] || '1100',
      isLocked: Boolean(profile.is_locked),
      mustChangePassword: Boolean(profile.must_change_password),
      passwordHash: '',
      passwordSalt: '',
      failedLoginAttempts: 0,
      createdAt: authData.user.created_at || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      isDeleted: false,
    };

    const session: AuthSession = {
      user,
      role,
      token: authData.session?.access_token || '',
      expiresAt: (authData.session?.expires_at ? authData.session.expires_at * 1000 : Date.now() + 8 * 3600 * 1000),
    };

    // Set actor context with server profile
    SessionContext.setActor({
      userId: user.id,
      username: user.username,
      role,
    });

    useAuthStore.getState().setSession(session);

    return session;
  }

  async signOut(): Promise<void> {
    try {
      await this.client.auth.signOut();
    } catch {
      // Ignore
    }
    useAuthStore.getState().logout();
  }

  async changePassword(userId: string, _currentPassword: string, newPassword: string): Promise<void> {
    const { error: updateError } = await this.client.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      throw new Error(`فشل تحديث كلمة المرور على الخادم: ${updateError.message}`);
    }

    // Clear must_change_password flag in profile
    await this.client.from('profiles').update({ must_change_password: false }).eq('id', userId);
  }

  async restoreSession(): Promise<AuthSession | null> {
    try {
      const { data } = await this.client.auth.getSession();
      if (!data.session?.user) return null;

      const { data: profile } = await this.client
        .from('profiles')
        .select('*')
        .eq('id', data.session.user.id)
        .maybeSingle();

      if (!profile) return null;

      const p = profile as ProfileRow;
      const role: Role = {
        id: `role-${p.role_code.toLowerCase()}`,
        code: p.role_code,
        name: p.role_name || p.role_code,
        description: `الدور: ${p.role_code}`,
        permissionCodes: [],
        isSystem: false,
        isDeleted: false,
      };

      const user: User = {
        id: p.id,
        username: p.username,
        fullName: p.full_name || p.username,
        email: `${p.username}@erp.local`,
        roleId: role.id,
        roleCode: p.role_code,
        roleName: role.name,
        companyCode: p.company_code || '1000',
        plantCode: p.assigned_plants?.[0] || '1100',
        isLocked: Boolean(p.is_locked),
        mustChangePassword: Boolean(p.must_change_password),
        passwordHash: '',
        passwordSalt: '',
        failedLoginAttempts: 0,
        createdAt: data.session.user.created_at || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        isDeleted: false,
      };

      const session: AuthSession = {
        user,
        role,
        token: data.session.access_token,
        expiresAt: data.session.expires_at ? data.session.expires_at * 1000 : Date.now() + 8 * 3600 * 1000,
      };

      SessionContext.setActor({
        userId: user.id,
        username: user.username,
        role,
      });

      return session;
    } catch {
      return null;
    }
  }

  // Realtime Subscriptions with 30-Second Polling Fallback
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

    // Return strict subscription cleanup
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
