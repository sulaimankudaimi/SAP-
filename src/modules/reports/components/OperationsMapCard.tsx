import React, { useState } from 'react';
import { MapPin, Building2, Truck, AlertTriangle, CheckCircle2, ChevronRight, Activity } from 'lucide-react';
import type { PlantLocationStatus } from '../services/dashboardService';

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

      {/* Stylized Offline SVG Map of Arabian Peninsula */}
      <div className="relative w-full h-56 bg-gradient-to-b from-[#0B2545] to-[#13315C] rounded-2xl overflow-hidden border border-[#13315C] p-2 flex items-center justify-center">
        {/* Subtle Map Grid lines */}
        <svg
          className="absolute inset-0 w-full h-full opacity-15"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="mapGrid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#FFFFFF" strokeWidth="0.75" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#mapGrid)" />
        </svg>

        {/* Vector Contour of the Arabian Peninsula */}
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full max-h-48 drop-shadow-md select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Landmass representation */}
          <path
            d="M 18,22 Q 28,18 42,20 Q 55,22 68,26 Q 78,32 82,42 Q 88,52 80,68 Q 72,78 60,86 Q 48,90 38,82 Q 26,75 22,58 Q 16,40 18,22 Z"
            fill="#1E3A63"
            stroke="#2A4D7E"
            strokeWidth="1.2"
          />

          {/* Red Sea shoreline */}
          <path
            d="M 18,26 Q 22,45 28,62 Q 35,76 40,84"
            fill="none"
            stroke="#0FA37F"
            strokeWidth="0.8"
            strokeDasharray="2,2"
            opacity="0.6"
          />

          {/* Arabian Gulf shoreline */}
          <path
            d="M 68,26 Q 74,38 78,48 Q 84,56 82,66"
            fill="none"
            stroke="#2563EB"
            strokeWidth="0.8"
            strokeDasharray="2,2"
            opacity="0.6"
          />

          {/* Location Pins */}
          {locations.map((loc) => {
            const isSelected = selectedPlant?.code === loc.code;
            const isMaintenance = loc.status === 'maintenance';
            return (
              <g
                key={loc.code}
                className="cursor-pointer group"
                onClick={() => setSelectedPlant(loc)}
              >
                {/* Outer Pulse ring */}
                <circle
                  cx={loc.coords.x}
                  cy={loc.coords.y}
                  r={isSelected ? 6 : 4}
                  fill={isMaintenance ? '#F59E0B' : '#0FA37F'}
                  opacity={isSelected ? 0.4 : 0.2}
                  className="animate-ping"
                />
                {/* Core Pin */}
                <circle
                  cx={loc.coords.x}
                  cy={loc.coords.y}
                  r={isSelected ? 3.5 : 2.5}
                  fill={isMaintenance ? '#F59E0B' : '#0FA37F'}
                  stroke="#FFFFFF"
                  strokeWidth="1"
                />
                {/* Plant Label on Map */}
                <text
                  x={loc.coords.x}
                  y={loc.coords.y - 4.5}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="3.2"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  {loc.city}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Mini Selected Plant Overlay Info Badge */}
        {selectedPlant && (
          <div className="absolute bottom-2 start-2 end-2 bg-white/95 backdrop-blur-xs p-2.5 rounded-xl border border-white/40 shadow-lg text-start flex items-center justify-between text-xs">
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
