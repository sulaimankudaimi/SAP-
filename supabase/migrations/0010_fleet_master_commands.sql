-- ============================================================================
-- Migration: 0010_fleet_master_commands.sql
-- Description: Server-authoritative RPCs for Fleet master data mutations:
--              create_vehicle, update_vehicle, set_vehicle_active,
--              create_driver, update_driver, set_driver_active.
--              Enforces explicit column whitelists, OCC version checks,
--              fail-closed permissions, and soft-deactivation (never deletes).
-- Database: PostgreSQL 15+ (Supabase / Self-Hosted)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Command: create_vehicle
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_vehicle(
    p_request_id uuid,
    p_code text,
    p_plate_number text,
    p_type text,
    p_make_model text,
    p_plant_code text,
    p_cost_center text,
    p_vin text DEFAULT NULL,
    p_year integer DEFAULT NULL,
    p_capacity_liters numeric(18,3) DEFAULT 0.000,
    p_current_odometer numeric(18,2) DEFAULT 0.00,
    p_fuel_type text DEFAULT 'Diesel',
    p_assigned_driver_id uuid DEFAULT NULL,
    p_insurance_expiry date DEFAULT NULL,
    p_registration_expiry date DEFAULT NULL
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
    v_vehicle_id uuid := gen_random_uuid();
    v_result jsonb;
BEGIN
    -- 1. Idempotency Check via begin_command
    v_existing_result := public.begin_command(p_request_id, 'create_vehicle');
    IF v_existing_result IS NOT NULL THEN
        RETURN v_existing_result;
    END IF;

    -- 2. Authorization Check (Fail-closed on plant)
    IF NOT public.has_permission('TM', 'create', p_plant_code) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية إنشاء مركبة جديدة في المحطة (%)', p_plant_code;
    END IF;

    -- 3. Insert Vehicle (Whitelist of columns)
    INSERT INTO public.vehicles (
        id, code, plate_number, type, make_model, vin, year,
        capacity_liters, current_odometer, fuel_type, assigned_driver_id,
        plant_code, cost_center, status, insurance_expiry, registration_expiry,
        is_deleted, created_by, version
    ) VALUES (
        v_vehicle_id, trim(p_code), trim(p_plate_number), p_type, trim(p_make_model), p_vin, p_year,
        COALESCE(p_capacity_liters, 0.000), COALESCE(p_current_odometer, 0.00), p_fuel_type, p_assigned_driver_id,
        p_plant_code, p_cost_center, 'available', p_insurance_expiry, p_registration_expiry,
        false, COALESCE(v_user_id::text, 'system'), 1
    );

    -- 4. Audit Trail
    PERFORM public.log_audit_event(
        'CREATE',
        'Vehicle',
        v_vehicle_id::text,
        NULL,
        jsonb_build_object(
            'code', p_code,
            'plate_number', p_plate_number,
            'plant_code', p_plant_code,
            'make_model', p_make_model
        ),
        v_user_id
    );

    -- 5. Prepare Return Object
    SELECT to_jsonb(v) INTO v_result
    FROM public.vehicles v
    WHERE v.id = v_vehicle_id;

    -- 6. Mark Command Done
    IF p_request_id IS NOT NULL THEN
        UPDATE public.command_requests
        SET status = 'done', result = v_result
        WHERE request_id = p_request_id AND command_name = 'create_vehicle';
    END IF;

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Command: update_vehicle
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_vehicle(
    p_request_id uuid,
    p_id uuid,
    p_expected_version integer,
    p_plate_number text DEFAULT NULL,
    p_make_model text DEFAULT NULL,
    p_type text DEFAULT NULL,
    p_fuel_type text DEFAULT NULL,
    p_capacity_liters numeric(18,3) DEFAULT NULL,
    p_assigned_driver_id uuid DEFAULT NULL,
    p_plant_code text DEFAULT NULL,
    p_cost_center text DEFAULT NULL,
    p_status text DEFAULT NULL,
    p_insurance_expiry date DEFAULT NULL,
    p_registration_expiry date DEFAULT NULL
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
    v_vehicle RECORD;
    v_target_plant text;
    v_result jsonb;
BEGIN
    -- 1. Idempotency Check
    v_existing_result := public.begin_command(p_request_id, 'update_vehicle');
    IF v_existing_result IS NOT NULL THEN
        RETURN v_existing_result;
    END IF;

    -- 2. Lock & Retrieve Current Row
    SELECT * INTO v_vehicle
    FROM public.vehicles
    WHERE id = p_id AND is_deleted = false
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'المركبة غير موجودة أو تم حذفها';
    END IF;

    -- 3. Optimistic Concurrency Control (OCC)
    IF p_expected_version IS NOT NULL AND v_vehicle.version <> p_expected_version THEN
        RAISE EXCEPTION 'تعارض في التعديل المتزامن للمركبة (Concurrency Conflict): الإصدار المتوقع: %، الإصدار الفعلي: %',
            p_expected_version, v_vehicle.version USING ERRCODE = 'P0001';
    END IF;

    -- 4. Authorization Check
    v_target_plant := COALESCE(p_plant_code, v_vehicle.plant_code);
    IF NOT public.has_permission('TM', 'change', v_target_plant) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية تعديل بيانات المركبة في المحطة (%)', v_target_plant;
    END IF;

    -- 5. Explicit Whitelist Column Updates
    UPDATE public.vehicles
    SET plate_number = COALESCE(NULLIF(trim(p_plate_number), ''), v_vehicle.plate_number),
        make_model = COALESCE(NULLIF(trim(p_make_model), ''), v_vehicle.make_model),
        type = COALESCE(NULLIF(trim(p_type), ''), v_vehicle.type),
        fuel_type = COALESCE(NULLIF(trim(p_fuel_type), ''), v_vehicle.fuel_type),
        capacity_liters = COALESCE(p_capacity_liters, v_vehicle.capacity_liters),
        assigned_driver_id = CASE
            WHEN p_assigned_driver_id IS NOT NULL THEN p_assigned_driver_id
            ELSE v_vehicle.assigned_driver_id
        END,
        plant_code = v_target_plant,
        cost_center = COALESCE(NULLIF(trim(p_cost_center), ''), v_vehicle.cost_center),
        status = COALESCE(NULLIF(trim(p_status), ''), v_vehicle.status),
        insurance_expiry = COALESCE(p_insurance_expiry, v_vehicle.insurance_expiry),
        registration_expiry = COALESCE(p_registration_expiry, v_vehicle.registration_expiry),
        updated_at = now()
    WHERE id = p_id;

    -- 6. Audit Trail
    PERFORM public.log_audit_event(
        'UPDATE',
        'Vehicle',
        p_id::text,
        jsonb_build_object('version', v_vehicle.version, 'plate', v_vehicle.plate_number),
        jsonb_build_object('version', v_vehicle.version + 1, 'plate', COALESCE(p_plate_number, v_vehicle.plate_number)),
        v_user_id
    );

    -- 7. Fetch Updated Vehicle
    SELECT to_jsonb(v) INTO v_result
    FROM public.vehicles v
    WHERE v.id = p_id;

    -- 8. Mark Command Done
    IF p_request_id IS NOT NULL THEN
        UPDATE public.command_requests
        SET status = 'done', result = v_result
        WHERE request_id = p_request_id AND command_name = 'update_vehicle';
    END IF;

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Command: set_vehicle_active (Soft Deactivation - Never Deletes)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_vehicle_active(
    p_request_id uuid,
    p_id uuid,
    p_is_active boolean,
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
    v_vehicle RECORD;
    v_result jsonb;
BEGIN
    v_existing_result := public.begin_command(p_request_id, 'set_vehicle_active');
    IF v_existing_result IS NOT NULL THEN
        RETURN v_existing_result;
    END IF;

    SELECT * INTO v_vehicle
    FROM public.vehicles
    WHERE id = p_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'المركبة غير موجودة';
    END IF;

    IF p_expected_version IS NOT NULL AND v_vehicle.version <> p_expected_version THEN
        RAISE EXCEPTION 'تعارض في التعديل المتزامن (Concurrency Conflict): الإصدار المتوقع: %، الإصدار الفعلي: %',
            p_expected_version, v_vehicle.version USING ERRCODE = 'P0001';
    END IF;

    IF NOT public.has_permission('TM', 'change', v_vehicle.plant_code) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية تغيير حالة تفعيل المركبة في المحطة (%)', v_vehicle.plant_code;
    END IF;

    -- Soft Deactivation / Activation
    UPDATE public.vehicles
    SET is_deleted = NOT p_is_active,
        status = CASE WHEN p_is_active THEN 'available' ELSE 'out_of_service' END,
        updated_at = now()
    WHERE id = p_id;

    PERFORM public.log_audit_event(
        'UPDATE',
        'Vehicle',
        p_id::text,
        jsonb_build_object('is_deleted', v_vehicle.is_deleted, 'status', v_vehicle.status),
        jsonb_build_object('is_deleted', NOT p_is_active, 'status', CASE WHEN p_is_active THEN 'available' ELSE 'out_of_service' END),
        v_user_id
    );

    SELECT to_jsonb(v) INTO v_result
    FROM public.vehicles v
    WHERE v.id = p_id;

    IF p_request_id IS NOT NULL THEN
        UPDATE public.command_requests
        SET status = 'done', result = v_result
        WHERE request_id = p_request_id AND command_name = 'set_vehicle_active';
    END IF;

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Command: create_driver
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_driver(
    p_request_id uuid,
    p_code text,
    p_name text,
    p_iqama_number text,
    p_mobile text,
    p_license_number text,
    p_license_class text,
    p_license_expiry date,
    p_plant_code text,
    p_safety_rating numeric(3,2) DEFAULT 5.00
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
    v_driver_id uuid := gen_random_uuid();
    v_result jsonb;
BEGIN
    v_existing_result := public.begin_command(p_request_id, 'create_driver');
    IF v_existing_result IS NOT NULL THEN
        RETURN v_existing_result;
    END IF;

    IF NOT public.has_permission('TM', 'create', p_plant_code) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية إضافة سائق جديد في المحطة (%)', p_plant_code;
    END IF;

    INSERT INTO public.drivers (
        id, code, name, iqama_number, mobile, license_number,
        license_class, license_expiry, plant_code, status, safety_rating,
        total_trips_completed, total_distance_km, is_deleted, created_by, version
    ) VALUES (
        v_driver_id, trim(p_code), trim(p_name), trim(p_iqama_number), trim(p_mobile),
        trim(p_license_number), p_license_class, p_license_expiry, p_plant_code,
        'available', COALESCE(p_safety_rating, 5.00), 0, 0.00,
        false, COALESCE(v_user_id::text, 'system'), 1
    );

    PERFORM public.log_audit_event(
        'CREATE',
        'Driver',
        v_driver_id::text,
        NULL,
        jsonb_build_object('code', p_code, 'name', p_name, 'plant_code', p_plant_code),
        v_user_id
    );

    SELECT to_jsonb(d) INTO v_result
    FROM public.drivers d
    WHERE d.id = v_driver_id;

    IF p_request_id IS NOT NULL THEN
        UPDATE public.command_requests
        SET status = 'done', result = v_result
        WHERE request_id = p_request_id AND command_name = 'create_driver';
    END IF;

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Command: update_driver
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_driver(
    p_request_id uuid,
    p_id uuid,
    p_expected_version integer,
    p_name text DEFAULT NULL,
    p_mobile text DEFAULT NULL,
    p_license_number text DEFAULT NULL,
    p_license_class text DEFAULT NULL,
    p_license_expiry date DEFAULT NULL,
    p_plant_code text DEFAULT NULL,
    p_status text DEFAULT NULL,
    p_safety_rating numeric(3,2) DEFAULT NULL
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
    v_driver RECORD;
    v_target_plant text;
    v_result jsonb;
BEGIN
    v_existing_result := public.begin_command(p_request_id, 'update_driver');
    IF v_existing_result IS NOT NULL THEN
        RETURN v_existing_result;
    END IF;

    SELECT * INTO v_driver
    FROM public.drivers
    WHERE id = p_id AND is_deleted = false
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'السائق غير موجود أو تم حذفه';
    END IF;

    IF p_expected_version IS NOT NULL AND v_driver.version <> p_expected_version THEN
        RAISE EXCEPTION 'تعارض في التعديل المتزامن للسائق (Concurrency Conflict): الإصدار المتوقع: %، الإصدار الفعلي: %',
            p_expected_version, v_driver.version USING ERRCODE = 'P0001';
    END IF;

    v_target_plant := COALESCE(p_plant_code, v_driver.plant_code);
    IF NOT public.has_permission('TM', 'change', v_target_plant) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية تعديل بيانات السائق في المحطة (%)', v_target_plant;
    END IF;

    UPDATE public.drivers
    SET name = COALESCE(NULLIF(trim(p_name), ''), v_driver.name),
        mobile = COALESCE(NULLIF(trim(p_mobile), ''), v_driver.mobile),
        license_number = COALESCE(NULLIF(trim(p_license_number), ''), v_driver.license_number),
        license_class = COALESCE(NULLIF(trim(p_license_class), ''), v_driver.license_class),
        license_expiry = COALESCE(p_license_expiry, v_driver.license_expiry),
        plant_code = v_target_plant,
        status = COALESCE(NULLIF(trim(p_status), ''), v_driver.status),
        safety_rating = COALESCE(p_safety_rating, v_driver.safety_rating),
        updated_at = now()
    WHERE id = p_id;

    PERFORM public.log_audit_event(
        'UPDATE',
        'Driver',
        p_id::text,
        jsonb_build_object('name', v_driver.name, 'version', v_driver.version),
        jsonb_build_object('name', COALESCE(p_name, v_driver.name), 'version', v_driver.version + 1),
        v_user_id
    );

    SELECT to_jsonb(d) INTO v_result
    FROM public.drivers d
    WHERE d.id = p_id;

    IF p_request_id IS NOT NULL THEN
        UPDATE public.command_requests
        SET status = 'done', result = v_result
        WHERE request_id = p_request_id AND command_name = 'update_driver';
    END IF;

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Command: set_driver_active (Soft Deactivation)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_driver_active(
    p_request_id uuid,
    p_id uuid,
    p_is_active boolean,
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
    v_driver RECORD;
    v_result jsonb;
BEGIN
    v_existing_result := public.begin_command(p_request_id, 'set_driver_active');
    IF v_existing_result IS NOT NULL THEN
        RETURN v_existing_result;
    END IF;

    SELECT * INTO v_driver
    FROM public.drivers
    WHERE id = p_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'السائق غير موجود';
    END IF;

    IF p_expected_version IS NOT NULL AND v_driver.version <> p_expected_version THEN
        RAISE EXCEPTION 'تعارض في التعديل المتزامن (Concurrency Conflict): الإصدار المتوقع: %، الإصدار الفعلي: %',
            p_expected_version, v_driver.version USING ERRCODE = 'P0001';
    END IF;

    IF NOT public.has_permission('TM', 'change', v_driver.plant_code) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية تغيير حالة تفعيل السائق في المحطة (%)', v_driver.plant_code;
    END IF;

    UPDATE public.drivers
    SET is_deleted = NOT p_is_active,
        status = CASE WHEN p_is_active THEN 'available' ELSE 'suspended' END,
        updated_at = now()
    WHERE id = p_id;

    PERFORM public.log_audit_event(
        'UPDATE',
        'Driver',
        p_id::text,
        jsonb_build_object('is_deleted', v_driver.is_deleted, 'status', v_driver.status),
        jsonb_build_object('is_deleted', NOT p_is_active, 'status', CASE WHEN p_is_active THEN 'available' ELSE 'suspended' END),
        v_user_id
    );

    SELECT to_jsonb(d) INTO v_result
    FROM public.drivers d
    WHERE d.id = p_id;

    IF p_request_id IS NOT NULL THEN
        UPDATE public.command_requests
        SET status = 'done', result = v_result
        WHERE request_id = p_request_id AND command_name = 'set_driver_active';
    END IF;

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Grant Privileges to authenticated
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_vehicle FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_vehicle FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_vehicle_active FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_driver FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_driver FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_driver_active FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_vehicle TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_vehicle TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_vehicle_active TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_driver TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_driver TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_driver_active TO authenticated;
