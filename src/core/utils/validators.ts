import { toWesternDigits } from './format';

export interface ValidationResult {
  readonly valid: boolean;
  readonly error?: string;
}

export const FIELD_LABELS = {
  nationalNumber: 'الرقم الوطني',
  taxNumber: 'الرقم الضريبي',
  commercialRegister: 'السجل التجاري',
  phone: 'رقم الهاتف',
  bankAccount: 'الحساب البنكي',
} as const;

/**
 * Syrian phone validator:
 * Accepts "+963" or a leading "0" followed by 8 to 9 digits (spaces/hyphens allowed).
 * Does not accept other country codes (such as +966).
 */
export function validateSyrianPhone(value: string): ValidationResult {
  const normalized = toWesternDigits(value || '').trim();
  if (!normalized) {
    return { valid: false, error: 'رقم الهاتف مطلوب.' };
  }

  const compact = normalized.replace(/[\s\-().]/g, '');
  const syriaPattern = /^(?:\+963|0)\d{8,9}$/;

  if (!syriaPattern.test(compact)) {
    return {
      valid: false,
      error: 'يرجى إدخال رقم هاتف سوري صحيح يبدأ بـ +963 أو 0 متبوعاً بـ 8 إلى 9 أرقام.',
    };
  }

  return { valid: true };
}

export function isValidSyrianPhone(value: string): boolean {
  return validateSyrianPhone(value).valid;
}

/**
 * National number validator (الرقم الوطني):
 * Loose validator accepting 6 to 20 letters or digits (no invented fixed-length rule).
 */
export function validateNationalNumber(value: string): ValidationResult {
  const normalized = toWesternDigits(value || '').trim();
  if (!normalized) {
    return { valid: false, error: 'الرقم الوطني مطلوب.' };
  }

  const compact = normalized.replace(/[\s-]/g, '');
  const allowedChars = /^[\p{L}\d]+$/u.test(compact);
  if (!allowedChars || compact.length < 6 || compact.length > 20) {
    return {
      valid: false,
      error: 'الرقم الوطني يجب أن يتكون من 6 إلى 20 حرفاً أو رقماً.',
    };
  }

  return { valid: true };
}

export function isValidNationalNumber(value: string): boolean {
  return validateNationalNumber(value).valid;
}

/**
 * Tax number validator (الرقم الضريبي):
 * Loose validator accepting 4 to 30 alphanumerics (letters or digits).
 */
export function validateTaxNumber(value: string): ValidationResult {
  const normalized = toWesternDigits(value || '').trim();
  if (!normalized) {
    return { valid: false, error: 'الرقم الضريبي مطلوب.' };
  }

  const compact = normalized.replace(/[\s\-/]/g, '');
  const allowedChars = /^[\p{L}\d]+$/u.test(compact);
  if (!allowedChars || compact.length < 4 || compact.length > 30) {
    return {
      valid: false,
      error: 'الرقم الضريبي يجب أن يتكون من 4 إلى 30 حرفاً أو رقماً.',
    };
  }

  return { valid: true };
}

export function isValidTaxNumber(value: string): boolean {
  return validateTaxNumber(value).valid;
}

/**
 * Commercial register validator (السجل التجاري):
 * Loose validator accepting 4 to 30 alphanumerics (letters or digits).
 */
export function validateCommercialRegister(value: string): ValidationResult {
  const normalized = toWesternDigits(value || '').trim();
  if (!normalized) {
    return { valid: false, error: 'السجل التجاري مطلوب.' };
  }

  const compact = normalized.replace(/[\s\-/]/g, '');
  const allowedChars = /^[\p{L}\d]+$/u.test(compact);
  if (!allowedChars || compact.length < 4 || compact.length > 30) {
    return {
      valid: false,
      error: 'السجل التجاري يجب أن يتكون من 4 إلى 30 حرفاً أو رقماً.',
    };
  }

  return { valid: true };
}

export function isValidCommercialRegister(value: string): boolean {
  return validateCommercialRegister(value).valid;
}

/**
 * Bank account validator:
 * Free text for bank account with optional IBAN that is NOT format-validated.
 */
export function validateBankAccount(
  accountText: string,
  optionalIbanOrRequired?: string | boolean
): ValidationResult {
  const trimmedAccount = (accountText || '').trim();
  const isRequired = typeof optionalIbanOrRequired === 'boolean' ? optionalIbanOrRequired : true;

  if (!trimmedAccount) {
    if (!isRequired) {
      return { valid: true };
    }
    return { valid: false, error: 'بيانات الحساب البنكي مطلوبة.' };
  }

  if (trimmedAccount.length < 4) {
    return { valid: false, error: 'بيانات الحساب البنكي يجب ألا تقل عن 4 أحرف أو أرقام.' };
  }

  // Optional IBAN is intentionally not format-validated per Syria localization spec
  if (
    optionalIbanOrRequired !== undefined &&
    typeof optionalIbanOrRequired !== 'string' &&
    typeof optionalIbanOrRequired !== 'boolean'
  ) {
    return { valid: false, error: 'قيمة IBAN غير صالحة.' };
  }

  return { valid: true };
}

export function isValidBankAccount(
  accountText: string,
  optionalIbanOrRequired?: string | boolean
): boolean {
  return validateBankAccount(accountText, optionalIbanOrRequired).valid;
}
