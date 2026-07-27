import { BadgeCheck } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { UserProfile } from '../../types/entities';
import { routes } from '../lib/routes';

export function hasVerifiedSchool(user: UserProfile | null | undefined) {
  return user?.schoolCertificationStatus === 'verified';
}

export function SchoolVerificationNotice({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();

  return (
    <section className={`border border-slate-200 bg-white ${compact ? 'flex items-center gap-3 rounded-lg px-3.5 py-2.5' : 'rounded-lg p-4'}`}>
      <BadgeCheck size={20} className="shrink-0 text-blue-600" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900">完成学校认证</div>
        {!compact ? <p className="mt-1 text-sm leading-6 text-slate-500">验证教育邮箱和手机号后，可以查看并发布本校内容。</p> : null}
      </div>
      <button type="button" onClick={() => navigate(routes.schoolVerify)} className="min-h-11 shrink-0 px-2 text-sm font-semibold text-blue-600">
        去认证
      </button>
    </section>
  );
}
