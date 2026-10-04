import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Bell,
  Settings,
  Building,
  Calendar,
  LogOut,
  ChevronDown,
  MapPin,
  Sliders,
  Shield,
  Activity,
  UserCheck,
} from 'lucide-react';
import { t } from '../../i18n/ar';
import { NotificationItem } from '../../types';
import { useToast } from '../ui/Toast';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAuthStore } from '../../core/auth/useAuthStore';

export interface HeaderProps {
  onOpenCommandPalette: () => void;
}

const mockNotifications: NotificationItem[] = [
  {
    id: 'n1',
    title: 'طلب اعتماد جديد لأمر الشراء PO-2026-000042',
    time: 'منذ 10 دقائق',
    unread: true,
    type: 'procurement',
  },
  {
    id: 'n2',
    title: 'استلام صهريج وقود ديزل Euro 5 بمحطة ينبع (MIGO 101)',
    time: 'منذ ساعة',
    unread: true,
    type: 'inventory',
  },
  {
    id: 'n3',
    title: 'اكتمال فحص السلامة الوقائية لأسطول النقل (الرياض)',
    time: 'منذ 3 ساعات',
    unread: false,
    type: 'system',
  },
];

export const Header: React.FC<HeaderProps> = ({ onOpenCommandPalette }) => {
  const navigate = useNavigate();
  const { success } = useToast();
  const { user, role, logout, recordActivity } = useAuthStore();

  // Record activity on interactions for idle timeout
  useEffect(() => {
    const handleActivity = () => recordActivity();
    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, [recordActivity]);

  // Context Switcher State (Company / Plant / Fiscal Year)
  const [companyCode, setCompanyCode] = useState(user?.companyCode || '1000');
  const [plantCode, setPlantCode] = useState(user?.plantCode || '1100');
  const [fiscalYear, setFiscalYear] = useState('2026');

  const [showContextModal, setShowContextModal] = useState(false);
  const [tempCompany, setTempCompany] = useState(companyCode);
  const [tempPlant, setTempPlant] = useState(plantCode);
  const [tempYear, setTempYear] = useState(fiscalYear);

  // Dropdown States
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState(mockNotifications);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const handleSaveContext = () => {
    setCompanyCode(tempCompany);
    setPlantCode(tempPlant);
    setFiscalYear(tempYear);
    setShowContextModal(false);
    success(t('context_saved'), `الشركة: ${tempCompany} | المحطة: ${tempPlant} | السنة: ${tempYear}`);
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const displayName = user?.fullName || 'م. أحمد الشمري';
  const displayRole = role?.name || 'مدير النظام (Admin)';
  const initials = displayName
    .split(' ')
    .filter((p) => !p.startsWith('م.') && !p.startsWith('أ.'))
    .slice(0, 2)
    .map((p) => p[0])
    .join('') || 'أ.ش';

  return (
    <>
      <header className="h-16 bg-white border-b border-[#E5EAF2] px-6 flex items-center justify-between sticky top-0 z-20">
        {/* Global Search Input trigger for Command Palette */}
        <div className="flex-1 max-w-md">
          <button
            onClick={onOpenCommandPalette}
            className="w-full flex items-center justify-between bg-[#F4F7FB] hover:bg-slate-100 border border-[#E5EAF2] rounded-xl px-3.5 py-2 text-xs text-[#64748B] transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <Search className="w-4 h-4 text-[#64748B] group-hover:text-[#0FA37F] transition-colors" />
              <span>{t('cmd_placeholder')}</span>
            </div>
            <kbd className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] bg-white border border-[#E5EAF2] text-[#64748B] px-1.5 py-0.5 rounded shadow-xs">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center gap-3">
          {/* SAP Context Switcher (Company / Plant / Fiscal Year) */}
          <button
            onClick={() => setShowContextModal(true)}
            className="hidden md:flex items-center gap-2 bg-[#F4F7FB] hover:bg-[#E5EAF2]/70 border border-[#E5EAF2] px-3 py-1.5 rounded-xl text-xs text-[#0F172A] transition-all cursor-pointer"
            title="تبديل سياق الشركة / المحطة / السنة المالية"
          >
            <Building className="w-3.5 h-3.5 text-[#0FA37F]" />
            <span className="font-semibold">{companyCode}</span>
            <span className="text-slate-300">|</span>
            <MapPin className="w-3.5 h-3.5 text-[#2563EB]" />
            <span className="font-semibold">{plantCode}</span>
            <span className="text-slate-300">|</span>
            <Calendar className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span className="font-mono font-bold">{fiscalYear}</span>
            <ChevronDown className="w-3 h-3 text-[#64748B]" />
          </button>

          {/* Quick link to /admin/dev verification cockpit */}
          <button
            onClick={() => navigate('/admin/dev')}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition-colors"
            title="لوحة التحقق الفني للمحرك وقاعدة البيانات"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>لوحة فحص المحرك</span>
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowUserMenu(false);
              }}
              className="relative p-2 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-[#F4F7FB] transition-colors cursor-pointer"
              title={t('notifications_title')}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 end-1.5 w-4 h-4 bg-[#EF4444] text-white rounded-full text-[9px] font-bold font-mono flex items-center justify-center ring-2 ring-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute end-0 mt-2 w-80 sm:w-96 bg-white border border-[#E5EAF2] rounded-2xl shadow-xl p-4 z-40 text-start animate-in fade-in-50">
                <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF2]">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-[#0F172A]">{t('notifications_title')}</h4>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 bg-[#0FA37F]/10 text-[#0FA37F] text-[10px] font-bold rounded-full">
                        {unreadCount} جديد
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-[#0FA37F] hover:underline font-semibold"
                    >
                      {t('notifications_mark_read')}
                    </button>
                  )}
                </div>

                <div className="divide-y divide-[#E5EAF2] max-h-72 overflow-y-auto my-2">
                  {notifications.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 space-y-1 transition-colors hover:bg-[#F4F7FB] rounded-lg ${
                        item.unread ? 'bg-[#0FA37F]/5' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-[#0F172A] leading-snug">
                          {item.title}
                        </span>
                        {item.unread && (
                          <span className="w-2 h-2 rounded-full bg-[#0FA37F] shrink-0 ms-2" />
                        )}
                      </div>
                      <span className="text-[10px] text-[#64748B] block">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Settings Icon */}
          <button
            onClick={() => setShowContextModal(true)}
            className="p-2 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-[#F4F7FB] transition-colors cursor-pointer"
            title="إعدادات السياق والتشغيل"
          >
            <Settings className="w-5 h-5" />
          </button>

          <div className="h-6 w-px bg-[#E5EAF2] mx-1" />

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowNotifications(false);
              }}
              className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-[#F4F7FB] transition-all cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-[#0B2545] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {initials}
              </div>
              <div className="hidden lg:block text-start leading-tight">
                <span className="text-xs font-bold text-[#0F172A] block">{displayName}</span>
                <span className="text-[10px] text-[#64748B] block truncate max-w-[140px]">
                  {displayRole}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
            </button>

            {showUserMenu && (
              <div className="absolute end-0 mt-2 w-64 bg-white border border-[#E5EAF2] rounded-2xl shadow-xl p-2 z-40 text-start animate-in fade-in-50 space-y-1">
                <div className="p-2.5 bg-[#F4F7FB] rounded-xl text-start">
                  <div className="text-xs font-bold text-[#0F172A]">{displayName}</div>
                  <div className="text-[10px] text-[#64748B]">{displayRole}</div>
                  <div className="text-[10px] font-mono text-[#0FA37F] mt-1 font-semibold">
                    المحطة: {plantCode} / السنة: {fiscalYear}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowContextModal(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#0F172A] hover:bg-[#F4F7FB] rounded-lg transition-colors cursor-pointer"
                >
                  <Sliders className="w-4 h-4 text-[#64748B]" />
                  <span>تغيير سياق العمل</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate('/admin/dev');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#0F172A] hover:bg-[#F4F7FB] rounded-lg transition-colors cursor-pointer"
                >
                  <Activity className="w-4 h-4 text-[#0FA37F]" />
                  <span>فحص المحرك والبيانات (Dev)</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate('/admin/diagnostics');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#0F172A] hover:bg-[#F4F7FB] rounded-lg transition-colors cursor-pointer"
                >
                  <Shield className="w-4 h-4 text-[#2563EB]" />
                  <span>سجلات التشخيص وصحة النظام</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate('/about');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#0F172A] hover:bg-[#F4F7FB] rounded-lg transition-colors cursor-pointer"
                >
                  <UserCheck className="w-4 h-4 text-[#F59E0B]" />
                  <span>عن النظام واختصارات المفاتيح</span>
                </button>

                <div className="border-t border-[#E5EAF2] my-1" />

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#EF4444] hover:bg-red-50 rounded-lg transition-colors cursor-pointer font-semibold"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t('action_logout')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* SAP S/4HANA Context Switcher Modal */}
      <Modal
        isOpen={showContextModal}
        onClose={() => setShowContextModal(false)}
        title="تحديد سياق التشغيل والبيانات (Company / Plant / Fiscal Year)"
        description="تحديد المعلمات الحاكمة للعمليات والمستندات المحاسبية وفق معيار SAP"
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowContextModal(false)}>
              {t('action_cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveContext}>
              {t('action_save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-start">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#0F172A] flex items-center gap-2">
              <Building className="w-4 h-4 text-[#0FA37F]" />
              {t('company_code')}
            </label>
            <select
              value={tempCompany}
              onChange={(e) => setTempCompany(e.target.value)}
              className="w-full bg-white border border-[#E5EAF2] rounded-xl p-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0FA37F]/30"
            >
              <option value="1000">1000 - شركة الخليج للطاقة (المملكة العربية السعودية)</option>
              <option value="2000">2000 - الخليج للإمدادات البترولية (الإمارات)</option>
              <option value="3000">3000 - الخليج للخدمات اللوجستية وتوزيع الطاقة (الكويت)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#0F172A] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#2563EB]" />
              {t('plant_code')}
            </label>
            <select
              value={tempPlant}
              onChange={(e) => setTempPlant(e.target.value)}
              className="w-full bg-white border border-[#E5EAF2] rounded-xl p-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0FA37F]/30"
            >
              <option value="1100">1100 - مركز الرياض للتوزيع والتخزين (Logistics Hub)</option>
              <option value="1200">1200 - محطة ينبع البترولية ومستودع الساحل الغربي</option>
              <option value="1300">1300 - مستودع المنطقة الشرقية (الدمام)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#0F172A] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#F59E0B]" />
              {t('fiscal_year')}
            </label>
            <select
              value={tempYear}
              onChange={(e) => setTempYear(e.target.value)}
              className="w-full bg-white border border-[#E5EAF2] rounded-xl p-2.5 text-xs font-mono text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0FA37F]/30"
            >
              <option value="2026">2026 (السنة المالية الحالية)</option>
              <option value="2025">2025 (السنة المالية السابقة - أرشيف)</option>
              <option value="2027">2027 (تخطيط الموازنات التقديرية)</option>
            </select>
          </div>
        </div>
      </Modal>
    </>
  );
};
