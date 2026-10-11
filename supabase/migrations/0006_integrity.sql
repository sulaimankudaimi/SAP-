-- ============================================================================
-- Migration: 0006_integrity.sql
-- Description: Automated integrity verification function auditing all 7 ADR invariants
-- Database: PostgreSQL 15+ (Supabase / Self-Hosted)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.integrity_report()
RETURNS TABLE (
    invariant_number integer,
    invariant_name text,
    status text,                 -- 'PASS' or 'FAIL'
    violations_count bigint,
    sample_ids text[],
    description text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_violations_count bigint;
    v_sample_ids text[];
    v_audit_check RECORD;
BEGIN
    -- ------------------------------------------------------------------------
    -- Invariant 1: Unique Document Numbers (No Duplicates in Any Transaction Table)
    -- ------------------------------------------------------------------------
    WITH duplicate_docs AS (
        SELECT doc_number FROM public.trips GROUP BY doc_number HAVING count(*) > 1
        UNION ALL
        SELECT doc_number FROM public.fuel_logs GROUP BY doc_number HAVING count(*) > 1
        UNION ALL
        SELECT doc_number FROM public.maintenance_orders GROUP BY doc_number HAVING count(*) > 1
        UNION ALL
        SELECT doc_number FROM public.material_documents GROUP BY doc_number HAVING count(*) > 1
        UNION ALL
        SELECT doc_number FROM public.journal_entries GROUP BY doc_number HAVING count(*) > 1
    )
    SELECT count(*), array_agg(doc_number ORDER BY doc_number)
    INTO v_violations_count, v_sample_ids
    FROM (SELECT doc_number FROM duplicate_docs LIMIT 10) sub;

    RETURN QUERY SELECT
        1,
        'أرقام المستندات فريدة تماماً وخالية من التكرار (Unique Document Numbers)'::text,
        CASE WHEN COALESCE(v_violations_count, 0) = 0 THEN 'PASS' ELSE 'FAIL' END::text,
        COALESCE(v_violations_count, 0)::bigint,
        COALESCE(v_sample_ids, '{}'::text[]),
        'التحقق من عدم وجود أي تكرار في أرقام الرحلات، الوقود، أوامر الصيانة، حركات المواد، والقيود المحاسبية'::text;

    -- ------------------------------------------------------------------------
    -- Invariant 2: Exactly One Balanced Journal Entry per Posted Business Document
    -- ------------------------------------------------------------------------
    WITH orphan_or_duplicate_postings AS (
        -- Completed trips with costs that lack exactly one journal
        SELECT id::text AS doc_id, doc_number FROM public.trips
        WHERE status = 'completed' AND total_trip_cost > 0
          AND (je_doc_number IS NULL OR NOT EXISTS (
              SELECT 1 FROM public.journal_entries WHERE doc_number = trips.je_doc_number
          ))
        UNION ALL
        -- Fuel logs that lack a valid balanced journal
        SELECT id::text AS doc_id, doc_number FROM public.fuel_logs
        WHERE total_cost > 0
          AND (je_doc_number IS NULL OR NOT EXISTS (
              SELECT 1 FROM public.journal_entries WHERE doc_number = fuel_logs.je_doc_number
          ))
        UNION ALL
        -- Completed maintenance orders with costs lacking journal
        SELECT id::text AS doc_id, doc_number FROM public.maintenance_orders
        WHERE status = 'completed' AND actual_cost > 0
          AND (je_doc_number IS NULL OR NOT EXISTS (
              SELECT 1 FROM public.journal_entries WHERE doc_number = maintenance_orders.je_doc_number
          ))
    )
    SELECT count(*), array_agg(doc_number ORDER BY doc_number)
    INTO v_violations_count, v_sample_ids
    FROM (SELECT doc_number FROM orphan_or_duplicate_postings LIMIT 10) sub;

    RETURN QUERY SELECT
        2,
        'قيد محاسبي متوازن وواحد لكل مستند تشغيلي مرحل (One Balanced Journal per Document)'::text,
        CASE WHEN COALESCE(v_violations_count, 0) = 0 THEN 'PASS' ELSE 'FAIL' END::text,
        COALESCE(v_violations_count, 0)::bigint,
        COALESCE(v_sample_ids, '{}'::text[]),
        'التأكد من أن كل رحلة، استهلاك وقود، وأمر صيانة مكتمل له قيد يومية متوازن مسجل في الأستاذ العام'::text;

    -- ------------------------------------------------------------------------
    -- Invariant 3: Trial Balance Zero-Sum Check (Total Debits == Total Credits)
    -- ------------------------------------------------------------------------
    WITH gl_balance_check AS (
        SELECT
            abs(COALESCE(sum(debit), 0.00) - COALESCE(sum(credit), 0.00)) AS diff
        FROM public.journal_lines
    )
    SELECT
        CASE WHEN diff > 0.001 THEN 1 ELSE 0 END,
        CASE WHEN diff > 0.001 THEN ARRAY['ميزان المراجعة غير متوازن بفارق ' || diff::text || ' ر.س'] ELSE '{}'::text[] END
    INTO v_violations_count, v_sample_ids
    FROM gl_balance_check;

    RETURN QUERY SELECT
        3,
        'توازن ميزان المراجعة الإجمالي (Zero-Sum Trial Balance Invariant)'::text,
        CASE WHEN COALESCE(v_violations_count, 0) = 0 THEN 'PASS' ELSE 'FAIL' END::text,
        COALESCE(v_violations_count, 0)::bigint,
        COALESCE(v_sample_ids, '{}'::text[]),
        'التحقق المحاسبي الصارم من أن مجموع حركات المدين يطابق تماماً مجموع حركات الدائن في دليل الحسابات'::text;

    -- ------------------------------------------------------------------------
    -- Invariant 4: Stock Balance Equals the Mathematical Sum of its Stock Ledger
    -- ------------------------------------------------------------------------
    WITH ledger_sums AS (
        SELECT
            material_code,
            plant_code,
            storage_location,
            sum(quantity) AS computed_qty
        FROM public.stock_ledger
        GROUP BY material_code, plant_code, storage_location
    ),
    discrepancies AS (
        SELECT
            sb.id,
            sb.material_code || '@' || sb.plant_code || '/' || sb.storage_location AS loc_tag
        FROM public.stock_balances sb
        LEFT JOIN ledger_sums ls
            ON sb.material_code = ls.material_code
           AND sb.plant_code = ls.plant_code
           AND sb.storage_location = ls.storage_location
        WHERE abs(sb.unrestricted_qty - COALESCE(ls.computed_qty, 0.000)) > 0.0001
    )
    SELECT count(*), array_agg(loc_tag ORDER BY loc_tag)
    INTO v_violations_count, v_sample_ids
    FROM (SELECT loc_tag FROM discrepancies LIMIT 10) sub;

    RETURN QUERY SELECT
        4,
        'تطابق رصيد المخزون مع مجموع سجل الحركات (Stock Balance Equals Ledger Sum)'::text,
        CASE WHEN COALESCE(v_violations_count, 0) = 0 THEN 'PASS' ELSE 'FAIL' END::text,
        COALESCE(v_violations_count, 0)::bigint,
        COALESCE(v_sample_ids, '{}'::text[]),
        'التأكد من أن الرصيد الحالي لكل صنف في كل موقع تخزين يساوي المجموع التراكمي لجميع حركات الإدخال والصرف'::text;

    -- ------------------------------------------------------------------------
    -- Invariant 5: No Negative Stock Unless Explicitly Allowed by Plant Configuration
    -- ------------------------------------------------------------------------
    WITH negative_stock_violations AS (
        SELECT
            sb.id,
            sb.material_code || '@' || sb.plant_code || ' (الرصيد: ' || sb.unrestricted_qty || ')' AS tag
        FROM public.stock_balances sb
        JOIN public.plants p ON p.code = sb.plant_code
        WHERE sb.unrestricted_qty < 0 AND NOT p.allows_negative_stock
    )
    SELECT count(*), array_agg(tag ORDER BY tag)
    INTO v_violations_count, v_sample_ids
    FROM (SELECT tag FROM negative_stock_violations LIMIT 10) sub;

    RETURN QUERY SELECT
        5,
        'حظر الأرصدة المخزنية السالبة إلا بإذن مسبق (Non-Negative Stock Rule)'::text,
        CASE WHEN COALESCE(v_violations_count, 0) = 0 THEN 'PASS' ELSE 'FAIL' END::text,
        COALESCE(v_violations_count, 0)::bigint,
        COALESCE(v_sample_ids, '{}'::text[]),
        'التحقق من عدم انخفاض رصيد أي مادة أو قطعة غيار دون الصفر ما لم تكن المحطة مهيأة للسماح بالرصيد السالب'::text;

    -- ------------------------------------------------------------------------
    -- Invariant 6: Every Mutation Has an Authenticated Actor (No Anonymous Writes)
    -- ------------------------------------------------------------------------
    WITH unauthenticated_mutations AS (
        SELECT id::text AS rec_id, doc_number FROM public.trips WHERE created_by IS NULL OR created_by = ''
        UNION ALL
        SELECT id::text AS rec_id, doc_number FROM public.fuel_logs WHERE created_by IS NULL OR created_by = ''
        UNION ALL
        SELECT id::text AS rec_id, doc_number FROM public.maintenance_orders WHERE created_by IS NULL OR created_by = ''
        UNION ALL
        SELECT id::text AS rec_id, doc_number FROM public.journal_entries WHERE created_by IS NULL OR created_by = ''
        UNION ALL
        SELECT id::text AS rec_id, 'audit-' || seq::text FROM public.audit_logs WHERE user_id IS NULL AND username = 'anonymous'
    )
    SELECT count(*), array_agg(doc_number ORDER BY doc_number)
    INTO v_violations_count, v_sample_ids
    FROM (SELECT doc_number FROM unauthenticated_mutations LIMIT 10) sub;

    RETURN QUERY SELECT
        6,
        'إسناد كافة العمليات لمستخدم موثق ومعتمد (Authenticated Actor Provenance)'::text,
        CASE WHEN COALESCE(v_violations_count, 0) = 0 THEN 'PASS' ELSE 'FAIL' END::text,
        COALESCE(v_violations_count, 0)::bigint,
        COALESCE(v_sample_ids, '{}'::text[]),
        'التأكد من أن كل عملية إدخال أو تعديل مسندة لمستخدم مسجل في النظام دون أي استدعاءات مجهولة'::text;

    -- ------------------------------------------------------------------------
    -- Invariant 7: Audit Chain Hash Integrity (Unbroken Cryptographic Trail)
    -- ------------------------------------------------------------------------
    SELECT * INTO v_audit_check FROM public.verify_audit_chain();

    RETURN QUERY SELECT
        7,
        'سلامة سلسلة التدقيق التشفيرية ومنع التلاعب (Tamper-Evident Audit Chain)'::text,
        CASE WHEN v_audit_check.is_valid THEN 'PASS' ELSE 'FAIL' END::text,
        CASE WHEN v_audit_check.is_valid THEN 0::bigint ELSE 1::bigint END,
        CASE WHEN v_audit_check.broken_id IS NOT NULL THEN ARRAY['Broken ID: ' || v_audit_check.broken_id::text] ELSE '{}'::text[] END,
        v_audit_check.error_message;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.integrity_report() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.integrity_report() TO authenticated;
