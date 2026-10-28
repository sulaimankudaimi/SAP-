import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../core/db';
import { DatabaseSeeder, SEED_VERSION, SEED_VERSION_KEY, SAR_TO_SYP_FACTOR } from '../seed';
import { LOCALE } from '../config/locale';
import { READ_SPECS } from '../core/gateway/readSpecs';
import { DRIVER_FIELD_MAP, mapDriverRow } from '../core/gateway/rowMappers';
import { WorkflowService } from '../modules/admin/services/WorkflowService';

describe('Prompt 2 — Syria Data Localization, Monetary Rescale, nationalId Rename & seedVersion', () => {
  beforeEach(async () => {
    await DatabaseSeeder.resetAndSeed({ demoMode: true });
  });

  it('seeds company, plants, storage locations, vendors, customers, drivers, and vehicles from LOCALE', async () => {
    const companies = await db.companies.toArray();
    expect(companies).toHaveLength(1);
    expect(companies[0].code).toBe('1000');
    expect(companies[0].name).toContain(LOCALE.brand.nameAr);
    expect(companies[0].currency).toBe('SYP');

    const plants = await db.plants.toArray();
    expect(plants).toHaveLength(3);
    expect(plants.map((p) => p.code).sort()).toEqual(['1100', '1200', '1300']);
    const hq = plants.find((p) => p.code === '1100');
    expect(hq?.city).toBe('دمشق');

    const slocs = await db.storageLocations.toArray();
    expect(slocs).toHaveLength(6);

    const vendors = await db.vendors.toArray();
    expect(vendors.length).toBe(30);
    expect(vendors[0].name).toBe(LOCALE.vendorNamePool[0]);

    const customers = await db.customers.toArray();
    expect(customers.length).toBe(15);
    expect(customers[0].name).toBe(LOCALE.customerNamePool[0]);

    const vehicles = await db.vehicles.toArray();
    expect(vehicles.length).toBe(40);
    // Syrian governorate-number plate format
    for (const v of vehicles) {
      expect(LOCALE.governorates.some((g) => v.plateNumber.startsWith(g.nameAr))).toBe(true);
    }
  });

  it('renames iqamaNumber -> nationalId and iqama_number -> national_id across models, specs, and mappers', async () => {
    expect(READ_SPECS.drivers.columns).toContain('national_id');
    expect(READ_SPECS.drivers.columns).not.toContain('iqama_number');
    expect(DRIVER_FIELD_MAP.nationalId).toEqual({ kind: 'column', column: 'national_id' });

    const mapped = mapDriverRow({
      id: 'd-test-map',
      code: 'DRV-900',
      name: 'طارق الحلبي',
      national_id: '01012345678',
      license_number: 'SY-DL-900',
      license_class: 'عمومي ثقيل',
      license_expiry: '2028-12-31',
      mobile: '+963931234567',
      safety_rating: 4.9,
      status: 'available',
      plant_code: '1100',
      version: 1,
      is_deleted: false,
    });
    expect(mapped.nationalId).toBe('01012345678');
    expect('iqamaNumber' in mapped).toBe(false);

    const drivers = await db.drivers.toArray();
    expect(drivers.length).toBe(30);
    for (const d of drivers) {
      expect(typeof d.nationalId).toBe('string');
      expect(d.nationalId.length).toBe(11);
      expect('iqamaNumber' in d).toBe(false);
    }
  });

  it('applies SAR_TO_SYP_FACTOR = 450 monetary rescale across seeds, fuel prices, and approval thresholds', async () => {
    expect(SAR_TO_SYP_FACTOR).toBe(450);

    const fuelLogs = await db.fuelLogs.toArray();
    expect(fuelLogs.length).toBeGreaterThan(0);
    expect(fuelLogs[0].costPerLiter).toBe(520);
    expect(fuelLogs[0].stationName).toContain('تجريبي');

    await WorkflowService.initRulesIfEmpty();
    const rules = await db.approvalRules.toArray();
    const poRules = rules.filter((r) => r.documentType === 'PO').sort((a, b) => a.minAmount - b.minAmount);
    expect(poRules[0].maxAmount).toBe(22500000);
    expect(poRules[1].maxAmount).toBe(112500000);
  });

  it('persists seed.version setting when demo database is seeded', async () => {
    const versionSetting = await db.settings.where('key').equals(SEED_VERSION_KEY).first();
    expect(versionSetting).toBeDefined();
    expect(versionSetting?.value).toBe(SEED_VERSION);
  });
});
