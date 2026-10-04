import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../core/db';
import { InventoryService, type AbcXyzItem } from '../services/InventoryService';
import { StatCard } from '../../../components/ui/StatCard';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { useToast } from '../../../components/ui/Toast';
import { useAuthStore } from '../../../core/auth/useAuthStore';
import { GoodsIssueModal } from '../components/GoodsIssueModal';
import {
  RefreshCw,
  AlertTriangle,
  ShoppingCart,
  TrendingDown,
  Gavel,
  Trash2,
  ArrowRightLeft,
  CheckCircle2,
  Sparkles,
  BarChart3,
  Calendar,
  Layers,
  Clock,
} from 'lucide-react';
import type { InventoryAlert, AuctionRecord } from '../../../types/models';

export const ReorderManagementPage: React.FC = () => {
  const { user } = useAuthStore();
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'alerts' | 'abcxyz' | 'slow_moving' | 'auctions'>('alerts');
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [abcXyzItems, setAbcXyzItems] = useState<AbcXyzItem[]>([]);
  const [auctions, setAuctions] = useState<AuctionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Slow-moving threshold
  const [slowMovingDays, setSlowMovingDays] = useState<number>(60);

  // Auction modal
  const [isAuctionModalOpen, setIsAuctionModalOpen] = useState(false);
  const [selectedAuctionItem, setSelectedAuctionItem] = useState<AbcXyzItem | null>(null);
  const [auctionStartingPrice, setAuctionStartingPrice] = useState<number>(1000);
  const [auctionReservePrice, setAuctionReservePrice] = useState<number>(2000);
  const [auctionCondition, setAuctionCondition] = useState<'Fair' | 'Scrap' | 'UsedGood' | 'Obsolete'>('Fair');

  // Goods Issue / Transfer Modal
  const [isGiModalOpen, setIsGiModalOpen] = useState(false);
  const [giModalMode, setGiModalMode] = useState<'scrap' | 'transfer'>('scrap');
  const [giTargetMaterial, setGiTargetMaterial] = useState<string>('');

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      await InventoryService.evaluateReorderEngine();
      const [alts, analysis, aucs] = await Promise.all([
        db.inventoryAlerts.where('isDeleted').equals(0 as unknown as string).reverse().toArray(),
        InventoryService.calculateAbcXyzAnalysis(slowMovingDays),
        db.auctionRecords.where('isDeleted').equals(0 as unknown as string).reverse().toArray(),
      ]);

      setAlerts(alts);
      setAbcXyzItems(analysis);
      setAuctions(aucs);
    } catch (err) {
      console.error(err);
      error('خطأ', 'تعذر تحميل بيانات إعادة الطلب والتحليل');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [slowMovingDays]);

  // One-click convert alert to PR
  const handleConvertAlert = async (alertId: string) => {
    try {
      const pr = await InventoryService.convertAlertToPurchaseRequisition(
        alertId,
        user?.id || 'u-wh-clerk',
        user?.fullName || 'أمين المستودع'
      );
      success(
        'تم إنشاء طلب الشراء بنجاح (PR Created)',
        `رقم مستند طلب الشراء: ${pr.docNumber} بمبلغ تقديري ${pr.totalEstimatedAmount.toLocaleString()} ر.س`
      );
      loadAllData();
    } catch (err) {
      error('خطأ', err instanceof Error ? err.message : 'فشل تحويل التنبيه لطلب شراء');
    }
  };

  // Open Auction modal
  const handleOpenAuctionModal = (item: AbcXyzItem) => {
    setSelectedAuctionItem(item);
    setAuctionStartingPrice(Math.round(item.unitPrice * 0.4));
    setAuctionReservePrice(Math.round(item.unitPrice * 0.7));
    setIsAuctionModalOpen(true);
  };

  // Submit Auction record
  const handleCreateAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAuctionItem) return;

    try {
      const auc = await InventoryService.createAuctionRecord({
        materialCode: selectedAuctionItem.materialCode,
        plantCode: '1100',
        storageLocation: 'SL01',
        quantity: selectedAuctionItem.currentStock,
        startingPrice: auctionStartingPrice,
        reservePrice: auctionReservePrice,
        condition: auctionCondition,
        userId: user?.id || 'u-wh-clerk',
      });

      success('تم طرح الصنف في المزاد بنجاح', `رقم المرجع: ${auc.auctionReference}`);
      setIsAuctionModalOpen(false);
      loadAllData();
    } catch (err) {
      error('خطأ', err instanceof Error ? err.message : 'فشل إنشاء سجل المزاد');
    }
  };

  const slowMovingItems = useMemo(() => {
    return abcXyzItems.filter((i) => i.isSlowMoving);
  }, [abcXyzItems]);

  const totalCapitalTiedUp = useMemo(() => {
    return slowMovingItems.reduce((acc, i) => acc + i.totalValuation, 0);
  }, [slowMovingItems]);

  return (
    <div className="space-y-6 text-start p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#E5EAF2]">
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-[#0FA37F]" />
            محرك إعادة الطلب وتحليل المخزون (Reorder Engine & ABC/XYZ Analysis)
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            التقييم الآلي لنقاط إعادة الطلب، تحويل التنبيهات لطلبات شراء بنقرة واحدة، ومعالجة الرواكد بالمزاد أو التخريد
          </p>
        </div>

        <Button variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={loadAllData}>
          إعادة تقييم المحرك الآن
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="تنبيهات إعادة التموين النشطة"
          value={alerts.filter((a) => a.status === 'active').length}
          subtitle="تتطلب إصدار طلب شراء فوري"
          icon={<AlertTriangle className="w-5 h-5 text-[#EF4444]" />}
        />

        <StatCard
          label="أصناف راكدة / بطيئة الحركة"
          value={slowMovingItems.length}
          subtitle={`بدون حركة منذ ${slowMovingDays} يوماً`}
          icon={<Clock className="w-5 h-5 text-[#F59E0B]" />}
        />

        <StatCard
          label="رأس المال المجمد في الرواكد (SAR)"
          value={`${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
            totalCapitalTiedUp
          )} ر.س`}
          subtitle="قابل للتحصيل عبر المزاد أو التخريد"
          icon={<Gavel className="w-5 h-5 text-[#2563EB]" />}
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E5EAF2]">
        <button
          type="button"
          onClick={() => setActiveTab('alerts')}
          className={`px-5 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'alerts'
              ? 'border-[#0FA37F] text-[#0FA37F]'
              : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          تنبيهات إعادة الطلب واقتراحات الشراء ({alerts.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('abcxyz')}
          className={`px-5 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'abcxyz'
              ? 'border-[#2563EB] text-[#2563EB]'
              : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          مصفوفة تحليل ABC / XYZ (120 صنف)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('slow_moving')}
          className={`px-5 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'slow_moving'
              ? 'border-[#F59E0B] text-[#F59E0B]'
              : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <Clock className="w-4 h-4" />
          المخزون الراكد والبطيء ({slowMovingItems.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('auctions')}
          className={`px-5 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'auctions'
              ? 'border-[#8B5CF6] text-[#8B5CF6]'
              : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <Gavel className="w-4 h-4" />
          مزادات بيع الرواكد المنشورة ({auctions.length})
        </button>
      </div>

      {/* TAB 1: REORDER ALERTS */}
      {activeTab === 'alerts' && (
        <div className="bg-white rounded-2xl border border-[#E5EAF2] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E5EAF2]">
                <tr>
                  <th className="p-3 text-start">رمز الصنف واسمه</th>
                  <th className="p-3 text-center">نوع التنبيه</th>
                  <th className="p-3 text-center">الرصيد المتاح الحالي</th>
                  <th className="p-3 text-center">نقطة الأمان / الحد الأدنى</th>
                  <th className="p-3 text-center font-bold text-[#0FA37F]">الكمية المقترحة للطلب</th>
                  <th className="p-3 text-start">تاريخ رصد التنبيه</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3 text-center">الإجراء المباشر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF2]">
                {alerts.length > 0 ? (
                  alerts.map((alt) => (
                    <tr key={alt.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-[#0F172A]">{alt.materialName}</div>
                        <div className="font-mono text-[10px] text-[#64748B]">{alt.materialCode}</div>
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          variant={alt.alertType === 'critical' ? 'critical' : 'in_review'}
                        >
                          {alt.alertType === 'critical' ? 'مخزون حرج (دون الأمان)' : 'تحت نقطة الطلب'}
                        </Badge>
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-[#EF4444]">
                        {alt.currentStock} {alt.unit}
                      </td>
                      <td className="p-3 text-center font-mono text-[#64748B]">
                        {alt.thresholdQty} {alt.unit}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-[#0FA37F] text-sm">
                        {alt.suggestedReorderQty} {alt.unit}
                      </td>
                      <td className="p-3 text-[11px] text-[#64748B]">
                        {new Date(alt.createdAt).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn')}
                      </td>
                      <td className="p-3 text-center">
                        {alt.status === 'converted_to_pr' ? (
                          <Badge variant="completed">
                            تم تحويله لطلب شراء
                          </Badge>
                        ) : (
                          <Badge variant="in_progress">
                            نشط بانتظار الاعتماد
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {alt.status === 'converted_to_pr' ? (
                          <span className="font-mono font-bold text-xs text-[#0FA37F]">
                            {alt.convertedPrDocNumber}
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="primary"
                            icon={<Sparkles className="w-3.5 h-3.5" />}
                            onClick={() => handleConvertAlert(alt.id)}
                          >
                            اقتراح طلب شراء (تحويل بنقرة واحدة)
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-[#64748B]">
                      مستويات المخزون مستقرة حالياً، لا توجد تنبيهات عجز أو إعادة تموين.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ABC/XYZ MATRIX */}
      {activeTab === 'abcxyz' && (
        <div className="bg-white rounded-2xl border border-[#E5EAF2] shadow-sm overflow-hidden space-y-4 p-4">
          <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E5EAF2] text-xs space-y-1">
            <span className="font-bold text-[#0F172A]">معايير التصنيف:</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-[#64748B]">
              <div>
                <strong>تحليل ABC (القيمة الرأسمالية):</strong> فئة A (أعلى 80% من القيمة)، فئة B (15%)، فئة C (5%).
              </div>
              <div>
                <strong>تحليل XYZ (تواتر وسكون الحركة):</strong> فئة X (حركة دائمة ومستقرة)، فئة Y (موسمية متذبذبة)، فئة Z (حركة نادرة أو مفاجئة).
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E5EAF2]">
                <tr>
                  <th className="p-2.5 text-start">رمز واسم الصنف</th>
                  <th className="p-2.5 text-center">الرصيد المتاح</th>
                  <th className="p-2.5 text-end">سعر التكلفة (MAP)</th>
                  <th className="p-2.5 text-end">إجمالي التقييم (SAR)</th>
                  <th className="p-2.5 text-center">النسبة التراكمية</th>
                  <th className="p-2.5 text-center">فئة ABC</th>
                  <th className="p-2.5 text-center">فئة XYZ</th>
                  <th className="p-2.5 text-center">عدد الحركات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF2]">
                {abcXyzItems.slice(0, 30).map((item) => (
                  <tr key={item.materialCode} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5">
                      <div className="font-bold text-[#0F172A]">{item.materialName}</div>
                      <div className="font-mono text-[10px] text-[#64748B]">{item.materialCode}</div>
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-[#0F172A]">
                      {new Intl.NumberFormat('en-US').format(item.currentStock)}
                    </td>
                    <td className="p-2.5 text-end font-mono text-[#64748B]">
                      {new Intl.NumberFormat('en-US').format(item.unitPrice)} ر.س
                    </td>
                    <td className="p-2.5 text-end font-mono font-bold text-[#0B2545]">
                      {new Intl.NumberFormat('en-US').format(item.totalValuation)} ر.س
                    </td>
                    <td className="p-2.5 text-center font-mono text-[#64748B]">{item.cumulativeValuePercent}%</td>
                    <td className="p-2.5 text-center">
                      <Badge
                        variant={item.abcClass === 'A' ? 'critical' : item.abcClass === 'B' ? 'in_review' : 'neutral'}
                      >
                        فئة {item.abcClass}
                      </Badge>
                    </td>
                    <td className="p-2.5 text-center">
                      <Badge variant={item.xyzClass === 'X' ? 'approved' : 'in_progress'}>
                        فئة {item.xyzClass}
                      </Badge>
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-[#0FA37F]">
                      {item.movementCount} حركة
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SLOW-MOVING & OBSOLETE STOCK */}
      {activeTab === 'slow_moving' && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-2xl border border-[#E5EAF2] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-bold text-[#0F172A]">حد سكون المخزون (Threshold):</span>
              <div className="flex gap-1.5">
                {[30, 60, 90, 180].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setSlowMovingDays(days)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
                      slowMovingDays === days
                        ? 'bg-[#0FA37F] text-white border-[#0FA37F]'
                        : 'bg-white text-[#64748B] border-[#E5EAF2] hover:bg-slate-50'
                    }`}
                  >
                    {days} يوماً
                  </button>
                ))}
              </div>
            </div>

            <span className="text-[11px] text-[#64748B]">
              الأصناف التي لم تسجل أي حركة صرف أو توريد خلال الفترة المحددة
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5EAF2] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E5EAF2]">
                  <tr>
                    <th className="p-3 text-start">رمز الصنف واسمه</th>
                    <th className="p-3 text-center">الرصيد الراكد</th>
                    <th className="p-3 text-center">أيام السكون</th>
                    <th className="p-3 text-start">تاريخ آخر حركة</th>
                    <th className="p-3 text-end">القيمة المالية المجمدة</th>
                    <th className="p-3 text-center">الإجراءات العلاجية الموصى بها</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5EAF2]">
                  {slowMovingItems.length > 0 ? (
                    slowMovingItems.map((item) => (
                      <tr key={item.materialCode} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-[#0F172A]">{item.materialName}</div>
                          <div className="font-mono text-[10px] text-[#64748B]">{item.materialCode}</div>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-[#F59E0B]">
                          {item.currentStock}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-[#EF4444]">
                          {item.idleDays} يوماً
                        </td>
                        <td className="p-3 font-mono text-[#64748B]">{item.lastMovementDate}</td>
                        <td className="p-3 text-end font-mono font-bold text-[#0B2545]">
                          {new Intl.NumberFormat('en-US').format(item.totalValuation)} ر.س
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={<Gavel className="w-3.5 h-3.5 text-[#2563EB]" />}
                              onClick={() => handleOpenAuctionModal(item)}
                            >
                              طرح بالمزاد
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              icon={<Trash2 className="w-3.5 h-3.5" />}
                              onClick={() => {
                                setGiTargetMaterial(item.materialCode);
                                setGiModalMode('scrap');
                                setIsGiModalOpen(true);
                              }}
                            >
                              تخريد (551)
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={<ArrowRightLeft className="w-3.5 h-3.5" />}
                              onClick={() => {
                                setGiTargetMaterial(item.materialCode);
                                setGiModalMode('transfer');
                                setIsGiModalOpen(true);
                              }}
                            >
                              تحويل (311)
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-[#64748B]">
                        لا توجد أصناف راكدة تتجاوز {slowMovingDays} يوماً بدون حركة.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PUBLISHED AUCTIONS */}
      {activeTab === 'auctions' && (
        <div className="bg-white rounded-2xl border border-[#E5EAF2] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E5EAF2]">
                <tr>
                  <th className="p-3 text-start">رقم مرجع المزاد</th>
                  <th className="p-3 text-start">الصنف</th>
                  <th className="p-3 text-center">الكمية المطروحة</th>
                  <th className="p-3 text-end">سعر الافتتاح (Starting)</th>
                  <th className="p-3 text-end">السعر المستهدف (Reserve)</th>
                  <th className="p-3 text-center">الحالة الفنية</th>
                  <th className="p-3 text-center">حالة المزاد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF2]">
                {auctions.length > 0 ? (
                  auctions.map((auc) => (
                    <tr key={auc.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono font-bold text-[#0F172A]">{auc.auctionReference}</td>
                      <td className="p-3">
                        <div className="font-bold text-[#0F172A]">{auc.materialName}</div>
                        <div className="font-mono text-[10px] text-[#64748B]">{auc.materialCode}</div>
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-[#0F172A]">
                        {auc.quantity} {auc.unit}
                      </td>
                      <td className="p-3 text-end font-mono text-[#0FA37F] font-bold">
                        {new Intl.NumberFormat('en-US').format(auc.startingPrice)} ر.س
                      </td>
                      <td className="p-3 text-end font-mono text-[#2563EB] font-bold">
                        {new Intl.NumberFormat('en-US').format(auc.reservePrice)} ر.س
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="neutral">
                          {auc.condition}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="approved">
                          منشور وجاهز للمزايدة
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#64748B]">
                      لا توجد مزادات نشطة حالياً. يمكنك طرح الأصناف الراكدة من تبويب "المخزون الراكد".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sell by Auction Modal */}
      <Modal
        isOpen={isAuctionModalOpen}
        onClose={() => setIsAuctionModalOpen(false)}
        title="طرح مخزون راكد في مزاد علني (Create Auction Record)"
        size="md"
      >
        {selectedAuctionItem && (
          <form onSubmit={handleCreateAuction} className="space-y-4 text-start text-xs" dir="rtl">
            <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E5EAF2] space-y-1">
              <span className="font-bold text-[#0F172A] text-sm">{selectedAuctionItem.materialName}</span>
              <div className="flex justify-between text-[#64748B]">
                <span>الكمية المعروضة: {selectedAuctionItem.currentStock} وحدة</span>
                <span>تكلفة الدفتر: {selectedAuctionItem.unitPrice} ر.س / وحدة</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="سعر الافتتاح (Starting Bid SAR):"
                type="number"
                min="1"
                value={auctionStartingPrice}
                onChange={(e) => setAuctionStartingPrice(parseFloat(e.target.value) || 0)}
                required
              />

              <Input
                label="السعر المستهدف / الحد الأدنى (Reserve Price):"
                type="number"
                min="1"
                value={auctionReservePrice}
                onChange={(e) => setAuctionReservePrice(parseFloat(e.target.value) || 0)}
                required
              />
            </div>

            <Select
              label="الحالة الفنية للمواد:"
              value={auctionCondition}
              onChange={(e) => setAuctionCondition(e.target.value as any)}
              options={[
                { label: 'مقبول / بحالة جيدة (Fair)', value: 'Fair' },
                { label: 'سائل / معدن قابل للتكرير والتخريد (Scrap)', value: 'Scrap' },
                { label: 'مستعمل بحالة ممتازة (Used Good)', value: 'UsedGood' },
                { label: 'طراز قديم غير مستخدم (Obsolete)', value: 'Obsolete' },
              ]}
            />

            <div className="flex justify-end gap-3 pt-3 border-t border-[#E5EAF2]">
              <Button type="button" variant="secondary" onClick={() => setIsAuctionModalOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" icon={<Gavel className="w-4 h-4" />}>
                نشر سجل المزاد (Publish Auction)
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Goods Issue / Scrap / Transfer Modal */}
      <GoodsIssueModal
        isOpen={isGiModalOpen}
        onClose={() => setIsGiModalOpen(false)}
        onSuccess={() => loadAllData()}
        initialMode={giModalMode}
        initialMaterialCode={giTargetMaterial}
      />
    </div>
  );
};
