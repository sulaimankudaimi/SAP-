export interface ValidationResult<T> {
  totalRows: number;
  validRows: T[];
  invalidRows: {
    rowNumber: number;
    raw: Record<string, string>;
    errors: string[];
  }[];
  summary: {
    validCount: number;
    errorCount: number;
  };
}

export class ImportExportService {
  /**
   * Parses raw CSV string into an array of objects.
   */
  static parseCSV(csvText: string): Record<string, string>[] {
    const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const currentLine = lines[i];
      // Regex parsing handling comma inside quotes
      const values: string[] = [];
      let inQuotes = false;
      let currentValue = '';

      for (let c = 0; c < currentLine.length; c++) {
        const char = currentLine[c];
        if (char === '"' && (c === 0 || currentLine[c - 1] !== '\\')) {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue.trim().replace(/^"|"$/g, ''));
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim().replace(/^"|"$/g, ''));

      const rowObj: Record<string, string> = {};
      headers.forEach((header, idx) => {
        rowObj[header] = values[idx] || '';
      });
      rows.push(rowObj);
    }

    return rows;
  }

  /**
   * Generates sample CSV template string with UTF-8 BOM.
   */
  static generateTemplate(headers: { key: string; labelAr: string; example: string }[]): string {
    const headerLine = headers.map((h) => `"${h.key}"`).join(',');
    const exampleLine = headers.map((h) => `"${h.example}"`).join(',');
    return '\uFEFF' + `${headerLine}\n${exampleLine}\n`;
  }

  /**
   * Validates parsed CSV rows against required schema rules (Dry Run).
   */
  static validateRows<T>(
    rows: Record<string, string>[],
    validators: {
      [key: string]: (val: string, row: Record<string, string>) => string | null;
    },
    transform: (row: Record<string, string>) => T
  ): ValidationResult<T> {
    const validRows: T[] = [];
    const invalidRows: ValidationResult<T>['invalidRows'] = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2; // 1-indexed header is row 1
      const errors: string[] = [];

      for (const [field, validateFn] of Object.entries(validators)) {
        const value = row[field] ?? '';
        const error = validateFn(value, row);
        if (error) {
          errors.push(error);
        }
      }

      if (errors.length > 0) {
        invalidRows.push({ rowNumber, raw: row, errors });
      } else {
        try {
          const transformed = transform(row);
          validRows.push(transformed);
        } catch (err) {
          invalidRows.push({
            rowNumber,
            raw: row,
            errors: [`خطأ تحويل البيانات: ${err instanceof Error ? err.message : String(err)}`],
          });
        }
      }
    });

    return {
      totalRows: rows.length,
      validRows,
      invalidRows,
      summary: {
        validCount: validRows.length,
        errorCount: invalidRows.length,
      },
    };
  }
}
