import { ArrowLeft, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

interface OnboardingShellProps {
  stepKey: string;
  stepIndex: number;
  totalSteps: number;
  children: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  busy?: boolean;
  primaryDisabled?: boolean;
  errorMessage?: string;
  showProgress?: boolean;
}

export function OnboardingShell({
  stepKey,
  stepIndex,
  totalSteps,
  children,
  primaryLabel,
  onPrimary,
  onBack,
  onSkip,
  busy = false,
  primaryDisabled = false,
  errorMessage,
  showProgress = true,
}: OnboardingShellProps) {
  const progress = Math.max(0, Math.min(100, (stepIndex / totalSteps) * 100));
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const hiddenBranches: Array<{ element: HTMLElement; ariaHidden: string | null; inert: boolean }> = [];
    let branch: HTMLElement = dialog;

    while (branch.parentElement && branch.parentElement !== document.body) {
      const parent = branch.parentElement;
      Array.from(parent.children).forEach((sibling) => {
        if (sibling === branch || !(sibling instanceof HTMLElement)) return;
        hiddenBranches.push({
          element: sibling,
          ariaHidden: sibling.getAttribute('aria-hidden'),
          inert: sibling.hasAttribute('inert'),
        });
        sibling.setAttribute('aria-hidden', 'true');
        sibling.setAttribute('inert', '');
      });
      branch = parent;
    }

    const focusableSelector = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    const getFocusable = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      });
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', trapFocus, true);
    return () => {
      document.removeEventListener('keydown', trapFocus, true);
      hiddenBranches.forEach(({ element, ariaHidden, inert }) => {
        if (ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
        if (!inert) element.removeAttribute('inert');
      });
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [stepKey]);

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 overflow-hidden bg-[#f7f8fa] outline-none"
      role="dialog"
      aria-modal="true"
      aria-label="首次使用引导"
    >
      <div className="mx-auto flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-[#f7f8fa]">
        <header className="shrink-0 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <div className="grid min-h-11 grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="app-button-reset flex h-11 w-11 items-center justify-center rounded-full text-slate-700 transition-colors active:bg-slate-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                aria-label="上一步"
              >
                <ArrowLeft size={21} strokeWidth={2.2} aria-hidden="true" />
              </button>
            ) : (
              <div aria-hidden="true" />
            )}

            {showProgress ? (
              <div className="min-w-0">
                <div
                  className="h-1 w-full overflow-hidden rounded-full bg-slate-200"
                  role="progressbar"
                  aria-label="资料填写进度"
                  aria-valuemin={0}
                  aria-valuemax={totalSteps}
                  aria-valuenow={stepIndex}
                >
                  <div
                    className="h-full rounded-full bg-blue-600 transition-[width] duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div aria-hidden="true" />
            )}

            {onSkip ? (
              <button
                type="button"
                onClick={onSkip}
                className="app-button-reset flex h-11 items-center justify-end text-sm font-medium text-slate-500 transition-colors active:text-slate-900"
              >
                跳过
              </button>
            ) : (
              <div aria-hidden="true" />
            )}
          </div>
        </header>

        <div
          key={stepKey}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div key={stepKey} className="onboarding-step-enter mx-auto w-full max-w-sm">
            {children}
          </div>
        </div>

        <footer className="shrink-0 border-t border-slate-200/80 bg-[#f7f8fa]/95 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 backdrop-blur-xl">
          {errorMessage ? (
            <div role="alert" className="mb-3 text-center text-sm font-medium leading-5 text-rose-600">
              {errorMessage}
            </div>
          ) : null}
          <button
            type="button"
            onClick={onPrimary}
            disabled={busy || primaryDisabled}
            aria-busy={busy}
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-[15px] font-semibold text-white transition-colors active:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
          >
            {busy ? <LoaderCircle size={19} className="animate-spin" aria-hidden="true" /> : null}
            {busy ? '保存中' : primaryLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
