-- ============================================================================
-- Migration: 0001_core.sql
-- Description: Core extensions, profiles, roles, and authorization functions
-- Database: PostgreSQL 15+ (Supabase / Self-Hosted)
-- ============================================================================

-- 1. Essential Cryptographic & UUID Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. System Roles Table
CREATE TABLE IF NOT EXISTS public.roles (
    code text PRIMARY KEY,
    name text NOT NULL,
    description text,
    is_system boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Role Permissions Table (Authorization Objects: Module + Activity + Limits)
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_code text NOT NULL REFERENCES public.roles(code) ON DELETE CASCADE,
    module text NOT NULL,           -- 'MM', 'WM', 'TM', 'FI', 'CO', 'AM', 'MD', 'ADM', '*'
    activity text NOT NULL,         -- 'view', 'create', 'change', 'post', 'approve', 'reverse', 'delete', '*'
    plant_limit text[],             -- Optional array of permitted plants (e.g. ARRAY['1100', '1200'])
    cost_center_limit text[],       -- Optional array of permitted cost centers
    amount_limit numeric(18,2),     -- Optional financial threshold (SAR)
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_role_module_activity UNIQUE(role_code, module, activity)
);

-- 4. User Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username text NOT NULL UNIQUE,
    full_name text NOT NULL,
    role_code text NOT NULL REFERENCES public.roles(code) ON DELETE RESTRICT,
    plant_codes text[] NOT NULL DEFAULT '{}',
    is_active boolean NOT NULL DEFAULT true,
    must_change_password boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for high-speed profile authentication lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role_code);

-- 5. Seed System Roles (Al-Khobar, Yanbu, Jubail Corporate Roles)
INSERT INTO public.roles (code, name, description, is_system) VALUES
('ADMIN', 'مدير النظام (System Administrator)', 'كامل الصلاحيات الفنية والتشغيلية لكافة الوحدات والتهيئة العامة', true),
('PROCUREMENT_MANAGER', 'مدير المشتريات (Procurement Manager)', 'إدارة عقود التوريد واعتماد أوامر الشراء حتى 250 ألف ر.س', true),
('PROCUREMENT_OFFICER', 'موظف مشتريات (Procurement Officer)', 'إنشاء طلبات عروض الأسعار وإصدار أوامر الشراء المبدئية', true),
('WAREHOUSE_CLERK', 'أمين مستودع (Warehouse Clerk)', 'استلام المواد MIGO، صرف المواد، والجرد الفعلي بالمحطات', true),
('FLEET_MANAGER', 'مدير الأسطول واللوجستيات (Fleet & Logistics Manager)', 'إدارة أسطول صهاريج نقل الوقود ومتابعة الصيانة والسائقين وحركات الصرف 261', true),
('ACCOUNTANT', 'محاسب مالي (Financial Accountant)', 'تسجيل القيود اليومية وفواتير الموردين والذمم الدائنة والمدينة', true),
('FINANCE_MANAGER', 'مدير مالي (Finance Director)', 'الرقابة المالية والميزانيات واعتماد الفواتير والمدفوعات والإقفال الدوري', true),
('AUDITOR', 'مدقق داخلي (Internal Auditor)', 'فحص سجلات التدقيق والحركات المحاسبية والمخزنية دون تعديل', true),
('ASSET_MANAGER', 'مدير الأصول (Asset Manager)', 'سجل الأصول الرأسمالية ومحطات الضخ والصيانة الدورية والاستبعاد', true),
('VIEWER', 'مستعرض فقط (Read-Only Viewer)', 'استعراض البيانات الأساسية والشاشات دون إمكانية التعديل', true)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- 6. Seed Authorization Objects (Permissions for each role)
INSERT INTO public.role_permissions (role_code, module, activity, amount_limit) VALUES
-- Admin (Superuser)
('ADMIN', '*', '*', NULL),

-- Fleet Manager (TM + Part Issue WM + MD)
('FLEET_MANAGER', 'TM', 'view', NULL),
('FLEET_MANAGER', 'TM', 'create', NULL),
('FLEET_MANAGER', 'TM', 'change', NULL),
('FLEET_MANAGER', 'TM', 'post', NULL),
('FLEET_MANAGER', 'WM', 'view', NULL),
('FLEET_MANAGER', 'WM', 'post', NULL), -- Required for Movement 261 spare parts issue
('FLEET_MANAGER', 'MD', 'view', NULL),

-- Warehouse Clerk (WM + MM + MD)
('WAREHOUSE_CLERK', 'WM', 'view', NULL),
('WAREHOUSE_CLERK', 'WM', 'post', NULL),
('WAREHOUSE_CLERK', 'MM', 'view', NULL),
('WAREHOUSE_CLERK', 'MD', 'view', NULL),

-- Procurement Manager (MM + MD + FI View)
('PROCUREMENT_MANAGER', 'MM', 'view', NULL),
('PROCUREMENT_MANAGER', 'MM', 'create', 250000.00),
('PROCUREMENT_MANAGER', 'MM', 'change', 250000.00),
('PROCUREMENT_MANAGER', 'MM', 'approve', 250000.00),
('PROCUREMENT_MANAGER', 'MD', 'view', NULL),
('PROCUREMENT_MANAGER', 'FI', 'view', NULL),

-- Procurement Officer (MM + MD)
('PROCUREMENT_OFFICER', 'MM', 'view', NULL),
('PROCUREMENT_OFFICER', 'MM', 'create', 50000.00),
('PROCUREMENT_OFFICER', 'MM', 'change', 50000.00),
('PROCUREMENT_OFFICER', 'MD', 'view', NULL),

-- Accountant (FI + MM + WM + MD)
('ACCOUNTANT', 'FI', 'view', NULL),
('ACCOUNTANT', 'FI', 'post', 100000.00),
('ACCOUNTANT', 'MM', 'view', NULL),
('ACCOUNTANT', 'WM', 'view', NULL),
('ACCOUNTANT', 'MD', 'view', NULL),

-- Finance Director (FI + MM Approve + MD)
('FINANCE_MANAGER', 'FI', 'view', NULL),
('FINANCE_MANAGER', 'FI', 'post', NULL),
('FINANCE_MANAGER', 'FI', 'approve', NULL),
('FINANCE_MANAGER', 'FI', 'reverse', NULL),
('FINANCE_MANAGER', 'MM', 'view', NULL),
('FINANCE_MANAGER', 'MM', 'approve', NULL),
('FINANCE_MANAGER', 'MD', 'view', NULL),

-- Auditor (Read-only across all modules)
('AUDITOR', 'MM', 'view', NULL),
('AUDITOR', 'WM', 'view', NULL),
('AUDITOR', 'FI', 'view', NULL),
('AUDITOR', 'TM', 'view', NULL),
('AUDITOR', 'AM', 'view', NULL),
('AUDITOR', 'MD', 'view', NULL),
('AUDITOR', 'ADM', 'view', NULL),

-- Asset Manager (AM + MD)
('ASSET_MANAGER', 'AM', 'view', NULL),
('ASSET_MANAGER', 'AM', 'create', NULL),
('ASSET_MANAGER', 'AM', 'post', 500000.00),
('ASSET_MANAGER', 'MD', 'view', NULL),

-- Viewer (Read-only view)
('VIEWER', 'MM', 'view', NULL),
('VIEWER', 'WM', 'view', NULL),
('VIEWER', 'TM', 'view', NULL),
('VIEWER', 'AM', 'view', NULL),
('VIEWER', 'FI', 'view', NULL),
('VIEWER', 'MD', 'view', NULL)
ON CONFLICT (role_code, module, activity) DO NOTHING;

-- 7. Security Definer Permission Function
-- Strictly reads profiles & role_permissions for auth.uid() under a locked search_path
CREATE OR REPLACE FUNCTION public.has_permission(
    p_module text,
    p_activity text,
    p_plant text DEFAULT NULL,
    p_amount numeric(18,2) DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_user_id uuid;
    v_role_code text;
    v_is_active boolean;
    v_user_plants text[];
    v_has_perm boolean := false;
BEGIN
    -- 1. Extract authenticated actor
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN false;
    END IF;

    -- 2. Lookup user profile
    SELECT role_code, is_active, plant_codes
    INTO v_role_code, v_is_active, v_user_plants
    FROM public.profiles
    WHERE user_id = v_user_id;

    IF NOT FOUND OR NOT v_is_active THEN
        RETURN false;
    END IF;

    -- 3. Superuser bypass
    IF v_role_code = 'ADMIN' THEN
        RETURN true;
    END IF;

    -- 4. Plant scope validation (if plant context is provided and user has explicit plant restrictions)
    IF p_plant IS NOT NULL AND cardinality(v_user_plants) > 0 THEN
        IF NOT (p_plant = ANY(v_user_plants)) THEN
            RETURN false;
        END IF;
    END IF;

    -- 5. Role permission matching (exact match or wildcard '*')
    SELECT true INTO v_has_perm
    FROM public.role_permissions
    WHERE role_code = v_role_code
      AND (module = p_module OR module = '*')
      AND (activity = p_activity OR activity = '*')
      AND (plant_limit IS NULL OR p_plant IS NULL OR p_plant = ANY(plant_limit))
      AND (amount_limit IS NULL OR p_amount IS NULL OR p_amount <= amount_limit)
    LIMIT 1;

    RETURN COALESCE(v_has_perm, false);
END;
$$;

-- Revoke execute from public; grant only to authenticated actors
REVOKE EXECUTE ON FUNCTION public.has_permission(text, text, text, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(text, text, text, numeric) TO authenticated;
