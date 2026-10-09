import { DiagnosticLogger } from '../../../core/services/DiagnosticLogger';
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Boxes,
  ArrowRight,
  Edit,
  Save,
  X,
  Barcode,
  AlertTriangle,
  CheckCircle,
  Clock,
  Warehouse,
  History,
  Paperclip,
  DollarSign,
  ShoppingCart,
  ShieldCheck,
  TrendingDown,
  Layers,
} from 'lucide-react';
import { db } from '../../../core/db';
import { materialRepository, materialGroupRepository, unitRepository } from '../../../core/repositories';
import { MasterDataService } from '../services/MasterDataService';
import type { Material, MaterialGroup, UnitOfMeasure, StockBalance, StockLedgerEntry } from '../../../types/models';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs';
import { Card } from '../../../components/ui/Card';
import { StatCard } from '../../../components/ui/StatCard';
import { Tabs, TabItem } from '../../../components/ui/Tabs';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useToast } from '../../../components/ui/Toast';
import { useAuthStore } from '../../../core/auth/useAuthStore';
import { formatNumber, formatCurrency, formatDate } from '../../../core/utils';
import { generateCode128Svg } from '../../../core/utils/barcode';
import { BarcodeModal } from '../components/BarcodeModal';
import { AttachmentManager } from '../components/AttachmentManager';
import { AuditHistoryTab } from '../components/AuditHistoryTab';
import { t } from '../../../i18n/ar';

export const MaterialDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const user = useAuthStore((s) => s.user);

  const [material, setMaterial] = useState<Material | null>(null);
  const [materialGroups, setMaterialGroups] = useState<MaterialGroup[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');

  // Stock summary and movements
  const [stockBalances, setStockBalances] = useState<StockBalance[]>([]);
  const [movements, setMovements] = useState<StockLedgerEntry[]>([]);
  const [totalStockQty, setTotalStockQty] = useState(0);
  const [totalStockVal, setTotalStockVal] = useState(0);

  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Material>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Barcode Modal
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);

  const loadMaterial = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [mat, grps, uns] = await Promise.all([
        materialRepository.getById(id),
        db.materialGroups.toArray(),
        db.units.toArray(),
      ]);

      if (!mat || mat.isDeleted) {
        setMaterial(null);
        return;
      }

      setMaterial(mat);
      setEditForm(mat);
      setMaterialGroups(grps.filter((g) => !g.isDeleted));
      setUnits(uns.filter((u) => !u.isDeleted));

      // Fetch stock details
      const stock = await MasterDataService.getMaterialStockDetails(mat.materialCode);
      setStockBalances(stock.balances);
      setMovements(stock.movements);
      setTotalStockQty(stock.totalQuantity);
      setTotalStockVal(stock.totalValue);
    } catch (err) {
      DiagnosticLogger.error('MaterialDetailPage', 'Failed to load material detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterial();
  }, [id]);

  const handleSaveEdit = async () => {
    if (!material || !id) return;
    try {
      setIsSaving(true);
      await materialRepository.update(id, editForm, user?.id || 'admin', user?.fullName || 'مدير النظام');

      showToast({
        title: 'تم تحديث بيانات الصنف',
        message: 'تم حفظ التعديلات وتوثيقها في سجل التدقيق بنجاح.',
        type: 'success',
      });

      setIsEditing(false);
      await loadMaterial();
    } catch (err) {
      showToast({
        title: 'فشل حفظ التعديلات',
        message: err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ التعديل.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!material) return;
    const newStatus = material.status === 'active' ? 'inactive' : 'active';
    try {
      await MasterDataService.toggleStatus(
        'materials',
        material.id,
        newStatus,
        user?.id || 'admin',
        user?.fullName || 'مدير النظام'
      );
      showToast({
        title: newStatus === 'active' ? 'تم تنشيط الصنف' : 'تم تعطيل الصنف',
        message: `تم تغيير حالة الصنف إلى [${newStatus === 'active' ? 'نشط' : 'معطل'}].`,
        type: 'info',
      });
      await loadMaterial();
    } catch (err) {
      showToast({
        title: 'فشل تغيير الحالة',
        message: err instanceof Error ? err.message : 'تعذر تحديث الحالة.',
        type: 'error',
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="rectangular" height={40} />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton variant="rectangular" height={100} />
          <Skeleton variant="rectangular" height={100} />
          <Skeleton variant="rectangular" height={100} />
          <Skeleton variant="rectangular" height={100} />
        </div>
        <Skeleton variant="rectangular" height={400} />
      </div>
    );
  }

  if (!material) {
    return (
      <EmptyState
        icon={<Boxes className="w-16 h-16 text-slate-300" />}
        title="الصنف غير موجود أو تم حذفه"
        description="لم يتم العثور على سجل الصنف المطلوب في قاعدة البيانات."
        action={
          <Button variant="primary" onClick={() => navigate('/master-data/materials')}>
            العودة إلى قائمة المواد
          </Button>
        }
      />
    );
  }

  // Barcode SVG Preview
  const barcodeSvg = generateCode128Svg(material.materialCode, {
    height: 48,
    moduleWidth: 1.6,
    showText: true,
  });

  const tabs: TabItem[] = [
    { id: 'general', label: t('md_tab_general') },
    { id: 'purchasing', label: t('md_tab_purchasing') },
    { id: 'inventory', label: t('md_tab_inventory') },
    { id: 'accounting', label: t('md_tab_accounting') },
    { id: 'balances', label: t('md_tab_balances'), count: stockBalances.length },
    { id: 'movements', label: t('md_tab_movements'), count: movements.length },
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
          { label: t('nav_md_materials'), path: '/master-data/materials' },
          { label: `${material.materialCode} - ${material.name}` },
        ]}
      />

      {/* Top Header Card */}
      <Card className="p-5 border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-primary shrink-0 shadow-sm">
              <Boxes className="w-8 h-8" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-mono text-base font-bold text-navy bg-slate-100 px-2.5 py-0.5 rounded">
                  {material.materialCode}
                </span>
                <Badge variant={material.status === 'active' ? 'approved' : 'closed'}>
                  {material.status === 'active' ? 'نشط (Active)' : 'معطل (Inactive)'}
                </Badge>
                <Badge variant={material.abcClass === 'A' ? 'critical' : 'in_progress'}>
                  فئة ABC: {material.abcClass}
                </Badge>
              </div>

              <h1 className="text-2xl font-bold text-navy">{material.name}</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                المجموعة: {material.groupCode} • وحدة القياس: {material.baseUnit}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setIsBarcodeOpen(true)}>
              <Barcode className="w-4 h-4 me-1.5" />
              طباعة باركود (Code128)
            </Button>

            <Button
              variant={material.status === 'active' ? 'ghost' : 'secondary'}
              size="sm"
              onClick={handleToggleStatus}
            >
              {material.status === 'active' ? 'تعطيل الصنف' : 'تنشيط الصنف'}
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
                تعديل الصنف
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي الكمية بالمخازن"
          value={`${formatNumber(totalStockQty)} ${material.baseUnit}`}
          icon={<Layers className="w-6 h-6 text-primary" />}
        />
        <StatCard
          label="القيمة الإجمالية للمخزون"
          value={formatCurrency(totalStockVal, material.currency || 'SAR')}
          icon={<DollarSign className="w-6 h-6 text-blue" />}
        />
        <StatCard
          label="السعر المعياري للوحدة"
          value={formatCurrency(material.standardPrice, material.currency || 'SAR')}
          icon={<ShoppingCart className="w-6 h-6 text-amber" />}
        />
        <StatCard
          label="نقطة إعادة الطلب / الأمان"
          value={`${formatNumber(material.reorderPoint || 0)} / ${formatNumber(material.safetyStock || 0)}`}
          icon={<TrendingDown className="w-6 h-6 text-slate-500" />}
        />
      </div>

      {/* Tabs Navigation */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* TAB 1: General (عام) */}
      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-5 border border-slate-200">
              <h3 className="text-base font-bold text-navy mb-4 pb-2 border-b border-slate-100">
                البيانات الأساسية والتوصيف العام (General Data)
              </h3>

              {isEditing ? (
                <div className="space-y-4">
                  <Input
                    label="اسم الصنف بالكامل *"
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                  <Textarea
                    label="الوصف الفني والتفصيلي"
                    value={editForm.description || ''}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      label="مجموعة المواد"
                      value={editForm.groupCode || ''}
                      onChange={(e) => setEditForm({ ...editForm, groupCode: e.target.value })}
                      options={materialGroups.map((g) => ({
                        value: g.code,
                        label: `${g.name} (${g.code})`,
                      }))}
                    />
                    <Select
                      label="وحدة القياس الأساسية"
                      value={editForm.baseUnit || ''}
                      onChange={(e) => setEditForm({ ...editForm, baseUnit: e.target.value })}
                      options={units.map((u) => ({
                        value: u.code,
                        label: `${u.name} (${u.code})`,
                      }))}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-1">رمز الصنف المعياري</span>
                    <span className="font-mono text-sm font-bold text-navy">{material.materialCode}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">الاسم التجاري والمعياري</span>
                    <span className="text-sm font-bold text-navy">{material.name}</span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-slate-400 block mb-1">الوصف والمواصفات الفنية</span>
                    <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                      {material.description || 'لا يوجد وصف فني إضافي مسجل لهذا الصنف.'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">مجموعة المواد (Material Group)</span>
                    <span className="font-semibold text-navy">{material.groupCode}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">وحدة القياس الأساسية (Base UoM)</span>
                    <span className="font-semibold text-navy">{material.baseUnit}</span>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Barcode & Identity Side Card */}
          <div className="space-y-4">
            <Card className="p-5 border border-slate-200 text-center flex flex-col items-center">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                باركود التتبع الفوري (Code128)
              </h4>
              <div
                className="w-full max-w-[220px] p-2 bg-slate-50 rounded-lg border border-slate-200 mb-3"
                dangerouslySetInnerHTML={{ __html: barcodeSvg }}
              />
              <Button variant="secondary" size="sm" onClick={() => setIsBarcodeOpen(true)}>
                <Barcode className="w-4 h-4 me-1.5" />
                معاينة وطباعة الملصق
              </Button>
            </Card>

            <Card className="p-4 border border-slate-200 bg-slate-50 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-navy">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>حالة الرقابة والتتبع</span>
              </div>
              <p className="text-slate-500">
                الصنف مسجل وفق معايير شركة الخليج للطاقة، ويخضع للرقابة المستودعية المباشرة وتدقيق القيود المحاسبية.
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: Purchasing Data (بيانات المشتريات) */}
      {activeTab === 'purchasing' && (
        <Card className="p-5 border border-slate-200 space-y-4">
          <h3 className="text-base font-bold text-navy mb-4 pb-2 border-b border-slate-100">
            معايير المشتريات وشروط التوريد (Purchasing View)
          </h3>

          {isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="مجموعة المشتريات (Purchasing Group)"
                value={editForm.purchasingGroup || ''}
                onChange={(e) => setEditForm({ ...editForm, purchasingGroup: e.target.value })}
              />
              <Input
                type="number"
                label="الحد الأدنى لطلب الشراء (Min Order Qty)"
                value={editForm.minOrderQty || ''}
                onChange={(e) => setEditForm({ ...editForm, minOrderQty: Number(e.target.value) })}
              />
              <Input
                type="number"
                label="فترة التوريد المتوقعة بالأيام (Lead Time)"
                value={editForm.leadTimeDays || ''}
                onChange={(e) => setEditForm({ ...editForm, leadTimeDays: Number(e.target.value) })}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">مجموعة المشتريات المسؤولة</span>
                <span className="font-semibold text-navy">{material.purchasingGroup || '001 - المشتريات العامة'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">فترة التوريد المتوقعة</span>
                <span className="font-semibold text-navy">{material.leadTimeDays || 7} أيام عمل</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">الحد الأدنى لطلب الشراء</span>
                <span className="font-semibold text-navy">{material.minOrderQty || 100} {material.baseUnit}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">العملة الافتراضية</span>
                <span className="font-semibold text-navy">{material.currency || 'SAR'}</span>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: Inventory Data (بيانات المخزون) */}
      {activeTab === 'inventory' && (
        <Card className="p-5 border border-slate-200 space-y-4">
          <h3 className="text-base font-bold text-navy mb-4 pb-2 border-b border-slate-100">
            سياسات التخزين ومستويات الأمان (Plant / Storage View)
          </h3>

          {isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                type="number"
                label="نقطة إعادة الطلب (Reorder Point)"
                value={editForm.reorderPoint || ''}
                onChange={(e) => setEditForm({ ...editForm, reorderPoint: Number(e.target.value) })}
              />
              <Input
                type="number"
                label="مخزون الأمان (Safety Stock)"
                value={editForm.safetyStock || ''}
                onChange={(e) => setEditForm({ ...editForm, safetyStock: Number(e.target.value) })}
              />
              <Select
                label="تصنيف الأهمية (ABC Class)"
                value={editForm.abcClass || 'A'}
                onChange={(e) =>
                  setEditForm({ ...editForm, abcClass: e.target.value as 'A' | 'B' | 'C' })
                }
                options={[
                  { value: 'A', label: 'الفئة A - استراتيجي عالي القيمة' },
                  { value: 'B', label: 'الفئة B - متوسط الاستهلاك' },
                  { value: 'C', label: 'الفئة C - تشغيلي روتيني' },
                ]}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block mb-1">نقطة إعادة الطلب (Reorder Point)</span>
                <span className="text-xl font-bold text-navy">{formatNumber(material.reorderPoint || 0)}</span>
                <span className="text-xs text-slate-400 ms-1">{material.baseUnit}</span>
                <p className="text-[11px] text-slate-400 mt-2">
                  يصدر النظام تنبيهاً آلياً ومقترح أمر شراء عند هبوط الرصيد عن هذا الحد.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block mb-1">مخزون الأمان الأدنى (Safety Stock)</span>
                <span className="text-xl font-bold text-amber">{formatNumber(material.safetyStock || 0)}</span>
                <span className="text-xs text-slate-400 ms-1">{material.baseUnit}</span>
                <p className="text-[11px] text-slate-400 mt-2">
                  الحد الحرج لمنع توقف العمليات التشغيلية ومحطات الضخ.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 block mb-1">طريقة التقييم المخزني (Valuation)</span>
                <span className="text-base font-bold text-navy">
                  {material.valuationMethod === 'Standard' ? 'السعر المعياري الثابت (S)' : 'المتوسط المتحرك (V)'}
                </span>
                <p className="text-[11px] text-slate-400 mt-2">
                  تحديث التكلفة آلياً مع كل حركة استلام بضاعة (GR).
                </p>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* TAB 4: Accounting (المحاسبة) */}
      {activeTab === 'accounting' && (
        <Card className="p-5 border border-slate-200 space-y-4">
          <h3 className="text-base font-bold text-navy mb-4 pb-2 border-b border-slate-100">
            الربط المحاسبي والأستاذ العام (Accounting View)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-400 block mb-1">فئة التقييم (Valuation Class)</span>
              <span className="font-mono text-base font-bold text-navy">{material.valuationClass || '3000'}</span>
              <span className="text-xs text-slate-500 block mt-1">Raw Materials / Energy Stock</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-400 block mb-1">حساب المخزون بالأستاذ العام (GL Account)</span>
              <span className="font-mono text-base font-bold text-navy">{material.glAccountCode || '120100'}</span>
              <span className="text-xs text-slate-500 block mt-1">مخزون الوقود والزيوت والمشتقات</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-400 block mb-1">السعر المعياري الحالي</span>
              <span className="text-base font-bold text-emerald-700">
                {formatCurrency(material.standardPrice, material.currency || 'SAR')}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* TAB 5: Balances by Location (الأرصدة حسب الموقع) */}
      {activeTab === 'balances' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-navy">
              توزيع الأرصدة المخزنية عبر المحطات والمستودعات (Stock Overview - MMBE)
            </h3>
            <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full font-medium">
              إجمالي الأرصدة: {formatNumber(totalStockQty)} {material.baseUnit}
            </span>
          </div>

          {stockBalances.length === 0 ? (
            <EmptyState
              icon={<Warehouse className="w-12 h-12 text-slate-300" />}
              title="لا توجد أرصدة مسجلة بالمستودعات"
              description="لم يتم تسجيل حركات استلام لهذا الصنف في أي محطة أو مستودع حتى الآن."
            />
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-start">المحطة (Plant)</th>
                    <th className="p-3 text-start">مستودع التخزين (Storage Location)</th>
                    <th className="p-3 text-start">رصيد متاح غير مقيد</th>
                    <th className="p-3 text-start">تحت الفحص الفني</th>
                    <th className="p-3 text-start">رصيد محجوز / محظور</th>
                    <th className="p-3 text-start">سعر التقييم للوحدة</th>
                    <th className="p-3 text-start">القيمة الإجمالية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockBalances.map((b) => {
                    const lineQty = (b.unrestrictedQty || 0) + (b.qualityInspectionQty || 0) + (b.blockedQty || 0);
                    const lineVal = b.totalValuation || (lineQty * material.standardPrice);
                    return (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-navy">{b.plantCode}</td>
                        <td className="p-3 text-slate-700">{b.storageLocation}</td>
                        <td className="p-3 font-bold text-emerald-700">
                          {formatNumber(b.unrestrictedQty || 0)} {material.baseUnit}
                        </td>
                        <td className="p-3 text-amber font-semibold">
                          {formatNumber(b.qualityInspectionQty || 0)} {material.baseUnit}
                        </td>
                        <td className="p-3 text-slate-400">
                          {formatNumber(b.blockedQty || 0)} {material.baseUnit}
                        </td>
                        <td className="p-3 font-mono">
                          {formatCurrency(material.standardPrice, 'SAR')}
                        </td>
                        <td className="p-3 font-bold text-navy">
                          {formatCurrency(lineVal, 'SAR')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: Movements History (سجل الحركات) */}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-navy">
              سجل حركات المواد الواردة والمنصرفة (Material Movements - MIGO)
            </h3>
            <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full font-medium">
              عدد الحركات: {movements.length}
            </span>
          </div>

          {movements.length === 0 ? (
            <EmptyState
              icon={<History className="w-12 h-12 text-slate-300" />}
              title="لا توجد حركات مسجلة"
              description="لم يتم ترحيل أي مستندات استلام أو صرف مخزني لهذا الصنف."
            />
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-start">رقم المستند</th>
                    <th className="p-3 text-start">نوع الحركة (Movement)</th>
                    <th className="p-3 text-start">تاريخ الترحيل</th>
                    <th className="p-3 text-start">المحطة / المستودع</th>
                    <th className="p-3 text-start">الكمية</th>
                    <th className="p-3 text-start">رقم المرجع (PO/Trip)</th>
                    <th className="p-3 text-start">المستخدم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-navy">{m.id.substring(0, 14)}</td>
                      <td className="p-3">
                        <Badge
                          variant={
                            m.movementType === '101'
                              ? 'approved'
                              : m.movementType === '201'
                              ? 'critical'
                              : 'in_progress'
                          }
                        >
                          {m.movementType} - {m.movementType === '101' ? 'استلام بضاعة (GR)' : m.movementType === '201' ? 'صرف استهلاك (GI)' : 'تحويل مخزني'}
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-600">{formatDate(m.postingDate, 'yyyy-MM-dd')}</td>
                      <td className="p-3">{m.plantCode} / {m.storageLocation}</td>
                      <td className="p-3 font-bold text-navy">
                        {formatNumber(m.quantity)} {m.unit}
                      </td>
                      <td className="p-3 font-mono text-slate-500">{m.referenceDocNumber || '—'}</td>
                      <td className="p-3 text-slate-600">{m.createdBy}</td>
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
        <AttachmentManager entityType="material" entityId={material.id} />
      )}

      {/* TAB 8: Audit History (سجل التغييرات) */}
      {activeTab === 'audit' && (
        <AuditHistoryTab entity="materials" entityId={material.id} />
      )}

      {/* Printable Barcode Modal */}
      <BarcodeModal
        isOpen={isBarcodeOpen}
        onClose={() => setIsBarcodeOpen(false)}
        materialCode={material.materialCode}
        materialName={material.name}
        unit={material.baseUnit}
        category={material.groupCode}
      />
    </div>
  );
};
