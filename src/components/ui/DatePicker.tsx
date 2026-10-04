import React from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '../../core/utils';

export interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || React.useId();

    return (
      <div className="w-full space-y-1.5 text-start">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-[#0F172A]">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-[#64748B]">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <input
            id={inputId}
            ref={ref}
            type="date"
            className={cn(
              'w-full bg-white text-[#0F172A] border border-[#E5EAF2] rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#0FA37F]/30 focus:border-[#0FA37F] disabled:bg-[#F4F7FB] disabled:cursor-not-allowed h-10 ps-9 pe-3 font-mono',
              error && 'border-[#EF4444] focus:ring-[#EF4444]/30 focus:border-[#EF4444]',
              className
            )}
            {...props}
          />
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

DatePicker.displayName = 'DatePicker';
