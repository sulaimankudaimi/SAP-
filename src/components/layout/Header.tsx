import { DiagnosticLogger } from '../../core/services/DiagnosticLogger';
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
  ExternalLink,
  KeyRound,
  Wifi,
  WifiOff,
  CloudUpload,
  Inbox,
  AlertTriangle,
} from 'lucide-react';
import { t } from '../../i18n/ar';
import { useToast } from '../ui/Toast';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAuthStore } from '../../core/auth/useAuthStore';
import { TCodeBar } from './TCodeBar';
import { NotificationService } from '../../core/services/NotificationService';
import { isRouteImplemented } from '../../app/routeStatus';
import { useConnectivityStore, isServerMode } from '../../core/gateway/connectivity';
import { db } from '../../core/db';
import { LOCALE } from '../../config/locale';
import { SEED_VERSION, SEED_VERSION_KEY, DatabaseSeeder } from '../../seed';
import type { Notification } from '../../types/models';

export interface HeaderProps {
  onOpenCommandPalette: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenCommandPalette }) => {
  const navigate = useNavigate();
  const { success } = useToast();
  const { user, role, logout, recordActivity, can } = useAuthStore();
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
  const canSysView = can({ module: 'SYS', activity: 'view' });

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

  const isServer = isServerMode();
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const isSyncing = useConnectivityStore((s) => s.isSyncing);
  const pendingCount = useConnectivityStore((s) => s.pendingCount);
  const needsReviewCount = useConnectivityStore((s) => s.needsReviewCount);
  const totalOutbox = pendingCount + needsReviewCount;

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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [storedSeedVersion, setStoredSeedVersion] = useState<string | null>(SEED_VERSION);
  const [isDbSeeded, setIsDbSeeded] = useState(false);

  const checkSeedVersion = async () => {
    try {
      const seeded = await DatabaseSeeder.isSeeded();
      setIsDbSeeded(seeded);
      if (seeded) {
        const setting =
          (await db.settings.get('set-seed-version')) ||
          (await db.settings.where('key').equals(SEED_VERSION_KEY).first());
        setStoredSeedVersion(setting?.value ?? null);
      }
    } catch (e) {
      DiagnosticLogger.error('Header', 'Failed to check seed version', e);
    }
  };

  const loadNotifications = async () => {
    try {
      await NotificationService.generateSystemNotifications();
      const list = await NotificationService.getNotifications({ userId: user?.id });
      setNotifications(list);
    } catch (e) {
      DiagnosticLogger.error('Header', 'Failed to load notifications in header', e);
    }
  };

  useEffect(() => {
    loadNotifications();
    checkSeedVersion();
  }, [user?.id]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleSaveContext = () => {
    setCompanyCode(tempCompany);
    setPlantCode(tempPlant);
    setFiscalYear(tempYear);
    setShowContextModal(false);
    success(t('context_saved'), `الشركة: ${tempCompany} | المحطة: ${tempPlant} | السنة: ${tempYear}`);
  };

  const handleMarkAllRead = async () => {
    try {
      await NotificationService.markAllAsRead(user?.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (e) {
      DiagnosticLogger.error('Header', 'Error occurred', e);
    }
  };

  const handleNotificationClick = async (item: Notification) => {
    if (!item.isRead) {
      await NotificationService.markAsRead(item.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
    }
    setShowNotifications(false);
    if (item.link && isRouteImplemented(item.link)) {
      navigate(item.link);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const displayName = user?.fullName || `م. ${LOCALE.namePools.firstNames[0]} ${LOCALE.namePools.lastNames[0]}`;
  const displayRole = role?.name || 'مدير النظام (Admin)';
  const initials = displayName
    .split(' ')
    .filter((p) => !p.startsWith('م.') && !p.startsWith('أ.'))
    .slice(0, 2)
    .map((p) => p[0])
    .join('') || 'ط.ح';

  const isAdminUser = user?.roleCode === 'ADMIN' || role?.code === 'ADMIN';
  const showSeedVersionNotice = Boolean(
    isDemoMode && isAdminUser && isDbSeeded && storedSeedVersion !== SEED_VERSION
  );

  return (
    <>
      {showSeedVersionNotice && (
        <div
          role="status"
          data-testid="seed-version-notice"
          className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs text-amber-900 flex items-center justify-between gap-4 z-20"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>تنبيه إصدار البيانات التجريبية:</strong> البيانات التجريبية المخزنة محلياً تعود لإصدار أقدم ({storedSeedVersion ?? 'غير محدد'} بدلاً من {SEED_VERSION}). لإعادة توليد البيانات التجريبية المحدّثة، يرجى مسح بيانات الموقع (Clear site data) من إعدادات المتصفح أو استخدام خيار إعادة الضبط من لوحة فحص المحرك. لن يتم حذف أي بيانات تلقائياً.
            </span>
          </div>
        </div>
      )}
      <header className="h-16 bg-white border-b border-[#E5EAF2] px-6 flex items-center justify-between sticky top-0 z-20">
        {/* SAP T-Code Box & Command Palette Search */}
        <div className="flex-1 max-w-xl flex items-center gap-3">
          <TCodeBar />
          <button
            onClick={onOpenCommandPalette}
            className="flex-1 hidden md:flex items-center justify-between bg-[#F4F7FB] hover:bg-slate-100 border border-[#E5EAF2] rounded-xl px-3 py-1.5 text-xs text-[#64748B] transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-[#64748B] group-hover:text-[#0FA37F] transition-colors" />
              <span className="truncate">{t('cmd_placeholder')}</span>
            </div>
            <kbd className="hidden lg:inline-flex items-center gap-1 font-mono text-[10px] bg-white border border-[#E5EAF2] text-[#64748B] px-1.5 py-0.5 rounded shadow-xs">
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

          {/* Connectivity Status Indicator (Online/Offline/Syncing) */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
              !isOnline
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : isSyncing
                ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                : isServer
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-50 text-slate-700 border-slate-200'
            }`}
            title={
              !isOnline
                ? 'وضع غير متصل بالشبكة (العمليات المحلية وصندوق الإرسال نشطة)'
                : isSyncing
                ? 'جاري مزامنة صندوق الإرسال مع الخادم...'
                : isServer
                ? 'متصل بالخادم المركزي للأسطول'
                : 'وضع محلي مستقل 100%'
            }
          >
            {!isOnline ? (
              <WifiOff className="w-3.5 h-3.5 text-rose-600" />
            ) : isSyncing ? (
              <CloudUpload className="w-3.5 h-3.5 text-amber-600" />
            ) : (
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span>
              {!isOnline
                ? 'غير متصل'
                : isSyncing
                ? 'مزامنة...'
                : isServer
                ? 'الخادم متصل'
                : 'محلي (أوفلاين)'}
            </span>
          </div>

          {/* Real Outbox Pending Badge / Button */}
          <button
            onClick={() => navigate('/fleet/outbox')}
            className={`relative p-2 rounded-xl transition-colors cursor-pointer ${
              totalOutbox > 0
                ? 'text-amber-600 hover:bg-amber-50'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F4F7FB]'
            }`}
            title={`صندوق الإرسال: ${pendingCount} قيد الإرسال، ${needsReviewCount} بحاجة لمراجعة`}
          >
            <Inbox className="w-5 h-5" />
            {totalOutbox > 0 && (
              <span className="absolute top-1.5 end-1.5 min-w-4 h-4 px-1 bg-amber-500 text-white rounded-full text-[9px] font-bold font-mono flex items-center justify-center ring-2 ring-white">
                {totalOutbox}
              </span>
            )}
          </button>

          {/* Quick link to /admin/dev verification cockpit (Demo Mode & SYS_VIEW only) */}
          {isDemoMode && canSysView && (
            <button
              onClick={() => navigate('/admin/dev')}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition-colors cursor-pointer"
              title="لوحة التحقق الفني للمحرك وقاعدة البيانات"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>لوحة فحص المحرك</span>
            </button>
          )}

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowUserMenu(false);
                if (!showNotifications) {
                  loadNotifications();
                }
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
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#64748B]">
                      لا توجد إشعارات جديدة حالياً
                    </div>
                  ) : (
                    notifications.slice(0, 8).map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleNotificationClick(item)}
                        className={`p-3 space-y-1 transition-colors hover:bg-[#F4F7FB] rounded-lg cursor-pointer ${
                          !item.isRead ? 'bg-[#0FA37F]/5' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-[#0F172A] leading-snug">
                            {item.title}
                          </span>
                          {!item.isRead && (
                            <span className="w-2 h-2 rounded-full bg-[#0FA37F] shrink-0 ms-2" />
                          )}
                        </div>
                        <p className="text-[10px] text-[#64748B] line-clamp-1">{item.message}</p>
                        <span className="text-[9px] text-slate-400 font-mono block">
                          {item.createdAt.slice(0, 16).replace('T', ' ')}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-2 border-t border-[#E5EAF2] text-center">
                  <button
                    onClick={() => {
                      setShowNotifications(false);
                      navigate('/notifications');
                    }}
                    className="text-xs font-semibold text-[#0FA37F] hover:underline inline-flex items-center gap-1"
                  >
                    <span>عرض كافة الإشعارات والتنبيهات</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
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

                {isDemoMode && canSysView && (
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
                )}

                {canSysView && (
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
                )}

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

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate('/change-password');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#0F172A] hover:bg-[#F4F7FB] rounded-lg transition-colors cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 text-[#0FA37F]" />
                  <span>{t('nav_change_password')}</span>
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
              <option value="1000">1000 - {LOCALE.brand.nameAr} ({LOCALE.country.nameAr})</option>
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
              {LOCALE.plants.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} - {p.nameAr}
                </option>
              ))}
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
