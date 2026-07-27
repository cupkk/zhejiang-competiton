import { Bookmark, CalendarDays, ExternalLink, Users } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { Competition, PostItem, ResourceItem, TeamItem } from '../../types/entities';
import { PageHeader } from '../components/PageHeader';
import { PostCard } from '../components/PostCard';
import { ResourceCard } from '../components/ResourceCard';
import { StateCard } from '../components/StateCard';
import { TeamCard } from '../components/TeamCard';
import { Toast, useToast } from '../components/Toast';
import { ActionButton, ActionLink, BottomActionBar } from '../components/ui';
import { useRequestState } from '../hooks/useRequestState';
import { useSession } from '../hooks/useSession';
import {
  createCompetitionEnrollment,
  fetchCompetitionDetail,
  fetchPostsForCompetition,
  fetchResourcesForCompetition,
  fetchTeamsForCompetition,
  toggleCompetitionFavorite,
} from '../lib/app-service';
import { displayCompetitionLevel, displayCompetitionStatus, formatCompetitionDeadline, formatCompetitionDaysLeft } from '../lib/format';
import { dataCacheKeys } from '../lib/query-cache';
import { getRequestErrorMessage } from '../lib/request-error';
import { buildLoginRoute, buildPublishTeamRoute, routes } from '../lib/routes';

function dateRange(start?: string, end?: string, fallback = '本届时间待发布') {
  if (start && end) return `${start} 至 ${end}`;
  return start || end || fallback;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="shrink-0 text-sm text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-right text-sm font-medium leading-6 text-slate-900">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[#d7e0ec] bg-white p-4 shadow-[0_8px_24px_rgba(29,45,72,0.05)]">
      <div className="flex items-center gap-2"><span className="h-4 w-1 rounded-full bg-[#1769e0]" /><h2 className="text-[15px] font-semibold text-[#172033]">{title}</h2></div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function scheduleLabel(status: Competition['scheduleStatus']) {
  if (status === 'announced') return '本届日程已发布';
  if (status === 'partially_announced') return '部分日程已发布';
  if (status === 'closed') return '本届已结束';
  return '本届日程待发布';
}

function scheduleDateFallback(status: Competition['scheduleStatus']) {
  if (status === 'closed') return '该届日期未收录';
  if (status === 'partially_announced') return '按赛区或赛道分阶段安排';
  if (status === 'announced') return '日程已发布';
  return '当前届次尚未发布';
}

export function CompetitionDetail() {
  const navigate = useNavigate();
  const params = useParams();
  const { loggedIn } = useSession();
  const { toast, showToast, clearToast } = useToast();
  const detailState = useRequestState<Competition | null>({
    initialData: null,
    fallbackData: null,
    errorMessage: '竞赛详情加载失败，请稍后重试。',
    cacheKey: params.id ? dataCacheKeys.competitionDetail(params.id) : undefined,
  });
  const resourceState = useRequestState<ResourceItem[]>({
    initialData: () => [],
    errorMessage: '关联资料加载失败，请稍后重试。',
    cacheKey: params.id ? dataCacheKeys.competitionResources(params.id) : undefined,
  });
  const teamState = useRequestState<TeamItem[]>({
    initialData: () => [],
    errorMessage: '关联组队加载失败，请稍后重试。',
    cacheKey: params.id ? dataCacheKeys.competitionTeams(params.id) : undefined,
  });
  const postState = useRequestState<PostItem[]>({
    initialData: () => [],
    errorMessage: '经验内容加载失败，请稍后重试。',
    cacheKey: params.id ? dataCacheKeys.competitionPosts(params.id) : undefined,
  });

  useEffect(() => {
    if (!params.id) return;
    void detailState.run(async () => {
      const detail = await fetchCompetitionDetail(params.id!);
      void resourceState.run(() => fetchResourcesForCompetition(params.id!), { preserveDataOnError: true, revalidate: true });
      void teamState.run(() => fetchTeamsForCompetition(params.id!), { preserveDataOnError: true, revalidate: true });
      void postState.run(() => fetchPostsForCompetition(params.id!), { preserveDataOnError: true, revalidate: true });
      return detail;
    }, { preserveDataOnError: true, revalidate: true });
  }, [detailState.run, params.id, postState.run, resourceState.run, teamState.run]);

  const competition = detailState.data;
  const officialUrl = competition?.sourceUrl || '';
  const guidance = competition?.actionHints.filter((item) => !/^官网[：:]/.test(item)) ?? [];

  return (
    <div className="min-h-full bg-[#edf1f7] pb-8">
      <Toast toast={toast} onClose={clearToast} />
      <PageHeader title="竞赛详情" back fallbackTo={routes.competitions} />

      <div className="space-y-3 px-4">
        {detailState.status === 'loading' ? <StateCard mode="loading" title="正在加载竞赛详情" /> : null}
        {detailState.status === 'error' ? (
          <StateCard mode="error" title="竞赛详情加载失败" description={detailState.errorMessage} actionText="重新加载" onAction={() => params.id && void detailState.run(() => fetchCompetitionDetail(params.id!), { forceRefresh: true })} />
        ) : null}
        {detailState.status === 'auth_expired' ? (
          <StateCard mode="auth" title="登录状态已失效" actionText="重新登录" onAction={() => navigate(buildLoginRoute(`/competitions/${params.id ?? ''}`))} />
        ) : null}

        {detailState.status === 'success' && competition ? (
          <>
            {competition.viewer?.isEnrolled ? (
              <section className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-slate-700">已记录报名意向</section>
            ) : null}

            <section className="overflow-hidden rounded-lg bg-[#1769e0] text-white shadow-[0_16px_36px_rgba(23,105,224,0.24)]">
              <div className="p-4 pb-3">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="rounded-md bg-white/16 px-2.5 py-1 font-semibold text-white">{displayCompetitionStatus(competition.status)}</span>
                <span className="font-semibold text-blue-100">{competition.category} · {displayCompetitionLevel(competition.level)}</span>
              </div>
              <h1 className="mt-4 text-[22px] font-semibold leading-8 text-white">{competition.title}</h1>
              <p className="mt-1 text-xs font-semibold text-blue-100">
                {competition.dataFreshness === 'reference' && competition.referenceEditionLabel
                  ? `${competition.currentEditionLabel || '当前届次'} · 参考 ${competition.referenceEditionLabel}`
                  : `${competition.currentEditionLabel || competition.editionLabel} · ${scheduleLabel(competition.scheduleStatus)}`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {competition.tags.slice(0, 4).map((tag) => <span key={tag} className="rounded-md bg-white/13 px-2 py-1 text-xs font-medium text-white">{tag}</span>)}
              </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-white/15 border-t border-white/15 bg-black/8 py-3 text-center">
                <div className="px-2"><div className="text-[10px] font-medium text-blue-100">报名状态</div><div className="mt-1 truncate text-[11px] font-semibold text-white">{formatCompetitionDaysLeft(competition.deadline, competition.daysLeft, competition.scheduleStatus)}</div></div>
                <div className="px-2"><div className="text-[10px] font-medium text-blue-100">团队人数</div><div className="mt-1 truncate text-[11px] font-semibold text-white">{competition.teamSize || '按赛道'}</div></div>
                <div className="px-2"><div className="text-[10px] font-medium text-blue-100">关注度</div><div className="mt-1 truncate text-[11px] font-semibold text-white">{competition.views} 浏览 · {competition.favoriteCount} 收藏</div></div>
              </div>
            </section>

            {competition.scheduleNote ? (
              <section className={`rounded-lg border px-4 py-3 ${competition.dataFreshness === 'reference' ? 'border-amber-200 bg-[#fff7e8]' : 'border-[#cfe0f8] bg-[#f2f7ff]'}`}>
                <div className={`text-xs font-bold ${competition.dataFreshness === 'reference' ? 'text-amber-800' : 'text-[#1769e0]'}`}>
                  {competition.dataFreshness === 'reference' ? '往届规则参考' : '信息状态'}
                </div>
                <p className="mt-1 text-sm leading-6 text-[#536177]">{competition.scheduleNote}</p>
                {competition.referenceNoticeUrl ? <a href={competition.referenceNoticeUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-amber-800">查看参考届次来源<ExternalLink size={14} /></a> : null}
              </section>
            ) : null}

            <Section title="基本信息">
              <div className="divide-y divide-slate-100">
                <InfoRow label="主办方" value={competition.host} />
                <InfoRow label="报名时间" value={dateRange(competition.registrationStart, competition.registrationEnd || competition.deadline, scheduleDateFallback(competition.scheduleStatus))} />
                <InfoRow label="比赛时间" value={dateRange(competition.competitionStart, competition.competitionEnd, scheduleDateFallback(competition.scheduleStatus))} />
                <InfoRow label="参赛对象" value={competition.target} />
                <InfoRow label="团队人数" value={competition.teamSize || '按对应赛道规则'} />
                <InfoRow label="赛事级别" value={displayCompetitionLevel(competition.level)} />
              </div>
            </Section>

            <Section title="赛程阶段">
              {competition.stages.length > 0 ? (
                <ol className="space-y-3">
                  {competition.stages.map((stage, index) => (
                    <li key={stage} className="flex gap-3 text-sm leading-6 text-slate-600">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e6f0ff] text-xs font-semibold text-[#1769e0]">{index + 1}</span>
                      <span>{stage}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </Section>

            <Section title="提交材料">
              {(competition.submissionMaterials?.length ?? 0) > 0 ? (
                <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
                  {competition.submissionMaterials?.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
            </Section>

            <Section title="参赛说明">
              <div className="space-y-4 text-sm leading-7 text-slate-600">
                <p className="whitespace-pre-line">{competition.description}</p>
                {competition.recommendedFor.length > 0 ? (
                  <div><div className="font-semibold text-slate-900">适合人群</div><ul className="mt-2 list-disc space-y-1 pl-5">{competition.recommendedFor.map((item) => <li key={item}>{item}</li>)}</ul></div>
                ) : null}
                {competition.awards ? <div><span className="font-semibold text-slate-900">奖项设置：</span>{competition.awards}</div> : null}
                {competition.feeDescription ? <div><span className="font-semibold text-slate-900">费用说明：</span>{competition.feeDescription}</div> : null}
                {competition.officialContact ? <div><span className="font-semibold text-slate-900">官方联系：</span>{competition.officialContact}</div> : null}
                {guidance.length > 0 ? <ul className="list-disc space-y-1 pl-5">{guidance.map((item) => <li key={item}>{item}</li>)}</ul> : null}
              </div>
            </Section>

            <Section title="官方通知">
              <div className="divide-y divide-slate-100">
                {competition.notices.map((notice) => (
                  <div key={notice.id} className="py-3 first:pt-0 last:pb-0">
                    <a href={notice.sourceUrl} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold text-blue-600">
                      <span className="min-w-0 flex-1">{notice.title}</span><ExternalLink size={16} className="shrink-0" aria-hidden="true" />
                    </a>
                    <div className="text-xs text-slate-400">{notice.publishedAt || '官网页面'} · {notice.fileType}</div>
                  </div>
                ))}
                {competition.notices.length === 0 && officialUrl ? (
                  <a href={officialUrl} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold text-blue-600">赛事官网<ExternalLink size={16} aria-hidden="true" /></a>
                ) : null}
                {competition.notices.length === 0 && !officialUrl ? <p className="text-sm text-slate-500">暂无可核验的官方链接。</p> : null}
              </div>
              <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
                最后核验：{competition.lastVerifiedAt || '待核验'}。官方来源用于查看最新届次通知和附件。
              </p>
            </Section>

            <section className="space-y-3">
              <div className="flex min-h-11 items-center justify-between gap-3">
                <h2 className="text-[17px] font-semibold text-slate-950">相关组队</h2>
                <button type="button" onClick={() => navigate(buildPublishTeamRoute({ compId: competition.id, compName: competition.title }))} className="min-h-11 px-2 text-sm font-semibold text-blue-600">发起组队</button>
              </div>
              {teamState.status === 'loading' ? <StateCard mode="loading" title="正在加载组队" /> : null}
              {teamState.status === 'success' && teamState.data.length === 0 ? <StateCard mode="empty" title="暂无相关组队" /> : null}
              {teamState.status === 'success' ? teamState.data.map((item) => <TeamCard key={item.id} team={item} />) : null}
            </section>

            <section className="space-y-3">
              <h2 className="text-[17px] font-semibold text-slate-950">相关资料</h2>
              {resourceState.status === 'loading' ? <StateCard mode="loading" title="正在加载资料" /> : null}
              {resourceState.status === 'success' && resourceState.data.length === 0 ? <StateCard mode="empty" title="暂无关联资料" /> : null}
              {resourceState.status === 'success' ? resourceState.data.map((item) => <ResourceCard key={item.id} resource={item} />) : null}
            </section>

            <section className="space-y-3">
              <h2 className="text-[17px] font-semibold text-slate-950">经验帖</h2>
              {postState.status === 'loading' ? <StateCard mode="loading" title="正在加载经验" /> : null}
              {postState.status === 'success' && postState.data.length === 0 ? <StateCard mode="empty" title="暂无相关经验" /> : null}
              {postState.status === 'success' ? postState.data.map((item) => <PostCard key={item.id} post={item} />) : null}
            </section>

            <BottomActionBar>
              <div className="grid grid-cols-2 gap-3">
                <ActionButton
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    if (!loggedIn) { navigate(buildLoginRoute(`/competitions/${competition.id}`)); return; }
                    try {
                      const viewer = competition.viewer ?? { isFavorited: false, isEnrolled: false };
                      const result = await toggleCompetitionFavorite(competition.id, { favorite: !viewer.isFavorited });
                      detailState.setData({ ...competition, favoriteCount: Math.max(0, competition.favoriteCount + (result.favorite ? 1 : -1)), viewer: { ...viewer, isFavorited: result.favorite } });
                      showToast(result.favorite ? '已收藏' : '已取消收藏', 'success');
                    } catch (error) { showToast(getRequestErrorMessage(error, '收藏失败，请稍后重试。'), 'error'); }
                  }}
                >
                  <Bookmark size={16} className={competition.viewer?.isFavorited ? 'fill-blue-600 text-blue-600' : ''} aria-hidden="true" />
                  {competition.viewer?.isFavorited ? '已收藏' : '收藏'}
                </ActionButton>
                {officialUrl ? (
                  <ActionLink href={officialUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} aria-hidden="true" />官方来源</ActionLink>
                ) : (
                  <ActionButton
                    type="button"
                    disabled={competition.viewer?.isEnrolled}
                    onClick={async () => {
                      if (!loggedIn) { navigate(buildLoginRoute(`/competitions/${competition.id}`)); return; }
                      try {
                        const viewer = competition.viewer ?? { isFavorited: false, isEnrolled: false };
                        await createCompetitionEnrollment(competition.id);
                        detailState.setData({ ...competition, viewer: { ...viewer, isEnrolled: true } });
                        showToast('已记录报名意向', 'success');
                      } catch (error) { showToast(getRequestErrorMessage(error, '操作失败，请稍后重试。'), 'error'); }
                    }}
                  >
                    {competition.viewer?.isEnrolled ? '已记录' : '记录意向'}
                  </ActionButton>
                )}
              </div>
            </BottomActionBar>
          </>
        ) : null}
      </div>
    </div>
  );
}
