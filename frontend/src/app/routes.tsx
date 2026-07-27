import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { Ai } from './pages/Ai';
import { Checkin } from './pages/Checkin';
import { Community } from './pages/Community';
import { CompetitionDetail } from './pages/CompetitionDetail';
import { Competitions } from './pages/Competitions';
import { Favorites } from './pages/Favorites';
import { History } from './pages/History';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Messages } from './pages/Messages';
import { MyActivity } from './pages/MyActivity';
import { MyResources } from './pages/MyResources';
import { NotFound } from './pages/NotFound';
import { Orders } from './pages/Orders';
import { PostDetail } from './pages/PostDetail';
import { Profile } from './pages/Profile';
import { PublishPost } from './pages/PublishPost';
import { PublishResource } from './pages/PublishResource';
import { PublishTeam } from './pages/PublishTeam';
import { RefundResult } from './pages/RefundResult';
import { ResourceDetail } from './pages/ResourceDetail';
import { ResourceSubmissions } from './pages/ResourceSubmissions';
import { Resources } from './pages/Resources';
import { RouteErrorBoundary } from './pages/RouteErrorBoundary';
import { AccountSettings } from './pages/AccountSettings';
import { SchoolSelect } from './pages/SchoolSelect';
import { SchoolVerify } from './pages/SchoolVerify';
import { Search } from './pages/Search';
import { TeamDetail } from './pages/TeamDetail';
import { Teams } from './pages/Teams';

function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div
        role="status"
        aria-label="页面加载中"
        className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600"
      />
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    ErrorBoundary: RouteErrorBoundary,
    children: [
      { index: true, Component: Home },
      { path: 'competitions', Component: Competitions },
      { path: 'competitions/:id', Component: CompetitionDetail },
      { path: 'resources', Component: Resources },
      { path: 'resources/:id', Component: ResourceDetail },
      { path: 'community', Component: Community },
      { path: 'posts/:id', Component: PostDetail },
      { path: 'teams', Component: Teams },
      { path: 'teams/:id', Component: TeamDetail },
      { path: 'profile', Component: Profile },
      { path: 'profile/edit', Component: AccountSettings },
      { path: 'checkin', Component: Checkin },
      { path: 'schools', Component: SchoolSelect },
      { path: 'school-verify', Component: SchoolVerify },
      { path: 'my-activity', Component: MyActivity },
      { path: 'history', Component: History },
      { path: 'account-settings', Component: AccountSettings },
      { path: 'search', Component: Search },
      { path: 'login', Component: Login },
      { path: 'messages', Component: Messages },
      { path: 'favorites', Component: Favorites },
      { path: 'my-resources', Component: MyResources },
      { path: 'publish-resource', Component: PublishResource },
      { path: 'resource-submissions', Component: ResourceSubmissions },
      { path: 'orders', Component: Orders },
      { path: 'orders/:id/refund', Component: RefundResult },
      { path: 'publish-team', Component: PublishTeam },
      { path: 'publish-post', Component: PublishPost },
      { path: 'ai', Component: Ai },
      { path: '*', Component: NotFound },
    ],
  },
  {
    path: '/admin/login',
    lazy: async () => ({ Component: (await import('./pages/admin/AdminLogin')).AdminLogin }),
    HydrateFallback: RouteLoading,
    ErrorBoundary: RouteErrorBoundary,
  },
  {
    path: '/admin',
    lazy: async () => ({ Component: (await import('./components/admin/AdminLayout')).AdminLayout }),
    HydrateFallback: RouteLoading,
    ErrorBoundary: RouteErrorBoundary,
    children: [
      { index: true, lazy: async () => ({ Component: (await import('./pages/admin/AdminDashboard')).AdminDashboard }) },
      { path: 'home', lazy: async () => ({ Component: (await import('./pages/admin/AdminHomeConfig')).AdminHomeConfig }) },
      { path: 'school-home', lazy: async () => ({ Component: (await import('./pages/admin/AdminSchoolHome')).AdminSchoolHome }) },
      { path: 'schools', lazy: async () => ({ Component: (await import('./pages/admin/AdminSchools')).AdminSchools }) },
      { path: 'audit', lazy: async () => ({ Component: (await import('./pages/admin/AdminAuditLogs')).AdminAuditLogs }) },
      { path: 'resources', lazy: async () => ({ Component: (await import('./pages/admin/AdminResources')).AdminResources }) },
      { path: 'resources/new', lazy: async () => ({ Component: (await import('./pages/admin/AdminResourcePublish')).AdminResourcePublish }) },
      { path: 'competitions', lazy: async () => ({ Component: (await import('./pages/admin/AdminCompetitions')).AdminCompetitions }) },
      { path: 'moderation', lazy: async () => ({ Component: (await import('./pages/admin/AdminModeration')).AdminModeration }) },
      { path: 'reports', lazy: async () => ({ Component: (await import('./pages/admin/AdminReports')).AdminReports }) },
    ],
  },
]);
