import { ArrowLeft, ChevronRight, LogOut, XCircle } from 'lucide-react';
import type { ChangeEvent, FormEvent } from 'react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { Toast, useToast } from '../components/Toast';
import { ActionButton } from '../components/ui';
import { useSession } from '../hooks/useSession';
import { getAvatarAlt, getAvatarLabel } from '../lib/avatar';
import { logout, saveCurrentUserIdentity, saveCurrentUserProfile, uploadUserAvatarImage } from '../lib/app-service';
import { getVisibleProfileText } from '../lib/profile-completion';
import { getRequestErrorMessage } from '../lib/request-error';
import { routes } from '../lib/routes';

type EditableProfileField = 'name' | 'grade' | 'major' | 'bio';

const editFieldLabels: Record<EditableProfileField, string> = {
  name: '昵称',
  grade: '年级',
  major: '专业',
  bio: '个人简介',
};

const editFieldMaxLength: Record<EditableProfileField, number> = {
  name: 24,
  grade: 20,
  major: 36,
  bio: 160,
};

const editControlClass =
  'app-mobile-edit-control block min-h-11 w-full min-w-0 max-w-full appearance-none border-0 bg-transparent px-0 py-3 pr-10 text-[16px] leading-6 text-slate-950 outline-none placeholder:text-slate-400 focus:ring-0';
const editTextareaClass =
  'app-mobile-edit-control block min-h-[8rem] w-full min-w-0 max-w-full resize-none appearance-none border-0 bg-transparent px-0 py-3 text-[16px] leading-7 text-slate-950 outline-none placeholder:text-slate-400 focus:ring-0';

function visibleBio(value?: string) {
  const text = value?.trim() || '';
  if (!text || text.startsWith('完成竞赛、资源和组队信息后')) {
    return '';
  }
  return text;
}

function InfoRow({
  label,
  value,
  action,
  onClick,
}: {
  label: string;
  value: string;
  action?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="text-[15px] font-medium text-slate-900">{label}</div>
      <div className="ml-auto min-w-0 flex items-center gap-2 pl-4 text-right text-sm text-slate-500">
        <span className="max-w-[12rem] truncate">{value}</span>
        {action ? <ChevronRight size={16} className="shrink-0 text-slate-300" aria-hidden="true" /> : null}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-[54px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
      >
        {content}
      </button>
    );
  }

  return <div className="flex min-h-[54px] items-center gap-3 px-4 py-3">{content}</div>;
}

export function AccountSettings() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { toast, showToast, clearToast } = useToast();
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [editingField, setEditingField] = useState<EditableProfileField | ''>('');
  const [editValue, setEditValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const school = getVisibleProfileText(user?.school) || '未选择';
  const major = getVisibleProfileText(user?.major) || '未填写';
  const grade = getVisibleProfileText(user?.grade) || '未填写';
  const bio = visibleBio(user?.bio) || '未填写';
  const certification =
    user?.schoolCertificationStatus === 'verified'
      ? '已认证'
      : user?.schoolCertificationStatus === 'pending'
        ? '待完成'
        : '未认证';

  function getFieldValue(field: EditableProfileField) {
    if (!user) return '';
    if (field === 'bio') return visibleBio(user.bio);
    if (field === 'grade') return getVisibleProfileText(user.grade);
    if (field === 'major') return getVisibleProfileText(user.major);
    return getVisibleProfileText(user.name) || user.name || '';
  }

  function openFieldEditor(field: EditableProfileField) {
    setEditValue(getFieldValue(field));
    setEditingField(field);
  }

  async function saveFieldEdit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!user || !editingField) return;

    const nextValue = editValue.trim();
    if (editingField !== 'bio' && !nextValue) {
      showToast(`请填写${editFieldLabels[editingField]}。`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (editingField === 'name') {
        await saveCurrentUserIdentity({ name: nextValue, avatarUrl: user.avatarUrl });
      } else {
        await saveCurrentUserProfile({
          name: user.name,
          avatarUrl: user.avatarUrl,
          school: user.school,
          major: editingField === 'major' ? nextValue : user.major,
          grade: editingField === 'grade' ? nextValue : user.grade,
          bio: editingField === 'bio' ? nextValue : user.bio,
          focusTags: user.focusTags || [],
        });
      }
      showToast('已保存', 'success');
      setEditingField('');
    } catch (error) {
      showToast(getRequestErrorMessage(error, '保存失败，请稍后重试。'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件。', 'error');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      showToast('头像图片不能超过 3 MB。', 'error');
      return;
    }

    setAvatarUploading(true);
    try {
      const result = await uploadUserAvatarImage(file);
      await saveCurrentUserIdentity({ name: user.name, avatarUrl: result.avatarUrl });
      showToast('头像已更新', 'success');
    } catch (error) {
      showToast(getRequestErrorMessage(error, '头像上传失败，请重新选择。'), 'error');
    } finally {
      setAvatarUploading(false);
    }
  }

  if (editingField) {
    const label = editFieldLabels[editingField];
    const isBio = editingField === 'bio';

    return (
      <div className="min-h-full w-full max-w-full overflow-x-hidden bg-[#f5f7fb] pb-8">
        <Toast toast={toast} onClose={clearToast} />
        <div className="sticky top-0 z-20 w-full max-w-full overflow-hidden border-b border-slate-200/70 bg-[#f6f7f9]/92 px-4 pb-3 pt-6 backdrop-blur-xl">
          <div className="grid min-h-11 w-full min-w-0 max-w-full grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
            <button
              type="button"
              onClick={() => setEditingField('')}
              className="app-button-reset flex h-11 w-11 items-center justify-center rounded-full text-slate-700 transition hover:bg-white active:bg-slate-200"
              aria-label="返回"
            >
              <ArrowLeft size={21} strokeWidth={2.2} />
            </button>
            <h1 className="truncate text-center text-[1.15rem] font-semibold text-slate-950">修改{label}</h1>
          </div>
        </div>

        <form className="w-full max-w-full overflow-x-hidden pt-4" onSubmit={(event) => void saveFieldEdit(event)}>
          <section className="w-full max-w-full overflow-hidden border-y border-slate-200 bg-white px-4 py-3">
            <label className="sr-only" htmlFor={`account-edit-${editingField}`}>
              {label}
            </label>
            <div className="relative w-full min-w-0 max-w-full">
              {isBio ? (
                <textarea
                  id={`account-edit-${editingField}`}
                  value={editValue}
                  onChange={(event) => setEditValue(event.target.value.slice(0, editFieldMaxLength[editingField]))}
                  className={editTextareaClass}
                  rows={6}
                  maxLength={editFieldMaxLength[editingField]}
                  placeholder="写一句简单介绍…"
                />
              ) : (
                <input
                  id={`account-edit-${editingField}`}
                  value={editValue}
                  onChange={(event) => setEditValue(event.target.value.slice(0, editFieldMaxLength[editingField]))}
                  className={editControlClass}
                  name={`account-edit-${editingField}`}
                  autoComplete={editingField === 'name' ? 'nickname' : 'off'}
                  maxLength={editFieldMaxLength[editingField]}
                  placeholder={`填写${label}…`}
                />
              )}
              {editValue ? (
                <button
                  type="button"
                  onClick={() => setEditValue('')}
                  className="absolute right-0 top-1 flex h-10 w-10 items-center justify-center rounded-full text-slate-300 active:text-slate-500"
                  aria-label="清空"
                >
                  <XCircle size={18} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </section>

          <div className="w-full max-w-full px-8 pt-7">
            <ActionButton type="submit" fullWidth disabled={submitting} className="box-border max-w-full rounded-full">
              {submitting ? '保存中…' : '保存'}
            </ActionButton>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#f5f7fb] pb-8">
      <Toast toast={toast} onClose={clearToast} />
      <PageHeader title="个人信息" back fallbackTo={routes.profile} />

      <div className="space-y-4 px-4">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            aria-label="从相册选择头像"
            onChange={(event) => void handleAvatarFileChange(event)}
          />
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarUploading || !user}
            className="flex min-h-[76px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:opacity-60"
          >
            <div className="text-[15px] font-medium text-slate-900">头像</div>
            <div className="ml-auto flex items-center gap-3">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={getAvatarAlt(user)} width={52} height={52} className="h-[52px] w-[52px] rounded-lg object-cover" />
              ) : (
                <div className="flex h-[52px] w-[52px] items-center justify-center rounded-lg bg-slate-900 text-lg font-semibold text-white">
                  {avatarUploading ? '…' : getAvatarLabel(user?.name)}
                </div>
              )}
              <ChevronRight size={16} className="text-slate-300" aria-hidden="true" />
            </div>
          </button>
          <div className="divide-y divide-slate-100">
            <InfoRow label="昵称" value={user?.name || '未登录'} action onClick={() => openFieldEditor('name')} />
            <InfoRow label="学校" value={school} action onClick={() => navigate(routes.schools)} />
            <InfoRow label="年级" value={grade} action onClick={() => openFieldEditor('grade')} />
            <InfoRow label="专业" value={major} action onClick={() => openFieldEditor('major')} />
            <InfoRow label="个人简介" value={bio} action onClick={() => openFieldEditor('bio')} />
            <InfoRow label="手机号" value="未绑定" action onClick={() => navigate(routes.schoolVerify)} />
            <InfoRow label="校园认证" value={certification} action onClick={() => navigate(routes.schoolVerify)} />
          </div>
        </section>

        <button
          type="button"
          onClick={() => {
            logout();
            navigate(routes.home, { replace: true });
          }}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-rose-600 transition-colors active:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
        >
          <LogOut size={16} aria-hidden="true" />
          退出登录
        </button>
      </div>
    </div>
  );
}
