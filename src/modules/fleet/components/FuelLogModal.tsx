import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { useToast } from '../../../components/ui/Toast';
import { FleetService } from '../services/FleetService';
import type { Vehicle, Driver } from '../../../types/models';
import { Fuel, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface FuelLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedVehicleId?: string;
}

export const FuelLogModal: React.FC<FuelLogModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedVehicleId,
}) => {
  const { success, error } = useToast();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [date, setDate] = useState('');
  const [fuelType, setFuelType] = useState<'Diesel' | 'Gasoline95' | 'Gasoline91'>('Diesel');
  const [quantityLiters, setQuantityLiters] = useState(350);
  const [costPerLiter, setCostPerLiter] = useState(1.15);
  const [odometer, setOdometer] = useState(120500);
  const [stationName, setStationName] = useState('محطة بترومين - طريق الرياض الخرج');

  useEffect(() => {
    if (isOpen) {
      loadDependencies();
      const today = new Date().toISOString().slice(0, 10);
      setDate(today);
    }
  }, [isOpen, preselectedVehicleId]);

  const loadDependencies = async () => {
    try {
      const [vList, dList] = await Promise.all([
        FleetService.getVehicles(),
        FleetService.getDrivers(),
      ]);
      setVehicles(vList);
      setDrivers(dList);

      const targetV = preselectedVehicleId
        ? vList.find((v) => v.id === preselectedVehicleId)
        : vList[0];

      if (targetV) {
        setVehicleId(targetV.id);
        setOdometer((targetV.currentOdometer || 120000) + 450);
        if (targetV.assignedDriverId) {
          setDriverId(targetV.assignedDriverId);
        } else if (dList.length > 0) {
          setDriverId(dList[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId || !driverId) {
      error('تنبيه', 'يرجى اختيار المركبة والسائق');
      return;
    }

    setIsSubmitting(true);
    try {
      const { fuelLog, anomalyAlert } = await FleetService.createFuelLog({
        vehicleId,
        driverId,
        date,
        fuelType,
        quantityLiters,
        costPerLiter,
        odometer,
        stationName,
      });

      if (anomalyAlert) {
        error(
          'تنبيه شذوذ في استهلاك الوقود!',
          `تم تسجيل حركة الوقود، ولكن اكتشف النظام انحرافاً في الاستهلاك بنسبة ${anomalyAlert.deviationPercentage}% عن المعدل المعتاد (${anomalyAlert.recordedLPer100Km} لتر/100كم)`
        );
      } else {
        success(
          'تم تسجيل استهلاك الوقود',
          `تم قيد ${quantityLiters} لتر بمبلغ ${(quantityLiters * costPerLiter).toLocaleString()} ر.س (معدل: ${fuelLog.calculatedConsumptionPer100Km} لتر/100كم)`
        );
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      error('خطأ', err.message || 'تعذر تسجيل قيد الوقود');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تسجيل قيد تزويد وقود جديد (Fuel Fill-up Log)"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-start" dir="rtl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Select
            label="اختر الشاحنة / الصهريج:"
            value={vehicleId}
            onChange={(e) => {
              setVehicleId(e.target.value);
              const found = vehicles.find((v) => v.id === e.target.value);
              if (found) {
                setOdometer((found.currentOdometer || 120000) + 400);
                if (found.assignedDriverId) setDriverId(found.assignedDriverId);
              }
            }}
            options={vehicles.map((v) => ({
              label: `${v.code} - ${v.plateNumber} (${v.type})`,
              value: v.id,
            }))}
          />

          <Select
            label="السائق المستلم:"
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            options={drivers.map((d) => ({
              label: d.name,
              value: d.id,
            }))}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label="تاريخ التعبئة:"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />

          <Select
            label="نوع الوقود:"
            value={fuelType}
            onChange={(e) => {
              const val = e.target.value as any;
              setFuelType(val);
              setCostPerLiter(val === 'Diesel' ? 1.15 : val === 'Gasoline95' ? 2.33 : 2.18);
            }}
            options={[
              { label: 'ديزل تجاري (Diesel) - 1.15 ر.س/لتر', value: 'Diesel' },
              { label: 'بنزين 95 سوبر - 2.33 ر.س/لتر', value: 'Gasoline95' },
              { label: 'بنزين 91 ممتاز - 2.18 ر.س/لتر', value: 'Gasoline91' },
            ]}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            label="الكمية المعبأة (لتر):"
            type="number"
            min="1"
            value={quantityLiters}
            onChange={(e) => setQuantityLiters(parseFloat(e.target.value) || 0)}
            required
          />

          <Input
            label="سعر اللتر (ر.س):"
            type="number"
            step="0.01"
            value={costPerLiter}
            onChange={(e) => setCostPerLiter(parseFloat(e.target.value) || 0)}
            required
          />

          <Input
            label="قراءة العداد الحالية (كم):"
            type="number"
            value={odometer}
            onChange={(e) => setOdometer(parseInt(e.target.value) || 0)}
            required
          />
        </div>

        <Input
          label="اسم المحطة / موقع التعبئة:"
          value={stationName}
          onChange={(e) => setStationName(e.target.value)}
          placeholder="مثال: محطة الدريس، محطة أرامكو المركزية، خزان الورشة الذاتي"
          required
        />

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
          <span className="text-[#64748B]">إجمالي قيمة الوقود المدفوعة:</span>
          <span className="text-base font-bold font-mono text-[#0FA37F]">
            {(quantityLiters * costPerLiter).toLocaleString(undefined, { minimumFractionDigits: 2 })} ر.س
          </span>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-[#E5EAF2]">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            icon={<Fuel className="w-4 h-4" />}
          >
            تسجيل قيد الوقود وفحص كفاءة الاستهلاك
          </Button>
        </div>
      </form>
    </Modal>
  );
};
