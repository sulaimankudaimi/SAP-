import React, { useEffect, useState } from 'react';
import { History, Clock, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { MasterDataService } from '../services/MasterDataService';
import type { AuditLog } from '../../../types/models';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { formatDate } from '../../../core/utils';

export interface AuditHistoryTabProps {
  entity: string;
  entityId: string;
}

export const AuditHistoryTab: React.FC<AuditHistoryTabProps> = ({ entity, entityId }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadLogs() {
      try {
        setLoading(true);
        const data = await MasterDataService.getChangeHistory(entity, entityId);
        if (mounted) setLogs(data);
      } catch (err) {
        console.error('Failed to load audit logs:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadLogs();
    return () => {
      mounted = false;
    };
  }, [entity, entityId]);

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton variant="rectangular" height={70} />
        <Skeleton variant="rectangular" height={70} />
        <Skeleton variant="rectangular" height={70} />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <EmptyState
        icon={<History className="w-12 h-12 text-slate-400" />}
        title="لا توجد سجلات تعديل سابقة"
        description="لم يتم تسجيل أي تعديلات أو تغييرات حالة لهذا السجل حتى الآن. يتم تسجيل كافة العمليات آلياً."
      />
    );
  }

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <Badge variant="approved">إنشاء سجل (Create)</Badge>;
      case 'UPDATE':
        return <Badge variant="in_progress">تعديل بيانات (Update)</Badge>;
      case 'STATUS_CHANGE':
        return <Badge variant="in_review">تغيير حالة (Status)</Badge>;
      case 'DELETE':
        return <Badge variant="critical">حذف / إلغاء (Delete)</Badge>;
      case 'LOGIN':
        return <Badge variant="approved">تسجيل دخول (Login)</Badge>;
      case 'LOGIN_FAILED':
        return <Badge variant="critical">فشل تسجيل الدخول (Failed)</Badge>;
      case 'ACCOUNT_LOCKED':
        return <Badge variant="critical">قفل الحساب (Locked)</Badge>;
      case 'ACCOUNT_UNLOCKED':
        return <Badge variant="in_progress">إلغاء قفل الحساب (Unlocked)</Badge>;
      case 'PASSWORD_CHANGED':
        return <Badge variant="in_review">تغيير كلمة المرور (Password)</Badge>;
      default:
        return <Badge variant="closed">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-navy" />
          <h3 className="text-base font-bold text-navy">سجل التغييرات وتتبع التدقيق (Change Documents)</h3>
        </div>
        <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2.5 py-1 rounded-full">
          إجمالي الحركات: {logs.length}
        </span>
      </div>

      <div className="relative border-s-2 border-slate-200 ms-4 space-y-6">
        {logs.map((log) => {
          const beforeKeys = Object.keys(log.before || {});
          const afterKeys = Object.keys(log.after || {});
          const allChangedKeys = Array.from(new Set([...beforeKeys, ...afterKeys]));

          return (
            <div key={log.id} className="relative ms-6">
              {/* Dot */}
              <div className="absolute -start-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-navy border-2 border-white ring-2 ring-slate-200" />

              <Card className="p-4 shadow-sm border border-slate-200 hover:border-slate-300 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    {getActionBadge(log.action)}
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDate(log.timestamp, 'yyyy-MM-dd HH:mm:ss')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
                    <User className="w-3.5 h-3.5 text-navy" />
                    <span>المستخدم: <strong className="text-navy">{log.userName || log.userId}</strong></span>
                  </div>
                </div>

                {/* Diff Viewer */}
                {allChangedKeys.length > 0 ? (
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs space-y-2">
                    <div className="font-semibold text-slate-700 mb-1">الحقول المعدلة (Before / After):</div>
                    <div className="divide-y divide-slate-200">
                      {allChangedKeys.map((key) => {
                        const beforeVal = log.before ? (log.before as Record<string, unknown>)[key] : null;
                        const afterVal = log.after ? (log.after as Record<string, unknown>)[key] : null;
                        return (
                          <div key={key} className="py-1.5 grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                            <span className="font-mono text-slate-600 font-semibold">{key}</span>
                            <div className="flex items-center gap-1 bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-200">
                              <span className="text-[10px] text-red-500 font-bold">قبل:</span>
                              <span className="truncate">{beforeVal !== undefined && beforeVal !== null ? String(beforeVal) : '—'}</span>
                            </div>
                            <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                              <ArrowRight className="w-3 h-3 text-emerald-600" />
                              <span className="text-[10px] text-emerald-600 font-bold">بعد:</span>
                              <span className="truncate font-semibold">{afterVal !== undefined && afterVal !== null ? String(afterVal) : '—'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    تم تسجيل العملية في سجل التدقيق المعتمد للنظام.
                  </div>
                )}
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
};
