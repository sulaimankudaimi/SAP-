import * as XLSX from 'xlsx';
import type { ReportColumn } from '../../../types/models';

export class ExportService {
  /**
   * Exports data to a Microsoft Excel (.xlsx) file with Arabic header styling and RTL sheet direction.
   */
  static exportToExcel(params: {
    fileName: string;
    sheetName?: string;
    title: string;
    columns: ReportColumn[];
    data: Record<string, unknown>[];
    totals?: Record<string, unknown>;
  }): void {
    const { fileName, sheetName = 'تقرير', title, columns, data, totals } = params;

    // Build headers row
    const headerRow = columns.map((col) => col.header);

    // Build data rows
    const dataRows = data.map((row) => {
      return columns.map((col) => {
        const val = row[col.key];
        if (val === undefined || val === null) return '';
        if (col.type === 'currency' || col.type === 'number' || col.type === 'percentage') {
          return typeof val === 'number' ? val : Number(val) || 0;
        }
        return String(val);
      });
    });

    // Optional totals row
    if (totals) {
      const totalsRow = columns.map((col, idx) => {
        if (idx === 0) return 'الإجمالي';
        const val = totals[col.key];
        if (val !== undefined && val !== null) {
          return typeof val === 'number' ? val : Number(val) || '';
        }
        return '';
      });
      dataRows.push(totalsRow);
    }

    // Combine into sheet data
    const wsData = [
      [title], // Row 1: Title
      [`تاريخ التصدير: ${new Date().toLocaleString('ar-SA')}`], // Row 2: Metadata
      [], // Empty row
      headerRow, // Row 4: Column Headers
      ...dataRows, // Data
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set Right-To-Left (RTL) mode for Arabic
    ws['!views'] = [{ RTL: true }];

    // Auto calculate column widths
    const colWidths = columns.map((col, idx) => {
      let maxLen = col.header.length * 2;
      for (const row of data) {
        const strVal = String(row[col.key] || '');
        if (strVal.length > maxLen) maxLen = Math.min(strVal.length, 35);
      }
      return { wch: Math.max(maxLen + 3, 14) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));

    const finalFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
    XLSX.writeFile(wb, finalFileName);
  }

  /**
   * Triggers a clean print-friendly layout.
   */
  static printReport(): void {
    window.print();
  }
}
