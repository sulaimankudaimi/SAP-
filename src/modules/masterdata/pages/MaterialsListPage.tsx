import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ColumnDef } from '@tanstack/react-table';
import {
  Boxes,
  Plus,
  Upload,
  Download,
  Barcode,
  Eye,
  Trash2,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { db } from '../../../core/db';
import { materialRepository, materialGroupRepository, unitRepository } from '../../../core/repositories';
import { MasterDataService } from '../services/MasterDataService';
import type { Material, MaterialGroup, UnitOfMeasure } from '../../../types/models';
import { DataTable } from '../../../components/ui/DataTable';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs';
import { Card } from '../../../components/ui/Card';
import { StatCard } from '../../../components/ui/StatCard';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useToast } from '../../../components/ui/Toast';
import { useAuthStore } from '../../../core/auth/useAuthStore';
import { formatNumber, formatCurrency, formatDate } from '../../../core/utils';
import { BarcodeModal } from '../components/BarcodeModal';
import { ImportCsvModal, TargetFieldDef } from '../components/ImportCsvModal';
import { t } from '../../../i18n/ar';

export const MaterialsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const user = useAuthStore((s) => s.user);
  const can = useAuthStore((s) => s.can);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialGroups, setMaterialGroups] = useState<MaterialGroup[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter tab
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive' | 'reorder'>('all');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [barcodeTarget, setBarcodeTarget] = useState<Material | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null);
  const [blockReason, setBlockReason] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    materialCode: '',
    name: '',
    description: '',
    groupCode: 'GRP-FUEL',
    baseUnit: 'LITER',
    abcClass: 'A' as 'A' | 'B' | 'C',
    reorderPoint: '1000',
    safetyStock: '500',
    standardPrice: '10',
    currency: 'SAR',
    valuationMethod: 'MovingAverage' as 'MovingAverage' | 'Standard',
    valuationClass: '3000',
    purchasingGroup: '001',
    leadTimeDays: '7',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [mats, grps, uns] = await Promise.all([
        db.materials.toArray(),
        db.materialGroups.toArray(),
        db.units.toArray(),
      ]);
      setMaterials(mats.filter((m) => !m.isDeleted));
      setMaterialGroups(grps.filter((g) => !g.isDeleted));
      setUnits(uns.filter((u) => !u.isDeleted));
    } catch (err) {
      console.error('Failed to load materials data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered dataset
  const filteredMaterials = useMemo(() => {
    if (activeFilter === 'active') return materials.filter((m) => m.status === 'active' || !m.status);
    if (activeFilter === 'inactive') return materials.filter((m) => m.status === 'inactive' || m.status === 'flagged_for_deletion');
    if (activeFilter === 'reorder') return materials.filter((m) => (m.reorderPoint || 0) > 2000);
    return materials;
  }, [materials, activeFilter]);

  // Handle Create Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!formData.materialCode.trim()) errors.materialCode = 'رمز الصنف مطلوب';
    if (!formData.name.trim()) errors.name = 'اسم الصنف مطلوب';
    if (!formData.groupCode) errors.groupCode = 'مجموعة المواد مطلوبة';
    if (!formData.baseUnit) errors.baseUnit = 'وحدة القياس مطلوبة';
    if (isNaN(Number(formData.standardPrice)) || Number(formData.standardPrice) < 0) {
      errors.standardPrice = 'السعر المعياري يجب أن يكون موجباً';
    }

    // Unique code check
    if (formData.materialCode.trim()) {
      const isUnique = await MasterDataService.isCodeUnique('materials', 'materialCode', formData.materialCode.trim());
      if (!isUnique) errors.materialCode = 'رمز الصنف موجود مسبقاً في النظام، يرجى اختيار رمز فريد.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setIsSubmitting(true);
      const newMaterial: Material = {
        id: `mat-${Date.now()}`,
        materialCode: formData.materialCode.trim().toUpperCase(),
        name: formData.name.trim(),
        description: formData.description.trim(),
        groupCode: formData.groupCode,
        baseUnit: formData.baseUnit,
        abcClass: formData.abcClass,
        reorderPoint: Number(formData.reorderPoint) || 0,
        safetyStock: Number(formData.safetyStock) || 0,
        standardPrice: Number(formData.standardPrice) || 0,
        currency: formData.currency,
        valuationMethod: formData.valuationMethod,
        valuationClass: formData.valuationClass,
        purchasingGroup: formData.purchasingGroup,
        leadTimeDays: Number(formData.leadTimeDays) || 0,
        status: 'active',
        isDeleted: false,
      };

      await materialRepository.create(newMaterial, user?.id || 'admin', user?.fullName || 'مدير النظام');

      showToast({
        title: 'تم إنشاء الصنف بنجاح',
        message: `تم حفظ الصنف [${newMaterial.materialCode}] وتوليد كود التتبع المعياري.`,
        type: 'success',
      });

      setIsCreateOpen(false);
      setFormData({
        materialCode: '',
        name: '',
        description: '',
        groupCode: 'GRP-FUEL',
        baseUnit: 'LITER',
        abcClass: 'A',
        reorderPoint: '1000',
        safetyStock: '500',
        standardPrice: '10',
        currency: 'SAR',
        valuationMethod: 'MovingAverage',
        valuationClass: '3000',
        purchasingGroup: '001',
        leadTimeDays: '7',
      });
      setFormErrors({});
      await loadData();
    } catch (err) {
      showToast({
        title: 'خطأ في الحفظ',
        message: err instanceof Error ? err.message : 'فشل حفظ الصنف الجديد.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Attempt Delete with Referential Integrity Guard
  const handleDeleteAttempt = async (material: Material) => {
    const check = await MasterDataService.checkReferentialIntegrity('materials', material.id, material.materialCode);
    if (!check.canDelete) {
      setBlockReason(check.reason || 'لا يمكن حذف هذا الصنف لارتباطه بمستندات نشطة.');
      setDeleteTarget(material);
    } else {
      setBlockReason(null);
      setDeleteTarget(material);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (blockReason) {
        // If blocked from deletion, execute SAP Deactivation instead
        await MasterDataService.toggleStatus(
          'materials',
          deleteTarget.id,
          'inactive',
          user?.id || 'admin',
          user?.fullName || 'مدير النظام'
        );
        showToast({
          title: 'تم تعطيل الصنف بنجاح',
          message: `تم وضع علامة التعطيل (LOEKZ) على الصنف [${deleteTarget.materialCode}] للحفاظ على تدفق المستندات التاريخي.`,
          type: 'info',
        });
      } else {
        await materialRepository.delete(deleteTarget.id, user?.id || 'admin', user?.fullName || 'مدير النظام');
        showToast({
          title: 'تم حذف الصنف',
          message: `تمت إزالة الصنف [${deleteTarget.materialCode}] من قاعدة البيانات.`,
          type: 'success',
        });
      }
      setDeleteTarget(null);
      setBlockReason(null);
      await loadData();
    } catch (err) {
      showToast({
        title: 'فشل الإجراء',
        message: err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة الطلب.',
        type: 'error',
      });
    }
  };

  // Target fields for CSV import
  const importTargetFields: TargetFieldDef[] = [
    { key: 'materialCode', label: 'رمز المادة (Material Code)', required: true, example: 'MAT-GAS-95' },
    { key: 'name', label: 'اسم الصنف (Material Name)', required: true, example: 'بنزين 95 أوكتان عالي النقاء' },
    { key: 'groupCode', label: 'رمز المجموعة', required: true, example: 'GRP-FUEL' },
    { key: 'baseUnit', label: 'وحدة القياس', required: true, example: 'LITER' },
    { key: 'standardPrice', label: 'السعر المعياري', required: true, example: '2.33' },
    { key: 'reorderPoint', label: 'نقطة إعادة الطلب', example: '5000' },
    { key: 'safetyStock', label: 'مخزون الأمان', example: '2500' },
    { key: 'abcClass', label: 'تصنيف ABC (A/B/C)', example: 'A' },
  ];

  // TanStack Columns
  const columns = useMemo<ColumnDef<Material>[]>(
    () => [
      {
        accessorKey: 'materialCode',
        header: 'رمز الصنف (Code)',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-navy hover:underline cursor-pointer">
              {row.original.materialCode}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setBarcodeTarget(row.original);
              }}
              className="p-1 text-slate-400 hover:text-navy hover:bg-slate-100 rounded"
              title="طباعة باركود Code128"
            >
              <Barcode className="w-4 h-4" />
            </button>
          </div>
        ),
      },
      {
        accessorKey: 'name',
        header: 'اسم الصنف والمواصفات',
        cell: ({ row }) => (
          <div>
            <div className="font-semibold text-navy">{row.original.name}</div>
            {row.original.description && (
              <div className="text-xs text-slate-500 line-clamp-1">{row.original.description}</div>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'groupCode',
        header: 'المجموعة',
        cell: ({ row }) => (
          <span className="text-xs font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
            {row.original.groupCode}
          </span>
        ),
      },
      {
        accessorKey: 'baseUnit',
        header: 'الوحدة',
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.baseUnit}</span>,
      },
      {
        accessorKey: 'abcClass',
        header: 'تصنيف ABC',
        cell: ({ row }) => {
          const cls = row.original.abcClass;
          const variant = cls === 'A' ? 'critical' : cls === 'B' ? 'in_progress' : 'closed';
          return <Badge variant={variant}>فئة {cls}</Badge>;
        },
      },
      {
        accessorKey: 'standardPrice',
        header: 'السعر المعياري',
        cell: ({ row }) => (
          <span className="font-semibold text-navy">
            {formatCurrency(row.original.standardPrice, row.original.currency || 'SAR')}
          </span>
        ),
      },
      {
        accessorKey: 'reorderPoint',
        header: 'نقطة الطلب / الأمان',
        cell: ({ row }) => (
          <div className="text-xs">
            <span className="text-navy font-semibold">{formatNumber(row.original.reorderPoint || 0)}</span>
            <span className="text-slate-400 mx-1">/</span>
            <span className="text-slate-500">{formatNumber(row.original.safetyStock || 0)}</span>
          </div>
        ),
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
              onClick={() => navigate(`/master-data/materials/${row.original.id}`)}
              title="عرض التفاصيل الكاملة"
            >
              <Eye className="w-4 h-4 text-blue" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteAttempt(row.original)}
              title="حذف أو تعطيل الصنف"
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
          { label: t('nav_md_materials') },
        ]}
      />

      {/* Header & KPI Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <Boxes className="w-7 h-7 text-primary" />
            <span>{t('md_materials_title')}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            سجل المواد المعياري وقطع الغيار متوافق مع بنية SAP Material Master (MM01/MM03)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setIsImportOpen(true)}>
            <Upload className="w-4 h-4 me-1.5" />
            استيراد جماعي (CSV)
          </Button>

          <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 me-1.5" />
            إضافة صنف جديد (MM01)
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي الأصناف المسجلة"
          value={formatNumber(materials.length)}
          icon={<Boxes className="w-6 h-6 text-primary" />}
        />
        <StatCard
          label="أصناف نشطة قيد التداول"
          value={formatNumber(materials.filter((m) => m.status === 'active' || !m.status).length)}
          icon={<CheckCircle className="w-6 h-6 text-emerald-600" />}
        />
        <StatCard
          label="أصناف استراتيجية (Class A)"
          value={formatNumber(materials.filter((m) => m.abcClass === 'A').length)}
          icon={<AlertTriangle className="w-6 h-6 text-amber" />}
        />
        <StatCard
          label="أصناف معطلة / معلمة للحذف"
          value={formatNumber(materials.filter((m) => m.status === 'inactive' || m.status === 'flagged_for_deletion').length)}
          icon={<XCircle className="w-6 h-6 text-slate-400" />}
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
          كافة المواد ({materials.length})
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
          أصناف نشطة
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('reorder')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
            activeFilter === 'reorder'
              ? 'bg-navy text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          حد إعادة الطلب المرتفع
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('inactive')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
            activeFilter === 'inactive'
              ? 'bg-navy text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          معطلة / محذوفة
        </button>
      </div>

      {/* Main Table */}
      <DataTable
        data={filteredMaterials}
        columns={columns}
        isLoading={loading}
        searchPlaceholder="بحث برمز الصنف، الاسم، المجموعة، أو الوحدة..."
        exportFileName="سجل_المواد_طاقة_الخليج"
        onRowClick={(row) => navigate(`/master-data/materials/${row.id}`)}
      />

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="إضافة صنف جديد إلى دليل المواد (SAP MM01)"
        size="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="رمز الصنف المعياري (Material Code) *"
              placeholder="مثال: MAT-OIL-009"
              value={formData.materialCode}
              onChange={(e) => setFormData({ ...formData, materialCode: e.target.value })}
              error={formErrors.materialCode}
            />

            <Input
              label="اسم الصنف بالكامل *"
              placeholder="مثال: زيت توربينات حرارية تخليقي"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={formErrors.name}
            />
          </div>

          <Textarea
            label="الوصف الفني والتفصيلي"
            placeholder="مواصفات الصنف، درجة اللزوجة أو الكثافة ومعايير الجودة..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="مجموعة المواد *"
              value={formData.groupCode}
              onChange={(e) => setFormData({ ...formData, groupCode: e.target.value })}
              options={materialGroups.map((g) => ({
                value: g.code,
                label: `${g.name} (${g.code})`,
              }))}
            />

            <Select
              label="وحدة القياس الأساسية *"
              value={formData.baseUnit}
              onChange={(e) => setFormData({ ...formData, baseUnit: e.target.value })}
              options={units.map((u) => ({
                value: u.code,
                label: `${u.name} (${u.code})`,
              }))}
            />

            <Select
              label="تصنيف الأهمية (ABC Class) *"
              value={formData.abcClass}
              onChange={(e) =>
                setFormData({ ...formData, abcClass: e.target.value as 'A' | 'B' | 'C' })
              }
              options={[
                { value: 'A', label: 'الفئة A - استراتيجي عالي القيمة' },
                { value: 'B', label: 'الفئة B - متوسط الاستهلاك' },
                { value: 'C', label: 'الفئة C - تشغيلي روتيني' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              type="number"
              label="السعر المعياري (Standard Price) *"
              value={formData.standardPrice}
              onChange={(e) => setFormData({ ...formData, standardPrice: e.target.value })}
              error={formErrors.standardPrice}
            />

            <Input
              type="number"
              label="نقطة إعادة الطلب (Reorder Point)"
              value={formData.reorderPoint}
              onChange={(e) => setFormData({ ...formData, reorderPoint: e.target.value })}
            />

            <Input
              type="number"
              label="مخزون الأمان الأدنى (Safety Stock)"
              value={formData.safetyStock}
              onChange={(e) => setFormData({ ...formData, safetyStock: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="طريقة التقييم المخزني"
              value={formData.valuationMethod}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  valuationMethod: e.target.value as 'MovingAverage' | 'Standard',
                })
              }
              options={[
                { value: 'MovingAverage', label: 'المتوسط المرجح المتحرك (V)' },
                { value: 'Standard', label: 'السعر المعياري الثابت (S)' },
              ]}
            />

            <Input
              label="فئة التقييم المحاسبي (Valuation Class)"
              value={formData.valuationClass}
              onChange={(e) => setFormData({ ...formData, valuationClass: e.target.value })}
              placeholder="3000"
            />

            <Input
              type="number"
              label="فترة التوريد المتوقعة (أيام)"
              value={formData.leadTimeDays}
              onChange={(e) => setFormData({ ...formData, leadTimeDays: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="ghost" type="button" onClick={() => setIsCreateOpen(false)}>
              إلغاء
            </Button>
            <Button variant="primary" type="submit" loading={isSubmitting}>
              حفظ وترحيل الصنف
            </Button>
          </div>
        </form>
      </Modal>

      {/* Barcode Modal */}
      {barcodeTarget && (
        <BarcodeModal
          isOpen={!!barcodeTarget}
          onClose={() => setBarcodeTarget(null)}
          materialCode={barcodeTarget.materialCode}
          materialName={barcodeTarget.name}
          unit={barcodeTarget.baseUnit}
          category={barcodeTarget.groupCode}
        />
      )}

      {/* CSV Bulk Import Modal */}
      <ImportCsvModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={loadData}
        entityType="materials"
        entityTitle="المواد والأصناف"
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
        title={blockReason ? 'تعطيل الصنف (علامة الحذف SAP LOEKZ)' : 'تأكيد حذف الصنف'}
        message={
          blockReason
            ? `${blockReason}\n\nهل ترغب في وضع علامة "معطل" على الصنف لمنع استخدامه في أوامر الشراء المستقبلية مع الحفاظ على البيانات التاريخية؟`
            : `هل أنت متأكد من رغبتك في حذف الصنف [${deleteTarget?.materialCode}] نهائياً؟`
        }
        confirmText={blockReason ? 'تعطيل الصنف الآن' : 'نعم، حذف الصنف'}
        cancelText="إلغاء"
        variant={blockReason ? 'warning' : 'danger'}
      />
    </div>
  );
};
