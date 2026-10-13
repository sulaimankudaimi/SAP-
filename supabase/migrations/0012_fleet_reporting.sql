-- ============================================================================
-- Migration: 0012_fleet_reporting.sql
-- Description: Server-authoritative fleet reporting objects:
--              1. fuel_anomaly_alerts table & automatic rolling 10-log deviation trigger
--              2. resolve_fuel_anomaly_alert RPC
--              3. get_vehicle_expiry_alerts(p_days int default 30) RPC
--              4. get_vehicle_cost_report(p_vehicle_id uuid default null) RPC
--              5. get_fleet_dashboard_kpis() RPC
--              6. RLS and security privileges
-- Database: PostgreSQL 15+ (Supabase / Self-Hosted)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table: fuel_anomaly_alerts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fuel_anomaly_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    "vehiclePlate" text NOT NULL,
    vehicle_plate text GENERATED ALWAYS AS ("vehiclePlate") STORED,
    fuel_log_id uuid NOT NULL REFERENCES public.fuel_logs(id) ON DELETE CASCADE,
    date date NOT NULL,
    liters numeric(18,3) NOT NULL,
    "recordedLPer100Km" numeric(18,2) NOT NULL,
    recorded_l_per_100km numeric(18,2) GENERATED ALWAYS AS ("recordedLPer100Km") STORED,
    "averageLPer100Km" numeric(18,2) NOT NULL,
    average_l_per_100km numeric(18,2) GENERATED ALWAYS AS ("averageLPer100Km") STORED,
    "deviationPercentage" numeric(18,2) NOT NULL,
    deviation_percentage numeric(18,2) GENERATED ALWAYS AS ("deviationPercentage") STORED,
    severity text NOT NULL CHECK (severity IN ('warning', 'critical')),
    "reasonSummary" text NOT NULL,
    reason_summary text GENERATED ALWAYS AS ("reasonSummary") STORED,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'investigated', 'resolved')),
    resolved_notes text,
    is_deleted boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_fuel_anomaly_per_log UNIQUE (fuel_log_id)
);

CREATE INDEX IF NOT EXISTS idx_fuel_anomaly_alerts_date ON public.fuel_anomaly_alerts(date DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_anomaly_alerts_vehicle ON public.fuel_anomaly_alerts(vehicle_id, status);

ALTER TABLE public.fuel_anomaly_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_fuel_anomaly_alerts_select ON public.fuel_anomaly_alerts
    FOR SELECT TO authenticated
    USING (public.has_permission('TM', 'view'));

-- ----------------------------------------------------------------------------
-- 2. Trigger Function: Automatically evaluate rolling 10-log consumption & log anomalies
-- Deviations exceeding 25% create a row in fuel_anomaly_alerts
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_check_fuel_anomaly()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_prev_log RECORD;
    v_vehicle RECORD;
    v_distance numeric(18,2);
    v_recorded_rate numeric(18,2);
    v_avg_rate numeric(18,2);
    v_deviation_pct numeric(18,2);
    v_severity text := 'warning';
    v_summary text;
BEGIN
    SELECT * INTO v_vehicle FROM public.vehicles WHERE id = NEW.vehicle_id;
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    -- Find the immediately preceding fuel log for this vehicle
    SELECT * INTO v_prev_log
    FROM public.fuel_logs
    WHERE vehicle_id = NEW.vehicle_id
      AND id <> NEW.id
      AND logged_at < NEW.logged_at
    ORDER BY logged_at DESC
    LIMIT 1;

    IF FOUND AND v_prev_log.odometer IS NOT NULL AND NEW.odometer > v_prev_log.odometer THEN
        v_distance := NEW.odometer - v_prev_log.odometer;

        IF v_distance > 0 THEN
            v_recorded_rate := round((NEW.liters / v_distance) * 100.0, 2);

            -- Calculate average consumption over the last 10 logs (excluding current)
            WITH recent_logs AS (
                SELECT
                    liters,
                    odometer,
                    LAG(odometer) OVER (ORDER BY logged_at ASC) AS prev_odo
                FROM (
                    SELECT liters, odometer, logged_at
                    FROM public.fuel_logs
                    WHERE vehicle_id = NEW.vehicle_id AND id <> NEW.id
                    ORDER BY logged_at DESC
                    LIMIT 10
                ) sub
            )
            SELECT round(AVG((liters / NULLIF(odometer - prev_odo, 0)) * 100.0), 2)
            INTO v_avg_rate
            FROM recent_logs
            WHERE odometer > prev_odo;

            IF v_avg_rate IS NOT NULL AND v_avg_rate > 0 THEN
                v_deviation_pct := round(((v_recorded_rate - v_avg_rate) / v_avg_rate) * 100.0, 2);

                -- Flag anomaly if consumption exceeds average by more than 25%
                IF v_deviation_pct > 25.0 THEN
                    IF v_deviation_pct > 40.0 THEN
                        v_severity := 'critical';
                    END IF;

                    v_summary := 'شذوذ استهلاك وقود بنسبة +' || v_deviation_pct::text ||
                                 '% مقارنة بمتوسط آخر 10 عمليات تسجيل (' || v_avg_rate::text || ' لتر/100كم)';

                    INSERT INTO public.fuel_anomaly_alerts (
                        vehicle_id, "vehiclePlate", fuel_log_id,
                        date, liters, "recordedLPer100Km",
                        "averageLPer100Km", "deviationPercentage",
                        severity, "reasonSummary", status
                    ) VALUES (
                        NEW.vehicle_id, v_vehicle.plate_number, NEW.id,
                        NEW.logged_at::date, NEW.liters, v_recorded_rate,
                        v_avg_rate, v_deviation_pct,
                        v_severity, v_summary, 'active'
                    ) ON CONFLICT (fuel_log_id) DO NOTHING;

                    -- Update fuel log anomaly flag
                    UPDATE public.fuel_logs
                    SET is_anomaly = true,
                        anomaly_reason = v_summary
                    WHERE id = NEW.id;
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fuel_logs_check_anomaly ON public.fuel_logs;
CREATE TRIGGER trg_fuel_logs_check_anomaly
    AFTER INSERT ON public.fuel_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_check_fuel_anomaly();

-- ----------------------------------------------------------------------------
-- 3. Command: resolve_fuel_anomaly_alert
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_fuel_anomaly_alert(
    p_id uuid,
    p_notes text
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF NOT public.has_permission('TM', 'change') THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية اعتماد وتسوية تنبيهات الوقود';
    END IF;

    UPDATE public.fuel_anomaly_alerts
    SET status = 'resolved',
        resolved_notes = p_notes
    WHERE id = p_id;

    PERFORM public.log_audit_event(
        'UPDATE',
        'FuelAnomalyAlert',
        p_id::text,
        jsonb_build_object('status', 'active'),
        jsonb_build_object('status', 'resolved', 'notes', p_notes),
        v_user_id
    );

    RETURN true;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Query RPC: get_vehicle_expiry_alerts(p_days int default 30)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_vehicle_expiry_alerts(
    p_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_results jsonb := '[]'::jsonb;
    v_alert RECORD;
BEGIN
    IF NOT public.has_permission('TM', 'view') THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية استعراض تنبيهات وثائق الأسطول';
    END IF;

    FOR v_alert IN
        SELECT
            'exp-ins-' || id::text AS id,
            id::text AS "vehicleId",
            plate_number AS "vehiclePlate",
            code AS "vehicleCode",
            'insurance' AS "alertType",
            'وثيقة تأمين المركبة' AS title,
            insurance_expiry::text AS "expiryDate",
            (insurance_expiry - current_date)::integer AS "daysRemaining",
            (insurance_expiry < current_date) AS "isExpired"
        FROM public.vehicles
        WHERE is_deleted = false
          AND insurance_expiry IS NOT NULL
          AND insurance_expiry <= (current_date + (p_days || ' days')::interval)
        UNION ALL
        SELECT
            'exp-reg-' || id::text AS id,
            id::text AS "vehicleId",
            plate_number AS "vehiclePlate",
            code AS "vehicleCode",
            'registration' AS "alertType",
            'رخصة سير المركبة (الاستمارة)' AS title,
            registration_expiry::text AS "expiryDate",
            (registration_expiry - current_date)::integer AS "daysRemaining",
            (registration_expiry < current_date) AS "isExpired"
        FROM public.vehicles
        WHERE is_deleted = false
          AND registration_expiry IS NOT NULL
          AND registration_expiry <= (current_date + (p_days || ' days')::interval)
        ORDER BY "daysRemaining" ASC
    LOOP
        v_results := v_results || to_jsonb(v_alert);
    END LOOP;

    RETURN v_results;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Query RPC: get_vehicle_cost_report(p_vehicle_id uuid default null)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_vehicle_cost_report(
    p_vehicle_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_rec RECORD;
    v_target_id uuid := p_vehicle_id;
    v_result jsonb;
BEGIN
    IF NOT public.has_permission('TM', 'view') THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية استعراض تقارير تكاليف الأسطول';
    END IF;

    -- If no target provided, pick first active vehicle
    IF v_target_id IS NULL THEN
        SELECT id INTO v_target_id FROM public.vehicles WHERE is_deleted = false LIMIT 1;
    END IF;

    IF v_target_id IS NULL THEN
        RETURN jsonb_build_object(
            'vehicleId', '',
            'vehiclePlate', '',
            'vehicleCode', '',
            'makeModel', '',
            'totalDistanceKm', 0,
            'fuelCostTotal', 0,
            'partsCostTotal', 0,
            'laborCostTotal', 0,
            'maintenanceCostTotal', 0,
            'driverAllowanceTotal', 0,
            'depreciationCostTotal', 0,
            'depreciationNote', 'الاستهلاك لا يحتسب على الخادم بل في المعالجة المحلية المستقلة (Depreciation is calculated offline and not part of server mode)',
            'grandTotalCost', 0,
            'costPerKm', 0
        );
    END IF;

    SELECT
        v.id AS vehicle_id,
        v.plate_number AS vehicle_plate,
        v.code AS vehicle_code,
        v.make_model,
        COALESCE(ts.distance_km, v.current_odometer, 0.00)::numeric(18,2) AS total_distance_km,
        COALESCE(fs.fuel_cost, 0.00)::numeric(18,2) AS fuel_cost,
        COALESCE(ms.parts_cost, 0.00)::numeric(18,2) AS parts_cost,
        COALESCE(ms.labor_cost, 0.00)::numeric(18,2) AS labor_cost,
        COALESCE(ms.actual_cost, 0.00)::numeric(18,2) AS maintenance_cost,
        COALESCE(ts.allowance_cost, 0.00)::numeric(18,2) AS driver_allowance,
        (COALESCE(fs.fuel_cost, 0.00) + COALESCE(ms.actual_cost, 0.00) + COALESCE(ts.allowance_cost, 0.00))::numeric(18,2) AS grand_total
    INTO v_rec
    FROM public.vehicles v
    LEFT JOIN (
        SELECT vehicle_id, SUM(distance_km) AS distance_km, SUM(driver_allowance_cost) AS allowance_cost
        FROM public.trips WHERE status = 'completed' AND is_deleted = false
        GROUP BY vehicle_id
    ) ts ON ts.vehicle_id = v.id
    LEFT JOIN (
        SELECT vehicle_id, SUM(total_cost) AS fuel_cost
        FROM public.fuel_logs WHERE is_deleted = false
        GROUP BY vehicle_id
    ) fs ON fs.vehicle_id = v.id
    LEFT JOIN (
        SELECT vehicle_id, SUM(parts_cost) AS parts_cost, SUM(labor_cost) AS labor_cost, SUM(actual_cost) AS actual_cost
        FROM public.maintenance_orders WHERE status = 'completed' AND is_deleted = false
        GROUP BY vehicle_id
    ) ms ON ms.vehicle_id = v.id
    WHERE v.id = v_target_id;

    v_result := jsonb_build_object(
        'vehicleId', v_rec.vehicle_id::text,
        'vehiclePlate', v_rec.vehicle_plate,
        'vehicleCode', v_rec.vehicle_code,
        'makeModel', v_rec.make_model,
        'totalDistanceKm', v_rec.total_distance_km,
        'fuelCostTotal', v_rec.fuel_cost,
        'partsCostTotal', v_rec.parts_cost,
        'laborCostTotal', v_rec.labor_cost,
        'maintenanceCostTotal', v_rec.maintenance_cost,
        'driverAllowanceTotal', v_rec.driver_allowance,
        'depreciationCostTotal', 0.00,
        'depreciationNote', 'الاستهلاك لا يحتسب على الخادم بل في المعالجة المحلية المستقلة (Depreciation is calculated offline and not part of server mode)',
        'grandTotalCost', v_rec.grand_total,
        'costPerKm', CASE WHEN v_rec.total_distance_km > 0 THEN round(v_rec.grand_total / v_rec.total_distance_km, 2) ELSE 0.00 END
    );

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Query RPC: get_fleet_dashboard_kpis()
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_fleet_dashboard_kpis()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_total_vehicles bigint := 0;
    v_on_road bigint := 0;
    v_available bigint := 0;
    v_maintenance bigint := 0;
    v_out_of_service bigint := 0;
    v_utilization numeric(18,2) := 0.00;
    v_fuel_today_liters numeric(18,3) := 0.000;
    v_fuel_today_cost numeric(18,2) := 0.00;
    v_fuel_yesterday_liters numeric(18,3) := 0.000;
    v_fuel_change_pct numeric(18,2) := 0.00;
    v_active_trips bigint := 0;
    v_pending_maint bigint := 0;
    v_critical_anomalies bigint := 0;
    v_overdue_schedules bigint := 0;
    v_expiring_docs bigint := 0;
BEGIN
    IF NOT public.has_permission('TM', 'view') THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية استعراض لوحة مؤشرات الأسطول';
    END IF;

    -- 1. Fleet status counts
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'on_trip'),
        COUNT(*) FILTER (WHERE status = 'available'),
        COUNT(*) FILTER (WHERE status = 'maintenance'),
        COUNT(*) FILTER (WHERE status = 'out_of_service')
    INTO v_total_vehicles, v_on_road, v_available, v_maintenance, v_out_of_service
    FROM public.vehicles
    WHERE is_deleted = false;

    IF v_total_vehicles > 0 THEN
        v_utilization := round((v_on_road::numeric / v_total_vehicles::numeric) * 100.0, 2);
    END IF;

    -- 2. Fuel today vs yesterday
    SELECT
        COALESCE(SUM(liters), 0.000),
        COALESCE(SUM(total_cost), 0.00)
    INTO v_fuel_today_liters, v_fuel_today_cost
    FROM public.fuel_logs
    WHERE is_deleted = false AND logged_at::date = CURRENT_DATE;

    SELECT COALESCE(SUM(liters), 0.000)
    INTO v_fuel_yesterday_liters
    FROM public.fuel_logs
    WHERE is_deleted = false AND logged_at::date = (CURRENT_DATE - 1);

    IF v_fuel_yesterday_liters > 0 THEN
        v_fuel_change_pct := round(((v_fuel_today_liters - v_fuel_yesterday_liters) / v_fuel_yesterday_liters) * 100.0, 2);
    END IF;

    -- 3. Open trips
    SELECT COUNT(*) INTO v_active_trips
    FROM public.trips
    WHERE is_deleted = false AND status IN ('in_transit', 'scheduled');

    -- 4. Open maintenance orders
    SELECT COUNT(*) INTO v_pending_maint
    FROM public.maintenance_orders
    WHERE is_deleted = false AND status = 'in_progress';

    -- 5. Critical anomalies
    SELECT COUNT(*) INTO v_critical_anomalies
    FROM public.fuel_anomaly_alerts
    WHERE is_deleted = false AND status = 'active';

    -- 6. Overdue preventive schedules
    SELECT COUNT(*) INTO v_overdue_schedules
    FROM public.preventive_schedules ps
    JOIN public.vehicles v ON v.id = ps.vehicle_id
    WHERE ps.status = 'Active'
      AND (
          (ps.next_due_date IS NOT NULL AND ps.next_due_date < CURRENT_DATE)
          OR (ps.next_due_odometer IS NOT NULL AND ps.next_due_odometer <= v.current_odometer)
      );

    -- 7. Expiring documents (next 30 days)
    SELECT COUNT(DISTINCT id) INTO v_expiring_docs
    FROM public.vehicles
    WHERE is_deleted = false
      AND (
          (insurance_expiry IS NOT NULL AND insurance_expiry <= (CURRENT_DATE + interval '30 days'))
          OR (registration_expiry IS NOT NULL AND registration_expiry <= (CURRENT_DATE + interval '30 days'))
      );

    RETURN jsonb_build_object(
        'totalVehicles', v_total_vehicles,
        'onRoadCount', v_on_road,
        'availableCount', v_available,
        'maintenanceCount', v_maintenance,
        'outOfServiceCount', v_out_of_service,
        'fleetUtilizationRate', v_utilization,
        'fuelConsumedTodayLiters', v_fuel_today_liters,
        'fuelCostTodaySar', v_fuel_today_cost,
        'fuelVsYesterdayChangePct', v_fuel_change_pct,
        'activeTripsCount', v_active_trips,
        'openTrips', v_active_trips,
        'pendingMaintenanceCount', v_pending_maint,
        'openMaintenanceOrders', v_pending_maint,
        'criticalAnomaliesCount', v_critical_anomalies,
        'overduePreventiveCount', v_overdue_schedules,
        'overduePreventiveSchedules', v_overdue_schedules,
        'expiringDocumentsCount', v_expiring_docs,
        'expiringDocuments', v_expiring_docs
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Grant Privileges
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.resolve_fuel_anomaly_alert FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_vehicle_expiry_alerts FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_vehicle_cost_report FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_fleet_dashboard_kpis FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.resolve_fuel_anomaly_alert TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vehicle_expiry_alerts TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vehicle_cost_report TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fleet_dashboard_kpis TO authenticated;
