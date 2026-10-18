import { z } from 'zod';
import { db } from '../db';
import type { OutboxCommand, OutboxCommandType } from '../../types/models';
import { useConnectivityStore } from './connectivity';
import { DiagnosticLogger } from '../services/DiagnosticLogger';
import { AuditService } from '../services/AuditService';
import type { IDataGateway } from './IDataGateway';
import {
  ValidationError,
  ChronologyError,
  AlreadyProcessed,
} from '../errors';

export const WHITELISTED_OFFLINE_COMMANDS: ReadonlyArray<OutboxCommandType> = [
  'fuel_log',
  'trip_event',
  'odometer_reading',
  'inspection',
];

export const OFFLINE_BLOCKED_ARABIC_EXPLANATION =
  'لا يمكن تنفيذ هذه العملية بدون اتصال بالخادم. العمليات غير المعتمدة للعمل دون اتصال: (الترحيل، الإكمال، الاعتماد، الإلغاء، الحذف، والبيانات الرئيسية). يرجى التحقق من اتصال الشبكة.';

// ----------------------------------------------------------------------------
// Zod Schemas for Strict Offline Command Payloads
// ----------------------------------------------------------------------------

export const fuelLogPayloadSchema = z
  .object({
    vehicleId: z.string().min(1, 'معرف المركبة مطلوب'),
    liters: z.number().optional(),
    quantityLiters: z.number().optional(),
    cost: z.number().optional(),
    costPerLiter: z.number().optional(),
    fuelType: z.string().optional().default('Diesel'),
    currentOdometer: z.number().optional(),
    odometer: z.number().optional(),
    driverId: z.string().optional(),
    vendorName: z.string().optional(),
    invoiceNumber: z.string().optional(),
    stationLocation: z.string().optional(),
    stationName: z.string().optional(),
    date: z.string().optional(),
    occurredAt: z.string().optional(),
  })
  .transform((data) => {
    const liters = data.liters ?? data.quantityLiters ?? 0;
    const cost =
      data.cost ?? (data.costPerLiter !== undefined ? data.costPerLiter * liters : 0);
    const currentOdometer = data.currentOdometer ?? data.odometer ?? 0;
    const stationLocation = data.stationLocation || data.stationName || 'محطة المحروقات';
    const occurredAt = data.occurredAt || data.date || new Date().toISOString();
    return {
      ...data,
      liters,
      cost,
      currentOdometer,
      stationLocation,
      occurredAt,
    };
  });

export const tripEventPayloadSchema = z.object({
  tripId: z.string().min(1, 'معرف الرحلة مطلوب'),
  vehicleId: z.string().min(1, 'معرف المركبة مطلوب'),
  eventType: z.enum(['departed', 'arrived', 'delayed', 'incident'], {
    errorMap: () => ({ message: 'نوع الحدث التشغيلي غير مدعوم' }),
  }),
  occurredAt: z.string().min(1, 'وقت وقوع الحدث مطلوب'),
  payload: z.record(z.unknown()).optional(),
});

export const odometerReadingPayloadSchema = z.object({
  vehicleId: z.string().min(1, 'معرف المركبة مطلوب'),
  readingKm: z.number().min(0, 'قراءة العداد لا يمكن أن تكون سالبة'),
  capturedAt: z.string().min(1, 'وقت تسجيل القراءة مطلوب'),
  source: z.string().optional(),
});

export const inspectionPayloadSchema = z.object({
  vehicleId: z.string().min(1, 'معرف المركبة مطلوب'),
  inspectedAt: z.string().min(1, 'تاريخ وتوقيت الفحص مطلوب'),
  result: z.enum(['pass', 'fail', 'warning'], {
    errorMap: () => ({ message: 'نتيجة الفحص غير صالحة' }),
  }),
  notes: z.string().optional(),
  checklist: z.record(z.unknown()).optional(),
});

export function validatePayload(
  type: string,
  payload: Record<string, unknown>
): { success: true; data: Record<string, unknown> } | { success: false; error: string } {
  switch (type) {
    case 'fuel_log': {
      const res = fuelLogPayloadSchema.safeParse(payload);
      return res.success
        ? { success: true, data: res.data as Record<string, unknown> }
        : {
            success: false,
            error: (res.error.issues || []).map((e: { message: string }) => e.message).join('، '),
          };
    }
    case 'trip_event': {
      const res = tripEventPayloadSchema.safeParse(payload);
      return res.success
        ? { success: true, data: res.data as Record<string, unknown> }
        : {
            success: false,
            error: (res.error.issues || []).map((e: { message: string }) => e.message).join('، '),
          };
    }
    case 'odometer_reading': {
      const res = odometerReadingPayloadSchema.safeParse(payload);
      return res.success
        ? { success: true, data: res.data as Record<string, unknown> }
        : {
            success: false,
            error: (res.error.issues || []).map((e: { message: string }) => e.message).join('، '),
          };
    }
    case 'inspection': {
      const res = inspectionPayloadSchema.safeParse(payload);
      return res.success
        ? { success: true, data: res.data as Record<string, unknown> }
        : {
            success: false,
            error: (res.error.issues || []).map((e: { message: string }) => e.message).join('، '),
          };
    }
    default:
      return {
        success: false,
        error: `نوع العملية (${type}) غير مدعوم في القائمة البيضاء الميدانية.`,
      };
  }
}

export function isCommandWhitelisted(type: string): type is OutboxCommandType {
  return WHITELISTED_OFFLINE_COMMANDS.includes(type as OutboxCommandType);
}

export function assertCommandWhitelisted(type: string): void {
  if (!isCommandWhitelisted(type)) {
    throw new Error(OFFLINE_BLOCKED_ARABIC_EXPLANATION);
  }
}

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
   * Validates with Zod before saving.
   */
  static async enqueue(options: {
    type: OutboxCommandType;
    payload: Record<string, unknown>;
    vehicleId?: string;
    customId?: string;
  }): Promise<OutboxCommand> {
    assertCommandWhitelisted(options.type);

    // Validate payload against schema before queueing
    const validation = validatePayload(options.type, options.payload);
    if (!validation.success) {
      throw new ValidationError(`بيانات العملية غير صالحة: ${validation.error}`);
    }

    const requestId = options.customId || generateRequestId();
    const now = new Date().toISOString();

    const command: OutboxCommand = {
      id: requestId,
      type: options.type,
      payload: validation.data,
      createdAt: now,
      attempts: 0,
      status: 'pending',
      vehicleId: options.vehicleId || (options.payload.vehicleId as string) || undefined,
    };

    await db.outbox.add(command);
    await useConnectivityStore.getState().refreshOutboxCounts();

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
   * Reuses the exact same request_id on each retry.
   */
  static async processQueue(gatewayOverride?: IDataGateway): Promise<void> {
    if (isProcessing) return;
    if (!useConnectivityStore.getState().isOnline) return;

    isProcessing = true;
    useConnectivityStore.getState().setSyncing(true);

    try {
      const items = await db.outbox
        .where('status')
        .equals('pending')
        .or('status')
        .equals('sending')
        .toArray();

      if (items.length === 0) {
        return;
      }

      // Group by vehicleId to enforce strict FIFO per vehicle
      const groupedByVehicle = new Map<string, OutboxCommand[]>();
      for (const item of items) {
        const key = item.vehicleId || '__unassigned__';
        const list = groupedByVehicle.get(key) || [];
        list.push(item);
        groupedByVehicle.set(key, list);
      }

      let gateway = gatewayOverride;
      if (!gateway) {
        const { getGateway } = await import('./ServerGateway');
        gateway = getGateway();
      }

      for (const [, queue] of groupedByVehicle.entries()) {
        queue.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        for (const cmd of queue) {
          if (cmd.attempts > 0 && cmd.updatedAt) {
            const backoffMs = Math.min(300000, 2000 * Math.pow(2, cmd.attempts - 1));
            const elapsed = Date.now() - new Date(cmd.updatedAt).getTime();
            if (elapsed < backoffMs) {
              break;
            }
          }

          const currentAttempt = cmd.attempts + 1;
          const now = new Date().toISOString();

          await db.outbox.update(cmd.id, {
            status: 'sending',
            attempts: currentAttempt,
            updatedAt: now,
          });

          try {
            await OutboxEngine.dispatchCommand(gateway, cmd);

            // Successfully processed
            await db.outbox.update(cmd.id, {
              status: 'done',
              updatedAt: new Date().toISOString(),
            });
          } catch (err) {
            // Check if AlreadyProcessed -> Treat as success returning stored result
            if (
              err instanceof AlreadyProcessed ||
              (err instanceof Error && err.message.includes('AlreadyProcessed')) ||
              (err instanceof Error && (err.message.includes('مكرر') || err.message.includes('already processed')))
            ) {
              await db.outbox.update(cmd.id, {
                status: 'done',
                updatedAt: new Date().toISOString(),
              });
              continue;
            }

            const errorMsg = err instanceof Error ? err.message : String(err);
            const isChronology =
              err instanceof ChronologyError ||
              errorMsg.includes('chronology') ||
              errorMsg.includes('تناقص') ||
              errorMsg.includes('يسبق');

            const isRejection =
              isChronology ||
              err instanceof ValidationError ||
              errorMsg.includes('rejected') ||
              errorMsg.includes('رفض') ||
              errorMsg.includes('غير صالح') ||
              errorMsg.includes('invalid') ||
              errorMsg.includes('business') ||
              errorMsg.includes('validation');

            if (isRejection) {
              // Server rejected item or chronological anomaly: move to needs_review with Arabic explanation. NEVER drop!
              await db.outbox.update(cmd.id, {
                status: 'needs_review',
                lastError: errorMsg,
                updatedAt: new Date().toISOString(),
              });
              // Stop subsequent commands for this vehicle
              break;
            } else {
              // Transient network failure: keep pending with backoff
              await db.outbox.update(cmd.id, {
                status: 'pending',
                lastError: errorMsg,
                updatedAt: new Date().toISOString(),
              });
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
   * Internal dispatcher for sending outbox commands to their dedicated RPCs.
   * NEVER maps to createTrip / completeTrip!
   */
  private static async dispatchCommand(gateway: IDataGateway, cmd: OutboxCommand): Promise<void> {
    // 1. Re-validate payload before sending
    const validation = validatePayload(cmd.type, cmd.payload);
    if (!validation.success) {
      throw new ValidationError(`بيانات العملية في صندوق الصادر غير صالحة: ${validation.error}`);
    }

    const payload = validation.data;

    switch (cmd.type) {
      case 'fuel_log': {
        await gateway.createFuelLog({
          vehicleId: payload.vehicleId,
          driverId: payload.driverId,
          liters: payload.liters,
          cost: payload.cost,
          fuelType: payload.fuelType,
          vendorName: payload.vendorName || payload.stationLocation || 'محطة المحروقات',
          invoiceNumber: payload.invoiceNumber as string | undefined,
          currentOdometer: payload.currentOdometer as number,
          odometer: payload.currentOdometer as number,
          stationLocation: payload.stationLocation as string | undefined,
          occurredAt: payload.occurredAt || cmd.createdAt,
          requestId: cmd.id, // Reuses exact request_id for idempotency
        });
        break;
      }

      case 'trip_event': {
        await gateway.recordTripEvent({
          requestId: cmd.id,
          tripId: payload.tripId,
          vehicleId: payload.vehicleId,
          eventType: payload.eventType,
          occurredAt: payload.occurredAt || cmd.createdAt,
          payload: payload.payload || {},
        });
        break;
      }

      case 'odometer_reading': {
        await gateway.recordOdometerReading({
          requestId: cmd.id,
          vehicleId: payload.vehicleId,
          readingKm: payload.readingKm,
          capturedAt: payload.capturedAt || cmd.createdAt,
          source: payload.source || 'driver_check_in',
        });
        break;
      }

      case 'inspection': {
        await gateway.recordInspection({
          requestId: cmd.id,
          vehicleId: payload.vehicleId,
          inspectedAt: payload.inspectedAt || cmd.createdAt,
          result: payload.result,
          notes: payload.notes,
          checklist: payload.checklist || {},
        });
        break;
      }

      default:
        throw new ValidationError(`نوع العملية (${cmd.type}) غير معروف في قائمة انتظار الإرسال.`);
    }
  }

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

  static async editAndResubmit(
    oldId: string,
    newPayload: Record<string, unknown>
  ): Promise<OutboxCommand> {
    const oldItem = await db.outbox.get(oldId);
    if (!oldItem) throw new Error('العملية الأصلية غير موجودة.');

    await db.outbox.update(oldId, {
      status: 'done',
      lastError: 'تم استبدال العملية بالعملية المعدلة الجديدة',
      updatedAt: new Date().toISOString(),
    });

    const newCmd = await OutboxEngine.enqueue({
      type: oldItem.type,
      payload: newPayload,
      vehicleId: (newPayload.vehicleId as string) || oldItem.vehicleId,
    });

    return newCmd;
  }

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
