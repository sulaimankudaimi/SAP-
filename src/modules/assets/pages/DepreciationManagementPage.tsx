import { DiagnosticLogger } from '../../../core/services/DiagnosticLogger';
import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { DepreciationEngine } from '../services/DepreciationEngine';
import { depreciationRepository } from '../../../core/repositories';
import { useAuthStore } from '../../../core/auth/useAuthStore';
import { useToast } from '../../../components/ui/Toast';
import type { DepreciationRun, DepreciationRunItem } from '../../../types/models';
import {
  Calculator,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  History,
  FileText,
  DollarSign,
  TrendingDown,
  Building2,
} from 'lucide-react';
import { t } from '../../../i18n/ar';

export const DepreciationManagementPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const { success, error } = useToast();

  const [companyCode, setCompanyCode] = useState('1000');
  const [fiscalYear, setFiscalYear] = useState('2026');
  const [period, setPeriod] = useState('10');
  const [plantCode, setPlantCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [previewItems, setPreviewItems] = useState<DepreciationRunItem[]>([]);
  const [totalPreviewAmount, setTotalPreviewAmount] = useState(0);
  const [hasPreviewed, setHasPreviewed] = useState(false);

  const [runsHistory, setRunsHistory] = useState<DepreciationRun[]>([]);
  const [selectedRunToReverse, setSelectedRunToReverse] = useState<DepreciationRun | null>(null);
  const [isReversing, setIsReversing] = useState(false);

  const loadHistory = async () => {
    try {
      const history = await depreciationRepository.list();
      setRunsHistory(history.filter((r: DepreciationRun) => !r.isDeleted).reverse());
    } catch (err) {
      DiagnosticLogger.error('DepreciationManagementPage', 'Error occurred', err);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleSimulate = async () => {
    setLoading(true);
    setHasPreviewed(true);
    try {
      const result = await DepreciationEngine.previewDepreciationRun({
        companyCode,
        fiscalYear,
        period: parseInt(period, 10),
        plantCode: plantCode || undefined,
      });

      setPreviewItems(result.items);
      setTotalPreviewAmount(result.totalDepreciation);
      if (result.items.length === 0) {
        error('لا توجد أصول', 'لا توجد أصول نشطة مستحقة للإهلاك خلال هذه الدورة.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل محاكاة الإهلاك';
      error('خطأ في المحاكاة', msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    if (!user) {
      error('خطأ في الجلسة', 'يرجى تسجيل الدخول أولاً.');
      return;
    }

    setLoading(true);
    try {
      const result = await DepreciationEngine.postDepreciationRun({
        companyCode,
        fiscalYear,
        period: parseInt(period, 10),
        plantCode: plantCode || undefined,
        user: { id: user.id, fullName: user.fullName },
      });

      success(
        'تم ترحيل دورة الإهلاك بنجاح',
        `تم إصدار مستند الإهلاك ${result.run.docNumber} وترحيل قيد الأستاذ العام ${result.je.docNumber} بقيمة إجمالية ${result.run.totalDepreciationAmount.toLocaleString('en-US')} ريال.`
      );

      setPreviewItems([]);
      setTotalPreviewAmount(0);
      setHasPreviewed(false);
      loadHistory();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل ترحيل دورة الإهلاك';
      error('تعذر الترحيل', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReverse = async () => {
    if (!selectedRunToReverse || !user) return;
    setIsReversing(true);
    try {
      const result = await DepreciationEngine.reverseDepreciationRun({
        runId: selectedRunToReverse.id,
        reason: 'طلب عكس وإلغاء دورة الإهلاك وتصحيح القيود المحاسبية (Storno)',
        user: { id: user.id, fullName: user.fullName },
      });

      success(
        'تم عكس دورة الإهلاك بنجاح',
        `تم عكس الدورة ${selectedRunToReverse.docNumber} وإصدار قيد العكس ${result.stornoJe.docNumber} واستعادة القيم الدفترية للأصول.`
      );
      setSelectedRunToReverse(null);
      loadHistory();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل عكس دورة الإهلاك';
      error('خطأ في الإلغاء', msg);
    } finally {
      setIsReversing(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-[#0FA37F]/10 text-emerald-800 border border-emerald-300">
              SAP Transaction AFAB
            </span>
            <span className="text-xs text-slate-500 font-mono">Depreciation Posting Run</span>
          </div>
          <h1 className="text-2xl font-black text-[#0B2545] tracking-tight mt-1">
            {t('asset_dep_run_title')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            حساب وتوزيع أقساط الإهلاك الشهري للأصول الثابتة وترحيل القيود اليومية آلياً للأستاذ العام
          </p>
        </div>
      </div>

      {/* Run Parameters Card */}
      <Card className="p-5 shadow-sm border border-slate-200 space-y-4">
        <h3 className="text-xs font-bold text-[#0B2545] border-b border-slate-100 pb-2">
          محددات دورة التشغيل ومعايير الترحيل (Run Parameters)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">رمز الشركة (Company)</label>
            <Select
              value={companyCode}
              onChange={(e) => setCompanyCode(e.target.value)}
              options={[{ value: '1000', label: '1000 - شركة الخليج للطاقة المحدودة' }]}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">السنة المالية (Fiscal Year)</label>
            <Select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value)}
              options={[
                { value: '2026', label: '2026' },
                { value: '2025', label: '2025' },
              ]}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">الفترة المحاسبية (Period)</label>
            <Select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              options={Array.from({ length: 12 }, (_, i) => ({
                value: String(i + 1),
                label: `الفترة ${i + 1} (${new Date(2026, i).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { month: 'long' })})`,
              }))}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">المحطة (اختياري)</label>
            <Select
              value={plantCode}
              onChange={(e) => setPlantCode(e.target.value)}
              options={[
                { value: '', label: 'كافة المحطات والمنشآت' },
                { value: '1100', label: '1100 - محطة الرياض المركزية' },
                { value: '1200', label: '1200 - محطة ومستودعات جدة' },
                { value: '1300', label: '1300 - مستودع الدمام' },
              ]}
            />
          </div>

          <div className="flex items-end gap-2">
            <Button
              onClick={handleSimulate}
              disabled={loading}
              className="w-full bg-[#0B2545] hover:bg-[#13315C] text-xs font-bold gap-2 py-2.5 h-[38px]"
            >
              <Play className="w-4 h-4 text-emerald-400" />
              <span>معاينة ومحاكاة</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Simulation / Preview Table */}
      {hasPreviewed && (
        <Card className="p-0 shadow-sm border border-slate-200 overflow-hidden space-y-0">
          <div className="p-4 bg-emerald-50/70 border-b border-emerald-200 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <div>
                <h4 className="font-bold text-sm text-emerald-950">
                  نتائج محاكاة الإهلاك لدورة {period}/{fiscalYear}
                </h4>
                <p className="text-xs text-emerald-800">
                  عدد الأصول المستحقة: <strong>{previewItems.length}</strong> أصل | إجمالي قسط الإهلاك المستحق: <strong>{totalPreviewAmount.toLocaleString('en-US')} SAR</strong>
                </p>
              </div>
            </div>

            <Button
              onClick={handlePost}
              disabled={loading || previewItems.length === 0}
              className="bg-[#0FA37F] hover:bg-[#0c8a6c] gap-2 font-bold shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>ترحيل رسمي للأستاذ العام (Post AFAB)</span>
            </Button>
          </div>

          {previewItems.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              لا توجد أصول مستحقة للإهلاك خلال هذه الفترة المحددة.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 text-start">رقم الأصل</th>
                    <th className="py-2.5 px-3 text-start">اسم الأصل</th>
                    <th className="py-2.5 px-3 text-start">الفئة</th>
                    <th className="py-2.5 px-3 text-start">مركز التكلفة</th>
                    <th className="py-2.5 px-3 text-start">القيمة الدفترية السابقة</th>
                    <th className="py-2.5 px-3 text-start">قسط إهلاك الدورة</th>
                    <th className="py-2.5 px-3 text-start">القيمة الدفترية الجديدة</th>
                    <th className="py-2.5 px-3 text-start">طريقة الإهلاك</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewItems.map((item) => (
                    <tr key={item.assetId} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{item.assetNumber}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{item.assetName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{item.category}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{item.costCenter}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">{item.previousBookValue.toLocaleString('en-US')} SAR</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-rose-600">{item.depreciationAmount.toLocaleString('en-US')} SAR</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-800">{item.newBookValue.toLocaleString('en-US')} SAR</td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">{item.method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Historical Depreciation Runs Table */}
      <Card className="p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#0B2545]" />
            <div>
              <h3 className="font-bold text-sm text-[#0B2545]">
                سجل دورات الإهلاك السابقة (Depreciation Posting Runs History)
              </h3>
              <p className="text-xs text-slate-500">
                قائمة بالدورات المرحلة مع أرقام قيود الأستاذ العام وإمكانية العكس المحاسبي (Storno)
              </p>
            </div>
          </div>
        </div>

        {runsHistory.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-200 rounded-xl">
            لم يتم ترحيل أي دورات إهلاك سابقة حتى الآن.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-start">رقم المستند (DEP)</th>
                  <th className="py-3 px-3 text-start">تاريخ الترحيل</th>
                  <th className="py-3 px-3 text-start">الفترة المالية</th>
                  <th className="py-3 px-3 text-start">عدد الأصول المشمولة</th>
                  <th className="py-3 px-3 text-start">إجمالي الإهلاك المرحل</th>
                  <th className="py-3 px-3 text-start">رقم قيد الأستاذ العام</th>
                  <th className="py-3 px-3 text-start">الحالة</th>
                  <th className="py-3 px-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runsHistory.map((run, idx) => (
                  <tr key={run.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-mono font-bold text-blue-900">{run.docNumber}</td>
                    <td className="py-3 px-3 font-mono">{run.runDate.split('T')[0]}</td>
                    <td className="py-3 px-3 font-semibold">فترة {run.period} / {run.fiscalYear}</td>
                    <td className="py-3 px-3 font-bold">{run.assetCount} أصل</td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-800">
                      {run.totalDepreciationAmount.toLocaleString('en-US')} SAR
                    </td>
                    <td className="py-3 px-3 font-mono text-blue-800 font-bold">
                      {run.journalEntryDocNumber || '—'}
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant={run.reversalDocNumber ? 'rejected' : 'completed'}>
                        {run.reversalDocNumber ? `معكوس (${run.reversalDocNumber})` : 'مرحل للأستاذ العام'}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {!run.reversalDocNumber && idx === 0 && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedRunToReverse(run)}
                          className="text-[11px] h-7 px-2 border-rose-200 text-rose-700 hover:bg-rose-50 font-bold gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>عكس الدورة (Storno)</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Confirm Storno Reversal Dialog */}
      <ConfirmDialog
        isOpen={Boolean(selectedRunToReverse)}
        onClose={() => setSelectedRunToReverse(null)}
        onConfirm={handleConfirmReverse}
        title="تأكيد عكس دورة الإهلاك (Storno Reversal)"
        message={`هل أنت متأكد من رغبتك في عكس وإلغاء دورة الإهلاك ${selectedRunToReverse?.docNumber} بقيمة ${selectedRunToReverse?.totalDepreciationAmount.toLocaleString('en-US')} ريال؟ سيتم إصدار قيد عكسي متوازن في الأستاذ العام واستعادة القيم الدفترية للأصول.`}
        confirmText="تأكيد العكس المحاسبي"
        cancelText="تراجع"
        variant="danger"
        loading={isReversing}
      />
    </div>
  );
};
