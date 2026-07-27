import { KeyRound, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminButton, AdminEmpty, AdminPageTitle, AdminPanel, AdminStatus, cx } from '../../components/admin/AdminUi';
import { StateCard } from '../../components/StateCard';
import { useRequestState } from '../../hooks/useRequestState';
import { createAdminSchoolAdmin, fetchAdminSchools, updateAdminSchool, updateAdminSchoolAdmin } from '../../lib/app-service';
import type { AdminSchoolListResult } from '../../lib/admin-types';
import { formatDateTimeLabel } from '../../lib/format';

const inputClass = 'min-h-11 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70';

export function AdminSchools() {
  const state = useRequestState<AdminSchoolListResult>({ initialData: { items: [], total: 0 }, errorMessage: '学校数据加载失败。' });
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  async function load(search = keyword) {
    const result = await state.run(() => fetchAdminSchools({ keyword: search.trim() || undefined, limit: 30 }));
    if (result?.items.length && !result.items.some((item) => item.id === selectedId)) setSelectedId(result.items[0].id);
  }
  useEffect(() => { const timer = window.setTimeout(() => void load(keyword), 220); return () => window.clearTimeout(timer); }, [keyword]);
  const selected = useMemo(() => state.data.items.find((item) => item.id === selectedId) || state.data.items[0], [selectedId, state.data.items]);

  async function mutate(task: () => Promise<unknown>, success: string) {
    setMessage('');
    try { await task(); setMessage(success); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : '操作失败'); }
  }

  return (
    <div className="space-y-5">
      <AdminPageTitle title="学校管理" meta={`共 ${state.data.total} 所匹配学校`} />
      <div className="px-5">
        <label className="flex min-h-11 max-w-xl items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100/70">
          <Search size={17} className="text-slate-400" />
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} name="admin-school-search" autoComplete="off" aria-label="搜索学校" placeholder="搜索学校、城市或省份" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
      </div>
      {state.status === 'loading' ? <div className="px-5"><StateCard mode="loading" title="加载中" /></div> : null}
      {state.status === 'error' ? <div className="px-5"><StateCard mode="error" title="加载失败" description={state.errorMessage} /></div> : null}
      <div className="grid min-w-0 gap-5 px-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <AdminPanel title="学校">
          <div className="max-h-[70vh] space-y-2 overflow-y-auto">
            {state.data.items.length ? state.data.items.map((school) => (
              <button key={school.id} type="button" onClick={() => setSelectedId(school.id)} className={cx('flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left', selected?.id === school.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white')}>
                {school.logoUrl ? <img src={school.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-md object-contain" /> : <div className="h-8 w-8 rounded-md bg-slate-100" />}
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{school.name}</span><span className="block truncate text-xs text-slate-500">{school.city || school.province || '地区未录入'}</span></span>
              </button>
            )) : <AdminEmpty>没有匹配学校</AdminEmpty>}
          </div>
        </AdminPanel>

        {selected ? <div className="min-w-0 space-y-5">
          <AdminPanel title={selected.name} meta={`${selected.verifiedUsers} 名已认证用户 / ${selected.admins.length} 名学校管理员`}>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3 text-sm">帖子 <strong>{selected.approvedPosts}</strong></div>
              <div className="rounded-lg bg-slate-50 p-3 text-sm">组队 <strong>{selected.approvedTeams}</strong></div>
              <div className="rounded-lg bg-slate-50 p-3 text-sm">资源 <strong>{selected.approvedResources}</strong></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <AdminButton tone={selected.isOpen ? 'success' : 'quiet'} onClick={() => void mutate(() => updateAdminSchool(selected.id, { isOpen: !selected.isOpen }), selected.isOpen ? '学校已停用' : '学校已启用')}>{selected.isOpen ? '已启用' : '已停用'}</AdminButton>
              <AdminButton tone={selected.isHot ? 'primary' : 'secondary'} onClick={() => void mutate(() => updateAdminSchool(selected.id, { isHot: !selected.isHot }), '热门状态已更新')}>{selected.isHot ? '热门学校' : '设为热门'}</AdminButton>
            </div>
          </AdminPanel>

          <AdminPanel title="学校管理员">
            <div className="space-y-3">
              {selected.admins.length ? selected.admins.map((admin) => (
                <div key={admin.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><div className="text-sm font-semibold text-slate-900">{admin.displayName}</div><div className="mt-1 text-xs text-slate-500">{admin.username} / 最近登录 {admin.lastLoginAt ? formatDateTimeLabel(admin.lastLoginAt) : '暂无'}</div></div>
                    <AdminStatus status={admin.status} />
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_auto_auto]">
                    <input type="password" value={resetPasswords[admin.id] || ''} onChange={(event) => setResetPasswords((current) => ({ ...current, [admin.id]: event.target.value }))} placeholder="新密码（至少 10 位）" className={inputClass} />
                    <AdminButton tone="secondary" onClick={() => void mutate(() => updateAdminSchoolAdmin(admin.id, { password: resetPasswords[admin.id] }), '密码已重置')}><KeyRound size={15} />重置</AdminButton>
                    <AdminButton tone={admin.status === 'active' ? 'danger' : 'success'} onClick={() => void mutate(() => updateAdminSchoolAdmin(admin.id, { status: admin.status === 'active' ? 'disabled' : 'active' }), admin.status === 'active' ? '账号已停用' : '账号已启用')}>{admin.status === 'active' ? '停用' : '启用'}</AdminButton>
                  </div>
                </div>
              )) : <AdminEmpty>暂无学校管理员</AdminEmpty>}
            </div>
          </AdminPanel>

          <AdminPanel title="创建管理员">
            <div className="grid gap-3 md:grid-cols-3">
              <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="账号" className={inputClass} />
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="显示名称" className={inputClass} />
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="初始密码（至少 10 位）" className={inputClass} />
            </div>
            <AdminButton className="mt-3" onClick={() => void mutate(async () => { await createAdminSchoolAdmin(selected.id, { username, displayName, password }); setUsername(''); setDisplayName(''); setPassword(''); }, '管理员已创建')}><Plus size={16} />创建</AdminButton>
          </AdminPanel>
          {message ? <div className={cx('text-sm font-medium', /失败|错误|至少|存在|无效/.test(message) ? 'text-rose-600' : 'text-emerald-600')}>{message}</div> : null}
        </div> : null}
      </div>
    </div>
  );
}
