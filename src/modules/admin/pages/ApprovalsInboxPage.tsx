import React, { useState, useEffect } from 'react';
import {
  Inbox,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  DollarSign,
  UserCheck,
  ShieldAlert,
  Search,
  RefreshCw,
  MessageSquare,
  AlertCircle,
  Eye,
  Check,
  X,
  Building,
  Printer,
} from 'lucide-react';
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { useToast } from '../../../components/ui/Toast';
import { useAuthStore } from '../../../core/auth/useAuthStore';
import { ApprovalService } from '../../../core/services/ApprovalService';
import { db } from '../../../core/db';
import { PrintDocumentModal } from '../../../components/common/PrintDocumentModal';
import type { ApprovalRequest, WorkflowDocumentType, PrintDocumentType } from '../../../types/models';

export const ApprovalsInboxPage: React.FC = () => {
  const { user } = useAuthStore();
  const { success, error, info } = useToast();

  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterTab, setFilterTab] = useState<'pending' | 'my_pending' | 'completed' | 'all'>('my_pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Request for action modal
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [actionComment, setActionComment] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const getPrintDocType = (docType: WorkflowDocumentType): PrintDocumentType => {
    if (docType === 'PAYMENT') return 'VOUCHER';
    return 'PO';
  };

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const list = await db.approvalRequests.filter((r) => !r.isDeleted).toArray();
      // Sort newest first
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setRequests(list);
    } catch (err) {
      console.error(err);
      error('خطأ', 'تعذر تحميل طلبات الاعتماد من قاعدة البيانات.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleOpenActionModal = (req: ApprovalRequest) => {
    setSelectedRequest(req);
    setActionComment('');
  };

  const handleProcessAction = async (action: 'approve' | 'reject') => {
    if (!selectedRequest || !user) return;

    if (action === 'reject' && !actionComment.trim()) {
      error('سبب الرفض إلزامي', 'يرجى كتابة سبب الرفض في خانة الملاحظات للمتابعة الإدارية.');
      return;
    }

    setIsProcessing(true);
    try {
      await ApprovalService.processStep({
        requestId: selectedRequest.id,
        action,
        comment: actionComment.trim() || (action === 'approve' ? 'تمت الموافقة والاعتماد' : 'مرفوض'),
        approver: user,
      });

      success(
        action === 'approve' ? 'تم الاعتماد بنجاح' : 'تم رفض الطلب',
        `تم تسجيل إجراء [${action === 'approve' ? 'الموافقة' : 'الرفض'}] على المستند ${selectedRequest.documentNumber}.`
      );
      setSelectedRequest(null);
      await loadRequests();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشلت معالجة خطوة الاعتماد';
      error('خطأ في معالجة الاعتماد', msg);
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter requests
  const filteredRequests = requests.filter((r) => {
    // Type Filter
    if (filterType !== 'ALL' && r.documentType !== filterType) return false;

    // Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchDoc = r.documentNumber.toLowerCase().includes(q);
      const matchReq = r.requesterUserName?.toLowerCase().includes(q);
      if (!matchDoc && !matchReq) return false;
    }

    // Status Tab Filter
    const currentStepObj = r.steps[r.currentStep - 1];
    const isUserStep =
      currentStepObj &&
      (user?.roleCode === currentStepObj.roleCode || user?.roleCode === 'ADMIN');

    if (filterTab === 'my_pending') {
      return r.status === 'pending' && isUserStep;
    } else if (filterTab === 'pending') {
      return r.status === 'pending';
    } else if (filterTab === 'completed') {
      return r.status === 'approved' || r.status === 'rejected';
    }

    return true;
  });

  const myPendingCount = requests.filter((r) => {
    const currentStepObj = r.steps[r.currentStep - 1];
    return (
      r.status === 'pending' &&
      currentStepObj &&
      (user?.roleCode === currentStepObj.roleCode || user?.roleCode === 'ADMIN')
    );
  }).length;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div>
        <Breadcrumbs
          items={[
            { label: 'الرئيسية', path: '/' },
            { label: 'طلبات الموافقة والاعتماد (SBWP)' },
          ]}
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#0F172A] flex items-center gap-2.5">
              <Inbox className="w-6 h-6 text-[#0FA37F]" />
              صندوق طلبات الموافقة والاعتماد (Approvals Workplace - SBWP)
            </h1>
            <p className="text-xs text-[#64748B] mt-1">
              إدارة واعتماد المعاملات المعلقة (أوامر الشراء، طلبات المواد، العقود، الاستبعاد، سندات الصرف) وفق الصلاحيات الممنوحة.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={loadRequests}>
              <RefreshCw className="w-4 h-4 me-1.5" />
              تحديث
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5EAF2] pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setFilterTab('my_pending')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterTab === 'my_pending'
                ? 'bg-[#0FA37F] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100'
            }`}
          >
            <span>بانتظار موافقتي</span>
            {myPendingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white font-mono text-[10px]">
                {myPendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setFilterTab('pending')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterTab === 'pending'
                ? 'bg-[#0FA37F] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100'
            }`}
          >
            <span>كافة الطلبات المعلقة</span>
          </button>

          <button
            onClick={() => setFilterTab('completed')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterTab === 'completed'
                ? 'bg-[#0FA37F] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100'
            }`}
          >
            <span>الطلبات المنجزة (معتمدة / مرفوضة)</span>
          </button>

          <button
            onClick={() => setFilterTab('all')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterTab === 'all'
                ? 'bg-[#0FA37F] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100'
            }`}
          >
            <span>الكل ({requests.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Doc Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs py-1.5 px-2.5 rounded-xl border border-[#E5EAF2] bg-white font-medium text-[#0F172A]"
          >
            <option value="ALL">كافة أنواع المستندات</option>
            <option value="PO">أوامر الشراء (PO)</option>
            <option value="PR">طلبات الشراء (PR)</option>
            <option value="CONTRACT">عقود التوريد (Contract)</option>
            <option value="DISPOSAL">استبعاد الأصول (Disposal)</option>
            <option value="PAYMENT">سندات الصرف (Payment)</option>
          </select>

          {/* Search Input */}
          <div className="w-48 sm:w-60">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث برقم المستند أو الطالب..."
              startIcon={<Search className="w-3.5 h-3.5 text-[#64748B]" />}
            />
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <Card>
        {isLoading ? (
          <div className="p-12 text-center text-xs text-[#64748B]">جارٍ تحميل الطلبات...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#64748B] space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="font-semibold text-[#0F172A]">لا توجد طلبات اعتماد مطابقة في هذا التصنيف.</p>
            <p className="text-[11px] text-slate-400">لقد تمت معالجة كافة طلبات الاعتماد بنجاح.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-[#E5EAF2] bg-[#F4F7FB] text-[#64748B]">
                  <th className="py-3 px-4 text-start font-semibold">رقم المستند</th>
                  <th className="py-3 px-4 text-start font-semibold">النوع</th>
                  <th className="py-3 px-4 text-start font-semibold">المبلغ الإجمالي</th>
                  <th className="py-3 px-4 text-start font-semibold">مقدم الطلب</th>
                  <th className="py-3 px-4 text-start font-semibold">تاريخ التقديم</th>
                  <th className="py-3 px-4 text-start font-semibold">المرحلة الحالية</th>
                  <th className="py-3 px-4 text-start font-semibold">الحالة</th>
                  <th className="py-3 px-4 text-center font-semibold">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF2]">
                {filteredRequests.map((req) => {
                  const currentStepObj = req.steps[req.currentStep - 1];
                  const canAct =
                    req.status === 'pending' &&
                    (user?.roleCode === currentStepObj?.roleCode || user?.roleCode === 'ADMIN');

                  return (
                    <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#0B2545]">
                        {req.documentNumber}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="in_progress">{req.documentType}</Badge>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-[#0FA37F]">
                        {req.amount.toLocaleString()} {req.currency}
                      </td>
                      <td className="py-3 px-4 text-[#0F172A]">{req.requesterUserName}</td>
                      <td className="py-3 px-4 text-[#64748B] font-mono">
                        {req.createdAt.slice(0, 10)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-[#0F172A] font-medium">
                          {currentStepObj?.roleName || 'مكتمل'}
                        </div>
                        <div className="text-[10px] text-[#64748B] font-mono">
                          المرحلة {req.currentStep} من {req.steps.length}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {req.status === 'approved' ? (
                          <Badge variant="approved">معتمد بالكامل</Badge>
                        ) : req.status === 'rejected' ? (
                          <Badge variant="rejected">مرفوض</Badge>
                        ) : (
                          <Badge variant="pending">بانتظار الاعتماد</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          variant={canAct ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => handleOpenActionModal(req)}
                        >
                          {canAct ? 'معاينة واعتماد' : 'استعراض المسار'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Review & Action Modal */}
      {selectedRequest && (
        <Modal
          isOpen={Boolean(selectedRequest)}
          onClose={() => setSelectedRequest(null)}
          title={`استعراض واعتماد المستند: ${selectedRequest.documentNumber}`}
          size="lg"
        >
          <div className="space-y-4" dir="rtl">
            {/* Document Header Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-[#F4F7FB] border border-[#E5EAF2] rounded-xl text-xs">
              <div>
                <span className="text-[#64748B] block">نوع المستند:</span>
                <span className="font-bold text-[#0F172A]">{selectedRequest.documentType}</span>
              </div>
              <div>
                <span className="text-[#64748B] block">القيمة الإجمالية:</span>
                <span className="font-mono font-bold text-[#0FA37F]">
                  {selectedRequest.amount.toLocaleString()} {selectedRequest.currency}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">مقدم الطلب:</span>
                <span className="font-medium text-[#0F172A]">{selectedRequest.requesterUserName}</span>
              </div>
              <div>
                <span className="text-[#64748B] block">حالة الطلب:</span>
                <span className="font-bold">
                  {selectedRequest.status === 'approved'
                    ? 'معتمد'
                    : selectedRequest.status === 'rejected'
                    ? 'مرفوض'
                    : 'قيد المراجعة'}
                </span>
              </div>
            </div>

            {/* Visual Approval Chain */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-[#0FA37F]" />
                <span>سلسلة مراحل الاعتماد ومحاضر الموافقات:</span>
              </h4>

              <div className="space-y-2">
                {selectedRequest.steps.map((st, i) => (
                  <div
                    key={st.stepNumber}
                    className={`p-3 rounded-xl border transition-all text-xs flex items-center justify-between ${
                      st.status === 'approved'
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                        : st.status === 'rejected'
                        ? 'bg-red-50/70 border-red-200 text-red-950'
                        : i === selectedRequest.currentStep - 1 && selectedRequest.status === 'pending'
                        ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/20'
                        : 'bg-slate-50 border-[#E5EAF2] text-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold font-mono text-xs ${
                          st.status === 'approved'
                            ? 'bg-emerald-600 text-white'
                            : st.status === 'rejected'
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {st.status === 'approved' ? (
                          <Check className="w-4 h-4" />
                        ) : st.status === 'rejected' ? (
                          <X className="w-4 h-4" />
                        ) : (
                          st.stepNumber
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-[#0F172A]">
                          المرحلة {st.stepNumber}: {st.roleName}
                        </div>
                        {st.approverUserName && (
                          <div className="text-[11px] text-[#64748B]">
                            بواسطة: {st.approverUserName} ({st.actionDate?.slice(0, 16).replace('T', ' ')})
                          </div>
                        )}
                        {st.comment && (
                          <div className="text-[11px] text-slate-600 italic mt-0.5">
                            &quot;{st.comment}&quot;
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      {st.status === 'approved' && <Badge variant="approved">معتمد</Badge>}
                      {st.status === 'rejected' && <Badge variant="rejected">مرفوض</Badge>}
                      {st.status === 'pending' && <Badge variant="pending">بانتظار الإجراء</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Approver Action Panel */}
            {selectedRequest.status === 'pending' ? (
              <div className="p-3 bg-slate-50 border border-[#E5EAF2] rounded-xl space-y-3">
                <label className="block text-xs font-semibold text-[#0F172A]">
                  ملاحظات الاعتماد / سبب الرفض (Comment)
                </label>
                <textarea
                  value={actionComment}
                  onChange={(e) => setActionComment(e.target.value)}
                  placeholder="أدخل أي ملاحظات فنية أو إدارية توثق سبب الموافقة أو الرفض في سجل التدقيق..."
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-xl border border-[#E5EAF2] bg-white focus:outline-hidden focus:border-[#0FA37F]"
                />

                <div className="flex items-center justify-between pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowPrintModal(true)}
                  >
                    <Printer className="w-4 h-4 me-1.5" />
                    معاينة الطباعة الرسمية
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setSelectedRequest(null)}
                    >
                      إغلاق
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={isProcessing}
                      onClick={() => handleProcessAction('reject')}
                    >
                      <XCircle className="w-4 h-4 me-1.5" />
                      رفض الطلب
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      disabled={isProcessing}
                      onClick={() => handleProcessAction('approve')}
                    >
                      <CheckCircle2 className="w-4 h-4 me-1.5" />
                      موافقة واعتماد
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowPrintModal(true)}
                >
                  <Printer className="w-4 h-4 me-1.5" />
                  معاينة الطباعة الرسمية
                </Button>
                <Button variant="secondary" onClick={() => setSelectedRequest(null)}>
                  إغلاق
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Official Print Layout Modal */}
      {selectedRequest && (
        <PrintDocumentModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          documentType={getPrintDocType(selectedRequest.documentType)}
          documentNumber={selectedRequest.documentNumber}
          partyName={selectedRequest.requesterUserName}
          date={selectedRequest.createdAt?.slice(0, 10)}
          total={selectedRequest.amount}
          currency={selectedRequest.currency}
          notes={`طلب اعتماد مالي رقم: ${selectedRequest.documentNumber} - مقدم من: ${selectedRequest.requesterUserName}`}
          items={[
            {
              code: selectedRequest.documentNumber,
              description: `مستند اعتماد ${selectedRequest.documentType} - القيمة الإجمالية المصرح بها`,
              quantity: 1,
              unit: 'EA',
              unitPrice: selectedRequest.amount / 1.15,
              total: selectedRequest.amount / 1.15,
            },
          ]}
        />
      )}
    </div>
  );
};
