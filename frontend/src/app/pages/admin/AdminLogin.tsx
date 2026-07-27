import { ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AdminButton, AdminPanel } from '../../components/admin/AdminUi';
import { StateCard } from '../../components/StateCard';
import { useAdminSession } from '../../hooks/useAdminSession';
import { loginAsAdmin } from '../../lib/app-service';
import { getRequestErrorMessage } from '../../lib/request-error';
import { normalizeInternalRoute, routes } from '../../lib/routes';

export function AdminLogin() {
  const navigate = useNavigate();
  const { loggedIn } = useAdminSession();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const nextPath = useMemo(() => normalizeInternalRoute(searchParams.get('next'), routes.admin), [searchParams]);

  useEffect(() => {
    if (loggedIn) navigate(nextPath, { replace: true });
  }, [loggedIn, navigate, nextPath]);

  async function handleLogin() {
    setSubmitting(true);
    setErrorMessage('');
    try {
      await loginAsAdmin({ username, password });
      navigate(nextPath, { replace: true });
    } catch (error) {
      setErrorMessage(getRequestErrorMessage(error, '管理员登录失败。'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] px-4">
      <div className="w-full max-w-[420px] space-y-4">
        <div>
          <div className="text-2xl font-semibold text-slate-950">管理员登录</div>
          <div className="mt-1 text-sm text-slate-500">校园成长后台</div>
        </div>

        {errorMessage ? <StateCard mode="error" title="登录失败" description={errorMessage} /> : null}

        <AdminPanel>
          <form
            className="grid gap-4"
            autoComplete="off"
            onSubmit={(event) => {
              event.preventDefault();
              void handleLogin();
            }}
          >
            <label htmlFor="admin-login-username" className="text-sm font-semibold text-slate-700">
              账号
              <input
                id="admin-login-username"
                name="campus-login-id"
                aria-label="管理员账号"
                autoComplete="new-password"
                spellCheck={false}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                placeholder="管理员账号"
              />
            </label>

            <label htmlFor="admin-login-password" className="text-sm font-semibold text-slate-700">
              密码
              <input
                id="admin-login-password"
                name="campus-login-key"
                type="password"
                aria-label="管理员密码"
                autoComplete="new-password"
                spellCheck={false}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
                placeholder="管理员密码"
              />
            </label>

            <AdminButton
              type="submit"
              disabled={submitting}
              className="w-full"
            >
              {submitting ? '登录中…' : '进入后台'}
              <ArrowRight size={16} />
            </AdminButton>
          </form>
        </AdminPanel>
      </div>
    </div>
  );
}
