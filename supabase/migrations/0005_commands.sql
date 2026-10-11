-- ============================================================================
-- Migration: 0005_commands.sql
-- Description: Server-authoritative business command RPCs with idempotent execution
-- Database: PostgreSQL 15+ (Supabase / Self-Hosted)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Idempotent Command Execution Registry
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.command_requests (
    request_id uuid NOT NULL,
    command_name text NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    result jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (request_id, command_name)
);

ALTER TABLE public.command_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_command_requests_select ON public.command_requests
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 1. Command: create_trip
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
    -- 1. Idempotency Check
    SELECT result INTO v_existing_result
    FROM public.command_requests
    WHERE request_id = p_request_id AND command_name = 'create_trip';

    IF FOUND THEN
        RETURN v_existing_result;
    END IF;

    -- 2. Security & Permission Check
    IF NOT public.has_permission('TM', 'create', p_origin_plant) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية إصدار وتسيير رحلات الأسطول في المحطة (%)', p_origin_plant;
    END IF;

    -- 3. Validate Vehicle & Driver Availability
    SELECT * INTO v_vehicle FROM public.vehicles WHERE id = p_vehicle_id FOR UPDATE;
    IF NOT FOUND OR v_vehicle.is_deleted THEN
        RAISE EXCEPTION 'مركبة الأسطول المحددة غير موجودة أو ملغاة';
    END IF;

    IF v_vehicle.status <> 'available' THEN
        RAISE EXCEPTION 'المركبة (%) غير متاحة حالياً (حالتها: %)', v_vehicle.plate_number, v_vehicle.status;
    END IF;

    SELECT * INTO v_driver FROM public.drivers WHERE id = p_driver_id FOR UPDATE;
    IF NOT FOUND OR v_driver.is_deleted THEN
        RAISE EXCEPTION 'السائق المحدد غير موجود أو ملغي';
    END IF;

    IF v_driver.status <> 'available' THEN
        RAISE EXCEPTION 'السائق (%) غير متاح حالياً (حالته: %)', v_driver.name, v_driver.status;
    END IF;

    -- 4. Generate Server-Authoritative Document Number
    v_doc_number := public.next_doc_number('TRIP', to_char(now(), 'YYYY'));
    v_trip_id := gen_random_uuid();

    -- 5. Insert Trip Record
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

    -- 6. Transition Vehicle and Driver Status to 'on_trip'
    UPDATE public.vehicles SET status = 'on_trip', updated_at = now() WHERE id = p_vehicle_id;
    UPDATE public.drivers SET status = 'on_trip', updated_at = now() WHERE id = p_driver_id;

    -- 7. Audit Log
    PERFORM public.log_audit_event('CREATE', 'Trip', v_doc_number, NULL, jsonb_build_object(
        'id', v_trip_id, 'doc_number', v_doc_number, 'vehicle_id', p_vehicle_id, 'driver_id', p_driver_id
    ), v_user_id);

    -- 8. Build & Cache Result
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
-- 2. Command: complete_trip
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_trip(
    p_request_id uuid,
    p_trip_id uuid,
    p_end_odometer numeric(18,2),
    p_actual_arrival timestamptz,
    p_fuel_liters_consumed numeric(18,3) DEFAULT 0.000,
    p_fuel_cost numeric(18,2) DEFAULT 0.00,
    p_driver_allowance numeric(18,2) DEFAULT 0.00,
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
    v_trip RECORD;
    v_distance numeric(18,2);
    v_total_cost numeric(18,2);
    v_cost_per_km numeric(18,2) := 0.00;
    v_je_number text := NULL;
    v_result jsonb;
BEGIN
    -- 1. Idempotency Check
    SELECT result INTO v_existing_result
    FROM public.command_requests
    WHERE request_id = p_request_id AND command_name = 'complete_trip';

    IF FOUND THEN
        RETURN v_existing_result;
    END IF;

    -- 2. Fetch Trip with Row Lock
    SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'الرحلة المطلوبة غير موجودة';
    END IF;

    IF v_trip.status = 'completed' THEN
        RAISE EXCEPTION 'تم إغلاق واعتماد هذه الرحلة مسبقاً';
    END IF;

    -- 3. Security Check
    IF NOT public.has_permission('TM', 'change', v_trip.origin_plant) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية إغلاق الرحلات للمحطة (%)', v_trip.origin_plant;
    END IF;

    -- 4. Optimistic Concurrency Check
    IF p_expected_version IS NOT NULL AND v_trip.version <> p_expected_version THEN
        RAISE EXCEPTION 'ConcurrencyError: تم تعديل هذا السجل بواسطة مستخدم آخر. أعد التحميل ثم حاول مجدداً.';
    END IF;

    -- 5. Validate Monotonic Odometer
    IF p_end_odometer < v_trip.start_odometer THEN
        RAISE EXCEPTION 'عداد الوصول (%) لا يمكن أن يكون أقل من عداد الانطلاق (%)', p_end_odometer, v_trip.start_odometer;
    END IF;

    v_distance := p_end_odometer - v_trip.start_odometer;
    v_total_cost := p_fuel_cost + p_driver_allowance;
    IF v_distance > 0 THEN
        v_cost_per_km := round(v_total_cost / v_distance, 2);
    END IF;

    -- 6. Financial Posting for Trip Allowance & Cost (if cost > 0)
    IF v_total_cost > 0 THEN
        v_je_number := public.next_doc_number('JE', to_char(now(), 'YYYY'));

        INSERT INTO public.journal_entries (
            doc_number, company_code, fiscal_year, period, posting_date,
            document_date, document_type, header_text, reference,
            total_debit, total_credit, created_by
        ) VALUES (
            v_je_number, '1000', to_char(now(), 'YYYY'), EXTRACT(MONTH FROM now())::int,
            CURRENT_DATE, CURRENT_DATE, 'SA',
            'تكاليف وبدلات رحلة نقل وقود ' || v_trip.doc_number,
            v_trip.doc_number, v_total_cost, v_total_cost, COALESCE(v_user_id::text, 'system')
        );

        -- Debit Trip Allowance Expense (601010)
        INSERT INTO public.journal_lines (
            journal_entry_id, line_number, posting_key, account_number, account_name,
            debit, credit, line_text
        ) VALUES (
            (SELECT id FROM public.journal_entries WHERE doc_number = v_je_number),
            1, '40', '601010', 'بدلات وانتدابات سائقي صهاريج الوقود',
            v_total_cost, 0.00, 'بدلات رحلة ' || v_trip.doc_number
        );

        -- Credit Logistics Clearing / Payable (201020)
        INSERT INTO public.journal_lines (
            journal_entry_id, line_number, posting_key, account_number, account_name,
            debit, credit, line_text
        ) VALUES (
            (SELECT id FROM public.journal_entries WHERE doc_number = v_je_number),
            2, '50', '201020', 'مستحقات وسيطة GR/IR - مقاولي النقل واللوجستيات',
            0.00, v_total_cost, 'استحقاق رحلة ' || v_trip.doc_number
        );

        -- Record in Posting Registry
        INSERT INTO public.posting_registry (source_type, source_id, event, journal_doc_number)
        VALUES ('TRIP', v_trip.id::text, 'POST', v_je_number);
    END IF;

    -- 7. Update Trip
    UPDATE public.trips SET
        status = 'completed',
        end_odometer = p_end_odometer,
        actual_arrival = COALESCE(p_actual_arrival, now()),
        distance_km = v_distance,
        fuel_liters_consumed = p_fuel_liters_consumed,
        fuel_cost = p_fuel_cost,
        driver_allowance_cost = p_driver_allowance,
        total_trip_cost = v_total_cost,
        cost_per_km = v_cost_per_km,
        je_doc_number = v_je_number,
        updated_at = now()
    WHERE id = p_trip_id;

    -- 8. Return Vehicle and Driver to 'available' and Update Odometer
    UPDATE public.vehicles SET
        current_odometer = p_end_odometer,
        status = 'available',
        updated_at = now()
    WHERE id = v_trip.vehicle_id;

    UPDATE public.drivers SET
        status = 'available',
        total_trips_completed = total_trips_completed + 1,
        total_distance_km = total_distance_km + v_distance,
        updated_at = now()
    WHERE id = v_trip.driver_id;

    -- 9. Audit Log
    PERFORM public.log_audit_event('UPDATE', 'Trip', v_trip.doc_number, to_jsonb(v_trip), jsonb_build_object(
        'status', 'completed', 'end_odometer', p_end_odometer, 'total_trip_cost', v_total_cost, 'je_doc_number', v_je_number
    ), v_user_id);

    -- 10. Cache Result
    v_result := jsonb_build_object(
        'success', true,
        'trip_id', p_trip_id,
        'doc_number', v_trip.doc_number,
        'distance_km', v_distance,
        'total_trip_cost', v_total_cost,
        'je_doc_number', v_je_number
    );

    INSERT INTO public.command_requests (request_id, command_name, user_id, result)
    VALUES (p_request_id, 'complete_trip', v_user_id, v_result);

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Command: create_fuel_log
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
    v_result jsonb;
BEGIN
    -- 1. Idempotency Check
    SELECT result INTO v_existing_result
    FROM public.command_requests
    WHERE request_id = p_request_id AND command_name = 'create_fuel_log';

    IF FOUND THEN
        RETURN v_existing_result;
    END IF;

    -- 2. Security Check
    IF NOT public.has_permission('TM', 'create', p_plant_code) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية تسجيل استهلاك وقود الأسطول في المحطة (%)', p_plant_code;
    END IF;

    -- 3. Lock Vehicle Record
    SELECT * INTO v_vehicle FROM public.vehicles WHERE id = p_vehicle_id FOR UPDATE;
    IF NOT FOUND OR v_vehicle.is_deleted THEN
        RAISE EXCEPTION 'المركبة المحددة غير موجودة';
    END IF;

    -- 4. Validations (Monotonic Odometer & Tank Capacity)
    IF p_odometer < v_vehicle.current_odometer THEN
        RAISE EXCEPTION 'قراءة العداد المدخلة (%) لا يمكن أن تكون أقل من قراءة المركبة الحالية (%)', p_odometer, v_vehicle.current_odometer;
    END IF;

    IF v_vehicle.capacity_liters > 0 AND p_liters > (v_vehicle.capacity_liters * 1.10) THEN
        v_is_anomaly := true;
        v_anomaly_reason := 'كمية الوقود المعبأة (' || p_liters || ' لتر) تتجاوز سعة خزان المركبة (' || v_vehicle.capacity_liters || ' لتر)';
    END IF;

    v_total_cost := round(p_liters * p_unit_price, 2);
    v_doc_number := public.next_doc_number('FL', to_char(now(), 'YYYY'));
    v_fuel_log_id := gen_random_uuid();

    -- 5. Post Accounting Journal Entry for Fuel Expense
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

        -- Debit Fuel Expense (603010)
        INSERT INTO public.journal_lines (
            journal_entry_id, line_number, posting_key, account_number, account_name,
            debit, credit, line_text
        ) VALUES (
            (SELECT id FROM public.journal_entries WHERE doc_number = v_je_number),
            1, '40', '603010', 'وقود تشغيل الشاحنات ومعدات النقل',
            v_total_cost, 0.00, 'وقود صهريج ' || v_vehicle.plate_number
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

    -- 6. Insert Fuel Log Record
    INSERT INTO public.fuel_logs (
        id, doc_number, vehicle_id, driver_id, fuel_type, liters, unit_price,
        total_cost, odometer, station_name, invoice_number, plant_code,
        logged_at, is_anomaly, anomaly_reason, je_doc_number, created_by
    ) VALUES (
        v_fuel_log_id, v_doc_number, p_vehicle_id, p_driver_id, p_fuel_type, p_liters, p_unit_price,
        v_total_cost, p_odometer, p_station_name, p_invoice_number, p_plant_code,
        now(), v_is_anomaly, v_anomaly_reason, v_je_number, COALESCE(v_user_id::text, 'system')
    );

    -- 7. Update Vehicle Current Odometer
    UPDATE public.vehicles SET current_odometer = p_odometer, updated_at = now() WHERE id = p_vehicle_id;

    -- 8. Audit Log
    PERFORM public.log_audit_event('CREATE', 'FuelLog', v_doc_number, NULL, jsonb_build_object(
        'id', v_fuel_log_id, 'doc_number', v_doc_number, 'liters', p_liters, 'total_cost', v_total_cost
    ), v_user_id);

    -- 9. Cache Result
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
-- 4. Command: issue_parts_to_maintenance_order (Movement Type 261)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.issue_parts_to_maintenance_order(
    p_request_id uuid,
    p_order_id uuid,
    p_parts jsonb, -- Array of { "materialCode": "MAT-01", "quantity": 2, "storageLocation": "SL01", "unitPrice": 150 }
    p_plant_code text,
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
    v_plant RECORD;
    v_part RECORD;
    v_stock RECORD;
    v_mat_code text;
    v_qty numeric(18,3);
    v_sloc text;
    v_price numeric(18,2);
    v_item_total numeric(18,2);
    v_total_parts_cost numeric(18,2) := 0.00;
    v_mat_doc_number text;
    v_mat_doc_id uuid;
    v_je_number text := NULL;
    v_result jsonb;
BEGIN
    -- 1. Idempotency Check
    SELECT result INTO v_existing_result
    FROM public.command_requests
    WHERE request_id = p_request_id AND command_name = 'issue_parts_to_maintenance_order';

    IF FOUND THEN
        RETURN v_existing_result;
    END IF;

    -- 2. Security Check
    IF NOT public.has_permission('WM', 'post', p_plant_code) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية صرف المواد وقطع الغيار (Movement 261) في المحطة (%)', p_plant_code;
    END IF;

    -- 3. Lock Maintenance Order
    SELECT * INTO v_order FROM public.maintenance_orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'أمر الصيانة المطلوب غير موجود';
    END IF;

    IF v_order.status = 'completed' THEN
        RAISE EXCEPTION 'أمر الصيانة مكتمل مسبقاً ولا يمكن صرف قطع إضافية عليه';
    END IF;

    IF p_expected_version IS NOT NULL AND v_order.version <> p_expected_version THEN
        RAISE EXCEPTION 'ConcurrencyError: تم تعديل هذا السجل بواسطة مستخدم آخر. أعد التحميل ثم حاول مجدداً.';
    END IF;

    SELECT * INTO v_plant FROM public.plants WHERE code = p_plant_code;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'المحطة المحددة (%) غير معرفة بالنظام', p_plant_code;
    END IF;

    v_mat_doc_number := public.next_doc_number('WA', to_char(now(), 'YYYY'));
    v_mat_doc_id := gen_random_uuid();

    -- 4. Process Each Part Line Item with Row-Level Locking on stock_balances
    FOR v_part IN SELECT * FROM jsonb_to_recordset(p_parts) AS x(
        "materialCode" text, "quantity" numeric, "storageLocation" text, "unitPrice" numeric
    ) LOOP
        v_mat_code := v_part."materialCode";
        v_qty      := v_part."quantity";
        v_sloc     := COALESCE(v_part."storageLocation", 'SL01');

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'الكمية المصروفة للصنف (%) يجب أن تكون أكبر من الصفر', v_mat_code;
        END IF;

        -- Row lock on specific stock balance
        SELECT * INTO v_stock
        FROM public.stock_balances
        WHERE material_code = v_mat_code AND plant_code = p_plant_code AND storage_location = v_sloc
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'لا يوجد رصيد مخزني مسجل للصنف (%) بالمستودع (%) في المحطة (%)', v_mat_code, v_sloc, p_plant_code;
        END IF;

        -- Verify Stock Availability (Reject negative unless plant explicitly allows)
        IF (v_stock.unrestricted_qty - v_qty) < 0 AND NOT v_plant.allows_negative_stock THEN
            RAISE EXCEPTION 'الرصيد المتاح من الصنف (%) لا يكفي لصرف الكمية المطلوبة (% متاح: %)', v_mat_code, v_qty, v_stock.unrestricted_qty;
        END IF;

        v_price := COALESCE(v_part."unitPrice", v_stock.moving_average_price, 0.00);
        v_item_total := round(v_qty * v_price, 2);
        v_total_parts_cost := v_total_parts_cost + v_item_total;

        -- Update Stock Balance
        UPDATE public.stock_balances SET
            unrestricted_qty = unrestricted_qty - v_qty,
            total_valuation = total_valuation - v_item_total,
            last_movement_date = CURRENT_DATE,
            updated_at = now()
        WHERE id = v_stock.id;

        -- Append to Stock Ledger (Outbound Negative Entry)
        INSERT INTO public.stock_ledger (
            material_doc_number, posting_date, material_code, plant_code,
            storage_location, movement_type, quantity, unit, unit_price,
            total_amount, balance_after, created_by
        ) VALUES (
            v_mat_doc_number, CURRENT_DATE, v_mat_code, p_plant_code,
            v_sloc, '261', -v_qty, v_stock.unit, v_price,
            v_item_total, (v_stock.unrestricted_qty - v_qty), COALESCE(v_user_id::text, 'system')
        );
    END LOOP;

    -- 5. Insert Material Document
    INSERT INTO public.material_documents (
        id, doc_number, movement_type, posting_date, plant_code, storage_location,
        maintenance_order_number, header_text, items, created_by
    ) VALUES (
        v_mat_doc_id, v_mat_doc_number, '261', CURRENT_DATE, p_plant_code, 'SL01',
        v_order.doc_number, 'صرف قطع غيار لأمر صيانة شاحنة ' || v_order.doc_number,
        p_parts, COALESCE(v_user_id::text, 'system')
    );

    -- 6. Post GL Journal Entry (Debit Maintenance Expense 602010 / Credit Spare Parts Stock 120040)
    IF v_total_parts_cost > 0 THEN
        v_je_number := public.next_doc_number('JE', to_char(now(), 'YYYY'));

        INSERT INTO public.journal_entries (
            doc_number, company_code, fiscal_year, period, posting_date,
            document_date, document_type, header_text, reference,
            total_debit, total_credit, created_by
        ) VALUES (
            v_je_number, '1000', to_char(now(), 'YYYY'), EXTRACT(MONTH FROM now())::int,
            CURRENT_DATE, CURRENT_DATE, 'WA',
            'صرف قطع غيار (261) لأمر صيانة ' || v_order.doc_number,
            v_mat_doc_number, v_total_parts_cost, v_total_parts_cost, COALESCE(v_user_id::text, 'system')
        );

        INSERT INTO public.journal_lines (journal_entry_id, line_number, posting_key, account_number, account_name, debit, credit, line_text)
        VALUES (
            (SELECT id FROM public.journal_entries WHERE doc_number = v_je_number),
            1, '40', '602010', 'مصروفات صيانة وإصلاح أسطول الصهاريج', v_total_parts_cost, 0.00, 'قطع غيار ' || v_order.doc_number
        );

        INSERT INTO public.journal_lines (journal_entry_id, line_number, posting_key, account_number, account_name, debit, credit, line_text)
        VALUES (
            (SELECT id FROM public.journal_entries WHERE doc_number = v_je_number),
            2, '50', '120040', 'مخزون قطع غيار الشاحنات والمضخات', 0.00, v_total_parts_cost, 'صرف مخزني مستند ' || v_mat_doc_number
        );

        INSERT INTO public.posting_registry (source_type, source_id, event, journal_doc_number)
        VALUES ('MAINTENANCE_ORDER', v_order.id::text, 'PARTS_ISSUE_' || v_mat_doc_number, v_je_number);
    END IF;

    -- 7. Update Maintenance Order Parts Cost
    UPDATE public.maintenance_orders SET
        parts_cost = parts_cost + v_total_parts_cost,
        actual_cost = actual_cost + v_total_parts_cost,
        updated_at = now()
    WHERE id = p_order_id;

    -- 8. Audit Log
    PERFORM public.log_audit_event('POST', 'MaintenanceOrder', v_order.doc_number, NULL, jsonb_build_object(
        'material_doc', v_mat_doc_number, 'parts_cost_added', v_total_parts_cost, 'je_doc_number', v_je_number
    ), v_user_id);

    -- 9. Cache Result
    v_result := jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'material_doc_number', v_mat_doc_number,
        'parts_cost_added', v_total_parts_cost,
        'je_doc_number', v_je_number
    );

    INSERT INTO public.command_requests (request_id, command_name, user_id, result)
    VALUES (p_request_id, 'issue_parts_to_maintenance_order', v_user_id, v_result);

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Command: complete_maintenance_order
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
    v_result jsonb;
BEGIN
    -- 1. Idempotency Check
    SELECT result INTO v_existing_result
    FROM public.command_requests
    WHERE request_id = p_request_id AND command_name = 'complete_maintenance_order';

    IF FOUND THEN
        RETURN v_existing_result;
    END IF;

    -- 2. Security Check
    IF NOT public.has_permission('TM', 'change') THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية اعتماد وإغلاق أوامر صيانة الأسطول';
    END IF;

    -- 3. Lock Order Record
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

    v_labor_cost := round(p_labor_hours * p_labor_rate, 2);
    v_final_actual_cost := v_order.parts_cost + v_labor_cost;

    -- 4. Post Labor Cost Journal Entry (if labor_cost > 0)
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

        -- Debit Maintenance Expense (602010)
        INSERT INTO public.journal_lines (journal_entry_id, line_number, posting_key, account_number, account_name, debit, credit, line_text)
        VALUES (
            (SELECT id FROM public.journal_entries WHERE doc_number = v_je_number),
            1, '40', '602010', 'مصروفات صيانة وإصلاح أسطول الصهاريج', v_labor_cost, 0.00, 'أجور فنيين ' || v_order.doc_number
        );

        -- Credit Salaries & Benefits Payable (203010)
        INSERT INTO public.journal_lines (journal_entry_id, line_number, posting_key, account_number, account_name, debit, credit, line_text)
        VALUES (
            (SELECT id FROM public.journal_entries WHERE doc_number = v_je_number),
            2, '50', '201010', 'الذمم الدائنة التجارية (موردي قطع الغيار والوقود)', 0.00, v_labor_cost, 'استحقاق أجور عمالة ' || v_order.doc_number
        );

        INSERT INTO public.posting_registry (source_type, source_id, event, journal_doc_number)
        VALUES ('MAINTENANCE_ORDER', v_order.id::text, 'COMPLETION_LABOR', v_je_number);
    END IF;

    -- 5. Update Maintenance Order
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

    -- 6. Release Vehicle back to 'available'
    UPDATE public.vehicles SET status = 'available', updated_at = now() WHERE id = v_order.vehicle_id;

    -- 7. Audit Log
    PERFORM public.log_audit_event('UPDATE', 'MaintenanceOrder', v_order.doc_number, to_jsonb(v_order), jsonb_build_object(
        'status', 'completed', 'actual_cost', v_final_actual_cost, 'labor_cost', v_labor_cost
    ), v_user_id);

    -- 8. Cache Result
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

-- ----------------------------------------------------------------------------
-- 6. Command: post_journal
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_journal(
    p_request_id uuid,
    p_source_type text,
    p_source_id text,
    p_event text,
    p_header_text text,
    p_lines jsonb, -- Array of { "postingKey": "40", "accountNumber": "601010", "accountName": "...", "debit": 100, "credit": 0, "costCenter": "CC-1100" }
    p_posting_date date DEFAULT CURRENT_DATE,
    p_document_type text DEFAULT 'SA'
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
    v_existing_reg RECORD;
    v_doc_number text;
    v_je_id uuid;
    v_total_debit numeric(18,2) := 0.00;
    v_total_credit numeric(18,2) := 0.00;
    v_line RECORD;
    v_period_open boolean;
    v_fiscal_year text := to_char(p_posting_date, 'YYYY');
    v_period integer := EXTRACT(MONTH FROM p_posting_date)::int;
    v_result jsonb;
BEGIN
    -- 1. Idempotency Check in command_requests
    SELECT result INTO v_existing_result
    FROM public.command_requests
    WHERE request_id = p_request_id AND command_name = 'post_journal';

    IF FOUND THEN
        RETURN v_existing_result;
    END IF;

    -- 2. Idempotency Check in posting_registry
    SELECT * INTO v_existing_reg
    FROM public.posting_registry
    WHERE source_type = p_source_type AND source_id = p_source_id AND event = p_event;

    IF FOUND THEN
        v_result := jsonb_build_object(
            'success', true,
            'is_duplicate', true,
            'doc_number', v_existing_reg.journal_doc_number
        );
        RETURN v_result;
    END IF;

    -- 3. Security Check
    IF NOT public.has_permission('FI', 'post') THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية ترحيل قيود اليومية العامة (FI Post)';
    END IF;

    -- 4. Open Fiscal Period Verification
    SELECT is_open INTO v_period_open
    FROM public.fiscal_periods
    WHERE company_code = '1000' AND fiscal_year = v_fiscal_year AND period = v_period;

    IF v_period_open IS NOT TRUE THEN
        RAISE EXCEPTION 'الفترة المالية (%-%) مقفلة محاسبياً ولا تسمح بالترحيل', v_fiscal_year, v_period;
    END IF;

    -- 5. Calculate Debits & Credits Balance
    FOR v_line IN SELECT * FROM jsonb_to_recordset(p_lines) AS x(
        "debit" numeric, "credit" numeric
    ) LOOP
        v_total_debit  := v_total_debit  + COALESCE(v_line."debit", 0.00);
        v_total_credit := v_total_credit + COALESCE(v_line."credit", 0.00);
    END LOOP;

    IF abs(v_total_debit - v_total_credit) > 0.001 THEN
        RAISE EXCEPTION 'القيد غير متوازن: مجموع المدين (%) لا يساوي مجموع الدائن (%) بفارق (%)',
            v_total_debit, v_total_credit, abs(v_total_debit - v_total_credit);
    END IF;

    v_doc_number := public.next_doc_number('JE', v_fiscal_year);
    v_je_id := gen_random_uuid();

    -- 6. Insert Journal Entry Header
    INSERT INTO public.journal_entries (
        id, doc_number, company_code, fiscal_year, period, posting_date,
        document_date, document_type, header_text, reference,
        total_debit, total_credit, created_by
    ) VALUES (
        v_je_id, v_doc_number, '1000', v_fiscal_year, v_period, p_posting_date,
        p_posting_date, p_document_type, p_header_text, p_source_id,
        v_total_debit, v_total_credit, COALESCE(v_user_id::text, 'system')
    );

    -- 7. Insert Journal Lines
    INSERT INTO public.journal_lines (
        journal_entry_id, line_number, posting_key, account_number, account_name,
        debit, credit, cost_center, line_text
    )
    SELECT
        v_je_id,
        (row_number() OVER ())::int,
        x."postingKey",
        x."accountNumber",
        x."accountName",
        COALESCE(x."debit", 0.00),
        COALESCE(x."credit", 0.00),
        x."costCenter",
        x."lineText"
    FROM jsonb_to_recordset(p_lines) AS x(
        "postingKey" text, "accountNumber" text, "accountName" text,
        "debit" numeric, "credit" numeric, "costCenter" text, "lineText" text
    );

    -- 8. Register in Posting Registry
    INSERT INTO public.posting_registry (source_type, source_id, event, journal_doc_number)
    VALUES (p_source_type, p_source_id, p_event, v_doc_number);

    -- 9. Audit Log
    PERFORM public.log_audit_event('POST', 'JournalEntry', v_doc_number, NULL, jsonb_build_object(
        'id', v_je_id, 'doc_number', v_doc_number, 'total_debit', v_total_debit, 'source', p_source_type
    ), v_user_id);

    -- 10. Cache Result
    v_result := jsonb_build_object(
        'success', true,
        'journal_id', v_je_id,
        'doc_number', v_doc_number,
        'total_amount', v_total_debit
    );

    INSERT INTO public.command_requests (request_id, command_name, user_id, result)
    VALUES (p_request_id, 'post_journal', v_user_id, v_result);

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Command: reverse_posting
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reverse_posting(
    p_request_id uuid,
    p_source_type text,
    p_source_id text,
    p_reason text
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
    v_reg RECORD;
    v_original_je RECORD;
    v_reversal_je_number text;
    v_reversal_je_id uuid;
    v_result jsonb;
BEGIN
    -- 1. Idempotency Check
    SELECT result INTO v_existing_result
    FROM public.command_requests
    WHERE request_id = p_request_id AND command_name = 'reverse_posting';

    IF FOUND THEN
        RETURN v_existing_result;
    END IF;

    -- 2. Security Check
    IF NOT public.has_permission('FI', 'reverse') THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية عكس وإلغاء القيود المحاسبية (FI Reverse / Storno)';
    END IF;

    -- 3. Lock Posting Registry Entry
    SELECT * INTO v_reg
    FROM public.posting_registry
    WHERE source_type = p_source_type AND source_id = p_source_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'لا يوجد قيد محاسبي مسجل للعملية (% - %)', p_source_type, p_source_id;
    END IF;

    -- Strict Reversal Invariant: Double Cancel Rejected
    IF v_reg.is_reversed THEN
        RAISE EXCEPTION 'تم عكس هذا القيد مسبقاً بموجب المستند (%). لا يمكن عكس القيد أكثر من مرة.', v_reg.reversal_doc_number;
    END IF;

    -- 4. Fetch Original Journal Entry
    SELECT * INTO v_original_je
    FROM public.journal_entries
    WHERE doc_number = v_reg.journal_doc_number
    FOR UPDATE;

    v_reversal_je_number := public.next_doc_number('AB', to_char(now(), 'YYYY'));
    v_reversal_je_id := gen_random_uuid();

    -- 5. Insert Reversal Header
    INSERT INTO public.journal_entries (
        id, doc_number, company_code, fiscal_year, period, posting_date,
        document_date, document_type, header_text, reference,
        total_debit, total_credit, reversal_of_doc_number, created_by
    ) VALUES (
        v_reversal_je_id, v_reversal_je_number, v_original_je.company_code,
        v_original_je.fiscal_year, v_original_je.period, CURRENT_DATE, CURRENT_DATE,
        'AB', 'عكس وإلغاء القيد ' || v_original_je.doc_number || ' - ' || p_reason,
        v_original_je.doc_number, v_original_je.total_debit, v_original_je.total_credit,
        v_original_je.doc_number, COALESCE(v_user_id::text, 'system')
    );

    -- 6. Insert Inverted Lines (Debit becomes Credit, Credit becomes Debit)
    INSERT INTO public.journal_lines (
        journal_entry_id, line_number, posting_key, account_number, account_name,
        debit, credit, cost_center, line_text
    )
    SELECT
        v_reversal_je_id,
        line_number,
        CASE WHEN posting_key = '40' THEN '50' ELSE '40' END,
        account_number,
        account_name,
        credit, -- Inverted
        debit,  -- Inverted
        cost_center,
        'عكس سطر ' || line_number || ' للقيد ' || v_original_je.doc_number
    FROM public.journal_lines
    WHERE journal_entry_id = v_original_je.id;

    -- 7. Update Original Journal and Registry
    UPDATE public.journal_entries SET reversed_by_doc_number = v_reversal_je_number, updated_at = now()
    WHERE id = v_original_je.id;

    UPDATE public.posting_registry SET
        is_reversed = true,
        reversal_doc_number = v_reversal_je_number,
        reversed_at = now()
    WHERE id = v_reg.id;

    -- 8. Audit Log
    PERFORM public.log_audit_event('REVERSE', 'JournalEntry', v_original_je.doc_number, NULL, jsonb_build_object(
        'reversal_doc_number', v_reversal_je_number, 'reason', p_reason
    ), v_user_id);

    -- 9. Cache Result
    v_result := jsonb_build_object(
        'success', true,
        'original_doc_number', v_original_je.doc_number,
        'reversal_doc_number', v_reversal_je_number
    );

    INSERT INTO public.command_requests (request_id, command_name, user_id, result)
    VALUES (p_request_id, 'reverse_posting', v_user_id, v_result);

    RETURN v_result;
END;
$$;

-- Grant Execute on all RPC commands to authenticated users
GRANT EXECUTE ON FUNCTION public.create_trip TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_trip TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_fuel_log TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_parts_to_maintenance_order TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_maintenance_order TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_journal TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_posting TO authenticated;
