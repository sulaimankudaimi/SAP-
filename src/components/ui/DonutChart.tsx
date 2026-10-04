import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { cn, formatNumber } from '../../core/utils';

export interface DonutDataItem {
  name: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  data: DonutDataItem[];
  totalLabel?: string;
  totalValue?: string | number;
  height?: number;
  className?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  totalLabel,
  totalValue,
  height = 240,
  className,
}) => {
  const calculatedTotal =
    totalValue ?? data.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className={cn('w-full flex flex-col items-center justify-center relative', className)}>
      <div className="w-full relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              formatter={(value: unknown, name: unknown) => [
                typeof value === 'number' ? formatNumber(value) : String(value ?? ''),
                String(name ?? ''),
              ]}
              contentStyle={{
                backgroundColor: '#FFFFFF',
                borderColor: '#E5EAF2',
                borderRadius: '12px',
                fontSize: '12px',
                direction: 'rtl',
                textAlign: 'right',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={85}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="#FFFFFF" strokeWidth={2} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Text */}
        {(totalLabel || totalValue !== undefined) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            {totalLabel && <span className="text-[11px] font-semibold text-[#64748B]">{totalLabel}</span>}
            <span className="text-xl font-bold text-[#0F172A] font-sans">
              {typeof calculatedTotal === 'number' ? formatNumber(calculatedTotal) : calculatedTotal}
            </span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="w-full flex flex-wrap items-center justify-center gap-4 mt-3 pt-3 border-t border-[#F4F7FB]">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-xs text-[#64748B]">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span>{item.name}:</span>
            <strong className="text-[#0F172A] font-mono">{formatNumber(item.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};
