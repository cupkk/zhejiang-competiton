import { UploadCloud } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { PublishResourcePayload } from '../../types/api';
import type { Competition } from '../../types/entities';
import { PageHeader } from '../components/PageHeader';
import { StateCard } from '../components/StateCard';
import { hasVerifiedSchool, SchoolVerificationNotice } from '../components/SchoolVerificationNotice';
import { Toast, useToast } from '../components/Toast';
import { useRequestState } from '../hooks/useRequestState';
import { useSession } from '../hooks/useSession';
import { fetchCompetitionList, publishResource, uploadResourceAsset } from '../lib/app-service';
import { getRequestErrorMessage } from '../lib/request-error';
import { routes } from '../lib/routes';
import { startQuickLogin } from '../lib/quick-login';
import { ActionButton, fieldClass, textAreaClass } from '../components/ui';
import { resourceCategoryOptions } from '../lib/domain-options';

const categoryOptions = resourceCategoryOptions.filter((item) => item.value !== '全部');

export function PublishResource() {
  const navigate = useNavigate();
  const { loggedIn, user } = useSession();
  const [loggingIn, setLoggingIn] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('PDF');
  const [category, setCategory] = useState<(typeof categoryOptions)[number]['value']>('资料包');
  const [description, setDescription] = useState('');
  const [sizeLabel, setSizeLabel] = useState('');
  const [suitableFor, setSuitableFor] = useState('');
  const [tags, setTags] = useState('');
  const [previewPoints, setPreviewPoints] = useState('');
  const [selectedCompetitionIds, setSelectedCompetitionIds] = useState<string[]>([]);
  const { toast, showToast, clearToast } = useToast();

  const competitionsState = useRequestState<Competition[]>({
    initialData: () => [],
    errorMessage: '竞赛列表加载失败，请稍后重试。',
  });

  useEffect(() => {
    void competitionsState.run(() => fetchCompetitionList({ limit: 12 }));
  }, [competitionsState.run]);

  if (!loggedIn) {
    return (
      <div className="min-h-full bg-slate-50 pb-8">
        <Toast toast={toast} onClose={clearToast} />
        <PageHeader title="资源投稿" back fallbackTo={routes.profile} />
        <div className="px-4">
          <StateCard
            mode="auth"
            title="请先登录"
            description="登录后才可以发布资源投稿。"
            actionText={loggingIn ? '登录中…' : '立即登录'}
            onAction={() =>
              void startQuickLogin({
                navigate,
                nextPath: routes.publishResource,
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
        <PageHeader title="资源投稿" back fallbackTo={routes.resources} />
        <div className="px-4"><SchoolVerificationNotice /></div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 pb-8">
      <Toast toast={toast} onClose={clearToast} />
      <PageHeader title="资源投稿" back fallbackTo={routes.profile} />

      <div className="space-y-4 px-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-[12px] font-medium text-slate-500">资源信息</div>
          <div className="mt-4 space-y-4">
            <input
              aria-label="资源标题"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="资源标题"
              className={fieldClass}
            />

            <div className="grid grid-cols-2 gap-3">
              <input
                aria-label="资源类型"
                value={type}
                onChange={(event) => setType(event.target.value)}
                placeholder="资源类型，例如 PDF / PPT / ZIP"
                className={fieldClass}
              />

              <select
                aria-label="资源分类"
                value={category}
                onChange={(event) => setCategory(event.target.value as (typeof categoryOptions)[number]['value'])}
                className={fieldClass}
              >
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              aria-label="资源简介"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="资源简介"
              className={textAreaClass}
            />

            <input
              aria-label="文件大小说明"
              value={sizeLabel}
              onChange={(event) => setSizeLabel(event.target.value)}
              placeholder="文件大小说明，例如 18.5 MB"
              className={fieldClass}
            />

            <textarea
              aria-label="适用场景"
              value={suitableFor}
              onChange={(event) => setSuitableFor(event.target.value)}
              rows={3}
              placeholder="适合什么场景、哪些同学使用"
              className={textAreaClass}
            />

            <input
              aria-label="资源标签"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="标签，使用逗号分隔"
              className={fieldClass}
            />

            <textarea
              aria-label="资源预览要点"
              value={previewPoints}
              onChange={(event) => setPreviewPoints(event.target.value)}
              rows={4}
              placeholder="每行一条"
              className={textAreaClass}
            />

            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-800">关联竞赛</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {competitionsState.data.map((item) => {
                  const selected = selectedCompetitionIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setSelectedCompetitionIds((prev) =>
                          selected ? prev.filter((target) => target !== item.id) : [...prev, item.id],
                        )
                      }
                      className={`min-h-11 rounded-lg px-3.5 py-2 text-sm font-semibold ${
                        selected ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'
                      }`}
                    >
                      {item.title}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
              <UploadCloud size={18} aria-hidden="true" />
              <span>{file ? `已选择：${file.name}` : '选择要上传的资源文件'}</span>
              <input type="file" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </label>
          </div>
        </section>

        <ActionButton
          type="button"
          disabled={submitting}
          onClick={async () => {
            if (!file) {
              showToast('请先选择文件', 'error');
              return;
            }
            if (!title.trim() || !type.trim() || !description.trim() || !suitableFor.trim()) {
              showToast('请补全资源信息', 'error');
              return;
            }

            setSubmitting(true);
            try {
              const asset = await uploadResourceAsset(file);
              const payload: PublishResourcePayload = {
                title: title.trim(),
                type: type.trim(),
                category,
                price: 0,
                description: description.trim(),
                sizeLabel: sizeLabel || `${(asset.sizeBytes / 1024 / 1024).toFixed(1)} MB`,
                suitableFor: suitableFor.trim(),
                tags: tags
                  .split(/[,\n，]/)
                  .map((item) => item.trim())
                  .filter(Boolean),
                previewPoints: previewPoints
                  .split('\n')
                  .map((item) => item.trim())
                  .filter(Boolean),
                relatedCompetitionIds: selectedCompetitionIds,
                assetId: asset.assetId,
              };
              await publishResource(payload);
              showToast('资源已提交审核', 'success');
              navigate(routes.resourceSubmissions, { replace: true });
            } catch (error) {
              showToast(getRequestErrorMessage(error, '投稿失败，请稍后重试。'), 'error');
            } finally {
              setSubmitting(false);
            }
          }}
          fullWidth
        >
          {submitting ? '提交中…' : '提交资源投稿'}
        </ActionButton>
      </div>
    </div>
  );
}
