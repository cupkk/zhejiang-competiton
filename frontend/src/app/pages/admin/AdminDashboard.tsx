import { ArrowRight, ClipboardCheck, FileSearch, FolderKanban } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { AdminButton, AdminEmpty, AdminPageTitle, AdminPanel, AdminStat, AdminStatus } from '../../components/admin/AdminUi';
import { StateCard } from '../../components/StateCard';
import { useRequestState } from '../../hooks/useRequestState';
import { useAdminSession } from '../../hooks/useAdminSession';
import { fetchAdminDashboardSummary, fetchAdminModerationTasks, fetchAdminReports } from '../../lib/app-service';
import type { AdminDashboardSummary, AdminModerationTask, AdminReportItem } from '../../lib/admin-types';
import { displayAdminTargetType, displayAdminTaskAction, displaySafeText, formatDateTimeLabel } from '../../lib/format';
import { routes } from '../../lib/routes';

function TaskRow({ item }: { item: AdminModerationTask }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-900">{displayAdminTaskAction(item.action)}</div>
        <div className="mt-0.5 text-xs text-slate-500">
          {displayAdminTargetType(item.targetType)} / {formatDateTimeLabel(item.createdAt)}
        </div>
      </div>
      <AdminStatus status={item.status} />
    </div>
  );
}

export function AdminDashboard() {
  const { admin } = useAdminSession();
  const moderationState = useRequestState<AdminModerationTask[]>({
    initialData: () => [],
    errorMessage: '审核任务加载失败。',
  });
  const reportState = useRequestState<AdminReportItem[]>({
    initialData: () => [],
    errorMessage: '举报列表加载失败。',
  });
  const summaryState = useRequestState<AdminDashboardSummary | null>({
    initialData: null,
    fallbackData: null,
    errorMessage: '运营数据加载失败。',
  });

  useEffect(() => {
    void moderationState.run(() => fetchAdminModerationTasks());
    void reportState.run(fetchAdminReports);
    void summaryState.run(fetchAdminDashboardSummary, { preserveDataOnError: true });
  }, [summaryState.run, moderationState.run, reportState.run]);

  const pendingResourceCount = useMemo(
    () => moderationState.data.filter((item) => item.targetType === 'resource' && ['pending', 'processing'].includes(item.status)).length,
    [moderationState.data],
  );
  const pendingModerationCount = useMemo(
    () => moderationState.data.filter((item) => ['pending', 'processing'].includes(item.status)).length,
    [moderationState.data],
  );
  const pendingReportCount = useMemo(
    () => reportState.data.filter((item) => ['pending', 'processing'].includes(item.status)).length,
    [reportState.data],
  );
  const latestResourceTasks = moderationState.data.filter((item) => item.targetType === 'resource').slice(0, 5);
  const latestReports = reportState.data.slice(0, 5);
  const latestModeration = moderationState.data.slice(0, 6);

  return (
    <div className="space-y-5">
      <AdminPageTitle
        title={admin?.scope === 'school' ? `${admin.schoolName || '本校'}运营` : '平台总览'}
        meta={
          admin?.scope === 'school'
            ? '本校内容、审核和举报数据'
            : `平台首页：${summaryState.data?.platformHomeStatus || '未知'} / 轮播 ${summaryState.data?.platformBannerCount ?? 0}`
        }
        action={<AdminButton to={routes.adminModeration}>审核台</AdminButton>}
      />

      <div className="grid grid-cols-2 gap-3 px-5 lg:grid-cols-4">
        <AdminStat label="帖子待审" value={summaryState.data?.pendingPosts ?? pendingModerationCount} tone="bg-sky-50 text-sky-700" />
        <AdminStat label="组队待审" value={summaryState.data?.pendingTeams ?? 0} tone="bg-violet-50 text-violet-700" />
        <AdminStat label="资源待审" value={summaryState.data?.pendingResources ?? pendingResourceCount} tone="bg-amber-50 text-amber-700" />
        <AdminStat label="举报待处理" value={summaryState.data?.pendingReports ?? pendingReportCount} tone="bg-rose-50 text-rose-700" />
      </div>

      <div className="grid gap-5 px-5 lg:grid-cols-2">
        <AdminPanel
          title="资源审核"
          action={
            <AdminButton to={routes.adminResources} tone="secondary">
              进入 <ArrowRight size={15} />
            </AdminButton>
          }
        >
          {moderationState.status === 'loading' ? <StateCard mode="loading" title="加载中" description="正在读取资源任务。" /> : null}
          {moderationState.status === 'error' ? (
            <StateCard mode="error" title="加载失败" description={moderationState.errorMessage} actionText="重试" onAction={() => void moderationState.run(() => fetchAdminModerationTasks())} />
          ) : null}
          {moderationState.status === 'success' ? (
            <div className="space-y-2.5">
              {latestResourceTasks.length > 0 ? latestResourceTasks.map((item) => <TaskRow key={item.id} item={item} />) : <AdminEmpty>暂无资源任务</AdminEmpty>}
            </div>
          ) : null}
        </AdminPanel>

        <AdminPanel
          title="举报"
          action={
            <AdminButton to={routes.adminReports} tone="secondary">
              进入 <ArrowRight size={15} />
            </AdminButton>
          }
        >
          {reportState.status === 'loading' ? <StateCard mode="loading" title="加载中" description="正在读取举报。" /> : null}
          {reportState.status === 'error' ? (
            <StateCard mode="error" title="加载失败" description={reportState.errorMessage} actionText="重试" onAction={() => void reportState.run(fetchAdminReports)} />
          ) : null}
          {reportState.status === 'success' ? (
            <div className="space-y-2.5">
              {latestReports.length > 0 ? (
                latestReports.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">{displaySafeText(item.reason)}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{displayAdminTargetType(item.targetType)} / {item.targetId}</div>
                    </div>
                    <AdminStatus status={item.status} />
                  </div>
                ))
              ) : (
                <AdminEmpty>暂无举报</AdminEmpty>
              )}
            </div>
          ) : null}
        </AdminPanel>
      </div>

      <div className="grid gap-5 px-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <AdminPanel title="最新审核">
          <div className="space-y-2.5">
            {latestModeration.length > 0 ? latestModeration.map((item) => <TaskRow key={item.id} item={item} />) : <AdminEmpty>暂无审核任务</AdminEmpty>}
          </div>
        </AdminPanel>

        <AdminPanel title="快捷入口">
          <div className="grid gap-2">
            {admin?.scope === 'school' ? (
              <AdminButton to={routes.adminSchoolHome} tone="quiet" className="justify-start">
                <FolderKanban size={16} /> 本校运营
              </AdminButton>
            ) : null}
            <AdminButton to={routes.adminResources} tone="quiet" className="justify-start">
              <FolderKanban size={16} /> 资源审核
            </AdminButton>
            <AdminButton to={routes.adminModeration} tone="quiet" className="justify-start">
              <ClipboardCheck size={16} /> 统一审核
            </AdminButton>
            <AdminButton to={routes.adminReports} tone="quiet" className="justify-start">
              <FileSearch size={16} /> 举报处理
            </AdminButton>
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}
