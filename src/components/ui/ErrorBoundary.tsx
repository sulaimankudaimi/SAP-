import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw, Home, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { DiagnosticLogger } from '../../core/services/DiagnosticLogger';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    DiagnosticLogger.error('ErrorBoundary', error.message, error, {
      componentStack: errorInfo.componentStack ?? '',
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.hash = '#/';
  };

  private handleCopyError = () => {
    const errorDetails = `
Error: ${this.state.error?.message || 'Unknown Error'}
Stack: ${this.state.error?.stack || 'No Stack'}
Component Stack: ${this.state.errorInfo?.componentStack || 'No Component Stack'}
Time: ${new Date().toISOString()}
System: Gulf Energy ERP (100% Offline)
    `.trim();

    navigator.clipboard.writeText(errorDetails).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-[400px] flex items-center justify-center p-6 bg-[#F4F7FB]"
        >
          <div className="w-full max-w-2xl bg-white border border-[#E5EAF2] rounded-[16px] shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-6 md:p-8 space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 text-[#EF4444] flex items-center justify-center shrink-0">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-[#0F172A]">
                  {this.props.fallbackTitle || 'حدث استثناء غير متوقع في تشغيل الشاشة'}
                </h2>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  تم عزل الخطأ بأمان وفق مبادئ السلامة التشغيلية لمنع تأثيره على سلامة باقي سجلات النظام وقاعدة البيانات المحلية.
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="p-3.5 bg-red-50/50 border border-red-100 rounded-xl text-xs text-[#EF4444] font-mono break-words">
              {this.state.error?.message || 'خطأ داخلي غير معروف'}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                variant="primary"
                onClick={this.handleReset}
                icon={<RotateCcw className="w-4 h-4" />}
              >
                إعادة محاولة تحميل الشاشة
              </Button>
              <Button
                variant="secondary"
                onClick={this.handleGoHome}
                icon={<Home className="w-4 h-4" />}
              >
                العودة للوحة المعلومات
              </Button>
              <Button
                variant="ghost"
                onClick={this.handleCopyError}
                icon={this.state.copied ? <Check className="w-4 h-4 text-[#0FA37F]" /> : <Copy className="w-4 h-4" />}
              >
                {this.state.copied ? 'تم نسخ التفاصيل' : 'نسخ التقرير الفني'}
              </Button>
            </div>

            {/* Collapsible Tech Stack */}
            <div className="border-t border-[#E5EAF2] pt-4">
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                className="flex items-center justify-between w-full text-xs text-[#64748B] hover:text-[#0F172A] font-medium"
              >
                <span>التفاصيل الفنية للتتبع (Developer Stack Trace)</span>
                {this.state.showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {this.state.showDetails && (
                <div className="mt-3 p-3 bg-[#0B2545] text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto max-h-60 leading-relaxed text-left" dir="ltr">
                  <div>{this.state.error?.stack || 'No Stack Available'}</div>
                  {this.state.errorInfo?.componentStack && (
                    <div className="mt-2 text-slate-300 pt-2 border-t border-slate-700">
                      {this.state.errorInfo.componentStack}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
