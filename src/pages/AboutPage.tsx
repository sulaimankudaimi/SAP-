import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Info,
  ShieldCheck,
  Keyboard,
  CheckCircle2,
  Lock,
  Terminal,
  Search,
  ExternalLink,
  Filter,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { useAuthStore } from '../core/auth/useAuthStore';
import { SAP_TCODES, TCodeService } from '../core/services/TCodeService';

interface ShortcutItem {
  keys: string[];
  action: string;
  category: string;
}

const SHORTCUTS: ShortcutItem[] = [
  { keys: ['Ctrl', 'K'], action: 'فتح لوحة الأوامر الموحدة والبحث السريع (Command Palette)', category: 'التنقل العام' },
  { keys: ['Ctrl', 'N'], action: 'إنشاء سجل جديد في شاشة القائمة الحالية (New Document)', category: 'إدخال البيانات' },
  { keys: ['Ctrl', 'S'], action: 'حفظ التعديلات في النموذج المفتوح أو النافذة المنبثقة (Save)', category: 'إدخال البيانات' },
  { keys: ['F4'], action: 'فتح نافذة مساعد القيم والبحث المتقدم في الحقول المرجعية (Value Help)', category: 'مساعد الإدخال SAP' },
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
];

export const AboutPage: React.FC = () => {
  const navigate = useNavigate();
  const { role } = useAuthStore();
  const { error, info } = useToast();

  const [tcodeSearch, setTcodeSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');

  const filteredCodes = useMemo(() => {
    return SAP_TCODES.filter((item) => {
      if (selectedModule !== 'ALL' && item.module !== selectedModule) {
        return false;
      }
      if (!tcodeSearch) return true;
      const q = tcodeSearch.toLowerCase().trim();
      const matchCode = item.code.toLowerCase().includes(q);
      const matchAr = item.descriptionArabic.toLowerCase().includes(q);
      const matchEn = item.descriptionEnglish.toLowerCase().includes(q);
      const matchPath = item.path.toLowerCase().includes(q);
      return matchCode || matchAr || matchEn || matchPath;
    });
  }, [tcodeSearch, selectedModule]);

  const handleExecuteTCode = (codeStr: string) => {
    const res = TCodeService.resolveCode(codeStr, role);
    if (!res.success) {
      error('خطأ صلاحيات T-Code', res.error || 'غير مصرح بتشغيل هذه المعاملة.');
      return;
    }
    if (res.targetPath) {
      info(`تشغيل المعاملة [${res.code?.code}]`, res.code?.descriptionArabic || '');
      navigate(res.targetPath);
    }
  };
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

      {/* SAP S/4HANA Transaction Codes Directory (T-Codes) */}
      <Card
        header={
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-bold text-[#0F172A] flex items-center gap-2">
                <Terminal className="w-5 h-5 text-[#0FA37F]" />
                <span>دليل رموز معاملات SAP S/4HANA (Transaction Codes Directory)</span>
              </div>
              <div className="text-xs text-[#64748B] font-normal mt-0.5">
                فهرس شامل لكافة معاملات النظام المتاحة عبر شريط الأوامر العلوي (T-Code Bar) مع مطابقة الصلاحيات
              </div>
            </div>
            <Badge variant="in_progress">{filteredCodes.length} معاملة مسجلة</Badge>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
              {[
                { id: 'ALL', label: 'كافة المعاملات' },
                { id: 'MM', label: 'المشتريات (MM)' },
                { id: 'WM', label: 'المخزون (WM)' },
                { id: 'MD', label: 'البيانات الرئيسية (MD)' },
                { id: 'FI', label: 'المالية (FI)' },
                { id: 'CO', label: 'التكاليف (CO)' },
                { id: 'AM', label: 'الأصول (AM)' },
                { id: 'TM', label: 'الأسطول (TM)' },
                { id: 'ADM', label: 'النظام (ADM)' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedModule(m.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                    selectedModule === m.id
                      ? 'bg-[#0FA37F] text-white shadow-xs'
                      : 'bg-[#F4F7FB] text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-72">
              <Input
                value={tcodeSearch}
                onChange={(e) => setTcodeSearch(e.target.value)}
                placeholder="بحث برمز المعاملة أو الوصف..."
                startIcon={<Search className="w-3.5 h-3.5 text-[#64748B]" />}
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-[#E5EAF2]">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="bg-[#F4F7FB] text-[#64748B] border-b border-[#E5EAF2]">
                  <th className="py-2.5 px-3 text-start font-semibold">رمز المعاملة (T-Code)</th>
                  <th className="py-2.5 px-3 text-start font-semibold">الوحدة (Module)</th>
                  <th className="py-2.5 px-3 text-start font-semibold">الوصف المعياري بالعربية</th>
                  <th className="py-2.5 px-3 text-start font-semibold">SAP Standard Name</th>
                  <th className="py-2.5 px-3 text-start font-semibold">المسار (Route)</th>
                  <th className="py-2.5 px-3 text-center font-semibold">تشغيل سريع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF2]">
                {filteredCodes.map((tc) => (
                  <tr key={tc.code} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold text-xs bg-slate-100 text-[#0B2545] px-2 py-0.5 rounded border border-[#E5EAF2]">
                        {tc.code}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge variant="neutral">{tc.module}</Badge>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-[#0F172A]">{tc.descriptionArabic}</td>
                    <td className="py-2.5 px-3 font-mono text-[#64748B]">{tc.descriptionEnglish}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{tc.path}</td>
                    <td className="py-2.5 px-3 text-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleExecuteTCode(tc.code)}
                        className="text-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5 me-1" />
                        تشغيل
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
};
