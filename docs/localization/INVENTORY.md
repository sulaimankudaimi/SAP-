# جرد التوطين والتحويل إلى البيئة السورية (Localization Inventory — Syria)

> تم توليد هذا التقرير آلياً عبر `scripts/localization-inventory.mjs` بالإضافة إلى المراجعة الدلالية اليدوية الشاملة.

## 1. ملخص الإحصاءات حسب الفئة (Summary Counts by Category)

| الفئة (Category) | عدد المواضع المرصودة (Hits) |
|---|---|
| **currency** | 2 |
| **places** | 0 |
| **people names** | 0 |
| **ID/legal formats** | 4 |
| **locale/timezone** | 0 |
| **tax** | 0 |
| **phone/IBAN validators** | 1 |
| **map/visuals** | 5 |
| **brand** | 44 |
| **SQL** | 0 |
| **tests** | 11 |
| **docs** | 57 |
| **الإجمالي الكلي (Total)** | **124** |

---

## 2. نتائج المسح الآلي مصنفة حسب الفئة (Automated Token Scan Hits)

### فئة: `currency` (2 موضع)

| الملف والسطر (`file:line`) | الرمز (`Token`) | المقتطف (`Snippet`) | البديل المقترح (`Proposed Replacement`) |
|---|---|---|---|
| `src/modules/finance/services/FinanceService.ts:466` | `SAR` | `* All amounts rescaled by 450 (SAR -> SYP).` | SYP (أو LOCALE.currency.code / formatMoney) |
| `src/seed/index.ts:4` | `SAR` | `* All historical demo amounts were originally authored in SAR.` | SYP (أو LOCALE.currency.code / formatMoney) |

### فئة: `places` (0 موضع)

_لا توجد مواضع متبقية في هذه الفئة._

### فئة: `people names` (0 موضع)

_لا توجد مواضع متبقية في هذه الفئة._

### فئة: `ID/legal formats` (4 موضع)

| الملف والسطر (`file:line`) | الرمز (`Token`) | المقتطف (`Snippet`) | البديل المقترح (`Proposed Replacement`) |
|---|---|---|---|
| `src/core/db/index.ts:184` | `iqama` | `// Version 6: Syria localization — rename Driver.iqamaNumber to Driver.nationalId` | الرقم الوطني (nationalId / national_id) |
| `src/core/db/index.ts:194` | `iqama` | `if (driver.nationalId === undefined && typeof driver.iqamaNumber === 'string') {` | الرقم الوطني (nationalId / national_id) |
| `src/core/db/index.ts:195` | `iqama` | `driver.nationalId = driver.iqamaNumber;` | الرقم الوطني (nationalId / national_id) |
| `src/core/db/index.ts:197` | `iqama` | `delete driver.iqamaNumber;` | الرقم الوطني (nationalId / national_id) |

### فئة: `locale/timezone` (0 موضع)

_لا توجد مواضع متبقية في هذه الفئة._

### فئة: `tax` (0 موضع)

_لا توجد مواضع متبقية في هذه الفئة._

### فئة: `phone/IBAN validators` (1 موضع)

| الملف والسطر (`file:line`) | الرمز (`Token`) | المقتطف (`Snippet`) | البديل المقترح (`Proposed Replacement`) |
|---|---|---|---|
| `src/core/utils/validators.ts:19` | `+966` | `* Does not accept other country codes (such as +966).` | +963 (LOCALE.phone.countryCode) |

### فئة: `map/visuals` (5 موضع)

| الملف والسطر (`file:line`) | الرمز (`Token`) | المقتطف (`Snippet`) | البديل المقترح (`Proposed Replacement`) |
|---|---|---|---|
| `src/modules/fleet/components/FleetMapView.tsx:142` | `Saudi` | `{/* Stylized Saudi Arabian Geographic Contour (Silhouette Backdrop) */}` | Syrian / Syria |
| `src/modules/fleet/components/FleetMapView.tsx:160` | `Arabian Gulf` | `{/* Red Sea & Arabian Gulf shoreline indications */}` | Syria / Eastern Mediterranean |
| `src/modules/fleet/components/FleetMapView.tsx:180` | `الخليج العربي` | `الخليج العربي (Arabian Gulf)` | الجمهورية العربية السورية / البحر الأبيض المتوسط |
| `src/modules/fleet/components/FleetMapView.tsx:180` | `Arabian Gulf` | `الخليج العربي (Arabian Gulf)` | Syria / Eastern Mediterranean |
| `src/modules/reports/components/OperationsMapCard.tsx:89` | `Arabian Gulf` | `{/* Arabian Gulf shoreline */}` | Syria / Eastern Mediterranean |

### فئة: `brand` (44 موضع)

| الملف والسطر (`file:line`) | الرمز (`Token`) | المقتطف (`Snippet`) | البديل المقترح (`Proposed Replacement`) |
|---|---|---|---|
| `index.html:6` | `Gulf Energy` | `<title>Gulf Energy ERP \| شركة الخليج للطاقة</title>` | Sham Energy (شركة الشام للطاقة) |
| `index.html:6` | `شركة الخليج` | `<title>Gulf Energy ERP \| شركة الخليج للطاقة</title>` | شركة الشام للطاقة |
| `index.html:6` | `الخليج` | `<title>Gulf Energy ERP \| شركة الخليج للطاقة</title>` | الشام |
| `index.html:7` | `Gulf Energy` | `<meta name="description" content="Gulf Energy ERP - نظام تخطيط وإدارة موارد الطاقة واللوجستيات" />` | Sham Energy (شركة الشام للطاقة) |
| `index.html:8` | `Gulf Energy` | `<meta property="og:title" content="Gulf Energy ERP \| شركة الخليج للطاقة" />` | Sham Energy (شركة الشام للطاقة) |
| `index.html:8` | `شركة الخليج` | `<meta property="og:title" content="Gulf Energy ERP \| شركة الخليج للطاقة" />` | شركة الشام للطاقة |
| `index.html:8` | `الخليج` | `<meta property="og:title" content="Gulf Energy ERP \| شركة الخليج للطاقة" />` | الشام |
| `index.html:9` | `Gulf Energy` | `<meta property="og:description" content="Gulf Energy ERP - نظام تخطيط وإدارة موارد الطاقة واللوجستيات" />` | Sham Energy (شركة الشام للطاقة) |
| `metadata.json:2` | `Gulf Energy` | `"name": "Gulf Energy ERP",` | Sham Energy (شركة الشام للطاقة) |
| `metadata.json:3` | `الخليج` | `"description": "نظام طاقة الخليج المتكامل لإدارة موارد المؤسسات والمشاريع والمالية والمخزون",` | الشام |
| `package.json:29` | `Gulf Energy` | `"productName": "Gulf Energy ERP",` | Sham Energy (شركة الشام للطاقة) |
| `scripts/concurrency-smoke.mjs:42` | `Gulf Energy` | `console.log('Gulf Energy ERP - Server-Authoritative Concurrency Smoke Suite');` | Sham Energy (شركة الشام للطاقة) |
| `scripts/concurrency-smoke.mjs:166` | `أرامكو` | `p_station_name: 'محطة أرامكو الدائري الشمالي',` | شركة الفرات للبترول / مصفاة حمص (وهمي تجريبي) |
| `scripts/state-report.mjs:144` | `Gulf Energy` | `let md = '# Gulf Energy ERP — Implementation State Report` | Sham Energy (شركة الشام للطاقة) |
| `src/components/common/PrintDocumentModal.tsx:289` | `Gulf Energy` | `'وثيقة رسمية صادرة آلياً من نظام الخليج لإدارة الموارد (Gulf Energy ERP).'}` | Sham Energy (شركة الشام للطاقة) |
| `src/components/common/PrintDocumentModal.tsx:289` | `الخليج` | `'وثيقة رسمية صادرة آلياً من نظام الخليج لإدارة الموارد (Gulf Energy ERP).'}` | الشام |
| `src/components/layout/CommandPalette.tsx:183` | `Gulf Energy` | `<span className="text-[10px] text-emerald-600 font-semibold font-mono">Gulf Energy ERP Desktop</span>` | Sham Energy (شركة الشام للطاقة) |
| `src/components/ui/ErrorBoundary.tsx:60` | `Gulf Energy` | `System: Gulf Energy ERP (100% Offline)` | Sham Energy (شركة الشام للطاقة) |
| `src/core/auth/AuthBootGate.tsx:30` | `شركة الخليج` | `<h2 className="text-lg font-bold text-[#0F172A]">شركة الخليج للطاقة</h2>` | شركة الشام للطاقة |
| `src/core/auth/AuthBootGate.tsx:30` | `الخليج` | `<h2 className="text-lg font-bold text-[#0F172A]">شركة الخليج للطاقة</h2>` | الشام |
| `src/core/auth/AuthBootGate.tsx:31` | `Gulf Energy` | `<p className="text-xs text-[#64748B]">Gulf Energy ERP</p>` | Sham Energy (شركة الشام للطاقة) |
| `src/core/gateway/rowMappers.ts:2` | `Gulf Energy` | `* Server Row Mappers for Gulf Energy ERP` | Sham Energy (شركة الشام للطاقة) |
| `src/core/security/offlineGuard.ts:2` | `Gulf Energy` | `* Runtime Offline Guard for Gulf Energy ERP` | Sham Energy (شركة الشام للطاقة) |
| `src/core/security/offlineGuard.ts:13` | `الخليج` | `'[OfflineEnforcer] تم حظر محاولة اتصال خارجي (${targetUrl}). نظام طاقة الخليج يعمل بنسبة 100% بدون اتصال خارجي.'` | الشام |
| `src/core/services/DiagnosticLogger.ts:97` | `Gulf Energy` | `system: 'Gulf Energy ERP (Offline Desktop / Web)',` | Sham Energy (شركة الشام للطاقة) |
| `src/modules/admin/pages/IntegrityPage.tsx:649` | `Gulf Energy` | `<strong>شركة الخليج للطاقة — نظام Gulf Energy ERP</strong>` | Sham Energy (شركة الشام للطاقة) |
| `src/modules/admin/pages/IntegrityPage.tsx:649` | `شركة الخليج` | `<strong>شركة الخليج للطاقة — نظام Gulf Energy ERP</strong>` | شركة الشام للطاقة |
| `src/modules/admin/pages/IntegrityPage.tsx:649` | `الخليج` | `<strong>شركة الخليج للطاقة — نظام Gulf Energy ERP</strong>` | الشام |
| `src/modules/admin/pages/PrintTemplatesPage.tsx:463` | `Gulf Energy` | `'وثيقة رسمية صادرة آلياً من نظام الخليج لإدارة الموارد (Gulf Energy ERP).'}` | Sham Energy (شركة الشام للطاقة) |
| `src/modules/admin/pages/PrintTemplatesPage.tsx:463` | `الخليج` | `'وثيقة رسمية صادرة آلياً من نظام الخليج لإدارة الموارد (Gulf Energy ERP).'}` | الشام |
| `src/modules/admin/services/BackupService.ts:225` | `Gulf Energy` | `{ name: 'Gulf Energy ERP Encrypted Backup', extensions: ['gerp', 'bak', 'json'] },` | Sham Energy (شركة الشام للطاقة) |
| `src/modules/assets/components/AssetBarcodeModal.tsx:86` | `Gulf Energy` | `<div class="header">شركة الخليج للطاقة \| Gulf Energy ERP</div>` | Sham Energy (شركة الشام للطاقة) |
| `src/modules/assets/components/AssetBarcodeModal.tsx:86` | `شركة الخليج` | `<div class="header">شركة الخليج للطاقة \| Gulf Energy ERP</div>` | شركة الشام للطاقة |
| `src/modules/assets/components/AssetBarcodeModal.tsx:86` | `الخليج` | `<div class="header">شركة الخليج للطاقة \| Gulf Energy ERP</div>` | الشام |
| `src/modules/assets/components/AssetBarcodeModal.tsx:119` | `شركة الخليج` | `<p className="text-xs font-bold text-slate-800">شركة الخليج للطاقة</p>` | شركة الشام للطاقة |
| `src/modules/assets/components/AssetBarcodeModal.tsx:119` | `الخليج` | `<p className="text-xs font-bold text-slate-800">شركة الخليج للطاقة</p>` | الشام |
| `src/modules/assets/components/AssetBarcodeModal.tsx:120` | `Gulf Energy` | `<p className="text-[10px] text-slate-500 font-mono">Gulf Energy Assets</p>` | Sham Energy (شركة الشام للطاقة) |
| `src/modules/fleet/components/FleetMapView.tsx:180` | `الخليج` | `الخليج العربي (Arabian Gulf)` | الشام |
| `src/modules/inventory/components/GoodsReceiptModal.tsx:234` | `Aramco` | `placeholder="مثال: DN-Aramco-8890"` | Al-Furat Petroleum (Demo) |
| `src/modules/masterdata/pages/MaterialGroupsListPage.tsx:260` | `الخليج` | `exportFileName="مجموعات_المواد_طاقة_الخليج"` | الشام |
| `src/modules/masterdata/pages/UnitsListPage.tsx:256` | `الخليج` | `exportFileName="وحدات_القياس_طاقة_الخليج"` | الشام |
| `src/pages/AboutPage.tsx:94` | `Gulf Energy` | `عن نظام طاقة الخليج (About Gulf Energy ERP)` | Sham Energy (شركة الشام للطاقة) |
| `src/pages/AboutPage.tsx:94` | `الخليج` | `عن نظام طاقة الخليج (About Gulf Energy ERP)` | الشام |
| `src/pages/ProjectRulesPage.tsx:16` | `Gulf Energy` | `"Gulf Energy ERP" — a custom ERP for Oil & Gas / energy-logistics companies, structured like SAP (modules, master data, transaction document` | Sham Energy (شركة الشام للطاقة) |

### فئة: `SQL` (0 موضع)

_لا توجد مواضع متبقية في هذه الفئة._

### فئة: `tests` (11 موضع)

| الملف والسطر (`file:line`) | الرمز (`Token`) | المقتطف (`Snippet`) | البديل المقترح (`Proposed Replacement`) |
|---|---|---|---|
| `src/tests/syria-data-localization.test.ts:46` | `iqama` | `it('renames iqamaNumber -> nationalId and iqama_number -> national_id across models, specs, and mappers', async () => {` | الرقم الوطني (nationalId / national_id) |
| `src/tests/syria-data-localization.test.ts:48` | `iqama` | `expect(READ_SPECS.drivers.columns).not.toContain('iqama_number');` | الرقم الوطني (nationalId / national_id) |
| `src/tests/syria-data-localization.test.ts:67` | `iqama` | `expect('iqamaNumber' in mapped).toBe(false);` | الرقم الوطني (nationalId / national_id) |
| `src/tests/syria-data-localization.test.ts:74` | `iqama` | `expect('iqamaNumber' in d).toBe(false);` | الرقم الوطني (nationalId / national_id) |
| `src/tests/validators-sy.test.ts:26` | `Saudi` | `it('rejects Saudi +966 numbers and malformed phone strings', () => {` | Syrian / Syria |
| `src/tests/validators-sy.test.ts:26` | `+966` | `it('rejects Saudi +966 numbers and malformed phone strings', () => {` | +963 (LOCALE.phone.countryCode) |
| `src/tests/validators-sy.test.ts:27` | `+966` | `expect(isValidSyrianPhone('+966501234567')).toBe(false);` | +963 (LOCALE.phone.countryCode) |
| `src/tests/validators-sy.test.ts:27` | `966` | `expect(isValidSyrianPhone('+966501234567')).toBe(false);` | +963XXXXXXXXX |
| `src/tests/validators-sy.test.ts:30` | `+966` | `expect(validateSyrianPhone('+966501234567').error).toContain('+963');` | +963 (LOCALE.phone.countryCode) |
| `src/tests/validators-sy.test.ts:30` | `966` | `expect(validateSyrianPhone('+966501234567').error).toContain('+963');` | +963XXXXXXXXX |
| `src/tests/validators-sy.test.ts:49` | `Saudi` | `it('accepts 4 to 30 alphanumeric characters without Saudi 15-digit 3...3 restriction', () => {` | Syrian / Syria |

### فئة: `docs` (57 موضع)

| الملف والسطر (`file:line`) | الرمز (`Token`) | المقتطف (`Snippet`) | البديل المقترح (`Proposed Replacement`) |
|---|---|---|---|
| `PROJECT_RULES.md:5` | `Gulf Energy` | `"Gulf Energy ERP" — a custom ERP for Oil & Gas / energy-logistics companies, structured like SAP (modules, master data, transaction document` | Sham Energy (شركة الشام للطاقة) |
| `PROJECT_RULES.md:22` | `SAR` | `- Charts, tables, forms, and dropdowns must all be RTL-correct. Currency default: SAR (ريال), configurable.` | SYP (أو LOCALE.currency.code / formatMoney) |
| `PROJECT_RULES.md:22` | `ريال` | `- Charts, tables, forms, and dropdowns must all be RTL-correct. Currency default: SAR (ريال), configurable.` | ليرة سورية / ل.س |
| `PROJECT_RULES.md:23` | `ar-SA` | `- Dates: Gregorian calendar with Western digits, i.e. toLocaleDateString('ar-SA-u-ca-gregory-nu-latn').` | ar-SY-u-ca-gregory-nu-latn (LOCALE.dateLocale) |
| `README.md:1` | `Gulf Energy` | `# Gulf Energy ERP \| شركة الخليج للطاقة` | Sham Energy (شركة الشام للطاقة) |
| `README.md:1` | `شركة الخليج` | `# Gulf Energy ERP \| شركة الخليج للطاقة` | شركة الشام للطاقة |
| `README.md:1` | `الخليج` | `# Gulf Energy ERP \| شركة الخليج للطاقة` | الشام |
| `README.md:9` | `Gulf Energy` | `Gulf Energy ERP enforces an SAP-grade, defense-in-depth security architecture with zero tolerance for implicit defaults, pseudo-users, or un` | Sham Energy (شركة الشام للطاقة) |
| `docs/STATE.md:1` | `Gulf Energy` | `# Gulf Energy ERP — Implementation State Report` | Sham Energy (شركة الشام للطاقة) |
| `docs/adr/0001-multi-user-architecture.md:1` | `Gulf Energy` | `# ADR 0001: Multi-User Server-Authoritative Architecture for Gulf Energy ERP` | Sham Energy (شركة الشام للطاقة) |
| `docs/adr/0001-multi-user-architecture.md:23` | `Gulf Energy` | `Today, Gulf Energy ERP runs exclusively as single-tenant client-side installations with data persisted in browser-local IndexedDB via Dexie.` | Sham Energy (شركة الشام للطاقة) |
| `docs/adr/0001-multi-user-architecture.md:25` | `Saudi` | `The organization operates across three distinct operational sites in Saudi Arabia:` | Syrian / Syria |
| `docs/adr/0001-multi-user-architecture.md:26` | `Khobar` | `1. **Al-Khobar Headquarters** (Executive governance, procurement approvals, corporate accounting, financial closing).` | Tartus |
| `docs/adr/0001-multi-user-architecture.md:27` | `Yanbu` | `2. **Yanbu Distribution Hub** (Bulk fuel dispatching, fleet terminal, regional fuel sales).` | Homs |
| `docs/adr/0001-multi-user-architecture.md:28` | `Jubail` | `3. **Jubail Industrial Logistics Depot** (Chemicals logistics, vehicle maintenance workshops, spare parts warehousing).` | Baniyas / Tartus |
| `docs/localization/LOCALIZATION.md:5` | `SAR` | `تم تحويل كافة المبالغ التجريبية والافتراضية التي كانت مقومة بالريال السعودي (SAR) إلى **الليرة السورية الجديدة (SYP)** الصادرة بتاريخ 1 كانو` | SYP (أو LOCALE.currency.code / formatMoney) |
| `docs/localization/LOCALIZATION.md:5` | `ريال` | `تم تحويل كافة المبالغ التجريبية والافتراضية التي كانت مقومة بالريال السعودي (SAR) إلى **الليرة السورية الجديدة (SYP)** الصادرة بتاريخ 1 كانو` | ليرة سورية / ل.س |
| `docs/localization/LOCALIZATION.md:5` | `سعودي` | `تم تحويل كافة المبالغ التجريبية والافتراضية التي كانت مقومة بالريال السعودي (SAR) إلى **الليرة السورية الجديدة (SYP)** الصادرة بتاريخ 1 كانو` | سوري |
| `docs/localization/LOCALIZATION.md:7` | `SAR` | `$$\text{SAR\_TO\_USD} = 3.75 \quad,\quad \text{DEMO\_FX\_SYP\_PER\_USD} = 120$$` | SYP (أو LOCALE.currency.code / formatMoney) |
| `docs/localization/LOCALIZATION.md:9` | `SAR` | `$$\text{SAR\_TO\_SYP\_FACTOR} = 3.75 \times 120 = 450$$` | SYP (أو LOCALE.currency.code / formatMoney) |
| `docs/localization/LOCALIZATION.md:17` | `SAR` | `\| الشريحة / الصلاحية \| القيمة السابقة (SAR) \| القيمة بعد التحويل ($\times 450$) (SYP) \|` | SYP (أو LOCALE.currency.code / formatMoney) |
| `docs/localization/LOCALIZATION.md:35` | `سعودي` | `تم إزالة مفهوم الإقامة السعودية ('iqama') بالكامل من قاعدة البيانات والكود المصدري واستبداله بـ **الرقم الوطني** ('nationalId' / 'national_i` | سوري |
| `docs/localization/LOCALIZATION.md:35` | `السعودية` | `تم إزالة مفهوم الإقامة السعودية ('iqama') بالكامل من قاعدة البيانات والكود المصدري واستبداله بـ **الرقم الوطني** ('nationalId' / 'national_i` | سوريا / الجمهورية العربية السورية |
| `docs/localization/LOCALIZATION.md:35` | `iqama` | `تم إزالة مفهوم الإقامة السعودية ('iqama') بالكامل من قاعدة البيانات والكود المصدري واستبداله بـ **الرقم الوطني** ('nationalId' / 'national_i` | الرقم الوطني (nationalId / national_id) |
| `docs/localization/LOCALIZATION.md:35` | `إقامة` | `تم إزالة مفهوم الإقامة السعودية ('iqama') بالكامل من قاعدة البيانات والكود المصدري واستبداله بـ **الرقم الوطني** ('nationalId' / 'national_i` | الرقم الوطني |
| `docs/localization/LOCALIZATION.md:39` | `iqama` | `\| عمود قاعدة البيانات ('public.drivers') \| 'iqama_number' \| 'national_id' \|` | الرقم الوطني (nationalId / national_id) |
| `docs/localization/LOCALIZATION.md:40` | `iqama` | `\| معامل دالة RPC ('public.create_driver') \| 'p_iqama_number' \| 'p_national_id' \|` | الرقم الوطني (nationalId / national_id) |
| `docs/localization/LOCALIZATION.md:41` | `iqama` | `\| نموذج TypeScript ('Driver') \| 'iqamaNumber' \| 'nationalId' \|` | الرقم الوطني (nationalId / national_id) |
| `docs/localization/LOCALIZATION.md:42` | `iqama` | `\| فهرس Dexie المحلي ('drivers') \| 'iqamaNumber' (الإصدار 5) \| 'nationalId' (الإصدار 6 مع دالة ترقية '.upgrade()' تنسخ القيمة وتحذف الحقل الق` | الرقم الوطني (nationalId / national_id) |
| `docs/localization/LOCALIZATION.md:43` | `iqama` | `\| مواصفات القراءة والمحولات ('READ_SPECS.drivers', 'DRIVER_FIELD_MAP') \| 'iqama_number' / 'iqamaNumber' \| 'national_id' / 'nationalId' \|` | الرقم الوطني (nationalId / national_id) |
| `docs/migrations/0008_integrity_runs.md:61` | `الرياض` | `-- جدولة التشغيل كل ليلة الساعة 02:00 صباحاً بتوقيت UTC (05:00 صباحاً بتوقيت الرياض)` | دمشق (1100) |
| `docs/pilot/PILOT_PLAN.md:3` | `Gulf Energy` | `**النظام:** نظام طاقة الخليج ERP الموحد (Gulf Energy ERP)` | Sham Energy (شركة الشام للطاقة) |
| `docs/pilot/PILOT_PLAN.md:3` | `الخليج` | `**النظام:** نظام طاقة الخليج ERP الموحد (Gulf Energy ERP)` | الشام |
| `docs/pilot/PILOT_PLAN.md:5` | `الرياض` | `**نطاق المحطة التجريبية:** محطة الرياض اللوجستية المركزية (Plant 1100 - Riyadh Central Hub)` | دمشق (1100) |
| `docs/pilot/PILOT_PLAN.md:5` | `Riyadh` | `**نطاق المحطة التجريبية:** محطة الرياض اللوجستية المركزية (Plant 1100 - Riyadh Central Hub)` | Damascus |
| `docs/pilot/PILOT_PLAN.md:30` | `saudi-surnames` | `\| **م. فهد القحطاني** \| مدير الأسطول الميداني (Fleet Manager) \| 'FLEET_MANAGER' \| Plant 1100 \| اعتماد التسيير، إغلاق الرحلات، الموافقة على أ` | أسماء سورية من LOCALE.namePools (الحلبي، الشامي، الحموي، الدمشقي، العلي، خوري...) |
| `docs/pilot/PILOT_PLAN.md:31` | `saudi-surnames` | `\| **خالد السبيعي** \| سائق صهريج محروقات (Driver) \| 'DRIVER' \| Fleet 1100 \| تسجيل قراءات العداد الميداني، فواتير الوقود، ورفع تقارير الوصول. ` | أسماء سورية من LOCALE.namePools (الحلبي، الشامي، الحموي، الدمشقي، العلي، خوري...) |
| `docs/pilot/PILOT_PLAN.md:34` | `saudi-surnames` | `\| **د. عمر الغامدي** \| المدقق الداخلي للحوكمة (Auditor) \| 'AUDITOR' \| All Plants \| التحقق اليومي من سلسلة التدقيق التشفيرية ('verify_audit_c` | أسماء سورية من LOCALE.namePools (الحلبي، الشامي، الحموي، الدمشقي، العلي، خوري...) |
| `docs/pilot/PILOT_PLAN.md:35` | `saudi-surnames` | `\| **ياسر الحربي** \| ضابط المتابعة التشغيلية (Viewer) \| 'VIEWER' \| Plant 1100 \| استعراض مؤشرات الأداء الحية والمتابعة اللحظية دون صلاحيات تعد` | أسماء سورية من LOCALE.namePools (الحلبي، الشامي، الحموي، الدمشقي، العلي، خوري...) |
| `docs/pilot/PILOT_PLAN.md:130` | `saudi-surnames` | `\| **مدير أسطول النقل اللوجستي** \| م. فهد القحطاني \| .................... \| ...../...../ 2026 \| [  ] معتمد للإنتاج \|` | أسماء سورية من LOCALE.namePools (الحلبي، الشامي، الحموي، الدمشقي، العلي، خوري...) |
| `docs/pilot/PILOT_PLAN.md:132` | `saudi-surnames` | `\| **المدقق الداخلي المعتمد** \| د. عمر الغامدي \| .................... \| ...../...../ 2026 \| [  ] معتمد للإنتاج \|` | أسماء سورية من LOCALE.namePools (الحلبي، الشامي، الحموي، الدمشقي، العلي، خوري...) |
| `docs/readiness/MODULE_TEMPLATE.md:11` | `Gulf Energy` | `يعتبر هذا الجدول الإطار الإلزامي لتوثيق جاهزية أي وحدة في نظام Gulf Energy ERP قبل السماح بالنشر الإنتاجي:` | Sham Energy (شركة الشام للطاقة) |
| `docs/readiness/fleet.md:4` | `Gulf Energy` | `> **وثيقة معيارية قابلة لإعادة الاستخدام لجميع وحدات نظام Gulf Energy ERP**` | Sham Energy (شركة الشام للطاقة) |
| `docs/readiness/fleet.md:119` | `الرياض` | `\| **فترة التشغيل الحي المستمر (14-Day Live Pilot)** \| 14 يوماً من التشغيل المتزامن في المواقع الثلاثة (الرياض، ينبع، الجبيل) دون أخطاء غير م` | دمشق (1100) |
| `docs/readiness/fleet.md:119` | `ينبع` | `\| **فترة التشغيل الحي المستمر (14-Day Live Pilot)** \| 14 يوماً من التشغيل المتزامن في المواقع الثلاثة (الرياض، ينبع، الجبيل) دون أخطاء غير م` | حمص (1200) |
| `docs/readiness/fleet.md:119` | `الجبيل` | `\| **فترة التشغيل الحي المستمر (14-Day Live Pilot)** \| 14 يوماً من التشغيل المتزامن في المواقع الثلاثة (الرياض، ينبع، الجبيل) دون أخطاء غير م` | بانياس / طرطوس (1300) |
| `docs/server-setup.md:2` | `Gulf Energy` | `## نظام طاقة الخليج لتخطيط موارد المؤسسات (Gulf Energy ERP)` | Sham Energy (شركة الشام للطاقة) |
| `docs/server-setup.md:2` | `الخليج` | `## نظام طاقة الخليج لتخطيط موارد المؤسسات (Gulf Energy ERP)` | الشام |
| `docs/server-setup.md:23` | `الرياض` | `- **المواقع الجغرافية**: 3 مواقع (الرياض، ينبع، الجبيل).` | دمشق (1100) |
| `docs/server-setup.md:23` | `ينبع` | `- **المواقع الجغرافية**: 3 مواقع (الرياض، ينبع، الجبيل).` | حمص (1200) |
| `docs/server-setup.md:23` | `الجبيل` | `- **المواقع الجغرافية**: 3 مواقع (الرياض، ينبع، الجبيل).` | بانياس / طرطوس (1300) |
| `docs/server-setup.md:45` | `الرياض` | `2. اختيار إقليم الاستضافة الأقرب (مثال: 'me-central-1' الرياض أو فرانكفورت).` | دمشق (1100) |
| `docs/server-setup.md:86` | `سعودي` | `- **التحقق من النجاح**: دعم كل أمر لمعرف الطلب الفريد 'request_id' لمنع التكرار (Idempotency) وحساب التكاليف بالعملة السعودية بدقة 'numeric(` | سوري |
| `docs/server-setup.md:86` | `السعودية` | `- **التحقق من النجاح**: دعم كل أمر لمعرف الطلب الفريد 'request_id' لمنع التكرار (Idempotency) وحساب التكاليف بالعملة السعودية بدقة 'numeric(` | سوريا / الجمهورية العربية السورية |
| `docs/server-setup.md:156` | `saudi-surnames` | `'{"full_name":"م. أحمد الشمري (مدير النظام)"}',` | أسماء سورية من LOCALE.namePools (الحلبي، الشامي، الحموي، الدمشقي، العلي، خوري...) |
| `docs/server-setup.md:173` | `saudi-surnames` | `'م. أحمد الشمري (المدير العام)',` | أسماء سورية من LOCALE.namePools (الحلبي، الشامي، الحموي، الدمشقي، العلي، خوري...) |
| `docs/server-setup.md:228` | `Gulf Energy` | `Gulf Energy ERP - Server-Authoritative Concurrency Smoke Suite` | Sham Energy (شركة الشام للطاقة) |

---

## 3. المراجعة الدلالية اليدوية الشاملة (Manual Semantic Review — Seeds, Fixtures, Amounts, Names & Regional UI Strings)

نظراً لأن المسح النصي بالرموز لا يكشف الدلالات الرقمية أو الأسماء السياقية، توثق الجداول التالية المراجعة اليدوية الكاملة لملفات البذر (Seeds)، التجهيزات الاختبارية (Fixtures)، الأسعار، وأسماء الكيانات التي سيتم تحويلها في المرحلة الثانية (Prompt 2) والمرحلة الثالثة (Prompt 3):

### أ) ملفات البذر والتجهيزات التي تحتوي على أسماء أشخاص بطابع سعودي (Tribal Surnames & Person Names)

| الموقع (`file:line`) | المحتوى الحالي | البديل السوري المعتمد (في Prompt 2) |
|---|---|---|
| `src/seed/index.ts:177-273` | أسماء المستخدمين الـ 10 (م. عبدالله الشمري، فهد القحطاني، سعد العتيبي، خالد الدوسري، عمر الغامدي، نايف الحربي، طارق المالكي، سلطان السبيعي، ماجد الزهراني، فيصل المطيري) | توليد أسماء سورية من `LOCALE.namePools` (مثل: م. طارق الحلبي، باسل الشامي، مازن الحموي، سامر اللاذقاني، غسان الدمشقي، إلخ) |
| `src/seed/index.ts:281-285` | مديرو المحطات والمراكز (م. عبدالله الشمري، م. عمر الغامدي، م. سلطان السبيعي) | أسماء مهندسين سوريين من `LOCALE.namePools` |
| `src/seed/index.ts:535-555` | سائقو الأسطول (أسماء مركبة من قوائم سعودية مثل الشمري، الدوسري، القحطاني، العتيبي، الحربي) | توليد أسماء سائقين سوريين من `LOCALE.namePools.firstNames` و `LOCALE.namePools.lastNames` |
| `src/tests-db/fixtures.ts:133-135` | سائقو الاختبارات (`أحمد السعيد`، `سالم الدوسري`) مع أرقام هواتف `+9665...` | أسماء سورية من `LOCALE.namePools` مع أرقام هواتف `+9639...` |
| `src/modules/fleet/services/TelemetryService.ts:62-145` | أسماء سائقي التتبع الحي في المحاكاة الميدانية | أسماء سورية من `LOCALE.namePools` |

### ب) المبالغ المالية وأسعار الوقود والتكاليف المعيارية (Monetary Amounts & Fuel Prices)

| الموقع (`file:line`) | المحتوى الحالي | البديل السوري المعتمد (بالليرة السورية الجديدة SYP) |
|---|---|---|
| `src/seed/index.ts:368-455` | أسعار المواد القياسية (`standardPrice`, `movingAveragePrice`) مثل الديزل بـ `1.15` والبنزين بـ `2.18` وقطع الغيار بالريال | أسعار مقومة بالليرة السورية الجديدة (SYP) مع الإبقاء على توازن المعادلات المحاسبية |
| `src/seed/index.ts:294-312` | موازنات مراكز التكلفة (`budget: 12000000` إلخ) | موازنات مقومة بالليرة السورية الجديدة (SYP) |
| `src/seed/index.ts:560-680` | تكاليف الوقود في الرحلات وسجلات التموين (`costPerLiter: 1.15`, `driverAllowance`) | تسعير اللتر والبدلات بالليرة السورية الجديدة (SYP) |
| `src/modules/fleet/components/FuelLogModal.tsx:41` | السعر الافتراضي للتر الوقود في نموذج التسجيل | السعر الافتراضي بالليرة السورية الجديدة (SYP) |
| `src/modules/fleet/components/TripModal.tsx:336` | معادلة تقدير تكلفة الوقود في نافذة الرحلة | استخدام السعر المعياري بالليرة السورية الجديدة (SYP) |
| `src/modules/finance/services/FinanceService.ts:475-780` | قيود اليومية الافتتاحية والفواتير التجريبية (`seedFinanceIfEmpty`) | قيود متوازنة بالليرة السورية الجديدة (SYP) وضريبة مبيعات 0% افتراضياً |

### ج) أسماء الموردين والعملاء والبنوك (Vendor, Customer & Bank Names)

| الموقع (`file:line`) | المحتوى الحالي | البديل السوري المعتمد (`LOCALE.vendorNamePool` / `customerNamePool`) |
|---|---|---|
| `src/seed/index.ts:316` | `النقدية بالبنوك المحلية (الراجحي / الأهلي)` | `النقدية بالبنوك المحلية (المصرف التجاري / مصرف التسليف)` |
| `src/seed/index.ts:458-485` | موردون سعوديون (أرامكو السعودية، سابك، شركة المصافي العربية، الجبيل للبتروكيماويات، إلخ) | شركات سورية خيالية من `LOCALE.vendorNamePool` (مثل: شركة الفرات للتوريدات النفطية، مؤسسة الشام للمعدات الصناعية، شركة الساحل للخدمات اللوجستية، إلخ) |
| `src/seed/index.ts:487-512` | عملاء سعوديون (شركة الكهرباء السعودية، تحلية المياه المالحة، معادن، مرافق، إلخ) | عملاء سوريون خياليون من `LOCALE.customerNamePool` (مثل: مؤسسة توليد الطاقة بدمشق، شركة الفرات للنقل والصناعة، منشأة حلب الصناعية، إلخ) |
| `src/modules/finance/components/PaymentProposalModal.tsx:122-130` | حسابات بنكية (`البنك الأهلي السعودي`، `مصرف الراجحي`، `بنك الرياض`) | حسابات مصرفية سورية مقومة بـ `SYP` |
| `src/modules/admin/services/PrintTemplateService.ts:22,51` | تفاصيل البنوك في قوالب الطباعة (`مصرف الراجحي`، `البنك الأهلي السعودي`) | بيانات مصرفية سورية في قوالب الطباعة |

### د) أسماء المحطات والمستودعات والمواقع والحقول (Plant, Storage Location & Site Names)

| الموقع (`file:line`) | المحتوى الحالي | البديل السوري المعتمد (من `LOCALE.plants` و `LOCALE.sites`) |
|---|---|---|
| `src/seed/index.ts:280-292` | المحطات (`1100 الرياض`، `1200 ينبع`، `1300 الجبيل`) والمستودعات الـ 6 | `1100 دمشق (المقر الرئيسي)`، `1200 حمص`، `1300 بانياس`، مع 6 مواقع تخزين موزعة عليها |
| `src/seed/index.ts:1010-1025` | مسارات الرحلات بين الرياض وينبع والجبيل وجدة والدمام | مسارات بين دمشق، حمص، بانياس، طرطوس، اللاذقية، دير الزور، الحسكة، تدمر |
| `src/modules/fleet/components/FleetMapView.tsx:35-120` | إحداثيات الخريطة والحقول والمصافي في الخليج والسعودية | إحداثيات سوريا والمواقع الـ 8 المعتمدة (`LOCALE.sites`: حقل الفرات، حقل الجزيرة، حقل البادية، مصفاة حمص، مصفاة بانياس، مرفأ طرطوس، مرفأ اللاذقية، مستودع دمشق) |
| `src/modules/fleet/services/TelemetryService.ts:40-160` | مسارات التتبع الحي وإحداثيات المركبات | مسارات وإحداثيات المحافظات والحقول السورية من `LOCALE.sites` |

### هـ) نصوص واجهة المستخدم التي تذكر أقاليم أو جهات تنظيمية إقليمية (Regional UI Strings)

| الموقع (`file:line`) | النص الحالي | البديل السوري المعتمد |
|---|---|---|
| `src/i18n/ar.ts` | نصوص النظام، اسم الشركة، وتسميات الهوية والضريبة | تحديث المفاتيح لتعكس `شركة الشام للطاقة`، `الرقم الوطني`، `الرقم الضريبي`، و`ل.س` |
| `src/modules/fleet/pages/DriversListPage.tsx:289,318,504` | `رقم الإقامة` / `رقم الإقامة / الهوية الوطنية` | `الرقم الوطني` |
| `src/modules/masterdata/pages/VendorsListPage.tsx:541` | `الرقم الضريبي (VAT ID) *` | `الرقم الضريبي *` |
| `src/modules/masterdata/pages/VendorDetailPage.tsx:370,630` | `الرقم الضريبي (VAT)` / `شهادة ضريبة القيمة المضافة` | `الرقم الضريبي` / `شهادة التسجيل الضريبي` |
| `src/modules/admin/pages/PrintTemplatesPage.tsx:221,404` | `الرقم الضريبي (ZATCA)` / `ضريبة القيمة المضافة (15%)` | `الرقم الضريبي` / `ضريبة` |
| `src/components/common/PrintDocumentModal.tsx:217` | `ضريبة القيمة المضافة (15%):` | `ضريبة:` |
| `src/modules/finance/pages/AccountsReceivablePage.tsx:154` | `ضريبة القيمة المضافة` | `ضريبة` |
| `src/modules/finance/components/CustomerInvoiceModal.tsx:193,234` | `الضريبة (15%)` / `ضريبة القيمة المضافة` | `ضريبة` (تعتمد على رمز الضريبة المختار `EXEMPT` أو `SALES`) |
