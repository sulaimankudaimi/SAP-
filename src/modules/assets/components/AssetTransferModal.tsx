import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { AssetService } from '../services/AssetService';
import { useAuthStore } from '../../../core/auth/useAuthStore';
import { useToast } from '../../../components/ui/Toast';
import type { Asset, AssetTransfer } from '../../../types/models';
import { ArrowRightLeft, Building2, User, MapPin } from 'lucide-react';
import { t } from '../../../i18n/ar';

interface AssetTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  onSuccess: (transfer: AssetTransfer) => void;
}

export const AssetTransferModal: React.FC<AssetTransferModalProps> = ({
  isOpen,
  onClose,
  asset,
  onSuccess,
}) => {
  const user = useAuthStore((s) => s.user);
  const { success, error } = useToast();

  const [toPlant, setToPlant] = useState(asset?.plantCode || '1200');
  const [toCostCenter, setToCostCenter] = useState(asset?.costCenter || 'CC-1002');
  const [toLocation, setToLocation] = useState('');
  const [toCustodian, setToCustodian] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!asset) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toCustodian.trim()) {
      error('خطأ في الإدخال', 'يرجى تحديد أمين العهدة الجديد.');
      return;
    }
    if (!reason.trim()) {
      error('خطأ في الإدخال', 'يرجى كتابة مبررات نقل العهدة أو الموقع.');
      return;
    }
    if (!user) {
      error('خطأ في الجلسة', 'يرجى تسجيل الدخول أولاً.');
      return;
    }

    setIsSubmitting(true);
    try {
      const transfer = await AssetService.createTransfer(
        {
          assetId: asset.id,
          toPlant,
          toCostCenter,
          toLocation: toLocation || undefined,
          toCustodian,
          reason,
        },
        { id: user.id, fullName: user.fullName }
      );

      success(
        'تم تسجيل طلب المناقلة بنجاح',
        `تم إصدار طلب المناقلة برقم ${transfer.docNumber} وهو قيد الاعتماد وتسليم العهدة.`
      );
      onSuccess(transfer);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل طلب نقل العهدة';
      error('تعذر إنشاء الطلب', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`طلب مناقلة وتحويل عهدة أصل - ${asset.assetNumber}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current State Summary */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="font-bold text-slate-800 text-sm">{asset.name}</div>
          <div className="grid grid-cols-2 gap-2 text-slate-600">
            <div>المحطة الحالية: <span className="font-bold text-slate-800">{asset.plantCode}</span></div>
            <div>مركز التكلفة الحالي: <span className="font-bold text-slate-800">{asset.costCenter}</span></div>
            <div>الموقع الحالي: <span className="font-bold text-slate-800">{asset.location || '—'}</span></div>
            <div>أمين العهدة الحالي: <span className="font-bold text-slate-800">{asset.custodian}</span></div>
          </div>
        </div>

        {/* Transfer Destination Form */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                المحطة المنقول إليها (To Plant) *
              </label>
              <Select
                value={toPlant}
                onChange={(e) => setToPlant(e.target.value)}
                options={[
                  { value: '1100', label: '1100 - محطة الرياض المركزية' },
                  { value: '1200', label: '1200 - محطة ومستودعات جدة' },
                  { value: '1300', label: '1300 - مستودع الدمام اللوجستي' },
                ]}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                مركز التكلفة الجديد (To Cost Center) *
              </label>
              <Select
                value={toCostCenter}
                onChange={(e) => setToCostCenter(e.target.value)}
                options={[
                  { value: 'CC-1001', label: 'CC-1001 - العمليات والتشغيل' },
                  { value: 'CC-1002', label: 'CC-1002 - الصيانة الهندسية' },
                  { value: 'CC-1003', label: 'CC-1003 - النقل واللوجستيات' },
                  { value: 'CC-1004', label: 'CC-1004 - السلامة والجودة' },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              أمين العهدة الجديد (New Custodian) *
            </label>
            <Input
              value={toCustodian}
              onChange={(e) => setToCustodian(e.target.value)}
              placeholder="مثال: م. خالد الغامدي"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              الموقع الفيزيائي الجديد (New Location)
            </label>
            <Input
              value={toLocation}
              onChange={(e) => setToLocation(e.target.value)}
              placeholder="مثال: رصيف الشحن رقم 4 - المحطة الغربية"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              أسباب ومبررات المناقلة (Reason for Transfer) *
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="اكتب أسباب النقل التشغيلية أو إعادة التوزيع بين المحطات..."
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
            className="bg-[#2563EB] hover:bg-[#1d4ed8] gap-2 font-bold"
          >
            <ArrowRightLeft className="w-4 h-4" />
            {isSubmitting ? 'جاري الإرسال...' : 'إصدار طلب المناقلة (ABT1N)'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
