import { BarChart3, ClipboardCheck, FileSearch, FolderKanban, Home, ListChecks, LogOut, Megaphone, School, ScrollText } from 'lucide-react';
import { useEffect } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { useAdminSession } from '../../hooks/useAdminSession';
import { logoutAdmin } from '../../lib/app-service';
import { buildAdminLoginRoute, routes } from '../../lib/routes';
import { cx } from './AdminUi';

const navItems = [
  { to: routes.admin, label: '总览', icon: BarChart3, end: true, scopes: ['platform', 'school'] },
  { to: routes.adminHome, label: '平台首页', icon: Home, scopes: ['platform'] },
  { to: routes.adminSchoolHome, label: '本校运营', icon: Megaphone, scopes: ['school'] },
  { to: routes.adminCompetitions, label: '竞赛目录', icon: ListChecks, scopes: ['platform'] },
  { to: routes.adminResources, label: '资源', icon: FolderKanban, scopes: ['platform', 'school'] },
  { to: routes.adminModeration, label: '审核', icon: ClipboardCheck, scopes: ['platform', 'school'] },
  { to: routes.adminReports, label: '举报', icon: FileSearch, scopes: ['platform', 'school'] },
  { to: routes.adminSchools, label: '学校管理', icon: School, scopes: ['platform'] },
  { to: routes.adminAudit, label: '审计日志', icon: ScrollText, scopes: ['platform'] },
];

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { admin, loggedIn } = useAdminSession();
  const visibleNavItems = navItems.filter((item) => item.scopes.includes(admin?.scope || 'platform'));

  useEffect(() => {
    const resetScroll = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    resetScroll();
    const frame = window.requestAnimationFrame(resetScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, location.search]);

  if (!loggedIn) {
    return <Navigate to={buildAdminLoginRoute(`${location.pathname}${location.search}`)} replace />;
  }
  const platformOnlyPaths = [routes.adminHome, routes.adminSchools, routes.adminAudit];
  if (admin?.scope === 'school' && platformOnlyPaths.some((path) => location.pathname.startsWith(path))) {
    return <Navigate to={routes.admin} replace />;
  }
  if (admin?.scope === 'platform' && location.pathname.startsWith(routes.adminSchoolHome)) {
    return <Navigate to={routes.admin} replace />;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f6f7f9] text-slate-900">
      <div className="flex min-h-screen min-w-0 flex-col md:flex-row">
        <aside className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white md:h-screen md:w-[224px] md:border-b-0 md:border-r">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 md:block">
            <div>
              <div className="text-lg font-semibold text-slate-950">校园成长</div>
              <div className="mt-1 text-xs text-slate-500">Admin</div>
            </div>
            <button
              type="button"
              onClick={() => void logoutAdmin()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 md:hidden"
            >
              <LogOut size={16} />
              退出
            </button>
          </div>

          <nav className="p-3 md:hidden" aria-label="后台导航">
            <label className="block">
              <span className="sr-only">当前后台页面</span>
              <select
                value={visibleNavItems.find((item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to))?.to || routes.admin}
                onChange={(event) => navigate(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
              >
                {visibleNavItems.map((item) => <option key={item.to} value={item.to}>{item.label}</option>)}
              </select>
            </label>
          </nav>

          <nav className="hidden p-3 md:block md:space-y-1" aria-label="后台导航">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cx(
                    'flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
                  )
                }
              >
                <item.icon size={17} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="absolute inset-x-0 bottom-0 hidden border-t border-slate-200 p-3 md:block">
            <div className="truncate text-sm font-semibold text-slate-900">{admin?.displayName}</div>
            <div className="mt-0.5 truncate text-xs text-slate-500">{admin?.username}</div>
            <div className="mt-2 inline-flex max-w-full rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
              <span className="truncate">{admin?.scope === 'school' ? admin.schoolName || '本校后台' : '平台后台'}</span>
            </div>
            <button
              type="button"
              onClick={() => void logoutAdmin()}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              <LogOut size={16} />
              退出
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-x-hidden pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
