-- ============================================================================
-- Migration: 0004_rls.sql
-- Description: Comprehensive Row Level Security (RLS) enforcement & permission policies
-- Database: PostgreSQL 15+ (Supabase / Self-Hosted)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enable Row Level Security on Every Table (Default Deny)
-- ----------------------------------------------------------------------------
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.number_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preventive_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gl_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_determination ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posting_registry ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. Core Administration Policies (Roles, Permissions, Profiles)
-- ----------------------------------------------------------------------------
-- Profiles: Users can view their own profile; Administrators and Auditors can view all profiles
CREATE POLICY pol_profiles_select ON public.profiles
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid() OR
        public.has_permission('ADM', 'view') OR
        public.has_permission('AUD', 'view')
    );

-- Roles & Role Permissions: Read-only for authenticated system users
CREATE POLICY pol_roles_select ON public.roles
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY pol_role_permissions_select ON public.role_permissions
    FOR SELECT TO authenticated
    USING (true);

-- ----------------------------------------------------------------------------
-- 3. Master Data Policies (Plants, Cost Centers, Materials, GL Accounts)
-- ----------------------------------------------------------------------------
CREATE POLICY pol_plants_select ON public.plants
    FOR SELECT TO authenticated
    USING (public.has_permission('MD', 'view', code));

CREATE POLICY pol_cost_centers_select ON public.cost_centers
    FOR SELECT TO authenticated
    USING (public.has_permission('MD', 'view'));

CREATE POLICY pol_materials_select ON public.materials
    FOR SELECT TO authenticated
    USING (public.has_permission('MD', 'view') OR public.has_permission('WM', 'view'));

CREATE POLICY pol_gl_accounts_select ON public.gl_accounts
    FOR SELECT TO authenticated
    USING (public.has_permission('FI', 'view') OR public.has_permission('MD', 'view'));

CREATE POLICY pol_account_determination_select ON public.account_determination
    FOR SELECT TO authenticated
    USING (public.has_permission('FI', 'view'));

CREATE POLICY pol_fiscal_periods_select ON public.fiscal_periods
    FOR SELECT TO authenticated
    USING (public.has_permission('FI', 'view'));

-- ----------------------------------------------------------------------------
-- 4. Fleet Master Data Policies (Vehicles & Drivers)
-- ----------------------------------------------------------------------------
CREATE POLICY pol_vehicles_select ON public.vehicles
    FOR SELECT TO authenticated
    USING (public.has_permission('TM', 'view', plant_code));

CREATE POLICY pol_drivers_select ON public.drivers
    FOR SELECT TO authenticated
    USING (public.has_permission('TM', 'view', plant_code));

CREATE POLICY pol_preventive_schedules_select ON public.preventive_schedules
    FOR SELECT TO authenticated
    USING (public.has_permission('TM', 'view'));

-- ----------------------------------------------------------------------------
-- 5. Fleet Operations Policies (Trips & Fuel Logs)
-- ----------------------------------------------------------------------------
CREATE POLICY pol_trips_select ON public.trips
    FOR SELECT TO authenticated
    USING (public.has_permission('TM', 'view', origin_plant));

CREATE POLICY pol_fuel_logs_select ON public.fuel_logs
    FOR SELECT TO authenticated
    USING (public.has_permission('TM', 'view', plant_code));

CREATE POLICY pol_maintenance_orders_select ON public.maintenance_orders
    FOR SELECT TO authenticated
    USING (public.has_permission('TM', 'view'));

-- ----------------------------------------------------------------------------
-- 6. Inventory Touchpoints Policies (Stock Balances, Ledger, Material Documents)
-- ----------------------------------------------------------------------------
-- Read-only visibility governed by WM permissions and plant scope
CREATE POLICY pol_stock_balances_select ON public.stock_balances
    FOR SELECT TO authenticated
    USING (public.has_permission('WM', 'view', plant_code));

CREATE POLICY pol_stock_ledger_select ON public.stock_ledger
    FOR SELECT TO authenticated
    USING (public.has_permission('WM', 'view', plant_code));

CREATE POLICY pol_material_documents_select ON public.material_documents
    FOR SELECT TO authenticated
    USING (public.has_permission('WM', 'view', plant_code));

-- ----------------------------------------------------------------------------
-- 7. Financial Accounting Policies (Journal Entries, Lines, Posting Registry)
-- ----------------------------------------------------------------------------
CREATE POLICY pol_journal_entries_select ON public.journal_entries
    FOR SELECT TO authenticated
    USING (public.has_permission('FI', 'view'));

CREATE POLICY pol_journal_lines_select ON public.journal_lines
    FOR SELECT TO authenticated
    USING (public.has_permission('FI', 'view'));

CREATE POLICY pol_posting_registry_select ON public.posting_registry
    FOR SELECT TO authenticated
    USING (public.has_permission('FI', 'view'));

-- ----------------------------------------------------------------------------
-- 8. Number Ranges & Audit Logs Policies
-- ----------------------------------------------------------------------------
CREATE POLICY pol_number_ranges_select ON public.number_ranges
    FOR SELECT TO authenticated
    USING (true);

-- Audit logs are viewable only by Administrators and Internal Auditors
CREATE POLICY pol_audit_logs_select ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        public.has_permission('ADM', 'view') OR
        public.has_permission('AUD', 'view')
    );

-- ============================================================================
-- CRITICAL SECURITY INVARIANT:
-- Clients have ZERO direct INSERT / UPDATE / DELETE policies on:
-- - stock_balances
-- - stock_ledger
-- - material_documents
-- - journal_entries
-- - journal_lines
-- - posting_registry
-- - number_ranges
-- - audit_logs
-- All mutations must strictly execute through SECURITY DEFINER RPC functions!
-- ============================================================================
