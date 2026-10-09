import { DiagnosticLogger } from '../../../core/services/DiagnosticLogger';
import React, { useState, useEffect } from 'react';
import { FleetService, FleetSummaryKPIs } from '../services/FleetService';
import { telemetryService, VehicleTelemetry } from '../services/TelemetryService';
import { FleetMapView } from '../components/FleetMapView';
import { SpeedGauge } from '../components/SpeedGauge';
import { TripModal } from '../components/TripModal';
import { FuelLogModal } from '../components/FuelLogModal';
import { MaintenanceOrderModal } from '../components/MaintenanceOrderModal';
import { StatCard } from '../../../components/ui/StatCard';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { useToast } from '../../../components/ui/Toast';
import type { PreventiveSchedule, Trip } from '../../../types/models';
import {
  Truck,
  Fuel,
  Wrench,
  Navigation,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  Radio,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Compass,
  Gauge,
  Activity,
  Calendar,
} from 'lucide-react';

export const FleetDashboardPage: React.FC = () => {
  const { success, error } = useToast();

  const [kpis, setKpis] = useState<FleetSummaryKPIs>({
    totalVehicles: 30,
    onRoadCount: 14,
    availableCount: 12,
    maintenanceCount: 4,
    outOfServiceCount: 0,
    fleetUtilizationRate: 47,
    fuelConsumedTodayLiters: 18450,
    fuelCostTodaySar: 21217,
    fuelVsYesterdayChangePct: -3.8,
    activeTripsCount: 14,
    pendingMaintenanceCount: 4,
    criticalAnomaliesCount: 2,
  });

  const [activeTelemetries, setActiveTelemetries] = useState<VehicleTelemetry[]>([]);
  const [upcomingSchedules, setUpcomingSchedules] = useState<PreventiveSchedule[]>([]);
  const [activeTrips, setActiveTrips] = useState<Trip[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  // Modals
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [tripToComplete, setTripToComplete] = useState<Trip | null>(null);
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);

  const loadData = async () => {
    try {
      const [kpiData, schedules, trips] = await Promise.all([
        FleetService.getFleetDashboardKPIs(),
        FleetService.getPreventiveSchedules(),
        FleetService.getTrips({ status: 'in_progress' }),
      ]);
      setKpis(kpiData);
      setUpcomingSchedules(schedules);
      setActiveTrips(trips);
    } catch (err) {
      DiagnosticLogger.error('FleetDashboardPage', 'Error occurred', err);
    }
  };

  useEffect(() => {
    loadData();

    // Subscribe to real-time live telemetry stream
    const unsubscribe = telemetryService.subscribeToUpdates((telemetryList) => {
      setActiveTelemetries(telemetryList);
    });

    return () => unsubscribe();
  }, []);

  // Compute average speed and top speed from active telemetries
  const averageSpeed =
    activeTelemetries.length > 0
      ? Math.round(
          activeTelemetries.reduce((acc, curr) => acc + curr.speedKmH, 0) /
            activeTelemetries.length
        )
      : 76;

  const topSpeedTelemetry =
    activeTelemetries.length > 0
      ? [...activeTelemetries].sort((a, b) => b.speedKmH - a.speedKmH)[0]
      : null;

  return (
    <div className="space-y-6 text-start p-6 max-w-7xl mx-auto" dir="rtl">
      {/* 1. Header Toolbar with Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#E5EAF2]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
              <Truck className="w-6 h-6 text-[#0FA37F]" />
              لوحة التحكم وإدارة أسطول النقل واللوجستيات (Fleet & Logistics)
            </h1>
            <Badge variant="in_progress">مباشر GPS</Badge>
          </div>
          <p className="text-xs text-[#64748B] mt-1">
            مراقبة وتتبع صهاريج نقل الوقود، كفاءة استهلاك المحروقات، وجداول الصيانة الوقائية
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={<Fuel className="w-4 h-4 text-amber-500" />}
            onClick={() => setIsFuelModalOpen(true)}
          >
            تسجيل قيد وقود
          </Button>

          <Button
            size="sm"
            variant="secondary"
            icon={<Wrench className="w-4 h-4 text-blue-500" />}
            onClick={() => setIsMaintenanceModalOpen(true)}
          >
            أمر صيانة جديد
          </Button>

          <Button
            size="sm"
            variant="primary"
            icon={<Navigation className="w-4 h-4" />}
            onClick={() => {
              setTripToComplete(null);
              setIsTripModalOpen(true);
            }}
          >
            إطلاق رحلة نقل (Dispatch)
          </Button>
        </div>
      </div>

      {/* 2. Fleet Status KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي أسطول الصهاريج والشاحنات"
          value={kpis.totalVehicles}
          subtitle={`نسبة تشغيل الأسطول: ${kpis.fleetUtilizationRate}%`}
          icon={<Truck className="w-5 h-5 text-[#0FA37F]" />}
        />

        <StatCard
          label="مركبات في الطريق (On Road)"
          value={kpis.onRoadCount}
          subtitle="تنفذ رحلات إمداد وتوزيع نشطة"
          icon={<Navigation className="w-5 h-5 text-[#2563EB]" />}
        />

        <StatCard
          label="مركبات جاهزة / متوقفة بالمحطة"
          value={kpis.availableCount}
          subtitle="متاحة للجدولة والتحميل الفوري"
          icon={<CheckCircle2 className="w-5 h-5 text-[#0FA37F]" />}
        />

        <StatCard
          label="مركبات قيد الصيانة والإصلاح"
          value={kpis.maintenanceCount}
          subtitle="في الورشة المركزية"
          icon={<Wrench className="w-5 h-5 text-[#F59E0B]" />}
        />
      </div>

      {/* 3. SVG Map & Gauges Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive SVG Map */}
        <div className="lg:col-span-2">
          <FleetMapView
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={(vId) => setSelectedVehicleId(vId)}
          />
        </div>

        {/* Right 1 Col: Speed Gauges & Fuel Status Card */}
        <div className="space-y-4 flex flex-col justify-between">
          {/* Speed Gauges Panel */}
          <div className="bg-white p-5 rounded-2xl border border-[#E5EAF2] shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF2]">
              <span className="text-xs font-bold text-[#0F172A] flex items-center gap-2">
                <Gauge className="w-4 h-4 text-[#0FA37F]" />
                مؤشرات سرعة الأسطول الآن
              </span>
              <span className="text-[10px] text-[#64748B]">تحديث كل ثانيتين</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <SpeedGauge
                speed={averageSpeed}
                label="متوسط سرعة الأسطول"
                size={140}
              />
              <SpeedGauge
                speed={topSpeedTelemetry?.speedKmH || 88}
                vehiclePlate={topSpeedTelemetry?.vehiclePlate || 'أ ب ج 1101'}
                label="أعلى سرعة مسجلة"
                size={140}
              />
            </div>
          </div>

          {/* Fuel Consumption Card */}
          <div className="bg-white p-5 rounded-2xl border border-[#E5EAF2] shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0F172A] flex items-center gap-2">
                <Fuel className="w-4 h-4 text-[#F59E0B]" />
                استهلاك الوقود اليومي للأسطول
              </span>
              <span className="text-xs font-bold text-[#0FA37F] flex items-center gap-0.5" dir="ltr">
                <ArrowDownRight className="w-3.5 h-3.5" />
                3.8%
              </span>
            </div>

            <div className="flex items-baseline justify-between pt-1">
              <div>
                <span className="text-2xl font-bold font-mono text-[#0F172A]">
                  {kpis.fuelConsumedTodayLiters.toLocaleString()}
                </span>
                <span className="text-xs text-[#64748B] ms-1">لتر</span>
              </div>
              <span className="text-xs font-mono font-bold text-[#0FA37F]">
                {kpis.fuelCostTodaySar.toLocaleString()} ر.س
              </span>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-[#E5EAF2] text-[11px] text-[#64748B]">
              <div className="flex justify-between">
                <span>متوسط الكفاءة المسجل:</span>
                <strong className="text-[#0F172A] font-mono">37.4 لتر / 100 كم</strong>
              </div>
              <div className="flex justify-between">
                <span>تنبيهات استهلاك غير اعتيادي:</span>
                <strong className="text-[#EF4444] font-mono">{kpis.criticalAnomaliesCount} تنبيهات</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Active Vehicles Table & Maintenance Schedule Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Vehicles Table (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E5EAF2] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#E5EAF2] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#0FA37F]" />
              <h3 className="font-bold text-sm text-[#0F172A]">
                الصهاريج والشاحنات النشطة على المسار الآن (Active Vehicles)
              </h3>
            </div>
            <span className="text-xs font-mono text-[#64748B]">
              {activeTelemetries.length} مركبة قيد التتبع
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E5EAF2]">
                <tr>
                  <th className="p-3 text-start">المركبة واللوحة</th>
                  <th className="p-3 text-start">السائق المكلف</th>
                  <th className="p-3 text-start">المسار والوجهة</th>
                  <th className="p-3 text-center">السرعة</th>
                  <th className="p-3 text-center w-28">مستوى الوقود</th>
                  <th className="p-3 text-center">الإنجاز</th>
                  <th className="p-3 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF2]">
                {activeTelemetries.map((v) => (
                  <tr
                    key={v.vehicleId}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedVehicleId(v.vehicleId)}
                  >
                    <td className="p-3">
                      <span className="font-mono font-bold text-[#0F172A] block">{v.vehiclePlate}</span>
                      <span className="text-[10px] text-[#64748B]">{v.vehicleCode}</span>
                    </td>
                    <td className="p-3 font-semibold text-[#0F172A]">{v.driverName}</td>
                    <td className="p-3">
                      <span className="font-bold text-[#0F172A] block">{v.destinationName}</span>
                      <span className="text-[10px] text-[#64748B]">{v.cargoType}</span>
                    </td>
                    <td className="p-3 text-center font-mono font-bold">
                      <span
                        className={
                          v.speedKmH > 90
                            ? 'text-[#EF4444]'
                            : v.speedKmH > 75
                            ? 'text-[#F59E0B]'
                            : 'text-[#0FA37F]'
                        }
                      >
                        {v.speedKmH} كم/س
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="w-full space-y-1">
                        <div className="flex justify-between text-[10px] font-mono">
                          <span>{v.fuelLevelPercentage}%</span>
                        </div>
                        <ProgressBar
                          value={v.fuelLevelPercentage}
                          color={v.fuelLevelPercentage < 30 ? 'red' : 'primary'}
                          size="sm"
                        />
                      </div>
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-[#0FA37F]">
                      {v.progressPercentage}%
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant="in_progress">في الطريق</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Maintenance Schedule Card (1 Col) */}
        <div className="bg-white rounded-2xl border border-[#E5EAF2] shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-4 border-b border-[#E5EAF2] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-[#F59E0B]" />
                <h3 className="font-bold text-sm text-[#0F172A]">
                  جدول الصيانة الوقائية (PM Schedule)
                </h3>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsMaintenanceModalOpen(true)}
              >
                + أمر
              </Button>
            </div>

            <div className="p-4 divide-y divide-[#E5EAF2]">
              {upcomingSchedules.slice(0, 5).map((pm) => (
                <div key={pm.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#0F172A]">
                      {pm.vehiclePlate} ({pm.serviceName})
                    </span>
                    <Badge variant={pm.status === 'due' ? 'critical' : pm.status === 'soon' ? 'in_review' : 'approved'}>
                      {pm.status === 'due' ? 'مستحقة الآن' : pm.status === 'soon' ? 'قريباً' : 'مكتملة'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                    <span>استحقاق العداد: <strong className="font-mono text-[#0F172A]">{pm.nextDueOdometer.toLocaleString()} كم</strong></span>
                    <span>التاريخ: {pm.nextDueDate}</span>
                  </div>
                </div>
              ))}

              {upcomingSchedules.length === 0 && (
                <div className="py-6 text-center text-xs text-[#64748B]">
                  كافة فحوصات الصيانة الوقائية محدثة وفق المعايير الفنية.
                </div>
              )}
            </div>
          </div>

          <div className="p-4 bg-[#F8FAFC] border-t border-[#E5EAF2]">
            <Button
              className="w-full"
              variant="secondary"
              size="sm"
              icon={<Calendar className="w-3.5 h-3.5" />}
              onClick={() => setIsMaintenanceModalOpen(true)}
            >
              عرض جدول الصيانة الشامل
            </Button>
          </div>
        </div>
      </div>

      {/* Modal Dialogs */}
      <TripModal
        isOpen={isTripModalOpen}
        onClose={() => {
          setIsTripModalOpen(false);
          setTripToComplete(null);
        }}
        onSuccess={() => {
          loadData();
          success('نجاح', 'تم تحديث سجل الرحلات والأسطول');
        }}
        tripToComplete={tripToComplete}
      />

      <FuelLogModal
        isOpen={isFuelModalOpen}
        onClose={() => setIsFuelModalOpen(false)}
        onSuccess={() => {
          loadData();
          success('نجاح', 'تم تسجيل قيد استهلاك الوقود');
        }}
      />

      <MaintenanceOrderModal
        isOpen={isMaintenanceModalOpen}
        onClose={() => setIsMaintenanceModalOpen(false)}
        onSuccess={() => {
          loadData();
          success('نجاح', 'تم تحديث أوامر الصيانة');
        }}
      />
    </div>
  );
};
