import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, AlertTriangle, ArrowUpRight, Plus } from 'lucide-react';
import { formatNumber } from '../../../core/utils';
import type { CriticalStockItem } from '../services/dashboardService';

export interface LowStockAlertsListProps {
  alerts: CriticalStockItem[];
}

export const LowStockAlertsList: React.FC<LowStockAlertsListProps> = ({ alerts }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[#0F172A]">تنبيهات المخزون الحرجة (Inventory Alerts)</h3>
          <p className="text-xs text-[#64748B] mt-0.5">
            المواد والأصناف التي تجاوزت حد الأمان أو نقطة إعادة الطلب
          </p>
        </div>
        <Link
          to="/inventory/reorder"
          className="text-xs font-semibold text-[#0FA37F] hover:text-[#0c8a6c] flex items-center gap-1"
        >
          <span>إعادة الطلب</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="space-y-2">
        {alerts.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#64748B] bg-[#F4F7FB] rounded-xl">
            كافة الأصناف والمواد البترولية ضمن الحدود الآمنة للمخزون.
          </div>
        ) : (
          alerts.map((item) => {
            const isCritical = item.severity === 'critical';
            return (
              <div
                key={item.materialCode}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                  isCritical
                    ? 'bg-red-50/60 border-red-200'
                    : 'bg-amber-50/60 border-amber-200'
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isCritical ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                    }`}
                  >
                    {isCritical ? <AlertCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  </div>

                  <div className="truncate text-start">
                    <span className="font-bold text-xs text-[#0F172A] block leading-tight truncate">
                      {item.materialName}
                    </span>
                    <span className="text-[10px] font-mono text-[#64748B] block mt-0.5">
                      {item.materialCode} | المحطة: {item.plantCode}
                    </span>
                  </div>
                </div>

                <div className="text-end shrink-0">
                  <div className="flex items-center justify-end gap-1.5 font-mono text-xs">
                    <span className="font-bold text-[#0F172A]">
                      {formatNumber(item.currentStock)} {item.unit}
                    </span>
                    <span className="text-[10px] text-slate-400">/ {formatNumber(item.reorderPoint)}</span>
                  </div>
                  <span
                    className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded-full mt-0.5 ${
                      isCritical
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {isCritical ? 'مخزون حرج (Safety Breach)' : 'بلغ نقطة الطلب (Reorder)'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
