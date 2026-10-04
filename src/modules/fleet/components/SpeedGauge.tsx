import React from 'react';

export interface SpeedGaugeProps {
  speed: number; // 0 to 140 km/h
  maxSpeed?: number;
  label?: string;
  vehiclePlate?: string;
  size?: number; // width in px
  showZones?: boolean;
}

export const SpeedGauge: React.FC<SpeedGaugeProps> = ({
  speed = 0,
  maxSpeed = 120,
  label = 'السرعة اللحظية',
  vehiclePlate,
  size = 200,
  showZones = true,
}) => {
  const clampedSpeed = Math.min(maxSpeed, Math.max(0, speed));
  const radius = 70;
  const strokeWidth = 12;
  const center = 100;

  // Semicircle arc angles: from 180 deg (left) to 0 deg (right) or 180 to 360
  // Standard gauge: angle from -180 deg to 0 deg
  // In RTL Arabic, 0 km/h starts at right (0 deg or -180 mirrored) or standard automotive left-to-right.
  // Automotive gauges start from bottom-left (180 deg) clockwise to bottom-right (0 deg / 360 deg).
  const angle = 180 + (clampedSpeed / maxSpeed) * 180;
  const radians = (angle * Math.PI) / 180;
  const needleLength = 55;
  const needleX = center + needleLength * Math.cos(radians);
  const needleY = center + needleLength * Math.sin(radians);

  // Speed status color
  const statusColor =
    clampedSpeed > 90 ? '#EF4444' : clampedSpeed > 75 ? '#F59E0B' : '#0FA37F';

  return (
    <div className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl border border-[#E5EAF2] shadow-sm select-none">
      <div className="relative" style={{ width: size, height: size * 0.65 }}>
        <svg
          viewBox="0 0 200 130"
          className="w-full h-full overflow-visible"
        >
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0FA37F" />
              <stop offset="60%" stopColor="#0FA37F" />
              <stop offset="75%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#EF4444" />
            </linearGradient>
          </defs>

          {/* Background Track */}
          <path
            d="M 30 100 A 70 70 0 0 1 170 100"
            fill="none"
            stroke="#E5EAF2"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Active colored arc based on showZones */}
          {showZones && (
            <path
              d="M 30 100 A 70 70 0 0 1 170 100"
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              opacity="0.85"
            />
          )}

          {/* Tick marks */}
          {[0, 30, 60, 90, 120].map((tick) => {
            const tickAngle = 180 + (tick / maxSpeed) * 180;
            const rad = (tickAngle * Math.PI) / 180;
            const x1 = center + 60 * Math.cos(rad);
            const y1 = center + 60 * Math.sin(rad);
            const x2 = center + 68 * Math.cos(rad);
            const y2 = center + 68 * Math.sin(rad);
            return (
              <g key={tick}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94A3B8" strokeWidth="2" />
                <text
                  x={center + 50 * Math.cos(rad)}
                  y={center + 50 * Math.sin(rad) + 4}
                  textAnchor="middle"
                  className="text-[9px] fill-[#64748B] font-mono font-bold"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Needle */}
          <line
            x1={center}
            y1={center}
            x2={needleX}
            y2={needleY}
            stroke={statusColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />

          {/* Center Hub */}
          <circle cx={center} cy={center} r="7" fill="#0B2545" />
          <circle cx={center} cy={center} r="3" fill="#FFFFFF" />
        </svg>

        {/* Speed Value in Center */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center text-center">
          <span
            className="text-2xl font-black font-mono tracking-tight"
            style={{ color: statusColor }}
          >
            {clampedSpeed}
          </span>
          <span className="text-[10px] font-bold text-[#64748B] -mt-1">كم / ساعة</span>
        </div>
      </div>

      <div className="mt-1 text-center">
        {vehiclePlate && (
          <span className="text-xs font-bold font-mono text-[#0F172A] block">
            {vehiclePlate}
          </span>
        )}
        <span className="text-[11px] text-[#64748B]">{label}</span>
      </div>
    </div>
  );
};
