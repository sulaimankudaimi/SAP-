import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { AssetService, type CreateAssetInput } from '../services/AssetService';
import { useAuthStore } from '../../../core/auth/useAuthStore';
import { useToast } from '../../../components/ui/Toast';
import type { Asset, AssetClass, DepreciationMethod } from '../../../types/models';
import { PlusCircle, Building2, Wrench, ShieldCheck, Layers } from 'lucide-react';
import { t } from '../../../i18n/ar';

interface AssetAcquisitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (asset: Asset) => void;
  aucAssetToSettle?: Asset | null;
}

export const AssetAcquisitionModal: React.FC<AssetAcquisitionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  aucAssetToSettle,
}) => {
  const user = useAuthStore((s) => s.user);
  const { success, error } = useToast();

  const [acquisitionMode, setAcquisitionMode] = useState<'Manual' | 'PO' | 'AuCSettlement'>(
    aucAssetToSettle ? 'AuCSettlement' : 'Manual'
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<AssetClass>('Machinery');
  const [serialNumber, setSerialNumber] = useState('');
  const [barcode, setBarcode] = useState('');
  const [plantCode, setPlantCode] = useState('1100');
  const [costCenter, setCostCenter] = useState('CC-1001');
  const [location, setLocation] = useState('المستودع الرئيسي - الرياض');
  const [custodian, setCustodian] = useState(user?.fullName || 'م. أحمد الشمري');
  const [acquisitionCost, setAcquisitionCost] = useState(
    aucAssetToSettle ? aucAssetToSettle.acquisitionCost.toString() : '150000'
  );
  const [acquisitionDate, setAcquisitionDate] = useState(new Date().toISOString().split('T')[0]);
  const [usefulLifeMonths, setUsefulLifeMonths] = useState('60');
  const [depreciationMethod, setDepreciationMethod] = useState<DepreciationMethod>('StraightLine');
  const [salvageValue, setSalvageValue] = useState('7500');
  const [sourceDocNumber, setSourceDocNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      error('خطأ في الإدخال', 'يرجى كتابة اسم أو توصيف الأصل الرأسمالي.');
      return;
    }

    if (!user) {
      error('خطأ في الجلسة', 'يرجى تسجيل الدخول أولاً.');
      return;
    }

    const costNum = parseFloat(acquisitionCost) || 0;
    const salvageNum = parseFloat(salvageValue) || 0;
    const usefulLifeNum = parseInt(usefulLifeMonths, 10) || 60;

    setIsSubmitting(true);
    try {
      const inputPayload: CreateAssetInput = {
        name,
        description,
        category,
        serialNumber,
        barcode: barcode.trim() || undefined,
        plantCode,
        costCenter,
        location,
        custodian,
        acquisitionDate,
        acquisitionCost: costNum,
        usefulLifeMonths: usefulLifeNum,
        depreciationMethod,
        salvageValue: salvageNum,
        sourceDocNumber: sourceDocNumber || undefined,
        acquisitionSource: acquisitionMode === 'AuCSettlement' ? 'AuCSettlement' : acquisitionMode,
      };

      if (acquisitionMode === 'AuCSettlement' && aucAssetToSettle) {
        const result = await AssetService.settleAuC({
          aucAssetId: aucAssetToSettle.id,
          targetAssetInput: inputPayload,
          user: { id: user.id, fullName: user.fullName },
        });
        success(
          'تمت تسوية الأصل قيد التنفيذ بنجاح',
          `تم تحويل ${aucAssetToSettle.assetNumber} إلى أصل مكتمل برقم ${result.finalAsset.assetNumber} وقيد تسوية ${result.je.docNumber}`
        );
        onSuccess(result.finalAsset);
      } else {
        const result = await AssetService.createAsset(inputPayload, {
          id: user.id,
          fullName: user.fullName,
        });
        success(
          'تم تسجيل الأصل بنجاح',
          `تم إنشاء الأصل رقم ${result.asset.assetNumber} وترحيل قيد الرأسمالية ${result.je?.docNumber || ''}`
        );
        onSuccess(result.asset);
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل تسجيل الأصل';
      error('تعذر الحفظ', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        aucAssetToSettle
          ? `تسوية أصل قيد التنفيذ (AuC Settlement - ${aucAssetToSettle.assetNumber})`
          : 'اقتناء ورأسمالية أصل جديد (Asset Capitalization - AS01)'
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Mode Selector */}
        {!aucAssetToSettle && (
          <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setAcquisitionMode('Manual')}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                acquisitionMode === 'Manual'
                  ? 'bg-white text-[#0B2545] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              اقتناء يدوي مباشر (Capitalization)
            </button>
            <button
              type="button"
              onClick={() => setAcquisitionMode('PO')}
              className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                acquisitionMode === 'PO'
                  ? 'bg-white text-[#0B2545] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ربط بأمر شراء / استلام (From PO/GR)
            </button>
          </div>
        )}

        {/* PO Reference fields if mode == PO */}
        {acquisitionMode === 'PO' && (
          <div className="bg-blue-50/70 border border-blue-200 p-4 rounded-xl space-y-2">
            <label className="text-xs font-bold text-blue-900 block">
              رقم أمر الشراء أو إشعار الاستلام (PO / GR Document)
            </label>
            <Input
              value={sourceDocNumber}
              onChange={(e) => setSourceDocNumber(e.target.value)}
              placeholder="مثال: PO-2026-000012 أو GR-2026-000004"
              className="bg-white font-mono"
            />
            <p className="text-[11px] text-blue-700">
              سيتم إنشاء قيد المقاصة الرأسمالية تلقائياً بين حساب الأصول وحساب وسيط الاستلام (GR/IR Clearing Account).
            </p>
          </div>
        )}

        {/* General Asset Data */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs font-bold text-slate-700 block mb-1">
              اسم وتوصيف الأصل الرأسمالي *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: مضخة حقن كيميائي هيدروليكية عالية الضغط"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              فئة الأصل الرأسمالي (Asset Class)
            </label>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value as AssetClass)}
              options={[
                { value: 'Machinery', label: 'الآلات والمضخات (Machinery)' },
                { value: 'StorageTanks', label: 'خزانات ومستودعات الوقود (Storage Tanks)' },
                { value: 'Vehicles', label: 'شاحنات النقل والأسطول (Vehicles)' },
                { value: 'Buildings', label: 'المباني والمنشآت اللوجستية (Buildings)' },
                { value: 'Pipelines', label: 'شبكات وخطوط الأنابيب (Pipelines)' },
                { value: 'IT', label: 'أنظمة وتجهيزات تقنية المعلومات (IT)' },
                { value: 'AuC', label: 'مشروعات قيد التنفيذ (Asset under Construction)' },
              ]}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              الرقم التسلسلي من المصنع (Serial Number)
            </label>
            <Input
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="مثال: SN-HYD-99824"
              className="font-mono text-start"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              رمز الباركود (اختياري - يولد آلياً)
            </label>
            <Input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="اتركه فارغاً للتوليد الآلي"
              className="font-mono text-start"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              أمين العهدة المسؤول (Custodian)
            </label>
            <Input
              value={custodian}
              onChange={(e) => setCustodian(e.target.value)}
              placeholder="اسم أمين العهدة"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              المحطة / المنشأة (Plant)
            </label>
            <Select
              value={plantCode}
              onChange={(e) => setPlantCode(e.target.value)}
              options={[
                { value: '1100', label: '1100 - محطة التوزيع المركزية بالرياض' },
                { value: '1200', label: '1200 - محطة ومستودعات جدة اللوجستية' },
                { value: '1300', label: '1300 - مستودع المنطقة الشرقية - الدمام' },
              ]}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              مركز التكلفة (Cost Center)
            </label>
            <Select
              value={costCenter}
              onChange={(e) => setCostCenter(e.target.value)}
              options={[
                { value: 'CC-1001', label: 'CC-1001 - إدارة العمليات والتشغيل' },
                { value: 'CC-1002', label: 'CC-1002 - الصيانة الهندسية والمعدات' },
                { value: 'CC-1003', label: 'CC-1003 - النقل واللوجستيات' },
                { value: 'CC-1004', label: 'CC-1004 - السلامة وضبط الجودة' },
              ]}
            />
          </div>

          <div className="col-span-2">
            <label className="text-xs font-bold text-slate-700 block mb-1">
              الموقع الفيزيائي داخل المنشأة
            </label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="مثال: مبنى الورشة المركزية - حظيرة المعدات الثقيلة"
            />
          </div>
        </div>

        {/* Valuation & Depreciation Parameters */}
        <div className="border-t border-slate-200 pt-4">
          <h5 className="text-xs font-bold text-[#0B2545] mb-3">
            المعايير المالية والإهلاك الدوري (Depreciation Parameters)
          </h5>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                تكلفة الاقتناء التاريخية (SAR) *
              </label>
              <Input
                type="number"
                step="0.01"
                value={acquisitionCost}
                onChange={(e) => {
                  setAcquisitionCost(e.target.value);
                  const cost = parseFloat(e.target.value) || 0;
                  setSalvageValue((cost * 0.05).toFixed(2));
                }}
                required
                className="font-mono text-start"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                تاريخ الاقتناء والرأسمالية
              </label>
              <Input
                type="date"
                value={acquisitionDate}
                onChange={(e) => setAcquisitionDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                طريقة الإهلاك المعتمدة
              </label>
              <Select
                value={depreciationMethod}
                onChange={(e) => setDepreciationMethod(e.target.value as DepreciationMethod)}
                options={[
                  { value: 'StraightLine', label: 'القسط الثابت (Straight-Line)' },
                  { value: 'DecliningBalance', label: 'القسط المتناقص (Declining Balance)' },
                ]}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                العمر الإنتاجي المقدر (بالأشهر)
              </label>
              <Input
                type="number"
                value={usefulLifeMonths}
                onChange={(e) => setUsefulLifeMonths(e.target.value)}
                placeholder="60 (5 سنوات)"
                className="font-mono text-start"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                قيمة الخردة / الإنقاذ المقدرة (SAR)
              </label>
              <Input
                type="number"
                step="0.01"
                value={salvageValue}
                onChange={(e) => setSalvageValue(e.target.value)}
                className="font-mono text-start"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            {t('action_cancel')}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-[#0FA37F] hover:bg-[#0c8a6c] gap-2 font-bold"
          >
            <PlusCircle className="w-4 h-4" />
            {isSubmitting ? 'جاري الرأسمالية والترحيل...' : 'حفظ ورأسمالية الأصل'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
