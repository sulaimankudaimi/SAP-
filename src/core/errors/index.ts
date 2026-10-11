export class ConcurrencyError extends Error {
  constructor(message: string = 'تم تعديل هذا السجل بواسطة مستخدم آخر. أعد التحميل ثم حاول مجدداً.') {
    super(message);
    this.name = 'ConcurrencyError';
    Object.setPrototypeOf(this, ConcurrencyError.prototype);
  }
}

export class DependencyError extends Error {
  public blockingReferences: string[];

  constructor(message: string, blockingReferences: string[] = []) {
    super(message);
    this.name = 'DependencyError';
    this.blockingReferences = blockingReferences;
    Object.setPrototypeOf(this, DependencyError.prototype);
  }
}
