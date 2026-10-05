import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Zap, ShieldCheck, Lock, User, ArrowLeft, Building2, AlertCircle, KeyRound, Sparkles } from 'lucide-react';
import { t } from '../i18n/ar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Checkbox } from '../components/ui/Checkbox';
import { useToast } from '../components/ui/Toast';
import { AuthService } from '../core/services/AuthService';
import { useAuthStore } from '../core/auth/useAuthStore';
import { DatabaseSeeder } from '../seed';
import { db } from '../core/db';

const loginSchema = z.object({
  username: z.string().min(2, 'يرجى إدخال اسم المستخدم أو الرقم الوظيفي'),
  password: z.string().min(4, 'كلمة المرور يجب أن لا تقل عن 4 خانات'),
  remember: z.boolean(),
});

type LoginFormData = {
  username: string;
  password: string;
  remember: boolean;
};

interface DemoAccount {
  username: string;
  roleName: string;
  name: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { username: 'admin', roleName: 'مدير النظام', name: 'م. أحمد الشمري' },
  { username: 'proc.mgr', roleName: 'مدير المشتريات', name: 'فهد الدوسري' },
  { username: 'proc.off', roleName: 'موظف مشتريات', name: 'سارة القحطاني' },
  { username: 'wh.clerk', roleName: 'أمين مستودع', name: 'سلطان المطيري' },
  { username: 'flt.mgr', roleName: 'مدير الأسطول', name: 'خالد العنزي' },
  { username: 'accountant', roleName: 'محاسب مالي', name: 'محمد الحربي' },
  { username: 'fin.mgr', roleName: 'مدير مالي', name: 'عبدالعزيز العتيبي' },
  { username: 'auditor', roleName: 'مدقق داخلي', name: 'نورة السبيعي' },
  { username: 'asset.mgr', roleName: 'مدير أصول', name: 'طارق الزهراني' },
  { username: 'viewer', roleName: 'مستعرض فقط', name: 'ريم الغامدي' },
];

export const LoginPage: React.FC = () => {
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
  const navigate = useNavigate();
  const location = useLocation();
  const { success } = useToast();
  const setSession = useAuthStore((s) => s.setSession);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDemoAccounts, setShowDemoAccounts] = useState(true);
  const [initialOtp, setInitialOtp] = useState<string | null>(null);

  // Auto seed on initial load if not yet seeded
  useEffect(() => {
    DatabaseSeeder.isSeeded().then(async (seeded) => {
      if (!seeded) {
        await DatabaseSeeder.seed().catch(console.error);
      }
      // Check for one-time generated admin password in non-demo mode
      if (!isDemoMode) {
        const otpSetting = await db.settings.get('set-initial-admin-otp');
        if (otpSetting && otpSetting.value) {
          setInitialOtp(otpSetting.value);
        }
      }
    });
  }, [isDemoMode]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: isDemoMode
      ? {
          username: 'admin',
          password: 'Admin@123',
          remember: true,
        }
      : {
          username: '',
          password: '',
          remember: false,
        },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Ensure DB is seeded before authenticating
      const seeded = await DatabaseSeeder.isSeeded();
      if (!seeded) {
        await DatabaseSeeder.seed();
      }

      const session = await AuthService.login(data.username, data.password);
      setSession(session);
      success('تم تسجيل الدخول بنجاح', `مرحباً بك، ${session.user.fullName} (${session.role.name})`);

      const destination = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/';
      navigate(destination);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل تسجيل الدخول';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const selectDemoAccount = (username: string) => {
    setValue('username', username);
    setValue('password', 'Admin@123');
    setErrorMessage(null);
  };

  return (
    <div
      className="min-h-screen relative flex items-center justify-center p-4 bg-gradient-to-br from-[#0B2545] via-[#13315C] to-[#07172B] overflow-hidden"
      dir="rtl"
    >
      {/* Background SVG Grid & Ambient Glow (100% offline inline SVG) */}
      <svg
        className="absolute inset-0 w-full h-full opacity-10 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#FFFFFF" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-pattern)" />
      </svg>

      {/* Ambient Lights */}
      <div className="absolute top-1/4 start-1/4 w-96 h-96 bg-[#0FA37F]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 end-1/4 w-96 h-96 bg-[#2563EB]/15 rounded-full blur-3xl pointer-events-none" />

      {/* Centered Login Container */}
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100/30 overflow-hidden z-10 my-8 transition-all">
        {/* Top Header */}
        <div className="p-8 pb-3 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0FA37F] to-[#2563EB] flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 ring-4 ring-[#0FA37F]/10">
            <Zap className="w-7 h-7 text-white fill-white" />
          </div>

          <div>
            <h2 className="text-xl font-black text-[#0F172A] tracking-tight">{t('app_name')}</h2>
            <p className="text-xs font-mono font-bold text-[#0FA37F] mt-0.5">{t('app_title')}</p>
            <p className="text-xs text-[#64748B] mt-1 leading-relaxed">{t('login_subtitle')}</p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-8 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#EF4444] flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-semibold">{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-8 pt-3 space-y-4 text-start">
          <Input
            label={t('login_username')}
            placeholder="مثال: admin أو proc.mgr"
            startIcon={<User className="w-4 h-4" />}
            error={errors.username?.message}
            {...register('username')}
          />

          <Input
            label={t('login_password')}
            type="password"
            placeholder="••••••••"
            startIcon={<Lock className="w-4 h-4" />}
            error={errors.password?.message}
            {...register('password')}
          />

          <div className="flex items-center justify-between pt-1">
            <Checkbox
              label={t('login_remember')}
              {...register('remember')}
            />
            {isDemoMode && (
              <span className="text-[11px] font-mono text-[#0FA37F]">
                كلمة المرور الافتراضية: Admin@123
              </span>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-2 font-bold"
            loading={isLoading}
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            {t('login_btn')}
          </Button>

          {/* Initial OTP Notification for First Boot in Non-Demo Mode */}
          {!isDemoMode && initialOtp && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-xs text-amber-900">
              <div className="flex items-center gap-1.5 font-bold text-amber-800">
                <KeyRound className="w-4 h-4 text-amber-600" />
                <span>إطلاق النظام الأول: كلمة المرور المؤقتة لمدير النظام</span>
              </div>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                اسم المستخدم: <strong className="font-mono text-slate-900">admin</strong> — كلمة المرور لمرة واحدة:{' '}
                <code className="bg-white px-2 py-0.5 rounded border border-amber-300 font-mono font-bold text-red-600 select-all">
                  {initialOtp}
                </code>
              </p>
              <p className="text-[10px] text-amber-600">
                سيُطلب منك تغيير كلمة المرور فور تسجيل الدخول الأول وفق معايير الأمان المؤسسية.
              </p>
            </div>
          )}

          {/* Demo Roles Quick Picker (Spec Requirement: ONLY when VITE_DEMO_MODE is true) */}
          {isDemoMode && (
            <div className="pt-3 border-t border-[#E5EAF2] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#0FA37F]" />
                  حسابات الأدوار التجريبية (Demo Accounts)
                </span>
                <button
                  type="button"
                  onClick={() => setShowDemoAccounts(!showDemoAccounts)}
                  className="text-[11px] text-[#2563EB] hover:underline cursor-pointer"
                >
                  {showDemoAccounts ? 'إخفاء' : 'إظهار'}
                </button>
              </div>

              {showDemoAccounts && (
                <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-1 bg-[#F4F7FB] rounded-xl border border-[#E5EAF2]">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.username}
                      type="button"
                      onClick={() => selectDemoAccount(acc.username)}
                      className="p-1.5 rounded-lg bg-white hover:bg-emerald-50 text-start border border-[#E5EAF2] hover:border-[#0FA37F]/50 transition-colors text-xs flex flex-col justify-between cursor-pointer"
                    >
                      <span className="font-bold text-[#0F172A] truncate">{acc.roleName}</span>
                      <span className="text-[10px] font-mono text-[#64748B] truncate">{acc.username}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="p-3 rounded-xl bg-[#F4F7FB] border border-[#E5EAF2] flex items-center justify-between text-[11px] text-[#64748B]">
            <span className="flex items-center gap-1.5 font-medium">
              <Building2 className="w-3.5 h-3.5 text-[#0FA37F]" />
              الفرع الافتراضي: 1100 - الرياض
            </span>
            <span className="font-mono font-semibold text-[#0B2545]">FY-2026</span>
          </div>

          <div className="pt-1 text-center">
            <p className="text-[10px] text-[#64748B] flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0FA37F]" />
              <span>{t('login_footer_note')}</span>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
