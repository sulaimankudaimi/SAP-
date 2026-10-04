import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { KPIRegistryService } from '../services/KPIRegistryService';
import type { KPIResult, ReportCategory } from '../../../types/models';
import {
  TrendingUp,
  TrendingDown,
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ArrowRight,
  Filter,
} from 'lucide-react';

interface KPIOverviewGridProps {
  onSelectReport: (reportId: string) => void;
}

export const KPIOverviewGrid: React.FC<KPIOverviewGridProps> = ({ onSelectReport }) => {
  const [kpis, setKpis] = useState<KPIResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedFormulaId, setExpandedFormulaId] = useState<string | null>(null);

  const loadKpis = async () => {
    setIsLoading(true);
    try {
      const data = await KPIRegistryService.getAllCalculatedKPIs();
      setKpis(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadKpis();
  }, []);

  const categories: { id: string; label: string }[] = [
    { id: 'all', label: 'كافة المؤشرات (9)' },
    { id: 'procurement', label: 'المشتريات والتوريد' },
    { id: 'inventory', label: 'المخزون السلعي' },
    { id: 'fleet', label: 'الأسطول واللوجستيات' },
    { id: 'assets', label: 'الأصول الرأسمالية' },
  ];

  const filteredKpis =
    selectedCategory === 'all'
      ? kpis
      : kpis.filter((k) => k.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Category Filter Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-white text-[#0B2545] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            ضمن المستهدف (سليم)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            تحت المراقبة (تحذير)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
            يتطلب تدخلاً (حرج)
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 bg-slate-100 rounded-2xl animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredKpis.map((kpi) => {
            const isGoodTrend = kpi.higherIsBetter ? kpi.trend > 0 : kpi.trend < 0;
            const isExpanded = expandedFormulaId === kpi.id;

            return (
              <Card
                key={kpi.id}
                className="p-5 border border-slate-200 hover:border-slate-300 transition-all shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col justify-between space-y-4 group bg-white"
              >
                {/* Header & Status Indicator */}
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[11px] font-bold font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                      {kpi.key}
                    </span>

                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                        kpi.status === 'healthy'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : kpi.status === 'warning'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {kpi.status === 'healthy' && <CheckCircle2 className="w-3 h-3" />}
                      {kpi.status === 'warning' && <AlertTriangle className="w-3 h-3" />}
                      {kpi.status === 'critical' && <AlertOctagon className="w-3 h-3" />}
                      <span>
                        {kpi.status === 'healthy' ? 'مطابق' : kpi.status === 'warning' ? 'تحذير' : 'حرج'}
                      </span>
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-[#0B2545] leading-tight">
                    {kpi.name}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {kpi.description}
                  </p>
                </div>

                {/* Main Metric Value & Comparison */}
                <div className="p-3.5 bg-[#F4F7FB] rounded-xl flex items-end justify-between">
                  <div>
                    <div className="text-xs text-slate-500 font-medium">القيمة الحالية الفعلية</div>
                    <div className="text-2xl font-black text-[#0B2545] font-sans tracking-tight mt-0.5">
                      {kpi.formattedValue}
                    </div>
                  </div>

                  <div className="text-end space-y-1">
                    <div className="text-[11px] text-slate-500">
                      الهدف: <span className="font-bold font-sans text-slate-700">{kpi.targetValue} {kpi.unit}</span>
                    </div>
                    <div
                      className={`text-xs font-bold flex items-center justify-end gap-0.5 ${
                        isGoodTrend ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {kpi.trend >= 0 ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5" />
                      )}
                      <span dir="ltr">{kpi.trend > 0 ? `+${kpi.trend}` : kpi.trend}%</span>
                    </div>
                  </div>
                </div>

                {/* Formula toggle & Action */}
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setExpandedFormulaId(isExpanded ? null : kpi.id)}
                      className="text-[11px] text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Info className="w-3.5 h-3.5" />
                      <span>{isExpanded ? 'إخفاء المعادلة' : 'صيغة المعادلة الحسابية'}</span>
                    </button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSelectReport(kpi.relatedReportId)}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 p-0 h-auto gap-1"
                    >
                      <span>تشغيل التقرير المرتبط</span>
                      <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 animate-in fade-in duration-100">
                      <div className="text-[10px] text-slate-400 font-sans font-bold mb-0.5">
                        معادلة القياس المعتمدة:
                      </div>
                      {kpi.formula}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
