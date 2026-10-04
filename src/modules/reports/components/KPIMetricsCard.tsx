import React from 'react';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { CheckCircle2, TrendingUp, ShieldCheck, Truck, Users } from 'lucide-react';
import type { OperationalKPIs } from '../services/dashboardService';

export interface KPIMetricsCardProps {
  kpis: OperationalKPIs;
}

export const KPIMetricsCard: React.FC<KPIMetricsCardProps> = ({ kpis }) => {
  const metricItems = [
    {
      title: 'الالتزام بمواعيد التوريد (On-Time Delivery)',
      value: kpis.vendorOnTimeDelivery,
      target: 95,
      color: 'primary' as const,
      icon: <CheckCircle2 className="w-4 h-4 text-[#0FA37F]" />,
      desc: 'نسبة وصول شحنات الوقود والمهمات في الموعد التعاقدي',
    },
    {
      title: 'دقة مطابقة المخزون (Record Accuracy)',
      value: kpis.inventoryAccuracy,
      target: 99,
      color: 'primary' as const,
      icon: <ShieldCheck className="w-4 h-4 text-[#2563EB]" />,
      desc: 'نسبة تطابق أرصدة الجرد الميداني مع السجلات الدفترية',
    },
    {
      title: 'معدل استغلال الأسطول (Fleet Utilization)',
      value: kpis.fleetUtilization,
      target: 80,
      color: 'blue' as const,
      icon: <Truck className="w-4 h-4 text-[#0B2545]" />,
      desc: 'نسبة الصهاريج والشاحنات في الرحلات النشطة مقارنة بالجاهزية',
    },
    {
      title: 'مؤشر أداء وتقييم الموردين (Vendor Score)',
      value: kpis.vendorQualityScore,
      target: 85,
      color: 'amber' as const,
      icon: <Users className="w-4 h-4 text-[#F59E0B]" />,
      desc: 'متوسط درجات الجودة والامتثال لموردي أرامكو والشركاء',
    },
  ];

  return (
    <div className="space-y-4 text-start">
      <div>
        <h3 className="text-sm font-bold text-[#0F172A]">مؤشرات الأداء الرئيسية (Operations Scorecard)</h3>
        <p className="text-xs text-[#64748B] mt-0.5">
          الالتزام بالمعايير التشغيلية المعتمدة لمحطات الطاقة وسلاسل الإمداد
        </p>
      </div>

      <div className="space-y-3.5">
        {metricItems.map((item) => (
          <div key={item.title} className="p-3 bg-[#F4F7FB] rounded-xl border border-[#E5EAF2] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {item.icon}
                <span className="text-xs font-bold text-[#0F172A]">{item.title}</span>
              </div>
              <div className="flex items-center gap-1 font-mono text-xs font-bold">
                <span className="text-[#0B2545]">{item.value}%</span>
                <span className="text-[10px] text-slate-400 font-normal">/ {item.target}%</span>
              </div>
            </div>

            <ProgressBar value={item.value} color={item.color} size="sm" />

            <span className="text-[10px] text-[#64748B] block leading-tight">
              {item.desc}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
