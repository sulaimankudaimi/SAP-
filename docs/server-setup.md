# دليل إعداد الخادم المعماري المتعدد للمستخدمين (Server Setup Guide)
## نظام طاقة الخليج لتخطيط موارد المؤسسات (Gulf Energy ERP)

يوثق هذا الدليل الخطوات الرسمية المعتمدة لتهيئة خادم PostgreSQL وقاعدة بيانات Supabase (سواء على شبكة الشركة المحلية الموصى بها `self-hosted-lan` أو السحابية `cloud-supabase`)، وتطبيق ملفات الترحيل المعمارية الستة بالترتيب، وتأسيس أول مستخدم إداري، وتفعيل وضع الخادم المتعدد للمستخدمين.

---

### جدول المحتويات
1. [خيارات الاستضافة والتثبيت](#1-خيارات-الاستضافة-والتثبيت)
2. [تطبيق ملفات الترحيل بالترتيب (Migrations Execution)](#2-تطبيق-ملفات-الترحيل-بالترتيب)
3. [إنشاء المستخدم الإداري الأول وتفعيل الملف الشخصي](#3-إنشاء-المستخدم-الإداري-الأول-وتفعيل-الملف-الشخصي)
4. [تهيئة المتغيرات البيئية (.env)](#4-تهيئة-المتغيرات-البيئية-env)
5. [تشغيل نصوص الفحص الآلي واختبار التزامن الدخاني](#5-تشغيل-نصوص-الفحص-الآلي-واختبار-التزامن-الدخاني)

---

### 1. خيارات الاستضافة والتثبيت

وفقاً للوثيقة المعمارية الملزمة **ADR 0001 (بطاقة القرار)**:
- **نوع الاستضافة المعتمد**: `self-hosted-lan` (خادم محلي داخل شبكة الشركة) لحماية سيادة وسرية بيانات الطاقة وضمان استمرارية العمل دون انقطاع الإنترنت.
- **الحد الأقصى للمستخدمين المتزامنين**: 15 مستخدماً.
- **المواقع الجغرافية**: 3 مواقع (الرياض، ينبع، الجبيل).

#### أ) التثبيت الذاتي عبر Docker Compose (الخيار الموصى به - Self-Hosted LAN)
1. على الخادم المركزي الرئيسي في شبكة الشركة (Ubuntu Server 22.04 LTS أو Rocky Linux):
   ```bash
   # تحميل مستودع Supabase Docker الرسمي
   git clone --depth 1 https://github.com/supabase/supabase
   cd supabase/docker

   # نسخ ملف الإعدادات
   cp .env.example .env

   # تشغيل الخدمات
   docker compose up -d
   ```
2. تصبح واجهة إدارة Supabase متاحة محلياً عبر المتصفح:
   `http://<SERVER_IP>:8000`
3. منفذ الاتصال المباشر بقاعدة بيانات PostgreSQL هو:
   `postgresql://postgres:postgres@<SERVER_IP>:5432/postgres`

#### ب) الاستضافة السحابية المباشرة (Cloud Supabase)
1. إنشاء مشروع جديد عبر بوابة `https://supabase.com`.
2. اختيار إقليم الاستضافة الأقرب (مثال: `me-central-1` الرياض أو فرانكفورت).
3. نسخ مفاتيح الوصول:
   - `Project URL`: `https://<PROJECT-REF>.supabase.co`
   - `Anon Public Key`: مفتاح `anon` العام.
   - **تحذير أمني صارم**: لا تقم بتضمين أو تسريب مفتاح `service_role` في تطبيقات الواجهة الأمامية للعملاء نهائياً!

---

### 2. تطبيق ملفات الترحيل بالترتيب

يتم فتح محرر الاستعلامات **Supabase SQL Editor** (أو استخدام أداة `psql`)، وتنفيذ ملفات الترحيل الموجودة في المجلد `/supabase/migrations/` بالترتيب التسلسلي الصارم التالي:

#### 1) الملف الأول: `0001_core.sql`
- **الغرض**: تثبيت ملحقات التشفير (`pgcrypto`, `uuid-ossp`)، إنشاء جداول الأدوار والصلاحيات، وجدول الملفات الشخصية `profiles`، ودالة فحص الصلاحيات المحمية `has_permission()`.
- **التحقق من النجاح**: ظهور الأدوار الـ 10 الأساسية في جدول `public.roles`.

#### 2) الملف الثاني: `0002_numbering_audit.sql`
- **الغرض**: إنشاء جدول الترقيم المتسلسل `number_ranges` ودالة الترقيم الذرية المغلقة `next_doc_number()`، وإنشاء سجل التدقيق المشفر غير القابل للتعديل `audit_logs` ودالة التحقق من سلامة السلسلة `verify_audit_chain()`.
- **التحقق من النجاح**: توليد رقم مستند تجريبي عبر تنفيذ:
  ```sql
  SELECT public.next_doc_number('TRIP', '2026');
  -- النتيجة المتوقعة: TRIP-2026-000001
  ```

#### 3) الملف الثالث: `0003_fleet_inventory_finance.sql`
- **الغرض**: إنشاء الجداول التشغيلية لأسطول النقل (المركبات، السائقين، الرحلات، الوقود، الصيانة)، ونقاط تلاقي المخزون (الأرصدة، سجل الحركات، مستندات حركة المواد 261)، ونقاط تلاقي المالية (دليل الحسابات، التوجيه المحاسبي الآلي، القيود، سجل الترحيل المتطابق `posting_registry`).
- **التحقق من النجاح**: وجود مشغلات التحديث التلقائي للإصدار `version + 1` و `updated_at = now()` على كافة الجداول المعدلة.

#### 4) الملف الرابع: `0004_rls.sql`
- **الغرض**: تفعيل أمان مستوى الصفوف (Row Level Security - RLS) على كافة الجداول مع سياسة المنع الافتراضي، وربط سياسات القراءة بدالة `has_permission()` ومحددات المحطات.
- **ملاحظة أمنية**: حظر كافة عمليات الإدخال والتعديل المباشرة للعملاء على جداول الأرصدة والقيود وسجل الترحيل.

#### 5) الملف الخامس: `0005_commands.sql`
- **الغرض**: بناء دوال الأوامر المركزية المعتمدة (`SECURITY DEFINER`):
  - `create_trip`
  - `complete_trip`
  - `create_fuel_log`
  - `issue_parts_to_maintenance_order` (حركة الصرف 261 مع قفل الأرصدة `FOR UPDATE`)
  - `complete_maintenance_order`
  - `post_journal`
  - `reverse_posting`
- **التحقق من النجاح**: دعم كل أمر لمعرف الطلب الفريد `request_id` لمنع التكرار (Idempotency) وحساب التكاليف بالعملة السعودية بدقة `numeric(18,2)`.

#### 6) الملف السادس: `0006_integrity.sql`
- **الغرض**: بناء دالة التدقيق الشاملة `integrity_report()` التي تفحص محددات سلامة البيانات السبعة الواردة في وثيقة القرار المعماري ADR 0001.

#### 7) الملف السابع: `0007_fleet_hardening.sql`
- **الغرض**: فهارس التصفح المجمعة (Composite Indexes) لـ 50,000+ سجل وقود ورحلات، وإطلالات تكاليف المركبات والتسوية المحاسبية لمراكز التكلفة (`v_vehicle_costs` و `v_cost_center_fleet_reconciliation`).

#### 8) الملف الثامن: `0008_integrity_runs_scheduled.sql`
- **الغرض**: جدول وسجل فحص النزاهة التلقائي الليلي `integrity_runs` ودالة `run_nightly_integrity_check()` مع غلاف آمن متسامح (`DO` block) يرسل إشعاراً في حال عدم تفعيل ملحق `pg_cron`.

#### 9) الملف التاسع: `0009_idempotency_security.sql`
- **الغرض**: حل سباق التكرار والتزامن عبر دالة `begin_command` وحالة `in_progress` / `done`، وسحب كافة امتيازات التنفيذ من `PUBLIC` و `anon`، وضمان الفشل المغلق (Fail-Closed) في `has_permission` عند `must_change_password` أو غياب نطاق المحطة، ودالة `complete_password_change()`.

#### 10) الملف العاشر: `0010_fleet_master_commands.sql`
- **الغرض**: أوامر تعديل البيانات الأساسية للأسطول عبر الخادم (`create_vehicle`, `update_vehicle`, `set_vehicle_active`, `create_driver`, `update_driver`, `set_driver_active`) بقوائم حقول صريحة، والتحكم التفاؤلي بالإصدارات `expected_version`، والتعطيل الإداري بدلاً من الحذف الفيزيائي.

#### 11) الملف الحادي عشر: `0011_field_events.sql`
- **الغرض**: جداول وأوامر تسجيل العمليات الميدانية غير المتصلة (`trip_events`, `odometer_readings`, `vehicle_inspections`) مع التحقق الزمني الصارم من عدم تراجع قراءات العدادات وفق التسلسل الزمني الفعلي.

#### 12) الملف الثاني عشر: `0012_fleet_reporting.sql`
- **الغرض**: جدول تنبيهات شذوذ استهلاك الوقود `fuel_anomaly_alerts` ومحرك اكتشاف الانحراف (25%+ عن متوسط آخر 10 تموينات)، ودوال استعلامات التقارير المتطابقة تماماً مع عقود الواجهة الأمامية (`get_vehicle_expiry_alerts`, `get_vehicle_cost_report`, `get_fleet_dashboard_kpis`).

#### 13) الملف الثالث عشر: `0013_roles_sync.sql`
- **الغرض**: المزامنة القطعية غير القابلة للانجراف للأدوار والصلاحيات النظامية والمولدة برمجياً عبر `scripts/generate-roles-sql.ts`.

---

### 3. إنشاء المستخدم الإداري الأول وتفعيل الملف الشخصي

بعد تطبيق ملفات الترحيل، يتم إنشاء أول مستخدم إداري عبر تنفيذ الاستعلام التالي في SQL Editor:

```sql
-- 1. إنشاء المستخدم في جدول مصادقة Supabase (auth.users)
-- ملاحظة: في بيئة الإنتاج يفضل دعوة المستخدم عبر Supabase Auth UI لتعيين كلمة مرور خاصة
DO $$
DECLARE
    v_user_id uuid := gen_random_uuid();
BEGIN
    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin
    ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'admin@gulfenergy.sa',
        crypt('Admin@123', gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{"full_name":"م. أحمد الشمري (مدير النظام)"}',
        false
    ) ON CONFLICT (email) DO NOTHING;

    -- 2. ربط وإنشاء الملف الشخصي الإداري في public.profiles
    INSERT INTO public.profiles (
        user_id,
        username,
        full_name,
        role_code,
        plant_codes,
        is_active,
        must_change_password
    )
    SELECT
        id,
        'admin',
        'م. أحمد الشمري (المدير العام)',
        'ADMIN',
        ARRAY['1100', '1200', '1300'],
        true,
        false
    FROM auth.users
    WHERE email = 'admin@gulfenergy.sa'
    ON CONFLICT (user_id) DO NOTHING;
END $$;
```

---

### 4. تهيئة المتغيرات البيئية (.env)

في المجلد الرئيسي للمشروع، قم بإنشاء أو تعديل ملف `.env`:

```ini
# تفعيل وضع الخادم المتعدد للمستخدمين (Server Mode)
VITE_SERVER_MODE=true

# رابط خادم Supabase المركزي (عنوان الخادم على الشبكة المحلية أو النطاق السحابي)
VITE_ERP_SERVER_URL=http://192.168.1.100:8000
# أو في السحابة:
# VITE_ERP_SERVER_URL=https://your-project.supabase.co

# المفتاح العام (Anon Key) فقط - لا تضع مفتاح service_role هنا نهائياً!
VITE_ERP_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### 5. تشغيل نصوص الفحص الآلي واختبار التزامن الدخاني

#### أ) اختبار سلامة المحددات السبعة داخل قاعدة البيانات (Invariants SQL Test)
قم بتنفيذ ملف الاختبار في Supabase SQL Editor:
`/supabase/tests/invariants.sql`

```sql
-- استعلام الفحص المباشر:
SELECT * FROM public.integrity_report();
```
**النتيجة المتوقعة**: ظهور الحالة `PASS` لجميع المحددات السبعة دون أي انتهاكات أو أخطاء.

#### ب) تشغيل فحص التزامن الدخاني عبر Node.js (Concurrency Smoke Script)
يقوم هذا الاختبار بإرسال 50 طلباً متزامناً لتوليد الأرقام، و20 حركة صرف متزامنة تتنافس على آخر وحدة مخزنية، والتحقق من عدم تكرار الأوامر المتطابقة.

قم بتنفيذ الأمر من موجه الأوامر:
```bash
node scripts/concurrency-smoke.mjs
```

**المخرجات المتوقعة**:
```text
====================================================================
Gulf Energy ERP - Server-Authoritative Concurrency Smoke Suite
Server Origin: http://192.168.1.100:8000
====================================================================

1. تسجيل دخول المستخدم المعتمد للفحص (Authenticating)...
✓ تم تسجيل الدخول بنجاح للمستخدم: admin@gulfenergy.sa

[PASS] 50 Parallel next_doc_number Calls: تم توليد 50 رقماً متتالياً وفريداً بنجاح دون أي تكرار أو فجوات
[PASS] 20 Parallel issue_parts_to_maintenance_order Competing for Last Unit: نجحت حركة واحدة فقط وتم رفض الحركات المتزامنة المتنافسة بأمان لمنع الرصيد السالب
[PASS] Idempotent Execution with Identical request_id (10x Invocations): تمت معالجة الطلب لمرة واحدة فقط وأعادت الاستدعاءات الـ 10 نفس رقم المستند دون تكرار أي قيد
[PASS] Optimistic Concurrency Collision (Two Updates at Same Version): تم رصد تعارض التعديل المتزامن بنجاح ورفض العملية المتأخرة برسالة ConcurrencyError واضحة

--------------------------------------------------------------------
✓ كافة فحوصات التزامن والأمان المعماري نجحت بنسبة 100% (ALL CHECKS PASSED)
```
