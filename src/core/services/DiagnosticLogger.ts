/**
 * In-App Diagnostics and Error Tracking Service
 * Collects runtime errors, component failures, and diagnostic events completely locally in-memory.
 */

export type DiagnosticLogLevel = 'info' | 'warn' | 'error' | 'fatal';

export interface DiagnosticLogEntry {
  id: string;
  timestamp: string;
  level: DiagnosticLogLevel;
  module: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

class DiagnosticLoggerService {
  private logs: DiagnosticLogEntry[] = [];
  private readonly MAX_LOGS = 200;
  private listeners: Array<() => void> = [];

  constructor() {
    this.log('info', 'System', 'تم تهيئة محرك التشخيص ومراقبة الأداء الداخلي بنجاح');
  }

  log(
    level: DiagnosticLogLevel,
    module: string,
    message: string,
    details?: Record<string, unknown>,
    stack?: string
  ): void {
    const entry: DiagnosticLogEntry = {
      id: `diag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      details,
      stack,
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.pop();
    }

    this.notify();
  }

  error(module: string, message: string, error?: unknown, details?: Record<string, unknown>): void {
    const stack = error instanceof Error ? error.stack : undefined;
    const errorMsg = error instanceof Error ? error.message : String(error || message);
    this.log('error', module, `${message}: ${errorMsg}`, details, stack);
  }

  warn(module: string, message: string, details?: Record<string, unknown>): void {
    this.log('warn', module, message, details);
  }

  info(module: string, message: string, details?: Record<string, unknown>): void {
    this.log('info', module, message, details);
  }

  getLogs(): DiagnosticLogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
    this.log('info', 'System', 'تم مسح سجلات التشخيص يدوياً');
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (e) {
        console.error('DiagnosticLogger listener failed', e);
      }
    });
  }

  exportJson(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        system: 'Gulf Energy ERP (Offline Desktop / Web)',
        version: 'v2.4.0',
        totalLogs: this.logs.length,
        logs: this.logs,
      },
      null,
      2
    );
  }
}

export const DiagnosticLogger = new DiagnosticLoggerService();
