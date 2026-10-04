import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency, formatNumber } from '../../../core/utils';
import type { SpendCategoryDistribution } from '../services/dashboardService';

export interface SpendDistributionDonutProps {
  categories: SpendCategoryDistribution[];
  total: number;
}

export const SpendDistributionDonut: React.FC<SpendDistributionDonutProps> = ({
  categories,
  total,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-[#0F172A]">توزيع الإنفاق حسب الفئة</h3>
        <p className="text-xs text-[#64748B] mt-0.5">
          النسب المئوية لحجم المشتريات التراكمية حسب مجموعات المواد
        </p>
      </div>

      <div className="relative h-56 w-full flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const cat = payload[0].payload as SpendCategoryDistribution;
                  return (
                    <div className="bg-white border border-[#E5EAF2] rounded-xl p-2.5 shadow-lg text-start text-xs space-y-1">
                      <p className="font-bold text-[#0B2545]">{cat.name}</p>
                      <p className="text-[#0FA37F] font-semibold">{formatCurrency(cat.amount, 'SAR')}</p>
                      <p className="text-[#64748B] text-[11px]">النسبة: {cat.percentage}%</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Pie
              data={categories}
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={3}
              dataKey="amount"
            >
              {categories.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="#FFFFFF" strokeWidth={2} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Total Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-[10px] font-semibold text-[#64748B]">إجمالي المشتريات</span>
          <span className="text-base font-bold text-[#0B2545] font-sans">
            {formatCurrency(total, 'SAR').split(' ')[0]}
          </span>
          <span className="text-[9px] font-bold text-emerald-600">ريال سعودي</span>
        </div>
      </div>

      {/* Legend with Categories & Percentages */}
      <div className="space-y-2 max-h-36 overflow-y-auto pt-1 border-t border-[#F4F7FB]">
        {categories.map((cat) => (
          <div key={cat.category} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 truncate">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="text-[#0F172A] font-medium truncate">{cat.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-slate-500 font-mono text-[11px]">{formatCurrency(cat.amount, 'SAR')}</span>
              <span className="px-1.5 py-0.2 rounded font-mono font-bold text-[10px] bg-slate-100 text-[#0B2545]">
                {cat.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
