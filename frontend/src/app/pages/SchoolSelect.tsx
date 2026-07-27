import { Check, Search, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { School } from '../../types/entities';
import { PageHeader } from '../components/PageHeader';
import { SchoolLogo } from '../components/SchoolLogo';
import { StateCard } from '../components/StateCard';
import { Toast, useToast } from '../components/Toast';
import { bareInputClass, searchShellClass } from '../components/ui';
import { useSession } from '../hooks/useSession';
import { loadSchoolList, saveCurrentUserSchool } from '../lib/app-service';
import { getVisibleProfileText } from '../lib/profile-completion';
import { getRequestErrorMessage } from '../lib/request-error';
import { buildSchoolVerifyRoute, normalizeInternalRoute, routes } from '../lib/routes';
import { startQuickLogin } from '../lib/quick-login';

export function SchoolSelect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loggedIn } = useSession();
  const [keyword, setKeyword] = useState('');
  const [hotSchools, setHotSchools] = useState<School[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [savingId, setSavingId] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const { toast, showToast, clearToast } = useToast();

  const nextPath = normalizeInternalRoute(searchParams.get('next'), routes.profile);
  const selectedSchool = getVisibleProfileText(user?.school);
  const selectedSchoolId = user?.schoolId || '';
  const selectedSchoolOption =
    [...hotSchools, ...schools].find((school) => school.id === selectedSchoolId || school.name === selectedSchool) || null;

  useEffect(() => {
    let alive = true;

    async function loadHotSchools() {
      try {
        const items = await loadSchoolList({ hotOnly: true, limit: 16 });
        if (alive) {
          setHotSchools(items);
        }
      } catch {
        if (alive) {
          setHotSchools([]);
        }
      }
    }

    void loadHotSchools();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setErrorMessage('');
      loadSchoolList({ keyword: keyword.trim(), limit: keyword.trim() ? 80 : 96 })
        .then((items) => {
          if (alive) {
            setSchools(items);
          }
        })
        .catch((error) => {
          if (alive) {
            setSchools([]);
            setErrorMessage(getRequestErrorMessage(error, '学校列表加载失败。'));
          }
        })
        .finally(() => {
          if (alive) {
            setLoading(false);
          }
        });
    }, keyword.trim() ? 220 : 0);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [keyword]);

  async function handleSelect(school: School) {
    setSavingId(school.id);
    try {
      await saveCurrentUserSchool({ schoolId: school.id, school: school.name });
      showToast('学校已更新', 'success');
      window.setTimeout(() => navigate(nextPath, { replace: true }), 260);
    } catch (error) {
      showToast(getRequestErrorMessage(error, '学校保存失败。'), 'error');
    } finally {
      setSavingId('');
    }
  }

  if (!loggedIn || !user) {
    return (
      <div className="min-h-full bg-[#f5f7fb] pb-8">
        <Toast toast={toast} onClose={clearToast} />
        <PageHeader title="选择学校" back fallbackTo={routes.profile} />
        <div className="px-4">
          <StateCard
            mode="auth"
            title="请先登录"
            description="登录后选择学校。"
            actionText={loggingIn ? '登录中...' : '立即登录'}
            onAction={() =>
              void startQuickLogin({
                navigate,
                nextPath: routes.schools,
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
    <div className="min-h-full bg-[#f5f7fb] pb-8">
      <Toast toast={toast} onClose={clearToast} />
      <PageHeader title="选择学校" back fallbackTo={routes.profile} />

      <div className="space-y-4 px-4 pt-3">
        <label className={searchShellClass}>
          <Search size={19} className="shrink-0 text-slate-400" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索全国高校"
            className={bareInputClass}
            type="search"
            name="schoolKeyword"
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex min-h-[76px] items-center gap-3 px-4 py-3">
            {selectedSchoolOption ? (
              <SchoolLogo school={selectedSchoolOption} compact />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-700">
                {selectedSchool ? Array.from(selectedSchool).slice(0, 2).join('') : '未选'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-semibold text-slate-950">{selectedSchool || '未选择学校'}</div>
              <div className="mt-1 text-sm font-medium text-slate-500">
                {selectedSchool ? '当前学校' : '选择后进入本校空间'}
              </div>
            </div>
            {selectedSchool ? (
              <Link
                to={buildSchoolVerifyRoute()}
                className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg bg-blue-50 px-3 text-sm font-semibold text-blue-600"
              >
                <ShieldCheck size={15} />
                认证
              </Link>
            ) : null}
          </div>
        </section>

        {hotSchools.length > 0 ? (
          <section className="rounded-lg border border-slate-200 bg-white px-4 py-4">
            <div className="text-[12px] font-medium text-slate-500">热门高校</div>
            <div className="mt-4 grid grid-cols-4 gap-x-2.5 gap-y-5">
              {hotSchools.map((school) => (
                <button
                  key={school.id}
                  type="button"
                  disabled={Boolean(savingId)}
                  onClick={() => void handleSelect(school)}
                  aria-label={`选择${school.name}`}
                  className="flex min-w-0 appearance-none flex-col items-center gap-2 rounded-lg border-0 bg-transparent p-0 text-center text-slate-800 outline-none transition-colors focus-visible:ring-4 focus-visible:ring-blue-100 disabled:opacity-60"
                >
                  <SchoolLogo school={school} />
                  <span className="line-clamp-2 min-h-[2.25rem] max-w-full text-[12px] font-medium leading-[1.15rem] text-slate-800">
                    {school.name}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3 text-[12px] font-medium text-slate-500">高校列表</div>
          <div className="divide-y divide-slate-100">
            {schools.map((school) => {
              const active = school.id === selectedSchoolId || school.name === selectedSchool;
              const saving = savingId === school.id;

              return (
                <button
                  key={school.id}
                  type="button"
                  disabled={Boolean(savingId)}
                  onClick={() => void handleSelect(school)}
                  aria-label={`选择${school.name}`}
                  className="flex min-h-[76px] w-full min-w-0 appearance-none items-center gap-3 border-0 bg-white px-4 py-3 text-left text-slate-950 outline-none transition-colors active:bg-slate-50 focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-blue-100 disabled:opacity-60"
                >
                  <SchoolLogo school={school} compact />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold text-slate-950">{school.name}</div>
                    <div className="mt-1 truncate text-sm font-medium text-slate-500">
                      {[school.province, school.city].filter(Boolean).join(' · ') || school.shortName}
                    </div>
                  </div>
                  {saving ? (
                    <span className="text-sm font-semibold text-slate-400">保存中</span>
                  ) : active ? (
                    <Check size={22} className="shrink-0 text-blue-500" />
                  ) : null}
                </button>
              );
            })}

            {loading ? (
              <div className="px-4 py-8 text-center text-sm font-medium text-slate-500">加载中...</div>
            ) : null}

            {!loading && errorMessage ? (
              <div className="px-4 py-8 text-center text-sm font-medium text-rose-600">{errorMessage}</div>
            ) : null}

            {!loading && !errorMessage && schools.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm font-medium text-slate-500">没有匹配学校</div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
