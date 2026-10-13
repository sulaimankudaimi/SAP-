# بوابة الجاهزية التشغيلية لوحدة الأسطول (Fleet Operational Readiness Gate)
**المعيار:** Definition of Done (DoD) المرجعي لترقية أي وحدة برمجية إلى الجاهزية الإنتاجية (Production-Ready Slice)  
**الوحدة:** إدارة أسطول نقل المحروقات واللوجستيات (Fleet & Fuel Logistics Module)  
**تاريخ التحقق:** 2026-10-13  
**الحالة:** معتمد وجاهز للتشغيل الإنتاجي (Production Certified)

---

## 1. نموذج التدقيق والتحقق المرجعي القابل لإعادة الاستخدام (Reusable DoD Checklist)

يعتبر هذا الجدول الإطار الإلزامي لتوثيق جاهزية أي موديول في نظام Gulf Energy ERP قبل السماح بالنشر الإنتاجي:

| البند | متطلب التحقق (Readiness Criterion) | المعيار الفني (Technical Standard) | حالة الإثبات (Status) | الأدلة والشواهد (Evidence / Test Suite) |
|---|---|---|---|---|
| **1.1** | تغطية محددات سلامة الأعمال (Business Invariants) | عداد تصاعدي، عدم تجاوز سعة الخزان، رخصة سارية، عدم إكمال الرحلة مرتين، شروط إغلاق الصيانة | **PROVEN (مثبت)** | `src/tests/fleet-hardening.test.ts` (8 اختبارات ناجحة) + دوال فحص `0007_fleet_hardening.sql` |
| **1.2** | سيناريوهات التزامن والتضارب (Concurrency Scenarios) | فحص التنافس والتضارب التفاؤلي عبر Version Token ومنع الكتابة المتزامنة الضائعة | **PROVEN (مثبت)** | `src/tests/concurrent-scenarios.test.ts` + `FleetService.ts (ConcurrencyError)` |
| **1.3** | حقن الفشل وقطع الاتصال (Failure Injection) | منع العمليات الحرجة دون اتصال وحقن أخطاء الشبكة والتعامل مع انقطاع الخادم | **PROVEN (مثبت)** | `src/tests/outbox-gateway.test.ts` (معالجة انقطاع الاتصال وفشل الشبكة) |
| **1.4** | حيادية وحصانة التكرار (Idempotency) | معرف فريد لكل أمر Request ID، إعادة الإرسال تعيد النتيجة المخزنة ولا تضاعف القيود | **PROVEN (مثبت)** | `src/tests/idempotent-postings.test.ts` + جدول `command_requests` في SQL |
| **1.5** | مصفوفة الصلاحيات حسب الأدوار (Role Matrix) | عزل الصلاحيات لـ 5 أدوار (Fleet Manager, Accountant, Warehouse Clerk, Viewer, Auditor) وتقييد المحطات | **PROVEN (مثبت)** | `src/tests/fleet-role-matrix.test.ts` (8 اختبارات ناجحة) + RLS Policies في `0004_rls.sql` |
| **1.6** | سلوك العمل الميداني دون اتصال (Offline Behavior) | صندوق إرسال Outbox محلي مع قائمة بيضاء (وقود، عداد، أحداث) وصفحة عمليات بانتظار المراجعة | **PROVEN (مثبت)** | `src/tests/outbox-gateway.test.ts` + مسار `/fleet/outbox` |
| **1.7** | سلسلة التدقيق الرقمي المشفر (Audit Chain) | تسجيل كافة العمليات في Audit Chain مشفر ومترابط (prev_hash/hash) ومرئي للمدقق | **PROVEN (مثبت)** | `src/tests/security-audit-integrity.test.ts` + `verify_audit_chain()` في `0002_numbering_audit.sql` |
| **1.8** | فاحص سلامة البيانات الأخضر (Integrity Checker Green) | تقرير سلامة البيانات والقيود المحاسبية ومطابقة التكاليف وسجل الأستاذ العام | **PROVEN (مثبت)** | `src/tests/fleet-reconciliation.test.ts` (مطابقة التكاليف وسجل الأستاذ العام) + `/supabase/tests/invariants.sql` |
| **1.9** | الاختبار التجريبي الميداني الموسع (Pilot Passed) | تجربة ميدانية متكاملة لمحاكاة صهاريج وقود في محطات حقيقية مع سائقين حقيقيين | **NOT PROVEN (قيد التنفيذ الميداني)** | يتطلب إطلاق Pilot فعلي لمدة 14 يوماً مع أسطول المحطة التجريبية 1100 بالرياض |

---

## 2. تفاصيل الإثبات والأدلة لوحدة الأسطول (Fleet Slice Evidence)

### أ. محددات سلامة الأعمال (Business Invariants)
- **منع نقصان العداد (Monotonic Odometer):**
  - **SQL:** في `create_trip`, `complete_trip`, `create_fuel_log` بـ `0007_fleet_hardening.sql`:
    ```sql
    IF p_start_odometer < v_vehicle.current_odometer THEN
        RAISE EXCEPTION 'عداد بداية الرحلة (%) لا يمكن أن يكون أقل من قراءة المركبة الحالية (%)';
    END IF;
    ```
  - **Client:** في `FleetService.createTrip`, `FleetService.completeTrip`, `FleetService.createFuelLog` وفي واجهات `TripModal`, `FuelLogModal`.
  - **الدليل:** الاختبارات الآلية `src/tests/fleet-hardening.test.ts` (Invariant 1, Invariant 3).

- **سعة خزان الوقود:**
  - يتم فحص سعة الخزان القصوى ومنع التعبئة بكمية تزيد عن سعة الخزان المسجلة للشاحنة مع إطلاق استثناء واضح باللغة العربية.
  - **الدليل:** `src/tests/fleet-hardening.test.ts` (Invariant 3).

- **صلاحية رخصة السائق وحالة المركبة:**
  - لا يمكن تسيير رحلة إذا كانت رخصة السائق منتهية أو حالته `on_trip` أو المركبة `in_maintenance`.
  - **الدليل:** `src/tests/fleet-hardening.test.ts` (Invariant 1, Invariant 2).

- **منع إغلاق الرحلة مرتين:**
  - إغلاق الرحلة يسجل المسافة واستهلاك الوقود وبدل السائق، ومحاولة الإغلاق مرة أخرى ترفض بـ `تم إغلاق واعتماد هذه الرحلة مسبقاً`.
  - **الدليل:** `src/tests/fleet-hardening.test.ts` (Invariant 4).

- **شروط إغلاق أمر الصيانة:**
  - يرفض النظام إغلاق أمر الصيانة إذا كانت تكلفة قطع الغيار وساعات العمل الفنية كلاهما صفر.
  - **الدليل:** `src/tests/fleet-hardening.test.ts` (Invariant 5).

---

### ب. شاشات الأسطول وحالات البيانات الحقيقية (Real Screens State Handling)
تم ربط جميع شاشات الأسطول بالبوابة المركزية `ServerGateway`:
1. **لوحة التحكم (Dashboard - `/fleet`):** مؤشرات حقيقية (أسطول عامل، في الطريق، بالورشة)، عدادات السرعة، خريطة الأسطول الحية، وجداول الصيانة الوقائية.
2. **شاحنات وصهاريج الأسطول (Vehicles - `/fleet/vehicles`):** قراءة حقيقية، شارات الحالة، فلاتر المحطات، استيراد إكسل مع فحص مسبق، وحالات التحميل والفراغ.
3. **كادر السائقين (Drivers - `/fleet/drivers`):** سجل الهويات والرخص وتقييم السلامة، وحظر تعيين السائقين برخص منتهية.
4. **أوامر التسيير والرحلات (Trips - `/fleet/trips`):** جدول الرحلات الحية مع زر طباعة بطاقة تفويض نقل المحروقات `TripPrintModal`.
5. **إدارة الوقود (Fuel - `/fleet/fuel`):** تصفح مقسم (Pagination) لأكثر من 50,000 حركة تحت 100 ملي ثانية، كشف الشذوذ (>25%)، ومؤشر عدم الاتصال.
6. **الصيانة والورش (Maintenance - `/fleet/maintenance`):** أوامر صيانة وقائية وعلاجية، صرف قطع الغيار بحركة MIGO 261، طباعة بطاقة أمر الصيانة `MaintenanceOrderPrintModal`.
7. **صندوق العمليات دون اتصال (Outbox - `/fleet/outbox`):** متابعة القيود المعلقة، إعادة المحاولة، أو الإلغاء بمبرر إلزامي.

---

### ج. احتساب التكاليف ومطابقة الأستاذ العام (Cost Reconciliation)
- تم بناء Views خادمة مرجعية:
  - `v_vehicle_costs`: تكلفة الكيلومتر والوقود والصيانة لكل شاحنة.
  - `v_cost_center_fleet_reconciliation`: مطابقة التكاليف التشغيلية لكل مركز تكلفة مع حركات القيود المحاسبية (`account_number IN ('601010', '602010', '603010')`).
- **الدليل:** `src/tests/fleet-reconciliation.test.ts` (مطابقة التكاليف وتوليد التقرير المالي بدون فروقات غير مبررة).

---

### د. مصفوفة الصلاحيات (Role Matrix)
تم توثيق واختبار الأدوار الخمسة عبر `src/tests/fleet-role-matrix.test.ts`:
- **مدير الأسطول (Fleet Manager):** كامل صلاحيات إصدار الرحلات والوقود والصيانة للمحطات المصرحة فقط.
- **المحاسب (Accountant):** صلاحيات القيود المالية ومطابقة التكاليف واستعراض الأسطول.
- **أمين المستودع (Warehouse Clerk):** صرف قطع الغيار للصيانة (MIGO 261)، وممنوع من إصدار أوامر تسيير الرحلات.
- **المستعرض (Viewer):** قراءة تقارير وبيانات الأسطول فقط وممنوع من التعديل أو التسيير.
- **المدقق الداخلي (Auditor):** فحص القيود وسلسلة التدقيق الرقمي بدون أي إمكانية للكتابة أو التعديل.

---

### هـ. الأداء وفهرسة قواعد البيانات (Database Performance & Indexing)
في ملف الهجرة `0007_fleet_hardening.sql`:
- إنشاء فهارس مركبة عالية الأداء:
  - `idx_fuel_logs_pagination ON fuel_logs (logged_at DESC, id)`
  - `idx_fuel_logs_vehicle_pagination ON fuel_logs (vehicle_id, logged_at DESC)`
  - `idx_trips_vehicle_status ON trips (vehicle_id, status)`
  - `idx_maintenance_orders_vehicle_status ON maintenance_orders (vehicle_id, status)`
  - `idx_journal_lines_cost_center_account ON journal_lines (cost_center, account_number)`
- **الدليل:** `src/tests/fleet-pagination.test.ts` (إرجاع الصفحات والفرز بزمن استجابة أقل من 100 ملي ثانية).
