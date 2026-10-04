import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowUpRight } from 'lucide-react';
import { StatusChip } from '../../../components/ui/Badge';
import { formatCurrency, formatDate } from '../../../core/utils';
import type { PurchaseOrder } from '../../../types/models';
import type { StatusVariant } from '../../../types';

export interface RecentOrdersTableProps {
  orders: PurchaseOrder[];
}

export const RecentOrdersTable: React.FC<RecentOrdersTableProps> = ({ orders }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[#0F172A]">أحدث أوامر الشراء (Recent Purchase Orders)</h3>
          <p className="text-xs text-[#64748B] mt-0.5">
            آخر المستندات الصادرة والمعتمدة للتوريد والتشغيل
          </p>
        </div>
        <Link
          to="/procurement/po"
          className="text-xs font-semibold text-[#0FA37F] hover:text-[#0c8a6c] flex items-center gap-1"
        >
          <span>عرض الكل</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-start text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#E5EAF2] text-[#64748B] font-bold">
              <th className="py-2.5 px-3 text-start">رقم المستند</th>
              <th className="py-2.5 px-3 text-start">المورد المعتمد</th>
              <th className="py-2.5 px-3 text-start">القيمة الإجمالية</th>
              <th className="py-2.5 px-3 text-start">التاريخ</th>
              <th className="py-2.5 px-3 text-start">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5EAF2]">
            {orders.map((po) => (
              <tr key={po.id} className="hover:bg-[#F4F7FB]/70 transition-colors">
                <td className="py-2.5 px-3 font-mono font-bold text-[#0B2545]">
                  <Link to="/procurement/po" className="hover:underline">
                    {po.docNumber}
                  </Link>
                </td>
                <td className="py-2.5 px-3 text-[#0F172A] font-medium truncate max-w-[160px]">
                  {po.vendorName}
                </td>
                <td className="py-2.5 px-3 font-mono font-semibold text-[#0F172A]">
                  {formatCurrency(po.totalAmount, po.currency)}
                </td>
                <td className="py-2.5 px-3 font-mono text-[#64748B]">
                  {formatDate(po.orderDate)}
                </td>
                <td className="py-2.5 px-3">
                  <StatusChip variant={po.status as StatusVariant} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
