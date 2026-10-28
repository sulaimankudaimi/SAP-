import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { LOCALE } from '../config/locale';
import {
  formatMoney,
  formatMoneyCompact,
  formatNumber as formatNumberCore,
  formatDate as formatDateCore,
  formatDateTime as formatDateTimeCore,
  formatTime as formatTimeCore,
  formatPhone as formatPhoneCore,
  formatPlate as formatPlateCore,
  toWesternDigits,
} from './utils/format';
import { downloadCsvFile } from './utils/fileDownloader';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export {
  formatMoney,
  formatMoneyCompact,
  toWesternDigits,
};

export function formatNumber(
  value: number,
  options?: number | { minimumFractionDigits?: number; maximumFractionDigits?: number },
  locale?: string
): string {
  return formatNumberCore(value, options, locale);
}

export function formatCurrency(
  value: number,
  currency: string = LOCALE.currency.code,
  options?: { decimals?: number }
): string {
  return formatMoney(value, currency, options);
}

export function formatDate(
  date: string | Date | number,
  patternOrOptions?: Intl.DateTimeFormatOptions | string
): string {
  return formatDateCore(date, patternOrOptions);
}

export function formatDateTime(
  date: string | Date | number,
  options?: Intl.DateTimeFormatOptions
): string {
  return formatDateTimeCore(date, options);
}

export function formatTime(
  date: string | Date | number,
  options?: { includeSeconds?: boolean }
): string {
  return formatTimeCore(date, options);
}

export function formatPhone(phone: string): string {
  return formatPhoneCore(phone);
}

export function formatPlate(
  plate: string | { governorate: string; number: string | number },
  plateNumber?: string | number
): string {
  return formatPlateCore(plate, plateNumber);
}

export function exportToCSV<T extends Record<string, unknown>>(data: T[], filename: string): void {
  exportToCsv(filename, data);
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error || 'خطأ غير متوقع');
}

export function exportToCsv<T extends Record<string, unknown>>(
  filename: string,
  data: T[],
  columns?: { key: string; label: string }[]
): void {
  if (!data || data.length === 0) return;
  const cols = columns || Object.keys(data[0]).map((k) => ({ key: k, label: k }));
  const csvRows: string[] = [];

  // Add header row
  csvRows.push(cols.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(','));

  // Add data rows with escape handling
  for (const row of data) {
    const values = cols.map((c) => {
      const val = row[c.key];
      if (val === null || val === undefined) return '""';
      const escaped = String(val).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  // Prepend UTF-8 BOM so Excel on Windows properly displays Arabic text
  const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  void downloadCsvFile(cleanFilename, csvRows.join('\n'));
}
