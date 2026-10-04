import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '../../core/utils';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number; // e.g. 12.5 or -4.2
    isPositive?: boolean; // if positive is good
    label?: string;
  };
  subtitle?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  trend,
  subtitle,
  className,
}) => {
  const isUp = trend ? trend.value > 0 : false;
  const isDown = trend ? trend.value < 0 : false;
  const isNeutral = trend ? trend.value === 0 : true;

  // By default, trend up is green (#0FA37F), trend down is red (#EF4444)
  const isGood = trend?.isPositive !== undefined ? (isUp ? trend.isPositive : !trend.isPositive) : isUp;

  return (
    <div
      className={cn(
        'bg-white rounded-[16px] border border-[#E5EAF2] p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col justify-between transition-all hover:border-[#CBD5E1]',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#64748B]">{label}</span>
        <div className="w-10 h-10 rounded-xl bg-[#F4F7FB] border border-[#E5EAF2] text-[#0B2545] flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>

      <div className="mt-4">
        <div className="text-2xl font-bold text-[#0F172A] tracking-tight font-sans">
          {value}
        </div>

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#F4F7FB] text-xs">
          {trend ? (
            <div
              className={cn(
                'inline-flex items-center gap-1 font-semibold text-xs',
                isNeutral
                  ? 'text-[#64748B]'
                  : isGood
                  ? 'text-[#0FA37F]'
                  : 'text-[#EF4444]'
              )}
            >
              {isUp && <ArrowUpRight className="w-3.5 h-3.5" />}
              {isDown && <ArrowDownRight className="w-3.5 h-3.5" />}
              {isNeutral && <Minus className="w-3.5 h-3.5" />}
              <span dir="ltr">{Math.abs(trend.value)}%</span>
              {trend.label && <span className="text-[#64748B] font-normal ms-1">{trend.label}</span>}
            </div>
          ) : (
            <span className="text-[11px] text-[#64748B]">{subtitle || ''}</span>
          )}
        </div>
      </div>
    </div>
  );
};
