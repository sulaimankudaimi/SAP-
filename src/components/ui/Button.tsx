import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../core/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      children,
      icon,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer';

    const variantStyles = {
      primary:
        'bg-[#0FA37F] text-white hover:bg-[#0c8a6c] focus:ring-[#0FA37F]/50 shadow-sm active:scale-[0.98]',
      secondary:
        'bg-white text-[#0F172A] border border-[#E5EAF2] hover:bg-[#F4F7FB] focus:ring-[#0B2545]/20 shadow-sm',
      ghost:
        'bg-transparent text-[#64748B] hover:text-[#0F172A] hover:bg-[#F4F7FB] focus:ring-slate-300',
      danger:
        'bg-[#EF4444] text-white hover:bg-red-600 focus:ring-red-400/50 shadow-sm active:scale-[0.98]',
      outline:
        'bg-white text-[#0F172A] border border-[#E5EAF2] hover:bg-[#F4F7FB] focus:ring-[#0B2545]/20 shadow-sm',
    };

    const sizeStyles = {
      sm: 'text-xs px-3 py-1.5 gap-1.5 h-8',
      md: 'text-sm px-4 py-2 gap-2 h-10',
      lg: 'text-base px-6 py-2.5 gap-2.5 h-12',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        <span>{children}</span>
      </button>
    );
  }
);

Button.displayName = 'Button';
