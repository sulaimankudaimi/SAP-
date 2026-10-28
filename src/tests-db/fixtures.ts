import { PoolClient } from 'pg';
import { LOCALE } from '../config/locale';
import { formatPlate } from '../core/utils/format';

export interface SeededFixtures {
  plants: string[];
  costCenters: string[];
  materials: {
    diesel: string;
    filter: string;
    tire: string;
  };
  vehicles: {
    riyadhTankerId: string;
    yanbuTankerId: string;
  };
  drivers: {
    validDriver1Id: string;
    validDriver2Id: string;
    expiredDriverId: string;
  };
}

/**
 * Seeds comprehensive reference data across the ERP database.
 */
export async function seedReferenceData(client: PoolClient): Promise<SeededFixtures> {
  // 1. Plants
  await client.query(`
    INSERT INTO public.plants (code, name, city, company_code, allows_negative_stock) VALUES
    ('${LOCALE.plants[0].code}', '${LOCALE.plants[0].nameAr}', '${LOCALE.plants[0].city}', '1000', false),
    ('${LOCALE.plants[1].code}', '${LOCALE.plants[1].nameAr}', '${LOCALE.plants[1].city}', '1000', false),
    ('${LOCALE.plants[2].code}', '${LOCALE.plants[2].nameAr}', '${LOCALE.plants[2].city}', '1000', false)
    ON CONFLICT (code) DO NOTHING;
  `);

  // 2. Cost Centers
  await client.query(`
    INSERT INTO public.cost_centers (code, name, company_code, responsible_person) VALUES
    ('CC-1100', 'إدارة تشغيل أسطول دمشق', '1000', '${LOCALE.namePools.firstNames[0]} ${LOCALE.namePools.lastNames[0]}'),
    ('CC-1200', 'محطة التوزيع والشحن بحمص', '1000', '${LOCALE.namePools.firstNames[2]} ${LOCALE.namePools.lastNames[2]}'),
    ('CC-1300', 'ورشة الصيانة ومستودع بانياس', '1000', '${LOCALE.namePools.firstNames[4]} ${LOCALE.namePools.lastNames[4]}')
    ON CONFLICT (code) DO NOTHING;
  `);

  // 3. GL Accounts (SAP Standard Chart of Accounts)
  await client.query(`
    INSERT INTO public.gl_accounts (account_number, name, category, currency) VALUES
    ('101010', 'النقدية بالبنوك المحلية (المصرف التجاري / التسليف)', 'Asset', 'SYP'),
    ('120010', 'مخزون وقود الديزل والمحروقات (Euro 5 Diesel)', 'Asset', 'SYP'),
    ('120040', 'مخزون قطع غيار الشاحنات والمضخات', 'Asset', 'SYP'),
    ('150020', 'أصول ثابتة - أسطول صهاريج نقل الوقود', 'Asset', 'SYP'),
    ('201010', 'الذمم الدائنة التجارية (موردي قطع الغيار والوقود)', 'Liability', 'SYP'),
    ('201020', 'مستحقات وسيطة GR/IR - مقاولي النقل واللوجستيات', 'Liability', 'SYP'),
    ('202010', 'ضريبة مبيعات مستحقة / تسويات ضريبية', 'Liability', 'SYP'),
    ('501020', 'تكلفة قطع الغيار والمهمات المستهلكة (COGS Spare Parts)', 'Expense', 'SYP'),
    ('601010', 'بدلات وانتدابات سائقي صهاريج الوقود', 'Expense', 'SYP'),
    ('602010', 'مصروفات صيانة وإصلاح أسطول الصهاريج', 'Expense', 'SYP'),
    ('603010', 'وقود تشغيل الشاحنات ومعدات النقل', 'Expense', 'SYP')
    ON CONFLICT (account_number) DO NOTHING;
  `);

  // 4. Account Determination Rules
  await client.query(`
    INSERT INTO public.account_determination (event, rule_name, debit_account_number, credit_account_number, description) VALUES
    ('GI_ORDER', 'صرف قطع غيار لأمر صيانة شاحنة (Movement 261)', '602010', '120040', 'مدين مصروفات صيانة / دائن مخزون قطع الغيار'),
    ('FUEL_LOG', 'تسجيل استهلاك وقود صهريج (Fuel Log)', '603010', '201010', 'مدين وقود تشغيل / دائن ذمم دائنة أو نقدية'),
    ('TRIP_COST', 'ترحيل تكلفة رحلة أسطول (Trip Completion)', '601010', '201020', 'مدين بدلات السائقين وتكاليف الشحن / دائن مستحقات وسيطة')
    ON CONFLICT (event) DO NOTHING;
  `);

  // 5. Fiscal Periods for 2026
  await client.query(`
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
  `);

  // 6. Materials (Rescaled by SAR_TO_SYP_FACTOR = 450)
  await client.query(`
    INSERT INTO public.materials (code, name, material_type, material_group, base_unit, moving_average_price, is_active) VALUES
    ('MAT-FUEL-DIESEL', 'وقود ديزل نقل ثقيل (Euro 5 Diesel - تجريبي)', 'HAWA', 'FUEL', 'L', 520.00, true),
    ('MAT-OIL-FILTER', 'فلتر زيت محرك ديزل أصلي (Actros Oil Filter)', 'ERSA', 'PARTS', 'PC', 68000.00, true),
    ('MAT-TIRE-HEAVY', 'إطار شاحنة ثقيلة ميشلان (315/80 R22.5)', 'ERSA', 'TIRES', 'PC', 540000.00, true)
    ON CONFLICT (code) DO NOTHING;
  `);

  // 7. Stock Balances
  // We seed 50 oil filters and exactly 1 heavy tire (for the "last unit" concurrency test)
  await client.query(`
    INSERT INTO public.stock_balances (id, material_code, plant_code, storage_location, unrestricted_qty, total_valuation, moving_average_price, unit, last_movement_date) VALUES
    ('bal-MAT-OIL-FILTER-1100-SL01', 'MAT-OIL-FILTER', '1100', 'SL01', 50.000, 3400000.00, 68000.00, 'PC', current_date),
    ('bal-MAT-TIRE-HEAVY-1100-SL01', 'MAT-TIRE-HEAVY', '1100', 'SL01', 1.000, 540000.00, 540000.00, 'PC', current_date)
    ON CONFLICT (id) DO UPDATE SET
      unrestricted_qty = EXCLUDED.unrestricted_qty,
      total_valuation = EXCLUDED.total_valuation;
  `);

  // 8. Vehicles
  const v1Id = '11111111-1111-1111-1111-111111111101';
  const v2Id = '22222222-2222-2222-2222-222222222202';

  await client.query(`
    INSERT INTO public.vehicles (
      id, code, plate_number, type, make_model, vin, year, capacity_liters,
      current_odometer, fuel_type, plant_code, cost_center, status, insurance_expiry, registration_expiry
    ) VALUES
    ($1, 'TRK-101', '${formatPlate(LOCALE.governorates[0].nameAr, 110101)}', 'Tanker', 'Mercedes-Benz Actros 3340', 'WDB9634031L110101', 2023, 32000, 150000.00, 'Diesel', '1100', 'CC-1100', 'available', '2027-12-31', '2027-12-31'),
    ($2, 'TRK-102', '${formatPlate(LOCALE.governorates[3].nameAr, 220102)}', 'Tanker', 'Volvo FH16 750', 'YV2RT40A1MB220202', 2024, 35000, 80000.00, 'Diesel', '1200', 'CC-1200', 'available', '2027-12-31', '2027-12-31')
    ON CONFLICT (id) DO UPDATE SET
      current_odometer = EXCLUDED.current_odometer,
      status = EXCLUDED.status;
  `, [v1Id, v2Id]);

  // 9. Drivers
  const d1Id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
  const d2Id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
  const dExpId = 'cccccccc-cccc-cccc-cccc-cccccccccc03';

  await client.query(`
    INSERT INTO public.drivers (
      id, code, name, national_id, mobile, license_number, license_class, license_expiry, plant_code, status, safety_rating
    ) VALUES
    ($1, 'DRV-101', '${LOCALE.namePools.firstNames[0]} ${LOCALE.namePools.lastNames[0]}', '01010998877', '+963931112233', 'LIC-101', 'نقل مواد خطرة (HazMat)', '2027-12-31', '1100', 'available', 4.95),
    ($2, 'DRV-102', '${LOCALE.namePools.firstNames[1]} ${LOCALE.namePools.lastNames[1]}', '04011445566', '+963945112233', 'LIC-102', 'عمومي ثقيل', '2027-12-31', '1200', 'available', 5.00),
    ($3, 'DRV-EXP', 'سائق منتهي الصلاحية', '01033444555', '+963999000111', 'LIC-EXP', 'عمومي ثقيل', '2024-01-01', '1100', 'available', 3.50)
    ON CONFLICT (id) DO UPDATE SET
      license_expiry = EXCLUDED.license_expiry,
      status = EXCLUDED.status;
  `, [d1Id, d2Id, dExpId]);

  // 10. Number Ranges
  await client.query(`
    INSERT INTO public.number_ranges (object_type, fiscal_year, prefix, current_number, from_number, to_number) VALUES
    ('TRIP', '2026', 'TRIP-2026-', 0, 1, 999999),
    ('FUEL', '2026', 'FL-2026-', 0, 1, 999999),
    ('MO', '2026', 'MO-2026-', 0, 1, 999999),
    ('JE', '2026', 'JE-2026-', 0, 1, 999999),
    ('MATDOC', '2026', 'MD-2026-', 0, 1, 999999)
    ON CONFLICT (object_type, fiscal_year) DO NOTHING;
  `);

  return {
    plants: ['1100', '1200', '1300'],
    costCenters: ['CC-1100', 'CC-1200', 'CC-1300'],
    materials: {
      diesel: 'MAT-FUEL-DIESEL',
      filter: 'MAT-OIL-FILTER',
      tire: 'MAT-TIRE-HEAVY',
    },
    vehicles: {
      riyadhTankerId: v1Id,
      yanbuTankerId: v2Id,
    },
    drivers: {
      validDriver1Id: d1Id,
      validDriver2Id: d2Id,
      expiredDriverId: dExpId,
    },
  };
}
