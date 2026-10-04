import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../components/ui/Toast';
import { db } from '../../../core/db';
import { NumberRangeService } from '../../../core/services/NumberRangeService';
import { AutomaticPostingEngine } from '../services/AutomaticPostingEngine';
import type { Customer, CustomerInvoice } from '../../../types/models';
import { FilePlus, Plus, Trash2 } from 'lucide-react';

interface CustomerInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CustomerInvoiceModal: React.FC<CustomerInvoiceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerCode, setCustomerCode] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [items, setItems] = useState([
    { lineItem: 1, description: 'توريد وقود ديزل صناعي لمحطة توزيع', amount: 50000, vatRate: 0.15 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadCustomers() {
      const data = await db.customers.filter((c) => !c.isDeleted).toArray();
      setCustomers(data);
      if (data.length > 0 && !customerCode) {
        setCustomerCode(data[0].customerCode);
      }
    }
    if (isOpen) {
      loadCustomers();
    }
  }, [isOpen]);

  const updateItem = (index: number, field: string, val: string | number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: val };
    setItems(updated);
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        lineItem: items.length + 1,
        description: 'بند مبيعات طاقة وخدمات لوجستية',
        amount: 25000,
        vatRate: 0.15,
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const netAmount = items.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
  const vatAmount = Math.round(netAmount * 0.15 * 100) / 100;
  const totalAmount = netAmount + vatAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerCode) {
      showToast('يرجى تحديد العميل.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const customer = customers.find((c) => c.customerCode === customerCode);
      const customerName = customer ? customer.name : customerCode;
      const fiscalYear = new Date(invoiceDate).getFullYear().toString();
      const docNumber = await NumberRangeService.getNextNumber('ARINV', fiscalYear);
      const now = new Date().toISOString();

      const formattedItems = items.map((it, idx) => ({
        lineItem: idx + 1,
        description: it.description,
        amount: Number(it.amount) || 0,
        vatRate: it.vatRate,
        vatAmount: Math.round((Number(it.amount) || 0) * it.vatRate * 100) / 100,
        totalWithVat: Math.round((Number(it.amount) || 0) * (1 + it.vatRate) * 100) / 100,
      }));

      const invoice: CustomerInvoice = {
        id: `cinv-${docNumber}`,
        docNumber,
        status: 'approved',
        customerCode,
        customerName,
        invoiceDate,
        postingDate: invoiceDate,
        dueDate,
        totalAmount,
        vatAmount,
        netAmount,
        paymentStatus: 'Unpaid',
        items: formattedItems,
        createdBy: 'usr-admin-1',
        createdAt: now,
        updatedBy: 'usr-admin-1',
        updatedAt: now,
        version: 1,
        isDeleted: false,
      };

      await db.customerInvoices.add(invoice);

      // Post to GL
      await AutomaticPostingEngine.postCustomerInvoice({
        invoice,
        createdBy: 'usr-admin-1',
      });

      showToast(`تم إصدار فاتورة المبيعات وترحيلها للأستاذ العام برقم ${docNumber}`, 'success');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'فشل إصدار الفاتورة', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="إصدار فاتورة مبيعات عميل (SAP FB70 - Customer Invoice)"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-800">
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-3 gap-3">
          <div className="col-span-3">
            <label className="text-slate-600 font-bold block mb-1">العميل المستفيد *</label>
            <select
              value={customerCode}
              onChange={(e) => setCustomerCode(e.target.value)}
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
            <label className="text-slate-600 font-bold block mb-1">تاريخ الفاتورة</label>
            <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required />
          </div>
          <div>
            <label className="text-slate-600 font-bold block mb-1">تاريخ الاستحقاق</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </div>
          <div>
            <label className="text-slate-600 font-bold block mb-1">شروط الدفع</label>
            <Input value="آجل 30 يوماً (Net 30)" readOnly className="bg-slate-100" />
          </div>
        </div>

        {/* Invoice Items */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
          <div className="p-3 bg-slate-100 flex items-center justify-between border-b border-slate-200">
            <h4 className="font-bold text-slate-800">بنود الفاتورة والخدمات</h4>
            <Button size="sm" type="button" onClick={addItem} variant="secondary" className="gap-1 border-slate-300 h-7 text-xs">
              <Plus className="w-3.5 h-3.5" />
              إضافة بند
            </Button>
          </div>

          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2 px-3">الوصف</th>
                <th className="py-2 px-3 w-36 text-end">المبلغ قبل الضريبة</th>
                <th className="py-2 px-3 w-28 text-center">الضريبة (15%)</th>
                <th className="py-2 px-2 text-center w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it, idx) => (
                <tr key={idx}>
                  <td className="py-2 px-3">
                    <Input
                      value={it.description}
                      onChange={(e) => updateItem(idx, 'description', e.target.value)}
                      className="h-8 text-xs"
                      required
                    />
                  </td>
                  <td className="py-2 px-3">
                    <Input
                      type="number"
                      value={it.amount}
                      onChange={(e) => updateItem(idx, 'amount', e.target.value)}
                      className="h-8 text-xs font-mono text-end font-bold"
                      required
                    />
                  </td>
                  <td className="py-2 px-3 text-center font-mono text-slate-600">
                    {((it.amount || 0) * 0.15).toLocaleString('en-US')} ر.س
                  </td>
                  <td className="py-2 px-2 text-center">
                    <button type="button" onClick={() => removeItem(idx)} className="text-slate-400 hover:text-rose-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Box */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between font-mono text-xs">
          <span>المبلغ قبل الضريبة: <strong className="font-bold">{netAmount.toLocaleString('en-US')} ر.س</strong></span>
          <span>ضريبة القيمة المضافة: <strong className="font-bold text-amber-700">{vatAmount.toLocaleString('en-US')} ر.س</strong></span>
          <span>إجمالي الفاتورة: <strong className="font-black text-sm text-emerald-700">{totalAmount.toLocaleString('en-US')} ر.س</strong></span>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </Button>
          <Button type="submit" disabled={isSubmitting} className="bg-[#0FA37F] hover:bg-[#0c8a6c] gap-2 font-bold">
            <FilePlus className="w-4 h-4" />
            <span>{isSubmitting ? 'جاري الإصدار والترحيل...' : 'إصدار الفاتورة وترحيل القيد'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
