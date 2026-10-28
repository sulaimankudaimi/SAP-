import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ShieldAlert, RefreshCw, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../core/auth/useAuthStore';
import { RbacService, SYSTEM_ROLES } from '../../core/services/RbacService';
import { useIntegrityScheduler } from '../../core/hooks/useIntegrityScheduler';
import { formatDateTime } from '../../core/utils/format';

export const IntegrityAlertBanner: React.FC = () => {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);
  const isAdmin = Boolean(
    role &&
      (role.code === SYSTEM_ROLES.ADMIN ||
        RbacService.hasPermission(role, { module: 'SYS', activity: 'view' }))
  );

  const { lastRun, isOverdue, hasViolations, isRunning, runNow } = useIntegrityScheduler();

  if (!isAdmin) {
    return null;
  }

  // If no violations and not overdue, show nothing
  if (!hasViolations && !isOverdue) {
    return null;
  }

  const formatRunTime = (iso?: string) => {
    if (!iso) return 'لم يتم بعد';
    try {
      return formatDateTime(iso);
    } catch {
      return iso;
    }
  };

  return (
    <div
      dir="rtl"
      className={`rounded-[16px] border p-4 mb-6 shadow-sm transition-all ${
        hasViolations
          ? 'bg-red-50/90 border-red-200 text-red-950'
          : 'bg-amber-50/90 border-amber-200 text-amber-950'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-xl mt-0.5 sm:mt-0 ${
              hasViolations ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {hasViolations ? (
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-[15px]">
                {hasViolations
                  ? 'تنبيه سلامة البيانات: تم رصد مخالفات في محددات النظام'
                  : 'تحذير تشغيلي: فحص سلامة البيانات متأخر (أكثر من 24 ساعة)'}
              </h4>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  hasViolations
                    ? 'bg-red-200/80 text-red-900'
                    : 'bg-amber-200/80 text-amber-900'
                }`}
              >
                {hasViolations
                  ? `${lastRun?.totalViolations ?? 1} مخالفة رُصدت`
                  : 'مطلوب للمعيار اليومي'}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              {hasViolations
                ? `أظهر الفحص الأخير المنفذ بتاريخ (${formatRunTime(
                    lastRun?.timestamp
                  )}) وجود مخالفات في محددات ADR أو سجل التدقيق. يرجى المراجعة الفورية لضمان عدم تأثر المعيار الإنتاجي.`
                : `لم يُسجل تشغيل لفاحص سلامة البيانات ومطابقة الأستاذ العام خلال الـ 24 ساعة الماضية. آخر فحص: (${formatRunTime(
                    lastRun?.timestamp
                  )}).`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
          <button
            type="button"
            disabled={isRunning}
            onClick={() => void runNow()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition shadow-xs text-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'جارِ الفحص...' : 'فحص الآن'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/integrity')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg text-white transition shadow-xs ${
              hasViolations
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            <span>تقرير السلامة</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
