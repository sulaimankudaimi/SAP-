import React from 'react';
import { cn } from '../../core/utils';
import { StatusVariant } from '../../types';
import { t } from '../../i18n/ar';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: StatusVariant | 'primary' | 'secondary' | 'neutral' | 'green' | 'emerald' | 'amber' | 'red' | 'blue' | 'gray';
  children?: React.ReactNode;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'neutral',
  children,
  dot = true,
  ...props
}) => {
  // Mapping strict status chip specifications:
  // green=approved/completed, amber=in review/pending, red=rejected/critical, blue=in progress, gray=draft/closed
  const variantMap: Record<string, { bg: string; text: string; dot: string; labelKey?: string }> = {
    approved: { bg: 'bg-[#0FA37F]/10 border-[#0FA37F]/30', text: 'text-[#0FA37F]', dot: 'bg-[#0FA37F]', labelKey: 'status_approved' },
    completed: { bg: 'bg-[#0FA37F]/10 border-[#0FA37F]/30', text: 'text-[#0FA37F]', dot: 'bg-[#0FA37F]', labelKey: 'status_completed' },
    in_review: { bg: 'bg-[#F59E0B]/10 border-[#F59E0B]/30', text: 'text-[#B45309]', dot: 'bg-[#F59E0B]', labelKey: 'status_in_review' },
    pending: { bg: 'bg-[#F59E0B]/10 border-[#F59E0B]/30', text: 'text-[#B45309]', dot: 'bg-[#F59E0B]', labelKey: 'status_pending' },
    rejected: { bg: 'bg-[#EF4444]/10 border-[#EF4444]/30', text: 'text-[#EF4444]', dot: 'bg-[#EF4444]', labelKey: 'status_rejected' },
    critical: { bg: 'bg-[#EF4444]/10 border-[#EF4444]/30', text: 'text-[#EF4444]', dot: 'bg-[#EF4444]', labelKey: 'status_critical' },
    in_progress: { bg: 'bg-[#2563EB]/10 border-[#2563EB]/30', text: 'text-[#2563EB]', dot: 'bg-[#2563EB]', labelKey: 'status_in_progress' },
    draft: { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-600', dot: 'bg-slate-400', labelKey: 'status_draft' },
    closed: { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-600', dot: 'bg-slate-400', labelKey: 'status_closed' },
    primary: { bg: 'bg-[#0FA37F]/10 border-[#0FA37F]/30', text: 'text-[#0FA37F]', dot: 'bg-[#0FA37F]' },
    secondary: { bg: 'bg-[#0B2545]/10 border-[#0B2545]/20', text: 'text-[#0B2545]', dot: 'bg-[#0B2545]' },
    neutral: { bg: 'bg-[#F4F7FB] border-[#E5EAF2]', text: 'text-[#64748B]', dot: 'bg-[#64748B]' },
    // Direct color aliases
    green: { bg: 'bg-[#0FA37F]/10 border-[#0FA37F]/30', text: 'text-[#0FA37F]', dot: 'bg-[#0FA37F]' },
    emerald: { bg: 'bg-[#0FA37F]/10 border-[#0FA37F]/30', text: 'text-[#0FA37F]', dot: 'bg-[#0FA37F]' },
    amber: { bg: 'bg-[#F59E0B]/10 border-[#F59E0B]/30', text: 'text-[#B45309]', dot: 'bg-[#F59E0B]' },
    red: { bg: 'bg-[#EF4444]/10 border-[#EF4444]/30', text: 'text-[#EF4444]', dot: 'bg-[#EF4444]' },
    blue: { bg: 'bg-[#2563EB]/10 border-[#2563EB]/30', text: 'text-[#2563EB]', dot: 'bg-[#2563EB]' },
    gray: { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-600', dot: 'bg-slate-400' },
  };

  const style = variantMap[variant] || variantMap.neutral;
  const defaultLabel = style.labelKey ? t(style.labelKey as Parameters<typeof t>[0]) : null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border select-none',
        style.bg,
        style.text,
        className
      )}
      {...props}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', style.dot)} />}
      <span>{children ?? defaultLabel}</span>
    </span>
  );
};

export const StatusChip = Badge;
