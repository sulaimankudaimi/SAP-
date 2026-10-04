import React, { useEffect, useState, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  PieChart,
  Plus,
  Trash2,
  Edit,
  Building,
  User,
  CheckCircle,
} from 'lucide-react';
import { db } from '../../../core/db';
import { costCenterRepository } from '../../../core/repositories';
import { MasterDataService } from '../services/MasterDataService';
import type { CostCenter } from '../../../types/models';
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
import { formatNumber } from '../../../core/utils';
import { t } from '../../../i18n/ar';

export const CostCentersListPage: React.FC = () => {
  const { showToast } = useToast();
  const user = useAuthStore((s) => s.user);

  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CostCenter | null>(null);
  const [blockReason, setBlockReason] = useState<string | null>(null);

  // Form
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    companyCode: '1000',
    responsiblePerson: '',
    department: 'العمليات اللوجستية',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await db.costCenters.toArray();
      setCostCenters(data.filter((c) => !c.isDeleted));
    } catch (err) {
      console.error('Failed to load cost centers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!formData.code.trim()) errors.code = 'رمز مركز التكلفة مطلوب';
    if (!formData.name.trim()) errors.name = 'اسم مركز التكلفة مطلوب';

    if (formData.code.trim()) {
      const isUnique = await MasterDataService.isCodeUnique('costCenters', 'code', formData.code.trim());
      if (!isUnique) errors.code = 'رمز مركز التكلفة مسجل مسبقاً.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setIsSubmitting(true);
      const newCC: CostCenter = {
        id: `cc-${Date.now()}`,
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        companyCode: formData.companyCode,
        responsiblePerson: formData.responsiblePerson.trim() || 'مدير العمليات',
        department: formData.department,
        status: 'active',
        isDeleted: false,
      };

      await costCenterRepository.create(newCC, user?.id || 'admin', user?.fullName || 'مدير النظام');
      showToast({
        title: 'تم إنشاء مركز التكلفة',
        message: `تم تسجيل مركز التكلفة [${newCC.name}] بنجاح.`,
        type: 'success',
      });

      setIsCreateOpen(false);
      setFormData({ code: '', name: '', companyCode: '1000', responsiblePerson: '', department: 'العمليات اللوجستية' });
      setFormErrors({});
      await loadData();
    } catch (err) {
      showToast({
        title: 'فشل الإنشاء',
        message: err instanceof Error ? err.message : 'حدث خطأ.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAttempt = async (cc: CostCenter) => {
    const check = await MasterDataService.checkReferentialIntegrity('costCenters', cc.id, cc.code);
    if (!check.canDelete) {
      setBlockReason(check.reason || 'لا يمكن حذف مركز التكلفة لارتباطه بطلبات شراء أو ميزانيات.');
    } else {
      setBlockReason(null);
    }
    setDeleteTarget(cc);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (blockReason) {
        await MasterDataService.toggleStatus(
          'costCenters',
          deleteTarget.id,
          'inactive',
          user?.id || 'admin',
          user?.fullName || 'مدير النظام'
        );
        showToast({
          title: 'تم تعطيل مركز التكلفة',
          message: `تم تعطيل مركز التكلفة [${deleteTarget.code}] لمنع تحميل مصروفات جديدة عليه.`,
          type: 'info',
        });
      } else {
        await costCenterRepository.delete(deleteTarget.id, user?.id || 'admin', user?.fullName || 'مدير النظام');
        showToast({
          title: 'تم الحذف بنجاح',
          message: `تم حذف مركز التكلفة [${deleteTarget.code}].`,
          type: 'success',
        });
      }

      setDeleteTarget(null);
      setBlockReason(null);
      await loadData();
    } catch (err) {
      showToast({
        title: 'فشل الإجراء',
        message: err instanceof Error ? err.message : 'حدث خطأ.',
        type: 'error',
      });
    }
  };

  const columns = useMemo<ColumnDef<CostCenter>[]>(
    () => [
      {
        accessorKey: 'code',
        header: 'رمز المركز (Cost Center)',
        cell: ({ row }) => <span className="font-mono font-bold text-navy">{row.original.code}</span>,
      },
      {
        accessorKey: 'name',
        header: 'اسم مركز التكلفة',
        cell: ({ row }) => <span className="font-semibold text-navy">{row.original.name}</span>,
      },
      {
        accessorKey: 'department',
        header: 'القسم / الإدارة',
        cell: ({ row }) => <span>{row.original.department || 'العمليات'}</span>,
      },
      {
        accessorKey: 'responsiblePerson',
        header: 'المسؤول المباشر',
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-xs text-slate-700">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>{row.original.responsiblePerson}</span>
          </div>
        ),
      },
      {
        accessorKey: 'companyCode',
        header: 'رمز الشركة',
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.companyCode}</span>,
      },
      {
        accessorKey: 'status',
        header: 'الحالة',
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'active' ? 'approved' : 'closed'}>
            {row.original.status === 'active' ? 'نشط' : 'معطل'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'إجراءات',
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" onClick={() => handleDeleteAttempt(row.original)}>
            <Trash2 className="w-4 h-4 text-red" />
          </Button>
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
          { label: t('nav_cost_centers') },
        ]}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <PieChart className="w-7 h-7 text-primary" />
            <span>{t('md_cost_centers_title')}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            دليل مراكز التكلفة التشغيلية وتحميل النفقات (SAP CO-CCA - KS01/KS03)
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 me-1.5" />
          إضافة مركز تكلفة جديد (KS01)
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="إجمالي مراكز التكلفة"
          value={formatNumber(costCenters.length)}
          icon={<PieChart className="w-6 h-6 text-primary" />}
        />
        <StatCard
          label="مراكز تكلفة نشطة"
          value={formatNumber(costCenters.filter((c) => c.status === 'active' || !c.status).length)}
          icon={<CheckCircle className="w-6 h-6 text-emerald-600" />}
        />
        <StatCard
          label="الشركات التابعة"
          value="1 (شركة الخليج للطاقة)"
          icon={<Building className="w-6 h-6 text-blue" />}
        />
      </div>

      <DataTable
        data={costCenters}
        columns={columns}
        isLoading={loading}
        searchPlaceholder="بحث برمز مركز التكلفة، الاسم، أو المسؤول..."
        exportFileName="مراكز_التكلفة_طاقة_الخليج"
      />

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="إنشاء مركز تكلفة جديد (SAP KS01)"
        size="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="رمز مركز التكلفة المعياري *"
            placeholder="مثال: CC-OPS-01"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            error={formErrors.code}
          />
          <Input
            label="اسم مركز التكلفة بالكامل *"
            placeholder="مثال: إدارة النقل والتوزيع الجنوبي"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
          />
          <Input
            label="القسم / الإدارة التابع لها"
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
          />
          <Input
            label="المسؤول المباشر عن المركز"
            placeholder="اسم المدير المسؤول"
            value={formData.responsiblePerson}
            onChange={(e) => setFormData({ ...formData, responsiblePerson: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button variant="ghost" type="button" onClick={() => setIsCreateOpen(false)}>
              إلغاء
            </Button>
            <Button variant="primary" type="submit" loading={isSubmitting}>
              حفظ مركز التكلفة
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete / Deactivate Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setBlockReason(null);
        }}
        onConfirm={handleConfirmDelete}
        title={blockReason ? 'تعطيل مركز التكلفة' : 'تأكيد الحذف'}
        message={
          blockReason
            ? `${blockReason}\n\nهل ترغب في تعطيل مركز التكلفة لمنع تحميل التكاليف عليه؟`
            : `هل أنت متأكد من حذف مركز التكلفة [${deleteTarget?.name}]؟`
        }
        confirmText={blockReason ? 'تعطيل المركز' : 'نعم، حذف'}
        cancelText="إلغاء"
        variant={blockReason ? 'warning' : 'danger'}
      />
    </div>
  );
};
