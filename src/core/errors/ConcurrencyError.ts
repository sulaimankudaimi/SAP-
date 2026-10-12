/**
 * ConcurrencyError
 * Thrown when an update detects an optimistic concurrency control (OCC) conflict
 * (e.g. expectedVersion does not match currentVersion on the server or in local store).
 */
export class ConcurrencyError extends Error {
  readonly entityName: string;
  readonly entityId: string;
  readonly expectedVersion: number;
  readonly currentVersion?: number;

  constructor(
    optionsOrMessage:
      | string
      | {
          entityName: string;
          entityId: string;
          expectedVersion: number;
          currentVersion?: number;
          message?: string;
        } = 'تم تعديل هذا السجل بواسطة مستخدم آخر. أعد التحميل ثم حاول مجدداً.'
  ) {
    if (typeof optionsOrMessage === 'string') {
      super(optionsOrMessage);
      this.name = 'ConcurrencyError';
      this.entityName = 'Record';
      this.entityId = '';
      this.expectedVersion = 0;
    } else {
      const msg =
        optionsOrMessage.message ||
        `تعارض في التحديث المتزامن: تم تعديل السجل (${optionsOrMessage.entityName} #${optionsOrMessage.entityId}) بواسطة مستخدم آخر. الإصدار المتوقع: ${optionsOrMessage.expectedVersion}، الإصدار الحالي: ${optionsOrMessage.currentVersion ?? 'غير معروف'}.`;
      super(msg);
      this.name = 'ConcurrencyError';
      this.entityName = optionsOrMessage.entityName;
      this.entityId = optionsOrMessage.entityId;
      this.expectedVersion = optionsOrMessage.expectedVersion;
      this.currentVersion = optionsOrMessage.currentVersion;
    }
    Object.setPrototypeOf(this, ConcurrencyError.prototype);
  }
}
