import { CircleAlert, Inbox, LoaderCircle, LogIn } from 'lucide-react';
import { ActionButton } from './ui';

interface StateCardProps {
  mode: 'loading' | 'error' | 'auth' | 'empty';
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}

const stateMeta = {
  loading: { icon: LoaderCircle, iconClass: 'animate-spin text-slate-400' },
  error: { icon: CircleAlert, iconClass: 'text-slate-500' },
  auth: { icon: LogIn, iconClass: 'text-slate-500' },
  empty: { icon: Inbox, iconClass: 'text-slate-400' },
} as const;

export function StateCard({ mode, title, description, actionText, onAction }: StateCardProps) {
  const meta = stateMeta[mode];
  const Icon = meta.icon;

  return (
    <section className="flex min-h-40 flex-col items-center justify-center px-5 py-10 text-center">
      <Icon size={25} strokeWidth={1.8} className={meta.iconClass} aria-hidden="true" />
      <h3 className="mt-3 text-base font-semibold text-slate-900">{title}</h3>
      {description ? <p className="mt-1.5 max-w-72 text-sm leading-6 text-slate-500">{description}</p> : null}
      {actionText && onAction ? (
        <ActionButton type="button" onClick={onAction} className="mt-4">
          {actionText}
        </ActionButton>
      ) : null}
    </section>
  );
}
