import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { PredictiveAnalyticsService } from '../services/PredictiveAnalyticsService';
import type { ForecastResult, AnomalyItem } from '../../../types/models';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Package,
  Truck,
  ShoppingCart,
  RefreshCw,
  Info,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

export const PredictiveAnalyticsView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'material-demand' | 'cost-forecast' | 'anomalies'>(
    'material-demand'
  );

  // Material Demand Forecast State
  const [selectedMaterial, setSelectedMaterial] = useState<string>('MAT-10001');
  const [materialForecast, setMaterialForecast] = useState<ForecastResult | null>(null);
  const [isLoadingMat, setIsLoadingMat] = useState(false);

  // Cost Forecast State
  const [costType, setCostType] = useState<'fleet' | 'procurement'>('fleet');
  const [costForecast, setCostForecast] = useState<ForecastResult | null>(null);
  const [isLoadingCost, setIsLoadingCost] = useState(false);

  // Anomalies State
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [isLoadingAnom, setIsLoadingAnom] = useState(false);
  const [anomalyFilter, setAnomalyFilter] = useState<'all' | 'procurement' | 'fleet' | 'inventory'>('all');

  const materialsList = [
    { code: 'MAT-10001', name: 'وقود الديزل عالي النقاء (Euro 5) - لتر' },
    { code: 'MAT-10002', name: 'بنزين ممتاز 95 أوكتان - لتر' },
    { code: 'MAT-20001', name: 'زيت محركات شاحنات ثقيلة 15W-40 - برميل' },
    { code: 'MAT-30001', name: 'صمامات تحكم هيدروليكية ومضخات ضغط - قطعة' },
  ];

  const loadMaterialForecast = async (matCode: string) => {
    setIsLoadingMat(true);
    try {
      const res = await PredictiveAnalyticsService.forecastMaterialDemand(matCode);
      setMaterialForecast(res);
    } finally {
      setIsLoadingMat(false);
    }
  };

  const loadCostForecast = async (type: 'fleet' | 'procurement') => {
    setIsLoadingCost(true);
    try {
      const res = await PredictiveAnalyticsService.forecastOperationalCosts(type);
      setCostForecast(res);
    } finally {
      setIsLoadingCost(false);
    }
  };

  const loadAnomalies = async () => {
    setIsLoadingAnom(true);
    try {
      const list = await PredictiveAnalyticsService.detectAnomalies();
      setAnomalies(list);
    } finally {
      setIsLoadingAnom(false);
    }
  };

  useEffect(() => {
    loadMaterialForecast(selectedMaterial);
    loadCostForecast(costType);
    loadAnomalies();
  }, []);

  const filteredAnomalies =
    anomalyFilter === 'all'
      ? anomalies
      : anomalies.filter((a) => a.domain === anomalyFilter);

  return (
    <div className="space-y-6">
      {/* Sub Tabs Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveSubTab('material-demand')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'material-demand'
                ? 'bg-white text-[#0B2545] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="w-3.5 h-3.5 text-emerald-600" />
            <span>التنبؤ بالطلب على المواد ونقاط الطلب (Demand Forecast & ROP)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('cost-forecast')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'cost-forecast'
                ? 'bg-white text-[#0B2545] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
            <span>توقع التكاليف التشغيلية والمصروفات (Cost Trend Forecast)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('anomalies')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'anomalies'
                ? 'bg-white text-[#0B2545] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            <span>كشف الشذوذ الإحصائي (Z-Score / IQR Outliers) ({anomalies.length})</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>نماذج رياضية خوارزمية مدمجة تعمل محلياً دون أي خوادم خارجية (Offline TS Engine)</span>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 1. Demand Forecast per Material                                   */}
      {/* ----------------------------------------------------------------- */}
      {activeSubTab === 'material-demand' && (
        <div className="space-y-6">
          {/* Material Selector & Model Controls */}
          <Card className="p-4 border border-slate-200 bg-slate-50/60 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700">اختر المادة المراد التنبؤ باحتياجها:</span>
              <select
                value={selectedMaterial}
                onChange={(e) => {
                  setSelectedMaterial(e.target.value);
                  loadMaterialForecast(e.target.value);
                }}
                className="h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 min-w-[280px]"
              >
                {materialsList.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.code} - {m.name}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadMaterialForecast(selectedMaterial)}
              disabled={isLoadingMat}
              className="gap-1.5 text-xs font-bold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMat ? 'animate-spin' : ''}`} />
              <span>إعادة احتساب وتدريب النماذج</span>
            </Button>
          </Card>

          {/* Forecast Chart & Confidence Bands */}
          {materialForecast && (
            <div className="space-y-5">
              {/* Algorithm Metrics Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4 border border-slate-200 bg-white space-y-1">
                  <span className="text-[11px] text-slate-500 font-bold block">النموذج المختار تلقائياً</span>
                  <div className="text-sm font-black text-[#0B2545] font-sans">
                    {materialForecast.selectedModel === 'EXPONENTIAL_SMOOTHING'
                      ? 'التمهيد الأسي البسيط (SES)'
                      : materialForecast.selectedModel === 'SEASONAL_DECOMPOSITION'
                      ? 'التحليل الموسمي (Seasonal)'
                      : 'المتوسط المتحرك (SMA)'}
                  </div>
                  <span className="text-[10px] text-emerald-600 font-bold block">
                    حقّق أدنى نسبة خطأ بين النماذج
                  </span>
                </Card>

                <Card className="p-4 border border-slate-200 bg-white space-y-1">
                  <span className="text-[11px] text-slate-500 font-bold block">معدل دقة التنبؤ (1 - MAPE)</span>
                  <div className="text-xl font-black text-emerald-600 font-sans">
                    {(100 - materialForecast.modelAccuracyMape).toFixed(1)}%
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    معدل الخطأ النسبي: {materialForecast.modelAccuracyMape}%
                  </span>
                </Card>

                <Card className="p-4 border border-slate-200 bg-white space-y-1">
                  <span className="text-[11px] text-slate-500 font-bold block">نقطة إعادة الطلب المقترحة (ROP)</span>
                  <div className="text-xl font-black text-blue-700 font-sans">
                    {materialForecast.suggestedReorderPoint?.toLocaleString('en-US')} وحدة
                  </div>
                  <span className="text-[10px] text-slate-400">
                    تشمل فترة التوريد (14 يوماً) + مخزون الأمان
                  </span>
                </Card>

                <Card className="p-4 border border-slate-200 bg-white space-y-1">
                  <span className="text-[11px] text-slate-500 font-bold block">حجم الطلبية الاقتصادي (EOQ)</span>
                  <div className="text-xl font-black text-[#0B2545] font-sans">
                    {materialForecast.economicOrderQuantity?.toLocaleString('en-US')} وحدة
                  </div>
                  <span className="text-[10px] text-slate-400">
                    يوازن تكاليف الإصدار مع مصاريف الاحتفاظ
                  </span>
                </Card>
              </div>

              {/* Chart Card */}
              <Card className="p-6 border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#0B2545]">{materialForecast.seriesName}</h3>
                    <p className="text-xs text-slate-500">
                      مقارنة بين الاستهلاك الفعلي السابق مع التنبؤ المستقبلي للأشهر الثلاثة القادمة بنطاق ثقة 95%.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 font-bold text-slate-700">
                      <span className="w-3 h-0.5 bg-[#0B2545]"></span> الفعلي السابق
                    </span>
                    <span className="flex items-center gap-1.5 font-bold text-blue-600">
                      <span className="w-3 h-0.5 bg-blue-600 border-dashed"></span> التنبؤ المستقبلي
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <span className="w-3 h-3 bg-blue-200/50 rounded-xs"></span> نطاق الثقة (±1.96σ)
                    </span>
                  </div>
                </div>

                <div className="h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={materialForecast.points} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="period" tick={{ fill: '#64748B', fontSize: 11 }} />
                      <YAxis
                        tick={{ fill: '#64748B', fontSize: 11 }}
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload || !payload.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="p-3 bg-[#0B2545] text-white rounded-xl shadow-xl text-xs space-y-1">
                              <div className="font-bold text-emerald-400 border-b border-white/10 pb-1">
                                الفترة: {label} {data.isProjected ? '(توقع مستقبلي)' : '(فعلي مسجل)'}
                              </div>
                              {data.actual !== undefined && (
                                <div>الاستهلاك الفعلي: <span className="font-mono font-bold">{data.actual.toLocaleString('en-US')}</span> وحدة</div>
                              )}
                              <div>التنبؤ الخوارزمي: <span className="font-mono font-bold text-blue-300">{data.forecast.toLocaleString('en-US')}</span> وحدة</div>
                              <div className="text-[10px] text-slate-300">
                                نطاق الثقة: {data.lowerBound.toLocaleString('en-US')} إلى {data.upperBound.toLocaleString('en-US')} وحدة
                              </div>
                            </div>
                          );
                        }}
                      />
                      {/* Confidence Band Area */}
                      <Area
                        type="monotone"
                        dataKey="upperBound"
                        stroke="none"
                        fill="#3B82F6"
                        fillOpacity={0.12}
                        name="نطاق الثقة الأعلى"
                      />
                      <Area
                        type="monotone"
                        dataKey="lowerBound"
                        stroke="none"
                        fill="#FFFFFF"
                        fillOpacity={1}
                        name="نطاق الثقة الأدنى"
                      />
                      {/* Actual Historical Line */}
                      <Line
                        type="monotone"
                        dataKey="actual"
                        stroke="#0B2545"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#0B2545' }}
                        name="الاستهلاك الفعلي"
                      />
                      {/* Forecast Line */}
                      <Line
                        type="monotone"
                        dataKey="forecast"
                        stroke="#2563EB"
                        strokeWidth={2.5}
                        strokeDasharray="4 4"
                        dot={{ r: 4, fill: '#2563EB' }}
                        name="التنبؤ الخوارزمي"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Plain-Arabic Explanation Callout */}
                <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-start gap-3">
                  <Info className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-emerald-950 block">تحليل الذكاء الإحصائي للطلب:</span>
                    <p className="text-xs text-emerald-900 leading-relaxed font-sans">
                      {materialForecast.explanationArabic}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 2. Cost Forecast (Fleet vs Procurement)                           */}
      {/* ----------------------------------------------------------------- */}
      {activeSubTab === 'cost-forecast' && (
        <div className="space-y-6">
          <Card className="p-4 border border-slate-200 bg-slate-50/60 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700">المجال التشغيلي للتنبؤ بالمصروفات:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setCostType('fleet');
                    loadCostForecast('fleet');
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    costType === 'fleet' ? 'bg-[#0B2545] text-white' : 'bg-white text-slate-700 border border-slate-300'
                  }`}
                >
                  تكاليف أسطول النقل والوقود والصيانة
                </button>
                <button
                  onClick={() => {
                    setCostType('procurement');
                    loadCostForecast('procurement');
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    costType === 'procurement' ? 'bg-[#0B2545] text-white' : 'bg-white text-slate-700 border border-slate-300'
                  }`}
                >
                  الإنفاق الرأسمالي والتوريدات
                </button>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadCostForecast(costType)}
              disabled={isLoadingCost}
              className="gap-1.5 text-xs font-bold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCost ? 'animate-spin' : ''}`} />
              <span>تحديث التنبؤ</span>
            </Button>
          </Card>

          {costForecast && (
            <Card className="p-6 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#0B2545]">{costForecast.seriesName}</h3>
                  <p className="text-xs text-slate-500">
                    نموذج الانحدار الخطي مع التعديل الموسمي الدوري للربع الرابع 2026.
                  </p>
                </div>
                <div className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                  دقة النموذج: {(100 - costForecast.modelAccuracyMape).toFixed(1)}%
                </div>
              </div>

              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={costForecast.points} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="period" tick={{ fill: '#64748B', fontSize: 11 }} />
                    <YAxis
                      tick={{ fill: '#64748B', fontSize: 11 }}
                      tickFormatter={(v) => `${(v / 1000).toLocaleString('en-US')}k`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="p-3 bg-[#0B2545] text-white rounded-xl shadow-xl text-xs space-y-1">
                            <div className="font-bold text-emerald-400 border-b border-white/10 pb-1">
                              الفترة: {label} {data.isProjected ? '(توقع مستقبلي)' : '(فعلي)'}
                            </div>
                            {data.actual !== undefined && (
                              <div>المصروف الفعلي: <span className="font-mono font-bold">{data.actual.toLocaleString('en-US')}</span> ر.س</div>
                            )}
                            <div>التوقع الخوارزمي: <span className="font-mono font-bold text-blue-300">{data.forecast.toLocaleString('en-US')}</span> ر.س</div>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="upperBound"
                      stroke="none"
                      fill="#3B82F6"
                      fillOpacity={0.12}
                    />
                    <Area
                      type="monotone"
                      dataKey="lowerBound"
                      stroke="none"
                      fill="#FFFFFF"
                      fillOpacity={1}
                    />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke="#0B2545"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#0B2545' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      stroke="#2563EB"
                      strokeWidth={2.5}
                      strokeDasharray="4 4"
                      dot={{ r: 4, fill: '#2563EB' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-blue-950 block">ملاحظات التنبؤ بالتكاليف:</span>
                  <p className="text-xs text-blue-900 leading-relaxed font-sans">
                    {costForecast.explanationArabic}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 3. Anomaly Detection (Z-Score & IQR)                              */}
      {/* ----------------------------------------------------------------- */}
      {activeSubTab === 'anomalies' && (
        <div className="space-y-5">
          {/* Filters Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
              {[
                { id: 'all', label: `كافة الحالات الشاذة (${anomalies.length})` },
                { id: 'procurement', label: 'المشتريات والإنفاق' },
                { id: 'fleet', label: 'الأسطول والوقود' },
                { id: 'inventory', label: 'حركات المخزون' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setAnomalyFilter(tab.id as any)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    anomalyFilter === tab.id
                      ? 'bg-white text-[#0B2545] shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={loadAnomalies}
              disabled={isLoadingAnom}
              className="gap-1.5 text-xs font-bold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAnom ? 'animate-spin' : ''}`} />
              <span>إعادة فحص الشذوذ</span>
            </Button>
          </div>

          {/* Anomaly Cards List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAnomalies.map((anom) => (
              <Card
                key={anom.id}
                className="p-5 border border-slate-200 hover:border-slate-300 shadow-sm space-y-3 bg-white"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold font-mono text-slate-400 uppercase">
                      {anom.domain} · {anom.date}
                    </span>
                    <h4 className="text-xs font-bold text-[#0B2545] line-clamp-1">{anom.entityName}</h4>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      anom.severity === 'high'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    انحراف {anom.severity === 'high' ? 'حرج' : 'متوسط'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>المقياس الإحصائي:</span>
                    <span className="font-bold text-slate-800">{anom.metric}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>القيمة المسجلة الفعلية:</span>
                    <span className="font-mono font-bold text-rose-700">
                      {anom.actualValue.toLocaleString('en-US')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span>المتوسط المتوقع (Mean):</span>
                    <span className="font-mono">{anom.expectedMean.toLocaleString('en-US')}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 text-[11px] pt-1 border-t border-slate-200/60">
                    <span>مؤشر الشذوذ (Z-Score):</span>
                    <span className="font-mono font-bold text-slate-900">{anom.zScore}σ</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed font-sans">
                  {anom.explanationArabic}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
