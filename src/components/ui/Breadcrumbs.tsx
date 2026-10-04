import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BreadcrumbItem } from '../../types';
import { cn } from '../../core/utils';

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, className }) => {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center text-xs text-[#64748B]', className)}>
      <ol className="flex items-center gap-1.5 list-none p-0 m-0 flex-wrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center gap-1.5">
              {index > 0 && <ChevronLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              {item.path && !isLast ? (
                <Link
                  to={item.path}
                  className="hover:text-[#0FA37F] transition-colors font-medium truncate max-w-[180px]"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    'truncate max-w-[220px]',
                    isLast ? 'text-[#0F172A] font-semibold' : 'text-[#64748B]'
                  )}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
