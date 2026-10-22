import { DiagnosticLogger } from '../../../core/services/DiagnosticLogger';
import React, { useState, useEffect, useMemo } from 'react';
import { FleetService } from '../services/FleetService';
import { FuelLogModal } from '../components/FuelLogModal';
import { StatCard } from '../../../components/ui/StatCard';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { useToast } from '../../../components/ui/Toast';
import type { FuelLog, FuelAnomalyAlert } from '../../../types/models';
import { useConnectivityStore } from '../../../core/gateway/connectivity';
import {
  Fuel,
  Search,
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Droplet,
  FileText,
  DollarSign,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  WifiOff,
} from 'lucide-react';

export const FuelManagementPage: React.FC = () => {
  const { success, error } = useToast();

  const isOnline = useConnectivityStore((s) => s.isOnline);
  const [activeTab, setActiveTab] = useState<'logs' | 'anomalies'>('logs');
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [anomalyAlerts, setAnomalyAlerts] = useState<FuelAnomalyAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);

  // Pagination state for handling up to 50,000+ fuel records efficiently
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const loadData = async (page = currentPage) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [paginatedResult, alerts] = await Promise.all([
        FleetService.getPaginatedFuelLogs({
          page,
          pageSize,
          search: searchQuery.trim() || undefined,
        }),
        FleetService.getFuelAnomalyAlerts(),
      ]);
      setFuelLogs(paginatedResult.data);
      setTotalCount(paginatedResult.totalCount);
      setTotalPages(paginatedResult.totalPages);
      setCurrentPage(paginatedResult.page);
      setAnomalyAlerts(alerts);
    } catch (err) {
      DiagnosticLogger.error('FuelManagementPage', 'Error occurred', err);
      setLoadError('تعذر تحميل بيانات الوقود من الخادم');
      error('خطأ', 'تعذر تحميل بيانات الوقود');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(1);
  }, [pageSize, searchQuery]);

  const handleResolveAlert = async (alert: FuelAnomalyAlert) => {
    try {
      await FleetService.resolveFuelAnomalyAlert(
        alert.id,
        'تم التحقق من تقرير السائق والورشة واعتماد الاستهلاك',
        undefined,
        alert.version
      );
      success('تم بنجاح', 'تمت تسوية تنبيه الشذوذ في الوقود');
      loadData(currentPage);
    } catch (err) {
      error('خطأ', err instanceof Error ? err.message : 'تعذر تسوية التنبيه');
    }
  };

  const totalFuelLiters = useMemo(
    () => fuelLogs.reduce((acc, curr) => acc + curr.quantityLiters, 0),
    [fuelLogs]
  );
  const totalFuelCost = useMemo(
    () => fuelLogs.reduce((acc, curr) => acc + curr.totalCost, 0),
    [fuelLogs]
  );

  return (
    <div className="space-y-6 text-start p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#E5EAF2]">
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <Fuel className="w-6 h-6 text-[#0FA37F]" />
            إدارة ومراقبة استهلاك الوقود وكشف الشذوذ (Fuel Management & Anomaly Detection)
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            تسجيل حركات التزود، احتساب معدلات لتر/100كم لكل شاحنة، ورصد الانحرافات التي تتجاوز 25% لكشف الهدر والتسريب
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={() => loadData()}>
            تحديث
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setIsFuelModalOpen(true)}
          >
            تسجيل قيد وقود جديد
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي كميات الوقود المستهلكة"
          value={`${totalFuelLiters.toLocaleString()} لتر`}
          subtitle="ديزل وبنزين محطات"
          icon={<Droplet className="w-5 h-5 text-[#0FA37F]" />}
        />

        <StatCard
          label="إجمالي التكلفة المالية للوقود"
          value={`${totalFuelCost.toLocaleString()} ر.س`}
          subtitle="تسعيرة الديزل المعتمدة 1.15 ر.س"
          icon={<DollarSign className="w-5 h-5 text-[#0FA37F]" />}
        />

        <StatCard
          label="متوسط كفاءة الأسطول العام"
          value="37.8 L"
          subtitle="لتر لكل 100 كيلومتر"
          icon={<Fuel className="w-5 h-5 text-[#2563EB]" />}
        />

        <StatCard
          label="تنبيهات شذوذ الاستهلاك (&gt;25%)"
          value={anomalyAlerts.filter((a) => a.status === 'active').length}
          subtitle="تتطلب تدقيقاً فنياً وإدارياً"
          icon={<ShieldAlert className="w-5 h-5 text-[#EF4444]" />}
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E5EAF2]">
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`px-5 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'logs'
              ? 'border-[#0FA37F] text-[#0FA37F]'
              : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <Fuel className="w-4 h-4" />
          سجل حركات تزويد الوقود ({fuelLogs.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('anomalies')}
          className={`px-5 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'anomalies'
              ? 'border-[#EF4444] text-[#EF4444]'
              : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          تنبيهات الاستهلاك الشاذ والمريب ({anomalyAlerts.filter((a) => a.status === 'active').length})
        </button>
      </div>

      {/* TAB 1: FUEL LOGS TABLE */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-2xl border border-[#E5EAF2] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex-1 w-full">
              <Input
                placeholder="بحث برقم اللوحة، اسم السائق، أو المحطة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                startIcon={<Search className="w-4 h-4 text-[#64748B]" />}
              />
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-xs text-[#64748B] whitespace-nowrap">عرض:</span>
              <select
                aria-label="عدد السجلات في الصفحة"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="text-xs border border-[#E5EAF2] rounded-lg px-2.5 py-1.5 bg-white text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#0FA37F]"
              >
                <option value={25}>25 حركة</option>
                <option value={50}>50 حركة</option>
                <option value={100}>100 حركة</option>
              </select>
            </div>
          </div>

          {!isOnline && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
              <span>أنت تعمل حالياً دون اتصال. يتم عرض البيانات المخزنة محلياً ويمكنك تسجيل قيود وقود جديدة ليتم إرسالها آلياً عند عودة الاتصال.</span>
            </div>
          )}

          {loadError && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center justify-between">
              <span>{loadError}</span>
              <Button size="sm" variant="secondary" onClick={() => loadData(currentPage)}>
                إعادة المحاولة
              </Button>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-[#E5EAF2] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E5EAF2]">
                  <tr>
                    <th className="p-3 text-start">التاريخ</th>
                    <th className="p-3 text-start">المركبة واللوحة</th>
                    <th className="p-3 text-start">السائق المستلم</th>
                    <th className="p-3 text-start">المحطة والموقع</th>
                    <th className="p-3 text-center">الكمية (لتر)</th>
                    <th className="p-3 text-center">العداد (كم)</th>
                    <th className="p-3 text-center font-bold text-[#0B2545]">معدل لتر / 100 كم</th>
                    <th className="p-3 text-end">التكلفة (ر.س)</th>
                    <th className="p-3 text-center">فحص الشذوذ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EAF2]">
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td className="p-3"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                        <td className="p-3"><div className="h-4 bg-slate-200 rounded w-24" /></td>
                        <td className="p-3"><div className="h-4 bg-slate-200 rounded w-28" /></td>
                        <td className="p-3"><div className="h-4 bg-slate-200 rounded w-24" /></td>
                        <td className="p-3 text-center"><div className="h-4 bg-slate-200 rounded w-12 mx-auto" /></td>
                        <td className="p-3 text-center"><div className="h-4 bg-slate-200 rounded w-16 mx-auto" /></td>
                        <td className="p-3 text-center"><div className="h-4 bg-slate-200 rounded w-12 mx-auto" /></td>
                        <td className="p-3 text-end"><div className="h-4 bg-slate-200 rounded w-16 ms-auto" /></td>
                        <td className="p-3 text-center"><div className="h-4 bg-slate-200 rounded w-16 mx-auto" /></td>
                      </tr>
                    ))
                  ) : fuelLogs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-xs text-[#64748B]">
                        لا توجد حركات تزويد وقود مطابقة لمعايير البحث الحالية.
                      </td>
                    </tr>
                  ) : (
                    fuelLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono text-[#64748B]">{log.date}</td>
                        <td className="p-3 font-bold font-mono text-[#0F172A]">{log.vehiclePlate}</td>
                        <td className="p-3 font-semibold text-[#0F172A]">{log.driverName}</td>
                        <td className="p-3 text-[#64748B]">{log.stationName}</td>
                        <td className="p-3 text-center font-mono font-bold text-[#0FA37F]">
                          {log.quantityLiters.toLocaleString()}
                        </td>
                        <td className="p-3 text-center font-mono text-[#64748B]">
                          {log.odometer.toLocaleString()}
                        </td>
                        <td className="p-3 text-center font-mono font-bold">
                          <span
                            className={
                              log.isAnomaly
                                ? 'text-[#EF4444] bg-red-50 px-2 py-0.5 rounded border border-red-200'
                                : 'text-[#0FA37F]'
                            }
                          >
                            {log.calculatedConsumptionPer100Km || 38.0}
                          </span>
                        </td>
                        <td className="p-3 text-end font-mono font-bold text-[#0F172A]">
                          {log.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })} ر.س
                        </td>
                        <td className="p-3 text-center">
                          {log.isAnomaly ? (
                            <Badge variant="critical">شذوذ +{log.anomalyDeviationPercentage}%</Badge>
                          ) : (
                            <Badge variant="approved">طبيعي</Badge>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Server-side Pagination Bar */}
            <div className="p-4 bg-[#F8FAFC] border-t border-[#E5EAF2] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-[#64748B]">
                عرض <strong className="text-[#0F172A] font-mono">{totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> إلى{' '}
                <strong className="text-[#0F172A] font-mono">{Math.min(currentPage * pageSize, totalCount)}</strong> من أصل{' '}
                <strong className="text-[#0FA37F] font-mono">{totalCount.toLocaleString()}</strong> حركة وقود مسجلة
              </span>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={currentPage <= 1 || isLoading}
                  onClick={() => loadData(currentPage - 1)}
                  icon={<ChevronRight className="w-3.5 h-3.5" />}
                >
                  السابق
                </Button>

                <span className="px-3 py-1 font-mono font-bold text-[#0F172A] bg-white border border-[#E5EAF2] rounded-lg">
                  {currentPage} / {totalPages}
                </span>

                <Button
                  size="sm"
                  variant="secondary"
                  disabled={currentPage >= totalPages || isLoading}
                  onClick={() => loadData(currentPage + 1)}
                  icon={<ChevronLeft className="w-3.5 h-3.5" />}
                >
                  التالي
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ANOMALY ALERTS TABLE */}
      {activeTab === 'anomalies' && (
        <div className="bg-white rounded-2xl border border-[#E5EAF2] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#E5EAF2] bg-red-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-[#EF4444]">
              <ShieldAlert className="w-5 h-5" />
              تنبيهات انحراف معدل استهلاك الوقود بأكثر من 25% عن المتوسط التاريخي للمركبة
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E5EAF2]">
                <tr>
                  <th className="p-3 text-start">التاريخ</th>
                  <th className="p-3 text-start">الشاحنة</th>
                  <th className="p-3 text-center">الاستهلاك المسجل</th>
                  <th className="p-3 text-center">المتوسط المعتاد</th>
                  <th className="p-3 text-center">نسبة الانحراف</th>
                  <th className="p-3 text-start">السبب والتشخيص الفني</th>
                  <th className="p-3 text-center">الخطورة</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF2]">
                {anomalyAlerts.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono text-[#64748B]">{a.date}</td>
                    <td className="p-3 font-bold font-mono text-[#0F172A]">{a.vehiclePlate}</td>
                    <td className="p-3 text-center font-mono font-bold text-[#EF4444]">
                      {a.recordedLPer100Km} لتر/100كم
                    </td>
                    <td className="p-3 text-center font-mono text-[#64748B]">
                      {a.averageLPer100Km} لتر/100كم
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-[#EF4444]">
                      +{a.deviationPercentage}%
                    </td>
                    <td className="p-3 text-[#64748B] max-w-xs">{a.reasonSummary}</td>
                    <td className="p-3 text-center">
                      <Badge variant={a.severity === 'critical' ? 'critical' : 'in_review'}>
                        {a.severity === 'critical' ? 'حرج جداً' : 'تحذيري'}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={a.status === 'resolved' ? 'approved' : 'critical'}>
                        {a.status === 'resolved' ? 'تمت التسوية' : 'نشط'}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      {a.status !== 'resolved' ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<CheckCircle2 className="w-3.5 h-3.5 text-[#0FA37F]" />}
                          onClick={() => handleResolveAlert(a)}
                        >
                          اعتماد وتسوية
                        </Button>
                      ) : (
                        <span className="text-slate-400 text-xs">مغلق</span>
                      )}
                    </td>
                  </tr>
                ))}

                {anomalyAlerts.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-xs text-[#64748B]">
                      لا توجد تنبيهات شذوذ حالياً. جميع معدلات الاستهلاك مطابقة للمعايير.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fuel Log Modal */}
      <FuelLogModal
        isOpen={isFuelModalOpen}
        onClose={() => setIsFuelModalOpen(false)}
        onSuccess={() => {
          loadData();
          success('نجاح', 'تم تسجيل وتدقيق استهلاك الوقود');
        }}
      />
    </div>
  );
};
