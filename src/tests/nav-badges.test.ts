import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../core/db';
import { NavBadgeService } from '../core/services/NavBadgeService';
import { SessionContext } from '../core/security/SessionContext';
import type {
  PurchaseRequisition,
  PurchaseOrder,
  Notification,
  ApprovalRequest,
  VendorInvoice,
  InventoryAlert,
  Role,
} from '../types/models';

describe('NavBadgeService Live Metrics Suite (D3)', () => {
  beforeEach(async () => {
    SessionContext.clearActor();
    await db.purchaseRequisitions.clear();
    await db.purchaseOrders.clear();
    await db.notifications.clear();
    await db.approvalRequests.clear();
    await db.vendorInvoices.clear();
    await db.inventoryAlerts.clear();
  });

  it('returns zero for all badges when database tables are empty', async () => {
    const counts = await NavBadgeService.getBadgeCounts();

    expect(counts.pr).toBe(0);
    expect(counts.po).toBe(0);
    expect(counts.procurement).toBe(0);
    expect(counts.notifications).toBe(0);
    expect(counts.approvals).toBe(0);
    expect(counts.ap).toBe(0);
    expect(counts.reorder).toBe(0);
    expect(counts.inventory).toBe(0);
  });

  it('computes exact counts matching seeded records without mutating database', async () => {
    const testRole: Role = {
      id: 'r-proc',
      code: 'PROC_MGR',
      name: 'مدير المشتريات',
      description: 'Procurement Manager',
      permissionCodes: ['*'],
      isSystem: false,
    };

    SessionContext.setActor({
      userId: 'u-proc-1',
      username: 'proc.mgr',
      role: testRole,
    });

    // 1. Purchase Requisitions: 2 Submitted, 1 Draft, 1 Deleted Submitted
    const prs: Partial<PurchaseRequisition>[] = [
      { id: 'pr-1', status: 'Submitted', isDeleted: false },
      { id: 'pr-2', status: 'Submitted', isDeleted: false },
      { id: 'pr-3', status: 'Draft', isDeleted: false },
      { id: 'pr-4', status: 'Submitted', isDeleted: true },
    ];
    await db.purchaseRequisitions.bulkAdd(prs as PurchaseRequisition[]);

    // 2. Purchase Orders: 3 PendingApproval, 1 Approved, 1 Deleted
    const pos: Partial<PurchaseOrder>[] = [
      { id: 'po-1', status: 'PendingApproval', isDeleted: false },
      { id: 'po-2', status: 'PendingApproval', isDeleted: false },
      { id: 'po-3', status: 'PendingApproval', isDeleted: false },
      { id: 'po-4', status: 'Approved', isDeleted: false },
      { id: 'po-5', status: 'PendingApproval', isDeleted: true },
    ];
    await db.purchaseOrders.bulkAdd(pos as PurchaseOrder[]);

    // 3. Notifications: 2 unread for current user, 1 read for current user, 1 unread for another user
    const notifs: Partial<Notification>[] = [
      { id: 'notif-1', userId: 'u-proc-1', isRead: false },
      { id: 'notif-2', userId: 'u-proc-1', isRead: false },
      { id: 'notif-3', userId: 'u-proc-1', isRead: true },
      { id: 'notif-4', userId: 'other-user', isRead: false },
    ];
    await db.notifications.bulkAdd(notifs as Notification[]);

    // 4. Approval Requests: 1 pending matching role, 1 approved, 1 pending for other role
    const approvals: Partial<ApprovalRequest>[] = [
      {
        id: 'app-1',
        status: 'pending',
        currentStep: 0,
        isDeleted: false,
        steps: [{ stepNumber: 0, roleCode: 'PROC_MGR', roleName: 'Proc', status: 'pending' }],
      },
      {
        id: 'app-2',
        status: 'approved',
        currentStep: 0,
        isDeleted: false,
        steps: [{ stepNumber: 0, roleCode: 'PROC_MGR', roleName: 'Proc', status: 'approved' }],
      },
      {
        id: 'app-3',
        status: 'pending',
        currentStep: 0,
        isDeleted: false,
        steps: [{ stepNumber: 0, roleCode: 'FIN_MGR', roleName: 'Finance', status: 'pending' }],
      },
    ];
    await db.approvalRequests.bulkAdd(approvals as ApprovalRequest[]);

    // 5. Vendor Invoices: 2 blocked, 2 unblocked, 1 deleted
    const invoices: Partial<VendorInvoice>[] = [
      { id: 'inv-1', isPaymentBlocked: true, isDeleted: false },
      { id: 'inv-2', isPaymentBlocked: true, isDeleted: false },
      { id: 'inv-3', isPaymentBlocked: false, isDeleted: false },
      { id: 'inv-4', isPaymentBlocked: true, isDeleted: true },
    ];
    await db.vendorInvoices.bulkAdd(invoices as VendorInvoice[]);

    // 6. Inventory Alerts: 3 active, 1 acknowledged, 1 resolved, 1 deleted
    const alerts: Partial<InventoryAlert>[] = [
      { id: 'alt-1', status: 'active', isDeleted: false },
      { id: 'alt-2', status: 'active', isDeleted: false },
      { id: 'alt-3', status: 'acknowledged', isDeleted: false },
      { id: 'alt-4', status: 'resolved', isDeleted: false },
      { id: 'alt-5', status: 'active', isDeleted: true },
    ];
    await db.inventoryAlerts.bulkAdd(alerts as InventoryAlert[]);

    const counts = await NavBadgeService.getBadgeCounts();

    expect(counts.pr).toBe(2);
    expect(counts.po).toBe(3);
    expect(counts.procurement).toBe(5);
    expect(counts.notifications).toBe(2);
    expect(counts.approvals).toBe(1);
    expect(counts.ap).toBe(2);
    expect(counts.reorder).toBe(3);
    expect(counts.inventory).toBe(3);
  });
});
