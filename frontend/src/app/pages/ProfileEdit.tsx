import { useState } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { StateCard } from '../components/StateCard';
import { ProfileForm } from '../components/profile/ProfileForm';
import { Toast, useToast } from '../components/Toast';
import { useSession } from '../hooks/useSession';
import { saveCurrentUserProfile } from '../lib/app-service';
import { getRequestErrorMessage } from '../lib/request-error';
import { routes } from '../lib/routes';
import { startQuickLogin } from '../lib/quick-login';

export function ProfileEdit() {
  const navigate = useNavigate();
  const { loggedIn, user } = useSession();
  const [loggingIn, setLoggingIn] = useState(false);
  const { toast, showToast, clearToast } = useToast();

  if (!loggedIn || !user) {
    return (
      <div className="min-h-full bg-slate-50 pb-8">
        <Toast toast={toast} onClose={clearToast} />
        <PageHeader title="编辑资料" back fallbackTo={routes.profile} />
        <div className="px-4">
          <StateCard
            mode="auth"
            title="请先登录"
            description="登录后才能编辑你的个人资料。"
            actionText={loggingIn ? '登录中…' : '立即登录'}
            onAction={() =>
              void startQuickLogin({
                navigate,
                nextPath: routes.profileEdit,
                onStart: () => setLoggingIn(true),
                onComplete: () => setLoggingIn(false),
              })
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 pb-8">
      <Toast toast={toast} onClose={clearToast} />
      <PageHeader title="编辑资料" back fallbackTo={routes.profile} />
      <div className="space-y-4 px-4">
        <section className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div className="text-[12px] font-medium text-slate-500">基础资料</div>
          <div className="mt-2 text-sm leading-6 text-slate-600">学校、专业和关注方向会用于组队申请与个人主页展示。</div>
        </section>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <ProfileForm
            user={user}
            submitLabel="保存资料"
            onCancel={() => navigate(-1)}
            onSubmit={async (payload) => {
              try {
                await saveCurrentUserProfile(payload);
                showToast('资料已保存', 'success');
                navigate(routes.profile, { replace: true });
              } catch (error) {
                showToast(getRequestErrorMessage(error, '资料保存失败，请稍后重试。'), 'error');
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
