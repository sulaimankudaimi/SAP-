import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { StatCard } from '../../../components/ui/StatCard';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { Tabs } from '../../../components/ui/Tabs';
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs';
import { useToast } from '../../../components/ui/Toast';
import { t } from '../../../i18n/ar';
import { db } from '../../../core/db';
import { AccountsPayableService, VendorAgingItem, AgingBucket } from '../services/AccountsPayableService';
import { ThreeWayMatchService } from '../services/ThreeWayMatchService';
import { ThreeWayMatchModal } from '../components/ThreeWayMatchModal';
import { PaymentProposalModal } from '../components/PaymentProposalModal';
import type { VendorInvoice, Vendor } from '../../../types/models';
import {
  CreditCard,
  AlertCircle,
  Clock,
  Send,
  Building,
  CheckCircle2,
  Calendar,
  FileCheck,
  Search,
} from 'lucide-react';

export const AccountsPayablePage: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('open-items');
  const [isLoading, setIsLoading] = useState(true);

  // Invoices & Vendors
  const [openInvoices, setOpenInvoices] = useState<VendorInvoice[]>([]);
  const [blockedInvoices, setBlockedInvoices] = useState<VendorInvoice[]>([]);
  const [agingData, setAgingData] = useState<{ overall: AgingBucket; vendorItems: VendorAgingItem[] }>({
    overall: { current: 0, days30To60: 0, days60To90: 0, over90: 0, total: 0 },
    vendorItems: [],
  });

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendorForLedger, setSelectedVendorForLedger] = useState<string>('');
  const [vendorLedger, setVendorLedger] = useState<{
    transactions: { date: string; docNumber: string; docType?: string; description: string; debit: number; credit: number; balance: number }[];
    closingBalance: number;
  } | null>(null);

  // Modals
  const [selectedInvoiceForMatch, setSelectedInvoiceForMatch] = useState<VendorInvoice | null>(null);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const vList = await db.vendors.filter((v) => !v.isDeleted).toArray();
      setVendors(vList);
      if (vList.length > 0 && !selectedVendorForLedger) {
        setSelectedVendorForLedger(vList[0].vendorCode);
      }

      // Open invoices
      const invs = await db.vendorInvoices
        .filter((inv) => !inv.isDeleted && inv.paymentStatus !== 'Paid')
        .toArray();
      setOpenInvoices(invs);

      // Blocked invoices
      const blocked = await ThreeWayMatchService.getBlockedInvoices();
      setBlockedInvoices(blocked);

      // Aging report
      const aging = await AccountsPayableService.getAgingReport();
      setAgingData(aging);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'فشل تحميل بيانات حسابات الموردين', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Load ledger when selected vendor changes
  useEffect(() => {
    async function loadLedger() {
      if (!selectedVendorForLedger) return;
      const res = await AccountsPayableService.getVendorLedger(selectedVendorForLedger);
      setVendorLedger(res);
    }
    loadLedger();
  }, [selectedVendorForLedger]);

  const totalOpenAmount = openInvoices.reduce((acc, inv) => acc + inv.totalAmount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumbs
            items={[
              { label: t('nav_home'), path: '/' },
              { label: t('nav_finance'), path: '/finance' },
              { label: 'حسابات الموردين والمدفوعات (FI-AP)' },
            ]}
          />
          <h1 className="text-2xl font-black text-[#0B2545] tracking-tight mt-1">
            {t('fi_ap_title')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            متابعة استحقاقات الموردين، كشف الحساب، فحص المطابقة الثلاثية، وجداول الدفع الآلي (F110)
          </p>
        </div>

        <Button
          onClick={() => setIsProposalModalOpen(true)}
          className="bg-[#0FA37F] hover:bg-[#0c8a6c] gap-2 font-bold shadow-sm"
        >
          <Send className="w-4 h-4" />
          <span>{t('fi_btn_proposal')}</span>
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="إجمالي الديون المستحقة للموردين"
          value={`${totalOpenAmount.toLocaleString('en-US')} ر.س`}
          subtitle={`${openInvoices.length} فاتورة غير مسددة`}
          icon={<CreditCard className="w-5 h-5 text-amber-600" />}
        />
        <StatCard
          label="فواتير محجوبة عن الصرف (MRBR)"
          value={blockedInvoices.length.toString()}
          subtitle="فروقات مطابقة ثلاثية"
          icon={<AlertCircle className="w-5 h-5 text-red-600" />}
        />
        <StatCard
          label="ديون متأخرة لأكثر من 60 يوماً"
          value={`${(agingData.overall.days60To90 + agingData.overall.over90).toLocaleString('en-US')} ر.س`}
          subtitle="تتطلب أولوية في مقترح السداد"
          icon={<Clock className="w-5 h-5 text-slate-600" />}
        />
        <StatCard
          label="عدد الموردين ذوي الأرصدة القائمة"
          value={agingData.vendorItems.length.toString()}
          subtitle="شركات ومقاولي طاقة ولوجستيات"
          icon={<Building className="w-5 h-5 text-[#0B2545]" />}
        />
      </div>

      {/* Tabs Layout */}
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'open-items', label: `الفواتير المستحقة المفتوحة (${openInvoices.length})` },
          { id: 'blocked-invoices', label: `الفواتير المحجوبة والمطابقة MRBR (${blockedInvoices.length})` },
          { id: 'vendor-ledger', label: 'كشف حساب المورد (Vendor Ledger)' },
          { id: 'aging-analysis', label: 'تحليل أعمار الديون (Aging Report)' },
        ]}
      />

      {/* Tab 1: Open Items */}
      {activeTab === 'open-items' && (
        <Card className="overflow-hidden border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 text-start">رقم المستند</th>
                  <th className="py-2.5 px-3 text-start">رقم فاتورة المورد</th>
                  <th className="py-2.5 px-3 text-start">كود واسم المورد</th>
                  <th className="py-2.5 px-3 text-start">أمر الشراء المرتبط</th>
                  <th className="py-2.5 px-3 text-start">تاريخ الاستحقاق</th>
                  <th className="py-2.5 px-3 text-end">إجمالي الفاتورة</th>
                  <th className="py-2.5 px-3 text-center">حالة السداد</th>
                  <th className="py-2.5 px-3 text-center">المطابقة الثلاثية</th>
                  <th className="py-2.5 px-3 text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {openInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{inv.docNumber}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{inv.vendorInvoiceNumber}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{inv.vendorName || inv.vendorCode}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{inv.poNumber || '—'}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{inv.dueDate}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-end text-slate-900">
                      {inv.totalAmount.toLocaleString('en-US')} ر.س
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant="pending">{inv.paymentStatus}</Badge>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {inv.isPaymentBlocked ? (
                        <Badge variant="rejected">محجوبة (MRBR)</Badge>
                      ) : (
                        <Badge variant="approved">مطابقة ومعتمدة</Badge>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedInvoiceForMatch(inv);
                          setIsMatchModalOpen(true);
                        }}
                        className="text-[11px] h-7 px-2 font-bold hover:bg-slate-100"
                      >
                        فحص المطابقة
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 2: Blocked Invoices (MRBR) */}
      {activeTab === 'blocked-invoices' && (
        <Card className="overflow-hidden border border-slate-200 space-y-4 p-4">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between text-rose-900">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              <span className="font-bold text-xs">
                قائمة فواتير الموردين المعلقة عن الصرف (SAP MRBR Worklist)
              </span>
            </div>
            <span className="text-xs font-semibold">
              تم حجب هذه الفواتير آلياً لوجود فروقات بالكميات أو الأسعار تتجاوز حد التسامح.
            </span>
          </div>

          <div className="overflow-x-auto border rounded-xl border-slate-200">
            <table className="w-full text-xs text-start">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 text-start">رقم المستند</th>
                  <th className="py-2.5 px-3 text-start">رقم فاتورة المورد</th>
                  <th className="py-2.5 px-3 text-start">المورد</th>
                  <th className="py-2.5 px-3 text-start">أمر الشراء</th>
                  <th className="py-2.5 px-3 text-end">مبلغ الفاتورة</th>
                  <th className="py-2.5 px-3 text-start">أسباب الحظر المكتشفة</th>
                  <th className="py-2.5 px-3 text-center">إجراء الاعتماد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {blockedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      لا توجد فواتير محجوبة حالياً. جميع الفواتير مطابقة لمعايير الاستلام.
                    </td>
                  </tr>
                ) : (
                  blockedInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{inv.docNumber}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{inv.vendorInvoiceNumber}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{inv.vendorName || inv.vendorCode}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{inv.poNumber || '—'}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-end text-slate-900">
                        {inv.totalAmount.toLocaleString('en-US')} ر.س
                      </td>
                      <td className="py-2.5 px-3 text-rose-700 font-semibold">
                        {inv.blockingReasons?.map((r) => (
                          <span key={r} className="inline-block px-2 py-0.5 bg-rose-50 border border-rose-200 rounded text-[11px] me-1 mb-1">
                            {r === 'PriceVariance'
                              ? 'فارق سعر'
                              : r === 'QuantityMismatch'
                              ? 'عدم تطابق كمية'
                              : r === 'MissingGoodsReceipt'
                              ? 'غياب إذن استلام MIGO'
                              : 'شروط دفع'}
                          </span>
                        ))}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectedInvoiceForMatch(inv);
                            setIsMatchModalOpen(true);
                          }}
                          className="bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 font-bold"
                        >
                          مراجعة وفك الحظر ←
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 3: Vendor Ledger */}
      {activeTab === 'vendor-ledger' && (
        <div className="space-y-4">
          <Card className="p-4 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3 w-1/3">
              <label className="text-slate-500 font-bold text-xs whitespace-nowrap">اختر المورد:</label>
              <select
                value={selectedVendorForLedger}
                onChange={(e) => setSelectedVendorForLedger(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
              >
                {vendors.map((v) => (
                  <option key={v.id} value={v.vendorCode}>
                    {v.vendorCode} - {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-6 font-mono text-xs">
              <div>
                <span className="text-slate-400 font-sans block text-[11px]">الرصيد القائم المستحق:</span>
                <span className="text-base font-black text-rose-700">
                  {vendorLedger?.closingBalance.toLocaleString('en-US')} ر.س
                </span>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden border border-slate-200">
            <table className="w-full text-xs text-start">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 text-start">التاريخ</th>
                  <th className="py-2.5 px-3 text-start">رقم المستند</th>
                  <th className="py-2.5 px-3 text-start">نوع الحركة</th>
                  <th className="py-2.5 px-3 text-start">البيان التوضيحي</th>
                  <th className="py-2.5 px-3 text-end">مدين (سداد)</th>
                  <th className="py-2.5 px-3 text-end">دائن (فاتورة)</th>
                  <th className="py-2.5 px-3 text-end">الرصيد التراكمي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {vendorLedger?.transactions.map((tx, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono text-slate-600">{tx.date}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{tx.docNumber}</td>
                    <td className="py-2.5 px-3 font-mono font-bold">
                      <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                        {tx.docType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-800">{tx.description}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-end text-emerald-700">
                      {tx.debit > 0 ? `${tx.debit.toLocaleString('en-US')} ر.س` : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-end text-slate-900">
                      {tx.credit > 0 ? `${tx.credit.toLocaleString('en-US')} ر.س` : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-end text-blue-900">
                      {tx.balance.toLocaleString('en-US')} ر.س
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* Tab 4: Aging Analysis */}
      {activeTab === 'aging-analysis' && (
        <Card className="overflow-hidden border border-slate-200">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 text-start">المورد</th>
                <th className="py-2.5 px-3 text-center">عدد الفواتير</th>
                <th className="py-2.5 px-3 text-end">0 - 30 يوماً (جاري)</th>
                <th className="py-2.5 px-3 text-end">31 - 60 يوماً</th>
                <th className="py-2.5 px-3 text-end">61 - 90 يوماً</th>
                <th className="py-2.5 px-3 text-end">+90 يوماً (متأخر)</th>
                <th className="py-2.5 px-3 text-end">إجمالي المستحق</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {agingData.vendorItems.map((vi) => (
                <tr key={vi.vendorCode} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3 font-bold text-slate-800">
                    {vi.vendorName} ({vi.vendorCode})
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold">{vi.openInvoiceCount}</td>
                  <td className="py-2.5 px-3 font-mono text-end text-slate-700">
                    {vi.buckets.current > 0 ? `${vi.buckets.current.toLocaleString('en-US')} ر.س` : '—'}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-end text-slate-700">
                    {vi.buckets.days30To60 > 0 ? `${vi.buckets.days30To60.toLocaleString('en-US')} ر.س` : '—'}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-end text-amber-700 font-semibold">
                    {vi.buckets.days60To90 > 0 ? `${vi.buckets.days60To90.toLocaleString('en-US')} ر.س` : '—'}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-end text-rose-700 font-bold">
                    {vi.buckets.over90 > 0 ? `${vi.buckets.over90.toLocaleString('en-US')} ر.س` : '—'}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-end text-blue-900 text-sm">
                    {vi.buckets.total.toLocaleString('en-US')} ر.س
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-200">
              <tr>
                <td className="py-3 px-3">الإجمالي العام لأعمار الديون</td>
                <td className="py-3 px-3 text-center">{openInvoices.length}</td>
                <td className="py-3 px-3 text-end font-mono">
                  {agingData.overall.current.toLocaleString('en-US')} ر.س
                </td>
                <td className="py-3 px-3 text-end font-mono">
                  {agingData.overall.days30To60.toLocaleString('en-US')} ر.س
                </td>
                <td className="py-3 px-3 text-end font-mono text-amber-800">
                  {agingData.overall.days60To90.toLocaleString('en-US')} ر.س
                </td>
                <td className="py-3 px-3 text-end font-mono text-rose-800">
                  {agingData.overall.over90.toLocaleString('en-US')} ر.س
                </td>
                <td className="py-3 px-3 text-end font-mono text-blue-900 text-sm">
                  {agingData.overall.total.toLocaleString('en-US')} ر.س
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      {/* Modals */}
      <ThreeWayMatchModal
        invoice={selectedInvoiceForMatch}
        isOpen={isMatchModalOpen}
        onClose={() => setIsMatchModalOpen(false)}
        onReleased={loadData}
      />

      <PaymentProposalModal
        isOpen={isProposalModalOpen}
        onClose={() => setIsProposalModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
};
