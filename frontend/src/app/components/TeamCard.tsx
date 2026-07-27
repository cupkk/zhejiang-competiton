import { Clock3, Users } from 'lucide-react';
import { Link } from 'react-router';
import type { TeamItem } from '../../types/entities';
import { displayTeamStatus, statusTone } from '../lib/format';
import { buildTeamDetailRoute } from '../lib/routes';

export function TeamCard({ team, preview = false }: { team: TeamItem; preview?: boolean }) {
  const isMemberAvailable = team.listingType === 'member_available';
  const visibleStatus =
    team.moderationStatus && team.moderationStatus !== 'approved'
      ? team.moderationStatus === 'rejected'
        ? '未通过'
        : '审核中'
      : isMemberAvailable
        ? '求加入'
        : displayTeamStatus(team.status);
  const primaryTags = isMemberAvailable ? team.capabilities ?? [] : team.missingRoles;
  const accentClass = isMemberAvailable ? 'border-l-[#1769e0]' : 'border-l-[#e88413]';

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-bold text-[#718097]">{team.compName}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${statusTone(visibleStatus)}`}>{visibleStatus}</span>
            {team.isExample ? <span className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">内测示例</span> : null}
            <span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${team.visibilityScope === 'cross_school' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              {team.visibilityScope === 'cross_school' ? '跨校公开' : '仅本校'}
            </span>
          </div>
          <h3 className="mt-2 line-clamp-2 text-[17px] font-semibold leading-6 text-[#172033]">{team.title}</h3>
        </div>
        {!isMemberAvailable ? (
          <div className="shrink-0 text-right"><div className="text-lg font-semibold tabular-nums text-[#172033]">{team.current}/{team.max}</div><div className="text-[10px] font-medium text-[#8a95a6]">当前人数</div></div>
        ) : null}
      </div>

      <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#56657b]">{team.target}</p>

      {primaryTags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {primaryTags.slice(0, 4).map((tag) => (
            <span key={tag} className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${isMemberAvailable ? 'bg-[#e9f2ff] text-[#1769e0]' : 'bg-[#fff1de] text-[#b75b00]'}`}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {(team.goalTags?.length ?? 0) > 0 ? (
        <div className="mt-2 text-xs font-semibold text-[#1769e0]">目标：{team.goalTags!.slice(0, 2).join(' · ')}</div>
      ) : null}

      <div className="mt-3 flex min-w-0 items-center justify-between gap-3 border-t border-[#e7ecf3] pt-3 text-xs text-[#6d7b90]">
        <span className="min-w-0 truncate">
          {team.schoolName || '学校待补充'} · {team.authorName}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1">
          {isMemberAvailable ? <Clock3 size={13} aria-hidden="true" /> : <Users size={13} aria-hidden="true" />}
          {isMemberAvailable ? team.weeklyCommitment || '时间可沟通' : `截止 ${team.deadline}`}
        </span>
      </div>
    </>
  );

  if (preview) {
    return <div className={`rounded-lg border border-[#d7e0ec] border-l-4 bg-white p-4 shadow-[0_8px_22px_rgba(29,45,72,0.05)] ${accentClass}`}>{content}</div>;
  }

  return (
    <Link
      to={buildTeamDetailRoute(team.id)}
      className={`block rounded-lg border border-[#d7e0ec] border-l-4 bg-white p-4 shadow-[0_8px_22px_rgba(29,45,72,0.055)] transition-colors active:bg-[#f8fbff] ${accentClass}`}
    >
      {content}
    </Link>
  );
}
