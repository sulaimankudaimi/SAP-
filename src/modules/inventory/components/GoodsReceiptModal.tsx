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
  FileText,
  Boxes,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { PurchaseOrder, StorageLocation } from '../../../types/models';

interface GoodsReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (docNumber: string) => void;
  initialPoNumber?: string;
}

interface ReceiptLineState {
  lineItem: number;
  materialCode: string;
  materialName: string;
  orderedQty: number;
  previouslyReceivedQty: number;
  remainingQty: number;
  receivedQty: number;
  unit: string;
  unitPrice: number;
  storageLocation: string;
  binLocation: string;
  batchNumber: string;
  serialNumber: string;
  qualityInspection: boolean;
}

export const GoodsReceiptModal: React.FC<GoodsReceiptModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialPoNumber,
}) => {
  const { user } = useAuthStore();
  const { success, error, warning } = useToast();

  const [availablePOs, setAvailablePOs] = useState<PurchaseOrder[]>([]);
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [selectedPoNumber, setSelectedPoNumber] = useState<string>(initialPoNumber || '');
  const [currentPO, setCurrentPO] = useState<PurchaseOrder | null>(null);

  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');
  const [postingDate, setPostingDate] = useState(new Date().toISOString().split('T')[0]);
  const [headerText, setHeaderText] = useState('');
  const [lines, setLines] = useState<ReceiptLineState[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);

  // Load POs and locations
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      const pos = await db.purchaseOrders
        .filter((po) => po.status === 'approved' || po.status === 'in_progress')
        .toArray();
      setAvailablePOs(pos);

      const locs = await db.storageLocations.toArray();
      setStorageLocations(locs);

      if (initialPoNumber) {
        setSelectedPoNumber(initialPoNumber);
      } else if (pos.length > 0 && !selectedPoNumber) {
        setSelectedPoNumber(pos[0].docNumber);
      }
    };

    loadData();
  }, [isOpen, initialPoNumber]);

  // When PO changes, load items
  useEffect(() => {
    if (!selectedPoNumber) {
      setCurrentPO(null);
      setLines([]);
      return;
    }

    const po = availablePOs.find((p) => p.docNumber === selectedPoNumber);
    if (po) {
      setCurrentPO(po);
      const parsedLines: ReceiptLineState[] = po.items.map((item) => {
        const prev = item.receivedQuantity || 0;
        const rem = Math.max(0, item.quantity - prev);
        return {
          lineItem: item.lineItem,
          materialCode: item.materialCode,
          materialName: item.materialName,
          orderedQty: item.quantity,
          previouslyReceivedQty: prev,
          remainingQty: rem,
          receivedQty: rem, // default to remaining
          unit: item.unit,
          unitPrice: item.unitPrice,
          storageLocation: item.storageLocation || 'SL01',
          binLocation: 'A-01',
          batchNumber: `BATCH-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
          serialNumber: '',
          qualityInspection: false,
        };
      });
      setLines(parsedLines);
      setDeliveryNoteNumber(`DN-${po.vendorCode}-${Date.now().toString().slice(-4)}`);
    }
  }, [selectedPoNumber, availablePOs]);

  const updateLine = (lineItem: number, updates: Partial<ReceiptLineState>) => {
    setLines((prev) =>
      prev.map((l) => (l.lineItem === lineItem ? { ...l, ...updates } : l))
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachedFileName(e.target.files[0].name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPO) {
      error('خطأ', 'يرجى اختيار أمر الشراء المراد استلامه');
      return;
    }

    if (!deliveryNoteNumber.trim()) {
      error('حقل مطلوب', 'يرجى إدخال رقم إشعار التسليم / البوليصة');
      return;
    }

    const itemsToPost = lines.filter((l) => l.receivedQty > 0);
    if (itemsToPost.length === 0) {
      error('تنبيه', 'يجب إدخال كمية استلام لأصناف الشحنة (أكبر من صفر)');
      return;
    }

    // Over-delivery tolerance check (10%)
    for (const item of itemsToPost) {
      const maxAllowed = item.remainingQty * 1.1;
      if (item.receivedQty > maxAllowed) {
        warning(
          'تجاوز نسبة التسامح في التوريد',
          `الكمية المستلمة للصنف [${item.materialCode}] تتجاوز الحد الأقصى المسموح (10% فوق المتبقي).`
        );
      }
    }

    setIsSubmitting(true);
    try {
      const matDoc = await InventoryService.postMaterialDocument({
        movementType: '101',
        plantCode: currentPO.plantCode,
        storageLocation: itemsToPost[0].storageLocation,
        poNumber: currentPO.docNumber,
        deliveryNoteNumber,
        postingDate,
        headerText: headerText || `استلام مواد مقابل أمر الشراء ${currentPO.docNumber}`,
        items: itemsToPost.map((it) => ({
          materialCode: it.materialCode,
          quantity: it.receivedQty,
          unitPrice: it.unitPrice,
          unit: it.unit,
          storageLocation: it.storageLocation,
          batchNumber: it.batchNumber,
          serialNumber: it.serialNumber,
          qualityInspection: it.qualityInspection,
        })),
        userId: user?.id || 'u-wh-clerk',
        userName: user?.fullName || 'أمين المستودع',
      });

      success(
        'تم تسجيل استلام المواد بنجاح (MIGO 101)',
        `رقم مستند المواد: ${matDoc.docNumber} | القيد المالي: ${matDoc.accountingDocNumber}`
      );

      onSuccess(matDoc.docNumber);
      onClose();
    } catch (err) {
      error('فشل الاستلام', err instanceof Error ? err.message : 'حدث خطأ أثناء ترحيل الاستلام');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="استلام بضائع مقابل أمر شراء (MIGO - Goods Receipt 101)"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6 text-start" dir="rtl">
        {/* Header Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#F8FAFC] rounded-2xl border border-[#E5EAF2]">
          <Select
            label="اختر أمر الشراء (Purchase Order):"
            value={selectedPoNumber}
            onChange={(e) => setSelectedPoNumber(e.target.value)}
            options={availablePOs.map((p) => ({
              label: `${p.docNumber} - ${p.vendorName} (${p.status === 'completed' ? 'مكتمل' : 'متاح للاستلام'})`,
              value: p.docNumber,
            }))}
          />

          <Input
            label="رقم إشعار التسليم / البوليصة (Delivery Note):"
            value={deliveryNoteNumber}
            onChange={(e) => setDeliveryNoteNumber(e.target.value)}
            placeholder="مثال: DN-Aramco-8890"
            required
          />

          <Input
            label="تاريخ الترحيل (Posting Date):"
            type="date"
            value={postingDate}
            onChange={(e) => setPostingDate(e.target.value)}
            required
          />
        </div>

        {/* PO Summary Card */}
        {currentPO && (
          <div className="p-3 bg-white border border-[#E5EAF2] rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="font-bold text-[#0F172A]">المورد: {currentPO.vendorName}</span>
              <span className="text-[#64748B]">|</span>
              <span className="text-[#64748B]">المحطة: {currentPO.plantCode}</span>
              <span className="text-[#64748B]">|</span>
              <span className="text-[#64748B]">تاريخ الأمر: {currentPO.orderDate}</span>
            </div>
            <Badge variant={currentPO.status === 'completed' ? 'completed' : 'in_progress'}>
              الحالة الحالية: {currentPO.status}
            </Badge>
          </div>
        )}

        {/* Line Items Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
              <Boxes className="w-4 h-4 text-[#0FA37F]" />
              بنود أمر الشراء والكميات المستلمة (Partial Receipts & Bins):
            </h4>
            <span className="text-[11px] text-[#64748B]">
              يمكن إدخال استلام جزئي أو تحديد المستودع والدفعة لكل بند
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#E5EAF2]">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E5EAF2]">
                <tr>
                  <th className="p-2.5 text-start">البند</th>
                  <th className="p-2.5 text-start">الصنف</th>
                  <th className="p-2.5 text-center">الكمية المطلوبة</th>
                  <th className="p-2.5 text-center">المستلم سابقاً</th>
                  <th className="p-2.5 text-center w-28">الكمية المستلمة الآن</th>
                  <th className="p-2.5 text-start">المستودع والموقع</th>
                  <th className="p-2.5 text-start">رقم التشغيلة / الدفعة</th>
                  <th className="p-2.5 text-center">فحص جودة (QI)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF2] bg-white">
                {lines.map((l) => (
                  <tr key={l.lineItem} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono text-center font-bold text-[#64748B]">{l.lineItem}</td>
                    <td className="p-2.5">
                      <div className="font-bold text-[#0F172A]">{l.materialName}</div>
                      <div className="font-mono text-[10px] text-[#64748B]">{l.materialCode}</div>
                    </td>
                    <td className="p-2.5 text-center font-mono font-semibold">
                      {l.orderedQty} {l.unit}
                    </td>
                    <td className="p-2.5 text-center font-mono text-[#64748B]">
                      {l.previouslyReceivedQty} {l.unit}
                    </td>
                    <td className="p-2.5 text-center">
                      <input
                        type="number"
                        min="0"
                        max={l.remainingQty * 1.5}
                        step="any"
                        value={l.receivedQty}
                        onChange={(e) => updateLine(l.lineItem, { receivedQty: parseFloat(e.target.value) || 0 })}
                        className="w-24 px-2 py-1 border border-[#E5EAF2] rounded-lg text-center font-mono font-bold text-[#0FA37F] focus:border-[#0FA37F] focus:outline-none"
                      />
                    </td>
                    <td className="p-2.5">
                      <select
                        value={l.storageLocation}
                        onChange={(e) => updateLine(l.lineItem, { storageLocation: e.target.value })}
                        className="px-2 py-1 border border-[#E5EAF2] rounded-lg text-xs bg-white focus:outline-none"
                      >
                        {storageLocations.map((loc) => (
                          <option key={loc.code} value={loc.code}>
                            {loc.code} - {loc.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2.5">
                      <input
                        type="text"
                        value={l.batchNumber}
                        onChange={(e) => updateLine(l.lineItem, { batchNumber: e.target.value })}
                        placeholder="رقم الدفعة"
                        className="w-28 px-2 py-1 border border-[#E5EAF2] rounded-lg font-mono text-xs focus:outline-none"
                      />
                    </td>
                    <td className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={l.qualityInspection}
                        onChange={(e) => updateLine(l.lineItem, { qualityInspection: e.target.checked })}
                        className="w-4 h-4 text-[#0FA37F] rounded focus:ring-0 cursor-pointer"
                        title="حجز تحت فحص الجودة"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Attachments & Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="ملاحظات رأس المستند (Header Text):"
            value={headerText}
            onChange={(e) => setHeaderText(e.target.value)}
            placeholder="ملاحظات فحص الشحنة أو رقم لوحة الشاحنة..."
          />

          <div className="space-y-1">
            <label className="text-xs font-bold text-[#0F172A] block">
              مرفقات الاستلام (بوليصة الشحن / الفاتورة):
            </label>
            <div className="flex items-center gap-2">
              <label className="px-3 py-2 border border-dashed border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#0B2545] bg-[#F8FAFC] hover:bg-slate-100 cursor-pointer flex items-center gap-2 transition-colors">
                <Upload className="w-3.5 h-3.5 text-[#0FA37F]" />
                <span>{attachedFileName ? `تم إرفاق: ${attachedFileName}` : 'رفع ملف البوليصة (PDF/JPG)'}</span>
                <input type="file" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5EAF2]">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            icon={<CheckCircle2 className="w-4 h-4" />}
          >
            ترحيل استلام المواد (Post MIGO 101)
          </Button>
        </div>
      </form>
    </Modal>
  );
};
