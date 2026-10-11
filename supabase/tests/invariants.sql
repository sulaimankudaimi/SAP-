-- ============================================================================
-- Test Suite: /supabase/tests/invariants.sql
-- Description: Verification script asserting that all 7 ADR invariants return PASS
-- Execution: Run in Supabase SQL Editor or psql
-- ============================================================================

DO $$
DECLARE
    r RECORD;
    v_fail_count integer := 0;
    v_total_count integer := 0;
BEGIN
    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'بدء الفحص الآلي لمحددات سلامة البيانات (ADR 0001 Invariants Audit)';
    RAISE NOTICE '====================================================================';

    FOR r IN SELECT * FROM public.integrity_report() ORDER BY invariant_number ASC LOOP
        v_total_count := v_total_count + 1;

        IF r.status = 'PASS' THEN
            RAISE NOTICE '[نجاح ✓] محدد %: %', r.invariant_number, r.invariant_name;
        ELSE
            v_fail_count := v_fail_count + 1;
            RAISE WARNING '[فشل ✗] محدد %: % | عدد الانتهاكات: % | عينات: %',
                r.invariant_number, r.invariant_name, r.violations_count, r.sample_ids;
        END IF;
    END LOOP;

    RAISE NOTICE '--------------------------------------------------------------------';
    RAISE NOTICE 'ملخص الفحص: إجمالي المحددات المفحوصة: % | حالات الفشل: %', v_total_count, v_fail_count;
    RAISE NOTICE '--------------------------------------------------------------------';

    IF v_fail_count > 0 THEN
        RAISE EXCEPTION 'فشل التحقق من محددات سلامة البيانات: يوجد % محدد غير مطابق!', v_fail_count;
    ELSE
        RAISE NOTICE 'تم التحقق بنجاح: كافة محددات سلامة البيانات مطابقة للائحة المعمارية 0001 بنسبة 100%%';
    END IF;
END $$;
