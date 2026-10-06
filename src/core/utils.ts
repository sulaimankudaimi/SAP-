import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// Fixed Western digits formatter (0-9) as mandated by PROJECT_RULES.md
const westernNumberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const westernCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'decimal',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatNumber(value: number): string {
  if (isNaN(value)) return '0';
  return westernNumberFormatter.format(value);
}

export function formatCurrency(value: number, currency: string = 'SAR'): string {
  if (isNaN(value)) return `0.00 ${currency}`;
  return `${westernCurrencyFormatter.format(value)} ${currency}`;
}

export function formatDate(date: string | Date, pattern: string = 'yyyy-MM-dd'): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, pattern);
  } catch {
    return String(date);
  }
}

import { downloadCsvFile } from './utils/fileDownloader';

export function exportToCSV<T extends Record<string, unknown>>(data: T[], filename: string): void {
  exportToCsv(filename, data);
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

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return 'حدث خطأ غير متوقع';
}
