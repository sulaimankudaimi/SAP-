import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { useToast } from '../../../components/ui/Toast';
import { db } from '../../../core/db';
import { ThreeWayMatchService, MatchResult } from '../services/ThreeWayMatchService';
import type { VendorInvoice, PurchaseOrder, GoodsReceipt } from '../../../types/models';
import { CheckCircle2, AlertTriangle, Unlock, ArrowRightLeft, FileCheck, Layers } from 'lucide-react';

interface ThreeWayMatchModalProps {
  invoice: VendorInvoice | null;
  isOpen: boolean;
  onClose: () => void;
  onReleased?: () => void;
}

export const ThreeWayMatchModal: React.FC<ThreeWayMatchModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onReleased,
}) => {
  const { showToast } = useToast();
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [grs, setGrs] = useState<GoodsReceipt[]>([]);
  const [releaseReason, setReleaseReason] = useState('');
  const [isReleasing, setIsReleasing] = useState(false);
  const [showReleaseBox, setShowReleaseBox] = useState(false);

  useEffect(() => {
    async function evaluate() {
      if (!invoice) return;
      const res = await ThreeWayMatchService.evaluateInvoice(invoice);
      setMatchResult(res);

      if (invoice.poNumber) {
        const poData = await db.purchaseOrders.where('docNumber').equals(invoice.poNumber).first();
        setPo(poData || null);

        const grData = await db.goodsReceipts
          .where('poNumber')
          .equals(invoice.poNumber)
          .filter((g) => !g.isDeleted)
          .toArray();
        setGrs(grData);
      }
    }
    if (isOpen && invoice) {
      evaluate();
    }
  }, [isOpen, invoice]);

  if (!invoice || !matchResult) return null;

  const handleRelease = async () => {
    if (!releaseReason.trim()) {
      showToast('يرجى إدخال مبرر فك الحظر والاعتماد الإداري.', 'warning');
      return;
    }

    setIsReleasing(true);
    try {
      await ThreeWayMatchService.releaseBlockedInvoice(invoice.id, releaseReason, 'usr-cfo-1');
      showToast('تم فك حظر الفاتورة بنجاح وأصبحت معتمدة للصرف في مقترحات السداد.', 'success');
      setShowReleaseBox(false);
      if (onReleased) onReleased();
      onClose();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'فشل فك حظر الفاتورة', 'error');
    } finally {
      setIsReleasing(false);
    }
  };

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'PriceVariance':
        return 'فارق في السعر يتجاوز نسبة التسامح المسموح بها (3%)';
      case 'QuantityMismatch':
        return 'الكمية المفوترة تتجاوز الكميات المستلمة فعلياً بالمخازن (5%)';
      case 'MissingGoodsReceipt':
        return 'لم يتم العثور على إذن استلام بضاعة مخزني معتمد (MIGO)';
      case 'TermsDiscrepancy':
        return 'اختلاف في شروط الدفع والتعاقد مع المورد';
      default:
        return reason;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`مطابقة الفاتورة الثلاثية (Three-Way Match - SAP MIRO) - ${invoice.docNumber}`}
      size="lg"
    >
      <div className="space-y-5 text-xs text-slate-800">
        {/* Match Evaluation Header Banner */}
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between ${
            matchResult.isBlocked
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-3">
            {matchResult.isBlocked ? (
              <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            )}
            <div>
              <h4 className="font-bold text-sm">
                {matchResult.isBlocked
                  ? 'الفاتورة محجوبة عن الصرف لوجود فروقات (Payment Blocked - MRBR)'
                  : 'المطابقة الثلاثية مكتملة ومطابقة للمواصفات وأذون الاستلام'}
              </h4>
              <p className="text-[11px] opacity-80 mt-0.5">
                مقارنة بيانات فاتورة المورد مقابل أمر الشراء (PO) وإذن استلام المواد المخزني (GR)
              </p>
            </div>
          </div>
          <Badge variant={matchResult.isBlocked ? 'rejected' : 'approved'}>
            {matchResult.isBlocked ? 'محجوبة للصرف' : 'معتمدة'}
          </Badge>
        </div>

        {/* Blocking Reasons if any */}
        {matchResult.isBlocked && (
          <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3.5 space-y-2">
            <span className="font-bold text-amber-900 block text-xs">أسباب الحظر المكتشفة:</span>
            <ul className="space-y-1.5">
              {matchResult.reasons.map((r, i) => (
                <li key={i} className="flex items-center gap-2 text-amber-800 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  <span className="font-semibold">{getReasonLabel(r)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 3-Way Triad Comparison Cards */}
        <div className="grid grid-cols-3 gap-3">
          {/* 1. PO */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="font-bold">1. أمر الشراء (PO)</span>
              <FileCheck className="w-4 h-4 text-blue-600" />
            </div>
            <p className="font-mono font-bold text-blue-900 text-sm">{invoice.poNumber || 'بدون أمر شراء'}</p>
            <div className="text-[11px] space-y-1 text-slate-600">
              <div>إجمالي الأمر: <span className="font-mono font-bold">{po ? `${po.totalAmount.toLocaleString('en-US')} ر.س` : '—'}</span></div>
              <div>شروط الدفع: <span className="font-semibold">{po?.paymentTerms || 'Net 30'}</span></div>
            </div>
          </div>

          {/* 2. GR */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="font-bold">2. إذن الاستلام (GR)</span>
              <Layers className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="font-mono font-bold text-emerald-900 text-sm">
              {grs.length > 0 ? grs.map((g) => g.docNumber).join(', ') : 'غير مستلم بالمخزن'}
            </p>
            <div className="text-[11px] space-y-1 text-slate-600">
              <div>عدد أذون الاستلام: <span className="font-mono font-bold">{grs.length}</span></div>
              <div>إجمالي الكميات المستلمة: <span className="font-mono font-bold">{matchResult.details.grQuantityTotal}</span></div>
            </div>
          </div>

          {/* 3. Invoice */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="font-bold">3. فاتورة المورد (Invoice)</span>
              <ArrowRightLeft className="w-4 h-4 text-purple-600" />
            </div>
            <p className="font-mono font-bold text-purple-900 text-sm">{invoice.vendorInvoiceNumber}</p>
            <div className="text-[11px] space-y-1 text-slate-600">
              <div>إجمالي الفاتورة: <span className="font-mono font-bold">{invoice.totalAmount.toLocaleString('en-US')} ر.س</span></div>
              <div>الكمية المفوترة: <span className="font-mono font-bold">{matchResult.details.invoiceQuantityTotal}</span></div>
            </div>
          </div>
        </div>

        {/* Release Box */}
        {showReleaseBox && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-900 font-bold">
              <Unlock className="w-5 h-5 text-emerald-600" />
              <span>اعتماد فك حظر الفاتورة للصرف (Release Blocked Invoice - MRBR)</span>
            </div>
            <p className="text-xs text-emerald-800">
              بصفتك مخولاً مالياً، سيتم فك الحظر وإتاحة الفاتورة لجدول سدادات الموردين مع تسجيل المبرر في سجل التدقيق.
            </p>
            <input
              type="text"
              value={releaseReason}
              onChange={(e) => setReleaseReason(e.target.value)}
              placeholder="اكتب مبرر الاعتماد (مثال: اعتماد فارق السعر بموجب ملحق العقد المعتمد)..."
              className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500"
              required
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button size="sm" variant="secondary" onClick={() => setShowReleaseBox(false)}>
                إلغاء
              </Button>
              <Button
                size="sm"
                onClick={handleRelease}
                disabled={isReleasing}
                className="bg-[#0FA37F] hover:bg-[#0c8a6c] gap-1.5 font-bold"
              >
                <Unlock className="w-4 h-4" />
                <span>{isReleasing ? 'جاري الفك...' : 'تأكيد فك الحظر والاعتماد'}</span>
              </Button>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>
            إغلاق
          </Button>

          {matchResult.isBlocked && !showReleaseBox && (
            <Button
              onClick={() => setShowReleaseBox(true)}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2 font-bold"
            >
              <Unlock className="w-4 h-4" />
              <span>فك حظر الفاتورة للصرف (MRBR Release)</span>
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
