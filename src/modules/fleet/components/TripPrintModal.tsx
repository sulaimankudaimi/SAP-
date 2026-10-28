import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Printer, Navigation, Truck, User, Calendar, MapPin, CheckCircle2, ShieldCheck } from 'lucide-react';
import { PrintTemplateService } from '../../admin/services/PrintTemplateService';
import { formatMoney, formatNumber } from '../../../core/utils/format';
import { LOCALE } from '../../../config/locale';
import type { Trip, PrintTemplate } from '../../../types/models';

interface TripPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip | null;
}

export const TripPrintModal: React.FC<TripPrintModalProps> = ({
  isOpen,
  onClose,
  trip,
}) => {
  const [template, setTemplate] = useState<PrintTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && trip) {
      setIsLoading(true);
      PrintTemplateService.getTemplate('TRIP')
        .then((tmpl) => setTemplate(tmpl))
        .catch((err) => console.error('Failed to load trip print template', err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, trip]);

  if (!trip) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`طباعة بوليسة شحن وترحيل شاحنة [${trip.docNumber}]`}
      size="xl"
    >
      <div className="space-y-6 text-start select-none" dir="rtl">
        {/* Print Toolbar */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5EAF2] print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#64748B]">معاينة المستند الرسمي قبل الطباعة:</span>
            <Badge variant="approved">معتمد رسمياً</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              إغلاق
            </Button>
            <Button variant="primary" size="sm" icon={<Printer className="w-4 h-4" />} onClick={handlePrint}>
              طباعة البوليسة (Print)
            </Button>
          </div>
        </div>

        {/* Printable Voucher Paper */}
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
                بوليسة شحن وترحيل شاحنة
              </div>
              <div className="text-sm font-black font-mono text-[#0B2545]">{trip.docNumber}</div>
              <div className="text-[10px] text-slate-500 font-mono mt-1">
                تاريخ الإصدار: {trip.createdAt ? trip.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)}
              </div>
              {trip.postedAccountingDocNumber && (
                <div className="text-[10px] text-[#0FA37F] font-mono font-bold mt-1">
                  سند القيد المحاسبي: {trip.postedAccountingDocNumber}
                </div>
              )}
            </div>
          </div>

          {/* Trip Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] text-slate-500 block">رقم اللوحة والموديل:</span>
              <span className="font-bold font-mono text-sm text-[#0B2545]">{trip.vehiclePlate}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">السائق المسؤول:</span>
              <span className="font-bold text-sm text-[#0F172A]">{trip.driverName}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">محطة الانطلاق:</span>
              <span className="font-semibold text-xs text-[#0F172A]">{trip.originPlant}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">وجهة التسليم:</span>
              <span className="font-semibold text-xs text-[#0F172A]">{trip.destinationLocation}</span>
            </div>
          </div>

          {/* Cargo and Mileage Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-start">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5 text-start">نوع الحمولة البترولية</th>
                  <th className="p-2.5 text-center">كمية الشحن (لتر)</th>
                  <th className="p-2.5 text-center">عداد البداية (كم)</th>
                  <th className="p-2.5 text-center">عداد الوصول (كم)</th>
                  <th className="p-2.5 text-center">المسافة الفعلية</th>
                  <th className="p-2.5 text-end">حالة الرحلة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="p-2.5 font-bold text-[#0B2545]">{trip.cargoType}</td>
                  <td className="p-2.5 text-center font-mono font-bold">
                    {trip.cargoVolumeLiters ? formatNumber(trip.cargoVolumeLiters) : '—'}
                  </td>
                  <td className="p-2.5 text-center font-mono">{formatNumber(trip.startOdometer ?? 0)}</td>
                  <td className="p-2.5 text-center font-mono">
                    {trip.endOdometer ? formatNumber(trip.endOdometer) : 'قيد السير'}
                  </td>
                  <td className="p-2.5 text-center font-mono font-bold text-[#0FA37F]">
                    {trip.distanceKm ? `${formatNumber(trip.distanceKm)} كم` : '—'}
                  </td>
                  <td className="p-2.5 text-end font-semibold">
                    {trip.status === 'completed' ? 'مكتملة ومُرحّلة' : 'في الطريق'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Timestamps & Financial Cost Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="font-bold text-[#0B2545] text-xs flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-500" />
                الرصد الزمني للرحلة
              </div>
              <div className="text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">المغادرة المجدولة:</span>
                  <span className="font-mono">{trip.scheduledDeparture || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">الوصول المجدول:</span>
                  <span className="font-mono">{trip.scheduledArrival || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">الوصول الفعلي:</span>
                  <span className="font-mono font-bold">{trip.actualArrival || '—'}</span>
                </div>
                {trip.delayMinutes && trip.delayMinutes > 0 && (
                  <div className="flex justify-between text-[#EF4444] font-bold">
                    <span>التأخير المسجل:</span>
                    <span>{trip.delayMinutes} دقيقة ({trip.delayReason || 'تأخير حركة سير'})</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="font-bold text-[#0B2545] text-xs">التكاليف المحاسبية المرتبطة بالرحلة</div>
              <div className="text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">تكلفة وقود الرحلة:</span>
                  <span className="font-mono font-semibold">
                    {formatMoney(trip.fuelCost ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">بدل السائق ({LOCALE.currency.code}/Km):</span>
                  <span className="font-mono font-semibold">
                    {formatMoney(trip.driverAllowanceCost ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-300 font-bold text-xs text-[#0FA37F]">
                  <span>إجمالي تكلفة الرحلة:</span>
                  <span className="font-mono">
                    {formatMoney(trip.totalTripCost ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Terms & Conditions */}
          {template?.termsAndConditions && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[10px] text-slate-600 whitespace-pre-line leading-relaxed">
              <span className="font-bold text-slate-700 block mb-1">تعليمات وشروط النقل والسلامة المهنية:</span>
              {template.termsAndConditions}
            </div>
          )}

          {/* Signatures & Stamp Block */}
          {template?.showSignatureBlock && (
            <div className="pt-6 border-t border-slate-300 grid grid-cols-4 gap-4 text-center text-[10px]">
              <div>
                <span className="font-bold block text-slate-700">مأمور الترحيل والحركة</span>
                <div className="h-14 border-b border-dashed border-slate-400 mt-2"></div>
                <span className="text-slate-400 text-[9px] mt-1 block">التوقيع والاعتماد</span>
              </div>
              <div>
                <span className="font-bold block text-slate-700">السائق المستلم</span>
                <div className="h-14 border-b border-dashed border-slate-400 mt-2"></div>
                <span className="text-slate-400 text-[9px] mt-1 block">توقيع السائق</span>
              </div>
              <div>
                <span className="font-bold block text-slate-700">مستلم الشحنة بالوجهة</span>
                <div className="h-14 border-b border-dashed border-slate-400 mt-2"></div>
                <span className="text-slate-400 text-[9px] mt-1 block">مطابقة الفحص والاستلام</span>
              </div>
              <div>
                <span className="font-bold block text-slate-700">ختم المحطة والشركة</span>
                <div className="h-14 border border-dashed border-slate-400 rounded-lg mt-2 flex items-center justify-center text-slate-300 text-[9px]">
                  موضع الختم الرسمي
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-[9px] text-slate-500 pt-3 border-t border-slate-200">
            {template?.footerText || 'تخضع الشحنة لمعايير السلامة المهنية وتنظيمات النقل المعتمدة.'}
          </div>
        </div>
      </div>
    </Modal>
  );
};
