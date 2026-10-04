import { LucideIcon } from 'lucide-react';

export * from './models';

export type StatusVariant = 'approved' | 'completed' | 'in_review' | 'pending' | 'rejected' | 'critical' | 'in_progress' | 'draft' | 'closed';

export interface NavItemConfig {
  id: string;
  path: string;
  titleKey: string;
  icon: LucideIcon;
  badgeCount?: number;
  children?: {
    id: string;
    path: string;
    titleKey: string;
    badgeCount?: number;
  }[];
}

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

export interface UserContext {
  id: string;
  name: string;
  role: string;
  initials: string;
  companyCode: string;
  companyName: string;
  plantCode: string;
  plantName: string;
  fiscalYear: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  time: string;
  unread: boolean;
  type: 'procurement' | 'inventory' | 'finance' | 'system';
}

export interface DemoTableRecord {
  [key: string]: unknown;
  id: string;
  docNumber: string;
  materialCode: string;
  materialName: string;
  vendor: string;
  quantity: number;
  unit: string;
  totalAmount: number;
  currency: string;
  status: StatusVariant;
  postingDate: string;
  plant: string;
}
