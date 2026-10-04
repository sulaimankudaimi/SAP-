import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { StatCard } from '../../../components/ui/StatCard';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs';
import { useToast } from '../../../components/ui/Toast';
import { t } from '../../../i18n/ar';
import { db } from '../../../core/db';
import { BudgetService, BudgetAvailabilityCheckResult } from '../services/BudgetService';
import { BudgetModal } from '../components/BudgetModal';
import type { Budget, CostCenter } from '../../../types/models';
import {
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Play,
  DollarSign,
  FileCheck,
} from 'lucide-react';

export const BudgetControlPage: React.FC = () => {
  const { showToast } = useToast();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Budget Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCcForEdit, setSelectedCcForEdit] = useState<string | undefined>(undefined);

  // Availability Simulator
  const [simCostCenter, setSimCostCenter] = useState('CC-1001');
  const [simAmount, setSimAmount] = useState('50000');
  const [simResult, setSimResult] = useState<BudgetAvailabilityCheckResult | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const bList = await db.budgets.filter((b) => !b.isDeleted).toArray();
      const ccs = await db.costCenters.filter((c) => !c.isDeleted).toArray();
      setBudgets(bList);
      setCostCenters(ccs);
      if (ccs.length > 0 && !simCostCenter) {
        setSimCostCenter(ccs[0].code);
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'فشل تحميل الميزانيات', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const runSimulation = async () => {
    const amt = parseFloat(simAmount) || 0;
    const res = await BudgetService.checkAvailability(simCostCenter, amt, '2026');
    setSimResult(res);
  };

  const totalAllocated = budgets.reduce((acc, b) => acc + b.allocatedAmount, 0);
  const totalCommitted = budgets.reduce((acc, b) => acc + b.committedAmount, 0);
  const totalActual = budgets.reduce((acc, b) => acc + b.actualAmount, 0);
  const totalAvailable = totalAllocated - totalCommitted - totalActual;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumbs
            items={[
              { label: t('nav_home'), path: '/' },
              { label: t('nav_finance'), path: '/finance' },
              { label: 'الرقابة على الميزانيات والالتزامات' },
            ]}
          />
          <h1 className="text-2xl font-black text-[#0B2545] tracking-tight mt-1">
            {t('fi_budget_title')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            تتبع الارتباطات المالية (Commitment Tracking) وفحص إتاحة الميزانية لأوامر الشراء وطلبات الصرف
          </p>
        </div>

        <Button
          onClick={() => {
            setSelectedCcForEdit(undefined);
            setIsModalOpen(true);
          }}
          className="bg-[#0FA37F] hover:bg-[#0c8a6c] gap-2 font-bold shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>تخصيص ميزانية جديدة لمركز تكلفة</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="إجمالي الميزانيات المعتمدة (2026)"
          value={`${totalAllocated.toLocaleString('en-US')} ر.س`}
          subtitle="سقف الإنفاق السنوي المعتمد"
          icon={<DollarSign className="w-5 h-5 text-[#0B2545]" />}
        />
        <StatCard
          label="الارتباطات المفتوحة (Commitments)"
          value={`${totalCommitted.toLocaleString('en-US')} ر.س`}
          subtitle="أوامر شراء معتمدة قيد التوريد"
          icon={<FileCheck className="w-5 h-5 text-amber-600" />}
        />
        <StatCard
          label="المصروفات الفعلية المنفذة"
          value={`${totalActual.toLocaleString('en-US')} ر.س`}
          subtitle="مشتريات مستلمة ومصروفة فعلياً"
          icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
        />
        <StatCard
          label="صافي الميزانية المتاحة للصرف"
          value={`${totalAvailable.toLocaleString('en-US')} ر.س`}
          subtitle="رصيد متاح لإصدار أوامر جديدة"
          icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />}
        />
      </div>

      {/* Simulator Card: Check Availability (PR/PO Gatekeeper) */}
      <Card className="p-5 border border-slate-200 bg-slate-50/70 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              محاكي فحص إتاحة الميزانية (SAP Budget Availability Check Gatekeeper)
            </h3>
            <p className="text-xs text-slate-500">
              قاعدة التحقق: المتاح = المعتمد − المنصرف الفعلي − الارتباطات المفتوحة (PR/PO)
            </p>
          </div>
          <Button onClick={runSimulation} className="bg-blue-600 hover:bg-blue-700 gap-2 font-bold shadow-xs">
            <Play className="w-4 h-4" />
            <span>فحص الإتاحة الآن</span>
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-slate-600 font-bold text-xs block mb-1">مركز التكلفة المستهدف:</label>
            <select
              value={simCostCenter}
              onChange={(e) => setSimCostCenter(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500"
            >
              {costCenters.map((cc) => (
                <option key={cc.id} value={cc.code}>
                  {cc.code} - {cc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-600 font-bold text-xs block mb-1">المبلغ المطلوب اعتماده (ر.س):</label>
            <Input
              type="number"
              value={simAmount}
              onChange={(e) => setSimAmount(e.target.value)}
              className="font-mono font-bold text-slate-800 text-xs"
            />
          </div>

          <div>
            <label className="text-slate-600 font-bold text-xs block mb-1">السنة المالية:</label>
            <Input value="2026" readOnly className="bg-slate-100 text-xs font-mono" />
          </div>
        </div>

        {/* Simulation Output Result Box */}
        {simResult && (
          <div
            className={`p-4 rounded-2xl border text-xs flex items-center justify-between ${
              simResult.isAvailable
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-3">
              {simResult.isAvailable ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
              )}
              <div>
                <h4 className="font-bold text-sm">
                  {simResult.isAvailable
                    ? 'الميزانية كافية ومتاحة، سيتم اعتماد الطلب وتثبيت الارتباط'
                    : 'تم رفض الطلب آلياً لتجاوز الميزانية المعتمدة لمركز التكلفة'}
                </h4>
                <p className="text-[11px] opacity-80 mt-0.5">
                  مركز التكلفة: {simResult.costCenterName} ({simResult.costCenter}) | المتبقي بعد العملية:{' '}
                  <span className="font-mono font-bold">
                    {simResult.remainingAfterRequest.toLocaleString('en-US')} ر.س
                  </span>
                </p>
                {simResult.warning && <p className="text-[11px] font-bold mt-1 text-amber-800">{simResult.warning}</p>}
              </div>
            </div>

            <div className="flex items-center gap-4 font-mono text-end">
              <div>
                <span className="text-[10px] block opacity-70">المتاح حالياً:</span>
                <span className="font-bold">{simResult.availableAmount.toLocaleString('en-US')} ر.س</span>
              </div>
              <div>
                <span className="text-[10px] block opacity-70">نسبة الاستهلاك:</span>
                <span className="font-black text-sm">{simResult.utilizationPercentage}%</span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Cost Center Budgets Register Table */}
      <Card className="overflow-hidden border border-slate-200">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-800">سجل ميزانيات مراكز التكلفة والارتباطات</h3>
          <span className="text-xs text-slate-500 font-mono">العام المالي: 2026</span>
        </div>

        <table className="w-full text-xs text-start">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3 text-start">كود المركز</th>
              <th className="py-2.5 px-3 text-start">اسم مركز التكلفة</th>
              <th className="py-2.5 px-3 text-end">الميزانية المعتمدة</th>
              <th className="py-2.5 px-3 text-end">الارتباطات المفتوحة (Commitments)</th>
              <th className="py-2.5 px-3 text-end">المنصرف الفعلي</th>
              <th className="py-2.5 px-3 text-end">المتبقي المتاح</th>
              <th className="py-2.5 px-3 w-44">نسبة الاستهلاك</th>
              <th className="py-2.5 px-3 text-center">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {budgets.map((b) => {
              const consumed = b.committedAmount + b.actualAmount;
              const pct = b.allocatedAmount > 0 ? Math.min(100, Math.round((consumed / b.allocatedAmount) * 100)) : 0;
              const available = b.allocatedAmount - consumed;

              return (
                <tr key={b.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{b.costCenter}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-800">{b.costCenterName || b.costCenter}</td>
                  <td className="py-2.5 px-3 font-mono text-end font-semibold">
                    {b.allocatedAmount.toLocaleString('en-US')} ر.س
                  </td>
                  <td className="py-2.5 px-3 font-mono text-end text-amber-700 font-semibold">
                    {b.committedAmount.toLocaleString('en-US')} ر.س
                  </td>
                  <td className="py-2.5 px-3 font-mono text-end text-slate-900 font-bold">
                    {b.actualAmount.toLocaleString('en-US')} ر.س
                  </td>
                  <td
                    className={`py-2.5 px-3 font-mono text-end font-black text-sm ${
                      available >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {available.toLocaleString('en-US')} ر.س
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span>{pct}% مستهلك</span>
                        <span>{available.toLocaleString('en-US')} متبقي</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct >= 90 ? 'bg-rose-500' : pct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedCcForEdit(b.costCenter);
                        setIsModalOpen(true);
                      }}
                      className="text-[11px] h-7 px-2 font-bold hover:bg-slate-100"
                    >
                      تعديل الميزانية
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Modal */}
      <BudgetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadData}
        initialCostCenter={selectedCcForEdit}
      />
    </div>
  );
};
