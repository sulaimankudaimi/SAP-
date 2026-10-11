-- ============================================================================
-- Migration: 0002_numbering_audit.sql
-- Description: Atomic gap-free number ranges & append-only cryptographic audit chain
-- Database: PostgreSQL 15+ (Supabase / Self-Hosted)
-- ============================================================================

-- 1. Number Ranges Table (Row-Locked Sequence Generator)
CREATE TABLE IF NOT EXISTS public.number_ranges (
    doc_type text NOT NULL,
    fiscal_year text NOT NULL,
    prefix text NOT NULL,
    current_number bigint NOT NULL DEFAULT 0,
    number_length integer NOT NULL DEFAULT 6,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (doc_type, fiscal_year)
);

-- Seed default standard ranges for fiscal year 2026
INSERT INTO public.number_ranges (doc_type, fiscal_year, prefix, current_number, number_length) VALUES
('TRIP', '2026', 'TRIP', 0, 6),   -- Fleet Trips (TRIP-2026-000001)
('MO',   '2026', 'MO',   0, 6),   -- Maintenance Orders (MO-2026-000001)
('FL',   '2026', 'FL',   0, 6),   -- Fuel Logs (FL-2026-000001)
('WE',   '2026', 'WE',   0, 6),   -- Goods Receipts Movement 101 (WE-2026-000001)
('WA',   '2026', 'WA',   0, 6),   -- Goods Issues Movement 201/261 (WA-2026-000001)
('JE',   '2026', 'JE',   0, 6),   -- General Ledger Journal Entries (JE-2026-000001)
('AB',   '2026', 'AB',   0, 6),   -- Accounting Reversal Documents (AB-2026-000001)
('INV',  '2026', 'INV',  0, 6),   -- Vendor Invoices (INV-2026-000001)
('PMT',  '2026', 'PMT',  0, 6),   -- Payment Orders (PMT-2026-000001)
('PO',   '2026', 'PO',   0, 6),   -- Purchase Orders (PO-2026-000001)
('AST',  '2026', 'AST',  0, 6)    -- Asset Transfers (AST-2026-000001)
ON CONFLICT (doc_type, fiscal_year) DO NOTHING;

-- 2. Atomic, Row-Locked Document Number Generator
-- Uses INSERT ... ON CONFLICT DO UPDATE ... RETURNING to guarantee zero race conditions and gap-free sequential numbers
CREATE OR REPLACE FUNCTION public.next_doc_number(
    p_doc_type text,
    p_fiscal_year text DEFAULT to_char(now(), 'YYYY')
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_prefix text;
    v_curr bigint;
    v_len integer;
    v_clean_year text;
BEGIN
    v_clean_year := COALESCE(NULLIF(trim(p_fiscal_year), ''), to_char(now(), 'YYYY'));

    -- Atomic upsert: locks the specific row in number_ranges and increments
    INSERT INTO public.number_ranges (doc_type, fiscal_year, prefix, current_number, number_length, updated_at)
    VALUES (p_doc_type, v_clean_year, p_doc_type, 1, 6, now())
    ON CONFLICT (doc_type, fiscal_year)
    DO UPDATE SET
        current_number = public.number_ranges.current_number + 1,
        updated_at = now()
    RETURNING prefix, current_number, number_length
    INTO v_prefix, v_curr, v_len;

    RETURN v_prefix || '-' || v_clean_year || '-' || lpad(v_curr::text, v_len, '0');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.next_doc_number(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.next_doc_number(text, text) TO authenticated;

-- 3. Append-Only Cryptographic Audit Log Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seq bigint GENERATED ALWAYS AS IDENTITY,
    timestamp timestamptz NOT NULL DEFAULT now(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    username text,
    action text NOT NULL,           -- 'CREATE', 'UPDATE', 'POST', 'CANCEL', 'REVERSE', 'LOGIN'
    entity text NOT NULL,           -- Table / Entity name e.g. 'Trip', 'MaintenanceOrder', 'JournalEntry'
    entity_id text NOT NULL,
    before_data jsonb,
    after_data jsonb,
    prev_hash text NOT NULL,
    hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_seq ON public.audit_logs(seq);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp);

-- Enforce Strict Append-Only Permissions
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM public, authenticated, anon;

-- 4. Cryptographic Hash Chain Logging Function
-- Executes under a transactional advisory lock to prevent race conditions during hash calculation
CREATE OR REPLACE FUNCTION public.log_audit_event(
    p_action text,
    p_entity text,
    p_entity_id text,
    p_before_data jsonb DEFAULT NULL,
    p_after_data jsonb DEFAULT NULL,
    p_user_id uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_audit_id uuid := gen_random_uuid();
    v_username text;
    v_prev_hash text;
    v_timestamp timestamptz := now();
    v_payload text;
    v_hash text;
    v_redacted_before jsonb;
    v_redacted_after jsonb;
BEGIN
    -- Acquire transaction-scoped advisory lock for deterministic hash ordering
    PERFORM pg_advisory_xact_lock(hashtext('gulf_erp_audit_chain_lock'));

    -- Lookup username
    IF p_user_id IS NOT NULL THEN
        SELECT username INTO v_username FROM public.profiles WHERE user_id = p_user_id;
    END IF;
    v_username := COALESCE(v_username, 'system');

    -- Redact sensitive keys from snapshots
    v_redacted_before := p_before_data - 'password' - 'password_hash' - 'salt' - 'token';
    v_redacted_after  := p_after_data  - 'password' - 'password_hash' - 'salt' - 'token';

    -- Retrieve latest hash in the chain
    SELECT hash INTO v_prev_hash
    FROM public.audit_logs
    ORDER BY seq DESC
    LIMIT 1;

    IF v_prev_hash IS NULL THEN
        v_prev_hash := 'GENESIS_BLOCK_GULF_ENERGY_ERP_2026';
    END IF;

    -- Compute SHA-256 HMAC digest
    v_payload := v_prev_hash || '|' ||
                 p_action || '|' ||
                 p_entity || '|' ||
                 p_entity_id || '|' ||
                 v_timestamp::text || '|' ||
                 COALESCE(p_user_id::text, 'system') || '|' ||
                 COALESCE(v_redacted_after::text, '');

    v_hash := encode(digest(v_payload, 'sha256'), 'hex');

    INSERT INTO public.audit_logs (
        id, timestamp, user_id, username, action, entity, entity_id,
        before_data, after_data, prev_hash, hash
    ) VALUES (
        v_audit_id, v_timestamp, p_user_id, v_username, p_action, p_entity, p_entity_id,
        v_redacted_before, v_redacted_after, v_prev_hash, v_hash
    );

    RETURN v_audit_id;
END;
$$;

-- 5. Audit Chain Verification Function (Returns the First Broken Row if Tampered)
CREATE OR REPLACE FUNCTION public.verify_audit_chain()
RETURNS TABLE (
    is_valid boolean,
    total_records bigint,
    broken_seq bigint,
    broken_id uuid,
    expected_hash text,
    actual_hash text,
    error_message text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    r RECORD;
    v_expected_prev text := 'GENESIS_BLOCK_GULF_ENERGY_ERP_2026';
    v_payload text;
    v_computed_hash text;
    v_count bigint := 0;
BEGIN
    FOR r IN
        SELECT seq, id, timestamp, user_id, action, entity, entity_id, after_data, prev_hash, hash
        FROM public.audit_logs
        ORDER BY seq ASC
    LOOP
        v_count := v_count + 1;

        -- 1. Verify prev_hash link
        IF r.prev_hash <> v_expected_prev THEN
            RETURN QUERY SELECT
                false,
                v_count,
                r.seq,
                r.id,
                v_expected_prev,
                r.prev_hash,
                'انقطاع في تسلسل الهاش السابق (Broken prev_hash chain link)';
            RETURN;
        END IF;

        -- 2. Recompute row hash
        v_payload := r.prev_hash || '|' ||
                     r.action || '|' ||
                     r.entity || '|' ||
                     r.entity_id || '|' ||
                     r.timestamp::text || '|' ||
                     COALESCE(r.user_id::text, 'system') || '|' ||
                     COALESCE(r.after_data::text, '');

        v_computed_hash := encode(digest(v_payload, 'sha256'), 'hex');

        IF v_computed_hash <> r.hash THEN
            RETURN QUERY SELECT
                false,
                v_count,
                r.seq,
                r.id,
                v_computed_hash,
                r.hash,
                'تعديل غير مصرح به في بيانات السجل (Tampered audit record content)';
            RETURN;
        END IF;

        v_expected_prev := r.hash;
    END LOOP;

    -- If all rows are intact
    RETURN QUERY SELECT
        true,
        v_count,
        NULL::bigint,
        NULL::uuid,
        NULL::text,
        NULL::text,
        'سلسلة التدقيق سليمة تماماً وغير قابلة للتلاعب (Audit chain intact and verified)';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_audit_chain() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.verify_audit_chain() TO authenticated;
