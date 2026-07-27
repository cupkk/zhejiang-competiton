import { CheckCircle2, Clock3, FileSearch, FolderKanban, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminSchoolFilter } from '../../components/admin/AdminSchoolFilter';
import { AdminTeamExamples } from '../../components/admin/AdminTeamExamples';
import { AdminButton, AdminEmpty, AdminPageTitle, AdminPanel, AdminStat, AdminStatus, AdminTextarea, cx } from '../../components/admin/AdminUi';
import { StateCard } from '../../components/StateCard';
import { useRequestState } from '../../hooks/useRequestState';
import { fetchAdminModerationTasks, reviewAdminModerationTask } from '../../lib/app-service';
import type { AdminModerationTask } from '../../lib/admin-types';
import { displayAdminTargetType, displayAdminTaskAction, displayAdminStatus, displaySafeText, formatDateTimeLabel } from '../../lib/format';
import { routes } from '../../lib/routes';

const targetTypeOptions = [
  { value: 'all', label: '全部' },
  { value: 'resource', label: '资源' },
  { value: 'post', label: '帖子' },
  { value: 'comment', label: '评论' },
  { value: 'team', label: '组队' },
  { value: 'report', label: '举报' },
];

const statusOptions = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'processing', label: '处理中' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
];

export function AdminModeration() {
  const [view, setView] = useState<'queue' | 'examples'>('queue');
  const [targetType, setTargetType] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [schoolId, setSchoolId] = useState('all');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [batchSubmitting, setBatchSubmitting] = useState<'processing' | 'approved' | 'rejected' | null>(null);
  const [batchMessage, setBatchMessage] = useState('');

  const state = useRequestState<AdminModerationTask[]>({
    initialData: () => [],
    errorMessage: '审核任务加载失败。',
  });

  const refresh = async () => {
    await state.run(() =>
      fetchAdminModerationTasks({
        targetType: targetType === 'all' ? undefined : targetType,
        status: statusFilter === 'all' ? undefined : statusFilter,
        schoolId: schoolId === 'all' ? undefined : schoolId,
      }),
    );
  };

  useEffect(() => {
    void refresh();
  }, [schoolId, state.run, statusFilter, targetType]);

  useEffect(() => {
    if (state.status !== 'success') return;
    setNotes((current) => {
      const next = { ...current };
      state.data.forEach((item) => {
        if (next[item.id] === undefined) next[item.id] = item.note ?? '';
      });
      return next;
    });
  }, [state.data, state.status]);

  const items = useMemo(() => state.data, [state.data]);
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
      setBatchMessage('先选择需要处理的任务。');
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
        title="审核"
        meta={view === 'examples' ? '内测示例' : `${targetTypeOptions.find((item) => item.value === targetType)?.label ?? '全部'} / ${statusOptions.find((item) => item.value === statusFilter)?.label ?? '全部'}`}
        action={
          <div className="flex gap-2">
            <AdminButton to={routes.adminResources} tone="secondary"><FolderKanban size={15} />资源</AdminButton>
            <AdminButton to={routes.adminReports} tone="secondary"><FileSearch size={15} />举报</AdminButton>
          </div>
        }
      />

      <div className="px-5">
        <div className="inline-flex rounded-lg bg-slate-100 p-1">
          <button type="button" onClick={() => setView('queue')} className={cx('min-h-11 rounded-md px-4 text-sm font-semibold', view === 'queue' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500')}>审核队列</button>
          <button type="button" onClick={() => setView('examples')} className={cx('min-h-11 rounded-md px-4 text-sm font-semibold', view === 'examples' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500')}>内测示例</button>
        </div>
      </div>

      <AdminSchoolFilter value={schoolId} onChange={setSchoolId} />

      {view === 'examples' ? <AdminTeamExamples schoolId={schoolId} /> : null}
      {view === 'queue' ? <>

      <div className="grid grid-cols-4 gap-3 px-5">
        <AdminStat label="待处理" value={pendingCount} tone="bg-amber-50 text-amber-700" />
        <AdminStat label="处理中" value={processingCount} tone="bg-sky-50 text-sky-700" />
        <AdminStat label="已通过" value={approvedCount} tone="bg-emerald-50 text-emerald-700" />
        <AdminStat label="已驳回" value={rejectedCount} tone="bg-rose-50 text-rose-700" />
      </div>

      <div className="px-5">
        <AdminPanel>
          <div className="flex flex-wrap items-center gap-2">
            {targetTypeOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setTargetType(item.value)}
                className={cx('min-h-11 rounded-lg px-3.5 text-sm font-semibold', targetType === item.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600')}
              >
                {item.label}
              </button>
            ))}
            <div className="mx-1 h-5 w-px bg-slate-200" />
            {statusOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setStatusFilter(item.value)}
                className={cx('min-h-11 rounded-lg px-3.5 text-sm font-semibold', statusFilter === item.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}
              >
                {item.label}
              </button>
            ))}
          </div>
        </AdminPanel>
      </div>

      <div className="sticky top-[4.5rem] z-20 px-5">
        <AdminPanel className="shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleAllReviewable}
                disabled={reviewableItems.length === 0 || batchSubmitting !== null}
                className={cx(
                  'inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  allReviewableSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700',
                )}
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
                tone="primary"
              >
                一键通过本页
              </AdminButton>
            </div>
          </div>
        </AdminPanel>
      </div>

      <div className="px-5">
        {state.status === 'loading' ? <StateCard mode="loading" title="加载中" description="正在读取审核队列。" /> : null}
        {state.status === 'error' ? <StateCard mode="error" title="加载失败" description={state.errorMessage} actionText="重试" onAction={() => void refresh()} /> : null}
        {state.status === 'success' && items.length === 0 ? <AdminEmpty>当前没有审核任务。</AdminEmpty> : null}

        {state.status === 'success' && items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item) => {
              const submitting = submittingTaskId === item.id;
              const reviewable = item.status === 'pending' || item.status === 'processing';
              const selected = selectedIds.has(item.id);
              return (
                <AdminPanel key={item.id} className={selected ? 'border-blue-300 ring-2 ring-blue-100' : undefined}>
                  <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <label className="flex min-w-0 flex-1 items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={!reviewable || batchSubmitting !== null}
                            onChange={() => toggleSelected(item.id)}
                            className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600"
                            aria-label={`选择审核任务 ${displaySafeText(item.targetTitle || displayAdminTaskAction(item.action))}`}
                          />
                          <div className="min-w-0">
                          <div className="truncate text-base font-semibold text-slate-950">
                            {displaySafeText(item.targetTitle || displayAdminTaskAction(item.action))}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {displayAdminTargetType(item.targetType)} / {item.targetId} / {formatDateTimeLabel(item.createdAt)}
                          </div>
                          {item.schoolName ? (
                            <div className="mt-2 inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                              {displaySafeText(item.schoolName)}
                            </div>
                          ) : null}
                          </div>
                        </label>
                        <AdminStatus status={item.status} />
                      </div>
                      {item.targetSummary ? (
                        <div className="mt-3 line-clamp-2 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
                          {displaySafeText(item.targetSummary)}
                        </div>
                      ) : null}
                      {item.targetSourceUrl ? (
                        <a
                          href={item.targetSourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                        >
                          查看来源
                        </a>
                      ) : null}
                      <div className="mt-3">
                        <AdminTextarea
                          value={notes[item.id] ?? ''}
                          onChange={(value) => setNotes((current) => ({ ...current, [item.id]: value }))}
                          placeholder="审核备注"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col justify-between gap-3 rounded-lg bg-slate-50 p-3">
                      <div className="space-y-1 text-xs text-slate-500">
                        <div>处理：{item.reviewedAt ? formatDateTimeLabel(item.reviewedAt) : '未处理'}</div>
                        <div>状态：{displayAdminStatus(item.status)}</div>
                        <div>学校：{displaySafeText(item.schoolName || '平台公共')}</div>
                        {item.targetOwner ? <div>提交人：{displaySafeText(item.targetOwner)}</div> : null}
                        {item.targetType === 'team' && item.targetVisibilityScope ? (
                          <div>可见范围：{item.targetVisibilityScope === 'cross_school' ? '全部高校' : '仅本校'}</div>
                        ) : null}
                        {item.targetType === 'team' && item.targetContactEmail ? (
                          <div className="break-all">联系邮箱：{displaySafeText(item.targetContactEmail)}</div>
                        ) : null}
                        {item.targetStatus ? <div>内容状态：{displayAdminStatus(item.targetStatus)}</div> : null}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
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
            })}
          </div>
        ) : null}
      </div>
      </> : null}
    </div>
  );
}
