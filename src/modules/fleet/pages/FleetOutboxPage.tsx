import React, { useState, useEffect, useMemo } from 'react';
import {
  Inbox,
  RefreshCw,
  RotateCw,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  Truck,
  FileText,
  Search,
} from 'lucide-react';
import { db } from '../../../core/db';
import type { OutboxCommand } from '../../../types/models';
import { OutboxEngine } from '../../../core/gateway/OutboxEngine';
import { useConnectivityStore } from '../../../core/gateway/connectivity';
import { useAuthStore } from '../../../core/auth/useAuthStore';
import { useToast } from '../../../components/ui/Toast';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Textarea } from '../../../components/ui/Textarea';

export const FleetOutboxPage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const { user } = useAuthStore();
  const { isOnline, isSyncing, refreshOutboxCounts } = useConnectivityStore();

  const [commands, setCommands] = useState<OutboxCommand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Discard Modal State
  const [itemToDiscard, setItemToDiscard] = useState<OutboxCommand | null>(null);
  const [discardReason, setDiscardReason] = useState('');
  const [isDiscarding, setIsDiscarding] = useState(false);

  // Edit & Resubmit Modal State
  const [itemToEdit, setItemToEdit] = useState<OutboxCommand | null>(null);
  const [editedPayloadJson, setEditedPayloadJson] = useState('');
  const [isResubmitting, setIsResubmitting] = useState(false);

  const loadOutbox = async () => {
    setIsLoading(true);
    try {
      const items = await db.outbox.toArray();
      // Sort newest first for review overview
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCommands(items);
      await refreshOutboxCounts();
    } catch (err) {
      toastError('خطأ', 'تعذر تحميل عناصر صندوق الإرسال.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOutbox();
  }, []);

  const filteredCommands = useMemo(() => {
    return commands.filter((cmd) => {
      if (filterStatus !== 'ALL' && cmd.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const idMatch = cmd.id.toLowerCase().includes(q);
        const typeMatch = cmd.type.toLowerCase().includes(q);
        const vehMatch = cmd.vehicleId ? cmd.vehicleId.toLowerCase().includes(q) : false;
        const errMatch = cmd.lastError ? cmd.lastError.toLowerCase().includes(q) : false;
        return idMatch || typeMatch || vehMatch || errMatch;
      }
      return true;
    });
  }, [commands, filterStatus, searchQuery]);

  // Action: Retry
  const handleRetry = async (id: string) => {
    try {
      await OutboxEngine.retryItem(id);
      success('تمت إعادة الجدولة', 'تمت إعادة العملية إلى قائمة الإرسال بانتظار المزامنة.');
      await loadOutbox();
    } catch (err) {
      toastError('فشل إعادة المحاولة', err instanceof Error ? err.message : String(err));
    }
  };

  // Action: Open Discard Dialog
  const openDiscardModal = (cmd: OutboxCommand) => {
    setItemToDiscard(cmd);
    setDiscardReason('');
  };

  // Action: Submit Discard
  const handleConfirmDiscard = async () => {
    if (!itemToDiscard) return;
    if (!discardReason.trim()) {
      toastError('سبب الإلغاء إلزامي', 'يرجى كتابة سبب استبعاد العملية لتوثيقه في سجل التدقيق الأمني.');
      return;
    }

    setIsDiscarding(true);
    try {
      await OutboxEngine.discardItem({
        id: itemToDiscard.id,
        reason: discardReason,
        userId: user?.id || 'u-flt-mgr',
        userName: user?.fullName || user?.username || 'مدير الأسطول',
      });
      success('تم استبعاد العملية', 'تم إلغاء وتوثيق استبعاد العملية بنجاح في سجل الرقابة.');
      setItemToDiscard(null);
      await loadOutbox();
    } catch (err) {
      toastError('فشل الاستبعاد', err instanceof Error ? err.message : String(err));
    } finally {
      setIsDiscarding(false);
    }
  };

  // Action: Open Edit Dialog
  const openEditModal = (cmd: OutboxCommand) => {
    setItemToEdit(cmd);
    setEditedPayloadJson(JSON.stringify(cmd.payload, null, 2));
  };

  // Action: Submit Edit & Resubmit
  const handleConfirmEditAndResubmit = async () => {
    if (!itemToEdit) return;

    let parsedPayload: Record<string, unknown>;
    try {
      parsedPayload = JSON.parse(editedPayloadJson);
    } catch {
      toastError('خطأ تنسيق JSON', 'يرجى التأكد من كتابة بيانات صالحة بصيغة JSON.');
      return;
    }

    setIsResubmitting(true);
    try {
      await OutboxEngine.editAndResubmit(itemToEdit.id, parsedPayload);
      success('تم التعديل وإعادة الإرسال', 'تم إنشاء عملية جديدة بالبيانات المعدلة وإضافتها لصندوق الإرسال.');
      setItemToEdit(null);
      await loadOutbox();
    } catch (err) {
      toastError('فشل التعديل', err instanceof Error ? err.message : String(err));
    } finally {
      setIsResubmitting(false);
    }
  };

  const getStatusBadge = (status: OutboxCommand['status']) => {
    switch (status) {
      case 'needs_review':
        return <Badge variant="critical">بانتظار المراجعة (مرفوض)</Badge>;
      case 'rejected':
        return <Badge variant="critical">مرفوض</Badge>;
      case 'sending':
        return <Badge variant="in_progress">جاري الإرسال...</Badge>;
      case 'pending':
        return <Badge variant="neutral">معلق (قيد الانتظار)</Badge>;
      case 'done':
        return <Badge variant="approved">مكتمل ومُرسل</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'fuel_log':
        return 'قيد تزويد وقود (Fuel Log)';
      case 'trip_event':
        return 'حدث رحلة شحن (Trip Event)';
      case 'odometer_reading':
        return 'قراءة عداد المسافات (Odometer)';
      case 'inspection':
        return 'فحص فني للمركبة (Inspection)';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6 text-start p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#E5EAF2]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
              <Inbox className="w-6 h-6 text-[#0FA37F]" />
              عمليات بانتظار المراجعة (Offline Command Outbox)
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#0FA37F]/10 text-[#0FA37F]">
              {commands.filter((c) => c.status === 'needs_review').length} تتطلب مراجعة
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-1">
            إدارة ومراجعة العمليات المنفذة في وضع عدم الاتصال، معالجة الرفض الرقابي، وإعادة الإرسال وفق المعيار الصارم
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={<RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />}
            onClick={() => {
              OutboxEngine.processQueue();
              loadOutbox();
            }}
            disabled={!isOnline || isSyncing}
          >
            {isSyncing ? 'جاري المزامنة...' : 'مزامنة الآن'}
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E5EAF2]">
        <div className="flex items-center gap-2 flex-1 max-w-md bg-[#F4F7FB] px-3 py-2 rounded-xl border border-[#E5EAF2]">
          <Search className="w-4 h-4 text-[#64748B]" />
          <input
            type="text"
            placeholder="بحث برقم المعاملة (UUID) أو نوع العملية أو المركبة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-[#0F172A] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#64748B] font-semibold">تصفية الحالة:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#F4F7FB] border border-[#E5EAF2] rounded-xl px-3 py-1.5 text-xs text-[#0F172A] focus:outline-none"
          >
            <option value="ALL">كافة الحالات</option>
            <option value="needs_review">بانتظار المراجعة (needs_review)</option>
            <option value="pending">معلق (pending)</option>
            <option value="sending">جاري الإرسال (sending)</option>
            <option value="done">مكتمل ومُرسل (done)</option>
          </select>
        </div>
      </div>

      {/* Outbox Table */}
      <div className="bg-white rounded-2xl border border-[#E5EAF2] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-[#F4F7FB] border-b border-[#E5EAF2] text-[#64748B] font-bold">
              <tr>
                <th className="p-3.5 text-start">معرف الطلب (Request ID)</th>
                <th className="p-3.5 text-start">نوع العملية</th>
                <th className="p-3.5 text-start">المركبة</th>
                <th className="p-3.5 text-start">الحالة</th>
                <th className="p-3.5 text-start">المحاولات</th>
                <th className="p-3.5 text-start">تاريخ الإنشاء</th>
                <th className="p-3.5 text-start">سبب الرفض / الخطأ</th>
                <th className="p-3.5 text-end">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF2]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[#64748B]">
                    جاري تحميل سجلات صندوق الإرسال...
                  </td>
                </tr>
              ) : filteredCommands.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[#64748B]">
                    لا توجد عمليات مطابقة في صندوق الإرسال حالياً.
                  </td>
                </tr>
              ) : (
                filteredCommands.map((cmd) => (
                  <tr key={cmd.id} className="hover:bg-[#F4F7FB]/50 transition-colors">
                    <td className="p-3.5 font-mono text-[11px] text-[#0F172A] font-semibold">
                      {cmd.id}
                    </td>
                    <td className="p-3.5 font-semibold text-[#0F172A]">
                      {getTypeLabel(cmd.type)}
                    </td>
                    <td className="p-3.5 text-[#64748B]">
                      {cmd.vehicleId || '-'}
                    </td>
                    <td className="p-3.5">
                      {getStatusBadge(cmd.status)}
                    </td>
                    <td className="p-3.5 font-mono text-center">
                      {cmd.attempts}
                    </td>
                    <td className="p-3.5 text-[#64748B] font-mono text-[11px]">
                      {cmd.createdAt.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="p-3.5 text-rose-600 max-w-xs truncate" title={cmd.lastError || ''}>
                      {cmd.lastError || '-'}
                    </td>
                    <td className="p-3.5 text-end">
                      <div className="flex items-center justify-end gap-1.5">
                        {(cmd.status === 'needs_review' || cmd.status === 'rejected' || cmd.status === 'pending') && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleRetry(cmd.id)}
                            title="إعادة المحاولة بنفس المعرف (Retry)"
                          >
                            <RotateCw className="w-3.5 h-3.5 text-[#0FA37F]" />
                          </Button>
                        )}

                        {(cmd.status === 'needs_review' || cmd.status === 'rejected') && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openEditModal(cmd)}
                            title="تعديل البيانات وإعادة الإرسال كأمر جديد"
                          >
                            <Edit className="w-3.5 h-3.5 text-[#2563EB]" />
                          </Button>
                        )}

                        {cmd.status !== 'done' && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => openDiscardModal(cmd)}
                            title="استبعاد وإلغاء العملية مع توثيق السبب"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Mandatory Audited Discard */}
      <Modal
        isOpen={Boolean(itemToDiscard)}
        onClose={() => setItemToDiscard(null)}
        title="استبعاد وإلغاء العملية من صندوق الإرسال"
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setItemToDiscard(null)}>
              إلغاء
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmDiscard}
              loading={isDiscarding}
            >
              تأكيد الاستبعاد وتوثيق السبب
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-start" dir="rtl">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
            <strong>تحذير رقابي:</strong> سيتم حذف هذه العملية نهائياً من صندوق الإرسال وتوثيق اسم
            المستخدم وتاريخ الإلغاء وسبب الاستبعاد في سجل التدقيق الأمني (AuditLog).
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#0F172A]">
              سبب الاستبعاد الإلزامي: <span className="text-rose-500">*</span>
            </label>
            <Textarea
              rows={3}
              placeholder="اكتب بالتفصيل سبب استبعاد هذه العملية وعدم ترحيلها..."
              value={discardReason}
              onChange={(e) => setDiscardReason(e.target.value)}
              className="w-full text-xs"
            />
          </div>
        </div>
      </Modal>

      {/* Modal: Edit and Resubmit */}
      <Modal
        isOpen={Boolean(itemToEdit)}
        onClose={() => setItemToEdit(null)}
        title="تعديل حمولة العملية وإعادة الإرسال (Edit & Resubmit)"
        size="lg"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setItemToEdit(null)}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmEditAndResubmit}
              loading={isResubmitting}
            >
              حفظ وإرسال كأمر جديد
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-start" dir="rtl">
          <p className="text-xs text-[#64748B]">
            يمكنك تصحيح البيانات غير الصالحة التي تسببت في رفض الخادم للأمر، ثم إرسالها مجدداً.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#0F172A]">
              حمولة البيانات (JSON Payload):
            </label>
            <Textarea
              rows={8}
              dir="ltr"
              value={editedPayloadJson}
              onChange={(e) => setEditedPayloadJson(e.target.value)}
              className="font-mono text-xs w-full"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
