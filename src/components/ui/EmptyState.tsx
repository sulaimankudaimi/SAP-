import React from 'react';
import { FolderSearch } from 'lucide-react';
import { cn } from '../../core/utils';
import { t } from '../../i18n/ar';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = t('empty_title'),
  description = t('empty_description'),
  icon,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-[#CBD5E1] bg-white/50 my-4',
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-[#F4F7FB] border border-[#E5EAF2] flex items-center justify-center text-[#64748B] mb-4">
        {icon || <FolderSearch className="w-7 h-7 text-[#64748B]" />}
      </div>
      <h3 className="text-sm font-bold text-[#0F172A] max-w-sm">{title}</h3>
      <p className="text-xs text-[#64748B] max-w-md mt-1.5 leading-relaxed">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};
