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
