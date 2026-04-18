import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@lecpunch/ui';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled UI error', error, errorInfo);
  }

  private retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-4 flex items-center gap-3 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm font-semibold">页面渲染异常</p>
          </div>
          <h1 className="text-xl font-bold text-slate-900">应用遇到了一个错误</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            请点击重试按钮重新渲染页面。如果问题持续出现，请刷新页面或联系管理员。
          </p>
          <div className="mt-6">
            <Button type="button" onClick={this.retry} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              重试
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
