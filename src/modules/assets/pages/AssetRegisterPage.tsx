import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { AssetService } from '../services/AssetService';
import { AssetBarcodeModal } from '../components/AssetBarcodeModal';
import { AssetScanDrawer } from '../components/AssetScanDrawer';
import { AssetAcquisitionModal } from '../components/AssetAcquisitionModal';
import { AssetTransferModal } from '../components/AssetTransferModal';
import { AssetDisposalModal } from '../components/AssetDisposalModal';
import { exportToCsv } from '../../../core/utils/importExport';
import type { Asset, AssetClass, AssetStatus } from '../../../types/models';
import {
  Building2,
  Search,
  Filter,
  Download,
  PlusCircle,
  ScanBarcode,
  Printer,
  ArrowRightLeft,
  Trash2,
  Eye,
  CheckCircle,
  Wrench,
} from 'lucide-react';
import { t } from '../../../i18n/ar';

export const AssetRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedPlant, setSelectedPlant] = useState<string>('');

  // Modals state
  const [barcodeAsset, setBarcodeAsset] = useState<Asset | null>(null);
  const [transferAsset, setTransferAsset] = useState<Asset | null>(null);
  const [disposalAsset, setDisposalAsset] = useState<Asset | null>(null);
  const [isScanDrawerOpen, setIsScanDrawerOpen] = useState(false);
  const [isAcquisitionModalOpen, setIsAcquisitionModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await AssetService.getAssets({
        category: selectedCategory || undefined,
        status: selectedStatus || undefined,
        plantCode: selectedPlant || undefined,
        search: search || undefined,
      });
      setAssets(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategory, selectedStatus, selectedPlant, search]);

  const handleExportCsv = () => {
    const dataToExport = assets.map((a) => ({
      'رقم الأصل': a.assetNumber,
      'الباركود': a.barcode,
      'اسم الأصل': a.name,
      'الفئة': a.category,
      'الرقم التسلسلي': a.serialNumber || '',
      'المحطة': a.plantCode,
      'الموقع': a.location || '',
      'مركز التكلفة': a.costCenter,
      'أمين العهدة': a.custodian,
      'تاريخ الاقتناء': a.acquisitionDate,
      'التكلفة التاريخية': a.acquisitionCost,
      'العمر الإنتاجي (أشهر)': a.usefulLifeMonths,
      'طريقة الإهلاك': a.depreciationMethod,
      'قيمة الخردة': a.salvageValue,
      'مجمع الإهلاك': a.accumulatedDepreciation,
      'صافي القيمة الدفترية': a.netBookValue,
      'الحالة': a.status,
    }));
    exportToCsv(dataToExport, `سجل_الأصول_الرأسمالية_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-[#0FA37F]/10 text-emerald-800 border border-emerald-300">
              SAP AS01 / AS02 / AS03
            </span>
            <span className="text-xs text-slate-500 font-mono">Asset Master Register</span>
          </div>
          <h1 className="text-2xl font-black text-[#0B2545] tracking-tight mt-1">
            سجل الأصول والمعدات الرأسمالية (Asset Register)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            فهرس الأصول الرأسمالية والمعدات، تتبع الباركود، العمر الإنتاجي، ومراكز التكلفة
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => setIsScanDrawerOpen(true)}
            className="border-slate-300 hover:bg-slate-100 gap-2 font-bold"
          >
            <ScanBarcode className="w-4 h-4 text-emerald-600" />
            <span>مسح باركود (Scan-to-Open)</span>
          </Button>

          <Button
            variant="secondary"
            onClick={handleExportCsv}
            disabled={assets.length === 0}
            className="border-slate-300 hover:bg-slate-100 gap-2 font-bold"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>تصدير CSV</span>
          </Button>

          <Button
            onClick={() => setIsAcquisitionModalOpen(true)}
            className="bg-[#0FA37F] hover:bg-[#0c8a6c] gap-2 font-bold shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>إضافة أصل جديد (AS01)</span>
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-4 shadow-sm border border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute top-3 end-3" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم الأصل، الاسم، الباركود، أمين العهدة..."
              className="pe-9 text-xs"
            />
          </div>

          <div>
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              options={[
                { value: '', label: 'كافة فئات الأصول' },
                { value: 'Machinery', label: 'المضخات والآلات (Machinery)' },
                { value: 'StorageTanks', label: 'خزانات الوقود (Storage Tanks)' },
                { value: 'Vehicles', label: 'الشاحنات والصهاريج (Vehicles)' },
                { value: 'Buildings', label: 'المباني والمنشآت (Buildings)' },
                { value: 'Pipelines', label: 'خطوط الأنابيب (Pipelines)' },
                { value: 'IT', label: 'تقنية المعلومات (IT)' },
                { value: 'AuC', label: 'مشروعات قيد التنفيذ (AuC)' },
              ]}
            />
          </div>

          <div>
            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              options={[
                { value: '', label: 'كافة الحالات التشغيلية' },
                { value: 'Active', label: 'نشط قيد الاستخدام' },
                { value: 'InDepreciation', label: 'قيد الإهلاك الدوري' },
                { value: 'InTransfer', label: 'قيد النقل والتسليم' },
                { value: 'UnderConstruction', label: 'قيد الإنشاء (AuC)' },
                { value: 'Disposed', label: 'مُكهَّن / مستبعد' },
              ]}
            />
          </div>

          <div>
            <Select
              value={selectedPlant}
              onChange={(e) => setSelectedPlant(e.target.value)}
              options={[
                { value: '', label: 'كافة المحطات والمستودعات' },
                { value: '1100', label: '1100 - محطة الرياض المركزية' },
                { value: '1200', label: '1200 - محطة ومستودعات جدة' },
                { value: '1300', label: '1300 - مستودع الدمام اللوجستي' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Asset Table */}
      <Card className="p-0 shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : assets.length === 0 ? (
          <div className="p-12">
            <EmptyState
              title="لم يتم العثور على أصول مطابقة"
              description="جرب تعديل خيارات البحث أو قم بإضافة أصل رأسمالي جديد في السجل."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-start">رقم الأصل (AA)</th>
                  <th className="py-3 px-3 text-start">رمز الباركود</th>
                  <th className="py-3 px-3 text-start">اسم الأصل وتوصيفه</th>
                  <th className="py-3 px-3 text-start">الفئة</th>
                  <th className="py-3 px-3 text-start">المحطة والموقع</th>
                  <th className="py-3 px-3 text-start">أمين العهدة</th>
                  <th className="py-3 px-3 text-start">التكلفة التاريخية</th>
                  <th className="py-3 px-3 text-start">صافي الدفترية (NBV)</th>
                  <th className="py-3 px-3 text-start">طريقة الإهلاك</th>
                  <th className="py-3 px-3 text-start">الحالة</th>
                  <th className="py-3 px-3 text-center">إجراءات سريعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets.map((asset) => (
                  <tr
                    key={asset.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/assets/register/${asset.id}`)}
                  >
                    <td className="py-3 px-3 font-mono font-bold text-blue-900">
                      {asset.assetNumber}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500">
                      {asset.barcode || '—'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                        {asset.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {asset.serialNumber ? `S/N: ${asset.serialNumber}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {asset.category}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      <div>{asset.plantCode}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                        {asset.location || 'المستودع الرئيسي'}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-700 font-medium">
                      {asset.custodian}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700">
                      {asset.acquisitionCost.toLocaleString('en-US')} SAR
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-800">
                      {asset.netBookValue.toLocaleString('en-US')} SAR
                    </td>
                    <td className="py-3 px-3 text-slate-600 text-[11px]">
                      {asset.depreciationMethod === 'StraightLine' ? 'قسط ثابت' : 'قسط متناقص'}
                    </td>
                    <td className="py-3 px-3">
                      <Badge
                        variant={
                          asset.status === 'Active'
                            ? 'completed'
                            : asset.status === 'InTransfer'
                            ? 'pending'
                            : asset.status === 'Disposed'
                            ? 'rejected'
                            : asset.status === 'UnderConstruction'
                            ? 'draft'
                            : 'in_progress'
                        }
                      >
                        {asset.status === 'Active'
                          ? 'نشط'
                          : asset.status === 'InTransfer'
                          ? 'قيد النقل'
                          : asset.status === 'InDepreciation'
                          ? 'قيد الإهلاك'
                          : asset.status === 'UnderConstruction'
                          ? 'قيد الإنشاء'
                          : 'مُكهَّن'}
                      </Badge>
                    </td>
                    <td
                      className="py-3 px-3 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        {/* View Card */}
                        <button
                          type="button"
                          onClick={() => navigate(`/assets/register/${asset.id}`)}
                          className="p-1 rounded-md text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                          title="عرض البطاقة والتسلسل الزمني"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Print Barcode */}
                        <button
                          type="button"
                          onClick={() => setBarcodeAsset(asset)}
                          className="p-1 rounded-md text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                          title="طباعة بطاقة الباركود"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {/* Transfer Custody */}
                        {asset.status !== 'Disposed' && (
                          <button
                            type="button"
                            onClick={() => setTransferAsset(asset)}
                            className="p-1 rounded-md text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                            title="نقل العهدة أو الموقع"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                          </button>
                        )}

                        {/* Dispose */}
                        {asset.status !== 'Disposed' && (
                          <button
                            type="button"
                            onClick={() => setDisposalAsset(asset)}
                            className="p-1 rounded-md text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                            title="تخريد أو بيع الأصل"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <span>إجمالي عدد السجلات المعروضة: <strong>{assets.length}</strong> أصل رأسمالي</span>
          <span>العملة الافتراضية: <strong>ريال سعودي (SAR)</strong></span>
        </div>
      </Card>

      {/* Modals & Drawers */}
      <AssetBarcodeModal
        isOpen={Boolean(barcodeAsset)}
        onClose={() => setBarcodeAsset(null)}
        asset={barcodeAsset}
      />

      <AssetScanDrawer
        isOpen={isScanDrawerOpen}
        onClose={() => setIsScanDrawerOpen(false)}
      />

      <AssetAcquisitionModal
        isOpen={isAcquisitionModalOpen}
        onClose={() => setIsAcquisitionModalOpen(false)}
        onSuccess={() => loadData()}
      />

      <AssetTransferModal
        isOpen={Boolean(transferAsset)}
        onClose={() => setTransferAsset(null)}
        asset={transferAsset}
        onSuccess={() => loadData()}
      />

      <AssetDisposalModal
        isOpen={Boolean(disposalAsset)}
        onClose={() => setDisposalAsset(null)}
        asset={disposalAsset}
        onSuccess={() => loadData()}
      />
    </div>
  );
};
