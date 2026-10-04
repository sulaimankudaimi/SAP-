import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { StatCard } from '../../../components/ui/StatCard';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Tabs } from '../../../components/ui/Tabs';
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs';
import { useToast } from '../../../components/ui/Toast';
import { t } from '../../../i18n/ar';
import { db } from '../../../core/db';
import { CustomerInvoiceModal } from '../components/CustomerInvoiceModal';
import { CustomerReceiptModal } from '../components/CustomerReceiptModal';
import type { CustomerInvoice, CustomerReceipt, Customer } from '../../../types/models';
import {
  TrendingUp,
  FilePlus,
  DollarSign,
  Users,
  CheckCircle2,
  Clock,
  ArrowUpRight,
} from 'lucide-react';

export const AccountsReceivablePage: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('invoices');
  const [isLoading, setIsLoading] = useState(true);

  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [receipts, setReceipts] = useState<CustomerReceipt[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Modals
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const invs = await db.customerInvoices.filter((i) => !i.isDeleted).toArray();
      const recs = await db.customerReceipts.filter((r) => !r.isDeleted).toArray();
      const custs = await db.customers.filter((c) => !c.isDeleted).toArray();

      setInvoices(invs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setReceipts(recs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setCustomers(custs);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'فشل تحميل بيانات العملاء', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalInvoiced = invoices.reduce((acc, i) => acc + i.totalAmount, 0);
  const totalCollected = receipts.reduce((acc, r) => acc + r.amount, 0);
  const openReceivables = invoices
    .filter((i) => i.paymentStatus !== 'Paid')
    .reduce((acc, i) => acc + i.totalAmount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumbs
            items={[
              { label: t('nav_home'), path: '/' },
              { label: t('nav_finance'), path: '/finance' },
              { label: 'حسابات العملاء والمقبوضات (FI-AR)' },
            ]}
          />
          <h1 className="text-2xl font-black text-[#0B2545] tracking-tight mt-1">
            {t('fi_ar_title')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            إصدار فواتير مبيعات الطاقة (FB70)، تسجيل سندات القبض والتحصيل (F-28)، ومتابعة الذمم المدينة
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => setIsReceiptModalOpen(true)}
            className="gap-2 border-slate-300 font-bold"
          >
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span>سند قبض وتحصيل (F-28)</span>
          </Button>

          <Button
            onClick={() => setIsInvoiceModalOpen(true)}
            className="bg-[#0FA37F] hover:bg-[#0c8a6c] gap-2 font-bold shadow-sm"
          >
            <FilePlus className="w-4 h-4" />
            <span>فاتورة مبيعات جديدة (FB70)</span>
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="إجمالي الذمم المدينة القائمة (AR)"
          value={`${openReceivables.toLocaleString('en-US')} ر.س`}
          subtitle="مبيعات بانتظار التحصيل"
          icon={<TrendingUp className="w-5 h-5 text-amber-600" />}
        />
        <StatCard
          label="إجمالي مبيعات الطاقة المفوترة"
          value={`${totalInvoiced.toLocaleString('en-US')} ر.س`}
          subtitle={`${invoices.length} فاتورة مبيعات`}
          icon={<FilePlus className="w-5 h-5 text-blue-600" />}
        />
        <StatCard
          label="إجمالي المقبوضات البنكية المحصلة"
          value={`${totalCollected.toLocaleString('en-US')} ر.س`}
          subtitle={`${receipts.length} سند قبض بنكي`}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
        />
        <StatCard
          label="عدد العملاء النشطين"
          value={customers.length.toString()}
          subtitle="محطات وشركات طاقة محلية"
          icon={<Users className="w-5 h-5 text-[#0B2545]" />}
        />
      </div>

      {/* Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'invoices', label: `فواتير مبيعات العملاء (${invoices.length})` },
          { id: 'receipts', label: `سندات القبض والتحصيل (${receipts.length})` },
          { id: 'customer-summary', label: 'كشف مديونيات العملاء' },
        ]}
      />

      {/* Tab 1: Invoices */}
      {activeTab === 'invoices' && (
        <Card className="overflow-hidden border border-slate-200">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 text-start">رقم الفاتورة</th>
                <th className="py-2.5 px-3 text-start">العميل</th>
                <th className="py-2.5 px-3 text-start">تاريخ الإصدار</th>
                <th className="py-2.5 px-3 text-start">تاريخ الاستحقاق</th>
                <th className="py-2.5 px-3 text-end">المبلغ قبل الضريبة</th>
                <th className="py-2.5 px-3 text-end">ضريبة القيمة المضافة</th>
                <th className="py-2.5 px-3 text-end">إجمالي الفاتورة</th>
                <th className="py-2.5 px-3 text-center">حالة السداد</th>
                <th className="py-2.5 px-3 text-start">قيد الأستاذ العام</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    لا توجد فواتير مبيعات عملاء مسجلة حالياً.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{inv.docNumber}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">{inv.customerName}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{inv.invoiceDate}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{inv.dueDate}</td>
                    <td className="py-2.5 px-3 font-mono text-end font-semibold text-slate-700">
                      {inv.netAmount.toLocaleString('en-US')} ر.س
                    </td>
                    <td className="py-2.5 px-3 font-mono text-end text-amber-700">
                      {inv.vatAmount.toLocaleString('en-US')} ر.س
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-end text-emerald-800 text-sm">
                      {inv.totalAmount.toLocaleString('en-US')} ر.س
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant={inv.paymentStatus === 'Paid' ? 'approved' : 'pending'}>
                        {inv.paymentStatus === 'Paid' ? 'مسددة بالكامل' : 'مستحقة'}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-blue-900 font-bold">{inv.jeDocNumber || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}

      {/* Tab 2: Receipts */}
      {activeTab === 'receipts' && (
        <Card className="overflow-hidden border border-slate-200">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 text-start">رقم سند القبض</th>
                <th className="py-2.5 px-3 text-start">العميل</th>
                <th className="py-2.5 px-3 text-start">تاريخ التحصيل</th>
                <th className="py-2.5 px-3 text-start">الحساب البنكي المودع به</th>
                <th className="py-2.5 px-3 text-start">رقم الحوالة / المرجع</th>
                <th className="py-2.5 px-3 text-end">مبلغ التحصيل</th>
                <th className="py-2.5 px-3 text-start">قيد الأستاذ العام</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {receipts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    لا توجد سندات قبض مسجلة حالياً.
                  </td>
                </tr>
              ) : (
                receipts.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{rec.docNumber}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">{rec.customerName}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{rec.receiptDate}</td>
                    <td className="py-2.5 px-3 text-slate-700">{rec.bankAccount}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{rec.referenceNumber}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-end text-emerald-800 text-sm">
                      {rec.amount.toLocaleString('en-US')} ر.س
                    </td>
                    <td className="py-2.5 px-3 font-mono text-blue-900 font-bold">{rec.jeDocNumber || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}

      {/* Tab 3: Customer Balances Summary */}
      {activeTab === 'customer-summary' && (
        <Card className="overflow-hidden border border-slate-200">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 text-start">كود العميل</th>
                <th className="py-2.5 px-3 text-start">اسم العميل</th>
                <th className="py-2.5 px-3 text-end">إجمالي الفواتير الصادرة</th>
                <th className="py-2.5 px-3 text-end">إجمالي التحصيلات المسددة</th>
                <th className="py-2.5 px-3 text-end">الرصيد المدين المتبقي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {customers.map((c) => {
                const cInvs = invoices.filter((i) => i.customerCode === c.customerCode);
                const cRecs = receipts.filter((r) => r.customerCode === c.customerCode);
                const invSum = cInvs.reduce((acc, i) => acc + i.totalAmount, 0);
                const recSum = cRecs.reduce((acc, r) => acc + r.amount, 0);
                const balance = invSum - recSum;

                return (
                  <tr key={c.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{c.customerCode}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">{c.name}</td>
                    <td className="py-2.5 px-3 font-mono text-end font-semibold text-slate-700">
                      {invSum.toLocaleString('en-US')} ر.س
                    </td>
                    <td className="py-2.5 px-3 font-mono text-end text-emerald-700">
                      {recSum.toLocaleString('en-US')} ر.س
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-end text-blue-900 text-sm">
                      {balance.toLocaleString('en-US')} ر.س
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Modals */}
      <CustomerInvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        onSuccess={loadData}
      />

      <CustomerReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
};
