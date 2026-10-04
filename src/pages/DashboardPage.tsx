import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  ShoppingCart,
  Boxes,
  Truck,
  Building,
  RefreshCw,
  Calendar,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { useAuthStore } from '../core/auth/useAuthStore';
import { useToast } from '../components/ui/Toast';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { ScreenSkeleton } from '../components/ui/Skeleton';
import { formatCurrency, formatNumber } from '../core/utils';
import {
  DashboardService,
  type DashboardKPISummary,
  type SpendCategoryDistribution,
  type TrendDataPoint,
  type CriticalStockItem,
  type OperationalKPIs,
  type PlantLocationStatus,
} from '../modules/reports/services/dashboardService';
import type { PurchaseOrder } from '../types/models';
import { ProcurementTrendChart } from '../modules/reports/components/ProcurementTrendChart';
import { SpendDistributionDonut } from '../modules/reports/components/SpendDistributionDonut';
import { OperationsMapCard } from '../modules/reports/components/OperationsMapCard';
import { RecentOrdersTable } from '../modules/reports/components/RecentOrdersTable';
import { LowStockAlertsList } from '../modules/reports/components/LowStockAlertsList';
import { KPIMetricsCard } from '../modules/reports/components/KPIMetricsCard';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, can } = useAuthStore();
  const { success, error } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [trendDays, setTrendDays] = useState<30 | 90 | 365>(30);

  // Data States
  const [kpiSummary, setKpiSummary] = useState<DashboardKPISummary | null>(null);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [spendDist, setSpendDist] = useState<{ categories: SpendCategoryDistribution[]; total: number }>({
    categories: [],
    total: 0,
  });
  const [plantLocations, setPlantLocations] = useState<PlantLocationStatus[]>([]);
  const [recentPOs, setRecentPOs] = useState<PurchaseOrder[]>([]);
  const [criticalStock, setCriticalStock] = useState<CriticalStockItem[]>([]);
  const [operationalKPIs, setOperationalKPIs] = useState<OperationalKPIs | null>(null);

  // Role Permissions Checks (Role-aware widgets)
  const canViewProcurement = can({ module: 'MM', activity: 'view' });
  const canViewInventory = can({ module: 'WM', activity: 'view' });
  const canViewFleet = can({ module: 'TM', activity: 'view' });
  const canViewAssets = can({ module: 'AM', activity: 'view' });
  const canViewFinance = can({ module: 'FI', activity: 'view' });

  const loadDashboardData = useCallback(async (days: 30 | 90 | 365 = 30) => {
    setIsLoading(true);
    try {
      const [kpis, trends, spend, plants, pos, stockAlerts, opKpis] = await Promise.all([
        DashboardService.getKPISummary(),
        DashboardService.getProcurementTrends(days),
        DashboardService.getSpendDistribution(),
        DashboardService.getPlantLocations(),
        DashboardService.getLatestPurchaseOrders(5),
        DashboardService.getCriticalStockAlerts(),
        DashboardService.getOperationalKPIs(),
      ]);

      setKpiSummary(kpis);
      setTrendData(trends);
      setSpendDist(spend);
      setPlantLocations(plants);
      setRecentPOs(pos);
      setCriticalStock(stockAlerts);
      setOperationalKPIs(opKpis);

      const now = new Date();
      setLastUpdated(now.toLocaleTimeString('ar-SA-u-ca-gregory-nu-latn', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      error('خطأ في تحميل البيانات', 'تعذر جلب البيانات التشغيلية للوحة التحكم.');
    } finally {
      setIsLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadDashboardData(trendDays);
  }, [loadDashboardData, trendDays]);

  const handleRefresh = async () => {
    await loadDashboardData(trendDays);
    success('تم تحديث البيانات', 'كافة مؤشرات لوحة التحكم متزامنة الآن مع قاعدة البيانات المحلية.');
  };

  const handlePeriodChange = (days: 30 | 90 | 365) => {
    setTrendDays(days);
    DashboardService.getProcurementTrends(days).then((data) => setTrendData(data));
  };

  if (isLoading && !kpiSummary) {
    return <ScreenSkeleton />;
  }

  // Format today's date in Gregorian with Arabic month names (e.g., "3 أكتوبر 2026")
  const todayFormatted = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const userName = user?.fullName || 'م. أحمد الشمري';

  return (
    <div className="space-y-6">
      {/* 1. Greeting Row */}
      <div className="bg-white rounded-[16px] border border-[#E5EAF2] p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 text-start">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black text-[#0B2545] tracking-tight">
              مرحباً، {userName}
            </h1>
            <span className="p-1 rounded-lg bg-emerald-50 text-[#0FA37F]">
              <Sparkles className="w-4 h-4" />
            </span>
          </div>
          <p className="text-xs text-[#64748B]">
            نظام طاقة الخليج ERP الموحد — المتابعة التشغيلية والمالية الفورية لقطاع النفط والغاز وسلاسل الإمداد
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {/* Gregorian Date with Arabic Month */}
          <div className="flex items-center gap-2 bg-[#F4F7FB] border border-[#E5EAF2] px-3 py-1.5 rounded-xl text-xs text-[#0F172A] font-semibold">
            <Calendar className="w-3.5 h-3.5 text-[#0FA37F]" />
            <span>{todayFormatted}</span>
          </div>

          {/* Last updated & refresh button */}
          <div className="flex items-center gap-2 bg-[#F4F7FB] border border-[#E5EAF2] px-3 py-1.5 rounded-xl text-xs text-[#64748B]">
            <Clock className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>آخر تحديث: <strong className="font-mono text-[#0F172A]">{lastUpdated}</strong></span>
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={handleRefresh}
            title="تحديث كافة مؤشرات لوحة التحكم"
          >
            تحديث
          </Button>
        </div>
      </div>

      {/* 2. Row 1: 4 StatCards (Role-aware & Clickable to respective modules) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: In-progress operations (Fleet / Procurement) */}
        {canViewFleet ? (
          <div
            onClick={() => navigate('/fleet/trips')}
            className="cursor-pointer transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <StatCard
              label="شحنات / طلبات قيد التنفيذ"
              value={`${formatNumber(kpiSummary?.inProgressCount || 28)} عملية`}
              icon={<Truck className="w-5 h-5 text-[#2563EB]" />}
              trend={{
                value: kpiSummary?.inProgressTrend || 12.5,
                isPositive: true,
                label: 'مقارنة بالأسبوع السابق',
              }}
              subtitle="رحلات صهاريج نشطة وأوامر توريد جارية"
            />
          </div>
        ) : null}

        {/* Card 2: Total procurement this month (Procurement) */}
        {canViewProcurement ? (
          <div
            onClick={() => navigate('/procurement/po')}
            className="cursor-pointer transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <StatCard
              label="إجمالي قيمة المشتريات هذا الشهر"
              value={formatCurrency(kpiSummary?.monthlyProcurementTotal || 0, 'SAR')}
              icon={<ShoppingCart className="w-5 h-5 text-[#0FA37F]" />}
              trend={{
                value: kpiSummary?.monthlyProcurementTrend || 8.4,
                isPositive: true,
                label: 'معدل الإنفاق الشهري المعتمد',
              }}
              subtitle="أوامر شراء معتمدة ومفتوحة للتوريد"
            />
          </div>
        ) : null}

        {/* Card 3: Inventory valuation (Inventory / Warehouses) */}
        {canViewInventory ? (
          <div
            onClick={() => navigate('/inventory/stock')}
            className="cursor-pointer transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <StatCard
              label="قيمة المخزون الحالي (Stock Valuation)"
              value={formatCurrency(kpiSummary?.inventoryValuation || 0, 'SAR')}
              icon={<Boxes className="w-5 h-5 text-[#F59E0B]" />}
              trend={{
                value: kpiSummary?.inventoryValuationTrend || -1.8,
                isPositive: false,
                label: 'سحب مواد للتشغيل الميداني',
              }}
              subtitle="أرصدة المستودعات والمحطات المركزية"
            />
          </div>
        ) : null}

        {/* Card 4: Fixed assets net book value (Fixed Assets) */}
        {canViewAssets ? (
          <div
            onClick={() => navigate('/assets/register')}
            className="cursor-pointer transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <StatCard
              label="الأصول الثابتة (القيمة الدفترية الصافية)"
              value={formatCurrency(kpiSummary?.fixedAssetsNetValue || 0, 'SAR')}
              icon={<Building className="w-5 h-5 text-[#0B2545]" />}
              trend={{
                value: kpiSummary?.fixedAssetsTrend || 3.2,
                isPositive: true,
                label: 'صافي القيمة بعد خصم الاستهلاك',
              }}
              subtitle="خزانات، حفارات، ومضخات هيدروليكية"
            />
          </div>
        ) : null}
      </div>

      {/* 3. Row 2: Visual Analytics (Procurement Trends, Spend Donut, Offline SVG Operations Map) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* (a) Line/Area Chart: Procurement Over Time (5 cols) */}
        {canViewProcurement ? (
          <Card className="lg:col-span-5 p-5">
            <ProcurementTrendChart
              data={trendData}
              selectedDays={trendDays}
              onPeriodChange={handlePeriodChange}
            />
          </Card>
        ) : null}

        {/* (b) Donut Chart: Spend by Category (3 cols) */}
        {canViewProcurement ? (
          <Card className="lg:col-span-3 p-5">
            <SpendDistributionDonut
              categories={spendDist.categories}
              total={spendDist.total}
            />
          </Card>
        ) : null}

        {/* (c) Offline SVG Operations Map (4 cols) */}
        <Card className="lg:col-span-4 p-5">
          <OperationsMapCard locations={plantLocations} />
        </Card>
      </div>

      {/* 4. Row 3: Operational Feeds (Recent POs, Low Stock Alerts, Key Operational KPIs) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* (a) Recent Purchase Orders Table (5 cols) */}
        {canViewProcurement ? (
          <Card className="lg:col-span-5 p-5" noPadding={false}>
            <RecentOrdersTable orders={recentPOs} />
          </Card>
        ) : null}

        {/* (b) Critical / Low Stock Alerts (3 cols) */}
        {canViewInventory ? (
          <Card className="lg:col-span-3 p-5">
            <LowStockAlertsList alerts={criticalStock} />
          </Card>
        ) : null}

        {/* (c) Key Performance Indicators (4 cols) */}
        <Card className="lg:col-span-4 p-5">
          {operationalKPIs && <KPIMetricsCard kpis={operationalKPIs} />}
        </Card>
      </div>
    </div>
  );
};
