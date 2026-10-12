import React from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export interface ConflictDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onReload: () => void;
  entityName?: string;
  entityId?: string;
  expectedVersion?: number;
  currentVersion?: number;
  message?: string;
}

export const ConflictDialog: React.FC<ConflictDialogProps> = ({
  isOpen,
  onClose,
  onReload,
  entityName = 'السجل',
  entityId,
  expectedVersion,
  currentVersion,
  message,
}) => {
  const displayMessage =
    message ||
    `تعارض في التحديث المتزامن: تم تعديل هذا السجل (${entityName}${
      entityId ? ` #${entityId}` : ''
    }) بواسطة مستخدم آخر على الخادم.${
      expectedVersion !== undefined && currentVersion !== undefined
        ? ` (الإصدار المحلي: ${expectedVersion}، إصدار الخادم: ${currentVersion})`
        : ''
    } يرجى إعادة تحميل أحدث نسخة من البيانات لتجنب الكتابة فوق تغييرات الزملاء.`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تعارض في التحديث المتزامن (Concurrency Conflict)"
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} icon={<X className="w-4 h-4" />}>
            إلغاء الأمر
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onReload();
              onClose();
            }}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            إعادة تحميل أحدث بيانات
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3.5 text-start" dir="rtl">
        <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="space-y-1.5 flex-1">
          <h4 className="text-xs font-bold text-[#0F172A]">تم تعديل المستند على الخادم أثناء عملك</h4>
          <p className="text-xs text-[#64748B] leading-relaxed">{displayMessage}</p>
        </div>
      </div>
    </Modal>
  );
};
