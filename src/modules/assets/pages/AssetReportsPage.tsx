import React, { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { Skeleton } from '../../../components/ui/Skeleton';
import { AssetService } from '../services/AssetService';
import { exportToCsv } from '../../../core/utils/importExport';
import type { Asset } from '../../../types/models';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Building2,
  Calendar,
  Layers,
  TrendingDown,
  Trash2,
} from 'lucide-react';
import { t } from '../../../i18n/ar';

export const AssetReportsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<'register' | 'schedule' | 'additions_disposals'>('register');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedPlant, setSelectedPlant] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const all = await AssetService.getAssets({
        plantCode: selectedPlant || undefined,
        category: selectedCategory || undefined,
      });
      setAssets(all);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedPlant, selectedCategory]);

  const handleExport = () => {
    if (activeReport === 'register') {
      const data = assets.map((a) => ({
        'رقم الأصل': a.assetNumber,
        'اسم الأصل': a.name,
        'الفئة': a.category,
        'المحطة': a.plantCode,
        'الموقع': a.location || '',
        'مركز التكلفة': a.costCenter,
        'أمين العهدة': a.custodian,
        'تاريخ الاقتناء': a.acquisitionDate,
        'التكلفة التاريخية': a.acquisitionCost,
        'مجمع الإهلاك': a.accumulatedDepreciation,
        'صافي القيمة الدفترية': a.netBookValue,
        'الحالة': a.status,
      }));
      exportToCsv(data, `تقرير_سجل_الأصول_${new Date().toISOString().split('T')[0]}`);
    } else if (activeReport === 'schedule') {
      const data = assets.map((a) => {
        const annualDep = (a.acquisitionCost - a.salvageValue) / (a.usefulLifeMonths / 12);
        return {
          'رقم الأصل': a.assetNumber,
          'اسم الأصل': a.name,
          'التكلفة التاريخية': a.acquisitionCost,
          'طريقة الإهلاك': a.depreciationMethod,
          'العمر الإنتاجي (أشهر)': a.usefulLifeMonths,
          'قيمة الخردة': a.salvageValue,
          'الإهلاك السنوي المقدر': Math.round(annualDep),
          'الإهلاك الشهري المقدر': Math.round(annualDep / 12),
          'مجمع الإهلاك الحالي': a.accumulatedDepreciation,
          'صافي القيمة الدفترية': a.netBookValue,
        };
      });
      exportToCsv(data, `جدول_الإهلاك_المقدر_${new Date().toISOString().split('T')[0]}`);
    } else {
      const additions = assets.filter((a) => a.status !== 'Disposed');
      const disposals = assets.filter((a) => a.status === 'Disposed');
      const data = [
        ...additions.map((a) => ({
          'نوع الحركة': 'إضافة / اقتناء',
          'رقم الأصل': a.assetNumber,
          'اسم الأصل': a.name,
          'التاريخ': a.acquisitionDate,
          'التكلفة التاريخية': a.acquisitionCost,
          'متحصلات البيع': 0,
          'الأرباح / الخسائر': 0,
          'ملاحظات': a.acquisitionSource || 'Manual',
        })),
        ...disposals.map((a) => ({
          'نوع الحركة': a.disposalType === 'Sale' ? 'استبعاد بالبيع' : 'استبعاد بالتخريد',
          'رقم الأصل': a.assetNumber,
          'اسم الأصل': a.name,
          'التاريخ': a.disposalDate || '',
          'التكلفة التاريخية': a.acquisitionCost,
          'متحصلات البيع': a.disposalProceeds || 0,
          'الأرباح / الخسائر': a.disposalGainLoss || 0,
          'ملاحظات': a.disposalReason || '',
        })),
      ];
      exportToCsv(data, `تقرير_الإضافات_والاستبعادات_${new Date().toISOString().split('T')[0]}`);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-[#0FA37F]/10 text-emerald-800 border border-emerald-300">
              SAP FI-AA Reporting
            </span>
            <span className="text-xs text-slate-500 font-mono">Asset Accounting Reports</span>
          </div>
          <h1 className="text-2xl font-black text-[#0B2545] tracking-tight mt-1">
            تقارير وتحليلات الأصول الرأسمالية (Asset Reports)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            سجل الأصول الشامل، جدول الإهلاك السنوي، وسجل الإضافات والاستبعادات الرأسمالية
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleExport}
            className="bg-[#0FA37F] hover:bg-[#0c8a6c] gap-2 font-bold text-xs"
          >
            <Download className="w-4 h-4" />
            <span>تصدير التقرير الحالي CSV</span>
          </Button>
        </div>
      </div>

      {/* Report Selection Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl max-w-xl">
        <button
          onClick={() => setActiveReport('register')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeReport === 'register'
              ? 'bg-white text-[#0B2545] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          1. تقرير سجل الأصول الشامل
        </button>

        <button
          onClick={() => setActiveReport('schedule')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeReport === 'schedule'
              ? 'bg-white text-[#0B2545] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          2. جدول الإهلاك السنوي والشهري
        </button>

        <button
          onClick={() => setActiveReport('additions_disposals')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeReport === 'additions_disposals'
              ? 'bg-white text-[#0B2545] shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          3. تقرير الإضافات والاستبعادات
        </button>
      </div>

      {/* Filters */}
      <Card className="p-4 shadow-sm border border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">تصفية حسب المنشأة / المحطة</label>
            <Select
              value={selectedPlant}
              onChange={(e) => setSelectedPlant(e.target.value)}
              options={[
                { value: '', label: 'كافة المحطات' },
                { value: '1100', label: '1100 - محطة الرياض' },
                { value: '1200', label: '1200 - محطة جدة' },
                { value: '1300', label: '1300 - مستودع الدمام' },
              ]}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">تصفية حسب فئة الأصل</label>
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              options={[
                { value: '', label: 'كافة الفئات' },
                { value: 'Machinery', label: 'الآلات والمضخات' },
                { value: 'StorageTanks', label: 'خزانات الوقود' },
                { value: 'Vehicles', label: 'الصهاريج والشاحنات' },
                { value: 'Buildings', label: 'المباني والمنشآت' },
                { value: 'Pipelines', label: 'خطوط الأنابيب' },
                { value: 'IT', label: 'تقنية المعلومات' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Report Content Table */}
      <Card className="p-0 shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            {activeReport === 'register' && (
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 text-start">رقم الأصل</th>
                    <th className="py-2.5 px-3 text-start">اسم الأصل</th>
                    <th className="py-2.5 px-3 text-start">الفئة</th>
                    <th className="py-2.5 px-3 text-start">المحطة</th>
                    <th className="py-2.5 px-3 text-start">أمين العهدة</th>
                    <th className="py-2.5 px-3 text-start">تاريخ الاقتناء</th>
                    <th className="py-2.5 px-3 text-start">التكلفة التاريخية</th>
                    <th className="py-2.5 px-3 text-start">مجمع الإهلاك</th>
                    <th className="py-2.5 px-3 text-start">صافي القيمة الدفترية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assets.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{a.assetNumber}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{a.name}</td>
                      <td className="py-2.5 px-3 text-slate-600">{a.category}</td>
                      <td className="py-2.5 px-3 text-slate-600">{a.plantCode}</td>
                      <td className="py-2.5 px-3 text-slate-700">{a.custodian}</td>
                      <td className="py-2.5 px-3 font-mono">{a.acquisitionDate}</td>
                      <td className="py-2.5 px-3 font-mono">{a.acquisitionCost.toLocaleString('en-US')} SAR</td>
                      <td className="py-2.5 px-3 font-mono text-rose-600">{a.accumulatedDepreciation.toLocaleString('en-US')} SAR</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-800">{a.netBookValue.toLocaleString('en-US')} SAR</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeReport === 'schedule' && (
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 text-start">رقم الأصل</th>
                    <th className="py-2.5 px-3 text-start">اسم الأصل</th>
                    <th className="py-2.5 px-3 text-start">التكلفة التاريخية</th>
                    <th className="py-2.5 px-3 text-start">طريقة الإهلاك</th>
                    <th className="py-2.5 px-3 text-start">العمر الإنتاجي</th>
                    <th className="py-2.5 px-3 text-start">قيمة الخردة</th>
                    <th className="py-2.5 px-3 text-start">الإهلاك الشهري المقدر</th>
                    <th className="py-2.5 px-3 text-start">مجمع الإهلاك</th>
                    <th className="py-2.5 px-3 text-start">صافي الدفترية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assets.map((a) => {
                    const monthlyDep = Math.round((a.acquisitionCost - a.salvageValue) / Math.max(1, a.usefulLifeMonths));
                    return (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{a.assetNumber}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{a.name}</td>
                        <td className="py-2.5 px-3 font-mono">{a.acquisitionCost.toLocaleString('en-US')} SAR</td>
                        <td className="py-2.5 px-3">{a.depreciationMethod === 'StraightLine' ? 'قسط ثابت' : 'قسط متناقص'}</td>
                        <td className="py-2.5 px-3">{a.usefulLifeMonths} شهر</td>
                        <td className="py-2.5 px-3 font-mono">{a.salvageValue.toLocaleString('en-US')} SAR</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{monthlyDep.toLocaleString('en-US')} SAR</td>
                        <td className="py-2.5 px-3 font-mono text-rose-600">{a.accumulatedDepreciation.toLocaleString('en-US')} SAR</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-800">{a.netBookValue.toLocaleString('en-US')} SAR</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {activeReport === 'additions_disposals' && (
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 text-start">نوع الحركة</th>
                    <th className="py-2.5 px-3 text-start">رقم الأصل</th>
                    <th className="py-2.5 px-3 text-start">اسم الأصل</th>
                    <th className="py-2.5 px-3 text-start">التاريخ</th>
                    <th className="py-2.5 px-3 text-start">التكلفة التاريخية</th>
                    <th className="py-2.5 px-3 text-start">متحصلات البيع</th>
                    <th className="py-2.5 px-3 text-start">صافي الأرباح / الخسائر</th>
                    <th className="py-2.5 px-3 text-start">البيان / السبب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assets.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold">
                        {a.status === 'Disposed' ? (
                          <span className="text-rose-600">
                            {a.disposalType === 'Sale' ? 'استبعاد بالبيع' : 'استبعاد بالتخريد'}
                          </span>
                        ) : (
                          <span className="text-emerald-700">اقتناء ورأسمالية</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{a.assetNumber}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{a.name}</td>
                      <td className="py-2.5 px-3 font-mono">
                        {a.status === 'Disposed' ? a.disposalDate || '—' : a.acquisitionDate}
                      </td>
                      <td className="py-2.5 px-3 font-mono">{a.acquisitionCost.toLocaleString('en-US')} SAR</td>
                      <td className="py-2.5 px-3 font-mono">
                        {a.status === 'Disposed' ? `${(a.disposalProceeds || 0).toLocaleString('en-US')} SAR` : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold">
                        {a.status === 'Disposed' ? (
                          <span className={(a.disposalGainLoss ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                            {(a.disposalGainLoss ?? 0).toLocaleString('en-US')} SAR
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 max-w-[150px] truncate">
                        {a.status === 'Disposed' ? a.disposalReason || '—' : a.acquisitionSource || 'Manual'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
