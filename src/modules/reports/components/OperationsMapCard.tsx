import React, { useState } from 'react';
import { Building2 } from 'lucide-react';
import type { PlantLocationStatus } from '../services/dashboardService';
import { SyriaMap } from '../../../components/maps/SyriaMap';
import { LOCALE } from '../../../config/locale';

export interface OperationsMapCardProps {
  locations: PlantLocationStatus[];
}

export const OperationsMapCard: React.FC<OperationsMapCardProps> = ({ locations }) => {
  const [selectedPlant, setSelectedPlant] = useState<PlantLocationStatus | null>(
    locations[0] || null
  );

  const activeCount = locations.filter((l) => l.status === 'active').length;
  const maintenanceCount = locations.filter((l) => l.status === 'maintenance').length;
  const warningCount = locations.filter((l) => l.status === 'warning').length;

  return (
    <div className="space-y-4 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A]">المواقع والعمليات (Logistics Map)</h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              خريطة تشغيلية تفاعلية للمحطات ومستودعات التوزيع الإقليمية
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
            Offline Vector Map
          </span>
        </div>

        {/* Status Counters Strip */}
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-200/60">
            <span className="text-[10px] text-emerald-800 block font-medium">نشطة</span>
            <span className="text-sm font-bold text-emerald-700 font-mono">{activeCount} محطات</span>
          </div>
          <div className="p-2 rounded-xl bg-amber-50/70 border border-amber-200/60">
            <span className="text-[10px] text-amber-800 block font-medium">قيد الصيانة</span>
            <span className="text-sm font-bold text-amber-700 font-mono">{maintenanceCount} محطة</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] text-slate-600 block font-medium">تنبيهات</span>
            <span className="text-sm font-bold text-slate-700 font-mono">{warningCount} تنبيه</span>
          </div>
        </div>
      </div>

      {/* Stylized Offline SVG Syria Map */}
      <div className="relative w-full h-64 rounded-2xl overflow-hidden border border-[#13315C] shadow-inner">
        <SyriaMap
          theme="dark"
          width={800}
          height={560}
          selectedPinId={selectedPlant?.code}
          onSelectPin={(pin) => {
            const matched = locations.find((l) => l.code === pin.code);
            if (matched) {
              setSelectedPlant(matched);
            } else {
              // Find matching plant by city if site
              const plantForCity = locations.find((l) => l.city === pin.city) || locations[0];
              setSelectedPlant({
                id: pin.id,
                code: pin.code,
                name: pin.name,
                city: pin.city,
                activeOrders: 12,
                activeVehicles: 8,
                status: 'active',
                coords: { x: 50, y: 50 },
              });
            }
          }}
          className="w-full h-full"
        />

        {/* Mini Selected Plant Overlay Info Badge */}
        {selectedPlant && (
          <div className="absolute bottom-2 start-2 end-2 bg-white/95 backdrop-blur-xs p-2.5 rounded-xl border border-white/40 shadow-lg text-start flex items-center justify-between text-xs z-20">
            <div className="flex items-center gap-2 overflow-hidden">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  selectedPlant.status === 'maintenance'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                <Building2 className="w-4 h-4" />
              </div>
              <div className="truncate">
                <span className="font-bold text-[#0F172A] block leading-tight truncate">
                  {selectedPlant.name}
                </span>
                <span className="text-[10px] text-[#64748B] block">
                  {selectedPlant.code} | {selectedPlant.city}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 text-start">
              <div className="text-center font-mono">
                <span className="text-[9px] text-[#64748B] block">أوامر نشطة</span>
                <span className="font-bold text-emerald-700">{selectedPlant.activeOrders}</span>
              </div>
              <div className="text-center font-mono">
                <span className="text-[9px] text-[#64748B] block">الصهاريج</span>
                <span className="font-bold text-[#2563EB]">{selectedPlant.activeVehicles}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
