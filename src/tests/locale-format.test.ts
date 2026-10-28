import { describe, it, expect } from 'vitest';
import {
  formatMoney,
  formatMoneyCompact,
  formatNumber,
  formatDate,
  formatDateTime,
  formatPhone,
  formatPlate,
} from '../core/utils/format';
import { LOCALE } from '../config/locale';

describe('Syria Locale Pack & Formatting Helpers (locale-format)', () => {
  describe('LOCALE configuration pack', () => {
    it('exports verified Syrian locale constants and Decision Card values', () => {
      expect(LOCALE.country.code).toBe('SY');
      expect(LOCALE.brand.nameAr).toBe('شركة الشام للطاقة');
      expect(LOCALE.brand.nameEn).toBe('Sham Energy');
      expect(LOCALE.brand.productName).toBe('Sham Energy ERP');
      expect(LOCALE.hqCity).toBe('دمشق');
      expect(LOCALE.currency).toEqual({
        code: 'SYP',
        symbolAr: 'ل.س',
        symbolEn: 'SYP',
        decimals: 2,
      });
      expect(LOCALE.secondaryCurrency).toBe('USD');
      expect(LOCALE.demoFx).toEqual({
        sypPerUsd: 120,
        label: 'تجريبي',
      });
      expect(LOCALE.timezone).toBe('Asia/Damascus');
      expect(LOCALE.dateLocale).toBe('ar-SY-u-ca-gregory-nu-latn');
      expect(LOCALE.numberLocale).toBe('en-US');
      expect(LOCALE.phone.countryCode).toBe('+963');
      expect(LOCALE.tax).toEqual({
        mode: 'configurable',
        defaultRate: 0,
      });
    });

    it('contains all 14 Syrian governorates, 25+ name pools, 3 plants, 6 storage locations, and 8 sites', () => {
      expect(LOCALE.governorates).toHaveLength(14);
      const govNames = LOCALE.governorates.map((g) => g.nameAr);
      expect(govNames).toEqual([
        'دمشق',
        'ريف دمشق',
        'حلب',
        'حمص',
        'حماة',
        'اللاذقية',
        'طرطوس',
        'إدلب',
        'درعا',
        'السويداء',
        'القنيطرة',
        'دير الزور',
        'الرقة',
        'الحسكة',
      ]);

      expect(LOCALE.namePools.firstNames.length).toBeGreaterThanOrEqual(25);
      expect(LOCALE.namePools.lastNames.length).toBeGreaterThanOrEqual(25);
      expect(LOCALE.plants.map((p) => p.code)).toEqual(['1100', '1200', '1300']);
      expect(LOCALE.storageLocations).toHaveLength(6);
      expect(LOCALE.sites).toHaveLength(8);
    });
  });

  describe('formatMoney & formatMoneyCompact', () => {
    it('formats exact SYP strings with Western digits, two decimals, and Arabic symbol after the number', () => {
      expect(formatMoney(1250000)).toBe('1,250,000.00 ل.س');
      expect(formatMoney(0)).toBe('0.00 ل.س');
      expect(formatMoney(42.5)).toBe('42.50 ل.س');
    });

    it('rounds half-up deterministically to two decimals', () => {
      expect(formatMoney(1234.567)).toBe('1,234.57 ل.س');
      expect(formatMoney(1234.564)).toBe('1,234.56 ل.س');
      expect(formatMoney(99.999)).toBe('100.00 ل.س');
    });

    it('formats negative numbers deterministically with leading minus sign', () => {
      expect(formatMoney(-1250000)).toBe('-1,250,000.00 ل.س');
      expect(formatMoney(-0.001)).toBe('0.00 ل.س');
      expect(formatMoney(-45.2, 'USD')).toBe('-45.20 USD');
    });

    it('supports secondary currency (USD) and compact money formatting', () => {
      expect(formatMoney(1500, 'USD')).toBe('1,500.00 USD');
      expect(formatMoneyCompact(2500000)).toBe('2.5M ل.س');
      expect(formatMoneyCompact(45000)).toBe('45K ل.س');
      expect(formatMoneyCompact(-1200000, 'USD')).toBe('-1.2M USD');
    });

    it('formats numbers with Western digits via formatNumber', () => {
      expect(formatNumber(9876543.21, 2)).toBe('9,876,543.21');
      expect(formatNumber(-4200)).toBe('-4,200');
    });
  });

  describe('formatDate & formatDateTime (Levantine months, Western digits, Asia/Damascus timezone)', () => {
    it('formats dates with Levantine month names and Western digits 0-9', () => {
      const jan = formatDate('2026-01-15T12:00:00Z');
      const jun = formatDate('2026-06-20T12:00:00Z');
      const oct = formatDate('2026-10-05T12:00:00Z');

      expect(jan).toContain('كانون الثاني');
      expect(jan).toContain('2026');
      expect(jan).toContain('15');
      expect(jan).not.toMatch(/[٠-٩]/);

      expect(jun).toContain('حزيران');
      expect(jun).toContain('20');

      expect(oct).toContain('تشرين الأول');
      expect(oct).toContain('5');
    });

    it('handles Asia/Damascus (UTC+3) timezone boundaries around midnight accurately', () => {
      // 2026-06-14 20:30 UTC === 2026-06-14 23:30 Asia/Damascus (still June 14)
      const beforeMidnightDamascus = formatDate('2026-06-14T20:30:00.000Z', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      expect(beforeMidnightDamascus).toContain('14');
      expect(beforeMidnightDamascus).toContain('حزيران');

      // 2026-06-14 21:30 UTC === 2026-06-15 00:30 Asia/Damascus (crossed into June 15 in Damascus!)
      const afterMidnightDamascus = formatDate('2026-06-14T21:30:00.000Z', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      expect(afterMidnightDamascus).toContain('15');
      expect(afterMidnightDamascus).toContain('حزيران');

      const dtString = formatDateTime('2026-06-14T21:30:00.000Z');
      expect(dtString).not.toMatch(/[٠-٩]/);
      expect(dtString).toContain('2026');
    });
  });

  describe('formatPhone & formatPlate', () => {
    it('formats Syrian phone numbers with +963 prefix and Western digits', () => {
      expect(formatPhone('0933123456')).toBe('+963 933123456');
      expect(formatPhone('+963944987654')).toBe('+963 944987654');
      expect(formatPhone('00963112233445')).toBe('+963 112233445');
    });

    it('formats Syrian vehicle plates with governorate name plus digits', () => {
      expect(formatPlate('حمص', '345678')).toBe('حمص 345678');
      expect(formatPlate('HO', 345678)).toBe('حمص 345678');
      expect(formatPlate('DI', '104920')).toBe('دمشق 104920');
      expect(formatPlate('حمص 345678')).toBe('حمص 345678');
    });
  });
});
