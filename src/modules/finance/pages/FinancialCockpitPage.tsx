import { DiagnosticLogger } from '../../../core/services/DiagnosticLogger';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { StatCard } from '../../../components/ui/StatCard';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs';
import { useToast } from '../../../components/ui/Toast';
import { t } from '../../../i18n/ar';
import { db } from '../../../core/db';
import { FinanceService } from '../services/FinanceService';
import { FinancialStatementsService } from '../services/FinancialStatementsService';
import { JournalEntryModal } from '../components/JournalEntryModal';
import { JournalDetailModal } from '../components/JournalDetailModal';
import type { JournalEntry } from '../../../types/models';
import {
  Landmark,
  FileText,
  CreditCard,
  TrendingUp,
  AlertCircle,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
  BarChart3,
  Sliders,
} from 'lucide-react';

export const FinancialCockpitPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // KPIs
  const [totalCash, setTotalCash] = useState(0);
  const [totalApDue, setTotalApDue] = useState(0);
  const [totalArReceivable, setTotalArReceivable] = useState(0);
  const [netIncomeYtd, setNetIncomeYtd] = useState(0);
  const [openPeriod, setOpenPeriod] = useState<string>('الفترة 10/2026');
  const [recentEntries, setRecentEntries] = useState<JournalEntry[]>([]);
  const [blockedInvoicesCount, setBlockedInvoicesCount] = useState(0);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await FinanceService.initFiscalPeriods('2026');
      await FinanceService.seedFinanceIfEmpty();

      // 1. Financial statements summary
      const inc = await FinancialStatementsService.getIncomeStatement('2026');
      setNetIncomeYtd(inc.netIncome);

      // 2. Cash and bank balance (101xxx)
      const tb = await FinancialStatementsService.getTrialBalance('2026');
      const cashAcc = tb.items.find((i) => i.accountNumber === '101010');
      const pettyCash = tb.items.find((i) => i.accountNumber === '101020');
      setTotalCash((cashAcc?.balance || 0) + (pettyCash?.balance || 0));

      // 3. AP Due
      const invoices = await db.vendorInvoices
        .filter((inv) => !inv.isDeleted && inv.paymentStatus !== 'Paid')
        .toArray();
      const apTotal = invoices.reduce((acc, inv) => acc + inv.totalAmount, 0);
      setTotalApDue(apTotal);

      const blockedCount = invoices.filter((inv) => !!inv.isPaymentBlocked).length;
      setBlockedInvoicesCount(blockedCount);

      // 4. AR Receivable
      const arInvoices = await db.customerInvoices
        .filter((inv) => !inv.isDeleted && inv.paymentStatus !== 'Paid')
        .toArray();
      const arTotal = arInvoices.reduce((acc, inv) => acc + inv.totalAmount, 0);
      setTotalArReceivable(arTotal);

      // 5. Recent journal entries
      const entries = await FinanceService.getJournalEntries();
      setRecentEntries(entries.slice(0, 8));

      // 6. Current open period
      const currentMonth = new Date().getMonth() + 1;
      const periodRec = await db.fiscalPeriods
        .where({ fiscalYear: '2026', period: currentMonth })
        .first();
      setOpenPeriod(
        periodRec?.status === 'Open'
          ? `فترة ${currentMonth} / 2026 (مفتوحة)`
          : `فترة ${currentMonth} / 2026 (مقفلة)`
      );
    } catch (e: unknown) {
      DiagnosticLogger.error('FinancialCockpitPage', 'Error occurred', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header & Quick Action Buttons */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumbs
            items={[
              { label: t('nav_home'), path: '/' },
              { label: t('nav_finance'), path: '/finance' },
              { label: 'لوحة القيادة المالية والرقابة' },
            ]}
          />
          <h1 className="text-2xl font-black text-[#0B2545] tracking-tight mt-1">
            {t('fi_title')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            المركز المالي الموحد، دفتر الأستاذ العام، مطابقة الفواتير، ومحاسبة التكاليف وفق معايير المحاسبة الدولية
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => navigate('/finance/statements')}
            className="gap-2 border-slate-300 font-bold"
          >
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <span>القوائم المالية الختامية</span>
          </Button>

          <Button
            variant="secondary"
            onClick={() => navigate('/finance/ap')}
            className="gap-2 border-slate-300 font-bold"
          >
            <CreditCard className="w-4 h-4 text-amber-600" />
            <span>مقترحات السداد (F110)</span>
          </Button>

          <Button
            onClick={() => setIsEntryModalOpen(true)}
            className="bg-[#0FA37F] hover:bg-[#0c8a6c] gap-2 font-bold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>{t('fi_btn_new_je')}</span>
          </Button>
        </div>
      </div>

      {/* Blocked Invoices Alert if any */}
      {blockedInvoicesCount > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-center justify-between text-amber-900">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold text-xs">
                يوجد {blockedInvoicesCount} فواتير موردين محجوبة عن الصرف لوجود فروقات مطابقة ثلاثية (MRBR)
              </span>
              <p className="text-[11px] text-amber-700 mt-0.5">
                تتطلب الفواتير مراجعة الفروقات السعرية أو الكمية والاعتماد الإداري لفك الحظر.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate('/finance/ap')}
            className="border-amber-300 text-amber-900 font-bold bg-white"
          >
            فتح قائمة الفواتير المحجوبة ←
          </Button>
        </div>
      )}

      {/* Financial KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="السيولة والنقدية بالبنوك"
          value={`${totalCash.toLocaleString('en-US')} ر.س`}
          subtitle="حسابات العمليات والتحصيل"
          icon={<Landmark className="w-5 h-5 text-emerald-600" />}
        />
        <StatCard
          label="مستحقات الموردين المفتوحة (AP)"
          value={`${totalApDue.toLocaleString('en-US')} ر.س`}
          subtitle="فواتير شراء مستحقة"
          icon={<CreditCard className="w-5 h-5 text-amber-600" />}
        />
        <StatCard
          label="ذمم العملاء المدينة (AR)"
          value={`${totalArReceivable.toLocaleString('en-US')} ر.س`}
          subtitle="مبيعات طاقة قيد التحصيل"
          icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
        />
        <StatCard
          label="صافي الدخل التشغيلي (YTD)"
          value={`${netIncomeYtd.toLocaleString('en-US')} ر.س`}
          subtitle={openPeriod}
          icon={<ShieldCheck className="w-5 h-5 text-[#0B2545]" />}
        />
      </div>

      {/* Navigation Sub-Cockpit Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card
          onClick={() => navigate('/finance/journal')}
          className="p-4 hover:shadow-md transition-all cursor-pointer border border-slate-200 hover:border-emerald-300 space-y-2 group"
        >
          <div className="flex items-center justify-between text-slate-400 group-hover:text-emerald-600 transition-colors">
            <span className="font-bold text-xs text-slate-700 group-hover:text-emerald-700">سجل قيود اليومية</span>
            <FileText className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-[11px] text-slate-500">إدخال القيود اليدوية FB50، المسودات FBV1، وعكس القيود FB08</p>
        </Card>

        <Card
          onClick={() => navigate('/finance/cost-centers')}
          className="p-4 hover:shadow-md transition-all cursor-pointer border border-slate-200 hover:border-blue-300 space-y-2 group"
        >
          <div className="flex items-center justify-between text-slate-400 group-hover:text-blue-600 transition-colors">
            <span className="font-bold text-xs text-slate-700 group-hover:text-blue-700">محاسبة التكاليف (Controlling)</span>
            <Layers className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-[11px] text-slate-500">شجرة مراكز التكلفة، الفروقات التقديرية، ودورات توزيع الأعباء KSU5</p>
        </Card>

        <Card
          onClick={() => navigate('/finance/budgets')}
          className="p-4 hover:shadow-md transition-all cursor-pointer border border-slate-200 hover:border-purple-300 space-y-2 group"
        >
          <div className="flex items-center justify-between text-slate-400 group-hover:text-purple-600 transition-colors">
            <span className="font-bold text-xs text-slate-700 group-hover:text-purple-700">الرقابة على الميزانيات</span>
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-[11px] text-slate-500">تتبع الارتباطات (Commitments) وفحص إتاحة الميزانية للمشتريات</p>
        </Card>

        <Card
          onClick={() => navigate('/finance/period-end')}
          className="p-4 hover:shadow-md transition-all cursor-pointer border border-slate-200 hover:border-amber-300 space-y-2 group"
        >
          <div className="flex items-center justify-between text-slate-400 group-hover:text-amber-600 transition-colors">
            <span className="font-bold text-xs text-slate-700 group-hover:text-amber-700">إقفال الفترات والـ GR/IR</span>
            <Calendar className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-[11px] text-slate-500">فتح وقفل الشهور المالية، مقاصة بضائع واردة، وقائمة التدقيق</p>
        </Card>
      </div>

      {/* Recent Journal Entries Table */}
      <Card className="overflow-hidden border border-slate-200">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-800">أحدث القيود المحاسبية المرحلة بدفتر الأستاذ العام</h3>
            <p className="text-xs text-slate-500">مستندات متوازنة بالكامل مدعومة بسند القيد والتوثيق المحاسبي</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/finance/journal')}
            className="text-xs font-bold text-emerald-700 border-emerald-200 hover:bg-emerald-50"
          >
            عرض سجل القيود كاملاً (FB03) ←
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 text-start">رقم المستند</th>
                <th className="py-2.5 px-3 text-start">النوع</th>
                <th className="py-2.5 px-3 text-start">تاريخ الترحيل</th>
                <th className="py-2.5 px-3 text-start">البيان التوضيحي</th>
                <th className="py-2.5 px-3 text-start">المرجع</th>
                <th className="py-2.5 px-3 text-end">إجمالي القيد</th>
                <th className="py-2.5 px-3 text-center">الحالة</th>
                <th className="py-2.5 px-3 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {recentEntries.map((je) => (
                <tr key={je.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{je.docNumber}</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                    <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                      {je.documentType}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">{je.postingDate}</td>
                  <td className="py-2.5 px-3 font-medium text-slate-800 max-w-xs truncate">{je.headerText}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">{je.reference || '—'}</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-end text-emerald-800">
                    {je.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س
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
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modals */}
      <JournalEntryModal
        isOpen={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
        onSuccess={loadData}
      />

      <JournalDetailModal
        entry={selectedEntry}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onReversed={loadData}
      />
    </div>
  );
};
