import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldCheck, Lock, KeyRound, AlertCircle, CheckCircle2, XCircle, ArrowLeft, LogOut } from 'lucide-react';
import { t } from '../i18n/ar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';
import { AuthService } from '../core/services/AuthService';
import { useAuthStore } from '../core/auth/useAuthStore';

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'يرجى إدخال كلمة المرور الحالية'),
    newPassword: z.string().min(10, 'يجب أن لا تقل كلمة المرور عن 10 خانات'),
    confirmPassword: z.string().min(1, 'يرجى تأكيد كلمة المرور الجديدة'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'كلمة المرور وتأكيدها غير متطابقين.',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'يجب أن تختلف كلمة المرور الجديدة عن كلمة المرور الحالية.',
    path: ['newPassword'],
  });

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const { user, refreshUser, logout } = useAuthStore();

  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    mode: 'onChange',
  });

  const watchedNewPassword = watch('newPassword') || '';

  // Password Policy live checks
  const policyChecks = [
    { label: t('policy_len'), valid: watchedNewPassword.length >= 10 },
    { label: t('policy_upper'), valid: /[A-Z]/.test(watchedNewPassword) },
    { label: t('policy_lower'), valid: /[a-z]/.test(watchedNewPassword) },
    { label: t('policy_digit'), valid: /[0-9]/.test(watchedNewPassword) },
    { label: t('policy_symbol'), valid: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(watchedNewPassword) },
  ];

  const onSubmit = async (data: ChangePasswordFormData) => {
    if (!user) return;
    setIsLoading(true);
    setServerError(null);

    try {
      await AuthService.changePassword(user.id, data.currentPassword, data.newPassword);
      await refreshUser();
      success(t('change_pwd_success'), 'تم تفعيل الحساب بكلمة المرور الجديدة بنجاح.');
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل تغيير كلمة المرور';
      setServerError(msg);
      toastError('خطأ', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div
      className="min-h-screen relative flex items-center justify-center p-4 bg-gradient-to-br from-[#0B2545] via-[#13315C] to-[#07172B] overflow-hidden"
      dir="rtl"
    >
      {/* Background SVG Grid Pattern */}
      <svg
        className="absolute inset-0 w-full h-full opacity-10 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="grid-pattern-pwd" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#FFFFFF" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-pattern-pwd)" />
      </svg>

      {/* Ambient Lights */}
      <div className="absolute top-1/4 start-1/4 w-96 h-96 bg-[#0FA37F]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 end-1/4 w-96 h-96 bg-[#2563EB]/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Card Container */}
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100/30 overflow-hidden z-10 my-8">
        {/* Header */}
        <div className="p-8 pb-4 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0FA37F] to-[#2563EB] flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 ring-4 ring-[#0FA37F]/10">
            <KeyRound className="w-7 h-7 text-white" />
          </div>

          <div>
            <h2 className="text-xl font-black text-[#0F172A] tracking-tight">{t('change_pwd_title')}</h2>
            <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed max-w-sm mx-auto">
              {t('change_pwd_subtitle')}
            </p>
            {user && (
              <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-[#F4F7FB] border border-[#E5EAF2] rounded-full text-xs font-semibold text-[#0B2545]">
                <span>المستخدم:</span>
                <span className="font-mono text-[#0FA37F]">{user.username}</span>
                <span>({user.fullName})</span>
              </div>
            )}
          </div>
        </div>

        {/* Server Error Alert */}
        {serverError && (
          <div className="mx-8 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-[#EF4444] flex items-start gap-2.5 animate-in fade-in-50">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-semibold">{serverError}</span>
          </div>
        )}

        {/* Change Password Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-8 pt-4 space-y-4 text-start">
          <Input
            label={t('change_pwd_current')}
            type="password"
            placeholder="••••••••"
            startIcon={<Lock className="w-4 h-4" />}
            error={errors.currentPassword?.message}
            {...register('currentPassword')}
          />

          <Input
            label={t('change_pwd_new')}
            type="password"
            placeholder="••••••••••••"
            startIcon={<KeyRound className="w-4 h-4" />}
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />

          {/* Live Visual Password Policy Checklist */}
          <div className="p-3.5 bg-[#F4F7FB] border border-[#E5EAF2] rounded-2xl space-y-2">
            <span className="text-[11px] font-bold text-[#0F172A] block">
              معايير تعقيد كلمة المرور (Security Policy):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {policyChecks.map((check, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
                    check.valid ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                >
                  {check.valid ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  )}
                  <span>{check.label}</span>
                </div>
              ))}
            </div>
          </div>

          <Input
            label={t('change_pwd_confirm')}
            type="password"
            placeholder="••••••••••••"
            startIcon={<Lock className="w-4 h-4" />}
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-2 font-bold cursor-pointer"
            loading={isLoading}
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            {t('change_pwd_submit')}
          </Button>

          <div className="pt-2 flex items-center justify-between border-t border-[#E5EAF2] text-xs">
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-slate-500 hover:text-red-600 transition-colors cursor-pointer font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تسجيل الخروج والعودة</span>
            </button>

            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#0FA37F]" />
              <span>تشفير PBKDF2 محلي</span>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};
