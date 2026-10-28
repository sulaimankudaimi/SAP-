import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Printer, Wrench, Boxes, Calendar, Clock, DollarSign, CheckCircle2 } from 'lucide-react';
import { PrintTemplateService } from '../../admin/services/PrintTemplateService';
import { formatMoney } from '../../../core/utils/format';
import { LOCALE } from '../../../config/locale';
import type { MaintenanceOrder, PrintTemplate } from '../../../types/models';

interface MaintenanceOrderPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: MaintenanceOrder | null;
}

export const MaintenanceOrderPrintModal: React.FC<MaintenanceOrderPrintModalProps> = ({
  isOpen,
  onClose,
  order,
}) => {
  const [template, setTemplate] = useState<PrintTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && order) {
      setIsLoading(true);
      PrintTemplateService.getTemplate('MAINTENANCE')
        .then((tmpl) => setTemplate(tmpl))
        .catch((err) => console.error('Failed to load maintenance print template', err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, order]);

  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`طباعة أمر صيانة أسطول [${order.docNumber}]`}
      size="xl"
    >
      <div className="space-y-6 text-start select-none" dir="rtl">
        {/* Print Toolbar */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5EAF2] print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#64748B]">معاينة أمر الصيانة وإذن صرف القطع:</span>
            <Badge variant="approved">معتمد رسمياً</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              إغلاق
            </Button>
            <Button variant="primary" size="sm" icon={<Printer className="w-4 h-4" />} onClick={handlePrint}>
              طباعة أمر الصيانة (Print)
            </Button>
          </div>
        </div>

        {/* Printable Paper */}
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0 space-y-6 text-xs text-[#0F172A]">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-800 pb-5">
            <div>
              <h1 className="text-lg font-bold text-[#0B2545]">
                {template?.companyNameArabic || LOCALE.brand.nameAr}
              </h1>
              <h2 className="text-xs font-semibold text-slate-500 font-sans tracking-wide">
                {template?.companyNameEnglish || LOCALE.brand.nameEn}
              </h2>
              <div className="mt-2 text-[10px] text-slate-600 space-y-0.5">
                <div>الرقم الضريبي: <span className="font-mono font-bold">{template?.taxNumber || 'SY-TAX-100293'}</span></div>
                <div>السجل التجاري: <span className="font-mono font-bold">{template?.commercialRecord || 'DAM-CR-88412'}</span></div>
                <div className="text-slate-500">{template?.headerText}</div>
              </div>
            </div>

            <div className="text-end">
              <div className="inline-block px-3 py-1 bg-slate-100 border border-slate-300 rounded font-bold text-xs text-[#0B2545] mb-2">
                أمر صيانة وإصلاح أسطول
              </div>
              <div className="text-sm font-black font-mono text-[#0B2545]">{order.docNumber}</div>
              <div className="text-[10px] text-slate-500 font-mono mt-1">
                تاريخ الأمر: {order.startDate || new Date().toISOString().slice(0, 10)}
              </div>
              {order.materialDocNumber && (
                <div className="text-[10px] text-[#0FA37F] font-mono font-bold mt-1">
                  سند صرف المخزون (261): {order.materialDocNumber}
                </div>
              )}
            </div>
          </div>

          {/* Vehicle & Maintenance Order Details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] text-slate-500 block">رقم اللوحة:</span>
              <span className="font-bold font-mono text-sm text-[#0B2545]">{order.vehiclePlate}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">نوع الصيانة:</span>
              <span className="font-bold text-xs text-[#0F172A]">
                {order.orderType === 'Preventive'
                  ? 'صيانة دورية وقائية'
                  : order.orderType === 'Corrective'
                  ? 'صيانة طارئة / علاجية'
                  : 'فحص فني ومعايرة'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">حالة الأمر:</span>
              <span className="font-bold text-xs text-[#0FA37F]">
                {order.status === 'completed' ? 'مكتمل ومعتمد' : 'قيد التنفيذ بالورشة'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">ساعات التوقف (Downtime):</span>
              <span className="font-bold font-mono text-xs text-[#EF4444]">
                {order.downtimeHours ? `${order.downtimeHours} ساعة` : '—'}
              </span>
            </div>
          </div>

          {/* Fault & Description */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
            <div>
              <span className="font-bold text-slate-700">وصف العطل والأعمال المطلوبة: </span>
              <span className="text-slate-800">{order.description}</span>
            </div>
            {order.faultReported && (
              <div>
                <span className="font-bold text-[#EF4444]">العطل الميداني المبلغ عنه: </span>
                <span className="text-slate-800">{order.faultReported}</span>
              </div>
            )}
          </div>

          {/* Parts Issued Table (Movement 261) */}
          <div className="space-y-2">
            <div className="font-bold text-xs text-[#0B2545] flex items-center justify-between">
              <span>قطع الغيار المستهلكة والمصروفة من المستودع (حركة SAP 261):</span>
              <span className="text-[10px] text-slate-500 font-normal">
                {order.partsUsed.length} قطع مسجلة
              </span>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-start">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 text-start">كود المادة</th>
                    <th className="p-2.5 text-start">اسم الصنف والمواصفات</th>
                    <th className="p-2.5 text-center">الكمية</th>
                    <th className="p-2.5 text-center">الوحدة</th>
                    <th className="p-2.5 text-end">سعر الوحدة</th>
                    <th className="p-2.5 text-end font-bold text-[#0B2545]">إجمالي التكلفة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {order.partsUsed.map((p, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 font-mono font-bold text-[#0F172A]">{p.materialCode}</td>
                      <td className="p-2.5 font-semibold text-[#0F172A]">{p.materialName}</td>
                      <td className="p-2.5 text-center font-mono font-bold">{p.quantity}</td>
                      <td className="p-2.5 text-center">{p.unit}</td>
                      <td className="p-2.5 text-end font-mono">{formatMoney(p.unitPrice ?? 0)}</td>
                      <td className="p-2.5 text-end font-mono font-bold text-[#0FA37F]">
                        {formatMoney(p.totalCost ?? 0)}
                      </td>
                    </tr>
                  ))}
                  {order.partsUsed.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400">
                        لم يتم صرف قطع غيار مستودعية لهذا الأمر
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Labor & Financial Totals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <div className="font-bold text-[#0B2545] text-xs">تفاصيل ساعات العمل الفني</div>
              <div className="text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">ساعات العمل المنجزة:</span>
                  <span className="font-mono font-bold">{order.laborHours || 0} ساعة</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">معدل أجر الفني بالساعة:</span>
                  <span className="font-mono">{formatMoney(120)} / ساعة</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">تاريخ إغلاق الأمر:</span>
                  <span className="font-mono">{order.completionDate || '—'}</span>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <div className="font-bold text-[#0B2545] text-xs">ملخص التكاليف المالية الإجمالية</div>
              <div className="text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">تكلفة قطع الغيار المصروفة:</span>
                  <span className="font-mono">{formatMoney(order.partsCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">تكلفة أجور الفنيين:</span>
                  <span className="font-mono">{formatMoney(order.laborCost)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-300 font-bold text-xs text-[#0FA37F]">
                  <span>التكلفة الفعلية الإجمالية:</span>
                  <span className="font-mono text-sm">{formatMoney(order.actualCost)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Terms & Conditions */}
          {template?.termsAndConditions && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[10px] text-slate-600 whitespace-pre-line leading-relaxed">
              <span className="font-bold text-slate-700 block mb-1">شروط واعتمادات الصيانة والضمان:</span>
              {template.termsAndConditions}
            </div>
          )}

          {/* Signatures & Stamp Block */}
          {template?.showSignatureBlock && (
            <div className="pt-6 border-t border-slate-300 grid grid-cols-4 gap-4 text-center text-[10px]">
              <div>
                <span className="font-bold block text-slate-700">الفني المنفذ</span>
                <div className="h-14 border-b border-dashed border-slate-400 mt-2"></div>
                <span className="text-slate-400 text-[9px] mt-1 block">توقيع الفني</span>
              </div>
              <div>
                <span className="font-bold block text-slate-700">مشرف الورشة المركزية</span>
                <div className="h-14 border-b border-dashed border-slate-400 mt-2"></div>
                <span className="text-slate-400 text-[9px] mt-1 block">اعتماد المشرف</span>
              </div>
              <div>
                <span className="font-bold block text-slate-700">أمين مستودع القطع (261)</span>
                <div className="h-14 border-b border-dashed border-slate-400 mt-2"></div>
                <span className="text-slate-400 text-[9px] mt-1 block">توقيع المستودع</span>
              </div>
              <div>
                <span className="font-bold block text-slate-700">ختم ورشة الصيانة</span>
                <div className="h-14 border border-dashed border-slate-400 rounded-lg mt-2 flex items-center justify-center text-slate-300 text-[9px]">
                  موضع الختم الرسمي
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-[9px] text-slate-500 pt-3 border-t border-slate-200">
            {template?.footerText || 'تمت الصيانة وفحص الجودة وصرف قطع الغيار وفق معايير SAP PM حركة 261.'}
          </div>
        </div>
      </div>
    </Modal>
  );
};
