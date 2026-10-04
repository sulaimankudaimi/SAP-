import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency, formatNumber } from '../../../core/utils';
import type { TrendDataPoint } from '../services/dashboardService';

export interface ProcurementTrendChartProps {
  data: TrendDataPoint[];
  selectedDays: 30 | 90 | 365;
  onPeriodChange: (days: 30 | 90 | 365) => void;
  isLoading?: boolean;
}

export const ProcurementTrendChart: React.FC<ProcurementTrendChartProps> = ({
  data,
  selectedDays,
  onPeriodChange,
}) => {
  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#0F172A]">حركة المشتريات والتعاقدات عبر الزمن</h3>
          <p className="text-xs text-[#64748B] mt-0.5">
            تطور حجم الإنفاق التراكمي وتدفق أوامر الشراء الصادرة
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="bg-[#F4F7FB] border border-[#E5EAF2] rounded-xl p-1 flex items-center text-xs self-start">
          {[
            { label: '30 يوماً', val: 30 as const },
            { label: '90 يوماً', val: 90 as const },
            { label: 'سنة كاملة', val: 365 as const },
          ].map((period) => (
            <button
              key={period.val}
              onClick={() => onPeriodChange(period.val)}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedDays === period.val
                  ? 'bg-white text-[#0B2545] shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* Area Chart Container */}
      <div className="h-64 w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="procurementGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0FA37F" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#0FA37F" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5EAF2" />
            <XAxis
              dataKey="label"
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload as TrendDataPoint;
                  return (
                    <div
                      className="bg-white border border-[#E5EAF2] rounded-xl p-3 shadow-lg text-start font-sans text-xs space-y-1"
                      dir="rtl"
                    >
                      <p className="font-bold text-[#0B2545]">{item.label}</p>
                      <p className="text-[#0FA37F] font-semibold">
                        الإنفاق: {formatCurrency(item.amount, 'SAR')}
                      </p>
                      <p className="text-[#64748B] text-[11px]">
                        عدد الأوامر: {formatNumber(item.orderCount)} أمر شراء
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="#0FA37F"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#procurementGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
