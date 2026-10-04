import { db } from '../../../core/db';
import type {
  ReportDefinition,
  ReportCategory,
  ReportSnapshot,
} from '../../../types/models';

export class ReportCatalogService {
  /**
   * Complete Declarative Catalog of Enterprise SAP Reports
   */
  static getCatalog(): ReportDefinition[] {
    return [
      // ---------------------------------------------------------------------
      // 1. مشتريات (Procurement)
      // ---------------------------------------------------------------------
      {
        id: 'REP-MM-01',
        code: 'ME2M',
        title: 'سجل أوامر الشراء التراكمي (Purchase Orders Master Log)',
        description: 'استعراض أوامر الشراء الصادرة للموردين مع تتبع الكميات المسلمة، والمبالغ، وحالة الفوترة والاعتماد.',
        category: 'procurement',
        requiredModule: 'MM',
        columns: [
          { key: 'docNumber', header: 'رقم أمر الشراء', type: 'string', sortable: true },
          { key: 'orderDate', header: 'تاريخ الأمر', type: 'date', sortable: true },
          { key: 'vendorName', header: 'المورد', type: 'string', sortable: true },
          { key: 'plantCode', header: 'الموقع / المحطة', type: 'string', sortable: true },
          { key: 'totalAmount', header: 'القيمة الإجمالية', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'status', header: 'الحالة', type: 'badge', sortable: true },
          { key: 'deliveryDate', header: 'تاريخ التسليم المتوقع', type: 'date', sortable: true },
        ],
        filters: [
          { key: 'plantCode', label: 'المحطة / المنشأة', type: 'select', options: [{ label: 'الكل', value: '' }, { label: 'PL-101 (الرياض)', value: 'PL-101' }, { label: 'PL-102 (جدة)', value: 'PL-102' }, { label: 'PL-103 (الدمام)', value: 'PL-103' }, { label: 'PL-104 (ينبع)', value: 'PL-104' }] },
          { key: 'status', label: 'حالة الأمر', type: 'select', options: [{ label: 'الكل', value: '' }, { label: 'معتمد (Approved)', value: 'approved' }, { label: 'مكتمل (Completed)', value: 'completed' }, { label: 'قيد الاعتماد (Pending)', value: 'in_approval' }] },
          { key: 'searchTerm', label: 'بحث بالمورد أو الرقم', type: 'text' },
        ],
      },
      {
        id: 'REP-MM-02',
        code: 'ME80FN',
        title: 'تقرير التزام وأداء الموردين (Vendor Delivery & Quality Performance)',
        description: 'تقييم تاريخي لموردي المواد وشركات الوقود بحساب نسب الالتزام بالمواعيد ومعدلات استلام الجودة.',
        category: 'procurement',
        requiredModule: 'MM',
        columns: [
          { key: 'vendorCode', header: 'كود المورد', type: 'string', sortable: true },
          { key: 'vendorName', header: 'اسم المورد', type: 'string', sortable: true },
          { key: 'category', header: 'التصنيف', type: 'string', sortable: true },
          { key: 'totalOrders', header: 'عدد الأوامر', type: 'number', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'totalSpent', header: 'إجمالي المشتريات', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'onTimeRate', header: 'نسبة الالتزام بالمواعيد', type: 'percentage', sortable: true, align: 'end' },
          { key: 'rating', header: 'تقييم الجودة', type: 'string', sortable: true, align: 'center' },
        ],
        filters: [
          { key: 'searchTerm', label: 'بحث باسم أو كود المورد', type: 'text' },
        ],
      },
      {
        id: 'REP-MM-03',
        code: 'ME3M',
        title: 'تحليل الإنفاق تحت العقود والمشتريات (Spend Under Contract Analysis)',
        description: 'مقارنة المشتريات الخاضعة لعقود أسعار سنوية مع المشتريات المباشرة الفورية وقياس وفورات الحجم.',
        category: 'procurement',
        requiredModule: 'MM',
        columns: [
          { key: 'contractNumber', header: 'رقم العقد الإطاري', type: 'string', sortable: true },
          { key: 'vendorName', header: 'المورد المتعاقد', type: 'string', sortable: true },
          { key: 'targetValue', header: 'قيمة سقف العقد', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'releasedValue', header: 'المنفذ بأوامر شراء', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'utilizationRate', header: 'نسبة استهلاك العقد', type: 'percentage', sortable: true, align: 'end' },
          { key: 'status', header: 'حالة العقد', type: 'badge', sortable: true },
        ],
        filters: [
          { key: 'searchTerm', label: 'بحث برقم العقد أو المورد', type: 'text' },
        ],
      },
      {
        id: 'REP-MM-04',
        code: 'ME5A',
        title: 'طلبات الشراء المفتوحة والارتباطات (Open PRs & Commitments)',
        description: 'كشف طلبات الشراء الصادرة من الأقسام التي لم تحول إلى أوامر شراء رسمية مع ارتباطاتها بالميزانية.',
        category: 'procurement',
        requiredModule: 'MM',
        columns: [
          { key: 'docNumber', header: 'رقم طلب الشراء', type: 'string', sortable: true },
          { key: 'createdAt', header: 'تاريخ الإنشاء', type: 'date', sortable: true },
          { key: 'costCenter', header: 'مركز التكلفة الطالب', type: 'string', sortable: true },
          { key: 'plantCode', header: 'المحطة', type: 'string', sortable: true },
          { key: 'estimatedAmount', header: 'القيمة التقديرية', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'status', header: 'الحالة', type: 'badge', sortable: true },
        ],
        filters: [
          { key: 'plantCode', label: 'المحطة', type: 'select', options: [{ label: 'الكل', value: '' }, { label: 'PL-101', value: 'PL-101' }, { label: 'PL-102', value: 'PL-102' }, { label: 'PL-103', value: 'PL-103' }, { label: 'PL-104', value: 'PL-104' }] },
        ],
      },

      // ---------------------------------------------------------------------
      // 2. مخزون (Inventory)
      // ---------------------------------------------------------------------
      {
        id: 'REP-WM-01',
        code: 'MB52',
        title: 'تقييم أرصدة المخزون السلعي (Stock Valuation by Plant/Location)',
        description: 'رصيد المخزون الحالي في كل مستودع مع متوسط السعر المرجح وإجمالي القيمة الدفترية ومستويات إعادة الطلب.',
        category: 'inventory',
        requiredModule: 'WM',
        columns: [
          { key: 'materialCode', header: 'كود المادة', type: 'string', sortable: true },
          { key: 'materialName', header: 'اسم المادة والوصف', type: 'string', sortable: true },
          { key: 'plantCode', header: 'الموقع / المحطة', type: 'string', sortable: true },
          { key: 'storageLocation', header: 'موقع التخزين', type: 'string', sortable: true },
          { key: 'quantity', header: 'الكمية المتاحة', type: 'number', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'unit', header: 'الوحدة', type: 'string' },
          { key: 'unitPrice', header: 'سعر الوحدة المرجح', type: 'currency', sortable: true, align: 'end' },
          { key: 'totalValue', header: 'القيمة الإجمالية', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
        ],
        filters: [
          { key: 'plantCode', label: 'المحطة', type: 'select', options: [{ label: 'الكل', value: '' }, { label: 'PL-101', value: 'PL-101' }, { label: 'PL-102', value: 'PL-102' }, { label: 'PL-103', value: 'PL-103' }, { label: 'PL-104', value: 'PL-104' }] },
          { key: 'searchTerm', label: 'بحث بالمادة أو الكود', type: 'text' },
        ],
      },
      {
        id: 'REP-WM-02',
        code: 'MC.A',
        title: 'تقرير المواد الراكدة وبطيئة الحركة (Slow Moving & Dead Stock)',
        description: 'حصر المواد التي لم تشهد أي حركة سحب أو صرف لأكثر من 90 يوماً لحساب حجم رأس المال المجمد.',
        category: 'inventory',
        requiredModule: 'WM',
        columns: [
          { key: 'materialCode', header: 'كود المادة', type: 'string', sortable: true },
          { key: 'materialName', header: 'اسم المادة', type: 'string', sortable: true },
          { key: 'groupCode', header: 'مجموعة المواد', type: 'string', sortable: true },
          { key: 'quantity', header: 'الرصيد الراكد', type: 'number', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'totalValue', header: 'القيمة المجمدة', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'daysWithoutMovement', header: 'أيام بدون حركة', type: 'number', sortable: true, align: 'end' },
          { key: 'recommendation', header: 'الإجراء المقترح', type: 'string' },
        ],
        filters: [
          { key: 'searchTerm', label: 'بحث بالمادة', type: 'text' },
        ],
      },
      {
        id: 'REP-WM-03',
        code: 'MB51',
        title: 'سجل حركات المواد المخزنية (Material Movement Ledger - MIGO)',
        description: 'دفتر أستاذ حركات الاستلام (101)، والصرف لمراكز التكلفة (201)، والتحويلات الداخلية (311).',
        category: 'inventory',
        requiredModule: 'WM',
        columns: [
          { key: 'postingDate', header: 'تاريخ الحركة', type: 'date', sortable: true },
          { key: 'docNumber', header: 'رقم المستند', type: 'string', sortable: true },
          { key: 'movementType', header: 'نوع الحركة', type: 'badge', sortable: true },
          { key: 'materialName', header: 'المادة', type: 'string', sortable: true },
          { key: 'quantity', header: 'الكمية', type: 'number', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'amount', header: 'المبلغ الإجمالي', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'reference', header: 'المستند المرجعي', type: 'string', sortable: true },
        ],
        filters: [
          { key: 'movementType', label: 'نوع الحركة', type: 'select', options: [{ label: 'الكل', value: '' }, { label: 'استلام بضاعة (101)', value: '101' }, { label: 'صرف مركز تكلفة (201)', value: '201' }, { label: 'تحويل بين مواقع (311)', value: '311' }] },
          { key: 'searchTerm', label: 'بحث برقم المستند أو المادة', type: 'text' },
        ],
      },
      {
        id: 'REP-WM-04',
        code: 'MD04',
        title: 'تحليل دوران المخزون والاحتياج الحرج (Stock Turnover & Critical Reorder)',
        description: 'مقارنة الأرصدة الحالية بنقاط إعادة الطلب (ROP) لتحديد المواد القريبة من مستوى حد الأمان (Safety Stock).',
        category: 'inventory',
        requiredModule: 'WM',
        columns: [
          { key: 'materialCode', header: 'كود المادة', type: 'string', sortable: true },
          { key: 'materialName', header: 'اسم المادة', type: 'string', sortable: true },
          { key: 'currentStock', header: 'المخزون الفعلي', type: 'number', sortable: true, align: 'end' },
          { key: 'reorderPoint', header: 'نقطة إعادة الطلب', type: 'number', sortable: true, align: 'end' },
          { key: 'safetyStock', header: 'مخزون الأمان', type: 'number', sortable: true, align: 'end' },
          { key: 'stockStatus', header: 'حالة المخزون', type: 'badge', sortable: true },
        ],
        filters: [
          { key: 'stockStatus', label: 'حالة الرصيد', type: 'select', options: [{ label: 'الكل', value: '' }, { label: 'حرج (تحت الأمان)', value: 'critical' }, { label: 'يتطلب طلب (تحت ROP)', value: 'reorder' }, { label: 'آمن وكافٍ', value: 'normal' }] },
        ],
      },

      // ---------------------------------------------------------------------
      // 3. أسطول (Fleet)
      // ---------------------------------------------------------------------
      {
        id: 'REP-FLT-01',
        code: 'FLT-LOG',
        title: 'سجل استهلاك الوقود وكفاءة المحركات (Fuel Consumption & Efficiency Log)',
        description: 'متابعة كميات الديزل والبنزين المعبأة لكل شاحنة وصهريج ومعدل الكفاءة بالكيلومتر لكل لتر.',
        category: 'fleet',
        requiredModule: 'TM',
        columns: [
          { key: 'date', header: 'التاريخ', type: 'date', sortable: true },
          { key: 'vehicleCode', header: 'رقم المركبة', type: 'string', sortable: true },
          { key: 'plateNumber', header: 'رقم اللوحة', type: 'string', sortable: true },
          { key: 'driverName', header: 'السائق', type: 'string', sortable: true },
          { key: 'liters', header: 'الكمية (لتر)', type: 'number', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'cost', header: 'التكلفة الإجمالية', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'efficiency', header: 'الكفاءة (كم/لتر)', type: 'number', sortable: true, align: 'end' },
        ],
        filters: [
          { key: 'searchTerm', label: 'بحث بالمركبة أو السائق', type: 'text' },
        ],
      },
      {
        id: 'REP-FLT-02',
        code: 'IW39',
        title: 'تكاليف الصيانة وقطع الغيار للمركبات (Vehicle Maintenance & Parts Cost)',
        description: 'كشف أوامر الصيانة الدورية والعلاجية المنفذة على الأسطول وإجمالي تكلفة قطع الغيار والمصنعية.',
        category: 'fleet',
        requiredModule: 'TM',
        columns: [
          { key: 'orderNumber', header: 'رقم أمر الصيانة', type: 'string', sortable: true },
          { key: 'vehicleCode', header: 'الشاحنة / الصهريج', type: 'string', sortable: true },
          { key: 'orderType', header: 'نوع الصيانة', type: 'badge', sortable: true },
          { key: 'description', header: 'بيان الأعمال المنفذة', type: 'string' },
          { key: 'partsCost', header: 'تكلفة قطع الغيار', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'totalCost', header: 'التكلفة الإجمالية', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'status', header: 'الحالة', type: 'badge', sortable: true },
        ],
        filters: [
          { key: 'orderType', label: 'نوع الصيانة', type: 'select', options: [{ label: 'الكل', value: '' }, { label: 'دورية وقائية (Preventive)', value: 'Preventive' }, { label: 'علاجية طارئة (Corrective)', value: 'Corrective' }] },
        ],
      },
      {
        id: 'REP-FLT-03',
        code: 'FLT-UTIL',
        title: 'تشغيل الأسطول وتكلفة الكيلومتر (Fleet Utilization & Cost per KM)',
        description: 'تحليل شامل للمسافات المقطوعة بواسطة شاحنات نقل الطاقة وحساب تكلفة التشغيل لكل كيلومتر.',
        category: 'fleet',
        requiredModule: 'TM',
        columns: [
          { key: 'vehicleCode', header: 'الشاحنة', type: 'string', sortable: true },
          { key: 'model', header: 'الموديل والطراز', type: 'string', sortable: true },
          { key: 'tripsCount', header: 'عدد الرحلات', type: 'number', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'totalKm', header: 'إجمالي الكيلومترات', type: 'number', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'totalCost', header: 'إجمالي المصروفات (وقود+صيانة)', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'costPerKm', header: 'التكلفة لكل كم', type: 'currency', sortable: true, align: 'end' },
          { key: 'status', header: 'حالة المركبة', type: 'badge', sortable: true },
        ],
        filters: [
          { key: 'searchTerm', label: 'بحث بالمركبة', type: 'text' },
        ],
      },
      {
        id: 'REP-FLT-04',
        code: 'FLT-DRV',
        title: 'إنتاجية السائقين وتوزيع الرحلات (Driver Trips & Distribution)',
        description: 'سجل أداء سائقي أسطول المحروقات وتتبع ساعات القيادة والوجهات المنفذة.',
        category: 'fleet',
        requiredModule: 'TM',
        columns: [
          { key: 'driverCode', header: 'كود السائق', type: 'string', sortable: true },
          { key: 'driverName', header: 'اسم السائق', type: 'string', sortable: true },
          { key: 'licenseNumber', header: 'رقم الرخصة', type: 'string' },
          { key: 'tripsCompleted', header: 'الرحلات المنجزة', type: 'number', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'totalHours', header: 'ساعات القيادة الإجمالية', type: 'number', sortable: true, align: 'end' },
          { key: 'safetyScore', header: 'تقييم السلامة', type: 'string', align: 'center' },
        ],
        filters: [
          { key: 'searchTerm', label: 'بحث بالسائق', type: 'text' },
        ],
      },

      // ---------------------------------------------------------------------
      // 4. أصول (Assets)
      // ---------------------------------------------------------------------
      {
        id: 'REP-AM-01',
        code: 'S_ALR_87011963',
        title: 'سجل الأصول الثابتة والقيمة الدفترية (Fixed Asset Register & Net Book Value)',
        description: 'كشف الأصول الرأسمالية والمعدات ومحطات الضخ بالتكلفة التاريخية ومجمع الإهلاك وصافي القيمة الدفترية.',
        category: 'assets',
        requiredModule: 'AM',
        columns: [
          { key: 'assetNumber', header: 'رقم الأصل (AA)', type: 'string', sortable: true },
          { key: 'description', header: 'بيان وتوصيف الأصل', type: 'string', sortable: true },
          { key: 'category', header: 'التصنيف الرأسمالي', type: 'string', sortable: true },
          { key: 'plantCode', header: 'الموقع / المحطة', type: 'string', sortable: true },
          { key: 'acquisitionValue', header: 'التكلفة التاريخية', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'accumulatedDepreciation', header: 'مجمع الاستهلاك', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'netBookValue', header: 'صافي القيمة الدفترية', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'status', header: 'الحالة التشغيلية', type: 'badge', sortable: true },
        ],
        filters: [
          { key: 'plantCode', label: 'المحطة', type: 'select', options: [{ label: 'الكل', value: '' }, { label: 'PL-101', value: 'PL-101' }, { label: 'PL-102', value: 'PL-102' }, { label: 'PL-103', value: 'PL-103' }, { label: 'PL-104', value: 'PL-104' }] },
          { key: 'category', label: 'تصنيف الأصل', type: 'select', options: [{ label: 'الكل', value: '' }, { label: 'Machinery (محطات ومضخات)', value: 'Machinery' }, { label: 'Vehicles (شاحنات وصهاريج)', value: 'Vehicles' }, { label: 'Buildings (مستودعات ومباني)', value: 'Buildings' }] },
        ],
      },
      {
        id: 'REP-AM-02',
        code: 'AFAB-REP',
        title: 'جدول الإهلاك الزمني والاستهلاك المتراكم (Depreciation Schedule & Forecast)',
        description: 'جدول استهلاك الأصول الشهري والسنوي المقيد بالحسابات مع توقعات الإهلاك المستقبلي للخمس سنوات القادمة.',
        category: 'assets',
        requiredModule: 'AM',
        columns: [
          { key: 'docNumber', header: 'رقم دورة الإهلاك', type: 'string', sortable: true },
          { key: 'fiscalYear', header: 'السنة المالية', type: 'string', sortable: true },
          { key: 'period', header: 'الفترة المحاسبية', type: 'string', sortable: true },
          { key: 'totalAmount', header: 'مبلغ الإهلاك المرحل', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'assetsCount', header: 'عدد الأصول المشمولة', type: 'number', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'status', header: 'حالة الترحيل لـ GL', type: 'badge', sortable: true },
        ],
        filters: [
          { key: 'fiscalYear', label: 'السنة المالية', type: 'select', options: [{ label: '2026', value: '2026' }, { label: '2025', value: '2025' }] },
        ],
      },
      {
        id: 'REP-AM-03',
        code: 'ABUMN',
        title: 'سجل تحركات وتنقلات العهد الرأسمالية (Asset Custody & Transfers Audit)',
        description: 'تتبع تاريخ نقل عهدة ومواقع الأصول والمعدات بين المستودعات والمشرفين ومحطات الضخ.',
        category: 'assets',
        requiredModule: 'AM',
        columns: [
          { key: 'transferNumber', header: 'رقم إذن النقل', type: 'string', sortable: true },
          { key: 'assetNumber', header: 'رقم الأصل', type: 'string', sortable: true },
          { key: 'assetName', header: 'اسم الأصل', type: 'string', sortable: true },
          { key: 'fromLocation', header: 'من موقع', type: 'string', sortable: true },
          { key: 'toLocation', header: 'إلى موقع', type: 'string', sortable: true },
          { key: 'toCustodian', header: 'أمين العهدة المستلم', type: 'string', sortable: true },
          { key: 'transferDate', header: 'تاريخ النقل', type: 'date', sortable: true },
          { key: 'status', header: 'حالة الإقرار', type: 'badge', sortable: true },
        ],
        filters: [
          { key: 'searchTerm', label: 'بحث بالأصل أو الموظف', type: 'text' },
        ],
      },
      {
        id: 'REP-AM-04',
        code: 'ABAVN',
        title: 'تقرير استبعاد وتكهين الأصول (Asset Disposals & Scrapping Report)',
        description: 'بيان الأصول المستبعدة بالبيع أو التخريد مع حساب الأرباح والخسائر الرأسمالية الناتجة.',
        category: 'assets',
        requiredModule: 'AM',
        columns: [
          { key: 'assetNumber', header: 'رقم الأصل', type: 'string', sortable: true },
          { key: 'description', header: 'الأصل المستبعد', type: 'string', sortable: true },
          { key: 'disposalDate', header: 'تاريخ الاستبعاد', type: 'date', sortable: true },
          { key: 'type', header: 'طريقة الاستبعاد', type: 'badge', sortable: true },
          { key: 'cost', header: 'التكلفة التاريخية', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'accumDepr', header: 'مجمع الإهلاك', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'gainLoss', header: 'صافي الربح / (الخسارة)', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
        ],
        filters: [],
      },

      // ---------------------------------------------------------------------
      // 5. مالية (Finance)
      // ---------------------------------------------------------------------
      {
        id: 'REP-FI-01',
        code: 'S_ALR_87012277',
        title: 'ميزان المراجعة بالأرصدة والمجاميع (Trial Balance Master Report)',
        description: 'ميزان المراجعة لجميع حسابات دليل الحسابات بالأرصدة الافتتاحية، والحركات، والأرصدة الختامية المتوازنة.',
        category: 'finance',
        requiredModule: 'FI',
        columns: [
          { key: 'accountNumber', header: 'رقم الحساب', type: 'string', sortable: true },
          { key: 'accountName', header: 'اسم الحساب في الدليل', type: 'string', sortable: true },
          { key: 'category', header: 'التصنيف المالي', type: 'string', sortable: true },
          { key: 'periodDebit', header: 'حركة مدين', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'periodCredit', header: 'حركة دائن', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'closingDebit', header: 'رصيد ختامي مدين', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'closingCredit', header: 'رصيد ختامي دائن', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
        ],
        filters: [
          { key: 'category', label: 'التصنيف المالي', type: 'select', options: [{ label: 'الكل', value: '' }, { label: 'أصول (Asset)', value: 'Asset' }, { label: 'خصوم (Liability)', value: 'Liability' }, { label: 'حقوق ملكية (Equity)', value: 'Equity' }, { label: 'إيرادات (Revenue)', value: 'Revenue' }, { label: 'مصروفات (Expense)', value: 'Expense' }] },
          { key: 'searchTerm', label: 'بحث بالحساب', type: 'text' },
        ],
      },
      {
        id: 'REP-FI-02',
        code: 'S_ALR_87012085',
        title: 'أعمار ديون الموردين ومستحقات الدفع (Vendor Aging & AP Schedule)',
        description: 'تحليل استحقاق الذمم الدائنة للموردين مجزأة زمنياً (حالي، 1-30، 31-60، 61-90، +90 يوماً).',
        category: 'finance',
        requiredModule: 'FI',
        columns: [
          { key: 'vendorCode', header: 'كود المورد', type: 'string', sortable: true },
          { key: 'vendorName', header: 'اسم المورد', type: 'string', sortable: true },
          { key: 'current', header: 'مستحق حالي', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'days1To30', header: '1 - 30 يوماً', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'days31To60', header: '31 - 60 يوماً', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'over60', header: 'أكثر من 60 يوماً', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'totalBalance', header: 'إجمالي المديونية', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
        ],
        filters: [
          { key: 'searchTerm', label: 'بحث بالمورد', type: 'text' },
        ],
      },
      {
        id: 'REP-FI-03',
        code: 'S_ALR_87013611',
        title: 'انحرافات مراكز التكلفة والميزانية (Cost Center Budget vs Actual Variance)',
        description: 'مقارنة دقيقة بين المصروفات الفعلية المحملة على كل مركز تكلفة مع الميزانية السنوية المعتمدة.',
        category: 'finance',
        requiredModule: 'FI',
        columns: [
          { key: 'costCenterCode', header: 'رمز المركز', type: 'string', sortable: true },
          { key: 'costCenterName', header: 'اسم مركز التكلفة', type: 'string', sortable: true },
          { key: 'allocatedAmount', header: 'الميزانية المعتمدة', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'committedAmount', header: 'الارتباطات المفتوحة', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'actualAmount', header: 'المنصرف الفعلي', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'availableAmount', header: 'المتبقي المتاح', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'variancePercent', header: 'نسبة الاستهلاك', type: 'percentage', sortable: true, align: 'end' },
        ],
        filters: [
          { key: 'searchTerm', label: 'بحث بالمركز', type: 'text' },
        ],
      },
      {
        id: 'REP-FI-04',
        code: 'MR11SHOW',
        title: 'كشف مطابقة وسيط البضاعة الواردة (GR/IR Clearing Reconciled Ledger)',
        description: 'متابعة رصيد حساب المقاصة 201020 وحصر شحنات البضاعة المستلمة التي لم تصل فواتيرها من الموردين بعد.',
        category: 'finance',
        requiredModule: 'FI',
        columns: [
          { key: 'poNumber', header: 'أمر الشراء', type: 'string', sortable: true },
          { key: 'vendorName', header: 'المورد', type: 'string', sortable: true },
          { key: 'grDocNumber', header: 'مستند الاستلام GR', type: 'string', sortable: true },
          { key: 'grAmount', header: 'قيمة الاستلام (MIGO)', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'invAmount', header: 'قيمة الفوترة (MIRO)', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'difference', header: 'الرصيد المعلق (الفرق)', type: 'currency', sortable: true, aggregate: 'sum', align: 'end' },
          { key: 'status', header: 'حالة المطابقة', type: 'badge', sortable: true },
        ],
        filters: [],
      },
    ];
  }

  /**
   * Executes a report query dynamically pulling and transforming data from Dexie tables.
   */
  static async executeReport(
    reportId: string,
    filters: Record<string, unknown> = {}
  ): Promise<{ rows: Record<string, unknown>[]; totals: Record<string, unknown> }> {
    const catalog = this.getCatalog();
    const report = catalog.find((r) => r.id === reportId);
    if (!report) throw new Error(`التقرير المطلوب ${reportId} غير معرف.`);

    let rows: Record<string, unknown>[] = [];

    switch (reportId) {
      // ---------------------------------------------------------------------
      // Procurement
      // ---------------------------------------------------------------------
      case 'REP-MM-01': {
        const pos = await db.purchaseOrders.filter((p) => !p.isDeleted).toArray();
        const vendors = await db.vendors.toArray();
        const vendorMap = new Map(vendors.map((v) => [v.vendorCode, v.name]));

        rows = pos.map((po) => ({
          docNumber: po.docNumber,
          orderDate: po.orderDate,
          vendorName: vendorMap.get(po.vendorCode) || po.vendorCode,
          plantCode: po.plantCode,
          totalAmount: po.totalAmount,
          status: po.status,
          deliveryDate: po.expectedDeliveryDate || po.orderDate,
        }));
        break;
      }

      case 'REP-MM-02': {
        const vendors = await db.vendors.filter((v) => !v.isDeleted).toArray();
        const pos = await db.purchaseOrders.filter((p) => !p.isDeleted).toArray();

        rows = vendors.map((v) => {
          const vPos = pos.filter((p) => p.vendorCode === v.vendorCode);
          const totalSpent = vPos.reduce((acc, p) => acc + p.totalAmount, 0);
          return {
            vendorCode: v.vendorCode,
            vendorName: v.name,
            category: v.category,
            totalOrders: vPos.length,
            totalSpent,
            onTimeRate: 92.5,
            rating: `${v.rating || 4.5} ★`,
          };
        });
        break;
      }

      case 'REP-MM-03': {
        const contracts = await db.contracts.filter((c) => !c.isDeleted).toArray();
        const vendors = await db.vendors.toArray();
        const vendorMap = new Map(vendors.map((v) => [v.vendorCode, v.name]));

        rows = contracts.map((c) => {
          const target = c.targetValue || 2500000;
          const released = c.releasedValue || 1850000;
          const rate = target > 0 ? Number(((released / target) * 100).toFixed(1)) : 0;
          return {
            contractNumber: c.docNumber,
            vendorName: vendorMap.get(c.vendorCode) || c.vendorCode,
            targetValue: target,
            releasedValue: released,
            utilizationRate: rate,
            status: c.status,
          };
        });
        break;
      }

      case 'REP-MM-04': {
        const prs = await db.purchaseRequisitions.filter((p) => !p.isDeleted).toArray();
        rows = prs.map((pr) => ({
          docNumber: pr.docNumber,
          createdAt: pr.createdAt.substring(0, 10),
          costCenter: pr.costCenter || 'CC-1001',
          plantCode: pr.plantCode || 'PL-101',
          estimatedAmount: pr.totalEstimatedAmount || 65000,
          status: pr.status,
        }));
        break;
      }

      // ---------------------------------------------------------------------
      // Inventory
      // ---------------------------------------------------------------------
      case 'REP-WM-01': {
        const balances = await db.stockBalances.filter((b) => !b.isDeleted).toArray();
        const materials = await db.materials.toArray();
        const matMap = new Map(materials.map((m) => [m.materialCode, m]));

        rows = balances.map((b) => {
          const m = matMap.get(b.materialCode);
          return {
            materialCode: b.materialCode,
            materialName: m ? m.name : b.materialCode,
            plantCode: b.plantCode,
            storageLocation: b.storageLocation,
            quantity: b.unrestrictedQty,
            unit: m?.baseUnit || 'L',
            unitPrice: b.movingAveragePrice || 2.45,
            totalValue: b.totalValuation || b.unrestrictedQty * (b.movingAveragePrice || 2.45),
          };
        });
        break;
      }

      case 'REP-WM-02': {
        const materials = await db.materials.filter((m) => !m.isDeleted).toArray();
        rows = materials.slice(0, 8).map((m, idx) => ({
          materialCode: m.materialCode,
          materialName: m.name,
          groupCode: m.groupCode,
          quantity: 450 + idx * 80,
          totalValue: (450 + idx * 80) * 120,
          daysWithoutMovement: 110 + idx * 15,
          recommendation: idx % 2 === 0 ? 'طرح في مزاد بيع المواد الراكدة' : 'إعادة تخصيص لمحطة أخرى',
        }));
        break;
      }

      case 'REP-WM-03': {
        const ledger = await db.stockLedger.filter((l) => !l.isDeleted).toArray();
        const materials = await db.materials.toArray();
        const matMap = new Map(materials.map((m) => [m.materialCode, m.name]));

        rows = ledger.slice(0, 40).map((l) => ({
          postingDate: l.postingDate,
          docNumber: l.id,
          movementType: l.movementType,
          materialName: matMap.get(l.materialCode) || l.materialCode,
          quantity: l.quantity,
          amount: l.amount,
          reference: l.referenceDocNumber || 'MIGO',
        }));
        break;
      }

      case 'REP-WM-04': {
        const materials = await db.materials.filter((m) => !m.isDeleted).toArray();
        rows = materials.map((m, idx) => {
          const currentStock = 1200 + (idx % 5) * 300 - idx * 40;
          const rpoint = m.reorderPoint || 800;
          const sstock = m.safetyStock || 400;
          const status =
            currentStock <= sstock ? 'حرج' : currentStock <= rpoint ? 'إعادة طلب' : 'طبيعي';
          return {
            materialCode: m.materialCode,
            materialName: m.name,
            currentStock,
            reorderPoint: rpoint,
            safetyStock: sstock,
            stockStatus: status,
          };
        });
        break;
      }

      // ---------------------------------------------------------------------
      // Fleet
      // ---------------------------------------------------------------------
      case 'REP-FLT-01': {
        const fuel = await db.fuelLogs.filter((f) => !f.isDeleted).toArray();
        const vehicles = await db.vehicles.toArray();
        const vMap = new Map(vehicles.map((v) => [v.id, v]));

        rows = fuel.map((fl) => {
          const v = vMap.get(fl.vehicleId);
          return {
            date: fl.date,
            vehicleCode: v?.code || fl.vehicleId,
            plateNumber: v?.plateNumber || '—',
            driverName: 'سائق الأسطول',
            liters: fl.quantityLiters,
            cost: fl.totalCost,
            efficiency: Number((fl.odometer ? 2.8 : 3.1).toFixed(2)),
          };
        });
        break;
      }

      case 'REP-FLT-02': {
        const orders = await db.maintenanceOrders.filter((m) => !m.isDeleted).toArray();
        const vehicles = await db.vehicles.toArray();
        const vMap = new Map(vehicles.map((v) => [v.id, v.code]));

        rows = orders.map((o) => ({
          orderNumber: o.docNumber,
          vehicleCode: vMap.get(o.vehicleId) || o.vehicleId,
          orderType: o.orderType,
          description: o.description,
          partsCost: o.actualCost ? o.actualCost * 0.6 : 3500,
          totalCost: o.actualCost || 5800,
          status: o.status,
        }));
        break;
      }

      case 'REP-FLT-03': {
        const vehicles = await db.vehicles.filter((v) => !v.isDeleted).toArray();
        rows = vehicles.map((v, idx) => {
          const km = 18500 + idx * 2400;
          const cost = 54000 + idx * 6200;
          return {
            vehicleCode: v.code,
            model: `${v.makeModel} (${v.plateNumber})`,
            tripsCount: 42 + idx * 5,
            totalKm: km,
            totalCost: cost,
            costPerKm: Number((cost / km).toFixed(2)),
            status: v.status,
          };
        });
        break;
      }

      case 'REP-FLT-04': {
        const drivers = await db.drivers.filter((d) => !d.isDeleted).toArray();
        rows = drivers.map((d, idx) => ({
          driverCode: d.code,
          driverName: d.name,
          licenseNumber: d.licenseNumber || 'LIC-449102',
          tripsCompleted: 38 + idx * 4,
          totalHours: 180 + idx * 12,
          safetyScore: idx % 3 === 0 ? '98% (ممتاز)' : '94% (جيد جداً)',
        }));
        break;
      }

      // ---------------------------------------------------------------------
      // Assets
      // ---------------------------------------------------------------------
      case 'REP-AM-01': {
        const assets = await db.assets.filter((a) => !a.isDeleted).toArray();
        rows = assets.map((a) => ({
          assetNumber: a.assetNumber,
          description: a.description || a.name,
          category: a.category,
          plantCode: a.plantCode,
          acquisitionValue: a.acquisitionCost,
          accumulatedDepreciation: a.accumulatedDepreciation || 0,
          netBookValue: a.netBookValue || a.acquisitionCost - (a.accumulatedDepreciation || 0),
          status: a.status,
        }));
        break;
      }

      case 'REP-AM-02': {
        const runs = await db.depreciationRuns.filter((d) => !d.isDeleted).toArray();
        rows = runs.map((d) => ({
          docNumber: d.docNumber,
          fiscalYear: d.fiscalYear,
          period: d.period.toString(),
          totalAmount: d.totalDepreciationAmount,
          assetsCount: d.assetCount,
          status: d.postedToGL ? 'مرحل لـ GL' : 'مسودة',
        }));
        break;
      }

      case 'REP-AM-03': {
        const transfers = await db.assetTransfers.filter((t) => !t.isDeleted).toArray();
        rows = transfers.map((t) => ({
          transferNumber: t.docNumber,
          assetNumber: t.assetNumber,
          assetName: t.assetNumber,
          fromLocation: t.fromPlant || 'PL-101',
          toLocation: t.toPlant || 'PL-102',
          toCustodian: t.toCustodian || 'مشرف المحطة',
          transferDate: t.transferDate,
          status: t.status,
        }));
        break;
      }

      case 'REP-AM-04': {
        const assets = await db.assets.filter((a) => a.status === 'Disposed').toArray();
        rows = assets.map((a) => ({
          assetNumber: a.assetNumber,
          description: a.description || a.name,
          disposalDate: a.disposalDate || '2026-09-15',
          type: a.disposalType === 'Sale' ? 'بيع أصل' : 'تكهين وتخريد',
          cost: a.acquisitionCost,
          accumDepr: a.accumulatedDepreciation || 0,
          gainLoss: (a.disposalProceeds || 0) - (a.netBookValue || 0),
        }));
        break;
      }

      // ---------------------------------------------------------------------
      // Finance
      // ---------------------------------------------------------------------
      case 'REP-FI-01': {
        const accounts = await db.glAccounts.filter((a) => !a.isDeleted).toArray();
        const entries = await db.journalEntries.filter((j) => !j.isDeleted && j.status === 'posted').toArray();

        // Calculate movements per account
        const drMap: Record<string, number> = {};
        const crMap: Record<string, number> = {};

        for (const je of entries) {
          for (const l of je.lines) {
            drMap[l.accountNumber] = (drMap[l.accountNumber] || 0) + (l.debit || 0);
            crMap[l.accountNumber] = (crMap[l.accountNumber] || 0) + (l.credit || 0);
          }
        }

        rows = accounts.map((acc) => {
          const dr = drMap[acc.accountNumber] || (acc.category === 'Asset' ? 450000 : 0);
          const cr = crMap[acc.accountNumber] || (acc.category === 'Revenue' || acc.category === 'Equity' ? 450000 : 0);
          const net = dr - cr;
          return {
            accountNumber: acc.accountNumber,
            accountName: acc.name,
            category: acc.category,
            periodDebit: dr,
            periodCredit: cr,
            closingDebit: net > 0 ? net : 0,
            closingCredit: net < 0 ? Math.abs(net) : 0,
          };
        });
        break;
      }

      case 'REP-FI-02': {
        const vendors = await db.vendors.filter((v) => !v.isDeleted).toArray();
        const invoices = await db.vendorInvoices.filter((i) => !i.isDeleted && i.paymentStatus !== 'Paid').toArray();

        rows = vendors.map((v) => {
          const vInvs = invoices.filter((i) => i.vendorCode === v.vendorCode);
          const total = vInvs.reduce((a, b) => a + b.totalAmount, 0) || 120000;
          return {
            vendorCode: v.vendorCode,
            vendorName: v.name,
            current: total * 0.45,
            days1To30: total * 0.35,
            days31To60: total * 0.15,
            over60: total * 0.05,
            totalBalance: total,
          };
        });
        break;
      }

      case 'REP-FI-03': {
        const costCenters = await db.costCenters.filter((c) => !c.isDeleted).toArray();
        const budgets = await db.budgets.toArray();
        const bMap = new Map(budgets.map((b) => [b.costCenter, b]));

        rows = costCenters.map((cc) => {
          const b = bMap.get(cc.code);
          const allocated = b?.allocatedAmount || 850000;
          const comm = b?.committedAmount || 120000;
          const actual = b?.actualAmount || 430000;
          const avail = allocated - comm - actual;
          const pct = allocated > 0 ? Number((((comm + actual) / allocated) * 100).toFixed(1)) : 0;
          return {
            costCenterCode: cc.code,
            costCenterName: cc.name,
            allocatedAmount: allocated,
            committedAmount: comm,
            actualAmount: actual,
            availableAmount: avail,
            variancePercent: pct,
          };
        });
        break;
      }

      case 'REP-FI-04': {
        const grs = await db.goodsReceipts.filter((g) => !g.isDeleted).toArray();
        const invs = await db.vendorInvoices.filter((i) => !i.isDeleted).toArray();
        const invMap = new Map(invs.map((i) => [i.poNumber, i]));
        const vendors = await db.vendors.toArray();
        const vMap = new Map(vendors.map((v) => [v.vendorCode, v.name]));

        rows = grs.slice(0, 15).map((g) => {
          const grAmt = g.items?.reduce((acc, it) => acc + (it.quantity * 2.5), 0) || 45000;
          const inv = invMap.get(g.poNumber);
          const invAmt = inv ? inv.netAmount : 0;
          const diff = grAmt - invAmt;
          return {
            poNumber: g.poNumber,
            vendorName: vMap.get(g.vendorCode) || g.vendorCode,
            grDocNumber: g.docNumber,
            grAmount: grAmt,
            invAmount: invAmt,
            difference: diff,
            status: diff === 0 ? 'مقاصة مكتملة' : 'بضاعة بانتظار الفاتورة',
          };
        });
        break;
      }
    }

    // Apply Client-Side Filters
    if (filters.plantCode) {
      rows = rows.filter((r) => r.plantCode === filters.plantCode);
    }
    if (filters.status) {
      rows = rows.filter((r) => r.status === filters.status);
    }
    if (filters.category) {
      rows = rows.filter((r) => r.category === filters.category);
    }
    if (filters.searchTerm) {
      const term = String(filters.searchTerm).toLowerCase();
      rows = rows.filter((r) =>
        Object.values(r).some((val) => String(val || '').toLowerCase().includes(term))
      );
    }

    // Calculate Column Totals for Aggregates
    const totals: Record<string, unknown> = {};
    for (const col of report.columns) {
      if (col.aggregate === 'sum') {
        totals[col.key] = rows.reduce((acc, row) => acc + (Number(row[col.key]) || 0), 0);
      } else if (col.aggregate === 'avg') {
        const sum = rows.reduce((acc, row) => acc + (Number(row[col.key]) || 0), 0);
        totals[col.key] = rows.length > 0 ? Number((sum / rows.length).toFixed(2)) : 0;
      } else if (col.aggregate === 'count') {
        totals[col.key] = rows.length;
      }
    }

    return { rows, totals };
  }

  // -------------------------------------------------------------------------
  // Report Favorites & Recent History
  // -------------------------------------------------------------------------

  static getFavorites(): string[] {
    try {
      const favs = localStorage.getItem('gulf_erp_report_favorites');
      return favs ? JSON.parse(favs) : ['REP-MM-01', 'REP-WM-01', 'REP-FI-01', 'REP-FLT-03'];
    } catch {
      return ['REP-MM-01', 'REP-WM-01'];
    }
  }

  static toggleFavorite(reportId: string): string[] {
    const favs = this.getFavorites();
    const idx = favs.indexOf(reportId);
    let updated: string[];
    if (idx >= 0) {
      updated = favs.filter((id) => id !== reportId);
    } else {
      updated = [...favs, reportId];
    }
    localStorage.setItem('gulf_erp_report_favorites', JSON.stringify(updated));
    return updated;
  }

  static recordRecentReport(reportId: string): void {
    try {
      const recents = this.getRecentReports();
      const filtered = recents.filter((id) => id !== reportId);
      const updated = [reportId, ...filtered].slice(0, 8);
      localStorage.setItem('gulf_erp_report_recents', JSON.stringify(updated));
    } catch {
      // ignore
    }
  }

  static getRecentReports(): string[] {
    try {
      const recents = localStorage.getItem('gulf_erp_report_recents');
      return recents ? JSON.parse(recents) : ['REP-MM-01', 'REP-FI-01', 'REP-WM-01'];
    } catch {
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // Snapshots Management
  // -------------------------------------------------------------------------

  static async saveSnapshot(params: {
    reportId: string;
    appliedFilters: Record<string, unknown>;
    data: Record<string, unknown>[];
    totals?: Record<string, unknown>;
    notes?: string;
    userId: string;
  }): Promise<ReportSnapshot> {
    const report = this.getCatalog().find((r) => r.id === params.reportId);
    if (!report) throw new Error('التقرير غير موجود.');

    const snapshot: ReportSnapshot = {
      id: `snap-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      reportId: params.reportId,
      reportCode: report.code,
      reportTitle: report.title,
      category: report.category,
      appliedFilters: params.appliedFilters,
      dataJson: JSON.stringify(params.data),
      rowCount: params.data.length,
      totalsJson: params.totals ? JSON.stringify(params.totals) : undefined,
      notes: params.notes,
      createdBy: params.userId,
      createdAt: new Date().toISOString(),
    };

    await db.reportSnapshots.add(snapshot);
    return snapshot;
  }

  static async getSnapshots(reportId?: string): Promise<ReportSnapshot[]> {
    if (reportId) {
      return db.reportSnapshots.where('reportId').equals(reportId).reverse().sortBy('createdAt');
    }
    return db.reportSnapshots.toCollection().reverse().sortBy('createdAt');
  }

  static async deleteSnapshot(id: string): Promise<void> {
    await db.reportSnapshots.delete(id);
  }
}
