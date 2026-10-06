import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { db } from '../../../core/db';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Filter,
  Calendar,
  Building,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Package,
  Truck,
  Landmark,
  Building2,
} from 'lucide-react';

type DepartmentId = 'procurement' | 'inventory' | 'fleet' | 'assets' | 'finance';

interface DepartmentDashboardsViewProps {
  onSelectReport: (reportId: string) => void;
}

const COLORS = ['#0B2545', '#0FA37F', '#2563EB', '#F59E0B', '#8B5CF6', '#EC4899'];

export const DepartmentDashboardsView: React.FC<DepartmentDashboardsViewProps> = ({
  onSelectReport,
}) => {
  const [selectedDept, setSelectedDept] = useState<DepartmentId>('procurement');

  // Unified Global Filters
  const [dateRange, setDateRange] = useState<string>('YTD');
  const [selectedPlant, setSelectedPlant] = useState<string>('all');
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>('all');

  // Cross-Filter Selection State (e.g. user clicked a plant or category in a chart)
  const [crossFilterKey, setCrossFilterKey] = useState<string | null>(null);
  const [crossFilterValue, setCrossFilterValue] = useState<string | null>(null);

  // Departments List
  const departments: Array<{ id: DepartmentId; label: string; icon: typeof Package }> = [
    { id: 'procurement', label: 'المشتريات والتوريد', icon: Package },
    { id: 'inventory', label: 'المستودعات والمخزون', icon: Building },
    { id: 'fleet', label: 'الأسطول والنقل اللوجستي', icon: Truck },
    { id: 'assets', label: 'الأصول والمعدات الرأسمالية', icon: Building2 },
    { id: 'finance', label: 'المحاسبة والمالية', icon: Landmark },
  ];

  // 1. Procurement Data Mock/Calculated
  const procurementSpendByCategory = [
    { name: 'محروقات ووقود', value: 4850000, plant: 'PL-101' },
    { name: 'قطع غيار شاحنات', value: 920000, plant: 'PL-102' },
    { name: 'صمامات وأنابيب ضغط', value: 1450000, plant: 'PL-103' },
    { name: 'معدات أمان وسلامة', value: 380000, plant: 'PL-101' },
    { name: 'كيماويات تكرير', value: 750000, plant: 'PL-104' },
  ];

  const procurementMonthlyVolume = [
    { month: 'مايو', orders: 28, amount: 1100000 },
    { month: 'يونيو', orders: 35, amount: 1350000 },
    { month: 'يوليو', orders: 42, amount: 1680000 },
    { month: 'أغسطس', orders: 39, amount: 1520000 },
    { month: 'سبتمبر', orders: 48, amount: 1890000 },
  ];

  // 2. Inventory Data
  const stockByPlant = [
    { name: 'محطة الرياض (PL-101)', value: 3850000, plant: 'PL-101' },
    { name: 'محطة جدة (PL-102)', value: 2900000, plant: 'PL-102' },
    { name: 'محطة الدمام (PL-103)', value: 2450000, plant: 'PL-103' },
    { name: 'مصفاة ينبع (PL-104)', value: 4100000, plant: 'PL-104' },
  ];

  const stockTurnoverTrend = [
    { month: 'مايو', rate: 5.2 },
    { month: 'يونيو', rate: 5.5 },
    { month: 'يوليو', rate: 5.7 },
    { month: 'أغسطس', rate: 5.6 },
    { month: 'سبتمبر', rate: 6.1 },
  ];

  // 3. Fleet Data
  const fleetCostByVehicle = [
    { code: 'VH-1001 (أكتروس صهريج)', fuel: 24500, maintenance: 8500, plant: 'PL-101' },
    { code: 'VH-1002 (أكتروس مقطورة)', fuel: 28900, maintenance: 12400, plant: 'PL-102' },
    { code: 'VH-1003 (فولفو صهريج)', fuel: 22100, maintenance: 6200, plant: 'PL-103' },
    { code: 'VH-1004 (مان صهريج)', fuel: 19800, maintenance: 4100, plant: 'PL-101' },
  ];

  // 4. Assets Data
  const assetValuesByClass = [
    { name: 'محطات وخزانات ضخ', value: 8500000, plant: 'PL-101' },
    { name: 'أسطول شاحنات وصهاريج', value: 6200000, plant: 'PL-102' },
    { name: 'مباني ومستودعات تخزين', value: 4800000, plant: 'PL-103' },
    { name: 'معدات فحص وتوزيع', value: 1900000, plant: 'PL-104' },
  ];

  // 5. Finance Data
  const financeRevenueExpenses = [
    { month: 'مايو', revenue: 3800000, expense: 2900000 },
    { month: 'يونيو', revenue: 4100000, expense: 3150000 },
    { month: 'يوليو', revenue: 4600000, expense: 3400000 },
    { month: 'أغسطس', revenue: 4400000, expense: 3350000 },
    { month: 'سبتمبر', revenue: 4950000, expense: 3600000 },
  ];

  const handleChartClick = (key: string, value: string) => {
    if (crossFilterKey === key && crossFilterValue === value) {
      // Toggle off
      setCrossFilterKey(null);
      setCrossFilterValue(null);
    } else {
      setCrossFilterKey(key);
      setCrossFilterValue(value);
    }
  };

  const clearCrossFilter = () => {
    setCrossFilterKey(null);
    setCrossFilterValue(null);
  };

  return (
    <div className="space-y-6">
      {/* Department Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        {departments.map((dept) => {
          const Icon = dept.icon;
          const isActive = selectedDept === dept.id;
          return (
            <button
              key={dept.id}
              onClick={() => {
                setSelectedDept(dept.id);
                clearCrossFilter();
              }}
              className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                isActive
                  ? 'bg-[#0B2545] text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>{dept.label}</span>
            </button>
          );
        })}
      </div>

      {/* Global Filter Bar */}
      <Card className="p-4 border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <Filter className="w-4 h-4 text-emerald-600" />
              <span>معايير العرض الشاملة:</span>
            </div>

            {/* Date Range Selector */}
            <div className="flex items-center gap-1.5">
              <label className="text-slate-500">الفترة الزمنية:</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="h-8 px-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
              >
                <option value="YTD">العام المالي حتى تاريخه (YTD 2026)</option>
                <option value="Q3">الربع الثالث (Q3 2026)</option>
                <option value="Q2">الربع الثاني (Q2 2026)</option>
                <option value="Q1">الربع الأول (Q1 2026)</option>
                <option value="L30">آخر 30 يوماً</option>
              </select>
            </div>

            {/* Plant Selector */}
            <div className="flex items-center gap-1.5">
              <label className="text-slate-500">المحطة / المنشأة:</label>
              <select
                value={selectedPlant}
                onChange={(e) => setSelectedPlant(e.target.value)}
                className="h-8 px-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
              >
                <option value="all">كافة المنشآت والمحطات</option>
                <option value="PL-101">محطة الرياض المركزية (PL-101)</option>
                <option value="PL-102">محطة جدة الساحلية (PL-102)</option>
                <option value="PL-103">محطة الظهران البترولية (PL-103)</option>
                <option value="PL-104">مصفاة ينبع (PL-104)</option>
              </select>
            </div>

            {/* Cost Center Selector */}
            <div className="flex items-center gap-1.5">
              <label className="text-slate-500">مركز التكلفة:</label>
              <select
                value={selectedCostCenter}
                onChange={(e) => setSelectedCostCenter(e.target.value)}
                className="h-8 px-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
              >
                <option value="all">كافة مراكز التكلفة</option>
                <option value="CC-1001">الإدارة العامة والتشغيل (CC-1001)</option>
                <option value="CC-1002">إدارة أسطول النقل اللوجستي (CC-1002)</option>
                <option value="CC-2001">مستودع رابغ المركزي (CC-2001)</option>
                <option value="CC-3001">محطة التوزيع والضخ (CC-3001)</option>
              </select>
            </div>
          </div>

          {/* Cross Filter Active Indicator */}
          {crossFilterKey && crossFilterValue && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs">
              <span className="text-emerald-800 font-bold">
                تصفية تقاطعية نشطة: {crossFilterValue}
              </span>
              <button
                onClick={clearCrossFilter}
                className="text-xs font-bold text-emerald-900 hover:text-emerald-700 underline cursor-pointer"
              >
                إلغاء التصفية
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Dynamic Department Visualizations                                */}
      {/* ----------------------------------------------------------------- */}

      {/* 1. Procurement Dashboard */}
      {selectedDept === 'procurement' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Spend by Category Donut */}
            <Card className="p-5 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-[#0B2545]">
                  توزيع الإنفاق الشرائي حسب تصنيف المواد (انقر للتصفية التقاطعية)
                </h3>
                <span className="text-[10px] text-slate-400">YTD 2026</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={procurementSpendByCategory}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                      onClick={(entry) => handleChartClick('category', (entry && 'name' in entry ? String(entry.name) : ''))}
                      className="cursor-pointer"
                    >
                      {procurementSpendByCategory.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          opacity={crossFilterValue && crossFilterValue !== entry.name ? 0.35 : 1}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number | string | undefined) => `${Number(v || 0).toLocaleString('en-US')} ر.س`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Monthly PO Volume and Value */}
            <Card className="p-5 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-[#0B2545]">
                  حجم وقيم أوامر الشراء الصادرة شهرياً
                </h3>
                <span className="text-[10px] text-slate-400">آخر 5 شهور</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={procurementMonthlyVolume} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                    <Tooltip formatter={(v: number | string | undefined) => `${Number(v || 0).toLocaleString('en-US')} ر.س`} />
                    <Bar dataKey="amount" name="قيمة المشتريات (ر.س)" fill="#0B2545" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* 2. Inventory Dashboard */}
      {selectedDept === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-[#0B2545]">
                  قيمة المخزون السلعي حسب المحطة (انقر للتصفية)
                </h3>
                <span className="text-[10px] text-slate-400">رصيد دفتري فعلي</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stockByPlant} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                    <Tooltip formatter={(v: number | string | undefined) => `${Number(v || 0).toLocaleString('en-US')} ر.س`} />
                    <Bar
                      dataKey="value"
                      name="قيمة المخزون"
                      fill="#0FA37F"
                      radius={[6, 6, 0, 0]}
                      onClick={(entry: { plant?: string; name?: string }) => handleChartClick('plant', entry?.plant || entry?.name || '')}
                      className="cursor-pointer"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-[#0B2545]">
                  معدل دوران المخزون السنوي (Turnover Ratio)
                </h3>
                <span className="text-[10px] text-emerald-600 font-bold">هدف: 6.0x</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stockTurnoverTrend} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[4, 8]} />
                    <Tooltip formatter={(v: number | string | undefined) => `${v ?? 0} مرة/سنة`} />
                    <Line type="monotone" dataKey="rate" stroke="#0FA37F" strokeWidth={3} dot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* 3. Fleet Dashboard */}
      {selectedDept === 'fleet' && (
        <div className="space-y-6">
          <Card className="p-5 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-[#0B2545]">
                تحليل تكاليف الوقود والصيانة حسب شاحنة النقل اللوجستي
              </h3>
              <span className="text-[10px] text-slate-400">بيانات تشغيلية فعلية</span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fleetCostByVehicle} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="code" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number | string | undefined) => `${Number(v || 0).toLocaleString('en-US')} ر.س`} />
                  <Legend />
                  <Bar dataKey="fuel" name="تكلفة الوقود المعبأ" fill="#2563EB" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="maintenance" name="تكاليف الصيانة وقطع الغيار" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* 4. Assets Dashboard */}
      {selectedDept === 'assets' && (
        <div className="space-y-6">
          <Card className="p-5 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-[#0B2545]">
                القيمة التاريخية للأصول والمعدات الرأسمالية حسب التصنيف
              </h3>
              <span className="text-[10px] text-slate-400">إجمالي 21.4M ر.س</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assetValuesByClass} layout="vertical" margin={{ top: 10, right: 30, left: 30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={140} />
                  <Tooltip formatter={(v: number | string | undefined) => `${Number(v || 0).toLocaleString('en-US')} ر.س`} />
                  <Bar dataKey="value" name="القيمة الرأسمالية" fill="#0B2545" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* 5. Finance Dashboard */}
      {selectedDept === 'finance' && (
        <div className="space-y-6">
          <Card className="p-5 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-[#0B2545]">
                مقارنة الإيرادات التشغيلية الشهرية مع إجمالي المصروفات (P&L Trend)
              </h3>
              <span className="text-[10px] text-emerald-600 font-bold">هامش صافي ربح إيجابي</span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financeRevenueExpenses} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip formatter={(v: number | string | undefined) => `${Number(v || 0).toLocaleString('en-US')} ر.س`} />
                  <Legend />
                  <Bar dataKey="revenue" name="إيرادات مبيعات الطاقة" fill="#0FA37F" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expense" name="المصروفات والتكاليف" fill="#EF4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
