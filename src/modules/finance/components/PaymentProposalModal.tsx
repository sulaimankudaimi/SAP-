import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { useToast } from '../../../components/ui/Toast';
import { AccountsPayableService, PaymentProposalItem } from '../services/AccountsPayableService';
import { Send, DollarSign, Calendar, CheckSquare, Square, Building } from 'lucide-react';

interface PaymentProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PaymentProposalModal: React.FC<PaymentProposalModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [cutoffDate, setCutoffDate] = useState(
    new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [bankAccount, setBankAccount] = useState('101010 - البنك الأهلي السعودي (حساب المدفوعات الرئيسي)');
  const [items, setItems] = useState<PaymentProposalItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const loadProposal = async () => {
    setIsLoading(true);
    try {
      const data = await AccountsPayableService.generatePaymentProposal({ cutoffDate });
      setItems(data);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'فشل تحميل مقترح السداد', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadProposal();
    }
  }, [isOpen, cutoffDate]);

  const toggleSelect = (invoiceId: string) => {
    setItems((prev) =>
      prev.map((it) => (it.invoiceId === invoiceId ? { ...it, selected: !it.selected } : it))
    );
  };

  const toggleSelectAll = () => {
    const unblocked = items.filter((it) => !it.isBlocked);
    const allSelected = unblocked.every((it) => it.selected);
    setItems((prev) =>
      prev.map((it) => (it.isBlocked ? it : { ...it, selected: !allSelected }))
    );
  };

  const selectedItems = items.filter((it) => it.selected && !it.isBlocked);
  const totalNetPayment = selectedItems.reduce((acc, it) => acc + it.netPaymentAmount, 0);
  const totalDiscounts = selectedItems.reduce((acc, it) => acc + it.cashDiscountAmount, 0);

  const handleExecute = async () => {
    if (selectedItems.length === 0) {
      showToast('يرجى تحديد فاتورة واحدة على الأقل لصرف الدفعة.', 'warning');
      return;
    }

    setIsExecuting(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await AccountsPayableService.executePaymentProposal({
        items,
        bankAccount,
        paymentDate: todayStr,
        createdBy: 'usr-admin-1',
      });

      showToast(
        `تم بنجاح إصدار ${res.successfulPayments.length} سند صرف وترحيلها للأستاذ العام بإجمالي ${res.totalPaid.toLocaleString('en-US')} ر.س`,
        'success'
      );
      onSuccess();
      onClose();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'فشل تنفيذ أوامر السداد', 'error');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تشغيل مقترح سداد مستحقات الموردين الآلي (SAP F110 - Payment Proposal Run)"
      size="xl"
    >
      <div className="space-y-4 text-xs text-slate-800">
        {/* Run Criteria Controls */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-3 gap-3">
          <div>
            <label className="text-slate-500 font-bold block mb-1">تاريخ استحقاق حتى (Cut-off Date)</label>
            <Input
              type="date"
              value={cutoffDate}
              onChange={(e) => setCutoffDate(e.target.value)}
              className="text-xs"
            />
          </div>
          <div className="col-span-2">
            <label className="text-slate-500 font-bold block mb-1">حساب السداد البنكي المنفذ (House Bank)</label>
            <select
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
            >
              <option value="101010 - البنك الأهلي السعودي (حساب المدفوعات الرئيسي)">
                101010 - البنك الأهلي السعودي (حساب المدفوعات الرئيسي - SAR)
              </option>
              <option value="101020 - مصرف الراجحي (حساب العمليات التجارية)">
                101020 - مصرف الراجحي (حساب العمليات التجارية - SAR)
              </option>
              <option value="101030 - بنك الرياض (حساب المشروعات والطاقة)">
                101030 - بنك الرياض (حساب المشروعات والطاقة - SAR)
              </option>
            </select>
          </div>
        </div>

        {/* Selected Summary Bar */}
        <div className="flex items-center justify-between p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-900 font-mono">
          <div className="flex items-center gap-2 font-sans font-bold text-xs">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <span>ملخص الدفعة المقترحة:</span>
            <span className="bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full text-[11px]">
              {selectedItems.length} فاتورة محددة
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs">
            <div>
              <span className="text-slate-500 font-sans text-[11px] block">خصم تعجيل الدفع المكتسب:</span>
              <span className="font-bold text-emerald-700">{totalDiscounts.toLocaleString('en-US')} ر.س</span>
            </div>
            <div>
              <span className="text-slate-500 font-sans text-[11px] block">صافي المبلغ المسدد للبنك:</span>
              <span className="font-black text-sm text-slate-900">{totalNetPayment.toLocaleString('en-US')} ر.س</span>
            </div>
          </div>
        </div>

        {/* Invoices List Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
          <div className="p-3 bg-slate-100 flex items-center justify-between border-b border-slate-200">
            <h4 className="font-bold text-slate-800">قائمة الفواتير المستحقة للسداد</h4>
            <Button size="sm" variant="secondary" onClick={toggleSelectAll} className="h-7 text-xs gap-1 border-slate-300">
              تحديد / إلغاء تحديد الكل
            </Button>
          </div>

          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3 text-center w-10">تحديد</th>
                  <th className="py-2.5 px-3">رقم الفاتورة</th>
                  <th className="py-2.5 px-3">المورد</th>
                  <th className="py-2.5 px-3">تاريخ الاستحقاق</th>
                  <th className="py-2.5 px-3 text-end">إجمالي الفاتورة</th>
                  <th className="py-2.5 px-3 text-end">الخصم المتاح</th>
                  <th className="py-2.5 px-3 text-end">صافي السداد</th>
                  <th className="py-2.5 px-3 text-center">حالة الصرف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-400">
                      لا توجد فواتير مستحقة للسداد حتى التاريخ المحدد.
                    </td>
                  </tr>
                ) : (
                  items.map((it) => (
                    <tr
                      key={it.invoiceId}
                      className={`hover:bg-slate-50 transition-colors ${
                        it.isBlocked ? 'bg-rose-50/30 opacity-70' : ''
                      }`}
                    >
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          disabled={it.isBlocked}
                          onClick={() => toggleSelect(it.invoiceId)}
                          className="disabled:opacity-30"
                        >
                          {it.selected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-blue-900">{it.vendorInvoiceNumber}</td>
                      <td className="py-2 px-3 font-semibold text-slate-800">{it.vendorName}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{it.dueDate}</td>
                      <td className="py-2 px-3 font-mono text-end font-semibold">
                        {it.totalAmount.toLocaleString('en-US')} ر.س
                      </td>
                      <td className="py-2 px-3 font-mono text-end text-emerald-700">
                        {it.cashDiscountAmount > 0 ? `${it.cashDiscountAmount.toLocaleString('en-US')} ر.س` : '—'}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-end text-slate-900">
                        {it.netPaymentAmount.toLocaleString('en-US')} ر.س
                      </td>
                      <td className="py-2 px-3 text-center">
                        {it.isBlocked ? (
                          <Badge variant="rejected">محجوبة (MRBR)</Badge>
                        ) : (
                          <Badge variant="approved">جاهزة للصرف</Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={isExecuting}>
            إلغاء
          </Button>

          <Button
            onClick={handleExecute}
            disabled={isExecuting || selectedItems.length === 0}
            className="bg-[#0FA37F] hover:bg-[#0c8a6c] gap-2 font-bold shadow-sm"
          >
            <Send className="w-4 h-4" />
            <span>{isExecuting ? 'جاري ترحيل المدفوعات...' : `تنفيذ أوامر الصرف (${selectedItems.length})`}</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};
