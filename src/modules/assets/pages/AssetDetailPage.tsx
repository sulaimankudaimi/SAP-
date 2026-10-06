import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';
import { AssetService } from '../services/AssetService';
import { DepreciationEngine, type FiveYearForecastPoint } from '../services/DepreciationEngine';
import { AssetBarcodeModal } from '../components/AssetBarcodeModal';
import { AssetTransferModal } from '../components/AssetTransferModal';
import { AssetDisposalModal } from '../components/AssetDisposalModal';
import { AssetValuationModal } from '../components/AssetValuationModal';
import { AssetAcquisitionModal } from '../components/AssetAcquisitionModal';
import { generateCode128Svg } from '../../../core/utils/barcode';
import { useAuthStore } from '../../../core/auth/useAuthStore';
import { useToast } from '../../../components/ui/Toast';
import type { Asset, AssetTransfer, AssetValuation } from '../../../types/models';
import {
  Building2,
  ArrowRight,
  Printer,
  ArrowRightLeft,
  Trash2,
  ClipboardCheck,
  Calendar,
  Tag,
  User,
  MapPin,
  TrendingDown,
  Layers,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Upload,
  ShieldCheck,
  HelpCircle,
  FileText,
  DollarSign,
  Wrench,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { t } from '../../../i18n/ar';

export const AssetDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { success, error } = useToast();

  const [loading, setLoading] = useState(true);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [transfers, setTransfers] = useState<AssetTransfer[]>([]);
  const [valuations, setValuations] = useState<AssetValuation[]>([]);
  const [forecastData, setForecastData] = useState<FiveYearForecastPoint[]>([]);
  const [activeTab, setActiveTab] = useState<'forecast' | 'transfers' | 'valuations'>('forecast');

  // Modals
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isDisposalModalOpen, setIsDisposalModalOpen] = useState(false);
  const [isValuationModalOpen, setIsValuationModalOpen] = useState(false);
  const [isAuCSettleModalOpen, setIsAuCSettleModalOpen] = useState(false);

  const loadAssetData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const found = await AssetService.getAssetByIdOrCode(id);
      if (found) {
        setAsset(found);
        const forecast = DepreciationEngine.generateFiveYearForecast(found);
        setForecastData(forecast);

        const transferList = await AssetService.getAssetTransfers(found.assetNumber);
        setTransfers(transferList);

        const valuationList = await AssetService.getAssetValuations(found.assetNumber);
        setValuations(valuationList);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssetData();
  }, [id]);

  const handleAcknowledgeCustody = async (transferId: string) => {
    if (!user) return;
    try {
      await AssetService.acknowledgeCustody(transferId, {
        id: user.id,
        fullName: user.fullName,
      });
      success('تم تأكيد استلام العهدة', 'تم تسجيل إقرار استلام العهدة وتوقيعه بنجاح.');
      loadAssetData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل تأكيد الاستلام';
      error('خطأ', msg);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !asset) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setAsset({ ...asset, imageUri: base64 });
      success('تم تحديث صورة الأصل', 'تم حفظ الصورة ضمن بطاقة الأصل بنجاح.');
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-72 rounded-xl" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="p-12 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">الأصل غير موجود</h2>
        <p className="text-sm text-slate-500">لم يتم العثور على أصل بهذا الرقم أو المعرف.</p>
        <Button onClick={() => navigate('/assets/register')} className="bg-[#0B2545]">
          العودة لسجل الأصول
        </Button>
      </div>
    );
  }

  const barcodeSvg = generateCode128Svg(asset.barcode || asset.assetNumber, {
    height: 38,
    moduleWidth: 1.5,
    showText: false,
  });

  return (
    <div className="p-6 space-y-6">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/assets/register')}
            className="text-xs font-bold gap-1.5"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لسجل الأصول</span>
          </Button>
          <span className="text-slate-300">/</span>
          <span className="text-xs font-bold text-slate-500 font-mono">{asset.assetNumber}</span>
          <span className="text-slate-300">/</span>
          <span className="text-xs font-bold text-slate-900 truncate max-w-[200px]">{asset.name}</span>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsBarcodeModalOpen(true)}
            className="border-slate-300 hover:bg-slate-100 gap-1.5 font-bold text-xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>طباعة الباركود</span>
          </Button>

          {asset.status !== 'Disposed' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsTransferModalOpen(true)}
              className="border-slate-300 hover:bg-slate-100 gap-1.5 font-bold text-xs"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
              <span>نقل العهدة / الموقع</span>
            </Button>
          )}

          {asset.status !== 'Disposed' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsValuationModalOpen(true)}
              className="border-slate-300 hover:bg-slate-100 gap-1.5 font-bold text-xs"
            >
              <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>تسجيل تقييم فني</span>
            </Button>
          )}

          {asset.category === 'AuC' && asset.status === 'UnderConstruction' && (
            <Button
              size="sm"
              onClick={() => setIsAuCSettleModalOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 font-bold text-xs shadow-sm"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>تسوية AuC لأصل مكتمل</span>
            </Button>
          )}

          {asset.status !== 'Disposed' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsDisposalModalOpen(true)}
              className="border-rose-200 text-rose-700 hover:bg-rose-50 gap-1.5 font-bold text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>تخريد / استبعاد</span>
            </Button>
          )}
        </div>
      </div>

      {/* Asset Hero Card (Matching Reference Design) */}
      <Card className="p-6 bg-white border border-slate-200 shadow-sm rounded-2xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Asset Image Upload / Illustration */}
          <div className="lg:col-span-3">
            <div className="relative group w-full h-48 rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center overflow-hidden">
              {asset.imageUri ? (
                <img
                  src={asset.imageUri}
                  alt={asset.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#0B2545]/10 text-[#0B2545] mx-auto flex items-center justify-center mb-2">
                    <Building2 className="w-7 h-7 text-emerald-600" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">معدات شركة الخليج</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{asset.category}</p>
                </div>
              )}

              {/* Upload Overlay */}
              <label className="absolute inset-0 bg-[#0B2545]/80 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs font-bold gap-1">
                <Upload className="w-5 h-5 text-emerald-400" />
                <span>تحميل صورة الأصل</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Asset Core Details */}
          <div className="lg:col-span-6 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-[#0B2545] text-white tracking-wider">
                {asset.assetNumber}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                فئة: {asset.category}
              </span>
              <Badge
                variant={
                  asset.status === 'Active'
                    ? 'completed'
                    : asset.status === 'InTransfer'
                    ? 'pending'
                    : asset.status === 'Disposed'
                    ? 'rejected'
                    : asset.status === 'UnderConstruction'
                    ? 'draft'
                    : 'in_progress'
                }
              >
                {asset.status === 'Active'
                  ? 'نشط قيد الاستخدام'
                  : asset.status === 'InTransfer'
                  ? 'قيد النقل والتسليم'
                  : asset.status === 'InDepreciation'
                  ? 'قيد الإهلاك'
                  : asset.status === 'UnderConstruction'
                  ? 'قيد الإنشاء (AuC)'
                  : 'مُكهَّن / مستبعد'}
              </Badge>
            </div>

            <h2 className="text-xl font-black text-slate-900 leading-snug">
              {asset.name}
            </h2>

            <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-slate-400 shrink-0" />
                <span>الرقم التسلسلي: <strong className="font-mono text-slate-900">{asset.serialNumber || 'غير متوفر'}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span>تاريخ الاقتناء: <strong className="font-mono text-slate-900">{asset.acquisitionDate}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span>الموقع: <strong className="text-slate-900">{asset.location || asset.plantCode}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400 shrink-0" />
                <span>أمين العهدة: <strong className="text-slate-900">{asset.custodian}</strong></span>
              </div>
            </div>

            {/* Inline Barcode Preview */}
            <div className="flex items-center gap-3 pt-2">
              <div
                className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg inline-block overflow-hidden"
                dangerouslySetInnerHTML={{ __html: barcodeSvg }}
              />
              <div className="text-[11px] text-slate-500 font-mono">
                Code128: <strong>{asset.barcode}</strong>
              </div>
            </div>
          </div>

          {/* Asset Financial Metrics Box */}
          <div className="lg:col-span-3 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-[#0B2545] border-b border-slate-200 pb-1.5 flex items-center justify-between">
              <span>البيانات المالية المحاسبية</span>
              <span className="font-mono text-[10px] text-slate-400">FI-AA Values</span>
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">التكلفة التاريخية:</span>
                <span className="font-mono font-bold text-slate-800">
                  {asset.acquisitionCost.toLocaleString('en-US')} SAR
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">مجمع الإهلاك:</span>
                <span className="font-mono font-bold text-rose-600">
                  {asset.accumulatedDepreciation.toLocaleString('en-US')} SAR
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">قيمة الخردة:</span>
                <span className="font-mono text-slate-700">
                  {asset.salvageValue.toLocaleString('en-US')} SAR
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                <span className="font-bold text-slate-800">صافي القيمة الدفترية:</span>
                <span className="font-mono font-black text-emerald-700 text-sm">
                  {asset.netBookValue.toLocaleString('en-US')} SAR
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Lifecycle Timeline (Reference Standard) */}
      <Card className="p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="font-bold text-sm text-[#0B2545]">
                {t('asset_lifecycle_timeline')}
              </h3>
              <p className="text-xs text-slate-500">
                تسلسل مراحل حياة الأصل من الشراء والرأسمالية إلى التدشين والإهلاك والتخريد
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-600">
            العمر الإنتاجي: {asset.usefulLifeMonths} شهر ({Math.round(asset.usefulLifeMonths / 12)} سنوات)
          </span>
        </div>

        {/* 5-Stage Interactive Timeline */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
          {/* Stage 1: Purchase & Capitalization */}
          <div className="border border-emerald-300 bg-emerald-50/60 rounded-xl p-3.5 space-y-1.5 relative">
            <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
              1
            </div>
            <h5 className="font-bold text-xs text-emerald-950">الشراء والرأسمالية</h5>
            <p className="text-[11px] text-slate-600">
              تاريخ: <span className="font-mono font-semibold">{asset.acquisitionDate}</span>
            </p>
            <p className="text-[10px] text-slate-500">
              المصدر: {asset.acquisitionSource || 'Manual'} ({asset.capitalizationJeDocNumber || 'JE-CAP'})
            </p>
          </div>

          {/* Stage 2: Receipt & Commissioning */}
          <div className="border border-emerald-300 bg-emerald-50/60 rounded-xl p-3.5 space-y-1.5">
            <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
              2
            </div>
            <h5 className="font-bold text-xs text-emerald-950">الاستلام والفحص الفني</h5>
            <p className="text-[11px] text-slate-600">
              مطابقة المواصفات وبطاقة الباركود
            </p>
            <p className="text-[10px] text-slate-500">
              المحطة: {asset.plantCode} (معتمد)
            </p>
          </div>

          {/* Stage 3: Commissioning & Deployment */}
          <div className="border border-emerald-300 bg-emerald-50/60 rounded-xl p-3.5 space-y-1.5">
            <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
              3
            </div>
            <h5 className="font-bold text-xs text-emerald-950">التدشين ودخول الخدمة</h5>
            <p className="text-[11px] text-slate-600">
              تاريخ التدشين: <span className="font-mono font-semibold">{asset.commissioningDate || asset.acquisitionDate}</span>
            </p>
            <p className="text-[10px] text-slate-500">
              العهدة: {asset.custodian}
            </p>
          </div>

          {/* Stage 4: Periodic Depreciation */}
          <div className={`border rounded-xl p-3.5 space-y-1.5 ${
            asset.status === 'InDepreciation' || asset.status === 'Active'
              ? 'border-blue-300 bg-blue-50/60'
              : 'border-slate-200 bg-slate-50'
          }`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
              asset.status === 'InDepreciation' || asset.status === 'Active'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-300 text-slate-700'
            }`}>
              4
            </div>
            <h5 className="font-bold text-xs text-slate-900">سريان دورات الإهلاك</h5>
            <p className="text-[11px] text-slate-600">
              الطريقة: {asset.depreciationMethod === 'StraightLine' ? 'القسط الثابت' : 'القسط المتناقص'}
            </p>
            <p className="text-[10px] text-slate-500">
              المجمع: {asset.accumulatedDepreciation.toLocaleString('en-US')} SAR
            </p>
          </div>

          {/* Stage 5: End of Life / Disposal */}
          <div className={`border rounded-xl p-3.5 space-y-1.5 ${
            asset.status === 'Disposed'
              ? 'border-rose-300 bg-rose-50/60'
              : 'border-slate-200 bg-slate-50 opacity-70'
          }`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
              asset.status === 'Disposed'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-300 text-slate-700'
            }`}>
              5
            </div>
            <h5 className="font-bold text-xs text-slate-900">نهاية العمر والتخريد</h5>
            <p className="text-[11px] text-slate-600">
              {asset.status === 'Disposed' ? (
                <>تاريخ: <span className="font-mono">{asset.disposalDate}</span></>
              ) : (
                'قيد الخدمة التشغيلية'
              )}
            </p>
            <p className="text-[10px] text-slate-500">
              {asset.status === 'Disposed' ? `قيد: ${asset.disposalJeDocNumber || 'ABAVN'}` : 'لم يحن التخريد'}
            </p>
          </div>
        </div>
      </Card>

      {/* Tabs Section: 1. 5-Year Forecast Chart | 2. Custody Log | 3. Technical Valuations */}
      <Card className="p-0 shadow-sm border border-slate-200 overflow-hidden">
        {/* Tab Headers */}
        <div className="flex items-center gap-1 p-2 bg-slate-100 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('forecast')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'forecast'
                ? 'bg-white text-[#0B2545] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            توقعات الإهلاك والقيمة الدفترية (5 سنوات)
          </button>

          <button
            onClick={() => setActiveTab('transfers')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'transfers'
                ? 'bg-white text-[#0B2545] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>سجل مناقلات العهدة والتسليم</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 font-mono">
              {transfers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('valuations')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'valuations'
                ? 'bg-white text-[#0B2545] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>سجل الفحص الفني والتقييمات</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 font-mono">
              {valuations.length}
            </span>
          </button>
        </div>

        {/* Tab 1: 5-Year Forecast Chart */}
        {activeTab === 'forecast' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-[#0B2545]">
                  مسار القيمة الدفترية مقابل مجمع الإهلاك (5-Year Depreciation Curve)
                </h4>
                <p className="text-xs text-slate-500">
                  مقارنة تراجع صافي القيمة الدفترية ونمو مجمع الإهلاك وصولاً إلى قيمة الخردة ({asset.salvageValue.toLocaleString('en-US')} SAR)
                </p>
              </div>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg font-mono">
                الطريقة: {asset.depreciationMethod}
              </span>
            </div>

            <div className="h-72 w-full pt-4" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                  <defs>
                    <linearGradient id="bookValueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0FA37F" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#0FA37F" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="depGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="periodLabel" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(val: number | string | undefined, name: string | undefined) => [
                      `${Number(val || 0).toLocaleString('en-US')} SAR`,
                      name === 'bookValue' ? 'صافي القيمة الدفترية' : 'مجمع الإهلاك',
                    ]}
                    contentStyle={{ backgroundColor: '#0B2545', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend
                    formatter={(value) => (value === 'bookValue' ? 'صافي القيمة الدفترية (NBV)' : 'مجمع الإهلاك المتراكم')}
                  />
                  <Area
                    type="monotone"
                    dataKey="bookValue"
                    stroke="#0FA37F"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#bookValueGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="accumulatedDepreciation"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#depGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Tab 2: Custody & Transfer History */}
        {activeTab === 'transfers' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-[#0B2545]">
                سجل مناقلات العهدة وتغيير المواقع (Custody Handover & Transfers)
              </h4>
              {asset.status !== 'Disposed' && (
                <Button
                  size="sm"
                  onClick={() => setIsTransferModalOpen(true)}
                  className="bg-[#2563EB] hover:bg-[#1d4ed8] text-xs gap-1.5"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>طلب مناقلة جديد</span>
                </Button>
              )}
            </div>

            {transfers.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-200 rounded-xl">
                لا توجد مناقلات مسجلة على هذا الأصل. العهدة الحالية مسجلة باسم <strong>{asset.custodian}</strong> منذ تاريخ الاقتناء.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 text-start">رقم المستند</th>
                      <th className="py-2.5 px-3 text-start">تاريخ النقل</th>
                      <th className="py-2.5 px-3 text-start">أمين العهدة السابق</th>
                      <th className="py-2.5 px-3 text-start">أمين العهدة الجديد</th>
                      <th className="py-2.5 px-3 text-start">من محطة / موقع</th>
                      <th className="py-2.5 px-3 text-start">إلى محطة / موقع</th>
                      <th className="py-2.5 px-3 text-start">الحالة</th>
                      <th className="py-2.5 px-3 text-start">إقرار الاستلام</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transfers.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{t.docNumber}</td>
                        <td className="py-2.5 px-3 font-mono">{t.transferDate}</td>
                        <td className="py-2.5 px-3">{t.fromCustodian}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">{t.toCustodian}</td>
                        <td className="py-2.5 px-3">{t.fromPlant} ({t.fromLocation || '—'})</td>
                        <td className="py-2.5 px-3 font-semibold">{t.toPlant} ({t.toLocation || '—'})</td>
                        <td className="py-2.5 px-3">
                          <Badge variant={t.status === 'approved' ? 'completed' : 'pending'}>
                            {t.status === 'approved' ? 'معتمد' : 'معلق'}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          {t.acknowledgedByCustodian ? (
                            <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              تم الإقرار والتسليم
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleAcknowledgeCustody(t.id)}
                              className="text-[11px] h-7 px-2 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                            >
                              إقرار استلام العهدة
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Technical Valuations & Inspections */}
        {activeTab === 'valuations' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-[#0B2545]">
                سجل الفحص الهندسي والتقييم الفني (Technical Condition & Inspections)
              </h4>
              {asset.status !== 'Disposed' && (
                <Button
                  size="sm"
                  onClick={() => setIsValuationModalOpen(true)}
                  className="bg-[#0FA37F] hover:bg-[#0c8a6c] text-xs gap-1.5"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  <span>تسجيل فحص فني جديد</span>
                </Button>
              )}
            </div>

            {valuations.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-200 rounded-xl">
                لم يتم تسجيل أي فحوصات فنية دورية لهذا الأصل حتى الآن. اضغط على الزر أعلاه لإضافة أول تقرير فحص.
              </div>
            ) : (
              <div className="space-y-3">
                {valuations.map((v) => (
                  <div key={v.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-blue-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {v.docNumber}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">{v.inspectionDate}</span>
                        <span className="text-xs font-semibold text-slate-700">بواسطة: {v.inspectorName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-800">
                          درجة الكفاءة: {v.conditionScore}/100
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            v.conditionGrade === 'Excellent'
                              ? 'bg-emerald-100 text-emerald-800'
                              : v.conditionGrade === 'Good'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {v.conditionGrade}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-100">
                      {v.physicalConditionNotes}
                    </p>

                    <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                      <div>
                        التوصية الهندسية: <strong className="text-slate-800">{v.recommendedAction}</strong>
                      </div>
                      {v.estimatedMarketValue && (
                        <div>
                          القيمة السوقية التقديرية: <strong className="font-mono text-emerald-800">{v.estimatedMarketValue.toLocaleString('en-US')} SAR</strong>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Modals */}
      <AssetBarcodeModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        asset={asset}
      />

      <AssetTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        asset={asset}
        onSuccess={() => loadAssetData()}
      />

      <AssetDisposalModal
        isOpen={isDisposalModalOpen}
        onClose={() => setIsDisposalModalOpen(false)}
        asset={asset}
        onSuccess={() => loadAssetData()}
      />

      <AssetValuationModal
        isOpen={isValuationModalOpen}
        onClose={() => setIsValuationModalOpen(false)}
        asset={asset}
        onSuccess={() => loadAssetData()}
      />

      {asset.category === 'AuC' && (
        <AssetAcquisitionModal
          isOpen={isAuCSettleModalOpen}
          onClose={() => setIsAuCSettleModalOpen(false)}
          aucAssetToSettle={asset}
          onSuccess={(settled) => {
            navigate(`/assets/register/${settled.id}`);
          }}
        />
      )}
    </div>
  );
};
