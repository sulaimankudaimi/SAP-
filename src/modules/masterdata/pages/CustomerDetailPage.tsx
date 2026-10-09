import { DiagnosticLogger } from '../../../core/services/DiagnosticLogger';
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users2,
  Building,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Edit,
  Save,
  X,
  Paperclip,
  History,
  ShieldCheck,
} from 'lucide-react';
import { customerRepository } from '../../../core/repositories';
import { MasterDataService } from '../services/MasterDataService';
import type { Customer } from '../../../types/models';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs';
import { Card } from '../../../components/ui/Card';
import { Tabs, TabItem } from '../../../components/ui/Tabs';
import { Input } from '../../../components/ui/Input';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useToast } from '../../../components/ui/Toast';
import { useAuthStore } from '../../../core/auth/useAuthStore';
import { formatCurrency } from '../../../core/utils';
import { AttachmentManager } from '../components/AttachmentManager';
import { AuditHistoryTab } from '../components/AuditHistoryTab';
import { t } from '../../../i18n/ar';

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const user = useAuthStore((s) => s.user);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');

  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Customer>>({});
  const [isSaving, setIsSaving] = useState(false);

  const loadCustomer = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const cust = await customerRepository.getById(id);
      if (!cust || cust.isDeleted) {
        setCustomer(null);
        return;
      }
      setCustomer(cust);
      setEditForm(cust);
    } catch (err) {
      DiagnosticLogger.error('CustomerDetailPage', 'Failed to load customer:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomer();
  }, [id]);

  const handleSaveEdit = async () => {
    if (!customer || !id) return;
    try {
      setIsSaving(true);
      await customerRepository.update(id, editForm, user?.id || 'admin', user?.fullName || 'مدير النظام');

      showToast({
        title: 'تم تحديث بيانات العميل',
        message: 'تم حفظ التعديلات بنجاح في قاعدة البيانات وتوثيقها.',
        type: 'success',
      });

      setIsEditing(false);
      await loadCustomer();
    } catch (err) {
      showToast({
        title: 'فشل التعديل',
        message: err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ التعديلات.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="rectangular" height={40} />
        <Skeleton variant="rectangular" height={140} />
        <Skeleton variant="rectangular" height={300} />
      </div>
    );
  }

  if (!customer) {
    return (
      <EmptyState
        icon={<Users2 className="w-16 h-16 text-slate-300" />}
        title="ملف العميل غير موجود"
        description="لم يتم العثور على العميل المطلوب."
        action={
          <Button variant="primary" onClick={() => navigate('/master-data/customers')}>
            العودة لقائمة العملاء
          </Button>
        }
      />
    );
  }

  const tabs: TabItem[] = [
    { id: 'general', label: t('md_tab_general') },
    { id: 'contact', label: t('md_tab_contact') },
    { id: 'attachments', label: t('md_tab_attachments') },
    { id: 'audit', label: t('md_tab_audit') },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: t('nav_home'), path: '/' },
          { label: t('nav_master_data'), path: '/master-data' },
          { label: t('nav_md_customers'), path: '/master-data/customers' },
          { label: `${customer.customerCode} - ${customer.name}` },
        ]}
      />

      <Card className="p-5 border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-sm">
              <Users2 className="w-8 h-8" />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-base font-bold text-navy bg-slate-100 px-2.5 py-0.5 rounded">
                  {customer.customerCode}
                </span>
                <Badge variant={customer.status === 'active' ? 'approved' : 'closed'}>
                  {customer.status === 'active' ? 'نشط' : 'معطل'}
                </Badge>
              </div>
              <h1 className="text-2xl font-bold text-navy">{customer.name}</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                الرقم الضريبي: {customer.taxNumber} • المدينة: {customer.city}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                  <X className="w-4 h-4 me-1" />
                  إلغاء
                </Button>
                <Button variant="primary" size="sm" loading={isSaving} onClick={handleSaveEdit}>
                  <Save className="w-4 h-4 me-1.5" />
                  حفظ التعديلات
                </Button>
              </>
            ) : (
              <Button variant="primary" size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="w-4 h-4 me-1.5" />
                تعديل البيانات
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'general' && (
        <Card className="p-5 border border-slate-200 space-y-4">
          <h3 className="text-base font-bold text-navy mb-4 pb-2 border-b border-slate-100">
            البيانات التجارية والائتمانية (Commercial & Credit)
          </h3>

          {isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="اسم العميل *"
                value={editForm.name || ''}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
              <Input
                label="الرقم الضريبي *"
                value={editForm.taxNumber || ''}
                onChange={(e) => setEditForm({ ...editForm, taxNumber: e.target.value })}
              />
              <Input
                type="number"
                label="الحد الائتماني (ريال)"
                value={editForm.creditLimit || ''}
                onChange={(e) => setEditForm({ ...editForm, creditLimit: Number(e.target.value) })}
              />
              <Input
                label="شروط الدفع"
                value={editForm.paymentTerms || ''}
                onChange={(e) => setEditForm({ ...editForm, paymentTerms: e.target.value })}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">رمز العميل</span>
                <span className="font-mono text-sm font-bold text-navy">{customer.customerCode}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">الرقم الضريبي</span>
                <span className="font-mono text-sm font-semibold text-navy">{customer.taxNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">سقف الائتمان المعتمد</span>
                <span className="text-sm font-bold text-emerald-700">
                  {formatCurrency(customer.creditLimit, 'SAR')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">شروط السداد</span>
                <span className="font-semibold text-navy">{customer.paymentTerms || 'آجل 30 يوماً'}</span>
              </div>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'contact' && (
        <Card className="p-5 border border-slate-200 space-y-4">
          <h3 className="text-base font-bold text-navy mb-4 pb-2 border-b border-slate-100">
            بيانات الاتصال والموقع
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block mb-1">المدينة</span>
              <span className="font-semibold text-navy">{customer.city || 'الرياض'}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block mb-1">رقم الهاتف</span>
              <span className="font-mono font-semibold text-navy">{customer.phone || '011-5829100'}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block mb-1">البريد الإلكتروني</span>
              <span className="font-mono font-semibold text-navy">{customer.email || 'info@customer.sa'}</span>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'attachments' && (
        <AttachmentManager entityType="customer" entityId={customer.id} />
      )}

      {activeTab === 'audit' && (
        <AuditHistoryTab entity="customers" entityId={customer.id} />
      )}
    </div>
  );
};
