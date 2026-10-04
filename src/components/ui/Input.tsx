import React from 'react';
import { cn } from '../../core/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, startIcon, endIcon, id, ...props }, ref) => {
    const inputId = id || React.useId();

    return (
      <div className="w-full space-y-1.5 text-start">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-[#0F172A]">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {startIcon && (
            <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-[#64748B]">
              {startIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'w-full bg-white text-[#0F172A] border border-[#E5EAF2] rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#0FA37F]/30 focus:border-[#0FA37F] disabled:bg-[#F4F7FB] disabled:cursor-not-allowed placeholder:text-[#64748B]/60 h-10 px-3',
              startIcon && 'ps-9',
              endIcon && 'pe-9',
              error && 'border-[#EF4444] focus:ring-[#EF4444]/30 focus:border-[#EF4444]',
              className
            )}
            {...props}
          />
          {endIcon && (
            <div className="absolute inset-y-0 end-0 pe-3 flex items-center pointer-events-none text-[#64748B]">
              {endIcon}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-xs text-[#EF4444] font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-[#64748B]">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
