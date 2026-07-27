import { CheckCircle2, Mail, Phone } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { School, SchoolMembership, SchoolVerificationCodeResult } from '../../types/entities';
import { PageHeader } from '../components/PageHeader';
import { SchoolLogo } from '../components/SchoolLogo';
import { StateCard } from '../components/StateCard';
import { Toast, useToast } from '../components/Toast';
import { ActionButton, fieldClass } from '../components/ui';
import { useSession } from '../hooks/useSession';
import {
  loadSchoolList,
  loadSchoolMemberships,
  sendCurrentUserSchoolVerificationCode,
  verifyCurrentUserSchoolCode,
} from '../lib/app-service';
import { getVisibleProfileText } from '../lib/profile-completion';
import { getRequestErrorMessage } from '../lib/request-error';
import { routes } from '../lib/routes';
import { startQuickLogin } from '../lib/quick-login';

type VerificationChannel = 'email' | 'phone';

const statusText = {
  unverified: '未认证',
  pending: '待完成',
  verified: '已认证',
  rejected: '未通过',
} as const;

function VerificationCard({
  channel,
  title,
  icon: Icon,
  target,
  code,
  verified,
  codeResult,
  busy,
  targetPlaceholder,
  codePlaceholder,
  inputType = 'text',
  inputMode,
  autoComplete,
  onTargetChange,
  onCodeChange,
  onSend,
  onVerify,
}: {
  channel: VerificationChannel;
  title: string;
  icon: typeof Mail;
  target: string;
  code: string;
  verified: boolean;
  codeResult?: SchoolVerificationCodeResult;
  busy?: boolean;
  targetPlaceholder: string;
  codePlaceholder: string;
  inputType?: string;
  inputMode?: 'email' | 'tel' | 'numeric';
  autoComplete?: string;
  onTargetChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onSend: () => void;
  onVerify: () => void;
}) {
  const targetInputId = `school-verification-${channel}-target`;
  const codeInputId = `school-verification-${channel}-code`;
  const targetLabel = channel === 'email' ? '教育邮箱地址' : '手机号';

  if (verified) {
    return (
      <section className="flex min-h-[72px] items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <Icon size={19} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="mt-1 truncate text-sm text-slate-500">{target}</div>
        </div>
        <CheckCircle2 size={21} className="shrink-0 text-emerald-600" aria-label="已验证" />
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <Icon size={19} />
          </div>
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-950">{title}</div>
            <div className="mt-1 text-sm font-medium text-slate-500">{verified ? '已验证' : '未完成'}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <label className="block" htmlFor={targetInputId}>
          <span className="mb-2 block text-sm font-semibold text-slate-700">{channel === 'email' ? '教育邮箱' : '手机号'}</span>
          <input
            id={targetInputId}
            name={channel === 'email' ? 'education-email' : 'phone'}
            aria-label={targetLabel}
            value={target}
            onChange={(event) => onTargetChange(event.target.value)}
            className={fieldClass}
            placeholder={targetPlaceholder}
            type={inputType}
            inputMode={inputMode}
            autoComplete={autoComplete}
          />
        </label>

        <div className="flex min-w-0 gap-2">
          <input
            id={codeInputId}
            name={`${channel}-verification-code`}
            aria-label={`${title}验证码`}
            value={code}
            onChange={(event) => onCodeChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
            className={`${fieldClass} flex-1`}
            placeholder={codePlaceholder}
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          <ActionButton
            type="button"
            variant="secondary"
            aria-label={`发送${title}验证码`}
            onClick={onSend}
            disabled={busy}
            className="px-3"
          >
            发送
          </ActionButton>
        </div>

        {codeResult?.debugCode ? (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
            内测码 {codeResult.debugCode}
          </div>
        ) : null}

        <ActionButton type="button" fullWidth aria-label={`完成${title}验证`} onClick={onVerify} disabled={busy}>
          {busy ? '处理中...' : '完成验证'}
        </ActionButton>
      </div>
    </section>
  );
}

export function SchoolVerify() {
  const navigate = useNavigate();
  const { user, loggedIn } = useSession();
  const { toast, showToast, clearToast } = useToast();
  const [loggingIn, setLoggingIn] = useState(false);
  const [memberships, setMemberships] = useState<SchoolMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [emailResult, setEmailResult] = useState<SchoolVerificationCodeResult>();
  const [phoneResult, setPhoneResult] = useState<SchoolVerificationCodeResult>();
  const [busyChannel, setBusyChannel] = useState<VerificationChannel | ''>('');
  const [schoolOption, setSchoolOption] = useState<School | null>(null);

  const activeMembership = useMemo(
    () => memberships.find((membership) => membership.active) || memberships[0] || null,
    [memberships],
  );
  const schoolName = getVisibleProfileText(user?.school);
  const status = user?.schoolCertificationStatus || activeMembership?.certificationStatus || 'unverified';

  useEffect(() => {
    if (!loggedIn || !schoolName) {
      setSchoolOption(null);
      return;
    }

    let alive = true;
    loadSchoolList({ keyword: schoolName, limit: 8 })
      .then((items) => {
        if (!alive) return;
        const exact = items.find((item) => item.id === user?.schoolId || item.name === schoolName) || items[0] || null;
        setSchoolOption(exact);
      })
      .catch(() => {
        if (alive) {
          setSchoolOption(null);
        }
      });

    return () => {
      alive = false;
    };
  }, [loggedIn, schoolName, user?.schoolId]);

  useEffect(() => {
    if (!loggedIn) {
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    loadSchoolMemberships()
      .then((items) => {
        if (!alive) return;
        setMemberships(items);
        const active = items.find((item) => item.active) || items[0];
        if (active?.educationEmail) {
          setEmail(active.educationEmail);
        }
        if (active?.phone) {
          setPhone(active.phone);
        }
      })
      .catch((error) => {
        if (alive) {
          showToast(getRequestErrorMessage(error, '认证状态加载失败。'), 'error');
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [loggedIn, showToast]);

  async function sendCode(channel: VerificationChannel) {
    const target = channel === 'email' ? email.trim() : phone.trim();
    setBusyChannel(channel);
    try {
      const result = await sendCurrentUserSchoolVerificationCode({
        schoolId: user?.schoolId,
        channel,
        target,
      });
      if (channel === 'email') {
        setEmailResult(result);
      } else {
        setPhoneResult(result);
      }
      showToast('验证码已发送', 'success');
    } catch (error) {
      showToast(getRequestErrorMessage(error, '发送失败。'), 'error');
    } finally {
      setBusyChannel('');
    }
  }

  async function verifyCode(channel: VerificationChannel) {
    const target = channel === 'email' ? email.trim() : phone.trim();
    const code = channel === 'email' ? emailCode.trim() : phoneCode.trim();
    setBusyChannel(channel);
    try {
      const result = await verifyCurrentUserSchoolCode({
        schoolId: user?.schoolId,
        channel,
        target,
        code,
      });
      setMemberships((items) => {
        const next = items.filter((item) => item.id !== result.membership.id);
        return [result.membership, ...next];
      });
      showToast(channel === 'email' ? '邮箱已验证' : '手机号已验证', 'success');
    } catch (error) {
      showToast(getRequestErrorMessage(error, '验证失败。'), 'error');
    } finally {
      setBusyChannel('');
    }
  }

  if (!loggedIn || !user) {
    return (
      <div className="min-h-full bg-[#f5f7fb] pb-8">
        <Toast toast={toast} onClose={clearToast} />
        <PageHeader title="学校认证" back fallbackTo={routes.profile} />
        <div className="px-4">
          <StateCard
            mode="auth"
            title="请先登录"
            description="登录后完成学校认证。"
            actionText={loggingIn ? '登录中...' : '立即登录'}
            onAction={() =>
              void startQuickLogin({
                navigate,
                nextPath: routes.schoolVerify,
                onStart: () => setLoggingIn(true),
                onComplete: () => setLoggingIn(false),
              })
            }
          />
        </div>
      </div>
    );
  }

  if (!schoolName) {
    return (
      <div className="min-h-full bg-[#f5f7fb] pb-8">
        <Toast toast={toast} onClose={clearToast} />
        <PageHeader title="学校认证" back fallbackTo={routes.profile} />
        <div className="px-4">
          <StateCard
            mode="empty"
            title="先选择学校"
            description="选择学校后再认证。"
            actionText="去选择"
            onAction={() => navigate(routes.schools)}
          />
        </div>
      </div>
    );
  }

  if (!loading && status === 'verified') {
    const verifiedTarget = activeMembership?.educationEmail || activeMembership?.phone || '';
    return (
      <div className="min-h-full bg-[#f5f7fb] pb-8">
        <PageHeader title="学校认证" back fallbackTo={routes.profile} />
        <section className="mt-3 border-y border-slate-200 bg-white px-4 py-5">
          <div className="flex items-center gap-3">
            {schoolOption ? (
              <SchoolLogo school={schoolOption} compact />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-700">
                {Array.from(schoolName).slice(0, 2).join('')}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-semibold text-slate-950">{schoolName}</div>
              {verifiedTarget ? <div className="mt-1 truncate text-sm text-slate-500">{verifiedTarget}</div> : null}
            </div>
            <CheckCircle2 size={22} className="shrink-0 text-emerald-600" aria-label="已认证" />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#f5f7fb] pb-8">
      <Toast toast={toast} onClose={clearToast} />
      <PageHeader title="学校认证" back fallbackTo={routes.profile} />

      <div className="space-y-4 px-4 pt-3">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            {schoolOption ? (
              <SchoolLogo school={schoolOption} compact />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-700">
                {Array.from(schoolName).slice(0, 2).join('')}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-semibold text-slate-950">{schoolName}</div>
              <div className="mt-1 text-sm font-medium text-slate-500">{statusText[status]}</div>
            </div>
            <Link
              to={routes.schools}
              className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-blue-50 px-3 text-sm font-semibold text-blue-600"
            >
              切换
            </Link>
          </div>
        </section>

        {loading ? (
          <StateCard mode="loading" title="正在加载" description="请稍候。" />
        ) : (
          <>
            <VerificationCard
              channel="email"
              title="教育邮箱"
              icon={Mail}
              target={email}
              code={emailCode}
              verified={Boolean(activeMembership?.emailVerified)}
              codeResult={emailResult}
              busy={busyChannel === 'email'}
              targetPlaceholder="name@school.edu.cn"
              codePlaceholder="邮箱验证码"
              inputType="email"
              inputMode="email"
              autoComplete="email"
              onTargetChange={setEmail}
              onCodeChange={setEmailCode}
              onSend={() => void sendCode('email')}
              onVerify={() => void verifyCode('email')}
            />

            <VerificationCard
              channel="phone"
              title="手机号"
              icon={Phone}
              target={phone}
              code={phoneCode}
              verified={Boolean(activeMembership?.phoneVerified)}
              codeResult={phoneResult}
              busy={busyChannel === 'phone'}
              targetPlaceholder="11 位手机号"
              codePlaceholder="短信验证码"
              inputType="tel"
              inputMode="tel"
              autoComplete="tel"
              onTargetChange={setPhone}
              onCodeChange={setPhoneCode}
              onSend={() => void sendCode('phone')}
              onVerify={() => void verifyCode('phone')}
            />
          </>
        )}
      </div>
    </div>
  );
}
