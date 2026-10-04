import React, { useState, useEffect, useMemo } from 'react';
import { FleetService } from '../services/FleetService';
import { MaintenanceOrderModal } from '../components/MaintenanceOrderModal';
import { StatCard } from '../../../components/ui/StatCard';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { useToast } from '../../../components/ui/Toast';
import type { MaintenanceOrder, PreventiveSchedule } from '../../../types/models';
import {
  Wrench,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  RefreshCw,
  Boxes,
  Truck,
  DollarSign,
  Calendar,
  Layers,
} from 'lucide-react';

export const FleetMaintenancePage: React.FC = () => {
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'orders' | 'schedules'>('orders');
  const [orders, setOrders] = useState<MaintenanceOrder[]>([]);
  const [schedules, setSchedules] = useState<PreventiveSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<MaintenanceOrder | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [orderList, schedList] = await Promise.all([
        FleetService.getMaintenanceOrders(),
        FleetService.getPreventiveSchedules(),
      ]);
      setOrders(orderList);
      setSchedules(schedList);
    } catch (err) {
      console.error(err);
      error('خطأ', 'تعذر تحميل بيانات الصيانة');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (selectedType !== 'ALL' && o.orderType !== selectedType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          o.docNumber.toLowerCase().includes(q) ||
          o.vehiclePlate.toLowerCase().includes(q) ||
          o.description.toLowerCase().includes(q) ||
          (o.faultReported && o.faultReported.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [orders, selectedType, searchQuery]);

  const totalDowntime = useMemo(
    () => orders.reduce((acc, curr) => acc + (curr.downtimeHours || 0), 0),
    [orders]
  );
  const totalMaintenanceCost = useMemo(
    () => orders.reduce((acc, curr) => acc + curr.actualCost, 0),
    [orders]
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="approved">مكتمل ومعتمد</Badge>;
      case 'in_progress':
        return <Badge variant="in_progress">قيد التنفيذ بالورشة</Badge>;
      case 'in_review':
        return <Badge variant="in_review">قيد فحص الجودة</Badge>;
      default:
        return <Badge variant="neutral">مجدول</Badge>;
    }
  };

  const getScheduleBadge = (status: 'due' | 'soon' | 'completed') => {
    switch (status) {
      case 'due':
        return <Badge variant="critical">مستحقة الآن</Badge>;
      case 'soon':
        return <Badge variant="in_review">قريباً</Badge>;
      case 'completed':
        return <Badge variant="approved">مكتملة</Badge>;
    }
  };

  return (
    <div className="space-y-6 text-start p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#E5EAF2]">
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <Wrench className="w-6 h-6 text-[#0FA37F]" />
            صيانة الأسطول وصرف قطع الغيار (Fleet Maintenance & SAP PM)
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            أوامر الصيانة الوقائية والطارئة، ربط صرف قطع الغيار بالمخزون بحركة SAP 261، واحتساب ساعات التوقف وتكلفة الشاحنة
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
            onClick={() => {
              setSelectedOrder(null);
              setIsModalOpen(true);
            }}
          >
            فتح أمر صيانة جديد
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          label="أوامر الصيانة النشطة بالورشة"
          value={orders.filter((o) => o.status !== 'completed').length}
          subtitle="قيد الإصلاح وصرف القطع"
          icon={<Wrench className="w-5 h-5 text-[#F59E0B]" />}
        />

        <StatCard
          label="فحوصات وقائية مستحقة قريباً"
          value={schedules.filter((s) => s.status === 'due' || s.status === 'soon').length}
          subtitle="بناءً على الكيلومترات والأيام"
          icon={<Clock className="w-5 h-5 text-[#2563EB]" />}
        />

        <StatCard
          label="إجمالي ساعات توقف الأسطول"
          value={`${totalDowntime} ساعة`}
          subtitle="ساعات Downtime بالورشة"
          icon={<AlertTriangle className="w-5 h-5 text-[#EF4444]" />}
        />

        <StatCard
          label="إجمالي تكاليف الصيانة الفعلية"
          value={`${totalMaintenanceCost.toLocaleString()} ر.س`}
          subtitle="قطع غيار (حركة 261) + عمالة"
          icon={<DollarSign className="w-5 h-5 text-[#0FA37F]" />}
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E5EAF2]">
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`px-5 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'orders'
              ? 'border-[#0FA37F] text-[#0FA37F]'
              : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <Wrench className="w-4 h-4" />
          أوامر الصيانة والإصلاح ({orders.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('schedules')}
          className={`px-5 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'schedules'
              ? 'border-[#2563EB] text-[#2563EB]'
              : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <Calendar className="w-4 h-4" />
          جدول الصيانة الوقائية بالمسافات والأيام ({schedules.length})
        </button>
      </div>

      {/* TAB 1: WORK ORDERS */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-2xl border border-[#E5EAF2] shadow-sm space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                placeholder="بحث برقم الأمر، لوحة الشاحنة، أو وصف العطل..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                startIcon={<Search className="w-4 h-4 text-[#64748B]" />}
              />

              <Select
                label="نوع أمر الصيانة:"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                options={[
                  { label: 'كافة أنواع الأوامر (الكل)', value: 'ALL' },
                  { label: 'صيانة دورية وقائية (Preventive)', value: 'Preventive' },
                  { label: 'صيانة طارئة / علاجية (Corrective)', value: 'Corrective' },
                  { label: 'فحص فني ومعايرة (Inspection)', value: 'Inspection' },
                ]}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5EAF2] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E5EAF2]">
                  <tr>
                    <th className="p-3 text-start">رقم الأمر والتاريخ</th>
                    <th className="p-3 text-start">الشاحنة واللوحة</th>
                    <th className="p-3 text-start">النوع والوصف</th>
                    <th className="p-3 text-center">قطع الغيار المصروفة</th>
                    <th className="p-3 text-center">ساعات التوقف (Downtime)</th>
                    <th className="p-3 text-end">تكلفة القطع (261)</th>
                    <th className="p-3 text-end font-bold text-[#0FA37F]">التكلفة الإجمالية</th>
                    <th className="p-3 text-center">الحالة</th>
                    <th className="p-3 text-center">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EAF2]">
                  {filteredOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3">
                        <span className="font-mono font-bold text-[#0F172A] block">{o.docNumber}</span>
                        <span className="text-[10px] text-[#64748B]">{o.startDate}</span>
                      </td>
                      <td className="p-3 font-mono font-bold text-[#0F172A]">{o.vehiclePlate}</td>
                      <td className="p-3">
                        <span className="font-bold text-[#0F172A] block">{o.description}</span>
                        <span className="text-[10px] text-[#64748B]">{o.orderType}</span>
                      </td>
                      <td className="p-3 text-center">
                        {o.partsUsed.length > 0 ? (
                          <Badge variant="in_progress">{o.partsUsed.length} قطع (261)</Badge>
                        ) : (
                          <span className="text-slate-400">لا يوجد</span>
                        )}
                        {o.materialDocNumber && (
                          <span className="text-[9px] text-[#0FA37F] font-mono block">
                            {o.materialDocNumber}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-[#EF4444]">
                        {o.downtimeHours ? `${o.downtimeHours} ساعة` : '—'}
                      </td>
                      <td className="p-3 text-end font-mono text-[#64748B]">
                        {o.partsCost.toLocaleString()} ر.س
                      </td>
                      <td className="p-3 text-end font-mono font-bold text-[#0FA37F]">
                        {o.actualCost.toLocaleString()} ر.س
                      </td>
                      <td className="p-3 text-center">
                        {getStatusBadge(o.status)}
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          size="sm"
                          variant={o.status === 'completed' ? 'secondary' : 'primary'}
                          icon={<Wrench className="w-3.5 h-3.5" />}
                          onClick={() => {
                            setSelectedOrder(o);
                            setIsModalOpen(true);
                          }}
                        >
                          {o.status === 'completed' ? 'استعراض' : 'صرف قطع / إغلاق'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PREVENTIVE SCHEDULES */}
      {activeTab === 'schedules' && (
        <div className="bg-white rounded-2xl border border-[#E5EAF2] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#E5EAF2] flex justify-between items-center bg-[#F8FAFC]">
            <span className="text-xs font-bold text-[#0F172A]">
              جدولة الصيانات الوقائية الدورية المعتمدة لكل صهريج وشاحنة
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E5EAF2]">
                <tr>
                  <th className="p-3 text-start">الشاحنة</th>
                  <th className="p-3 text-start">نوع الخدمة الوقائية</th>
                  <th className="p-3 text-center">فاصل الكيلومترات</th>
                  <th className="p-3 text-center">آخر صيانة تمت</th>
                  <th className="p-3 text-center">استحقاق العداد القادم</th>
                  <th className="p-3 text-center">التاريخ المتوقع</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3 text-center">إصدار أمر عمل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF2]">
                {schedules.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-[#0F172A]">{s.vehiclePlate}</td>
                    <td className="p-3 font-bold text-[#0F172A]">{s.serviceName}</td>
                    <td className="p-3 text-center font-mono font-bold text-[#2563EB]">
                      كل {s.intervalKm.toLocaleString()} كم
                    </td>
                    <td className="p-3 text-center font-mono text-[#64748B]">
                      {s.lastDoneOdometer.toLocaleString()} كم ({s.lastDoneDate})
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-[#0FA37F]">
                      {s.nextDueOdometer.toLocaleString()} كم
                    </td>
                    <td className="p-3 text-center font-mono text-[#64748B]">{s.nextDueDate}</td>
                    <td className="p-3 text-center">
                      {getScheduleBadge(s.status)}
                    </td>
                    <td className="p-3 text-center">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Plus className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setSelectedOrder(null);
                          setIsModalOpen(true);
                        }}
                      >
                        فتح أمر عمل
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Maintenance Order Modal */}
      <MaintenanceOrderModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedOrder(null);
        }}
        onSuccess={() => {
          loadData();
          success('نجاح', 'تم تحديث أوامر الصيانة وسجلات الأسطول');
        }}
        existingOrder={selectedOrder}
      />
    </div>
  );
};
