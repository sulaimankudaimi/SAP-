-- ============================================================================
-- Migration: 0014_client_contract_fixes.sql
-- Description: Client contract fixes and schema alignment:
--              1. fuel_anomaly_alerts: add resolved_at, resolved_by, updated_at, version
--                 and deprecate duplicated camelCase columns via comments.
--              2. resolve_fuel_anomaly RPC with begin_command idempotency,
--                 vehicle plant permission check, OCC, audit, and result caching.
--              3. Add fleet tables to supabase_realtime publication idempotently.
--              4. Add non-deletion guidance comments on documents tables.
-- Database: PostgreSQL 15+ (Supabase / Self-Hosted)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Upgrade fuel_anomaly_alerts Table
-- ----------------------------------------------------------------------------
ALTER TABLE public.fuel_anomaly_alerts
    ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
    ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
    ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- Add deprecation comments on camelCase columns (clients must read snake_case columns)
COMMENT ON COLUMN public.fuel_anomaly_alerts."vehiclePlate" IS 'Deprecated: Duplicate column kept for backwards compatibility. Clients must read snake_case column vehicle_plate.';
COMMENT ON COLUMN public.fuel_anomaly_alerts."recordedLPer100Km" IS 'Deprecated: Duplicate column kept for backwards compatibility. Clients must read snake_case column recorded_l_per_100km.';
COMMENT ON COLUMN public.fuel_anomaly_alerts."averageLPer100Km" IS 'Deprecated: Duplicate column kept for backwards compatibility. Clients must read snake_case column average_l_per_100km.';
COMMENT ON COLUMN public.fuel_anomaly_alerts."deviationPercentage" IS 'Deprecated: Duplicate column kept for backwards compatibility. Clients must read snake_case column deviation_percentage.';
COMMENT ON COLUMN public.fuel_anomaly_alerts."reasonSummary" IS 'Deprecated: Duplicate column kept for backwards compatibility. Clients must read snake_case column reason_summary.';

-- ----------------------------------------------------------------------------
-- 2. Command: resolve_fuel_anomaly
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_fuel_anomaly(
    p_request_id uuid,
    p_alert_id uuid,
    p_notes text DEFAULT NULL,
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
    v_alert RECORD;
    v_plant text;
    v_result jsonb;
    v_new_version integer;
    v_resolved_at timestamptz := now();
BEGIN
    -- 1. Idempotency Check via begin_command
    v_existing_result := public.begin_command(p_request_id, 'resolve_fuel_anomaly');
    IF v_existing_result IS NOT NULL THEN
        RETURN v_existing_result;
    END IF;

    -- 2. Lock & Retrieve Alert Row with Vehicle Plant
    SELECT a.*, v.plant_code
    INTO v_alert
    FROM public.fuel_anomaly_alerts a
    JOIN public.vehicles v ON v.id = a.vehicle_id
    WHERE a.id = p_alert_id AND a.is_deleted = false
    FOR UPDATE OF a;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'تنبيه استهلاك الوقود غير موجود أو تم حذفه';
    END IF;

    -- 3. Authorization Check (plant of the alert's vehicle)
    v_plant := v_alert.plant_code;
    IF NOT public.has_permission('TM', 'change', v_plant) THEN
        RAISE EXCEPTION 'غير مصرح: لا تملك صلاحية اعتماد وتسوية تنبيهات الوقود في المحطة (%)', v_plant;
    END IF;

    -- 4. Reject Already Resolved Alert
    IF v_alert.status = 'resolved' THEN
        RAISE EXCEPTION 'تنبيه استهلاك الوقود تمت تسويته مسبقاً ولا يمكن تسويته مرة أخرى';
    END IF;

    -- 5. Optimistic Concurrency Control (OCC)
    IF p_expected_version IS NOT NULL AND v_alert.version <> p_expected_version THEN
        RAISE EXCEPTION 'تعارض في التعديل المتزامن (Concurrency Conflict): تم تعديل التنبيه من قبل مستخدم آخر. الإصدار المتوقع: %، الإصدار الفعلي: %',
            p_expected_version, v_alert.version USING ERRCODE = 'P0001';
    END IF;

    v_new_version := v_alert.version + 1;

    -- 6. Update Alert
    UPDATE public.fuel_anomaly_alerts
    SET status = 'resolved',
        resolved_notes = COALESCE(p_notes, resolved_notes),
        resolved_at = v_resolved_at,
        resolved_by = v_user_id,
        updated_at = v_resolved_at,
        version = v_new_version
    WHERE id = p_alert_id;

    -- 7. Audit Event
    PERFORM public.log_audit_event(
        'UPDATE',
        'FuelAnomalyAlert',
        p_alert_id::text,
        jsonb_build_object(
            'status', v_alert.status,
            'version', v_alert.version
        ),
        jsonb_build_object(
            'status', 'resolved',
            'version', v_new_version,
            'resolved_notes', p_notes,
            'resolved_at', v_resolved_at,
            'resolved_by', v_user_id
        ),
        v_user_id
    );

    -- 8. Prepare Result Object
    v_result := jsonb_build_object(
        'id', p_alert_id,
        'status', 'resolved',
        'resolvedNotes', p_notes,
        'resolvedAt', v_resolved_at,
        'resolvedBy', v_user_id,
        'version', v_new_version
    );

    -- 9. Store Command Result as Done
    IF p_request_id IS NOT NULL THEN
        UPDATE public.command_requests
        SET status = 'done', result = v_result
        WHERE request_id = p_request_id AND command_name = 'resolve_fuel_anomaly';
    END IF;

    RETURN v_result;
END;
$$;

-- Grant EXECUTE only to authenticated (default privileges already revoked from PUBLIC/anon)
GRANT EXECUTE ON FUNCTION public.resolve_fuel_anomaly(uuid, uuid, text, integer) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. Realtime Publication Enrollment
-- Idempotently add fleet tables to supabase_realtime publication
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    v_table text;
    v_tables text[] := ARRAY[
        'vehicles',
        'drivers',
        'trips',
        'fuel_logs',
        'maintenance_orders',
        'preventive_schedules',
        'fuel_anomaly_alerts'
    ];
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        FOREACH v_table IN ARRAY v_tables LOOP
            IF NOT EXISTS (
                SELECT 1
                FROM pg_publication_tables
                WHERE pubname = 'supabase_realtime'
                  AND schemaname = 'public'
                  AND tablename = v_table
            ) THEN
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', v_table);
                RAISE NOTICE 'Added table % to supabase_realtime publication', v_table;
            ELSE
                RAISE NOTICE 'Table % is already a member of supabase_realtime publication', v_table;
            END IF;
        END LOOP;
    ELSE
        RAISE NOTICE 'supabase_realtime publication does not exist in this environment; skipping table addition.';
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Document Tables Non-Deletion Guidance Comments
-- Documents and ledgers are immutable and never deleted; filter by status instead.
-- ----------------------------------------------------------------------------
COMMENT ON TABLE public.trips IS 'Documents are never deleted; filter by status';
COMMENT ON TABLE public.fuel_logs IS 'Documents are never deleted; filter by status';
COMMENT ON TABLE public.maintenance_orders IS 'Documents are never deleted; filter by status';
