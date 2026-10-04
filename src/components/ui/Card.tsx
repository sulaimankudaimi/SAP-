import React from 'react';
import { cn } from '../../core/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  header?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  className,
  children,
  header,
  action,
  footer,
  noPadding = false,
  ...props
}) => {
  return (
    <div
      className={cn(
        'bg-white rounded-[16px] border border-[#E5EAF2] shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden transition-all',
        className
      )}
      {...props}
    >
      {(header || action) && (
        <div className="px-6 py-4 border-b border-[#E5EAF2] flex items-center justify-between">
          <div className="font-bold text-sm text-[#0F172A]">{header}</div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={cn(noPadding ? 'p-0' : 'p-6')}>{children}</div>
      {footer && (
        <div className="px-6 py-3.5 bg-[#F4F7FB] border-t border-[#E5EAF2] flex items-center justify-between text-xs text-[#64748B]">
          {footer}
        </div>
      )}
    </div>
  );
};
