import React, { useState } from 'react';
import { Breadcrumbs } from '../ui/Breadcrumbs';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { ScreenSkeleton } from '../ui/Skeleton';
import { StatusChip } from '../ui/Badge';
import { BreadcrumbItem } from '../../types';
import { Plus, RefreshCw, Eye, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { t } from '../../i18n/ar';

export interface PlaceholderPageProps {
  title: string;
  subtitle?: string;
  moduleName: string;
  breadcrumbs: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title,
  subtitle,
  moduleName,
  breadcrumbs,
  actions,
}) => {
  const [viewState, setViewState] = useState<'content' | 'skeleton' | 'empty' | 'error'>('content');

  return (
    <div className="space-y-6">
      {/* Breadcrumbs & Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 text-start">
          <Breadcrumbs items={breadcrumbs} />
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">{title}</h1>
            <StatusChip variant="in_progress">
              {moduleName}
            </StatusChip>
          </div>
          <p className="text-xs text-[#64748B]">
            {subtitle || t('placeholder_notice')}
          </p>
        </div>

        {/* Action Buttons & State Switcher for Verification */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-white border border-[#E5EAF2] rounded-xl p-1 flex items-center text-xs">
            <button
              onClick={() => setViewState('content')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                viewState === 'content' ? 'bg-[#0FA37F] text-white' : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              عرض الشاشة
            </button>
            <button
              onClick={() => setViewState('skeleton')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                viewState === 'skeleton' ? 'bg-[#0FA37F] text-white' : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Skeleton
            </button>
            <button
              onClick={() => setViewState('empty')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                viewState === 'empty' ? 'bg-[#0FA37F] text-white' : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Empty State
            </button>
            <button
              onClick={() => setViewState('error')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                viewState === 'error' ? 'bg-[#EF4444] text-white' : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Error State
            </button>
          </div>

          {actions ? (
            actions
          ) : (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
            >
              {t('action_create')}
            </Button>
          )}
        </div>
      </div>

      {/* Screen Body depending on view state */}
      {viewState === 'skeleton' && <ScreenSkeleton />}

      {viewState === 'empty' && (
        <EmptyState
          title={`لا توجد سجلات حالية في ${title}`}
          description="لم يتم إدخال أي مستندات أو حركات في هذا القسم حتى الآن. انقر على زر إنشاء مستند جديد لبدء دورة العمل."
          action={
            <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}>
              إضافة أول سجل
            </Button>
          }
        />
      )}

      {viewState === 'error' && (
        <div className="p-8 bg-white rounded-2xl border border-red-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#EF4444] flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#0F172A]">تعذر تحميل بيانات {title}</h3>
          <p className="text-xs text-[#64748B] max-w-md mx-auto">
            حدث خطأ أثناء محاولة جلب السجلات من قاعدة البيانات المحلية (Dexie Repository). يرجى المحاولة مرة أخرى.
          </p>
          <Button variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={() => setViewState('content')}>
            إعادة المحاولة
          </Button>
        </div>
      )}

      {viewState === 'content' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-[#64748B]">
                <span>حالة الوحدة</span>
                <StatusChip variant="approved">مهيأة معمارياً</StatusChip>
              </div>
              <div className="text-lg font-bold text-[#0F172A]">جاهزة للمرحلة الثانية</div>
              <p className="text-[11px] text-[#64748B]">
                المسار مسجل في نظام التوجيه HashRouter ومتوافق مع وضع عدم الاتصال (Offline).
              </p>
            </Card>

            <Card className="p-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-[#64748B]">
                <span>المستندات المحاسبية</span>
                <span className="font-mono text-xs text-[#2563EB]">DocFlow Ready</span>
              </div>
              <div className="text-lg font-bold text-[#0F172A]">الترقيم الآلي وسجل التدقيق</div>
              <p className="text-[11px] text-[#64748B]">
                مهيأ لاستقبال المعرف id، رقم المستند docNumber، وتدقيق التغييرات AuditLog.
              </p>
            </Card>

            <Card className="p-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-[#64748B]">
                <span>الصلاحيات والحماية</span>
                <StatusChip variant="in_progress">RBAC Guard</StatusChip>
              </div>
              <div className="text-lg font-bold text-[#0F172A]">تحقق الصلاحيات الصارم</div>
              <p className="text-[11px] text-[#64748B]">
                محمي على مستوى الواجهة والخدمات (Services Guard & UI Disable).
              </p>
            </Card>
          </div>

          <Card
            header={
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0FA37F]" />
                <span>دليل تشغيل الوحدة وفق معايير SAP S/4HANA</span>
              </div>
            }
          >
            <div className="space-y-3 text-xs text-[#0F172A] leading-relaxed">
              <div className="p-3 rounded-xl bg-[#F4F7FB] border border-[#E5EAF2] flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#0FA37F] shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-xs font-bold text-[#0F172A]">الهيكلية الصارمة</strong>
                  <span>
                    ستقوم الخدمات في <code className="font-mono text-emerald-700 bg-emerald-50 px-1 rounded">/src/core/services</code> بإدارة كافة المعاملات والحركات المالية والمخزنية دون تضمين أي منطق أعمال داخل مكونات العرض.
                  </span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#F4F7FB] border border-[#E5EAF2] flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#0FA37F] shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-xs font-bold text-[#0F172A]">استقلالية قاعدة البيانات</strong>
                  <span>
                    التعامل مع البيانات يتم عبر نمط المستودعات <code className="font-mono text-blue-700 bg-blue-50 px-1 rounded">Repository Interface</code> لتمكين الاستبدال السلس لـ SQLite مستقبلاً.
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
