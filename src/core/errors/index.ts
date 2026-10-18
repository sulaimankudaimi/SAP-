export * from './ConcurrencyError';

export class DependencyError extends Error {
  public blockingReferences: string[];

  constructor(message: string, blockingReferences: string[] = []) {
    super(message);
    this.name = 'DependencyError';
    this.blockingReferences = blockingReferences;
    Object.setPrototypeOf(this, DependencyError.prototype);
  }
}

export class PermissionError extends Error {
  constructor(message: string = 'غير مصرح: لا تملك الصلاحية الكافية لتنفيذ هذا الإجراء على الخادم.') {
    super(message);
    this.name = 'PermissionError';
    Object.setPrototypeOf(this, PermissionError.prototype);
  }
}

export class ValidationError extends Error {
  public field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class ChronologyError extends Error {
  constructor(message: string = 'خطأ زمني: لا يمكن تسجيل قراءة عداد أو حدث بتاريخ يسبق القيود المسجلة.') {
    super(message);
    this.name = 'ChronologyError';
    Object.setPrototypeOf(this, ChronologyError.prototype);
  }
}

export class AlreadyProcessed extends Error {
  public storedResult?: unknown;

  constructor(message: string = 'تمت معالجة هذا الطلب مسبقاً بنجاح.', storedResult?: unknown) {
    super(message);
    this.name = 'AlreadyProcessed';
    this.storedResult = storedResult;
    Object.setPrototypeOf(this, AlreadyProcessed.prototype);
  }
}

export class ServerCommandUnavailableError extends Error {
  constructor(commandName: string) {
    super(`الأمر المطلوب [${commandName}] غير متوفر أو غير مدعوم على بوابة الخادم في الوضع السحابي.`);
    this.name = 'ServerCommandUnavailableError';
    Object.setPrototypeOf(this, ServerCommandUnavailableError.prototype);
  }
}

export class GenericServerError extends Error {
  constructor(message: string = 'حدث خطأ في معالجة الطلب على الخادم. يرجى المحاولة لاحقاً.') {
    super(message);
    this.name = 'GenericServerError';
    Object.setPrototypeOf(this, GenericServerError.prototype);
  }
}
