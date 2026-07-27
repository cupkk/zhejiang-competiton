import type { PropsWithChildren, ReactNode } from 'react';
import { Link } from 'react-router';
import { displayAdminStatus, statusTone } from '../../lib/format';

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function AdminPageTitle({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-[#f6f7f9] px-5">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold text-slate-950">{title}</h1>
        {meta ? <div className="mt-1 text-xs text-slate-500">{meta}</div> : null}
      </div>
      {action ? <div className="flex min-w-0 flex-wrap gap-2 sm:shrink-0">{action}</div> : null}
    </div>
  );
}

export function AdminPanel({
  title,
  meta,
  action,
  children,
  className,
}: PropsWithChildren<{
  title?: string;
  meta?: string;
  action?: ReactNode;
  className?: string;
}>) {
  return (
    <section className={cx('min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white', className)}>
      {(title || action) ? (
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            {title ? <div className="truncate text-sm font-semibold text-slate-900">{title}</div> : null}
            {meta ? <div className="mt-1 truncate text-xs text-slate-500">{meta}</div> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function AdminStat({ label, value, tone = 'bg-slate-100 text-slate-700' }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className={cx('inline-flex rounded-md px-2 py-1 text-[11px] font-semibold', tone)}>{label}</div>
      <div className="mt-3 text-2xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

export function AdminStatus({ status }: { status: string }) {
  return <span className={cx('shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold', statusTone(status))}>{displayAdminStatus(status)}</span>;
}

export function AdminButton({
  children,
  to,
  onClick,
  disabled,
  type = 'button',
  tone = 'primary',
  className,
}: PropsWithChildren<{
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  tone?: 'primary' | 'secondary' | 'success' | 'danger' | 'quiet';
  className?: string;
}>) {
  const classes = cx(
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
    tone === 'primary' && 'bg-slate-900 text-white hover:bg-slate-800',
    tone === 'secondary' && 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    tone === 'success' && 'bg-emerald-600 text-white hover:bg-emerald-500',
    tone === 'danger' && 'bg-rose-600 text-white hover:bg-rose-500',
    tone === 'quiet' && 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    className,
  );

  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} disabled={disabled} onClick={onClick} className={classes}>
      {children}
    </button>
  );
}

export function AdminTextarea({
  value,
  onChange,
  placeholder,
  name = 'admin-note',
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  name?: string;
  ariaLabel?: string;
}) {
  return (
    <textarea
      name={name}
      aria-label={ariaLabel || placeholder || '备注'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={3}
      placeholder={placeholder}
      className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
    />
  );
}

export function AdminEmpty({ children }: PropsWithChildren) {
  return <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">{children}</div>;
}
