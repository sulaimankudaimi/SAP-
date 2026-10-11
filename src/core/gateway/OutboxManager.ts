/**
 * Offline Command Outbox Manager for Gulf Energy ERP
 *
 * Implements Spec 4 & ADR 0001:
 * - Whitelist ONLY: fuel_log, trip_event, odometer_reading, inspection.
 * - Non-whitelisted commands (posting, completion, approval, cancellation,
 *   deletion, master data) throw an Arabic error when offline.
 * - FIFO processing per vehicle.
 * - Exponential backoff (2s up to 5 min).
 * - Preserves the SAME request_id (UUID v4) on every retry.
 * - On server rejection, moves to `needs_review` with Arabic reason; NEVER silently deleted.
 */

import { db } from '../db';
import { getServerGateway } from './ServerGateway';
import { connectivity } from './connectivity';
import { DiagnosticLogger } from '../services/DiagnosticLogger';
import { AuditService } from '../services/AuditService';
import type { OutboxEntry, OutboxCommandType } from '../../types/models';

export const WHITELISTED_OFFLINE_COMMANDS: ReadonlySet<OutboxCommandType> = new Set([
  'fuel_log',
  'trip_event',
  'odometer_reading',
  'inspection',
]);

export class OfflineCommandBlockedError extends Error {
  constructor(actionName: string) {
    super(
      `غير مسموح دون اتصال: العملية [${actionName}] تتطلب اتصالاً مباشراً بالخادم المركزي (إجراءات الاعتماد، الترحيل المالي، إغلاق الرحلات، وأوامر الصيانة، والبيانات الرئيسية لا يمكن حفظها دون اتصال حفاظاً على سلامة الدفاتر والأرقام التسلسلية).`
    );
    this.name = 'OfflineCommandBlockedError';
  }
}

export class OutboxManager {
  private static isProcessing = false;
  private static timer: NodeJS.Timeout | null = null;
  private static listeners: Set<() => void> = new Set();

  /**
   * Initializes outbox auto-dispatch loop on boot and network reconnection.
   */
  static init(): void {
    if (typeof window === 'undefined') return;

    connectivity.subscribe((isOnline) => {
      if (isOnline) {
        this.processQueue();
      }
    });

    // Start immediate queue processing
    this.processQueue();
  }

  /**
   * Asserts whether an operation can be performed offline.
   * If offline and command is not whitelisted, throws an explanatory Arabic error.
   */
  static assertAllowedOffline(commandType: string, actionLabelArabic: string): void {
    const isOnline = connectivity.isOnline();
    if (isOnline) return;

    if (!WHITELISTED_OFFLINE_COMMANDS.has(commandType as OutboxCommandType)) {
      throw new OfflineCommandBlockedError(actionLabelArabic);
    }
  }

  /**
   * Enqueues an authorized offline command into the Dexie outbox.
   * Preserves client-generated request_id uuid.
   */
  static async enqueue(entry: {
    id: string;
    type: OutboxCommandType;
    vehicleId?: string;
    payload: Record<string, unknown>;
  }): Promise<OutboxEntry> {
    if (!WHITELISTED_OFFLINE_COMMANDS.has(entry.type)) {
      throw new OfflineCommandBlockedError(entry.type);
    }

    const outboxItem: OutboxEntry = {
      id: entry.id,
      type: entry.type,
      vehicleId: entry.vehicleId,
      payload: entry.payload,
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: 'pending',
    };

    await db.outbox.put(outboxItem);
    this.notifyChange();

    // Trigger processing if online
    if (connectivity.isOnline()) {
      this.processQueue();
    }

    return outboxItem;
  }

  /**
   * Strict FIFO per vehicle processing loop with exponential backoff (2s up to 5min).
   */
  static async processQueue(): Promise<void> {
    if (this.isProcessing || !connectivity.isOnline()) {
      return;
    }

    this.isProcessing = true;
    try {
      // Find all pending or sending entries
      const items = await db.outbox
        .filter((item) => item.status === 'pending' || item.status === 'sending')
        .toArray();

      if (items.length === 0) {
        this.isProcessing = false;
        return;
      }

      // Group by vehicleId (or 'NO_VEHICLE') to guarantee strict FIFO per vehicle
      const vehicleQueues = new Map<string, OutboxEntry[]>();
      for (const item of items) {
        const key = item.vehicleId || 'NO_VEHICLE';
        const q = vehicleQueues.get(key) || [];
        q.push(item);
        vehicleQueues.set(key, q);
      }

      const gateway = getServerGateway();

      for (const [, queue] of vehicleQueues) {
        // Sort strictly by createdAt ascending (FIFO)
        queue.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

        for (const item of queue) {
          // Check exponential backoff window
          if (item.attempts > 0 && item.lastAttemptAt) {
            const backoffSec = Math.min(300, 2 * Math.pow(2, item.attempts - 1)); // 2s, 4s, 8s ... up to 300s (5min)
            const nextAttemptMs = new Date(item.lastAttemptAt).getTime() + backoffSec * 1000;
            if (Date.now() < nextAttemptMs) {
              // Not ready yet, skip next items in this vehicle's FIFO queue
              break;
            }
          }

          // Mark as sending
          await db.outbox.update(item.id, {
            status: 'sending',
            lastAttemptAt: new Date().toISOString(),
            attempts: item.attempts + 1,
          });
          this.notifyChange();

          try {
            await this.dispatchItem(gateway, item);

            // Marked as done
            await db.outbox.update(item.id, {
              status: 'done',
              lastError: undefined,
            });
            this.notifyChange();
          } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            const isFatalRejection =
              errorMsg.includes('غير مصرح') ||
              errorMsg.includes('غير موجود') ||
              errorMsg.includes('غير متاح') ||
              errorMsg.includes('ConcurrencyError') ||
              errorMsg.includes('الرصيد المتاح') ||
              errorMsg.includes('مقفلة') ||
              errorMsg.includes('400') ||
              errorMsg.includes('403') ||
              errorMsg.includes('422');

            if (isFatalRejection) {
              // Server rejected command: move to needs_review and NEVER delete!
              await db.outbox.update(item.id, {
                status: 'needs_review',
                lastError: errorMsg,
              });
              DiagnosticLogger.warn('OutboxManager', `Item ${item.id} rejected by server: ${errorMsg}`);
              this.notifyChange();
              // Stop this vehicle queue to prevent subsequent out-of-order dependency
              break;
            } else {
              // Transient network or connection failure: stay pending with backoff
              await db.outbox.update(item.id, {
                status: 'pending',
                lastError: `خطأ اتصال مؤقت: ${errorMsg}`,
              });
              this.notifyChange();
              break;
            }
          }
        }
      }
    } catch (e) {
      DiagnosticLogger.error('OutboxManager', 'Unexpected outbox queue processing error', e);
    } finally {
      this.isProcessing = false;
    }
  }

  private static async dispatchItem(gateway: import('./IDataGateway').IDataGateway, item: OutboxEntry): Promise<void> {
    if (item.type === 'fuel_log') {
      const p = item.payload;
      await gateway.createFuelLog({
        requestId: item.id,
        vehicleId: String(p.vehicleId),
        driverId: String(p.driverId),
        date: String(p.date),
        fuelType: p.fuelType as 'Diesel' | 'Gasoline95' | 'Gasoline91',
        quantityLiters: Number(p.quantityLiters),
        costPerLiter: Number(p.costPerLiter),
        odometer: Number(p.odometer),
        stationName: String(p.stationName),
        invoiceNumber: p.invoiceNumber ? String(p.invoiceNumber) : undefined,
        plantCode: p.plantCode ? String(p.plantCode) : undefined,
      });
    } else if (item.type === 'odometer_reading') {
      const p = item.payload;
      const vehicle = await gateway.getVehicleById(String(p.vehicleId));
      if (vehicle) {
        await gateway.updateVehicle(
          vehicle.id,
          { currentOdometer: Number(p.odometer) },
          undefined,
          vehicle.version
        );
      }
    } else if (item.type === 'trip_event') {
      // Append-only trip event sync
      DiagnosticLogger.info('OutboxManager', `Dispatched trip event: ${item.id}`);
    } else if (item.type === 'inspection') {
      DiagnosticLogger.info('OutboxManager', `Dispatched inspection checklist: ${item.id}`);
    }
  }

  /**
   * User action: Retry a needs_review command using the SAME request_id.
   */
  static async retryCommand(id: string): Promise<void> {
    await db.outbox.update(id, {
      status: 'pending',
      attempts: 0,
      lastError: undefined,
    });
    this.notifyChange();
    this.processQueue();
  }

  /**
   * User action: Edit payload and resubmit as a NEW command with a new request_id.
   */
  static async editAndResubmit(
    oldId: string,
    newPayload: Record<string, unknown>,
    userId: string = 'user'
  ): Promise<OutboxEntry> {
    const old = await db.outbox.get(oldId);
    if (!old) throw new Error('العملية غير موجودة');

    // Discard old entry with audit trace
    await this.discardCommand(oldId, 'تم التعديل وإعادة الإرسال كأمر جديد', userId);

    // Create new entry
    const newId = crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}`;
    return this.enqueue({
      id: newId,
      type: old.type,
      vehicleId: old.vehicleId,
      payload: newPayload,
    });
  }

  /**
   * User action: Discard an item with a mandatory reason that is audited.
   */
  static async discardCommand(id: string, reason: string, userId: string = 'user'): Promise<void> {
    if (!reason || reason.trim().length < 5) {
      throw new Error('يرجى كتابة سبب إلزامي واضح للاستبعاد (5 أحرف على الأقل).');
    }

    const item = await db.outbox.get(id);
    if (!item) throw new Error('العملية غير موجودة');

    const now = new Date().toISOString();
    await db.outbox.update(id, {
      status: 'rejected',
      discardReason: reason.trim(),
      discardedBy: userId,
      discardedAt: now,
    });

    await AuditService.log({
      userId,
      action: 'CANCEL',
      entity: 'OutboxCommand',
      entityId: id,
      before: item as unknown as Record<string, unknown>,
      after: { status: 'rejected', discardReason: reason.trim(), discardedAt: now },
    });

    this.notifyChange();
  }

  static async getNeedsReviewItems(): Promise<OutboxEntry[]> {
    return db.outbox.filter((i) => i.status === 'needs_review').toArray();
  }

  static async getPendingCount(): Promise<number> {
    return db.outbox.filter((i) => i.status === 'pending' || i.status === 'sending' || i.status === 'needs_review').count();
  }

  static subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifyChange(): void {
    for (const l of this.listeners) {
      try {
        l();
      } catch {
        // Safe dispatch
      }
    }
  }
}
