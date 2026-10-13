import { SYSTEM_ROLES } from '../services/RbacService';

export interface RoleCatalogPermission {
  module: string;
  activity: string;
  amountLimit?: number;
  plantLimit?: string[];
  costCenterLimit?: string[];
}

export interface RoleCatalogEntry {
  code: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: RoleCatalogPermission[];
}

export const SYSTEM_ROLE_DEFINITIONS: Record<string, RoleCatalogEntry> = {
  [SYSTEM_ROLES.ADMIN]: {
    code: SYSTEM_ROLES.ADMIN,
    name: 'مدير النظام (System Administrator)',
    description: 'كامل الصلاحيات الفنية والتشغيلية لكافة الوحدات والتهيئة العامة',
    isSystem: true,
    permissions: [{ module: '*', activity: '*' }],
  },
  [SYSTEM_ROLES.FLEET_MANAGER]: {
    code: SYSTEM_ROLES.FLEET_MANAGER,
    name: 'مدير الأسطول واللوجستيات (Fleet & Logistics Manager)',
    description: 'إدارة أسطول صهاريج نقل الوقود ومتابعة الصيانة والسائقين وحركات الصرف 261',
    isSystem: true,
    permissions: [
      { module: 'TM', activity: 'view' },
      { module: 'TM', activity: 'create' },
      { module: 'TM', activity: 'change' },
      { module: 'TM', activity: 'post' },
      { module: 'WM', activity: 'view' },
      { module: 'WM', activity: 'post' },
      { module: 'MD', activity: 'view' },
    ],
  },
  [SYSTEM_ROLES.WAREHOUSE_CLERK]: {
    code: SYSTEM_ROLES.WAREHOUSE_CLERK,
    name: 'أمين مستودع (Warehouse Clerk)',
    description: 'استلام المواد MIGO، صرف المواد، والجرد الفعلي بالمحطات',
    isSystem: true,
    permissions: [
      { module: 'WM', activity: 'view' },
      { module: 'WM', activity: 'post' },
      { module: 'MM', activity: 'view' },
      { module: 'MD', activity: 'view' },
    ],
  },
  [SYSTEM_ROLES.PROCUREMENT_MANAGER]: {
    code: SYSTEM_ROLES.PROCUREMENT_MANAGER,
    name: 'مدير المشتريات (Procurement Manager)',
    description: 'إدارة عقود التوريد واعتماد أوامر الشراء حتى 250 ألف ر.س',
    isSystem: true,
    permissions: [
      { module: 'MM', activity: 'view' },
      { module: 'MM', activity: 'create', amountLimit: 250000.0 },
      { module: 'MM', activity: 'change', amountLimit: 250000.0 },
      { module: 'MM', activity: 'approve', amountLimit: 250000.0 },
      { module: 'MD', activity: 'view' },
      { module: 'FI', activity: 'view' },
    ],
  },
  [SYSTEM_ROLES.PROCUREMENT_OFFICER]: {
    code: SYSTEM_ROLES.PROCUREMENT_OFFICER,
    name: 'موظف مشتريات (Procurement Officer)',
    description: 'إنشاء طلبات عروض الأسعار وإصدار أوامر الشراء المبدئية',
    isSystem: true,
    permissions: [
      { module: 'MM', activity: 'view' },
      { module: 'MM', activity: 'create', amountLimit: 50000.0 },
      { module: 'MM', activity: 'change', amountLimit: 50000.0 },
      { module: 'MD', activity: 'view' },
    ],
  },
  [SYSTEM_ROLES.ACCOUNTANT]: {
    code: SYSTEM_ROLES.ACCOUNTANT,
    name: 'محاسب مالي (Financial Accountant)',
    description: 'تسجيل القيود اليومية وفواتير الموردين والذمم الدائنة والمدينة',
    isSystem: true,
    permissions: [
      { module: 'FI', activity: 'view' },
      { module: 'FI', activity: 'post', amountLimit: 100000.0 },
      { module: 'MM', activity: 'view' },
      { module: 'WM', activity: 'view' },
      { module: 'MD', activity: 'view' },
    ],
  },
  [SYSTEM_ROLES.FINANCE_MANAGER]: {
    code: SYSTEM_ROLES.FINANCE_MANAGER,
    name: 'مدير مالي (Finance Director)',
    description: 'الرقابة المالية والميزانيات واعتماد الفواتير والمدفوعات والإقفال الدوري',
    isSystem: true,
    permissions: [
      { module: 'FI', activity: 'view' },
      { module: 'FI', activity: 'post' },
      { module: 'FI', activity: 'approve' },
      { module: 'FI', activity: 'reverse' },
      { module: 'MM', activity: 'view' },
      { module: 'MM', activity: 'approve' },
      { module: 'MD', activity: 'view' },
    ],
  },
  [SYSTEM_ROLES.AUDITOR]: {
    code: SYSTEM_ROLES.AUDITOR,
    name: 'مدقق داخلي (Internal Auditor)',
    description: 'فحص سجلات التدقيق والحركات المحاسبية والمخزنية دون تعديل',
    isSystem: true,
    permissions: [
      { module: 'MM', activity: 'view' },
      { module: 'WM', activity: 'view' },
      { module: 'FI', activity: 'view' },
      { module: 'TM', activity: 'view' },
      { module: 'AM', activity: 'view' },
      { module: 'MD', activity: 'view' },
      { module: 'ADM', activity: 'view' },
    ],
  },
  [SYSTEM_ROLES.ASSET_MANAGER]: {
    code: SYSTEM_ROLES.ASSET_MANAGER,
    name: 'مدير الأصول (Asset Manager)',
    description: 'سجل الأصول الرأسمالية ومحطات الضخ والصيانة الدورية والاستبعاد',
    isSystem: true,
    permissions: [
      { module: 'AM', activity: 'view' },
      { module: 'AM', activity: 'create' },
      { module: 'AM', activity: 'post', amountLimit: 500000.0 },
      { module: 'MD', activity: 'view' },
    ],
  },
  [SYSTEM_ROLES.VIEWER]: {
    code: SYSTEM_ROLES.VIEWER,
    name: 'مستعرض فقط (Read-Only Viewer)',
    description: 'استعراض البيانات الأساسية والشاشات دون إمكانية التعديل',
    isSystem: true,
    permissions: [
      { module: 'MM', activity: 'view' },
      { module: 'WM', activity: 'view' },
      { module: 'TM', activity: 'view' },
      { module: 'AM', activity: 'view' },
      { module: 'FI', activity: 'view' },
      { module: 'MD', activity: 'view' },
    ],
  },
};
