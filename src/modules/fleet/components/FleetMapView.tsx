import React, { useState, useEffect } from 'react';
import {
  telemetryService,
  SAUDI_ENERGY_NODES,
  SAUDI_ENERGY_ROUTES,
  VehicleTelemetry,
  TelemetryNode,
} from '../services/TelemetryService';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import {
  Truck,
  MapPin,
  Radio,
  Flame,
  Layers,
  Compass,
  Gauge,
  Droplet,
  Info,
  Maximize2,
  Navigation,
} from 'lucide-react';

interface FleetMapViewProps {
  onSelectVehicle?: (vehicleId: string) => void;
  selectedVehicleId?: string | null;
}

export const FleetMapView: React.FC<FleetMapViewProps> = ({
  onSelectVehicle,
  selectedVehicleId,
}) => {
  const [telemetries, setTelemetries] = useState<VehicleTelemetry[]>([]);
  const [hoveredVehicle, setHoveredVehicle] = useState<VehicleTelemetry | null>(null);
  const [hoveredNode, setHoveredNode] = useState<TelemetryNode | null>(null);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  useEffect(() => {
    // Subscribe to live telemetry stream from provider (Simulated GPS Heartbeat)
    const unsubscribe = telemetryService.subscribeToUpdates((data) => {
      setTelemetries(data);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="relative bg-[#0B2545] rounded-2xl border border-slate-700/50 overflow-hidden shadow-xl text-white select-none">
      {/* Map Header Toolbar */}
      <div className="absolute top-4 start-4 end-4 z-20 flex flex-wrap items-center justify-between gap-3 p-3 bg-[#0B2545]/85 backdrop-blur-md rounded-xl border border-slate-600/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#0FA37F]/20 border border-[#0FA37F]/40 flex items-center justify-center text-[#0FA37F]">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">
                خريطة التتبع الفعلي لأسطول النقل البترولي
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40">
                محاكاة GPS مباشرة
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              تتبع مسارات صهاريج نقل الوقود بين المحطات المركزية وحقول الإنتاج
            </p>
          </div>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRoutes(!showRoutes)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
              showRoutes
                ? 'bg-[#0FA37F] text-white border-[#0FA37F]'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>المسارات</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLabels(!showLabels)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
              showLabels
                ? 'bg-[#2563EB] text-white border-[#2563EB]'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>التسميات</span>
          </button>
        </div>
      </div>

      {/* SVG Map Canvas */}
      <div className="w-full aspect-[16/10] min-h-[480px] max-h-[620px] relative overflow-hidden bg-gradient-to-b from-[#091D36] via-[#0B2545] to-[#0A1A2F]">
        <svg
          viewBox="0 0 1000 650"
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Grid Pattern */}
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            </pattern>

            {/* Glowing route filters */}
            <filter id="glow-route" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Vehicle pulse */}
            <filter id="glow-vehicle" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Route Gradients */}
            <linearGradient id="routeGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0FA37F" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.8" />
            </linearGradient>

            <linearGradient id="routeGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0FA37F" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Background Grid */}
          <rect width="1000" height="650" fill="url(#grid)" />

          {/* Stylized Saudi Arabian Geographic Contour (Silhouette Backdrop) */}
          <path
            d="M 120 180 
               Q 240 140 380 120 
               Q 520 100 680 110 
               Q 790 140 850 200 
               Q 880 320 860 450 
               Q 810 570 700 590 
               Q 560 610 380 590 
               Q 240 570 190 480 
               Q 140 380 120 280 Z"
            fill="#0F2B4D"
            opacity="0.35"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Red Sea & Arabian Gulf shoreline indications */}
          <path
            d="M 110 200 Q 160 340 270 570"
            fill="none"
            stroke="#2563EB"
            strokeWidth="2.5"
            opacity="0.25"
          />
          <text x="140" y="440" fill="#64748B" fontSize="11" opacity="0.4" transform="rotate(-65 140 440)">
            البحر الأحمر (Red Sea)
          </text>

          <path
            d="M 640 160 Q 690 230 730 330"
            fill="none"
            stroke="#0FA37F"
            strokeWidth="2.5"
            opacity="0.25"
          />
          <text x="700" y="220" fill="#64748B" fontSize="11" opacity="0.4" transform="rotate(45 700 220)">
            الخليج العربي (Arabian Gulf)
          </text>

          {/* 1. Highway Route Paths */}
          {showRoutes &&
            SAUDI_ENERGY_ROUTES.map((route, i) => (
              <g key={route.id} className="transition-all duration-300">
                {/* Outer Glow Path */}
                <path
                  d={route.pathD}
                  fill="none"
                  stroke={i % 2 === 0 ? 'url(#routeGrad1)' : 'url(#routeGrad2)'}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  opacity="0.75"
                />

                {/* Animated dash line overlay */}
                <path
                  d={route.pathD}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  strokeDasharray="6 8"
                  opacity="0.5"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="100"
                    to="0"
                    dur="5s"
                    repeatCount="indefinite"
                  />
                </path>
              </g>
            ))}

          {/* 2. Facility Nodes (Oil fields, Refineries, Logistics Hubs) */}
          {SAUDI_ENERGY_NODES.map((node) => {
            const isHovered = hoveredNode?.id === node.id;
            const nodeColor =
              node.type === 'hub'
                ? '#0FA37F'
                : node.type === 'refinery'
                ? '#2563EB'
                : node.type === 'oilfield'
                ? '#F59E0B'
                : '#8B5CF6';

            return (
              <g
                key={node.id}
                className="cursor-pointer transition-transform duration-300"
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Outer Pulse Ring */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isHovered ? 18 : 12}
                  fill={nodeColor}
                  opacity="0.18"
                >
                  <animate
                    attributeName="r"
                    values="10;18;10"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.25;0.05;0.25"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Core Marker */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isHovered ? 8 : 6}
                  fill={nodeColor}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  filter="url(#glow-route)"
                />

                {/* Node Label */}
                {showLabels && (
                  <g>
                    <rect
                      x={node.x - 55}
                      y={node.y + 12}
                      width="110"
                      height="20"
                      rx="6"
                      fill="#0B2545"
                      opacity="0.85"
                      stroke="rgba(255,255,255,0.15)"
                      strokeWidth="1"
                    />
                    <text
                      x={node.x}
                      y={node.y + 26}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="9.5"
                      fontWeight="bold"
                    >
                      {node.name.length > 20 ? node.name.slice(0, 19) + '..' : node.name}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* 3. Moving Animated Vehicle Markers */}
          {telemetries.map((v) => {
            const isSelected = selectedVehicleId === v.vehicleId;
            const isHovered = hoveredVehicle?.vehicleId === v.vehicleId;

            return (
              <g
                key={v.vehicleId}
                className="cursor-pointer transition-all duration-300"
                onClick={() => onSelectVehicle?.(v.vehicleId)}
                onMouseEnter={() => setHoveredVehicle(v)}
                onMouseLeave={() => setHoveredVehicle(null)}
              >
                {/* Vehicle Pulse Halo */}
                <circle
                  cx={v.currentPosition.x}
                  cy={v.currentPosition.y}
                  r={isSelected || isHovered ? 16 : 10}
                  fill="#0FA37F"
                  opacity="0.3"
                  filter="url(#glow-vehicle)"
                />

                {/* Vehicle Marker Pin */}
                <circle
                  cx={v.currentPosition.x}
                  cy={v.currentPosition.y}
                  r={isSelected || isHovered ? 9 : 7}
                  fill={v.speedKmH > 90 ? '#EF4444' : v.speedKmH > 75 ? '#F59E0B' : '#0FA37F'}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />

                {/* Vehicle Plate Callout */}
                <g>
                  <rect
                    x={v.currentPosition.x - 35}
                    y={v.currentPosition.y - 25}
                    width="70"
                    height="17"
                    rx="5"
                    fill={isSelected ? '#0FA37F' : '#0F172A'}
                    opacity="0.95"
                    stroke="#FFFFFF"
                    strokeWidth={isSelected ? '1.5' : '0.5'}
                  />
                  <text
                    x={v.currentPosition.x}
                    y={v.currentPosition.y - 13}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {v.vehiclePlate} ({v.speedKmH}k)
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip for Hovered Vehicle */}
        {hoveredVehicle && (
          <div
            className="absolute z-30 p-3 bg-[#0F172A]/95 text-white text-xs rounded-xl border border-slate-600/70 shadow-2xl backdrop-blur-md pointer-events-none transition-all duration-150 space-y-1.5"
            style={{
              top: `${Math.min(75, Math.max(15, (hoveredVehicle.currentPosition.y / 650) * 100))}%`,
              left: `${Math.min(80, Math.max(10, (hoveredVehicle.currentPosition.x / 1000) * 100))}%`,
              transform: 'translate(-50%, -105%)',
              minWidth: '220px',
            }}
            dir="rtl"
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-700">
              <span className="font-bold text-[#0FA37F] flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" />
                {hoveredVehicle.vehicleCode} - {hoveredVehicle.vehiclePlate}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold text-[10px]">
                {hoveredVehicle.speedKmH} كم/س
              </span>
            </div>

            <div className="space-y-1 text-[11px] text-slate-300">
              <div>السائق: <strong className="text-white">{hoveredVehicle.driverName}</strong></div>
              <div>الحمولة: <span className="text-amber-300">{hoveredVehicle.cargoType}</span></div>
              <div>المسار: <span>{hoveredVehicle.originName} ← {hoveredVehicle.destinationName}</span></div>
              <div className="flex items-center justify-between pt-1">
                <span className="flex items-center gap-1 text-slate-400">
                  <Droplet className="w-3 h-3 text-blue-400" /> خزان الوقود:
                </span>
                <span className="font-mono font-bold text-white">{hoveredVehicle.fuelLevelPercentage}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">نسبة إنجاز المسار:</span>
                <span className="font-mono font-bold text-[#0FA37F]">{hoveredVehicle.progressPercentage}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Floating Tooltip for Hovered Node */}
        {hoveredNode && !hoveredVehicle && (
          <div
            className="absolute z-30 p-2.5 bg-[#0F172A]/95 text-white text-xs rounded-xl border border-slate-600/70 shadow-2xl backdrop-blur-md pointer-events-none transition-all duration-150"
            style={{
              top: `${Math.min(75, Math.max(15, (hoveredNode.y / 650) * 100))}%`,
              left: `${Math.min(80, Math.max(10, (hoveredNode.x / 1000) * 100))}%`,
              transform: 'translate(-50%, -105%)',
              minWidth: '200px',
            }}
            dir="rtl"
          >
            <div className="font-bold text-amber-400 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" />
              {hoveredNode.name}
            </div>
            <p className="text-[10px] text-slate-300 mt-1">{hoveredNode.description}</p>
          </div>
        )}
      </div>

      {/* Map Legend Footer */}
      <div className="p-3 bg-[#091D36] border-t border-slate-700/60 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0FA37F]" />
            <span>مراكز لوجستية رئيسية</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
            <span>حقول نفط وإنتاج</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
            <span>مصافي وموانئ بترولية</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
            <span>سرعة مرتفعة (&gt;90 كم/س)</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
          <span>إجمالي المركبات النشطة على الخريطة:</span>
          <strong className="font-mono font-bold text-[#0FA37F]">{telemetries.length} صهريج</strong>
        </div>
      </div>
    </div>
  );
};
