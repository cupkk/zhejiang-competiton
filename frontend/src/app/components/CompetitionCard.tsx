import { Bookmark, CalendarDays, Eye, Users } from 'lucide-react';
import { Link } from 'react-router';
import type { Competition } from '../../types/entities';
import {
  displayCompetitionLevel,
  displayCompetitionStatus,
  formatCompetitionDeadline,
  formatCount,
  statusTone,
} from '../lib/format';
import { buildCompetitionDetailRoute } from '../lib/routes';

export function CompetitionCard({ competition }: { competition: Competition }) {
  const accent = competition.dataFreshness === 'reference'
    ? 'bg-amber-500'
    : competition.scheduleStatus === 'closed'
      ? 'bg-slate-400'
      : 'bg-[#1769e0]';
  const editionText = competition.dataFreshness === 'reference' && competition.referenceEditionLabel
    ? `参考 ${competition.referenceEditionLabel}`
    : competition.currentEditionLabel || competition.editionLabel;
  return (
    <Link
      to={buildCompetitionDetailRoute(competition.id)}
      className="block overflow-hidden rounded-lg border border-[#d7e0ec] bg-white shadow-[0_8px_24px_rgba(29,45,72,0.055)] transition-colors active:bg-[#f8fbff]"
    >
      <div className={`h-1 w-full ${accent}`} />
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold text-[#60708a]">{competition.category} · {displayCompetitionLevel(competition.level)}</span>
          <span className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${statusTone(competition.status)}`}>
            {displayCompetitionStatus(competition.status)}
          </span>
        </div>
        <h3 className="mt-2 line-clamp-2 text-[17px] font-semibold leading-6 text-[#172033]">{competition.title}</h3>
        <div className="mt-1 flex items-center gap-2 text-xs font-medium text-[#748198]">
          <span className="truncate">{editionText}</span>
          {competition.dataFreshness === 'reference' ? <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">往届参考</span> : null}
        </div>

        {competition.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {competition.tags.slice(0, 2).map((tag, index) => (
              <span key={`${tag}-${index}`} className="rounded bg-[#f0f4f9] px-2 py-1 text-[10px] font-semibold text-[#65738a]">{tag}</span>
            ))}
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-3 divide-x divide-[#e4eaf2] rounded-lg bg-[#f5f8fc] py-2.5">
          <div className="min-w-0 px-2.5">
            <div className="flex items-center gap-1 text-[10px] font-semibold text-[#8490a2]"><CalendarDays size={12} />时间</div>
            <div className="mt-1 truncate text-[11px] font-semibold text-[#33415a]">{formatCompetitionDeadline(competition.deadline, competition.daysLeft, competition.scheduleStatus)}</div>
          </div>
          <div className="min-w-0 px-2.5">
            <div className="flex items-center gap-1 text-[10px] font-semibold text-[#8490a2]"><Users size={12} />组队</div>
            <div className="mt-1 truncate text-[11px] font-semibold text-[#33415a]">{competition.teamSize || '按赛道'}</div>
          </div>
          <div className="min-w-0 px-2.5">
            <div className="flex items-center gap-1 text-[10px] font-semibold text-[#8490a2]"><Eye size={12} />热度</div>
            <div className="mt-1 truncate text-[11px] font-semibold text-[#33415a]">{formatCount(competition.views)} 浏览</div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-[11px] font-medium text-[#7d899b]">
          <span>核验 {competition.lastVerifiedAt || '待更新'}</span>
          <span className="inline-flex items-center gap-1"><Bookmark size={12} aria-hidden="true" />{formatCount(competition.favoriteCount)} 收藏</span>
        </div>
      </div>
    </Link>
  );
}
