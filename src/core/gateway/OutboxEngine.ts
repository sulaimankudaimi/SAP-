import { db } from '../db';
import type { OutboxCommand, OutboxCommandType } from '../../types/models';
import { useConnectivityStore } from './connectivity';
import { DiagnosticLogger } from '../services/DiagnosticLogger';
import { AuditService } from '../services/AuditService';
import type { IDataGateway } from './IDataGateway';

export const WHITELISTED_OFFLINE_COMMANDS: ReadonlyArray<OutboxCommandType> = [
  'fuel_log',
  'trip_event',
  'odometer_reading',
  'inspection',
];

export const OFFLINE_BLOCKED_ARABIC_EXPLANATION =
  'لا يمكن تنفيذ هذه العملية بدون اتصال بالخادم. العمليات غير المعتمدة للعمل دون اتصال: (الترحيل، الإكمال، الاعتماد، الإلغاء، الحذف، والبيانات الرئيسية). يرجى التحقق من اتصال الشبكة.';

export function isCommandWhitelisted(type: string): type is OutboxCommandType {
  return WHITELISTED_OFFLINE_COMMANDS.includes(type as OutboxCommandType);
}

export function assertCommandWhitelisted(type: string): void {
  if (!isCommandWhitelisted(type)) {
    throw new Error(OFFLINE_BLOCKED_ARABIC_EXPLANATION);
  }
}

/**
 * Generates standard UUID v4 for request_id idempotency tracking
 */
export function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'req-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 10);
}

let isProcessing = false;

export class OutboxEngine {
  /**
   * Enqueues an offline command into the Dexie outbox table.
   * Whitelist check is enforced before writing.
   */
  static async enqueue(options: {
    type: OutboxCommandType;
    payload: Record<string, unknown>;
    vehicleId?: string;
    customId?: string;
  }): Promise<OutboxCommand> {
    assertCommandWhitelisted(options.type);

    const requestId = options.customId || generateRequestId();
    const now = new Date().toISOString();

    const command: OutboxCommand = {
      id: requestId,
      type: options.type,
      payload: options.payload,
      createdAt: now,
      attempts: 0,
      status: 'pending',
      vehicleId: options.vehicleId || (options.payload.vehicleId as string) || undefined,
    };

    await db.outbox.add(command);
    await useConnectivityStore.getState().refreshOutboxCounts();

    // Trigger background process if online
    if (useConnectivityStore.getState().isOnline) {
      setTimeout(() => {
        OutboxEngine.processQueue().catch((err) => {
          DiagnosticLogger.warn('OutboxEngine', 'Background processQueue failed:', err);
        });
      }, 50);
    }

    return command;
  }

  /**
   * Processes the outbox with strict FIFO per vehicle and exponential backoff.
   * Does not drop rejected items (moves them to needs_review).
   * Reuses the exact same request_id on each retry.
   */
  static async processQueue(gatewayOverride?: IDataGateway): Promise<void> {
    if (isProcessing) return;
    if (!useConnectivityStore.getState().isOnline) return;

    isProcessing = true;
    useConnectivityStore.getState().setSyncing(true);

    try {
      // 1. Fetch pending and sending commands
      const items = await db.outbox
        .where('status')
        .equals('pending')
        .or('status')
        .equals('sending')
        .toArray();

      if (items.length === 0) {
        return;
      }

      // 2. Group by vehicleId to enforce strict FIFO per vehicle
      const groupedByVehicle = new Map<string, OutboxCommand[]>();
      for (const item of items) {
        const key = item.vehicleId || '__unassigned__';
        const list = groupedByVehicle.get(key) || [];
        list.push(item);
        groupedByVehicle.set(key, list);
      }

      // Dynamically resolve gateway if not provided
      let gateway = gatewayOverride;
      if (!gateway) {
        const { getGateway } = await import('./ServerGateway');
        gateway = getGateway();
      }

      // 3. Process each vehicle queue in strict FIFO order
      for (const [, queue] of groupedByVehicle.entries()) {
        // Sort strictly by createdAt ascending
        queue.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        for (const cmd of queue) {
          // Check exponential backoff: 2s up to 5 min
          if (cmd.attempts > 0 && cmd.updatedAt) {
            const backoffMs = Math.min(300000, 2000 * Math.pow(2, cmd.attempts - 1));
            const elapsed = Date.now() - new Date(cmd.updatedAt).getTime();
            if (elapsed < backoffMs) {
              // Not yet time for this command, stop subsequent commands for this vehicle
              break;
            }
          }

          const currentAttempt = cmd.attempts + 1;
          const now = new Date().toISOString();

          // Mark as sending with same request_id
          await db.outbox.update(cmd.id, {
            status: 'sending',
            attempts: currentAttempt,
            updatedAt: now,
          });

          try {
            await OutboxEngine.dispatchCommand(gateway, cmd);

            // Marked as done on successful execution
            await db.outbox.update(cmd.id, {
              status: 'done',
              updatedAt: new Date().toISOString(),
            });
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            const isRejection =
              errorMsg.includes('rejected') ||
              errorMsg.includes('رفض') ||
              errorMsg.includes('غير صالح') ||
              errorMsg.includes('invalid') ||
              errorMsg.includes('business') ||
              errorMsg.includes('validation');

            if (isRejection) {
              // Server rejected item: move to needs_review with Arabic reason. NEVER DELETE!
              await db.outbox.update(cmd.id, {
                status: 'needs_review',
                lastError: errorMsg,
                updatedAt: new Date().toISOString(),
              });
              // Stop subsequent commands for this vehicle until user resolves this command
              break;
            } else {
              // Transient network or connection failure: stay pending with backoff
              await db.outbox.update(cmd.id, {
                status: 'pending',
                lastError: errorMsg,
                updatedAt: new Date().toISOString(),
              });
              // Stop subsequent commands for this vehicle
              break;
            }
          }
        }
      }
    } finally {
      isProcessing = false;
      useConnectivityStore.getState().setSyncing(false);
      await useConnectivityStore.getState().refreshOutboxCounts();
    }
  }

  /**
   * Internal dispatcher for sending outbox commands to the gateway
   */
  private static async dispatchCommand(gateway: IDataGateway, cmd: OutboxCommand): Promise<void> {
    switch (cmd.type) {
      case 'fuel_log': {
        const payload = cmd.payload as unknown as import('./IDataGateway').CreateFuelLogCommand;
        await gateway.createFuelLog({
          ...payload,
          requestId: cmd.id, // Ensure request_id is reused on every retry
        });
        break;
      }
      case 'trip_event':
      case 'odometer_reading':
      case 'inspection': {
        // Dispatch to generic command RPC or maintenance/trip handler
        if (cmd.payload.tripId && gateway.completeTrip) {
          const payload = cmd.payload as unknown as import('./IDataGateway').CompleteTripCommand;
          await gateway.completeTrip({
            ...payload,
            requestId: cmd.id,
          });
        } else if (gateway.createTrip) {
          const payload = cmd.payload as unknown as import('./IDataGateway').CreateTripCommand;
          await gateway.createTrip({
            ...payload,
            requestId: cmd.id,
          });
        }
        break;
      }
      default:
        throw new Error(`نوع العملية (${cmd.type}) غير معروف في قائمة انتظار الإرسال.`);
    }
  }

  /**
   * Retries an item in 'needs_review' or 'rejected' status.
   * Resets status to 'pending' so the FIFO sender loop re-picks it up.
   */
  static async retryItem(id: string): Promise<void> {
    const item = await db.outbox.get(id);
    if (!item) throw new Error('العملية غير موجودة في صندوق الإرسال.');

    await db.outbox.update(id, {
      status: 'pending',
      attempts: 0,
      lastError: undefined,
      updatedAt: new Date().toISOString(),
    });

    await useConnectivityStore.getState().refreshOutboxCounts();
    OutboxEngine.processQueue().catch((err) => {
      DiagnosticLogger.warn('OutboxEngine', 'Retry processQueue error:', err);
    });
  }

  /**
   * Edits the payload of a rejected command and resubmits it as a fresh command.
   * The old command is marked as replaced, and the new command is enqueued.
   */
  static async editAndResubmit(
    oldId: string,
    newPayload: Record<string, unknown>
  ): Promise<OutboxCommand> {
    const oldItem = await db.outbox.get(oldId);
    if (!oldItem) throw new Error('العملية الأصلية غير موجودة.');

    // Remove or mark old item done/superseded
    await db.outbox.update(oldId, {
      status: 'done',
      lastError: `تم استبدال العملية بالعملية المعدلة الجديدة`,
      updatedAt: new Date().toISOString(),
    });

    // Enqueue as a fresh command
    const newCmd = await OutboxEngine.enqueue({
      type: oldItem.type,
      payload: newPayload,
      vehicleId: (newPayload.vehicleId as string) || oldItem.vehicleId,
    });

    return newCmd;
  }

  /**
   * Discards a command from the outbox with a mandatory audited reason.
   */
  static async discardItem(options: {
    id: string;
    reason: string;
    userId: string;
    userName?: string;
  }): Promise<void> {
    if (!options.reason || !options.reason.trim()) {
      throw new Error('سبب استبعاد العملية إلزامي ولا يمكن تركه فارغاً.');
    }

    const item = await db.outbox.get(options.id);
    if (!item) throw new Error('العملية غير موجودة في صندوق الإرسال.');

    // Log mandatory audit entry for discarding unposted command
    await AuditService.log({
      userId: options.userId,
      userName: options.userName || 'مدير الأسطول',
      action: 'DELETE',
      entity: 'OutboxCommand',
      entityId: item.id,
      before: item as unknown as Record<string, unknown>,
      after: {
        discardReason: options.reason.trim(),
        discardedAt: new Date().toISOString(),
      },
    });

    await db.outbox.delete(options.id);
    await useConnectivityStore.getState().refreshOutboxCounts();
  }
}
