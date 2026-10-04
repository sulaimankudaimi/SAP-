import React from 'react';
import { cn } from '../../core/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, rows = 3, ...props }, ref) => {
    const textareaId = id || React.useId();

    return (
      <div className="w-full space-y-1.5 text-start">
        {label && (
          <label htmlFor={textareaId} className="block text-xs font-semibold text-[#0F172A]">
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          rows={rows}
          className={cn(
            'w-full bg-white text-[#0F172A] border border-[#E5EAF2] rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#0FA37F]/30 focus:border-[#0FA37F] disabled:bg-[#F4F7FB] disabled:cursor-not-allowed placeholder:text-[#64748B]/60 p-3',
            error && 'border-[#EF4444] focus:ring-[#EF4444]/30 focus:border-[#EF4444]',
            className
          )}
          {...props}
        />
        {error ? (
          <p className="text-xs text-[#EF4444] font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-[#64748B]">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
