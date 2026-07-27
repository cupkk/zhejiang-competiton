import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminSchoolFilter } from '../../components/admin/AdminSchoolFilter';
import { AdminEmpty, AdminPageTitle, AdminPanel } from '../../components/admin/AdminUi';
import { StateCard } from '../../components/StateCard';
import { useRequestState } from '../../hooks/useRequestState';
import { fetchAdminAuditLogs } from '../../lib/app-service';
import type { AdminAuditLogItem } from '../../lib/admin-types';
import { formatDateTimeLabel } from '../../lib/format';

const inputClass = 'min-h-11 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70';

const actionLabels: Record<string, string> = {
  'admin.login': '登录后台',
  'admin.logout': '退出后台',
  'moderation.review': '审核内容',
  'school_home.update': '更新本校运营',
  'home_config.update': '更新平台首页',
  'home_config.upload_image': '上传首页图片',
  'school.update': '更新学校状态',
  'school_admin.create': '创建学校管理员',
  'school_admin.update': '更新学校管理员',
};

function displayAction(action: string) {
  return actionLabels[action] || action;
}

function displayIp(ip?: string) {
  return ip?.replace(/^::ffff:/, '') || '-';
}

export function AdminAuditLogs() {
  const state = useRequestState<AdminAuditLogItem[]>({ initialData: () => [], errorMessage: '审计日志加载失败。' });
  const [schoolId, setSchoolId] = useState('all');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => void state.run(() => fetchAdminAuditLogs({ schoolId: schoolId === 'all' ? undefined : schoolId, action: action.trim() || undefined, from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined, to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined, limit: 150 })), 180);
    return () => window.clearTimeout(timer);
  }, [action, from, schoolId, state.run, to]);

  return (
    <div className="space-y-5">
      <AdminPageTitle title="审计日志" meta="管理员登录、审核和配置修改记录" />
      <AdminSchoolFilter value={schoolId} onChange={setSchoolId} />
      <div className="grid gap-3 px-5 sm:grid-cols-[minmax(12rem,1fr)_11rem_11rem]">
        <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100/70"><Search size={16} className="text-slate-400" /><input value={action} onChange={(event) => setAction(event.target.value)} name="admin-audit-action" autoComplete="off" aria-label="筛选操作代码" placeholder="操作代码" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="开始日期" className={inputClass} />
        <input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="结束日期" className={inputClass} />
      </div>
      <div className="px-5">
        <AdminPanel title="操作记录" meta={`${state.data.length} 条`}>
          {state.status === 'loading' ? <StateCard mode="loading" title="加载中" /> : null}
          {state.status === 'error' ? <StateCard mode="error" title="加载失败" description={state.errorMessage} /> : null}
          {state.status === 'success' ? <div className="overflow-x-auto">
            {state.data.length ? <table className="w-full min-w-[760px] border-collapse text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th className="px-3 py-2">时间</th><th className="px-3 py-2">管理员</th><th className="px-3 py-2">学校</th><th className="px-3 py-2">操作</th><th className="px-3 py-2">目标</th><th className="px-3 py-2">IP</th></tr></thead><tbody>{state.data.map((item) => <tr key={item.id} className="border-b border-slate-100"><td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{formatDateTimeLabel(item.createdAt)}</td><td className="px-3 py-3"><div className="font-medium text-slate-900">{item.adminDisplayName}</div><div className="text-xs text-slate-500">{item.adminUsername}</div></td><td className="px-3 py-3 text-slate-600">{item.schoolName || '平台'}</td><td className="px-3 py-3 font-medium text-slate-900" title={item.action}>{displayAction(item.action)}</td><td className="px-3 py-3 text-slate-600">{item.targetType || '-'}{item.targetId ? ` / ${item.targetId}` : ''}</td><td className="px-3 py-3 text-xs text-slate-500">{displayIp(item.ip)}</td></tr>)}</tbody></table> : <AdminEmpty>暂无审计记录</AdminEmpty>}
          </div> : null}
        </AdminPanel>
      </div>
    </div>
  );
}
