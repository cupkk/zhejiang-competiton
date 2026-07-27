import type { AnchorHTMLAttributes, ButtonHTMLAttributes, PropsWithChildren } from 'react';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export const fieldClass =
  'block min-h-11 w-full min-w-0 max-w-full appearance-none rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100/70';

export const textAreaClass = `${fieldClass} min-h-[7.5rem] resize-none leading-7`;
export const bareInputClass =
  'app-bare-input min-h-11 w-full border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400';
export const searchShellClass =
  'flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-0 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100/70';
export const floatingCreateButtonClass =
  'fixed bottom-[calc(env(safe-area-inset-bottom)+8.25rem)] right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_12px_28px_rgba(37,99,235,0.28)] transition active:scale-95 disabled:opacity-60 sm:right-[calc((100vw-430px)/2+1.25rem)]';

const buttonBase =
  'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-3 text-sm font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60';

const buttonVariants = {
  primary: 'bg-blue-600 text-white hover:bg-blue-500',
  secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
  subtle: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  success: 'bg-emerald-600 text-white hover:bg-emerald-500',
  danger: 'bg-rose-500 text-white hover:bg-rose-400',
} as const;

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants;
  fullWidth?: boolean;
}

export function ActionButton({
  variant = 'primary',
  fullWidth = false,
  className,
  children,
  ...props
}: PropsWithChildren<ActionButtonProps>) {
  return (
    <button
      {...props}
      className={cx(buttonBase, buttonVariants[variant], fullWidth && 'w-full', className)}
    >
      {children}
    </button>
  );
}

interface ActionLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: keyof typeof buttonVariants;
  fullWidth?: boolean;
}

export function ActionLink({
  variant = 'primary',
  fullWidth = false,
  className,
  children,
  ...props
}: PropsWithChildren<ActionLinkProps>) {
  return (
    <a
      {...props}
      className={cx(buttonBase, buttonVariants[variant], fullWidth && 'w-full', className)}
    >
      {children}
    </a>
  );
}

export function BottomActionBar({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <section
      className={cx(
        'sticky bottom-4 z-10 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-[0_10px_28px_rgba(15,23,42,0.10)] backdrop-blur-xl',
        className,
      )}
    >
      {children}
    </section>
  );
}
