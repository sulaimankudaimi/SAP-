import { useState, useEffect } from 'react';
import { db } from '../db';
import { SessionContext } from '../security/SessionContext';
import { DiagnosticLogger } from './DiagnosticLogger';

/**
 * Service to dynamically compute live navigation badges from Dexie IndexedDB.
 * Completely read-only with no side effects or hardcoded values.
 */
export class NavBadgeService {
  /**
   * Computes badge counts for sidebar navigation items based on real database records:
   * - pending PR: purchaseRequisitions with status 'Submitted' and not deleted
   * - pending PO: purchaseOrders with status 'PendingApproval' and not deleted
   * - notifications: unread notifications for the current authenticated actor
   * - approvals inbox: approvalRequests pending for the actor's role
   * - blocked invoices: vendorInvoices with isPaymentBlocked true
   * - reorder alerts: open inventoryAlerts ('active' or 'acknowledged')
   */
  static async getBadgeCounts(): Promise<Record<string, number>> {
    let pendingPr = 0;
    try {
      pendingPr = await db.purchaseRequisitions
        .filter((pr) => !pr.isDeleted && pr.status === 'Submitted')
        .count();
    } catch {
      pendingPr = 0;
    }

    let pendingPo = 0;
    try {
      pendingPo = await db.purchaseOrders
        .filter((po) => !po.isDeleted && po.status === 'PendingApproval')
        .count();
    } catch {
      pendingPo = 0;
    }

    let unreadNotifs = 0;
    try {
      const actor = SessionContext.getActor();
      if (actor?.userId) {
        unreadNotifs = await db.notifications
          .filter((n) => !n.isRead && (!n.userId || n.userId === actor.userId))
          .count();
      }
    } catch {
      unreadNotifs = 0;
    }

    let pendingApprovals = 0;
    try {
      const actor = SessionContext.getActor();
      const roleCode = actor?.role?.code;
      if (roleCode) {
        const isSysAdmin = roleCode === 'ADMIN' || roleCode === 'SYS_ADMIN';
        pendingApprovals = await db.approvalRequests
          .filter((req) => {
            if (req.isDeleted || req.status !== 'pending') return false;
            if (isSysAdmin) return true;
            const currentStep = req.steps?.[req.currentStep];
            if (currentStep?.status === 'pending' && currentStep?.roleCode === roleCode) {
              return true;
            }
            return (
              req.steps?.some(
                (s) => s.status === 'pending' && s.roleCode === roleCode
              ) ?? false
            );
          })
          .count();
      }
    } catch {
      pendingApprovals = 0;
    }

    let blockedInvoices = 0;
    try {
      blockedInvoices = await db.vendorInvoices
        .filter((inv) => !inv.isDeleted && Boolean(inv.isPaymentBlocked))
        .count();
    } catch {
      blockedInvoices = 0;
    }

    let reorderAlerts = 0;
    try {
      reorderAlerts = await db.inventoryAlerts
        .filter(
          (alert) =>
            !alert.isDeleted &&
            (alert.status === 'active' || alert.status === 'acknowledged')
        )
        .count();
    } catch {
      reorderAlerts = 0;
    }

    return {
      pr: pendingPr,
      po: pendingPo,
      procurement: pendingPr + pendingPo,
      notifications: unreadNotifs,
      approvals: pendingApprovals,
      ap: blockedInvoices,
      reorder: reorderAlerts,
      inventory: reorderAlerts,
      // Named aliases for test convenience
      pendingPR: pendingPr,
      pendingPO: pendingPo,
      blockedInvoices,
      reorderAlerts,
    };
  }
}

/**
 * React hook that loads live badge counts on mount, on window focus,
 * and polls every 60 seconds. Cleans up its interval and event listeners.
 */
export function useNavBadges(): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let isMounted = true;

    const fetchCounts = async () => {
      try {
        const data = await NavBadgeService.getBadgeCounts();
        if (isMounted) {
          setCounts(data);
        }
      } catch (err) {
        DiagnosticLogger.error(
          'useNavBadges',
          'Failed to retrieve navigation badge counts',
          err
        );
      }
    };

    fetchCounts();

    const handleFocus = () => {
      fetchCounts();
    };

    window.addEventListener('focus', handleFocus);
    const timer = setInterval(fetchCounts, 60000);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
      clearInterval(timer);
    };
  }, []);

  return counts;
}
