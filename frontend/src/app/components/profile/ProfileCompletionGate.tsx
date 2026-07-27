import { useState } from 'react';
import type { UserProfile } from '../../../types/entities';
import { saveCurrentUserProfile } from '../../lib/app-service';
import { getProfileCompletionHint } from '../../lib/profile-completion';
import { getRequestErrorMessage } from '../../lib/request-error';
import { ProfileForm } from './ProfileForm';

interface ProfileCompletionGateProps {
  user: UserProfile;
}

export function ProfileCompletionGate({ user }: ProfileCompletionGateProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm">
      <div className="flex min-h-full items-end sm:items-center sm:justify-center">
        <div className="w-full rounded-lg bg-white p-5 shadow-xl sm:max-w-[32rem]">
          <div className="inline-flex items-center gap-2 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-600">
            首次登录
          </div>

          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
            先补全资料，再继续使用
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            学校、年级和关注方向会用于组队申请与个人主页展示。
          </p>

          <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-600">
            {getProfileCompletionHint(user)}
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-600">
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-5">
            <ProfileForm
              user={user}
              submitLabel="保存并继续"
              submitting={submitting}
              onSubmit={async (payload) => {
                setSubmitting(true);
                setErrorMessage('');

                try {
                  await saveCurrentUserProfile(payload);
                } catch (error) {
                  setErrorMessage(getRequestErrorMessage(error, '资料保存失败，请稍后重试。'));
                } finally {
                  setSubmitting(false);
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
