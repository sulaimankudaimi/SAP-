import { DiagnosticLogger } from '../../../core/services/DiagnosticLogger';
import React, { useEffect, useState, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  Ruler,
  Plus,
  Trash2,
  Boxes,
  CheckCircle,
} from 'lucide-react';
import { db } from '../../../core/db';
import { unitRepository } from '../../../core/repositories';
import { MasterDataService } from '../services/MasterDataService';
import type { UnitOfMeasure } from '../../../types/models';
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

export const UnitsListPage: React.FC = () => {
  const { showToast } = useToast();
  const user = useAuthStore((s) => s.user);

  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [materialsCountByUnit, setMaterialsCountByUnit] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UnitOfMeasure | null>(null);
  const [blockReason, setBlockReason] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    symbol: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [uns, mats] = await Promise.all([
        db.units.toArray(),
        db.materials.toArray(),
      ]);

      setUnits(uns.filter((u) => !u.isDeleted));

      const counts: Record<string, number> = {};
      mats.forEach((m) => {
        if (!m.isDeleted && m.baseUnit) {
          counts[m.baseUnit] = (counts[m.baseUnit] || 0) + 1;
        }
      });
      setMaterialsCountByUnit(counts);
    } catch (err) {
      DiagnosticLogger.error('UnitsListPage', 'Failed to load units:', err);
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

    if (!formData.code.trim()) errors.code = 'رمز الوحدة مطلوب';
    if (!formData.name.trim()) errors.name = 'اسم الوحدة مطلوب';

    if (formData.code.trim()) {
      const isUnique = await MasterDataService.isCodeUnique('units', 'code', formData.code.trim());
      if (!isUnique) errors.code = 'رمز الوحدة مسجل مسبقاً.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setIsSubmitting(true);
      const newUnit: UnitOfMeasure = {
        id: `unit-${Date.now()}`,
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        symbol: formData.symbol.trim() || formData.code.trim(),
        isDeleted: false,
      };

      await unitRepository.create(newUnit, user?.id || 'admin', user?.fullName || 'مدير النظام');
      showToast({
        title: 'تم إنشاء وحدة القياس',
        message: `تم إضافة الوحدة [${newUnit.name}] لدليل القياس المعياري.`,
        type: 'success',
      });

      setIsCreateOpen(false);
      setFormData({ code: '', name: '', symbol: '' });
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

  const handleDeleteAttempt = async (unit: UnitOfMeasure) => {
    const check = await MasterDataService.checkReferentialIntegrity('units', unit.id, unit.code);
    if (!check.canDelete) {
      setBlockReason(check.reason || 'الوحدة مستخدمة كوحدة قياس أساسية لعدد من الأصناف.');
    } else {
      setBlockReason(null);
    }
    setDeleteTarget(unit);
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
        await unitRepository.delete(deleteTarget.id, user?.id || 'admin', user?.fullName || 'مدير النظام');
        showToast({
          title: 'تم الحذف',
          message: `تم حذف الوحدة [${deleteTarget.code}].`,
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

  const columns = useMemo<ColumnDef<UnitOfMeasure>[]>(
    () => [
      {
        accessorKey: 'code',
        header: 'رمز الوحدة (ISO Code)',
        cell: ({ row }) => <span className="font-mono font-bold text-navy">{row.original.code}</span>,
      },
      {
        accessorKey: 'name',
        header: 'اسم وحدة القياس',
        cell: ({ row }) => <span className="font-semibold text-navy">{row.original.name}</span>,
      },
      {
        accessorKey: 'symbol',
        header: 'الرمز المختصر (Symbol)',
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.symbol || row.original.code}</span>,
      },
      {
        id: 'itemsCount',
        header: 'الأصناف المرتبطة',
        cell: ({ row }) => {
          const count = materialsCountByUnit[row.original.code] || 0;
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
    [materialsCountByUnit]
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: t('nav_home'), path: '/' },
          { label: t('nav_master_data'), path: '/master-data' },
          { label: 'وحدات القياس' },
        ]}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <Ruler className="w-7 h-7 text-primary" />
            <span>{t('md_units_title')}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            دليل وحدات القياس المعيارية لأنشطة الطاقة واللوجستيات (SAP CUNI)
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 me-1.5" />
          إضافة وحدة قياس جديدة
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="إجمالي وحدات القياس"
          value={formatNumber(units.length)}
          icon={<Ruler className="w-6 h-6 text-primary" />}
        />
        <StatCard
          label="وحدات قياس معتمدة"
          value={formatNumber(units.length)}
          icon={<CheckCircle className="w-6 h-6 text-emerald-600" />}
        />
      </div>

      <DataTable
        data={units}
        columns={columns}
        isLoading={loading}
        searchPlaceholder="بحث برمز الوحدة أو الاسم..."
        exportFileName="وحدات_القياس_طاقة_الخليج"
      />

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="إضافة وحدة قياس معيارية (CUNI)"
        size="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="رمز الوحدة المعياري (ISO Code) *"
            placeholder="مثال: BARREL"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            error={formErrors.code}
          />
          <Input
            label="اسم وحدة القياس بالكامل *"
            placeholder="مثال: برميل نفط قياسي"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
          />
          <Input
            label="الرمز المختصر / الرمز الرياضي"
            placeholder="مثال: bbl"
            value={formData.symbol}
            onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button variant="ghost" type="button" onClick={() => setIsCreateOpen(false)}>
              إلغاء
            </Button>
            <Button variant="primary" type="submit" loading={isSubmitting}>
              حفظ الوحدة
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
        title={blockReason ? 'تعذر حذف الوحدة' : 'تأكيد الحذف'}
        message={
          blockReason
            ? blockReason
            : `هل أنت متأكد من حذف الوحدة [${deleteTarget?.name}]؟`
        }
        confirmText={blockReason ? 'حسناً' : 'نعم، حذف'}
        cancelText="إلغاء"
        variant={blockReason ? 'warning' : 'danger'}
      />
    </div>
  );
};
