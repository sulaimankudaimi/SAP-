import { db } from '../db';
import type { Setting } from '../../types/models';

export interface TolerancePolicy {
  pricePercent: number;
  quantityPercent: number;
  amountAbsolute: number;
}

export class TolerancePolicyService {
  static readonly DEFAULT_PRICE_PERCENT = 3.0;
  static readonly DEFAULT_QUANTITY_PERCENT = 5.0;
  static readonly DEFAULT_AMOUNT_ABSOLUTE = 0.0;

  /**
   * Validates tolerance values:
   * Percentages must be between 0 and 100 inclusive.
   * Absolute amounts must be non-negative.
   */
  static validate(policy: TolerancePolicy): void {
    if (
      typeof policy.pricePercent !== 'number' ||
      Number.isNaN(policy.pricePercent) ||
      policy.pricePercent < 0 ||
      policy.pricePercent > 100
    ) {
      throw new Error('نسبة سماحية السعر غير صالحة: يجب أن تكون بين 0 و 100.');
    }

    if (
      typeof policy.quantityPercent !== 'number' ||
      Number.isNaN(policy.quantityPercent) ||
      policy.quantityPercent < 0 ||
      policy.quantityPercent > 100
    ) {
      throw new Error('نسبة سماحية الكمية غير صالحة: يجب أن تكون بين 0 و 100.');
    }

    if (
      typeof policy.amountAbsolute !== 'number' ||
      Number.isNaN(policy.amountAbsolute) ||
      policy.amountAbsolute < 0
    ) {
      throw new Error('مبلغ السماحية المطلق غير صالح: يجب أن يكون رقماً غير سالب.');
    }
  }

  /**
   * Resolves tolerance settings for a company code with global fallback.
   * Reads keys:
   *   tolerance.price.percent
   *   tolerance.quantity.percent
   *   tolerance.amount.absolute
   * Checking per-company key {baseKey}.{companyCode} first, then global {baseKey}.
   */
  static async get(companyCode?: string): Promise<TolerancePolicy> {
    const [pricePercent, quantityPercent, amountAbsolute] = await Promise.all([
      this.readNumberSetting('tolerance.price.percent', companyCode, this.DEFAULT_PRICE_PERCENT, 0, 100),
      this.readNumberSetting('tolerance.quantity.percent', companyCode, this.DEFAULT_QUANTITY_PERCENT, 0, 100),
      this.readNumberSetting('tolerance.amount.absolute', companyCode, this.DEFAULT_AMOUNT_ABSOLUTE, 0),
    ]);

    const policy: TolerancePolicy = {
      pricePercent,
      quantityPercent,
      amountAbsolute,
    };

    this.validate(policy);
    return policy;
  }

  /**
   * Saves or updates tolerance setting for a company code or global fallback.
   */
  static async set(policy: TolerancePolicy, companyCode?: string): Promise<void> {
    this.validate(policy);

    const now = new Date().toISOString();
    const rows: Setting[] = [
      {
        id: companyCode ? `set-tol-price-${companyCode}` : 'set-tolerance-price-pct',
        key: companyCode ? `tolerance.price.percent.${companyCode}` : 'tolerance.price.percent',
        value: String(policy.pricePercent),
        category: 'general',
        description: companyCode
          ? `Tolerance price percent for company ${companyCode}`
          : 'initial company policy, editable',
        updatedAt: now,
        isDeleted: false,
      },
      {
        id: companyCode ? `set-tol-qty-${companyCode}` : 'set-tolerance-qty-pct',
        key: companyCode ? `tolerance.quantity.percent.${companyCode}` : 'tolerance.quantity.percent',
        value: String(policy.quantityPercent),
        category: 'general',
        description: companyCode
          ? `Tolerance quantity percent for company ${companyCode}`
          : 'initial company policy, editable',
        updatedAt: now,
        isDeleted: false,
      },
      {
        id: companyCode ? `set-tol-amt-${companyCode}` : 'set-tolerance-amt-abs',
        key: companyCode ? `tolerance.amount.absolute.${companyCode}` : 'tolerance.amount.absolute',
        value: String(policy.amountAbsolute),
        category: 'general',
        description: companyCode
          ? `Tolerance amount absolute for company ${companyCode}`
          : 'initial company policy, editable',
        updatedAt: now,
        isDeleted: false,
      },
    ];

    await db.settings.bulkPut(rows);
  }

  private static async readNumberSetting(
    baseKey: string,
    companyCode: string | undefined,
    defaultValue: number,
    min: number,
    max?: number
  ): Promise<number> {
    let settingRow: Setting | undefined;

    if (companyCode) {
      settingRow = await db.settings
        .where('key')
        .equals(`${baseKey}.${companyCode}`)
        .first();
    }

    if (!settingRow || settingRow.isDeleted) {
      settingRow = await db.settings.where('key').equals(baseKey).first();
    }

    if (!settingRow || settingRow.isDeleted || settingRow.value === undefined || settingRow.value === '') {
      return defaultValue;
    }

    const parsed = parseFloat(settingRow.value);
    if (Number.isNaN(parsed)) {
      throw new Error(`قيمة الإعداد [${settingRow.key}] غير صالحة كرقم: ${settingRow.value}`);
    }

    if (parsed < min || (max !== undefined && parsed > max)) {
      throw new Error(
        `قيمة الإعداد [${settingRow.key}] (${parsed}) خارج النطاق المسموح به (${min} - ${max ?? 'غير محدود'}).`
      );
    }

    return parsed;
  }
}
