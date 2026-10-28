import { LOCALE } from '../../config/locale';

const LEVANTINE_MONTHS: readonly string[] = [
  'كانون الثاني',
  'شباط',
  'آذار',
  'نيسان',
  'أيار',
  'حزيران',
  'تموز',
  'آب',
  'أيلول',
  'تشرين الأول',
  'تشرين الثاني',
  'كانون الأول',
];

const EASTERN_TO_WESTERN_DIGITS: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

export function toWesternDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (ch) => EASTERN_TO_WESTERN_DIGITS[ch] ?? ch);
}

function formatWithCommas(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function resolveCurrencySymbol(currency: string): string {
  const normalized = currency.trim().toUpperCase();
  if (
    !normalized ||
    normalized === LOCALE.currency.code ||
    currency.trim() === LOCALE.currency.symbolAr
  ) {
    return LOCALE.currency.symbolAr;
  }
  return normalized;
}

/**
 * Deterministic money formatter using Western digits and explicit symbol placement.
 * Example: formatMoney(1250000) -> "1,250,000.00 ل.س"
 */
export function formatMoney(
  amount: number,
  currency: string = LOCALE.currency.code,
  options?: { decimals?: number }
): string {
  const symbol = resolveCurrencySymbol(currency || LOCALE.currency.code);
  const decimals = options?.decimals ?? LOCALE.currency.decimals;
  if (!Number.isFinite(amount) || Number.isNaN(amount)) {
    const zeroStr = decimals > 0 ? `0.${'0'.repeat(decimals)}` : '0';
    return `${zeroStr} ${symbol}`;
  }

  const factor = Math.pow(10, decimals);
  const roundedAbs = Math.round((Math.abs(amount) + Number.EPSILON) * factor) / factor;
  const isNegative = amount < 0 && roundedAbs > 0;
  const fixed = roundedAbs.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const formattedNumber =
    decimals > 0 && decPart !== undefined
      ? `${isNegative ? '-' : ''}${formatWithCommas(intPart)}.${decPart}`
      : `${isNegative ? '-' : ''}${formatWithCommas(intPart)}`;

  return `${formattedNumber} ${symbol}`;
}

/**
 * Compact money formatter using Western digits.
 * Example: formatMoneyCompact(1250000) -> "1.25M ل.س"
 */
export function formatMoneyCompact(
  amount: number,
  currency: string = LOCALE.currency.code
): string {
  const symbol = resolveCurrencySymbol(currency);
  if (!Number.isFinite(amount) || Number.isNaN(amount)) {
    return `0 ${symbol}`;
  }

  const abs = Math.abs(amount);
  const sign = amount < 0 && abs > 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    const val = (abs / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '');
    return `${sign}${val}B ${symbol}`;
  }
  if (abs >= 1_000_000) {
    const val = (abs / 1_000_000).toFixed(2).replace(/\.?0+$/, '');
    return `${sign}${val}M ${symbol}`;
  }
  if (abs >= 1_000) {
    const val = (abs / 1_000).toFixed(1).replace(/\.?0+$/, '');
    return `${sign}${val}K ${symbol}`;
  }

  const rounded = Math.round((abs + Number.EPSILON) * 100) / 100;
  const formatted = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `${sign}${formatted} ${symbol}`;
}

/**
 * Formats numbers using LOCALE.numberLocale ('en-US') with Western digits.
 */
export function formatNumber(
  value: number,
  optionsOrDecimals?: number | { minimumFractionDigits?: number; maximumFractionDigits?: number },
  _locale?: string
): string {
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    return '0';
  }
  const minFrac =
    typeof optionsOrDecimals === 'number'
      ? optionsOrDecimals
      : optionsOrDecimals?.minimumFractionDigits ?? 0;
  const maxFrac =
    typeof optionsOrDecimals === 'number'
      ? optionsOrDecimals
      : optionsOrDecimals?.maximumFractionDigits ?? 2;
  const formatter = new Intl.NumberFormat(LOCALE.numberLocale, {
    minimumFractionDigits: minFrac,
    maximumFractionDigits: Math.max(minFrac, maxFrac),
  });
  return toWesternDigits(formatter.format(value));
}

function toValidDate(input: Date | string | number): Date | null {
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }
  if (typeof input === 'number') {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function extractZonedParts(date: Date): {
  year: string;
  month: number;
  day: string;
  hour: string;
  minute: string;
  second: string;
} {
  const dtf = new Intl.DateTimeFormat(LOCALE.dateLocale, {
    timeZone: LOCALE.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = toWesternDigits(part.value);
    }
  }
  const monthNum = Math.min(12, Math.max(1, parseInt(map.month || '1', 10)));
  return {
    year: map.year || '1970',
    month: monthNum,
    day: String(parseInt(map.day || '1', 10)),
    hour: (map.hour || '00').padStart(2, '0'),
    minute: (map.minute || '00').padStart(2, '0'),
    second: (map.second || '00').padStart(2, '0'),
  };
}

/**
 * Formats a date using LOCALE.dateLocale ('ar-SY-u-ca-gregory-nu-latn')
 * and LOCALE.timezone ('Asia/Damascus'), with Levantine month names and Western digits.
 */
export function formatDate(
  input: Date | string | number,
  optionsOrPattern?: Intl.DateTimeFormatOptions | string
): string {
  const date = toValidDate(input);
  if (!date) {
    return typeof input === 'string' ? input : '';
  }

  const parts = extractZonedParts(date);
  const levantineMonth = LEVANTINE_MONTHS[parts.month - 1];

  if (typeof optionsOrPattern === 'string') {
    if (optionsOrPattern === 'yyyy-MM-dd') {
      return `${parts.year}-${String(parts.month).padStart(2, '0')}-${parts.day.padStart(2, '0')}`;
    }
    if (optionsOrPattern === 'HH:mm:ss') {
      return `${parts.hour}:${parts.minute}:${parts.second}`;
    }
    if (optionsOrPattern === 'HH:mm') {
      return `${parts.hour}:${parts.minute}`;
    }
  }

  if (optionsOrPattern && typeof optionsOrPattern === 'object') {
    if (
      optionsOrPattern.month === '2-digit' ||
      optionsOrPattern.month === 'numeric'
    ) {
      const m =
        optionsOrPattern.month === '2-digit'
          ? String(parts.month).padStart(2, '0')
          : String(parts.month);
      const d =
        optionsOrPattern.day === '2-digit'
          ? parts.day.padStart(2, '0')
          : parts.day;
      return `${parts.year}/${m}/${d}`;
    }
    if (optionsOrPattern.month && !optionsOrPattern.year && optionsOrPattern.day) {
      return `${parts.day} ${levantineMonth}`;
    }
    if (optionsOrPattern.month && optionsOrPattern.year && !optionsOrPattern.day) {
      return `${levantineMonth} ${parts.year}`;
    }
  }

  return `${parts.day} ${levantineMonth} ${parts.year}`;
}

/**
 * Formats a date and time using LOCALE.dateLocale ('ar-SY-u-ca-gregory-nu-latn')
 * and LOCALE.timezone ('Asia/Damascus'), with Levantine month names and Western digits.
 */
export function formatDateTime(
  input: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = toValidDate(input);
  if (!date) {
    return typeof input === 'string' ? input : '';
  }

  const parts = extractZonedParts(date);
  const levantineMonth = LEVANTINE_MONTHS[parts.month - 1];
  const includeSeconds = options?.second !== undefined;
  const timeStr = includeSeconds
    ? `${parts.hour}:${parts.minute}:${parts.second}`
    : `${parts.hour}:${parts.minute}`;

  return `${parts.day} ${levantineMonth} ${parts.year}، ${timeStr}`;
}

/**
 * Formats only the time portion in LOCALE.timezone ('Asia/Damascus') with Western digits.
 */
export function formatTime(
  input: Date | string | number,
  options?: { includeSeconds?: boolean }
): string {
  const date = toValidDate(input);
  if (!date) {
    return typeof input === 'string' ? input : '';
  }
  const parts = extractZonedParts(date);
  const includeSeconds = options?.includeSeconds ?? true;
  return includeSeconds
    ? `${parts.hour}:${parts.minute}:${parts.second}`
    : `${parts.hour}:${parts.minute}`;
}

/**
 * Formats Syrian phone numbers (+963 aware).
 * Accepts +963..., 00963..., 963..., or leading 0 followed by 8-9 digits.
 */
export function formatPhone(phone: string): string {
  const raw = toWesternDigits(phone || '').trim();
  if (!raw) return '';

  const cleaned = raw.replace(/[\s\-().]/g, '');
  let national = '';

  if (cleaned.startsWith('+963')) {
    national = cleaned.slice(4);
  } else if (cleaned.startsWith('00963')) {
    national = cleaned.slice(5);
  } else if (cleaned.startsWith('963') && cleaned.length >= 11) {
    national = cleaned.slice(3);
  } else if (cleaned.startsWith('0')) {
    national = cleaned.slice(1);
  } else {
    national = cleaned.replace(/^\+/, '');
  }

  if (national.startsWith('0')) {
    national = national.slice(1);
  }

  if (!/^\d+$/.test(national)) {
    return raw;
  }

  const cc = LOCALE.phone.countryCode;
  return `${cc} ${national}`;
}

const GOVERNORATE_SHORT_CODES: Record<string, string> = {
  DI: 'دمشق',
  DAM: 'دمشق',
  RD: 'ريف دمشق',
  RIF: 'ريف دمشق',
  AL: 'حلب',
  ALP: 'حلب',
  HO: 'حمص',
  HMS: 'حمص',
  HA: 'حماة',
  HMA: 'حماة',
  LA: 'اللاذقية',
  LAT: 'اللاذقية',
  TA: 'طرطوس',
  TAR: 'طرطوس',
  ID: 'إدلب',
  IDL: 'إدلب',
  DR: 'درعا',
  DAR: 'درعا',
  SU: 'السويداء',
  SWE: 'السويداء',
  QU: 'القنيطرة',
  QUN: 'القنيطرة',
  DZ: 'دير الزور',
  DEZ: 'دير الزور',
  RA: 'الرقة',
  RAQ: 'الرقة',
  HS: 'الحسكة',
  HAS: 'الحسكة',
};

function resolveGovernorateAr(govKey: string): string {
  const trimmed = govKey.trim();
  const upper = trimmed.toUpperCase();
  if (GOVERNORATE_SHORT_CODES[upper]) {
    return GOVERNORATE_SHORT_CODES[upper];
  }
  const matched = LOCALE.governorates.find(
    (g) =>
      g.code.toUpperCase() === upper ||
      g.nameAr === trimmed ||
      g.nameEn.toLowerCase() === trimmed.toLowerCase() ||
      trimmed.includes(g.nameAr)
  );
  return matched ? matched.nameAr : trimmed || LOCALE.hqCity;
}

/**
 * Formats a Syrian vehicle plate as "<governorate nameAr> <digits>".
 * Supports:
 * - formatPlate('حمص', '345678') -> "حمص 345678"
 * - formatPlate('HO', 345678) -> "حمص 345678"
 * - formatPlate({ governorate: 'HMS', number: 345678 }) -> "حمص 345678"
 * - formatPlate('حمص 345678') -> "حمص 345678"
 */
export function formatPlate(
  plate: string | { governorate: string; number: string | number },
  plateNumber?: string | number
): string {
  if (plateNumber !== undefined) {
    const govName =
      typeof plate === 'string'
        ? resolveGovernorateAr(plate)
        : resolveGovernorateAr(plate.governorate);
    const digits = toWesternDigits(String(plateNumber)).replace(/\D/g, '');
    return digits ? `${govName} ${digits}` : govName;
  }

  if (typeof plate === 'object' && plate !== null) {
    const govName = resolveGovernorateAr(plate.governorate);
    const digits = toWesternDigits(String(plate.number)).replace(/\D/g, '');
    return digits ? `${govName} ${digits}` : govName;
  }

  const normalized = toWesternDigits(plate || '').trim();
  if (!normalized) return '';

  const digitsMatch = normalized.match(/\d+/g);
  const digits = digitsMatch ? digitsMatch.join('') : '';
  const textPart = normalized
    .replace(/\d+/g, '')
    .replace(/[-_/|،,]+/g, ' ')
    .trim();

  if (textPart) {
    const govName = resolveGovernorateAr(textPart);
    return digits ? `${govName} ${digits}` : govName;
  }

  return digits ? `${LOCALE.hqCity} ${digits}` : normalized;
}
