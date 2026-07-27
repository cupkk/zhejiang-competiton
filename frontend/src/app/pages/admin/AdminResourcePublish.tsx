import { ArrowLeft, ExternalLink, Upload } from 'lucide-react';
import { useState } from 'react';
import { AdminButton, AdminPageTitle, AdminPanel, cx } from '../../components/admin/AdminUi';
import { publishAdminResource } from '../../lib/app-service';
import type { AdminResourcePublishResult } from '../../lib/admin-types';
import { buildResourceDetailRoute, routes } from '../../lib/routes';

const inputClass = 'min-h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70';
const textareaClass = `${inputClass} min-h-28 resize-y py-3 leading-6`;

function values(value: string) {
  return value.split(/[\r\n,，、]+/).map((item) => item.trim()).filter(Boolean);
}

export function AdminResourcePublish() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('竞赛资料');
  const [description, setDescription] = useState('');
  const [suitableFor, setSuitableFor] = useState('');
  const [tags, setTags] = useState('');
  const [previewPoints, setPreviewPoints] = useState('');
  const [relatedCompetitionIds, setRelatedCompetitionIds] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<AdminResourcePublishResult | null>(null);

  async function submit() {
    if (!file) { setMessage('请选择资源文件'); return; }
    setSubmitting(true);
    setMessage('');
    try {
      const next = await publishAdminResource(file, {
        title, category, description, suitableFor,
        tags: values(tags), previewPoints: values(previewPoints), relatedCompetitionIds: values(relatedCompetitionIds),
      });
      setResult(next);
      setMessage(next.contentScope === 'school' ? '已发布到本校资源库' : '已发布到平台资源库');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '发布失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <AdminPageTitle title="发布资源" meta="文件和内容将写入真实资源库" action={<AdminButton to={routes.adminResources} tone="secondary"><ArrowLeft size={15} />返回</AdminButton>} />
      <div className="max-w-4xl px-5">
        <AdminPanel>
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <label className="block md:col-span-2"><span className="mb-1.5 block text-xs font-semibold text-slate-600">资源文件</span><input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.zip,.jpg,.jpeg,.png,.webp" onChange={(event) => setFile(event.target.files?.[0] || null)} className={`${inputClass} py-2`} /></label>
            <label className="block md:col-span-2"><span className="mb-1.5 block text-xs font-semibold text-slate-600">资源名称</span><input value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">分类</span><input value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass} /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">适合人群</span><input value={suitableFor} onChange={(event) => setSuitableFor(event.target.value)} className={inputClass} /></label>
            <label className="block md:col-span-2"><span className="mb-1.5 block text-xs font-semibold text-slate-600">资源简介</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} className={textareaClass} /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">内容要点（每行一项）</span><textarea value={previewPoints} onChange={(event) => setPreviewPoints(event.target.value)} className={textareaClass} /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">标签（逗号或换行分隔）</span><textarea value={tags} onChange={(event) => setTags(event.target.value)} className={textareaClass} /></label>
            <label className="block md:col-span-2"><span className="mb-1.5 block text-xs font-semibold text-slate-600">关联竞赛 ID（可选）</span><input value={relatedCompetitionIds} onChange={(event) => setRelatedCompetitionIds(event.target.value)} placeholder="可从竞赛目录复制 ID，多个用逗号分隔" className={inputClass} /></label>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <AdminButton onClick={() => void submit()} disabled={submitting}><Upload size={16} />{submitting ? '上传中' : '上传并发布'}</AdminButton>
            {message ? <span className={cx('text-sm font-medium', /失败|请选择|补全|不匹配/.test(message) ? 'text-rose-600' : 'text-emerald-600')}>{message}</span> : null}
            {result ? <AdminButton to={buildResourceDetailRoute(result.id)} tone="secondary"><ExternalLink size={15} />查看资源</AdminButton> : null}
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}
