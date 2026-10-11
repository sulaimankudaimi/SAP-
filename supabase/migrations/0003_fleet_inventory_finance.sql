-- ============================================================================
-- Migration: 0003_fleet_inventory_finance.sql
-- Description: Core schema for Fleet vertical slice, Inventory & Finance touchpoints
-- Database: PostgreSQL 15+ (Supabase / Self-Hosted)
-- ============================================================================

-- Generic trigger function to automatically bump version and updated_at
CREATE OR REPLACE FUNCTION public.fn_bump_version_and_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.version := COALESCE(OLD.version, 1) + 1;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1. Organizational Master Data (Plants & Cost Centers)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plants (
    code text PRIMARY KEY,
    name text NOT NULL,
    city text,
    company_code text NOT NULL DEFAULT '1000',
    allows_negative_stock boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_by text NOT NULL DEFAULT 'system',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version integer NOT NULL DEFAULT 1
);

CREATE TRIGGER trg_plants_bump_version
    BEFORE UPDATE ON public.plants
    FOR EACH ROW EXECUTE FUNCTION public.fn_bump_version_and_timestamp();

CREATE TABLE IF NOT EXISTS public.cost_centers (
    code text PRIMARY KEY,
    name text NOT NULL,
    company_code text NOT NULL DEFAULT '1000',
    responsible_person text,
    is_active boolean NOT NULL DEFAULT true,
    created_by text NOT NULL DEFAULT 'system',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version integer NOT NULL DEFAULT 1
);

CREATE TRIGGER trg_cost_centers_bump_version
    BEFORE UPDATE ON public.cost_centers
    FOR EACH ROW EXECUTE FUNCTION public.fn_bump_version_and_timestamp();

-- Seed Primary Strategic Energy Sites
INSERT INTO public.plants (code, name, city, company_code, allows_negative_stock) VALUES
('1100', 'محطة الرياض المركزية (Riyadh Central Depot)', 'الرياض', '1000', false),
('1200', 'مستودع ينبع للمحروقات (Yanbu Fuel Terminal)', 'ينبع', '1000', false),
('1300', 'مركز توزيع الجبيل الصناعي (Jubail Logistics Center)', 'الجبيل', '1000', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.cost_centers (code, name, company_code, responsible_person) VALUES
('CC-1100', 'إدارة تشغيل أسطول الرياض', '1000', 'أحمد الشمري'),
('CC-1200', 'محطة التوزيع والشحن بينبع', '1000', 'خالد العنزي'),
('CC-1300', 'ورشة الصيانة ومستودع الجبيل', '1000', 'طارق الزهراني')
ON CONFLICT (code) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Materials & Spare Parts Master Data
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.materials (
    code text PRIMARY KEY,
    name text NOT NULL,
    material_type text NOT NULL, -- 'ROH' (Raw), 'ERSA' (Spare Parts), 'HAWA' (Fuel Products)
    material_group text NOT NULL,
    base_unit text NOT NULL,
    moving_average_price numeric(18,2) NOT NULL DEFAULT 0.00,
    is_active boolean NOT NULL DEFAULT true,
    created_by text NOT NULL DEFAULT 'system',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version integer NOT NULL DEFAULT 1
);

CREATE TRIGGER trg_materials_bump_version
    BEFORE UPDATE ON public.materials
    FOR EACH ROW EXECUTE FUNCTION public.fn_bump_version_and_timestamp();

-- ----------------------------------------------------------------------------
-- 3. Fleet Master Data (Vehicles & Drivers)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    plate_number text NOT NULL UNIQUE,
    type text NOT NULL, -- 'Tanker', 'HeavyTruck', 'LightTruck', 'Crane', 'Trailer'
    make_model text NOT NULL,
    vin text,
    year integer,
    capacity_liters numeric(18,3) NOT NULL DEFAULT 0.000,
    current_odometer numeric(18,2) NOT NULL DEFAULT 0.00,
    fuel_type text NOT NULL DEFAULT 'Diesel',
    assigned_driver_id uuid,
    plant_code text NOT NULL REFERENCES public.plants(code) ON DELETE RESTRICT,
    cost_center text NOT NULL REFERENCES public.cost_centers(code) ON DELETE RESTRICT,
    status text NOT NULL DEFAULT 'available', -- 'available', 'on_trip', 'maintenance', 'out_of_service'
    insurance_expiry date,
    registration_expiry date,
    is_deleted boolean NOT NULL DEFAULT false,
    created_by text NOT NULL DEFAULT 'system',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version integer NOT NULL DEFAULT 1
);

CREATE TRIGGER trg_vehicles_bump_version
    BEFORE UPDATE ON public.vehicles
    FOR EACH ROW EXECUTE FUNCTION public.fn_bump_version_and_timestamp();

CREATE TABLE IF NOT EXISTS public.drivers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    iqama_number text NOT NULL UNIQUE,
    mobile text NOT NULL,
    license_number text NOT NULL,
    license_class text NOT NULL,
    license_expiry date NOT NULL,
    plant_code text NOT NULL REFERENCES public.plants(code) ON DELETE RESTRICT,
    status text NOT NULL DEFAULT 'available', -- 'available', 'on_trip', 'on_leave', 'suspended'
    safety_rating numeric(3,2) NOT NULL DEFAULT 5.00,
    total_trips_completed integer NOT NULL DEFAULT 0,
    total_distance_km numeric(18,2) NOT NULL DEFAULT 0.00,
    is_deleted boolean NOT NULL DEFAULT false,
    created_by text NOT NULL DEFAULT 'system',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version integer NOT NULL DEFAULT 1
);

CREATE TRIGGER trg_drivers_bump_version
    BEFORE UPDATE ON public.drivers
    FOR EACH ROW EXECUTE FUNCTION public.fn_bump_version_and_timestamp();

ALTER TABLE public.vehicles
    ADD CONSTRAINT fk_vehicles_driver
    FOREIGN KEY (assigned_driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 4. Fleet Operations (Trips & Fuel Logs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trips (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_number text NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'in_transit', -- 'scheduled', 'in_transit', 'completed', 'cancelled'
    vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
    driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE RESTRICT,
    origin_plant text NOT NULL REFERENCES public.plants(code) ON DELETE RESTRICT,
    destination_location text NOT NULL,
    cargo_type text NOT NULL,
    cargo_volume_liters numeric(18,3) NOT NULL,
    scheduled_departure timestamptz NOT NULL,
    scheduled_arrival timestamptz NOT NULL,
    actual_departure timestamptz,
    actual_arrival timestamptz,
    start_odometer numeric(18,2) NOT NULL,
    end_odometer numeric(18,2),
    distance_km numeric(18,2),
    fuel_liters_consumed numeric(18,3) NOT NULL DEFAULT 0.000,
    fuel_cost numeric(18,2) NOT NULL DEFAULT 0.00,
    driver_allowance_cost numeric(18,2) NOT NULL DEFAULT 0.00,
    total_trip_cost numeric(18,2) NOT NULL DEFAULT 0.00,
    cost_per_km numeric(18,2) NOT NULL DEFAULT 0.00,
    is_delayed boolean NOT NULL DEFAULT false,
    delay_minutes integer NOT NULL DEFAULT 0,
    je_doc_number text,
    cancelled_by_document text,
    cancellation_reason text,
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version integer NOT NULL DEFAULT 1
);

CREATE TRIGGER trg_trips_bump_version
    BEFORE UPDATE ON public.trips
    FOR EACH ROW EXECUTE FUNCTION public.fn_bump_version_and_timestamp();

CREATE TABLE IF NOT EXISTS public.fuel_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_number text NOT NULL UNIQUE,
    vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
    driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE RESTRICT,
    fuel_type text NOT NULL DEFAULT 'Diesel',
    liters numeric(18,3) NOT NULL,
    unit_price numeric(18,2) NOT NULL,
    total_cost numeric(18,2) NOT NULL,
    odometer numeric(18,2) NOT NULL,
    station_name text NOT NULL,
    invoice_number text,
    plant_code text NOT NULL REFERENCES public.plants(code) ON DELETE RESTRICT,
    logged_at timestamptz NOT NULL DEFAULT now(),
    is_anomaly boolean NOT NULL DEFAULT false,
    anomaly_reason text,
    je_doc_number text,
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version integer NOT NULL DEFAULT 1
);

CREATE TRIGGER trg_fuel_logs_bump_version
    BEFORE UPDATE ON public.fuel_logs
    FOR EACH ROW EXECUTE FUNCTION public.fn_bump_version_and_timestamp();

-- ----------------------------------------------------------------------------
-- 5. Fleet Maintenance & Preventive Schedules
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.preventive_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
    title text NOT NULL,
    interval_km numeric(18,2),
    interval_days integer,
    last_performed_date date,
    last_performed_odometer numeric(18,2),
    next_due_date date,
    next_due_odometer numeric(18,2),
    status text NOT NULL DEFAULT 'Active',
    created_by text NOT NULL DEFAULT 'system',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version integer NOT NULL DEFAULT 1
);

CREATE TRIGGER trg_preventive_schedules_bump_version
    BEFORE UPDATE ON public.preventive_schedules
    FOR EACH ROW EXECUTE FUNCTION public.fn_bump_version_and_timestamp();

CREATE TABLE IF NOT EXISTS public.maintenance_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_number text NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed', 'cancelled'
    vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
    vehicle_plate text NOT NULL,
    order_type text NOT NULL DEFAULT 'Preventive', -- 'Preventive', 'Corrective', 'Inspection'
    description text NOT NULL,
    fault_reported text,
    estimated_cost numeric(18,2) NOT NULL DEFAULT 0.00,
    parts_cost numeric(18,2) NOT NULL DEFAULT 0.00,
    labor_hours numeric(18,2) NOT NULL DEFAULT 0.00,
    labor_cost numeric(18,2) NOT NULL DEFAULT 0.00,
    actual_cost numeric(18,2) NOT NULL DEFAULT 0.00,
    downtime_hours numeric(18,2) NOT NULL DEFAULT 0.00,
    start_date date NOT NULL,
    completion_date date,
    preventive_schedule_id uuid REFERENCES public.preventive_schedules(id) ON DELETE SET NULL,
    je_doc_number text,
    cancelled_by_document text,
    cancellation_reason text,
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version integer NOT NULL DEFAULT 1
);

CREATE TRIGGER trg_maintenance_orders_bump_version
    BEFORE UPDATE ON public.maintenance_orders
    FOR EACH ROW EXECUTE FUNCTION public.fn_bump_version_and_timestamp();

-- ----------------------------------------------------------------------------
-- 6. Inventory Touchpoints (Stock Balances, Stock Ledger, Material Documents)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_balances (
    id text PRIMARY KEY, -- e.g. 'bal-MAT-001-1100-SL01'
    material_code text NOT NULL REFERENCES public.materials(code) ON DELETE RESTRICT,
    plant_code text NOT NULL REFERENCES public.plants(code) ON DELETE RESTRICT,
    storage_location text NOT NULL,
    unrestricted_qty numeric(18,3) NOT NULL DEFAULT 0.000,
    quality_inspection_qty numeric(18,3) NOT NULL DEFAULT 0.000,
    blocked_qty numeric(18,3) NOT NULL DEFAULT 0.000,
    unit text NOT NULL,
    total_valuation numeric(18,2) NOT NULL DEFAULT 0.00,
    moving_average_price numeric(18,2) NOT NULL DEFAULT 0.00,
    last_movement_date date NOT NULL DEFAULT current_date,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version integer NOT NULL DEFAULT 1,
    CONSTRAINT uq_material_plant_sloc UNIQUE(material_code, plant_code, storage_location)
);

CREATE TRIGGER trg_stock_balances_bump_version
    BEFORE UPDATE ON public.stock_balances
    FOR EACH ROW EXECUTE FUNCTION public.fn_bump_version_and_timestamp();

CREATE TABLE IF NOT EXISTS public.material_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_number text NOT NULL UNIQUE,
    movement_type text NOT NULL, -- '101' (Receipt), '201' (Issue CC), '261' (Issue Order), '311' (Transfer), '551' (Scrap)
    posting_date date NOT NULL,
    plant_code text NOT NULL REFERENCES public.plants(code) ON DELETE RESTRICT,
    storage_location text,
    po_number text,
    maintenance_order_number text,
    header_text text,
    items jsonb NOT NULL,
    cancelled_by_document text,
    cancellation_reason text,
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    material_doc_number text NOT NULL,
    posting_date date NOT NULL,
    material_code text NOT NULL REFERENCES public.materials(code) ON DELETE RESTRICT,
    plant_code text NOT NULL REFERENCES public.plants(code) ON DELETE RESTRICT,
    storage_location text NOT NULL,
    movement_type text NOT NULL,
    quantity numeric(18,3) NOT NULL, -- Signed: positive inbound, negative outbound
    unit text NOT NULL,
    unit_price numeric(18,2) NOT NULL,
    total_amount numeric(18,2) NOT NULL,
    balance_after numeric(18,3) NOT NULL,
    cost_center text REFERENCES public.cost_centers(code) ON DELETE RESTRICT,
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_ledger_material ON public.stock_ledger(material_code, plant_code, storage_location);

-- ----------------------------------------------------------------------------
-- 7. Financial Accounting Touchpoints (GL, Determination, Periods, Journals, Registry)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gl_accounts (
    account_number text PRIMARY KEY,
    name text NOT NULL,
    category text NOT NULL, -- 'Asset', 'Liability', 'Equity', 'Revenue', 'Expense'
    currency text NOT NULL DEFAULT 'SAR',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed Essential SAP Chart of Accounts for Fleet, Inventory, and Energy Logistics
INSERT INTO public.gl_accounts (account_number, name, category, currency) VALUES
('101010', 'النقدية بالبنوك المحلية (Al Rajhi / SNB)', 'Asset', 'SAR'),
('120010', 'مخزون وقود الديزل والمحروقات (Euro 5 Diesel)', 'Asset', 'SAR'),
('120040', 'مخزون قطع غيار الشاحنات والمضخات', 'Asset', 'SAR'),
('150020', 'أصول ثابتة - أسطول صهاريج نقل الوقود', 'Asset', 'SAR'),
('201010', 'الذمم الدائنة التجارية (موردي قطع الغيار والوقود)', 'Liability', 'SAR'),
('201020', 'مستحقات وسيطة GR/IR - مقاولي النقل واللوجستيات', 'Liability', 'SAR'),
('202010', 'ضريبة القيمة المضافة المستحقة / المدخلات (ZATCA VAT)', 'Liability', 'SAR'),
('501020', 'تكلفة قطع الغيار والمهمات المستهلكة (COGS Spare Parts)', 'Expense', 'SAR'),
('601010', 'بدلات وانتدابات سائقي صهاريج الوقود', 'Expense', 'SAR'),
('602010', 'مصروفات صيانة وإصلاح أسطول الصهاريج', 'Expense', 'SAR'),
('603010', 'وقود تشغيل الشاحنات ومعدات النقل', 'Expense', 'SAR')
ON CONFLICT (account_number) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.account_determination (
    event text PRIMARY KEY,
    rule_name text NOT NULL,
    debit_account_number text NOT NULL REFERENCES public.gl_accounts(account_number) ON DELETE RESTRICT,
    credit_account_number text NOT NULL REFERENCES public.gl_accounts(account_number) ON DELETE RESTRICT,
    posting_key_debit text NOT NULL DEFAULT '40',
    posting_key_credit text NOT NULL DEFAULT '50',
    description text
);

INSERT INTO public.account_determination (event, rule_name, debit_account_number, credit_account_number, description) VALUES
('GI_ORDER', 'صرف قطع غيار لأمر صيانة شاحنة (Movement 261)', '602010', '120040', 'مدين مصروفات صيانة / دائن مخزون قطع الغيار'),
('FUEL_LOG', 'تسجيل استهلاك وقود صهريج (Fuel Log)', '603010', '201010', 'مدين وقود تشغيل / دائن ذمم دائنة أو نقدية'),
('TRIP_COST', 'ترحيل تكلفة رحلة أسطول (Trip Completion)', '601010', '201020', 'مدين بدلات السائقين وتكاليف الشحن / دائن مستحقات وسيطة')
ON CONFLICT (event) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.fiscal_periods (
    id text PRIMARY KEY, -- e.g. 'FP-1000-2026-03'
    company_code text NOT NULL DEFAULT '1000',
    fiscal_year text NOT NULL,
    period integer NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_open boolean NOT NULL DEFAULT true,
    closed_at timestamptz,
    closed_by text,
    CONSTRAINT uq_company_year_period UNIQUE(company_code, fiscal_year, period)
);

-- Seed 12 Fiscal Periods for 2026 (All Open by Default)
DO $$
DECLARE
    m integer;
    s_date date;
    e_date date;
BEGIN
    FOR m IN 1..12 LOOP
        s_date := make_date(2026, m, 1);
        e_date := (s_date + interval '1 month - 1 day')::date;
        INSERT INTO public.fiscal_periods (id, company_code, fiscal_year, period, start_date, end_date, is_open)
        VALUES ('FP-1000-2026-' || lpad(m::text, 2, '0'), '1000', '2026', m, s_date, e_date, true)
        ON CONFLICT (id) DO NOTHING;
    END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.journal_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_number text NOT NULL UNIQUE,
    company_code text NOT NULL DEFAULT '1000',
    fiscal_year text NOT NULL,
    period integer NOT NULL,
    posting_date date NOT NULL,
    document_date date NOT NULL,
    document_type text NOT NULL DEFAULT 'SA', -- 'SA' (GL), 'WA' (Goods Issue), 'WE' (Goods Receipt), 'AB' (Reversal)
    header_text text NOT NULL,
    reference text,
    total_debit numeric(18,2) NOT NULL,
    total_credit numeric(18,2) NOT NULL,
    status text NOT NULL DEFAULT 'posted',
    is_parked boolean NOT NULL DEFAULT false,
    reversal_of_doc_number text,
    reversed_by_doc_number text,
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    version integer NOT NULL DEFAULT 1,
    CONSTRAINT chk_journal_balanced CHECK (abs(total_debit - total_credit) < 0.001)
);

CREATE TRIGGER trg_journal_entries_bump_version
    BEFORE UPDATE ON public.journal_entries
    FOR EACH ROW EXECUTE FUNCTION public.fn_bump_version_and_timestamp();

CREATE TABLE IF NOT EXISTS public.journal_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    line_number integer NOT NULL,
    posting_key text NOT NULL, -- '40' (Debit), '50' (Credit)
    account_number text NOT NULL REFERENCES public.gl_accounts(account_number) ON DELETE RESTRICT,
    account_name text NOT NULL,
    debit numeric(18,2) NOT NULL DEFAULT 0.00,
    credit numeric(18,2) NOT NULL DEFAULT 0.00,
    cost_center text REFERENCES public.cost_centers(code) ON DELETE RESTRICT,
    line_text text,
    CONSTRAINT uq_journal_line UNIQUE (journal_entry_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_lines(account_number);

CREATE TABLE IF NOT EXISTS public.posting_registry (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type text NOT NULL, -- 'TRIP', 'FUEL_LOG', 'MAINTENANCE_ORDER', 'GOODS_ISSUE', 'GOODS_RECEIPT'
    source_id text NOT NULL,
    event text NOT NULL DEFAULT 'POST',
    journal_doc_number text NOT NULL REFERENCES public.journal_entries(doc_number) ON DELETE RESTRICT,
    is_reversed boolean NOT NULL DEFAULT false,
    reversal_doc_number text,
    reversed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_source_event UNIQUE (source_type, source_id, event)
);
