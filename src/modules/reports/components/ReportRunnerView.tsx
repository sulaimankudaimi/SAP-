import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { ReportCatalogService } from '../services/ReportCatalogService';
import { ExportService } from '../services/ExportService';
import { useToast } from '../../../components/ui/Toast';
import type { ReportDefinition } from '../../../types/models';
import {
  FileSpreadsheet,
  Printer,
  Camera,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  Bookmark,
  Calendar,
  Layers,
} from 'lucide-react';

interface ReportRunnerViewProps {
  reportId: string;
  onBackToCatalog: () => void;
}

export const ReportRunnerView: React.FC<ReportRunnerViewProps> = ({
  reportId,
  onBackToCatalog,
}) => {
  const { toast } = useToast();
  const [report, setReport] = useState<ReportDefinition | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [totals, setTotals] = useState<Record<string, unknown>>({});
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Sorting
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Snapshot modal
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [snapshotNotes, setSnapshotNotes] = useState('');
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const loadReportData = async () => {
    setIsLoading(true);
    try {
      const catalog = ReportCatalogService.getCatalog();
      const def = catalog.find((r) => r.id === reportId);
      if (!def) throw new Error('التقرير غير موجود.');
      setReport(def);

      ReportCatalogService.recordRecentReport(reportId);

      const res = await ReportCatalogService.executeReport(reportId, filters);
      setRows(res.rows);
      setTotals(res.totals);
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : 'فشل تنفيذ التقرير', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [reportId]);

  const handleFilterChange = (key: string, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleApplyFilters = () => {
    setCurrentPage(1);
    loadReportData();
  };

  const handleResetFilters = () => {
    setFilters({});
    setCurrentPage(1);
    setTimeout(() => {
      loadReportData();
    }, 50);
  };

  const handleSort = (columnKey: string) => {
    if (sortKey === columnKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(columnKey);
      setSortDirection('asc');
    }
  };

  // Sort rows
  const sortedRows = [...rows].sort((a, b) => {
    if (!sortKey) return 0;
    const valA = a[sortKey];
    const valB = b[sortKey];
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    }
    const strA = String(valA || '');
    const strB = String(valB || '');
    return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
  });

  const totalPages = Math.ceil(sortedRows.length / pageSize) || 1;
  const paginatedRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExportExcel = () => {
    if (!report) return;
    try {
      ExportService.exportToExcel({
        fileName: `${report.code}_${new Date().toISOString().substring(0, 10)}`,
        title: `${report.code} - ${report.title}`,
        columns: report.columns,
        data: sortedRows,
        totals,
      });
      toast({ title: 'تم تصدير التقرير إلى ملف Excel بنجاح', type: 'success' });
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : 'فشل التصدير إلى Excel', type: 'error' });
    }
  };

  const handleSaveSnapshot = async () => {
    if (!report) return;
    setIsSavingSnapshot(true);
    try {
      await ReportCatalogService.saveSnapshot({
        reportId: report.id,
        appliedFilters: filters,
        data: sortedRows,
        totals,
        notes: snapshotNotes,
        userId: 'usr-admin-1',
      });
      toast({ title: 'تم حفظ اللقطة الدورية للتقرير بنجاح في قاعدة البيانات', type: 'success' });
      setIsSnapshotModalOpen(false);
      setSnapshotNotes('');
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : 'فشل حفظ اللقطة', type: 'error' });
    } finally {
      setIsSavingSnapshot(false);
    }
  };

  if (!report) {
    return (
      <div className="p-12 text-center text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
        جاري تحميل بنية التقرير...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={onBackToCatalog}
            className="gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 border-slate-300"
          >
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            <span>العودة للكتالوج</span>
          </Button>

          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#0B2545] text-white rounded text-xs font-mono font-bold">
                {report.code}
              </span>
              <h1 className="text-xl font-bold text-[#0B2545]">{report.title}</h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{report.description}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportExcel}
            className="gap-2 text-xs font-bold text-emerald-800 border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100/80"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>تصدير Excel (.xlsx)</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => ExportService.printReport()}
            className="gap-2 text-xs font-bold text-slate-700 border-slate-300 hover:bg-slate-100"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>طباعة PDF</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsSnapshotModalOpen(true)}
            className="gap-2 text-xs font-bold text-blue-700 border-blue-200 bg-blue-50/50 hover:bg-blue-100"
          >
            <Camera className="w-4 h-4 text-blue-600" />
            <span>حفظ لقطة دورية (Snapshot)</span>
          </Button>
        </div>
      </div>

      {/* Dynamic Filters Bar */}
      {report.filters.length > 0 && (
        <Card className="p-4 border border-slate-200/80 bg-slate-50/50">
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div className="flex items-center flex-wrap gap-3 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 ms-1">
                <Filter className="w-3.5 h-3.5" />
                <span>معايير التصفية:</span>
              </div>

              {report.filters.map((f) => {
                if (f.type === 'select') {
                  return (
                    <div key={f.key} className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 block">{f.label}</label>
                      <select
                        value={String(filters[f.key] || '')}
                        onChange={(e) => handleFilterChange(f.key, e.target.value)}
                        className="h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-600"
                      >
                        {f.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }

                return (
                  <div key={f.key} className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 block">{f.label}</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={String(filters[f.key] || '')}
                        onChange={(e) => handleFilterChange(f.key, e.target.value)}
                        placeholder="ابحث..."
                        className="h-8 ps-2.5 pe-7 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600"
                      />
                      <Search className="w-3.5 h-3.5 absolute end-2.5 top-2.5 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleApplyFilters}
                className="bg-emerald-600 hover:bg-emerald-700 text-xs font-bold gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تطبيق الفلاتر</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                إعادة ضبط
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Main Report Table */}
      <Card className="border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="bg-[#0B2545] text-white font-bold border-b border-[#13315C]">
                <th className="py-3 px-3.5 text-start w-12">#</th>
                {report.columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    className={`py-3 px-3.5 whitespace-nowrap ${
                      col.align === 'end' ? 'text-end' : col.align === 'center' ? 'text-center' : 'text-start'
                    } ${col.sortable ? 'cursor-pointer hover:bg-white/10 transition-colors' : ''}`}
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span>{col.header}</span>
                      {col.sortable && sortKey === col.key && (
                        <span className="text-[10px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-sans">
              {isLoading ? (
                <tr>
                  <td colSpan={report.columns.length + 1} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    جاري استخراج ومعالجة بيانات التقرير...
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={report.columns.length + 1} className="py-12 text-center text-slate-400">
                    لا توجد سجلات تطابق معايير التصفية المحددة.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3.5 text-slate-400 font-mono text-[11px]">
                      {(currentPage - 1) * pageSize + rowIdx + 1}
                    </td>
                    {report.columns.map((col) => {
                      const val = row[col.key];

                      return (
                        <td
                          key={col.key}
                          className={`py-2.5 px-3.5 whitespace-nowrap ${
                            col.align === 'end'
                              ? 'text-end'
                              : col.align === 'center'
                              ? 'text-center'
                              : 'text-start'
                          }`}
                        >
                          {col.type === 'currency' ? (
                            <span className="font-mono font-bold text-slate-800">
                              {typeof val === 'number'
                                ? `${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`
                                : '—'}
                            </span>
                          ) : col.type === 'number' ? (
                            <span className="font-mono font-bold text-slate-700">
                              {typeof val === 'number' ? val.toLocaleString('en-US') : String(val ?? '—')}
                            </span>
                          ) : col.type === 'percentage' ? (
                            <span className="font-mono font-bold text-emerald-700">
                              {typeof val === 'number' ? `${val}%` : String(val ?? '—')}
                            </span>
                          ) : col.type === 'badge' ? (
                            <Badge variant={val === 'approved' || val === 'completed' || val === 'مكتمل' || val === 'Active' || val === 'طبيعي' ? 'approved' : 'pending'}>
                              {String(val ?? '—')}
                            </Badge>
                          ) : col.type === 'date' ? (
                            <span className="font-mono text-slate-600">{String(val ?? '—')}</span>
                          ) : (
                            <span className="text-slate-800 font-medium">{String(val ?? '—')}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>

            {/* Totals Row */}
            {Object.keys(totals).length > 0 && !isLoading && (
              <tfoot>
                <tr className="bg-slate-100/90 font-bold border-t-2 border-slate-300 text-slate-900">
                  <td className="py-3 px-3.5 text-center text-xs">∑</td>
                  {report.columns.map((col, idx) => {
                    const totalVal = totals[col.key];
                    if (idx === 0) {
                      return (
                        <td key={col.key} className="py-3 px-3.5 text-slate-900 font-bold text-xs">
                          إجمالي النتائج ({rows.length} سجل)
                        </td>
                      );
                    }
                    return (
                      <td
                        key={col.key}
                        className={`py-3 px-3.5 whitespace-nowrap text-xs font-mono font-bold ${
                          col.align === 'end' ? 'text-end text-[#0B2545]' : 'text-start'
                        }`}
                      >
                        {totalVal !== undefined && col.type === 'currency'
                          ? `${Number(totalVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`
                          : totalVal !== undefined && col.type === 'number'
                          ? Number(totalVal).toLocaleString('en-US')
                          : ''}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            عرض الصفحة <span className="font-bold text-slate-800">{currentPage}</span> من{' '}
            <span className="font-bold text-slate-800">{totalPages}</span> (إجمالي{' '}
            <span className="font-bold text-slate-800">{sortedRows.length}</span> سجل)
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 text-xs"
            >
              السابق
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 text-xs"
            >
              التالي
            </Button>
          </div>
        </div>
      </Card>

      {/* Snapshot Save Modal */}
      {isSnapshotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">حفظ لقطة دورية للتقرير (Snapshot)</h3>
                <p className="text-xs text-slate-500">حفظ نسخة مؤرشفة من بيانات التقرير الحالية للرجوع إليها مستقبلاً.</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1 font-mono text-slate-700">
                <div>التقرير: <span className="font-bold">{report.title}</span> ({report.code})</div>
                <div>عدد السجلات: <span className="font-bold">{sortedRows.length}</span> سجل</div>
                <div>التاريخ: <span className="font-bold">{new Date().toLocaleString('ar-SA')}</span></div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">ملاحظات توثيقية إضافية (اختياري)</label>
                <textarea
                  value={snapshotNotes}
                  onChange={(e) => setSnapshotNotes(e.target.value)}
                  placeholder="مثال: لقطة نهاية الربع الثالث لإقفال حسابات التوريد..."
                  rows={3}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-600 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsSnapshotModalOpen(false)}
                disabled={isSavingSnapshot}
              >
                إلغاء
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveSnapshot}
                disabled={isSavingSnapshot}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1.5"
              >
                {isSavingSnapshot ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Bookmark className="w-3.5 h-3.5" />}
                <span>تأكيد حفظ اللقطة</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
