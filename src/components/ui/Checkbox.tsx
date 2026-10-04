import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../core/utils';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, id, checked, ...props }, ref) => {
    const checkboxId = id || React.useId();

    return (
      <label htmlFor={checkboxId} className="inline-flex items-start gap-2.5 cursor-pointer select-none">
        <div className="relative flex items-center justify-center mt-0.5">
          <input
            id={checkboxId}
            ref={ref}
            type="checkbox"
            checked={checked}
            className="peer sr-only"
            {...props}
          />
          <div
            className={cn(
              'w-5 h-5 rounded-lg border border-[#E5EAF2] bg-white transition-all peer-checked:bg-[#0FA37F] peer-checked:border-[#0FA37F] peer-focus:ring-2 peer-focus:ring-[#0FA37F]/30 peer-disabled:bg-[#F4F7FB] peer-disabled:cursor-not-allowed flex items-center justify-center text-white',
              className
            )}
          >
            <Check className="w-3.5 h-3.5 stroke-[3] opacity-0 peer-checked:opacity-100 transition-opacity" />
          </div>
        </div>
        {(label || description) && (
          <div className="text-start">
            {label && <span className="text-xs font-semibold text-[#0F172A] block leading-tight">{label}</span>}
            {description && <span className="text-[11px] text-[#64748B] block mt-0.5">{description}</span>}
          </div>
        )}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
