import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs';
import { AskDataSearchBar } from '../components/AskDataSearchBar';
import { KPIOverviewGrid } from '../components/KPIOverviewGrid';
import { ReportRunnerView } from '../components/ReportRunnerView';
import { PredictiveAnalyticsView } from '../components/PredictiveAnalyticsView';
import { DepartmentDashboardsView } from '../components/DepartmentDashboardsView';
import { SnapshotsListView } from '../components/SnapshotsListView';
import { ReportCatalogService } from '../services/ReportCatalogService';
import type { ReportDefinition, ReportCategory } from '../../../types/models';
import {
  FileText,
  BarChart3,
  TrendingUp,
  Target,
  Sparkles,
  Camera,
  Star,
  Clock,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Package,
  Building,
  Truck,
  Building2,
  Landmark,
} from 'lucide-react';

type ReportsCenterTab = 'catalog' | 'runner' | 'dashboards' | 'predictive' | 'kpis' | 'snapshots';
const VALID_TABS: readonly ReportsCenterTab[] = ['catalog', 'runner', 'dashboards', 'predictive', 'kpis', 'snapshots'];

function isReportsCenterTab(tab: string): tab is ReportsCenterTab {
  return (VALID_TABS as readonly string[]).includes(tab);
}

export const ReportsCenterPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportsCenterTab>('catalog');
  const [selectedReportId, setSelectedReportId] = useState<string>('REP-MM-01');

  // Catalog State
  const [allReports, setAllReports] = useState<ReportDefinition[]>([]);
  const [catalogCategory, setCatalogCategory] = useState<string>('all');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [recentReportIds, setRecentReportIds] = useState<string[]>([]);

  useEffect(() => {
    const list = ReportCatalogService.getCatalog();
    setAllReports(list);
    setFavorites(ReportCatalogService.getFavorites());
    setRecentReportIds(ReportCatalogService.getRecentReports());
  }, []);

  const handleToggleFavorite = (e: React.MouseEvent, reportId: string) => {
    e.stopPropagation();
    const updated = ReportCatalogService.toggleFavorite(reportId);
    setFavorites(updated);
  };

  const handleOpenReport = (reportId: string) => {
    setSelectedReportId(reportId);
    setActiveTab('runner');
  };

  // Filter Catalog
  const filteredReports = allReports.filter((rep) => {
    if (showOnlyFavorites && !favorites.includes(rep.id)) return false;
    if (catalogCategory !== 'all' && rep.category !== catalogCategory) return false;
    if (catalogSearch) {
      const term = catalogSearch.toLowerCase();
      const matchTitle = rep.title.toLowerCase().includes(term);
      const matchCode = rep.code.toLowerCase().includes(term);
      const matchDesc = rep.description.toLowerCase().includes(term);
      if (!matchTitle && !matchCode && !matchDesc) return false;
    }
    return true;
  });

  const categoryCounts: Record<string, number> = {
    all: allReports.length,
    procurement: allReports.filter((r) => r.category === 'procurement').length,
    inventory: allReports.filter((r) => r.category === 'inventory').length,
    fleet: allReports.filter((r) => r.category === 'fleet').length,
    assets: allReports.filter((r) => r.category === 'assets').length,
    finance: allReports.filter((r) => r.category === 'finance').length,
  };

  const categories = [
    { id: 'all', label: `الكل (${categoryCounts.all})`, icon: FileText },
    { id: 'procurement', label: `المشتريات (${categoryCounts.procurement})`, icon: Package },
    { id: 'inventory', label: `المخزون (${categoryCounts.inventory})`, icon: Building },
    { id: 'fleet', label: `الأسطول (${categoryCounts.fleet})`, icon: Truck },
    { id: 'assets', label: `الأصول (${categoryCounts.assets})`, icon: Building2 },
    { id: 'finance', label: `المالية (${categoryCounts.finance})`, icon: Landmark },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumbs & Title */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Breadcrumbs
            items={[
              { label: 'الرئيسية', path: '/' },
              { label: 'مركز التقارير والتحليلات', path: '/reports' },
            ]}
          />
          <h1 className="text-2xl font-bold text-[#0B2545] tracking-tight mt-1 flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-emerald-600" />
            <span>مركز التقارير والذكاء التحليلي (Analytics & Reporting Center)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            كتالوج التقارير القياسية الشاملة، المشغل التفاعلي، التحليلات التنبؤية بالطلب، ومكتبة مؤشرات الأداء (KPIs).
          </p>
        </div>
      </div>

      {/* "Ask the Data" Natural Language Search Engine */}
      <AskDataSearchBar
        onSelectReport={handleOpenReport}
        onNavigateTab={(tab) => {
          if (isReportsCenterTab(tab)) setActiveTab(tab);
        }}
      />

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        {(
          [
            { id: 'catalog' as const, label: 'كتالوج التقارير الشامل', icon: FileText, count: allReports.length },
            { id: 'runner' as const, label: 'مشغل التقارير التفاعلي', icon: BarChart3, count: undefined },
            { id: 'dashboards' as const, label: 'لوحات المؤشرات الإدارية', icon: TrendingUp, count: undefined },
            { id: 'predictive' as const, label: 'التحليلات التنبؤية وكشف الشذوذ', icon: Sparkles, count: undefined },
            { id: 'kpis' as const, label: 'مكتبة مؤشرات الأداء (KPIs)', icon: Target, count: undefined },
            { id: 'snapshots' as const, label: 'اللقطات المؤرشفة', icon: Camera, count: undefined },
          ]
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                isActive
                  ? 'bg-[#0B2545] text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 1. Categorized Catalog Tab                                        */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          {/* Filters & Search Row */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Category segmented buttons */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setCatalogCategory(cat.id);
                    setShowOnlyFavorites(false);
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    catalogCategory === cat.id && !showOnlyFavorites
                      ? 'bg-white text-[#0B2545] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {/* Favorites toggle button */}
              <button
                type="button"
                onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition-colors cursor-pointer ${
                  showOnlyFavorites
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${showOnlyFavorites ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
                <span>المفضلة فقط ({favorites.length})</span>
              </button>

              {/* Text Search Input */}
              <div className="relative w-64">
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="بحث في التقارير أو الرمز..."
                  className="w-full ps-3 pe-8 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600"
                />
                <Search className="w-3.5 h-3.5 absolute end-2.5 top-2.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Recent Reports Bar (if any) */}
          {recentReportIds.length > 0 && !showOnlyFavorites && !catalogSearch && (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                تقارير تم تشغيلها مؤخراً
              </span>
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                {recentReportIds.map((repId) => {
                  const rep = allReports.find((r) => r.id === repId);
                  if (!rep) return null;
                  return (
                    <button
                      key={rep.id}
                      onClick={() => handleOpenReport(rep.id)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-700 flex items-center gap-2 whitespace-nowrap shadow-2xs transition-colors cursor-pointer"
                    >
                      <span className="font-mono text-[10px] text-slate-400">{rep.code}</span>
                      <span>{rep.title.split('(')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reports Catalog Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredReports.map((rep) => {
              const isFav = favorites.includes(rep.id);

              return (
                <Card
                  key={rep.id}
                  onClick={() => handleOpenReport(rep.id)}
                  className="p-5 border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer bg-white flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-[#0B2545] text-white rounded text-xs font-mono font-bold">
                          {rep.code}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          {rep.category}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleToggleFavorite(e, rep.id)}
                        className="p-1 text-slate-400 hover:text-amber-500 rounded-md transition-colors"
                        title={isFav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                      >
                        <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400 text-amber-500' : ''}`} />
                      </button>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors leading-snug">
                      {rep.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {rep.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
                    <span>{rep.columns.length} أعمدة تحليلية</span>
                    <span className="font-bold text-emerald-600 group-hover:translate-x-[-2px] transition-transform flex items-center gap-1">
                      <span>تشغيل التقرير</span>
                      <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 2. Generic Report Runner Tab                                      */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'runner' && (
        <ReportRunnerView
          reportId={selectedReportId}
          onBackToCatalog={() => setActiveTab('catalog')}
        />
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 3. Departmental Dashboards Tab                                    */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'dashboards' && (
        <DepartmentDashboardsView onSelectReport={handleOpenReport} />
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 4. Predictive Analytics Tab                                       */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'predictive' && <PredictiveAnalyticsView />}

      {/* ----------------------------------------------------------------- */}
      {/* 5. KPI Library & Registry Tab                                     */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'kpis' && <KPIOverviewGrid onSelectReport={handleOpenReport} />}

      {/* ----------------------------------------------------------------- */}
      {/* 6. Snapshots Archive Tab                                          */}
      {/* ----------------------------------------------------------------- */}
      {activeTab === 'snapshots' && <SnapshotsListView onOpenReport={handleOpenReport} />}
    </div>
  );
};
