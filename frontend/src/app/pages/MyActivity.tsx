import { type ReactNode, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { StateCard } from '../components/StateCard';
import { useRequestState } from '../hooks/useRequestState';
import { useSession } from '../hooks/useSession';
import { fetchMyResourceSubmissions, fetchUserActivity } from '../lib/app-service';
import {
  buildCompetitionDetailRoute,
  buildPostDetailRoute,
  buildTeamDetailRoute,
  buildResourceDetailRoute,
  routes,
} from '../lib/routes';
import { displayPostCategory, displayTeamStatus } from '../lib/format';
import { startQuickLogin } from '../lib/quick-login';
import type { UserActivityCollection } from '../../types/entities';
import type { ResourceSubmissionSummary } from '../lib/admin-types';

interface ActivityDashboard {
  activity: UserActivityCollection;
  submissions: ResourceSubmissionSummary[];
}

const emptyActivity: UserActivityCollection = {
  publishedTeams: [],
  publishedPosts: [],
  competitionEnrollments: [],
  teamApplications: [],
};

const emptyDashboard: ActivityDashboard = {
  activity: emptyActivity,
  submissions: [],
};

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-[1rem] font-semibold text-slate-900">{title}</div>
      <div className="mt-3 space-y-2.5">{children}</div>
    </section>
  );
}

function ItemBlock({ children }: { children: ReactNode }) {
  return <div className="block rounded-lg bg-slate-50 px-4 py-3.5">{children}</div>;
}

export function MyActivity() {
  const navigate = useNavigate();
  const { loggedIn } = useSession();
  const [loggingIn, setLoggingIn] = useState(false);
  const state = useRequestState<ActivityDashboard>({
    initialData: emptyDashboard,
    errorMessage: '我的动态加载失败，请稍后重试。',
  });

  useEffect(() => {
    if (!loggedIn) {
      state.reset(emptyDashboard);
      return;
    }

    void state.run(async () => {
      const [activity, submissions] = await Promise.all([fetchUserActivity(), fetchMyResourceSubmissions()]);
      return { activity, submissions };
    });
  }, [loggedIn, state.reset, state.run]);

  if (!loggedIn) {
    return (
      <div className="min-h-full bg-slate-50 pb-8">
        <PageHeader title="我的动态" back />
        <div className="px-4">
          <StateCard
            mode="auth"
            title="请先登录"
            actionText={loggingIn ? '登录中…' : '立即登录'}
            onAction={() =>
              void startQuickLogin({
                navigate,
                nextPath: routes.myActivity,
                onStart: () => setLoggingIn(true),
                onComplete: () => setLoggingIn(false),
              })
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 pb-8">
      <PageHeader title="我的动态" back />

      <div className="space-y-4 px-4">
        {state.status === 'loading' ? (
          <StateCard mode="loading" title="正在加载动态" />
        ) : null}

        {state.status === 'error' ? (
          <StateCard
            mode="error"
            title="我的动态加载失败"
            description={state.errorMessage}
            actionText="重新加载"
            onAction={() =>
              void state.run(async () => {
                const [activity, submissions] = await Promise.all([fetchUserActivity(), fetchMyResourceSubmissions()]);
                return { activity, submissions };
              })
            }
          />
        ) : null}

        {state.status === 'success' ? (
          <>
            <SectionCard title="我的发布">
              {state.data.activity.publishedTeams.length === 0 && state.data.activity.publishedPosts.length === 0 ? (
                <StateCard mode="empty" title="还没有发布内容" />
              ) : null}

              {state.data.activity.publishedTeams.map((item) => (
                <Link key={item.id} to={buildTeamDetailRoute(item.id)}>
                  <ItemBlock>
                    <div className="text-[15px] font-semibold text-slate-900">{item.title}</div>
                    <div className="mt-1.5 text-sm text-slate-500">
                      {item.compName} · {item.moderationStatus === 'approved' ? displayTeamStatus(item.status) : item.moderationStatus === 'rejected' ? '未通过' : '审核中'} · {item.current}/{item.max}
                    </div>
                  </ItemBlock>
                </Link>
              ))}

              {state.data.activity.publishedPosts.map((item) => (
                <Link key={item.id} to={buildPostDetailRoute(item.id)}>
                  <ItemBlock>
                    <div className="text-[15px] font-semibold text-slate-900">{item.title}</div>
                    <div className="mt-1.5 text-sm text-slate-500">
                      {displayPostCategory(item.category)} · {item.comments} 条评论
                    </div>
                  </ItemBlock>
                </Link>
              ))}
            </SectionCard>

            <SectionCard title="我的报名">
              {state.data.activity.competitionEnrollments.length === 0 ? (
                <StateCard mode="empty" title="还没有报名记录" />
              ) : null}

              {state.data.activity.competitionEnrollments.map((item) => (
                <Link key={item.id} to={buildCompetitionDetailRoute(item.competitionId)}>
                  <ItemBlock>
                    <div className="text-[15px] font-semibold text-slate-900">{item.competition.title}</div>
                    <div className="mt-1.5 text-sm text-slate-500">
                      状态：{item.status === 'enrolled' ? '已报名' : '审核中'} · {item.createdAt}
                    </div>
                  </ItemBlock>
                </Link>
              ))}
            </SectionCard>

            <SectionCard title="我的投稿">
              {state.data.submissions.length === 0 ? (
                <StateCard mode="empty" title="还没有投稿记录" />
              ) : null}

              {state.data.submissions.map((item) => (
                <Link key={item.id} to={buildResourceDetailRoute(item.id)}>
                  <ItemBlock>
                    <div className="text-[15px] font-semibold text-slate-900">{item.title}</div>
                    <div className="mt-1.5 text-sm text-slate-500">
                      {item.type} · {item.moderationStatus === 'approved' ? '已通过' : item.moderationStatus === 'rejected' ? '未通过' : '审核中'}
                    </div>
                  </ItemBlock>
                </Link>
              ))}
            </SectionCard>
          </>
        ) : null}
      </div>
    </div>
  );
}
