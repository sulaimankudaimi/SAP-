-- ============================================================================
-- Migration: 0007_fleet_hardening.sql
-- Description: Production hardening for Fleet module:
--              1. Business invariants in RPC commands (odometer, tank capacity, license expiry, completion)
--              2. Server-side reporting views (v_vehicle_costs, v_cost_center_fleet_reconciliation)
--              3. High-performance composite indexes for 50,000+ record pagination
-- Database: PostgreSQL 15+ (Supabase / Self-Hosted)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. High-Performance Composite Indexes for 50,000+ Record Pagination
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_fuel_logs_pagination ON public.fuel_logs (logged_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_vehicle_pagination ON public.fuel_logs (vehicle_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_plant_pagination ON public.fuel_logs (plant_code, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_status ON public.trips (vehicle_id, status);
CREATE INDEX IF NOT EXISTS idx_trips_created_pagination ON public.trips (created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_maintenance_orders_vehicle_status ON public.maintenance_orders (vehicle_id, status);
CREATE INDEX IF NOT EXISTS idx_journal_lines_cost_center_account ON public.journal_lines (cost_center, account_number);

-- ----------------------------------------------------------------------------
-- 2. Server-Side View: Vehicle Costs & Cost Per Km
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_vehicle_costs AS
WITH trip_stats AS (
    SELECT
        vehicle_id,
        COALESCE(SUM(distance_km), 0) AS total_distance_km,
        COALESCE(SUM(driver_allowance_cost), 0) AS driver_allowance_total
    FROM public.trips
    WHERE status = 'completed' AND is_deleted = false
    GROUP BY vehicle_id
),
fuel_stats AS (
    SELECT
        vehicle_id,
        COALESCE(SUM(total_cost), 0) AS fuel_cost_total
    FROM public.fuel_logs
    WHERE is_deleted = false
    GROUP BY vehicle_id
),
maint_stats AS (
    SELECT
        vehicle_id,
        COALESCE(SUM(actual_cost), 0) AS maintenance_cost_total
    FROM public.maintenance_orders
    WHERE status = 'completed' AND is_deleted = false
    GROUP BY vehicle_id
)
SELECT
    v.id AS vehicle_id,
    v.code AS vehicle_code,
    v.plate_number AS vehicle_plate,
    v.make_model,
    v.plant_code,
    'CC-' || v.plant_code AS cost_center,
    COALESCE(ts.total_distance_km, 0)::numeric(18,2) AS total_distance_km,
    COALESCE(fs.fuel_cost_total, 0)::numeric(18,2) AS fuel_cost_total,
    COALESCE(ms.maintenance_cost_total, 0)::numeric(18,2) AS maintenance_cost_total,
    COALESCE(ts.driver_allowance_total, 0)::numeric(18,2) AS driver_allowance_total,
    (
        COALESCE(fs.fuel_cost_total, 0) +
        COALESCE(ms.maintenance_cost_total, 0) +
        COALESCE(ts.driver_allowance_total, 0)
    )::numeric(18,2) AS grand_total_cost,
    CASE
        WHEN COALESCE(ts.total_distance_km, 0) > 0 THEN
            ROUND((
                COALESCE(fs.fuel_cost_total, 0) +
                COALESCE(ms.maintenance_cost_total, 0) +
                COALESCE(ts.driver_allowance_total, 0)
            ) / ts.total_distance_km, 2)
        ELSE 0.00
    END::numeric(18,2) AS cost_per_km
FROM public.vehicles v
LEFT JOIN trip_stats ts ON ts.vehicle_id = v.id
LEFT JOIN fuel_stats fs ON fs.vehicle_id = v.id
LEFT JOIN maint_stats ms ON ms.vehicle_id = v.id
WHERE v.is_deleted = false;

-- ----------------------------------------------------------------------------
-- 3. Server-Side View: Cost Center Fleet GL Reconciliation
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_cost_center_fleet_reconciliation AS
WITH operational_costs AS (
    SELECT
        cost_center,
        SUM(fuel_cost_total) AS total_fuel,
        SUM(maintenance_cost_total) AS total_maintenance,
        SUM(driver_allowance_total) AS total_allowance,
        SUM(grand_total_cost) AS operational_total_cost
    FROM public.v_vehicle_costs
    GROUP BY cost_center
),
journal_costs AS (
    SELECT
        jl.cost_center,
        COALESCE(SUM(jl.debit), 0) AS journal_total_debit
    FROM public.journal_lines jl
    JOIN public.journal_entries je ON je.id = jl.journal_entry_id
    WHERE je.status = 'posted'
      AND jl.account_number IN ('601010', '602010', '603010')
    GROUP BY jl.cost_center
)
SELECT
    COALESCE(oc.cost_center, jc.cost_center) AS cost_center,
    COALESCE(oc.total_fuel, 0)::numeric(18,2) AS total_fuel,
    COALESCE(oc.total_maintenance, 0)::numeric(18,2) AS total_maintenance,
    COALESCE(oc.total_allowance, 0)::numeric(18,2) AS total_allowance,
    COALESCE(oc.operational_total_cost, 0)::numeric(18,2) AS operational_total_cost,
    COALESCE(jc.journal_total_debit, 0)::numeric(18,2) AS journal_total_debit,
    (COALESCE(oc.operational_total_cost, 0) - COALESCE(jc.journal_total_debit, 0))::numeric(18,2) AS variance
FROM operational_costs oc
FULL OUTER JOIN journal_costs jc ON jc.cost_center = oc.cost_center;

-- ----------------------------------------------------------------------------
-- 4. Invariant Enforcement: create_trip Hardening
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_trip(
    p_request_id uuid,
    p_vehicle_id uuid,
    p_driver_id uuid,
    p_origin_plant text,
    p_destination_location text,
    p_cargo_type text,
    p_cargo_volume_liters numeric(18,3),
    p_scheduled_departure timestamptz,
    p_scheduled_arrival timestamptz,
    p_start_odometer numeric(18,2)
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_existing_result jsonb;
    v_doc_number text;
    v_trip_id uuid;
    v_vehicle RECORD;
    v_driver RECORD;
    v_result jsonb;
BEGIN
    -- Idempotency Check
    SELECT result INTO v_existing_result
    FROM public.command_requests
    WHERE request_id = p_request_id AND command_name = 'create_trip';

    IF FOUND THEN
        RETURN v_existing_result;
    END IF;

    -- Security & Permission Check
    IF NOT public.has_permission('TM', 'create', p_origin_plant) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية إصدار وتسيير رحلات الأسطول في المحطة (%)', p_origin_plant;
    END IF;

    -- Validate Vehicle Existence, Status & Monotonic Odometer
    SELECT * INTO v_vehicle FROM public.vehicles WHERE id = p_vehicle_id FOR UPDATE;
    IF NOT FOUND OR v_vehicle.is_deleted THEN
        RAISE EXCEPTION 'مركبة الأسطول المحددة غير موجودة أو ملغاة';
    END IF;

    IF v_vehicle.status <> 'available' THEN
        RAISE EXCEPTION 'المركبة (%) غير متاحة للرحلة (حالتها الحالية: %)', v_vehicle.plate_number, v_vehicle.status;
    END IF;

    IF p_start_odometer < v_vehicle.current_odometer THEN
        RAISE EXCEPTION 'عداد بداية الرحلة (% كم) لا يمكن أن يكون أقل من قراءة المركبة الحالية (% كم)', p_start_odometer, v_vehicle.current_odometer;
    END IF;

    -- Validate Driver Existence, Status & License Validity
    SELECT * INTO v_driver FROM public.drivers WHERE id = p_driver_id FOR UPDATE;
    IF NOT FOUND OR v_driver.is_deleted THEN
        RAISE EXCEPTION 'السائق المحدد غير موجود أو ملغي';
    END IF;

    IF v_driver.status <> 'available' THEN
        RAISE EXCEPTION 'السائق (%) غير متاح حالياً (حالته: %)', v_driver.name, v_driver.status;
    END IF;

    IF v_driver.license_expiry IS NOT NULL AND v_driver.license_expiry < CURRENT_DATE THEN
        RAISE EXCEPTION 'رخصة قيادة السائق (%) منتهية الصلاحية بتاريخ (%) ولا يمكن تعيينه للرحلة', v_driver.name, v_driver.license_expiry;
    END IF;

    -- Generate Server-Authoritative Document Number
    v_doc_number := public.next_doc_number('TRIP', to_char(now(), 'YYYY'));
    v_trip_id := gen_random_uuid();

    -- Insert Trip Record
    INSERT INTO public.trips (
        id, doc_number, status, vehicle_id, driver_id, origin_plant,
        destination_location, cargo_type, cargo_volume_liters,
        scheduled_departure, scheduled_arrival, actual_departure,
        start_odometer, created_by, created_at, updated_at, version
    ) VALUES (
        v_trip_id, v_doc_number, 'in_transit', p_vehicle_id, p_driver_id, p_origin_plant,
        p_destination_location, p_cargo_type, p_cargo_volume_liters,
        p_scheduled_departure, p_scheduled_arrival, now(),
        p_start_odometer, COALESCE(v_user_id::text, 'system'), now(), now(), 1
    );

    -- Transition Vehicle and Driver Status to 'on_trip'
    UPDATE public.vehicles SET status = 'on_trip', updated_at = now() WHERE id = p_vehicle_id;
    UPDATE public.drivers SET status = 'on_trip', updated_at = now() WHERE id = p_driver_id;

    -- Audit Log
    PERFORM public.log_audit_event('CREATE', 'Trip', v_doc_number, NULL, jsonb_build_object(
        'id', v_trip_id, 'doc_number', v_doc_number, 'vehicle_id', p_vehicle_id, 'driver_id', p_driver_id, 'start_odometer', p_start_odometer
    ), v_user_id);

    -- Build & Cache Result
    v_result := jsonb_build_object(
        'success', true,
        'trip_id', v_trip_id,
        'doc_number', v_doc_number,
        'status', 'in_transit'
    );

    INSERT INTO public.command_requests (request_id, command_name, user_id, result)
    VALUES (p_request_id, 'create_trip', v_user_id, v_result);

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Invariant Enforcement: create_fuel_log Hardening
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_fuel_log(
    p_request_id uuid,
    p_vehicle_id uuid,
    p_driver_id uuid,
    p_fuel_type text,
    p_liters numeric(18,3),
    p_unit_price numeric(18,2),
    p_odometer numeric(18,2),
    p_station_name text,
    p_invoice_number text,
    p_plant_code text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_existing_result jsonb;
    v_doc_number text;
    v_fuel_log_id uuid;
    v_vehicle RECORD;
    v_total_cost numeric(18,2);
    v_is_anomaly boolean := false;
    v_anomaly_reason text := NULL;
    v_je_number text := NULL;
    v_cost_center text;
    v_result jsonb;
BEGIN
    -- Idempotency Check
    SELECT result INTO v_existing_result
    FROM public.command_requests
    WHERE request_id = p_request_id AND command_name = 'create_fuel_log';

    IF FOUND THEN
        RETURN v_existing_result;
    END IF;

    -- Security Check
    IF NOT public.has_permission('TM', 'create', p_plant_code) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية تسجيل استهلاك وقود الأسطول في المحطة (%)', p_plant_code;
    END IF;

    -- Lock Vehicle Record
    SELECT * INTO v_vehicle FROM public.vehicles WHERE id = p_vehicle_id FOR UPDATE;
    IF NOT FOUND OR v_vehicle.is_deleted THEN
        RAISE EXCEPTION 'المركبة المحددة غير موجودة';
    END IF;

    -- Validations: Monotonic Odometer & Tank Capacity Constraint
    IF p_odometer < v_vehicle.current_odometer THEN
        RAISE EXCEPTION 'قراءة العداد المدخلة (% كم) لا يمكن أن تكون أقل من قراءة المركبة الحالية (% كم)', p_odometer, v_vehicle.current_odometer;
    END IF;

    IF v_vehicle.capacity_liters > 0 AND p_liters > v_vehicle.capacity_liters THEN
        RAISE EXCEPTION 'كمية الوقود المعبأة (% لتر) تتجاوز سعة خزان الوقود للمركبة (% لتر)', p_liters, v_vehicle.capacity_liters;
    END IF;

    v_total_cost := round(p_liters * p_unit_price, 2);
    v_doc_number := public.next_doc_number('FL', to_char(now(), 'YYYY'));
    v_fuel_log_id := gen_random_uuid();
    v_cost_center := 'CC-' || COALESCE(p_plant_code, v_vehicle.plant_code, '1100');

    -- Post Accounting Journal Entry for Fuel Expense
    IF v_total_cost > 0 THEN
        v_je_number := public.next_doc_number('JE', to_char(now(), 'YYYY'));

        INSERT INTO public.journal_entries (
            doc_number, company_code, fiscal_year, period, posting_date,
            document_date, document_type, header_text, reference,
            total_debit, total_credit, created_by
        ) VALUES (
            v_je_number, '1000', to_char(now(), 'YYYY'), EXTRACT(MONTH FROM now())::int,
            CURRENT_DATE, CURRENT_DATE, 'WA',
            'استهلاك محروقات صهريج ' || v_vehicle.plate_number || ' - ' || v_doc_number,
            v_doc_number, v_total_cost, v_total_cost, COALESCE(v_user_id::text, 'system')
        );

        -- Debit Fuel Expense (603010) with Cost Center
        INSERT INTO public.journal_lines (
            journal_entry_id, line_number, posting_key, account_number, account_name,
            debit, credit, cost_center, line_text
        ) VALUES (
            (SELECT id FROM public.journal_entries WHERE doc_number = v_je_number),
            1, '40', '603010', 'وقود تشغيل الشاحنات ومعدات النقل',
            v_total_cost, 0.00, v_cost_center, 'وقود صهريج ' || v_vehicle.plate_number
        );

        -- Credit Accounts Payable (201010)
        INSERT INTO public.journal_lines (
            journal_entry_id, line_number, posting_key, account_number, account_name,
            debit, credit, line_text
        ) VALUES (
            (SELECT id FROM public.journal_entries WHERE doc_number = v_je_number),
            2, '50', '201010', 'الذمم الدائنة التجارية (موردي قطع الغيار والوقود)',
            0.00, v_total_cost, 'استحقاق محطة ' || p_station_name
        );

        INSERT INTO public.posting_registry (source_type, source_id, event, journal_doc_number)
        VALUES ('FUEL_LOG', v_fuel_log_id::text, 'POST', v_je_number);
    END IF;

    -- Insert Fuel Log Record
    INSERT INTO public.fuel_logs (
        id, doc_number, vehicle_id, driver_id, fuel_type, liters, unit_price,
        total_cost, odometer, station_name, invoice_number, plant_code,
        logged_at, is_anomaly, anomaly_reason, je_doc_number, created_by
    ) VALUES (
        v_fuel_log_id, v_doc_number, p_vehicle_id, p_driver_id, p_fuel_type, p_liters, p_unit_price,
        v_total_cost, p_odometer, p_station_name, p_invoice_number, p_plant_code,
        now(), v_is_anomaly, v_anomaly_reason, v_je_number, COALESCE(v_user_id::text, 'system')
    );

    -- Update Vehicle Current Odometer
    UPDATE public.vehicles SET current_odometer = p_odometer, updated_at = now() WHERE id = p_vehicle_id;

    -- Audit Log
    PERFORM public.log_audit_event('CREATE', 'FuelLog', v_doc_number, NULL, jsonb_build_object(
        'id', v_fuel_log_id, 'doc_number', v_doc_number, 'liters', p_liters, 'total_cost', v_total_cost
    ), v_user_id);

    -- Cache Result
    v_result := jsonb_build_object(
        'success', true,
        'fuel_log_id', v_fuel_log_id,
        'doc_number', v_doc_number,
        'total_cost', v_total_cost,
        'is_anomaly', v_is_anomaly,
        'je_doc_number', v_je_number
    );

    INSERT INTO public.command_requests (request_id, command_name, user_id, result)
    VALUES (p_request_id, 'create_fuel_log', v_user_id, v_result);

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Invariant Enforcement: complete_maintenance_order Hardening
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_maintenance_order(
    p_request_id uuid,
    p_order_id uuid,
    p_labor_hours numeric(18,2),
    p_labor_rate numeric(18,2) DEFAULT 120.00,
    p_downtime_hours numeric(18,2) DEFAULT 0.00,
    p_completion_date date DEFAULT CURRENT_DATE,
    p_expected_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_existing_result jsonb;
    v_order RECORD;
    v_labor_cost numeric(18,2);
    v_final_actual_cost numeric(18,2);
    v_je_number text := NULL;
    v_cost_center text;
    v_result jsonb;
BEGIN
    -- Idempotency Check
    SELECT result INTO v_existing_result
    FROM public.command_requests
    WHERE request_id = p_request_id AND command_name = 'complete_maintenance_order';

    IF FOUND THEN
        RETURN v_existing_result;
    END IF;

    -- Security Check
    IF NOT public.has_permission('TM', 'change') THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية اعتماد وإغلاق أوامر صيانة الأسطول';
    END IF;

    -- Lock Order Record
    SELECT * INTO v_order FROM public.maintenance_orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'أمر الصيانة المطلوب غير موجود';
    END IF;

    IF v_order.status = 'completed' THEN
        RAISE EXCEPTION 'تم إغلاق واعتماد أمر الصيانة هذا مسبقاً';
    END IF;

    IF p_expected_version IS NOT NULL AND v_order.version <> p_expected_version THEN
        RAISE EXCEPTION 'ConcurrencyError: تم تعديل هذا السجل بواسطة مستخدم آخر. أعد التحميل ثم حاول مجدداً.';
    END IF;

    -- Invariant: Must have issued parts OR labor hours before completing
    IF (v_order.parts_cost <= 0 AND COALESCE(p_labor_hours, 0) <= 0) THEN
        RAISE EXCEPTION 'لا يمكن إغلاق أمر الصيانة بدون تسجيل ساعات عمل فنية أو صرف قطع غيار';
    END IF;

    v_labor_cost := round(COALESCE(p_labor_hours, 0) * p_labor_rate, 2);
    v_final_actual_cost := v_order.parts_cost + v_labor_cost;
    v_cost_center := 'CC-' || COALESCE((SELECT plant_code FROM public.vehicles WHERE id = v_order.vehicle_id), '1100');

    -- Post Labor Cost Journal Entry (if labor_cost > 0)
    IF v_labor_cost > 0 THEN
        v_je_number := public.next_doc_number('JE', to_char(now(), 'YYYY'));

        INSERT INTO public.journal_entries (
            doc_number, company_code, fiscal_year, period, posting_date,
            document_date, document_type, header_text, reference,
            total_debit, total_credit, created_by
        ) VALUES (
            v_je_number, '1000', to_char(now(), 'YYYY'), EXTRACT(MONTH FROM now())::int,
            CURRENT_DATE, CURRENT_DATE, 'SA',
            'أجور فنيي صيانة الشاحنات لأمر الصيانة ' || v_order.doc_number,
            v_order.doc_number, v_labor_cost, v_labor_cost, COALESCE(v_user_id::text, 'system')
        );

        -- Debit Maintenance Expense (602010) with Cost Center
        INSERT INTO public.journal_lines (
            journal_entry_id, line_number, posting_key, account_number, account_name,
            debit, credit, cost_center, line_text
        ) VALUES (
            (SELECT id FROM public.journal_entries WHERE doc_number = v_je_number),
            1, '40', '602010', 'مصروفات صيانة وإصلاح أسطول الصهاريج',
            v_labor_cost, 0.00, v_cost_center, 'أجور فنيين ' || v_order.doc_number
        );

        -- Credit Payables (201010)
        INSERT INTO public.journal_lines (
            journal_entry_id, line_number, posting_key, account_number, account_name,
            debit, credit, line_text
        ) VALUES (
            (SELECT id FROM public.journal_entries WHERE doc_number = v_je_number),
            2, '50', '201010', 'الذمم الدائنة التجارية (موردي قطع الغيار والوقود)',
            0.00, v_labor_cost, 'استحقاق أجور عمالة ' || v_order.doc_number
        );

        INSERT INTO public.posting_registry (source_type, source_id, event, journal_doc_number)
        VALUES ('MAINTENANCE_ORDER', v_order.id::text, 'COMPLETION_LABOR', v_je_number);
    END IF;

    -- Update Maintenance Order
    UPDATE public.maintenance_orders SET
        status = 'completed',
        labor_hours = p_labor_hours,
        labor_cost = v_labor_cost,
        actual_cost = v_final_actual_cost,
        downtime_hours = p_downtime_hours,
        completion_date = COALESCE(p_completion_date, CURRENT_DATE),
        je_doc_number = COALESCE(v_je_number, v_order.je_doc_number),
        updated_at = now()
    WHERE id = p_order_id;

    -- Release Vehicle back to 'available'
    UPDATE public.vehicles SET status = 'available', updated_at = now() WHERE id = v_order.vehicle_id;

    -- Audit Log
    PERFORM public.log_audit_event('UPDATE', 'MaintenanceOrder', v_order.doc_number, to_jsonb(v_order), jsonb_build_object(
        'status', 'completed', 'actual_cost', v_final_actual_cost, 'labor_cost', v_labor_cost
    ), v_user_id);

    -- Cache Result
    v_result := jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'doc_number', v_order.doc_number,
        'actual_cost', v_final_actual_cost,
        'je_doc_number', v_je_number
    );

    INSERT INTO public.command_requests (request_id, command_name, user_id, result)
    VALUES (p_request_id, 'complete_maintenance_order', v_user_id, v_result);

    RETURN v_result;
END;
$$;
