import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { StatCard } from '../../../components/ui/StatCard';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';
import { AssetService } from '../services/AssetService';
import { AssetScanDrawer } from '../components/AssetScanDrawer';
import { AssetAcquisitionModal } from '../components/AssetAcquisitionModal';
import { DiagnosticLogger } from '../../../core/services/DiagnosticLogger';
import {
  Building2,
  TrendingDown,
  ArrowRightLeft,
  ScanBarcode,
  PlusCircle,
  Calculator,
  ShieldCheck,
  FileSpreadsheet,
  AlertTriangle,
  Clock,
  Layers,
  CheckCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import type { Asset, AssetClass, AssetStatus } from '../../../types/models';
import { t } from '../../../i18n/ar';

export const AssetDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<{
    totalAssetsCount: number;
    totalAcquisitionCost: number;
    totalNetBookValue: number;
    totalAccumulatedDepreciation: number;
    inDepreciationCount: number;
    inTransferCount: number;
    barcodeTrackableCount: number;
    aucCount: number;
    categoryBreakdown: { category: AssetClass; name: string; count: number; totalValue: number }[];
    statusCounts: Record<AssetStatus, number>;
  } | null>(null);

  const [recentAssets, setRecentAssets] = useState<Asset[]>([]);
  const [isScanDrawerOpen, setIsScanDrawerOpen] = useState(false);
  const [isAcquisitionModalOpen, setIsAcquisitionModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await AssetService.getDashboardKPIs();
      setKpis(data);

      const all = await AssetService.getAssets();
      setRecentAssets(all.slice(0, 6));
    } catch (err) {
      DiagnosticLogger.error('AssetModule', 'Failed to load asset dashboard', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const COLORS = ['#0FA37F', '#2563EB', '#F59E0B', '#6366F1', '#EC4899', '#14B8A6', '#8B5CF6'];

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-72 rounded-xl" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with Title & Quick Actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-[#0FA37F]/10 text-emerald-800 border border-emerald-300">
              SAP FI-AA & Asset Lifecycle
            </span>
            <span className="text-xs text-slate-500 font-mono">FI-AA / PM Integration</span>
          </div>
          <h1 className="text-2xl font-black text-[#0B2545] tracking-tight mt-1">
            {t('asset_title')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            متابعة دورة حياة الأصول، الإهلاك الشهري، مناقلات العهدة، والتخريد وفق معايير المحاسبة الدولية
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => setIsScanDrawerOpen(true)}
            className="border-slate-300 hover:bg-slate-100 gap-2 font-bold"
          >
            <ScanBarcode className="w-4 h-4 text-emerald-600" />
            <span>مسح باركود (Scan-to-Open)</span>
          </Button>

          <Button
            variant="secondary"
            onClick={() => navigate('/assets/depreciation')}
            className="border-slate-300 hover:bg-slate-100 gap-2 font-bold"
          >
            <Calculator className="w-4 h-4 text-blue-600" />
            <span>تشغيل الإهلاك (AFAB)</span>
          </Button>

          <Button
            onClick={() => setIsAcquisitionModalOpen(true)}
            className="bg-[#0FA37F] hover:bg-[#0c8a6c] gap-2 font-bold shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>اقتناء أصل جديد (AS01)</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي القيمة الدفترية للأصول"
          value={`${(kpis?.totalNetBookValue || 0).toLocaleString('en-US')} SAR`}
          subtitle={`من تكلفة تاريخية ${(kpis?.totalAcquisitionCost || 0).toLocaleString('en-US')} ريال`}
          icon={<Building2 className="w-5 h-5 text-emerald-600" />}
        />

        <StatCard
          label="أصول قيد الإهلاك النشط"
          value={kpis?.inDepreciationCount || 0}
          subtitle={`مجمع إهلاك متراكم ${(kpis?.totalAccumulatedDepreciation || 0).toLocaleString('en-US')} ريال`}
          icon={<TrendingDown className="w-5 h-5 text-blue-600" />}
        />

        <StatCard
          label="أصول قيد النقل وتسليم العهدة"
          value={kpis?.inTransferCount || 0}
          subtitle="بانتظار استكمال إقرارات استلام العهدة"
          icon={<ArrowRightLeft className="w-5 h-5 text-amber-600" />}
        />

        <StatCard
          label="أصول مفهرسة بباركود Code128"
          value={kpis?.barcodeTrackableCount || 0}
          subtitle={`من إجمالي ${kpis?.totalAssetsCount || 0} أصل رأسمالي مسجل`}
          icon={<ScanBarcode className="w-5 h-5 text-[#0B2545]" />}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Values Bar Chart */}
        <Card className="lg:col-span-2 p-5 space-y-4 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-[#0B2545]">
                توزيع القيمة الدفترية حسب فئات الأصول (Asset Class Value)
              </h3>
              <p className="text-xs text-slate-500">
                القيمة الصافية للأصول موزعة على خطوط الإنتاج واللوجستيات
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded-md">
              ريال سعودي
            </span>
          </div>

          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kpis?.categoryBreakdown || []} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} interval={0} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(val: number | string | undefined) => [`${Number(val || 0).toLocaleString('en-US')} SAR`, 'القيمة الدفترية']}
                  contentStyle={{ backgroundColor: '#0B2545', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="totalValue" fill="#0FA37F" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Operational Status Pie Chart */}
        <Card className="p-5 space-y-4 shadow-sm border border-slate-200">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-[#0B2545]">
              الحالات التشغيلية للأصول (Operational Status)
            </h3>
            <p className="text-xs text-slate-500">
              حالة الأصول في المنشأة والمستودعات
            </p>
          </div>

          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'نشط قيد الاستخدام', value: kpis?.statusCounts.Active || 0 },
                    { name: 'قيد الإهلاك', value: kpis?.statusCounts.InDepreciation || 0 },
                    { name: 'قيد النقل', value: kpis?.statusCounts.InTransfer || 0 },
                    { name: 'قيد الإنشاء (AuC)', value: kpis?.statusCounts.UnderConstruction || 0 },
                    { name: 'مُكهَّن / مستبعد', value: kpis?.statusCounts.Disposed || 0 },
                  ].filter((x) => x.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                >
                  {COLORS.map((c, i) => (
                    <Cell key={`cell-${i}`} fill={c} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: number | string | undefined) => [val ?? 0, 'عدد الأصول']}
                  contentStyle={{ backgroundColor: '#0B2545', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Recent Assets & Action Links */}
      <Card className="p-5 space-y-4 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="font-bold text-sm text-[#0B2545]">
                أحدث الأصول الرأسمالية المسجلة في النظام
              </h3>
              <p className="text-xs text-slate-500">
                سجل الأصول الرأسمالية والمعدات الثقيلة بمحطات الطاقة واللوجستيات
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/assets/register')}
            className="text-xs font-bold text-emerald-700 border-emerald-200 hover:bg-emerald-50"
          >
            عرض سجل الأصول كاملاً (AS03) ←
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 text-start">رقم الأصل</th>
                <th className="py-2.5 px-3 text-start">اسم الأصل وتوصيفه</th>
                <th className="py-2.5 px-3 text-start">الفئة</th>
                <th className="py-2.5 px-3 text-start">المحطة / الموقع</th>
                <th className="py-2.5 px-3 text-start">أمين العهدة</th>
                <th className="py-2.5 px-3 text-start">القيمة التاريخية</th>
                <th className="py-2.5 px-3 text-start">صافي الدفترية</th>
                <th className="py-2.5 px-3 text-start">الحالة</th>
                <th className="py-2.5 px-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentAssets.map((asset) => (
                <tr key={asset.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-blue-900">
                    {asset.assetNumber}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">
                    {asset.name}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">
                    {asset.category}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">
                    {asset.location || asset.plantCode}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">
                    {asset.custodian}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-700">
                    {asset.acquisitionCost.toLocaleString('en-US')} ريال
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-emerald-800">
                    {asset.netBookValue.toLocaleString('en-US')} ريال
                  </td>
                  <td className="py-2.5 px-3">
                    <Badge
                      variant={
                        asset.status === 'Active'
                          ? 'approved'
                          : asset.status === 'InTransfer'
                          ? 'pending'
                          : asset.status === 'Disposed'
                          ? 'rejected'
                          : 'in_progress'
                      }
                    >
                      {asset.status === 'Active'
                        ? 'نشط'
                        : asset.status === 'InTransfer'
                        ? 'قيد النقل'
                        : asset.status === 'InDepreciation'
                        ? 'قيد الإهلاك'
                        : asset.status === 'UnderConstruction'
                        ? 'قيد الإنشاء'
                        : 'مُكهَّن'}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/assets/register/${asset.id}`)}
                      className="text-[11px] h-7 px-2 font-bold hover:bg-slate-100"
                    >
                      عرض البطاقة
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modals and Drawers */}
      <AssetScanDrawer
        isOpen={isScanDrawerOpen}
        onClose={() => setIsScanDrawerOpen(false)}
      />

      <AssetAcquisitionModal
        isOpen={isAcquisitionModalOpen}
        onClose={() => setIsAcquisitionModalOpen(false)}
        onSuccess={() => loadData()}
      />
    </div>
  );
};
