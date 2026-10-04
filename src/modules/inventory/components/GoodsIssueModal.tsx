import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { useToast } from '../../../components/ui/Toast';
import { db } from '../../../core/db';
import { InventoryService } from '../services/InventoryService';
import { useAuthStore } from '../../../core/auth/useAuthStore';
import {
  ArrowUpRight,
  ArrowRightLeft,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Boxes,
  Building2,
  Layers,
  Wrench,
} from 'lucide-react';
import type {
  Material,
  StorageLocation,
  CostCenter,
  Plant,
  MaintenanceOrder,
  StockBalance,
  MovementTypeCode,
} from '../../../types/models';

interface GoodsIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (docNumber: string) => void;
  initialMode?: 'issue' | 'transfer' | 'scrap';
  initialMaterialCode?: string;
  initialStorageLocation?: string;
}

export const GoodsIssueModal: React.FC<GoodsIssueModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'issue',
  initialMaterialCode,
  initialStorageLocation,
}) => {
  const { user } = useAuthStore();
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'issue' | 'transfer' | 'scrap'>(initialMode);
  const [issueSubtype, setIssueSubtype] = useState<'201' | '261'>('201');
  const [transferSubtype, setTransferSubtype] = useState<'311' | '301'>('311');

  // Master data
  const [materials, setMaterials] = useState<Material[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [maintenanceOrders, setMaintenanceOrders] = useState<MaintenanceOrder[]>([]);

  // Form values
  const [materialCode, setMaterialCode] = useState(initialMaterialCode || '');
  const [plantCode, setPlantCode] = useState('1100');
  const [storageLocation, setStorageLocation] = useState(initialStorageLocation || 'SL01');
  const [quantity, setQuantity] = useState<number>(10);
  const [costCenter, setCostCenter] = useState('CC-1007');
  const [orderNumber, setOrderNumber] = useState('');
  const [toPlantCode, setToPlantCode] = useState('1200');
  const [toStorageLocation, setToStorageLocation] = useState('SL03');
  const [scrapReason, setScrapReason] = useState('تالف بسبب سوء التخزين / انتهاء الصلاحية');
  const [headerText, setHeaderText] = useState('');

  // Live availability
  const [availableStock, setAvailableStock] = useState<number>(0);
  const [stockUnit, setStockUnit] = useState<string>('PCS');
  const [isLoadingStock, setIsLoadingStock] = useState<boolean>(false);
  const [allowNegativeStock, setAllowNegativeStock] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadMasterData = async () => {
      const [mats, pls, slocs, ccs, mos, negSetting] = await Promise.all([
        db.materials.toArray(),
        db.plants.toArray(),
        db.storageLocations.toArray(),
        db.costCenters.toArray(),
        db.maintenanceOrders.toArray(),
        InventoryService.isNegativeStockAllowed(),
      ]);

      setMaterials(mats);
      setPlants(pls);
      setStorageLocations(slocs);
      setCostCenters(ccs);
      setMaintenanceOrders(mos);
      setAllowNegativeStock(negSetting);

      if (initialMaterialCode) {
        setMaterialCode(initialMaterialCode);
      } else if (mats.length > 0 && !materialCode) {
        setMaterialCode(mats[0].materialCode);
      }
    };

    loadMasterData();
  }, [isOpen, initialMaterialCode]);

  // Update available stock whenever materialCode, plantCode, or storageLocation changes
  useEffect(() => {
    if (!materialCode || !plantCode || !storageLocation) return;

    setIsLoadingStock(true);
    InventoryService.getOrCreateBalance(materialCode, plantCode, storageLocation)
      .then((bal) => {
        setAvailableStock(bal.unrestrictedQty);
        setStockUnit(bal.unit);
      })
      .finally(() => setIsLoadingStock(false));
  }, [materialCode, plantCode, storageLocation]);

  const selectedMaterial = materials.find((m) => m.materialCode === materialCode);
  const isInsufficientStock = quantity > availableStock && !allowNegativeStock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!materialCode) {
      error('خطأ', 'يرجى اختيار الصنف المخزني');
      return;
    }

    if (quantity <= 0) {
      error('خطأ', 'الكمية يجب أن تكون أكبر من صفر');
      return;
    }

    if (isInsufficientStock) {
      error(
        'رصيد غير كافٍ',
        `الكمية المطلوبة (${quantity}) تتجاوز الرصيد المتاح (${availableStock} ${stockUnit}). الرصيد السالب غير مسموح به في الإعدادات.`
      );
      return;
    }

    let movementType: MovementTypeCode = '201';
    if (activeTab === 'issue') {
      movementType = issueSubtype;
    } else if (activeTab === 'transfer') {
      movementType = transferSubtype;
    } else if (activeTab === 'scrap') {
      movementType = '551';
    }

    setIsSubmitting(true);
    try {
      const matDoc = await InventoryService.postMaterialDocument({
        movementType,
        plantCode,
        storageLocation,
        headerText:
          headerText ||
          (activeTab === 'issue'
            ? `صرف مواد حركة ${movementType} لصالح ${issueSubtype === '201' ? costCenter : orderNumber}`
            : activeTab === 'transfer'
            ? `نقل مخزني حركة ${movementType} إلى ${toStorageLocation}`
            : `تخريد وإتلاف حركة 551`),
        items: [
          {
            materialCode,
            quantity,
            unit: stockUnit,
            storageLocation,
            toPlantCode: movementType === '301' ? toPlantCode : undefined,
            toStorageLocation: movementType === '311' || movementType === '301' ? toStorageLocation : undefined,
            costCenter: movementType === '201' || movementType === '551' ? costCenter : undefined,
            orderNumber: movementType === '261' ? orderNumber : undefined,
            scrapReason: movementType === '551' ? scrapReason : undefined,
          },
        ],
        userId: user?.id || 'u-wh-clerk',
        userName: user?.fullName || 'أمين المستودع',
      });

      success(
        'تم ترحيل الحركة المخزنية بنجاح',
        `رقم مستند المواد: ${matDoc.docNumber} | نوع الحركة: SAP ${movementType}`
      );

      onSuccess(matDoc.docNumber);
      onClose();
    } catch (err) {
      error('فشل الترحيل', err instanceof Error ? err.message : 'حدث خطأ أثناء ترحيل الحركة');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="حركات الصرف والنقل والتخريد (Goods Issue, Transfer, Scrapping)"
      size="lg"
    >
      <div className="space-y-6 text-start" dir="rtl">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[#E5EAF2]">
          <button
            type="button"
            onClick={() => setActiveTab('issue')}
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'issue'
                ? 'border-[#0FA37F] text-[#0FA37F]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            صرف مخزني (GI 201 / 261)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transfer')}
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'transfer'
                ? 'border-[#2563EB] text-[#2563EB]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            نقل مخزني (Transfer 311 / 301)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('scrap')}
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'scrap'
                ? 'border-[#EF4444] text-[#EF4444]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            تخريد وإتلاف (Scrapping 551)
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Subtype selectors */}
          {activeTab === 'issue' && (
            <div className="flex gap-4 p-3 bg-[#F8FAFC] rounded-xl border border-[#E5EAF2] text-xs">
              <label className="flex items-center gap-2 font-bold cursor-pointer">
                <input
                  type="radio"
                  name="issueType"
                  checked={issueSubtype === '201'}
                  onChange={() => setIssueSubtype('201')}
                  className="text-[#0FA37F] focus:ring-0"
                />
                <span>صرف لمركز تكلفة تشغيلي (201 - Goods Issue for Cost Center)</span>
              </label>
              <label className="flex items-center gap-2 font-bold cursor-pointer">
                <input
                  type="radio"
                  name="issueType"
                  checked={issueSubtype === '261'}
                  onChange={() => setIssueSubtype('261')}
                  className="text-[#0FA37F] focus:ring-0"
                />
                <span>صرف لأمر صيانة أو أسطول (261 - Goods Issue for Order)</span>
              </label>
            </div>
          )}

          {activeTab === 'transfer' && (
            <div className="flex gap-4 p-3 bg-[#F8FAFC] rounded-xl border border-[#E5EAF2] text-xs">
              <label className="flex items-center gap-2 font-bold cursor-pointer">
                <input
                  type="radio"
                  name="transferType"
                  checked={transferSubtype === '311'}
                  onChange={() => setTransferSubtype('311')}
                  className="text-[#2563EB] focus:ring-0"
                />
                <span>نقل بين مستودعات نفس المنشأة (311 - SLoc to SLoc)</span>
              </label>
              <label className="flex items-center gap-2 font-bold cursor-pointer">
                <input
                  type="radio"
                  name="transferType"
                  checked={transferSubtype === '301'}
                  onChange={() => setTransferSubtype('301')}
                  className="text-[#2563EB] focus:ring-0"
                />
                <span>نقل بين المحطات والفروع (301 - Plant to Plant)</span>
              </label>
            </div>
          )}

          {/* Material & Source Location */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Select
                label="اختر الصنف المخزني:"
                value={materialCode}
                onChange={(e) => setMaterialCode(e.target.value)}
                options={materials.map((m) => ({
                  label: `${m.materialCode} - ${m.name}`,
                  value: m.materialCode,
                }))}
              />
            </div>

            <Select
              label="المحطة المصدر:"
              value={plantCode}
              onChange={(e) => setPlantCode(e.target.value)}
              options={plants.map((p) => ({
                label: `${p.code} - ${p.name.slice(0, 25)}`,
                value: p.code,
              }))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="مستودع الصرف / المصدر:"
              value={storageLocation}
              onChange={(e) => setStorageLocation(e.target.value)}
              options={storageLocations.map((sl) => ({
                label: `${sl.code} - ${sl.name}`,
                value: sl.code,
              }))}
            />

            <Input
              label={`الكمية المطلوبة (${stockUnit}):`}
              type="number"
              min="0.01"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
              required
            />
          </div>

          {/* Live Availability Status Card (Critical requirement #3) */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
              isInsufficientStock
                ? 'bg-red-50 border-red-200 text-[#EF4444]'
                : 'bg-emerald-50 border-emerald-200 text-[#0FA37F]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {isInsufficientStock ? (
                <AlertCircle className="w-5 h-5 shrink-0 text-[#EF4444]" />
              ) : (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-[#0FA37F]" />
              )}
              <div>
                <span className="font-bold">
                  {isLoadingStock
                    ? 'جاري فحص الرصيد الفعلي...'
                    : `الرصيد المتاح حالياً في [${storageLocation}]: ${availableStock} ${stockUnit}`}
                </span>
                {isInsufficientStock && (
                  <p className="text-[11px] text-red-600 mt-0.5">
                    الرصيد غير كافٍ لتنفيذ هذه الحركة. يتم حظر الصرف بالسالب نظامياً.
                  </p>
                )}
              </div>
            </div>
            <span className="font-mono font-bold text-sm">
              {selectedMaterial ? `${(selectedMaterial.standardPrice * quantity).toLocaleString()} ر.س` : ''}
            </span>
          </div>

          {/* Conditional Destination / Cost Center Fields */}
          {activeTab === 'issue' && issueSubtype === '201' && (
            <Select
              label="مركز التكلفة المستفيد (Cost Center):"
              value={costCenter}
              onChange={(e) => setCostCenter(e.target.value)}
              options={costCenters.map((cc) => ({
                label: `${cc.code} - ${cc.name}`,
                value: cc.code,
              }))}
            />
          )}

          {activeTab === 'issue' && issueSubtype === '261' && (
            <Select
              label="أمر الصيانة / المركبة المستفيدة (Maintenance Order):"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              options={maintenanceOrders.map((mo) => ({
                label: `${mo.docNumber} - ${mo.description}`,
                value: mo.docNumber,
              }))}
            />
          )}

          {activeTab === 'transfer' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-200">
              {transferSubtype === '301' && (
                <Select
                  label="المحطة الوجهة (To Plant):"
                  value={toPlantCode}
                  onChange={(e) => setToPlantCode(e.target.value)}
                  options={plants.map((p) => ({
                    label: `${p.code} - ${p.name}`,
                    value: p.code,
                  }))}
                />
              )}
              <Select
                label="المستودع الوجهة (To Storage Location):"
                value={toStorageLocation}
                onChange={(e) => setToStorageLocation(e.target.value)}
                options={storageLocations.map((sl) => ({
                  label: `${sl.code} - ${sl.name}`,
                  value: sl.code,
                }))}
              />
            </div>
          )}

          {activeTab === 'scrap' && (
            <div className="space-y-3 p-3 bg-red-50/50 rounded-xl border border-red-200">
              <Input
                label="سبب التخريد والإتلاف (Scrap Reason):"
                value={scrapReason}
                onChange={(e) => setScrapReason(e.target.value)}
                placeholder="تلف أثناء النقل، انتهاء صلاحية كيميائية، كسر ميكانيكي..."
                required
              />
              <Select
                label="مركز تكلفة الخسارة (Scrap Expense Cost Center):"
                value={costCenter}
                onChange={(e) => setCostCenter(e.target.value)}
                options={costCenters.map((cc) => ({
                  label: `${cc.code} - ${cc.name}`,
                  value: cc.code,
                }))}
              />
            </div>
          )}

          <Input
            label="ملاحظات الحركة المخزنية:"
            value={headerText}
            onChange={(e) => setHeaderText(e.target.value)}
            placeholder="ملاحظات تفصيلية أو اسم المستلم..."
          />

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5EAF2]">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              إلغاء
            </Button>
            <Button
              type="submit"
              variant={activeTab === 'scrap' ? 'danger' : 'primary'}
              loading={isSubmitting}
              disabled={isInsufficientStock}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              {activeTab === 'issue'
                ? `ترحيل صرف المواد (${issueSubtype})`
                : activeTab === 'transfer'
                ? `ترحيل النقل المخزني (${transferSubtype})`
                : 'ترحيل التخريد والإتلاف (551)'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
