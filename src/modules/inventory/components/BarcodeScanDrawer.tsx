import React, { useState } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import {
  Barcode,
  Scan,
  CheckCircle2,
  AlertCircle,
  Package,
  MapPin,
  FileText,
  ArrowUpRight,
  ArrowDownLeft,
  Boxes,
  Zap,
} from 'lucide-react';
import type { ResolvedBarcode } from '../hooks/useBarcodeScanner';
import type { Material, StorageLocation, PurchaseOrder, MaterialDocument } from '../../../types/models';

interface BarcodeScanDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  scanned: ResolvedBarcode | null;
  onManualScan: (code: string) => void;
  onSelectAction?: (action: 'view_stock' | 'gr' | 'gi', targetCode: string) => void;
}

export const BarcodeScanDrawer: React.FC<BarcodeScanDrawerProps> = ({
  isOpen,
  onClose,
  scanned,
  onManualScan,
  onSelectAction,
}) => {
  const [manualCode, setManualCode] = useState('');

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onManualScan(manualCode.trim());
      setManualCode('');
    }
  };

  const sampleCodes = [
    { label: 'وقود ديزل (Euro 5)', code: 'MAT-FUEL-0001' },
    { label: 'صمام بوابة هيدروليكي', code: 'MAT-VALVE-0008' },
    { label: 'مستودع صهاريج الوقود', code: 'SL01' },
    { label: 'مستودع قطع الغيار', code: 'SL03' },
    { label: 'أمر شراء PO-000001', code: 'PO-2026-000001' },
  ];

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="قارئ الباركود وRFID التفاعلي (Barcode & RFID Wedge)"
      size="md"
    >
      <div className="space-y-6 text-start" dir="rtl">
        {/* Device Status Bar */}
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0FA37F] animate-pulse" />
            <span className="text-xs font-bold text-[#0F172A]">وضع الاستماع المباشر (Keyboard Wedge) نشط</span>
          </div>
          <Badge variant="approved">
            متصل جاهز للمسح
          </Badge>
        </div>

        {/* Manual Input Simulator */}
        <form onSubmit={handleManualSubmit} className="space-y-2">
          <label className="text-xs font-bold text-[#0F172A]">محاكي المسح اليدوي أو إدخال الكود:</label>
          <div className="flex gap-2">
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="امسح بالباركود أو اكتب الكود (مثال: MAT-FUEL-0001)..."
              startIcon={<Scan className="w-4 h-4 text-[#64748B]" />}
              className="flex-1"
            />
            <Button type="submit" variant="primary" size="md" icon={<Barcode className="w-4 h-4" />}>
              مسح
            </Button>
          </div>
        </form>

        {/* Quick Sample Buttons */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-[#64748B] flex items-center gap-1">
            <Zap className="w-3 h-3 text-[#F59E0B]" />
            رموز تجريبية سريعة للاختبار:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {sampleCodes.map((s) => (
              <button
                key={s.code}
                type="button"
                onClick={() => onManualScan(s.code)}
                className="px-2 py-1 bg-white hover:bg-slate-100 text-[#0F172A] border border-[#E5EAF2] rounded-lg text-xs font-mono transition-colors cursor-pointer"
              >
                {s.code} <span className="text-[10px] text-[#64748B]">({s.label})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scanned Result Card */}
        {scanned ? (
          <div className="p-4 bg-white rounded-2xl border border-[#E5EAF2] shadow-sm space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0FA37F]/10 flex items-center justify-center text-[#0FA37F]">
                  {scanned.type === 'material' ? (
                    <Package className="w-5 h-5" />
                  ) : scanned.type === 'storageLocation' ? (
                    <MapPin className="w-5 h-5" />
                  ) : scanned.type === 'purchaseOrder' ? (
                    <FileText className="w-5 h-5" />
                  ) : (
                    <Barcode className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-[#0F172A]">{scanned.rawCode}</span>
                    <Badge
                      variant={
                        scanned.type === 'material'
                          ? 'approved'
                          : scanned.type === 'storageLocation'
                          ? 'in_progress'
                          : scanned.type === 'purchaseOrder'
                          ? 'in_review'
                          : 'neutral'
                      }
                    >
                      {scanned.type === 'material'
                        ? 'مادة / صنف'
                        : scanned.type === 'storageLocation'
                        ? 'موقع تخزين'
                        : scanned.type === 'purchaseOrder'
                        ? 'أمر شراء'
                        : 'غير معروف'}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#64748B] mt-0.5">{scanned.description}</p>
                </div>
              </div>
            </div>

            {/* Entity details display */}
            {scanned.type === 'material' && scanned.item && (
              <div className="p-3 bg-[#F4F7FB] rounded-xl text-xs space-y-2 border border-[#E5EAF2]">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">الاسم:</span>
                  <span className="font-bold text-[#0F172A]">{(scanned.item as Material).name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">المجموعة والتصنيف:</span>
                  <span className="font-semibold text-[#0F172A]">
                    {(scanned.item as Material).groupCode} | فئة {(scanned.item as Material).abcClass}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">السعر المعياري (MAP):</span>
                  <span className="font-bold text-[#0FA37F]">
                    {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(
                      (scanned.item as Material).standardPrice
                    )}{' '}
                    ر.س
                  </span>
                </div>
              </div>
            )}

            {scanned.type === 'storageLocation' && scanned.item && (
              <div className="p-3 bg-[#F4F7FB] rounded-xl text-xs space-y-2 border border-[#E5EAF2]">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">اسم المستودع:</span>
                  <span className="font-bold text-[#0F172A]">{(scanned.item as StorageLocation).name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">نوع التخزين:</span>
                  <span className="font-semibold text-[#0F172A]">{(scanned.item as StorageLocation).type}</span>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="pt-2 border-t border-[#E5EAF2] flex flex-wrap gap-2">
              {scanned.type === 'material' && (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Boxes className="w-3.5 h-3.5" />}
                    onClick={() => {
                      onSelectAction?.('view_stock', scanned.rawCode);
                      onClose();
                    }}
                  >
                    عرض الأرصدة
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<ArrowDownLeft className="w-3.5 h-3.5" />}
                    onClick={() => {
                      onSelectAction?.('gr', scanned.rawCode);
                      onClose();
                    }}
                  >
                    استلام مواد (101)
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<ArrowUpRight className="w-3.5 h-3.5" />}
                    onClick={() => {
                      onSelectAction?.('gi', scanned.rawCode);
                      onClose();
                    }}
                  >
                    صرف مخزني (201)
                  </Button>
                </>
              )}

              {scanned.type === 'purchaseOrder' && (
                <Button
                  size="sm"
                  variant="primary"
                  icon={<ArrowDownLeft className="w-3.5 h-3.5" />}
                  onClick={() => {
                    onSelectAction?.('gr', scanned.rawCode);
                    onClose();
                  }}
                >
                  استلام شحنة أمر الشراء
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center border-2 border-dashed border-[#E5EAF2] rounded-2xl space-y-2">
            <Scan className="w-10 h-10 text-[#64748B] mx-auto opacity-50" />
            <h4 className="text-sm font-bold text-[#0F172A]">في انتظار مسح باركود...</h4>
            <p className="text-xs text-[#64748B]">
              وجّه جهاز القارئ نحو باركود الصنف أو الصهريج، أو استخدم أزرار النماذج أعلاه.
            </p>
          </div>
        )}
      </div>
    </Drawer>
  );
};
