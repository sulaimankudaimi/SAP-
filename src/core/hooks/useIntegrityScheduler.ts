import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../auth/useAuthStore';
import { RbacService, SYSTEM_ROLES } from '../services/RbacService';
import { IntegrityService } from '../services/IntegrityService';
import type { IntegrityReport, IntegrityRun } from '../../types/models';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export interface IntegritySchedulerState {
  lastRun: IntegrityRun | null;
  lastReport: IntegrityReport | null;
  isRunning: boolean;
  isOverdue: boolean;
  hasViolations: boolean;
  runNow: () => Promise<IntegrityReport | null>;
  refreshStatus: () => Promise<void>;
}

export function useIntegrityScheduler(): IntegritySchedulerState {
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);

  const isAdmin = Boolean(
    role &&
      (role.code === SYSTEM_ROLES.ADMIN ||
        RbacService.hasPermission(role, { module: 'SYS', activity: 'view' }))
  );

  const [lastRun, setLastRun] = useState<IntegrityRun | null>(null);
  const [lastReport, setLastReport] = useState<IntegrityReport | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const isRunningRef = useRef(false);

  const refreshStatus = useCallback(async () => {
    try {
      const { run, report } = await IntegrityService.getLastRun();
      setLastRun(run);
      setLastReport(report);
    } catch (err) {
      console.error('Failed to refresh integrity status:', err);
    }
  }, []);

  const runNow = useCallback(async (): Promise<IntegrityReport | null> => {
    if (isRunningRef.current) return null;
    isRunningRef.current = true;
    setIsRunning(true);
    try {
      const executedBy = user?.username ? `${user.username} (${role?.name || 'مدير'})` : undefined;
      const report = await IntegrityService.runIntegrityReport({ executedBy });
      await refreshStatus();
      return report;
    } catch (err) {
      console.error('Manual integrity run failed:', err);
      return null;
    } finally {
      isRunningRef.current = false;
      setIsRunning(false);
    }
  }, [user, role, refreshStatus]);

  useEffect(() => {
    if (!isAdmin) return;

    let timer: NodeJS.Timeout | null = null;

    const initAndSchedule = async () => {
      // 1. Check last run
      const { run } = await IntegrityService.getLastRun();
      const now = Date.now();
      const lastRunTime = run ? new Date(run.timestamp).getTime() : 0;
      const elapsed = now - lastRunTime;

      // Run automatically at app start if no run or last run was > 6 hours ago
      if (!run || elapsed >= SIX_HOURS_MS) {
        await runNow();
      } else {
        await refreshStatus();
      }

      // 2. Schedule recurring run every 6 hours while open
      timer = setInterval(() => {
        void runNow();
      }, SIX_HOURS_MS);
    };

    void initAndSchedule();

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isAdmin, runNow, refreshStatus]);

  const isOverdue = IntegrityService.isRunOverdue(lastRun?.timestamp);
  const hasViolations = Boolean(lastRun && (lastRun.status === 'FAIL' || lastRun.totalViolations > 0));

  return {
    lastRun,
    lastReport,
    isRunning,
    isOverdue,
    hasViolations,
    runNow,
    refreshStatus,
  };
}
