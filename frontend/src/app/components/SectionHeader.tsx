import { Link } from 'react-router';

interface SectionHeaderProps {
  title: string;
  actionText?: string;
  actionTo?: string;
}

export function SectionHeader({ title, actionText, actionTo }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between px-1">
      <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      {actionText && actionTo ? (
        <Link to={actionTo} className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-600 transition-colors active:bg-slate-200">
          {actionText}
        </Link>
      ) : null}
    </div>
  );
}
