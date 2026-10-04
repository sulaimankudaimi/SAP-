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
} from 'lucide-react';

export const FuelManagementPage: React.FC = () => {
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'logs' | 'anomalies'>('logs');
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [anomalyAlerts, setAnomalyAlerts] = useState<FuelAnomalyAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [logs, alerts] = await Promise.all([
        FleetService.getFuelLogs(),
        FleetService.getFuelAnomalyAlerts(),
      ]);
      setFuelLogs(logs);
      setAnomalyAlerts(alerts);
    } catch (err) {
      console.error(err);
      error('خطأ', 'تعذر تحميل بيانات الوقود');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleResolveAlert = async (alertId: string) => {
    try {
      await FleetService.resolveFuelAnomalyAlert(alertId, 'تم التحقق من تقرير السائق والورشة واعتماد الاستهلاك');
      success('تم بنجاح', 'تمت تسوية تنبيه الشذوذ في الوقود');
      loadData();
    } catch (err) {
      error('خطأ', 'تعذر تسوية التنبيه');
    }
  };

  const filteredLogs = useMemo(() => {
    return fuelLogs.filter((log) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          log.vehiclePlate.toLowerCase().includes(q) ||
          log.driverName.toLowerCase().includes(q) ||
          log.stationName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [fuelLogs, searchQuery]);

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
          <Button variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={loadData}>
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
          <div className="p-4 bg-white rounded-2xl border border-[#E5EAF2] shadow-sm">
            <Input
              placeholder="بحث باللوحة، السائق، أو المحطة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              startIcon={<Search className="w-4 h-4 text-[#64748B]" />}
            />
          </div>

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
                  {filteredLogs.map((log) => (
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
                  ))}
                </tbody>
              </table>
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
                          onClick={() => handleResolveAlert(a.id)}
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
