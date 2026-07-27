import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { PublishPostPayload } from '../../types/api';
import type { Competition } from '../../types/entities';
import { PageHeader } from '../components/PageHeader';
import { StateCard } from '../components/StateCard';
import { hasVerifiedSchool, SchoolVerificationNotice } from '../components/SchoolVerificationNotice';
import { Toast, useToast } from '../components/Toast';
import { useSession } from '../hooks/useSession';
import { useRequestState } from '../hooks/useRequestState';
import { fetchCompetitionList, publishPost } from '../lib/app-service';
import { getRequestErrorMessage } from '../lib/request-error';
import { buildPostDetailRoute, routes } from '../lib/routes';
import { startQuickLogin } from '../lib/quick-login';
import { ActionButton, fieldClass, textAreaClass } from '../components/ui';
import { postCategoryTabs } from '../lib/domain-options';

const categories = postCategoryTabs.filter((item) => item.value !== '推荐') as Array<{
  label: string;
  value: PublishPostPayload['category'];
}>;

const questionTagOptions = ['报名', '组队', '材料', '赛制'] as const;

export function PublishPost() {
  const navigate = useNavigate();
  const { loggedIn, user } = useSession();
  const [loggingIn, setLoggingIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<(typeof categories)[number]['value']>('经验贴');
  const [tags, setTags] = useState('');
  const [content, setContent] = useState('');
  const [relatedCompetitionId, setRelatedCompetitionId] = useState('');
  const [questionTags, setQuestionTags] = useState<string[]>([]);
  const { toast, showToast, clearToast } = useToast();
  const competitionState = useRequestState<Competition[]>({ initialData: () => [], errorMessage: '竞赛列表加载失败。' });

  useEffect(() => {
    if (!loggedIn) return;
    void competitionState.run(() => fetchCompetitionList({ sort: '即将截止', limit: 50 }));
  }, [competitionState.run, loggedIn]);

  const isQuestion = category === '问答';

  if (!loggedIn) {
    return (
      <div className="min-h-full bg-slate-50 pb-8">
        <Toast toast={toast} onClose={clearToast} />
        <PageHeader title="发布帖子" back fallbackTo={routes.community} />
        <div className="px-4">
          <StateCard
            mode="auth"
            title="请先登录"
            description="登录后才可以发帖。"
            actionText={loggingIn ? '登录中…' : '立即登录'}
            onAction={() =>
              void startQuickLogin({
                navigate,
                nextPath: routes.publishPost,
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
        <PageHeader title="发布帖子" back fallbackTo={routes.community} />
        <div className="px-4"><SchoolVerificationNotice /></div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 pb-8">
      <Toast toast={toast} onClose={clearToast} />
      <PageHeader title={isQuestion ? '发布问题' : '发布帖子'} back fallbackTo={routes.community} />

      <div className="space-y-4 px-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mt-4 space-y-4">
            <input
              aria-label={isQuestion ? '问题标题' : '帖子标题'}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={isQuestion ? '用一句话说明问题' : '帖子标题'}
              className={fieldClass}
            />

            <div className="flex flex-wrap gap-2">
              {categories.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  aria-pressed={category === item.value}
                  onClick={() => setCategory(item.value)}
                  className={`min-h-11 rounded-lg px-3.5 py-2 text-sm font-semibold ${
                    category === item.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {isQuestion ? (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">关联竞赛</span>
                  <select value={relatedCompetitionId} onChange={(event) => setRelatedCompetitionId(event.target.value)} className={fieldClass}>
                    <option value="">暂不关联</option>
                    {competitionState.data.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                </label>
                <fieldset>
                  <legend className="text-sm font-semibold text-slate-700">问题类型</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {questionTagOptions.map((item) => {
                      const active = questionTags.includes(item);
                      return (
                        <button key={item} type="button" aria-pressed={active} onClick={() => setQuestionTags(active ? questionTags.filter((tag) => tag !== item) : [...questionTags, item])} className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold ${active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'}`}>
                          {active ? <Check size={14} aria-hidden="true" /> : null}{item}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </>
            ) : null}

            <input
              aria-label="帖子标签"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="补充标签，使用逗号分隔"
              className={fieldClass}
            />

            <textarea
              aria-label={isQuestion ? '问题正文' : '帖子正文'}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={9}
              placeholder={isQuestion ? '说明背景、已经尝试的方法和具体卡点' : '正文内容'}
              className={textAreaClass}
            />
          </div>
        </section>

        <ActionButton
          type="button"
          disabled={submitting}
          onClick={async () => {
            if (!title.trim()) {
              showToast('请填写标题', 'error');
              return;
            }
            if (!content.trim()) {
              showToast('请填写正文', 'error');
              return;
            }

            setSubmitting(true);
            try {
              const customTags = tags
                .split(/[,\n，]/)
                .map((item) => item.trim())
                .filter(Boolean);
              const nextPost = await publishPost({
                title: title.trim(),
                category: category as PublishPostPayload['category'],
                content: content.trim(),
                tags: [...new Set([...(isQuestion ? questionTags : []), ...customTags])].slice(0, 8),
                relatedCompetitionId: isQuestion ? relatedCompetitionId || undefined : undefined,
              });
              showToast('已提交审核', 'success');
              navigate(buildPostDetailRoute(nextPost.id), { replace: true });
            } catch (error) {
              showToast(getRequestErrorMessage(error, '发布失败，请稍后重试。'), 'error');
            } finally {
              setSubmitting(false);
            }
          }}
          fullWidth
        >
          {submitting ? '提交中…' : '提交审核'}
        </ActionButton>
      </div>
    </div>
  );
}
