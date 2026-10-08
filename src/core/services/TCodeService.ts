import type { Role, ModuleCode, ActivityType } from '../../types/models';
import { RbacService } from './RbacService';
import { isRouteImplemented } from '../../app/routeStatus';

export interface SAPTransactionCode {
  code: string;
  descriptionArabic: string;
  descriptionEnglish: string;
  module: ModuleCode;
  activity: ActivityType;
  path: string;
  keywords?: string[];
}

export const SAP_TCODES: SAPTransactionCode[] = [
  // 1. Procurement & Purchasing (MM-PUR)
  {
    code: 'ME51N',
    descriptionArabic: 'إنشاء طلب شراء داخلي جديد (Create Purchase Requisition)',
    descriptionEnglish: 'Create Purchase Requisition',
    module: 'MM',
    activity: 'create',
    path: '/procurement/pr',
    keywords: ['طلب شراء', 'شراء', 'pr', 'requisition'],
  },
  {
    code: 'ME52N',
    descriptionArabic: 'تعديل وتحديث طلب شراء (Change Purchase Requisition)',
    descriptionEnglish: 'Change Purchase Requisition',
    module: 'MM',
    activity: 'change',
    path: '/procurement/pr',
    keywords: ['تعديل طلب شراء', 'change pr'],
  },
  {
    code: 'ME53N',
    descriptionArabic: 'استعراض وعرض طلب شراء (Display Purchase Requisition)',
    descriptionEnglish: 'Display Purchase Requisition',
    module: 'MM',
    activity: 'view',
    path: '/procurement/pr',
    keywords: ['عرض طلب شراء', 'display pr'],
  },
  {
    code: 'ME21N',
    descriptionArabic: 'إنشاء أمر شراء معتمد للمورد (Create Purchase Order)',
    descriptionEnglish: 'Create Purchase Order',
    module: 'MM',
    activity: 'create',
    path: '/procurement/po',
    keywords: ['أمر شراء', 'تعميد', 'po', 'order'],
  },
  {
    code: 'ME22N',
    descriptionArabic: 'تعديل أمر شراء قائم (Change Purchase Order)',
    descriptionEnglish: 'Change Purchase Order',
    module: 'MM',
    activity: 'change',
    path: '/procurement/po',
    keywords: ['تعديل أمر شراء', 'change po'],
  },
  {
    code: 'ME23N',
    descriptionArabic: 'استعراض بيانات وتفاصيل أمر شراء (Display Purchase Order)',
    descriptionEnglish: 'Display Purchase Order',
    module: 'MM',
    activity: 'view',
    path: '/procurement/po',
    keywords: ['عرض أمر شراء', 'display po'],
  },
  {
    code: 'ME41',
    descriptionArabic: 'إنشاء طلب عروض أسعار منافسة (Create RFQ)',
    descriptionEnglish: 'Create Request for Quotation',
    module: 'MM',
    activity: 'create',
    path: '/procurement/rfq',
    keywords: ['عرض سعر', 'منافسة', 'rfq'],
  },
  {
    code: 'ME31K',
    descriptionArabic: 'إنشاء عقد توريد إطاري / اتفاقية كميات (Create Outline Agreement/Contract)',
    descriptionEnglish: 'Create Purchasing Contract',
    module: 'MM',
    activity: 'create',
    path: '/procurement/contracts',
    keywords: ['عقد', 'اتفاقية', 'contract'],
  },
  {
    code: 'ME33K',
    descriptionArabic: 'استعراض عقود التوريد ومتابعة الكميات (Display Purchasing Contract)',
    descriptionEnglish: 'Display Purchasing Contract',
    module: 'MM',
    activity: 'view',
    path: '/procurement/contracts',
    keywords: ['عرض عقد', 'display contract'],
  },

  // 2. Inventory & Warehouse Management (MM-IM / WM)
  {
    code: 'MIGO',
    descriptionArabic: 'حركات المواد والاستلام والصرف المخزني (Goods Movements / MIGO)',
    descriptionEnglish: 'Goods Movement (MIGO)',
    module: 'WM',
    activity: 'post',
    path: '/inventory/movements',
    keywords: ['استلام', 'صرف', 'migo', 'goods receipt', 'goods issue'],
  },
  {
    code: 'MMBE',
    descriptionArabic: 'نظرة عامة على أرصدة المخزون والمحطات (Stock Overview)',
    descriptionEnglish: 'Stock Overview',
    module: 'WM',
    activity: 'view',
    path: '/inventory/stock',
    keywords: ['أرصدة', 'رصيد المخزون', 'stock', 'balance'],
  },
  {
    code: 'MB51',
    descriptionArabic: 'سجل مستندات وحركات المواد التفصيلية (Material Document List)',
    descriptionEnglish: 'Material Document List',
    module: 'WM',
    activity: 'view',
    path: '/inventory/movements',
    keywords: ['سجل الحركات', 'material ledger', 'mb51'],
  },
  {
    code: 'MI01',
    descriptionArabic: 'إنشاء مستند الجرد الفعلي للمستودع (Create Physical Inventory Document)',
    descriptionEnglish: 'Create Physical Inventory Document',
    module: 'WM',
    activity: 'create',
    path: '/inventory/physical',
    keywords: ['جرد', 'جرد فعلي', 'physical inventory'],
  },
  {
    code: 'MI04',
    descriptionArabic: 'إدخال وتثبيت نتائج العد الفعلي للجرد (Enter Inventory Count)',
    descriptionEnglish: 'Enter Inventory Count',
    module: 'WM',
    activity: 'change',
    path: '/inventory/physical',
    keywords: ['تسجيل العد', 'عد الجرد', 'count'],
  },
  {
    code: 'MI07',
    descriptionArabic: 'اعتماد وترحيل فروقات الجرد الفعلي (Post Inventory Differences)',
    descriptionEnglish: 'Post Inventory Differences',
    module: 'WM',
    activity: 'post',
    path: '/inventory/physical',
    keywords: ['تسوية الجرد', 'ترحيل فروقات', 'post difference'],
  },
  {
    code: 'MD04',
    descriptionArabic: 'مستويات الاحتياج ومراقبة نقطة إعادة الطلب (Stock/Requirements & Reorder)',
    descriptionEnglish: 'Stock Requirements & Reorder',
    module: 'MM',
    activity: 'view',
    path: '/inventory/reorder',
    keywords: ['إعادة الطلب', 'reorder point', 'safety stock'],
  },

  // 3. Master Data (MD)
  {
    code: 'MM01',
    descriptionArabic: 'إنشاء بطاقة صنف / مادة بترولية جديدة (Create Material Master)',
    descriptionEnglish: 'Create Material Master',
    module: 'MD',
    activity: 'create',
    path: '/masterdata/materials',
    keywords: ['صنف', 'مادة', 'وقود', 'material'],
  },
  {
    code: 'MM02',
    descriptionArabic: 'تعديل بطاقة مادة ومواصفات التخزين (Change Material Master)',
    descriptionEnglish: 'Change Material Master',
    module: 'MD',
    activity: 'change',
    path: '/masterdata/materials',
    keywords: ['تعديل صنف', 'change material'],
  },
  {
    code: 'MM03',
    descriptionArabic: 'استعراض بطاقات المواد والأصناف (Display Material Master)',
    descriptionEnglish: 'Display Material Master',
    module: 'MD',
    activity: 'view',
    path: '/masterdata/materials',
    keywords: ['عرض صنف', 'display material'],
  },
  {
    code: 'XK01',
    descriptionArabic: 'تسجيل مورد معتمد جديد (Create Vendor Master)',
    descriptionEnglish: 'Create Vendor Master',
    module: 'MD',
    activity: 'create',
    path: '/masterdata/vendors',
    keywords: ['مورد', 'vendor', 'supplier'],
  },
  {
    code: 'XK02',
    descriptionArabic: 'تعديل بيانات مورد وتصنيفه التجاري (Change Vendor Master)',
    descriptionEnglish: 'Change Vendor Master',
    module: 'MD',
    activity: 'change',
    path: '/masterdata/vendors',
    keywords: ['تعديل مورد', 'change vendor'],
  },
  {
    code: 'XK03',
    descriptionArabic: 'استعراض سجل الموردين وتقييم الأداء (Display Vendor Master)',
    descriptionEnglish: 'Display Vendor Master',
    module: 'MD',
    activity: 'view',
    path: '/masterdata/vendors',
    keywords: ['عرض مورد', 'display vendor'],
  },
  {
    code: 'XD03',
    descriptionArabic: 'استعراض بيانات العملاء وجهات التوزيع (Display Customer Master)',
    descriptionEnglish: 'Display Customer Master',
    module: 'MD',
    activity: 'view',
    path: '/masterdata/customers',
    keywords: ['عميل', 'زبون', 'customer'],
  },
  {
    code: 'OX10',
    descriptionArabic: 'استعراض الفروع ومحطات التوزيع البترولية (Display Plant Master)',
    descriptionEnglish: 'Display Plants',
    module: 'MD',
    activity: 'view',
    path: '/masterdata/locations',
    keywords: ['فرع', 'محطة', 'plant', 'site'],
  },
  {
    code: 'KS03',
    descriptionArabic: 'استعراض مراكز التكلفة التشغيلية (Display Cost Centers)',
    descriptionEnglish: 'Display Cost Centers',
    module: 'MD',
    activity: 'view',
    path: '/masterdata/cost-centers',
    keywords: ['مركز تكلفة', 'cost center'],
  },

  // 4. Financial Accounting & Controlling (FI / CO)
  {
    code: 'FB50',
    descriptionArabic: 'تسجيل وترحيل قيود اليومية العامة (Enter G/L Account Document)',
    descriptionEnglish: 'Enter G/L Account Document',
    module: 'FI',
    activity: 'post',
    path: '/finance/journal-entries',
    keywords: ['قيد', 'قيد يومية', 'journal entry', 'gl'],
  },
  {
    code: 'FB08',
    descriptionArabic: 'عكس وإلغاء قيد محاسبي معتمد - ستورنو (Reverse Document / Storno)',
    descriptionEnglish: 'Reverse Document',
    module: 'FI',
    activity: 'reverse',
    path: '/finance/journal-entries',
    keywords: ['عكس قيد', 'storno', 'reverse'],
  },
  {
    code: 'FBV0',
    descriptionArabic: 'ترحيل القيود المسودة المحفوظة (Post Parked Document)',
    descriptionEnglish: 'Post Parked Document',
    module: 'FI',
    activity: 'post',
    path: '/finance/journal-entries',
    keywords: ['قيد محفوظ', 'parked document'],
  },
  {
    code: 'FBL1N',
    descriptionArabic: 'كشف حسابات الذمم الدائنة وأعمار الديون (Vendor Line Items & Aging)',
    descriptionEnglish: 'Vendor Line Items & Aging',
    module: 'FI',
    activity: 'view',
    path: '/finance/payables',
    keywords: ['ذمم دائنة', 'فواتير موردين', 'accounts payable', 'aging'],
  },
  {
    code: 'F110',
    descriptionArabic: 'تشغيل دورة سداد المدفوعات التلقائية (Automatic Payment Run)',
    descriptionEnglish: 'Automatic Payment Run',
    module: 'FI',
    activity: 'post',
    path: '/finance/payables',
    keywords: ['سداد', 'صرف دفعات', 'payment proposal'],
  },
  {
    code: 'FBL5N',
    descriptionArabic: 'كشف حسابات العملاء والمدينين (Customer Line Items & AR)',
    descriptionEnglish: 'Customer Line Items',
    module: 'FI',
    activity: 'view',
    path: '/finance/receivables',
    keywords: ['ذمم مدينة', 'عملاء', 'accounts receivable'],
  },
  {
    code: 'F-28',
    descriptionArabic: 'تسجيل سندات قبض وتحصيل العملاء (Post Customer Incoming Payment)',
    descriptionEnglish: 'Post Customer Payment Receipt',
    module: 'FI',
    activity: 'post',
    path: '/finance/receivables',
    keywords: ['سند قبض', 'تحصيل', 'customer payment'],
  },
  {
    code: 'FS10N',
    descriptionArabic: 'أرصدة حسابات الأستاذ العام وميزان المراجعة (G/L Account Balance Display)',
    descriptionEnglish: 'G/L Account Balance Display',
    module: 'FI',
    activity: 'view',
    path: '/finance/statements',
    keywords: ['ميزان مراجعة', 'أرصدة الأستاذ', 'trial balance'],
  },
  {
    code: 'S_ALR_87012284',
    descriptionArabic: 'القوائم المالية الختامية: المركز المالي والأرباح والخسائر (Financial Statements)',
    descriptionEnglish: 'Balance Sheet & P&L Statements',
    module: 'FI',
    activity: 'view',
    path: '/finance/statements',
    keywords: ['قوائم مالية', 'ميزانية عمومية', 'دخل', 'financial statements'],
  },
  {
    code: 'OBYC',
    descriptionArabic: 'قواعد التوجيه المحاسبي الآلي لحركات المواد (Account Determination Rules)',
    descriptionEnglish: 'Account Determination',
    module: 'FI',
    activity: 'view',
    path: '/finance/account-determination',
    keywords: ['توجيه محاسبي', 'obyc', 'determination'],
  },
  {
    code: 'OB52',
    descriptionArabic: 'إقفال وفتح الفترات المالية المحاسبية (Open/Close Posting Periods)',
    descriptionEnglish: 'Posting Periods Control',
    module: 'FI',
    activity: 'change',
    path: '/finance/closing',
    keywords: ['إقفال فترة', 'فترات مالية', 'fiscal periods'],
  },
  {
    code: 'KSU5',
    descriptionArabic: 'دورة توزيع الأعباء والتكاليف المشتركة (Cost Center Assessment Cycle)',
    descriptionEnglish: 'Cost Allocation Assessment',
    module: 'CO',
    activity: 'post',
    path: '/finance/controlling',
    keywords: ['توزيع تكاليف', 'تحميل تكلفة', 'allocation'],
  },
  {
    code: 'S_ALR_87013611',
    descriptionArabic: 'تقرير مقارنة التكاليف الفعلية بالميزانية التقديرية (Cost Center Actual vs Budget)',
    descriptionEnglish: 'Cost Center Actual/Budget',
    module: 'CO',
    activity: 'view',
    path: '/finance/controlling',
    keywords: ['انحراف التكاليف', 'موازنة', 'budget variance'],
  },

  // 5. Fixed Asset Management (FI-AA)
  {
    code: 'AS01',
    descriptionArabic: 'تسجيل ورسملة أصل رأسمالي جديد (Create Asset Master)',
    descriptionEnglish: 'Create Asset Master Record',
    module: 'AM',
    activity: 'create',
    path: '/assets/register',
    keywords: ['أصل', 'أصول ثابتة', 'asset', 'fixed assets'],
  },
  {
    code: 'AS02',
    descriptionArabic: 'تعديل بيانات وبيئة أصل رأسمالي (Change Asset Master)',
    descriptionEnglish: 'Change Asset Master Record',
    module: 'AM',
    activity: 'change',
    path: '/assets/register',
    keywords: ['تعديل أصل', 'change asset'],
  },
  {
    code: 'AS03',
    descriptionArabic: 'سجل الأصول الثابتة وقيم الدفاتر (Display Asset Register)',
    descriptionEnglish: 'Display Asset Register',
    module: 'AM',
    activity: 'view',
    path: '/assets/register',
    keywords: ['عرض أصل', 'asset register'],
  },
  {
    code: 'AFAB',
    descriptionArabic: 'تشغيل وترحيل دورة إهلاك الأصول الشهرية (Execute Depreciation Posting Run)',
    descriptionEnglish: 'Depreciation Posting Run',
    module: 'AM',
    activity: 'post',
    path: '/assets/depreciation',
    keywords: ['إهلاك', 'دورة إهلاك', 'depreciation'],
  },
  {
    code: 'ABT1N',
    descriptionArabic: 'نقل الأصول بين الفروع ومراكز التكلفة والعهد (Intercompany/Plant Asset Transfer)',
    descriptionEnglish: 'Asset Transfer',
    module: 'AM',
    activity: 'create',
    path: '/assets/transfers',
    keywords: ['نقل أصل', 'عهدة', 'asset transfer'],
  },
  {
    code: 'ABAVN',
    descriptionArabic: 'استبعاد وتخريد أو بيع الأصول الثابتة (Asset Retirement / Scrap / Sale)',
    descriptionEnglish: 'Asset Retirement & Scrap',
    module: 'AM',
    activity: 'post',
    path: '/assets/disposals',
    keywords: ['تخريد أصل', 'بيع أصل', 'scrap', 'disposal'],
  },

  // 6. Fleet & Logistics (TM / PM)
  {
    code: 'IE01',
    descriptionArabic: 'تسجيل شاحنة أو صهريج وقود بالأسطول (Create Fleet Vehicle Master)',
    descriptionEnglish: 'Create Fleet Vehicle Master',
    module: 'TM',
    activity: 'create',
    path: '/fleet/vehicles',
    keywords: ['شاحنة', 'صهريج', 'مركبة', 'vehicle', 'fleet'],
  },
  {
    code: 'IE03',
    descriptionArabic: 'استعراض أسطول الشاحنات والصهاريج وحالتها (Display Fleet Vehicles)',
    descriptionEnglish: 'Display Fleet Vehicles',
    module: 'TM',
    activity: 'view',
    path: '/fleet/vehicles',
    keywords: ['عرض الشاحنات', 'أسطول', 'vehicles'],
  },
  {
    code: 'VT01N',
    descriptionArabic: 'إصدار أمر شحن وترحيل رحلة نقل وقود (Create Transportation Trip)',
    descriptionEnglish: 'Create Transportation Trip',
    module: 'TM',
    activity: 'create',
    path: '/fleet/trips',
    keywords: ['رحلة', 'أمر شحن', 'نقل', 'trip', 'dispatch'],
  },
  {
    code: 'IW31',
    descriptionArabic: 'فتح أمر صيانة وإصلاح شاحنة (Create Maintenance Order)',
    descriptionEnglish: 'Create Maintenance Order',
    module: 'TM',
    activity: 'create',
    path: '/fleet/maintenance',
    keywords: ['صيانة', 'أمر صيانة', 'ورشة', 'maintenance'],
  },
  {
    code: 'IFC1',
    descriptionArabic: 'سجل استهلاك الوقود وفحص الانحرافات (Fleet Fuel Consumption Log)',
    descriptionEnglish: 'Fleet Fuel Management',
    module: 'TM',
    activity: 'view',
    path: '/fleet/fuel',
    keywords: ['وقود', 'استهلاك وقود', 'fuel'],
  },

  // 7. System Administration & Workflows (ADM)
  {
    code: 'SU01',
    descriptionArabic: 'إدارة حسابات المستخدمين وصلاحيات الدخول (User Maintenance)',
    descriptionEnglish: 'User Maintenance',
    module: 'ADM',
    activity: 'view',
    path: '/admin/users',
    keywords: ['مستخدم', 'مستخدمين', 'users', 'su01'],
  },
  {
    code: 'PFCG',
    descriptionArabic: 'إدارة الأدوار الوظيفية وكائنات التخويل (Role & Authorization Maintenance)',
    descriptionEnglish: 'Role Maintenance',
    module: 'ADM',
    activity: 'view',
    path: '/admin/roles',
    keywords: ['أدوار', 'صلاحيات', 'roles', 'pfcg'],
  },
  {
    code: 'SM21',
    descriptionArabic: 'سجل التدقيق الشامل وتتبع كافة الحركات (System Audit Log)',
    descriptionEnglish: 'System Audit Log',
    module: 'ADM',
    activity: 'view',
    path: '/admin/audit',
    keywords: ['تدقيق', 'سجل العمليات', 'audit log'],
  },
  {
    code: 'BR01',
    descriptionArabic: 'لوحة النسخ الاحتياطي المشفر والاستعادة (Backup & Recovery Cockpit)',
    descriptionEnglish: 'Backup & Recovery Cockpit',
    module: 'ADM',
    activity: 'create',
    path: '/admin/backup',
    keywords: ['نسخ احتياطي', 'استعادة', 'backup', 'restore'],
  },
  {
    code: 'SWDD',
    descriptionArabic: 'تهيئة مسارات وقواعد الاعتماد المالي (Workflow Architecture & Approvals)',
    descriptionEnglish: 'Workflow Configuration',
    module: 'ADM',
    activity: 'create',
    path: '/admin/workflow',
    keywords: ['سير عمل', 'اعتمادات', 'workflow'],
  },
  {
    code: 'SBWP',
    descriptionArabic: 'صندوق طلبات الاعتماد والموافقات الواردة (SAP Business Workplace / Approvals)',
    descriptionEnglish: 'Approvals Inbox',
    module: 'MM',
    activity: 'view',
    path: '/approvals',
    keywords: ['موافقات', 'طلبات الاعتماد', 'inbox', 'approvals'],
  },
  {
    code: 'PRT01',
    descriptionArabic: 'محرر قوالب المطبوعات الرسمية (Print Templates Editor)',
    descriptionEnglish: 'Print Templates Editor',
    module: 'ADM',
    activity: 'create',
    path: '/admin/print-templates',
    keywords: ['طباعة', 'قوالب طباعة', 'print template'],
  },
];

export class TCodeService {
  /**
   * Normalizes input by stripping /n or /N and trimming
   */
  static normalizeCode(input: string): string {
    let clean = input.trim();
    if (clean.toLowerCase().startsWith('/n')) {
      clean = clean.substring(2).trim();
    }
    return clean.toUpperCase();
  }

  /**
   * Finds matching transaction codes for autocomplete suggestions.
   * Filters by permissions if current role is provided.
   */
  static searchCodes(query: string, currentRole?: Role | null): SAPTransactionCode[] {
    const q = query.trim().toLowerCase();
    const cleanQ = q.startsWith('/n') ? q.substring(2).trim() : q;

    if (!cleanQ) {
      return SAP_TCODES.filter((item) => {
        if (!currentRole) return true;
        return RbacService.hasPermission(currentRole, { module: item.module, activity: item.activity });
      }).slice(0, 8);
    }

    return SAP_TCODES.filter((item) => {
      // Omit unimplemented placeholder screens from autocomplete
      if (!isRouteImplemented(item.path)) {
        return false;
      }

      const matchCode = item.code.toLowerCase().includes(cleanQ);
      const matchAr = item.descriptionArabic.toLowerCase().includes(cleanQ);
      const matchEn = item.descriptionEnglish.toLowerCase().includes(cleanQ);
      const matchKey = item.keywords?.some((k) => k.toLowerCase().includes(cleanQ));

      if (!matchCode && !matchAr && !matchEn && !matchKey) {
        return false;
      }

      if (currentRole) {
        return RbacService.hasPermission(currentRole, { module: item.module, activity: item.activity });
      }

      return true;
    }).slice(0, 10);
  }

  /**
   * Resolves a T-Code string, strictly verifying authorization and implementation status.
   */
  static resolveCode(
    inputCode: string,
    currentRole?: Role | null
  ): { success: boolean; targetPath?: string; error?: string; code?: SAPTransactionCode } {
    const normalized = this.normalizeCode(inputCode);
    if (!normalized) {
      return { success: false, error: 'يرجى إدخال رمز المعاملة (T-Code).' };
    }

    const tcode = SAP_TCODES.find((t) => t.code.toUpperCase() === normalized);
    if (!tcode) {
      return {
        success: false,
        error: `رمز المعاملة [${normalized}] غير معروف أو غير مسجل في النظام.`,
      };
    }

    // Authorization Guard
    if (currentRole) {
      const hasPerm = RbacService.hasPermission(currentRole, {
        module: tcode.module,
        activity: tcode.activity,
      });

      if (!hasPerm) {
        const requiredCode = RbacService.getPermissionCode(tcode.module, tcode.activity);
        return {
          success: false,
          error: `خطأ صلاحيات: ليس لديك صلاحية (${requiredCode}) لتشغيل المعاملة [${tcode.code}].`,
          code: tcode,
        };
      }
    }

    // Check if target screen is implemented in current release
    if (!isRouteImplemented(tcode.path)) {
      return {
        success: false,
        error: 'هذه الشاشة غير متاحة بعد في هذا الإصدار',
        code: tcode,
      };
    }

    return {
      success: true,
      targetPath: tcode.path,
      code: tcode,
    };
  }
}
