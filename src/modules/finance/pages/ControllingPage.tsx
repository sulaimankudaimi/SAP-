import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { StatCard } from '../../../components/ui/StatCard';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Tabs } from '../../../components/ui/Tabs';
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs';
import { useToast } from '../../../components/ui/Toast';
import { t } from '../../../i18n/ar';
import { db } from '../../../core/db';
import { ControllingService, CostCenterVarianceItem } from '../services/ControllingService';
import { CostAllocationModal } from '../components/CostAllocationModal';
import type { CostAllocationCycle, CostCenter, InternalOrder } from '../../../types/models';
import {
  Layers,
  TrendingDown,
  TrendingUp,
  FolderTree,
  FileText,
  DollarSign,
  ChevronRight,
  ListFilter,
} from 'lucide-react';

export const ControllingPage: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('actual-vs-budget');
  const [isLoading, setIsLoading] = useState(true);

  const [varianceReport, setVarianceReport] = useState<{
    items: CostCenterVarianceItem[];
    totalBudget: number;
    totalCommitments: number;
    totalActual: number;
    totalVariance: number;
  }>({
    items: [],
    totalBudget: 0,
    totalCommitments: 0,
    totalActual: 0,
    totalVariance: 0,
  });

  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [selectedCostCenterForDrilldown, setSelectedCostCenterForDrilldown] = useState<string>('CC-1001');
  const [drilldownLines, setDrilldownLines] = useState<
    {
      docNumber: string;
      postingDate: string;
      documentType: string;
      headerText: string;
      accountNumber: string;
      accountName: string;
      debit: number;
      credit: number;
    }[]
  >([]);

  const [allocationCycles, setAllocationCycles] = useState<CostAllocationCycle[]>([]);
  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const rep = await ControllingService.getActualVsBudgetReport('2026');
      setVarianceReport(rep);

      const ccs = await db.costCenters.filter((c) => !c.isDeleted).toArray();
      setCostCenters(ccs);

      const cycles = await db.costAllocationCycles.filter((c) => !c.isDeleted).toArray();
      setAllocationCycles(cycles);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'فشل تحميل بيانات محاسبة التكاليف', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Load drilldown lines (KSB1) when cost center changes
  useEffect(() => {
    async function loadDrilldown() {
      if (!selectedCostCenterForDrilldown) return;
      const res = await ControllingService.getCostCenterLineItems(selectedCostCenterForDrilldown, '2026');
      setDrilldownLines(res.lines);
    }
    loadDrilldown();
  }, [selectedCostCenterForDrilldown]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumbs
            items={[
              { label: t('nav_home'), path: '/' },
              { label: t('nav_finance'), path: '/finance' },
              { label: 'محاسبة التكاليف ومراكز المسؤولية (CO-OM)' },
            ]}
          />
          <h1 className="text-2xl font-black text-[#0B2545] tracking-tight mt-1">
            {t('fi_co_title')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            الرقابة على تكاليف العمليات، تحليل الفروقات التقديرية (Variance Analysis)، وتوزيع الأعباء المشتركة (KSU5)
          </p>
        </div>

        <Button
          onClick={() => setIsAllocationModalOpen(true)}
          className="bg-[#0FA37F] hover:bg-[#0c8a6c] gap-2 font-bold shadow-sm"
        >
          <Layers className="w-4 h-4" />
          <span>{t('fi_btn_allocation')}</span>
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="إجمالي الميزانيات المعتمدة (CO)"
          value={`${varianceReport.totalBudget.toLocaleString('en-US')} ر.س`}
          subtitle="ميزانية العام المالي 2026"
          icon={<DollarSign className="w-5 h-5 text-[#0B2545]" />}
        />
        <StatCard
          label="إجمالي التكاليف الفعلية المنفقة"
          value={`${varianceReport.totalActual.toLocaleString('en-US')} ر.س`}
          subtitle="حركات أستاذ مسجلة بمراكز التكلفة"
          icon={<TrendingDown className="w-5 h-5 text-red-600" />}
        />
        <StatCard
          label="الارتباطات المفتوحة (Commitments)"
          value={`${varianceReport.totalCommitments.toLocaleString('en-US')} ر.س`}
          subtitle="أوامر شراء قيد التنفيذ"
          icon={<FileText className="w-5 h-5 text-amber-600" />}
        />
        <StatCard
          label="صافي الوفر التقديري المتبقي"
          value={`${varianceReport.totalVariance.toLocaleString('en-US')} ر.س`}
          subtitle={varianceReport.totalVariance >= 0 ? 'وفر إيجابي متاح' : 'تجاوز في الميزانية'}
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
        />
      </div>

      {/* Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'actual-vs-budget', label: 'الميزانية مقابل الفعلي والفروقات (Variance Analysis)' },
          { id: 'line-items', label: 'كشف بنود تكاليف مركز المسؤولية (KSB1 Drill-down)' },
          { id: 'allocation-cycles', label: `دورات توزيع الأعباء والتكاليف (${allocationCycles.length})` },
        ]}
      />

      {/* Tab 1: Actual vs Budget */}
      {activeTab === 'actual-vs-budget' && (
        <Card className="overflow-hidden border border-slate-200">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 text-start">كود المركز</th>
                <th className="py-2.5 px-3 text-start">اسم مركز التكلفة</th>
                <th className="py-2.5 px-3 text-start">التصنيف</th>
                <th className="py-2.5 px-3 text-end">الميزانية المعتمدة</th>
                <th className="py-2.5 px-3 text-end">الارتباطات (POs)</th>
                <th className="py-2.5 px-3 text-end">المنصرف الفعلي</th>
                <th className="py-2.5 px-3 text-end">فارق الوفر / العجز</th>
                <th className="py-2.5 px-3 text-center">حالة الاستهلاك</th>
                <th className="py-2.5 px-3 text-center">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {varianceReport.items.map((item) => (
                <tr key={item.costCenterCode} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{item.costCenterCode}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-800">{item.costCenterName}</td>
                  <td className="py-2.5 px-3 text-slate-600">{item.category}</td>
                  <td className="py-2.5 px-3 font-mono text-end font-semibold text-slate-800">
                    {item.budgetAllocated.toLocaleString('en-US')} ر.س
                  </td>
                  <td className="py-2.5 px-3 font-mono text-end text-amber-700">
                    {item.commitments.toLocaleString('en-US')} ر.س
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-end text-slate-900">
                    {item.actualCost.toLocaleString('en-US')} ر.س
                  </td>
                  <td
                    className={`py-2.5 px-3 font-mono font-bold text-end ${
                      item.varianceAmount >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {item.varianceAmount.toLocaleString('en-US')} ر.س
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {item.status === 'critical' ? (
                      <Badge variant="rejected">تجاوز ميزانية</Badge>
                    ) : item.status === 'warning' ? (
                      <Badge variant="pending">اقتراب من الحد</Badge>
                    ) : (
                      <Badge variant="approved">ضمن المخطط</Badge>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedCostCenterForDrilldown(item.costCenterCode);
                        setActiveTab('line-items');
                      }}
                      className="text-[11px] h-7 px-2 font-bold hover:bg-slate-100"
                    >
                      كشف البنود KSB1 ←
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-200">
              <tr>
                <td colSpan={3} className="py-3 px-3">الإجمالي العام لمراكز التكلفة</td>
                <td className="py-3 px-3 text-end font-mono">
                  {varianceReport.totalBudget.toLocaleString('en-US')} ر.س
                </td>
                <td className="py-3 px-3 text-end font-mono text-amber-800">
                  {varianceReport.totalCommitments.toLocaleString('en-US')} ر.س
                </td>
                <td className="py-3 px-3 text-end font-mono text-slate-900">
                  {varianceReport.totalActual.toLocaleString('en-US')} ر.س
                </td>
                <td className="py-3 px-3 text-end font-mono text-emerald-800 text-sm">
                  {varianceReport.totalVariance.toLocaleString('en-US')} ر.س
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      {/* Tab 2: Line Items Drill-down (KSB1) */}
      {activeTab === 'line-items' && (
        <div className="space-y-4">
          <Card className="p-4 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3 w-1/3">
              <label className="text-slate-500 font-bold text-xs whitespace-nowrap">مركز التكلفة المعروض:</label>
              <select
                value={selectedCostCenterForDrilldown}
                onChange={(e) => setSelectedCostCenterForDrilldown(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
              >
                {costCenters.map((cc) => (
                  <option key={cc.id} value={cc.code}>
                    {cc.code} - {cc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500">
              إجمالي الحركات المحمَّلة على هذا المركز: <strong className="text-slate-900 font-mono">{drilldownLines.length} حركة قيد</strong>
            </div>
          </Card>

          <Card className="overflow-hidden border border-slate-200">
            <table className="w-full text-xs text-start">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 text-start">التاريخ</th>
                  <th className="py-2.5 px-3 text-start">رقم قيد اليومية</th>
                  <th className="py-2.5 px-3 text-start">نوع المستند</th>
                  <th className="py-2.5 px-3 text-start">رقم واسم الحساب المحاسبي</th>
                  <th className="py-2.5 px-3 text-start">البيان التوضيحي</th>
                  <th className="py-2.5 px-3 text-end">مدين (تحميل مصروف)</th>
                  <th className="py-2.5 px-3 text-end">دائن (تخفيض)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {drilldownLines.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      لا توجد قيود مصروفات مرحلة لمركز التكلفة المحدد بعد.
                    </td>
                  </tr>
                ) : (
                  drilldownLines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-mono text-slate-600">{line.postingDate}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{line.docNumber}</td>
                      <td className="py-2.5 px-3 font-mono font-bold">
                        <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                          {line.documentType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {line.accountNumber} - {line.accountName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">{line.headerText}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-end text-emerald-800">
                        {line.debit > 0 ? `${line.debit.toLocaleString('en-US')} ر.س` : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-end text-blue-800">
                        {line.credit > 0 ? `${line.credit.toLocaleString('en-US')} ر.س` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* Tab 3: Allocation Cycles (KSU5) */}
      {activeTab === 'allocation-cycles' && (
        <Card className="overflow-hidden border border-slate-200">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 text-start">رقم المستند</th>
                <th className="py-2.5 px-3 text-start">رمز الدورة</th>
                <th className="py-2.5 px-3 text-start">اسم دورة التوزيع</th>
                <th className="py-2.5 px-3 text-start">الفترة المالية</th>
                <th className="py-2.5 px-3 text-start">مركز التكلفة المرسل</th>
                <th className="py-2.5 px-3 text-end">إجمالي المبلغ الموزع</th>
                <th className="py-2.5 px-3 text-start">قيد الأستاذ العام المرتبط</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {allocationCycles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    لم يتم تشغيل دورات توزيع تكاليف بعد. انقر على زر &quot;تشغيل دورة توزيع التكاليف&quot; بالأعلى.
                  </td>
                </tr>
              ) : (
                allocationCycles.map((cyc) => (
                  <tr key={cyc.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{cyc.docNumber}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{cyc.cycleCode}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{cyc.name}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {cyc.fiscalYear} / {cyc.period}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-700">{cyc.senderCostCenter}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-end text-emerald-800 text-sm">
                      {cyc.totalAllocatedAmount.toLocaleString('en-US')} ر.س
                    </td>
                    <td className="py-2.5 px-3 font-mono text-blue-900 font-bold">{cyc.jeDocNumber || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}

      {/* Modal */}
      <CostAllocationModal
        isOpen={isAllocationModalOpen}
        onClose={() => setIsAllocationModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
};
