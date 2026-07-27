import { CheckCircle2, Clock3, ExternalLink, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminSchoolFilter } from '../../components/admin/AdminSchoolFilter';
import { AdminButton, AdminEmpty, AdminPageTitle, AdminPanel, AdminStat, AdminStatus, AdminTextarea } from '../../components/admin/AdminUi';
import { StateCard } from '../../components/StateCard';
import { useRequestState } from '../../hooks/useRequestState';
import { fetchAdminModerationTasks, fetchAdminReports, reviewAdminModerationTask } from '../../lib/app-service';
import type { AdminModerationTask, AdminReportItem } from '../../lib/admin-types';
import { displayAdminStatus, displayAdminTargetType, displaySafeText, formatDateTimeLabel } from '../../lib/format';
import { buildPostDetailRoute, buildResourceDetailRoute, buildTeamDetailRoute, routes } from '../../lib/routes';

function getReportTargetRoute(report: AdminReportItem) {
  if (report.targetType === 'resource') return buildResourceDetailRoute(report.targetId);
  if (report.targetType === 'team') return buildTeamDetailRoute(report.targetId);
  if (report.targetType === 'post') return buildPostDetailRoute(report.targetId);
  return routes.adminModeration;
}

export function AdminReports() {
  const [schoolId, setSchoolId] = useState('all');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [submittingReportId, setSubmittingReportId] = useState<string | null>(null);

  const reportState = useRequestState<AdminReportItem[]>({
    initialData: () => [],
    errorMessage: '举报加载失败。',
  });
  const taskState = useRequestState<AdminModerationTask[]>({
    initialData: () => [],
    errorMessage: '审核任务加载失败。',
  });

  async function refresh() {
    const schoolQuery = { schoolId: schoolId === 'all' ? undefined : schoolId };
    await Promise.all([
      reportState.run(() => fetchAdminReports(schoolQuery)),
      taskState.run(() => fetchAdminModerationTasks({ targetType: 'report', ...schoolQuery })),
    ]);
  }

  useEffect(() => {
    void refresh();
  }, [reportState.run, schoolId, taskState.run]);

  const items = useMemo(() => reportState.data, [reportState.data]);
  const taskMap = useMemo(() => new Map(taskState.data.map((item) => [item.targetId, item])), [taskState.data]);

  useEffect(() => {
    if (taskState.status !== 'success') return;
    setNotes((current) => {
      const next = { ...current };
      taskState.data.forEach((item) => {
        if (next[item.targetId] === undefined) next[item.targetId] = item.note ?? '';
      });
      return next;
    });
  }, [taskState.data, taskState.status]);

  const pendingCount = useMemo(() => items.filter((item) => item.status === 'pending').length, [items]);
  const processingCount = useMemo(() => items.filter((item) => item.status === 'processing').length, [items]);
  const resolvedCount = useMemo(() => items.filter((item) => item.status === 'resolved').length, [items]);
  const rejectedCount = useMemo(() => items.filter((item) => item.status === 'rejected').length, [items]);

  async function handleReview(reportId: string, status: 'processing' | 'approved' | 'rejected') {
    const task = taskMap.get(reportId);
    if (!task) return;

    setSubmittingReportId(reportId);
    try {
      await reviewAdminModerationTask(task.id, { status, note: notes[reportId]?.trim() || undefined });
      await refresh();
    } finally {
      setSubmittingReportId(null);
    }
  }

  return (
    <div className="space-y-5">
      <AdminPageTitle title="举报" meta={`${items.length} 条记录`} action={<AdminButton to={routes.adminModeration} tone="secondary">审核台</AdminButton>} />

      <div className="grid grid-cols-4 gap-3 px-5">
        <AdminStat label="待受理" value={pendingCount} tone="bg-amber-50 text-amber-700" />
        <AdminStat label="处理中" value={processingCount} tone="bg-sky-50 text-sky-700" />
        <AdminStat label="已确认" value={resolvedCount} tone="bg-emerald-50 text-emerald-700" />
        <AdminStat label="已驳回" value={rejectedCount} tone="bg-rose-50 text-rose-700" />
      </div>

      <AdminSchoolFilter value={schoolId} onChange={setSchoolId} />

      <div className="space-y-3 px-5">
        {reportState.status === 'loading' || taskState.status === 'loading' ? <StateCard mode="loading" title="加载中" description="正在读取举报。" /> : null}
        {reportState.status === 'error' ? <StateCard mode="error" title="加载失败" description={reportState.errorMessage} actionText="重试" onAction={() => void refresh()} /> : null}
        {taskState.status === 'error' ? <StateCard mode="error" title="加载失败" description={taskState.errorMessage} actionText="重试" onAction={() => void refresh()} /> : null}
        {reportState.status === 'success' && taskState.status === 'success' && items.length === 0 ? <AdminEmpty>暂无举报。</AdminEmpty> : null}

        {reportState.status === 'success' && taskState.status === 'success'
          ? items.map((item) => {
              const task = taskMap.get(item.id);
              const submitting = submittingReportId === item.id;

              return (
                <AdminPanel key={item.id}>
                  <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold text-slate-950">{displaySafeText(item.reason)}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {displayAdminTargetType(item.targetType)} / {item.targetId} / {formatDateTimeLabel(item.createdAt)}
                          </div>
                          {item.schoolName ? (
                            <div className="mt-2 inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                              {displaySafeText(item.schoolName)}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <AdminStatus status={item.status} />
                          {task ? <AdminStatus status={task.status} /> : null}
                        </div>
                      </div>
                      {item.detail ? <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-700">{displaySafeText(item.detail)}</div> : null}
                      <div className="mt-3">
                        <AdminTextarea value={notes[item.id] ?? ''} onChange={(value) => setNotes((current) => ({ ...current, [item.id]: value }))} placeholder="处理备注" />
                      </div>
                    </div>

                    <div className="flex flex-col justify-between gap-3 rounded-lg bg-slate-50 p-3">
                      <div className="space-y-1 text-xs text-slate-500">
                        <div>举报人：{item.reporterUserId}</div>
                        <div>更新：{formatDateTimeLabel(item.updatedAt)}</div>
                        <div>学校：{displaySafeText(item.schoolName || '平台公共')}</div>
                        <div>审核任务：{task ? displayAdminStatus(task.status) : '未关联'}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <AdminButton to={getReportTargetRoute(item)} tone="secondary">
                          <ExternalLink size={15} /> 查看
                        </AdminButton>
                        <AdminButton disabled={!task || submitting} onClick={() => void handleReview(item.id, 'processing')} tone="quiet">
                          <Clock3 size={15} /> 处理中
                        </AdminButton>
                        <AdminButton disabled={!task || submitting} onClick={() => void handleReview(item.id, 'approved')} tone="success">
                          <CheckCircle2 size={15} /> 成立
                        </AdminButton>
                        <AdminButton disabled={!task || submitting} onClick={() => void handleReview(item.id, 'rejected')} tone="danger">
                          <XCircle size={15} /> 驳回
                        </AdminButton>
                      </div>
                    </div>
                  </div>
                </AdminPanel>
              );
            })
          : null}
      </div>
    </div>
  );
}
