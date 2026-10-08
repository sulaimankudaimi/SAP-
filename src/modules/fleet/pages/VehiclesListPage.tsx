import React, { useState, useEffect, useMemo } from 'react';
import { FleetService, ExpiryAlert, VehicleCostReport } from '../services/FleetService';
import { StatCard } from '../../../components/ui/StatCard';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Modal } from '../../../components/ui/Modal';
import { Drawer } from '../../../components/ui/Drawer';
import { useToast } from '../../../components/ui/Toast';
import { getErrorMessage } from '../../../core/utils';
import { DiagnosticLogger } from '../../../core/services/DiagnosticLogger';
import type { Vehicle, VehicleType } from '../../../types/models';
import {
  Truck,
  Search,
  Filter,
  AlertTriangle,
  Plus,
  Wrench,
  Fuel,
  DollarSign,
  ShieldCheck,
  FileText,
  Calendar,
  Eye,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

const VALID_VEHICLE_TYPES: readonly VehicleType[] = ['Tanker', 'HeavyTruck', 'LightTruck', 'Crane', 'Trailer'];

function parseVehicleTypeFilter(val: string): VehicleType | 'ALL' {
  if (val === 'ALL') return 'ALL';
  return (VALID_VEHICLE_TYPES as readonly string[]).includes(val) ? (val as VehicleType) : 'ALL';
}

function parseVehicleType(val: string): VehicleType {
  return (VALID_VEHICLE_TYPES as readonly string[]).includes(val) ? (val as VehicleType) : 'Tanker';
}

export const VehiclesListPage: React.FC = () => {
  const { success, error } = useToast();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<VehicleType | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Cost Report Drawer
  const [selectedCostReport, setSelectedCostReport] = useState<VehicleCostReport | null>(null);
  const [isCostDrawerOpen, setIsCostDrawerOpen] = useState(false);

  // Create Vehicle Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newPlate, setNewPlate] = useState('');
  const [newVin, setNewVin] = useState('');
  const [newType, setNewType] = useState<VehicleType>('Tanker');
  const [newFuelType, setNewFuelType] = useState<'Diesel' | 'Gasoline95' | 'Gasoline91'>('Diesel');
  const [newCapacity, setNewCapacity] = useState(36000);
  const [newMakeModel, setNewMakeModel] = useState('مرسيدس أكتروس Actros 3340');
  const [newYear, setNewYear] = useState(2024);
  const [newOdometer, setNewOdometer] = useState(65000);
  const [newInsuranceExpiry, setNewInsuranceExpiry] = useState('2027-04-15');
  const [newRegistrationExpiry, setNewRegistrationExpiry] = useState('2027-06-30');

  const loadVehicles = async () => {
    setIsLoading(true);
    try {
      const [vList, expList] = await Promise.all([
        FleetService.getVehicles(),
        FleetService.getVehicleExpiryAlerts(),
      ]);
      setVehicles(vList);
      setExpiryAlerts(expList);
    } catch (err) {
      DiagnosticLogger.error('FleetModule', 'Failed to load vehicles', err);
      error('خطأ', 'تعذر تحميل بيانات الأسطول');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      if (selectedType !== 'ALL' && v.type !== selectedType) return false;
      if (selectedStatus !== 'ALL' && v.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          v.plateNumber.toLowerCase().includes(q) ||
          v.code.toLowerCase().includes(q) ||
          v.makeModel.toLowerCase().includes(q) ||
          (v.vin && v.vin.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [vehicles, selectedType, selectedStatus, searchQuery]);

  const handleOpenCostReport = async (vehicleId: string) => {
    try {
      const report = await FleetService.getVehicleCostReport(vehicleId);
      setSelectedCostReport(report);
      setIsCostDrawerOpen(true);
    } catch (err) {
      DiagnosticLogger.error('FleetModule', 'Failed to get vehicle cost report', err);
      error('خطأ', 'تعذر احتساب تقرير التكلفة');
    }
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await FleetService.createVehicle({
        code: newCode || `TNK-${String(vehicles.length + 1).padStart(3, '0')}`,
        plateNumber: newPlate,
        vin: newVin || `SA-VIN-${Math.floor(10000000 + Math.random() * 90000000)}`,
        type: newType,
        fuelType: newFuelType,
        capacityLiters: newCapacity,
        makeModel: newMakeModel,
        year: newYear,
        currentOdometer: newOdometer,
        status: 'available',
        insuranceExpiry: newInsuranceExpiry,
        registrationExpiry: newRegistrationExpiry,
      });

      success('تمت الإضافة بنجاح', `تم تسجيل الشاحنة ${newPlate} في الأسطول`);
      setIsCreateModalOpen(false);
      loadVehicles();
    } catch (err: unknown) {
      error('خطأ', getErrorMessage(err));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'on_trip':
        return <Badge variant="in_progress">في الطريق</Badge>;
      case 'available':
        return <Badge variant="approved">متاحة / متوقفة</Badge>;
      case 'maintenance':
        return <Badge variant="in_review">في الصيانة</Badge>;
      case 'out_of_service':
      default:
        return <Badge variant="critical">خارج الخدمة</Badge>;
    }
  };

  const getTypeLabel = (type: VehicleType) => {
    switch (type) {
      case 'Tanker':
        return 'صهريج وقود';
      case 'HeavyTruck':
        return 'شاحنة ثقيلة';
      case 'LightTruck':
        return 'شاحنة خفيفة';
      case 'Crane':
        return 'رافعة ميدانية';
      case 'Trailer':
        return 'مقطورة سحب';
    }
  };

  return (
    <div className="space-y-6 text-start p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#E5EAF2]">
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <Truck className="w-6 h-6 text-[#0FA37F]" />
            سجل صهاريج وشاحنات الأسطول (Vehicles Master Data)
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            إدارة بيانات المركبات، أرقام اللوحات والهيكل، وسعات الخزانات، ومتابعة تواريخ انتهاء التأمين ورخص السير
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={loadVehicles}>
            تحديث
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setNewCode(`TNK-${String(vehicles.length + 1).padStart(3, '0')}`);
              setIsCreateModalOpen(true);
            }}
          >
            إضافة صهريج / شاحنة جديدة
          </Button>
        </div>
      </div>

      {/* Expiry Alerts Banner if any */}
      {expiryAlerts.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#B45309]">
            <AlertTriangle className="w-4 h-4" />
            تنبيهات استحقاق الوثائق الرسمية والتراخيص (تأمين ورخص سير مستحقة خلال 30 يوماً):
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {expiryAlerts.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                className="p-2.5 bg-white rounded-xl border border-amber-200 text-xs flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-[#0F172A] block">{alert.vehiclePlate} ({alert.vehicleCode})</span>
                  <span className="text-[11px] text-[#64748B]">{alert.title}</span>
                </div>
                <span className={`font-mono font-bold text-xs ${alert.isExpired ? 'text-[#EF4444]' : 'text-[#B45309]'}`}>
                  {alert.isExpired ? 'منتهي!' : `${alert.daysRemaining} يوم`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي صهاريج الوقود"
          value={vehicles.filter((v) => v.type === 'Tanker').length}
          subtitle="سعات نقل 32,000 إلى 45,000 لتر"
          icon={<Truck className="w-5 h-5 text-[#0FA37F]" />}
        />

        <StatCard
          label="شاحنات ثقيلة ورافعات"
          value={vehicles.filter((v) => v.type === 'HeavyTruck' || v.type === 'Crane').length}
          subtitle="معدات النقل الثقيل والرافعات"
          icon={<Wrench className="w-5 h-5 text-[#2563EB]" />}
        />

        <StatCard
          label="شاحنات نشطة في الطريق"
          value={vehicles.filter((v) => v.status === 'on_trip').length}
          subtitle="تنفذ رحلات شحن وتفريغ"
          icon={<Truck className="w-5 h-5 text-[#0FA37F]" />}
        />

        <StatCard
          label="وثائق تتطلب التجديد"
          value={expiryAlerts.length}
          subtitle="تأمين أو استمارة سير"
          icon={<ShieldCheck className="w-5 h-5 text-[#F59E0B]" />}
        />
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-white rounded-2xl border border-[#E5EAF2] shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            placeholder="بحث برقم اللوحة، كود الصهريج، الموديل، أو رقم VIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            startIcon={<Search className="w-4 h-4 text-[#64748B]" />}
          />

          <Select
            label="نوع المركبة:"
            value={selectedType}
            onChange={(e) => setSelectedType(parseVehicleTypeFilter(e.target.value))}
            options={[
              { label: 'كافة أنواع المركبات (الكل)', value: 'ALL' },
              { label: 'صهاريج نقل الوقود (Tanker)', value: 'Tanker' },
              { label: 'شاحنات نقل ثقيل (Heavy Truck)', value: 'HeavyTruck' },
              { label: 'شاحنات نقل خفيف (Light Truck)', value: 'LightTruck' },
              { label: 'رافعات ميدانية (Crane)', value: 'Crane' },
              { label: 'مقطورات سحب (Trailer)', value: 'Trailer' },
            ]}
          />

          <Select
            label="حالة التشغيل الحالية:"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            options={[
              { label: 'كافة الحالات التشغيلية (الكل)', value: 'ALL' },
              { label: 'متاحة / متوقفة بالمحطة (Available)', value: 'available' },
              { label: 'في الطريق بالرحلة (On Trip)', value: 'on_trip' },
              { label: 'قيد الصيانة بالورشة (Maintenance)', value: 'maintenance' },
              { label: 'خارج الخدمة (Out of Service)', value: 'out_of_service' },
            ]}
          />
        </div>
      </div>

      {/* Vehicles Table */}
      <div className="bg-white rounded-2xl border border-[#E5EAF2] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E5EAF2]">
              <tr>
                <th className="p-3 text-start">رمز المركبة واللوحة</th>
                <th className="p-3 text-start">النوع والموديل</th>
                <th className="p-3 text-start">رقم الهيكل (VIN)</th>
                <th className="p-3 text-center">سعة الحمولة</th>
                <th className="p-3 text-center">قراءة العداد</th>
                <th className="p-3 text-start">السائق المعين</th>
                <th className="p-3 text-center">انتهاء التأمين</th>
                <th className="p-3 text-center">الحالة</th>
                <th className="p-3 text-center">تقرير التكلفة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF2]">
              {filteredVehicles.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3">
                    <span className="font-mono font-bold text-[#0F172A] block">{v.plateNumber}</span>
                    <span className="text-[10px] text-[#64748B]">{v.code}</span>
                  </td>
                  <td className="p-3">
                    <span className="font-bold text-[#0F172A] block">{v.makeModel}</span>
                    <span className="text-[10px] text-[#64748B]">{getTypeLabel(v.type)} ({v.year})</span>
                  </td>
                  <td className="p-3 font-mono text-[#64748B]">{v.vin || '—'}</td>
                  <td className="p-3 text-center font-mono font-bold text-[#0FA37F]">
                    {v.capacityLiters ? `${v.capacityLiters.toLocaleString()} لتر` : '—'}
                  </td>
                  <td className="p-3 text-center font-mono font-bold text-[#0F172A]">
                    {v.currentOdometer.toLocaleString()} كم
                  </td>
                  <td className="p-3 text-[#0F172A]">
                    {v.assignedDriverName || 'غير معين'}
                  </td>
                  <td className="p-3 text-center font-mono text-[#64748B]">
                    {v.insuranceExpiry || '2027-12-31'}
                  </td>
                  <td className="p-3 text-center">
                    {getStatusBadge(v.status)}
                  </td>
                  <td className="p-3 text-center">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<DollarSign className="w-3.5 h-3.5" />}
                      onClick={() => handleOpenCostReport(v.id)}
                    >
                      التكلفة / كم
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vehicle Cost Report Drawer (Spec 6: Cost per vehicle report) */}
      <Drawer
        isOpen={isCostDrawerOpen}
        onClose={() => setIsCostDrawerOpen(false)}
        title={
          selectedCostReport
            ? `تقرير تكاليف المركبة الشامل [${selectedCostReport.vehiclePlate}] - (${selectedCostReport.vehicleCode})`
            : 'تقرير التكاليف'
        }
        size="md"
      >
        {selectedCostReport && (
          <div className="space-y-6 text-start p-2" dir="rtl">
            {/* Header info */}
            <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-[#E5EAF2] space-y-1">
              <span className="text-sm font-bold text-[#0F172A]">{selectedCostReport.makeModel}</span>
              <p className="text-xs text-[#64748B]">
                إجمالي المسافة التشغيلية المقطوعة: <strong className="font-mono text-[#0F172A]">{selectedCostReport.totalDistanceKm.toLocaleString()} كم</strong>
              </p>
            </div>

            {/* Cost Per Km Highlight */}
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
              <span className="text-xs font-semibold text-[#0FA37F]">معدل التكلفة التشغيلية الإجمالية لكل كيلومتر:</span>
              <div className="text-3xl font-black font-mono text-[#0FA37F] mt-1">
                {selectedCostReport.costPerKm} <span className="text-sm">ر.س / كم</span>
              </div>
              <span className="text-[11px] text-[#64748B] block mt-1">
                (يشمل الوقود، الصيانة، بدلات السائقين، واستهلاك الأصول)
              </span>
            </div>

            {/* Cost Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#0FA37F]" />
                تفاصيل عناصر التكلفة المحاسبية (Cost Elements Breakdown):
              </h4>

              <div className="divide-y divide-[#E5EAF2] border border-[#E5EAF2] rounded-xl overflow-hidden bg-white text-xs">
                <div className="p-3 flex justify-between items-center">
                  <span className="flex items-center gap-2 text-[#0F172A]">
                    <Fuel className="w-4 h-4 text-amber-500" /> تكلفة المحروقات والديزل (Fuel):
                  </span>
                  <span className="font-mono font-bold text-[#0F172A]">
                    {selectedCostReport.fuelCostTotal.toLocaleString()} ر.س
                  </span>
                </div>

                <div className="p-3 flex justify-between items-center">
                  <span className="flex items-center gap-2 text-[#0F172A]">
                    <Wrench className="w-4 h-4 text-blue-500" /> تكلفة الصيانة وقطع الغيار (Maintenance):
                  </span>
                  <span className="font-mono font-bold text-[#0F172A]">
                    {selectedCostReport.maintenanceCostTotal.toLocaleString()} ر.س
                  </span>
                </div>

                <div className="p-3 flex justify-between items-center">
                  <span className="flex items-center gap-2 text-[#0F172A]">
                    <Truck className="w-4 h-4 text-emerald-500" /> بدلات وانتدابات السائقين (Driver Allowance):
                  </span>
                  <span className="font-mono font-bold text-[#0F172A]">
                    {selectedCostReport.driverAllowanceTotal.toLocaleString()} ر.س
                  </span>
                </div>

                <div className="p-3 flex justify-between items-center">
                  <span className="flex items-center gap-2 text-[#0F172A]">
                    <DollarSign className="w-4 h-4 text-purple-500" /> استهلاك الأصل الرأسمالي السنوي (Depreciation):
                  </span>
                  <span className="font-mono font-bold text-[#0F172A]">
                    {selectedCostReport.depreciationCostTotal.toLocaleString()} ر.س
                  </span>
                </div>

                <div className="p-3 bg-[#F8FAFC] flex justify-between items-center font-bold text-sm text-[#0F172A]">
                  <span>إجمالي التكلفة الكلية (Grand Total):</span>
                  <span className="font-mono text-[#0FA37F]">
                    {selectedCostReport.grandTotalCost.toLocaleString()} ر.س
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Create Vehicle Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="إضافة شاحنة / صهريج وقود جديد إلى الأسطول"
        size="md"
      >
        <form onSubmit={handleCreateVehicle} className="space-y-4 text-start" dir="rtl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="كود الشاحنة:"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="مثال: TNK-031"
              required
            />
            <Input
              label="رقم اللوحة:"
              value={newPlate}
              onChange={(e) => setNewPlate(e.target.value)}
              placeholder="مثال: ر ص ط 9988"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="نوع المركبة:"
              value={newType}
              onChange={(e) => setNewType(parseVehicleType(e.target.value))}
              options={[
                { label: 'صهريج وقود بترولي (Tanker)', value: 'Tanker' },
                { label: 'شاحنة ثقيلة (Heavy Truck)', value: 'HeavyTruck' },
                { label: 'شاحنة نقل خفيف (Light Truck)', value: 'LightTruck' },
                { label: 'رافعة هيدروليكية (Crane)', value: 'Crane' },
                { label: 'مقطورة سحب (Trailer)', value: 'Trailer' },
              ]}
            />
            <Input
              label="سعة الحمولة (لتر):"
              type="number"
              value={newCapacity}
              onChange={(e) => setNewCapacity(parseInt(e.target.value) || 0)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="الموديل والشركة الصانعة:"
              value={newMakeModel}
              onChange={(e) => setNewMakeModel(e.target.value)}
              required
            />
            <Input
              label="سنة الصنع:"
              type="number"
              value={newYear}
              onChange={(e) => setNewYear(parseInt(e.target.value) || 2024)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="رقم الهيكل (VIN):"
              value={newVin}
              onChange={(e) => setNewVin(e.target.value)}
              placeholder="WDB9340331L..."
              required
            />
            <Input
              label="قراءة العداد الحالية (كم):"
              type="number"
              value={newOdometer}
              onChange={(e) => setNewOdometer(parseInt(e.target.value) || 0)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="تاريخ انتهاء وثيقة التأمين:"
              type="date"
              value={newInsuranceExpiry}
              onChange={(e) => setNewInsuranceExpiry(e.target.value)}
              required
            />
            <Input
              label="تاريخ انتهاء استمارة السير:"
              type="date"
              value={newRegistrationExpiry}
              onChange={(e) => setNewRegistrationExpiry(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#E5EAF2]">
            <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" icon={<CheckCircle2 className="w-4 h-4" />}>
              تسجيل وحفظ المركبة
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
