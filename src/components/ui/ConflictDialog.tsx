import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConflictDiffItem {
  field: string;
  label?: string;
  currentValue: unknown;
  myValue: unknown;
}

export interface ConflictDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onReload: () => void;
  title?: string;
  message?: string;
  differences?: ConflictDiffItem[];
  isReloading?: boolean;
}

export const ConflictDialog: React.FC<ConflictDialogProps> = ({
  isOpen,
  onClose,
  onReload,
  title = 'تعارض في التعديل المتزامن (Concurrency Conflict)',
  message = 'تم تعديل هذا السجل بواسطة مستخدم آخر. أعد التحميل ثم حاول مجدداً.',
  differences = [],
  isReloading = false,
}) => {
  const [showDifferences, setShowDifferences] = useState(false);

  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? 'نعم' : 'لا';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={title}
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowDifferences(!showDifferences)}
          >
            {showDifferences ? (
              <>
                <EyeOff className="w-4 h-4 me-1.5" />
                إخفاء الفروقات
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 me-1.5" />
                عرض الفروقات
              </>
            )}
          </Button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={isReloading}>
              إلغاء
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onReload}
              loading={isReloading}
            >
              <RefreshCw className="w-4 h-4 me-1.5" />
              إعادة التحميل
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-start" dir="rtl">
        <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-700">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-[#0F172A]">تعارض تعديل متزامن</h4>
            <p className="text-xs text-[#64748B] leading-relaxed">{message}</p>
          </div>
        </div>

        {showDifferences && (
          <div className="border border-[#E5EAF2] rounded-xl overflow-hidden bg-white">
            <div className="bg-[#F4F7FB] px-3.5 py-2 border-b border-[#E5EAF2] text-xs font-bold text-[#0F172A]">
              مقارنة الفروقات بين نسختك والبيانات المحدثة في النظام
            </div>
            {differences.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#64748B]">
                لا توجد فروقات تفصيلية مسجلة أو لم يتم استرجاع الحقول بعد. اضغط "إعادة التحميل" لتحديث النموذج.
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E5EAF2]">
                    <tr>
                      <th className="py-2 px-3 text-start font-medium">الحقل</th>
                      <th className="py-2 px-3 text-start font-medium text-emerald-700">القيمة في النظام</th>
                      <th className="py-2 px-3 text-start font-medium text-blue-700">تعديلاتك المعلقة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5EAF2]">
                    {differences.map((diff, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-[#0F172A]">
                          {diff.label || diff.field}
                        </td>
                        <td className="py-2 px-3 text-emerald-700 bg-emerald-50/40">
                          {formatValue(diff.currentValue)}
                        </td>
                        <td className="py-2 px-3 text-blue-700 bg-blue-50/40">
                          {formatValue(diff.myValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
