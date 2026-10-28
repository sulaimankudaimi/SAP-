import { DiagnosticLogger } from '../../../core/services/DiagnosticLogger';
import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { useToast } from '../../../components/ui/Toast';
import { FleetService } from '../services/FleetService';
import { useSaveWithConflict } from '../../../core/hooks/useSaveWithConflict';
import { currentActorId } from '../../../core/security/SessionContext';
import { formatMoney, formatNumber } from '../../../core/utils/format';
import { LOCALE } from '../../../config/locale';
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

  const { saveWithConflict, ConflictModal } = useSaveWithConflict({
    onReload: async () => {
      if (tripToComplete) {
        const fresh = await FleetService.getTripById(tripToComplete.id);
        if (fresh) {
          setEndOdometer(fresh.endOdometer || fresh.startOdometer);
          setActualArrival(fresh.actualArrival || '');
        }
      }
    },
    fetchLatest: async () => {
      if (!tripToComplete) return undefined;
      const t = await FleetService.getTripById(tripToComplete.id);
      return t as unknown as Record<string, unknown>;
    },
    fieldLabels: {
      endOdometer: 'قراءة عداد الوصول',
      actualArrival: 'وقت الوصول الفعلي',
      fuelConsumedLiters: 'كمية الوقود المستهلك',
    },
  });

  // Create Mode Fields
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [originPlant, setOriginPlant] = useState(`${LOCALE.plants[0].code} - ${LOCALE.plants[0].nameAr}`);
  const [destinationLocation, setDestinationLocation] = useState(LOCALE.sites[0].nameAr);
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
        setActualArrival(toLocalIso(now));
        setFuelConsumedLiters(0);
        setDriverAllowance(0);
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

      if (tripToComplete) {
        const targetVehicle = await FleetService.getVehicleById(tripToComplete.vehicleId);
        setEndOdometer(targetVehicle?.currentOdometer || tripToComplete.startOdometer);
      } else {
        if (vList.length > 0 && !selectedVehicleId) {
          setSelectedVehicleId(vList[0].id);
          setStartOdometer(vList[0].currentOdometer || 0);
        }
        if (dList.length > 0 && !selectedDriverId) {
          setSelectedDriverId(dList[0].id);
        }
      }
    } catch (err) {
      DiagnosticLogger.error('TripModal', 'Error occurred', err);
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

    const selectedV = vehicles.find((v) => v.id === selectedVehicleId);
    if (!selectedV) {
      error('خطأ', 'المركبة المحددة غير موجودة');
      return;
    }
    if (selectedV.status !== 'available') {
      error('المركبة غير متاحة', `المركبة (${selectedV.plateNumber}) غير متاحة للرحلة (حالتها: ${selectedV.status})`);
      return;
    }
    if (startOdometer < selectedV.currentOdometer) {
      error(
        'خطأ في قراءة العداد',
        `عداد بداية الرحلة (${startOdometer} كم) لا يمكن أن يكون أقل من قراءة عداد المركبة الحالية (${selectedV.currentOdometer} كم).`
      );
      return;
    }

    const selectedD = drivers.find((d) => d.id === selectedDriverId);
    if (!selectedD) {
      error('خطأ', 'السائق المحدد غير موجود');
      return;
    }
    if (selectedD.status !== 'available') {
      error('السائق غير متاح', `السائق (${selectedD.name}) غير متاح حالياً للرحلة (حالته: ${selectedD.status})`);
      return;
    }
    if (selectedD.licenseExpiry && new Date(selectedD.licenseExpiry) < new Date()) {
      error(
        'رخصة قيادة منتهية',
        `رخصة قيادة السائق (${selectedD.name}) منتهية الصلاحية بتاريخ (${selectedD.licenseExpiry}) ولا يمكن تعيينه للرحلة.`
      );
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر إنشاء الرحلة';
      error('خطأ', msg);
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

    const localData = {
      endOdometer,
      actualArrival,
      fuelConsumedLiters,
    };

    setIsSubmitting(true);
    try {
      const trip = await saveWithConflict(
        () =>
          FleetService.completeTrip(
            tripToComplete.id,
            {
              endOdometer,
              actualArrival,
              fuelLitersConsumed: fuelConsumedLiters,
              fuelCost: Math.round(fuelConsumedLiters * 520),
              driverAllowanceCost: driverAllowance,
            },
            currentActorId(),
            tripToComplete.version
          ),
        localData
      );

      if (!trip) return;

      success(
        'تم إغلاق الرحلة',
        `تم تسجيل وصول الرحلة ${trip.docNumber} وترحيل تكاليفها (${formatMoney(trip.totalTripCost ?? 0)})`
      );
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر إكمال الرحلة';
      error('خطأ', msg);
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
              label={`بدل إعاشة وانتداب السائق (${LOCALE.currency.symbolAr}):`}
              type="number"
              min="0"
              value={driverAllowance}
              onChange={(e) => setDriverAllowance(parseFloat(e.target.value) || 0)}
              required
            />
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col justify-center">
              <span className="text-[11px] text-[#0FA37F] font-semibold">إجمالي تكلفة الرحلة التقديرية ({LOCALE.demoFx.label}):</span>
              <span className="text-base font-bold font-mono text-[#0FA37F]">
                {formatMoney(Math.round(fuelConsumedLiters * 520) + driverAllowance)}
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
                label: `${v.code} - ${v.plateNumber} (${v.type} - سعة ${formatNumber(v.capacityLiters)} لتر)`,
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
                ...LOCALE.plants.map((p) => ({
                  label: `${p.code} - ${p.nameAr}`,
                  value: `${p.code} - ${p.nameAr}`,
                })),
                ...LOCALE.sites
                  .filter((s) => s.type === 'FIELD' || s.type === 'REFINERY')
                  .map((s) => ({
                    label: s.nameAr,
                    value: s.nameAr,
                  })),
              ]}
            />

            <Select
              label="الموقع الوجهة / العميل المستلم:"
              value={destinationLocation}
              onChange={(e) => setDestinationLocation(e.target.value)}
              options={[
                ...LOCALE.sites.map((s) => ({
                  label: s.nameAr,
                  value: s.nameAr,
                })),
                ...LOCALE.customerNamePool.slice(0, 3).map((c) => ({
                  label: c,
                  value: c,
                })),
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
                { label: 'بنزين 95 أوكتان', value: 'بنزين 95 أوكتان' },
                { label: 'بنزين 91 عادي', value: 'بنزين 91 عادي' },
                { label: 'وقود طائرات نفاثة (Jet A-1)', value: 'وقود طائرات نفاثة (Jet A-1)' },
                { label: 'نفط خام سوري خفيف (Syrian Light)', value: 'نفط خام سوري خفيف (Syrian Light)' },
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
      <ConflictModal />
    </Modal>
  );
};
