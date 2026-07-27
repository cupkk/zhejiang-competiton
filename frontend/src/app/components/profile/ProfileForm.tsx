import { useEffect, useMemo, useState } from 'react';
import type { UpdateUserProfilePayload } from '../../../types/api';
import type { UserProfile } from '../../../types/entities';
import { ActionButton, fieldClass, textAreaClass } from '../ui';

interface ProfileFormProps {
  user: UserProfile;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (payload: UpdateUserProfilePayload) => Promise<void> | void;
  onCancel?: () => void;
  cancelLabel?: string;
}

function normalizeTags(value: string) {
  return value
    .split(/[,\n，]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export function ProfileForm({
  user,
  submitLabel,
  submitting = false,
  onSubmit,
  onCancel,
  cancelLabel = '取消',
}: ProfileFormProps) {
  const [name, setName] = useState(user.name);
  const [school, setSchool] = useState(user.school);
  const [grade, setGrade] = useState(user.grade);
  const [major, setMajor] = useState(user.major);
  const [bio, setBio] = useState(user.bio);
  const [focusTagsText, setFocusTagsText] = useState(user.focusTags.join('，'));
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setName(user.name);
    setSchool(user.school);
    setGrade(user.grade);
    setMajor(user.major);
    setBio(user.bio);
    setFocusTagsText(user.focusTags.join('，'));
  }, [user]);

  const previewTags = useMemo(() => normalizeTags(focusTagsText), [focusTagsText]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextPayload: UpdateUserProfilePayload = {
      name: name.trim(),
      school: school.trim(),
      grade: grade.trim(),
      major: major.trim(),
      bio: bio.trim(),
      focusTags: normalizeTags(focusTagsText),
    };

    if (!nextPayload.name || !nextPayload.school || !nextPayload.grade || !nextPayload.major || !nextPayload.bio) {
      setErrorMessage('请先补全昵称、学校、年级、专业和个人简介。');
      return;
    }

    if (nextPayload.focusTags.length === 0) {
      setErrorMessage('请至少填写一个关注方向。');
      return;
    }

    setErrorMessage('');
    await onSubmit(nextPayload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <div className="mb-2 text-sm font-semibold text-slate-700">昵称</div>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如 陈同学"
            className={fieldClass}
          />
        </label>
        <label className="block">
          <div className="mb-2 text-sm font-semibold text-slate-700">学校</div>
          <input
            value={school}
            onChange={(event) => setSchool(event.target.value)}
            placeholder="例如 北京理工大学"
            className={fieldClass}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <div className="mb-2 text-sm font-semibold text-slate-700">年级</div>
          <input
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
            placeholder="例如 大三"
            className={fieldClass}
          />
        </label>
        <label className="block">
          <div className="mb-2 text-sm font-semibold text-slate-700">专业</div>
          <input
            value={major}
            onChange={(event) => setMajor(event.target.value)}
            placeholder="例如 计算机科学与技术"
            className={fieldClass}
          />
        </label>
      </div>

      <label className="block">
        <div className="mb-2 text-sm font-semibold text-slate-700">关注方向</div>
        <input
          value={focusTagsText}
          onChange={(event) => setFocusTagsText(event.target.value)}
          placeholder="用逗号分隔，例如 商赛、数据分析、答辩"
          className={fieldClass}
        />
        {previewTags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {previewTags.map((tag) => (
              <span key={tag} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </label>

      <label className="block">
        <div className="mb-2 text-sm font-semibold text-slate-700">个人简介</div>
        <textarea
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          rows={5}
          placeholder="简单介绍你的兴趣方向、最近在做的事情，以及你想寻找的合作方式。"
          className={textAreaClass}
        />
      </label>

      {errorMessage ? (
        <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-600">{errorMessage}</div>
      ) : null}

      <div className="flex gap-3 pt-2">
        {onCancel ? (
          <ActionButton
            type="button"
            onClick={onCancel}
            variant="secondary"
            className="flex-1"
          >
            {cancelLabel}
          </ActionButton>
        ) : null}
        <ActionButton
          type="submit"
          disabled={submitting}
          className="flex-1"
        >
          {submitting ? '保存中…' : submitLabel}
        </ActionButton>
      </div>
    </form>
  );
}
