import { Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { Competition, TeamItem, TeamListingType, TeamVisibilityScope } from '../../types/entities';
import { teamTemplatePresets, type TeamTemplatePreset } from '../../data/team-templates';
import { PageHeader } from '../components/PageHeader';
import { StateCard } from '../components/StateCard';
import { hasVerifiedSchool, SchoolVerificationNotice } from '../components/SchoolVerificationNotice';
import { TeamCard } from '../components/TeamCard';
import { Toast, useToast } from '../components/Toast';
import { ActionButton, fieldClass, textAreaClass } from '../components/ui';
import { useRequestState } from '../hooks/useRequestState';
import { useSession } from '../hooks/useSession';
import { fetchCompetitionList, publishTeamRecruit } from '../lib/app-service';
import {
  collaborationModeOptions,
  competitionGoalOptions,
  teamRoleOptions,
  weeklyCommitmentOptions,
} from '../lib/domain-options';
import { getRequestErrorMessage } from '../lib/request-error';
import { buildPublishTeamRoute, buildTeamDetailRoute, routes } from '../lib/routes';
import { startQuickLogin } from '../lib/quick-login';

function uniqueValues(values: string[], limit = 8) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))].slice(0, limit);
}

function parseValues(value: string) {
  return value.split(/[,，、\n]/).map((item) => item.trim()).filter(Boolean);
}

function ChoiceGroup({
  label,
  options,
  selected,
  onChange,
  max,
  required = false,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (values: string[]) => void;
  max: number;
  required?: boolean;
}) {
  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
      return;
    }
    if (max === 1) {
      onChange([value]);
      return;
    }
    if (selected.length < max) onChange([...selected, value]);
  }

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-800">
        {label}{required ? <span className="ml-1 text-blue-600">*</span> : null}
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((item) => {
          const active = selected.includes(item);
          return (
            <button
              key={item}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(item)}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 active:bg-slate-50'
              }`}
            >
              {active ? <Check size={14} strokeWidth={2.8} aria-hidden="true" /> : null}
              {item}
            </button>
          );
        })}
      </div>
      <div className="mt-2 text-xs text-slate-400">已选 {selected.length}/{max}</div>
    </fieldset>
  );
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="text-[15px] font-semibold text-slate-950">{title}</h2>
      {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
    </div>
  );
}

export function PublishTeam() {
  const navigate = useNavigate();
  const { loggedIn, user } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialType: TeamListingType = searchParams.get('type') === 'member_available' ? 'member_available' : 'team_recruit';
  const [listingType, setListingType] = useState<TeamListingType>(initialType);
  const [loggingIn, setLoggingIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [compId, setCompId] = useState(searchParams.get('compId') || '');
  const [compName, setCompName] = useState(searchParams.get('compName') || '');
  const [summary, setSummary] = useState('');
  const [fullDescription, setFullDescription] = useState('');
  const [missingRoles, setMissingRoles] = useState<string[]>([]);
  const [customRoles, setCustomRoles] = useState('');
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [customCapabilities, setCustomCapabilities] = useState('');
  const [goalTags, setGoalTags] = useState<string[]>([]);
  const [requirements, setRequirements] = useState('');
  const [currentCount, setCurrentCount] = useState(1);
  const [maxCount, setMaxCount] = useState(4);
  const [collaborationMode, setCollaborationMode] = useState('');
  const [weeklyCommitment, setWeeklyCommitment] = useState('');
  const [deadline, setDeadline] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [visibilityScope, setVisibilityScope] = useState<TeamVisibilityScope>('school');
  const { toast, showToast, clearToast } = useToast();
  const competitionState = useRequestState<Competition[]>({
    initialData: () => [],
    errorMessage: '竞赛列表加载失败。',
  });

  useEffect(() => {
    if (!loggedIn) return;
    void competitionState.run(() => fetchCompetitionList({ sort: '即将截止', limit: 50 }));
  }, [competitionState.run, loggedIn]);

  function switchType(next: TeamListingType) {
    setListingType(next);
    const params = new URLSearchParams(searchParams);
    next === 'member_available' ? params.set('type', next) : params.delete('type');
    setSearchParams(params, { replace: true });
  }

  function applyTemplate(template: TeamTemplatePreset) {
    switchType(template.listingType);
    setTitle(template.title);
    setCompId(template.competitionId);
    setCompName(template.competitionName);
    setSummary(template.target);
    setFullDescription(template.fullDescription);
    setMissingRoles(template.missingRoles);
    setCustomRoles('');
    setCapabilities(template.capabilities);
    setCustomCapabilities('');
    setGoalTags(template.goals);
    setRequirements(template.requirements.join('\n'));
    setCurrentCount(template.currentCount || 1);
    setMaxCount(template.maxCount);
    setCollaborationMode(template.collaborationMode);
    setWeeklyCommitment(template.weeklyCommitment);
    setDeadline('');
    setContactEmail('');
    showToast('模板已填入，请补充联系邮箱', 'success');
  }

  const finalRoles = useMemo(() => uniqueValues([...missingRoles, ...parseValues(customRoles)]), [customRoles, missingRoles]);
  const finalCapabilities = useMemo(
    () => uniqueValues([...capabilities, ...parseValues(customCapabilities)]),
    [capabilities, customCapabilities],
  );
  const isMemberAvailable = listingType === 'member_available';
  const visibleTemplates = teamTemplatePresets.filter((item) => item.listingType === listingType);
  const previewTeam: TeamItem = {
    id: '',
    contentScope: 'school',
    listingType,
    title: title.trim() || (isMemberAvailable ? '想找一支认真参赛的队伍' : '组队招募标题'),
    compId: compId || undefined,
    compName: compName || '竞赛方向待定',
    status: isMemberAvailable ? '求队中' : '招募中',
    target: summary.trim() || (isMemberAvailable ? '介绍你的能力、经历和组队期待。' : '介绍项目进展和招募要求。'),
    fullDescription: fullDescription.trim() || undefined,
    current: isMemberAvailable ? 0 : currentCount,
    max: isMemberAvailable ? 1 : maxCount,
    missingRoles: finalRoles,
    deadline: deadline || '长期有效',
    authorName: user?.name || '校园用户',
    authorMark: user?.mark || '校',
    authorGrade: user?.grade || '年级待补充',
    authorMajor: user?.major || '专业待补充',
    schoolLimit: visibilityScope === 'school',
    visibilityScope,
    requirements: parseValues(requirements),
    goalTags,
    capabilities: finalCapabilities,
    collaborationMode,
    weeklyCommitment,
    contactHint: contactEmail || '提交后展示联系邮箱',
    contactEmail: contactEmail || undefined,
  };

  if (!loggedIn) {
    return (
      <div className="min-h-full bg-slate-50 pb-8">
        <Toast toast={toast} onClose={clearToast} />
        <PageHeader title="发布组队" back fallbackTo={routes.teams} />
        <div className="px-4">
          <StateCard
            mode="auth"
            title="请先登录"
            description="登录后可以发布组队信息。"
            actionText={loggingIn ? '登录中…' : '立即登录'}
            onAction={() =>
              void startQuickLogin({
                navigate,
                nextPath: buildPublishTeamRoute({ type: listingType }),
                onStart: () => setLoggingIn(true),
                onComplete: () => setLoggingIn(false),
              })
            }
          />
        </div>
      </div>
    );
  }

  if (!hasVerifiedSchool(user)) {
    return (
      <div className="min-h-full bg-slate-50 pb-8">
        <PageHeader title="发布组队" back fallbackTo={routes.teams} />
        <div className="px-4"><SchoolVerificationNotice /></div>
      </div>
    );
  }

  async function submit() {
    if (!title.trim() || !summary.trim() || !contactEmail.trim() || !collaborationMode || !weeklyCommitment) {
      showToast('请补全必填信息', 'error');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      showToast('请填写有效的联系邮箱', 'error');
      return;
    }
    if (!isMemberAvailable && (!compId || finalRoles.length === 0 || maxCount < 2 || currentCount < 1 || currentCount > maxCount)) {
      showToast('请补全竞赛、人数和招募角色', 'error');
      return;
    }
    if (isMemberAvailable && finalCapabilities.length === 0) {
      showToast('请至少选择一项能力', 'error');
      return;
    }
    if (goalTags.length === 0) {
      showToast('请至少选择一个参赛目标', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const nextTeam = await publishTeamRecruit({
        listingType,
        title: title.trim(),
        compId: compId || undefined,
        compName: compName || '竞赛方向待定',
        target: summary.trim(),
        fullDescription: fullDescription.trim() || undefined,
        missingRoles: isMemberAvailable ? [] : finalRoles,
        deadline: deadline || '长期有效',
        requirements: parseValues(requirements),
        goalTags,
        capabilities: finalCapabilities,
        collaborationMode,
        weeklyCommitment,
        currentCount: isMemberAvailable ? 0 : currentCount,
        maxCount: isMemberAvailable ? 1 : maxCount,
        schoolLimit: visibilityScope === 'school',
        visibilityScope,
        contactHint: contactEmail.trim(),
        contactEmail: contactEmail.trim(),
      });
      showToast('已提交审核', 'success');
      navigate(buildTeamDetailRoute(nextTeam.id), { replace: true });
    } catch (error) {
      showToast(getRequestErrorMessage(error, '发布失败，请稍后重试。'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-full bg-[#edf1f7] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
      <Toast toast={toast} onClose={clearToast} />
      <PageHeader title={isMemberAvailable ? '发布求加入' : '发布组队'} back fallbackTo={routes.teams} />

      <div className="space-y-4 px-4">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#dce4ef] p-1" aria-label="发布类型">
          <button
            type="button"
            aria-pressed={!isMemberAvailable}
            onClick={() => switchType('team_recruit')}
            className={`min-h-11 rounded-md text-sm font-semibold ${!isMemberAvailable ? 'bg-[#172033] text-white shadow-sm' : 'text-[#617089]'}`}
          >
            发布招募
          </button>
          <button
            type="button"
            aria-pressed={isMemberAvailable}
            onClick={() => switchType('member_available')}
            className={`min-h-11 rounded-md text-sm font-semibold ${isMemberAvailable ? 'bg-[#172033] text-white shadow-sm' : 'text-[#617089]'}`}
          >
            发布求队
          </button>
        </div>

        <section aria-labelledby="team-template-title">
          <div className="flex items-end justify-between gap-3 px-0.5">
            <div>
              <h2 id="team-template-title" className="text-[15px] font-semibold text-slate-950">快速套用</h2>
              <p className="mt-0.5 text-xs text-slate-500">选择后仍可修改全部内容</p>
            </div>
            <span className="text-xs font-medium text-slate-400">{visibleTemplates.length} 个模板</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {visibleTemplates.map((template) => (
              <button
                key={template.key}
                type="button"
                onClick={() => applyTemplate(template)}
                className="min-h-[5.5rem] min-w-0 rounded-lg border border-[#d7e0ec] bg-white px-3 py-3 text-left shadow-[0_6px_18px_rgba(29,45,72,0.055)] active:scale-[0.98]"
              >
                <span className="block truncate text-[11px] font-semibold text-blue-600">{template.competitionName}</span>
                <span className="mt-1 line-clamp-2 block text-sm font-semibold leading-5 text-slate-900">{template.title}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="divide-y divide-[#e1e7ef] rounded-lg border border-[#d7e0ec] bg-white shadow-[0_10px_28px_rgba(29,45,72,0.06)]">
          <div className="space-y-3.5 p-4">
            <SectionHeading title="基本信息" description={isMemberAvailable ? '说明你想参加的方向和组队期待。' : '选择竞赛并说明项目当前进展。'} />
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">{isMemberAvailable ? '目标竞赛' : '关联竞赛'}{!isMemberAvailable ? ' *' : ''}</span>
              <select
                value={compId}
                onChange={(event) => {
                  const next = competitionState.data.find((item) => item.id === event.target.value);
                  setCompId(event.target.value);
                  setCompName(next?.title || '');
                }}
                className={fieldClass}
              >
                <option value="">{isMemberAvailable ? '暂未确定' : competitionState.status === 'loading' ? '正在加载竞赛' : '选择竞赛'}</option>
                {competitionState.data.map((item) => (
                  <option key={item.id} value={item.id}>{item.title}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">标题 *</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value.slice(0, 48))}
                placeholder={isMemberAvailable ? '例如：技术开发，想找创新创业队伍' : '例如：创新大赛项目招募技术开发'}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">{isMemberAvailable ? '个人简介' : '项目简介'} *</span>
              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value.slice(0, 240))}
                rows={4}
                placeholder={isMemberAvailable ? '简要介绍经历和组队期待。' : '简要说明项目方向和当前进展。'}
                className={textAreaClass}
              />
              <span className="mt-1 block text-right text-xs text-slate-400">{summary.length}/240</span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">{isMemberAvailable ? '补充说明' : '完整招募正文'}</span>
              <textarea
                value={fullDescription}
                onChange={(event) => setFullDescription(event.target.value.slice(0, 3000))}
                rows={8}
                placeholder={isMemberAvailable ? '可补充项目经历、作品和合作偏好。' : '可按项目情况、招募要求、合作安排分段填写。'}
                className={textAreaClass}
              />
              <span className="mt-1 block text-right text-xs text-slate-400">{fullDescription.length}/3000</span>
            </label>
          </div>

          <div className="space-y-4 p-4">
            <SectionHeading title={isMemberAvailable ? '能力与目标' : '队伍与岗位'} />
            {!isMemberAvailable ? (
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="mb-2 block text-sm font-semibold text-slate-700">当前人数 *</span>
                  <input type="number" min={1} max={20} value={currentCount} onChange={(event) => setCurrentCount(Number(event.target.value))} className={fieldClass} />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-semibold text-slate-700">计划人数 *</span>
                  <input type="number" min={2} max={20} value={maxCount} onChange={(event) => setMaxCount(Number(event.target.value))} className={fieldClass} />
                </label>
              </div>
            ) : null}
            {!isMemberAvailable ? <ChoiceGroup label="招募角色" options={teamRoleOptions} selected={missingRoles} onChange={setMissingRoles} max={4} required /> : null}
            {!isMemberAvailable ? (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">其他角色</span>
                <input value={customRoles} onChange={(event) => setCustomRoles(event.target.value)} placeholder="用逗号分隔" className={fieldClass} />
              </label>
            ) : null}
            <ChoiceGroup label={isMemberAvailable ? '我能承担' : '已有能力'} options={teamRoleOptions} selected={capabilities} onChange={setCapabilities} max={4} required={isMemberAvailable} />
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">补充能力</span>
              <input value={customCapabilities} onChange={(event) => setCustomCapabilities(event.target.value)} placeholder="例如：Python、视频剪辑" className={fieldClass} />
            </label>
            <ChoiceGroup label="参赛目标" options={competitionGoalOptions} selected={goalTags} onChange={setGoalTags} max={2} required />
          </div>

          <div className="space-y-4 p-4">
            <SectionHeading title="合作安排" />
            <ChoiceGroup label="合作方式" options={collaborationModeOptions} selected={collaborationMode ? [collaborationMode] : []} onChange={(items) => setCollaborationMode(items.at(-1) || '')} max={1} required />
            <ChoiceGroup label="时间投入" options={weeklyCommitmentOptions} selected={weeklyCommitment ? [weeklyCommitment] : []} onChange={(items) => setWeeklyCommitment(items.at(-1) || '')} max={1} required />
            {!isMemberAvailable ? (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">具体要求</span>
                <textarea value={requirements} onChange={(event) => setRequirements(event.target.value)} rows={4} placeholder="每行一项，例如：能独立完成前端页面" className={textAreaClass} />
              </label>
            ) : null}
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">有效期</span>
              <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className={fieldClass} />
            </label>
            <fieldset>
              <legend className="text-sm font-semibold text-slate-700">可见范围 *</legend>
              <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-[#e7ecf3] p-1">
                {([
                  ['school', '仅本校'],
                  ['cross_school', '全部高校'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={visibilityScope === value}
                    onClick={() => setVisibilityScope(value)}
                    className={`min-h-11 rounded-md text-sm font-semibold ${visibilityScope === value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">联系邮箱 *</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value.slice(0, 120))}
                placeholder="name@example.com"
                className={fieldClass}
              />
            </label>
            <div className="flex min-h-11 items-center gap-3 rounded-lg bg-[#f2f7ff] px-3.5 text-sm text-[#536177]">
              <Check size={16} className="shrink-0 text-blue-600" aria-hidden="true" />
              {visibilityScope === 'school' ? `仅在 ${user?.school || '当前学校'} 展示` : '全部高校用户可查看并通过邮箱联系'}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeading title="发布预览" />
            <span className="text-xs text-slate-400">审核通过后公开</span>
          </div>
          <TeamCard team={previewTeam} preview />
        </section>

        <p className="px-1 text-xs leading-5 text-slate-500">联系邮箱会随招募公开。平台不参与撮合，请勿转账、缴纳押金或发送敏感信息。</p>

        <div className="sticky bottom-4 z-10 rounded-lg border border-[#d7e0ec] bg-white/92 p-3 shadow-[0_12px_30px_rgba(29,45,72,0.12)] backdrop-blur-xl">
          <ActionButton disabled={submitting} onClick={() => void submit()} fullWidth>
            {submitting ? '提交中…' : '提交审核'}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
