import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { StatCard } from '../../../components/ui/StatCard';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Tabs } from '../../../components/ui/Tabs';
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs';
import { useToast } from '../../../components/ui/Toast';
import { t } from '../../../i18n/ar';
import {
  FinancialStatementsService,
  TrialBalanceItem,
  BalanceSheetData,
  IncomeStatementData,
  CashFlowData,
} from '../services/FinancialStatementsService';
import {
  Printer,
  Download,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Scale,
  Calendar,
} from 'lucide-react';

export const FinancialStatementsPage: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('trial-balance');
  const [fiscalYear, setFiscalYear] = useState('2026');
  const [selectedPeriod, setSelectedPeriod] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  // Statement Data
  const [trialBalance, setTrialBalance] = useState<{
    items: TrialBalanceItem[];
    totalPeriodDebit: number;
    totalPeriodCredit: number;
    totalClosingDebit: number;
    totalClosingCredit: number;
    isZeroSum: boolean;
  }>({
    items: [],
    totalPeriodDebit: 0,
    totalPeriodCredit: 0,
    totalClosingDebit: 0,
    totalClosingCredit: 0,
    isZeroSum: true,
  });

  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetData | null>(null);
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatementData | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowData | null>(null);

  const loadStatements = async () => {
    setIsLoading(true);
    try {
      const tb = await FinancialStatementsService.getTrialBalance(fiscalYear, selectedPeriod);
      setTrialBalance(tb);

      const bs = await FinancialStatementsService.getBalanceSheet(fiscalYear, selectedPeriod);
      setBalanceSheet(bs);

      const inc = await FinancialStatementsService.getIncomeStatement(fiscalYear, selectedPeriod);
      setIncomeStatement(inc);

      const cf = await FinancialStatementsService.getCashFlowStatement(fiscalYear, selectedPeriod);
      setCashFlow(cf);
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : 'فشل تحميل القوائم المالية', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatements();
  }, [fiscalYear, selectedPeriod]);

  const handleExportCsv = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    if (activeTab === 'trial-balance') {
      csvContent += 'رقم الحساب,اسم الحساب,التصنيف,حركة مدين,حركة دائن,رصيد مدين,رصيد دائن\n';
      trialBalance.items.forEach((it) => {
        csvContent += `"${it.accountNumber}","${it.accountName}","${it.category}",${it.periodDebit},${it.periodCredit},${it.closingDebit},${it.closingCredit}\n`;
      });
    } else if (activeTab === 'balance-sheet' && balanceSheet) {
      csvContent += 'البند,رقم الحساب,المبلغ (ر.س)\n';
      csvContent += 'الأصول المتداولة\n';
      balanceSheet.currentAssets.forEach((a) => {
        csvContent += `"${a.name}","${a.accountNumber}",${a.amount}\n`;
      });
      csvContent += `إجمالي الأصول,,"${balanceSheet.totalAssets}"\n`;
    } else if (activeTab === 'income-statement' && incomeStatement) {
      csvContent += 'البند,رقم الحساب,المبلغ (ر.س)\n';
      incomeStatement.revenues.forEach((r) => {
        csvContent += `"${r.name}","${r.accountNumber}",${r.amount}\n`;
      });
      csvContent += `صافي الدخل,,${incomeStatement.netIncome}\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${activeTab}_${fiscalYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'تم تصدير التقرير المالي إلى ملف CSV بنجاح', type: 'success' });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumbs
            items={[
              { label: t('nav_home'), path: '/' },
              { label: t('nav_finance'), path: '/finance' },
              { label: 'القوائم المالية والتقارير الختامية' },
            ]}
          />
          <h1 className="text-2xl font-black text-[#0B2545] tracking-tight mt-1">
            {t('fi_statements_title')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            ميزان المراجعة بالمجاميع والأرصدة، الميزانية العمومية، قائمة الدخل، والتدفقات النقدية وفق المعايير الدولية
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handlePrint} className="gap-2 border-slate-300 font-bold">
            <Printer className="w-4 h-4" />
            <span>طباعة القائمة</span>
          </Button>

          <Button
            onClick={handleExportCsv}
            className="bg-[#0FA37F] hover:bg-[#0c8a6c] gap-2 font-bold shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>تصدير إلى Excel/CSV</span>
          </Button>
        </div>
      </div>

      {/* Period & Filter Control Card */}
      <Card className="p-4 border border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <label className="text-slate-500 font-bold">السنة المالية:</label>
            <select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-slate-500 font-bold">حتى الفترة المالية:</label>
            <select
              value={selectedPeriod || ''}
              onChange={(e) => setSelectedPeriod(e.target.value ? Number(e.target.value) : undefined)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">كامل العام التراكمي (YTD)</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  فترة {i + 1}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Zero-Sum Balance Badge Indicator */}
        <div className="flex items-center gap-3 font-mono text-xs">
          {trialBalance.isZeroSum ? (
            <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 font-sans font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>ميزان المراجعة متطابق صفر المتغيرات (Zero-Sum Balanced ✓)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-rose-800 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 font-sans font-bold">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>يوجد فارق في توازن القيود المحاسبية</span>
            </div>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'trial-balance', label: 'ميزان المراجعة بالمجاميع والأرصدة (Trial Balance)' },
          { id: 'balance-sheet', label: 'الميزانية العمومية والمركز المالي (Balance Sheet)' },
          { id: 'income-statement', label: 'قائمة الدخل والأرباح والخسائر (Income Statement)' },
          { id: 'cash-flow', label: 'قائمة التدفقات النقدية غير المباشرة (Cash Flow)' },
        ]}
      />

      {/* Tab 1: Trial Balance */}
      {activeTab === 'trial-balance' && (
        <Card className="overflow-hidden border border-slate-200">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 text-start">رقم الحساب</th>
                <th className="py-2.5 px-3 text-start">اسم الحساب</th>
                <th className="py-2.5 px-3 text-start">التصنيف</th>
                <th className="py-2.5 px-3 text-end">حركة مدين (Debit)</th>
                <th className="py-2.5 px-3 text-end">حركة دائن (Credit)</th>
                <th className="py-2.5 px-3 text-end">رصيد ختامي مدين</th>
                <th className="py-2.5 px-3 text-end">رصيد ختامي دائن</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {trialBalance.items.map((it) => (
                <tr key={it.accountNumber} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{it.accountNumber}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">{it.accountName}</td>
                  <td className="py-2.5 px-3 text-slate-500">{it.category}</td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-end text-emerald-800">
                    {it.periodDebit > 0 ? it.periodDebit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-end text-blue-800">
                    {it.periodCredit > 0 ? it.periodCredit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-end text-emerald-900">
                    {it.closingDebit > 0 ? it.closingDebit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-end text-blue-900">
                    {it.closingCredit > 0 ? it.closingCredit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
              <tr>
                <td colSpan={3} className="py-3 px-3 text-slate-800">
                  المجموع العام المتوازن (Total Zero-Sum):
                </td>
                <td className="py-3 px-3 text-end font-mono text-emerald-900 text-sm">
                  {trialBalance.totalPeriodDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س
                </td>
                <td className="py-3 px-3 text-end font-mono text-blue-900 text-sm">
                  {trialBalance.totalPeriodCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س
                </td>
                <td className="py-3 px-3 text-end font-mono text-emerald-900 text-sm">
                  {trialBalance.totalClosingDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س
                </td>
                <td className="py-3 px-3 text-end font-mono text-blue-900 text-sm">
                  {trialBalance.totalClosingCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      {/* Tab 2: Balance Sheet */}
      {activeTab === 'balance-sheet' && balanceSheet && (
        <div className="grid grid-cols-2 gap-6">
          {/* Assets Side */}
          <Card className="p-4 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-600" />
                الأصول (Assets)
              </h3>
              <span className="font-mono font-bold text-sm text-emerald-800">
                {balanceSheet.totalAssets.toLocaleString('en-US')} ر.س
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <span className="font-bold text-slate-500 block">الأصول المتداولة (Current Assets):</span>
                <div className="divide-y divide-slate-100 border rounded-xl overflow-hidden">
                  {balanceSheet.currentAssets.map((a) => (
                    <div key={a.accountNumber} className="py-2 px-3 flex justify-between">
                      <span className="text-slate-800">{a.name} ({a.accountNumber})</span>
                      <span className="font-mono font-bold text-slate-900">{a.amount.toLocaleString('en-US')} ر.س</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-500 block">الأصول الثابتة وغير المتداولة (Fixed Assets):</span>
                <div className="divide-y divide-slate-100 border rounded-xl overflow-hidden">
                  {balanceSheet.fixedAssets.map((a) => (
                    <div key={a.accountNumber} className="py-2 px-3 flex justify-between">
                      <span className="text-slate-800">{a.name} ({a.accountNumber})</span>
                      <span className="font-mono font-bold text-slate-900">{a.amount.toLocaleString('en-US')} ر.س</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t flex justify-between font-bold text-sm bg-emerald-50/70 p-3 rounded-xl border-emerald-200 text-emerald-950 font-mono">
              <span className="font-sans">إجمالي الأصول الموحدة:</span>
              <span>{balanceSheet.totalAssets.toLocaleString('en-US')} ر.س</span>
            </div>
          </Card>

          {/* Liabilities & Equity Side */}
          <Card className="p-4 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Scale className="w-4 h-4 text-blue-600" />
                الالتزامات وحقوق الملكية (Liabilities & Equity)
              </h3>
              <span className="font-mono font-bold text-sm text-blue-800">
                {balanceSheet.totalLiabilitiesAndEquity.toLocaleString('en-US')} ر.س
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <span className="font-bold text-slate-500 block">الالتزامات المتداولة (Current Liabilities):</span>
                <div className="divide-y divide-slate-100 border rounded-xl overflow-hidden">
                  {balanceSheet.currentLiabilities.map((l) => (
                    <div key={l.accountNumber} className="py-2 px-3 flex justify-between">
                      <span className="text-slate-800">{l.name} ({l.accountNumber})</span>
                      <span className="font-mono font-bold text-slate-900">{l.amount.toLocaleString('en-US')} ر.س</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-500 block">حقوق الملكية والأرباح (Equity & Reserves):</span>
                <div className="divide-y divide-slate-100 border rounded-xl overflow-hidden">
                  {balanceSheet.equity.map((e) => (
                    <div key={e.accountNumber} className="py-2 px-3 flex justify-between">
                      <span className="text-slate-800">{e.name} ({e.accountNumber})</span>
                      <span className="font-mono font-bold text-slate-900">{e.amount.toLocaleString('en-US')} ر.س</span>
                    </div>
                  ))}
                  <div className="py-2 px-3 flex justify-between bg-blue-50/50">
                    <span className="font-bold text-blue-900">صافي ربح الفترة الحالية (Net Income YTD)</span>
                    <span className="font-mono font-bold text-blue-900">
                      {balanceSheet.currentPeriodNetIncome.toLocaleString('en-US')} ر.س
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t flex justify-between font-bold text-sm bg-blue-50/70 p-3 rounded-xl border-blue-200 text-blue-950 font-mono">
              <span className="font-sans">إجمالي الالتزامات وحقوق الملكية:</span>
              <span>{balanceSheet.totalLiabilitiesAndEquity.toLocaleString('en-US')} ر.س</span>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 3: Income Statement */}
      {activeTab === 'income-statement' && incomeStatement && (
        <Card className="p-5 border border-slate-200 space-y-4 max-w-4xl mx-auto">
          <div className="border-b pb-3 text-center">
            <h3 className="font-bold text-base text-slate-900">قائمة الدخل الشامل (Statement of Profit or Loss)</h3>
            <p className="text-xs text-slate-500 font-mono">عن السنة المالية المنتهية في 2026</p>
          </div>

          <div className="space-y-3 text-xs">
            {/* Revenues */}
            <div className="border rounded-xl p-3 bg-slate-50">
              <span className="font-bold text-slate-700 block mb-2">إيرادات النشاط التشغيلي والمبيعات:</span>
              <div className="space-y-1">
                {incomeStatement.revenues.map((r) => (
                  <div key={r.accountNumber} className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>{r.name}</span>
                    <span className="font-mono font-bold text-emerald-800">{r.amount.toLocaleString('en-US')} ر.س</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 font-bold text-emerald-900">
                  <span>إجمالي الإيرادات التشغيلية:</span>
                  <span className="font-mono text-sm">{incomeStatement.totalRevenue.toLocaleString('en-US')} ر.س</span>
                </div>
              </div>
            </div>

            {/* COGS */}
            <div className="border rounded-xl p-3 bg-slate-50">
              <span className="font-bold text-slate-700 block mb-2">تكلفة البضاعة والمواد المباعة (COGS):</span>
              <div className="space-y-1">
                {incomeStatement.cogs.map((c) => (
                  <div key={c.accountNumber} className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>{c.name}</span>
                    <span className="font-mono font-bold text-slate-800">({c.amount.toLocaleString('en-US')}) ر.س</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 font-bold text-slate-800">
                  <span>إجمالي تكلفة المبيعات:</span>
                  <span className="font-mono">({incomeStatement.totalCogs.toLocaleString('en-US')}) ر.س</span>
                </div>
              </div>
            </div>

            {/* Gross Profit */}
            <div className="flex justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-200 font-bold text-sm text-emerald-950 font-mono">
              <span className="font-sans">إجمالي الربح (مجمل الربح Gross Profit):</span>
              <span>{incomeStatement.grossProfit.toLocaleString('en-US')} ر.س</span>
            </div>

            {/* Operating Expenses */}
            <div className="border rounded-xl p-3 bg-slate-50">
              <span className="font-bold text-slate-700 block mb-2">المصروفات التشغيلية والإدارية ومصروفات الأسطول:</span>
              <div className="space-y-1">
                {incomeStatement.operatingExpenses.map((o) => (
                  <div key={o.accountNumber} className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>{o.name}</span>
                    <span className="font-mono font-bold text-slate-700">({o.amount.toLocaleString('en-US')}) ر.س</span>
                  </div>
                ))}
                {incomeStatement.depreciationExpenses.map((d) => (
                  <div key={d.accountNumber} className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>{d.name} (استهلاك أصول)</span>
                    <span className="font-mono font-bold text-slate-700">({d.amount.toLocaleString('en-US')}) ر.س</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Net Income */}
            <div className="flex justify-between p-4 bg-[#0B2545] text-white rounded-2xl font-bold text-base font-mono shadow-md">
              <span className="font-sans">صافي الدخل التشغيلي للفترة (Net Income):</span>
              <span className="text-emerald-400">{incomeStatement.netIncome.toLocaleString('en-US')} ر.س</span>
            </div>
          </div>
        </Card>
      )}

      {/* Tab 4: Cash Flow */}
      {activeTab === 'cash-flow' && cashFlow && (
        <Card className="p-5 border border-slate-200 space-y-4 max-w-4xl mx-auto">
          <div className="border-b pb-3 text-center">
            <h3 className="font-bold text-base text-slate-900">قائمة التدفقات النقدية غير المباشرة (Cash Flow Statement)</h3>
            <p className="text-xs text-slate-500 font-mono">تسوية صافي الدخل مع السيولة النقدية الفعلية</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="border rounded-xl p-3 bg-slate-50 space-y-2">
              <span className="font-bold text-slate-700 block">التدفقات النقدية من الأنشطة التشغيلية:</span>
              {cashFlow.operatingCashFlow.map((item, idx) => (
                <div key={idx} className="flex justify-between py-1 border-b border-slate-200/60">
                  <span>{item.item}</span>
                  <span className="font-mono font-bold text-slate-800">{item.amount.toLocaleString('en-US')} ر.س</span>
                </div>
              ))}
              <div className="flex justify-between pt-1 font-bold text-emerald-800">
                <span>صافي النقد من التشغيل:</span>
                <span className="font-mono">{cashFlow.totalOperating.toLocaleString('en-US')} ر.س</span>
              </div>
            </div>

            <div className="border rounded-xl p-3 bg-slate-50 space-y-2">
              <span className="font-bold text-slate-700 block">التدفقات النقدية من الأنشطة الاستثمارية:</span>
              {cashFlow.investingCashFlow.map((item, idx) => (
                <div key={idx} className="flex justify-between py-1 border-b border-slate-200/60">
                  <span>{item.item}</span>
                  <span className="font-mono font-bold text-slate-800">({Math.abs(item.amount).toLocaleString('en-US')}) ر.س</span>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-100 rounded-xl space-y-2 font-mono text-xs">
              <div className="flex justify-between">
                <span className="font-sans font-bold">رصيد النقدية في بداية الفترة:</span>
                <span className="font-bold">{cashFlow.beginningCash.toLocaleString('en-US')} ر.س</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans font-bold">صافي التغير في النقدية خلال الفترة:</span>
                <span className="font-bold text-emerald-700">{cashFlow.netCashFlow.toLocaleString('en-US')} ر.س</span>
              </div>
              <div className="flex justify-between pt-2 border-t font-black text-sm text-blue-900">
                <span className="font-sans">رصيد النقدية بالبنوك في نهاية الفترة:</span>
                <span>{cashFlow.endingCash.toLocaleString('en-US')} ر.س</span>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
