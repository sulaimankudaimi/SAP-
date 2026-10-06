import { db } from '../db';
import type { Notification } from '../../types/models';

export class NotificationService {
  /**
   * Retrieves notifications with optional filtering.
   */
  static async getNotifications(filters?: {
    type?: string;
    isRead?: boolean;
    userId?: string;
  }): Promise<Notification[]> {
    let list = await db.notifications.filter((n) => !n.isDeleted).toArray();

    if (filters?.type && filters.type !== 'ALL') {
      list = list.filter((n) => n.type === filters.type);
    }
    if (filters?.isRead !== undefined) {
      list = list.filter((n) => n.isRead === filters.isRead);
    }
    if (filters?.userId) {
      list = list.filter((n) => n.userId === filters.userId || n.userId === 'ALL' || n.userId === 'SYSTEM');
    }

    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Marks a single notification as read.
   */
  static async markAsRead(id: string): Promise<void> {
    await db.notifications.update(id, { isRead: true });
  }

  /**
   * Marks all active notifications as read.
   */
  static async markAllAsRead(userId?: string): Promise<void> {
    const notifications = await this.getNotifications({ isRead: false, userId });
    for (const notif of notifications) {
      await db.notifications.update(notif.id, { isRead: true });
    }
  }

  /**
   * Deletes a notification (soft delete).
   */
  static async deleteNotification(id: string): Promise<void> {
    await db.notifications.update(id, { isDeleted: true });
  }

  /**
   * Generates system notifications for:
   * 1. Contract expiry (within 30 days)
   * 2. Reorder stock alerts
   * 3. Blocked vendor invoices (3-way match)
   * 4. Fleet maintenance due / vehicle registration expiry
   * 5. Pending approvals awaiting action
   */
  static async generateSystemNotifications(): Promise<number> {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const in30Days = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);

    const existingNotifs = await db.notifications.filter((n) => !n.isDeleted && !n.isRead).toArray();
    const existingDocKeys = new Set(existingNotifs.map((n) => `${n.documentType}:${n.documentId}`));

    let newCount = 0;
    const newNotifications: Notification[] = [];

    // 1. Contract Expiry Generator
    const contracts = await db.contracts.filter((c) => !c.isDeleted && c.status === 'active').toArray();
    for (const c of contracts) {
      if (c.validTo && c.validTo <= in30Days && !existingDocKeys.has(`CONTRACT:${c.id}`)) {
        newNotifications.push({
          id: `notif-cnt-${c.id}-${Date.now()}`,
          userId: 'ALL',
          title: 'تنبيه اقتراب انتهاء عقد توريد',
          message: `عقد التوريد [${c.docNumber} - ${c.title || c.vendorCode}] ينتهي بتاريخ ${c.validTo}. يرجى مراجعة التجديد.`,
          type: 'procurement',
          isRead: false,
          link: '/procurement/contracts',
          documentType: 'CONTRACT',
          documentId: c.id,
          documentNumber: c.docNumber,
          createdAt: now.toISOString(),
          isDeleted: false,
        });
        existingDocKeys.add(`CONTRACT:${c.id}`);
        newCount++;
      }
    }

    // 2. Reorder Stock Alerts Generator
    const inventoryAlerts = await db.inventoryAlerts.filter((a) => !a.isDeleted && a.status === 'active').toArray();
    for (const alert of inventoryAlerts) {
      if (!existingDocKeys.has(`ALERT:${alert.id}`)) {
        newNotifications.push({
          id: `notif-alt-${alert.id}-${Date.now()}`,
          userId: 'ALL',
          title: alert.alertType === 'critical' ? 'تحذير حرج: هبوط المخزون دون حد الأمان!' : 'تنبيه طلب مواد: وصول نقطة إعادة الطلب',
          message: `المادة [${alert.materialName} (${alert.materialCode})] بالمستودع ${alert.plantCode}: الرصيد الحالي ${alert.currentStock} ${alert.unit}.`,
          type: 'inventory',
          isRead: false,
          link: '/inventory/reorder',
          documentType: 'ALERT',
          documentId: alert.id,
          documentNumber: alert.materialCode,
          createdAt: now.toISOString(),
          isDeleted: false,
        });
        existingDocKeys.add(`ALERT:${alert.id}`);
        newCount++;
      }
    }

    // 3. Blocked Invoices Generator (3-Way Matching)
    const blockedInvoices = await db.vendorInvoices.filter((i) => !i.isDeleted && Boolean(i.isPaymentBlocked)).toArray();
    for (const inv of blockedInvoices) {
      if (!existingDocKeys.has(`INVOICE:${inv.id}`)) {
        newNotifications.push({
          id: `notif-inv-${inv.id}-${Date.now()}`,
          userId: 'ALL',
          title: 'فاتورة مورد محجوبة عن الصرف (3-Way Match Block)',
          message: `فاتورة المورد ${inv.vendorName || inv.vendorCode} برقم [${inv.vendorInvoiceNumber}] محجوبة لوجود فروقات سعرية أو كمية.`,
          type: 'finance',
          isRead: false,
          link: '/finance/payables',
          documentType: 'INVOICE',
          documentId: inv.id,
          documentNumber: inv.docNumber,
          createdAt: now.toISOString(),
          isDeleted: false,
        });
        existingDocKeys.add(`INVOICE:${inv.id}`);
        newCount++;
      }
    }

    // 4. Fleet Maintenance & Registration Due Generator
    const vehicles = await db.vehicles.filter((v) => !v.isDeleted).toArray();
    for (const veh of vehicles) {
      const isRegDue = veh.registrationExpiry && veh.registrationExpiry <= in30Days;
      const isInsDue = veh.insuranceExpiry && veh.insuranceExpiry <= in30Days;
      if ((isRegDue || isInsDue) && !existingDocKeys.has(`VEHICLE:${veh.id}`)) {
        newNotifications.push({
          id: `notif-veh-${veh.id}-${Date.now()}`,
          userId: 'ALL',
          title: 'تنبيه أسطول: تجديد استمارة / تأمين مركبة',
          message: `المركبة [${veh.plateNumber} - ${veh.makeModel}] يتطلب فحص تجديد ${isRegDue ? 'الاستمارة' : 'التأمين'} قبل ${veh.registrationExpiry || veh.insuranceExpiry}.`,
          type: 'fleet',
          isRead: false,
          link: '/fleet/vehicles',
          documentType: 'VEHICLE',
          documentId: veh.id,
          documentNumber: veh.plateNumber,
          createdAt: now.toISOString(),
          isDeleted: false,
        });
        existingDocKeys.add(`VEHICLE:${veh.id}`);
        newCount++;
      }
    }

    // 5. Pending Approvals Generator
    const pendingApprovals = await db.approvalRequests.filter((a) => !a.isDeleted && a.status === 'pending').toArray();
    for (const apr of pendingApprovals) {
      const currentStep = apr.steps[apr.currentStep - 1];
      if (!existingDocKeys.has(`APPROVAL:${apr.id}`)) {
        newNotifications.push({
          id: `notif-apr-${apr.id}-${Date.now()}`,
          userId: currentStep?.roleCode || 'ALL',
          title: `طلب اعتماد بانتظارك: ${apr.documentNumber}`,
          message: `يتطلب المستند ${apr.documentType} رقم [${apr.documentNumber}] بقيمة ${apr.amount.toLocaleString()} ${apr.currency} موافقتك كـ [${currentStep?.roleName}].`,
          type: 'approval',
          isRead: false,
          link: '/approvals',
          documentType: 'APPROVAL',
          documentId: apr.id,
          documentNumber: apr.documentNumber,
          createdAt: now.toISOString(),
          isDeleted: false,
        });
        existingDocKeys.add(`APPROVAL:${apr.id}`);
        newCount++;
      }
    }

    if (newNotifications.length > 0) {
      await db.notifications.bulkAdd(newNotifications);
    }

    return newCount;
  }
}
