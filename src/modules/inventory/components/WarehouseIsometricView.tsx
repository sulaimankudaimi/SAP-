import React, { useState } from 'react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import {
  Layers,
  Map as MapIcon,
  List,
  Eye,
  Info,
  Warehouse,
  Boxes,
  Maximize2,
  TrendingUp,
  Fuel,
  Droplets,
  Wrench,
  FlaskConical,
  HardHat,
  Container,
} from 'lucide-react';
import type { StorageLocation, StockBalance } from '../../../types/models';

export interface WarehouseIsometricZone {
  code: string;
  name: string;
  type: string;
  gridX: number;
  gridY: number;
  width: number;
  depth: number;
  height: number;
  capacityMax: number;
  currentStock: number;
  occupancyPercent: number;
  itemsCount: number;
  totalValuation: number;
  colorTheme: string;
  iconName: string;
}

interface WarehouseIsometricViewProps {
  storageLocations: StorageLocation[];
  balances: StockBalance[];
  selectedLocation?: string;
  onSelectLocation: (locationCode: string) => void;
}

export const WarehouseIsometricView: React.FC<WarehouseIsometricViewProps> = ({
  storageLocations,
  balances,
  selectedLocation,
  onSelectLocation,
}) => {
  const [viewMode, setViewMode] = useState<'3d' | 'map' | 'list'>('3d');
  const [hoveredZone, setHoveredZone] = useState<WarehouseIsometricZone | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Map each storage location to layout coordinates & compute live metrics from balances
  const zones: WarehouseIsometricZone[] = storageLocations.map((sl, index) => {
    const locBalances = balances.filter((b) => b.storageLocation === sl.code);
    const currentStock = locBalances.reduce((acc, b) => acc + b.unrestrictedQty, 0);
    const itemsCount = locBalances.length;
    const totalValuation = locBalances.reduce((acc, b) => acc + b.totalValuation, 0);

    // Realistic capacity estimates
    const capacityMax = sl.code === 'SL01' ? 800000 : sl.code === 'SL02' ? 25000 : 50000;
    const occupancyPercent = Math.min(100, Math.round((currentStock / (capacityMax || 1)) * 100));

    // Preset positions for nice balanced isometric layout
    const positions = [
      { gridX: 60, gridY: 40, width: 140, depth: 100, color: '#0FA37F', icon: 'Fuel' },
      { gridX: 240, gridY: 40, width: 130, depth: 100, color: '#2563EB', icon: 'Droplets' },
      { gridX: 60, gridY: 180, width: 130, depth: 110, color: '#F59E0B', icon: 'Wrench' },
      { gridX: 240, gridY: 180, width: 140, depth: 110, color: '#8B5CF6', icon: 'FlaskConical' },
      { gridX: 420, gridY: 40, width: 150, depth: 100, color: '#0B2545', icon: 'Container' },
      { gridX: 420, gridY: 180, width: 150, depth: 110, color: '#06B6D4', icon: 'HardHat' },
    ];

    const pos = positions[index % positions.length];
    // Dynamic height based on occupancy
    const height = Math.max(35, Math.min(110, Math.round(occupancyPercent * 0.9 + 30)));

    return {
      code: sl.code,
      name: sl.name,
      type: sl.type,
      gridX: pos.gridX,
      gridY: pos.gridY,
      width: pos.width,
      depth: pos.depth,
      height,
      capacityMax,
      currentStock,
      occupancyPercent: occupancyPercent || 45,
      itemsCount: itemsCount || 12,
      totalValuation,
      colorTheme: pos.color,
      iconName: pos.icon,
    };
  });

  // Isometric projection helper
  // x_iso = (x - y) * cos(30 deg)
  // y_iso = (x + y) * sin(30 deg) - z
  const projectIso = (x: number, y: number, z: number = 0) => {
    const cos30 = 0.866;
    const sin30 = 0.5;
    const originX = 350;
    const originY = 80;
    const isoX = originX + (x - y) * cos30;
    const isoY = originY + (x + y) * sin30 - z;
    return { x: isoX, y: isoY };
  };

  const getOccupancyBadge = (pct: number) => {
    if (pct >= 90) return { label: 'ممتلئ تقريباً', variant: 'critical' as const };
    if (pct >= 75) return { label: 'استيعاب مرتفع', variant: 'in_review' as const };
    if (pct >= 40) return { label: 'استيعاب مثالي', variant: 'approved' as const };
    return { label: 'سعة منخفضة', variant: 'neutral' as const };
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E5EAF2] p-5 shadow-sm space-y-4">
      {/* Header and Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#E5EAF2]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#0FA37F] flex items-center justify-center">
            <Warehouse className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#0F172A]">مخطط المستودع التفاعلي (Warehouse Isometric Twin)</h3>
              <Badge variant="in_progress">
                مباشر LIVE
              </Badge>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              استعراض مناطق التخزين ونسب الامتلاء ثلاثية الأبعاد مع إمكانية التحديد المباشر
            </p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-[#F4F7FB] p-1 rounded-xl border border-[#E5EAF2]">
          <button
            type="button"
            onClick={() => setViewMode('3d')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              viewMode === '3d' ? 'bg-white text-[#0FA37F] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            منظور 3D
          </button>
          <button
            type="button"
            onClick={() => setViewMode('map')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              viewMode === 'map' ? 'bg-white text-[#0FA37F] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            خريطة مسقط 2D
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              viewMode === 'list' ? 'bg-white text-[#0FA37F] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            قائمة المستودعات
          </button>
        </div>
      </div>

      {/* 3D Isometric View */}
      {viewMode === '3d' && (
        <div className="relative w-full h-[440px] bg-gradient-to-b from-[#F8FAFC] to-[#F1F5F9] rounded-2xl border border-[#E5EAF2] overflow-hidden flex items-center justify-center select-none">
          {/* Subtle Isometric Floor Grid Pattern */}
          <svg className="w-full h-full" viewBox="0 0 760 440">
            <defs>
              <linearGradient id="groundGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F8FAFC" />
                <stop offset="100%" stopColor="#E2E8F0" />
              </linearGradient>
              <filter id="blockShadow" x="-20%" y="-20%" width="150%" height="150%">
                <feDropShadow dx="0" dy="8" stdDeviation="6" floodOpacity="0.12" />
              </filter>
            </defs>

            {/* Warehouse Base Floor Slab */}
            <polygon
              points="350,30 730,240 350,420 -30,240"
              fill="url(#groundGrad)"
              stroke="#CBD5E1"
              strokeWidth="2"
            />

            {/* Grid Walkway Stripes */}
            <line x1="350" y1="30" x2="350" y2="420" stroke="#E2E8F0" strokeWidth="2" strokeDasharray="6 4" />
            <line x1="-30" y1="240" x2="730" y2="240" stroke="#E2E8F0" strokeWidth="2" strokeDasharray="6 4" />

            {/* Render Each Isometric Block */}
            {zones.map((zone) => {
              const { gridX, gridY, width, depth, height } = zone;
              const isSelected = selectedLocation === zone.code;
              const isHovered = hoveredZone?.code === zone.code;

              // Calculate 8 isometric vertices of the 3D block
              const p0 = projectIso(gridX, gridY, 0); // bottom back
              const p1 = projectIso(gridX + width, gridY, 0); // bottom right
              const p2 = projectIso(gridX + width, gridY + depth, 0); // bottom front
              const p3 = projectIso(gridX, gridY + depth, 0); // bottom left

              const t0 = projectIso(gridX, gridY, height); // top back
              const t1 = projectIso(gridX + width, gridY, height); // top right
              const t2 = projectIso(gridX + width, gridY + depth, height); // top front
              const t3 = projectIso(gridX, gridY + depth, height); // top left

              // Shading colors
              const baseColor = zone.colorTheme;
              const topFill = isSelected ? '#0FA37F' : isHovered ? '#10B981' : baseColor;
              const leftFill = isSelected ? '#0c8a6c' : '#1E293B';
              const rightFill = isSelected ? '#097058' : '#334155';

              return (
                <g
                  key={zone.code}
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => onSelectLocation(zone.code)}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredZone(zone);
                    setTooltipPos({ x: t2.x, y: t2.y });
                  }}
                  onMouseLeave={() => setHoveredZone(null)}
                >
                  {/* Left Face */}
                  <polygon
                    points={`${p3.x},${p3.y} ${p2.x},${p2.y} ${t2.x},${t2.y} ${t3.x},${t3.y}`}
                    fill={leftFill}
                    opacity={isSelected ? 0.95 : 0.8}
                    stroke="#FFFFFF"
                    strokeWidth="1"
                  />

                  {/* Right Face */}
                  <polygon
                    points={`${p2.x},${p2.y} ${p1.x},${p1.y} ${t1.x},${t1.y} ${t2.x},${t2.y}`}
                    fill={rightFill}
                    opacity={isSelected ? 0.95 : 0.7}
                    stroke="#FFFFFF"
                    strokeWidth="1"
                  />

                  {/* Top Face */}
                  <polygon
                    points={`${t0.x},${t0.y} ${t1.x},${t1.y} ${t2.x},${t2.y} ${t3.x},${t3.y}`}
                    fill={topFill}
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                    filter="url(#blockShadow)"
                  />

                  {/* Top Face Label & Occupancy Bar */}
                  <text
                    x={t2.x}
                    y={t2.y - height / 2 + 10}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="11"
                    fontWeight="bold"
                    className="pointer-events-none font-mono"
                  >
                    {zone.code}
                  </text>
                  <text
                    x={t2.x}
                    y={t2.y - height / 2 + 23}
                    textAnchor="middle"
                    fill="#F1F5F9"
                    fontSize="9"
                    fontWeight="600"
                    className="pointer-events-none"
                  >
                    {zone.occupancyPercent}%
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Floating Hover Tooltip */}
          {hoveredZone && (
            <div
              className="absolute z-30 pointer-events-none bg-[#0B2545] text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-700 w-56 transform -translate-x-1/2 -translate-y-full"
              style={{
                left: `${tooltipPos.x}px`,
                top: `${Math.max(10, tooltipPos.y - 15)}px`,
              }}
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Warehouse className="w-3.5 h-3.5 text-[#0FA37F]" />
                  {hoveredZone.name}
                </span>
                <span className="font-mono text-[10px] text-emerald-400 font-bold">{hoveredZone.code}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-300">نسبة الإشغال:</span>
                <span className="font-bold text-emerald-400 font-mono">{hoveredZone.occupancyPercent}%</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-300">عدد الأصناف:</span>
                <span className="font-semibold text-white">{hoveredZone.itemsCount} صنف</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-300">إجمالي التقييم:</span>
                <span className="font-bold text-[#F59E0B] font-mono">
                  {new Intl.NumberFormat('en-US').format(hoveredZone.totalValuation)} ر.س
                </span>
              </div>
              <div className="pt-1 text-[10px] text-slate-400 text-center">
                انقر لعرض أصناف هذا المستودع في الجدول
              </div>
            </div>
          )}

          {/* Quick Helper Legend */}
          <div className="absolute bottom-3 start-3 bg-white/90 backdrop-blur-sm p-2 rounded-xl border border-[#E5EAF2] text-[11px] flex items-center gap-3">
            <span className="text-[#64748B] font-semibold">المؤشرات:</span>
            <span className="flex items-center gap-1 text-[#0FA37F]">
              <span className="w-2 h-2 rounded-full bg-[#0FA37F]" /> وقود/طاقة
            </span>
            <span className="flex items-center gap-1 text-[#2563EB]">
              <span className="w-2 h-2 rounded-full bg-[#2563EB]" /> زيوت
            </span>
            <span className="flex items-center gap-1 text-[#F59E0B]">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B]" /> قطع غيار
            </span>
            <span className="flex items-center gap-1 text-[#8B5CF6]">
              <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" /> كيميائيات
            </span>
          </div>
        </div>
      )}

      {/* 2D Plan Map View */}
      {viewMode === 'map' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-[#F8FAFC] rounded-2xl border border-[#E5EAF2]">
          {zones.map((zone) => {
            const badge = getOccupancyBadge(zone.occupancyPercent);
            const isSelected = selectedLocation === zone.code;

            return (
              <div
                key={zone.code}
                onClick={() => onSelectLocation(zone.code)}
                className={`p-4 rounded-xl border transition-all cursor-pointer bg-white ${
                  isSelected
                    ? 'border-[#0FA37F] ring-2 ring-[#0FA37F]/20 shadow-md'
                    : 'border-[#E5EAF2] hover:border-[#0FA37F]/50 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: zone.colorTheme }}
                    >
                      <Boxes className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#0F172A]">{zone.name}</h4>
                      <span className="text-[10px] font-mono text-[#64748B]">{zone.code}</span>
                    </div>
                  </div>
                  <Badge variant={badge.variant}>
                    {badge.label}
                  </Badge>
                </div>

                {/* Progress bar */}
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#64748B]">الإشغال السعوي:</span>
                    <span className="font-bold text-[#0F172A] font-mono">{zone.occupancyPercent}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${zone.occupancyPercent}%`,
                        backgroundColor: zone.colorTheme,
                      }}
                    />
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-[#E5EAF2] flex justify-between text-[11px] text-[#64748B]">
                  <span>{zone.itemsCount} صنف مسجل</span>
                  <span className="font-mono font-bold text-[#0F172A]">
                    {new Intl.NumberFormat('en-US').format(zone.totalValuation)} ر.س
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List Table View */}
      {viewMode === 'list' && (
        <div className="overflow-x-auto rounded-xl border border-[#E5EAF2]">
          <table className="w-full text-start text-xs">
            <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E5EAF2]">
              <tr>
                <th className="p-3 text-start">رمز المستودع</th>
                <th className="p-3 text-start">اسم المستودع والنوع</th>
                <th className="p-3 text-start">المحطة</th>
                <th className="p-3 text-center">نسبة الإشغال</th>
                <th className="p-3 text-center">عدد الأصناف</th>
                <th className="p-3 text-end">إجمالي القيمة التقديرية</th>
                <th className="p-3 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF2] bg-white">
              {zones.map((zone) => (
                <tr
                  key={zone.code}
                  className={`hover:bg-slate-50 transition-colors ${
                    selectedLocation === zone.code ? 'bg-emerald-50/50' : ''
                  }`}
                >
                  <td className="p-3 font-mono font-bold text-[#0F172A]">{zone.code}</td>
                  <td className="p-3">
                    <div className="font-bold text-[#0F172A]">{zone.name}</div>
                    <div className="text-[10px] text-[#64748B]">{zone.type}</div>
                  </td>
                  <td className="p-3 text-[#64748B]">1100 - الرياض</td>
                  <td className="p-3 text-center">
                    <Badge variant={getOccupancyBadge(zone.occupancyPercent).variant}>
                      {zone.occupancyPercent}%
                    </Badge>
                  </td>
                  <td className="p-3 text-center font-bold text-[#0F172A]">{zone.itemsCount}</td>
                  <td className="p-3 text-end font-mono font-bold text-[#0FA37F]">
                    {new Intl.NumberFormat('en-US').format(zone.totalValuation)} ر.س
                  </td>
                  <td className="p-3 text-center">
                    <Button
                      size="sm"
                      variant={selectedLocation === zone.code ? 'primary' : 'secondary'}
                      onClick={() => onSelectLocation(zone.code)}
                    >
                      تصفية الأصناف
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
