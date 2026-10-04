import React, { useState, useEffect } from 'react';
import { Search, Sparkles, ArrowLeft, Target, BookOpen, AlertCircle } from 'lucide-react';
import { NaturalLanguageSearchService, type NLSearchResult } from '../services/NaturalLanguageSearchService';
import { ReportCatalogService } from '../services/ReportCatalogService';
import type { KPIResult, ReportDefinition } from '../../../types/models';

interface AskDataSearchBarProps {
  onSelectReport: (reportId: string) => void;
  onNavigateTab: (tabId: string) => void;
}

export const AskDataSearchBar: React.FC<AskDataSearchBarProps> = ({
  onSelectReport,
  onNavigateTab,
}) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<NLSearchResult | null>(null);
  const [allReports, setAllReports] = useState<ReportDefinition[]>([]);

  useEffect(() => {
    setAllReports(ReportCatalogService.getCatalog());
  }, []);

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (!text.trim()) {
      setSearchResult(null);
      return;
    }
    setIsSearching(true);
    try {
      const res = await NaturalLanguageSearchService.search(text, allReports);
      setSearchResult(res);
    } finally {
      setIsSearching(false);
    }
  };

  const sampleQueries = [
    'معدل دوران المخزون السلعي',
    'نسبة تسليم الموردين OTIF',
    'الإنفاق المدار بعقود إطارية',
    'تكلفة الكيلومتر لاستهلاك الوقود',
    'تراكم أوامر صيانة الشاحنات',
    'استغلال الأصول الرأسمالية',
    'تنبؤ الطلب للوقود',
  ];

  return (
    <div className="relative w-full space-y-3">
      {/* Search Bar Input */}
      <div className="relative flex items-center">
        <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none text-emerald-600">
          <Sparkles className="w-5 h-5 animate-pulse" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="اسأل البيانات باللغة الطبيعية (مثال: كم معدل دوران المخزون؟، الإنفاق تحت العقود، تكلفة الكيلومتر، فواتير الموردين)..."
          className="w-full ps-12 pe-4 py-3.5 bg-white border-2 border-emerald-500/30 rounded-2xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-all"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setSearchResult(null);
            }}
            className="absolute inset-y-0 end-0 pe-4 flex items-center text-xs text-slate-400 hover:text-slate-600"
          >
            مسح
          </button>
        )}
      </div>

      {/* Suggested Quick Queries */}
      <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
        <span className="font-bold text-slate-600 flex items-center gap-1">
          <Search className="w-3.5 h-3.5" />
          استعلامات شائعة:
        </span>
        {sampleQueries.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSearch(q)}
            className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-lg transition-colors cursor-pointer"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Live Results Panel */}
      {searchResult && (searchResult.matchedKPIs.length > 0 || searchResult.matchedReportIds.length > 0) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-bold text-slate-600">
              نتائج استعلام الذكاء التحليلي: "{query}"
            </span>
            {searchResult.suggestedActionLabel && searchResult.suggestedActionTab && (
              <button
                onClick={() => onNavigateTab(searchResult.suggestedActionTab!)}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-md transition-colors"
              >
                <span>{searchResult.suggestedActionLabel}</span>
                <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
              </button>
            )}
          </div>

          {/* Matched KPIs Cards */}
          {searchResult.matchedKPIs.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                مؤشرات الأداء المطابقة (KPI Match)
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {searchResult.matchedKPIs.map((kpi) => (
                  <div
                    key={kpi.id}
                    className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 hover:border-emerald-400 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-[#0B2545]">{kpi.name}</span>
                        <div className="text-[10px] text-slate-500 font-mono">{kpi.formula}</div>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-bold ${
                          kpi.status === 'healthy'
                            ? 'bg-emerald-100 text-emerald-800'
                            : kpi.status === 'warning'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {kpi.formattedValue}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500">
                        الهدف المستهدف: {kpi.targetValue} {kpi.unit}
                      </span>
                      <button
                        onClick={() => onSelectReport(kpi.relatedReportId)}
                        className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1"
                      >
                        <span>عرض التقرير التفصيلي</span>
                        <ArrowLeft className="w-3 h-3 rtl:rotate-180" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matched Reports List */}
          {searchResult.matchedReportIds.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                التقارير التفصيلية الموصى بها
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {searchResult.matchedReportIds.map((repId) => {
                  const rep = allReports.find((r) => r.id === repId);
                  if (!rep) return null;
                  return (
                    <div
                      key={rep.id}
                      onClick={() => onSelectReport(rep.id)}
                      className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer group transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#0B2545]/5 text-[#0B2545] flex items-center justify-center font-bold text-xs font-mono">
                          {rep.code}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                            {rep.title}
                          </div>
                          <div className="text-[11px] text-slate-400 line-clamp-1">{rep.description}</div>
                        </div>
                      </div>
                      <span className="text-xs text-emerald-600 font-bold group-hover:translate-x-[-2px] transition-transform">
                        تشغيل ←
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
