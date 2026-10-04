import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../core/db';
import { StatCard } from '../../../components/ui/StatCard';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { useToast } from '../../../components/ui/Toast';
import { WarehouseIsometricView } from '../components/WarehouseIsometricView';
import { GoodsReceiptModal } from '../components/GoodsReceiptModal';
import { GoodsIssueModal } from '../components/GoodsIssueModal';
import { exportToCsv } from '../../../core/utils/importExport';
import {
  Boxes,
  Search,
  Filter,
  Download,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Layers,
  Warehouse,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { StockBalance, Material, StorageLocation, Plant } from '../../../types/models';

export const StockBalancePage: React.FC = () => {
  const { success, error } = useToast();

  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlant, setSelectedPlant] = useState('ALL');
  const [selectedSloc, setSelectedSloc] = useState('ALL');
  const [selectedAbc, setSelectedAbc] = useState('ALL');
  const [showIsometric, setShowIsometric] = useState(false);

  // Modal actions
  const [isGrOpen, setIsGrOpen] = useState(false);
  const [isGiOpen, setIsGiOpen] = useState(false);
  const [activeMaterialCode, setActiveMaterialCode] = useState<string>('');

  const loadBalances = async () => {
    setIsLoading(true);
    try {
      const [bals, mats, slocs, pls] = await Promise.all([
        db.stockBalances.toArray(),
        db.materials.toArray(),
        db.storageLocations.toArray(),
        db.plants.toArray(),
      ]);

      setBalances(bals);
      setMaterials(mats);
      setStorageLocations(slocs);
      setPlants(pls);
    } catch (err) {
      console.error(err);
      error('خطأ', 'تعذر تحميل أرصدة المخزون');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBalances();
  }, []);

  // Material dictionary for fast lookup
  const matMap = useMemo(() => {
    const map = new Map<string, Material>();
    materials.forEach((m) => map.set(m.materialCode, m));
    return map;
  }, [materials]);

  // Filtered list
  const filteredBalances = useMemo(() => {
    return balances.filter((b) => {
      const mat = matMap.get(b.materialCode);
      if (selectedPlant !== 'ALL' && b.plantCode !== selectedPlant) return false;
      if (selectedSloc !== 'ALL' && b.storageLocation !== selectedSloc) return false;
      if (selectedAbc !== 'ALL' && mat?.abcClass !== selectedAbc) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const codeMatch = b.materialCode.toLowerCase().includes(query);
        const nameMatch = mat?.name?.toLowerCase().includes(query) || false;
        const slocMatch = b.storageLocation.toLowerCase().includes(query);
        if (!codeMatch && !nameMatch && !slocMatch) return false;
      }
      return true;
    });
  }, [balances, matMap, selectedPlant, selectedSloc, selectedAbc, searchQuery]);

  // Metrics
  const totalValuation = useMemo(() => {
    return filteredBalances.reduce((acc, b) => acc + (b.totalValuation || 0), 0);
  }, [filteredBalances]);

  const totalQuantity = useMemo(() => {
    return filteredBalances.reduce((acc, b) => acc + (b.unrestrictedQty || 0), 0);
  }, [filteredBalances]);

  const handleExportCsv = () => {
    const dataToExport = filteredBalances.map((b) => {
      const mat = matMap.get(b.materialCode);
      return {
        'رمز الصنف': b.materialCode,
        'اسم الصنف': mat?.name || '',
        'المحطة': b.plantCode,
        'المستودع': b.storageLocation,
        'الرصيد المتاح': b.unrestrictedQty,
        'تحت الفحص QI': b.qualityInspectionQty,
        'الوحدة': b.unit,
        'سعر التكلفة (MAP)': b.movingAveragePrice || mat?.standardPrice || 0,
        'إجمالي التقييم (SAR)': b.totalValuation,
        'فئة ABC': mat?.abcClass || 'C',
        'آخر حركة': b.lastMovementDate,
      };
    });

    exportToCsv(dataToExport, `Gulf_Energy_Stock_Balance_${new Date().toISOString().split('T')[0]}`);
    success('تم التصدير بنجاح', 'تم تنزيل ملف CSV لأرصدة المخزون.');
  };

  return (
    <div className="space-y-6 text-start p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#E5EAF2]">
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <Boxes className="w-6 h-6 text-[#0FA37F]" />
            أرصدة المخزون وتقييم المواد (Stock Balance & Valuation - MMBE)
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            سجل كميات المواد المتاحة، المحجوزة، وقيد الفحص، مع التقييم المالي وفق متوسط التكلفة المرجح (MAP)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            icon={<Layers className="w-4 h-4" />}
            onClick={() => setShowIsometric(!showIsometric)}
          >
            {showIsometric ? 'إخفاء المخطط 3D' : 'عرض مخطط المستودع 3D'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={handleExportCsv}
          >
            تصدير CSV
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<ArrowDownLeft className="w-4 h-4" />}
            onClick={() => setIsGrOpen(true)}
          >
            استلام بضائع (101)
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="إجمالي الأصناف المعروضة"
          value={filteredBalances.length}
          subtitle="رصيد موقع / صنف مسجل"
          icon={<Boxes className="w-5 h-5 text-[#2563EB]" />}
        />

        <StatCard
          label="إجمالي الكميات المتاحة (Units)"
          value={new Intl.NumberFormat('en-US').format(totalQuantity)}
          subtitle="في كافة المستودعات المحددة"
          icon={<Warehouse className="w-5 h-5 text-[#0FA37F]" />}
        />

        <StatCard
          label="إجمالي القيمة التقديرية (SAR)"
          value={`${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
            totalValuation
          )} ر.س`}
          subtitle="وفق المتوسط المرجح المتحرك"
          icon={<CheckCircle2 className="w-5 h-5 text-[#0FA37F]" />}
        />
      </div>

      {/* Optional Isometric Warehouse Section */}
      {showIsometric && (
        <WarehouseIsometricView
          storageLocations={storageLocations}
          balances={balances}
          selectedLocation={selectedSloc !== 'ALL' ? selectedSloc : undefined}
          onSelectLocation={(locCode) => setSelectedSloc(locCode)}
        />
      )}

      {/* Filter Bar */}
      <div className="p-4 bg-white rounded-2xl border border-[#E5EAF2] shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input
            placeholder="بحث بالرمز أو اسم الصنف أو المستودع..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            startIcon={<Search className="w-4 h-4 text-[#64748B]" />}
          />

          <Select
            label="المحطة:"
            value={selectedPlant}
            onChange={(e) => setSelectedPlant(e.target.value)}
            options={[
              { label: 'كافة المحطات (الكل)', value: 'ALL' },
              ...plants.map((p) => ({ label: `${p.code} - ${p.name.slice(0, 20)}`, value: p.code })),
            ]}
          />

          <Select
            label="المستودع:"
            value={selectedSloc}
            onChange={(e) => setSelectedSloc(e.target.value)}
            options={[
              { label: 'كافة المستودعات (الكل)', value: 'ALL' },
              ...storageLocations.map((s) => ({ label: `${s.code} - ${s.name}`, value: s.code })),
            ]}
          />

          <Select
            label="تصنيف ABC:"
            value={selectedAbc}
            onChange={(e) => setSelectedAbc(e.target.value)}
            options={[
              { label: 'كافة التصنيفات', value: 'ALL' },
              { label: 'فئة A (عالية القيمة)', value: 'A' },
              { label: 'فئة B (متوسطة القيمة)', value: 'B' },
              { label: 'فئة C (منخفضة القيمة)', value: 'C' },
            ]}
          />
        </div>
      </div>

      {/* Stock Balances Data Table */}
      <div className="bg-white rounded-2xl border border-[#E5EAF2] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E5EAF2]">
              <tr>
                <th className="p-3 text-start">رمز الصنف</th>
                <th className="p-3 text-start">اسم الصنف والمجموعة</th>
                <th className="p-3 text-start">المحطة والمستودع</th>
                <th className="p-3 text-center">الرصيد المتاح</th>
                <th className="p-3 text-center">فحص الجودة (QI)</th>
                <th className="p-3 text-end">سعر التكلفة (MAP)</th>
                <th className="p-3 text-end">إجمالي القيمة</th>
                <th className="p-3 text-center">فئة ABC</th>
                <th className="p-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF2]">
              {filteredBalances.length > 0 ? (
                filteredBalances.map((b) => {
                  const mat = matMap.get(b.materialCode);
                  const mapPrice = b.movingAveragePrice || mat?.standardPrice || 0;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono font-bold text-[#0F172A]">{b.materialCode}</td>
                      <td className="p-3">
                        <div className="font-bold text-[#0F172A]">{mat?.name || b.materialCode}</div>
                        <div className="text-[10px] text-[#64748B]">{mat?.groupCode}</div>
                      </td>
                      <td className="p-3">
                        <span className="font-mono font-semibold text-[#0F172A]">{b.storageLocation}</span>
                        <span className="text-[10px] text-[#64748B] block">فرع {b.plantCode}</span>
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-[#0FA37F]">
                        {new Intl.NumberFormat('en-US').format(b.unrestrictedQty)} {b.unit}
                      </td>
                      <td className="p-3 text-center font-mono text-[#64748B]">
                        {b.qualityInspectionQty > 0 ? (
                          <Badge variant="in_review">
                            {b.qualityInspectionQty} {b.unit}
                          </Badge>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td className="p-3 text-end font-mono text-[#0F172A]">
                        {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(mapPrice)} ر.س
                      </td>
                      <td className="p-3 text-end font-mono font-bold text-[#0B2545]">
                        {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(
                          b.totalValuation
                        )}{' '}
                        ر.س
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          variant={
                            mat?.abcClass === 'A'
                              ? 'critical'
                              : mat?.abcClass === 'B'
                              ? 'in_review'
                              : 'neutral'
                          }
                        >
                          فئة {mat?.abcClass || 'C'}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={<ArrowUpRight className="w-3 h-3 text-[#2563EB]" />}
                            onClick={() => {
                              setActiveMaterialCode(b.materialCode);
                              setIsGiOpen(true);
                            }}
                          >
                            صرف
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            icon={<ArrowDownLeft className="w-3 h-3" />}
                            onClick={() => {
                              setActiveMaterialCode(b.materialCode);
                              setIsGrOpen(true);
                            }}
                          >
                            استلام
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[#64748B]">
                    لا توجد أرصدة تطابق شروط التصفية الحالية.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <GoodsReceiptModal
        isOpen={isGrOpen}
        onClose={() => setIsGrOpen(false)}
        onSuccess={() => loadBalances()}
      />

      <GoodsIssueModal
        isOpen={isGiOpen}
        onClose={() => setIsGiOpen(false)}
        onSuccess={() => loadBalances()}
        initialMaterialCode={activeMaterialCode}
      />
    </div>
  );
};
