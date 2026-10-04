import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Checkbox } from '../../../components/ui/Checkbox';
import { useToast } from '../../../components/ui/Toast';
import { db } from '../../../core/db';
import { InventoryService } from '../services/InventoryService';
import { useAuthStore } from '../../../core/auth/useAuthStore';
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Boxes,
  FileCheck,
  Lock,
  ArrowRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { StorageLocation, PhysicalInventoryDoc } from '../../../types/models';

interface PhysicalInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (piDocNumber: string) => void;
  activeDoc?: PhysicalInventoryDoc | null;
}

export const PhysicalInventoryModal: React.FC<PhysicalInventoryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  activeDoc,
}) => {
  const { user } = useAuthStore();
  const { success, error } = useToast();

  const [step, setStep] = useState<'create' | 'count' | 'review'>('create');
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);

  // Step 1: Create Document fields
  const [plantCode, setPlantCode] = useState('1100');
  const [storageLocation, setStorageLocation] = useState('SL01');
  const [freezeMovements, setFreezeMovements] = useState(true);
  const [abcClassFilter, setAbcClassFilter] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL');

  // Step 2 & 3: Active Working Document & Items
  const [workingDoc, setWorkingDoc] = useState<PhysicalInventoryDoc | null>(null);
  const [countedQuantities, setCountedQuantities] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    db.storageLocations.toArray().then(setStorageLocations);

    if (activeDoc) {
      setWorkingDoc(activeDoc);
      const initialCounts: Record<string, number> = {};
      activeDoc.items.forEach((item) => {
        initialCounts[item.materialCode] = item.countedQty ?? item.bookQty;
      });
      setCountedQuantities(initialCounts);
      setStep(activeDoc.status === 'in_review' ? 'review' : 'count');
    } else {
      setStep('create');
      setWorkingDoc(null);
    }
  }, [isOpen, activeDoc]);

  // Handle Step 1: Create
  const handleCreateDocument = async () => {
    setIsSubmitting(true);
    try {
      const doc = await InventoryService.createPhysicalInventoryDoc({
        plantCode,
        storageLocation,
        freezeMovements,
        abcClassFilter,
        userId: user?.id || 'u-wh-clerk',
      });

      setWorkingDoc(doc);
      const initialCounts: Record<string, number> = {};
      doc.items.forEach((item) => {
        initialCounts[item.materialCode] = item.bookQty;
      });
      setCountedQuantities(initialCounts);
      setStep('count');
      success('تم إنشاء مستند الجرد بنجاح (MI01)', `رقم المستند: ${doc.docNumber}`);
    } catch (err) {
      error('خطأ', err instanceof Error ? err.message : 'فشل إنشاء مستند الجرد');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Step 2: Save Counts
  const handleSaveCounts = async () => {
    if (!workingDoc) return;

    setIsSubmitting(true);
    try {
      const payload = Object.entries(countedQuantities).map(([materialCode, countedQty]) => ({
        materialCode,
        countedQty,
      }));

      const updated = await InventoryService.savePhysicalInventoryCounts(
        workingDoc.id,
        payload,
        user?.id || 'u-wh-clerk'
      );

      setWorkingDoc(updated);
      setStep('review');
      success('تم حفظ نتائج العد والجرد (MI04)', 'انتقل إلى مراجعة الفروقات والاعتماد النهائي.');
    } catch (err) {
      error('خطأ', err instanceof Error ? err.message : 'فشل حفظ كميات الجرد');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Step 3: Approve & Post Differences
  const handlePostDifferences = async () => {
    if (!workingDoc) return;

    setIsSubmitting(true);
    try {
      const res = await InventoryService.postPhysicalInventoryDifferences(
        workingDoc.id,
        user?.id || 'u-wh-clerk',
        user?.fullName || 'أمين المستودع'
      );

      success(
        'تم ترحيل فروقات الجرد بنجاح (MI07)',
        `تم ترحيل مستندات المواد: ${res.materialDocNumbers.join(', ')}`
      );

      onSuccess(workingDoc.docNumber);
      onClose();
    } catch (err) {
      error('فشل الترحيل', err instanceof Error ? err.message : 'حدث خطأ أثناء ترحيل فروقات الجرد');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Compute live variance stats
  const itemsStats = (workingDoc?.items || []).map((item) => {
    const counted = countedQuantities[item.materialCode] ?? item.bookQty;
    const variance = counted - item.bookQty;
    const varianceValue = variance * item.unitPrice;
    return { ...item, counted, variance, varianceValue };
  });

  const totalVarianceValue = itemsStats.reduce((acc, i) => acc + i.varianceValue, 0);
  const totalSurplusCount = itemsStats.filter((i) => i.variance > 0).length;
  const totalDeficitCount = itemsStats.filter((i) => i.variance < 0).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="إجراءات الجرد الفعلي للمستودع (Physical Inventory MI01 / MI04 / MI07)"
      size="xl"
    >
      <div className="space-y-6 text-start" dir="rtl">
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between border-b border-[#E5EAF2] pb-3 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold font-mono ${
                step === 'create' ? 'bg-[#0FA37F] text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              1
            </span>
            <span className={step === 'create' ? 'font-bold text-[#0FA37F]' : 'text-[#64748B]'}>
              إنشاء مستند الجرد (MI01)
            </span>
          </div>

          <ArrowRight className="w-4 h-4 text-slate-300" />

          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold font-mono ${
                step === 'count' ? 'bg-[#0FA37F] text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              2
            </span>
            <span className={step === 'count' ? 'font-bold text-[#0FA37F]' : 'text-[#64748B]'}>
              إدخال كميات العد الفعلي (MI04)
            </span>
          </div>

          <ArrowRight className="w-4 h-4 text-slate-300" />

          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold font-mono ${
                step === 'review' ? 'bg-[#0FA37F] text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              3
            </span>
            <span className={step === 'review' ? 'font-bold text-[#0FA37F]' : 'text-[#64748B]'}>
              تقرير الفروقات وترحيل التسوية (MI07)
            </span>
          </div>
        </div>

        {/* STEP 1: CREATE DOCUMENT */}
        {step === 'create' && (
          <div className="space-y-4">
            <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-[#E5EAF2] space-y-4">
              <h4 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-[#0FA37F]" />
                تحديد معايير ونطاق الجرد الفعلي:
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="اختر المستودع / الموقع المراد جرده:"
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  options={storageLocations.map((s) => ({
                    label: `${s.code} - ${s.name} (${s.type})`,
                    value: s.code,
                  }))}
                />

                <Select
                  label="تصفية حسب تصنيف الأهمية (ABC Class):"
                  value={abcClassFilter}
                  onChange={(e) => setAbcClassFilter(e.target.value as 'ALL' | 'A' | 'B' | 'C')}
                  options={[
                    { label: 'كافة الأصناف بدون تصفية (All)', value: 'ALL' },
                    { label: 'أصناف الفئة A فقط (أعلى 80% قيمة)', value: 'A' },
                    { label: 'أصناف الفئة B فقط (15% قيمة)', value: 'B' },
                    { label: 'أصناف الفئة C فقط (5% قيمة)', value: 'C' },
                  ]}
                />
              </div>

              <div className="p-3 bg-white rounded-xl border border-[#E5EAF2] space-y-2">
                <Checkbox
                  label="تجميد الحركات المخزنية أثناء الجرد (Freeze Book Inventory):"
                  checked={freezeMovements}
                  onChange={(e) => setFreezeMovements(e.target.checked)}
                />
                <p className="text-[11px] text-[#64748B] me-6">
                  عند التفعيل، يتم اعتماد الأرصدة الدفترية في لحظة إنشاء المستند وتجميد الصرف لمنع التضارب
                  أثناء العد اليدوي.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <Button type="button" variant="secondary" onClick={onClose}>
                إلغاء
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={isSubmitting}
                onClick={handleCreateDocument}
                icon={<ClipboardCheck className="w-4 h-4" />}
              >
                توليد مستند الجرد وبدء العد
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: COUNT ENTRY */}
        {step === 'count' && workingDoc && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs">
              <span className="font-bold text-[#0F172A]">
                مستند الجرد: <strong className="font-mono text-[#0FA37F]">{workingDoc.docNumber}</strong> | المستودع: [
                {workingDoc.storageLocation}]
              </span>
              <Badge variant="in_progress">
                عدد البنود: {workingDoc.items.length}
              </Badge>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-xl border border-[#E5EAF2]">
              <table className="w-full text-start text-xs">
                <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E5EAF2] sticky top-0">
                  <tr>
                    <th className="p-2.5 text-start">البند</th>
                    <th className="p-2.5 text-start">الصنف</th>
                    <th className="p-2.5 text-center">الرصيد الدفتري (Book Qty)</th>
                    <th className="p-2.5 text-center w-36">العد الفعلي (Counted Qty)</th>
                    <th className="p-2.5 text-center">الفارق المتوقع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EAF2] bg-white">
                  {workingDoc.items.map((item) => {
                    const counted = countedQuantities[item.materialCode] ?? item.bookQty;
                    const diff = counted - item.bookQty;

                    return (
                      <tr key={item.materialCode} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono text-center text-[#64748B]">{item.lineItem}</td>
                        <td className="p-2.5">
                          <div className="font-bold text-[#0F172A]">{item.materialName}</div>
                          <div className="font-mono text-[10px] text-[#64748B]">{item.materialCode}</div>
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-[#0F172A]">
                          {item.bookQty} {item.unit}
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={counted}
                            onChange={(e) =>
                              setCountedQuantities({
                                ...countedQuantities,
                                [item.materialCode]: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-28 px-2 py-1 border border-[#E5EAF2] rounded-lg text-center font-mono font-bold text-[#0FA37F] focus:border-[#0FA37F] focus:outline-none"
                          />
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold">
                          <span className={diff > 0 ? 'text-[#0FA37F]' : diff < 0 ? 'text-[#EF4444]' : 'text-slate-400'}>
                            {diff > 0 ? `+${diff}` : diff} {item.unit}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[#E5EAF2]">
              <Button type="button" variant="secondary" onClick={() => setStep('create')}>
                رجوع
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={isSubmitting}
                onClick={handleSaveCounts}
                icon={<FileCheck className="w-4 h-4" />}
              >
                حفظ العد واستعراض تقرير الفروقات (MI20)
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: VARIANCE REPORT & POSTING */}
        {step === 'review' && workingDoc && (
          <div className="space-y-4">
            {/* KPI Summary Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-white rounded-xl border border-[#E5EAF2] text-center">
                <span className="text-[11px] text-[#64748B]">أصناف بزيادة (فائض 701):</span>
                <div className="text-base font-bold text-[#0FA37F] flex items-center justify-center gap-1 mt-0.5">
                  <TrendingUp className="w-4 h-4" /> {totalSurplusCount} صنف
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-[#E5EAF2] text-center">
                <span className="text-[11px] text-[#64748B]">أصناف بنقص (عجز 702):</span>
                <div className="text-base font-bold text-[#EF4444] flex items-center justify-center gap-1 mt-0.5">
                  <TrendingDown className="w-4 h-4" /> {totalDeficitCount} صنف
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-[#E5EAF2] text-center">
                <span className="text-[11px] text-[#64748B]">صافي القيمة المالية للفروقات:</span>
                <div
                  className={`text-base font-bold font-mono mt-0.5 ${
                    totalVarianceValue >= 0 ? 'text-[#0FA37F]' : 'text-[#EF4444]'
                  }`}
                >
                  {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(totalVarianceValue)} ر.س
                </div>
              </div>
            </div>

            {/* Differences Table */}
            <div className="max-h-72 overflow-y-auto rounded-xl border border-[#E5EAF2]">
              <table className="w-full text-start text-xs">
                <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E5EAF2] sticky top-0">
                  <tr>
                    <th className="p-2.5 text-start">الصنف</th>
                    <th className="p-2.5 text-center">الدفتري</th>
                    <th className="p-2.5 text-center">الفعلي</th>
                    <th className="p-2.5 text-center">فارق الكمية</th>
                    <th className="p-2.5 text-end">سعر الوحدة</th>
                    <th className="p-2.5 text-end">قيمة الفارق</th>
                    <th className="p-2.5 text-center">حركة التسوية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EAF2] bg-white">
                  {itemsStats.map((item) => (
                    <tr key={item.materialCode} className="hover:bg-slate-50">
                      <td className="p-2.5">
                        <div className="font-bold text-[#0F172A]">{item.materialName}</div>
                        <div className="font-mono text-[10px] text-[#64748B]">{item.materialCode}</div>
                      </td>
                      <td className="p-2.5 text-center font-mono">{item.bookQty}</td>
                      <td className="p-2.5 text-center font-mono font-bold text-[#0F172A]">{item.counted}</td>
                      <td className="p-2.5 text-center font-mono font-bold">
                        <span className={item.variance > 0 ? 'text-[#0FA37F]' : item.variance < 0 ? 'text-[#EF4444]' : 'text-slate-400'}>
                          {item.variance > 0 ? `+${item.variance}` : item.variance} {item.unit}
                        </span>
                      </td>
                      <td className="p-2.5 text-end font-mono text-[#64748B]">
                        {new Intl.NumberFormat('en-US').format(item.unitPrice)} ر.س
                      </td>
                      <td
                        className={`p-2.5 text-end font-mono font-bold ${
                          item.varianceValue > 0 ? 'text-[#0FA37F]' : item.varianceValue < 0 ? 'text-[#EF4444]' : 'text-slate-400'
                        }`}
                      >
                        {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(item.varianceValue)} ر.س
                      </td>
                      <td className="p-2.5 text-center">
                        {item.variance > 0 ? (
                          <Badge variant="approved">
                            701 فائض
                          </Badge>
                        ) : item.variance < 0 ? (
                          <Badge variant="critical">
                            702 عجز
                          </Badge>
                        ) : (
                          <Badge variant="neutral">
                            مطابق
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[#E5EAF2]">
              <Button type="button" variant="secondary" onClick={() => setStep('count')}>
                تعديل الأرقام
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={isSubmitting}
                onClick={handlePostDifferences}
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                اعتماد وترحيل فروقات الجرد (Post MI07)
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
