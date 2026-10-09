import { DiagnosticLogger } from '../../../core/services/DiagnosticLogger';
import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { StatCard } from '../../../components/ui/StatCard';
import { Badge } from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { AssetService } from '../services/AssetService';
import type { Asset } from '../../../types/models';
import {
  Trash2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Search,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { t } from '../../../i18n/ar';

export const AssetDisposalsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [disposedAssets, setDisposedAssets] = useState<Asset[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const all = await AssetService.getAssets({ status: 'Disposed' });
      setDisposedAssets(all);
    } catch (err) {
      DiagnosticLogger.error('AssetDisposalsPage', 'Error occurred', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalCost = disposedAssets.reduce((sum, a) => sum + a.acquisitionCost, 0);
  const totalProceeds = disposedAssets.reduce((sum, a) => sum + (a.disposalProceeds || 0), 0);
  const netGainLoss = disposedAssets.reduce((sum, a) => sum + (a.disposalGainLoss || 0), 0);

  const filteredAssets = disposedAssets.filter((a) => {
    if (typeFilter && a.disposalType !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchNum = a.assetNumber.toLowerCase().includes(q);
      const matchName = a.name.toLowerCase().includes(q);
      const matchJe = a.disposalJeDocNumber?.toLowerCase().includes(q);
      if (!matchNum && !matchName && !matchJe) return false;
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 border border-rose-200">
            SAP Transactions ABAVN / ABAON
          </span>
          <span className="text-xs text-slate-500 font-mono">Asset Retirement & Disposal Ledger</span>
        </div>
        <h1 className="text-2xl font-black text-[#0B2545] tracking-tight mt-1">
          {t('nav_disposal')}
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          سجل استبعاد وتخريد وبيع الأصول الثابتة، إثبات أرباح وخسائر البيع، وربط قيود الأستاذ العام
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="إجمالي تكلفة الأصول المستبعدة"
          value={`${totalCost.toLocaleString('en-US')} SAR`}
          subtitle={`عدد الأصول المكهنة: ${disposedAssets.length} أصل`}
          icon={<Trash2 className="w-5 h-5 text-rose-600" />}
        />

        <StatCard
          label="متحصلات البيع المحققة"
          value={`${totalProceeds.toLocaleString('en-US')} SAR`}
          subtitle="متحصلات مبيعات خردة ومعدات خارج الخدمة"
          icon={<DollarSign className="w-5 h-5 text-blue-600" />}
        />

        <StatCard
          label="صافي الأرباح / (الخسائر) الرأسمالية"
          value={`${netGainLoss.toLocaleString('en-US')} SAR`}
          subtitle={netGainLoss >= 0 ? 'أرباح رأسمالية مرحلة للأستاذ العام' : 'خسائر استبعاد مرحلة للأستاذ العام'}
          icon={netGainLoss >= 0 ? <TrendingUp className="w-5 h-5 text-emerald-600" /> : <TrendingDown className="w-5 h-5 text-rose-600" />}
        />
      </div>

      {/* Filters */}
      <Card className="p-4 shadow-sm border border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute top-3 end-3" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم الأصل، اسم الأصل، رقم قيد الاستبعاد..."
              className="pe-9 text-xs"
            />
          </div>

          <div>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[
                { value: '', label: 'كافة أنواع الاستبعاد' },
                { value: 'Scrap', label: 'تخريد بدون قيمة (Scrap)' },
                { value: 'Sale', label: 'بيع بمتحصلات نقدية (Sale)' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="p-0 shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            لا توجد أصول مكهنة أو مستبعدة تطابق معايير البحث.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-start">رقم الأصل</th>
                  <th className="py-3 px-3 text-start">اسم الأصل</th>
                  <th className="py-3 px-3 text-start">تاريخ الاستبعاد</th>
                  <th className="py-3 px-3 text-start">النوع</th>
                  <th className="py-3 px-3 text-start">التكلفة التاريخية</th>
                  <th className="py-3 px-3 text-start">مجمع الإهلاك</th>
                  <th className="py-3 px-3 text-start">متحصلات البيع</th>
                  <th className="py-3 px-3 text-start">الأثر المالي (ربح/خسارة)</th>
                  <th className="py-3 px-3 text-start">قيد الأستاذ العام</th>
                  <th className="py-3 px-3 text-start">أسباب الاستبعاد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssets.map((asset) => {
                  const gainLoss = asset.disposalGainLoss ?? 0;
                  return (
                    <tr key={asset.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-mono font-bold text-blue-900">{asset.assetNumber}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800">{asset.name}</td>
                      <td className="py-3 px-3 font-mono">{asset.disposalDate || '—'}</td>
                      <td className="py-3 px-3">
                        <Badge variant={asset.disposalType === 'Sale' ? 'in_progress' : 'rejected'}>
                          {asset.disposalType === 'Sale' ? 'بيع' : 'تخريد'}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700">
                        {asset.acquisitionCost.toLocaleString('en-US')} SAR
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700">
                        {asset.accumulatedDepreciation.toLocaleString('en-US')} SAR
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-800 font-bold">
                        {(asset.disposalProceeds || 0).toLocaleString('en-US')} SAR
                      </td>
                      <td className="py-3 px-3 font-mono font-bold">
                        <span className={gainLoss > 0 ? 'text-emerald-700' : gainLoss < 0 ? 'text-rose-600' : 'text-slate-600'}>
                          {gainLoss > 0 ? `+${gainLoss.toLocaleString('en-US')}` : gainLoss.toLocaleString('en-US')} SAR
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-blue-800">
                        {asset.disposalJeDocNumber || '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-500 max-w-[150px] truncate" title={asset.disposalReason}>
                        {asset.disposalReason || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
