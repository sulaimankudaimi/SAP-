import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ShoppingCart,
  Boxes,
  Truck,
  Building2,
  Landmark,
  Database,
  BarChart3,
  ShieldCheck,
  ArrowRight,
  FileCode,
  X,
} from 'lucide-react';
import { t } from '../../i18n/ar';
import { cn } from '../../core/utils';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  category: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const commands: CommandItem[] = [
  { id: 'home', title: 'لوحة التحكم الرئيسية', category: 'الرئيسية', path: '/', icon: BarChart3 },
  { id: 'pr', title: 'طلبات الشراء (Purchase Requisitions)', category: 'المشتريات', path: '/procurement/pr', icon: ShoppingCart },
  { id: 'po', title: 'أوامر الشراء (Purchase Orders)', category: 'المشتريات', path: '/procurement/po', icon: ShoppingCart },
  { id: 'rfq', title: 'عروض الأسعار (RFQ)', category: 'المشتريات', path: '/procurement/rfq', icon: ShoppingCart },
  { id: 'stock', title: 'أرصدة المخزون وحركات المستودعات', category: 'المخزون', path: '/inventory/stock', icon: Boxes },
  { id: 'warehouse-dash', title: 'لوحة تحكم المستودعات والمخطط 3D وRFID', category: 'المخزون', path: '/inventory', icon: Boxes },
  { id: 'movements', title: 'حركات المواد (Goods Movements - MIGO)', category: 'المخزون', path: '/inventory/movements', icon: Boxes },
  { id: 'physical-inv', title: 'الجرد الفعلي ومطابقة الفروقات (Physical Inventory - MI01)', category: 'المخزون', path: '/inventory/physical', icon: Boxes },
  { id: 'reorder-engine', title: 'محرك إعادة الطلب وتحليل الرواكد وABC/XYZ', category: 'المخزون', path: '/inventory/reorder', icon: Boxes },
  { id: 'vehicles', title: 'أسطول الصهاريج والشاحنات', category: 'الأسطول', path: '/fleet/vehicles', icon: Truck },
  { id: 'trips', title: 'رحلات نقل الوقود واللوجستيات', category: 'الأسطول', path: '/fleet/trips', icon: Truck },
  { id: 'assets', title: 'سجل الأصول الثابتة ومعدات الطاقة', category: 'الأصول', path: '/assets/register', icon: Building2 },
  { id: 'journal', title: 'القيود اليومية المحاسبية (Journal Entries)', category: 'المالية', path: '/finance/journal', icon: Landmark },
  { id: 'ap', title: 'ذمم الموردين والفواتير (AP)', category: 'المالية', path: '/finance/ap', icon: Landmark },
  { id: 'materials', title: 'سجل المواد وقطع الغيار (Material Master)', category: 'البيانات الرئيسية', path: '/master-data/materials', icon: Database },
  { id: 'vendors', title: 'سجل الموردين والمقاولين (Vendors)', category: 'البيانات الرئيسية', path: '/master-data/vendors', icon: Database },
  { id: 'customers', title: 'سجل العملاء ومحطات التوزيع (Customers)', category: 'البيانات الرئيسية', path: '/master-data/customers', icon: Database },
  { id: 'locations', title: 'المحطات ومستودعات التخزين (Locations)', category: 'البيانات الرئيسية', path: '/master-data/locations', icon: Database },
  { id: 'cost-centers', title: 'مراكز التكلفة التشغيلية (Cost Centers)', category: 'البيانات الرئيسية', path: '/master-data/cost-centers', icon: Database },
  { id: 'gl-accounts', title: 'دليل الحسابات والأستاذ العام (GL Accounts)', category: 'البيانات الرئيسية', path: '/master-data/gl-accounts', icon: Database },
  { id: 'groups', title: 'مجموعات وتصنيفات المواد (Material Groups)', category: 'البيانات الرئيسية', path: '/master-data/material-groups', icon: Database },
  { id: 'units', title: 'وحدات القياس المعيارية (Units of Measure)', category: 'البيانات الرئيسية', path: '/master-data/units', icon: Database },
  { id: 'audit', title: 'سجل التدقيق وتتبع العمليات (Audit Log)', category: 'الإدارة', path: '/admin/audit', icon: ShieldCheck },
  { id: 'rules', title: 'ملف قواعد المشروع الصارمة (/PROJECT_RULES.md)', category: 'النظام', path: '/rules', icon: FileCode },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open handled by parent or window listener
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredCommands = commands.filter(
    (c) =>
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-[#0B2545]/50 backdrop-blur-xs transition-opacity" onClick={onClose} />
      <div className="flex min-h-full items-start justify-center p-4 pt-16">
        <div
          className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-[#E5EAF2] overflow-hidden flex flex-col transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Box */}
          <div className="p-4 border-b border-[#E5EAF2] flex items-center gap-3">
            <Search className="w-5 h-5 text-[#64748B] shrink-0" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder={t('cmd_placeholder')}
              className="w-full text-sm text-[#0F172A] placeholder-[#64748B] focus:outline-none bg-transparent"
            />
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F4F7FB]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Results list */}
          <div className="p-2 max-h-96 overflow-y-auto divide-y divide-[#F4F7FB]">
            {filteredCommands.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#64748B]">
                {t('cmd_no_results')}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredCommands.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.path)}
                      className={cn(
                        'w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-start',
                        idx === selectedIndex
                          ? 'bg-[#0FA37F]/10 text-[#0FA37F]'
                          : 'text-[#0F172A] hover:bg-[#F4F7FB]'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[#F4F7FB] border border-[#E5EAF2] text-[#0B2545]">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-xs">{item.title}</div>
                          <div className="text-[10px] text-[#64748B]">{item.category}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-[#64748B] bg-slate-100 px-2 py-0.5 rounded">
                        الانتقال
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Shortcuts Guide */}
          <div className="px-4 py-2.5 bg-[#F4F7FB] border-t border-[#E5EAF2] flex items-center justify-between text-[11px] text-[#64748B]">
            <div className="flex items-center gap-3">
              <span>للإغلاق: <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#E5EAF2]">ESC</kbd></span>
              <span>للتنقل السريع: <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#E5EAF2]">Ctrl+K</kbd></span>
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold font-mono">Gulf Energy ERP Desktop</span>
          </div>
        </div>
      </div>
    </div>
  );
};
