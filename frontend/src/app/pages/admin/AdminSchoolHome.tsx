import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminButton, AdminEmpty, AdminPageTitle, AdminPanel, AdminTextarea, cx } from '../../components/admin/AdminUi';
import { StateCard } from '../../components/StateCard';
import { useRequestState } from '../../hooks/useRequestState';
import { fetchAdminSchoolHomeConfig, updateAdminSchoolHomeConfig } from '../../lib/app-service';
import type { AdminSchoolHomeConfig } from '../../lib/admin-types';
import { formatDateTimeLabel } from '../../lib/format';

function SelectableList({
  title,
  items,
  selectedIds,
  onChange,
}: {
  title: string;
  items: AdminSchoolHomeConfig['availableTeams'];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <AdminPanel title={title} meta={`已选 ${selectedIds.length} 条，首页最多展示 2 条`}>
      <div className="space-y-2">
        {items.length ? items.map((item) => {
          const checked = selectedIds.includes(item.id);
          const disabled = !checked && selectedIds.length >= 2;
          return (
            <label key={item.id} className={cx('flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2.5', checked ? 'cursor-pointer border-blue-300 bg-blue-50' : disabled ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60' : 'cursor-pointer border-slate-200 bg-white')}>
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(checked ? selectedIds.filter((id) => id !== item.id) : [...selectedIds, item.id].slice(0, 2))}
                className="h-4 w-4 accent-blue-600"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900">{item.title}</span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">{item.meta}</span>
              </span>
            </label>
          );
        }) : <AdminEmpty>暂无已审核内容</AdminEmpty>}
      </div>
    </AdminPanel>
  );
}

export function AdminSchoolHome() {
  const state = useRequestState<AdminSchoolHomeConfig | null>({ initialData: null, fallbackData: null, errorMessage: '本校运营配置加载失败。' });
  const [announcement, setAnnouncement] = useState('');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [postIds, setPostIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { void state.run(() => fetchAdminSchoolHomeConfig()); }, [state.run]);
  useEffect(() => {
    if (!state.data) return;
    setAnnouncement(state.data.announcement);
    setTeamIds(state.data.teamIds);
    setPostIds(state.data.postIds);
  }, [state.data]);

  async function save() {
    if (!state.data || saving) return;
    setSaving(true);
    setMessage('');
    try {
      const next = await updateAdminSchoolHomeConfig({ announcement, teamIds, postIds });
      state.setData(next);
      setMessage('已保存');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <AdminPageTitle
        title={state.data ? `${state.data.schoolName}运营` : '本校运营'}
        meta={state.data?.updatedAt ? `更新于 ${formatDateTimeLabel(state.data.updatedAt)}` : '公告和首页推荐只对本校认证用户生效'}
        action={<AdminButton onClick={() => void save()} disabled={!state.data || saving}><Save size={16} />{saving ? '保存中' : '保存'}</AdminButton>}
      />
      {state.status === 'loading' ? <div className="px-5"><StateCard mode="loading" title="加载中" /></div> : null}
      {state.status === 'error' ? <div className="px-5"><StateCard mode="error" title="加载失败" description={state.errorMessage} actionText="重试" onAction={() => void state.run(() => fetchAdminSchoolHomeConfig())} /></div> : null}
      {state.data ? (
        <div className="space-y-5 px-5">
          <AdminPanel title="本校公告" meta="最多 120 字，展示在用户首页公告栏">
            <AdminTextarea value={announcement} onChange={(value) => setAnnouncement(value.slice(0, 120))} name="school-announcement" ariaLabel="本校公告" placeholder="填写本校公告" />
            <div className="mt-2 text-right text-xs text-slate-400">{announcement.length}/120</div>
          </AdminPanel>
          <div className="grid gap-5 xl:grid-cols-2">
            <SelectableList title="推荐组队" items={state.data.availableTeams} selectedIds={teamIds} onChange={setTeamIds} />
            <SelectableList title="推荐经验" items={state.data.availablePosts} selectedIds={postIds} onChange={setPostIds} />
          </div>
          {message ? <div className={cx('text-sm font-medium', message === '已保存' ? 'text-emerald-600' : 'text-rose-600')}>{message}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
