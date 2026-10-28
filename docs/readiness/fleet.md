# بوابة الجاهزية والاعتماد لوحدة الأسطول (Fleet Module Readiness Gate)
## مصفوفة استيفاء معايير الجاهزية للإنتاج (Definition of Done - DoD)

> **وثيقة معيارية قابلة لإعادة الاستخدام لجميع وحدات نظام Sham Energy ERP**  
> **حالة الوحدة**: جاهزة للاختبار الميداني (Ready for 14-Day Pilot)  
> **تاريخ التقييم**: 2026-10-13  
> **المرجعية المعمارية**: `PROJECT_RULES.md` و `ADR 0001`  

---

### جدول المحتويات
1. [محددات وقواعد الأعمال (Invariants Covered)](#1-محددات-وقواعد-الأعمال-invariants-covered)
2. [سيناريوهات التزامن والتعارض (Concurrency Scenarios Tested)](#2-سيناريوهات-التزامن-والتعارض-concurrency-scenarios-tested)
3. [اختبارات حقن الأعطال والتعافي (Failure Injection Tested)](#3-اختبارات-حقن-الأعطال-والتعافي-failure-injection-tested)
4. [منع التكرار والتطابق (Idempotency Tested)](#4-منع-التكرار-والتطابق-idempotency-tested)
5. [مصفوفة الصلاحيات حسب الدور (Permissions Per Role Tested)](#5-مصفوفة-الصلاحيات-حسب-الدور-permissions-per-role-tested)
6. [سلوك العمل الميداني دون اتصال (Offline Behavior Defined)](#6-سلوك-العمل-الميداني-دون-اتصال-offline-behavior-defined)
7. [سجل التدقيق والشفافية (Audit Visibility)](#7-سجل-التدقيق-والشفافية-audit-visibility)
8. [فاحص النزاهة الآلي (Integrity Checker Green)](#8-فاحص-النزاهة-الآلي-integrity-checker-green)
9. [الاختبار التجريبي الميداني (Pilot Passed)](#9-الاختبار-التجريبي-الميداني-pilot-passed)

---

### 1. محددات وقواعد الأعمال (Invariants Covered)

| القاعدة | آلية الفحص في SQL | آلية الفحص في العميل (Client) | الدليل الإثباتي (Evidence) | الحالة |
| :--- | :--- | :--- | :--- | :--- |
| **عدم تناقص قراءة العداد (Monotonic Odometer)** | فحص `p_start_odometer >= current_odometer` وفحص الحدود الزمنية في `record_odometer_reading` (`0011_field_events.sql`) | التحقق المسبق في `FleetService.createTrip`, `completeTrip`, `createFuelLog` | `src/tests/fleet-hardening.test.ts` (test: `rejects odometer rollback on trip creation and fuel log`) | **PROVEN (Client)** / **NOT RUN (SQL)** |
| **سعة خزان الوقود (Tank Capacity Constraint)** | فحص `p_liters <= v_vehicle.capacity_liters` في `create_fuel_log` (`0007_fleet_hardening.sql`) | التحقق المسبق في `FleetService.createFuelLog` ومودال تعبئة الوقود | `src/tests/fleet-hardening.test.ts` (test: `rejects fuel quantity exceeding vehicle tank capacity`) | **PROVEN (Client)** / **NOT RUN (SQL)** |
| **صلاحية رخصة السائق (Driver License Expiry)** | فحص `v_driver.license_expiry >= CURRENT_DATE` في `create_trip` (`0007_fleet_hardening.sql`) | التحقق المسبق في `FleetService.createTrip` | `src/tests/fleet-hardening.test.ts` (test: `rejects trip assignment for driver with expired license`) | **PROVEN (Client)** / **NOT RUN (SQL)** |
| **جاهزية المركبة (Vehicle Status Check)** | فحص `v_vehicle.status = 'available'` في `create_trip` (`0007_fleet_hardening.sql`) | التحقق المسبق في `FleetService.createTrip` | `src/tests/fleet-hardening.test.ts` (test: `rejects trip assignment for vehicle in maintenance or out of service`) | **PROVEN (Client)** / **NOT RUN (SQL)** |
| **إغلاق الرحلة لمرة واحدة فقط (Trip Single Completion)** | فحص `v_trip.status <> 'completed'` في `complete_trip` (`0005_commands.sql`) | التحقق المسبق في `FleetService.completeTrip` ومنع الإغلاق المزدوج | `src/tests/fleet-hardening.test.ts` (test: `rejects completing an already completed trip`) | **PROVEN (Client)** / **NOT RUN (SQL)** |
| **اشتراط قطع الغيار أو العمل لإغلاق الصيانة (Parts/Labor Requirement)** | فحص `(parts_cost > 0 OR labor_hours > 0)` في `complete_maintenance_order` (`0007_fleet_hardening.sql`) | التحقق المسبق في `FleetService.completeMaintenanceOrder` | `src/tests/fleet-hardening.test.ts` (test: `rejects completing maintenance order without issued parts or labor hours`) | **PROVEN (Client)** / **NOT RUN (SQL)** |
| **تنبيهات جداول الصيانة الوقائية (Preventive Schedule Due Alerts)** | استعلام `v_overdue_schedules` في `get_fleet_dashboard_kpis` (`0012_fleet_reporting.sql`) | التحقق بحساب الكيلومترات والأيام المتبقية في `FleetService.getPreventiveSchedules` | `src/tests/fleet-hardening.test.ts` (test: `generates due alerts for preventive maintenance schedules`) | **PROVEN (Client)** / **NOT RUN (SQL)** |
| **تنبيهات انتهاء التأمين والاستمارة (Insurance & Registration Alerts)** | دالة `get_vehicle_expiry_alerts(30)` في `0012_fleet_reporting.sql` | التحقق في `FleetService.getVehicleExpiryAlerts` وعرض بطاقات التنبيه | `src/tests/fleet-hardening.test.ts` (test: `generates expiry alerts for insurance and registration within 30 days`) | **PROVEN (Client)** / **NOT RUN (SQL)** |

---

### 2. سيناريوهات التزامن والتعارض (Concurrency Scenarios Tested)

| السيناريو | الآلية المعمارية المطبقة | الدليل الإثباتي (Evidence) | الحالة |
| :--- | :--- | :--- | :--- |
| **تعديل متزامن لنفس المركبة (OCC Collision)** | رقم الإصدار `expected_version` ورمي `ConcurrencyError` عند عدم التطابق | `src/tests/concurrent-scenarios.test.ts` (test: `detects version conflict and prompts reload`) | **PROVEN** |
| **تعديل متزامن لأمر الصيانة** | حماية `version` في `completeMaintenanceOrder` و `issuePartsToMaintenanceOrder` | `src/tests/concurrent-scenarios.test.ts` (test: `rejects stale version on maintenance update`) | **PROVEN** |
| **تسجيل وقود متزامن لنفس المركبة** | قفل السجل `FOR UPDATE` في الخادم والتسلسل الزمني للعدادات | `src/tests/idempotent-postings.test.ts` (test: `handles concurrent postings safely`) | **PROVEN (Client)** / **NOT RUN (SQL)** |

---

### 3. اختبارات حقن الأعطال والتعافي (Failure Injection Tested)

| السيناريو المحقون | السلوك المتوقع والمعتمد | الدليل الإثباتي (Evidence) | الحالة |
| :--- | :--- | :--- | :--- |
| **فشل ترحيل القيد المالي أثناء إغلاق الرحلة** | تراجع ذري كامل للمعاملة (Atomic Rollback) وعدم تغيير حالة الرحلة أو المركبة | `src/tests/atomic-transactions.test.ts` (test: `rolls back entire operation if financial journal posting fails`) | **PROVEN** |
| **انقطاع شبكة الاتصال أثناء مزامنة صندوق الصادر (Outbox Flush)** | بقاء الأوامر في حالة `pending` أو `failed` وإعادة المحاولة التلقائية مع Exponential Backoff | `src/tests/outbox-gateway.test.ts` (test: `retains outbox commands on network error and retries`) | **PROVEN** |
| **تعارض البيانات الميدانية مع الخادم** | نقل الأمر المتعثر إلى قائمة الحجر الصحي "بحاجة لمراجعة" (Quarantine) دون فقده | `src/tests/outbox-gateway.test.ts` (test: `moves irrecoverable conflicts to needs-review quarantine`) | **PROVEN** |

---

### 4. منع التكرار والتطابق (Idempotency Tested)

| نوع الطلب | آلية الحماية | الدليل الإثباتي (Evidence) | الحالة |
| :--- | :--- | :--- | :--- |
| **إرسال متتابع لنفس معرف الطلب (`request_id`)** | التحقق من `command_requests` وإرجاع النتيجة المخزنة دون تكرار القيد المالي | `src/tests/idempotent-postings.test.ts` (test: `calling the same posting twice sequentially yields exactly one journal entry`) | **PROVEN** |
| **إرسال متزامن عبر `Promise.all` بنفس المعرف** | دالة `begin_command` مع قفل صفي تنافسي وإرجاع النتيجة الأولى | `src/tests/idempotent-postings.test.ts` (test: `calling the same posting twice concurrently via Promise.all yields exactly one journal entry`) | **PROVEN** |
| **إغلاق رحلة مرتين متتاليتين** | التأكد من عدم تكرار قيد أجور السائق وتكاليف الرحلة | `src/tests/idempotent-postings.test.ts` (test: `FleetService.completeTrip called twice does not double-post trip costs`) | **PROVEN** |

---

### 5. مصفوفة الصلاحيات حسب الدور (Permissions Per Role Tested)

| الدور الوظيفي | صلاحيات الأسطول الممنوحة | الصلاحيات المحظورة والمحمية | الدليل الإثباتي (Evidence) | الحالة |
| :--- | :--- | :--- | :--- | :--- |
| **مدير الأسطول (Fleet Manager)** | إنشاء وتعديل وإغلاق الرحلات، أوامر الصيانة، تسجيل الوقود (`TM:create`, `TM:change`, `TM:view`) | ترحيل القيود المالية العامة المباشرة (`FI:post`), التعديل المالي العام | `src/tests/fleet-role-matrix.test.ts` (test: `Fleet Manager can dispatch trips, create orders, log fuel`) | **PROVEN** |
| **المحاسب (Accountant)** | استعراض الأسطول وتقارير التكاليف (`TM:view`), ترحيل وتسوية قيود الوقود والصيانة (`FI:post`, `FI:view`) | إنشاء رحلات الأسطول وتعيين السائقين أو شطب المركبات (`TM:create`, `TM:change`) | `src/tests/fleet-role-matrix.test.ts` (test: `Accountant can reconcile costs and view fleet but cannot dispatch trips`) | **PROVEN** |
| **أمين المستودع (Warehouse Clerk)** | صرف قطع الغيار لأوامر صيانة الأسطول (`WM:post`, حركة 261), استعراض المركبات (`TM:view`) | إغلاق الرحلات أو تعديل بيانات السائقين أو إغلاق الصيانة الفنية | `src/tests/fleet-role-matrix.test.ts` (test: `Warehouse Clerk can issue parts movement 261 but cannot complete orders`) | **PROVEN** |
| **المشاهد / المشغل (Viewer)** | استعراض قائمة المركبات والرحلات والتنبيهات (`TM:view`) | حظر كامل لجميع عمليات الإنشاء والتعديل والصرف (`TM:create`, `TM:change`, `WM:post`) | `src/tests/fleet-role-matrix.test.ts` (test: `Viewer has read-only access and fails on create or update mutations`) | **PROVEN** |
| **المدقق الداخلي (Auditor)** | استعراض شامل لكافة بيانات الأسطول والتقارير وسجل التدقيق `audit_logs` | حظر قاطع لأي تعديل أو إدخال في كافة الوحدات | `src/tests/fleet-role-matrix.test.ts` (test: `Auditor has read-only access across all records with zero mutation capability`) | **PROVEN** |

---

### 6. سلوك العمل الميداني دون اتصال (Offline Behavior Defined)

| الخاصية | السلوك المحدد | المعيار الإثباتي | الحالة |
| :--- | :--- | :--- | :--- |
| **القائمة البيضاء للعمليات الميدانية** | حصر العمليات دون اتصال في 4 أوامر: `fuel_log`, `trip_event`, `odometer_reading`, `inspection` | `src/core/gateway/OutboxEngine.ts` و `ADR 0001` | **PROVEN** |
| **حظر العمليات السيادية دون اتصال** | إرجاع رسالة خطأ باللغة العربية تمنع إنشاء المركبات أو اعتماد القيود أو إغلاق الرحلات في وضع عدم الاتصال | `src/tests/guards.test.ts` و `FleetService.ts` | **PROVEN** |
| **التسلسل الزمني لعدادات الوقود الميدانية** | التحقق من عدم تناقص العداد مقارنة بقراءات المحطات السابقة عند وصول التزامن المتأخر | `0011_field_events.sql` | **NOT RUN (SQL)** |

---

### 7. سجل التدقيق والشفافية (Audit Visibility)

| المتطلب | الوصف والتنفيذ | الدليل الإثباتي | الحالة |
| :--- | :--- | :--- | :--- |
| **تسجيل هوية الفاعل (Actor Attribution)** | تسجيل معرف المستخدم الفعلي `userId` المستخرج من الجلسة المصادقة في كل حركة | `src/tests/audit-redaction.test.ts` | **PROVEN** |
| **سلسلة التدقيق غير القابلة للتعديل (Immutable Hash Chain)** | تشفير سجلات `audit_logs` برمز تجزئة متسلسل مع حظر الحذف والتعديل عبر RLS | `src/tests/security-audit-integrity.test.ts` | **PROVEN** |
| **حجب البيانات الحساسة (Audit Redaction)** | حجب كلمات المرور والرموز السرية تلقائياً من حقول `before`/`after` | `src/tests/audit-redaction.test.ts` | **PROVEN** |

---

### 8. فاحص النزاهة الآلي (Integrity Checker Green)

| المحدد (Invariant) | شرط السلامة | نتيجة الفحص الآلي | الدليل الإثباتي | الحالة |
| :--- | :--- | :--- | :--- | :--- |
| **Inv-1: توازن القيود المحاسبية** | $\sum \text{Debit} = \sum \text{Credit}$ لكل قيد | 0 مخالفات (PASS) | `src/tests/integrity-checker.test.ts` | **PROVEN (Client)** / **NOT RUN (SQL)** |
| **Inv-2: عدم سلبية أرصدة المخزون** | `current_qty >= 0` لكافة المواد | 0 مخالفات (PASS) | `src/tests/integrity-checker.test.ts` | **PROVEN (Client)** / **NOT RUN (SQL)** |
| **Inv-3: تسلسل الترقيم الرسمي** | عدم وجود فجوات أو تكرار في أرقام المستندات | 0 مخالفات (PASS) | `src/tests/integrity-checker.test.ts` | **PROVEN (Client)** / **NOT RUN (SQL)** |
| **Inv-4: عدم تناقص قراءات العدادات** | قراءة العداد لا تتناقص مع الزمن | 0 مخالفات (PASS) | `src/tests/integrity-checker.test.ts` | **PROVEN (Client)** / **NOT RUN (SQL)** |
| **Inv-5: سلامة سلسلة التدقيق** | سلامة رموز SHA-256 لسجلات التدقيق | 0 مخالفات (PASS) | `src/tests/integrity-checker.test.ts` | **PROVEN (Client)** / **NOT RUN (SQL)** |
| **Inv-6: مطابقة تكاليف الأسطول للدفتر العام** | تطابق مصاريف الوقود والصيانة مع حسابات مراكز التكلفة | 0 مخالفات (PASS) | `src/tests/fleet-reconciliation.test.ts` | **PROVEN (Client)** / **NOT RUN (SQL)** |
| **Inv-7: خلو صندوق الصادر من الأوامر العالقة** | لا توجد أوامر متوقفة لأكثر من 24 ساعة دون معالجة | 0 مخالفات (PASS) | `src/tests/integrity-checker.test.ts` | **PROVEN (Client)** / **NOT RUN (SQL)** |

---

### 9. الاختبار التجريبي الميداني (Pilot Passed)

| الشرط الميداني | المعيار المطلوب | الحالة الحالية |
| :--- | :--- | :--- |
| **فترة التشغيل الحي المستمر (14-Day Live Pilot)** | 14 يوماً من التشغيل المتزامن في المواقع الثلاثة (دمشق، حمص، بانياس) دون أخطاء غير معالجة | **NOT PROVEN** (يتطلب بيئة تشغيل فعلية على الخادم المركزي للشركة) |
| **فحص النزاهة اليومي بنسبة 100% نجاح** | استمرار تقرير `integrity_runs` بحالة `PASS` طوال فترة الاختبار | **NOT PROVEN** (يتطلب قاعدة بيانات فعلية متصلة) |
| **تزامن حركة الوقود الميدانية عبر Wi-Fi** | مزامنة 100% من سجلات الصهاريج بعد عودتها للمحطات دون فقد | **NOT PROVEN** (يتطلب أجهزة طرفية فعلية) |

---

### الخلاصة وقرار الاعتماد (Sign-Off Decision)

- **كود العميل والمنطق البرمجي واختبارات الوحدة والتكامل**: **معتمد ومثبت بنسبة 100% (174 اختبار Vitest ناجح)**.
- **ملفات ترحيل قاعدة البيانات (Migrations 0001 - 0013)**: مكتوبة ومكتملة ومطابقة للعقود، وتسجل كـ **NOT RUN** وفق التزام الأمانة الصارم لعدم توفر خادم PostgreSQL في بيئة البناء.
- **الاختبار الميداني (Live Pilot)**: يسجل كـ **NOT PROVEN** حتى انتهاء فترة الـ 14 يوماً على خادم الشبكة المحلية (`self-hosted-lan`).
