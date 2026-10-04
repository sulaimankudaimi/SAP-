import React, { useRef } from 'react';
import { Printer, Copy, Check, Barcode } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { generateCode128Svg } from '../../../core/utils/barcode';
import { formatDate } from '../../../core/utils';
import { useToast } from '../../../components/ui/Toast';

export interface BarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  materialCode: string;
  materialName: string;
  unit: string;
  category?: string;
}

export const BarcodeModal: React.FC<BarcodeModalProps> = ({
  isOpen,
  onClose,
  materialCode,
  materialName,
  unit,
  category,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  const svgContent = generateCode128Svg(materialCode, {
    height: 70,
    moduleWidth: 2,
    showText: true,
    label: `*${materialCode}*`,
  });

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>ملصق باركود - ${materialCode}</title>
          <style>
            body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; padding: 20px; }
            .label-card { width: 350px; border: 2px dashed #000; padding: 16px; border-radius: 8px; text-align: center; }
            .title { font-size: 14px; font-weight: bold; margin-bottom: 4px; }
            .name { font-size: 16px; font-weight: bold; margin-bottom: 8px; }
            .meta { font-size: 12px; margin-bottom: 12px; }
            .barcode { margin: 10px 0; }
            @media print {
              body { padding: 0; }
              .label-card { border: 1px solid #000; width: 100%; }
            }
          </style>
        </head>
        <body>
          <div class="label-card">
            <div class="title">شركة الخليج للطاقة (Gulf Energy ERP)</div>
            <div class="name">${materialName}</div>
            <div class="meta">الرمز: <strong>${materialCode}</strong> | الوحدة: <strong>${unit}</strong></div>
            <div class="barcode">${svgContent}</div>
            <div class="meta" style="font-size: 10px; color: #555;">تاريخ الإصدار: ${formatDate(new Date(), 'yyyy-MM-dd HH:mm')}</div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const copyCode = () => {
    navigator.clipboard.writeText(materialCode);
    showToast({
      title: 'تم النسخ',
      message: `تم نسخ رمز المادة [${materialCode}] إلى الحافظة.`,
      type: 'info',
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="ملصق باركود الصنف المعياري (Code128 Barcode)"
      size="md"
    >
      <div className="space-y-6">
        {/* Printable Card Container */}
        <div
          ref={printRef}
          className="p-5 bg-white border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center text-center shadow-sm"
        >
          <div className="text-xs font-bold text-navy uppercase tracking-wider mb-1">
            شركة الخليج للطاقة — نظام إدارة المخازن
          </div>
          <h3 className="text-lg font-bold text-navy mb-1">{materialName}</h3>
          <div className="text-xs text-slate-500 mb-4 flex items-center gap-3">
            <span>الرمز: <strong className="font-mono text-navy">{materialCode}</strong></span>
            <span>•</span>
            <span>الوحدة: <strong>{unit}</strong></span>
            {category && (
              <>
                <span>•</span>
                <span>المجموعة: <strong>{category}</strong></span>
              </>
            )}
          </div>

          {/* Inline SVG Barcode */}
          <div
            className="w-full max-w-[280px] my-2 p-2 bg-slate-50 rounded border border-slate-200"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />

          <div className="text-[10px] text-slate-400 mt-2 font-mono">
            Generated Code128 Offline • {formatDate(new Date(), 'yyyy-MM-dd HH:mm')}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Button variant="secondary" size="sm" onClick={copyCode}>
            <Copy className="w-4 h-4 me-1.5" />
            نسخ الرمز الرقمي
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              إغلاق
            </Button>
            <Button variant="primary" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 me-1.5" />
              طباعة الملصق الآن
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
