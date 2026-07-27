import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Camera,
  Check,
  Code2,
  Compass,
  Palette,
  PenLine,
  Presentation,
  Search,
  School as SchoolIcon,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { UpdateUserProfilePayload } from '../../../types/api';
import type { School, UserProfile } from '../../../types/entities';
import { getAvatarLabel } from '../../lib/avatar';
import {
  loadSchoolList,
  saveCurrentUserIdentity,
  saveCurrentUserProfile,
  saveCurrentUserSchool,
  uploadUserAvatarImage,
} from '../../lib/app-service';
import {
  getVisibleProfileText,
  isBasicIdentityReady,
  isProfileComplete,
  isSchoolSelected,
} from '../../lib/profile-completion';
import {
  clearOnboardingReplay,
  clearOnboardingResumeStep,
  getOnboardingResumeStep,
  shouldReplayOnboarding,
} from '../../lib/onboarding-state';
import { getRequestErrorMessage } from '../../lib/request-error';
import { competitionGoalOptions } from '../../lib/domain-options';
import { SchoolLogo } from '../SchoolLogo';
import { OnboardingShell } from './OnboardingShell';

interface OnboardingGateProps {
  user: UserProfile;
}

type OnboardingStep = 'notice' | 'identity' | 'school' | 'directions' | 'skills' | 'team' | 'bio' | 'complete';

const announcementPrefix = 'campus-growth:onboarding-announcement:';
const flowCompletePrefix = 'campus-growth:onboarding-complete:';
const totalProgressSteps = 6;
const gradeOptions = ['大一', '大二', '大三', '大四', '研究生'];
const directionOptions = ['创新创业', '数学建模', '编程算法', '商科案例', '电子硬件', '设计艺术', '学术科研', '语言外语'];
const goalOptions: string[] = [...competitionGoalOptions];
const skillOptions = [
  { label: '技术开发', description: '前后端、App', icon: Code2 },
  { label: '算法数据', description: '建模、分析', icon: BarChart3 },
  { label: '商业分析', description: '市场、模式、财务', icon: BriefcaseBusiness },
  { label: '路演答辩', description: '演讲、临场问答', icon: Presentation },
  { label: '视觉设计', description: '界面、海报、PPT', icon: Palette },
  { label: '文案内容', description: '撰写、包装', icon: PenLine },
] as const;
const teamOptions = [
  { label: '想加入队伍', description: '浏览招募，联系合适的队长', icon: Users },
  { label: '正在招队友', description: '发布招募，说明项目和要求', icon: UserPlus },
  { label: '先看看', description: '先浏览内容，需要时再组队', icon: Compass },
] as const;
const bioExamples = [
  '会 Python 和数据分析，参加过数模校赛，希望找认真负责的队友。',
  '擅长商业分析和路演，做过完整项目，希望一起冲击省赛。',
  '视觉传达专业，可以负责 UI、海报和答辩 PPT。',
];
const guidedTags = new Set([
  ...directionOptions,
  ...goalOptions,
  ...skillOptions.map((item) => item.label),
  ...teamOptions.map((item) => item.label),
]);
const inputClass =
  'block min-h-12 w-full min-w-0 max-w-full appearance-none rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-[16px] leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70';

function readFlag(prefix: string, userId: string) {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(`${prefix}${userId}`) === 'done';
}

function writeFlag(prefix: string, userId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`${prefix}${userId}`, 'done');
}

function uniqueTags(tags: string[]) {
  return Array.from(new Set(tags.map((item) => item.trim()).filter(Boolean))).slice(0, 10);
}

function initialDirections(user: UserProfile) {
  return directionOptions.filter((item) => user.focusTags.includes(item));
}

function initialSkills(user: UserProfile) {
  return skillOptions.map((item) => item.label).filter((item) => user.focusTags.includes(item));
}

function initialGoals(user: UserProfile) {
  return goalOptions.filter((item) => user.focusTags.includes(item));
}

function initialTeamIntent(user: UserProfile) {
  return teamOptions.find((item) => user.focusTags.includes(item.label))?.label || '';
}

function resolveInitialStep(user: UserProfile): OnboardingStep | null {
  const resumeStep = getOnboardingResumeStep();
  if (resumeStep) return resumeStep;
  if (shouldReplayOnboarding(user.id)) return 'notice';
  if (readFlag(flowCompletePrefix, user.id) && isBasicIdentityReady(user) && isSchoolSelected(user)) return null;
  if (isProfileComplete(user)) return null;
  if (!readFlag(announcementPrefix, user.id)) return 'notice';
  if (!isBasicIdentityReady(user)) return 'identity';
  if (!isSchoolSelected(user) || !getVisibleProfileText(user.grade) || !getVisibleProfileText(user.major)) return 'school';
  if (user.focusTags.length === 0) return 'directions';
  if (!user.bio.trim()) return 'bio';
  return null;
}

function toggleLimited(current: string[], value: string, limit: number) {
  if (current.includes(value)) return current.filter((item) => item !== value);
  if (current.length >= limit) return current;
  return [...current, value];
}

function StepHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-[25px] font-semibold leading-[1.3] text-slate-950">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p> : null}
    </div>
  );
}

export function OnboardingGate({ user }: OnboardingGateProps) {
  const [step, setStep] = useState<OnboardingStep | null>(() => resolveInitialStep(user));
  const [name, setName] = useState(() => getVisibleProfileText(user.name));
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [grade, setGrade] = useState(() => getVisibleProfileText(user.grade));
  const [major, setMajor] = useState(() => getVisibleProfileText(user.major));
  const [bio, setBio] = useState(user.bio || '');
  const [directions, setDirections] = useState(() => initialDirections(user));
  const [goals, setGoals] = useState(() => initialGoals(user));
  const [skills, setSkills] = useState<string[]>(() => initialSkills(user));
  const [teamIntent, setTeamIntent] = useState(() => initialTeamIntent(user));
  const [schoolKeyword, setSchoolKeyword] = useState('');
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const activeUserIdRef = useRef(user.id);

  const currentSchoolName = selectedSchool?.name || getVisibleProfileText(user.school);
  const extraTags = useMemo(() => user.focusTags.filter((item) => !guidedTags.has(item)), [user.focusTags]);
  const currentTags = useMemo(
    () => uniqueTags([...directions, ...goals, ...skills, ...(teamIntent ? [teamIntent] : []), ...extraTags]),
    [directions, extraTags, goals, skills, teamIntent],
  );

  useEffect(() => {
    if (!step) return;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [step]);

  useEffect(() => {
    if (step && getOnboardingResumeStep() === step) {
      clearOnboardingResumeStep();
    }
  }, [step]);

  useEffect(() => {
    if (activeUserIdRef.current === user.id) return;
    activeUserIdRef.current = user.id;
    setStep(resolveInitialStep(user));
    setName(getVisibleProfileText(user.name));
    setAvatarUrl(user.avatarUrl || '');
    setGrade(getVisibleProfileText(user.grade));
    setMajor(getVisibleProfileText(user.major));
    setBio(user.bio || '');
    setDirections(initialDirections(user));
    setGoals(initialGoals(user));
    setSkills(initialSkills(user));
    setTeamIntent(initialTeamIntent(user));
    setSelectedSchool(null);
    setSchoolKeyword('');
    setErrorMessage('');
  }, [user]);

  useEffect(() => {
    if (step !== 'school') return;
    let alive = true;
    const keyword = schoolKeyword.trim();
    const timer = window.setTimeout(() => {
      setSchoolsLoading(true);
      loadSchoolList({ keyword, hotOnly: keyword ? undefined : true, limit: keyword ? 24 : 12 })
        .then((items) => {
          if (!alive) return;
          setSchools(items);
          if (!selectedSchool && user.schoolId) {
            setSelectedSchool(items.find((item) => item.id === user.schoolId) || null);
          }
        })
        .catch(() => {
          if (alive) setSchools([]);
        })
        .finally(() => {
          if (alive) setSchoolsLoading(false);
        });
    }, keyword ? 220 : 0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [schoolKeyword, selectedSchool, step, user.schoolId]);

  if (!step) return null;

  function profilePayload(overrides: Partial<UpdateUserProfilePayload> = {}): UpdateUserProfilePayload {
    return {
      name: getVisibleProfileText(user.name) || name.trim(),
      avatarUrl: avatarUrl || user.avatarUrl,
      school: currentSchoolName || getVisibleProfileText(user.school),
      grade: grade.trim(),
      major: major.trim(),
      bio: bio.trim(),
      focusTags: currentTags,
      ...overrides,
    };
  }

  async function runSave(action: () => Promise<void>, fallbackMessage: string) {
    setSubmitting(true);
    setErrorMessage('');
    try {
      await action();
    } catch (error) {
      setErrorMessage(getRequestErrorMessage(error, fallbackMessage));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMessage('请选择 JPG、PNG 或 WebP 图片。');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setErrorMessage('头像图片不能超过 3 MB。');
      return;
    }
    setAvatarUploading(true);
    setErrorMessage('');
    try {
      const result = await uploadUserAvatarImage(file);
      setAvatarUrl(result.avatarUrl);
    } catch (error) {
      setErrorMessage(getRequestErrorMessage(error, '头像上传失败，请重新选择。'));
    } finally {
      setAvatarUploading(false);
    }
  }

  const previousStep: Partial<Record<OnboardingStep, OnboardingStep>> = {
    identity: 'notice',
    school: 'identity',
    directions: 'school',
    skills: 'directions',
    team: 'skills',
    bio: 'team',
  };

  const back = previousStep[step] ? () => {
    setErrorMessage('');
    setStep(previousStep[step] || null);
  } : undefined;

  if (step === 'notice') {
    return (
      <OnboardingShell
        stepKey={step}
        stepIndex={0}
        totalSteps={totalProgressSteps}
        showProgress={false}
        primaryLabel="继续"
        onPrimary={() => {
          writeFlag(announcementPrefix, user.id);
          setStep(shouldReplayOnboarding(user.id) || !isBasicIdentityReady(user) ? 'identity' : 'school');
        }}
      >
        <div className="pt-8">
          <StepHeading title="使用说明" />
          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {[
              '内容按学校展示',
              '发布前需完成学校认证',
              '公开联系方式前请确认不含敏感信息',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 py-4 text-[15px] leading-6 text-slate-700">
                <Check size={17} className="shrink-0 text-blue-600" aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </OnboardingShell>
    );
  }

  if (step === 'identity') {
    const nextName = name.trim();
    return (
      <OnboardingShell
        stepKey={step}
        stepIndex={1}
        totalSteps={totalProgressSteps}
        primaryLabel="下一步"
        onBack={back}
        busy={submitting || avatarUploading}
        primaryDisabled={!nextName}
        errorMessage={errorMessage}
        onPrimary={() => {
          if (!nextName) return;
          void runSave(async () => {
            await saveCurrentUserIdentity({ name: nextName, avatarUrl: avatarUrl || user.avatarUrl });
            setStep('school');
          }, '头像昵称保存失败，请稍后重试。');
        }}
      >
        <StepHeading title="先认识一下你" description="头像和昵称会展示在帖子与组队信息中，之后可以随时修改。" />
        <div className="flex flex-col items-center py-2">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarUploading}
            className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-[22px] bg-slate-200 text-3xl font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:opacity-60"
            aria-label="从相册选择头像"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="头像预览" className="h-full w-full object-cover" />
            ) : (
              getAvatarLabel(nextName || user.name)
            )}
            <span className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950 text-white ring-2 ring-[#f7f8fa]">
              <Camera size={14} aria-hidden="true" />
            </span>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => void handleAvatarFileChange(event)}
          />
        </div>
        <label className="mt-7 block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">昵称</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value.slice(0, 24))}
            name="onboarding-nickname"
            autoComplete="nickname"
            placeholder="填写你希望展示的昵称"
            className={inputClass}
          />
          <span className="mt-2 block text-right text-xs tabular-nums text-slate-400">{name.length}/24</span>
        </label>
      </OnboardingShell>
    );
  }

  if (step === 'school') {
    const canContinue = Boolean(currentSchoolName && grade.trim() && major.trim());
    return (
      <OnboardingShell
        stepKey={step}
        stepIndex={2}
        totalSteps={totalProgressSteps}
        primaryLabel="下一步"
        onBack={back}
        busy={submitting}
        primaryDisabled={!canContinue}
        errorMessage={errorMessage}
        onPrimary={() => {
          if (!canContinue) return;
          void runSave(async () => {
            if (selectedSchool && selectedSchool.id !== user.schoolId) {
              await saveCurrentUserSchool({ schoolId: selectedSchool.id, school: selectedSchool.name });
            }
            await saveCurrentUserProfile(profilePayload({ school: currentSchoolName, grade: grade.trim(), major: major.trim() }));
            setStep('directions');
          }, '学校信息保存失败，请稍后重试。');
        }}
      >
        <StepHeading title="你在哪所学校？" description="校内帖子、组队和资料会按学校区分。" />

        {currentSchoolName ? (
          <div className="mb-4 flex min-h-[68px] items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/60 px-3.5 py-2.5">
            {selectedSchool ? (
              <SchoolLogo school={selectedSchool} compact />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-blue-600 ring-1 ring-blue-100">
                <SchoolIcon size={21} aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold text-slate-950">{currentSchoolName}</div>
              <div className="mt-0.5 text-xs text-slate-500">当前选择</div>
            </div>
            <Check size={19} className="text-blue-600" aria-hidden="true" />
          </div>
        ) : null}

        <label className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3.5 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100/70">
          <Search size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
          <input
            value={schoolKeyword}
            onChange={(event) => setSchoolKeyword(event.target.value)}
            type="search"
            placeholder={currentSchoolName ? '重新搜索学校' : '搜索全国高校'}
            className="app-bare-input min-h-11 w-full min-w-0 bg-transparent text-[16px] text-slate-950 outline-none placeholder:text-slate-400"
          />
        </label>

        <div className="mt-3 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {schools.map((school) => (
            <button
              key={school.id}
              type="button"
              onClick={() => {
                setSelectedSchool(school);
                setSchoolKeyword('');
              }}
              className="flex min-h-[62px] w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 active:bg-slate-50"
            >
              <SchoolLogo school={school} compact />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">{school.name}</div>
                <div className="mt-0.5 truncate text-xs text-slate-500">{[school.province, school.city].filter(Boolean).join(' · ')}</div>
              </div>
            </button>
          ))}
          {schoolsLoading ? <div className="px-3 py-5 text-center text-sm text-slate-400">正在加载学校</div> : null}
          {!schoolsLoading && schools.length === 0 ? (
            <div className="px-3 py-5 text-center text-sm text-slate-400">没有匹配的学校</div>
          ) : null}
        </div>

        <div className="mt-5">
          <div className="mb-2 text-sm font-semibold text-slate-700">年级</div>
          <div className="grid grid-cols-3 gap-2">
            {gradeOptions.map((item) => {
              const active = grade === item;
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setGrade(item)}
                  className={`min-h-11 rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
                    active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 active:bg-slate-50'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        <label className="mt-5 block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">专业</span>
          <input
            value={major}
            onChange={(event) => setMajor(event.target.value.slice(0, 36))}
            placeholder="例如：计算机科学与技术"
            className={inputClass}
          />
        </label>
      </OnboardingShell>
    );
  }

  if (step === 'directions') {
    return (
      <OnboardingShell
        stepKey={step}
        stepIndex={3}
        totalSteps={totalProgressSteps}
        primaryLabel="下一步"
        onBack={back}
        busy={submitting}
        primaryDisabled={directions.length === 0 || goals.length === 0}
        errorMessage={errorMessage}
        onPrimary={() => {
          if (directions.length === 0 || goals.length === 0) return;
          void runSave(async () => {
            await saveCurrentUserProfile(profilePayload());
            setStep('skills');
          }, '关注方向保存失败，请稍后重试。');
        }}
      >
        <StepHeading title="你关注哪些竞赛？" description="最多选择 3 个，首页会优先展示相关内容。" />
        <div className="flex flex-wrap gap-2.5">
          {directionOptions.map((item) => {
            const active = directions.includes(item);
            return (
              <button
                key={item}
                type="button"
                aria-pressed={active}
                onClick={() => setDirections((current) => toggleLimited(current, item, 3))}
                className={`min-h-11 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 active:bg-slate-50'
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
        <div className="mt-4 text-xs text-slate-400">已选择 {directions.length}/3</div>

        <section className="mt-7 border-t border-slate-200 pt-6">
          <div className="text-sm font-semibold text-slate-900">参赛主要为了什么？</div>
          <div className="mt-1 text-xs text-slate-400">最多选择 2 项</div>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {goalOptions.map((item) => {
              const active = goals.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setGoals((current) => toggleLimited(current, item, 2))}
                  className={`min-h-11 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                    active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 active:bg-slate-50'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
          <div className="mt-4 text-xs text-slate-400">已选择 {goals.length}/2</div>
        </section>
      </OnboardingShell>
    );
  }

  if (step === 'skills') {
    return (
      <OnboardingShell
        stepKey={step}
        stepIndex={4}
        totalSteps={totalProgressSteps}
        primaryLabel="下一步"
        onBack={back}
        onSkip={() => setStep('team')}
        busy={submitting}
        errorMessage={errorMessage}
        onPrimary={() => {
          void runSave(async () => {
            await saveCurrentUserProfile(profilePayload());
            setStep('team');
          }, '技能信息保存失败，请稍后重试。');
        }}
      >
        <StepHeading title="组队时，你擅长什么？" description="最多选择 3 项，方便队友快速了解你。" />
        <div className="grid grid-cols-2 gap-2.5">
          {skillOptions.map((item) => {
            const active = skills.includes(item.label);
            return (
              <button
                key={item.label}
                type="button"
                aria-pressed={active}
                onClick={() => setSkills((current) => toggleLimited(current, item.label, 3))}
                className={`relative min-h-[92px] rounded-lg border p-3 text-left transition-colors ${
                  active ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white active:bg-slate-50'
                }`}
              >
                <item.icon size={19} className={active ? 'text-blue-600' : 'text-slate-500'} aria-hidden="true" />
                <div className={`mt-3 text-sm font-semibold ${active ? 'text-blue-700' : 'text-slate-900'}`}>{item.label}</div>
                <div className="mt-0.5 text-[12px] leading-5 text-slate-500">{item.description}</div>
                {active ? <Check size={16} className="absolute right-2.5 top-2.5 text-blue-600" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </OnboardingShell>
    );
  }

  if (step === 'team') {
    return (
      <OnboardingShell
        stepKey={step}
        stepIndex={5}
        totalSteps={totalProgressSteps}
        primaryLabel="下一步"
        onBack={back}
        onSkip={() => {
          setTeamIntent('先看看');
          setStep('bio');
        }}
        busy={submitting}
        primaryDisabled={!teamIntent}
        errorMessage={errorMessage}
        onPrimary={() => {
          if (!teamIntent) return;
          void runSave(async () => {
            await saveCurrentUserProfile(profilePayload());
            setStep('bio');
          }, '组队意向保存失败，请稍后重试。');
        }}
      >
        <StepHeading title="你现在的组队状态？" description="平台只提供信息和联系方式，不介入后续沟通。" />
        <div className="space-y-3">
          {teamOptions.map((item) => {
            const active = teamIntent === item.label;
            return (
              <button
                key={item.label}
                type="button"
                aria-pressed={active}
                onClick={() => setTeamIntent(item.label)}
                className={`flex min-h-[78px] w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors ${
                  active ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white active:bg-slate-50'
                }`}
              >
                <item.icon size={21} className={active ? 'text-blue-600' : 'text-slate-500'} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-slate-900'}`}>{item.label}</div>
                  <div className="mt-1 text-[12px] leading-5 text-slate-500">{item.description}</div>
                </div>
                <span className={`h-5 w-5 shrink-0 rounded-full border-2 ${active ? 'border-blue-600 bg-blue-600 shadow-[inset_0_0_0_4px_white]' : 'border-slate-300'}`} />
              </button>
            );
          })}
        </div>
      </OnboardingShell>
    );
  }

  if (step === 'bio') {
    const finish = (nextBio: string) => {
      void runSave(async () => {
        await saveCurrentUserProfile(profilePayload({ bio: nextBio.trim() }));
        writeFlag(flowCompletePrefix, user.id);
        clearOnboardingReplay(user.id);
        setStep('complete');
      }, '个人简介保存失败，请稍后重试。');
    };
    return (
      <OnboardingShell
        stepKey={step}
        stepIndex={6}
        totalSteps={totalProgressSteps}
        primaryLabel="完成资料"
        onBack={back}
        onSkip={() => finish(bio)}
        busy={submitting}
        errorMessage={errorMessage}
        onPrimary={() => finish(bio)}
      >
        <StepHeading title="用一句话介绍自己" description="队友会先看到这段内容，也可以以后再补。" />
        <label className="block">
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value.slice(0, 160))}
            rows={5}
            placeholder="写下你的经历、擅长方向和组队期待"
            className={`${inputClass} min-h-[132px] resize-none leading-7`}
          />
          <span className="mt-2 block text-right text-xs tabular-nums text-slate-400">{bio.length}/160</span>
        </label>
        <div className="mt-5">
          <div className="mb-2 text-xs font-medium text-slate-400">常用写法</div>
          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {bioExamples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setBio(example)}
                className="w-full py-3 text-left text-[13px] leading-6 text-slate-600 active:text-blue-700"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      stepKey={step}
      stepIndex={totalProgressSteps}
      totalSteps={totalProgressSteps}
      primaryLabel="开始使用"
      onPrimary={() => setStep(null)}
    >
      <div className="pt-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white">
          <Check size={31} strokeWidth={2.5} aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-[25px] font-semibold text-slate-950">资料已保存</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">之后可以在“我的 - 个人信息”中继续修改。</p>
      </div>

      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-4 text-left">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-slate-200 text-lg font-semibold text-slate-700">
            {avatarUrl ? <img src={avatarUrl} alt="头像" className="h-full w-full object-cover" /> : getAvatarLabel(name || user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold text-slate-950">{name || getVisibleProfileText(user.name) || '校园用户'}</div>
            <div className="mt-1 truncate text-xs text-slate-500">
              {[currentSchoolName, major, grade].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>
        {currentTags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {currentTags.map((tag) => (
              <span key={tag} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </section>
    </OnboardingShell>
  );
}
