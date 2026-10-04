import React, { useEffect, useState, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  FolderTree,
  Plus,
  Trash2,
  Boxes,
  CheckCircle,
} from 'lucide-react';
import { db } from '../../../core/db';
import { materialGroupRepository } from '../../../core/repositories';
import { MasterDataService } from '../services/MasterDataService';
import type { MaterialGroup } from '../../../types/models';
import { DataTable } from '../../../components/ui/DataTable';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs';
import { StatCard } from '../../../components/ui/StatCard';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useToast } from '../../../components/ui/Toast';
import { useAuthStore } from '../../../core/auth/useAuthStore';
import { formatNumber } from '../../../core/utils';
import { t } from '../../../i18n/ar';

export const MaterialGroupsListPage: React.FC = () => {
  const { showToast } = useToast();
  const user = useAuthStore((s) => s.user);

  const [groups, setGroups] = useState<MaterialGroup[]>([]);
  const [materialsCountByGroup, setMaterialsCountByGroup] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MaterialGroup | null>(null);
  const [blockReason, setBlockReason] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [grps, mats] = await Promise.all([
        db.materialGroups.toArray(),
        db.materials.toArray(),
      ]);

      setGroups(grps.filter((g) => !g.isDeleted));

      const counts: Record<string, number> = {};
      mats.forEach((m) => {
        if (!m.isDeleted && m.groupCode) {
          counts[m.groupCode] = (counts[m.groupCode] || 0) + 1;
        }
      });
      setMaterialsCountByGroup(counts);
    } catch (err) {
      console.error('Failed to load material groups:', err);
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

    if (!formData.code.trim()) errors.code = 'رمز المجموعة مطلوب';
    if (!formData.name.trim()) errors.name = 'اسم المجموعة مطلوب';

    if (formData.code.trim()) {
      const isUnique = await MasterDataService.isCodeUnique('materialGroups', 'code', formData.code.trim());
      if (!isUnique) errors.code = 'رمز المجموعة مسجل مسبقاً.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setIsSubmitting(true);
      const newGroup: MaterialGroup = {
        id: `mg-${Date.now()}`,
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        description: formData.description.trim(),
        status: 'active',
        isDeleted: false,
      };

      await materialGroupRepository.create(newGroup, user?.id || 'admin', user?.fullName || 'مدير النظام');
      showToast({
        title: 'تم إنشاء مجموعة المواد',
        message: `تم إضافة المجموعة [${newGroup.name}] إلى تصنيفات المواد.`,
        type: 'success',
      });

      setIsCreateOpen(false);
      setFormData({ code: '', name: '', description: '' });
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

  const handleDeleteAttempt = async (grp: MaterialGroup) => {
    const check = await MasterDataService.checkReferentialIntegrity('materialGroups', grp.id, grp.code);
    if (!check.canDelete) {
      setBlockReason(check.reason || 'المجموعة تحتوي على أصناف مسجلة تابعة لها.');
    } else {
      setBlockReason(null);
    }
    setDeleteTarget(grp);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (blockReason) {
        showToast({
          title: 'تعذر الحذف',
          message: blockReason,
          type: 'error',
        });
      } else {
        await materialGroupRepository.delete(deleteTarget.id, user?.id || 'admin', user?.fullName || 'مدير النظام');
        showToast({
          title: 'تم الحذف',
          message: `تم حذف المجموعة [${deleteTarget.code}].`,
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

  const columns = useMemo<ColumnDef<MaterialGroup>[]>(
    () => [
      {
        accessorKey: 'code',
        header: 'رمز المجموعة (Group Code)',
        cell: ({ row }) => <span className="font-mono font-bold text-navy">{row.original.code}</span>,
      },
      {
        accessorKey: 'name',
        header: 'اسم مجموعة المواد والتصنيف',
        cell: ({ row }) => (
          <div>
            <div className="font-semibold text-navy">{row.original.name}</div>
            {row.original.description && (
              <div className="text-xs text-slate-500">{row.original.description}</div>
            )}
          </div>
        ),
      },
      {
        id: 'itemsCount',
        header: 'الأصناف التابعة',
        cell: ({ row }) => {
          const count = materialsCountByGroup[row.original.code] || 0;
          return (
            <Badge variant={count > 0 ? 'approved' : 'closed'} className="gap-1">
              <Boxes className="w-3.5 h-3.5" />
              <span>{count} صنف</span>
            </Badge>
          );
        },
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
    [materialsCountByGroup]
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: t('nav_home'), path: '/' },
          { label: t('nav_master_data'), path: '/master-data' },
          { label: 'مجموعات المواد' },
        ]}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <FolderTree className="w-7 h-7 text-primary" />
            <span>{t('md_groups_title')}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            تصنيفات ومجموعات المواد الاستراتيجية والتشغيلية (Material Groups)
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 me-1.5" />
          إضافة مجموعة جديدة
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="إجمالي مجموعات المواد"
          value={formatNumber(groups.length)}
          icon={<FolderTree className="w-6 h-6 text-primary" />}
        />
        <StatCard
          label="مجموعات نشطة قيد الاستخدام"
          value={formatNumber(groups.length)}
          icon={<CheckCircle className="w-6 h-6 text-emerald-600" />}
        />
      </div>

      <DataTable
        data={groups}
        columns={columns}
        isLoading={loading}
        searchPlaceholder="بحث برمز المجموعة أو الاسم..."
        exportFileName="مجموعات_المواد_طاقة_الخليج"
      />

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="إضافة مجموعة مواد جديدة"
        size="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="رمز المجموعة المعياري *"
            placeholder="مثال: GRP-CHEM"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            error={formErrors.code}
          />
          <Input
            label="اسم المجموعة بالكامل *"
            placeholder="مثال: كيماويات معالجة الوقود والمضافات"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
          />
          <Textarea
            label="الوصف والتصنيف"
            placeholder="وصف تفصيلي لأصناف هذه المجموعة..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button variant="ghost" type="button" onClick={() => setIsCreateOpen(false)}>
              إلغاء
            </Button>
            <Button variant="primary" type="submit" loading={isSubmitting}>
              حفظ المجموعة
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setBlockReason(null);
        }}
        onConfirm={handleConfirmDelete}
        title={blockReason ? 'تعذر حذف المجموعة' : 'تأكيد الحذف'}
        message={
          blockReason
            ? blockReason
            : `هل أنت متأكد من حذف المجموعة [${deleteTarget?.name}]؟`
        }
        confirmText={blockReason ? 'حسناً' : 'نعم، حذف'}
        cancelText="إلغاء"
        variant={blockReason ? 'warning' : 'danger'}
      />
    </div>
  );
};
