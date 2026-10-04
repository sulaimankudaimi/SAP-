import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { StatCard } from '../../../components/ui/StatCard';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs';
import { useToast } from '../../../components/ui/Toast';
import { t } from '../../../i18n/ar';
import { FinanceService } from '../services/FinanceService';
import { JournalEntryModal } from '../components/JournalEntryModal';
import { JournalDetailModal } from '../components/JournalDetailModal';
import type { JournalEntry } from '../../../types/models';
import {
  FileText,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Bookmark,
  RotateCcw,
  BookOpen,
} from 'lucide-react';

export const JournalEntriesPage: React.FC = () => {
  const { toast } = useToast();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const loadEntries = async () => {
    setIsLoading(true);
    try {
      await FinanceService.seedFinanceIfEmpty();
      const data = await FinanceService.getJournalEntries();
      setEntries(data);
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : 'فشل تحميل قيود اليومية', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  // Filtered entries
  const filtered = entries.filter((je) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const match =
        je.docNumber.toLowerCase().includes(term) ||
        je.headerText.toLowerCase().includes(term) ||
        (je.reference && je.reference.toLowerCase().includes(term));
      if (!match) return false;
    }
    if (docTypeFilter && je.documentType !== docTypeFilter) return false;
    if (statusFilter) {
      if (statusFilter === 'parked' && !je.isParked) return false;
      if (statusFilter === 'posted' && (je.isParked || je.isReversed)) return false;
      if (statusFilter === 'reversed' && !je.isReversed) return false;
    }
    if (periodFilter && je.period !== Number(periodFilter)) return false;
    return true;
  });

  const totalDebitSum = filtered.reduce((acc, je) => acc + je.totalDebit, 0);
  const parkedCount = filtered.filter((je) => je.isParked).length;
  const reversedCount = filtered.filter((je) => je.isReversed).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumbs
            items={[
              { label: t('nav_home'), path: '/' },
              { label: t('nav_finance'), path: '/finance' },
              { label: 'سجل قيود اليومية ودفتر الأستاذ' },
            ]}
          />
          <h1 className="text-2xl font-black text-[#0B2545] tracking-tight mt-1">
            {t('fi_journal_title')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            استعراض وترحيل قيود اليومية العامة (FB50)، المسودات المؤقتة (FBV1)، والقيود العكسية (FB08)
          </p>
        </div>

        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-[#0FA37F] hover:bg-[#0c8a6c] gap-2 font-bold shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>{t('fi_btn_new_je')}</span>
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="إجمالي حركات القيود المعروضة"
          value={`${totalDebitSum.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س`}
          subtitle="مجموع العمليات المدينة والدائنة"
          icon={<BookOpen className="w-5 h-5 text-emerald-600" />}
        />
        <StatCard
          label="عدد القيود المسجلة"
          value={filtered.length.toString()}
          subtitle="مستندات محاسبية رسمية"
          icon={<FileText className="w-5 h-5 text-[#0B2545]" />}
        />
        <StatCard
          label="مسودات قيود محفوظة (Parked)"
          value={parkedCount.toString()}
          subtitle="بانتظار الاعتماد والترحيل (FBV0)"
          icon={<Bookmark className="w-5 h-5 text-amber-600" />}
        />
        <StatCard
          label="قيود معكوسة وملغاة (Storno)"
          value={reversedCount.toString()}
          subtitle="معالجة عبر قيود عكسية رسمية"
          icon={<RotateCcw className="w-5 h-5 text-red-600" />}
        />
      </div>

      {/* Filters Bar */}
      <Card className="p-4 border border-slate-200">
        <div className="grid grid-cols-4 gap-3 text-xs">
          <div>
            <label className="text-slate-500 font-bold block mb-1">بحث برقم المستند أو البيان أو المرجع</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute start-3 top-2.5 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث برقم القيد أو البيان..."
                className="ps-9 h-9 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-500 font-bold block mb-1">نوع المستند (SAP Doc Type)</label>
            <select
              value={docTypeFilter}
              onChange={(e) => setDocTypeFilter(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 h-9"
            >
              <option value="">جميع أنواع المستندات</option>
              <option value="SA">SA - قيود عامة (G/L)</option>
              <option value="KR">KR - فواتير موردين (Vendor Invoice)</option>
              <option value="KZ">KZ - سداد موردين (Payment)</option>
              <option value="WE">WE - استلام بضائع (Goods Receipt)</option>
              <option value="RE">RE - فاتورة بضاعة واردة (Invoice Receipt)</option>
              <option value="DR">DR - فواتير عملاء (Customer Invoice)</option>
              <option value="DZ">DZ - تحصيل عملاء (Customer Receipt)</option>
              <option value="AB">AB - قيود عكسية ومقاصة (Reversal)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-500 font-bold block mb-1">الحالة المحاسبية</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 h-9"
            >
              <option value="">جميع الحالات</option>
              <option value="posted">مرحل رسمي (Posted)</option>
              <option value="parked">مسودة محفوظة (Parked)</option>
              <option value="reversed">معكوس وملغي (Reversed)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-500 font-bold block mb-1">الفترة المالية (Period)</label>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 h-9"
            >
              <option value="">جميع الفترات (1-12)</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  فترة {i + 1}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Main Journal Entries Table */}
      <Card className="overflow-hidden border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 text-start">رقم المستند</th>
                <th className="py-2.5 px-3 text-start">النوع</th>
                <th className="py-2.5 px-3 text-start">السنة/الفترة</th>
                <th className="py-2.5 px-3 text-start">تاريخ الترحيل</th>
                <th className="py-2.5 px-3 text-start">تاريخ المستند</th>
                <th className="py-2.5 px-3 text-start">البيان التوضيحي للرأس</th>
                <th className="py-2.5 px-3 text-start">المرجع</th>
                <th className="py-2.5 px-3 text-end">إجمالي المدين</th>
                <th className="py-2.5 px-3 text-end">إجمالي الدائن</th>
                <th className="py-2.5 px-3 text-center">الحالة</th>
                <th className="py-2.5 px-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400 font-medium">
                    لا توجد قيود محاسبية مطابقة للبحث المحدد.
                  </td>
                </tr>
              ) : (
                filtered.map((je) => (
                  <tr key={je.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{je.docNumber}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                      <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                        {je.documentType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {je.fiscalYear} / {je.period}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{je.postingDate}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{je.documentDate}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-800 max-w-xs truncate">
                      {je.headerText}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{je.reference || '—'}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-end text-emerald-800">
                      {je.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-end text-blue-800">
                      {je.totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {je.isReversed ? (
                        <Badge variant="rejected">معكوس</Badge>
                      ) : je.isParked ? (
                        <Badge variant="in_progress">مسودة</Badge>
                      ) : (
                        <Badge variant="approved">مرحل</Badge>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedEntry(je);
                          setIsDetailModalOpen(true);
                        }}
                        className="text-[11px] h-7 px-2 font-bold hover:bg-slate-100"
                      >
                        عرض السند
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modals */}
      <JournalEntryModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadEntries}
      />

      <JournalDetailModal
        entry={selectedEntry}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onReversed={loadEntries}
      />
    </div>
  );
};
