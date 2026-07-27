import { Copy, Mail, ShieldAlert } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { TeamItem } from '../../types/entities';
import { PageHeader } from '../components/PageHeader';
import { StateCard } from '../components/StateCard';
import { Toast, useToast } from '../components/Toast';
import { BottomActionBar } from '../components/ui';
import { useRequestState } from '../hooks/useRequestState';
import { fetchTeamDetail } from '../lib/app-service';
import { displayTeamStatus } from '../lib/format';
import { dataCacheKeys } from '../lib/query-cache';
import { buildLoginRoute, routes } from '../lib/routes';

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-[15px] font-semibold text-slate-950">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function TagList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600">
          {item}
        </span>
      ))}
    </div>
  );
}

export function TeamDetail() {
  const navigate = useNavigate();
  const params = useParams();
  const { toast, showToast, clearToast } = useToast();
  const teamState = useRequestState<TeamItem | null>({
    initialData: null,
    fallbackData: null,
    errorMessage: '队伍详情加载失败，请稍后重试。',
    cacheKey: params.id ? dataCacheKeys.teamDetail(params.id) : undefined,
  });

  useEffect(() => {
    if (!params.id) return;
    void teamState.run(() => fetchTeamDetail(params.id!), { preserveDataOnError: true, revalidate: true });
  }, [params.id, teamState.run]);

  async function copyEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email);
      showToast('邮箱已复制', 'success');
    } catch {
      showToast('请长按复制邮箱', 'error');
    }
  }

  const team = teamState.data;
  const isMemberAvailable = team?.listingType === 'member_available';
  const contactClosed = team?.status === '已结束';
  const primaryRoles = isMemberAvailable ? team?.capabilities ?? [] : team?.missingRoles ?? [];
  const authorMeta = [team?.authorMajor, team?.authorGrade].filter((value) => value?.trim()).join(' · ');
  const emailHref = team?.contactEmail
    ? `mailto:${team.contactEmail}?subject=${encodeURIComponent(`咨询组队：${team.title}`)}&body=${encodeURIComponent('你好，我在校园成长平台看到了你的组队信息，想进一步了解。')}`
    : '';

  return (
    <div className="min-h-full bg-[#f6f7f9] pb-8">
      <Toast toast={toast} onClose={clearToast} />
      <PageHeader title="组队详情" back fallbackTo={routes.teams} />

      <div className="space-y-3 px-4">
        {teamState.status === 'loading' ? <StateCard mode="loading" title="正在加载组队详情" /> : null}
        {teamState.status === 'error' ? (
          <StateCard
            mode="error"
            title="组队详情加载失败"
            description={teamState.errorMessage}
            actionText="重新加载"
            onAction={() => params.id && void teamState.run(() => fetchTeamDetail(params.id!), { forceRefresh: true })}
          />
        ) : null}
        {teamState.status === 'auth_expired' ? (
          <StateCard mode="auth" title="登录状态已失效" actionText="重新登录" onAction={() => navigate(buildLoginRoute(`/teams/${params.id ?? ''}`))} />
        ) : null}

        {teamState.status === 'success' && team ? (
          <>
            {team.viewer?.isOwner && team.moderationStatus !== 'approved' ? (
              <section className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <div className="text-sm font-semibold text-slate-900">{team.moderationStatus === 'rejected' ? '审核未通过' : '审核中'}</div>
                <p className="mt-1 text-sm leading-6 text-slate-600">{team.moderationStatus === 'rejected' ? '调整内容后可以重新发布。' : '审核通过后会按所选可见范围公开。'}</p>
              </section>
            ) : null}

            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="rounded-md bg-blue-50 px-2 py-1 font-semibold text-blue-600">
                  {isMemberAvailable ? '求加入' : displayTeamStatus(team.status)}
                </span>
                {team.isExample ? <span className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">内测示例</span> : null}
                <span className="min-w-0 truncate font-medium text-slate-500">{team.compName}</span>
              </div>
              <h1 className="mt-3 text-xl font-semibold leading-8 text-slate-950">{team.title}</h1>
              {primaryRoles.length > 0 ? <div className="mt-3"><TagList items={primaryRoles} /></div> : null}
              <div className="mt-4 divide-y divide-slate-100 border-y border-slate-100 text-sm">
                {!isMemberAvailable ? <div className="flex justify-between gap-4 py-3"><span className="text-slate-500">队伍人数</span><span className="font-medium text-slate-900">{team.current}/{team.max} 人</span></div> : null}
                <div className="flex justify-between gap-4 py-3"><span className="text-slate-500">所属学校</span><span className="text-right font-medium text-slate-900">{team.schoolName || '学校待补充'}</span></div>
                <div className="flex justify-between gap-4 py-3"><span className="text-slate-500">可见范围</span><span className="text-right font-medium text-slate-900">{team.visibilityScope === 'cross_school' ? '全部高校' : '仅本校'}</span></div>
                <div className="flex justify-between gap-4 py-3"><span className="text-slate-500">有效期</span><span className="text-right font-medium text-slate-900">{team.deadline}</span></div>
                {team.goalTags?.length ? <div className="flex justify-between gap-4 py-3"><span className="text-slate-500">参赛目标</span><span className="text-right font-medium text-slate-900">{team.goalTags.join('、')}</span></div> : null}
              </div>
            </section>

            <DetailSection title={isMemberAvailable ? '个人介绍' : '项目简介'}>
              <p className="whitespace-pre-line text-sm leading-7 text-slate-600">{team.target}</p>
            </DetailSection>

            {team.fullDescription ? (
              <DetailSection title="完整说明">
                <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">{team.fullDescription}</p>
              </DetailSection>
            ) : null}

            {!isMemberAvailable ? (
              <DetailSection title="招募岗位"><TagList items={team.missingRoles} /></DetailSection>
            ) : null}

            {(team.capabilities?.length ?? 0) > 0 ? (
              <DetailSection title={isMemberAvailable ? '我能承担' : '已有能力'}><TagList items={team.capabilities!} /></DetailSection>
            ) : null}

            <DetailSection title="合作要求">
              <div className="divide-y divide-slate-100 text-sm">
                {team.collaborationMode ? <div className="flex justify-between gap-4 py-2.5 first:pt-0"><span className="text-slate-500">合作方式</span><span className="text-right font-medium text-slate-900">{team.collaborationMode}</span></div> : null}
                {team.weeklyCommitment ? <div className="flex justify-between gap-4 py-2.5"><span className="text-slate-500">时间投入</span><span className="text-right font-medium text-slate-900">{team.weeklyCommitment}</span></div> : null}
                {team.requirements.map((item) => <div key={item} className="py-2.5 leading-6 text-slate-600">{item}</div>)}
              </div>
            </DetailSection>

            <DetailSection title="发起人">
              <div className="text-sm font-semibold text-slate-900">{team.authorName}</div>
              {authorMeta ? <div className="mt-1 text-sm text-slate-500">{authorMeta}</div> : null}
            </DetailSection>

            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex min-h-11 items-center justify-between gap-3">
                <h2 className="text-[15px] font-semibold text-slate-950">邮件联系</h2>
                {team.contactEmail && !contactClosed ? (
                  <button type="button" onClick={() => void copyEmail(team.contactEmail!)} className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold text-blue-600">
                    <Copy size={16} aria-hidden="true" />复制邮箱
                  </button>
                ) : null}
              </div>
              {team.isExample ? (
                <p className="mt-1 text-sm leading-6 text-slate-500">这是展示案例，不提供真实邮箱；正式招募会显示队长主动填写的联系邮箱。</p>
              ) : contactClosed ? (
                <p className="mt-1 text-sm leading-6 text-slate-500">该信息已结束，联系邮箱已关闭。</p>
              ) : team.contactEmail ? (
                <a href={emailHref} className="mt-2 flex min-h-12 items-center gap-3 rounded-lg bg-blue-50 px-3.5 text-sm font-semibold text-blue-700 active:bg-blue-100">
                  <Mail size={18} aria-hidden="true" />
                  <span className="min-w-0 break-all">{team.contactEmail}</span>
                </a>
              ) : (
                <p className="mt-1 text-sm leading-6 text-slate-500">发布者尚未提供联系邮箱。</p>
              )}
              <p className="mt-3 text-xs leading-5 text-slate-500">平台只提供信息渠道，不参与筛选、撮合或后续沟通。</p>
            </section>

            <div className="flex gap-2 px-1 text-xs leading-5 text-slate-500">
              <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>不转账、不缴押金，不提交身份证或银行卡信息；报名资格和时间请查看官方来源。</span>
            </div>

            {!contactClosed && !team.isExample && team.contactEmail ? <BottomActionBar>
              <a href={emailHref} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white active:bg-blue-700">
                <Mail size={17} aria-hidden="true" />
                发送邮件
              </a>
            </BottomActionBar> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
