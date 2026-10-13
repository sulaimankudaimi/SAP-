-- ============================================================================
-- Migration: 0011_field_events.sql
-- Description: Offline field event persistence tables and server commands:
--              1. trip_events, odometer_readings, vehicle_inspections tables with RLS & indexes
--              2. record_trip_event (cannot create or complete trips)
--              3. record_odometer_reading (chronological boundary validation)
--              4. record_inspection
--              5. create_fuel_log chronological odometer synchronization
-- Database: PostgreSQL 15+ (Supabase / Self-Hosted)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table: trip_events (Append-Only Operational Field Telemetry)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trip_events (
    request_id uuid PRIMARY KEY,
    trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
    event_type text NOT NULL CHECK (event_type IN ('departed', 'arrived', 'delayed', 'incident')),
    occurred_at timestamptz NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_events_trip ON public.trip_events(trip_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_trip_events_vehicle ON public.trip_events(vehicle_id, occurred_at);

ALTER TABLE public.trip_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_trip_events_select ON public.trip_events
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.trips t
            WHERE t.id = trip_events.trip_id
              AND public.has_permission('TM', 'view', t.origin_plant)
        )
    );

-- ----------------------------------------------------------------------------
-- 2. Table: odometer_readings (Chronological Ingestion Registry)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.odometer_readings (
    request_id uuid PRIMARY KEY,
    vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    reading_km numeric(18,2) NOT NULL,
    captured_at timestamptz NOT NULL,
    source text NOT NULL DEFAULT 'driver_check_in',
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_odometer_readings_vehicle_time
    ON public.odometer_readings(vehicle_id, captured_at DESC);

ALTER TABLE public.odometer_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_odometer_readings_select ON public.odometer_readings
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.vehicles v
            WHERE v.id = odometer_readings.vehicle_id
              AND public.has_permission('TM', 'view', v.plant_code)
        )
    );

-- ----------------------------------------------------------------------------
-- 3. Table: vehicle_inspections (Pre/Post-Trip Checklists)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_inspections (
    request_id uuid PRIMARY KEY,
    vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    inspected_at timestamptz NOT NULL,
    result text NOT NULL CHECK (result IN ('pass', 'fail', 'warning')),
    notes text,
    checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_vehicle_time
    ON public.vehicle_inspections(vehicle_id, inspected_at DESC);

ALTER TABLE public.vehicle_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_vehicle_inspections_select ON public.vehicle_inspections
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.vehicles v
            WHERE v.id = vehicle_inspections.vehicle_id
              AND public.has_permission('TM', 'view', v.plant_code)
        )
    );

-- ----------------------------------------------------------------------------
-- 4. Command: record_trip_event (CAN NEVER complete or create a trip)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_trip_event(
    p_request_id uuid,
    p_trip_id uuid,
    p_vehicle_id uuid,
    p_event_type text,
    p_occurred_at timestamptz,
    p_payload jsonb DEFAULT '{}'::jsonb
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
    v_result jsonb;
BEGIN
    -- 1. Idempotency Check
    v_existing_result := public.begin_command(p_request_id, 'record_trip_event');
    IF v_existing_result IS NOT NULL THEN
        RETURN v_existing_result;
    END IF;

    -- Validate Event Type
    IF p_event_type NOT IN ('departed', 'arrived', 'delayed', 'incident') THEN
        RAISE EXCEPTION 'نوع الحدث التشغيلي (%) غير مدعوم', p_event_type;
    END IF;

    -- Validate Trip
    SELECT * INTO v_trip
    FROM public.trips
    WHERE id = p_trip_id AND is_deleted = false;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'الرحلة المرتبطة بالحدث غير موجودة';
    END IF;

    IF NOT public.has_permission('TM', 'create', v_trip.origin_plant) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية تسجيل أحداث الرحلات في المحطة (%)', v_trip.origin_plant;
    END IF;

    -- Insert Event Row (Strictly Append-Only, Does NOT modify trip status or complete it)
    INSERT INTO public.trip_events (
        request_id, trip_id, vehicle_id, event_type,
        occurred_at, payload, created_by
    ) VALUES (
        p_request_id, p_trip_id, p_vehicle_id, p_event_type,
        p_occurred_at, COALESCE(p_payload, '{}'::jsonb), COALESCE(v_user_id::text, 'field_user')
    );

    -- Audit Event
    PERFORM public.log_audit_event(
        'CREATE',
        'TripEvent',
        p_request_id::text,
        NULL,
        jsonb_build_object(
            'trip_id', p_trip_id,
            'event_type', p_event_type,
            'occurred_at', p_occurred_at
        ),
        v_user_id
    );

    v_result := jsonb_build_object(
        'requestId', p_request_id,
        'tripId', p_trip_id,
        'eventType', p_event_type,
        'occurredAt', p_occurred_at,
        'status', 'recorded'
    );

    IF p_request_id IS NOT NULL THEN
        UPDATE public.command_requests
        SET status = 'done', result = v_result
        WHERE request_id = p_request_id AND command_name = 'record_trip_event';
    END IF;

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Command: record_odometer_reading (Strict Chronological Boundary Validation)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_odometer_reading(
    p_request_id uuid,
    p_vehicle_id uuid,
    p_reading_km numeric(18,2),
    p_captured_at timestamptz,
    p_source text DEFAULT 'mobile'
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
    v_max_before numeric(18,2);
    v_min_after numeric(18,2);
    v_is_latest boolean := false;
    v_result jsonb;
BEGIN
    v_existing_result := public.begin_command(p_request_id, 'record_odometer_reading');
    IF v_existing_result IS NOT NULL THEN
        RETURN v_existing_result;
    END IF;

    SELECT * INTO v_vehicle
    FROM public.vehicles
    WHERE id = p_vehicle_id AND is_deleted = false
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'المركبة غير موجودة أو تم حذفها';
    END IF;

    IF NOT public.has_permission('TM', 'create', v_vehicle.plant_code) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية تسجيل قراءات العداد في المحطة (%)', v_vehicle.plant_code;
    END IF;

    -- Chronological Boundary Invariant 1:
    -- Reading must be >= the greatest reading captured at or before it
    SELECT MAX(reading_km) INTO v_max_before
    FROM public.odometer_readings
    WHERE vehicle_id = p_vehicle_id AND captured_at <= p_captured_at;

    IF v_max_before IS NOT NULL AND p_reading_km < v_max_before THEN
        RAISE EXCEPTION 'خطأ تسلسل العداد الزمني: القراءة المقدمة (%) كم أقل من قراءة سابقة مسجلة بتوقيت (%) كم',
            p_reading_km, v_max_before USING ERRCODE = 'P0002';
    END IF;

    -- Chronological Boundary Invariant 2:
    -- Reading must be <= the smallest reading captured after it
    SELECT MIN(reading_km) INTO v_min_after
    FROM public.odometer_readings
    WHERE vehicle_id = p_vehicle_id AND captured_at > p_captured_at;

    IF v_min_after IS NOT NULL AND p_reading_km > v_min_after THEN
        RAISE EXCEPTION 'خطأ تسلسل العداد الزمني: القراءة المقدمة (%) كم أكبر من قراءة لاحقة مسجلة بتوقيت لاحق (%) كم',
            p_reading_km, v_min_after USING ERRCODE = 'P0002';
    END IF;

    -- Insert reading into history
    INSERT INTO public.odometer_readings (
        request_id, vehicle_id, reading_km, captured_at, source, created_by
    ) VALUES (
        p_request_id, p_vehicle_id, p_reading_km, p_captured_at, p_source, COALESCE(v_user_id::text, 'field_user')
    );

    -- Only update vehicle.current_odometer if this reading is the latest chronologically
    IF NOT EXISTS (
        SELECT 1 FROM public.odometer_readings
        WHERE vehicle_id = p_vehicle_id AND captured_at > p_captured_at
    ) THEN
        v_is_latest := true;
        IF p_reading_km > v_vehicle.current_odometer THEN
            UPDATE public.vehicles
            SET current_odometer = p_reading_km,
                updated_at = now()
            WHERE id = p_vehicle_id;
        END IF;
    END IF;

    PERFORM public.log_audit_event(
        'CREATE',
        'OdometerReading',
        p_request_id::text,
        NULL,
        jsonb_build_object(
            'vehicle_id', p_vehicle_id,
            'reading_km', p_reading_km,
            'captured_at', p_captured_at,
            'is_latest', v_is_latest
        ),
        v_user_id
    );

    v_result := jsonb_build_object(
        'requestId', p_request_id,
        'vehicleId', p_vehicle_id,
        'readingKm', p_reading_km,
        'capturedAt', p_captured_at,
        'isLatest', v_is_latest
    );

    IF p_request_id IS NOT NULL THEN
        UPDATE public.command_requests
        SET status = 'done', result = v_result
        WHERE request_id = p_request_id AND command_name = 'record_odometer_reading';
    END IF;

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Command: record_inspection
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_inspection(
    p_request_id uuid,
    p_vehicle_id uuid,
    p_inspected_at timestamptz,
    p_result text,
    p_notes text DEFAULT NULL,
    p_checklist jsonb DEFAULT '{}'::jsonb
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
    v_existing_result := public.begin_command(p_request_id, 'record_inspection');
    IF v_existing_result IS NOT NULL THEN
        RETURN v_existing_result;
    END IF;

    IF p_result NOT IN ('pass', 'fail', 'warning') THEN
        RAISE EXCEPTION 'نتيجة الفحص (%) غير صالحة. القيم المسموحة: pass, fail, warning', p_result;
    END IF;

    SELECT * INTO v_vehicle
    FROM public.vehicles
    WHERE id = p_vehicle_id AND is_deleted = false;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'المركبة غير موجودة أو تم حذفها';
    END IF;

    IF NOT public.has_permission('TM', 'create', v_vehicle.plant_code) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية تسجيل فحص السلامة في المحطة (%)', v_vehicle.plant_code;
    END IF;

    INSERT INTO public.vehicle_inspections (
        request_id, vehicle_id, inspected_at, result, notes, checklist, created_by
    ) VALUES (
        p_request_id, p_vehicle_id, p_inspected_at, p_result, p_notes,
        COALESCE(p_checklist, '{}'::jsonb), COALESCE(v_user_id::text, 'inspector')
    );

    PERFORM public.log_audit_event(
        'CREATE',
        'VehicleInspection',
        p_request_id::text,
        NULL,
        jsonb_build_object(
            'vehicle_id', p_vehicle_id,
            'result', p_result,
            'inspected_at', p_inspected_at
        ),
        v_user_id
    );

    v_result := jsonb_build_object(
        'requestId', p_request_id,
        'vehicleId', p_vehicle_id,
        'result', p_result,
        'inspectedAt', p_inspected_at
    );

    IF p_request_id IS NOT NULL THEN
        UPDATE public.command_requests
        SET status = 'done', result = v_result
        WHERE request_id = p_request_id AND command_name = 'record_inspection';
    END IF;

    RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Grant Privileges
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.record_trip_event FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_odometer_reading FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_inspection FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.record_trip_event TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_odometer_reading TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_inspection TO authenticated;
