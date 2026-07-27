import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router';
import { useEffect } from 'react';
import { ActionButton } from '../components/ui';
import { reportClientError } from '../lib/client-errors';

function getErrorMessage(error: unknown) {
  if (isRouteErrorResponse(error)) {
    return error.data?.message || error.statusText || '页面加载失败，请稍后再试。';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '页面加载失败，请刷新后重试。';
}

export function RouteErrorBoundary() {
  const navigate = useNavigate();
  const error = useRouteError();
  const message = getErrorMessage(error);

  useEffect(() => {
    reportClientError('route', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-4">
      <div className="w-full max-w-[420px] rounded-lg border border-slate-200 bg-white p-5">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <AlertTriangle size={22} />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">页面加载失败</h1>
        <p className="mt-3 text-sm leading-7 text-slate-500">{message}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <ActionButton
            type="button"
            onClick={() => navigate(-1)}
            variant="secondary"
          >
            <ArrowLeft size={16} />
            返回上一页
          </ActionButton>
          <ActionButton
            type="button"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={16} />
            重新加载
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
