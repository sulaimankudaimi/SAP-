import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { AssetService } from '../services/AssetService';
import { useAuthStore } from '../../../core/auth/useAuthStore';
import { useToast } from '../../../components/ui/Toast';
import type { Asset } from '../../../types/models';
import { Trash2, DollarSign, AlertTriangle, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';
import { t } from '../../../i18n/ar';

interface AssetDisposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  onSuccess: (updatedAsset: Asset) => void;
}

export const AssetDisposalModal: React.FC<AssetDisposalModalProps> = ({
  isOpen,
  onClose,
  asset,
  onSuccess,
}) => {
  const user = useAuthStore((s) => s.user);
  const { success, error } = useToast();

  const [disposalType, setDisposalType] = useState<'Scrap' | 'Sale'>('Scrap');
  const [disposalDate, setDisposalDate] = useState(new Date().toISOString().split('T')[0]);
  const [proceeds, setProceeds] = useState('0');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!asset) return null;

  const cost = asset.acquisitionCost;
  const accDep = asset.accumulatedDepreciation;
  const netBookValue = Math.max(0, cost - accDep);
  const proceedsNum = disposalType === 'Sale' ? parseFloat(proceeds) || 0 : 0;
  const gainLoss = proceedsNum - netBookValue;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      error('خطأ في الإدخال', 'يرجى كتابة سبب الاستبعاد أو محضر اللجنة الفنية.');
      return;
    }
    if (!user) {
      error('خطأ في الجلسة', 'يرجى تسجيل الدخول أولاً.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await AssetService.disposeAsset(
        asset.id,
        {
          disposalType,
          disposalDate,
          proceeds: proceedsNum,
          reason,
        },
        { id: user.id, fullName: user.fullName }
      );

      const impactMsg =
        result.gainLoss >= 0
          ? `مع تحقيق أرباح رأسمالية قدرها ${result.gainLoss.toLocaleString('en-US')} ريال`
          : `مع إثبات خسائر رأسمالية قدرها ${Math.abs(result.gainLoss).toLocaleString('en-US')} ريال`;

      success(
        'تم استبعاد الأصل وترحيل القيد بنجاح',
        `تم استبعاد ${asset.assetNumber} وإنشاء القيد المحاسبي ${result.je.docNumber} (${impactMsg})`
      );
      onSuccess(result.asset);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل استبعاد الأصل';
      error('تعذر استبعاد الأصل', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`استبعاد وتخريد أصل رأسمالي (Asset Retirement - ABAVN) - ${asset.assetNumber}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Warning Banner */}
        <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex items-start gap-3 text-xs text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>تنبيه مالي:</strong> استبعاد الأصل سينشئ قيد محاسبي متوازن في دفتر الأستاذ العام (GL) لإقفال القيمة التاريخية ومجمع الإهلاك، وإثبات الأرباح أو الخسائر الرأسمالية الناتجة.
          </p>
        </div>

        {/* Real-time Math Summary Card */}
        <div className="border border-slate-200 bg-slate-50/80 rounded-xl p-4 space-y-3">
          <h5 className="font-bold text-xs text-[#0B2545] border-b border-slate-200 pb-2">
            الأثر المالي المباشر لاستبعاد الأصل
          </h5>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>التكلفة التاريخية: <span className="font-bold text-slate-800 font-mono">{cost.toLocaleString('en-US')} ريال</span></div>
            <div>مجمع الإهلاك المتراكم: <span className="font-bold text-slate-800 font-mono">{accDep.toLocaleString('en-US')} ريال</span></div>
            <div>صافي القيمة الدفترية (NBV): <span className="font-bold text-slate-800 font-mono">{netBookValue.toLocaleString('en-US')} ريال</span></div>
            <div>متحصلات البيع: <span className="font-bold text-slate-800 font-mono">{proceedsNum.toLocaleString('en-US')} ريال</span></div>
          </div>

          <div className={`p-3 rounded-lg flex items-center justify-between text-xs font-bold ${
            gainLoss > 0
              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              : gainLoss < 0
              ? 'bg-rose-100 text-rose-900 border border-rose-300'
              : 'bg-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center gap-2">
              {gainLoss > 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-700" />
              ) : gainLoss < 0 ? (
                <TrendingDown className="w-4 h-4 text-rose-700" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-slate-600" />
              )}
              <span>
                {gainLoss > 0
                  ? 'أرباح رأسمالية من الاستبعاد (Gain on Disposal)'
                  : gainLoss < 0
                  ? 'خسائر استبعاد وتخريد رأسمالية (Loss on Scrap)'
                  : 'تعادل (لا ربح ولا خسارة)'}
              </span>
            </div>
            <span className="font-mono text-sm">
              {Math.abs(gainLoss).toLocaleString('en-US')} ريال
            </span>
          </div>
        </div>

        {/* Inputs */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                نوع الاستبعاد (Disposal Type) *
              </label>
              <Select
                value={disposalType}
                onChange={(e) => {
                  const val = e.target.value as 'Scrap' | 'Sale';
                  setDisposalType(val);
                  if (val === 'Scrap') setProceeds('0');
                }}
                options={[
                  { value: 'Scrap', label: 'تخريد كامل بدون قيمة (Scrap)' },
                  { value: 'Sale', label: 'بيع بمقابل نقدي (Sale with Proceeds)' },
                ]}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                تاريخ الاستبعاد المحاسبي *
              </label>
              <Input
                type="date"
                value={disposalDate}
                onChange={(e) => setDisposalDate(e.target.value)}
                required
              />
            </div>
          </div>

          {disposalType === 'Sale' && (
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                قيمة البيع / المتحصلات النقدية (SAR) *
              </label>
              <Input
                type="number"
                step="0.01"
                value={proceeds}
                onChange={(e) => setProceeds(e.target.value)}
                required
                className="font-mono text-start"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              مبررات الاستبعاد ورقم محضر التخريد (Disposal Justification) *
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: تقادم فني وعدم الجدوى الاقتصادية للصيانة وفق محضر اللجنة رقم 44/2026..."
              rows={3}
              required
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            {t('action_cancel')}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-rose-600 hover:bg-rose-700 text-white gap-2 font-bold"
          >
            <Trash2 className="w-4 h-4" />
            {isSubmitting ? 'جاري الاستبعاد والترحيل...' : 'تأكيد الاستبعاد وترحيل القيد'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
