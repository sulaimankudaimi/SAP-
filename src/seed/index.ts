import { db } from '../core/db';
import { CryptoService } from '../core/services/crypto';
import { NumberRangeService } from '../core/services/NumberRangeService';
import { SYSTEM_ROLES } from '../core/services/RbacService';
import type {
  Role,
  Permission,
  User,
  Company,
  Plant,
  StorageLocation,
  CostCenter,
  GLAccount,
  Material,
  MaterialGroup,
  UnitOfMeasure,
  Vendor,
  Customer,
  PurchaseOrder,
  PurchaseOrderItem,
  GoodsReceipt,
  GoodsReceiptItem,
  VendorInvoice,
  VendorInvoiceItem,
  StockLedgerEntry,
  StockBalance,
  Vehicle,
  Driver,
  FuelLog,
  MaintenanceOrder,
  Asset,
  AssetTransfer,
  AssetValuation,
  DepreciationRun,
  Budget,
  MaterialDocument,
  PhysicalInventoryDoc,
  InventoryAlert,
  AuctionRecord,
  Trip,
  FuelAnomalyAlert,
  PreventiveSchedule,
} from '../types/models';
import type { StatusVariant } from '../types';
import { FinanceService } from '../modules/finance/services/FinanceService';

export class DatabaseSeeder {
  /**
   * Checks if database is already seeded.
   */
  static async isSeeded(): Promise<boolean> {
    const userCount = await db.users.count();
    const materialCount = await db.materials.count();
    return userCount >= 1 && materialCount >= 100;
  }

  /**
   * Clears all tables and performs fresh full seed.
   */
  static async resetAndSeed(): Promise<void> {
    const tableList = [
      db.users,
      db.roles,
      db.permissions,
      db.companies,
      db.plants,
      db.storageLocations,
      db.costCenters,
      db.glAccounts,
      db.materials,
      db.materialGroups,
      db.units,
      db.vendors,
      db.customers,
      db.purchaseRequisitions,
      db.rfqs,
      db.purchaseOrders,
      db.contracts,
      db.goodsReceipts,
      db.stockLedger,
      db.stockBalances,
      db.materialDocuments,
      db.inventoryAlerts,
      db.auctionRecords,
      db.physicalInventoryDocs,
      db.vehicles,
      db.drivers,
      db.trips,
      db.fuelLogs,
      db.fuelAnomalyAlerts,
      db.maintenanceOrders,
      db.preventiveSchedules,
      db.assets,
      db.assetTransfers,
      db.depreciationRuns,
      db.journalEntries,
      db.vendorInvoices,
      db.payments,
      db.budgets,
      db.approvalRequests,
      db.notifications,
      db.auditLogs,
      db.numberRanges,
      db.settings,
      db.fiscalPeriods,
      db.accountDeterminations,
      db.customerInvoices,
      db.customerReceipts,
      db.costAllocationCycles,
      db.internalOrders,
    ];

    for (const table of tableList) {
      await table.clear();
    }

    await this.seed();
  }

  /**
   * Executes rapid high-speed bulk seeding in under 5 seconds.
   */
  static async seed(): Promise<void> {
    console.time('DB_SEED_TIMER');

    // 1. Initialize Number Ranges
    await NumberRangeService.initDefaults('2026');

    // 2. Roles & Permissions (10 Roles)
    const permissions: Permission[] = [
      { id: 'p1', code: 'MM_VIEW', name: 'استعراض المشتريات', module: 'MM', activity: 'view', description: 'استعراض طلبات وأوامر الشراء' },
      { id: 'p2', code: 'MM_CREATE', name: 'إنشاء مشتريات', module: 'MM', activity: 'create', description: 'إنشاء طلبات وأوامر شراء جديدة' },
      { id: 'p3', code: 'MM_CHANGE', name: 'تعديل المشتريات', module: 'MM', activity: 'change', description: 'تعديل أوامر الشراء' },
      { id: 'p4', code: 'MM_DELETE', name: 'حذف المشتريات', module: 'MM', activity: 'delete', description: 'إلغاء وحذف أوامر الشراء' },
      { id: 'p5', code: 'MM_APPROVE', name: 'اعتماد المشتريات', module: 'MM', activity: 'approve', description: 'اعتماد أوامر الشراء والمناقصات' },
      { id: 'p6', code: 'WM_VIEW', name: 'استعراض المخزون', module: 'WM', activity: 'view', description: 'استعراض الأرصدة والمستودعات' },
      { id: 'p7', code: 'WM_POST', name: 'ترحيل حركة المواد', module: 'WM', activity: 'post', description: 'إدخال حركات MIGO وصرف المخزون' },
      { id: 'p8', code: 'TM_VIEW', name: 'استعراض الأسطول', module: 'TM', activity: 'view', description: 'استعراض المركبات والرحلات' },
      { id: 'p9', code: 'TM_CREATE', name: 'إنشاء رحلات', module: 'TM', activity: 'create', description: 'جدولة رحلات الصهاريج' },
      { id: 'p10', code: 'AM_VIEW', name: 'استعراض الأصول', module: 'AM', activity: 'view', description: 'سجل الأصول الثابتة' },
      { id: 'p11', code: 'AM_POST', name: 'استهلاك الأصول', module: 'AM', activity: 'post', description: 'ترحيل استهلاك الأصول' },
      { id: 'p12', code: 'FI_VIEW', name: 'استعراض المالية', module: 'FI', activity: 'view', description: 'استعراض الأستاذ العام والفواتير' },
      { id: 'p13', code: 'FI_POST', name: 'ترحيل القيود المالية', module: 'FI', activity: 'post', description: 'ترحيل قيود FB50 وفواتير FB60' },
      { id: 'p14', code: 'FI_APPROVE', name: 'اعتماد مالي', module: 'FI', activity: 'approve', description: 'اعتماد المدفوعات والميزانيات' },
      { id: 'p15', code: 'ADM_ALL', name: 'إدارة النظام بالكامل', module: 'ADM', activity: 'create', description: 'كامل الصلاحيات الفنية' },
    ];

    const roles: Role[] = [
      { id: 'r-admin', code: SYSTEM_ROLES.ADMIN, name: 'مدير النظام (System Administrator)', description: 'كامل الصلاحيات الفنية والتشغيلية لكافة الوحدات', permissionCodes: ['*'], isSystem: true },
      { id: 'r-proc-mgr', code: SYSTEM_ROLES.PROCUREMENT_MANAGER, name: 'مدير المشتريات (Procurement Manager)', description: 'إدارة عقود التوريد واعتماد أوامر الشراء حتى 250 ألف ر.س', permissionCodes: ['MM_VIEW', 'MM_CREATE', 'MM_CHANGE', 'MM_APPROVE', 'MD_VIEW', 'FI_VIEW'], isSystem: true },
      { id: 'r-proc-off', code: SYSTEM_ROLES.PROCUREMENT_OFFICER, name: 'موظف مشتريات (Procurement Officer)', description: 'إنشاء طلبات عروض الأسعار وإصدار أوامر الشراء المبدئية', permissionCodes: ['MM_VIEW', 'MM_CREATE', 'MM_CHANGE', 'MD_VIEW'], isSystem: true },
      { id: 'r-wh-clerk', code: SYSTEM_ROLES.WAREHOUSE_CLERK, name: 'أمين مستودع (Warehouse Clerk)', description: 'استلام المواد MIGO، صرف المواد، والجرد الفعلي بالمحطات', permissionCodes: ['WM_VIEW', 'WM_POST', 'MM_VIEW', 'MD_VIEW'], isSystem: true },
      { id: 'r-flt-mgr', code: SYSTEM_ROLES.FLEET_MANAGER, name: 'مدير الأسطول (Fleet & Logistics Manager)', description: 'إدارة أسطول صهاريج نقل الوقود ومتابعة الصيانة والسائقين', permissionCodes: ['TM_VIEW', 'TM_CREATE', 'TM_CHANGE', 'MD_VIEW'], isSystem: true },
      { id: 'r-acc', code: SYSTEM_ROLES.ACCOUNTANT, name: 'محاسب مالي (Financial Accountant)', description: 'تسجيل القيود اليومية وفواتير الموردين والذمم الدائنة والمدينة', permissionCodes: ['FI_VIEW', 'FI_POST', 'MM_VIEW', 'WM_VIEW', 'MD_VIEW'], isSystem: true },
      { id: 'r-fin-mgr', code: SYSTEM_ROLES.FINANCE_MANAGER, name: 'مدير مالي (Finance Director)', description: 'الرقابة المالية والميزانيات واعتماد الفواتير والمدفوعات', permissionCodes: ['FI_VIEW', 'FI_POST', 'FI_APPROVE', 'MM_VIEW', 'MM_APPROVE', 'MD_VIEW'], isSystem: true },
      { id: 'r-auditor', code: SYSTEM_ROLES.AUDITOR, name: 'مدقق داخلي (Internal Auditor)', description: 'فحص سجلات التدقيق والحركات المحاسبية والمخزنية دون تعديل', permissionCodes: ['MM_VIEW', 'WM_VIEW', 'FI_VIEW', 'TM_VIEW', 'AM_VIEW', 'MD_VIEW', 'ADM_VIEW'], isSystem: true },
      { id: 'r-asset-mgr', code: SYSTEM_ROLES.ASSET_MANAGER, name: 'مدير الأصول (Asset Manager)', description: 'سجل الأصول الرأسمالية ومحطات الضخ والصيانة الدورية', permissionCodes: ['AM_VIEW', 'AM_CREATE', 'AM_POST', 'MD_VIEW'], isSystem: true },
      { id: 'r-viewer', code: SYSTEM_ROLES.VIEWER, name: 'مستعرض فقط (Read-Only Viewer)', description: 'استعراض البيانات الأساسية والشاشات دون إمكانية التعديل', permissionCodes: ['MM_VIEW', 'WM_VIEW', 'TM_VIEW', 'AM_VIEW', 'FI_VIEW', 'MD_VIEW'], isSystem: true },
    ];

    // 3. Demo / Non-Demo Users Selection
    const defaultSalt = 'e8f7b2c14a9018d423985710bcdef012';
    const now = new Date().toISOString();
    const isDemoMode = typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEMO_MODE === 'true';

    let demoUsers: User[] = [];

    if (isDemoMode) {
      const defaultHash = await CryptoService.hashPassword('Admin@123', defaultSalt);
      demoUsers = [
        { id: 'u-admin', username: 'admin', fullName: 'م. أحمد الشمري (المدير العام)', email: 'admin@gulfenergy.sa', roleId: 'r-admin', roleCode: SYSTEM_ROLES.ADMIN, roleName: 'مدير النظام', companyCode: '1000', plantCode: '1100', passwordHash: defaultHash, passwordSalt: defaultSalt, failedLoginAttempts: 0, isLocked: false, mustChangePassword: false, createdAt: now, updatedAt: now, isDeleted: false },
        { id: 'u-proc-mgr', username: 'proc.mgr', fullName: 'أ. فهد الدوسري (مدير المشتريات)', email: 'fahad@gulfenergy.sa', roleId: 'r-proc-mgr', roleCode: SYSTEM_ROLES.PROCUREMENT_MANAGER, roleName: 'مدير المشتريات', companyCode: '1000', plantCode: '1100', passwordHash: defaultHash, passwordSalt: defaultSalt, failedLoginAttempts: 0, isLocked: false, mustChangePassword: false, createdAt: now, updatedAt: now, isDeleted: false },
        { id: 'u-proc-off', username: 'proc.off', fullName: 'سارة القحطاني (مسؤولة المشتريات)', email: 'sara@gulfenergy.sa', roleId: 'r-proc-off', roleCode: SYSTEM_ROLES.PROCUREMENT_OFFICER, roleName: 'موظف مشتريات', companyCode: '1000', plantCode: '1100', passwordHash: defaultHash, passwordSalt: defaultSalt, failedLoginAttempts: 0, isLocked: false, mustChangePassword: false, createdAt: now, updatedAt: now, isDeleted: false },
        { id: 'u-wh-clerk', username: 'wh.clerk', fullName: 'سلطان المطيري (أمين المستودع)', email: 'sultan@gulfenergy.sa', roleId: 'r-wh-clerk', roleCode: SYSTEM_ROLES.WAREHOUSE_CLERK, roleName: 'أمين مستودع', companyCode: '1000', plantCode: '1100', passwordHash: defaultHash, passwordSalt: defaultSalt, failedLoginAttempts: 0, isLocked: false, mustChangePassword: false, createdAt: now, updatedAt: now, isDeleted: false },
        { id: 'u-flt-mgr', username: 'flt.mgr', fullName: 'خالد العنزي (مدير اللوجستيات)', email: 'khaled@gulfenergy.sa', roleId: 'r-flt-mgr', roleCode: SYSTEM_ROLES.FLEET_MANAGER, roleName: 'مدير الأسطول', companyCode: '1000', plantCode: '1200', passwordHash: defaultHash, passwordSalt: defaultSalt, failedLoginAttempts: 0, isLocked: false, mustChangePassword: false, createdAt: now, updatedAt: now, isDeleted: false },
        { id: 'u-acc', username: 'accountant', fullName: 'محمد الحربي (محاسب مالي)', email: 'm.harbi@gulfenergy.sa', roleId: 'r-acc', roleCode: SYSTEM_ROLES.ACCOUNTANT, roleName: 'محاسب مالي', companyCode: '1000', plantCode: '1100', passwordHash: defaultHash, passwordSalt: defaultSalt, failedLoginAttempts: 0, isLocked: false, mustChangePassword: false, createdAt: now, updatedAt: now, isDeleted: false },
        { id: 'u-fin-mgr', username: 'fin.mgr', fullName: 'عبدالعزيز العتيبي (المدير المالي)', email: 'a.otaibi@gulfenergy.sa', roleId: 'r-fin-mgr', roleCode: SYSTEM_ROLES.FINANCE_MANAGER, roleName: 'مدير مالي', companyCode: '1000', plantCode: '1100', passwordHash: defaultHash, passwordSalt: defaultSalt, failedLoginAttempts: 0, isLocked: false, mustChangePassword: false, createdAt: now, updatedAt: now, isDeleted: false },
        { id: 'u-auditor', username: 'auditor', fullName: 'نورة السبيعي (مدقق مالي وتشغيلي)', email: 'noura@gulfenergy.sa', roleId: 'r-auditor', roleCode: SYSTEM_ROLES.AUDITOR, roleName: 'مدقق داخلي', companyCode: '1000', plantCode: '1100', passwordHash: defaultHash, passwordSalt: defaultSalt, failedLoginAttempts: 0, isLocked: false, mustChangePassword: false, createdAt: now, updatedAt: now, isDeleted: false },
        { id: 'u-asset-mgr', username: 'asset.mgr', fullName: 'م. طارق الزهراني (مدير الأصول والصيانة)', email: 'tariq@gulfenergy.sa', roleId: 'r-asset-mgr', roleCode: SYSTEM_ROLES.ASSET_MANAGER, roleName: 'مدير أصول', companyCode: '1000', plantCode: '1300', passwordHash: defaultHash, passwordSalt: defaultSalt, failedLoginAttempts: 0, isLocked: false, mustChangePassword: false, createdAt: now, updatedAt: now, isDeleted: false },
        { id: 'u-viewer', username: 'viewer', fullName: 'ريم الغامدي (مستعرض عمليات)', email: 'reem@gulfenergy.sa', roleId: 'r-viewer', roleCode: SYSTEM_ROLES.VIEWER, roleName: 'مستعرض فقط', companyCode: '1000', plantCode: '1100', passwordHash: defaultHash, passwordSalt: defaultSalt, failedLoginAttempts: 0, isLocked: false, mustChangePassword: false, createdAt: now, updatedAt: now, isDeleted: false },
      ];
    } else {
      // Non-demo mode: create ONLY admin user with mustChangePassword=true and random one-time password
      const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
      const generatedOtp = `Adm#${randomPart}!9`;
      const adminHash = await CryptoService.hashPassword(generatedOtp, defaultSalt);

      demoUsers = [
        {
          id: 'u-admin',
          username: 'admin',
          fullName: 'م. أحمد الشمري (المدير العام)',
          email: 'admin@gulfenergy.sa',
          roleId: 'r-admin',
          roleCode: SYSTEM_ROLES.ADMIN,
          roleName: 'مدير النظام',
          companyCode: '1000',
          plantCode: '1100',
          passwordHash: adminHash,
          passwordSalt: defaultSalt,
          failedLoginAttempts: 0,
          isLocked: false,
          mustChangePassword: true,
          createdAt: now,
          updatedAt: now,
          isDeleted: false,
        },
      ];

      // Save initial OTP for first boot display
      await db.settings.put({
        id: 'set-initial-admin-otp',
        key: 'INITIAL_ADMIN_OTP',
        value: generatedOtp,
        category: 'security',
        description: 'كلمة مرور لمرة واحدة لحساب المدير الأول',
        updatedAt: now,
        isDeleted: false,
      });
    }

    // 4. Enterprise Structure (1 Company, 3 Plants, 6 Storage Locations)
    const company: Company = { id: 'c-1000', code: '1000', name: 'شركة الخليج للطاقة (المملكة العربية السعودية)', currency: 'SAR', country: 'SA', taxNumber: '300192834700003', isDeleted: false };
    const plants: Plant[] = [
      { id: 'p-1100', code: '1100', name: 'مركز الرياض اللوجستي ومستودعات التوزيع الأوسط', companyCode: '1000', city: 'الرياض', isDeleted: false },
      { id: 'p-1200', code: '1200', name: 'محطة ينبع البترولية ومستودع الساحل الغربي', companyCode: '1000', city: 'ينبع', isDeleted: false },
      { id: 'p-1300', code: '1300', name: 'مجمع الدمام التشغيلي والأرصفة البحرية', companyCode: '1000', city: 'الدمام', isDeleted: false },
    ];
    const storageLocations: StorageLocation[] = [
      { id: 'sl-1101', code: 'SL01', name: 'مستودع صهاريج وقود الديزل والبنزين', plantCode: '1100', type: 'FuelBulk', isDeleted: false },
      { id: 'sl-1102', code: 'SL02', name: 'مستودع الزيوت والشحوم المعبأة', plantCode: '1100', type: 'PackedLube', isDeleted: false },
      { id: 'sl-1201', code: 'SL03', name: 'مستودع قطع غيار المضخات والصمامات', plantCode: '1200', type: 'SpareParts', isDeleted: false },
      { id: 'sl-1202', code: 'SL04', name: 'مستودع سوائل الحفر ومواد كيميائية', plantCode: '1200', type: 'Chemicals', isDeleted: false },
      { id: 'sl-1301', code: 'SL05', name: 'مستودع أنابيب الحفر والمعدات الثقيلة', plantCode: '1300', type: 'HeavyEquipment', isDeleted: false },
      { id: 'sl-1302', code: 'SL06', name: 'مستودع معدات السلامة والوقاية (PPE)', plantCode: '1300', type: 'SafetySupplies', isDeleted: false },
    ];

    // 5. 25 Cost Centers
    const costCenterNames = [
      'الإدارة العامة والتنفيذية', 'إدارة الحفر والاستكشاف', 'عمليات محطات ينبع',
      'عمليات محطات الدمام', 'أسطول صهاريج المنطقة الوسطى', 'أسطول صهاريج الغربية',
      'ورشة الصيانة الميكانيكية', 'إدارة البيئة والسلامة (EHS)', 'مستودعات الرياض المركزية',
      'إدارة المشتريات والتوريد', 'المبيعات وعقود الطاقة', 'الإدارة المالية والمحاسبة',
      'تقنية المعلومات والاتصالات', 'الموارد البشرية والتدريب', 'مختبرات فحص جودة الوقود',
      'أرصفة الشحن البحري', 'صيانة محطات الضخ الهيدروليكي', 'مراقبة المخزون والجرد',
      'الشؤون القانونية والعقود', 'الخدمات المساندة والمرافق', 'محطة توليد الكهرباء الاحتياطية',
      'خطوط أنابيب نقل الخام', 'وحدة معالجة المياه الصناعية', 'مكتب إدارة المشاريع (PMO)',
      'إدارة العلاقات الحكومية والموانئ'
    ];
    const costCenters: CostCenter[] = costCenterNames.map((name, idx) => ({
      id: `cc-${1000 + idx + 1}`,
      code: `CC-${1000 + idx + 1}`,
      name,
      companyCode: '1000',
      responsiblePerson: `م. مدير مركز ${idx + 1}`,
      isDeleted: false,
    }));

    // 6. 60 Chart of Accounts (SAP standard numbering 1xxxxx to 8xxxxx)
    const glAccounts: GLAccount[] = [
      // 1xxxxx Assets
      { id: 'gl-101010', accountNumber: '101010', name: 'النقدية بالبنوك المحلية (الراجحي / الأهلي)', category: 'Asset', currency: 'SAR', isDeleted: false },
      { id: 'gl-101020', accountNumber: '101020', name: 'صندوق العهد النقدية المؤقتة', category: 'Asset', currency: 'SAR', isDeleted: false },
      { id: 'gl-110010', accountNumber: '110010', name: 'الذمم المدينة التجارية (عملاء الطاقة)', category: 'Asset', currency: 'SAR', isDeleted: false },
      { id: 'gl-120010', accountNumber: '120010', name: 'مخزون وقود الديزل (Euro 5)', category: 'Asset', currency: 'SAR', isDeleted: false },
      { id: 'gl-120020', accountNumber: '120020', name: 'مخزون البنزين 95 أوكتان', category: 'Asset', currency: 'SAR', isDeleted: false },
      { id: 'gl-120030', accountNumber: '120030', name: 'مخزون زيوت المحركات والمواد البترولية', category: 'Asset', currency: 'SAR', isDeleted: false },
      { id: 'gl-120040', accountNumber: '120040', name: 'مخزون قطع غيار المضخات ومحابس الأنابيب', category: 'Asset', currency: 'SAR', isDeleted: false },
      { id: 'gl-120050', accountNumber: '120050', name: 'مخزون مواد كيميائية وسوائل الحفر', category: 'Asset', currency: 'SAR', isDeleted: false },
      { id: 'gl-120060', accountNumber: '120060', name: 'بضاعة بالطريق (Goods in Transit)', category: 'Asset', currency: 'SAR', isDeleted: false },
      { id: 'gl-150010', accountNumber: '150010', name: 'أصول ثابتة - خزانات ومحطات الضخ', category: 'Asset', currency: 'SAR', isDeleted: false },
      { id: 'gl-150020', accountNumber: '150020', name: 'أصول ثابتة - أسطول الشاحنات والصهاريج', category: 'Asset', currency: 'SAR', isDeleted: false },
      { id: 'gl-150030', accountNumber: '150030', name: 'مباني ومستودعات التخزين الجافة', category: 'Asset', currency: 'SAR', isDeleted: false },
      { id: 'gl-150090', accountNumber: '150090', name: 'مجمع استهلاك الأصول الثابتة', category: 'Asset', currency: 'SAR', isDeleted: false },

      // 2xxxxx Liabilities
      { id: 'gl-201010', accountNumber: '201010', name: 'الذمم الدائنة التجارية (موردي الوقود والمعدات)', category: 'Liability', currency: 'SAR', isDeleted: false },
      { id: 'gl-201020', accountNumber: '201020', name: 'مستحقات مقاولي النقل واللوجستيات', category: 'Liability', currency: 'SAR', isDeleted: false },
      { id: 'gl-202010', accountNumber: '202010', name: 'ضريبة القيمة المضافة المستحقة (ZATCA)', category: 'Liability', currency: 'SAR', isDeleted: false },
      { id: 'gl-203010', accountNumber: '203010', name: 'مستحقات الرواتب والتأمينات الاجتماعية', category: 'Liability', currency: 'SAR', isDeleted: false },
      { id: 'gl-210010', accountNumber: '210010', name: 'أوراق دفع وتسهيلات ائتمانية بنكية', category: 'Liability', currency: 'SAR', isDeleted: false },

      // 3xxxxx Equity
      { id: 'gl-301010', accountNumber: '301010', name: 'رأس المال المدفوع', category: 'Equity', currency: 'SAR', isDeleted: false },
      { id: 'gl-302010', accountNumber: '302010', name: 'الاحتياطي النظامي', category: 'Equity', currency: 'SAR', isDeleted: false },
      { id: 'gl-303010', accountNumber: '303010', name: 'الأرباح المبقاة', category: 'Equity', currency: 'SAR', isDeleted: false },

      // 4xxxxx Revenue
      { id: 'gl-401010', accountNumber: '401010', name: 'إيرادات مبيعات وقود الديزل الصناعي', category: 'Revenue', currency: 'SAR', isDeleted: false },
      { id: 'gl-401020', accountNumber: '401020', name: 'إيرادات مبيعات وقود المحطات والسيارات', category: 'Revenue', currency: 'SAR', isDeleted: false },
      { id: 'gl-402010', accountNumber: '402010', name: 'إيرادات خدمات نقل وشحن المواد البترولية', category: 'Revenue', currency: 'SAR', isDeleted: false },
      { id: 'gl-403010', accountNumber: '403010', name: 'إيرادات عقود الصيانة والخدمات الفنية', category: 'Revenue', currency: 'SAR', isDeleted: false },

      // 5xxxxx Cost of Goods Sold (COGS)
      { id: 'gl-501010', accountNumber: '501010', name: 'تكلفة مشتريات الوقود الخام والمكرر', category: 'Expense', currency: 'SAR', isDeleted: false },
      { id: 'gl-501020', accountNumber: '501020', name: 'تكلفة قطع الغيار والمهمات المستهلكة', category: 'Expense', currency: 'SAR', isDeleted: false },
      { id: 'gl-502010', accountNumber: '502010', name: 'فروقات جرد المخزون الفعلي (Inventory Shrinkage)', category: 'Expense', currency: 'SAR', isDeleted: false },

      // 6xxxxx Operating Expenses
      { id: 'gl-601010', accountNumber: '601010', name: 'رواتب وأجور السائقين والفنيين', category: 'Expense', currency: 'SAR', isDeleted: false },
      { id: 'gl-602010', accountNumber: '602010', name: 'مصروفات صيانة وإصلاح أسطول الصهاريج', category: 'Expense', currency: 'SAR', isDeleted: false },
      { id: 'gl-603010', accountNumber: '603010', name: 'وقود تشغيل الشاحنات ومعدات النقل', category: 'Expense', currency: 'SAR', isDeleted: false },
      { id: 'gl-604010', accountNumber: '604010', name: 'إيجارات المستودعات والمكاتب الإدارية', category: 'Expense', currency: 'SAR', isDeleted: false },
      { id: 'gl-605010', accountNumber: '605010', name: 'مصاريف التأمين على الصهاريج والبضائع', category: 'Expense', currency: 'SAR', isDeleted: false },

      // 7xxxxx Depreciation
      { id: 'gl-701010', accountNumber: '701010', name: 'استهلاك صهاريج وشاحنات الأسطول', category: 'Expense', currency: 'SAR', isDeleted: false },
      { id: 'gl-701020', accountNumber: '701020', name: 'استهلاك خزانات الوقود والمضخات', category: 'Expense', currency: 'SAR', isDeleted: false },

      // 8xxxxx Other / Tax
      { id: 'gl-801010', accountNumber: '801010', name: 'مخصص الزكاة الشرعية وضريبة الدخل', category: 'Expense', currency: 'SAR', isDeleted: false },
    ];
    // Fill remaining accounts up to 60 for complete SAP chart
    for (let i = glAccounts.length + 1; i <= 60; i++) {
      glAccounts.push({
        id: `gl-600${String(i).padStart(3, '0')}`,
        accountNumber: `600${String(i).padStart(3, '0')}`,
        name: `حساب تشغيلي فرعي #${i} - نفقات الطاقة والمرافق`,
        category: 'Expense',
        currency: 'SAR',
        isDeleted: false,
      });
    }

    // 7. Material Groups & Units
    const materialGroups: MaterialGroup[] = [
      { id: 'mg-fuel', code: 'GRP-FUEL', name: 'الوقود والمنتجات البترولية', isDeleted: false },
      { id: 'mg-lube', code: 'GRP-LUBE', name: 'الزيوت والشحوم الصناعية', isDeleted: false },
      { id: 'mg-pipe', code: 'GRP-PIPE', name: 'أنابيب الحفر ومعدات التوصيل', isDeleted: false },
      { id: 'mg-valve', code: 'GRP-VALVE', name: 'الصمامات ومحابس الضغط العالي', isDeleted: false },
      { id: 'mg-pump', code: 'GRP-PUMP', name: 'مضخات الطين والتفريغ الهيدروليكي', isDeleted: false },
      { id: 'mg-chem', code: 'GRP-CHEM', name: 'سوائل الحفر والمواد الكيميائية', isDeleted: false },
      { id: 'mg-ppe', code: 'GRP-PPE', name: 'معدات السلامة والوقاية الشخصية', isDeleted: false },
      { id: 'mg-spare', code: 'GRP-SPARE', name: 'قطع غيار المحركات والمحامل', isDeleted: false },
    ];
    const units: UnitOfMeasure[] = [
      { id: 'u-ltr', code: 'LTR', name: 'لتر', isDeleted: false },
      { id: 'u-bbl', code: 'BBL', name: 'برميل', isDeleted: false },
      { id: 'u-ton', code: 'TON', name: 'طن متري', isDeleted: false },
      { id: 'u-pcs', code: 'PCS', name: 'قطعة', isDeleted: false },
      { id: 'u-set', code: 'SET', name: 'طقم', isDeleted: false },
      { id: 'u-mtr', code: 'MTR', name: 'متر', isDeleted: false },
      { id: 'u-bag', code: 'BAG', name: 'كيس (50 كجم)', isDeleted: false },
    ];

    // 8. 120 Materials (Oil & Gas Domain: Drill pipes, Valves, Mud pumps, Bits, Bearings, Chemicals, PPE...)
    const materialTemplates = [
      { name: 'وقود ديزل منخفض الكبريت (Euro 5)', group: 'GRP-FUEL', unit: 'LTR', price: 1.15, abc: 'A', reorder: 50000, safety: 20000 },
      { name: 'بنزين ممتاز 95 أوكتان', group: 'GRP-FUEL', unit: 'LTR', price: 2.33, abc: 'A', reorder: 40000, safety: 15000 },
      { name: 'بنزين 91 أوكتان خالي من الرصاص', group: 'GRP-FUEL', unit: 'LTR', price: 2.18, abc: 'A', reorder: 45000, safety: 18000 },
      { name: 'زيت محركات الديزل الثقيلة 15W-40', group: 'GRP-LUBE', unit: 'BBL', price: 1250, abc: 'B', reorder: 50, safety: 20 },
      { name: 'شحم حراري عالي التحمل EP-2', group: 'GRP-LUBE', unit: 'BBL', price: 850, abc: 'C', reorder: 30, safety: 10 },
      { name: 'أنبوب حفر فولاذي عالي الصلابة 5 بوصة Grade G-105', group: 'GRP-PIPE', unit: 'MTR', price: 420, abc: 'A', reorder: 600, safety: 200 },
      { name: 'أنبوب تغليف آبار النفط 9-5/8 بوصة L-80', group: 'GRP-PIPE', unit: 'MTR', price: 580, abc: 'A', reorder: 400, safety: 150 },
      { name: 'صمام بوابة هيدروليكي (Gate Valve) ضغط 5000 PSI', group: 'GRP-VALVE', unit: 'PCS', price: 14500, abc: 'A', reorder: 8, safety: 3 },
      { name: 'صمام أمان كروي (Ball Valve) مقاس 6 بوصة ANSI 600', group: 'GRP-VALVE', unit: 'PCS', price: 8900, abc: 'B', reorder: 12, safety: 4 },
      { name: 'صمام عدم رجوع (Check Valve) 4 بوصة', group: 'GRP-VALVE', unit: 'PCS', price: 4200, abc: 'B', reorder: 15, safety: 5 },
      { name: 'مضخة طين ثلاثية الأسطوانات (Triplex Mud Pump 1600 HP)', group: 'GRP-PUMP', unit: 'SET', price: 385000, abc: 'A', reorder: 2, safety: 1 },
      { name: 'مضخة تفريغ وقود طاردة مركزية 50 HP', group: 'GRP-PUMP', unit: 'PCS', price: 24000, abc: 'A', reorder: 5, safety: 2 },
      { name: 'رأس حفر ماسي متعدد التبلور (PDC Drill Bit 8-1/2")', group: 'GRP-SPARE', unit: 'PCS', price: 45000, abc: 'A', reorder: 6, safety: 2 },
      { name: 'رأس حفر مخروطي فولاذي ثلاثي القوائم (Roller Cone Bit 12-1/4")', group: 'GRP-SPARE', unit: 'PCS', price: 28000, abc: 'A', reorder: 8, safety: 3 },
      { name: 'محمل كروي ذاتي المحاذاة (Spherical Roller Bearing SKF)', group: 'GRP-SPARE', unit: 'PCS', price: 3200, abc: 'B', reorder: 25, safety: 10 },
      { name: 'مانع تسرب ميكانيكي عالي الضغط (Mechanical Seal)', group: 'GRP-SPARE', unit: 'SET', price: 1850, abc: 'C', reorder: 40, safety: 15 },
      { name: 'مسحوق طين البنتونيت عالي النقاوة لحفر الآبار (Bentonite API)', group: 'GRP-CHEM', unit: 'BAG', price: 65, abc: 'B', reorder: 1000, safety: 300 },
      { name: 'مادة باريت لزيادة كثافة سوائل الحفر (Barite 4.2 SG)', group: 'GRP-CHEM', unit: 'BAG', price: 85, abc: 'B', reorder: 800, safety: 250 },
      { name: 'مثبط تآكل الأنابيب والمضخات (Corrosion Inhibitor)', group: 'GRP-CHEM', unit: 'BBL', price: 3400, abc: 'B', reorder: 20, safety: 8 },
      { name: 'خوذة أمان معيارية مقاومة للصدمات والكهرباء (Safety Helmet)', group: 'GRP-PPE', unit: 'PCS', price: 120, abc: 'C', reorder: 200, safety: 50 },
      { name: 'بدلة عمل مقاومة للحريق والمواد الكيميائية (Nomex Coverall)', group: 'GRP-PPE', unit: 'PCS', price: 380, abc: 'B', reorder: 150, safety: 40 },
      { name: 'حذاء سلامة مقاوم للزيوت والانزلاق مزود بمقدمة فولاذية', group: 'GRP-PPE', unit: 'PCS', price: 210, abc: 'C', reorder: 180, safety: 50 },
      { name: 'جهاز كشف الغازات الرباعي المحمول (H2S, CO, O2, LEL)', group: 'GRP-PPE', unit: 'SET', price: 4200, abc: 'A', reorder: 10, safety: 4 },
      { name: 'حشوات عازلة للحرارة والضغط للفلنجات (Spiral Wound Gasket)', group: 'GRP-SPARE', unit: 'PCS', price: 85, abc: 'C', reorder: 300, safety: 100 },
    ];

    const materials: Material[] = [];
    for (let i = 1; i <= 120; i++) {
      const template = materialTemplates[(i - 1) % materialTemplates.length];
      const variantSuffix = Math.floor((i - 1) / materialTemplates.length);
      const code = `MAT-${template.group.replace('GRP-', '')}-${String(i).padStart(4, '0')}`;
      const name = variantSuffix > 0 ? `${template.name} - طراز #${variantSuffix + 1}` : template.name;

      materials.push({
        id: `mat-${i}`,
        materialCode: code,
        name,
        description: `مواصفات قياسية معتمدة لقطاع الطاقة واللوجستيات (${code})`,
        groupCode: template.group,
        baseUnit: template.unit,
        abcClass: template.abc as 'A' | 'B' | 'C',
        reorderPoint: template.reorder,
        safetyStock: template.safety,
        standardPrice: template.price,
        currency: 'SAR',
        isDeleted: false,
      });
    }

    // 9. 30 Vendors with Ratings (Aramco-approved, equipment suppliers)
    const vendorNames = [
      'شركة أرامكو لتجارة المنتجات البترولية', 'مجموعة الزامل للمشاريع الصناعية', 'شركة الخريف لتقنيات البترول',
      'شركة الحفر العربية (ADC)', 'مصنع الأنابيب السعودية', 'شركة الأنابيب الفخارية الوطنية',
      'شركة المجرور للتجارة والمقاولات البترولية', 'المؤسسة الوطنية للمضخات والتوربينات', 'شركة لوبريف للزيوت الأساسية',
      'شركة الشرق للصمامات وتجهيزات الآبار', 'شركة التوريدات الصناعية الخليجية', 'المتحدة لخدمات حقول النفط',
      'شركة ينبع للخدمات البتروكيماوية', 'مجموعة سعيد رداد القابضة', 'شركة الفلك للمعدات البحرية والموانئ',
      'شركة الفوزان للمهمات الصناعية', 'مؤسسة صمام الأمان لمعدات الوقاية', 'شركة السيف للكيماويات المتطورة',
      'وكالة بيكر هيوز للحلول المتكاملة', 'شركة شلمبرجير السعودية', 'شركة هاليبرتون لخدمات الطاقة',
      'مؤسسة النقل والتوزيع اللوجستي السريع', 'شركة مسارات البترول لنقل الوقود', 'شركة بترورابغ للإمدادات',
      'شركة فال للصمامات والتحكم الآلي', 'مصنع الجزيرة للأنابيب والمعدات الثقيلة', 'شركة الصقر للأمن الصناعي والسلامة',
      'شركة درع الخليج للإلكترونيات والمقاييس', 'المؤسسة الحديثة لمحطات الضخ', 'شركة روافد الإمداد للمعدات'
    ];
    const vendors: Vendor[] = vendorNames.map((name, idx) => ({
      id: `ven-${idx + 1}`,
      vendorCode: `VEN-${String(1000 + idx + 1)}`,
      name,
      commercialRecord: `1010${String(345000 + idx)}`,
      taxNumber: `300${String(1827364000 + idx)}`,
      category: idx < 5 ? 'FuelRefinery' : idx < 15 ? 'EquipmentManufacturer' : 'LogisticsContractor',
      rating: 4.0 + (idx % 10) * 0.1,
      paymentTerms: idx % 2 === 0 ? 'Net 30 Days' : 'Net 60 Days',
      city: idx % 3 === 0 ? 'الرياض' : idx % 3 === 1 ? 'ينبع' : 'الدمام',
      isDeleted: false,
    }));

    // 10. 15 Customers (Power plants, logistics, industries)
    const customerNames = [
      'الشركة السعودية للكهرباء (SEC) - محطة التوليد 10', 'شركة مرافق للمياه والكهرباء بالجبيل وينبع',
      'شركة معادن للفوسفات والألمنيوم', 'مجموعة الموانئ والخدمات اللوجستية البحرية',
      'شركة سابك للمغذيات الزراعية', 'مجمع الرياض اللوجستي المركزي',
      'شركة التطوير الصناعي للأسمنت', 'مطارات القابضة - تزويد الطائرات بالوقود',
      'شركة قطارات السكك الحديدية (سار)', 'محطة كهرباء الشقيق البخارية',
      'شركة التعدين العربية الكبرى', 'شركة نقل وتوزيع الطاقة الوطنية',
      'مجمع التصنيع اللوجستي بينبع', 'شركة مقاولات الحفر والإنشاءات الكبرى',
      'شركة مصفاة أرامكو توتال (ساتورب)'
    ];
    const customers: Customer[] = customerNames.map((name, idx) => ({
      id: `cus-${idx + 1}`,
      customerCode: `CUS-${String(2000 + idx + 1)}`,
      name,
      taxNumber: `310${String(2948576000 + idx)}`,
      creditLimit: 5000000 + idx * 1000000,
      city: idx % 2 === 0 ? 'الرياض' : 'الدمام',
      isDeleted: false,
    }));

    // 11. Driver Names & 40 Vehicles (Fuel tankers, heavy haulers)
    const driverFirstNames = ['عبدالله', 'سعد', 'محمد', 'علي', 'فهد', 'يوسف', 'إبراهيم', 'عمر', 'سلمان', 'ماجد'];
    const driverLastNames = ['الشمري', 'الدوسري', 'القحطاني', 'العتيبي', 'المطيري', 'الحربي', 'الغامدي', 'الزهراني', 'الشهري', 'العنزي'];

    const vehicles: Vehicle[] = [];
    for (let i = 1; i <= 40; i++) {
      const isTanker = i <= 25;
      const fName = driverFirstNames[(i - 1) % driverFirstNames.length];
      const lName = driverLastNames[Math.floor((i - 1) / 3) % driverLastNames.length];
      vehicles.push({
        id: `veh-${i}`,
        code: `TNK-${String(i).padStart(3, '0')}`,
        plateNumber: `${1000 + i}-أ ب ج`,
        vin: `WDB9340331L${String(100000 + i)}`,
        type: isTanker ? 'Tanker' : (i % 3 === 0 ? 'Crane' : 'HeavyTruck'),
        fuelType: 'Diesel',
        capacityLiters: isTanker ? 36000 : 0,
        capacityTons: isTanker ? 30 : 45,
        makeModel: isTanker ? 'Mercedes-Benz Actros 3340' : (i % 3 === 0 ? 'Tadano GT-600EL' : 'Volvo FH16 650'),
        year: 2021 + (i % 4),
        currentOdometer: 85000 + i * 4200,
        status: i % 8 === 0 ? 'maintenance' : i % 5 === 0 ? 'on_trip' : 'available',
        assignedDriverId: `drv-${((i - 1) % 30) + 1}`,
        assignedDriverName: `${fName} ${lName}`,
        insuranceExpiry: i % 4 === 0 ? '2026-10-25' : '2027-08-30',
        registrationExpiry: i % 6 === 0 ? '2026-10-18' : '2027-11-15',
        lastMaintenanceDate: '2026-08-15',
        nextMaintenanceOdometer: 85000 + i * 4200 + 10000,
        isDeleted: false,
      });
    }

    // 12. 30 Drivers
    const drivers: Driver[] = [];
    for (let i = 1; i <= 30; i++) {
      const fName = driverFirstNames[(i - 1) % driverFirstNames.length];
      const lName = driverLastNames[Math.floor((i - 1) / 3) % driverLastNames.length];
      drivers.push({
        id: `drv-${i}`,
        code: `DRV-${String(i).padStart(3, '0')}`,
        name: `${fName} ${lName}`,
        iqamaNumber: `234${String(1000000 + i)}`,
        licenseNumber: `SA-DL-${String(50000 + i)}`,
        licenseClass: i % 3 === 0 ? 'نقل مواد خطرة (HazMat)' : 'عمومي ثقيل',
        licenseExpiry: '2028-12-31',
        mobile: `055${String(1000000 + i)}`,
        safetyRating: 4.2 + (i % 8) * 0.1,
        performanceScore: 88 + (i % 12),
        certifications: [
          'شهادة أرامكو لنقل المواد البترولية (HazMat)',
          'شهادة الدفاع المدني لمكافحة حرائق الصهاريج',
        ],
        status: i % 4 === 0 ? 'on_trip' : 'available',
        totalTripsCompleted: 24 + i * 5,
        totalDistanceKm: 18500 + i * 2400,
        isDeleted: false,
      });
    }

    // 13. 60 Fixed Assets with AA-style numbers, barcodes, custodians, and lifecycle states
    const assets: Asset[] = [];
    const assetTransfers: AssetTransfer[] = [];
    const assetValuations: AssetValuation[] = [];
    const depreciationRuns: DepreciationRun[] = [];

    const assetCategories: ('StorageTanks' | 'Machinery' | 'Vehicles' | 'Buildings' | 'Pipelines' | 'AuC')[] = [
      'StorageTanks',
      'Machinery',
      'Vehicles',
      'Buildings',
      'Pipelines',
      'StorageTanks',
      'Machinery',
      'AuC',
    ];

    const custodians = [
      'م. أحمد الشمري',
      'م. خالد الغامدي',
      'م. فهد القحطاني',
      'م. عبدالله الشهري',
      'م. بدر الحربي',
      'م. سلطان العنزي',
    ];

    const locations = [
      'المستودع الرئيسي - الرياض',
      'حظيرة الصهاريج رقم 2 - جدة',
      'رصيف الشحن والتفريغ البحري - الدمام',
      'محطة الضخ الهيدروليكية المركزية',
      'مبنى الصيانة والورش المركزية',
    ];

    for (let i = 1; i <= 60; i++) {
      const cat = assetCategories[(i - 1) % assetCategories.length];
      const cost = 120000 + i * 25000;
      const usefulLife = i % 2 === 0 ? 60 : 120;
      const isAuC = cat === 'AuC' || i === 8 || i === 16;
      const isDisposed = i === 12 || i === 24;
      const isInTransfer = i === 5 || i === 15;
      const isInDep = !isAuC && !isDisposed && !isInTransfer && i % 3 === 0;

      const accDep = isAuC ? 0 : Math.round(cost * (i % 4 === 0 ? 0.45 : 0.22));
      const salvage = Math.round(cost * 0.05);
      const bookValue = isDisposed ? 0 : cost - accDep;

      const assetNumber = `AA-2026-${String(i).padStart(6, '0')}`;
      const barcode = `BC-AA2026${String(i).padStart(6, '0')}`;
      const custodian = custodians[(i - 1) % custodians.length];
      const location = locations[(i - 1) % locations.length];

      assets.push({
        id: `ast-${i}`,
        assetNumber,
        name: isAuC
          ? `مشروع رأسمالي قيد التنفيذ #${i} - توسعة خطوط الضخ والتخزين`
          : isDisposed
          ? `مضخة توربينية قديمة #${i} (مُكهَّنة)`
          : `أصل رأسمالي #${i} - ${
              cat === 'StorageTanks'
                ? 'خزان وقود ديزل استراتيجي 50,000L'
                : cat === 'Machinery'
                ? 'مضخة هيدروليكية عالية الضغط'
                : cat === 'Vehicles'
                ? 'شاحنة صهريج نقل وقود مرسيدس أكتروس'
                : cat === 'Buildings'
                ? 'مستودع تخزين مواد لوجستية مركزي'
                : 'شبكة خطوط أنابيب الضخ السريع'
            }`,
        category: cat,
        serialNumber: `SN-GE-${20000 + i}`,
        barcode,
        plantCode: i % 3 === 0 ? '1100' : i % 3 === 1 ? '1200' : '1300',
        costCenter: `CC-${1000 + ((i % 10) + 1)}`,
        location,
        custodian,
        custodianEmployeeId: `EMP-${1000 + i}`,
        acquisitionDate: isAuC ? '2025-11-01' : '2023-01-15',
        acquisitionCost: cost,
        acquisitionSource: i % 3 === 0 ? 'PO' : 'Manual',
        sourceDocNumber: i % 3 === 0 ? `PO-2026-00000${(i % 5) + 1}` : undefined,
        usefulLifeMonths: usefulLife,
        depreciationMethod: i % 4 === 0 ? 'DecliningBalance' : 'StraightLine',
        decliningBalanceRate: i % 4 === 0 ? 0.30 : undefined,
        salvageValue: salvage,
        accumulatedDepreciation: accDep,
        netBookValue: bookValue,
        status: isAuC
          ? 'UnderConstruction'
          : isDisposed
          ? 'Disposed'
          : isInTransfer
          ? 'InTransfer'
          : isInDep
          ? 'InDepreciation'
          : 'Active',
        disposalDate: isDisposed ? '2026-02-15' : undefined,
        disposalType: isDisposed ? (i === 12 ? 'Scrap' : 'Sale') : undefined,
        disposalProceeds: isDisposed && i === 24 ? 35000 : 0,
        disposalGainLoss: isDisposed && i === 24 ? -15000 : isDisposed ? -38000 : undefined,
        disposalJeDocNumber: isDisposed ? `JE-2026-DISP0${i}` : undefined,
        capitalizationJeDocNumber: `JE-2026-CAP0${i}`,
        isDeleted: false,
      });

      // Seed sample transfers for transfer assets
      if (isInTransfer || i % 6 === 0) {
        assetTransfers.push({
          id: `transfer-${i}`,
          docNumber: `AST-2026-${String(i).padStart(6, '0')}`,
          status: isInTransfer ? 'pending' : 'approved',
          assetId: `ast-${i}`,
          assetNumber,
          assetName: assets[i - 1].name,
          fromPlant: '1100',
          toPlant: '1200',
          fromCostCenter: 'CC-1001',
          toCostCenter: 'CC-1002',
          fromLocation: 'المستودع الرئيسي - الرياض',
          toLocation: 'محطة ومستودعات جدة اللوجستية',
          fromCustodian: 'م. أحمد الشمري',
          toCustodian: custodian,
          transferDate: '2026-03-01',
          reason: 'إعادة توزيع المعدات والمضخات لدعم التوسعات التشغيلية في المنطقة الغربية',
          acknowledgedByCustodian: !isInTransfer,
          acknowledgedAt: !isInTransfer ? '2026-03-02T10:00:00Z' : undefined,
          createdBy: 'usr-admin-1',
          createdAt: '2026-03-01T08:00:00Z',
          updatedBy: 'usr-admin-1',
          updatedAt: '2026-03-02T10:00:00Z',
          version: 1,
          isDeleted: false,
        });
      }

      // Seed sample valuations
      if (i % 4 === 0) {
        const score = 70 + (i % 25);
        assetValuations.push({
          id: `val-${i}`,
          docNumber: `INSP-2026-${String(i).padStart(6, '0')}`,
          assetId: `ast-${i}`,
          assetNumber,
          inspectionDate: '2026-02-20',
          inspectorName: 'م. سامي الحربي (كبير مهندسي الفحص)',
          conditionScore: score,
          conditionGrade: score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : 'Fair',
          physicalConditionNotes: 'تم فحص منظومة الضخ وقياس الاهتزازات الميكانيكية، الحالة العامة جيدة ومطابقة للمواصفات القياسية.',
          estimatedMarketValue: Math.round(bookValue * 1.05),
          recommendedAction: 'Continue',
          attachments: [{ name: `تقرير_فحص_${assetNumber}.pdf`, size: '2.1 MB', type: 'PDF' }],
          createdBy: 'usr-admin-1',
          createdAt: '2026-02-20T11:00:00Z',
          updatedAt: '2026-02-20T11:00:00Z',
          isDeleted: false,
        });
      }
    }

    // Seed sample historical depreciation run
    depreciationRuns.push({
      id: 'dep-run-sample-1',
      docNumber: 'DEP-2026-000001',
      status: 'approved',
      companyCode: '1000',
      fiscalYear: '2026',
      period: 9,
      runDate: '2026-09-30T16:00:00Z',
      runType: 'Monthly',
      isSimulation: false,
      totalDepreciationAmount: 185400,
      assetCount: 42,
      postedToGL: true,
      journalEntryDocNumber: 'JE-2026-000101',
      items: [],
      createdBy: 'usr-admin-1',
      createdAt: '2026-09-30T16:00:00Z',
      updatedBy: 'usr-admin-1',
      updatedAt: '2026-09-30T16:00:00Z',
      version: 1,
      isDeleted: false,
    });

    // 14. 80 Purchase Orders (spanning draft, in_review, approved, in_progress, completed, rejected)
    const statuses: StatusVariant[] = ['approved', 'completed', 'in_progress', 'in_review', 'draft', 'rejected'];
    const purchaseOrders: PurchaseOrder[] = [];
    const goodsReceipts: GoodsReceipt[] = [];
    const vendorInvoices: VendorInvoice[] = [];

    for (let i = 1; i <= 80; i++) {
      const status = statuses[(i - 1) % statuses.length];
      const vendor = vendors[(i - 1) % vendors.length];
      const docNumber = `PO-2026-${String(i).padStart(6, '0')}`;
      const mat = materials[(i - 1) % materials.length];
      const qty = 50 + (i * 15);
      const unitPrice = mat.standardPrice;
      const totalAmount = qty * unitPrice;

      const items: PurchaseOrderItem[] = [
        {
          lineItem: 10,
          materialCode: mat.materialCode,
          materialName: mat.name,
          quantity: qty,
          receivedQuantity: status === 'completed' ? qty : status === 'in_progress' ? Math.floor(qty * 0.5) : 0,
          unit: mat.baseUnit,
          unitPrice,
          totalPrice: totalAmount,
          storageLocation: 'SL01',
        },
      ];

      purchaseOrders.push({
        id: `po-${i}`,
        docNumber,
        status,
        vendorCode: vendor.vendorCode,
        vendorName: vendor.name,
        companyCode: '1000',
        plantCode: i % 2 === 0 ? '1100' : '1200',
        orderDate: '2026-09-15',
        deliveryDate: '2026-10-15',
        totalAmount,
        currency: 'SAR',
        paymentTerms: vendor.paymentTerms,
        items,
        createdBy: 'u-proc-mgr',
        createdAt: now,
        updatedBy: 'u-proc-mgr',
        updatedAt: now,
        version: 1,
        isDeleted: false,
      });

      // Consistent GR and Invoices for completed and in_progress POs
      if (status === 'completed' || status === 'in_progress') {
        const grNumber = `GR-2026-${String(i).padStart(6, '0')}`;
        const grItems: GoodsReceiptItem[] = [
          {
            lineItem: 10,
            poItemNumber: 10,
            materialCode: mat.materialCode,
            materialName: mat.name,
            quantity: status === 'completed' ? qty : Math.floor(qty * 0.5),
            unit: mat.baseUnit,
            storageLocation: 'SL01',
          },
        ];

        goodsReceipts.push({
          id: `gr-${i}`,
          docNumber: grNumber,
          status: 'completed',
          poNumber: docNumber,
          vendorCode: vendor.vendorCode,
          deliveryNoteNumber: `DN-${vendor.vendorCode}-${100 + i}`,
          postingDate: '2026-09-20',
          plantCode: '1100',
          movementType: '101',
          items: grItems,
          createdBy: 'u-wh-clerk',
          createdAt: now,
          updatedBy: 'u-wh-clerk',
          updatedAt: now,
          version: 1,
          isDeleted: false,
        });

        // Consistent Vendor Invoice
        const invNumber = `INV-2026-${String(i).padStart(6, '0')}`;
        const netAmt = totalAmount;
        const vatAmt = netAmt * 0.15;
        const invItems: VendorInvoiceItem[] = [
          {
            lineItem: 10,
            description: mat.name,
            amount: netAmt,
            vatRate: 0.15,
            vatAmount: vatAmt,
            totalWithVat: netAmt + vatAmt,
          },
        ];

        vendorInvoices.push({
          id: `inv-${i}`,
          docNumber: invNumber,
          status: 'approved',
          vendorCode: vendor.vendorCode,
          poNumber: docNumber,
          vendorInvoiceNumber: `VINV-${vendor.vendorCode}-${400 + i}`,
          invoiceDate: '2026-09-22',
          postingDate: '2026-09-22',
          dueDate: '2026-10-22',
          totalAmount: netAmt + vatAmt,
          vatAmount: vatAmt,
          netAmount: netAmt,
          paymentStatus: status === 'completed' ? 'Paid' : 'Unpaid',
          items: invItems,
          createdBy: 'u-acc',
          createdAt: now,
          updatedBy: 'u-acc',
          updatedAt: now,
          version: 1,
          isDeleted: false,
        });
      }
    }

    // 15. 200 Stock Ledger Movements (101 GR, 201 GI for cost center, 311 transfer)
    const stockLedger: StockLedgerEntry[] = [];
    const stockBalances: StockBalance[] = [];

    materials.forEach((mat, idx) => {
      const plant = idx % 2 === 0 ? '1100' : '1200';
      const sloc = idx % 3 === 0 ? 'SL01' : idx % 3 === 1 ? 'SL02' : 'SL03';
      const initialQty = mat.reorderPoint * 2.5;

      stockBalances.push({
        id: `bal-${mat.materialCode}-${plant}-${sloc}`,
        materialCode: mat.materialCode,
        plantCode: plant,
        storageLocation: sloc,
        unrestrictedQty: initialQty,
        qualityInspectionQty: 0,
        blockedQty: 0,
        unit: mat.baseUnit,
        totalValuation: initialQty * mat.standardPrice,
        lastMovementDate: '2026-10-01',
        isDeleted: false,
      });

      // Add movement history
      stockLedger.push({
        id: `sl-${idx + 1}-101`,
        materialCode: mat.materialCode,
        plantCode: plant,
        storageLocation: sloc,
        movementType: '101',
        referenceDocNumber: `PO-2026-${String((idx % 80) + 1).padStart(6, '0')}`,
        quantity: initialQty,
        unit: mat.baseUnit,
        amount: initialQty * mat.standardPrice,
        postingDate: '2026-09-18',
        createdBy: 'u-wh-clerk',
        isDeleted: false,
      });
    });

    // Add 80 more issue movements (201 Goods Issue to Cost Centers) to complete 200 movements
    for (let k = 1; k <= 80; k++) {
      const mat = materials[k % materials.length];
      stockLedger.push({
        id: `sl-gi-${k}`,
        materialCode: mat.materialCode,
        plantCode: '1100',
        storageLocation: 'SL01',
        movementType: '201',
        referenceDocNumber: `CC-100${(k % 20) + 1}`,
        quantity: -10 * (k % 5 + 1),
        unit: mat.baseUnit,
        amount: -(10 * (k % 5 + 1) * mat.standardPrice),
        postingDate: '2026-09-25',
        createdBy: 'u-wh-clerk',
        isDeleted: false,
      });
    }

    // 16. 12 Months of Fuel & Maintenance Logs, Trips, Preventive Schedules, & Fuel Anomalies
    const fuelLogs: FuelLog[] = [];
    const maintenanceOrders: MaintenanceOrder[] = [];

    vehicles.forEach((veh, vIdx) => {
      // 12 fuel entries per vehicle
      for (let m = 1; m <= 12; m++) {
        const isLatest = m === 12;
        const isAnomalyVeh = vIdx === 2 || vIdx === 7;
        const liters = isLatest && isAnomalyVeh ? (vIdx === 2 ? 820 : 720) : 600 + (m * 20);
        const lPer100 = isLatest && vIdx === 2 ? 58 : isLatest && vIdx === 7 ? 49 : 38;
        const isAnomaly = isLatest && isAnomalyVeh;
        const devPct = isLatest && vIdx === 2 ? 52.6 : isLatest && vIdx === 7 ? 28.9 : undefined;

        fuelLogs.push({
          id: `fl-${veh.code}-${m}`,
          vehicleId: veh.id,
          vehiclePlate: veh.plateNumber,
          driverId: drivers[vIdx % drivers.length].id,
          driverName: drivers[vIdx % drivers.length].name,
          date: `2026-${String(m).padStart(2, '0')}-15`,
          fuelType: 'Diesel',
          quantityLiters: liters,
          costPerLiter: 1.15,
          totalCost: liters * 1.15,
          odometer: veh.currentOdometer - (12 - m) * 2500,
          stationName: 'محطة أرامكو المركزية - طريق الخرج',
          calculatedConsumptionPer100Km: lPer100,
          isAnomaly,
          anomalyDeviationPercentage: devPct,
          isDeleted: false,
        });
      }

      // Maintenance order per vehicle
      maintenanceOrders.push({
        id: `mo-${veh.code}`,
        docNumber: `MO-2026-${String(vIdx + 1).padStart(6, '0')}`,
        status: 'completed',
        vehicleId: veh.id,
        vehiclePlate: veh.plateNumber,
        orderType: vIdx % 3 === 0 ? 'Inspection' : 'Preventive',
        description: 'صيانة وقائية دورية 50,000 كم، تغيير زيوت الفلاتر وفحص المكابح',
        estimatedCost: 3500,
        actualCost: 3450,
        partsCost: 1850,
        laborCost: 1600,
        laborHours: 12,
        downtimeHours: 16,
        partsUsed: [
          {
            lineItem: 10,
            materialCode: materials[0]?.materialCode || 'OIL-SYN-01',
            materialName: materials[0]?.name || 'زيت محركات ديزل تخليقي',
            quantity: 2,
            unit: 'DRUM',
            unitPrice: 450,
            totalCost: 900,
            storageLocation: 'SL01',
          },
          {
            lineItem: 20,
            materialCode: materials[3]?.materialCode || 'FLT-SET-04',
            materialName: materials[3]?.name || 'طقم فلاتر ديزل وهواء متكامل',
            quantity: 1,
            unit: 'SET',
            unitPrice: 950,
            totalCost: 950,
            storageLocation: 'SL01',
          },
        ],
        materialDocNumber: `MBLNR-2026-${String(vIdx + 1).padStart(6, '0')}`,
        startDate: '2026-08-10',
        completionDate: '2026-08-12',
        createdBy: 'u-flt-mgr',
        createdAt: now,
        updatedBy: 'u-flt-mgr',
        updatedAt: now,
        version: 1,
        isDeleted: false,
      });
    });

    // 16b. Trips & Dispatches (20 trips: 6 in-progress, 14 completed)
    const tripRoutes = [
      { origin: '1100 - مركز الرياض اللوجستي المركزي', dest: 'حقل الغوار - محطة الضخ 4', dist: 395 },
      { origin: '1100 - مركز الرياض اللوجستي المركزي', dest: '1300 - مجمع الدمام ورأس تنورة', dist: 405 },
      { origin: '1100 - مركز الرياض اللوجستي المركزي', dest: '1200 - مصفاة ينبع البترولية', dist: 1050 },
      { origin: 'حقل خريص - منشأة الضخ المركزية', dest: '1100 - مركز الرياض اللوجستي المركزي', dist: 160 },
      { origin: '1300 - مجمع الدمام ورأس تنورة', dest: 'مجمع الجبيل الصناعي للبتروكيماويات', dist: 95 },
    ];

    const trips: Trip[] = [];
    for (let t = 1; t <= 20; t++) {
      const isInProgress = t <= 6;
      const v = vehicles[t - 1];
      const d = drivers[t - 1];
      const r = tripRoutes[(t - 1) % tripRoutes.length];
      const startOdo = v.currentOdometer - 1200 + t * 50;
      const dist = r.dist;
      const endOdo = startOdo + dist;
      const fuelLiters = Math.round(dist * 0.38);
      const fuelCost = Math.round(fuelLiters * 1.15);
      const allowance = Math.round(dist * 0.35);
      const totalCost = fuelCost + allowance;

      trips.push({
        id: `trip-${t}`,
        docNumber: `TRIP-2026-${String(t).padStart(6, '0')}`,
        status: isInProgress ? 'in_progress' : 'completed',
        vehicleId: v.id,
        vehiclePlate: v.plateNumber,
        driverId: d.id,
        driverName: d.name,
        originPlant: r.origin,
        destinationLocation: r.dest,
        cargoType: t % 2 === 0 ? 'ديزل صناعي - 36,000 لتر' : 'بنزين 95 عالي الأوكتان - 34,000 لتر',
        cargoVolumeLiters: 36000,
        scheduledDeparture: '2026-10-03 06:00',
        scheduledArrival: '2026-10-03 14:00',
        actualDeparture: '2026-10-03 06:15',
        actualArrival: isInProgress ? undefined : '2026-10-03 13:45',
        startOdometer: startOdo,
        endOdometer: isInProgress ? undefined : endOdo,
        distanceKm: isInProgress ? undefined : dist,
        delayMinutes: isInProgress ? 0 : (t % 4 === 0 ? 35 : 0),
        delayReason: !isInProgress && t % 4 === 0 ? 'ازدحام نقطة تفتيش أمن المنشآت عند مدخل المرفق' : undefined,
        fuelLitersConsumed: isInProgress ? undefined : fuelLiters,
        fuelCost: isInProgress ? undefined : fuelCost,
        driverAllowanceCost: isInProgress ? undefined : allowance,
        totalTripCost: isInProgress ? undefined : totalCost,
        postedAccountingDocNumber: isInProgress ? undefined : `ACC-TRIP-2026-${String(t).padStart(6, '0')}`,
        createdBy: 'u-flt-mgr',
        createdAt: now,
        updatedBy: 'u-flt-mgr',
        updatedAt: now,
        version: 1,
        isDeleted: false,
      });
    }

    // 16c. Active Fuel Anomaly Alerts (deviation > 25%)
    const fuelAnomalyAlerts: FuelAnomalyAlert[] = [
      {
        id: 'faa-1',
        vehicleId: vehicles[2].id,
        vehiclePlate: vehicles[2].plateNumber,
        fuelLogId: `fl-${vehicles[2].code}-12`,
        date: '2026-10-02',
        liters: 820,
        recordedLPer100Km: 58,
        averageLPer100Km: 38,
        deviationPercentage: 52.6,
        severity: 'critical',
        reasonSummary: 'استهلاك مرتفع جداً يتجاوز المعدل بنسبة 52.6% (احتمال تسريب وقود، تهريب محرك، أو تشغيل مكيف مفرط)',
        status: 'active',
        isDeleted: false,
      },
      {
        id: 'faa-2',
        vehicleId: vehicles[7].id,
        vehiclePlate: vehicles[7].plateNumber,
        fuelLogId: `fl-${vehicles[7].code}-12`,
        date: '2026-10-01',
        liters: 720,
        recordedLPer100Km: 49,
        averageLPer100Km: 38,
        deviationPercentage: 28.9,
        severity: 'warning',
        reasonSummary: 'استهلاك يتجاوز المعدل بنسبة 28.9% (فحص نظام الحقن وفلاتر الديزل مطلوب)',
        status: 'active',
        isDeleted: false,
      },
    ];

    // 16d. Preventive Maintenance Schedules
    const preventiveSchedules: PreventiveSchedule[] = [
      {
        id: 'ps-1',
        vehicleId: vehicles[0].id,
        vehiclePlate: vehicles[0].plateNumber,
        serviceName: 'صيانة دورية 10,000 كم (تغيير زيوت وفلاتر ومسح كمبيوتر)',
        intervalKm: 10000,
        intervalDays: 90,
        lastDoneOdometer: 80000,
        lastDoneDate: '2026-07-15',
        nextDueOdometer: 90000,
        nextDueDate: '2026-10-15',
        status: 'due',
        isDeleted: false,
      },
      {
        id: 'ps-2',
        vehicleId: vehicles[1].id,
        vehiclePlate: vehicles[1].plateNumber,
        serviceName: 'فحص منظومة الفرامل والهواء المضغوط وسلامة الإطارات',
        intervalKm: 15000,
        intervalDays: 120,
        lastDoneOdometer: 85000,
        lastDoneDate: '2026-08-01',
        nextDueOdometer: 100000,
        nextDueDate: '2026-11-01',
        status: 'soon',
        isDeleted: false,
      },
      {
        id: 'ps-3',
        vehicleId: vehicles[2].id,
        vehiclePlate: vehicles[2].plateNumber,
        serviceName: 'فحص صمامات تفريغ الصهريج ونظام مانع الشرر (Spark Arrestor)',
        intervalKm: 20000,
        intervalDays: 180,
        lastDoneOdometer: 70000,
        lastDoneDate: '2026-05-10',
        nextDueOdometer: 90000,
        nextDueDate: '2026-10-10',
        status: 'due',
        isDeleted: false,
      },
      {
        id: 'ps-4',
        vehicleId: vehicles[3].id,
        vehiclePlate: vehicles[3].plateNumber,
        serviceName: 'صيانة شاملة 50,000 كم واستبدال حزام المحرك وسائل التبريد',
        intervalKm: 50000,
        intervalDays: 365,
        lastDoneOdometer: 50000,
        lastDoneDate: '2025-11-20',
        nextDueOdometer: 100000,
        nextDueDate: '2026-11-20',
        status: 'soon',
        isDeleted: false,
      },
      {
        id: 'ps-5',
        vehicleId: vehicles[4].id,
        vehiclePlate: vehicles[4].plateNumber,
        serviceName: 'معايرة مقاييس ومستشعرات حرارة وضغط سوائل الوقود',
        intervalKm: 10000,
        intervalDays: 90,
        lastDoneOdometer: 92000,
        lastDoneDate: '2026-09-01',
        nextDueOdometer: 102000,
        nextDueDate: '2026-12-01',
        status: 'completed',
        isDeleted: false,
      },
    ];

    // 17. Budgets per Cost Center (25 Cost Centers)
    const budgets: Budget[] = costCenters.map((cc) => {
      const allocated = 1500000;
      const actual = 850000;
      const committed = 250000;
      return {
        id: `bgt-${cc.code}-2026`,
        costCenter: cc.code,
        fiscalYear: '2026',
        allocatedAmount: allocated,
        actualAmount: actual,
        committedAmount: committed,
        availableAmount: allocated - (actual + committed),
        isDeleted: false,
      };
    });

    // 18. Material Documents (MBLNR) corresponding to Goods Receipts and Movements
    const materialDocuments: MaterialDocument[] = goodsReceipts.map((gr, i) => ({
      id: `md-${i + 1}`,
      docNumber: `MD-2026-${String(i + 1).padStart(6, '0')}`,
      status: 'completed',
      movementType: '101',
      postingDate: gr.postingDate,
      documentDate: gr.postingDate,
      plantCode: gr.plantCode,
      storageLocation: gr.items[0]?.storageLocation || 'SL01',
      poNumber: gr.poNumber,
      deliveryNoteNumber: gr.deliveryNoteNumber,
      headerText: `استلام بضائع مقابل أمر شراء ${gr.poNumber}`,
      accountingDocNumber: `ACC-2026-${String(i + 1).padStart(6, '0')}`,
      items: gr.items.map((it) => ({
        lineItem: it.lineItem,
        materialCode: it.materialCode,
        materialName: it.materialName,
        quantity: it.quantity,
        unit: it.unit,
        unitPrice: 150,
        totalAmount: it.quantity * 150,
        storageLocation: it.storageLocation,
        batchNumber: `BATCH-2026-A1`,
      })),
      createdBy: 'u-wh-clerk',
      createdAt: now,
      updatedBy: 'u-wh-clerk',
      updatedAt: now,
      version: 1,
      isDeleted: false,
    }));

    // 19. Physical Inventory Docs (MI01 / MI04 / MI07)
    const samplePiDocs: PhysicalInventoryDoc[] = [
      {
        id: 'pi-1',
        docNumber: 'PI-2026-000001',
        status: 'completed',
        plantCode: '1100',
        storageLocation: 'SL01',
        countDate: '2026-09-30',
        freezeMovements: true,
        abcClassFilter: 'A',
        totalVarianceValue: 1250,
        postedDocNumber: 'MD-2026-000099',
        items: [
          {
            lineItem: 1,
            materialCode: materials[0].materialCode,
            materialName: materials[0].name,
            bookQty: 500,
            countedQty: 505,
            varianceQty: 5,
            unit: materials[0].baseUnit,
            unitPrice: materials[0].standardPrice,
            varianceValue: 5 * materials[0].standardPrice,
            counted: true,
          },
          {
            lineItem: 2,
            materialCode: materials[1].materialCode,
            materialName: materials[1].name,
            bookQty: 300,
            countedQty: 298,
            varianceQty: -2,
            unit: materials[1].baseUnit,
            unitPrice: materials[1].standardPrice,
            varianceValue: -2 * materials[1].standardPrice,
            counted: true,
          },
        ],
        createdBy: 'u-wh-clerk',
        createdAt: now,
        updatedBy: 'u-wh-clerk',
        updatedAt: now,
        version: 1,
        isDeleted: false,
      },
      {
        id: 'pi-2',
        docNumber: 'PI-2026-000002',
        status: 'draft',
        plantCode: '1100',
        storageLocation: 'SL02',
        countDate: '2026-10-02',
        freezeMovements: false,
        abcClassFilter: 'ALL',
        totalVarianceValue: 0,
        items: materials.slice(0, 5).map((m, idx) => ({
          lineItem: idx + 1,
          materialCode: m.materialCode,
          materialName: m.name,
          bookQty: m.reorderPoint * 2,
          countedQty: m.reorderPoint * 2,
          varianceQty: 0,
          unit: m.baseUnit,
          unitPrice: m.standardPrice,
          varianceValue: 0,
          counted: false,
        })),
        createdBy: 'u-wh-clerk',
        createdAt: now,
        updatedBy: 'u-wh-clerk',
        updatedAt: now,
        version: 1,
        isDeleted: false,
      },
    ];

    // 20. Inventory Alerts & Auction records
    const inventoryAlerts: InventoryAlert[] = [
      {
        id: 'alt-1',
        materialCode: materials[2].materialCode,
        materialName: materials[2].name,
        plantCode: '1100',
        alertType: 'critical',
        currentStock: 15,
        thresholdQty: materials[2].reorderPoint,
        suggestedReorderQty: materials[2].reorderPoint * 2,
        unit: materials[2].baseUnit,
        createdAt: now,
        status: 'active',
        isDeleted: false,
      },
      {
        id: 'alt-2',
        materialCode: materials[5].materialCode,
        materialName: materials[5].name,
        plantCode: '1100',
        alertType: 'low',
        currentStock: 40,
        thresholdQty: materials[5].reorderPoint,
        suggestedReorderQty: materials[5].reorderPoint * 1.5,
        unit: materials[5].baseUnit,
        createdAt: now,
        status: 'active',
        isDeleted: false,
      },
    ];

    const auctionRecords: AuctionRecord[] = [
      {
        id: 'auc-1',
        auctionReference: 'AUC-2026-000001',
        materialCode: materials[10].materialCode,
        materialName: materials[10].name,
        plantCode: '1100',
        storageLocation: 'SL01',
        quantity: 250,
        unit: materials[10].baseUnit,
        startingPrice: 10000,
        reservePrice: 15000,
        currency: 'SAR',
        condition: 'Obsolete',
        status: 'published',
        createdAt: now,
        createdBy: 'u-wh-clerk',
        isDeleted: false,
      },
    ];

    // Execute bulk additions in high-speed Dexie transaction
    await db.transaction(
      'rw',
      [
        db.permissions,
        db.roles,
        db.users,
        db.companies,
        db.plants,
        db.storageLocations,
        db.costCenters,
        db.glAccounts,
        db.materialGroups,
        db.units,
        db.materials,
        db.vendors,
        db.customers,
        db.vehicles,
        db.drivers,
        db.assets,
        db.purchaseOrders,
        db.goodsReceipts,
        db.vendorInvoices,
        db.stockBalances,
        db.stockLedger,
        db.materialDocuments,
        db.physicalInventoryDocs,
        db.inventoryAlerts,
        db.auctionRecords,
        db.trips,
        db.fuelLogs,
        db.fuelAnomalyAlerts,
        db.maintenanceOrders,
        db.preventiveSchedules,
        db.assetTransfers,
        db.assetValuations,
        db.depreciationRuns,
        db.budgets,
      ],
      async () => {
        await db.permissions.bulkAdd(permissions);
        await db.roles.bulkAdd(roles);
        await db.users.bulkAdd(demoUsers);
        await db.companies.add(company);
        await db.plants.bulkAdd(plants);
        await db.storageLocations.bulkAdd(storageLocations);
        await db.costCenters.bulkAdd(costCenters);
        await db.glAccounts.bulkAdd(glAccounts);
        await db.materialGroups.bulkAdd(materialGroups);
        await db.units.bulkAdd(units);
        await db.materials.bulkAdd(materials);
        await db.vendors.bulkAdd(vendors);
        await db.customers.bulkAdd(customers);
        await db.vehicles.bulkAdd(vehicles);
        await db.drivers.bulkAdd(drivers);
        await db.assets.bulkAdd(assets);
        await db.assetTransfers.bulkAdd(assetTransfers);
        await db.assetValuations.bulkAdd(assetValuations);
        await db.depreciationRuns.bulkAdd(depreciationRuns);
        await db.purchaseOrders.bulkAdd(purchaseOrders);
        await db.goodsReceipts.bulkAdd(goodsReceipts);
        await db.vendorInvoices.bulkAdd(vendorInvoices);
        await db.stockBalances.bulkAdd(stockBalances);
        await db.stockLedger.bulkAdd(stockLedger);
        await db.materialDocuments.bulkAdd(materialDocuments);
        await db.physicalInventoryDocs.bulkAdd(samplePiDocs);
        await db.inventoryAlerts.bulkAdd(inventoryAlerts);
        await db.auctionRecords.bulkAdd(auctionRecords);
        await db.trips.bulkAdd(trips);
        await db.fuelLogs.bulkAdd(fuelLogs);
        await db.fuelAnomalyAlerts.bulkAdd(fuelAnomalyAlerts);
        await db.maintenanceOrders.bulkAdd(maintenanceOrders);
        await db.preventiveSchedules.bulkAdd(preventiveSchedules);
        await db.budgets.bulkAdd(budgets);
      }
    );

    // 21. Seed Financial Accounting & Controlling (Periods, GL entries, account rules)
    await FinanceService.seedFinanceIfEmpty();
  }
}
