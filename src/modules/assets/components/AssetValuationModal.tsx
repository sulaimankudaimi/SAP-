import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { AssetService } from '../services/AssetService';
import { useAuthStore } from '../../../core/auth/useAuthStore';
import { useToast } from '../../../components/ui/Toast';
import type { Asset, AssetValuation } from '../../../types/models';
import { ClipboardCheck, ShieldAlert, Award, Paperclip } from 'lucide-react';
import { t } from '../../../i18n/ar';

interface AssetValuationModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  onSuccess: (valuation: AssetValuation) => void;
}

type RecommendedAction = 'Continue' | 'Maintenance' | 'Overhaul' | 'Disposal';
const VALID_ACTIONS: readonly RecommendedAction[] = ['Continue', 'Maintenance', 'Overhaul', 'Disposal'];

function parseRecommendedAction(val: string): RecommendedAction {
  return (VALID_ACTIONS as readonly string[]).includes(val) ? (val as RecommendedAction) : 'Continue';
}

export const AssetValuationModal: React.FC<AssetValuationModalProps> = ({
  isOpen,
  onClose,
  asset,
  onSuccess,
}) => {
  const user = useAuthStore((s) => s.user);
  const { success, error } = useToast();

  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [inspectorName, setInspectorName] = useState(user?.fullName || 'م. سامي الحربي (كبير مهندسي الفحص)');
  const [conditionScore, setConditionScore] = useState<number>(85);
  const [physicalConditionNotes, setPhysicalConditionNotes] = useState('');
  const [estimatedMarketValue, setEstimatedMarketValue] = useState(asset ? asset.netBookValue.toString() : '0');
  const [recommendedAction, setRecommendedAction] = useState<'Continue' | 'Maintenance' | 'Overhaul' | 'Disposal'>('Continue');
  const [attachmentName, setAttachmentName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!asset) return null;

  // Grade helper based on condition score
  const getGrade = (score: number): 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical' => {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    if (score >= 30) return 'Poor';
    return 'Critical';
  };

  const currentGrade = getGrade(conditionScore);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!physicalConditionNotes.trim()) {
      error('خطأ في الإدخال', 'يرجى كتابة الملاحظات والتقرير الفني لنتائج الفحص.');
      return;
    }
    if (!user) {
      error('خطأ في الجلسة', 'يرجى تسجيل الدخول أولاً.');
      return;
    }

    setIsSubmitting(true);
    try {
      const attachments = attachmentName.trim()
        ? [{ name: attachmentName.trim(), size: '2.4 MB', type: 'PDF' }]
        : [{ name: `تقرير_فحص_فني_${asset.assetNumber}.pdf`, size: '1.8 MB', type: 'PDF' }];

      const valuation = await AssetService.addTechnicalValuation(
        asset.id,
        {
          inspectionDate,
          inspectorName,
          conditionScore,
          conditionGrade: currentGrade,
          physicalConditionNotes,
          estimatedMarketValue: parseFloat(estimatedMarketValue) || undefined,
          recommendedAction,
          attachments,
        },
        { id: user.id, fullName: user.fullName }
      );

      success(
        'تم تسجيل تقرير الفحص الفني بنجاح',
        `تم حفظ وثيقة الفحص برقم ${valuation.docNumber} بدرجة تقييم ${conditionScore}/100 (${currentGrade})`
      );
      onSuccess(valuation);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل تسجيل التقييم';
      error('تعذر الحفظ', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`تسجيل فحص فني وتقييم كفاءة الأصل - ${asset.assetNumber}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Score & Grade Display */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800">
              درجة الكفاءة والجاهزية الفنية (Condition Score)
            </label>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg text-[#0B2545] font-mono">
                {conditionScore} / 100
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  currentGrade === 'Excellent'
                    ? 'bg-emerald-100 text-emerald-800'
                    : currentGrade === 'Good'
                    ? 'bg-blue-100 text-blue-800'
                    : currentGrade === 'Fair'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {currentGrade === 'Excellent'
                  ? 'ممتاز (Excellent)'
                  : currentGrade === 'Good'
                  ? 'جيد جداً (Good)'
                  : currentGrade === 'Fair'
                  ? 'مقبول (Fair)'
                  : currentGrade === 'Poor'
                  ? 'ضعيف (Poor)'
                  : 'حرج (Critical)'}
              </span>
            </div>
          </div>

          <input
            type="range"
            min={1}
            max={100}
            value={conditionScore}
            onChange={(e) => setConditionScore(parseInt(e.target.value, 10))}
            className="w-full accent-[#0FA37F] cursor-pointer"
          />
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              تاريخ الفحص والتقييم *
            </label>
            <Input
              type="date"
              value={inspectionDate}
              onChange={(e) => setInspectionDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              اسم المهندس / خبير الفحص *
            </label>
            <Input
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              القيمة السوقية العادلة المقدرة (SAR)
            </label>
            <Input
              type="number"
              step="0.01"
              value={estimatedMarketValue}
              onChange={(e) => setEstimatedMarketValue(e.target.value)}
              className="font-mono text-start"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              التوصية الهندسية المعتمدة
            </label>
            <Select
              value={recommendedAction}
              onChange={(e) => setRecommendedAction(parseRecommendedAction(e.target.value))}
              options={[
                { value: 'Continue', label: 'الاستمرار بالتشغيل الاعتيادي (Continue)' },
                { value: 'Maintenance', label: 'إدراج في خطة صيانة وقائية (Maintenance)' },
                { value: 'Overhaul', label: 'عمرة جسيمة وتجديد شامل (Overhaul)' },
                { value: 'Disposal', label: 'توصية بالتخريد والاستبعاد (Disposal)' },
              ]}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">
            تقرير الحالة الفنية والملاحظات الهندسية *
          </label>
          <Textarea
            value={physicalConditionNotes}
            onChange={(e) => setPhysicalConditionNotes(e.target.value)}
            placeholder="فحص سلامة الأجزاء الميكانيكية، قياس الاهتزازات، التسريبات، وضغوط التشغيل..."
            rows={3}
            required
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">
            اسم ملف التقرير الفني المرفق (PDF Attachment)
          </label>
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-slate-400" />
            <Input
              value={attachmentName}
              onChange={(e) => setAttachmentName(e.target.value)}
              placeholder="مثال: تقرير_فحص_المضخة_الهيدروليكية_2026.pdf"
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
            className="bg-[#0FA37F] hover:bg-[#0c8a6c] gap-2 font-bold"
          >
            <ClipboardCheck className="w-4 h-4" />
            {isSubmitting ? 'جاري الحفظ...' : 'اعتماد التقييم الفني'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
