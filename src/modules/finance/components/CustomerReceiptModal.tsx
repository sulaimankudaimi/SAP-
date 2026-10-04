import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../components/ui/Toast';
import { db } from '../../../core/db';
import { NumberRangeService } from '../../../core/services/NumberRangeService';
import { AutomaticPostingEngine } from '../services/AutomaticPostingEngine';
import type { Customer, CustomerInvoice, CustomerReceipt } from '../../../types/models';
import { CheckCircle2, DollarSign } from 'lucide-react';

interface CustomerReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CustomerReceiptModal: React.FC<CustomerReceiptModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [bankAccount, setBankAccount] = useState('101010 - مصرف الراجحي (حساب التحصيلات الرئيسي)');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      const custs = await db.customers.filter((c) => !c.isDeleted).toArray();
      setCustomers(custs);
      if (custs.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(custs[0].customerCode);
      }
    }
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    async function loadCustInvoices() {
      if (!selectedCustomerId) return;
      const invs = await db.customerInvoices
        .where('customerCode')
        .equals(selectedCustomerId)
        .filter((inv) => !inv.isDeleted && inv.paymentStatus !== 'Paid')
        .toArray();
      setInvoices(invs);
      if (invs.length > 0) {
        setSelectedInvoiceId(invs[0].id);
        setAmount(invs[0].totalAmount.toString());
      } else {
        setSelectedInvoiceId('');
        setAmount('0');
      }
    }
    if (selectedCustomerId) {
      loadCustInvoices();
    }
  }, [selectedCustomerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      showToast('يرجى إدخال مبلغ تحصيل صحيح.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const cust = customers.find((c) => c.customerCode === selectedCustomerId);
      const customerName = cust ? cust.name : selectedCustomerId;
      const fiscalYear = new Date(receiptDate).getFullYear().toString();
      const docNumber = await NumberRangeService.getNextNumber('ARPAY', fiscalYear);
      const now = new Date().toISOString();

      const receipt: CustomerReceipt = {
        id: `crec-${docNumber}`,
        docNumber,
        status: 'approved',
        invoiceId: selectedInvoiceId,
        invoiceDocNumber: invoices.find((i) => i.id === selectedInvoiceId)?.docNumber,
        customerCode: selectedCustomerId,
        customerName,
        amount: numAmount,
        receiptDate,
        bankAccount,
        referenceNumber: referenceNumber || `REC-TRX-${Date.now().toString().slice(-6)}`,
        paymentMethod: 'BankTransfer',
        createdBy: 'usr-admin-1',
        createdAt: now,
        updatedBy: 'usr-admin-1',
        updatedAt: now,
        version: 1,
        isDeleted: false,
      };

      await db.customerReceipts.add(receipt);

      // Update invoice payment status
      if (selectedInvoiceId) {
        await db.customerInvoices.update(selectedInvoiceId, {
          paymentStatus: 'Paid',
          updatedAt: now,
        });
      }

      // Post to GL: Dr. Bank / Cr. Customer Receivable
      await AutomaticPostingEngine.postCustomerReceipt({
        receipt,
        createdBy: 'usr-admin-1',
      });

      showToast(`تم تسجيل سند القبض وترحيل القيد للأستاذ العام برقم ${docNumber}`, 'success');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'فشل تسجيل سند القبض', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="سند قبض وتحصيل من عميل (SAP F-28 - Customer Receipt)"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-800">
        <div className="space-y-3">
          <div>
            <label className="text-slate-600 font-bold block mb-1">العميل *</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
              required
            >
              {customers.map((c) => (
                <option key={c.id} value={c.customerCode}>
                  {c.customerCode} - {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-600 font-bold block mb-1">الفاتورة المستهدفة للتحصيل</label>
            <select
              value={selectedInvoiceId}
              onChange={(e) => {
                setSelectedInvoiceId(e.target.value);
                const inv = invoices.find((i) => i.id === e.target.value);
                if (inv) setAmount(inv.totalAmount.toString());
              }}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500"
            >
              {invoices.length === 0 ? (
                <option value="">لا توجد فواتير مفتوحة (سداد دفعة مقدمة)</option>
              ) : (
                invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.docNumber} - مبلغ {inv.totalAmount.toLocaleString('en-US')} ر.س (استحقاق: {inv.dueDate})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-600 font-bold block mb-1">مبلغ التحصيل (ر.س) *</label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-mono text-end font-bold text-emerald-700"
                required
              />
            </div>
            <div>
              <label className="text-slate-600 font-bold block mb-1">تاريخ التحصيل *</label>
              <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="text-slate-600 font-bold block mb-1">الحساب البنكي المودع به *</label>
            <select
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
            >
              <option value="101010 - مصرف الراجحي (حساب التحصيلات الرئيسي)">
                101010 - مصرف الراجحي (حساب التحصيلات الرئيسي - SAR)
              </option>
              <option value="101020 - البنك الأهلي السعودي (حساب العمليات)">
                101020 - البنك الأهلي السعودي (حساب العمليات - SAR)
              </option>
            </select>
          </div>

          <div>
            <label className="text-slate-600 font-bold block mb-1">رقم الحوالة البنكية / إشعار الإيداع</label>
            <Input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="مثال: REF-PAY-884920..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </Button>
          <Button type="submit" disabled={isSubmitting} className="bg-[#0FA37F] hover:bg-[#0c8a6c] gap-2 font-bold">
            <DollarSign className="w-4 h-4" />
            <span>{isSubmitting ? 'جاري التحصيل...' : 'تأكيد التحصيل وترحيل القيد'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
