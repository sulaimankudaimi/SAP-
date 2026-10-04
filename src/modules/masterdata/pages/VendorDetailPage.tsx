import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  Landmark,
  Star,
  FileCheck,
  AlertTriangle,
  ShoppingCart,
  Paperclip,
  History,
  Edit,
  Save,
  X,
  CreditCard,
  Calendar,
  Clock,
  ShieldCheck,
  Receipt,
} from 'lucide-react';
import { db } from '../../../core/db';
import { vendorRepository } from '../../../core/repositories';
import { MasterDataService } from '../services/MasterDataService';
import type { Vendor, PurchaseOrder, VendorInvoice } from '../../../types/models';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs';
import { Card } from '../../../components/ui/Card';
import { StatCard } from '../../../components/ui/StatCard';
import { Tabs, TabItem } from '../../../components/ui/Tabs';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useToast } from '../../../components/ui/Toast';
import { useAuthStore } from '../../../core/auth/useAuthStore';
import { formatCurrency, formatNumber, formatDate } from '../../../core/utils';
import { AttachmentManager } from '../components/AttachmentManager';
import { AuditHistoryTab } from '../components/AuditHistoryTab';
import { t } from '../../../i18n/ar';

export const VendorDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const user = useAuthStore((s) => s.user);

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');

  // Purchases History
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [invoices, setInvoices] = useState<VendorInvoice[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);

  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Vendor>>({});
  const [isSaving, setIsSaving] = useState(false);

  const loadVendor = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const ven = await vendorRepository.getById(id);
      if (!ven || ven.isDeleted) {
        setVendor(null);
        return;
      }

      setVendor(ven);
      setEditForm(ven);

      const purchases = await MasterDataService.getVendorPurchases(ven.vendorCode);
      setPos(purchases.pos);
      setInvoices(purchases.invoices);
      setTotalSpent(purchases.totalAmount);
    } catch (err) {
      console.error('Failed to load vendor:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendor();
  }, [id]);

  const handleSaveEdit = async () => {
    if (!vendor || !id) return;
    try {
      setIsSaving(true);
      await vendorRepository.update(id, editForm, user?.id || 'admin', user?.fullName || 'مدير النظام');

      showToast({
        title: 'تم تحديث ملف المورد',
        message: 'تم حفظ كافة التعديلات وتسجيلها في سجل التدقيق.',
        type: 'success',
      });

      setIsEditing(false);
      await loadVendor();
    } catch (err) {
      showToast({
        title: 'فشل الحفظ',
        message: err instanceof Error ? err.message : 'حدث خطأ أثناء تعديل بيانات المورد.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!vendor) return;
    const newStatus = vendor.status === 'active' ? 'inactive' : 'active';
    try {
      await MasterDataService.toggleStatus(
        'vendors',
        vendor.id,
        newStatus,
        user?.id || 'admin',
        user?.fullName || 'مدير النظام'
      );
      showToast({
        title: newStatus === 'active' ? 'تم تنشيط المورد' : 'تم تعطيل المورد',
        message: `تم تحديث حالة المورد إلى [${newStatus === 'active' ? 'نشط' : 'معطل'}].`,
        type: 'info',
      });
      await loadVendor();
    } catch (err) {
      showToast({
        title: 'فشل تغيير الحالة',
        message: err instanceof Error ? err.message : 'تعذر تغيير حالة المورد.',
        type: 'error',
      });
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

  if (!vendor) {
    return (
      <EmptyState
        icon={<Building2 className="w-16 h-16 text-slate-300" />}
        title="ملف المورد غير موجود"
        description="تعذر العثور على سجل المورد المطلوب في قاعدة البيانات."
        action={
          <Button variant="primary" onClick={() => navigate('/master-data/vendors')}>
            العودة إلى دليل الموردين
          </Button>
        }
      />
    );
  }

  // Compliance calculations
  const now = new Date();
  const crDate = vendor.crExpiryDate ? new Date(vendor.crExpiryDate) : null;
  const daysUntilCrExpiry = crDate ? Math.ceil((crDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 999;
  const isCrExpired = daysUntilCrExpiry <= 0;
  const isCrExpiringSoon = daysUntilCrExpiry > 0 && daysUntilCrExpiry <= 30;

  // Rating scores
  const ratingData = MasterDataService.computeVendorRating(vendor);

  const tabs: TabItem[] = [
    { id: 'general', label: t('md_tab_general') },
    { id: 'contact', label: t('md_tab_contact') },
    { id: 'banking', label: t('md_tab_banking') },
    { id: 'rating', label: t('md_tab_rating') },
    { id: 'compliance', label: t('md_tab_compliance'), count: isCrExpiringSoon || isCrExpired ? 1 : undefined },
    { id: 'purchases', label: t('md_tab_purchases'), count: pos.length },
    { id: 'attachments', label: t('md_tab_attachments') },
    { id: 'audit', label: t('md_tab_audit') },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: t('nav_home'), path: '/' },
          { label: t('nav_master_data'), path: '/master-data' },
          { label: t('nav_md_vendors'), path: '/master-data/vendors' },
          { label: `${vendor.vendorCode} - ${vendor.name}` },
        ]}
      />

      {/* Expiration Warning Alert Banner */}
      {(isCrExpired || isCrExpiringSoon) && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 ${
            isCrExpired
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <AlertTriangle
            className={`w-5 h-5 shrink-0 mt-0.5 ${isCrExpired ? 'text-red' : 'text-amber'}`}
          />
          <div className="text-xs leading-relaxed">
            <strong>{isCrExpired ? t('md_compliance_expired') : t('md_compliance_expiring_soon')}</strong>
            <p className="mt-1">
              السجل التجاري أو الاعتماد النظامي للمورد ينتهي بتاريخ:{' '}
              <strong>{vendor.crExpiryDate ? formatDate(vendor.crExpiryDate, 'yyyy-MM-dd') : '—'}</strong>
              {isCrExpired ? ' (انتهت الصلاحية رسمياً)' : ` (متبقي ${daysUntilCrExpiry} يوماً فقط)`}.
              يرجى طلب تحديث شهادة السجل التجاري وشهادة الزكاة والدخل لتجنب حظر الترسية.
            </p>
          </div>
        </div>
      )}

      {/* Header Card */}
      <Card className="p-5 border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue shrink-0 shadow-sm">
              <Building2 className="w-8 h-8" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-mono text-base font-bold text-navy bg-slate-100 px-2.5 py-0.5 rounded">
                  {vendor.vendorCode}
                </span>
                <Badge variant={vendor.status === 'active' ? 'approved' : 'closed'}>
                  {vendor.status === 'active' ? 'نشط (Approved)' : 'معطل (Blocked)'}
                </Badge>
                <div className="flex items-center gap-1 bg-amber-50 text-amber-800 text-xs px-2 py-0.5 rounded-full border border-amber-200 font-bold">
                  <Star className="w-3.5 h-3.5 text-amber fill-amber" />
                  <span>{ratingData.overall} / 5.0</span>
                </div>
              </div>

              <h1 className="text-2xl font-bold text-navy">{vendor.name}</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                النشاط: {vendor.category} • السجل التجاري: {vendor.commercialRecord} • الرقم الضريبي: {vendor.taxNumber}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={vendor.status === 'active' ? 'ghost' : 'secondary'}
              size="sm"
              onClick={handleToggleStatus}
            >
              {vendor.status === 'active' ? 'تعطيل التعامل' : 'تنشيط المورد'}
            </Button>

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

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي المشتريات المعتمدة"
          value={formatCurrency(totalSpent, 'SAR')}
          icon={<ShoppingCart className="w-6 h-6 text-primary" />}
        />
        <StatCard
          label="أوامر الشراء المنجزة (POs)"
          value={formatNumber(pos.length)}
          icon={<FileCheck className="w-6 h-6 text-blue" />}
        />
        <StatCard
          label="فواتير المورد المسجلة (AP)"
          value={formatNumber(invoices.length)}
          icon={<Receipt className="w-6 h-6 text-amber" />}
        />
        <StatCard
          label="الالتزام بمواعيد التوريد"
          value={`${((ratingData.delivery / 5) * 100).toFixed(0)}%`}
          icon={<Clock className="w-6 h-6 text-emerald-600" />}
        />
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* TAB 1: General (عام) */}
      {activeTab === 'general' && (
        <Card className="p-5 border border-slate-200 space-y-4">
          <h3 className="text-base font-bold text-navy mb-4 pb-2 border-b border-slate-100">
            البيانات القانونية والنشاط الرئيسي (General Info)
          </h3>

          {isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="اسم المورد بالكامل *"
                value={editForm.name || ''}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
              <Input
                label="رقم السجل التجاري *"
                value={editForm.commercialRecord || ''}
                onChange={(e) => setEditForm({ ...editForm, commercialRecord: e.target.value })}
              />
              <Input
                label="الرقم الضريبي *"
                value={editForm.taxNumber || ''}
                onChange={(e) => setEditForm({ ...editForm, taxNumber: e.target.value })}
              />
              <Select
                label="تصنيف النشاط"
                value={editForm.category || ''}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                options={[
                  { value: 'وقود ومحروقات', label: 'وقود ومحروقات' },
                  { value: 'زيوت ومواد تشحيم', label: 'زيوت ومواد تشحيم' },
                  { value: 'قطع غيار وصيانة', label: 'قطع غيار وصيانة' },
                  { value: 'خدمات لوجستية ونقل', label: 'خدمات لوجستية ونقل' },
                ]}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">رمز المورد المعياري</span>
                <span className="font-mono text-sm font-bold text-navy">{vendor.vendorCode}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">الاسم القانوني للمنشأة</span>
                <span className="text-sm font-bold text-navy">{vendor.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">رقم السجل التجاري (CR)</span>
                <span className="font-mono text-sm font-semibold text-navy">{vendor.commercialRecord}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">الرقم الضريبي (VAT)</span>
                <span className="font-mono text-sm font-semibold text-navy">{vendor.taxNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">تصنيف النشاط</span>
                <span className="font-semibold text-navy">{vendor.category}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">شروط السداد</span>
                <span className="font-semibold text-navy">{vendor.paymentTerms || 'آجل 30 يوماً'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">المقر الرئيسي</span>
                <span className="font-semibold text-navy">{vendor.city || 'الرياض'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">حالة التوثيق والاعتماد</span>
                <span className="text-emerald-700 font-bold">معتمد في نظام المشتريات الموحد</span>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* TAB 2: Contact (الاتصال) */}
      {activeTab === 'contact' && (
        <Card className="p-5 border border-slate-200 space-y-4">
          <h3 className="text-base font-bold text-navy mb-4 pb-2 border-b border-slate-100">
            قنوات الاتصال والعناوين الرسمية (Contact Details)
          </h3>

          {isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="المدينة والمقر"
                value={editForm.city || ''}
                onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
              />
              <Input
                label="العنوان التفصيلي"
                value={editForm.address || ''}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              />
              <Input
                label="رقم الهاتف"
                value={editForm.phone || ''}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
              <Input
                label="البريد الإلكتروني"
                value={editForm.email || ''}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
              <Input
                label="الشخص المسؤول للاتصال"
                value={editForm.contactPerson || ''}
                onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-xs">
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 block mb-0.5">العنوان والمدينة</span>
                  <span className="font-semibold text-navy">{vendor.city || 'الرياض'}</span>
                  {vendor.address && <p className="text-slate-500 mt-0.5">{vendor.address}</p>}
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <Phone className="w-5 h-5 text-blue shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 block mb-0.5">الهاتف المباشر</span>
                  <span className="font-mono font-semibold text-navy">{vendor.phone || '011-4829100'}</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <Mail className="w-5 h-5 text-amber shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 block mb-0.5">البريد الإلكتروني</span>
                  <span className="font-mono font-semibold text-navy">{vendor.email || 'procurement@vendor.sa'}</span>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: Banking (الحسابات البنكية) */}
      {activeTab === 'banking' && (
        <Card className="p-5 border border-slate-200 space-y-4">
          <h3 className="text-base font-bold text-navy mb-4 pb-2 border-b border-slate-100">
            الحسابات المصرفية المعتمدة للتحويل (Banking Details)
          </h3>

          {isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="اسم البنك"
                value={editForm.bankName || ''}
                onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })}
              />
              <Input
                label="رقم الآيبان (IBAN)"
                value={editForm.bankIban || ''}
                onChange={(e) => setEditForm({ ...editForm, bankIban: e.target.value })}
              />
              <Input
                label="رمز السويفت (SWIFT/BIC)"
                value={editForm.bankSwift || ''}
                onChange={(e) => setEditForm({ ...editForm, bankSwift: e.target.value })}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
                <Landmark className="w-6 h-6 text-navy shrink-0" />
                <div>
                  <span className="text-slate-400 block mb-1">اسم البنك المعتمد</span>
                  <span className="text-sm font-bold text-navy">{vendor.bankName || 'مصرف الراجحي'}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3 md:col-span-2">
                <CreditCard className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <span className="text-slate-400 block mb-1">رقم الحساب الدولي (IBAN)</span>
                  <span className="font-mono text-sm font-bold text-navy">
                    {vendor.bankIban || 'SA0380000000608010167519'}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    يتم التحويل التلقائي المعتمد لأوامر الدفع بعد اكتمال المطابقة الثلاثية.
                  </span>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* TAB 4: Rating (التقييم التشغيلي) */}
      {activeTab === 'rating' && (
        <div className="space-y-6">
          <Card className="p-5 border border-slate-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-6">
              <div>
                <h3 className="text-base font-bold text-navy">
                  بطاقة تقييم أداء المورد (Vendor Performance Scorecard)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  يتم احتساب التقييم تلقائياً وفق معادلة موزونة: 40% سرعة التوريد + 40% جودة المواد + 20% تنافسية الأسعار
                </p>
              </div>

              <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <Star className="w-7 h-7 text-amber fill-amber shrink-0" />
                <div>
                  <div className="text-xl font-bold text-navy">{ratingData.overall} / 5.0</div>
                  <div className="text-[11px] text-amber-900 font-semibold">التصنيف الإجمالي (Overall Rating)</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Delivery Score */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-navy">الالتزام بمواعيد التوريد (40%)</span>
                  <span className="font-bold text-emerald-700">{ratingData.delivery.toFixed(1)} / 5.0</span>
                </div>
                <ProgressBar value={(ratingData.delivery / 5) * 100} color="primary" />
                <p className="text-[11px] text-slate-500">
                  نسبة وصول الشحنات في تاريخ التسليم المحدد بأمر الشراء دون تأخير.
                </p>
              </div>

              {/* Quality Score */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-navy">مطابقة الجودة والمواصفات (40%)</span>
                  <span className="font-bold text-blue">{ratingData.quality.toFixed(1)} / 5.0</span>
                </div>
                <ProgressBar value={(ratingData.quality / 5) * 100} color="blue" />
                <p className="text-[11px] text-slate-500">
                  اجتياز الفحص المخبري والمستودعي ونسبة المردودات أو الملاحظات الفنية.
                </p>
              </div>

              {/* Price Score */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-navy">تنافسية الأسعار والخصومات (20%)</span>
                  <span className="font-bold text-amber">{ratingData.price.toFixed(1)} / 5.0</span>
                </div>
                <ProgressBar value={(ratingData.price / 5) * 100} color="amber" />
                <p className="text-[11px] text-slate-500">
                  مقارنة عروض الأسعار مع متوسط أسعار السوق والمناقصات السابقة.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 5: Compliance & Expiry (المستندات والاعتمادات) */}
      {activeTab === 'compliance' && (
        <Card className="p-5 border border-slate-200 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-navy">
                سجل التراخيص والاعتمادات النظامية (Accreditations & Certificates)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                متابعة تواريخ سريان الوثائق الحكومية وتنبيهات التجديد المبكر
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            {/* Commercial Register */}
            <div
              className={`p-4 rounded-xl border ${
                isCrExpired
                  ? 'bg-red-50 border-red-200'
                  : isCrExpiringSoon
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-navy text-sm">السجل التجاري (CR)</span>
                {isCrExpired ? (
                  <Badge variant="critical">منتهي</Badge>
                ) : isCrExpiringSoon ? (
                  <Badge variant="in_review">ينتهي قريباً</Badge>
                ) : (
                  <Badge variant="approved">ساري ومطابق</Badge>
                )}
              </div>
              <div className="text-slate-600 mb-2">رقم السجل: <strong>{vendor.commercialRecord}</strong></div>
              <div className="text-slate-600 mb-2">
                تاريخ الانتهاء: <strong>{vendor.crExpiryDate ? formatDate(vendor.crExpiryDate, 'yyyy-MM-dd') : '2027-12-31'}</strong>
              </div>
              <div className="text-[11px] text-slate-500">
                {isCrExpired
                  ? 'يجب إيقاف إصدار أوامر الشراء الجديدة فوراً حتى تجديد السجل.'
                  : `متبقي على الصلاحية ${daysUntilCrExpiry} يوماً.`}
              </div>
            </div>

            {/* Zakat & Tax Certificate */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-navy text-sm">شهادة الزكاة والدخل</span>
                <Badge variant="approved">سارية</Badge>
              </div>
              <div className="text-slate-600 mb-2">الرقم الضريبي: <strong>{vendor.taxNumber}</strong></div>
              <div className="text-slate-600 mb-2">تاريخ الانتهاء: <strong>2027-04-30</strong></div>
              <div className="text-[11px] text-slate-500">شهادة ضريبة القيمة المضافة سارية ومحدثة.</div>
            </div>

            {/* ISO / Quality Certificate */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-navy text-sm">شهادة الجودة والسلامة (ISO)</span>
                <Badge variant="approved">معتمدة</Badge>
              </div>
              <div className="text-slate-600 mb-2">المعيار: <strong>ISO 9001:2015</strong></div>
              <div className="text-slate-600 mb-2">تاريخ المراجعة: <strong>2027-09-15</strong></div>
              <div className="text-[11px] text-slate-500">معتمد في نقل وتوزيع المشتقات البترولية.</div>
            </div>
          </div>
        </Card>
      )}

      {/* TAB 6: Purchases History (سجل المشتريات) */}
      {activeTab === 'purchases' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-navy">
              سجل أوامر الشراء الصادرة للمورد (Purchase History - ME23N)
            </h3>
            <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full font-medium">
              إجمالي التعاملات: {formatCurrency(totalSpent, 'SAR')}
            </span>
          </div>

          {pos.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart className="w-12 h-12 text-slate-300" />}
              title="لا توجد أوامر شراء سابقة"
              description="لم يتم إصدار أي أوامر شراء لهذا المورد في النظام حتى الآن."
            />
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-start">رقم أمر الشراء</th>
                    <th className="p-3 text-start">تاريخ الأمر</th>
                    <th className="p-3 text-start">تاريخ التسليم</th>
                    <th className="p-3 text-start">المحطة المستلمة</th>
                    <th className="p-3 text-start">إجمالي القيمة</th>
                    <th className="p-3 text-start">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pos.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-navy">{po.docNumber}</td>
                      <td className="p-3 text-slate-600">{formatDate(po.orderDate, 'yyyy-MM-dd')}</td>
                      <td className="p-3 text-slate-600">{formatDate(po.deliveryDate, 'yyyy-MM-dd')}</td>
                      <td className="p-3">{po.plantCode}</td>
                      <td className="p-3 font-bold text-navy">{formatCurrency(po.totalAmount, 'SAR')}</td>
                      <td className="p-3">
                        <Badge
                          variant={
                            po.status === 'completed'
                              ? 'approved'
                              : po.status === 'in_progress'
                              ? 'in_progress'
                              : 'in_review'
                          }
                        >
                          {po.status === 'completed' ? 'مكتمل ومستلم' : po.status === 'in_progress' ? 'قيد التوريد' : 'معتمد'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 7: Attachments (المرفقات) */}
      {activeTab === 'attachments' && (
        <AttachmentManager entityType="vendor" entityId={vendor.id} />
      )}

      {/* TAB 8: Audit History (سجل التغييرات) */}
      {activeTab === 'audit' && (
        <AuditHistoryTab entity="vendors" entityId={vendor.id} />
      )}
    </div>
  );
};
