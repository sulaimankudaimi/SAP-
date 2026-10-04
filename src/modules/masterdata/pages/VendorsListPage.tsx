import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ColumnDef } from '@tanstack/react-table';
import {
  Users,
  Plus,
  Upload,
  Eye,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Star,
  ShieldAlert,
  Building2,
} from 'lucide-react';
import { db } from '../../../core/db';
import { vendorRepository } from '../../../core/repositories';
import { MasterDataService } from '../services/MasterDataService';
import type { Vendor } from '../../../types/models';
import { DataTable } from '../../../components/ui/DataTable';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs';
import { StatCard } from '../../../components/ui/StatCard';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useToast } from '../../../components/ui/Toast';
import { useAuthStore } from '../../../core/auth/useAuthStore';
import { formatNumber, formatDate } from '../../../core/utils';
import { ImportCsvModal, TargetFieldDef } from '../components/ImportCsvModal';
import { t } from '../../../i18n/ar';

export const VendorsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const user = useAuthStore((s) => s.user);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter Tab
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'expiring' | 'high_rated'>('all');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [blockReason, setBlockReason] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    vendorCode: '',
    name: '',
    commercialRecord: '',
    taxNumber: '',
    category: 'وقود ومحروقات',
    paymentTerms: '30_days',
    city: 'الرياض',
    phone: '',
    email: '',
    contactPerson: '',
    bankName: 'مصرف الراجحي',
    bankIban: '',
    crExpiryDate: '2027-12-31',
    ratingDelivery: '4.8',
    ratingQuality: '4.7',
    ratingPrice: '4.5',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const data = await db.vendors.toArray();
      setVendors(data.filter((v) => !v.isDeleted));
    } catch (err) {
      console.error('Failed to load vendors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, []);

  // Check if expiration is within 30 days or passed
  const getExpirationStatus = (expiryDate?: string) => {
    if (!expiryDate) return 'valid';
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'expired';
    if (diffDays <= 30) return 'warning';
    return 'valid';
  };

  // Filtered dataset
  const filteredVendors = useMemo(() => {
    if (activeFilter === 'active') return vendors.filter((v) => v.status === 'active' || !v.status);
    if (activeFilter === 'expiring') {
      return vendors.filter((v) => {
        const st = getExpirationStatus(v.crExpiryDate);
        return st === 'expired' || st === 'warning';
      });
    }
    if (activeFilter === 'high_rated') return vendors.filter((v) => (v.rating || 0) >= 4.5);
    return vendors;
  }, [vendors, activeFilter]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!formData.vendorCode.trim()) errors.vendorCode = 'رمز المورد مطلوب';
    if (!formData.name.trim()) errors.name = 'اسم المورد مطلوب';
    if (!formData.commercialRecord.trim()) errors.commercialRecord = 'رقم السجل التجاري مطلوب';
    if (!formData.taxNumber.trim()) errors.taxNumber = 'الرقم الضريبي مطلوب';

    if (formData.vendorCode.trim()) {
      const isUnique = await MasterDataService.isCodeUnique('vendors', 'vendorCode', formData.vendorCode.trim());
      if (!isUnique) errors.vendorCode = 'رمز المورد مسجل مسبقاً، يرجى إدخال رمز فريد.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setIsSubmitting(true);
      const del = Number(formData.ratingDelivery) || 4.5;
      const qual = Number(formData.ratingQuality) || 4.5;
      const pr = Number(formData.ratingPrice) || 4.5;
      const overall = parseFloat(((del * 0.4) + (qual * 0.4) + (pr * 0.2)).toFixed(1));

      const newVendor: Vendor = {
        id: `ven-${Date.now()}`,
        vendorCode: formData.vendorCode.trim().toUpperCase(),
        name: formData.name.trim(),
        commercialRecord: formData.commercialRecord.trim(),
        taxNumber: formData.taxNumber.trim(),
        category: formData.category,
        paymentTerms: formData.paymentTerms,
        city: formData.city,
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        contactPerson: formData.contactPerson.trim(),
        bankName: formData.bankName,
        bankIban: formData.bankIban.trim(),
        crExpiryDate: formData.crExpiryDate,
        rating: overall,
        ratingDelivery: del,
        ratingQuality: qual,
        ratingPrice: pr,
        status: 'active',
        isDeleted: false,
      };

      await vendorRepository.create(newVendor, user?.id || 'admin', user?.fullName || 'مدير النظام');

      showToast({
        title: 'تم تسجيل المورد بنجاح',
        message: `تم إنشاء ملف المورد [${newVendor.name}] وتعيين التصنيف الأولي.`,
        type: 'success',
      });

      setIsCreateOpen(false);
      setFormData({
        vendorCode: '',
        name: '',
        commercialRecord: '',
        taxNumber: '',
        category: 'وقود ومحروقات',
        paymentTerms: '30_days',
        city: 'الرياض',
        phone: '',
        email: '',
        contactPerson: '',
        bankName: 'مصرف الراجحي',
        bankIban: '',
        crExpiryDate: '2027-12-31',
        ratingDelivery: '4.8',
        ratingQuality: '4.7',
        ratingPrice: '4.5',
      });
      setFormErrors({});
      await loadVendors();
    } catch (err) {
      showToast({
        title: 'خطأ في التسجيل',
        message: err instanceof Error ? err.message : 'فشل حفظ بيانات المورد.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAttempt = async (vendor: Vendor) => {
    const check = await MasterDataService.checkReferentialIntegrity('vendors', vendor.id, vendor.vendorCode);
    if (!check.canDelete) {
      setBlockReason(check.reason || 'لا يمكن حذف المورد لوجود معاملات مالية أو أوامر شراء نشطة.');
      setDeleteTarget(vendor);
    } else {
      setBlockReason(null);
      setDeleteTarget(vendor);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (blockReason) {
        await MasterDataService.toggleStatus(
          'vendors',
          deleteTarget.id,
          'inactive',
          user?.id || 'admin',
          user?.fullName || 'مدير النظام'
        );
        showToast({
          title: 'تم تعطيل المورد بنجاح',
          message: `تم وضع علامة التعطيل على ملف المورد [${deleteTarget.vendorCode}] لحفظ القيود المحاسبية التاريخية.`,
          type: 'info',
        });
      } else {
        await vendorRepository.delete(deleteTarget.id, user?.id || 'admin', user?.fullName || 'مدير النظام');
        showToast({
          title: 'تم حذف المورد',
          message: `تمت إزالة المورد [${deleteTarget.vendorCode}] من قاعدة البيانات.`,
          type: 'success',
        });
      }
      setDeleteTarget(null);
      setBlockReason(null);
      await loadVendors();
    } catch (err) {
      showToast({
        title: 'فشل الإجراء',
        message: err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة الطلب.',
        type: 'error',
      });
    }
  };

  const importTargetFields: TargetFieldDef[] = [
    { key: 'vendorCode', label: 'رمز المورد (Vendor Code)', required: true, example: 'VEND-001' },
    { key: 'name', label: 'اسم المورد (Vendor Name)', required: true, example: 'شركة أرامكو للتوزيع' },
    { key: 'commercialRecord', label: 'السجل التجاري', required: true, example: '1010293847' },
    { key: 'taxNumber', label: 'الرقم الضريبي', required: true, example: '300192837400003' },
    { key: 'category', label: 'تصنيف النشاط', example: 'وقود ومحروقات' },
    { key: 'city', label: 'المدينة', example: 'الرياض' },
    { key: 'paymentTerms', label: 'شروط الدفع', example: '30_days' },
    { key: 'crExpiryDate', label: 'تاريخ انتهاء السجل', example: '2027-10-15' },
  ];

  const columns = useMemo<ColumnDef<Vendor>[]>(
    () => [
      {
        accessorKey: 'vendorCode',
        header: 'رمز المورد',
        cell: ({ row }) => (
          <span className="font-mono font-bold text-navy hover:underline cursor-pointer">
            {row.original.vendorCode}
          </span>
        ),
      },
      {
        accessorKey: 'name',
        header: 'اسم المورد والمقاول',
        cell: ({ row }) => (
          <div>
            <div className="font-semibold text-navy">{row.original.name}</div>
            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span>ست: {row.original.commercialRecord}</span>
              <span>•</span>
              <span>ض: {row.original.taxNumber}</span>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'category',
        header: 'التصنيف / النشاط',
        cell: ({ row }) => (
          <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
            {row.original.category}
          </span>
        ),
      },
      {
        accessorKey: 'city',
        header: 'المدينة',
        cell: ({ row }) => <span className="text-xs text-slate-700">{row.original.city}</span>,
      },
      {
        accessorKey: 'rating',
        header: 'التقييم التشغيلي',
        cell: ({ row }) => {
          const rating = row.original.rating || 4.5;
          return (
            <div className="flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber fill-amber" />
              <span className="font-bold text-navy text-xs">{rating.toFixed(1)}</span>
              <span className="text-[10px] text-slate-400">/ 5.0</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'crExpiryDate',
        header: 'صلاحية الاعتماد',
        cell: ({ row }) => {
          const status = getExpirationStatus(row.original.crExpiryDate);
          if (status === 'expired') {
            return (
              <Badge variant="critical" className="gap-1">
                <AlertTriangle className="w-3 h-3" />
                منتهي الصلاحية
              </Badge>
            );
          }
          if (status === 'warning') {
            return (
              <Badge variant="in_review" className="gap-1">
                <Clock className="w-3 h-3" />
                ينتهي قريباً
              </Badge>
            );
          }
          return (
            <Badge variant="approved">
              ساري ({row.original.crExpiryDate ? formatDate(row.original.crExpiryDate, 'yyyy/MM') : 'مطابق'})
            </Badge>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'الحالة',
        cell: ({ row }) => {
          const status = row.original.status || 'active';
          if (status === 'active') return <Badge variant="approved">نشط</Badge>;
          if (status === 'flagged_for_deletion') return <Badge variant="critical">معلم للحذف</Badge>;
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
              onClick={() => navigate(`/master-data/vendors/${row.original.id}`)}
              title="عرض ملف المورد والتقييم"
            >
              <Eye className="w-4 h-4 text-blue" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteAttempt(row.original)}
              title="حذف أو تعطيل المورد"
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
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: t('nav_home'), path: '/' },
          { label: t('nav_master_data'), path: '/master-data' },
          { label: t('nav_md_vendors') },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <Building2 className="w-7 h-7 text-primary" />
            <span>{t('md_vendors_title')}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            ملفات الموردين والمقاولين والاعتمادات الرسمية متوافقة مع SAP Business Partner (BP/XK03)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setIsImportOpen(true)}>
            <Upload className="w-4 h-4 me-1.5" />
            استيراد جماعي (CSV)
          </Button>

          <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 me-1.5" />
            تسجيل مورد جديد (XK01)
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي الموردين المعتمدين"
          value={formatNumber(vendors.length)}
          icon={<Users className="w-6 h-6 text-primary" />}
        />
        <StatCard
          label="موردون بتقييم مرتفع (>= 4.5)"
          value={formatNumber(vendors.filter((v) => (v.rating || 0) >= 4.5).length)}
          icon={<Star className="w-6 h-6 text-amber fill-amber" />}
        />
        <StatCard
          label="شهادات واعتمادات قاربت على الانتهاء"
          value={formatNumber(
            vendors.filter((v) => {
              const st = getExpirationStatus(v.crExpiryDate);
              return st === 'expired' || st === 'warning';
            }).length
          )}
          icon={<ShieldAlert className="w-6 h-6 text-red" />}
        />
        <StatCard
          label="موردون نشطون بالتعاقد"
          value={formatNumber(vendors.filter((v) => v.status === 'active' || !v.status).length)}
          icon={<CheckCircle className="w-6 h-6 text-emerald-600" />}
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
            activeFilter === 'all'
              ? 'bg-navy text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          كافة الموردين ({vendors.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('active')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
            activeFilter === 'active'
              ? 'bg-navy text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          موردون نشطون
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('expiring')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
            activeFilter === 'expiring'
              ? 'bg-navy text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          تنبيهات انتهاء الصلاحية
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('high_rated')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
            activeFilter === 'high_rated'
              ? 'bg-navy text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          الأعلى تقييماً (Tier-1)
        </button>
      </div>

      {/* Table */}
      <DataTable
        data={filteredVendors}
        columns={columns}
        isLoading={loading}
        searchPlaceholder="بحث برمز المورد، الاسم، السجل التجاري، أو المدينة..."
        exportFileName="دليل_الموردين_طاقة_الخليج"
        onRowClick={(row) => navigate(`/master-data/vendors/${row.id}`)}
      />

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="تسجيل مورد جديد في النظام (SAP XK01)"
        size="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="رمز المورد المعياري (Vendor Code) *"
              placeholder="مثال: VEND-ARAMCO-01"
              value={formData.vendorCode}
              onChange={(e) => setFormData({ ...formData, vendorCode: e.target.value })}
              error={formErrors.vendorCode}
            />

            <Input
              label="اسم الشركة / المورد بالكامل *"
              placeholder="مثال: الشركة الوطنية للمشتقات النفطية"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={formErrors.name}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="رقم السجل التجاري (CR Number) *"
              placeholder="1010123456"
              value={formData.commercialRecord}
              onChange={(e) => setFormData({ ...formData, commercialRecord: e.target.value })}
              error={formErrors.commercialRecord}
            />

            <Input
              label="الرقم الضريبي (VAT ID) *"
              placeholder="300123456700003"
              value={formData.taxNumber}
              onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
              error={formErrors.taxNumber}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="تصنيف النشاط"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              options={[
                { value: 'وقود ومحروقات', label: 'وقود ومحروقات' },
                { value: 'زيوت ومواد تشحيم', label: 'زيوت ومواد تشحيم' },
                { value: 'قطع غيار وصيانة', label: 'قطع غيار وصيانة' },
                { value: 'خدمات لوجستية ونقل', label: 'خدمات لوجستية ونقل' },
              ]}
            />

            <Select
              label="شروط الدفع والائتمان"
              value={formData.paymentTerms}
              onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
              options={[
                { value: 'immediate', label: 'دفع فوري عند الاستلام' },
                { value: '30_days', label: 'آجل 30 يوماً' },
                { value: '60_days', label: 'آجل 60 يوماً' },
                { value: '90_days', label: 'آجل 90 يوماً' },
              ]}
            />

            <Input
              label="المدينة والمقر الرئيسي"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="رقم الهاتف"
              placeholder="0112345678"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />

            <Input
              label="البريد الإلكتروني"
              placeholder="procurement@vendor.sa"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />

            <Input
              label="الشخص المسؤول للاتصال"
              placeholder="م. خالد العتيبي"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="اسم البنك المعتمد"
              value={formData.bankName}
              onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
            />

            <Input
              label="رقم الحساب الدولي (IBAN)"
              placeholder="SA0380000000608010167519"
              value={formData.bankIban}
              onChange={(e) => setFormData({ ...formData, bankIban: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              type="date"
              label="تاريخ انتهاء السجل التجاري (CR Expiry)"
              value={formData.crExpiryDate}
              onChange={(e) => setFormData({ ...formData, crExpiryDate: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="ghost" type="button" onClick={() => setIsCreateOpen(false)}>
              إلغاء
            </Button>
            <Button variant="primary" type="submit" loading={isSubmitting}>
              اعتماد وتسجيل المورد
            </Button>
          </div>
        </form>
      </Modal>

      {/* CSV Bulk Import Modal */}
      <ImportCsvModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={loadVendors}
        entityType="vendors"
        entityTitle="الموردين والمقاولين"
        targetFields={importTargetFields}
      />

      {/* Delete / Deactivate Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setBlockReason(null);
        }}
        onConfirm={handleConfirmDelete}
        title={blockReason ? 'تعطيل ملف المورد (حظر التعاملات)' : 'تأكيد حذف المورد'}
        message={
          blockReason
            ? `${blockReason}\n\nهل ترغب في وضع علامة "معطل" على المورد لمنع إصدار أوامر شراء وعقود جديدة له مع حفظ قيود الدفاتر المحاسبية؟`
            : `هل أنت متأكد من حذف المورد [${deleteTarget?.name}] نهائياً؟`
        }
        confirmText={blockReason ? 'تعطيل المورد الآن' : 'نعم، حذف المورد'}
        cancelText="إلغاء"
        variant={blockReason ? 'warning' : 'danger'}
      />
    </div>
  );
};
