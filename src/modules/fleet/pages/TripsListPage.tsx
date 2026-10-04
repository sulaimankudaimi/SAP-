import React, { useState, useEffect, useMemo } from 'react';
import { FleetService } from '../services/FleetService';
import { TripModal } from '../components/TripModal';
import { StatCard } from '../../../components/ui/StatCard';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { useToast } from '../../../components/ui/Toast';
import type { Trip } from '../../../types/models';
import {
  Navigation,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  RefreshCw,
  Truck,
  DollarSign,
  Fuel,
  FileCheck,
} from 'lucide-react';

export const TripsListPage: React.FC = () => {
  const { success, error } = useToast();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modals
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [tripToComplete, setTripToComplete] = useState<Trip | null>(null);

  const loadTrips = async () => {
    setIsLoading(true);
    try {
      const list = await FleetService.getTrips();
      setTrips(list);
    } catch (err) {
      console.error(err);
      error('خطأ', 'تعذر تحميل سجل الرحلات');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTrips();
  }, []);

  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
      if (selectedStatus !== 'ALL' && t.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          t.docNumber.toLowerCase().includes(q) ||
          t.vehiclePlate.toLowerCase().includes(q) ||
          t.driverName.toLowerCase().includes(q) ||
          t.originPlant.toLowerCase().includes(q) ||
          t.destinationLocation.toLowerCase().includes(q) ||
          t.cargoType.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [trips, selectedStatus, searchQuery]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return <Badge variant="in_progress">في الطريق (نشطة)</Badge>;
      case 'completed':
        return <Badge variant="approved">مكتملة ومُرحّلة</Badge>;
      case 'draft':
      default:
        return <Badge variant="neutral">مجدولة</Badge>;
    }
  };

  return (
    <div className="space-y-6 text-start p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#E5EAF2]">
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <Navigation className="w-6 h-6 text-[#0FA37F]" />
            إدارة رحلات النقل وبوالص الشحن (Fleet Trips & Dispatch Management)
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            إصدار أوامر الترحيل، متابعة خطوط السير، كشف فترات التأخير الزمني، وإغلاق الرحلات وترحيل تكاليفها المحاسبية
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={loadTrips}>
            تحديث
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setTripToComplete(null);
              setIsTripModalOpen(true);
            }}
          >
            إطلاق رحلة جديدة (Dispatch Trip)
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          label="الرحلات النشطة على المسار"
          value={trips.filter((t) => t.status === 'in_progress').length}
          subtitle="قيد النقل والتسليم الميداني"
          icon={<Navigation className="w-5 h-5 text-[#2563EB]" />}
        />

        <StatCard
          label="الرحلات المكتملة والمُرحّلة"
          value={trips.filter((t) => t.status === 'completed').length}
          subtitle="تم قيد تكاليفها المحاسبية"
          icon={<CheckCircle2 className="w-5 h-5 text-[#0FA37F]" />}
        />

        <StatCard
          label="رحلات شهدت تأخيراً زمنياً"
          value={trips.filter((t) => (t.delayMinutes || 0) > 0).length}
          subtitle="تم رصد سبب التأخير نظامياً"
          icon={<Clock className="w-5 h-5 text-[#F59E0B]" />}
        />

        <StatCard
          label="إجمالي تكاليف النقل المحققة"
          value={`${trips
            .filter((t) => t.status === 'completed')
            .reduce((acc, curr) => acc + (curr.totalTripCost || 0), 0)
            .toLocaleString()} ر.س`}
          subtitle="بدلات سائقين ومحروقات"
          icon={<DollarSign className="w-5 h-5 text-[#0FA37F]" />}
        />
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-white rounded-2xl border border-[#E5EAF2] shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            placeholder="بحث برقم الرحلة، لوحة الشاحنة، السائق، أو المحطة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            startIcon={<Search className="w-4 h-4 text-[#64748B]" />}
          />

          <Select
            label="حالة الرحلة:"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            options={[
              { label: 'كافة الرحلات (الكل)', value: 'ALL' },
              { label: 'في الطريق (In Progress)', value: 'in_progress' },
              { label: 'مكتملة ومُرحّلة (Completed)', value: 'completed' },
            ]}
          />
        </div>
      </div>

      {/* Trips Table */}
      <div className="bg-white rounded-2xl border border-[#E5EAF2] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E5EAF2]">
              <tr>
                <th className="p-3 text-start">رقم الرحلة والتاريخ</th>
                <th className="p-3 text-start">الشاحنة والسائق</th>
                <th className="p-3 text-start">خط السير (المصدر ← الوجهة)</th>
                <th className="p-3 text-start">نوع الحمولة</th>
                <th className="p-3 text-center">المسافة (كم)</th>
                <th className="p-3 text-center">الرصد الزمني والتأخير</th>
                <th className="p-3 text-end">التكلفة المحاسبية</th>
                <th className="p-3 text-center">الحالة</th>
                <th className="p-3 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF2]">
              {filteredTrips.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3">
                    <span className="font-mono font-bold text-[#0F172A] block">{t.docNumber}</span>
                    <span className="text-[10px] text-[#64748B]">{t.scheduledDeparture?.slice(0, 10)}</span>
                  </td>
                  <td className="p-3">
                    <span className="font-mono font-bold text-[#0F172A] block">{t.vehiclePlate}</span>
                    <span className="text-[11px] text-[#64748B]">{t.driverName}</span>
                  </td>
                  <td className="p-3">
                    <span className="font-bold text-[#0F172A] block">{t.destinationLocation}</span>
                    <span className="text-[10px] text-[#64748B]">من: {t.originPlant}</span>
                  </td>
                  <td className="p-3">
                    <span className="font-bold text-[#0FA37F] block">{t.cargoType}</span>
                    <span className="text-[10px] text-[#64748B] font-mono">
                      {t.cargoVolumeLiters?.toLocaleString()} لتر
                    </span>
                  </td>
                  <td className="p-3 text-center font-mono font-bold text-[#0F172A]">
                    {t.distanceKm ? `${t.distanceKm.toLocaleString()} كم` : 'قيد السير'}
                  </td>
                  <td className="p-3 text-center">
                    {t.delayMinutes && t.delayMinutes > 0 ? (
                      <span className="text-[#EF4444] font-bold text-[11px] flex items-center justify-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        تأخير {t.delayMinutes} دقيقة
                      </span>
                    ) : (
                      <span className="text-[#0FA37F] font-semibold text-[11px] flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        في الموعد المحدد
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-end font-mono font-bold">
                    {t.totalTripCost ? (
                      <span className="text-[#0FA37F] block">
                        {t.totalTripCost.toLocaleString()} ر.س
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                    {t.postedAccountingDocNumber && (
                      <span className="text-[9px] text-[#64748B] block font-mono">
                        {t.postedAccountingDocNumber}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {getStatusBadge(t.status)}
                  </td>
                  <td className="p-3 text-center">
                    {t.status === 'in_progress' ? (
                      <Button
                        size="sm"
                        variant="primary"
                        icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setTripToComplete(t);
                          setIsTripModalOpen(true);
                        }}
                      >
                        تسجيل الوصول وإغلاق الرحلة
                      </Button>
                    ) : (
                      <Badge variant="approved">مكتملة</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trip Modal */}
      <TripModal
        isOpen={isTripModalOpen}
        onClose={() => {
          setIsTripModalOpen(false);
          setTripToComplete(null);
        }}
        onSuccess={() => {
          loadTrips();
          success('نجاح', 'تم تحديث سجل الرحلات بنجاح');
        }}
        tripToComplete={tripToComplete}
      />
    </div>
  );
};
