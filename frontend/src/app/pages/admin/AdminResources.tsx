import { CheckCircle2, Clock3, ExternalLink, Plus, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminSchoolFilter } from '../../components/admin/AdminSchoolFilter';
import { AdminButton, AdminEmpty, AdminPageTitle, AdminPanel, AdminStat, AdminStatus, AdminTextarea } from '../../components/admin/AdminUi';
import { StateCard } from '../../components/StateCard';
import { useRequestState } from '../../hooks/useRequestState';
import { useAdminSession } from '../../hooks/useAdminSession';
import { fetchAdminHomeFeedConfig, fetchAdminModerationTasks, reviewAdminModerationTask } from '../../lib/app-service';
import type { AdminHomeFeedConfig, AdminModerationTask } from '../../lib/admin-types';
import { displayAdminStatus, displayAdminTaskAction, displayPublishStatus, displaySafeText, formatDateTimeLabel } from '../../lib/format';
import { buildResourceDetailRoute, routes } from '../../lib/routes';

export function AdminResources() {
  const { admin } = useAdminSession();
  const canReadPlatformHome = Boolean(admin?.scope === 'platform' && admin.permissions.includes('home:read'));
  const [schoolId, setSchoolId] = useState('all');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [batchSubmitting, setBatchSubmitting] = useState<'processing' | 'approved' | 'rejected' | null>(null);
  const [batchMessage, setBatchMessage] = useState('');

  const taskState = useRequestState<AdminModerationTask[]>({
    initialData: () => [],
    errorMessage: '资源审核加载失败。',
  });
  const homeState = useRequestState<AdminHomeFeedConfig | null>({
    initialData: null,
    fallbackData: null,
    errorMessage: '首页配置加载失败。',
  });

  async function refresh() {
    const taskRequest = taskState.run(() =>
      fetchAdminModerationTasks({ targetType: 'resource', schoolId: schoolId === 'all' ? undefined : schoolId }),
    );
    if (!canReadPlatformHome) {
      homeState.reset(null);
      await taskRequest;
      return;
    }
    await Promise.all([taskRequest, homeState.run(fetchAdminHomeFeedConfig, { preserveDataOnError: true })]);
  }

  useEffect(() => {
    void refresh();
  }, [canReadPlatformHome, homeState.reset, homeState.run, schoolId, taskState.run]);

  useEffect(() => {
    if (taskState.status !== 'success') return;
    setNotes((current) => {
      const next = { ...current };
      taskState.data.forEach((item) => {
        if (next[item.id] === undefined) next[item.id] = item.note ?? '';
      });
      return next;
    });
  }, [taskState.data, taskState.status]);

  const items = useMemo(() => taskState.data, [taskState.data]);
  const reviewableItems = useMemo(
    () => items.filter((item) => item.status === 'pending' || item.status === 'processing'),
    [items],
  );
  const selectedItems = useMemo(
    () => reviewableItems.filter((item) => selectedIds.has(item.id)),
    [reviewableItems, selectedIds],
  );
  const pendingCount = useMemo(() => items.filter((item) => item.status === 'pending').length, [items]);
  const processingCount = useMemo(() => items.filter((item) => item.status === 'processing').length, [items]);
  const approvedCount = useMemo(() => items.filter((item) => item.status === 'approved').length, [items]);
  const rejectedCount = useMemo(() => items.filter((item) => item.status === 'rejected').length, [items]);
  const featuredResourceIds = new Set(homeState.data?.resourceIds ?? []);
  const isHomeOnline = homeState.data?.effectiveStatus === 'online';
  const allReviewableSelected = reviewableItems.length > 0 && reviewableItems.every((item) => selectedIds.has(item.id));

  useEffect(() => {
    setSelectedIds((current) => {
      const validIds = new Set(reviewableItems.map((item) => item.id));
      const next = new Set([...current].filter((id) => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [reviewableItems]);

  async function handleReview(taskId: string, status: 'processing' | 'approved' | 'rejected') {
    setSubmittingTaskId(taskId);
    try {
      await reviewAdminModerationTask(taskId, { status, note: notes[taskId]?.trim() || undefined });
      await refresh();
    } finally {
      setSubmittingTaskId(null);
    }
  }

  function toggleSelected(taskId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  function toggleAllReviewable() {
    setSelectedIds((current) => {
      if (allReviewableSelected) {
        return new Set();
      }

      const next = new Set(current);
      reviewableItems.forEach((item) => next.add(item.id));
      return next;
    });
  }

  async function handleBatchReview(status: 'processing' | 'approved' | 'rejected', sourceItems = selectedItems) {
    if (sourceItems.length === 0) {
      setBatchMessage('先选择需要处理的资源。');
      return;
    }

    setBatchSubmitting(status);
    setBatchMessage('');
    try {
      for (const item of sourceItems) {
        await reviewAdminModerationTask(item.id, { status, note: notes[item.id]?.trim() || undefined });
      }
      setSelectedIds(new Set());
      setBatchMessage(`已处理 ${sourceItems.length} 条。`);
      await refresh();
    } catch {
      setBatchMessage('批量操作失败，已保留当前选择，请稍后重试。');
    } finally {
      setBatchSubmitting(null);
    }
  }

  return (
    <div className="space-y-5">
      <AdminPageTitle
        title="资源"
        meta={canReadPlatformHome ? `首页资源 ${homeState.data?.resourceIds.length ?? 0} / ${displayPublishStatus(homeState.data?.effectiveStatus)}` : '本校资源审核'}
        action={<>
          <AdminButton to={routes.adminResourceNew}><Plus size={15} />发布资源</AdminButton>
          {canReadPlatformHome ? <AdminButton to={routes.adminHome} tone="secondary">首页配置</AdminButton> : null}
        </>}
      />

      <div className="grid grid-cols-2 gap-3 px-5 lg:grid-cols-4">
        <AdminStat label="待审核" value={pendingCount} tone="bg-amber-50 text-amber-700" />
        <AdminStat label="处理中" value={processingCount} tone="bg-sky-50 text-sky-700" />
        <AdminStat label="已通过" value={approvedCount} tone="bg-emerald-50 text-emerald-700" />
        <AdminStat label="已驳回" value={rejectedCount} tone="bg-rose-50 text-rose-700" />
      </div>

      <AdminSchoolFilter value={schoolId} onChange={setSchoolId} />

      <div className="sticky top-[4.5rem] z-20 px-5">
        <AdminPanel className="shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleAllReviewable}
                disabled={reviewableItems.length === 0 || batchSubmitting !== null}
                className={`inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  allReviewableSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {allReviewableSelected ? '取消全选' : '全选待审'}
              </button>
              <div className="text-sm font-medium text-slate-500">
                已选 {selectedItems.length} / 可处理 {reviewableItems.length}
              </div>
              {batchMessage ? <div className="text-sm font-semibold text-blue-600">{batchMessage}</div> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <AdminButton
                disabled={selectedItems.length === 0 || batchSubmitting !== null}
                onClick={() => void handleBatchReview('approved')}
                tone="success"
              >
                <CheckCircle2 size={15} /> 批量通过
              </AdminButton>
              <AdminButton
                disabled={selectedItems.length === 0 || batchSubmitting !== null}
                onClick={() => void handleBatchReview('rejected')}
                tone="danger"
              >
                <XCircle size={15} /> 批量驳回
              </AdminButton>
              <AdminButton
                disabled={reviewableItems.length === 0 || batchSubmitting !== null}
                onClick={() => void handleBatchReview('approved', reviewableItems)}
              >
                一键通过本页
              </AdminButton>
            </div>
          </div>
        </AdminPanel>
      </div>

      <div className={`grid gap-5 px-5 ${canReadPlatformHome ? 'lg:grid-cols-[minmax(0,1fr)_18rem]' : ''}`}>
        <div className="space-y-3">
          {taskState.status === 'loading' ? <StateCard mode="loading" title="加载中" description="正在读取资源任务。" /> : null}
          {taskState.status === 'error' ? <StateCard mode="error" title="加载失败" description={taskState.errorMessage} actionText="重试" onAction={() => void refresh()} /> : null}
          {taskState.status === 'success' && items.length === 0 ? <AdminEmpty>暂无资源审核任务。</AdminEmpty> : null}

          {taskState.status === 'success' && items.length > 0 ? (
            items.map((item) => {
              const featured = isHomeOnline && featuredResourceIds.has(item.targetId);
              const submitting = submittingTaskId === item.id;
              const reviewable = item.status === 'pending' || item.status === 'processing';
              const selected = selectedIds.has(item.id);
              return (
                <AdminPanel key={item.id} className={selected ? 'border-blue-300 ring-2 ring-blue-100' : undefined}>
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <label className="flex min-w-0 flex-1 items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={!reviewable || batchSubmitting !== null}
                            onChange={() => toggleSelected(item.id)}
                            className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600"
                            aria-label={`选择资源审核任务 ${displaySafeText(item.targetTitle || displayAdminTaskAction(item.action))}`}
                          />
                          <div className="min-w-0">
                            <div className="truncate text-base font-semibold text-slate-950">
                              {displaySafeText(item.targetTitle || displayAdminTaskAction(item.action))}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {item.targetId} / {formatDateTimeLabel(item.createdAt)}
                            </div>
                            {item.schoolName ? (
                              <div className="mt-2 inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                                {displaySafeText(item.schoolName)}
                              </div>
                            ) : null}
                          </div>
                        </label>
                        <div className="flex shrink-0 items-center gap-2">
                          {featured ? <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">首页</span> : null}
                          <AdminStatus status={item.status} />
                        </div>
                      </div>
                      {item.targetSummary ? (
                        <div className="mt-3 line-clamp-2 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
                          {displaySafeText(item.targetSummary)}
                        </div>
                      ) : null}
                      <div className="mt-3">
                        <AdminTextarea
                          value={notes[item.id] ?? ''}
                          onChange={(value) => setNotes((current) => ({ ...current, [item.id]: value }))}
                          placeholder="审核备注"
                          name={`resource-review-note-${item.id}`}
                          ariaLabel="资源审核备注"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col justify-between gap-3 rounded-lg bg-slate-50 p-3">
                      <div className="space-y-1 text-xs text-slate-500">
                        <div>处理：{item.reviewedAt ? formatDateTimeLabel(item.reviewedAt) : '未处理'}</div>
                        <div>首页：{featured ? '展示中' : '未展示'}</div>
                        <div>学校：{displaySafeText(item.schoolName || '平台公共')}</div>
                        {item.targetOwner ? <div>提交人：{displaySafeText(item.targetOwner)}</div> : null}
                        {item.targetStatus ? <div>内容状态：{displayAdminStatus(item.targetStatus)}</div> : null}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <AdminButton to={buildResourceDetailRoute(item.targetId)} tone="secondary">
                          <ExternalLink size={15} /> 查看
                        </AdminButton>
                        {item.targetSourceUrl ? (
                          <a
                            href={item.targetSourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]"
                          >
                            <ExternalLink size={15} /> 来源
                          </a>
                        ) : null}
                        <AdminButton disabled={submitting || batchSubmitting !== null} onClick={() => void handleReview(item.id, 'processing')} tone="quiet">
                          <Clock3 size={15} /> 处理中
                        </AdminButton>
                        <AdminButton disabled={submitting || batchSubmitting !== null} onClick={() => void handleReview(item.id, 'approved')} tone="success">
                          <CheckCircle2 size={15} /> 通过
                        </AdminButton>
                        <AdminButton disabled={submitting || batchSubmitting !== null} onClick={() => void handleReview(item.id, 'rejected')} tone="danger">
                          <XCircle size={15} /> 驳回
                        </AdminButton>
                      </div>
                    </div>
                  </div>
                </AdminPanel>
              );
            })
          ) : null}
        </div>

        {canReadPlatformHome ? <AdminPanel title="首页资源位" meta={`${homeState.data?.resourceIds.length ?? 0} 条`}>
          <div className="space-y-2">
            {(homeState.data?.resourceIds ?? []).slice(0, 8).map((id, index) => (
              <div key={id} className="break-all rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                #{index + 1} {id}
              </div>
            ))}
            {(homeState.data?.resourceIds ?? []).length === 0 ? <AdminEmpty>未配置</AdminEmpty> : null}
          </div>
        </AdminPanel> : null}
      </div>
    </div>
  );
}
