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
import { FinanceService } from '../services/FinanceService';
import { FinancialStatementsService, GrIrClearingItem } from '../services/FinancialStatementsService';
import type { FiscalPeriod } from '../../../types/models';
import {
  Calendar,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Layers,
  FileText,
  DollarSign,
} from 'lucide-react';

export const PeriodEndClosingPage: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('periods-control');
  const [isLoading, setIsLoading] = useState(true);

  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [grIrData, setGrIrData] = useState<{
    items: GrIrClearingItem[];
    totalGrAmount: number;
    totalIrAmount: number;
    netOpenBalance: number;
  }>({
    items: [],
    totalGrAmount: 0,
    totalIrAmount: 0,
    netOpenBalance: 0,
  });

  // Closing Checklist state
  const [checklist, setChecklist] = useState([
    { id: 'chk-1', task: 'استلام كافة أذون حركات المخزون (MIGO) وترحيلها', done: true },
    { id: 'chk-2', task: 'مطابقة وإثبات فواتير الموردين المستلمة (MIRO)', done: true },
    { id: 'chk-3', task: 'تشغيل دورة استهلاك الأصول الرأسمالية الشهرية (AFAB)', done: true },
    { id: 'chk-4', task: 'تسوية ومقاصة حساب البضاعة الواردة والفواتير غير المستلمة (GR/IR Clearing)', done: false },
    { id: 'chk-5', task: 'تسجيل قيود التسويات الجردية والمصروفات المستحقة والمقدمة (Accruals)', done: false },
    { id: 'chk-6', task: 'إجراء المطابقة البنكية وتأكيد أرصدة الحسابات النقدية (Bank Reconciliation)', done: true },
    { id: 'chk-7', task: 'التحقق من توازن ميزان المراجعة (Zero-Sum Trial Balance)', done: true },
    { id: 'chk-8', task: 'إقفال الفترة المالية لمنع الترحيل بأثر رجعي (Close Period)', done: false },
  ]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await FinanceService.initFiscalPeriods('2026');
      const pList = await db.fiscalPeriods.where({ fiscalYear: '2026' }).toArray();
      setPeriods(pList.sort((a, b) => a.period - b.period));

      const grIr = await FinancialStatementsService.getGrIrClearingReport();
      setGrIrData(grIr);
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : 'فشل تحميل بيانات إقفال الفترات', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const togglePeriod = async (p: FiscalPeriod) => {
    const nextStatus = p.status === 'Open' ? 'Closed' : 'Open';
    try {
      await FinanceService.setPeriodStatus(p.fiscalYear, p.period, nextStatus, 'usr-admin-1');
      toast({
        title:
          nextStatus === 'Closed'
            ? `تم إقفال الفترة المالية ${p.period}/${p.fiscalYear} بنجاح. تم تفعيل منع الترحيل بأثر رجعي.`
            : `تم إعادة فتح الفترة المالية ${p.period}/${p.fiscalYear}.`,
        type: 'success',
      });
      loadData();
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : 'فشل تغيير حالة الفترة', type: 'error' });
    }
  };

  const toggleChecklist = (id: string) => {
    setChecklist((prev) =>
      prev.map((c) => (c.id === id ? { ...c, done: !c.done } : c))
    );
  };

  const openPeriodsCount = periods.filter((p) => p.status === 'Open').length;
  const closedPeriodsCount = periods.filter((p) => p.status === 'Closed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumbs
            items={[
              { label: t('nav_home'), path: '/' },
              { label: t('nav_finance'), path: '/finance' },
              { label: 'إقفال الفترات والعمليات الدورية' },
            ]}
          />
          <h1 className="text-2xl font-black text-[#0B2545] tracking-tight mt-1">
            {t('fi_period_end_title')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            التحكم في قفل وفتح الفترات المالية (OB52)، مقاصة وسيط البضاعة الواردة (GR/IR)، وقائمة تدقيق الإقفال
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="الفترات المالية المفتوحة"
          value={openPeriodsCount.toString()}
          subtitle="متاحة للترحيل المحاسبي"
          icon={<Unlock className="w-5 h-5 text-emerald-600" />}
        />
        <StatCard
          label="الفترات المالية المقفلة"
          value={closedPeriodsCount.toString()}
          subtitle="ممنوعة من الترحيل الرجعي"
          icon={<Lock className="w-5 h-5 text-slate-600" />}
        />
        <StatCard
          label="رصيد وسيط GR/IR المفتوح"
          value={`${grIrData.netOpenBalance.toLocaleString('en-US')} ر.س`}
          subtitle="بضاعة واردة لم تفوّتر بعد"
          icon={<Layers className="w-5 h-5 text-amber-600" />}
        />
        <StatCard
          label="مهام الإقفال المكتملة"
          value={`${checklist.filter((c) => c.done).length} / ${checklist.length}`}
          subtitle="قائمة التحقق الدورية"
          icon={<CheckCircle2 className="w-5 h-5 text-blue-600" />}
        />
      </div>

      {/* Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'periods-control', label: 'التحكم في الفترات المالية (Open / Close Periods)' },
          { id: 'gr-ir-clearing', label: `تقرير مقاصة البضاعة الواردة GR/IR (${grIrData.items.length})` },
          { id: 'checklist', label: 'قائمة تدقيق إقفال الفترة (Month-End Checklist)' },
        ]}
      />

      {/* Tab 1: Periods Control Table */}
      {activeTab === 'periods-control' && (
        <Card className="overflow-hidden border border-slate-200">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-800">التحكم في فترات الترحيل المحاسبي (SAP OB52)</h3>
              <p className="text-xs text-slate-500">
                إقفال الفترة يمنع بشكل صارم إدخال أو ترحيل أي مستندات مالية أو مخزنية بتواريخ تقع ضمن تلك الفترة.
              </p>
            </div>
            <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              العام المالي: 2026
            </span>
          </div>

          <table className="w-full text-xs text-start">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 text-start">الفترة</th>
                <th className="py-2.5 px-3 text-start">الشهر المالي</th>
                <th className="py-2.5 px-3 text-start">تاريخ البداية</th>
                <th className="py-2.5 px-3 text-start">تاريخ النهاية</th>
                <th className="py-2.5 px-3 text-center">الحالة</th>
                <th className="py-2.5 px-3 text-start">تاريخ الإقفال</th>
                <th className="py-2.5 px-3 text-center">إجراء القفل / الفتح</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {periods.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3 font-mono font-bold text-blue-900 text-sm">
                    فترة {String(p.period).padStart(2, '0')}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-800">
                    {p.period === 1
                      ? 'يناير (January)'
                      : p.period === 2
                      ? 'فبراير (February)'
                      : p.period === 3
                      ? 'مارس (March)'
                      : p.period === 4
                      ? 'أبريل (April)'
                      : p.period === 5
                      ? 'مايو (May)'
                      : p.period === 6
                      ? 'يونيو (June)'
                      : p.period === 7
                      ? 'يوليو (July)'
                      : p.period === 8
                      ? 'أغسطس (August)'
                      : p.period === 9
                      ? 'سبتمبر (September)'
                      : p.period === 10
                      ? 'أكتوبر (October)'
                      : p.period === 11
                      ? 'نوفمبر (November)'
                      : 'ديسمبر (December)'}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">{p.startDate}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">{p.endDate}</td>
                  <td className="py-2.5 px-3 text-center">
                    {p.status === 'Open' ? (
                      <Badge variant="approved">مفتوحة للترحيل</Badge>
                    ) : (
                      <Badge variant="rejected">مقفلة تماماً</Badge>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-500">
                    {p.closedAt ? p.closedAt.split('T')[0] : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => togglePeriod(p)}
                      className={`text-[11px] h-7 px-3 font-bold gap-1.5 ${
                        p.status === 'Open'
                          ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                          : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {p.status === 'Open' ? (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>إقفال الفترة</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3.5 h-3.5" />
                          <span>إعادة فتح</span>
                        </>
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Tab 2: GR/IR Clearing Report */}
      {activeTab === 'gr-ir-clearing' && (
        <Card className="overflow-hidden border border-slate-200 space-y-4 p-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between text-blue-900">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-xs">
                تقرير مقاصة ومطابقة حساب البضاعة الواردة والفواتير غير المستلمة (SAP F.13 / F.19)
              </span>
            </div>
            <span className="text-xs font-mono font-bold">
              صافي الفارق المفتوح: {grIrData.netOpenBalance.toLocaleString('en-US')} ر.س
            </span>
          </div>

          <table className="w-full text-xs text-start">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 text-start">المرجع / مستند الاستلام</th>
                <th className="py-2.5 px-3 text-start">تاريخ الحركة</th>
                <th className="py-2.5 px-3 text-end">قيمة البضاعة المستلمة (GR Credit)</th>
                <th className="py-2.5 px-3 text-end">قيمة الفواتير المثبتة (IR Debit)</th>
                <th className="py-2.5 px-3 text-end">الرصيد المعلق (Open Balance)</th>
                <th className="py-2.5 px-3 text-center">حالة المقاصة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {grIrData.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    لا توجد حركات مسجلة بحساب وسيط GR/IR حالياً.
                  </td>
                </tr>
              ) : (
                grIrData.items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{it.referenceDoc}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{it.postingDate}</td>
                    <td className="py-2.5 px-3 font-mono text-end font-semibold text-slate-800">
                      {it.grAmount.toLocaleString('en-US')} ر.س
                    </td>
                    <td className="py-2.5 px-3 font-mono text-end font-semibold text-slate-800">
                      {it.irAmount.toLocaleString('en-US')} ر.س
                    </td>
                    <td
                      className={`py-2.5 px-3 font-mono font-bold text-end ${
                        it.openBalance === 0 ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {it.openBalance.toLocaleString('en-US')} ر.س
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {it.status === 'Matched' ? (
                        <Badge variant="approved">مقاصة تامة (0.00)</Badge>
                      ) : it.status === 'UnbilledGR' ? (
                        <Badge variant="pending">بضاعة غير مفوّترة</Badge>
                      ) : (
                        <Badge variant="rejected">فارق تسوية</Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}

      {/* Tab 3: Month-End Checklist */}
      {activeTab === 'checklist' && (
        <Card className="p-4 border border-slate-200 space-y-4">
          <div>
            <h3 className="font-bold text-sm text-slate-800">قائمة تدقيق وضوابط إقفال الفترة المالية (Checklist)</h3>
            <p className="text-xs text-slate-500">
              خطوات تدقيق الحسابات والترحيل الآلي المتبعة شهرياً للتأكد من سلامة القوائم المالية
            </p>
          </div>

          <div className="divide-y divide-slate-100 border rounded-2xl overflow-hidden border-slate-200">
            {checklist.map((chk, i) => (
              <div
                key={chk.id}
                onClick={() => toggleChecklist(chk.id)}
                className="p-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                      chk.done ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {chk.done && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                  <span className={`text-xs font-semibold ${chk.done ? 'text-slate-900 line-through opacity-70' : 'text-slate-800'}`}>
                    {chk.task}
                  </span>
                </div>
                <Badge variant={chk.done ? 'approved' : 'pending'}>
                  {chk.done ? 'مكتمل' : 'معلق'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
