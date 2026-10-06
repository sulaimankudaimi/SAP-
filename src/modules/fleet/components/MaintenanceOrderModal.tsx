import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { useToast } from '../../../components/ui/Toast';
import { db } from '../../../core/db';
import { FleetService } from '../services/FleetService';
import { DiagnosticLogger } from '../../../core/services/DiagnosticLogger';
import { getErrorMessage } from '../../../core/utils';
import type {
  Vehicle,
  MaintenanceOrder,
  Material,
  MaintenancePartItem,
} from '../../../types/models';
import {
  Wrench,
  Boxes,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
} from 'lucide-react';

interface MaintenanceOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingOrder?: MaintenanceOrder | null;
}

type MaintenanceOrderType = 'Preventive' | 'Corrective' | 'Inspection';
const VALID_ORDER_TYPES: readonly MaintenanceOrderType[] = ['Preventive', 'Corrective', 'Inspection'];

function parseOrderType(val: string): MaintenanceOrderType {
  return (VALID_ORDER_TYPES as readonly string[]).includes(val)
    ? (val as MaintenanceOrderType)
    : 'Preventive';
}

export const MaintenanceOrderModal: React.FC<MaintenanceOrderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingOrder,
}) => {
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'details' | 'parts' | 'closure'>('details');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [availableMaterials, setAvailableMaterials] = useState<Material[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Order Details
  const [vehicleId, setVehicleId] = useState('');
  const [orderType, setOrderType] = useState<'Preventive' | 'Corrective' | 'Inspection'>('Preventive');
  const [description, setDescription] = useState('');
  const [faultReported, setFaultReported] = useState('');
  const [estimatedCost, setEstimatedCost] = useState(2500);
  const [startDate, setStartDate] = useState('');

  // Parts issuing (Movement 261)
  const [partsToIssue, setPartsToIssue] = useState<MaintenancePartItem[]>([]);
  const [selectedMaterialCode, setSelectedMaterialCode] = useState('');
  const [partQuantity, setPartQuantity] = useState(1);
  const [partStorageLocation, setPartStorageLocation] = useState('SL01');

  // Closure Details
  const [laborHours, setLaborHours] = useState(4);
  const [laborRate, setLaborRate] = useState(120);
  const [downtimeHours, setDowntimeHours] = useState(6);
  const [completionDate, setCompletionDate] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
      const now = new Date().toISOString().slice(0, 10);
      setStartDate(now);
      setCompletionDate(now);

      if (existingOrder) {
        setVehicleId(existingOrder.vehicleId);
        setOrderType(existingOrder.orderType);
        setDescription(existingOrder.description);
        setFaultReported(existingOrder.faultReported || '');
        setEstimatedCost(existingOrder.estimatedCost);
        setStartDate(existingOrder.startDate);
        setLaborHours(existingOrder.laborHours || 4);
        setDowntimeHours(existingOrder.downtimeHours || 6);
        setActiveTab(existingOrder.status === 'completed' ? 'details' : 'parts');
      } else {
        setActiveTab('details');
        setPartsToIssue([]);
      }
    }
  }, [isOpen, existingOrder]);

  const loadData = async () => {
    try {
      const [vList, mList] = await Promise.all([
        FleetService.getVehicles(),
        db.materials.filter((m) => !m.isDeleted).toArray(),
      ]);
      setVehicles(vList);
      setAvailableMaterials(mList);

      if (vList.length > 0 && !vehicleId) {
        setVehicleId(vList[0].id);
      }
      if (mList.length > 0 && !selectedMaterialCode) {
        setSelectedMaterialCode(mList[0].materialCode);
      }
    } catch (err) {
      DiagnosticLogger.error('FleetModule', 'Failed to load vehicle and material lists in modal', err);
    }
  };

  const handleAddPartRow = () => {
    const material = availableMaterials.find((m) => m.materialCode === selectedMaterialCode);
    if (!material) return;

    const unitPrice = material.standardPrice || 150;
    const newItem: MaintenancePartItem = {
      lineItem: (partsToIssue.length + 1) * 10,
      materialCode: material.materialCode,
      materialName: material.name,
      quantity: partQuantity,
      unit: material.baseUnit,
      unitPrice,
      totalCost: partQuantity * unitPrice,
      storageLocation: partStorageLocation,
    };

    setPartsToIssue([...partsToIssue, newItem]);
    setPartQuantity(1);
  };

  const handleRemovePartRow = (index: number) => {
    setPartsToIssue(partsToIssue.filter((_, idx) => idx !== index));
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId) {
      error('تنبيه', 'يرجى اختيار المركبة');
      return;
    }

    setIsSubmitting(true);
    try {
      const order = await FleetService.createMaintenanceOrder({
        vehicleId,
        orderType,
        description,
        faultReported,
        estimatedCost,
        startDate,
      });

      success('تم إنشاء أمر الصيانة', `تم فتح أمر الصيانة رقم ${order.docNumber}`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      error('خطأ', getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIssuePartsMovement261 = async () => {
    if (!existingOrder) return;
    if (partsToIssue.length === 0) {
      error('تنبيه', 'يرجى إضافة قطع غيار لصرفها');
      return;
    }

    setIsSubmitting(true);
    try {
      const { order, materialDocNumber } = await FleetService.issuePartsToMaintenanceOrder(
        existingOrder.id,
        partsToIssue
      );

      success(
        'تم صرف قطع الغيار بنجاح (حركة 261)',
        `تم خصم المواد من المخزون بمستند المواد: ${materialDocNumber}`
      );
      setPartsToIssue([]);
      onSuccess();
      setActiveTab('closure');
    } catch (err: unknown) {
      error('خطأ في صرف المخزون', getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingOrder) return;

    setIsSubmitting(true);
    try {
      const completed = await FleetService.completeMaintenanceOrder(existingOrder.id, {
        laborHours,
        laborRatePerHour: laborRate,
        downtimeHours,
        completionDate,
      });

      success(
        'تم إغلاق أمر الصيانة بنجاح',
        `تم اعتماد اكتمال الصيانة ${completed.docNumber} وإعادة المركبة للخدمة (التكلفة: ${completed.actualCost.toLocaleString()} ر.س)`
      );
      onSuccess();
      onClose();
    } catch (err: unknown) {
      error('خطأ', getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        existingOrder
          ? `أمر صيانة أسطول [${existingOrder.docNumber}] - ${existingOrder.vehiclePlate}`
          : 'إنشاء أمر صيانة أسطول وقود جديد (Fleet Maintenance Work Order)'
      }
      size="lg"
    >
      {existingOrder && (
        <div className="flex border-b border-[#E5EAF2] mb-4" dir="rtl">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'details'
                ? 'border-[#0FA37F] text-[#0FA37F]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            تفاصيل الأمر
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('parts')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'parts'
                ? 'border-[#0FA37F] text-[#0FA37F]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            صرف قطع الغيار من المخزون (حركة 261)
            {existingOrder.partsUsed.length > 0 && (
              <Badge variant="in_progress">{existingOrder.partsUsed.length}</Badge>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('closure')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'closure'
                ? 'border-[#0FA37F] text-[#0FA37F]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            إغلاق الأمر والعمالة
          </button>
        </div>
      )}

      {/* TAB 1: CREATE / DETAILS */}
      {(!existingOrder || activeTab === 'details') && (
        <form onSubmit={handleCreateOrder} className="space-y-4 text-start" dir="rtl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="اختر الشاحنة / المركبة:"
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              disabled={!!existingOrder}
              options={vehicles.map((v) => ({
                label: `${v.code} - ${v.plateNumber} (${v.makeModel})`,
                value: v.id,
              }))}
            />

            <Select
              label="نوع أمر الصيانة:"
              value={orderType}
              onChange={(e) => setOrderType(parseOrderType(e.target.value))}
              disabled={!!existingOrder}
              options={[
                { label: 'صيانة دورية وقائية (Preventive)', value: 'Preventive' },
                { label: 'صيانة طارئة / إصلاح عطل (Corrective)', value: 'Corrective' },
                { label: 'فحص دوري ومعايرة فنية (Inspection)', value: 'Inspection' },
              ]}
            />
          </div>

          <Input
            label="وصف أعمال الصيانة المطلوبة:"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="مثال: فحص دوري لمضخة التفريغ وتغيير زيت المحرك وفلاتر الوقود"
            disabled={!!existingOrder}
            required
          />

          <Input
            label="العطل المُبلغ عنه (في حال وجود شكوى سائق):"
            value={faultReported}
            onChange={(e) => setFaultReported(e.target.value)}
            placeholder="مثال: صوت احتكاك عند المكابح، تسريب في صمام التفريغ السريع"
            disabled={!!existingOrder}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="التكلفة التقديرية (ر.س):"
              type="number"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(parseFloat(e.target.value) || 0)}
              disabled={!!existingOrder}
              required
            />
            <Input
              label="تاريخ بدء العمل:"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={!!existingOrder}
              required
            />
          </div>

          {!existingOrder && (
            <div className="flex justify-end gap-3 pt-3 border-t border-[#E5EAF2]">
              <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                إلغاء
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                icon={<Wrench className="w-4 h-4" />}
              >
                إنشاء أمر الصيانة وإدخال المركبة للورشة
              </Button>
            </div>
          )}
        </form>
      )}

      {/* TAB 2: ISSUE SPARE PARTS VIA MOVEMENT 261 */}
      {existingOrder && activeTab === 'parts' && (
        <div className="space-y-4 text-start" dir="rtl">
          {/* Header notice */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-[#0FA37F]" />
              <span className="font-bold text-[#0F172A]">
                صرف قطع الغيار ومواد الصيانة مباشرة من المستودع بحركة SAP MM-261
              </span>
            </div>
            {existingOrder.materialDocNumber && (
              <Badge variant="approved">
                مستند صرف المواد: {existingOrder.materialDocNumber}
              </Badge>
            )}
          </div>

          {/* Add Part Strip */}
          {existingOrder.status !== 'completed' && (
            <div className="p-3 bg-[#F8FAFC] border border-[#E5EAF2] rounded-xl space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Select
                    label="اختر قطعة الغيار من سجل المواد:"
                    value={selectedMaterialCode}
                    onChange={(e) => setSelectedMaterialCode(e.target.value)}
                    options={availableMaterials.map((m) => ({
                      label: `${m.materialCode} - ${m.name} (${m.standardPrice} ر.س / ${m.baseUnit})`,
                      value: m.materialCode,
                    }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="الكمية:"
                    type="number"
                    min="1"
                    value={partQuantity}
                    onChange={(e) => setPartQuantity(parseInt(e.target.value) || 1)}
                  />
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      className="w-full"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={handleAddPartRow}
                    >
                      إضافة
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pending Parts To Issue Table */}
          {partsToIssue.length > 0 && (
            <div className="border border-emerald-300 rounded-xl overflow-hidden bg-emerald-50/30">
              <div className="p-2.5 bg-emerald-100/60 font-bold text-xs text-[#0FA37F] flex justify-between items-center">
                <span>قطع غيار جديدة مجهزة للصرف (بانتظار تأكيد حركة 261):</span>
                <span>
                  الإجمالي: {partsToIssue.reduce((a, b) => a + b.totalCost, 0).toLocaleString()} ر.س
                </span>
              </div>
              <table className="w-full text-xs text-start">
                <thead className="bg-white/80 border-b border-emerald-200 text-[#64748B]">
                  <tr>
                    <th className="p-2 text-start">رمز الصنف</th>
                    <th className="p-2 text-start">اسم القطعة</th>
                    <th className="p-2 text-center">الكمية</th>
                    <th className="p-2 text-end">سعر الوحدة</th>
                    <th className="p-2 text-end">الإجمالي</th>
                    <th className="p-2 text-center">إلغاء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100 bg-white">
                  {partsToIssue.map((p, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-mono text-[#64748B]">{p.materialCode}</td>
                      <td className="p-2 font-bold text-[#0F172A]">{p.materialName}</td>
                      <td className="p-2 text-center font-bold">
                        {p.quantity} {p.unit}
                      </td>
                      <td className="p-2 text-end font-mono">{p.unitPrice} ر.س</td>
                      <td className="p-2 text-end font-mono font-bold text-[#0FA37F]">
                        {p.totalCost.toLocaleString()} ر.س
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemovePartRow(idx)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="p-3 bg-white border-t border-emerald-200 flex justify-end">
                <Button
                  type="button"
                  variant="primary"
                  loading={isSubmitting}
                  icon={<Boxes className="w-4 h-4" />}
                  onClick={handleIssuePartsMovement261}
                >
                  ترحيل صرف القطع من المخزون (Post MIGO 261)
                </Button>
              </div>
            </div>
          )}

          {/* Already Issued Parts in Order */}
          <div className="border border-[#E5EAF2] rounded-xl overflow-hidden">
            <div className="p-2.5 bg-[#F8FAFC] font-bold text-xs text-[#0F172A] flex justify-between items-center">
              <span>سجل القطع المصروفة مسبقاً لهذا الأمر:</span>
              <span className="font-mono text-[#0FA37F]">
                تكلفة القطع: {existingOrder.partsCost.toLocaleString()} ر.س
              </span>
            </div>

            {existingOrder.partsUsed.length > 0 ? (
              <table className="w-full text-xs text-start">
                <thead className="bg-[#F8FAFC] border-b border-[#E5EAF2] text-[#64748B]">
                  <tr>
                    <th className="p-2 text-start">البند</th>
                    <th className="p-2 text-start">رمز الصنف واسمه</th>
                    <th className="p-2 text-center">الكمية</th>
                    <th className="p-2 text-end">سعر الوحدة</th>
                    <th className="p-2 text-end">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EAF2] bg-white">
                  {existingOrder.partsUsed.map((p, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-mono text-[#64748B]">{p.lineItem}</td>
                      <td className="p-2">
                        <span className="font-bold text-[#0F172A] block">{p.materialName}</span>
                        <span className="font-mono text-[10px] text-[#64748B]">{p.materialCode}</span>
                      </td>
                      <td className="p-2 text-center font-bold">
                        {p.quantity} {p.unit}
                      </td>
                      <td className="p-2 text-end font-mono">{p.unitPrice} ر.س</td>
                      <td className="p-2 text-end font-mono font-bold text-[#0FA37F]">
                        {p.totalCost.toLocaleString()} ر.س
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="p-4 text-center text-xs text-[#64748B]">
                لم يتم صرف قطع غيار مسجلة حتى الآن. استخدم النموذج أعلاه للصرف بحركة 261.
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CLOSURE & LABOR */}
      {existingOrder && activeTab === 'closure' && (
        <form onSubmit={handleCompleteOrder} className="space-y-4 text-start" dir="rtl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="ساعات عمل الفنيين (Labor Hours):"
              type="number"
              min="0.5"
              step="0.5"
              value={laborHours}
              onChange={(e) => setLaborHours(parseFloat(e.target.value) || 0)}
              required
            />
            <Input
              label="أجر ساعة الفني (ر.س / ساعة):"
              type="number"
              value={laborRate}
              onChange={(e) => setLaborRate(parseFloat(e.target.value) || 0)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="زمن توقف المركبة عن الخدمة (ساعات Downtime):"
              type="number"
              min="0"
              value={downtimeHours}
              onChange={(e) => setDowntimeHours(parseFloat(e.target.value) || 0)}
              required
            />
            <Input
              label="تاريخ اكتمال الصيانة والخروج:"
              type="date"
              value={completionDate}
              onChange={(e) => setCompletionDate(e.target.value)}
              required
            />
          </div>

          {/* Cost Summary Card */}
          <div className="p-4 bg-[#F8FAFC] border border-[#E5EAF2] rounded-xl space-y-2 text-xs">
            <div className="flex justify-between text-[#64748B]">
              <span>تكلفة قطع الغيار المصروفة (261):</span>
              <span className="font-mono font-bold text-[#0F172A]">
                {existingOrder.partsCost.toLocaleString()} ر.س
              </span>
            </div>
            <div className="flex justify-between text-[#64748B]">
              <span>أجور العمالة المباشرة ({laborHours} ساعة × {laborRate} ر.س):</span>
              <span className="font-mono font-bold text-[#0F172A]">
                {(laborHours * laborRate).toLocaleString()} ر.س
              </span>
            </div>
            <div className="flex justify-between text-sm font-bold text-[#0FA37F] pt-2 border-t border-[#E5EAF2]">
              <span>إجمالي تكلفة أمر الصيانة الفعلي:</span>
              <span className="font-mono">
                {(existingOrder.partsCost + laborHours * laborRate).toLocaleString()} ر.س
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#E5EAF2]">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              اعتماد إغلاق أمر الصيانة وإعادة الشاحنة للأسطول
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
