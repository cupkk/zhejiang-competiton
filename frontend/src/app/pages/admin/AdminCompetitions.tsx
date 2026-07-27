import { ExternalLink, Plus, Save, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminButton, AdminEmpty, AdminPageTitle, AdminPanel, AdminStatus, cx } from '../../components/admin/AdminUi';
import { StateCard } from '../../components/StateCard';
import { useRequestState } from '../../hooks/useRequestState';
import { createAdminCompetition, fetchAdminCompetitions, updateAdminCompetition } from '../../lib/app-service';
import type {
  AdminCompetitionItem,
  AdminCompetitionPayload,
  AdminCompetitionPublishStatus,
} from '../../lib/admin-types';

type FormState = Omit<AdminCompetitionPayload, 'stages' | 'submissionMaterials' | 'tags' | 'recommendedFor' | 'actionHints' | 'tracks'> & {
  stages: string;
  submissionMaterials: string;
  tags: string;
  recommendedFor: string;
  actionHints: string;
  tracks: string;
};

const inputClass = 'min-h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70';
const textareaClass = `${inputClass} min-h-28 resize-y py-3 leading-6`;

function emptyForm(): FormState {
  return {
    title: '', level: '国家级', category: '', host: '', target: '', status: '待发布',
    deadline: '', difficulty: '中', description: '', teamSize: '', stages: '', submissionMaterials: '',
    tags: '', recommendedFor: '', actionHints: '', registrationStart: '', registrationEnd: '',
    competitionStart: '', competitionEnd: '', awards: '', feeDescription: '',
    officialContact: '', sourceUrl: '', lastVerifiedAt: new Intl.DateTimeFormat('en-CA').format(new Date()),
    editionLabel: '', scheduleStatus: 'not_announced', registrationMethod: '', tracks: '', qualityStatus: 'pending_review', publishStatus: 'draft',
  };
}

function joinLines(items?: string[]) {
  return (items || []).join('\n');
}

function formFromItem(item: AdminCompetitionItem): FormState {
  return {
    title: item.title, level: item.level, category: item.category, host: item.host, target: item.target,
    status: item.status, deadline: /^\d{4}-\d{2}-\d{2}$/.test(item.deadline) ? item.deadline : '',
    difficulty: item.difficulty, description: item.description, teamSize: item.teamSize || '',
    stages: joinLines(item.stages), submissionMaterials: joinLines(item.submissionMaterials), tags: item.tags.join('、'),
    recommendedFor: joinLines(item.recommendedFor), actionHints: joinLines(item.actionHints),
    registrationStart: item.registrationStart || '', registrationEnd: item.registrationEnd || '',
    competitionStart: item.competitionStart || '', competitionEnd: item.competitionEnd || '',
    awards: item.awards || '', feeDescription: item.feeDescription || '', officialContact: item.officialContact || '',
    sourceUrl: item.sourceUrl || '', lastVerifiedAt: item.lastVerifiedAt || '', editionLabel: item.editionLabel,
    scheduleStatus: item.scheduleStatus, registrationMethod: item.registrationMethod || '', tracks: joinLines(item.tracks),
    qualityStatus: item.qualityStatus, publishStatus: item.publishStatus,
  };
}

function lines(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function tags(value: string) {
  return value.split(/[、,，\r\n]+/).map((item) => item.trim()).filter(Boolean);
}

function payloadFromForm(form: FormState): AdminCompetitionPayload {
  return {
    ...form,
    stages: lines(form.stages),
    submissionMaterials: lines(form.submissionMaterials),
    tags: tags(form.tags),
    recommendedFor: lines(form.recommendedFor),
    actionHints: lines(form.actionHints),
    tracks: lines(form.tracks),
  };
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={cx('block min-w-0', className)}><span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>{children}</label>;
}

export function AdminCompetitions() {
  const state = useRequestState<AdminCompetitionItem[]>({ initialData: [], errorMessage: '竞赛目录加载失败。' });
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<AdminCompetitionPublishStatus | ''>('');
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function load(search = keyword, publishStatus = filter) {
    const items = await state.run(() => fetchAdminCompetitions({ keyword: search.trim() || undefined, publishStatus, limit: 150 }));
    if (!items) return;
    if (selectedId) {
      const selected = items.find((item) => item.id === selectedId);
      if (selected) setForm(formFromItem(selected));
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(keyword, filter), 180);
    return () => window.clearTimeout(timer);
  }, [keyword, filter]);

  const selected = useMemo(() => state.data.find((item) => item.id === selectedId), [selectedId, state.data]);

  function selectItem(item: AdminCompetitionItem) {
    setSelectedId(item.id);
    setForm(formFromItem(item));
    setMessage('');
  }

  function createNew() {
    setSelectedId('');
    setForm(emptyForm());
    setMessage('');
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      const result = selectedId
        ? await updateAdminCompetition(selectedId, payloadFromForm(form))
        : await createAdminCompetition(payloadFromForm(form));
      setSelectedId(result.id);
      setForm(formFromItem(result));
      setMessage(result.publishStatus === 'published' ? '已保存并发布' : result.publishStatus === 'archived' ? '已归档' : '草稿已保存');
      await load('', '');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <AdminPageTitle title="竞赛目录" meta={`${state.data.length} 条`} action={<AdminButton onClick={createNew}><Plus size={16} />新建竞赛</AdminButton>} />
      <div className="grid min-w-0 gap-5 px-5 xl:grid-cols-[21rem_minmax(0,1fr)]">
        <AdminPanel>
          <div className="space-y-3">
            <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-blue-500">
              <Search size={17} className="text-slate-400" />
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索名称、主办方" aria-label="搜索竞赛" className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" />
            </label>
            <select value={filter} onChange={(event) => setFilter(event.target.value as AdminCompetitionPublishStatus | '')} className={inputClass} aria-label="发布状态筛选">
              <option value="">全部状态</option><option value="draft">草稿</option><option value="published">已发布</option><option value="archived">已归档</option>
            </select>
          </div>
          <div className="mt-4 max-h-[72vh] space-y-2 overflow-y-auto pr-1">
            {state.status === 'loading' ? <StateCard mode="loading" title="加载中" /> : null}
            {state.status === 'error' ? <StateCard mode="error" title="加载失败" description={state.errorMessage} /> : null}
            {state.status === 'success' && state.data.length === 0 ? <AdminEmpty>没有匹配竞赛</AdminEmpty> : null}
            {state.data.map((item) => (
              <button key={item.id} type="button" onClick={() => selectItem(item)} className={cx('w-full rounded-lg border p-3 text-left', selectedId === item.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50')}>
                <div className="flex items-start justify-between gap-2"><span className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-5 text-slate-900">{item.title}</span><AdminStatus status={item.publishStatus} /></div>
                <div className="mt-2 truncate text-xs text-slate-500">{item.category} · {item.host}</div>
                <div className="mt-1 text-[11px] font-medium text-slate-400">{item.editionLabel || '未填写届次'} · {item.qualityStatus === 'verified' ? '已核验' : item.qualityStatus === 'stale' ? '待复核' : '待审核'}</div>
              </button>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel title={selected ? '编辑竞赛' : '新建竞赛'} meta={selected ? selected.id : '默认保存为草稿'} action={selected?.sourceUrl ? <a href={selected.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-600"><ExternalLink size={15} />来源</a> : null}>
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <Field label="竞赛名称" className="md:col-span-2"><input value={form.title} onChange={(e) => set('title', e.target.value)} className={inputClass} /></Field>
            <Field label="竞赛分类"><input value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="如：数学建模" className={inputClass} /></Field>
            <Field label="赛事级别"><input value={form.level} onChange={(e) => set('level', e.target.value)} className={inputClass} /></Field>
            <Field label="主办方" className="md:col-span-2"><input value={form.host} onChange={(e) => set('host', e.target.value)} className={inputClass} /></Field>
            <Field label="参赛对象" className="md:col-span-2"><input value={form.target} onChange={(e) => set('target', e.target.value)} className={inputClass} /></Field>
            <Field label="团队人数"><input value={form.teamSize} onChange={(e) => set('teamSize', e.target.value)} placeholder="填写稳定的人数或分工规则" className={inputClass} /></Field>
            <Field label="难度"><select value={form.difficulty} onChange={(e) => set('difficulty', e.target.value)} className={inputClass}><option>低</option><option>中</option><option>中高</option><option>高</option></select></Field>
            <Field label="报名状态"><input value={form.status} onChange={(e) => set('status', e.target.value)} className={inputClass} /></Field>
            <Field label="官方截止日期"><input type="date" value={form.deadline} onChange={(e) => set('deadline', e.target.value)} className={inputClass} /></Field>
            <Field label="报名开始"><input type="date" value={form.registrationStart || ''} onChange={(e) => set('registrationStart', e.target.value)} className={inputClass} /></Field>
            <Field label="报名结束"><input type="date" value={form.registrationEnd || ''} onChange={(e) => set('registrationEnd', e.target.value)} className={inputClass} /></Field>
            <Field label="比赛开始"><input type="date" value={form.competitionStart || ''} onChange={(e) => set('competitionStart', e.target.value)} className={inputClass} /></Field>
            <Field label="比赛结束"><input type="date" value={form.competitionEnd || ''} onChange={(e) => set('competitionEnd', e.target.value)} className={inputClass} /></Field>
            <Field label="届次说明"><input value={form.editionLabel} onChange={(e) => set('editionLabel', e.target.value)} placeholder="如：2025届公开规则" className={inputClass} /></Field>
            <Field label="赛程状态"><select value={form.scheduleStatus} onChange={(e) => set('scheduleStatus', e.target.value as FormState['scheduleStatus'])} className={inputClass}><option value="not_announced">本届未发布</option><option value="partially_announced">部分已发布</option><option value="announced">已发布</option><option value="closed">已结束</option></select></Field>
            <Field label="报名方式" className="md:col-span-2"><input value={form.registrationMethod || ''} onChange={(e) => set('registrationMethod', e.target.value)} className={inputClass} /></Field>
            <Field label="赛道或主题（每行一项）" className="md:col-span-2"><textarea value={form.tracks} onChange={(e) => set('tracks', e.target.value)} className={textareaClass} /></Field>
            <Field label="竞赛简介" className="md:col-span-2"><textarea value={form.description} onChange={(e) => set('description', e.target.value)} className={textareaClass} /></Field>
            <Field label="赛程阶段（每行一项）"><textarea value={form.stages} onChange={(e) => set('stages', e.target.value)} className={textareaClass} /></Field>
            <Field label="提交材料（每行一项）"><textarea value={form.submissionMaterials} onChange={(e) => set('submissionMaterials', e.target.value)} className={textareaClass} /></Field>
            <Field label="适合人群（每行一项）"><textarea value={form.recommendedFor} onChange={(e) => set('recommendedFor', e.target.value)} className={textareaClass} /></Field>
            <Field label="准备提示（每行一项）"><textarea value={form.actionHints} onChange={(e) => set('actionHints', e.target.value)} className={textareaClass} /></Field>
            <Field label="标签（顿号或逗号分隔）" className="md:col-span-2"><input value={form.tags} onChange={(e) => set('tags', e.target.value)} className={inputClass} /></Field>
            <Field label="奖项说明"><input value={form.awards || ''} onChange={(e) => set('awards', e.target.value)} className={inputClass} /></Field>
            <Field label="费用说明"><input value={form.feeDescription || ''} onChange={(e) => set('feeDescription', e.target.value)} className={inputClass} /></Field>
            <Field label="官方联系"><input value={form.officialContact || ''} onChange={(e) => set('officialContact', e.target.value)} className={inputClass} /></Field>
            <Field label="最后核验日期"><input type="date" value={form.lastVerifiedAt} onChange={(e) => set('lastVerifiedAt', e.target.value)} className={inputClass} /></Field>
            <Field label="官方来源" className="md:col-span-2"><input type="url" value={form.sourceUrl} onChange={(e) => set('sourceUrl', e.target.value)} placeholder="https://" className={inputClass} /></Field>
            <Field label="质量状态"><select value={form.qualityStatus} onChange={(e) => set('qualityStatus', e.target.value as FormState['qualityStatus'])} className={inputClass}><option value="pending_review">待审核</option><option value="verified">已核验</option><option value="stale">待复核</option></select></Field>
            <Field label="发布状态"><select value={form.publishStatus} onChange={(e) => set('publishStatus', e.target.value as AdminCompetitionPublishStatus)} className={inputClass}><option value="draft">草稿</option><option value="published">发布</option><option value="archived">归档</option></select></Field>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <AdminButton onClick={() => void save()} disabled={saving}><Save size={16} />{saving ? '保存中' : '保存'}</AdminButton>
            {message ? <span className={cx('text-sm font-medium', /失败|错误|请补全|有效/.test(message) ? 'text-rose-600' : 'text-emerald-600')}>{message}</span> : null}
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}
