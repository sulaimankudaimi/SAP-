import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { t } from '../../i18n/ar';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'warning';
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = t('confirm_title'),
  message = t('confirm_message'),
  confirmLabel,
  confirmText,
  cancelLabel,
  cancelText,
  variant = 'danger',
  loading = false,
}) => {
  const finalConfirmText = confirmText || confirmLabel || t('action_confirm');
  const finalCancelText = cancelText || cancelLabel || t('action_cancel');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            {finalCancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            {finalConfirmText}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
            variant === 'danger' ? 'bg-[#EF4444]/10 text-[#EF4444]' : 'bg-[#0FA37F]/10 text-[#0FA37F]'
          }`}
        >
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="space-y-1 text-start">
          <h4 className="text-sm font-bold text-[#0F172A]">{title}</h4>
          <p className="text-xs text-[#64748B] leading-relaxed">{message}</p>
        </div>
      </div>
    </Modal>
  );
};
