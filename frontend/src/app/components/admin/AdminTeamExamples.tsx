import { Archive, CheckSquare2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { archiveAdminTeamExamples, fetchAdminTeamExamples } from '../../lib/app-service';
import type { AdminTeamExampleItem } from '../../lib/admin-types';
import { displaySafeText, formatDateTimeLabel } from '../../lib/format';
import { useRequestState } from '../../hooks/useRequestState';
import { StateCard } from '../StateCard';
import { AdminButton, AdminEmpty, AdminPanel, cx } from './AdminUi';

const statusOptions = [
  { value: 'active', label: '使用中' },
  { value: 'archived', label: '已归档' },
  { value: 'all', label: '全部' },
] as const;

export function AdminTeamExamples({ schoolId }: { schoolId: string }) {
  const [status, setStatus] = useState<(typeof statusOptions)[number]['value']>('active');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [archiving, setArchiving] = useState(false);
  const [message, setMessage] = useState('');
  const state = useRequestState<AdminTeamExampleItem[]>({
    initialData: () => [],
    errorMessage: '内测示例加载失败。',
  });

  const refresh = async () => {
    await state.run(() => fetchAdminTeamExamples({
      schoolId: schoolId === 'all' ? undefined : schoolId,
      status,
    }));
  };

  useEffect(() => {
    setSelectedIds(new Set());
    setMessage('');
    void refresh();
  }, [schoolId, state.run, status]);

  const activeItems = useMemo(() => state.data.filter((item) => !item.archived), [state.data]);
  const selectedItems = useMemo(() => activeItems.filter((item) => selectedIds.has(item.id)), [activeItems, selectedIds]);
  const allSelected = activeItems.length > 0 && selectedItems.length === activeItems.length;

  function toggle(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function archiveSelected() {
    if (selectedItems.length === 0) return;
    setArchiving(true);
    setMessage('');
    try {
      const result = await archiveAdminTeamExamples(selectedItems.map((item) => item.id));
      setSelectedIds(new Set());
      setMessage(`已归档 ${result.archivedCount} 条示例。`);
      await refresh();
    } catch {
      setMessage('归档失败，请刷新后重试。');
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div className="space-y-4 px-5">
      <AdminPanel>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setStatus(item.value)}
                className={cx(
                  'min-h-11 rounded-lg px-3.5 text-sm font-semibold',
                  status === item.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={activeItems.length === 0 || archiving}
              onClick={() => setSelectedIds(allSelected ? new Set() : new Set(activeItems.map((item) => item.id)))}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-100 px-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              <CheckSquare2 size={15} />{allSelected ? '取消全选' : '全选使用中'}
            </button>
            <AdminButton disabled={selectedItems.length === 0 || archiving} onClick={() => void archiveSelected()} tone="danger">
              <Archive size={15} />{archiving ? '归档中' : `批量归档 (${selectedItems.length})`}
            </AdminButton>
          </div>
        </div>
        {message ? <div className="mt-3 text-sm font-semibold text-blue-600">{message}</div> : null}
      </AdminPanel>

      {state.status === 'loading' ? <StateCard mode="loading" title="正在加载内测示例" /> : null}
      {state.status === 'error' ? <StateCard mode="error" title="加载失败" description={state.errorMessage} actionText="重试" onAction={() => void refresh()} /> : null}
      {state.status === 'success' && state.data.length === 0 ? <AdminEmpty>当前筛选下没有内测示例。</AdminEmpty> : null}
      {state.status === 'success' ? state.data.map((item) => (
        <AdminPanel key={item.id} className={selectedIds.has(item.id) ? 'border-blue-300 ring-2 ring-blue-100' : undefined}>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={selectedIds.has(item.id)}
              disabled={item.archived || archiving}
              onChange={() => toggle(item.id)}
              className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600"
              aria-label={`选择内测示例 ${displaySafeText(item.title)}`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-base font-semibold text-slate-950">{displaySafeText(item.title)}</div>
                <span className={cx('rounded-md px-2 py-1 text-xs font-semibold', item.archived ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700')}>
                  {item.archived ? '已归档' : '内测示例'}
                </span>
              </div>
              <div className="mt-2 text-sm text-slate-600">{displaySafeText(item.schoolName)} / {displaySafeText(item.competitionName)}</div>
              <div className="mt-1 text-xs text-slate-400">
                {item.listingType === 'member_available' ? '求加入' : '找队友'} / 到期 {item.expiresAt ? formatDateTimeLabel(item.expiresAt) : '未设置'}
              </div>
            </div>
          </label>
        </AdminPanel>
      )) : null}
    </div>
  );
}
