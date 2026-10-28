-- ============================================================================
-- Migration: 0008_integrity_runs_scheduled.sql
-- Description: Nightly automated integrity audit job & persistence table
-- Database: PostgreSQL 15+ (Supabase / Self-Hosted)
-- ============================================================================

-- 1. Create integrity_runs Table
CREATE TABLE IF NOT EXISTS public.integrity_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_at timestamptz NOT NULL DEFAULT now(),
    status text NOT NULL CHECK (status IN ('PASS', 'FAIL')),
    total_violations bigint NOT NULL DEFAULT 0,
    report_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    triggered_by text NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'manual', 'edge_function'
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for rapid retrieval of the latest run
CREATE INDEX IF NOT EXISTS idx_integrity_runs_run_at ON public.integrity_runs (run_at DESC);

-- Enable Row Level Security
ALTER TABLE public.integrity_runs ENABLE ROW LEVEL SECURITY;

-- RLS: Authenticated users can view integrity runs
CREATE POLICY integrity_runs_select_authenticated
    ON public.integrity_runs
    FOR SELECT
    TO authenticated
    USING (true);

-- RLS: Only postgres / service_role can directly insert
CREATE POLICY integrity_runs_insert_service_role
    ON public.integrity_runs
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 2. Nightly Integrity Runner Stored Procedure
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_nightly_integrity_check(p_triggered_by text DEFAULT 'scheduled')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_run_id uuid;
    v_invariants jsonb := '[]'::jsonb;
    v_inv RECORD;
    v_total_violations bigint := 0;
    v_status text := 'PASS';
    v_audit_check RECORD;
    v_audit_json jsonb;
    v_stuck_outbox jsonb;
    v_stuck_count bigint := 0;
    v_report jsonb;
BEGIN
    -- 1. Execute integrity_report() auditing all 7 ADR invariants
    FOR v_inv IN SELECT * FROM public.integrity_report() ORDER BY invariant_number ASC LOOP
        v_total_violations := v_total_violations + COALESCE(v_inv.violations_count, 0);
        v_invariants := v_invariants || jsonb_build_object(
            'invariantNumber', v_inv.invariant_number,
            'invariantName', v_inv.invariant_name,
            'status', v_inv.status,
            'violationsCount', v_inv.violations_count,
            'sampleIds', v_inv.sample_ids,
            'description', v_inv.description
        );
    END LOOP;

    -- 2. Verify Cryptographic Audit Chain
    SELECT * INTO v_audit_check FROM public.verify_audit_chain();
    IF NOT v_audit_check.is_valid THEN
        v_total_violations := v_total_violations + 1;
    END IF;

    v_audit_json := jsonb_build_object(
        'isValid', v_audit_check.is_valid,
        'totalRecords', v_audit_check.total_records,
        'brokenSeq', v_audit_check.broken_seq,
        'brokenId', v_audit_check.broken_id,
        'expectedHash', v_audit_check.expected_hash,
        'actualHash', v_audit_check.actual_hash,
        'errorMessage', v_audit_check.error_message
    );

    -- 3. Check for Stuck Outbox Commands (> 24h)
    SELECT
        count(*),
        COALESCE(jsonb_agg(jsonb_build_object(
            'id', o.id,
            'type', o.type,
            'status', o.status,
            'createdAt', o.created_at,
            'vehicleId', o.vehicle_id,
            'attempts', o.attempts,
            'lastError', o.last_error
        )), '[]'::jsonb)
    INTO v_stuck_count, v_stuck_outbox
    FROM public.outbox o
    WHERE o.status IN ('pending', 'needs_review')
      AND o.created_at <= (now() - interval '24 hours');

    v_total_violations := v_total_violations + v_stuck_count;

    -- Determine overall status
    IF v_total_violations > 0 THEN
        v_status := 'FAIL';
    ELSE
        v_status := 'PASS';
    END IF;

    -- Assemble full report JSON
    v_report := jsonb_build_object(
        'timestamp', now(),
        'mode', 'server',
        'status', v_status,
        'totalViolations', v_total_violations,
        'invariants', v_invariants,
        'auditChain', v_audit_json,
        'stuckOutbox', jsonb_build_object(
            'count', v_stuck_count,
            'items', v_stuck_outbox
        ),
        'executedBy', p_triggered_by
    );

    -- Insert record into integrity_runs
    INSERT INTO public.integrity_runs (
        status,
        total_violations,
        report_data,
        triggered_by
    ) VALUES (
        v_status,
        v_total_violations,
        v_report,
        p_triggered_by
    ) RETURNING id INTO v_run_id;

    RETURN v_run_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.run_nightly_integrity_check(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.run_nightly_integrity_check(text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Scheduled Job Configuration (pg_cron & Edge Function Options)
-- ----------------------------------------------------------------------------

-- OPTION A: In-Database pg_cron Job (Nightly at 02:00 AM UTC)
-- Runs inside PostgreSQL without external dependencies.
DO $$
BEGIN
    BEGIN
        CREATE EXTENSION IF NOT EXISTS pg_cron;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'pg_cron extension not available: %', SQLERRM;
    END;

    IF EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) THEN
        -- Remove existing schedule if already registered to avoid duplicates
        PERFORM cron.unschedule('nightly-integrity-check')
        WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nightly-integrity-check');

        -- Schedule to run every night at 02:00 AM UTC (05:00 AM Damascus Time)
        PERFORM cron.schedule(
            'nightly-integrity-check',
            '0 2 * * *',
            'SELECT public.run_nightly_integrity_check(''pg_cron'');'
        );
    ELSE
        RAISE NOTICE 'pg_cron extension not active; schedule via Edge Function or external cron.';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Non-blocking notice if pg_cron is disabled in target environment
        RAISE NOTICE 'pg_cron scheduling skipped: %', SQLERRM;
END;
$$;

-- ============================================================================
-- DOCUMENTATION: SCHEDULING OPTIONS
-- ============================================================================
--
-- OPTION A: pg_cron (Native PostgreSQL)
-- 1. Enable extension: CREATE EXTENSION IF NOT EXISTS pg_cron;
-- 2. Verify schedule:  SELECT * FROM cron.job WHERE jobname = 'nightly-integrity-check';
-- 3. Check run logs:   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- 4. Manual trigger:   SELECT public.run_nightly_integrity_check('manual_sql');
--
-- OPTION B: Supabase Edge Function / HTTP Webhook
-- When pg_cron is managed externally or on Supabase Cloud:
-- 1. Create Edge Function: `supabase/functions/nightly-integrity/index.ts`
-- 2. Trigger nightly via Supabase Cron or GitHub Action:
--    curl -X POST "https://<PROJECT-REF>.supabase.co/functions/v1/nightly-integrity" \
--         -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>" \
--         -H "Content-Type: application/json"
-- 3. Function invokes RPC: supabase.rpc('run_nightly_integrity_check', { p_triggered_by: 'edge_function' })
-- ============================================================================
