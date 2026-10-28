/**
 * SyriaMap Component
 * -------------------
 * SCHEMATIC MAP ONLY: This map is purely illustrative/schematic and must NOT
 * be used as a boundary, geographic, or navigation reference.
 * لا يجوز استخدام هذا المخطط كمرجع حدودي أو ملاحي أو جغرافي رسمي.
 *
 * Fully offline SVG map supporting light and dark themes and RTL layout.
 * Displays only the simplified internationally recognized silhouette of the
 * Syrian Arab Republic, the Mediterranean Sea label ("البحر المتوسط"),
 * and operational nodes/plants from the Locale Pack.
 */

import React, { useMemo } from 'react';
import { LOCALE } from '../../config/locale';
import { projectLatLon, getSyriaSvgPath, Point2D } from './syriaOutline';

export interface MapPinItem {
  id: string;
  code: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
  type: 'plant' | 'site';
  subtype?: string; // 'FIELD' | 'REFINERY' | 'PORT' | 'DEPOT' | 'HQ' | 'BRANCH'
  status?: 'active' | 'maintenance' | 'warning' | string;
  subtitle?: string;
}

export interface SyriaMapProps {
  theme?: 'light' | 'dark';
  selectedPinId?: string | null;
  onSelectPin?: (pin: MapPinItem) => void;
  showPlants?: boolean;
  showSites?: boolean;
  showLabels?: boolean;
  className?: string;
  width?: number;
  height?: number;
  children?: React.ReactNode; // Extra layers (such as vehicle routes or animated telemetries)
}

export const SyriaMap: React.FC<SyriaMapProps> = ({
  theme = 'dark',
  selectedPinId,
  onSelectPin,
  showPlants = true,
  showSites = true,
  showLabels = true,
  className = '',
  width = 800,
  height = 560,
  children,
}) => {
  const isDark = theme === 'dark';

  // Compute silhouette SVG path string
  const silhouettePath = useMemo(() => {
    return getSyriaSvgPath(width, height, 44);
  }, [width, height]);

  // Compute Mediterranean Coast label position (west of Latakia/Tartus in the sea)
  const medSeaPos: Point2D = useMemo(() => {
    return projectLatLon(35.35, 35.35, width, height, 44);
  }, [width, height]);

  // Gather default pins from Locale Pack
  const pins: MapPinItem[] = useMemo(() => {
    const list: MapPinItem[] = [];

    if (showPlants) {
      LOCALE.plants.forEach((p) => {
        list.push({
          id: p.code,
          code: p.code,
          name: p.nameAr,
          city: p.city,
          lat: p.latitude,
          lon: p.longitude,
          type: 'plant',
          subtype: p.isHQ ? 'HQ' : 'BRANCH',
          status: 'active',
          subtitle: p.isHQ ? 'المقر الرئيسي والمحطة المركزية' : 'محطة تشغيل وتوزيع',
        });
      });
    }

    if (showSites) {
      LOCALE.sites.forEach((s) => {
        // Avoid duplicate pin if site code matches plant (e.g. 1100 / SITE-DAM-DEP)
        const already = list.some((item) => item.code === s.code);
        if (!already) {
          list.push({
            id: s.code,
            code: s.code,
            name: s.nameAr,
            city: s.city,
            lat: s.latitude,
            lon: s.longitude,
            type: 'site',
            subtype: s.type,
            status: 'active',
            subtitle: s.nameEn,
          });
        }
      });
    }

    return list;
  }, [showPlants, showSites]);

  // Styling theme tokens
  const colors = isDark
    ? {
        bg: 'from-[#091D36] via-[#0B2545] to-[#0A1A2F]',
        landFill: '#13315C',
        landStroke: '#2563EB',
        landOpacity: '0.45',
        seaText: '#60A5FA',
        gridStroke: 'rgba(255, 255, 255, 0.04)',
        captionBg: 'bg-[#0B2545]/85',
        captionText: 'text-slate-300',
        captionBorder: 'border-slate-700/60',
        labelBg: '#0B2545',
        labelText: '#FFFFFF',
        labelBorder: 'rgba(255, 255, 255, 0.2)',
      }
    : {
        bg: 'from-[#F8FAFC] via-[#F1F5F9] to-[#E2E8F0]',
        landFill: '#E2E8F0',
        landStroke: '#94A3B8',
        landOpacity: '0.8',
        seaText: '#2563EB',
        gridStroke: 'rgba(15, 23, 42, 0.04)',
        captionBg: 'bg-white/90',
        captionText: 'text-slate-600',
        captionBorder: 'border-slate-200',
        labelBg: '#FFFFFF',
        labelText: '#0F172A',
        labelBorder: '#CBD5E1',
      };

  return (
    <div
      dir="rtl"
      className={`relative rounded-2xl overflow-hidden border ${isDark ? 'border-slate-700/50' : 'border-[#E5EAF2]'} select-none ${className}`}
    >
      {/* Schematic Map Arabic Caption (Required by spec) */}
      <div
        className={`absolute top-3 end-3 z-20 px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide backdrop-blur-md border ${colors.captionBg} ${colors.captionText} ${colors.captionBorder} shadow-xs flex items-center gap-1.5`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#0FA37F] animate-pulse" />
        <span>مخطط توضيحي</span>
      </div>

      {/* SVG Canvas */}
      <div className={`w-full h-full bg-gradient-to-b ${colors.bg}`}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Subtle Grid */}
            <pattern id="syriaGrid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path
                d="M 32 0 L 0 0 0 32"
                fill="none"
                stroke={colors.gridStroke}
                strokeWidth="1"
              />
            </pattern>

            {/* Glowing marker filter */}
            <filter id="syriaGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid Background */}
          <rect width={width} height={height} fill="url(#syriaGrid)" />

          {/* Simplified Schematic Silhouette of Syria */}
          <path
            d={silhouettePath}
            fill={colors.landFill}
            stroke={colors.landStroke}
            strokeWidth="1.75"
            strokeLinejoin="round"
            opacity={colors.landOpacity}
          />

          {/* Mediterranean Sea Coast Label */}
          <g>
            <text
              x={medSeaPos.x}
              y={medSeaPos.y}
              fill={colors.seaText}
              fontSize="12"
              fontWeight="bold"
              opacity={isDark ? 0.75 : 0.85}
              textAnchor="middle"
              transform={`rotate(-75 ${medSeaPos.x} ${medSeaPos.y})`}
              style={{ letterSpacing: '2px' }}
            >
              البحر المتوسط
            </text>
          </g>

          {/* Extra layers (Routes, Telemetry, Polylines) */}
          {children}

          {/* Operational Pins and Nodes */}
          {pins.map((pin) => {
            const pos = projectLatLon(pin.lat, pin.lon, width, height, 44);
            const isSelected = selectedPinId === pin.id || selectedPinId === pin.code;

            // Pin coloring based on facility type
            const pinColor =
              pin.subtype === 'HQ'
                ? '#0FA37F'
                : pin.subtype === 'REFINERY'
                ? '#2563EB'
                : pin.subtype === 'FIELD'
                ? '#F59E0B'
                : pin.subtype === 'PORT'
                ? '#06B6D4'
                : '#8B5CF6';

            return (
              <g
                key={pin.id}
                className="cursor-pointer transition-all duration-200 group"
                onClick={() => onSelectPin?.(pin)}
              >
                {/* Ping ring for selected or active */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isSelected ? 16 : 9}
                  fill={pinColor}
                  opacity={isSelected ? 0.35 : 0.15}
                  className="transition-all duration-300"
                />

                {/* Core Pin Center */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isSelected ? 7 : 5}
                  fill={pinColor}
                  stroke="#FFFFFF"
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  filter={isDark ? 'url(#syriaGlow)' : undefined}
                />

                {/* Pin Text Label */}
                {showLabels && (
                  <g className="pointer-events-none">
                    <rect
                      x={pos.x - 48}
                      y={pos.y + 8}
                      width="96"
                      height="18"
                      rx="5"
                      fill={colors.labelBg}
                      opacity={isDark ? 0.9 : 0.95}
                      stroke={isSelected ? pinColor : colors.labelBorder}
                      strokeWidth={isSelected ? 1.5 : 0.75}
                    />
                    <text
                      x={pos.x}
                      y={pos.y + 20}
                      textAnchor="middle"
                      fill={colors.labelText}
                      fontSize="9"
                      fontWeight="bold"
                    >
                      {pin.name.length > 17 ? pin.name.slice(0, 16) + '..' : pin.name}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
