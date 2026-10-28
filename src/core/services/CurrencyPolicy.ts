import { db } from '../db';
import { LOCALE } from '../../config/locale';
import type { Setting, TaxCodeId, TaxCodeConfig } from '../../types/models';

export type TaxCodeKey = TaxCodeId;
export type { TaxCodeId, TaxCodeConfig };

export interface ExchangeRateConfig {
  readonly baseCurrency: string;
  readonly secondaryCurrency: string;
  readonly sypPerUsd: number;
  readonly label: 'تجريبي';
}

export const CURRENCY_SETTINGS_KEYS = {
  BASE_CURRENCY: 'currency.base',
  SECONDARY_CURRENCY: 'currency.secondary',
  FX_SYP_PER_USD: 'currency.fx.sypPerUsd',
  FX_LABEL: 'currency.fx.label',
  TAX_SALES_RATE: 'tax.sales.rate',
  TAX_DEFAULT_CODE: 'tax.defaultCode',
} as const;

async function upsertSetting(
  key: string,
  value: string | number | boolean,
  category: Setting['category'],
  description: string
): Promise<void> {
  const existing = await db.settings.where('key').equals(key).first();
  const now = new Date().toISOString();
  const strValue = String(value);
  if (existing) {
    await db.settings.update(existing.id, {
      value: strValue,
      description,
      updatedAt: now,
    });
  } else {
    await db.settings.put({
      id: key,
      key,
      value: strValue,
      category,
      description,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    });
  }
}

export class CurrencyPolicy {
  /**
   * Synchronous fallback returning the locale default base currency ('SYP').
   */
  static getDefaultBaseCurrency(): string {
    return LOCALE.currency.code;
  }

  /**
   * Reads the configured base currency from settings (key 'currency.base'),
   * defaulting to LOCALE.currency.code ('SYP').
   */
  static async getBaseCurrency(): Promise<string> {
    try {
      const rec = await db.settings
        .where('key')
        .equals(CURRENCY_SETTINGS_KEYS.BASE_CURRENCY)
        .first();
      if (rec && typeof rec.value === 'string' && rec.value.trim().length > 0) {
        return rec.value.trim().toUpperCase();
      }
    } catch {
      // Fallback to locale default if DB is unavailable
    }
    return LOCALE.currency.code;
  }

  /**
   * Throws an Arabic error if any non-deleted journal entry exists in the system.
   */
  static async assertCanChangeBase(_newCurrencyCode?: string): Promise<void> {
    const allEntries = await db.journalEntries.toArray();
    const activeCount = allEntries.filter((entry) => !entry.isDeleted).length;
    if (activeCount > 0) {
      throw new Error(
        'لا يمكن تغيير العملة الأساسية للنظام بعد وجود قيود يومية مسجلة في الدفاتر المحاسبية.'
      );
    }
  }

  /**
   * Changes the base currency in settings after asserting no journal entries exist.
   */
  static async setBaseCurrency(newCurrencyCode: string): Promise<string> {
    const normalized = newCurrencyCode.trim().toUpperCase();
    if (!normalized) {
      throw new Error('رمز العملة الأساسية غير صالح.');
    }
    await CurrencyPolicy.assertCanChangeBase();
    await upsertSetting(
      CURRENCY_SETTINGS_KEYS.BASE_CURRENCY,
      normalized,
      'Finance',
      'العملة الأساسية للنظام المحاسبي'
    );
    return normalized;
  }

  /**
   * Reads the demo exchange rate configuration from settings.
   * Always labeled "تجريبي" per binding Decision Card.
   */
  static async getExchangeRate(): Promise<ExchangeRateConfig> {
    const baseCurrency = await CurrencyPolicy.getBaseCurrency();
    let sypPerUsd: number = LOCALE.demoFx.sypPerUsd;
    try {
      const fxRec = await db.settings
        .where('key')
        .equals(CURRENCY_SETTINGS_KEYS.FX_SYP_PER_USD)
        .first();
      if (fxRec !== undefined && fxRec !== null) {
        const parsed = Number(fxRec.value);
        if (Number.isFinite(parsed) && parsed > 0) {
          sypPerUsd = parsed;
        }
      }
    } catch {
      // Fallback to demo default
    }

    return {
      baseCurrency,
      secondaryCurrency: LOCALE.secondaryCurrency,
      sypPerUsd,
      label: LOCALE.demoFx.label,
    };
  }

  /**
   * Updates the editable demo exchange rate (SYP per 1 USD) in settings.
   */
  static async setExchangeRate(sypPerUsd: number): Promise<ExchangeRateConfig> {
    if (!Number.isFinite(sypPerUsd) || sypPerUsd <= 0) {
      throw new Error('سعر الصرف التجريبي يجب أن يكون رقماً موجباً أكبر من الصفر.');
    }
    await upsertSetting(
      CURRENCY_SETTINGS_KEYS.FX_SYP_PER_USD,
      sypPerUsd,
      'Finance',
      `سعر الصرف (${LOCALE.demoFx.label}) مقابل الدولار الأمريكي`
    );
    await upsertSetting(
      CURRENCY_SETTINGS_KEYS.FX_LABEL,
      LOCALE.demoFx.label,
      'Finance',
      'تصنيف سعر الصرف (تجريبي)'
    );
    return CurrencyPolicy.getExchangeRate();
  }

  /**
   * Converts an amount between SYP and USD using the configured demo exchange rate.
   */
  static async convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    const from = fromCurrency.trim().toUpperCase();
    const to = toCurrency.trim().toUpperCase();
    if (from === to) return amount;

    const { sypPerUsd } = await CurrencyPolicy.getExchangeRate();
    if (from === 'USD' && to === 'SYP') {
      return Number((amount * sypPerUsd).toFixed(LOCALE.currency.decimals));
    }
    if (from === 'SYP' && to === 'USD') {
      return Number((amount / sypPerUsd).toFixed(LOCALE.currency.decimals));
    }
    return amount;
  }

  /**
   * Returns configurable tax codes from settings: EXEMPT (0) and SALES (default 0).
   */
  static async getTaxCodes(): Promise<TaxCodeConfig[]> {
    let salesRate: number = LOCALE.tax.defaultRate;
    try {
      const salesRec = await db.settings
        .where('key')
        .equals(CURRENCY_SETTINGS_KEYS.TAX_SALES_RATE)
        .first();
      if (salesRec !== undefined && salesRec !== null) {
        const parsed = Number(salesRec.value);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
          salesRate = parsed;
        } else if (Number.isFinite(parsed) && parsed > 1 && parsed <= 100) {
          salesRate = parsed / 100;
        }
      }
    } catch {
      // Fallback to defaultRate = 0
    }

    return [
      {
        code: 'EXEMPT',
        nameAr: 'معفى من الضريبة',
        nameEn: 'Tax Exempt',
        rate: 0,
      },
      {
        code: 'SALES',
        nameAr: 'ضريبة المبيعات',
        nameEn: 'Sales Tax',
        rate: salesRate,
      },
    ];
  }

  /**
   * Updates the configurable SALES tax rate in settings (accepts fraction 0..1 or percentage 0..100).
   */
  static async setSalesTaxRate(rate: number): Promise<void> {
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      throw new Error('نسبة الضريبة غير صالحة.');
    }
    const normalizedFraction = rate > 1 ? rate / 100 : rate;
    await upsertSetting(
      CURRENCY_SETTINGS_KEYS.TAX_SALES_RATE,
      normalizedFraction,
      'Finance',
      'نسبة ضريبة المبيعات القابلة للضبط'
    );
  }

  /**
   * Ensures default currency, demo FX, and configurable tax settings exist in db.settings.
   */
  static async ensureDefaultSettings(): Promise<void> {
    const baseRec = await db.settings
      .where('key')
      .equals(CURRENCY_SETTINGS_KEYS.BASE_CURRENCY)
      .first();
    if (!baseRec) {
      await upsertSetting(
        CURRENCY_SETTINGS_KEYS.BASE_CURRENCY,
        LOCALE.currency.code,
        'Finance',
        'العملة الأساسية للنظام المحاسبي'
      );
    }

    const secRec = await db.settings
      .where('key')
      .equals(CURRENCY_SETTINGS_KEYS.SECONDARY_CURRENCY)
      .first();
    if (!secRec) {
      await upsertSetting(
        CURRENCY_SETTINGS_KEYS.SECONDARY_CURRENCY,
        LOCALE.secondaryCurrency,
        'Finance',
        'العملة الثانوية للنظام'
      );
    }

    const fxRec = await db.settings
      .where('key')
      .equals(CURRENCY_SETTINGS_KEYS.FX_SYP_PER_USD)
      .first();
    if (!fxRec) {
      await upsertSetting(
        CURRENCY_SETTINGS_KEYS.FX_SYP_PER_USD,
        LOCALE.demoFx.sypPerUsd,
        'Finance',
        `سعر الصرف (${LOCALE.demoFx.label}) مقابل الدولار الأمريكي`
      );
    }

    const fxLabelRec = await db.settings
      .where('key')
      .equals(CURRENCY_SETTINGS_KEYS.FX_LABEL)
      .first();
    if (!fxLabelRec) {
      await upsertSetting(
        CURRENCY_SETTINGS_KEYS.FX_LABEL,
        LOCALE.demoFx.label,
        'Finance',
        'تصنيف سعر الصرف (تجريبي)'
      );
    }

    const taxRateRec = await db.settings
      .where('key')
      .equals(CURRENCY_SETTINGS_KEYS.TAX_SALES_RATE)
      .first();
    if (!taxRateRec) {
      await upsertSetting(
        CURRENCY_SETTINGS_KEYS.TAX_SALES_RATE,
        LOCALE.tax.defaultRate,
        'Finance',
        'نسبة ضريبة المبيعات (القيمة الافتراضية 0)'
      );
    }
  }
}
