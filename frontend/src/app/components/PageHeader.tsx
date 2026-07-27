import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import { routes } from '../lib/routes';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  sticky?: boolean;
  fixed?: boolean;
  back?: boolean;
  fallbackTo?: string;
  rightText?: string;
  onRightClick?: () => void;
}

export function PageHeader({
  title,
  subtitle,
  sticky = true,
  fixed = false,
  back = false,
  fallbackTo = routes.home,
  rightText,
  onRightClick,
}: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(fallbackTo, { replace: true });
  };

  return (
    <div
      className={`${
        fixed
          ? 'fixed inset-x-0 top-0 z-30 mx-auto w-full max-w-[430px] sm:top-4 sm:rounded-t-xl md:top-8'
          : sticky
            ? 'sticky top-0 z-20'
            : ''
      } border-b border-slate-200/70 bg-[#f6f7f9]/92 px-4 pb-3 pt-4 backdrop-blur-xl`}
    >
      <div className="flex min-h-11 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {back ? (
            <button
              type="button"
              onClick={handleBack}
              className="app-button-reset flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-white active:bg-slate-200"
              aria-label="返回"
            >
              <ArrowLeft size={21} strokeWidth={2.2} />
            </button>
          ) : null}

          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold leading-tight tracking-normal text-slate-950">{title}</h1>
            {subtitle ? <p className="mt-1 max-w-[19rem] truncate text-[13px] leading-5 text-slate-500">{subtitle}</p> : null}
          </div>
        </div>

        {rightText ? (
          <button
            type="button"
            onClick={onRightClick}
            className="min-h-11 shrink-0 rounded-full bg-transparent px-3.5 py-2 text-sm font-semibold text-blue-600 transition hover:bg-white active:bg-slate-200"
          >
            {rightText}
          </button>
        ) : null}
      </div>
    </div>
  );
}
