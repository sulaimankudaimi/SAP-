import { describe, it, expect } from 'vitest';
import {
  validateSyrianPhone,
  isValidSyrianPhone,
  validateNationalNumber,
  isValidNationalNumber,
  validateTaxNumber,
  isValidTaxNumber,
  validateCommercialRegister,
  isValidCommercialRegister,
  validateBankAccount,
  isValidBankAccount,
  FIELD_LABELS,
} from '../core/utils/validators';

describe('Syrian Loose Validators & Field Labels (validators-sy)', () => {
  describe('Phone Validator (+963 or leading 0 followed by 8-9 digits)', () => {
    it('accepts valid Syrian mobile and landline numbers', () => {
      expect(isValidSyrianPhone('+963933123456')).toBe(true);
      expect(isValidSyrianPhone('+963 944 123 456')).toBe(true);
      expect(isValidSyrianPhone('+963-11-2233445')).toBe(true);
      expect(isValidSyrianPhone('0933123456')).toBe(true);
      expect(isValidSyrianPhone('0112233445')).toBe(true);
    });

    it('rejects Saudi +966 numbers and malformed phone strings', () => {
      expect(isValidSyrianPhone('+966501234567')).toBe(false);
      expect(isValidSyrianPhone('12345')).toBe(false);
      expect(isValidSyrianPhone('')).toBe(false);
      expect(validateSyrianPhone('+966501234567').error).toContain('+963');
    });
  });

  describe('National Number Validator (6 to 20 letters or digits)', () => {
    it('accepts Syrian national numbers of 6 to 20 alphanumeric characters', () => {
      expect(isValidNationalNumber('01020034567')).toBe(true);
      expect(isValidNationalNumber('SY123456')).toBe(true);
      expect(isValidNationalNumber('12345678901234567890')).toBe(true);
    });

    it('rejects strings shorter than 6 or longer than 20 characters', () => {
      expect(isValidNationalNumber('12345')).toBe(false);
      expect(isValidNationalNumber('123456789012345678901')).toBe(false);
      expect(validateNationalNumber('123').error).toContain('الرقم الوطني');
    });
  });

  describe('Tax Number & Commercial Register Validators (4 to 30 alphanumerics)', () => {
    it('accepts 4 to 30 alphanumeric characters without Saudi 15-digit 3...3 restriction', () => {
      expect(isValidTaxNumber('TAX-1020')).toBe(true);
      expect(isValidTaxNumber('998877')).toBe(true);
      expect(isValidCommercialRegister('CR-DAM-10421')).toBe(true);
      expect(isValidCommercialRegister('10421')).toBe(true);
    });

    it('rejects values shorter than 4 or longer than 30 characters', () => {
      expect(isValidTaxNumber('12')).toBe(false);
      expect(isValidCommercialRegister('AB')).toBe(false);
      expect(validateTaxNumber('12').error).toContain('الرقم الضريبي');
      expect(validateCommercialRegister('12').error).toContain('السجل التجاري');
    });
  });

  describe('Bank Account Validator (free text with optional unvalidated IBAN)', () => {
    it('accepts free-text Syrian bank account descriptions and any optional IBAN', () => {
      expect(isValidBankAccount('المصرف التجاري السوري - فرع دمشق رقم 440192')).toBe(true);
      expect(isValidBankAccount('SY1200001001234567890123')).toBe(true);
      expect(isValidBankAccount('حساب جاري رقم 1002938')).toBe(true);
      expect(validateBankAccount('', false).valid).toBe(true);
    });

    it('rejects empty bank account only when required', () => {
      expect(validateBankAccount('', true).valid).toBe(false);
      expect(validateBankAccount('ab', true).valid).toBe(false);
    });
  });

  describe('Canonical Field Labels', () => {
    it('exposes the required Syrian field labels', () => {
      expect(FIELD_LABELS.nationalNumber).toBe('الرقم الوطني');
      expect(FIELD_LABELS.taxNumber).toBe('الرقم الضريبي');
      expect(FIELD_LABELS.commercialRegister).toBe('السجل التجاري');
    });
  });
});
