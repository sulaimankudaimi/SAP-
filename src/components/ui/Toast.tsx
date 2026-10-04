import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../../core/utils';
import { ToastMessage } from '../../types';

interface ToastContextType {
  toast: (options: Omit<ToastMessage, 'id'>) => void;
  showToast: (options: {
    title: string;
    message?: string;
    description?: string;
    type?: 'success' | 'error' | 'warning' | 'info';
    duration?: number;
  }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, type = 'info', duration = 4000 }: Omit<ToastMessage, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastMessage = { id, title, description, type, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }
    },
    [dismiss]
  );

  const showToast = useCallback(
    ({
      title,
      message,
      description,
      type = 'info',
      duration = 4000,
    }: {
      title: string;
      message?: string;
      description?: string;
      type?: 'success' | 'error' | 'warning' | 'info';
      duration?: number;
    }) => {
      toast({
        title,
        description: message || description,
        type,
        duration,
      });
    },
    [toast]
  );

  const success = useCallback((title: string, description?: string) => toast({ title, description, type: 'success' }), [toast]);
  const error = useCallback((title: string, description?: string) => toast({ title, description, type: 'error' }), [toast]);
  const warning = useCallback((title: string, description?: string) => toast({ title, description, type: 'warning' }), [toast]);
  const info = useCallback((title: string, description?: string) => toast({ title, description, type: 'info' }), [toast]);

  return (
    <ToastContext.Provider value={{ toast, showToast, success, error, warning, info, dismiss }}>
      {children}
      <div className="fixed bottom-5 start-5 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
        {toasts.map((item) => {
          const icons = {
            success: <CheckCircle2 className="w-5 h-5 text-[#0FA37F] shrink-0" />,
            error: <AlertCircle className="w-5 h-5 text-[#EF4444] shrink-0" />,
            warning: <AlertTriangle className="w-5 h-5 text-[#F59E0B] shrink-0" />,
            info: <Info className="w-5 h-5 text-[#2563EB] shrink-0" />,
          };

          const borderColors = {
            success: 'border-[#0FA37F]/30',
            error: 'border-[#EF4444]/30',
            warning: 'border-[#F59E0B]/30',
            info: 'border-[#2563EB]/30',
          };

          return (
            <div
              key={item.id}
              className={cn(
                'pointer-events-auto flex items-start gap-3 p-4 bg-white rounded-2xl shadow-xl border text-start transition-all animate-in slide-in-from-bottom-2',
                borderColors[item.type]
              )}
            >
              {icons[item.type]}
              <div className="flex-1 overflow-hidden">
                <h5 className="text-xs font-bold text-[#0F172A]">{item.title}</h5>
                {item.description && (
                  <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug">{item.description}</p>
                )}
              </div>
              <button
                onClick={() => dismiss(item.id)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
