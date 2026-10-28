-- ============================================================================
-- Migration: 0013_roles_sync.sql
-- Description: Deterministic synchronization of system roles and permissions
--              Generated automatically by scripts/generate-roles-sql.ts
-- Database: PostgreSQL 15+ (Supabase / Self-Hosted)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Idempotent Upsert of System Roles
-- ----------------------------------------------------------------------------
INSERT INTO public.roles (code, name, description, is_system) VALUES
('ADMIN', 'مدير النظام (System Administrator)', 'كامل الصلاحيات الفنية والتشغيلية لكافة الوحدات والتهيئة العامة', true),
('FLEET_MANAGER', 'مدير الأسطول واللوجستيات (Fleet & Logistics Manager)', 'إدارة أسطول صهاريج نقل الوقود ومتابعة الصيانة والسائقين وحركات الصرف 261', true),
('WAREHOUSE_CLERK', 'أمين مستودع (Warehouse Clerk)', 'استلام المواد MIGO، صرف المواد، والجرد الفعلي بالمحطات', true),
('PROCUREMENT_MANAGER', 'مدير المشتريات (Procurement Manager)', 'إدارة عقود التوريد واعتماد أوامر الشراء حتى 112.5 مليون ل.س', true),
('PROCUREMENT_OFFICER', 'موظف مشتريات (Procurement Officer)', 'إنشاء طلبات عروض الأسعار وإصدار أوامر الشراء المبدئية', true),
('ACCOUNTANT', 'محاسب مالي (Financial Accountant)', 'تسجيل القيود اليومية وفواتير الموردين والذمم الدائنة والمدينة', true),
('FINANCE_MANAGER', 'مدير مالي (Finance Director)', 'الرقابة المالية والميزانيات واعتماد الفواتير والمدفوعات والإقفال الدوري', true),
('AUDITOR', 'مدقق داخلي (Internal Auditor)', 'فحص سجلات التدقيق والحركات المحاسبية والمخزنية دون تعديل', true),
('ASSET_MANAGER', 'مدير الأصول (Asset Manager)', 'سجل الأصول الرأسمالية ومحطات الضخ والصيانة الدورية والاستبعاد', true),
('VIEWER', 'مستعرض فقط (Read-Only Viewer)', 'استعراض البيانات الأساسية والشاشات دون إمكانية التعديل', true)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_system = EXCLUDED.is_system;

-- ----------------------------------------------------------------------------
-- 2. Idempotent Upsert of Role Permissions
-- ----------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_code, module, activity, plant_limit, cost_center_limit, amount_limit) VALUES
('ADMIN', '*', '*', NULL, NULL, NULL),
('FLEET_MANAGER', 'TM', 'view', NULL, NULL, NULL),
('FLEET_MANAGER', 'TM', 'create', NULL, NULL, NULL),
('FLEET_MANAGER', 'TM', 'change', NULL, NULL, NULL),
('FLEET_MANAGER', 'TM', 'post', NULL, NULL, NULL),
('FLEET_MANAGER', 'WM', 'view', NULL, NULL, NULL),
('FLEET_MANAGER', 'WM', 'post', NULL, NULL, NULL),
('FLEET_MANAGER', 'MD', 'view', NULL, NULL, NULL),
('WAREHOUSE_CLERK', 'WM', 'view', NULL, NULL, NULL),
('WAREHOUSE_CLERK', 'WM', 'post', NULL, NULL, NULL),
('WAREHOUSE_CLERK', 'MM', 'view', NULL, NULL, NULL),
('WAREHOUSE_CLERK', 'MD', 'view', NULL, NULL, NULL),
('PROCUREMENT_MANAGER', 'MM', 'view', NULL, NULL, NULL),
('PROCUREMENT_MANAGER', 'MM', 'create', NULL, NULL, 112500000.00),
('PROCUREMENT_MANAGER', 'MM', 'change', NULL, NULL, 112500000.00),
('PROCUREMENT_MANAGER', 'MM', 'approve', NULL, NULL, 112500000.00),
('PROCUREMENT_MANAGER', 'MD', 'view', NULL, NULL, NULL),
('PROCUREMENT_MANAGER', 'FI', 'view', NULL, NULL, NULL),
('PROCUREMENT_OFFICER', 'MM', 'view', NULL, NULL, NULL),
('PROCUREMENT_OFFICER', 'MM', 'create', NULL, NULL, 22500000.00),
('PROCUREMENT_OFFICER', 'MM', 'change', NULL, NULL, 22500000.00),
('PROCUREMENT_OFFICER', 'MD', 'view', NULL, NULL, NULL),
('ACCOUNTANT', 'FI', 'view', NULL, NULL, NULL),
('ACCOUNTANT', 'FI', 'post', NULL, NULL, 45000000.00),
('ACCOUNTANT', 'MM', 'view', NULL, NULL, NULL),
('ACCOUNTANT', 'WM', 'view', NULL, NULL, NULL),
('ACCOUNTANT', 'MD', 'view', NULL, NULL, NULL),
('FINANCE_MANAGER', 'FI', 'view', NULL, NULL, NULL),
('FINANCE_MANAGER', 'FI', 'post', NULL, NULL, NULL),
('FINANCE_MANAGER', 'FI', 'approve', NULL, NULL, NULL),
('FINANCE_MANAGER', 'FI', 'reverse', NULL, NULL, NULL),
('FINANCE_MANAGER', 'MM', 'view', NULL, NULL, NULL),
('FINANCE_MANAGER', 'MM', 'approve', NULL, NULL, NULL),
('FINANCE_MANAGER', 'MD', 'view', NULL, NULL, NULL),
('AUDITOR', 'MM', 'view', NULL, NULL, NULL),
('AUDITOR', 'WM', 'view', NULL, NULL, NULL),
('AUDITOR', 'FI', 'view', NULL, NULL, NULL),
('AUDITOR', 'TM', 'view', NULL, NULL, NULL),
('AUDITOR', 'AM', 'view', NULL, NULL, NULL),
('AUDITOR', 'MD', 'view', NULL, NULL, NULL),
('AUDITOR', 'ADM', 'view', NULL, NULL, NULL),
('ASSET_MANAGER', 'AM', 'view', NULL, NULL, NULL),
('ASSET_MANAGER', 'AM', 'create', NULL, NULL, NULL),
('ASSET_MANAGER', 'AM', 'post', NULL, NULL, 225000000.00),
('ASSET_MANAGER', 'MD', 'view', NULL, NULL, NULL),
('VIEWER', 'MM', 'view', NULL, NULL, NULL),
('VIEWER', 'WM', 'view', NULL, NULL, NULL),
('VIEWER', 'TM', 'view', NULL, NULL, NULL),
('VIEWER', 'AM', 'view', NULL, NULL, NULL),
('VIEWER', 'FI', 'view', NULL, NULL, NULL),
('VIEWER', 'MD', 'view', NULL, NULL, NULL)
ON CONFLICT (role_code, module, activity) DO UPDATE SET
    plant_limit = EXCLUDED.plant_limit,
    cost_center_limit = EXCLUDED.cost_center_limit,
    amount_limit = EXCLUDED.amount_limit;

-- ----------------------------------------------------------------------------
-- 3. Cleanup: Remove Stale Permissions for Managed System Roles
-- ----------------------------------------------------------------------------
DELETE FROM public.role_permissions
WHERE role_code IN ('ADMIN', 'FLEET_MANAGER', 'WAREHOUSE_CLERK', 'PROCUREMENT_MANAGER', 'PROCUREMENT_OFFICER', 'ACCOUNTANT', 'FINANCE_MANAGER', 'AUDITOR', 'ASSET_MANAGER', 'VIEWER')
  AND NOT (
      (role_code = 'ADMIN' AND module = '*' AND activity = '*')
      OR (role_code = 'FLEET_MANAGER' AND module = 'TM' AND activity = 'view')
      OR (role_code = 'FLEET_MANAGER' AND module = 'TM' AND activity = 'create')
      OR (role_code = 'FLEET_MANAGER' AND module = 'TM' AND activity = 'change')
      OR (role_code = 'FLEET_MANAGER' AND module = 'TM' AND activity = 'post')
      OR (role_code = 'FLEET_MANAGER' AND module = 'WM' AND activity = 'view')
      OR (role_code = 'FLEET_MANAGER' AND module = 'WM' AND activity = 'post')
      OR (role_code = 'FLEET_MANAGER' AND module = 'MD' AND activity = 'view')
      OR (role_code = 'WAREHOUSE_CLERK' AND module = 'WM' AND activity = 'view')
      OR (role_code = 'WAREHOUSE_CLERK' AND module = 'WM' AND activity = 'post')
      OR (role_code = 'WAREHOUSE_CLERK' AND module = 'MM' AND activity = 'view')
      OR (role_code = 'WAREHOUSE_CLERK' AND module = 'MD' AND activity = 'view')
      OR (role_code = 'PROCUREMENT_MANAGER' AND module = 'MM' AND activity = 'view')
      OR (role_code = 'PROCUREMENT_MANAGER' AND module = 'MM' AND activity = 'create')
      OR (role_code = 'PROCUREMENT_MANAGER' AND module = 'MM' AND activity = 'change')
      OR (role_code = 'PROCUREMENT_MANAGER' AND module = 'MM' AND activity = 'approve')
      OR (role_code = 'PROCUREMENT_MANAGER' AND module = 'MD' AND activity = 'view')
      OR (role_code = 'PROCUREMENT_MANAGER' AND module = 'FI' AND activity = 'view')
      OR (role_code = 'PROCUREMENT_OFFICER' AND module = 'MM' AND activity = 'view')
      OR (role_code = 'PROCUREMENT_OFFICER' AND module = 'MM' AND activity = 'create')
      OR (role_code = 'PROCUREMENT_OFFICER' AND module = 'MM' AND activity = 'change')
      OR (role_code = 'PROCUREMENT_OFFICER' AND module = 'MD' AND activity = 'view')
      OR (role_code = 'ACCOUNTANT' AND module = 'FI' AND activity = 'view')
      OR (role_code = 'ACCOUNTANT' AND module = 'FI' AND activity = 'post')
      OR (role_code = 'ACCOUNTANT' AND module = 'MM' AND activity = 'view')
      OR (role_code = 'ACCOUNTANT' AND module = 'WM' AND activity = 'view')
      OR (role_code = 'ACCOUNTANT' AND module = 'MD' AND activity = 'view')
      OR (role_code = 'FINANCE_MANAGER' AND module = 'FI' AND activity = 'view')
      OR (role_code = 'FINANCE_MANAGER' AND module = 'FI' AND activity = 'post')
      OR (role_code = 'FINANCE_MANAGER' AND module = 'FI' AND activity = 'approve')
      OR (role_code = 'FINANCE_MANAGER' AND module = 'FI' AND activity = 'reverse')
      OR (role_code = 'FINANCE_MANAGER' AND module = 'MM' AND activity = 'view')
      OR (role_code = 'FINANCE_MANAGER' AND module = 'MM' AND activity = 'approve')
      OR (role_code = 'FINANCE_MANAGER' AND module = 'MD' AND activity = 'view')
      OR (role_code = 'AUDITOR' AND module = 'MM' AND activity = 'view')
      OR (role_code = 'AUDITOR' AND module = 'WM' AND activity = 'view')
      OR (role_code = 'AUDITOR' AND module = 'FI' AND activity = 'view')
      OR (role_code = 'AUDITOR' AND module = 'TM' AND activity = 'view')
      OR (role_code = 'AUDITOR' AND module = 'AM' AND activity = 'view')
      OR (role_code = 'AUDITOR' AND module = 'MD' AND activity = 'view')
      OR (role_code = 'AUDITOR' AND module = 'ADM' AND activity = 'view')
      OR (role_code = 'ASSET_MANAGER' AND module = 'AM' AND activity = 'view')
      OR (role_code = 'ASSET_MANAGER' AND module = 'AM' AND activity = 'create')
      OR (role_code = 'ASSET_MANAGER' AND module = 'AM' AND activity = 'post')
      OR (role_code = 'ASSET_MANAGER' AND module = 'MD' AND activity = 'view')
      OR (role_code = 'VIEWER' AND module = 'MM' AND activity = 'view')
      OR (role_code = 'VIEWER' AND module = 'WM' AND activity = 'view')
      OR (role_code = 'VIEWER' AND module = 'TM' AND activity = 'view')
      OR (role_code = 'VIEWER' AND module = 'AM' AND activity = 'view')
      OR (role_code = 'VIEWER' AND module = 'FI' AND activity = 'view')
      OR (role_code = 'VIEWER' AND module = 'MD' AND activity = 'view')
  );
