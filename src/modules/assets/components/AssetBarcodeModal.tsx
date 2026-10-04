import React from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { generateCode128Svg } from '../../../core/utils/barcode';
import type { Asset } from '../../../types/models';
import { Printer, ShieldCheck, Tag } from 'lucide-react';
import { t } from '../../../i18n/ar';

interface AssetBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
}

export const AssetBarcodeModal: React.FC<AssetBarcodeModalProps> = ({
  isOpen,
  onClose,
  asset,
}) => {
  if (!asset) return null;

  const barcodeSvg = generateCode128Svg(asset.barcode || asset.assetNumber, {
    height: 52,
    moduleWidth: 2,
    showText: true,
    label: asset.barcode || asset.assetNumber,
  });

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <title>بطاقة باركود أصل رأسمالي - ${asset.assetNumber}</title>
          <style>
            @page { size: auto; margin: 10mm; }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              padding: 20px;
              color: #0F172A;
            }
            .label-card {
              width: 380px;
              border: 2px solid #0B2545;
              border-radius: 12px;
              padding: 16px;
              text-align: center;
              box-shadow: none;
            }
            .header {
              font-weight: bold;
              font-size: 14px;
              color: #0B2545;
              border-bottom: 1px solid #E2E8F0;
              padding-bottom: 6px;
              margin-bottom: 12px;
            }
            .barcode-svg {
              margin: 10px auto;
              max-width: 100%;
            }
            .details-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
              font-size: 11px;
              text-align: right;
              margin-top: 10px;
              background: #F8FAFC;
              padding: 8px;
              border-radius: 6px;
            }
            .details-grid div strong {
              color: #475569;
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="label-card">
            <div class="header">شركة الخليج للطاقة | Gulf Energy ERP</div>
            <div style="font-weight: bold; font-size: 13px; margin-bottom: 4px;">${asset.name}</div>
            <div style="font-size: 11px; color: #64748B; margin-bottom: 8px;">رقم الأصل: ${asset.assetNumber}</div>
            <div class="barcode-svg">${barcodeSvg}</div>
            <div class="details-grid">
              <div><strong>الرقم التسلسلي:</strong> ${asset.serialNumber || 'غير متوفر'}</div>
              <div><strong>الموقع:</strong> ${asset.location || 'المستودع الرئيسي'}</div>
              <div><strong>أمين العهدة:</strong> ${asset.custodian}</div>
              <div><strong>مركز التكلفة:</strong> ${asset.costCenter}</div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="بطاقة تعريف الأصل والباركود (Asset Label Tag)"
      size="md"
    >
      <div className="space-y-4">
        {/* Printable Label Preview Card */}
        <div className="border-2 border-dashed border-slate-300 rounded-2xl p-5 bg-white shadow-sm space-y-4 text-center">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-start">
              <div className="w-8 h-8 rounded-lg bg-[#0B2545] text-white flex items-center justify-center">
                <Tag className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">شركة الخليج للطاقة</p>
                <p className="text-[10px] text-slate-500 font-mono">Gulf Energy Assets</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              معتمد للأصول الرأسمالية
            </span>
          </div>

          <div>
            <h4 className="font-bold text-sm text-slate-900">{asset.name}</h4>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{asset.assetNumber}</p>
          </div>

          {/* Pure vector SVG barcode */}
          <div
            className="p-3 bg-slate-50 rounded-xl flex items-center justify-center overflow-hidden border border-slate-100"
            dangerouslySetInnerHTML={{ __html: barcodeSvg }}
          />

          {/* Quick Specifications */}
          <div className="grid grid-cols-2 gap-2 text-start text-xs bg-slate-50/70 p-3 rounded-xl border border-slate-100">
            <div>
              <span className="text-slate-400 block text-[10px]">الرقم التسلسلي</span>
              <span className="font-medium text-slate-700 font-mono">{asset.serialNumber || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">الموقع / المحطة</span>
              <span className="font-medium text-slate-700">{asset.location || asset.plantCode}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">أمين العهدة</span>
              <span className="font-medium text-slate-700">{asset.custodian}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">مركز التكلفة</span>
              <span className="font-medium text-slate-700 font-mono">{asset.costCenter}</span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            {t('action_close')}
          </Button>
          <Button onClick={handlePrint} className="bg-[#0FA37F] hover:bg-[#0c8a6c] gap-2">
            <Printer className="w-4 h-4" />
            طباعة الملصق الآن
          </Button>
        </div>
      </div>
    </Modal>
  );
};
