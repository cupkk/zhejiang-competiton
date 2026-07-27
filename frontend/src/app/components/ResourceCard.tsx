import { Download } from 'lucide-react';
import { Link } from 'react-router';
import type { ResourceItem } from '../../types/entities';
import { displayPublicText, displayResourceCategory, formatPrice } from '../lib/format';
import { buildResourceDetailRoute } from '../lib/routes';

export function ResourceCard({ resource }: { resource: ResourceItem }) {
  const isSourceOnlyResource = Boolean(resource.sourceUrl && !resource.file);
  const availabilityLabel = isSourceOnlyResource ? '官方来源' : resource.price === 0 ? formatPrice(resource.price) : '暂未公开';
  const availabilityTone = resource.price === 0 ? 'text-blue-600' : 'text-slate-400';

  return (
    <Link
      to={buildResourceDetailRoute(resource.id)}
      className="flex min-h-[5.75rem] items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 transition-colors active:bg-slate-50"
    >
      <div className="flex h-[3.35rem] w-[3rem] shrink-0 flex-col items-center justify-center rounded-lg bg-slate-100 text-blue-700">
        <span className="text-[13px] font-semibold">{resource.type.split('/')[0].trim()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-[14px] font-semibold leading-5 text-slate-900">{displayPublicText(resource.title)}</div>
        <div className="mt-1 flex items-center gap-3 text-[11px] font-medium text-slate-500">
          {isSourceOnlyResource ? (
            <span>官网入口</span>
          ) : (
            <span>{resource.rating.toFixed(1)} 分</span>
          )}
          {isSourceOnlyResource ? null : (
            <span className="flex items-center gap-1">
              <Download size={13} className="text-slate-400" /> {resource.downloads}
            </span>
          )}
        </div>
        <div className="mt-1 text-[11px] font-medium text-slate-400">
          {displayPublicText(resource.authorName)} · {displayResourceCategory(resource.category)}
        </div>
      </div>
      <div className={`shrink-0 text-right text-[14px] font-semibold ${availabilityTone}`}>{availabilityLabel}</div>
    </Link>
  );
}
