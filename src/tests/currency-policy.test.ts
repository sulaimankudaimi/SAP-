import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../core/db';
import { CurrencyPolicy } from '../core/services/CurrencyPolicy';
import { LOCALE } from '../config/locale';

describe('CurrencyPolicy & Tax Settings Service (currency-policy)', () => {
  beforeEach(async () => {
    await db.settings.clear();
    await db.journalEntries.clear();
  });

  it('defaults base currency to SYP from LOCALE and seeds default settings', async () => {
    const base = await CurrencyPolicy.getBaseCurrency();
    expect(base).toBe('SYP');
    expect(base).toBe(LOCALE.currency.code);

    await CurrencyPolicy.ensureDefaultSettings();
    const storedBase = await db.settings.get('currency.base');
    const storedFx = await db.settings.get('currency.fx.sypPerUsd');
    const storedFxLabel = await db.settings.get('currency.fx.label');
    const storedTaxRate = await db.settings.get('tax.sales.rate');

    expect(storedBase?.value).toBe('SYP');
    expect(storedFx?.value).toBe('120');
    expect(storedFxLabel?.value).toBe('تجريبي');
    expect(storedTaxRate?.value).toBe('0');
  });

  it('allows changing base currency when no journal entries exist', async () => {
    await expect(CurrencyPolicy.assertCanChangeBase('USD')).resolves.toBeUndefined();
    await CurrencyPolicy.setBaseCurrency('USD');
    expect(await CurrencyPolicy.getBaseCurrency()).toBe('USD');
  });

  it('blocks changing base currency with an Arabic error when any journal entry exists', async () => {
    await CurrencyPolicy.ensureDefaultSettings();

    await db.journalEntries.put({
      id: 'je-test-1',
      docNumber: 'JE-2026-000001',
      companyCode: '1000',
      fiscalYear: '2026',
      period: 3,
      documentType: 'SA',
      postingDate: '2026-03-01',
      documentDate: '2026-03-01',
      headerText: 'قيد يومية اختباري',
      status: 'posted',
      totalDebit: 50000,
      totalCredit: 50000,
      lines: [
        { lineNumber: 1, accountNumber: '101010', accountName: 'النقدية', debit: 50000, credit: 0 },
        { lineNumber: 2, accountNumber: '401010', accountName: 'الإيرادات', debit: 0, credit: 50000 },
      ],
      createdBy: 'admin',
      createdAt: new Date().toISOString(),
      updatedBy: 'admin',
      updatedAt: new Date().toISOString(),
      version: 1,
      isDeleted: false,
    });

    await expect(CurrencyPolicy.assertCanChangeBase('USD')).rejects.toThrow(
      /لا يمكن تغيير العملة الأساسية/
    );
    await expect(CurrencyPolicy.setBaseCurrency('USD')).rejects.toThrow(
      /لا يمكن تغيير العملة الأساسية/
    );
    expect(await CurrencyPolicy.getBaseCurrency()).toBe('SYP');
  });

  it('manages demo exchange rate (120 SYP/USD labeled تجريبي) and converts amounts accurately', async () => {
    const fx = await CurrencyPolicy.getExchangeRate();
    expect(fx.sypPerUsd).toBe(120);
    expect(fx.label).toBe('تجريبي');

    const usdAmount = await CurrencyPolicy.convertAmount(12000, 'SYP', 'USD');
    expect(usdAmount).toBe(100);

    const sypAmount = await CurrencyPolicy.convertAmount(250, 'USD', 'SYP');
    expect(sypAmount).toBe(30000);

    await CurrencyPolicy.setExchangeRate(150);
    const updatedFx = await CurrencyPolicy.getExchangeRate();
    expect(updatedFx.sypPerUsd).toBe(150);
    expect(updatedFx.label).toBe('تجريبي');
  });

  it('provides configurable EXEMPT and SALES tax codes with default rate 0', async () => {
    const codes = await CurrencyPolicy.getTaxCodes();
    expect(codes).toHaveLength(2);
    expect(codes.find((c) => c.code === 'EXEMPT')?.rate).toBe(0);
    expect(codes.find((c) => c.code === 'SALES')?.rate).toBe(0);

    await CurrencyPolicy.setSalesTaxRate(0.05);
    const updatedCodes = await CurrencyPolicy.getTaxCodes();
    expect(updatedCodes.find((c) => c.code === 'EXEMPT')?.rate).toBe(0);
    expect(updatedCodes.find((c) => c.code === 'SALES')?.rate).toBe(0.05);
  });
});
