import { DiagnosticLogger } from '../../../core/services/DiagnosticLogger';
import React, { useEffect, useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Download,
  Trash2,
  Eye,
  FileCheck,
  AlertCircle,
} from 'lucide-react';
import { MasterDataService } from '../services/MasterDataService';
import type { Attachment } from '../../../types/models';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useToast } from '../../../components/ui/Toast';
import { useAuthStore } from '../../../core/auth/useAuthStore';
import { formatDate } from '../../../core/utils';

export interface AttachmentManagerProps {
  entityType: 'material' | 'vendor' | 'customer' | 'plant' | 'storageLocation' | 'costCenter' | 'glAccount' | 'document';
  entityId: string;
}

export const AttachmentManager: React.FC<AttachmentManagerProps> = ({ entityType, entityId }) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { showToast } = useToast();
  const user = useAuthStore((s) => s.user);

  const loadAttachments = async () => {
    try {
      setLoading(true);
      const data = await MasterDataService.getAttachments(entityType, entityId);
      setAttachments(data);
    } catch (err) {
      DiagnosticLogger.error('AttachmentManager', 'Error loading attachments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttachments();
  }, [entityType, entityId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > 10 * 1024 * 1024) {
      showToast({
        title: 'حجم الملف كبير',
        message: 'الحد الأقصى لحجم المرفق هو 10 ميجابايت.',
        type: 'error',
      });
      return;
    }

    try {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = reader.result as string;
          await MasterDataService.uploadAttachment(
            {
              entityType,
              entityId,
              fileName: file.name,
              fileType: file.type || 'application/octet-stream',
              fileSize: file.size,
              dataUrl,
              uploadedBy: user?.fullName || 'النظام',
            },
            user?.id || 'admin',
            user?.fullName || 'مدير النظام'
          );

          showToast({
            title: 'تم رفع المرفق',
            message: `تم حفظ الملف [${file.name}] في قاعدة البيانات المحلية بنجاح.`,
            type: 'success',
          });

          await loadAttachments();
          if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (uploadErr) {
          showToast({
            title: 'فشل حفظ المرفق',
            message: uploadErr instanceof Error ? uploadErr.message : 'حدث خطأ أثناء حفظ الملف.',
            type: 'error',
          });
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsUploading(false);
      showToast({
        title: 'خطأ في القراءة',
        message: 'تعذر قراءة محتوى الملف المختار.',
        type: 'error',
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await MasterDataService.deleteAttachment(deleteTargetId, user?.id || 'admin', user?.fullName || 'مدير');
      showToast({
        title: 'تم حذف المرفق',
        message: 'تمت إزالة المرفق وتسجيل ذلك في سجل التدقيق.',
        type: 'info',
      });
      setDeleteTargetId(null);
      await loadAttachments();
    } catch (err) {
      showToast({
        title: 'فشل الحذف',
        message: 'حدث خطأ أثناء محاولة حذف الملف.',
        type: 'error',
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const isImage = (type: string) => type.startsWith('image/');

  return (
    <div className="space-y-4">
      {/* Upload Header Card */}
      <Card className="p-4 bg-slate-50 border border-dashed border-slate-300">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-primary shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-navy">إرفاق مستندات وشهادات وبيانات فنية</h4>
              <p className="text-xs text-slate-500">
                يتم تخزين الملفات والصور مشفرة دون اتصال في IndexedDB المحلية. الحد الأقصى: 10 ميجابايت.
              </p>
            </div>
          </div>

          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.svg,.doc,.docx,.xls,.xlsx"
            />
            <Button
              variant="primary"
              size="sm"
              loading={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 me-1.5" />
              اختيار ملف للإرفاق
            </Button>
          </div>
        </div>
      </Card>

      {/* Attachments List */}
      {attachments.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-12 h-12 text-slate-300" />}
          title="لا توجد مرفقات مسجلة"
          description="يمكنك إرفاق شهادات الجودة، السجلات، صور الأصناف، أو عروض الأسعار بصيغ PDF أو صور."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {attachments.map((att) => (
            <Card
              key={att.id}
              className="p-3 border border-slate-200 hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                  {isImage(att.fileType) ? (
                    <img
                      src={att.dataUrl}
                      alt={att.fileName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileText className="w-5 h-5 text-navy" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-navy truncate" title={att.fileName}>
                    {att.fileName}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>{formatFileSize(att.fileSize)}</span>
                    <span>•</span>
                    <span>{formatDate(att.createdAt, 'yyyy-MM-dd')}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 truncate">
                    بواسطة: {att.uploadedBy}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-3 mt-3 border-t border-slate-100">
                {isImage(att.fileType) && (
                  <button
                    type="button"
                    onClick={() => setPreviewAttachment(att)}
                    className="p-1.5 rounded text-slate-600 hover:bg-slate-100 text-xs flex items-center gap-1"
                    title="معاينة الصورة"
                  >
                    <Eye className="w-4 h-4 text-blue" />
                    <span>معاينة</span>
                  </button>
                )}
                <a
                  href={att.dataUrl}
                  download={att.fileName}
                  className="p-1.5 rounded text-slate-600 hover:bg-slate-100 text-xs flex items-center gap-1"
                  title="تحميل الملف"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>تنزيل</span>
                </a>
                <button
                  type="button"
                  onClick={() => setDeleteTargetId(att.id)}
                  className="p-1.5 rounded text-red hover:bg-red-50 text-xs flex items-center gap-1"
                  title="حذف المرفق"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewAttachment && (
        <Modal
          isOpen={!!previewAttachment}
          onClose={() => setPreviewAttachment(null)}
          title={`معاينة المرفق: ${previewAttachment.fileName}`}
          size="lg"
        >
          <div className="flex flex-col items-center justify-center p-2 bg-slate-900 rounded-lg overflow-hidden">
            <img
              src={previewAttachment.dataUrl}
              alt={previewAttachment.fileName}
              className="max-h-[70vh] object-contain rounded"
            />
          </div>
          <div className="flex justify-between items-center mt-4">
            <span className="text-xs text-slate-500">
              حجم الملف: {formatFileSize(previewAttachment.fileSize)}
            </span>
            <a
              href={previewAttachment.dataUrl}
              download={previewAttachment.fileName}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-md text-xs font-semibold hover:bg-emerald-700"
            >
              <Download className="w-3.5 h-3.5" />
              تنزيل الملف
            </a>
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDelete}
        title="تأكيد حذف المرفق"
        message="هل أنت متأكد من حذف هذا الملف نهائياً؟ سيتم تسجيل حركة الحذف في سجل التدقيق."
        confirmText="نعم، حذف الملف"
        cancelText="إلغاء"
        variant="danger"
      />
    </div>
  );
};
