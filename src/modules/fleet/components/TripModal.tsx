import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { useToast } from '../../../components/ui/Toast';
import { FleetService } from '../services/FleetService';
import type { Vehicle, Driver, Trip } from '../../../types/models';
import {
  Truck,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  Fuel,
} from 'lucide-react';

interface TripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tripToComplete?: Trip | null;
}

export const TripModal: React.FC<TripModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  tripToComplete,
}) => {
  const { success, error } = useToast();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create Mode Fields
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [originPlant, setOriginPlant] = useState('1100 - مركز الرياض اللوجستي المركزي');
  const [destinationLocation, setDestinationLocation] = useState('حقل الغوار - محطة الضخ 4');
  const [cargoType, setCargoType] = useState('ديزل صناعي عالي الجودة');
  const [cargoVolumeLiters, setCargoVolumeLiters] = useState(36000);
  const [scheduledDeparture, setScheduledDeparture] = useState('');
  const [scheduledArrival, setScheduledArrival] = useState('');
  const [startOdometer, setStartOdometer] = useState(0);

  // Complete Mode Fields
  const [endOdometer, setEndOdometer] = useState(0);
  const [actualArrival, setActualArrival] = useState('');
  const [fuelConsumedLiters, setFuelConsumedLiters] = useState(0);
  const [driverAllowance, setDriverAllowance] = useState(0);

  useEffect(() => {
    if (isOpen) {
      loadDependencies();
      const now = new Date();
      const later = new Date(now.getTime() + 4 * 60 * 60 * 1000);

      const toLocalIso = (d: Date) => d.toISOString().slice(0, 16);

      if (tripToComplete) {
        setEndOdometer(tripToComplete.startOdometer + 350);
        setActualArrival(toLocalIso(now));
        setFuelConsumedLiters(130);
        setDriverAllowance(150);
      } else {
        setScheduledDeparture(toLocalIso(now));
        setScheduledArrival(toLocalIso(later));
      }
    }
  }, [isOpen, tripToComplete]);

  const loadDependencies = async () => {
    setIsLoading(true);
    try {
      const [vList, dList] = await Promise.all([
        FleetService.getVehicles({ status: 'available' }),
        FleetService.getDrivers(),
      ]);
      setVehicles(vList);
      setDrivers(dList);

      if (vList.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(vList[0].id);
        setStartOdometer(vList[0].currentOdometer || 120000);
      }
      if (dList.length > 0 && !selectedDriverId) {
        setSelectedDriverId(dList[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVehicleChange = (vId: string) => {
    setSelectedVehicleId(vId);
    const found = vehicles.find((v) => v.id === vId);
    if (found) {
      setStartOdometer(found.currentOdometer || 0);
      if (found.assignedDriverId) {
        setSelectedDriverId(found.assignedDriverId);
      }
    }
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId || !selectedDriverId) {
      error('تنبيه', 'يرجى اختيار الشاحنة والسائق');
      return;
    }

    setIsSubmitting(true);
    try {
      const trip = await FleetService.createTrip({
        vehicleId: selectedVehicleId,
        driverId: selectedDriverId,
        originPlant,
        destinationLocation,
        cargoType,
        cargoVolumeLiters,
        scheduledDeparture,
        scheduledArrival,
        startOdometer,
      });

      success('تم بنجاح', `تم إنشاء أمر الشحن وانطلاق الرحلة: ${trip.docNumber}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      error('خطأ', err.message || 'تعذر إنشاء الرحلة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripToComplete) return;

    if (endOdometer <= tripToComplete.startOdometer) {
      error('خطأ', 'عداد الوصول يجب أن يكون أكبر من عداد البداية');
      return;
    }

    setIsSubmitting(true);
    try {
      const trip = await FleetService.completeTrip(tripToComplete.id, {
        endOdometer,
        actualArrival,
        fuelLitersConsumed: fuelConsumedLiters,
        fuelCost: Math.round(fuelConsumedLiters * 1.15),
        driverAllowanceCost: driverAllowance,
      });

      success(
        'تم إغلاق الرحلة',
        `تم تسجيل وصول الرحلة ${trip.docNumber} وترحيل تكاليفها (${trip.totalTripCost?.toLocaleString()} ر.س)`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      error('خطأ', err.message || 'تعذر إكمال الرحلة');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        tripToComplete
          ? `إغلاق وتأكيد وصول الرحلة [${tripToComplete.docNumber}]`
          : 'إصدار أمر شحن وترحيل رحلة نقل وقود جديدة (Dispatch Trip)'
      }
      size="lg"
    >
      {tripToComplete ? (
        // COMPLETE TRIP FORM
        <form onSubmit={handleCompleteTrip} className="space-y-4 text-start" dir="rtl">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-[#0F172A]">
                الشاحنة: {tripToComplete.vehiclePlate} | السائق: {tripToComplete.driverName}
              </span>
              <p className="text-[#64748B] mt-0.5">
                المسار: {tripToComplete.originPlant} ← {tripToComplete.destinationLocation}
              </p>
            </div>
            <Badge variant="in_progress">قيد النقل</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="قراءة عداد البداية (كم):"
              value={tripToComplete.startOdometer}
              disabled
            />
            <Input
              label="قراءة عداد الوصول الفعلي (كم):"
              type="number"
              min={tripToComplete.startOdometer + 1}
              value={endOdometer}
              onChange={(e) => setEndOdometer(parseInt(e.target.value) || 0)}
              required
            />
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
            <span className="text-[#64748B]">إجمالي المسافة المقطوعة المحسوبة:</span>
            <span className="font-bold font-mono text-[#0FA37F] text-sm">
              {Math.max(0, endOdometer - tripToComplete.startOdometer)} كم
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="وقت الوصول الفعلي:"
              type="datetime-local"
              value={actualArrival}
              onChange={(e) => setActualArrival(e.target.value)}
              required
            />
            <Input
              label="كمية الوقود المستهلكة (لتر):"
              type="number"
              min="0"
              value={fuelConsumedLiters}
              onChange={(e) => setFuelConsumedLiters(parseFloat(e.target.value) || 0)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="بدل إعاشة وانتداب السائق (ر.س):"
              type="number"
              min="0"
              value={driverAllowance}
              onChange={(e) => setDriverAllowance(parseFloat(e.target.value) || 0)}
              required
            />
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col justify-center">
              <span className="text-[11px] text-[#0FA37F] font-semibold">إجمالي تكلفة الرحلة التقديرية:</span>
              <span className="text-base font-bold font-mono text-[#0FA37F]">
                {(Math.round(fuelConsumedLiters * 1.15) + driverAllowance).toLocaleString()} ر.س
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#E5EAF2]">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              تأكيد الوصول وترحيل التكاليف المحاسبية
            </Button>
          </div>
        </form>
      ) : (
        // CREATE TRIP FORM
        <form onSubmit={handleCreateTrip} className="space-y-4 text-start" dir="rtl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="اختر الشاحنة / الصهريج المتاح:"
              value={selectedVehicleId}
              onChange={(e) => handleVehicleChange(e.target.value)}
              options={vehicles.map((v) => ({
                label: `${v.code} - ${v.plateNumber} (${v.type} - سعة ${v.capacityLiters.toLocaleString()} لتر)`,
                value: v.id,
              }))}
            />

            <Select
              label="اختر السائق المكلف:"
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              options={drivers.map((d) => ({
                label: `${d.name} (${d.licenseClass}) - تقييم ${d.safetyRating}★`,
                value: d.id,
              }))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="المحطة المصدر / نقطة التحميل:"
              value={originPlant}
              onChange={(e) => setOriginPlant(e.target.value)}
              options={[
                { label: '1100 - مركز الرياض اللوجستي المركزي', value: '1100 - مركز الرياض اللوجستي المركزي' },
                { label: '1200 - مصفاة ومحطة ينبع البترولية', value: '1200 - مصفاة ومحطة ينبع البترولية' },
                { label: '1300 - مجمع الدمام ورأس تنورة', value: '1300 - مجمع الدمام ورأس تنورة' },
                { label: 'حقل الغوار - محطة المعالجة الشمالية', value: 'حقل الغوار - محطة المعالجة الشمالية' },
                { label: 'حقل خريص - منشأة الضخ المركزية', value: 'حقل خريص - منشأة الضخ المركزية' },
              ]}
            />

            <Select
              label="الموقع الوجهة / العميل المستلم:"
              value={destinationLocation}
              onChange={(e) => setDestinationLocation(e.target.value)}
              options={[
                { label: 'حقل الغوار - محطة الضخ 4', value: 'حقل الغوار - محطة الضخ 4' },
                { label: 'مطار الملك خالد الدولي - وقود الطيران', value: 'مطار الملك خالد الدولي - وقود الطيران' },
                { label: 'محطة كهرباء ينبع البخارية', value: 'محطة كهرباء ينبع البخارية' },
                { label: 'مجمع الجبيل الصناعي للبتروكيماويات', value: 'مجمع الجبيل الصناعي للبتروكيماويات' },
                { label: 'مصفاة وميناء جازان الاقتصادي', value: 'مصفاة وميناء جازان الاقتصادي' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="نوع الحمولة المنقولة:"
              value={cargoType}
              onChange={(e) => setCargoType(e.target.value)}
              options={[
                { label: 'ديزل صناعي فائق الجودة (Euro 5)', value: 'ديزل صناعي فائق الجودة (Euro 5)' },
                { label: 'بنزين 95 سوبر عالي الأوكتان', value: 'بنزين 95 سوبر عالي الأوكتان' },
                { label: 'بنزين 91 ممتاز', value: 'بنزين 91 ممتاز' },
                { label: 'وقود طائرات نفاثة (Jet A-1)', value: 'وقود طائرات نفاثة (Jet A-1)' },
                { label: 'زيت خام عربي خفيف (Arab Light)', value: 'زيت خام عربي خفيف (Arab Light)' },
              ]}
            />

            <Input
              label="كمية الحمولة المنقولة (لتر):"
              type="number"
              value={cargoVolumeLiters}
              onChange={(e) => setCargoVolumeLiters(parseInt(e.target.value) || 0)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              label="موعد الانطلاق المجدول:"
              type="datetime-local"
              value={scheduledDeparture}
              onChange={(e) => setScheduledDeparture(e.target.value)}
              required
            />
            <Input
              label="موعد الوصول المتوقع المجدول:"
              type="datetime-local"
              value={scheduledArrival}
              onChange={(e) => setScheduledArrival(e.target.value)}
              required
            />
            <Input
              label="عداد البداية (كم):"
              type="number"
              value={startOdometer}
              onChange={(e) => setStartOdometer(parseInt(e.target.value) || 0)}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#E5EAF2]">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              icon={<Navigation className="w-4 h-4" />}
            >
              إصدار أمر الشحن وإطلاق الرحلة
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
