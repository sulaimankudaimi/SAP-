#!/usr/bin/env node
/**
 * Localization Inventory Scanner (Syria Transformation - Prompt 1 of 3)
 * Pure Node.js script (zero external dependencies).
 *
 * Scans src, supabase, docs, public, scripts, index.html, README.md,
 * PROJECT_RULES.md, metadata.json, package.json (excluding lock files,
 * node_modules, dist, and this script / output file itself).
 *
 * Categorizes every hit into the 12 required categories:
 *  1. currency
 *  2. places
 *  3. people names
 *  4. ID/legal formats
 *  5. locale/timezone
 *  6. tax
 *  7. phone/IBAN validators
 *  8. map/visuals
 *  9. brand
 * 10. SQL
 * 11. tests
 * 12. docs
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT_REL = 'docs/localization/INVENTORY.md';
const SELF_REL = 'scripts/localization-inventory.mjs';

const SCAN_TARGETS = [
  'src',
  'supabase',
  'docs',
  'public',
  'scripts',
  'index.html',
  'README.md',
  'PROJECT_RULES.md',
  'metadata.json',
  'package.json',
];

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.aistudio']);
const SKIP_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  OUTPUT_REL,
  SELF_REL,
]);

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.sql',
  '.md',
  '.html',
  '.css',
  '.svg',
  '.txt',
]);

/**
 * Token definitions with default category and proposed Syrian replacement
 */
const TOKEN_RULES = [
  // Currency
  {
    id: 'SAR',
    pattern: /\bSAR\b/gi,
    category: 'currency',
    replacement: 'SYP (أو LOCALE.currency.code / formatMoney)',
  },
  {
    id: 'ر.س',
    pattern: /ر\.س/g,
    category: 'currency',
    replacement: 'ل.س (عبر formatMoney / LOCALE.currency.symbolAr)',
  },
  {
    id: 'ريال',
    pattern: /ريال/g,
    category: 'currency',
    replacement: 'ليرة سورية / ل.س',
  },

  // Places & Regions
  {
    id: 'سعودي',
    pattern: /سعودي/g,
    category: 'places',
    replacement: 'سوري',
  },
  {
    id: 'السعودية',
    pattern: /السعودية/g,
    category: 'places',
    replacement: 'سوريا / الجمهورية العربية السورية',
  },
  {
    id: 'Saudi',
    pattern: /\bSaudi\b/gi,
    category: 'places',
    replacement: 'Syrian / Syria',
  },
  {
    id: 'الرياض',
    pattern: /الرياض(?!ي)/g,
    category: 'places',
    replacement: 'دمشق (1100)',
  },
  {
    id: 'Riyadh',
    pattern: /\bRiyadh\b/gi,
    category: 'places',
    replacement: 'Damascus',
  },
  {
    id: 'جدة',
    pattern: /جدة/g,
    category: 'places',
    replacement: 'حلب / اللاذقية',
  },
  {
    id: 'Jeddah',
    pattern: /\bJeddah\b/gi,
    category: 'places',
    replacement: 'Aleppo / Latakia',
  },
  {
    id: 'ينبع',
    pattern: /ينبع/g,
    category: 'places',
    replacement: 'حمص (1200)',
  },
  {
    id: 'Yanbu',
    pattern: /\bYanbu\b/gi,
    category: 'places',
    replacement: 'Homs',
  },
  {
    id: 'الجبيل',
    pattern: /الجبيل/g,
    category: 'places',
    replacement: 'بانياس / طرطوس (1300)',
  },
  {
    id: 'Jubail',
    pattern: /\bJubail\b/gi,
    category: 'places',
    replacement: 'Baniyas / Tartus',
  },
  {
    id: 'الدمام',
    pattern: /الدمام/g,
    category: 'places',
    replacement: 'حمص / دير الزور',
  },
  {
    id: 'Dammam',
    pattern: /\bDammam\b/gi,
    category: 'places',
    replacement: 'Homs / Deir ez-Zor',
  },
  {
    id: 'الخبر',
    pattern: /الخبر/g,
    category: 'places',
    replacement: 'طرطوس',
  },
  {
    id: 'Khobar',
    pattern: /\bKhobar\b/gi,
    category: 'places',
    replacement: 'Tartus',
  },
  {
    id: 'الظهران',
    pattern: /الظهران/g,
    category: 'places',
    replacement: 'تدمر / دير الزور',
  },
  {
    id: 'Dhahran',
    pattern: /\bDhahran\b/gi,
    category: 'places',
    replacement: 'Palmyra / Deir ez-Zor',
  },

  // Map & Visuals
  {
    id: 'الخليج العربي',
    pattern: /الخليج العربي/g,
    category: 'map/visuals',
    replacement: 'الجمهورية العربية السورية / البحر الأبيض المتوسط',
  },
  {
    id: 'Arabian Gulf',
    pattern: /Arabian Gulf/gi,
    category: 'map/visuals',
    replacement: 'Syria / Eastern Mediterranean',
  },
  {
    id: 'Persian Gulf',
    pattern: /Persian Gulf/gi,
    category: 'map/visuals',
    replacement: 'Eastern Mediterranean',
  },

  // Brand & Companies
  {
    id: 'أرامكو',
    pattern: /أرامكو/g,
    category: 'brand',
    replacement: 'شركة الفرات للبترول / مصفاة حمص (وهمي تجريبي)',
  },
  {
    id: 'Aramco',
    pattern: /\bAramco\b/gi,
    category: 'brand',
    replacement: 'Al-Furat Petroleum (Demo)',
  },
  {
    id: 'Gulf Energy',
    pattern: /Gulf Energy/gi,
    category: 'brand',
    replacement: 'Sham Energy (شركة الشام للطاقة)',
  },
  {
    id: 'شركة الخليج',
    pattern: /شركة الخليج/g,
    category: 'brand',
    replacement: 'شركة الشام للطاقة',
  },
  {
    id: 'الخليج',
    pattern: /الخليج/g,
    category: 'brand',
    replacement: 'الشام',
  },

  // Locale & Timezone
  {
    id: 'ar-SA',
    pattern: /ar-SA/gi,
    category: 'locale/timezone',
    replacement: 'ar-SY-u-ca-gregory-nu-latn (LOCALE.dateLocale)',
  },
  {
    id: 'Asia/Riyadh',
    pattern: /Asia\/Riyadh/gi,
    category: 'locale/timezone',
    replacement: 'Asia/Damascus (LOCALE.timezone)',
  },

  // Phone & IBAN Validators
  {
    id: '+966',
    pattern: /\+966/g,
    category: 'phone/IBAN validators',
    replacement: '+963 (LOCALE.phone.countryCode)',
  },
  {
    id: '966',
    pattern: /\b966\d{6,9}\b/g,
    category: 'phone/IBAN validators',
    replacement: '+963XXXXXXXXX',
  },
  {
    id: 'SA-IBAN',
    pattern: /\bSA\d{22}\b/g,
    category: 'phone/IBAN validators',
    replacement: 'حساب مصرفي حر / IBAN اختياري غير مقيد بـ SA',
  },

  // ID & Legal Formats
  {
    id: 'iqama',
    pattern: /iqama/gi,
    category: 'ID/legal formats',
    replacement: 'الرقم الوطني (nationalId / national_id)',
  },
  {
    id: 'إقامة',
    pattern: /إقامة/g,
    category: 'ID/legal formats',
    replacement: 'الرقم الوطني',
  },
  {
    id: 'ZATCA',
    pattern: /\bZATCA\b/gi,
    category: 'ID/legal formats',
    replacement: 'الدوائر المالية / الضريبة',
  },
  {
    id: 'GOSI',
    pattern: /\bGOSI\b/gi,
    category: 'ID/legal formats',
    replacement: 'التأمينات الاجتماعية',
  },
  {
    id: 'SADAD',
    pattern: /\bSADAD\b/gi,
    category: 'ID/legal formats',
    replacement: 'التسديد الإلكتروني',
  },
  {
    id: 'Absher',
    pattern: /\bAbsher\b/gi,
    category: 'ID/legal formats',
    replacement: 'البوابة الإلكترونية',
  },
  {
    id: 'أبشر',
    pattern: /أبشر/g,
    category: 'ID/legal formats',
    replacement: 'البوابة الإلكترونية',
  },
  {
    id: 'Nitaqat',
    pattern: /\bNitaqat\b/gi,
    category: 'ID/legal formats',
    replacement: 'تصنيف العمالة',
  },

  // Tax 15% defaults
  {
    id: 'tax-15-percent',
    pattern: /(?:taxRate|vatRate|\bvat\b|\btax\b|calculatedTax|ضريبة القيمة المضافة)[^\n]{0,40}?(?:0\.15|15%|\b15\b)/gi,
    category: 'tax',
    replacement: 'رمز ضريبي قابل للضبط (EXEMPT=0, SALES=0 افتراضياً) وعنوان "ضريبة"',
  },
  {
    id: 'vat-label',
    pattern: /ضريبة القيمة المضافة/g,
    category: 'tax',
    replacement: 'ضريبة',
  },

  // Saudi tribal surnames in source/seed
  {
    id: 'saudi-surnames',
    pattern: /(?:الشمري|القحطاني|العتيبي|الدوسري|الغامدي|الحربي|المالكي|السبيعي|الزهراني|المطيري|العنزي)/g,
    category: 'people names',
    replacement: 'أسماء سورية من LOCALE.namePools (الحلبي، الشامي، الحموي، الدمشقي، العلي، خوري...)',
  },
];

const CATEGORIES = [
  'currency',
  'places',
  'people names',
  'ID/legal formats',
  'locale/timezone',
  'tax',
  'phone/IBAN validators',
  'map/visuals',
  'brand',
  'SQL',
  'tests',
  'docs',
];

function collectFiles(targetPath, results = []) {
  const fullPath = path.join(ROOT, targetPath);
  if (!fs.existsSync(fullPath)) return results;

  const stat = fs.statSync(fullPath);
  if (stat.isFile()) {
    const rel = path.relative(ROOT, fullPath).replace(/\\/g, '/');
    if (!SKIP_FILES.has(rel)) {
      results.push(rel);
    }
    return results;
  }

  if (stat.isDirectory()) {
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const childRel = path.join(targetPath, entry.name).replace(/\\/g, '/');
      if (SKIP_FILES.has(childRel)) continue;
      if (entry.isDirectory()) {
        collectFiles(childRel, results);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (TEXT_EXTENSIONS.has(ext)) {
          results.push(childRel);
        }
      }
    }
  }

  return results;
}

function classifyHit(relPath, baseCategory) {
  if (relPath.startsWith('supabase/')) return 'SQL';
  if (
    relPath.startsWith('src/tests/') ||
    relPath.startsWith('src/tests-db/') ||
    relPath.endsWith('.test.ts') ||
    relPath.endsWith('.test.tsx')
  ) {
    return 'tests';
  }
  if (
    relPath.startsWith('docs/') ||
    relPath === 'README.md' ||
    relPath === 'PROJECT_RULES.md'
  ) {
    return 'docs';
  }
  if (
    relPath.includes('FleetMapView') ||
    relPath.includes('WarehouseIsometricView') ||
    baseCategory === 'map/visuals'
  ) {
    if (baseCategory === 'places' || baseCategory === 'map/visuals') {
      return 'map/visuals';
    }
  }
  return baseCategory;
}

function runInventory() {
  const files = [];
  for (const target of SCAN_TARGETS) {
    collectFiles(target, files);
  }
  files.sort();

  /** @type {Record<string, Array<{file: string, line: number, token: string, snippet: string, replacement: string}>>} */
  const grouped = {};
  for (const cat of CATEGORIES) {
    grouped[cat] = [];
  }

  for (const relPath of files) {
    const absPath = path.join(ROOT, relPath);
    const content = fs.readFileSync(absPath, 'utf-8');
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      for (const rule of TOKEN_RULES) {
        rule.pattern.lastIndex = 0;
        if (rule.pattern.test(line)) {
          const finalCategory = classifyHit(relPath, rule.category);
          grouped[finalCategory].push({
            file: relPath,
            line: lineNum,
            token: rule.id,
            snippet: line.trim().slice(0, 140),
            replacement: rule.replacement,
          });
        }
      }
    }
  }

  // Build Markdown report
  const linesOut = [];
  linesOut.push('# جرد التوطين والتحويل إلى البيئة السورية (Localization Inventory — Syria)');
  linesOut.push('');
  linesOut.push('> تم توليد هذا التقرير آلياً عبر `scripts/localization-inventory.mjs` بالإضافة إلى المراجعة الدلالية اليدوية الشاملة.');
  linesOut.push('');
  linesOut.push('## 1. ملخص الإحصاءات حسب الفئة (Summary Counts by Category)');
  linesOut.push('');
  linesOut.push('| الفئة (Category) | عدد المواضع المرصودة (Hits) |');
  linesOut.push('|---|---|');

  let totalHits = 0;
  for (const cat of CATEGORIES) {
    const count = grouped[cat].length;
    totalHits += count;
    linesOut.push(`| **${cat}** | ${count} |`);
  }
  linesOut.push(`| **الإجمالي الكلي (Total)** | **${totalHits}** |`);
  linesOut.push('');

  linesOut.push('---');
  linesOut.push('');
  linesOut.push('## 2. نتائج المسح الآلي مصنفة حسب الفئة (Automated Token Scan Hits)');
  linesOut.push('');

  for (const cat of CATEGORIES) {
    const items = grouped[cat];
    linesOut.push(`### فئة: \`${cat}\` (${items.length} موضع)`);
    linesOut.push('');
    if (items.length === 0) {
      linesOut.push('_لا توجد مواضع متبقية في هذه الفئة._');
      linesOut.push('');
      continue;
    }
    linesOut.push('| الملف والسطر (`file:line`) | الرمز (`Token`) | المقتطف (`Snippet`) | البديل المقترح (`Proposed Replacement`) |');
    linesOut.push('|---|---|---|---|');
    for (const item of items) {
      const safeSnippet = item.snippet.replace(/\|/g, '\\|').replace(/`/g, "'");
      const safeReplacement = item.replacement.replace(/\|/g, '\\|');
      linesOut.push(`| \`${item.file}:${item.line}\` | \`${item.token}\` | \`${safeSnippet}\` | ${safeReplacement} |`);
    }
    linesOut.push('');
  }

  linesOut.push('---');
  linesOut.push('');
  linesOut.push('## 3. المراجعة الدلالية اليدوية الشاملة (Manual Semantic Review — Seeds, Fixtures, Amounts, Names & Regional UI Strings)');
  linesOut.push('');
  linesOut.push('نظراً لأن المسح النصي بالرموز لا يكشف الدلالات الرقمية أو الأسماء السياقية، توثق الجداول التالية المراجعة اليدوية الكاملة لملفات البذر (Seeds)، التجهيزات الاختبارية (Fixtures)، الأسعار، وأسماء الكيانات التي سيتم تحويلها في المرحلة الثانية (Prompt 2) والمرحلة الثالثة (Prompt 3):');
  linesOut.push('');

  linesOut.push('### أ) ملفات البذر والتجهيزات التي تحتوي على أسماء أشخاص بطابع سعودي (Tribal Surnames & Person Names)');
  linesOut.push('');
  linesOut.push('| الموقع (`file:line`) | المحتوى الحالي | البديل السوري المعتمد (في Prompt 2) |');
  linesOut.push('|---|---|---|');
  linesOut.push('| `src/seed/index.ts:177-273` | أسماء المستخدمين الـ 10 (م. عبدالله الشمري، فهد القحطاني، سعد العتيبي، خالد الدوسري، عمر الغامدي، نايف الحربي، طارق المالكي، سلطان السبيعي، ماجد الزهراني، فيصل المطيري) | توليد أسماء سورية من `LOCALE.namePools` (مثل: م. طارق الحلبي، باسل الشامي، مازن الحموي، سامر اللاذقاني، غسان الدمشقي، إلخ) |');
  linesOut.push('| `src/seed/index.ts:281-285` | مديرو المحطات والمراكز (م. عبدالله الشمري، م. عمر الغامدي، م. سلطان السبيعي) | أسماء مهندسين سوريين من `LOCALE.namePools` |');
  linesOut.push('| `src/seed/index.ts:535-555` | سائقو الأسطول (أسماء مركبة من قوائم سعودية مثل الشمري، الدوسري، القحطاني، العتيبي، الحربي) | توليد أسماء سائقين سوريين من `LOCALE.namePools.firstNames` و `LOCALE.namePools.lastNames` |');
  linesOut.push('| `src/tests-db/fixtures.ts:133-135` | سائقو الاختبارات (`أحمد السعيد`، `سالم الدوسري`) مع أرقام هواتف `+9665...` | أسماء سورية من `LOCALE.namePools` مع أرقام هواتف `+9639...` |');
  linesOut.push('| `src/modules/fleet/services/TelemetryService.ts:62-145` | أسماء سائقي التتبع الحي في المحاكاة الميدانية | أسماء سورية من `LOCALE.namePools` |');
  linesOut.push('');

  linesOut.push('### ب) المبالغ المالية وأسعار الوقود والتكاليف المعيارية (Monetary Amounts & Fuel Prices)');
  linesOut.push('');
  linesOut.push('| الموقع (`file:line`) | المحتوى الحالي | البديل السوري المعتمد (بالليرة السورية الجديدة SYP) |');
  linesOut.push('|---|---|---|');
  linesOut.push('| `src/seed/index.ts:368-455` | أسعار المواد القياسية (`standardPrice`, `movingAveragePrice`) مثل الديزل بـ `1.15` والبنزين بـ `2.18` وقطع الغيار بالريال | أسعار مقومة بالليرة السورية الجديدة (SYP) مع الإبقاء على توازن المعادلات المحاسبية |');
  linesOut.push('| `src/seed/index.ts:294-312` | موازنات مراكز التكلفة (`budget: 12000000` إلخ) | موازنات مقومة بالليرة السورية الجديدة (SYP) |');
  linesOut.push('| `src/seed/index.ts:560-680` | تكاليف الوقود في الرحلات وسجلات التموين (`costPerLiter: 1.15`, `driverAllowance`) | تسعير اللتر والبدلات بالليرة السورية الجديدة (SYP) |');
  linesOut.push('| `src/modules/fleet/components/FuelLogModal.tsx:41` | السعر الافتراضي للتر الوقود في نموذج التسجيل | السعر الافتراضي بالليرة السورية الجديدة (SYP) |');
  linesOut.push('| `src/modules/fleet/components/TripModal.tsx:336` | معادلة تقدير تكلفة الوقود في نافذة الرحلة | استخدام السعر المعياري بالليرة السورية الجديدة (SYP) |');
  linesOut.push('| `src/modules/finance/services/FinanceService.ts:475-780` | قيود اليومية الافتتاحية والفواتير التجريبية (`seedFinanceIfEmpty`) | قيود متوازنة بالليرة السورية الجديدة (SYP) وضريبة مبيعات 0% افتراضياً |');
  linesOut.push('');

  linesOut.push('### ج) أسماء الموردين والعملاء والبنوك (Vendor, Customer & Bank Names)');
  linesOut.push('');
  linesOut.push('| الموقع (`file:line`) | المحتوى الحالي | البديل السوري المعتمد (`LOCALE.vendorNamePool` / `customerNamePool`) |');
  linesOut.push('|---|---|---|');
  linesOut.push('| `src/seed/index.ts:316` | `النقدية بالبنوك المحلية (الراجحي / الأهلي)` | `النقدية بالبنوك المحلية (المصرف التجاري / مصرف التسليف)` |');
  linesOut.push('| `src/seed/index.ts:458-485` | موردون سعوديون (أرامكو السعودية، سابك، شركة المصافي العربية، الجبيل للبتروكيماويات، إلخ) | شركات سورية خيالية من `LOCALE.vendorNamePool` (مثل: شركة الفرات للتوريدات النفطية، مؤسسة الشام للمعدات الصناعية، شركة الساحل للخدمات اللوجستية، إلخ) |');
  linesOut.push('| `src/seed/index.ts:487-512` | عملاء سعوديون (شركة الكهرباء السعودية، تحلية المياه المالحة، معادن، مرافق، إلخ) | عملاء سوريون خياليون من `LOCALE.customerNamePool` (مثل: مؤسسة توليد الطاقة بدمشق، شركة الفرات للنقل والصناعة، منشأة حلب الصناعية، إلخ) |');
  linesOut.push('| `src/modules/finance/components/PaymentProposalModal.tsx:122-130` | حسابات بنكية (`البنك الأهلي السعودي`، `مصرف الراجحي`، `بنك الرياض`) | حسابات مصرفية سورية مقومة بـ `SYP` |');
  linesOut.push('| `src/modules/admin/services/PrintTemplateService.ts:22,51` | تفاصيل البنوك في قوالب الطباعة (`مصرف الراجحي`، `البنك الأهلي السعودي`) | بيانات مصرفية سورية في قوالب الطباعة |');
  linesOut.push('');

  linesOut.push('### د) أسماء المحطات والمستودعات والمواقع والحقول (Plant, Storage Location & Site Names)');
  linesOut.push('');
  linesOut.push('| الموقع (`file:line`) | المحتوى الحالي | البديل السوري المعتمد (من `LOCALE.plants` و `LOCALE.sites`) |');
  linesOut.push('|---|---|---|');
  linesOut.push('| `src/seed/index.ts:280-292` | المحطات (`1100 الرياض`، `1200 ينبع`، `1300 الجبيل`) والمستودعات الـ 6 | `1100 دمشق (المقر الرئيسي)`، `1200 حمص`، `1300 بانياس`، مع 6 مواقع تخزين موزعة عليها |');
  linesOut.push('| `src/seed/index.ts:1010-1025` | مسارات الرحلات بين الرياض وينبع والجبيل وجدة والدمام | مسارات بين دمشق، حمص، بانياس، طرطوس، اللاذقية، دير الزور، الحسكة، تدمر |');
  linesOut.push('| `src/modules/fleet/components/FleetMapView.tsx:35-120` | إحداثيات الخريطة والحقول والمصافي في الخليج والسعودية | إحداثيات سوريا والمواقع الـ 8 المعتمدة (`LOCALE.sites`: حقل الفرات، حقل الجزيرة، حقل البادية، مصفاة حمص، مصفاة بانياس، مرفأ طرطوس، مرفأ اللاذقية، مستودع دمشق) |');
  linesOut.push('| `src/modules/fleet/services/TelemetryService.ts:40-160` | مسارات التتبع الحي وإحداثيات المركبات | مسارات وإحداثيات المحافظات والحقول السورية من `LOCALE.sites` |');
  linesOut.push('');

  linesOut.push('### هـ) نصوص واجهة المستخدم التي تذكر أقاليم أو جهات تنظيمية إقليمية (Regional UI Strings)');
  linesOut.push('');
  linesOut.push('| الموقع (`file:line`) | النص الحالي | البديل السوري المعتمد |');
  linesOut.push('|---|---|---|');
  linesOut.push('| `src/i18n/ar.ts` | نصوص النظام، اسم الشركة، وتسميات الهوية والضريبة | تحديث المفاتيح لتعكس `شركة الشام للطاقة`، `الرقم الوطني`، `الرقم الضريبي`، و`ل.س` |');
  linesOut.push('| `src/modules/fleet/pages/DriversListPage.tsx:289,318,504` | `رقم الإقامة` / `رقم الإقامة / الهوية الوطنية` | `الرقم الوطني` |');
  linesOut.push('| `src/modules/masterdata/pages/VendorsListPage.tsx:541` | `الرقم الضريبي (VAT ID) *` | `الرقم الضريبي *` |');
  linesOut.push('| `src/modules/masterdata/pages/VendorDetailPage.tsx:370,630` | `الرقم الضريبي (VAT)` / `شهادة ضريبة القيمة المضافة` | `الرقم الضريبي` / `شهادة التسجيل الضريبي` |');
  linesOut.push('| `src/modules/admin/pages/PrintTemplatesPage.tsx:221,404` | `الرقم الضريبي (ZATCA)` / `ضريبة القيمة المضافة (15%)` | `الرقم الضريبي` / `ضريبة` |');
  linesOut.push('| `src/components/common/PrintDocumentModal.tsx:217` | `ضريبة القيمة المضافة (15%):` | `ضريبة:` |');
  linesOut.push('| `src/modules/finance/pages/AccountsReceivablePage.tsx:154` | `ضريبة القيمة المضافة` | `ضريبة` |');
  linesOut.push('| `src/modules/finance/components/CustomerInvoiceModal.tsx:193,234` | `الضريبة (15%)` / `ضريبة القيمة المضافة` | `ضريبة` (تعتمد على رمز الضريبة المختار `EXEMPT` أو `SALES`) |');
  linesOut.push('');

  const outPath = path.join(ROOT, OUTPUT_REL);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, linesOut.join('\n'), 'utf-8');

  console.log('=== Localization Inventory Summary ===');
  for (const cat of CATEGORIES) {
    console.log(`${cat.padEnd(24)}: ${grouped[cat].length}`);
  }
  console.log(`${'TOTAL'.padEnd(24)}: ${totalHits}`);
  console.log(`Wrote inventory report to ${OUTPUT_REL}`);
}

runInventory();
