import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ColumnDef } from '@tanstack/react-table';
import {
  Users2,
  Plus,
  Upload,
  Eye,
  Trash2,
  CreditCard,
  Building,
  Phone,
  Mail,
  CheckCircle,
} from 'lucide-react';
import { db } from '../../../core/db';
import { customerRepository } from '../../../core/repositories';
import { MasterDataService } from '../services/MasterDataService';
import type { Customer } from '../../../types/models';
import { DataTable } from '../../../components/ui/DataTable';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs';
import { StatCard } from '../../../components/ui/StatCard';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useToast } from '../../../components/ui/Toast';
import { useAuthStore } from '../../../core/auth/useAuthStore';
import { formatCurrency, formatNumber } from '../../../core/utils';
import { ImportCsvModal, TargetFieldDef } from '../components/ImportCsvModal';
import { t } from '../../../i18n/ar';

export const CustomersListPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const user = useAuthStore((s) => s.user);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [blockReason, setBlockReason] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    customerCode: '',
    name: '',
    taxNumber: '',
    creditLimit: '500000',
    city: 'الرياض',
    phone: '',
    email: '',
    contactPerson: '',
    paymentTerms: 'آجل 30 يوماً',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await db.customers.toArray();
      setCustomers(data.filter((c) => !c.isDeleted));
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!formData.customerCode.trim()) errors.customerCode = 'رمز العميل مطلوب';
    if (!formData.name.trim()) errors.name = 'اسم العميل مطلوب';
    if (!formData.taxNumber.trim()) errors.taxNumber = 'الرقم الضريبي مطلوب';

    if (formData.customerCode.trim()) {
      const isUnique = await MasterDataService.isCodeUnique('customers', 'customerCode', formData.customerCode.trim());
      if (!isUnique) errors.customerCode = 'رمز العميل مسجل مسبقاً، يرجى اختيار رمز فريد.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setIsSubmitting(true);
      const newCustomer: Customer = {
        id: `cust-${Date.now()}`,
        customerCode: formData.customerCode.trim().toUpperCase(),
        name: formData.name.trim(),
        taxNumber: formData.taxNumber.trim(),
        creditLimit: Number(formData.creditLimit) || 0,
        city: formData.city,
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        contactPerson: formData.contactPerson.trim(),
        paymentTerms: formData.paymentTerms,
        status: 'active',
        isDeleted: false,
      };

      await customerRepository.create(newCustomer, user?.id || 'admin', user?.fullName || 'مدير النظام');

      showToast({
        title: 'تم تسجيل العميل بنجاح',
        message: `تم إنشاء حساب العميل [${newCustomer.name}] وتحديد الحد الائتماني.`,
        type: 'success',
      });

      setIsCreateOpen(false);
      setFormData({
        customerCode: '',
        name: '',
        taxNumber: '',
        creditLimit: '500000',
        city: 'الرياض',
        phone: '',
        email: '',
        contactPerson: '',
        paymentTerms: 'آجل 30 يوماً',
      });
      setFormErrors({});
      await loadCustomers();
    } catch (err) {
      showToast({
        title: 'فشل التسجيل',
        message: err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ العميل.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAttempt = async (cust: Customer) => {
    const check = await MasterDataService.checkReferentialIntegrity('customers', cust.id, cust.customerCode);
    if (!check.canDelete) {
      setBlockReason(check.reason || 'لا يمكن حذف العميل لارتباطه برحلات وشحنات نشطة.');
      setDeleteTarget(cust);
    } else {
      setBlockReason(null);
      setDeleteTarget(cust);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (blockReason) {
        await MasterDataService.toggleStatus(
          'customers',
          deleteTarget.id,
          'inactive',
          user?.id || 'admin',
          user?.fullName || 'مدير النظام'
        );
        showToast({
          title: 'تم تعطيل حساب العميل',
          message: `تم وضع علامة التعطيل على حساب العميل [${deleteTarget.customerCode}].`,
          type: 'info',
        });
      } else {
        await customerRepository.delete(deleteTarget.id, user?.id || 'admin', user?.fullName || 'مدير النظام');
        showToast({
          title: 'تم حذف العميل',
          message: `تمت إزالة العميل [${deleteTarget.customerCode}] من النظام.`,
          type: 'success',
        });
      }
      setDeleteTarget(null);
      setBlockReason(null);
      await loadCustomers();
    } catch (err) {
      showToast({
        title: 'فشل الإجراء',
        message: err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة الطلب.',
        type: 'error',
      });
    }
  };

  const importTargetFields: TargetFieldDef[] = [
    { key: 'customerCode', label: 'رمز العميل (Customer Code)', required: true, example: 'CUST-001' },
    { key: 'name', label: 'اسم العميل / الشركة', required: true, example: 'شركة نقل الطاقة الوطنية' },
    { key: 'taxNumber', label: 'الرقم الضريبي', required: true, example: '300987654300003' },
    { key: 'creditLimit', label: 'الحد الائتماني (ر.س)', example: '500000' },
    { key: 'city', label: 'المدينة', example: 'الرياض' },
    { key: 'paymentTerms', label: 'شروط الدفع', example: 'آجل 30 يوماً' },
  ];

  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      {
        accessorKey: 'customerCode',
        header: 'رمز العميل',
        cell: ({ row }) => (
          <span className="font-mono font-bold text-navy hover:underline cursor-pointer">
            {row.original.customerCode}
          </span>
        ),
      },
      {
        accessorKey: 'name',
        header: 'اسم العميل / المحطة',
        cell: ({ row }) => (
          <div>
            <div className="font-semibold text-navy">{row.original.name}</div>
            <div className="text-xs text-slate-500">ض: {row.original.taxNumber}</div>
          </div>
        ),
      },
      {
        accessorKey: 'city',
        header: 'المدينة والموقع',
        cell: ({ row }) => <span className="text-xs text-slate-700">{row.original.city}</span>,
      },
      {
        accessorKey: 'creditLimit',
        header: 'سقف الائتمان الممنوح',
        cell: ({ row }) => (
          <span className="font-bold text-navy">
            {formatCurrency(row.original.creditLimit, 'SAR')}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'الحالة',
        cell: ({ row }) => {
          const status = row.original.status || 'active';
          if (status === 'active') return <Badge variant="approved">نشط</Badge>;
          return <Badge variant="closed">معطل</Badge>;
        },
      },
      {
        id: 'actions',
        header: 'إجراءات',
        cell: ({ row }) => (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/master-data/customers/${row.original.id}`)}
              title="عرض التفاصيل الكاملة"
            >
              <Eye className="w-4 h-4 text-blue" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteAttempt(row.original)}
              title="حذف أو تعطيل العميل"
            >
              <Trash2 className="w-4 h-4 text-red" />
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: t('nav_home'), path: '/' },
          { label: t('nav_master_data'), path: '/master-data' },
          { label: t('nav_md_customers') },
        ]}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <Users2 className="w-7 h-7 text-primary" />
            <span>{t('md_customers_title')}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            سجل العملاء، محطات التوزيع، وسقوف الائتمان متوافق مع معايير SAP SD Customer Master
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setIsImportOpen(true)}>
            <Upload className="w-4 h-4 me-1.5" />
            استيراد جماعي (CSV)
          </Button>

          <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 me-1.5" />
            تسجيل عميل جديد (XD01)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="إجمالي العملاء المسجلين"
          value={formatNumber(customers.length)}
          icon={<Users2 className="w-6 h-6 text-primary" />}
        />
        <StatCard
          label="إجمالي السقوف الائتمانية"
          value={formatCurrency(
            customers.reduce((sum, c) => sum + (c.creditLimit || 0), 0),
            'SAR'
          )}
          icon={<CreditCard className="w-6 h-6 text-blue" />}
        />
        <StatCard
          label="عملاء نشطون بالسحب"
          value={formatNumber(customers.filter((c) => c.status === 'active' || !c.status).length)}
          icon={<CheckCircle className="w-6 h-6 text-emerald-600" />}
        />
      </div>

      <DataTable
        data={customers}
        columns={columns}
        isLoading={loading}
        searchPlaceholder="بحث برمز العميل، الاسم، أو المدينة..."
        exportFileName="دليل_العملاء_طاقة_الخليج"
        onRowClick={(row) => navigate(`/master-data/customers/${row.id}`)}
      />

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="تسجيل عميل جديد (SAP XD01)"
        size="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="رمز العميل المعياري *"
              placeholder="مثال: CUST-DIST-01"
              value={formData.customerCode}
              onChange={(e) => setFormData({ ...formData, customerCode: e.target.value })}
              error={formErrors.customerCode}
            />
            <Input
              label="اسم العميل أو المحطة بالكامل *"
              placeholder="مثال: شركة نفط الشرق للتوزيع"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={formErrors.name}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="الرقم الضريبي *"
              placeholder="300123456700003"
              value={formData.taxNumber}
              onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
              error={formErrors.taxNumber}
            />
            <Input
              type="number"
              label="الحد الائتماني (ريال)"
              value={formData.creditLimit}
              onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
            />
            <Input
              label="المدينة"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="الهاتف"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <Input
              label="البريد الإلكتروني"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <Input
              label="المسؤول المباشر"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="ghost" type="button" onClick={() => setIsCreateOpen(false)}>
              إلغاء
            </Button>
            <Button variant="primary" type="submit" loading={isSubmitting}>
              حفظ واعتماد العميل
            </Button>
          </div>
        </form>
      </Modal>

      {/* CSV Bulk Import Modal */}
      <ImportCsvModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={loadCustomers}
        entityType="customers"
        entityTitle="العملاء ومحطات التوزيع"
        targetFields={importTargetFields}
      />

      {/* Delete / Deactivate Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setBlockReason(null);
        }}
        onConfirm={handleConfirmDelete}
        title={blockReason ? 'تعطيل حساب العميل' : 'تأكيد حذف العميل'}
        message={
          blockReason
            ? `${blockReason}\n\nهل ترغب في تعطيل العميل لحفظ القيود المحاسبية التاريخية؟`
            : `هل أنت متأكد من حذف العميل [${deleteTarget?.name}] نهائياً؟`
        }
        confirmText={blockReason ? 'تعطيل الحساب' : 'نعم، حذف العميل'}
        cancelText="إلغاء"
        variant={blockReason ? 'warning' : 'danger'}
      />
    </div>
  );
};
