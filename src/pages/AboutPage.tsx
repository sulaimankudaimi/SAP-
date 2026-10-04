import React from 'react';
import {
  Info,
  ShieldCheck,
  Keyboard,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';

interface ShortcutItem {
  keys: string[];
  action: string;
  category: string;
}

const SHORTCUTS: ShortcutItem[] = [
  { keys: ['Ctrl', 'K'], action: 'فتح لوحة الأوامر الموحدة والتنقل السريع (Command Palette)', category: 'التنقل العام' },
  { keys: ['Alt', 'H'], action: 'الانتقال إلى لوحة المعلومات والتحليلات الرئيسية', category: 'التنقل العام' },
  { keys: ['Alt', 'M'], action: 'فتح سجل المواد وإدارة الأصناف (SAP MM)', category: 'الموديولات' },
  { keys: ['Alt', 'W'], action: 'فتح شاشة أرصدة ومستودعات الطاقة (SAP WM)', category: 'الموديولات' },
  { keys: ['Alt', 'F'], action: 'قمرة القيادة المالية والحسابات العامة (SAP FI/CO)', category: 'الموديولات' },
  { keys: ['Alt', 'A'], action: 'سجل الأصول الثابتة ومحطات الضخ (SAP AM)', category: 'الموديولات' },
  { keys: ['Alt', 'T'], action: 'إدارة أسطول صهاريج وشاحنات النقل (SAP TM)', category: 'الموديولات' },
  { keys: ['Alt', 'R'], action: 'مركز التقارير والاستعلامات الذكية', category: 'الموديولات' },
  { keys: ['Esc'], action: 'إغلاق النوافذ المنبثقة واللوحات الجانبية المفتوحة', category: 'النوافذ والحوارات' },
  { keys: ['Tab'], action: 'التنقل التتابعي للأمام بين الحقول والأزرار', category: 'إمكانية الوصول' },
  { keys: ['Shift', 'Tab'], action: 'التنقل التتابعي للخلف بين الحقول والأزرار', category: 'إمكانية الوصول' },
  { keys: ['Space'], action: 'تحديد الخيارات والمربعات في الجداول', category: 'إمكانية الوصول' },
];

export const AboutPage: React.FC = () => {
  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div>
        <Breadcrumbs
          items={[
            { label: 'الرئيسية', path: '/' },
            { label: 'حول النظام واختصارات لوحة المفاتيح' },
          ]}
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#0F172A] flex items-center gap-2.5">
              <Info className="w-6 h-6 text-[#0FA37F]" />
              عن نظام طاقة الخليج (About Gulf Energy ERP)
            </h1>
            <p className="text-xs text-[#64748B] mt-1">
              نظام تخطيط موارد المؤسسات لقطاع الطاقة واللوجستيات البترولية — الإصدار المؤسسي المكتبي v2.4.0.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#0FA37F] border border-emerald-200 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" />
              100% يعمل بدون اتصال بالإنترنت
            </span>
          </div>
        </div>
      </div>

      {/* System Specifications Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card header="بيانات الإصدار والإنتاج">
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-[#E5EAF2]">
              <span className="text-[#64748B]">إصدار البرنامج (Release):</span>
              <span className="font-mono font-bold text-[#0F172A]">v2.4.0 (Enterprise)</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-[#E5EAF2]">
              <span className="text-[#64748B]">تاريخ البناء (Build Date):</span>
              <span className="font-mono text-[#0F172A]">2026-10-04</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-[#E5EAF2]">
              <span className="text-[#64748B]">البيئة المستهدفة:</span>
              <span className="text-[#0F172A] font-medium">Electron Desktop / Web Offline</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[#64748B]">معمارية التخزين:</span>
              <span className="text-[#0F172A] font-medium">Dexie IndexedDB (Zero Cloud)</span>
            </div>
          </div>
        </Card>

        <Card header="التوافقية المعيارية SAP S/4HANA">
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-[#0F172A]">
              <CheckCircle2 className="w-4 h-4 text-[#0FA37F]" />
              <span>إدارة المواد والمشتريات (SAP MM)</span>
            </div>
            <div className="flex items-center gap-2 text-[#0F172A]">
              <CheckCircle2 className="w-4 h-4 text-[#0FA37F]" />
              <span>إدارة المستودعات وحركات MIGO (SAP WM)</span>
            </div>
            <div className="flex items-center gap-2 text-[#0F172A]">
              <CheckCircle2 className="w-4 h-4 text-[#0FA37F]" />
              <span>المحاسبة المالية والرقابة FB50/FB60 (FI/CO)</span>
            </div>
            <div className="flex items-center gap-2 text-[#0F172A]">
              <CheckCircle2 className="w-4 h-4 text-[#0FA37F]" />
              <span>سجل الأصول الثابتة والاستهلاك (SAP AM)</span>
            </div>
            <div className="flex items-center gap-2 text-[#0F172A]">
              <CheckCircle2 className="w-4 h-4 text-[#0FA37F]" />
              <span>إدارة أسطول صهاريج الوقود (SAP TM)</span>
            </div>
          </div>
        </Card>

        <Card header="معايير الأمان والخصوصية">
          <div className="space-y-3 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-[#E5EAF2] flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-[#0B2545] shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#64748B] leading-relaxed">
                جميع البيانات المالية والتشغيلية مخزنة محلياً بالكامل ولا تغادر جهاز المستخدم نهائياً.
              </p>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[#E5EAF2]">
              <span className="text-[#64748B]">تشفير كلمات المرور:</span>
              <span className="font-mono text-[#0F172A]">Salted PBKDF2 (SHA-256)</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-[#64748B]">التحكم بالصلاحيات:</span>
              <span className="text-[#0FA37F] font-semibold">RBAC + Auth Objects</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Keyboard Shortcuts Cheat Sheet */}
      <Card
        header={
          <div>
            <div className="font-bold text-[#0F172A]">دليل اختصارات لوحة المفاتيح (Keyboard Shortcuts Cheat Sheet)</div>
            <div className="text-xs text-[#64748B] font-normal mt-0.5">استخدم لوحة المفاتيح للتنقل الفائق والإدخال السريع بدون استخدام الفأرة</div>
          </div>
        }
        action={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F4F7FB] border border-[#E5EAF2] text-xs font-mono text-[#0F172A]">
            <Keyboard className="w-3.5 h-3.5 text-[#0FA37F]" />
            Alt / Ctrl Shortcuts
          </span>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SHORTCUTS.map((item, idx) => (
            <div
              key={idx}
              className="p-3 bg-[#F4F7FB] border border-[#E5EAF2] rounded-xl flex items-center justify-between gap-3 hover:bg-white hover:border-[#0FA37F]/40 transition-colors"
            >
              <div className="space-y-0.5 flex-1">
                <div className="text-xs font-semibold text-[#0F172A]">{item.action}</div>
                <div className="text-[10px] text-[#64748B]">{item.category}</div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {item.keys.map((k, kIdx) => (
                  <kbd
                    key={kIdx}
                    className="px-2 py-1 text-[11px] font-mono font-bold bg-white text-[#0F172A] border border-[#cbd5e1] rounded-md shadow-xs"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
