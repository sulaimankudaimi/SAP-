import React, { useEffect, useState, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  Landmark,
  Plus,
  Trash2,
  Edit,
  DollarSign,
  CheckCircle,
} from 'lucide-react';
import { db } from '../../../core/db';
import { glAccountRepository } from '../../../core/repositories';
import { MasterDataService } from '../services/MasterDataService';
import type { GLAccount } from '../../../types/models';
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
import { formatNumber, formatCurrency } from '../../../core/utils';
import { t } from '../../../i18n/ar';

export const GLAccountsListPage: React.FC = () => {
  const { showToast } = useToast();
  const user = useAuthStore((s) => s.user);

  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GLAccount | null>(null);
  const [blockReason, setBlockReason] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    accountNumber: '',
    name: '',
    category: 'Asset' as GLAccount['category'],
    currency: 'SAR',
    balance: '0',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await db.glAccounts.toArray();
      setAccounts(data.filter((a) => !a.isDeleted));
    } catch (err) {
      console.error('Failed to load GL accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!formData.accountNumber.trim()) errors.accountNumber = 'رقم الحساب مطلوب';
    if (!formData.name.trim()) errors.name = 'اسم الحساب مطلوب';

    if (formData.accountNumber.trim()) {
      const isUnique = await MasterDataService.isCodeUnique('glAccounts', 'accountNumber', formData.accountNumber.trim());
      if (!isUnique) errors.accountNumber = 'رقم الحساب مسجل مسبقاً في الدليل المحاسبي.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setIsSubmitting(true);
      const newAccount: GLAccount = {
        id: `gl-${Date.now()}`,
        accountNumber: formData.accountNumber.trim(),
        name: formData.name.trim(),
        category: formData.category,
        currency: formData.currency,
        balance: Number(formData.balance) || 0,
        status: 'active',
        isDeleted: false,
      };

      await glAccountRepository.create(newAccount, user?.id || 'admin', user?.fullName || 'مدير النظام');
      showToast({
        title: 'تم إنشاء الحساب بالأستاذ العام',
        message: `تم إضافة الحساب [${newAccount.accountNumber} - ${newAccount.name}] إلى شجرة الحسابات.`,
        type: 'success',
      });

      setIsCreateOpen(false);
      setFormData({ accountNumber: '', name: '', category: 'Asset', currency: 'SAR', balance: '0' });
      setFormErrors({});
      await loadAccounts();
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

  const handleDeleteAttempt = async (acc: GLAccount) => {
    const check = await MasterDataService.checkReferentialIntegrity('glAccounts', acc.id, acc.accountNumber);
    if (!check.canDelete) {
      setBlockReason(check.reason || 'لا يمكن حذف الحساب لوجود قيود محاسبية مسجلة عليه.');
    } else {
      setBlockReason(null);
    }
    setDeleteTarget(acc);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (blockReason) {
        await MasterDataService.toggleStatus(
          'glAccounts',
          deleteTarget.id,
          'inactive',
          user?.id || 'admin',
          user?.fullName || 'مدير النظام'
        );
        showToast({
          title: 'تم تجميد الحساب',
          message: `تم إيقاف الترحيل على الحساب [${deleteTarget.accountNumber}].`,
          type: 'info',
        });
      } else {
        await glAccountRepository.delete(deleteTarget.id, user?.id || 'admin', user?.fullName || 'مدير النظام');
        showToast({
          title: 'تم حذف الحساب',
          message: `تمت إزالة الحساب [${deleteTarget.accountNumber}].`,
          type: 'success',
        });
      }

      setDeleteTarget(null);
      setBlockReason(null);
      await loadAccounts();
    } catch (err) {
      showToast({
        title: 'فشل الإجراء',
        message: err instanceof Error ? err.message : 'حدث خطأ.',
        type: 'error',
      });
    }
  };

  const getCategoryBadge = (cat: GLAccount['category']) => {
    switch (cat) {
      case 'Asset':
        return <Badge variant="approved">أصول (Asset)</Badge>;
      case 'Liability':
        return <Badge variant="critical">خصوم (Liability)</Badge>;
      case 'Equity':
        return <Badge variant="in_review">حقوق ملكية (Equity)</Badge>;
      case 'Revenue':
        return <Badge variant="approved">إيرادات (Revenue)</Badge>;
      case 'Expense':
        return <Badge variant="in_progress">مصروفات (Expense)</Badge>;
      default:
        return <Badge variant="closed">{cat}</Badge>;
    }
  };

  const columns = useMemo<ColumnDef<GLAccount>[]>(
    () => [
      {
        accessorKey: 'accountNumber',
        header: 'رقم الحساب (GL Account)',
        cell: ({ row }) => <span className="font-mono font-bold text-navy">{row.original.accountNumber}</span>,
      },
      {
        accessorKey: 'name',
        header: 'اسم الحساب المحاسبي',
        cell: ({ row }) => <span className="font-semibold text-navy">{row.original.name}</span>,
      },
      {
        accessorKey: 'category',
        header: 'تبويب الحساب (Category)',
        cell: ({ row }) => getCategoryBadge(row.original.category),
      },
      {
        accessorKey: 'currency',
        header: 'العملة',
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.currency}</span>,
      },
      {
        accessorKey: 'balance',
        header: 'الرصيد الدفتري التقديري',
        cell: ({ row }) => (
          <span className="font-bold text-navy">
            {formatCurrency(row.original.balance || 0, row.original.currency || 'SAR')}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'الحالة',
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'active' ? 'approved' : 'closed'}>
            {row.original.status === 'active' ? 'نشط' : 'مجمد'}
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
          { label: 'دليل الحسابات' },
        ]}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <Landmark className="w-7 h-7 text-primary" />
            <span>{t('md_gl_accounts_title')}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            شجرة ودليل الحسابات العامة لدفتر الأستاذ (SAP FI General Ledger - FS00)
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 me-1.5" />
          إضافة حساب بالأستاذ (FS00)
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="إجمالي حسابات الأستاذ"
          value={formatNumber(accounts.length)}
          icon={<Landmark className="w-6 h-6 text-primary" />}
        />
        <StatCard
          label="حسابات نشطة قابلة للترحيل"
          value={formatNumber(accounts.filter((a) => a.status === 'active' || !a.status).length)}
          icon={<CheckCircle className="w-6 h-6 text-emerald-600" />}
        />
        <StatCard
          label="العملة الموحدة"
          value="SAR (ريال سعودي)"
          icon={<DollarSign className="w-6 h-6 text-blue" />}
        />
      </div>

      <DataTable
        data={accounts}
        columns={columns}
        isLoading={loading}
        searchPlaceholder="بحث برقم الحساب أو الاسم..."
        exportFileName="شجرة_الحسابات_طاقة_الخليج"
      />

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="إنشاء حساب بالأستاذ العام (SAP FS00)"
        size="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="رقم الحساب المعياري (Account Number) *"
            placeholder="مثال: 120150"
            value={formData.accountNumber}
            onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
            error={formErrors.accountNumber}
          />
          <Input
            label="اسم الحساب بالكامل *"
            placeholder="مثال: مخزون مشتقات وقود المحطات"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="تبويب الحساب المحاسبي *"
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value as GLAccount['category'] })
              }
              options={[
                { value: 'Asset', label: 'أصول (Assets)' },
                { value: 'Liability', label: 'خصوم والتزامات (Liabilities)' },
                { value: 'Equity', label: 'حقوق الملكية (Equity)' },
                { value: 'Revenue', label: 'إيرادات تشغيلية (Revenues)' },
                { value: 'Expense', label: 'مصروفات وتكاليف (Expenses)' },
              ]}
            />
            <Input
              label="العملة"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button variant="ghost" type="button" onClick={() => setIsCreateOpen(false)}>
              إلغاء
            </Button>
            <Button variant="primary" type="submit" loading={isSubmitting}>
              حفظ الحساب
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
        title={blockReason ? 'تجميد الحساب المحاسبي' : 'تأكيد الحذف'}
        message={
          blockReason
            ? `${blockReason}\n\nهل ترغب في تجميد الحساب لمنع الترحيلات الجديدة عليه؟`
            : `هل أنت متأكد من حذف الحساب [${deleteTarget?.name}]؟`
        }
        confirmText={blockReason ? 'تجميد الحساب' : 'نعم، حذف'}
        cancelText="إلغاء"
        variant={blockReason ? 'warning' : 'danger'}
      />
    </div>
  );
};
