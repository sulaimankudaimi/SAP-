import React from 'react';
import { cn } from '../../core/utils';

export interface ProgressBarProps {
  value: number; // 0 to 100
  color?: 'primary' | 'blue' | 'amber' | 'red';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  color = 'primary',
  size = 'md',
  showLabel = false,
  className,
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));

  const colorStyles = {
    primary: 'bg-[#0FA37F]',
    blue: 'bg-[#2563EB]',
    amber: 'bg-[#F59E0B]',
    red: 'bg-[#EF4444]',
  };

  const sizeStyles = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  return (
    <div className={cn('w-full space-y-1', className)}>
      {showLabel && (
        <div className="flex justify-between items-center text-xs font-semibold text-[#0F172A]">
          <span>الإنجاز</span>
          <span dir="ltr">{clampedValue}%</span>
        </div>
      )}
      <div className={cn('w-full bg-[#E5EAF2] rounded-full overflow-hidden', sizeStyles[size])}>
        <div
          className={cn('h-full rounded-full transition-all duration-500 ease-out', colorStyles[color])}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
};

export interface KPIProgressBarProps {
  label: string;
  actual: number;
  target: number;
  unit?: string;
  className?: string;
}

export const KPIProgressBar: React.FC<KPIProgressBarProps> = ({
  label,
  actual,
  target,
  unit = '',
  className,
}) => {
  const percentage = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
  const isOver = actual >= target;

  return (
    <div className={cn('p-4 rounded-xl bg-[#F4F7FB] border border-[#E5EAF2] space-y-2', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-[#0F172A]">{label}</span>
        <span
          className={cn(
            'font-semibold px-2 py-0.5 rounded-full text-[10px]',
            isOver ? 'bg-[#0FA37F]/10 text-[#0FA37F]' : 'bg-[#2563EB]/10 text-[#2563EB]'
          )}
          dir="ltr"
        >
          {percentage}%
        </span>
      </div>

      <div className="w-full bg-[#E5EAF2] h-2 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isOver ? 'bg-[#0FA37F]' : percentage > 50 ? 'bg-[#2563EB]' : 'bg-[#F59E0B]'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#64748B]">
        <span>الفعلي: <strong className="text-[#0F172A] font-mono">{actual} {unit}</strong></span>
        <span>المستهدف: <strong className="text-[#0F172A] font-mono">{target} {unit}</strong></span>
      </div>
    </div>
  );
};
