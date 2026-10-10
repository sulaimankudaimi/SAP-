import React, { useEffect } from 'react';
import { useAuthStore } from './useAuthStore';

export const AuthBootGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isBootRestoring = useAuthStore((s) => s.isBootRestoring);

  useEffect(() => {
    // 5-second failsafe: ends restoring unauthenticated if initialization stalls
    const timer = setTimeout(() => {
      if (useAuthStore.getState().isBootRestoring) {
        useAuthStore.setState({ isBootRestoring: false, isAuthenticated: false });
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  if (isBootRestoring) {
    return (
      <div
        className="min-h-screen bg-[#F4F7FB] flex flex-col items-center justify-center p-6"
        dir="rtl"
        data-testid="auth-boot-splash"
      >
        <div className="bg-white rounded-[16px] border border-[#E5EAF2] p-8 max-w-sm w-full text-center shadow-sm space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#0B2545] text-white flex items-center justify-center mx-auto text-xl font-bold shadow-sm">
            GE
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-[#0F172A]">شركة الخليج للطاقة</h2>
            <p className="text-xs text-[#64748B]">Gulf Energy ERP</p>
          </div>
          <div className="pt-2 pb-1">
            <div className="w-8 h-8 border-3 border-[#0B2545] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
          <p className="text-xs text-[#64748B]">جاري تهيئة النظام واستعادة الجلسة بأمان...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
