import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../auth/useAuthStore';
import type { AuthObject, ModuleCode, ActivityType } from '../../types/models';

export function usePermission(
  required: AuthObject,
  plant?: string,
  costCenter?: string,
  amount?: number
): boolean {
  const can = useAuthStore((s) => s.can);
  return can(required, plant, costCenter, amount);
}

export interface CanProps {
  module: ModuleCode;
  activity: ActivityType;
  plant?: string;
  costCenter?: string;
  amount?: number;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const Can: React.FC<CanProps> = ({
  module,
  activity,
  plant,
  costCenter,
  amount,
  fallback = null,
  children,
}) => {
  const hasAccess = usePermission({ module, activity }, plant, costCenter, amount);
  if (!hasAccess) return <>{fallback}</>;
  return <>{children}</>;
};

export interface ProtectedRouteProps {
  requiredAuth?: AuthObject;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredAuth, children }) => {
  const { isAuthenticated, user, isAutoLocked, role } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Force password change if required, allowing ONLY /change-password
  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (requiredAuth && role) {
    const hasPermission = useAuthStore.getState().can(requiredAuth);
    if (!hasPermission) {
      return (
        <div className="p-8 bg-white rounded-2xl border border-red-200 text-center space-y-3 m-6">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#EF4444] flex items-center justify-center mx-auto font-bold text-lg">
            !
          </div>
          <h3 className="text-base font-bold text-[#0F172A]">وصول غير مصرح (Unauthorized 403)</h3>
          <p className="text-xs text-[#64748B] max-w-md mx-auto">
            دورك الوظيفي الحالي [<strong>{role.name}</strong>] لا يملك صلاحية الوصول إلى هذه الشاشة ({requiredAuth.module}_{requiredAuth.activity.toUpperCase()}).
          </p>
        </div>
      );
    }
  }

  return <>{children}</>;
};
