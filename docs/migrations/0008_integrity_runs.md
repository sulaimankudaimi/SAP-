# توثيق الهجرة 0008: فحص سلامة البيانات الليلي وجدول المتابعة (Migration 0008: Nightly Integrity Runs)

**الملف:** `supabase/migrations/0008_integrity_runs_scheduled.sql`  
**تاريخ الاعتماد:** 2026-10-13  
**الحالة:** معتمد ومنشور (Applied & Verified)  
**الهدف:** أتمتة الإثبات اليومي لسلامة البيانات ومحددات ADR طوال فترة الاختبار التجريبي (Pilot 14 يوماً) وما بعده.

---

## 1. جدول حفظ نتائج الفحص (`integrity_runs`)

تم إنشاء جدول مخصص لتخزين كل دورة فحص أوتوماتيكية أو يدوية مع تتبع عدد المخالفات والحالة الإجمالية:

```sql
CREATE TABLE public.integrity_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_at timestamptz NOT NULL DEFAULT now(),
    status text NOT NULL CHECK (status IN ('PASS', 'FAIL')),
    total_violations bigint NOT NULL DEFAULT 0,
    report_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    triggered_by text NOT NULL DEFAULT 'scheduled',
    created_at timestamptz NOT NULL DEFAULT now()
);
```

### سياسات الأمان والحماية (RLS):
- **القراءة (SELECT):** متاحة لكافة المستخدمين الموثقين (`authenticated`) لعرض المؤشرات في لوحة التحكم والشاشات الإدارية.
- **الإدراج (INSERT):** مقتصر حصرياً على `service_role` أو دالة النظام بصلاحية `SECURITY DEFINER` لمنع التلاعب بسجلات الفحص.

---

## 2. إجراء الفحص الآلي (`run_nightly_integrity_check`)

دالة مركزية في قاعدة البيانات تقوم بالآتي:
1. استدعاء `public.integrity_report()` وفحص محددات ADR السبعة:
   - Invariant 1: تفرد أرقام المستندات وخلوها من التكرار.
   - Invariant 2: وجود قيد محاسبي متوازن لكل مستند تشغيلي منتهي بتكلفة.
   - Invariant 3: توازن ميزان المراجعة الإجمالي (Zero-Sum).
   - Invariant 4: تطابق أرصدة المخزون مع المجموع التراكمي لسجل الحركات.
   - Invariant 5: حظر الأرصدة السالبة للمخزون.
   - Invariant 6: إسناد كافة القيود لمستخدم موثق (منع الإدخال المجهول).
   - Invariant 7: سلامة سلسلة التدقيق التشفيرية.
2. استدعاء `public.verify_audit_chain()` والتحقق من ترابط الهاش التشفيري وسلسلة الكتل.
3. فحص العمليات العالقة في صندوق المزامنة `public.outbox` لأكثر من 24 ساعة بحالة `pending` أو `needs_review`.
4. احتساب المجموع الإجمالي للمخالفات وتحديد الحالة (`PASS` عند صفر مخالفات، أو `FAIL`).
5. تخزين التقرير الكامل بصيغة `jsonb` وإرجاع معرف الفحص `run_id`.

---

## 3. خيارات الجدولة الأوتوماتيكية (Scheduling Architecture)

تم دعم وتوثيق خيارين لتنفيذ الجدولة الليلية:

### الخيار أ: الجدولة الداخلية عبر `pg_cron` (Native PostgreSQL)
يعد الخيار المفضل في بيئات التشغيل الذاتي وSupabase عند تفعيل ملحق `pg_cron`:

```sql
-- تفعيل الملحق إن لم يكن مفعلاً
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- جدولة التشغيل كل ليلة الساعة 02:00 صباحاً بتوقيت UTC (05:00 صباحاً بتوقيت الرياض)
SELECT cron.schedule(
    'nightly-integrity-check',
    '0 2 * * *',
    'SELECT public.run_nightly_integrity_check(''pg_cron'');'
);

-- الاستعلام عن المهام المجدولة:
SELECT * FROM cron.job WHERE jobname = 'nightly-integrity-check';

-- الاستعلام عن سجلات التنفيذ:
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

### الخيار ب: دالة سحابية أو Webhook خارجي (Supabase Edge Function / External Cron)
في حال كان خادم قاعدة البيانات لا يدعم `pg_cron` كملحق مباشر، يتم استخدام Edge Function أو cron خارجي:

1. **كود الدالة السحابية (`supabase/functions/nightly-integrity/index.ts`):**
```ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data, error } = await supabase.rpc('run_nightly_integrity_check', {
    p_triggered_by: 'edge_function'
  });

  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true, run_id: data }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

2. **الاستدعاء عبر Cron خارجي أو GitHub Actions:**
```bash
curl -X POST "https://<PROJECT-REF>.supabase.co/functions/v1/nightly-integrity" \
     -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>" \
     -H "Content-Type: application/json"
```

---

## 4. الفحص والتحقق اليدوي

لتشغيل الفحص فورياً عبر واجهة SQL:
```sql
SELECT public.run_nightly_integrity_check('manual_verification');
```

لاستعراض النتيجة الأخيرة:
```sql
SELECT id, run_at, status, total_violations, triggered_by
FROM public.integrity_runs
ORDER BY run_at DESC
LIMIT 1;
```
