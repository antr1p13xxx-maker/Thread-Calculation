import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-lg w-full bg-white border border-rose-200 rounded-lg p-6 space-y-3">
            <h1 className="text-base font-semibold text-rose-900">
              Terjadi Gangguan Koneksi / Izin Firebase Firestore
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Operasi database terhenti karena galat berikut. Silakan muat ulang halaman atau periksa autentikasi Firebase Anda.
            </p>
            <pre className="p-3 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono text-rose-800 overflow-x-auto whitespace-pre-wrap">
              {this.state.errorMessage}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors"
            >
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
