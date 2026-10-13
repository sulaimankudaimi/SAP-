-- ============================================================================
-- Migration: 0009_idempotency_security.sql
-- Description: 1. Idempotency race prevention with begin_command & command_requests status
--              2. Revoke execute on public functions from PUBLIC/anon & tighten grants
--              3. has_permission fails closed on must_change_password & NULL p_plant
--              4. complete_password_change RPC
--              5. Refactor existing commands to call begin_command first
-- Database: PostgreSQL 15+ (Supabase / Self-Hosted)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Upgrade command_requests Table for Race-Free Concurrency
-- ----------------------------------------------------------------------------
ALTER TABLE public.command_requests
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'done';

ALTER TABLE public.command_requests
    DROP CONSTRAINT IF EXISTS chk_command_requests_status;

ALTER TABLE public.command_requests
    ADD CONSTRAINT chk_command_requests_status
    CHECK (status IN ('in_progress', 'done'));

ALTER TABLE public.command_requests
    ALTER COLUMN result DROP NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. begin_command Helper Function
-- Atomically inserts row with 'in_progress'. If duplicate call arrives, it row-locks
-- and waits for the first transaction to complete, then returns stored result if 'done'.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.begin_command(
    p_request_id uuid,
    p_command text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_row RECORD;
BEGIN
    IF p_request_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- 1. Optimistically insert 'in_progress' marker
    INSERT INTO public.command_requests (request_id, command_name, user_id, status, result)
    VALUES (
        p_request_id,
        p_command,
        COALESCE(v_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
        'in_progress',
        NULL
    )
    ON CONFLICT (request_id, command_name) DO NOTHING;

    -- 2. Lock the row to wait for any in-flight concurrent transaction
    SELECT status, result INTO v_row
    FROM public.command_requests
    WHERE request_id = p_request_id AND command_name = p_command
    FOR UPDATE;

    -- 3. If previous transaction finished ('done'), return its stored result
    IF FOUND AND v_row.status = 'done' THEN
        RETURN v_row.result;
    END IF;

    -- If insert won in this transaction or was uncommitted, proceed with execution
    RETURN NULL;
END;
$$;

-- Revoke execute from authenticated & public (internal helper only)
REVOKE ALL ON FUNCTION public.begin_command(uuid, text) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. has_permission Function Hardening (Fail-Closed)
-- Returns false if must_change_password = true
-- Returns false if NULL p_plant when user or role has plant restrictions
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_permission(
    p_module text,
    p_activity text,
    p_plant text DEFAULT NULL,
    p_amount numeric(18,2) DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id uuid;
    v_role_code text;
    v_is_active boolean;
    v_must_change_password boolean;
    v_user_plants text[];
    v_has_perm boolean := false;
BEGIN
    -- 1. Extract authenticated actor
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN false;
    END IF;

    -- 2. Lookup user profile
    SELECT role_code, is_active, must_change_password, plant_codes
    INTO v_role_code, v_is_active, v_must_change_password, v_user_plants
    FROM public.profiles
    WHERE user_id = v_user_id;

    IF NOT FOUND OR NOT v_is_active THEN
        RETURN false;
    END IF;

    -- CRITICAL SECURITY REQUIREMENT: Fail closed if user must change password
    IF v_must_change_password IS TRUE THEN
        RETURN false;
    END IF;

    -- 3. Superuser bypass (only if password is not expired)
    IF v_role_code = 'ADMIN' THEN
        RETURN true;
    END IF;

    -- 4. User profile plant scope validation (fails closed on NULL p_plant if user has plant restrictions)
    IF cardinality(v_user_plants) > 0 THEN
        IF p_plant IS NULL THEN
            RETURN false;
        END IF;
        IF NOT (p_plant = ANY(v_user_plants)) THEN
            RETURN false;
        END IF;
    END IF;

    -- 5. Role permission matching (exact match or wildcard '*')
    -- Also fails closed on NULL p_plant if role has plant_limit
    SELECT true INTO v_has_perm
    FROM public.role_permissions
    WHERE role_code = v_role_code
      AND (module = p_module OR module = '*')
      AND (activity = p_activity OR activity = '*')
      AND (
          plant_limit IS NULL
          OR (p_plant IS NOT NULL AND p_plant = ANY(plant_limit))
      )
      AND (amount_limit IS NULL OR p_amount IS NULL OR p_amount <= amount_limit)
    LIMIT 1;

    RETURN COALESCE(v_has_perm, false);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. complete_password_change RPC (SECURITY DEFINER)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_password_change()
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'المستخدم غير موثق (Unauthenticated)';
    END IF;

    UPDATE public.profiles
    SET must_change_password = false,
        updated_at = now()
    WHERE user_id = v_user_id;

    PERFORM public.log_audit_event(
        'UPDATE',
        'Profile',
        v_user_id::text,
        jsonb_build_object('must_change_password', true),
        jsonb_build_object('must_change_password', false),
        v_user_id
    );

    RETURN true;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Drop Obsolete Signatures Before Recreating to Prevent PostgREST Overload Errors
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_trip(uuid, uuid, uuid, text, text, text, numeric, timestamptz, timestamptz, numeric);
DROP FUNCTION IF EXISTS public.complete_trip(uuid, uuid, numeric, timestamptz, numeric, numeric, numeric, integer);
DROP FUNCTION IF EXISTS public.create_fuel_log(uuid, uuid, uuid, text, numeric, numeric, numeric, text, text, text);
DROP FUNCTION IF EXISTS public.issue_parts_to_maintenance_order(uuid, uuid, jsonb, text, integer);
DROP FUNCTION IF EXISTS public.complete_maintenance_order(uuid, uuid, numeric, numeric, numeric, date, integer);
DROP FUNCTION IF EXISTS public.post_journal(uuid, text, text, text, text, jsonb, date, text);
DROP FUNCTION IF EXISTS public.reverse_posting(uuid, text, text, text);

-- ----------------------------------------------------------------------------
-- 6. Refactor Command 1: create_trip with begin_command
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
    p_start_odometer numeric(18,2),
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
    v_doc_number text;
    v_trip_id uuid;
    v_vehicle RECORD;
    v_driver RECORD;
    v_result jsonb;
BEGIN
    -- 1. Idempotency Check via begin_command
    v_existing_result := public.begin_command(p_request_id, 'create_trip');
    IF v_existing_result IS NOT NULL THEN
        RETURN v_existing_result;
    END IF;

    -- 2. Security & Permission Check
    IF NOT public.has_permission('TM', 'create', p_origin_plant) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية إصدار وتسيير رحلات الأسطول في المحطة (%)', p_origin_plant;
    END IF;

    -- 3. Lock & Validate Vehicle
    SELECT * INTO v_vehicle
    FROM public.vehicles
    WHERE id = p_vehicle_id AND is_deleted = false
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'المركبة غير موجودة أو تم حذفها';
    END IF;

    IF v_vehicle.status <> 'available' THEN
        RAISE EXCEPTION 'المركبة في حالة (%) ولا يمكن إسناد رحلة جديدة لها', v_vehicle.status;
    END IF;

    IF p_start_odometer < v_vehicle.current_odometer THEN
        RAISE EXCEPTION 'قراءة عداد البداية (%) أقل من قراءة العداد الحالية للمركبة (%)',
            p_start_odometer, v_vehicle.current_odometer;
    END IF;

    -- 4. Lock & Validate Driver
    SELECT * INTO v_driver
    FROM public.drivers
    WHERE id = p_driver_id AND is_deleted = false
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'السائق غير موجود أو تم حذفه';
    END IF;

    IF v_driver.status <> 'available' THEN
        RAISE EXCEPTION 'السائق في حالة (%) ولا يمكن تسييره في رحلة جديدة', v_driver.status;
    END IF;

    IF v_driver.license_expiry < current_date THEN
        RAISE EXCEPTION 'رخصة قيادة السائق منتهية الصلاحية بتاريخ (%)', v_driver.license_expiry;
    END IF;

    -- 5. Generate Atomic Document Number
    v_doc_number := public.next_doc_number('TRIP');
    v_trip_id := gen_random_uuid();

    -- 6. Insert Trip Record
    INSERT INTO public.trips (
        id, doc_number, status, vehicle_id, driver_id, origin_plant,
        destination_location, cargo_type, cargo_volume_liters,
        scheduled_departure, scheduled_arrival, start_odometer,
        created_by, version
    ) VALUES (
        v_trip_id, v_doc_number, 'in_transit', p_vehicle_id, p_driver_id, p_origin_plant,
        p_destination_location, p_cargo_type, p_cargo_volume_liters,
        p_scheduled_departure, p_scheduled_arrival, p_start_odometer,
        COALESCE(v_user_id::text, 'system'), 1
    );

    -- 7. Update Vehicle & Driver Status
    UPDATE public.vehicles
    SET status = 'on_trip',
        current_odometer = p_start_odometer,
        assigned_driver_id = p_driver_id,
        updated_at = now()
    WHERE id = p_vehicle_id;

    UPDATE public.drivers
    SET status = 'on_trip',
        updated_at = now()
    WHERE id = p_driver_id;

    -- 8. Log Cryptographic Audit Trail
    PERFORM public.log_audit_event(
        'CREATE',
        'Trip',
        v_trip_id::text,
        NULL,
        jsonb_build_object(
            'doc_number', v_doc_number,
            'vehicle_id', p_vehicle_id,
            'driver_id', p_driver_id,
            'origin_plant', p_origin_plant,
            'cargo_volume_liters', p_cargo_volume_liters,
            'start_odometer', p_start_odometer
        ),
        v_user_id
    );

    -- 9. Prepare Stored Result
    v_result := jsonb_build_object(
        'id', v_trip_id,
        'docNumber', v_doc_number,
        'status', 'in_transit',
        'vehicleId', p_vehicle_id,
        'driverId', p_driver_id,
        'originPlant', p_origin_plant,
        'destinationLocation', p_destination_location,
        'cargoType', p_cargo_type,
        'cargoVolumeLiters', p_cargo_volume_liters,
        'startOdometer', p_start_odometer,
        'version', 1
    );

    -- 10. Mark Command Done
    IF p_request_id IS NOT NULL THEN
        UPDATE public.command_requests
        SET status = 'done', result = v_result
        WHERE request_id = p_request_id AND command_name = 'create_trip';
    END IF;

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Refactor Command 2: complete_trip with begin_command & p_driver_allowance_cost
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_trip(
    p_request_id uuid,
    p_trip_id uuid,
    p_end_odometer numeric(18,2),
    p_actual_arrival timestamptz DEFAULT now(),
    p_fuel_liters_consumed numeric(18,3) DEFAULT 0.000,
    p_fuel_cost numeric(18,2) DEFAULT 0.00,
    p_driver_allowance_cost numeric(18,2) DEFAULT 0.00,
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
    v_je_doc text := NULL;
    v_result jsonb;
BEGIN
    -- 1. Idempotency Check via begin_command
    v_existing_result := public.begin_command(p_request_id, 'complete_trip');
    IF v_existing_result IS NOT NULL THEN
        RETURN v_existing_result;
    END IF;

    -- 2. Lock Trip Record
    SELECT * INTO v_trip
    FROM public.trips
    WHERE id = p_trip_id AND is_deleted = false
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'الرحلة غير موجودة أو تم حذفها';
    END IF;

    IF v_trip.status = 'completed' THEN
        RAISE EXCEPTION 'الرحلة مكتملة مسبقاً ولا يمكن إكمالها مرة أخرى';
    END IF;

    -- 3. Concurrency Check
    IF p_expected_version IS NOT NULL AND v_trip.version <> p_expected_version THEN
        RAISE EXCEPTION 'تعارض في التعديل المتزامن (Concurrency Conflict): تم تعديل الرحلة من قبل مستخدم آخر. الإصدار المتوقع: %، الإصدار الحالي: %',
            p_expected_version, v_trip.version USING ERRCODE = 'P0001';
    END IF;

    -- 4. Permission Check
    IF NOT public.has_permission('TM', 'change', v_trip.origin_plant) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية تعديل وإكمال رحلات الأسطول في المحطة (%)', v_trip.origin_plant;
    END IF;

    IF p_end_odometer < v_trip.start_odometer THEN
        RAISE EXCEPTION 'قراءة عداد النهاية (%) أقل من قراءة البداية (%)', p_end_odometer, v_trip.start_odometer;
    END IF;

    v_distance := p_end_odometer - v_trip.start_odometer;
    v_total_cost := COALESCE(p_fuel_cost, 0.00) + COALESCE(p_driver_allowance_cost, 0.00);

    IF v_distance > 0 THEN
        v_cost_per_km := round(v_total_cost / v_distance, 2);
    END IF;

    -- 5. Auto Post Journal Entry if Trip Incurs Operational Costs
    IF v_total_cost > 0.00 THEN
        v_je_doc := public.next_doc_number('JE');

        INSERT INTO public.journal_entries (
            doc_number, company_code, fiscal_year, period,
            document_date, posting_date, document_type,
            reference_number, header_text, created_by, status
        ) VALUES (
            v_je_doc, '1000', to_char(now(), 'YYYY'), extract(month from now())::integer,
            current_date, current_date, 'SA',
            v_trip.doc_number, 'تسوية تكاليف الرحلة التشغيلية - ' || v_trip.doc_number,
            COALESCE(v_user_id::text, 'system'), 'posted'
        );

        -- Debit Transportation Expense
        INSERT INTO public.journal_lines (
            journal_entry_id, line_item, account_number, cost_center,
            plant_code, debit, credit, line_text
        ) VALUES (
            (SELECT id FROM public.journal_entries WHERE doc_number = v_je_doc),
            1, '601010', 'CC-' || v_trip.origin_plant,
            v_trip.origin_plant, v_total_cost, 0.00, 'تكاليف تشغيل ونقل الرحلة'
        );

        -- Credit Cash / Clearing
        INSERT INTO public.journal_lines (
            journal_entry_id, line_item, account_number, cost_center,
            plant_code, debit, credit, line_text
        ) VALUES (
            (SELECT id FROM public.journal_entries WHERE doc_number = v_je_doc),
            2, '101010', NULL,
            v_trip.origin_plant, 0.00, v_total_cost, 'صندوق / وسيط تسوية تكاليف النقل'
        );
    END IF;

    -- 6. Update Trip Status
    UPDATE public.trips
    SET status = 'completed',
        end_odometer = p_end_odometer,
        distance_km = v_distance,
        actual_arrival = COALESCE(p_actual_arrival, now()),
        fuel_liters_consumed = COALESCE(p_fuel_liters_consumed, 0.000),
        fuel_cost = COALESCE(p_fuel_cost, 0.00),
        driver_allowance_cost = COALESCE(p_driver_allowance_cost, 0.00),
        total_trip_cost = v_total_cost,
        cost_per_km = v_cost_per_km,
        je_doc_number = v_je_doc,
        updated_at = now()
    WHERE id = p_trip_id;

    -- 7. Release Vehicle and Update Odometer
    UPDATE public.vehicles
    SET status = 'available',
        current_odometer = p_end_odometer,
        assigned_driver_id = NULL,
        updated_at = now()
    WHERE id = v_trip.vehicle_id;

    -- 8. Release Driver
    UPDATE public.drivers
    SET status = 'available',
        total_trips_completed = total_trips_completed + 1,
        total_distance_km = total_distance_km + v_distance,
        updated_at = now()
    WHERE id = v_trip.driver_id;

    -- 9. Audit Event
    PERFORM public.log_audit_event(
        'POST',
        'Trip',
        p_trip_id::text,
        jsonb_build_object('status', 'in_transit'),
        jsonb_build_object(
            'status', 'completed',
            'end_odometer', p_end_odometer,
            'total_cost', v_total_cost,
            'je_doc_number', v_je_doc
        ),
        v_user_id
    );

    v_result := jsonb_build_object(
        'id', p_trip_id,
        'docNumber', v_trip.doc_number,
        'status', 'completed',
        'endOdometer', p_end_odometer,
        'distanceKm', v_distance,
        'totalTripCost', v_total_cost,
        'jeDocNumber', v_je_doc
    );

    -- 10. Mark Command Done
    IF p_request_id IS NOT NULL THEN
        UPDATE public.command_requests
        SET status = 'done', result = v_result
        WHERE request_id = p_request_id AND command_name = 'complete_trip';
    END IF;

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Refactor Command 3: create_fuel_log with begin_command & client signatures
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_fuel_log(
    p_request_id uuid,
    p_vehicle_id uuid,
    p_driver_id uuid,
    p_fuel_type text,
    p_odometer numeric(18,2),
    p_quantity_liters numeric(18,3) DEFAULT NULL,
    p_cost_per_liter numeric(18,2) DEFAULT NULL,
    p_station_name text DEFAULT 'محطة المحروقات',
    p_date text DEFAULT NULL,
    p_expected_version integer DEFAULT NULL,
    p_occurred_at timestamptz DEFAULT NULL,
    p_liters numeric(18,3) DEFAULT NULL,
    p_unit_price numeric(18,2) DEFAULT NULL,
    p_invoice_number text DEFAULT NULL,
    p_plant_code text DEFAULT NULL
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
    v_liters numeric(18,3);
    v_unit_price numeric(18,2);
    v_plant text;
    v_total_cost numeric(18,2);
    v_je_doc text := NULL;
    v_result jsonb;
    v_occurred timestamptz;
BEGIN
    -- 1. Idempotency Check via begin_command
    v_existing_result := public.begin_command(p_request_id, 'create_fuel_log');
    IF v_existing_result IS NOT NULL THEN
        RETURN v_existing_result;
    END IF;

    -- Resolve field aliases
    v_liters := COALESCE(p_quantity_liters, p_liters);
    v_unit_price := COALESCE(p_cost_per_liter, p_unit_price);
    IF v_liters IS NULL OR v_unit_price IS NULL THEN
        RAISE EXCEPTION 'كمية الوقود وسعر اللتر مطلوبان (Liters and unit price required)';
    END IF;

    v_occurred := COALESCE(p_occurred_at, (NULLIF(trim(p_date), '') || ' 12:00:00')::timestamptz, now());

    -- 2. Lock & Validate Vehicle
    SELECT * INTO v_vehicle
    FROM public.vehicles
    WHERE id = p_vehicle_id AND is_deleted = false
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'المركبة غير موجودة أو تم حذفها';
    END IF;

    v_plant := COALESCE(p_plant_code, v_vehicle.plant_code);

    -- Permission Check
    IF NOT public.has_permission('TM', 'create', v_plant) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية تسجيل الوقود في المحطة (%)', v_plant;
    END IF;

    -- Tank Capacity Check
    IF v_vehicle.capacity_liters > 0 AND v_liters > v_vehicle.capacity_liters THEN
        RAISE EXCEPTION 'كمية الوقود المسجلة (%) لتر تتجاوز السعة القصوى لخزان المركبة (%) لتر',
            v_liters, v_vehicle.capacity_liters;
    END IF;

    v_total_cost := round(v_liters * v_unit_price, 2);
    v_doc_number := public.next_doc_number('FL');
    v_fuel_log_id := gen_random_uuid();

    -- Post Automatic Journal Entry for Fuel Expense
    IF v_total_cost > 0.00 THEN
        v_je_doc := public.next_doc_number('JE');

        INSERT INTO public.journal_entries (
            doc_number, company_code, fiscal_year, period,
            document_date, posting_date, document_type,
            reference_number, header_text, created_by, status
        ) VALUES (
            v_je_doc, '1000', to_char(now(), 'YYYY'), extract(month from now())::integer,
            v_occurred::date, v_occurred::date, 'WA',
            v_doc_number, 'استهلاك وقود - ' || v_vehicle.code,
            COALESCE(v_user_id::text, 'system'), 'posted'
        );

        INSERT INTO public.journal_lines (
            journal_entry_id, line_item, account_number, cost_center,
            plant_code, debit, credit, line_text
        ) VALUES (
            (SELECT id FROM public.journal_entries WHERE doc_number = v_je_doc),
            1, '602010', 'CC-' || v_plant,
            v_plant, v_total_cost, 0.00, 'مصروفات وقود ومحروقات'
        );

        INSERT INTO public.journal_lines (
            journal_entry_id, line_item, account_number, cost_center,
            plant_code, debit, credit, line_text
        ) VALUES (
            (SELECT id FROM public.journal_entries WHERE doc_number = v_je_doc),
            2, '101010', NULL,
            v_plant, 0.00, v_total_cost, 'صندوق / وسيط مشتريات الوقود'
        );
    END IF;

    -- Insert Fuel Log
    INSERT INTO public.fuel_logs (
        id, doc_number, vehicle_id, driver_id, fuel_type,
        liters, unit_price, total_cost, odometer, station_name,
        invoice_number, plant_code, logged_at, je_doc_number, created_by
    ) VALUES (
        v_fuel_log_id, v_doc_number, p_vehicle_id, p_driver_id, p_fuel_type,
        v_liters, v_unit_price, v_total_cost, p_odometer, p_station_name,
        p_invoice_number, v_plant, v_occurred, v_je_doc, COALESCE(v_user_id::text, 'system')
    );

    -- Update Vehicle Odometer if greater
    IF p_odometer > v_vehicle.current_odometer THEN
        UPDATE public.vehicles
        SET current_odometer = p_odometer,
            updated_at = now()
        WHERE id = p_vehicle_id;
    END IF;

    -- Audit Event
    PERFORM public.log_audit_event(
        'CREATE',
        'FuelLog',
        v_fuel_log_id::text,
        NULL,
        jsonb_build_object(
            'doc_number', v_doc_number,
            'liters', v_liters,
            'total_cost', v_total_cost,
            'je_doc_number', v_je_doc
        ),
        v_user_id
    );

    v_result := jsonb_build_object(
        'id', v_fuel_log_id,
        'docNumber', v_doc_number,
        'vehicleId', p_vehicle_id,
        'driverId', p_driver_id,
        'liters', v_liters,
        'totalCost', v_total_cost,
        'odometer', p_odometer,
        'jeDocNumber', v_je_doc
    );

    -- Mark Command Done
    IF p_request_id IS NOT NULL THEN
        UPDATE public.command_requests
        SET status = 'done', result = v_result
        WHERE request_id = p_request_id AND command_name = 'create_fuel_log';
    END IF;

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. Refactor Command 4: issue_parts_to_maintenance_order with begin_command
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.issue_parts_to_maintenance_order(
    p_request_id uuid,
    p_order_id uuid,
    p_plant_code text,
    p_parts jsonb,
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
    v_part RECORD;
    v_stock RECORD;
    v_mat_code text;
    v_qty numeric(18,3);
    v_sloc text;
    v_unit_price numeric(18,2);
    v_total_parts_cost numeric(18,2) := 0.00;
    v_mat_doc text;
    v_je_doc text;
    v_result jsonb;
BEGIN
    -- 1. Idempotency Check via begin_command
    v_existing_result := public.begin_command(p_request_id, 'issue_parts_to_maintenance_order');
    IF v_existing_result IS NOT NULL THEN
        RETURN v_existing_result;
    END IF;

    -- 2. Security Check (Movement 261 requires WM post)
    IF NOT public.has_permission('WM', 'post', p_plant_code) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية صرف قطع الغيار والمواد (حركة 261) في المحطة (%)', p_plant_code;
    END IF;

    -- 3. Lock Maintenance Order
    SELECT * INTO v_order
    FROM public.maintenance_orders
    WHERE id = p_order_id AND is_deleted = false
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'أمر الصيانة غير موجود أو تم إلغاؤه';
    END IF;

    IF v_order.status = 'completed' THEN
        RAISE EXCEPTION 'أمر الصيانة مكتمل مسبقاً ولا يمكن صرف قطع إضافية عليه';
    END IF;

    IF p_expected_version IS NOT NULL AND v_order.version <> p_expected_version THEN
        RAISE EXCEPTION 'تعارض في التعديل المتزامن (Concurrency Conflict): تم تعديل أمر الصيانة مسبقاً. الإصدار المتوقع: %، الإصدار الحالي: %',
            p_expected_version, v_order.version USING ERRCODE = 'P0001';
    END IF;

    -- 4. Process Each Line Item Atomically
    FOR v_part IN SELECT * FROM jsonb_to_recordset(p_parts) AS x(
        "materialCode" text, quantity numeric, "storageLocation" text, "unitPrice" numeric
    ) LOOP
        v_mat_code := v_part."materialCode";
        v_qty := v_part.quantity;
        v_sloc := COALESCE(v_part."storageLocation", 'SL01');

        SELECT * INTO v_stock
        FROM public.stock_balances
        WHERE material_code = v_mat_code AND plant_code = p_plant_code AND storage_location = v_sloc
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'المادة (%) غير موجودة في رصيد المستودع بالمحطة (%) موقع (%)',
                v_mat_code, p_plant_code, v_sloc;
        END IF;

        IF v_stock.unrestricted_qty < v_qty THEN
            RAISE EXCEPTION 'رصيد غير كافٍ للصرف: الرصيد المتاح للمادة (%) هو (%) والمطلوب (%) لمنع الرصيد السالب',
                v_mat_code, v_stock.unrestricted_qty, v_qty;
        END IF;

        v_unit_price := COALESCE(v_part."unitPrice", v_stock.moving_average_price);
        v_total_parts_cost := v_total_parts_cost + round(v_qty * v_unit_price, 2);

        -- Deduct unrestricted quantity
        UPDATE public.stock_balances
        SET unrestricted_qty = unrestricted_qty - v_qty,
            total_valuation = total_valuation - round(v_qty * moving_average_price, 2),
            last_movement_date = current_date,
            updated_at = now()
        WHERE id = v_stock.id;

        -- Record movement in stock_ledger
        INSERT INTO public.stock_ledger (
            material_doc_number, posting_date, material_code, plant_code,
            storage_location, movement_type, quantity, unit,
            unit_price, total_cost, reference_doc, cost_center, created_by
        ) VALUES (
            'PENDING', current_date, v_mat_code, p_plant_code,
            v_sloc, '261', -v_qty, v_stock.unit,
            v_unit_price, round(v_qty * v_unit_price, 2), v_order.doc_number,
            'CC-' || p_plant_code, COALESCE(v_user_id::text, 'system')
        );
    END LOOP;

    -- 5. Generate Material Document Number
    v_mat_doc := public.next_doc_number('WA');

    UPDATE public.stock_ledger
    SET material_doc_number = v_mat_doc
    WHERE reference_doc = v_order.doc_number AND material_doc_number = 'PENDING';

    INSERT INTO public.material_documents (
        doc_number, movement_type, posting_date, plant_code,
        maintenance_order_number, items, created_by
    ) VALUES (
        v_mat_doc, '261', current_date, p_plant_code,
        v_order.doc_number, p_parts, COALESCE(v_user_id::text, 'system')
    );

    -- 6. Generate General Ledger Posting for Spare Parts Expense
    IF v_total_parts_cost > 0.00 THEN
        v_je_doc := public.next_doc_number('JE');

        INSERT INTO public.journal_entries (
            doc_number, company_code, fiscal_year, period,
            document_date, posting_date, document_type,
            reference_number, header_text, created_by, status
        ) VALUES (
            v_je_doc, '1000', to_char(now(), 'YYYY'), extract(month from now())::integer,
            current_date, current_date, 'WA',
            v_mat_doc, 'صرف قطع غيار لأمر الصيانة ' || v_order.doc_number,
            COALESCE(v_user_id::text, 'system'), 'posted'
        );

        INSERT INTO public.journal_lines (
            journal_entry_id, line_item, account_number, cost_center,
            plant_code, debit, credit, line_text
        ) VALUES (
            (SELECT id FROM public.journal_entries WHERE doc_number = v_je_doc),
            1, '603010', 'CC-' || p_plant_code,
            p_plant_code, v_total_parts_cost, 0.00, 'مصروفات قطع غيار وصيانة أسطول'
        );

        INSERT INTO public.journal_lines (
            journal_entry_id, line_item, account_number, cost_center,
            plant_code, debit, credit, line_text
        ) VALUES (
            (SELECT id FROM public.journal_entries WHERE doc_number = v_je_doc),
            2, '105020', NULL,
            p_plant_code, 0.00, v_total_parts_cost, 'مخزون قطع الغيار ومستلزمات الصيانة'
        );
    END IF;

    -- 7. Update Maintenance Order Costs
    UPDATE public.maintenance_orders
    SET parts_cost = parts_cost + v_total_parts_cost,
        actual_cost = actual_cost + v_total_parts_cost,
        updated_at = now()
    WHERE id = p_order_id;

    -- 8. Audit Event
    PERFORM public.log_audit_event(
        'POST',
        'MaintenanceOrder',
        p_order_id::text,
        jsonb_build_object('parts_cost', v_order.parts_cost),
        jsonb_build_object(
            'parts_cost', v_order.parts_cost + v_total_parts_cost,
            'material_doc', v_mat_doc,
            'je_doc', v_je_doc
        ),
        v_user_id
    );

    v_result := jsonb_build_object(
        'order', jsonb_build_object(
            'id', p_order_id,
            'docNumber', v_order.doc_number,
            'partsCost', v_order.parts_cost + v_total_parts_cost,
            'actualCost', v_order.actual_cost + v_total_parts_cost
        ),
        'materialDocNumber', v_mat_doc
    );

    -- 9. Mark Command Done
    IF p_request_id IS NOT NULL THEN
        UPDATE public.command_requests
        SET status = 'done', result = v_result
        WHERE request_id = p_request_id AND command_name = 'issue_parts_to_maintenance_order';
    END IF;

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. Refactor Command 5: complete_maintenance_order with begin_command & p_labor_rate_per_hour
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_maintenance_order(
    p_request_id uuid,
    p_order_id uuid,
    p_labor_hours numeric(18,2),
    p_labor_rate_per_hour numeric(18,2) DEFAULT 120.00,
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
    v_result jsonb;
BEGIN
    -- 1. Idempotency Check via begin_command
    v_existing_result := public.begin_command(p_request_id, 'complete_maintenance_order');
    IF v_existing_result IS NOT NULL THEN
        RETURN v_existing_result;
    END IF;

    -- 2. Lock Maintenance Order
    SELECT * INTO v_order
    FROM public.maintenance_orders
    WHERE id = p_order_id AND is_deleted = false
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'أمر الصيانة غير موجود أو تم إلغاؤه';
    END IF;

    IF v_order.status = 'completed' THEN
        RAISE EXCEPTION 'أمر الصيانة مكتمل مسبقاً';
    END IF;

    IF p_expected_version IS NOT NULL AND v_order.version <> p_expected_version THEN
        RAISE EXCEPTION 'تعارض في التعديل المتزامن (Concurrency Conflict): تم تعديل أمر الصيانة من قبل مستخدم آخر. الإصدار المتوقع: %، الإصدار الحالي: %',
            p_expected_version, v_order.version USING ERRCODE = 'P0001';
    END IF;

    IF NOT public.has_permission('TM', 'change') THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية اعتماد وإغلاق أوامر الصيانة';
    END IF;

    v_labor_cost := round(COALESCE(p_labor_hours, 0.00) * COALESCE(p_labor_rate_per_hour, 120.00), 2);
    v_final_actual_cost := v_order.parts_cost + v_labor_cost;

    -- 3. Update Maintenance Order Record
    UPDATE public.maintenance_orders
    SET status = 'completed',
        labor_hours = p_labor_hours,
        labor_cost = v_labor_cost,
        actual_cost = v_final_actual_cost,
        downtime_hours = COALESCE(p_downtime_hours, 0.00),
        completion_date = COALESCE(p_completion_date, CURRENT_DATE),
        updated_at = now()
    WHERE id = p_order_id;

    -- 4. Release Vehicle back to available
    UPDATE public.vehicles
    SET status = 'available',
        updated_at = now()
    WHERE id = v_order.vehicle_id;

    -- 5. Audit Event
    PERFORM public.log_audit_event(
        'POST',
        'MaintenanceOrder',
        p_order_id::text,
        jsonb_build_object('status', 'in_progress'),
        jsonb_build_object(
            'status', 'completed',
            'labor_cost', v_labor_cost,
            'actual_cost', v_final_actual_cost
        ),
        v_user_id
    );

    v_result := jsonb_build_object(
        'id', p_order_id,
        'docNumber', v_order.doc_number,
        'status', 'completed',
        'laborCost', v_labor_cost,
        'actualCost', v_final_actual_cost
    );

    -- 6. Mark Command Done
    IF p_request_id IS NOT NULL THEN
        UPDATE public.command_requests
        SET status = 'done', result = v_result
        WHERE request_id = p_request_id AND command_name = 'complete_maintenance_order';
    END IF;

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 11. Refactor Command 6: post_journal with begin_command & client signature
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_journal(
    p_request_id uuid,
    p_source_type text,
    p_source_id text,
    p_company_code text DEFAULT '1000',
    p_fiscal_year text DEFAULT to_char(now(), 'YYYY'),
    p_period integer DEFAULT extract(month from now())::integer,
    p_posting_date date DEFAULT CURRENT_DATE,
    p_document_date date DEFAULT CURRENT_DATE,
    p_document_type text DEFAULT 'SA',
    p_header_text text DEFAULT 'قيد محاسبي عام',
    p_reference text DEFAULT NULL,
    p_lines jsonb DEFAULT '[]'::jsonb,
    p_expected_version integer DEFAULT NULL,
    p_event text DEFAULT 'POST'
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
    v_line_item integer := 0;
    v_result jsonb;
BEGIN
    -- 1. Idempotency Check via begin_command
    v_existing_result := public.begin_command(p_request_id, 'post_journal');
    IF v_existing_result IS NOT NULL THEN
        RETURN v_existing_result;
    END IF;

    -- 2. Check posting_registry for duplicate business posting
    SELECT * INTO v_existing_reg
    FROM public.posting_registry
    WHERE source_type = p_source_type AND source_id = p_source_id AND event = p_event
    FOR UPDATE;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'docNumber', v_existing_reg.journal_doc_number,
            'jeId', v_existing_reg.journal_entry_id,
            'idempotent', true
        );
    END IF;

    -- 3. Security Check
    IF NOT public.has_permission('FI', 'post') THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية ترحيل القيود اليومية في المحاسبة المالية (FI_POST)';
    END IF;

    -- 4. Calculate & Verify Zero-Sum Balance (Debits == Credits)
    FOR v_line IN SELECT * FROM jsonb_to_recordset(p_lines) AS x(
        "accountNumber" text, "accountName" text, debit numeric, credit numeric, "costCenter" text, "lineText" text
    ) LOOP
        v_total_debit := v_total_debit + COALESCE(v_line.debit, 0.00);
        v_total_credit := v_total_credit + COALESCE(v_line.credit, 0.00);
    END LOOP;

    IF v_total_debit <> v_total_credit THEN
        RAISE EXCEPTION 'القيد غير متوازن محاسبياً: مجموع المدين (%) لا يساوي مجموع الدائن (%)',
            v_total_debit, v_total_credit;
    END IF;

    IF v_total_debit <= 0.00 THEN
        RAISE EXCEPTION 'قيمة القيد المحاسبي يجب أن تكون أكبر من الصفر';
    END IF;

    -- 5. Insert Journal Entry Header
    v_doc_number := public.next_doc_number('JE');
    v_je_id := gen_random_uuid();

    INSERT INTO public.journal_entries (
        id, doc_number, company_code, fiscal_year, period,
        document_date, posting_date, document_type,
        reference_number, header_text, created_by, status
    ) VALUES (
        v_je_id, v_doc_number, p_company_code, p_fiscal_year, p_period,
        p_document_date, p_posting_date, p_document_type,
        COALESCE(p_reference, p_source_id), p_header_text,
        COALESCE(v_user_id::text, 'system'), 'posted'
    );

    -- 6. Insert Journal Entry Lines
    FOR v_line IN SELECT * FROM jsonb_to_recordset(p_lines) AS x(
        "accountNumber" text, "accountName" text, debit numeric, credit numeric, "costCenter" text, "lineText" text
    ) LOOP
        v_line_item := v_line_item + 1;
        INSERT INTO public.journal_lines (
            journal_entry_id, line_item, account_number, cost_center,
            debit, credit, line_text
        ) VALUES (
            v_je_id, v_line_item, v_line."accountNumber", v_line."costCenter",
            COALESCE(v_line.debit, 0.00), COALESCE(v_line.credit, 0.00),
            COALESCE(v_line."lineText", p_header_text)
        );
    END LOOP;

    -- 7. Record in posting_registry
    INSERT INTO public.posting_registry (
        source_type, source_id, event,
        journal_doc_number, journal_entry_id, created_by
    ) VALUES (
        p_source_type, p_source_id, p_event,
        v_doc_number, v_je_id, COALESCE(v_user_id::text, 'system')
    );

    -- 8. Audit Event
    PERFORM public.log_audit_event(
        'POST',
        'JournalEntry',
        v_je_id::text,
        NULL,
        jsonb_build_object(
            'doc_number', v_doc_number,
            'source_type', p_source_type,
            'source_id', p_source_id,
            'total_debit', v_total_debit
        ),
        v_user_id
    );

    v_result := jsonb_build_object(
        'docNumber', v_doc_number,
        'jeId', v_je_id
    );

    -- 9. Mark Command Done
    IF p_request_id IS NOT NULL THEN
        UPDATE public.command_requests
        SET status = 'done', result = v_result
        WHERE request_id = p_request_id AND command_name = 'post_journal';
    END IF;

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 12. Refactor Command 7: reverse_posting with begin_command
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
    -- 1. Idempotency Check via begin_command
    v_existing_result := public.begin_command(p_request_id, 'reverse_posting');
    IF v_existing_result IS NOT NULL THEN
        RETURN v_existing_result;
    END IF;

    -- 2. Security Check (Reverse requires FI reverse permission)
    IF NOT public.has_permission('FI', 'reverse') THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية عكس وإلغاء القيود اليومية (FI_REVERSE)';
    END IF;

    -- 3. Lock Posting Registry
    SELECT * INTO v_reg
    FROM public.posting_registry
    WHERE source_type = p_source_type AND source_id = p_source_id AND event = 'POST'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'القيد الأصلي غير موجود في سجل الترحيل أو تم عكسه مسبقاً';
    END IF;

    -- 4. Verify Not Already Reversed
    IF EXISTS (
        SELECT 1 FROM public.posting_registry
        WHERE source_type = p_source_type AND source_id = p_source_id AND event = 'REVERSE'
    ) THEN
        RAISE EXCEPTION 'تم عكس هذا القيد مسبقاً ولا يمكن إلغاؤه مرة ثانية';
    END IF;

    -- 5. Fetch Original Journal Entry
    SELECT * INTO v_original_je
    FROM public.journal_entries
    WHERE id = v_reg.journal_entry_id;

    -- 6. Insert Reversal Journal Entry Header
    v_reversal_je_number := public.next_doc_number('AB');
    v_reversal_je_id := gen_random_uuid();

    INSERT INTO public.journal_entries (
        id, doc_number, company_code, fiscal_year, period,
        document_date, posting_date, document_type,
        reference_number, header_text, created_by, status
    ) VALUES (
        v_reversal_je_id, v_reversal_je_number, v_original_je.company_code,
        to_char(now(), 'YYYY'), extract(month from now())::integer,
        current_date, current_date, 'AB',
        v_original_je.doc_number, 'قيد عكسي للمستند ' || v_original_je.doc_number || ' - ' || p_reason,
        COALESCE(v_user_id::text, 'system'), 'posted'
    );

    -- 7. Insert Inverted Journal Lines (Debits -> Credits, Credits -> Debits)
    INSERT INTO public.journal_lines (
        journal_entry_id, line_item, account_number, cost_center,
        plant_code, debit, credit, line_text
    )
    SELECT
        v_reversal_je_id, line_item, account_number, cost_center,
        plant_code, credit, debit, 'عكس السطر: ' || COALESCE(line_text, '')
    FROM public.journal_lines
    WHERE journal_entry_id = v_reg.journal_entry_id;

    -- 8. Register Reversal Event in posting_registry
    INSERT INTO public.posting_registry (
        source_type, source_id, event,
        journal_doc_number, journal_entry_id, created_by
    ) VALUES (
        p_source_type, p_source_id, 'REVERSE',
        v_reversal_je_number, v_reversal_je_id, COALESCE(v_user_id::text, 'system')
    );

    -- 9. Mark Original Entry Reversed
    UPDATE public.journal_entries
    SET status = 'reversed',
        cancelled_by_document = v_reversal_je_number,
        cancellation_reason = p_reason,
        updated_at = now()
    WHERE id = v_reg.journal_entry_id;

    -- 10. Audit Event
    PERFORM public.log_audit_event(
        'REVERSE',
        'JournalEntry',
        v_reversal_je_id::text,
        jsonb_build_object('original_doc', v_original_je.doc_number),
        jsonb_build_object(
            'reversal_doc', v_reversal_je_number,
            'reason', p_reason
        ),
        v_user_id
    );

    v_result := jsonb_build_object(
        'reversalDocNumber', v_reversal_je_number,
        'reversalJeId', v_reversal_je_id
    );

    -- 11. Mark Command Done
    IF p_request_id IS NOT NULL THEN
        UPDATE public.command_requests
        SET status = 'done', result = v_result
        WHERE request_id = p_request_id AND command_name = 'reverse_posting';
    END IF;

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 13. Comprehensive Privilege Realignment
-- Revoke all function execution from PUBLIC and anon;
-- Grant execute ONLY to authenticated for explicit business endpoints.
-- next_doc_number & begin_command are revoked from authenticated.
-- ----------------------------------------------------------------------------
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

-- Explicitly revoke next_doc_number and begin_command from authenticated
REVOKE EXECUTE ON FUNCTION public.next_doc_number(text, text) FROM authenticated, PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.begin_command(uuid, text) FROM authenticated, PUBLIC, anon;

-- Grant EXECUTE to authenticated only for explicit business RPCs
GRANT EXECUTE ON FUNCTION public.complete_password_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_trip(uuid, uuid, uuid, text, text, text, numeric, timestamptz, timestamptz, numeric, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_trip(uuid, uuid, numeric, timestamptz, numeric, numeric, numeric, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_fuel_log(uuid, uuid, uuid, text, numeric, numeric, numeric, text, text, integer, timestamptz, numeric, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_parts_to_maintenance_order(uuid, uuid, text, jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_maintenance_order(uuid, uuid, numeric, numeric, numeric, date, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_journal(uuid, text, text, text, text, integer, date, date, text, text, text, jsonb, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_posting(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_audit_chain() TO authenticated;
GRANT EXECUTE ON FUNCTION public.integrity_report() TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_nightly_integrity_check(text) TO authenticated;

-- Ensure profiles select policy remains intact based on user_id = auth.uid()
DROP POLICY IF EXISTS pol_profiles_select ON public.profiles;
CREATE POLICY pol_profiles_select ON public.profiles
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid() OR
        public.has_permission('ADM', 'view') OR
        public.has_permission('AUD', 'view')
    );
