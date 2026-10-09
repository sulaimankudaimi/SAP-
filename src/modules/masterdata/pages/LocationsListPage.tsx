import { DiagnosticLogger } from '../../../core/services/DiagnosticLogger';
import React, { useEffect, useState, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  MapPin,
  Warehouse,
  Plus,
  Trash2,
  Edit,
  Building,
  Layers,
  CheckCircle,
} from 'lucide-react';
import { db } from '../../../core/db';
import { plantRepository, storageLocationRepository } from '../../../core/repositories';
import { MasterDataService } from '../services/MasterDataService';
import type { Plant, StorageLocation } from '../../../types/models';
import { DataTable } from '../../../components/ui/DataTable';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs';
import { StatCard } from '../../../components/ui/StatCard';
import { Tabs, TabItem } from '../../../components/ui/Tabs';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useToast } from '../../../components/ui/Toast';
import { useAuthStore } from '../../../core/auth/useAuthStore';
import { formatNumber } from '../../../core/utils';
import { t } from '../../../i18n/ar';

export const LocationsListPage: React.FC = () => {
  const { showToast } = useToast();
  const user = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState('plants');
  const [plants, setPlants] = useState<Plant[]>([]);
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isPlantModalOpen, setIsPlantModalOpen] = useState(false);
  const [isSlocModalOpen, setIsSlocModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ entity: 'plants' | 'storageLocations'; id: string; code: string; name: string } | null>(null);
  const [blockReason, setBlockReason] = useState<string | null>(null);

  // Forms
  const [plantForm, setPlantForm] = useState({
    code: '',
    name: '',
    companyCode: '1000',
    city: 'الرياض',
    manager: '',
  });
  const [slocForm, setSlocForm] = useState({
    code: '',
    name: '',
    plantCode: 'PL01',
    type: 'خزانات وقود رئيسية',
    capacity: '500,000 لتر',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pls, sls] = await Promise.all([
        db.plants.toArray(),
        db.storageLocations.toArray(),
      ]);
      setPlants(pls.filter((p) => !p.isDeleted));
      setStorageLocations(sls.filter((s) => !s.isDeleted));
    } catch (err) {
      DiagnosticLogger.error('LocationsListPage', 'Failed to load locations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePlantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!plantForm.code.trim()) errors.code = 'رمز المحطة مطلوب';
    if (!plantForm.name.trim()) errors.name = 'اسم المحطة مطلوب';

    if (plantForm.code.trim()) {
      const isUnique = await MasterDataService.isCodeUnique('plants', 'code', plantForm.code.trim());
      if (!isUnique) errors.code = 'رمز المحطة مسجل مسبقاً.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setIsSubmitting(true);
      const newPlant: Plant = {
        id: `plant-${Date.now()}`,
        code: plantForm.code.trim().toUpperCase(),
        name: plantForm.name.trim(),
        companyCode: plantForm.companyCode,
        city: plantForm.city,
        manager: plantForm.manager,
        status: 'active',
        isDeleted: false,
      };

      await plantRepository.create(newPlant, user?.id || 'admin', user?.fullName || 'مدير النظام');
      showToast({
        title: 'تم إنشاء المحطة بنجاح',
        message: `تم تسجيل المحطة [${newPlant.name}] في الهيكل التنظيمي للمنشأة.`,
        type: 'success',
      });

      setIsPlantModalOpen(false);
      setPlantForm({ code: '', name: '', companyCode: '1000', city: 'الرياض', manager: '' });
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

  const handleSlocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!slocForm.code.trim()) errors.code = 'رمز المستودع مطلوب';
    if (!slocForm.name.trim()) errors.name = 'اسم المستودع مطلوب';

    if (slocForm.code.trim()) {
      const isUnique = await MasterDataService.isCodeUnique('storageLocations', 'code', slocForm.code.trim());
      if (!isUnique) errors.code = 'رمز المستودع مسجل مسبقاً.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setIsSubmitting(true);
      const newSloc: StorageLocation = {
        id: `sloc-${Date.now()}`,
        code: slocForm.code.trim().toUpperCase(),
        name: slocForm.name.trim(),
        plantCode: slocForm.plantCode,
        type: slocForm.type,
        capacity: slocForm.capacity,
        status: 'active',
        isDeleted: false,
      };

      await storageLocationRepository.create(newSloc, user?.id || 'admin', user?.fullName || 'مدير النظام');
      showToast({
        title: 'تم إنشاء المستودع بنجاح',
        message: `تم تسجيل مستودع التخزين [${newSloc.name}] تحت المحطة [${newSloc.plantCode}].`,
        type: 'success',
      });

      setIsSlocModalOpen(false);
      setSlocForm({ code: '', name: '', plantCode: 'PL01', type: 'خزانات وقود رئيسية', capacity: '500,000 لتر' });
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

  const handleDeleteAttempt = async (entity: 'plants' | 'storageLocations', id: string, code: string, name: string) => {
    const check = await MasterDataService.checkReferentialIntegrity(entity, id, code);
    if (!check.canDelete) {
      setBlockReason(check.reason || 'لا يمكن الحذف لوجود مستودعات أو أرصدة مخزنية نشطة.');
    } else {
      setBlockReason(null);
    }
    setDeleteTarget({ entity, id, code, name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (blockReason) {
        await MasterDataService.toggleStatus(
          deleteTarget.entity,
          deleteTarget.id,
          'inactive',
          user?.id || 'admin',
          user?.fullName || 'مدير النظام'
        );
        showToast({
          title: 'تم تعطيل الموقع',
          message: `تم تعطيل الموقع [${deleteTarget.code}] لمنع حركات الإدخال الجديدة.`,
          type: 'info',
        });
      } else {
        const repo = deleteTarget.entity === 'plants' ? plantRepository : storageLocationRepository;
        await repo.delete(deleteTarget.id, user?.id || 'admin', user?.fullName || 'مدير النظام');
        showToast({
          title: 'تم الحذف بنجاح',
          message: `تم حذف السجل [${deleteTarget.code}].`,
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

  const plantColumns = useMemo<ColumnDef<Plant>[]>(
    () => [
      {
        accessorKey: 'code',
        header: 'رمز المحطة (Plant)',
        cell: ({ row }) => <span className="font-mono font-bold text-navy">{row.original.code}</span>,
      },
      {
        accessorKey: 'name',
        header: 'اسم المحطة والمجمع',
        cell: ({ row }) => <span className="font-semibold text-navy">{row.original.name}</span>,
      },
      {
        accessorKey: 'city',
        header: 'المدينة',
        cell: ({ row }) => <span>{row.original.city}</span>,
      },
      {
        accessorKey: 'companyCode',
        header: 'رمز الشركة (Company)',
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.companyCode}</span>,
      },
      {
        id: 'slocsCount',
        header: 'المستودعات التابعة',
        cell: ({ row }) => {
          const count = storageLocations.filter((s) => s.plantCode === row.original.code).length;
          return <Badge variant="in_progress">{count} مستودعات</Badge>;
        },
      },
      {
        accessorKey: 'status',
        header: 'الحالة',
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'active' ? 'approved' : 'closed'}>
            {row.original.status === 'active' ? 'نشطة' : 'معطلة'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'إجراءات',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteAttempt('plants', row.original.id, row.original.code, row.original.name)}
          >
            <Trash2 className="w-4 h-4 text-red" />
          </Button>
        ),
      },
    ],
    [storageLocations]
  );

  const slocColumns = useMemo<ColumnDef<StorageLocation>[]>(
    () => [
      {
        accessorKey: 'code',
        header: 'رمز المستودع (SLoc)',
        cell: ({ row }) => <span className="font-mono font-bold text-navy">{row.original.code}</span>,
      },
      {
        accessorKey: 'name',
        header: 'اسم المستودع / الخزان',
        cell: ({ row }) => <span className="font-semibold text-navy">{row.original.name}</span>,
      },
      {
        accessorKey: 'plantCode',
        header: 'المحطة التابع لها',
        cell: ({ row }) => <span className="font-mono font-semibold text-primary">{row.original.plantCode}</span>,
      },
      {
        accessorKey: 'type',
        header: 'نوع المستودع',
        cell: ({ row }) => <span className="text-xs">{row.original.type}</span>,
      },
      {
        accessorKey: 'capacity',
        header: 'السعة الاستيعابية',
        cell: ({ row }) => <span className="text-xs text-slate-600">{row.original.capacity || '—'}</span>,
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteAttempt('storageLocations', row.original.id, row.original.code, row.original.name)}
          >
            <Trash2 className="w-4 h-4 text-red" />
          </Button>
        ),
      },
    ],
    []
  );

  const tabs: TabItem[] = [
    { id: 'plants', label: t('md_tab_plants'), count: plants.length },
    { id: 'slocs', label: t('md_tab_slocs'), count: storageLocations.length },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: t('nav_home'), path: '/' },
          { label: t('nav_master_data'), path: '/master-data' },
          { label: t('nav_md_locations') },
        ]}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <Warehouse className="w-7 h-7 text-primary" />
            <span>{t('md_locations_title')}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            الهيكل التنظيمي لمواقع التشغيل: المحطات (Plants) ومستودعات التخزين (Storage Locations)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'plants' ? (
            <Button variant="primary" size="sm" onClick={() => setIsPlantModalOpen(true)}>
              <Plus className="w-4 h-4 me-1.5" />
              إضافة محطة جديدة (Plant)
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setIsSlocModalOpen(true)}>
              <Plus className="w-4 h-4 me-1.5" />
              إضافة مستودع تخزين (SLoc)
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="إجمالي المحطات التشغيلية"
          value={formatNumber(plants.length)}
          icon={<Building className="w-6 h-6 text-primary" />}
        />
        <StatCard
          label="إجمالي مستودعات التخزين والخزانات"
          value={formatNumber(storageLocations.length)}
          icon={<Warehouse className="w-6 h-6 text-blue" />}
        />
        <StatCard
          label="المواقع النشطة الجاهزة للاستلام"
          value={formatNumber(plants.filter((p) => p.status === 'active' || !p.status).length)}
          icon={<CheckCircle className="w-6 h-6 text-emerald-600" />}
        />
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'plants' ? (
        <DataTable
          data={plants}
          columns={plantColumns}
          isLoading={loading}
          searchPlaceholder="بحث في المحطات..."
          exportFileName="المحطات_الرئيسية_طاقة_الخليج"
        />
      ) : (
        <DataTable
          data={storageLocations}
          columns={slocColumns}
          isLoading={loading}
          searchPlaceholder="بحث في مستودعات التخزين والخزانات..."
          exportFileName="مستودعات_التخزين_طاقة_الخليج"
        />
      )}

      {/* Create Plant Modal */}
      <Modal
        isOpen={isPlantModalOpen}
        onClose={() => setIsPlantModalOpen(false)}
        title="إضافة محطة تشغيل رئيسية جديدة (Plant)"
        size="md"
      >
        <form onSubmit={handlePlantSubmit} className="space-y-4">
          <Input
            label="رمز المحطة المعياري (Plant Code) *"
            placeholder="مثال: PL06"
            value={plantForm.code}
            onChange={(e) => setPlantForm({ ...plantForm, code: e.target.value })}
            error={formErrors.code}
          />
          <Input
            label="اسم المحطة بالكامل *"
            placeholder="مثال: محطة توزيع ينبع اللوجستية"
            value={plantForm.name}
            onChange={(e) => setPlantForm({ ...plantForm, name: e.target.value })}
            error={formErrors.name}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="المدينة"
              value={plantForm.city}
              onChange={(e) => setPlantForm({ ...plantForm, city: e.target.value })}
            />
            <Input
              label="مدير المحطة المسؤول"
              value={plantForm.manager}
              onChange={(e) => setPlantForm({ ...plantForm, manager: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button variant="ghost" type="button" onClick={() => setIsPlantModalOpen(false)}>
              إلغاء
            </Button>
            <Button variant="primary" type="submit" loading={isSubmitting}>
              حفظ المحطة
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create SLoc Modal */}
      <Modal
        isOpen={isSlocModalOpen}
        onClose={() => setIsSlocModalOpen(false)}
        title="إضافة مستودع تخزين (Storage Location)"
        size="md"
      >
        <form onSubmit={handleSlocSubmit} className="space-y-4">
          <Input
            label="رمز المستودع (SLoc Code) *"
            placeholder="مثال: SL09"
            value={slocForm.code}
            onChange={(e) => setSlocForm({ ...slocForm, code: e.target.value })}
            error={formErrors.code}
          />
          <Input
            label="اسم المستودع أو الخزان *"
            placeholder="مثال: خزان وقود الديزل الاستراتيجي رقم 4"
            value={slocForm.name}
            onChange={(e) => setSlocForm({ ...slocForm, name: e.target.value })}
            error={formErrors.name}
          />
          <Select
            label="المحطة التابع لها *"
            value={slocForm.plantCode}
            onChange={(e) => setSlocForm({ ...slocForm, plantCode: e.target.value })}
            options={plants.map((p) => ({ value: p.code, label: `${p.name} (${p.code})` }))}
          />
          <Input
            label="السعة الاستيعابية التقديرية"
            value={slocForm.capacity}
            onChange={(e) => setSlocForm({ ...slocForm, capacity: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button variant="ghost" type="button" onClick={() => setIsSlocModalOpen(false)}>
              إلغاء
            </Button>
            <Button variant="primary" type="submit" loading={isSubmitting}>
              حفظ المستودع
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete / Deactivate Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setBlockReason(null);
        }}
        onConfirm={handleConfirmDelete}
        title={blockReason ? 'تعطيل الموقع' : 'تأكيد الحذف'}
        message={
          blockReason
            ? `${blockReason}\n\nهل ترغب في تعطيل الموقع لمنع حركات الإدخال المستقبلية؟`
            : `هل أنت متأكد من حذف [${deleteTarget?.name}]؟`
        }
        confirmText={blockReason ? 'تعطيل الموقع' : 'نعم، حذف'}
        cancelText="إلغاء"
        variant={blockReason ? 'warning' : 'danger'}
      />
    </div>
  );
};
