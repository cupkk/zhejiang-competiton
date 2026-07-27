import { type DragEvent, useEffect, useMemo, useState } from 'react';
import { Eye, GripVertical, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { AdminButton, AdminPageTitle } from '../../components/admin/AdminUi';
import { StateCard } from '../../components/StateCard';
import { useRequestState } from '../../hooks/useRequestState';
import {
  fetchAdminHomeFeedConfig,
  fetchCompetitionList,
  fetchPostList,
  fetchResourceList,
  fetchTeamList,
  updateAdminHomeFeedConfig,
  uploadAdminHomeFeedImage,
} from '../../lib/app-service';
import type { AdminHomeFeedConfig } from '../../lib/admin-types';
import { defaultAdminHomeConfig, homeQuickLinkMeta } from '../../lib/home-config';
import { displayPublishStatus, formatDateTimeLabel } from '../../lib/format';
import type { Competition, HomeBannerItem, HomeQuickLinkItem, PostItem, ResourceItem, TeamItem } from '../../../types/entities';

interface HomeConfigOptions {
  competitions: Competition[];
  resources: ResourceItem[];
  teams: TeamItem[];
  posts: PostItem[];
}

interface SortDragState {
  group: string;
  itemId: string;
}

interface SelectableItem {
  id: string;
  title: string;
  meta: string;
}

const emptyOptions: HomeConfigOptions = {
  competitions: [],
  resources: [],
  teams: [],
  posts: [],
};

const publishStatuses: Array<{ value: AdminHomeFeedConfig['publishStatus']; label: string; hint: string }> = [
  { value: 'draft', label: '草稿', hint: '暂不生效' },
  { value: 'scheduled', label: '定时', hint: '到点上线' },
  { value: 'online', label: '上线', hint: '立即生效' },
  { value: 'offline', label: '下线', hint: '回退默认' },
];

function toDateTimeLocal(value?: string) {
  if (!value) {
    return '';
  }

  const normalized = value.replace(' ', 'T');
  return normalized.length >= 16 ? normalized.slice(0, 16) : normalized;
}

function moveItemById<T extends { id: string }>(list: T[], activeId: string, targetId: string) {
  const sourceIndex = list.findIndex((item) => item.id === activeId);
  const targetIndex = list.findIndex((item) => item.id === targetId);

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return list;
  }

  const next = [...list];
  const [source] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, source);
  return next;
}

function moveStringItem(list: string[], activeId: string, targetId: string) {
  const sourceIndex = list.findIndex((item) => item === activeId);
  const targetIndex = list.findIndex((item) => item === targetId);

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return list;
  }

  const next = [...list];
  const [source] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, source);
  return next;
}

function createBanner(index: number): HomeBannerItem {
  return {
    id: `banner-${Date.now()}-${index}`,
    badge: '新轮播',
    title: '填写首页标题',
    imageUrl: defaultAdminHomeConfig.banners[0].imageUrl,
    link: '/',
  };
}

function buildSelectedItems(allItems: SelectableItem[], ids: string[]) {
  const itemMap = new Map(allItems.map((item) => [item.id, item]));
  return ids.map((id) => itemMap.get(id)).filter((item): item is SelectableItem => Boolean(item));
}

function updateBannerField(
  config: AdminHomeFeedConfig,
  bannerId: string,
  key: keyof Pick<HomeBannerItem, 'badge' | 'title' | 'link' | 'imageUrl'>,
  value: string
) {
  return {
    ...config,
    banners: config.banners.map((item) => (item.id === bannerId ? { ...item, [key]: value } : item)),
  };
}

function toggleSelectedId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

function SortableSelectedList({
  title,
  limit,
  onLimitChange,
  selectedIds,
  items,
  candidateItems,
  dragState,
  setDragState,
  onReorder,
  onToggle,
}: {
  title: string;
  limit: number;
  onLimitChange: (value: number) => void;
  selectedIds: string[];
  items: SelectableItem[];
  candidateItems: SelectableItem[];
  dragState: SortDragState | null;
  setDragState: (value: SortDragState | null) => void;
  onReorder: (activeId: string, targetId: string) => void;
  onToggle: (id: string) => void;
}) {
  return (
    <section className="min-w-0 rounded-lg bg-white p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-base font-semibold text-slate-900">{title}</div>
        </div>
        <label className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
          数量
          <input
            type="number"
            min={1}
            max={6}
            name={`${title}-limit`}
            aria-label={`${title}数量`}
            value={limit}
            onChange={(event) => onLimitChange(Number(event.target.value || 1))}
            className="ml-2 min-h-11 w-14 bg-transparent text-right outline-none"
          />
        </label>
      </div>

      <div className="mt-4">
        <div className="mb-3 text-sm font-semibold text-slate-700">已选</div>
        <div className="space-y-3">
          {items.length > 0 ? (
            items.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => setDragState({ group: title, itemId: item.id })}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragState?.group === title) {
                    onReorder(dragState.itemId, item.id);
                  }
                  setDragState(null);
                }}
                onDragEnd={() => setDragState(null)}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                  dragState?.group === title && dragState.itemId === item.id
                    ? 'border-teal-300 bg-teal-50'
                    : 'border-slate-100 bg-slate-50'
                }`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">
                  <GripVertical size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900">{item.title}</div>
                  <div className="mt-1 truncate text-xs text-slate-500">{item.meta}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggle(item.id)}
                  className="min-h-11 rounded-md bg-white px-3 py-1 text-xs font-semibold text-rose-600 shadow-sm"
                >
                  移除
                </button>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              未选择
            </div>
          )}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-3 text-sm font-semibold text-slate-700">内容池</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {candidateItems.map((item) => {
            const selected = selectedIds.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggle(item.id)}
                className={`min-h-11 rounded-lg border px-4 py-4 text-left transition-colors ${
                  selected ? 'border-teal-400 bg-teal-50 text-teal-900' : 'border-slate-100 bg-slate-50 text-slate-800'
                }`}
              >
                <div className="text-sm font-semibold">{item.title}</div>
                <div className="mt-2 text-xs leading-5 text-slate-500">{item.meta}</div>
                <div className="mt-3 text-xs font-semibold">{selected ? '已选' : '加入'}</div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function AdminHomeConfig() {
  const [config, setConfig] = useState<AdminHomeFeedConfig>(defaultAdminHomeConfig);
  const [saving, setSaving] = useState(false);
  const [dragState, setDragState] = useState<SortDragState | null>(null);
  const [uploadingBannerId, setUploadingBannerId] = useState<string | null>(null);

  const configState = useRequestState<AdminHomeFeedConfig>({
    initialData: defaultAdminHomeConfig,
    errorMessage: '首页运营配置加载失败，请稍后重试。',
  });

  const optionsState = useRequestState<HomeConfigOptions>({
    initialData: emptyOptions,
    errorMessage: '首页候选内容加载失败，请稍后重试。',
  });

  useEffect(() => {
    void configState.run(async () => {
      const result = await fetchAdminHomeFeedConfig();
      setConfig(result);
      return result;
    });

    void optionsState.run(async () => {
      const [competitions, resources, teams, posts] = await Promise.all([
        fetchCompetitionList({ limit: 20 }),
        fetchResourceList({ limit: 20 }),
        fetchTeamList({}),
        fetchPostList({}),
      ]);

      return {
        competitions: competitions.slice(0, 12),
        resources: resources.slice(0, 12),
        teams: teams.slice(0, 12),
        posts: posts.slice(0, 12),
      };
    });
  }, [configState.run, optionsState.run]);

  const previewBanner = config.banners[0] || defaultAdminHomeConfig.banners[0];
  const visibleQuickLinks = config.quickLinks.filter((item) => item.id !== 'ai');
  const enabledQuickLinks = visibleQuickLinks.filter((item) => item.enabled);
  const updatedAtLabel = useMemo(() => formatDateTimeLabel(config.updatedAt), [config.updatedAt]);

  const competitionCandidates = useMemo<SelectableItem[]>(
    () =>
      optionsState.data.competitions.map((item) => ({
        id: item.id,
        title: item.title,
        meta: `${item.level} / ${item.category} / 截止 ${item.deadline}`,
      })),
    [optionsState.data.competitions]
  );

  const resourceCandidates = useMemo<SelectableItem[]>(
    () =>
      optionsState.data.resources.map((item) => ({
        id: item.id,
        title: item.title,
        meta: `${item.category} / ${item.type} / ${item.price === 0 ? '免费' : `¥${item.price}`}`,
      })),
    [optionsState.data.resources]
  );

  const teamCandidates = useMemo<SelectableItem[]>(
    () =>
      optionsState.data.teams.map((item) => ({
        id: item.id,
        title: item.title,
        meta: `${item.compName} / 还缺 ${Math.max(item.max - item.current, 0)} 人`,
      })),
    [optionsState.data.teams]
  );

  const postCandidates = useMemo<SelectableItem[]>(
    () =>
      optionsState.data.posts.map((item) => ({
        id: item.id,
        title: item.title,
        meta: `${item.category} / ${item.likes} 赞 / ${item.comments} 评论`,
      })),
    [optionsState.data.posts]
  );

  const isReady = configState.status === 'success' && optionsState.status === 'success';

  async function handleBannerUpload(bannerId: string, file: File) {
    setUploadingBannerId(bannerId);
    try {
      const result = await uploadAdminHomeFeedImage(file);
      setConfig((current) => updateBannerField(current, bannerId, 'imageUrl', result.imageUrl));
    } finally {
      setUploadingBannerId(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const leadBanner = config.banners[0] || defaultAdminHomeConfig.banners[0];
      const payload: AdminHomeFeedConfig = {
        ...config,
        quickLinks: config.quickLinks.map((item) => (item.id === 'ai' ? { ...item, enabled: false } : item)),
        heroBadge: leadBanner.badge,
        heroPrompt: leadBanner.title,
        heroImageUrl: leadBanner.imageUrl,
      };
      const result = await updateAdminHomeFeedConfig(payload);
      setConfig(result);
      configState.reset(result, 'success');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageTitle
        title="首页"
        meta={`${displayPublishStatus(config.effectiveStatus)} / ${config.banners.length} 个轮播`}
        action={
          <AdminButton disabled={!isReady || saving} onClick={() => void handleSave()}>
            {saving ? '保存中…' : '保存'}
          </AdminButton>
        }
      />

      <div className="space-y-6 px-5 pb-8">
        {configState.status === 'loading' || optionsState.status === 'loading' ? (
          <StateCard mode="loading" title="正在同步首页配置" description="运营位、候选内容和排序信息正在加载中。" />
        ) : null}

        {configState.status === 'error' ? (
          <StateCard
            mode="error"
            title="首页运营配置加载失败"
            description={configState.errorMessage}
            actionText="重新加载"
            onAction={() => void configState.run(fetchAdminHomeFeedConfig)}
          />
        ) : null}

        {optionsState.status === 'error' ? (
          <StateCard
            mode="error"
            title="首页候选内容加载失败"
            description={optionsState.errorMessage}
            actionText="重新加载"
            onAction={() =>
              void optionsState.run(async () => {
                const [competitions, resources, teams, posts] = await Promise.all([
                  fetchCompetitionList({ limit: 20 }),
                  fetchResourceList({ limit: 20 }),
                  fetchTeamList({}),
                  fetchPostList({}),
                ]);

                return {
                  competitions: competitions.slice(0, 12),
                  resources: resources.slice(0, 12),
                  teams: teams.slice(0, 12),
                  posts: posts.slice(0, 12),
                };
              })
            }
          />
        ) : null}

        {isReady ? (
          <>
            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
              <div className="space-y-5 rounded-lg bg-white p-5 shadow-sm">
                <div>
                  <div className="text-base font-semibold text-slate-900">发布状态</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {publishStatuses.map((item) => {
                    const selected = config.publishStatus === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setConfig((current) => ({ ...current, publishStatus: item.value }))}
                        className={`min-h-11 rounded-lg border px-4 py-4 text-left transition-colors ${
                          selected ? 'border-teal-500 bg-teal-50 text-teal-900' : 'border-slate-100 bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div className="text-sm font-semibold">{item.label}</div>
                        <div className="mt-2 text-xs leading-5 text-slate-500">{item.hint}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <div className="mb-2 font-semibold text-slate-900">发布时间</div>
                    <input
                      type="datetime-local"
                      name="home-publish-at"
                      aria-label="发布时间"
                      value={toDateTimeLocal(config.publishAt)}
                      onChange={(event) => setConfig((current) => ({ ...current, publishAt: event.target.value }))}
                      className="min-h-11 w-full bg-transparent outline-none"
                    />
                  </label>

                  <label className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <div className="mb-2 font-semibold text-slate-900">下线时间</div>
                    <input
                      type="datetime-local"
                      name="home-offline-at"
                      aria-label="下线时间"
                      value={toDateTimeLocal(config.offlineAt)}
                      onChange={(event) => setConfig((current) => ({ ...current, offlineAt: event.target.value }))}
                      className="min-h-11 w-full bg-transparent outline-none"
                    />
                  </label>
                </div>

                <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  状态：<span className="font-semibold text-slate-900">{displayPublishStatus(config.effectiveStatus)}</span>
                  <span className="ml-3">最近保存：{updatedAtLabel}</span>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg bg-slate-950">
                <div className="relative min-h-[22rem]">
                  <img src={previewBanner.imageUrl} alt={previewBanner.title} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                    <div className="inline-flex rounded-md bg-white/16 px-3 py-1 text-xs font-semibold backdrop-blur-md">
                      {previewBanner.badge}
                    </div>
                    <div className="mt-3 max-w-[22rem] text-[1.65rem] font-semibold leading-10">{previewBanner.title}</div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {enabledQuickLinks.slice(0, 4).map((item) => (
                        <div key={item.id} className="rounded-md bg-white/14 px-3 py-1.5 text-xs font-semibold">
                          {homeQuickLinkMeta[item.id].label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="min-w-0 overflow-hidden rounded-lg bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold text-slate-900">轮播</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfig((current) => ({
                      ...current,
                      banners: [...current.banners, createBanner(current.banners.length + 1)],
                    }))
                  }
                  className="inline-flex min-h-11 items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  <Plus size={16} />
                  新增轮播
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {config.banners.map((banner, index) => (
                  <div
                    key={banner.id}
                    draggable
                    onDragStart={() => setDragState({ group: 'banners', itemId: banner.id })}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (dragState?.group === 'banners') {
                        setConfig((current) => ({
                          ...current,
                          banners: moveItemById(current.banners, dragState.itemId, banner.id),
                        }));
                      }
                      setDragState(null);
                    }}
                    onDragEnd={() => setDragState(null)}
                    className={`grid min-w-0 max-w-full gap-4 rounded-lg border p-4 transition-colors md:grid-cols-[120px_minmax(0,1fr)] ${
                      dragState?.group === 'banners' && dragState.itemId === banner.id
                        ? 'border-teal-300 bg-teal-50'
                        : 'border-slate-100 bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 space-y-3">
                      <div className="relative overflow-hidden rounded-lg bg-slate-200">
                        <img src={banner.imageUrl} alt={banner.title} className="h-28 w-full object-cover" />
                        <div className="absolute left-2 top-2 rounded-md bg-slate-950/75 px-2 py-1 text-[11px] font-bold text-white">
                          {index + 1}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">
                          <GripVertical size={16} />
                        </div>
                        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                          <ImagePlus size={14} />
                          {uploadingBannerId === banner.id ? '上传中…' : '更换图片'}
                          <input
                            type="file"
                            name={`banner-image-${banner.id}`}
                            aria-label="更换轮播图片"
                            accept="image/*"
                            className="hidden"
                            onChange={async (event) => {
                              const file = event.target.files?.[0];
                              if (!file) {
                                return;
                              }
                              await handleBannerUpload(banner.id, file);
                              event.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="min-w-0 space-y-3">
                      <div className="grid min-w-0 gap-3 md:grid-cols-[12rem_minmax(0,1fr)]">
                        <input
                          name={`banner-badge-${banner.id}`}
                          aria-label="轮播角标"
                          value={banner.badge}
                          onChange={(event) => setConfig((current) => updateBannerField(current, banner.id, 'badge', event.target.value))}
                          className="min-h-11 w-full min-w-0 max-w-full rounded-lg bg-white px-4 py-3 text-sm outline-none"
                          placeholder="角标文案"
                        />
                        <input
                          name={`banner-link-${banner.id}`}
                          aria-label="轮播跳转链接"
                          value={banner.link}
                          onChange={(event) => setConfig((current) => updateBannerField(current, banner.id, 'link', event.target.value))}
                          className="min-h-11 w-full min-w-0 max-w-full rounded-lg bg-white px-4 py-3 text-sm outline-none"
                          placeholder="跳转链接，如 /competitions"
                        />
                      </div>

                      <textarea
                        name={`banner-title-${banner.id}`}
                        aria-label="轮播标题"
                        value={banner.title}
                        onChange={(event) => setConfig((current) => updateBannerField(current, banner.id, 'title', event.target.value))}
                        rows={3}
                        className="w-full rounded-lg bg-white px-4 py-3 text-sm outline-none"
                        placeholder="轮播标题"
                      />

                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 text-xs text-slate-500">
                        <div className="min-w-0 flex-1 truncate">图片地址：{banner.imageUrl}</div>
                        <button
                          type="button"
                          onClick={() =>
                            setConfig((current) => ({
                              ...current,
                              banners:
                                current.banners.length > 1
                                  ? current.banners.filter((item) => item.id !== banner.id)
                                  : current.banners,
                            }))
                          }
                          className="inline-flex min-h-11 items-center gap-1 rounded-md bg-rose-50 px-3 py-1.5 font-semibold text-rose-600"
                        >
                          <Trash2 size={14} />
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold text-slate-900">快捷入口</div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  <Eye size={14} />
                  已启用 {enabledQuickLinks.length}
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {visibleQuickLinks.map((item) => {
                  const meta = homeQuickLinkMeta[item.id];
                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => setDragState({ group: 'quick-links', itemId: item.id })}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (dragState?.group === 'quick-links') {
                          setConfig((current) => ({
                            ...current,
                            quickLinks: moveItemById(current.quickLinks, dragState.itemId, item.id),
                          }));
                        }
                        setDragState(null);
                      }}
                      onDragEnd={() => setDragState(null)}
                      className={`rounded-lg border p-4 transition-colors ${
                        item.enabled ? 'border-slate-200 bg-slate-50' : 'border-slate-100 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">
                            <GripVertical size={16} />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{meta.label}</div>
                            <div className="mt-1 line-clamp-1 text-xs text-slate-500">{meta.description}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setConfig((current) => ({
                              ...current,
                              quickLinks: current.quickLinks.map((entry) =>
                                entry.id === item.id ? { ...entry, enabled: !entry.enabled } : entry
                              ),
                            }))
                          }
                          className={`min-h-11 rounded-md px-3 py-1 text-xs font-semibold ${
                            item.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.enabled ? '已启用' : '已关闭'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <SortableSelectedList
              title="推荐竞赛"
              limit={config.competitionLimit}
              onLimitChange={(value) => setConfig((current) => ({ ...current, competitionLimit: Math.min(6, Math.max(1, value)) }))}
              selectedIds={config.competitionIds}
              items={buildSelectedItems(competitionCandidates, config.competitionIds)}
              candidateItems={competitionCandidates}
              dragState={dragState}
              setDragState={setDragState}
              onReorder={(activeId, targetId) =>
                setConfig((current) => ({ ...current, competitionIds: moveStringItem(current.competitionIds, activeId, targetId) }))
              }
              onToggle={(id) => setConfig((current) => ({ ...current, competitionIds: toggleSelectedId(current.competitionIds, id) }))}
            />

            <SortableSelectedList
              title="热门资源"
              limit={config.resourceLimit}
              onLimitChange={(value) => setConfig((current) => ({ ...current, resourceLimit: Math.min(6, Math.max(1, value)) }))}
              selectedIds={config.resourceIds}
              items={buildSelectedItems(resourceCandidates, config.resourceIds)}
              candidateItems={resourceCandidates}
              dragState={dragState}
              setDragState={setDragState}
              onReorder={(activeId, targetId) =>
                setConfig((current) => ({ ...current, resourceIds: moveStringItem(current.resourceIds, activeId, targetId) }))
              }
              onToggle={(id) => setConfig((current) => ({ ...current, resourceIds: toggleSelectedId(current.resourceIds, id) }))}
            />

            <SortableSelectedList
              title="最新组队"
              limit={config.teamLimit}
              onLimitChange={(value) => setConfig((current) => ({ ...current, teamLimit: Math.min(6, Math.max(1, value)) }))}
              selectedIds={config.teamIds}
              items={buildSelectedItems(teamCandidates, config.teamIds)}
              candidateItems={teamCandidates}
              dragState={dragState}
              setDragState={setDragState}
              onReorder={(activeId, targetId) =>
                setConfig((current) => ({ ...current, teamIds: moveStringItem(current.teamIds, activeId, targetId) }))
              }
              onToggle={(id) => setConfig((current) => ({ ...current, teamIds: toggleSelectedId(current.teamIds, id) }))}
            />

            <SortableSelectedList
              title="社区精选"
              limit={config.postLimit}
              onLimitChange={(value) => setConfig((current) => ({ ...current, postLimit: Math.min(6, Math.max(1, value)) }))}
              selectedIds={config.postIds}
              items={buildSelectedItems(postCandidates, config.postIds)}
              candidateItems={postCandidates}
              dragState={dragState}
              setDragState={setDragState}
              onReorder={(activeId, targetId) =>
                setConfig((current) => ({ ...current, postIds: moveStringItem(current.postIds, activeId, targetId) }))
              }
              onToggle={(id) => setConfig((current) => ({ ...current, postIds: toggleSelectedId(current.postIds, id) }))}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
