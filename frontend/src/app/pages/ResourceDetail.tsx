import { Bookmark, Download, ExternalLink, EyeOff } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { HomeFeed, ResourceItem } from '../../types/entities';
import { PageHeader } from '../components/PageHeader';
import { ResourceCard } from '../components/ResourceCard';
import { StateCard } from '../components/StateCard';
import { Toast, useToast } from '../components/Toast';
import { ActionButton, ActionLink, BottomActionBar } from '../components/ui';
import { useRequestState } from '../hooks/useRequestState';
import { useSession } from '../hooks/useSession';
import {
  createResourceAcquire,
  createResourceDownload,
  fetchHomeFeed,
  fetchResourceDetail,
  fetchResourceList,
  toggleResourceFavorite,
} from '../lib/app-service';
import { downloadWithAuth } from '../lib/download';
import { displayPublicText, displayResourceCategory, formatPrice } from '../lib/format';
import { dataCacheKeys, writeCachedData } from '../lib/query-cache';
import { getRequestErrorMessage } from '../lib/request-error';
import { buildLoginRoute, routes } from '../lib/routes';
import { paymentsEnabled } from '../lib/commercial-config';

function renderSourceLine(line: string) {
  const publicLine = displayPublicText(line);
  const match = publicLine.match(/^(来源[：:]\s*)(https?:\/\/\S+)$/);

  if (!match) {
    return publicLine;
  }

  const [, label, url] = match;
  return (
    <>
      {label}
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center break-all font-medium text-blue-600 underline underline-offset-4"
      >
        {url}
      </a>
    </>
  );
}

export function ResourceDetail() {
  const navigate = useNavigate();
  const params = useParams();
  const { loggedIn } = useSession();
  const { toast, showToast, clearToast } = useToast();
  const detailState = useRequestState<ResourceItem | null>({
    initialData: null,
    fallbackData: null,
    errorMessage: '该资源暂未公开。',
    cacheKey: params.id ? dataCacheKeys.resourceDetail(params.id) : undefined,
  });
  const relatedState = useRequestState<ResourceItem[]>({
    initialData: () => [],
    errorMessage: '相关推荐加载失败，请稍后重试。',
    cacheKey: params.id ? dataCacheKeys.resourceRelated(params.id) : undefined,
  });
  const homeFeedState = useRequestState<HomeFeed | null>({
    initialData: null,
    fallbackData: null,
    errorMessage: '首页运营信息加载失败，请稍后重试。',
    cacheKey: dataCacheKeys.homeFeed(),
  });

  useEffect(() => {
    if (!params.id) {
      return;
    }

    void detailState.run(async () => {
      const detail = await fetchResourceDetail(params.id!);
      void relatedState.run(async () => {
        const related = await fetchResourceList({ category: detail.category, limit: 3 });
        related.forEach((item) => writeCachedData(dataCacheKeys.resourceDetail(item.id), item));
        return related;
      }, {
        preserveDataOnError: true,
        revalidate: true,
      });
      void homeFeedState.run(fetchHomeFeed, { preserveDataOnError: true, revalidate: true });
      return detail;
    }, { preserveDataOnError: true, revalidate: true });
  }, [detailState.run, homeFeedState.run, params.id, relatedState.run]);

  const resource = detailState.data;
  const isPaidResource = Boolean(resource && resource.price > 0);
  const shouldHidePaidAcquire = isPaidResource && !paymentsEnabled;
  const isSourceOnlyResource = Boolean(resource?.sourceUrl && !resource.file);
  const homeResourceIndex = useMemo(() => {
    if (!resource || !resource.viewer?.canManage) {
      return -1;
    }
    return homeFeedState.data?.hotResources.findIndex((item) => item.id === resource.id) ?? -1;
  }, [homeFeedState.data, resource]);

  async function downloadResource() {
    if (!resource) {
      return;
    }

    try {
      const grant = await createResourceDownload(resource.id);
      await downloadWithAuth(grant.downloadUrl, grant.filename);
    } catch (error) {
      showToast(getRequestErrorMessage(error, '下载失败，请稍后重试。'), 'error');
    }
  }

  return (
    <div className="min-h-full bg-slate-50 pb-8">
      <Toast toast={toast} onClose={clearToast} />
      <PageHeader title="资源详情" back fallbackTo={routes.resources} />

      <div className="space-y-4 px-4">
        {detailState.status === 'loading' ? (
          <StateCard mode="loading" title="正在加载资源详情" description="资源信息、获取状态和相关推荐正在同步中。" />
        ) : null}

        {detailState.status === 'error' ? (
          <StateCard
            mode="error"
            title="资源详情加载失败"
            description={detailState.errorMessage}
            actionText="重新加载"
            onAction={() => params.id && void detailState.run(() => fetchResourceDetail(params.id!), { forceRefresh: true })}
          />
        ) : null}

        {detailState.status === 'auth_expired' ? (
          <StateCard
            mode="auth"
            title="登录状态已失效"
            description="重新登录后可以同步你的收藏和已获取状态。"
            actionText="重新登录"
            onAction={() => navigate(buildLoginRoute(`/resources/${params.id ?? ''}`))}
          />
        ) : null}

        {detailState.status === 'success' && resource ? (
          <>
            {resource.viewer?.canManage && resource.moderationStatus ? (
              <section
                className={`rounded-lg border px-4 py-3 ${
                  resource.moderationStatus === 'approved'
                    ? 'border-blue-100 bg-blue-50'
                    : resource.moderationStatus === 'rejected'
                      ? 'border-slate-200 bg-slate-50'
                      : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="text-sm font-semibold text-slate-900">
                  {resource.moderationStatus === 'approved'
                    ? '资源已通过审核'
                    : resource.moderationStatus === 'rejected'
                      ? '资源审核未通过'
                      : '资源仍在审核中'}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {resource.reviewNote || '审核结论会同步显示在这里，并回写到投稿记录。'}
                </p>
              </section>
            ) : null}

            {resource.viewer?.canManage && homeResourceIndex >= 0 ? (
              <section className="rounded-lg bg-slate-900 px-4 py-3 text-white">
                <div className="text-sm font-semibold">首页运营位预览</div>
                <p className="mt-2 text-sm leading-6 text-white/80">
                  这条资源正在首页「热门资源」区域展示，当前排序第 {homeResourceIndex + 1} 位。
                </p>
              </section>
            ) : null}

            {resource.viewer?.accessStatus === 'owned' ? (
              <section className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                <div className="text-sm font-semibold text-slate-900">你已获得这份资源</div>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  可以直接下载使用。资源更新后仍会保留在你的已获资源里。
                </p>
              </section>
            ) : null}

            {isSourceOnlyResource ? (
              <section className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                <div className="flex min-h-11 items-center justify-between gap-3 text-sm">
                  <div className="inline-flex items-center gap-2 font-semibold text-slate-900">
                    <ExternalLink size={16} />
                    官方来源
                  </div>
                  <div className="shrink-0 text-xs font-medium text-slate-600">以官网为准</div>
                </div>
              </section>
            ) : null}

            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="shrink-0 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">{resource.type}</div>
                  <div className="truncate text-xs font-medium text-slate-500">
                    {displayResourceCategory(resource.category)}
                  </div>
                </div>
                <div className={`text-right text-lg font-semibold ${resource.price === 0 ? 'text-blue-600' : 'text-slate-500'}`}>
                  {resource.price === 0 ? formatPrice(resource.price) : '暂未公开'}
                </div>
              </div>

              <h1 className="mt-3 text-2xl font-semibold leading-tight text-slate-950">{displayPublicText(resource.title)}</h1>
              <div className="mt-2 text-sm text-slate-500">
                {displayPublicText(resource.authorName)} · {displayPublicText(resource.authorTitle)}
              </div>

              <p className="mt-4 text-sm leading-7 text-slate-600">{displayPublicText(resource.description)}</p>

              {isSourceOnlyResource ? (
                <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-lg font-semibold text-slate-900">官方</div>
                    <div className="text-[11px] text-slate-400">来源</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-lg font-semibold text-slate-900">官网</div>
                    <div className="text-[11px] text-slate-400">入口</div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-lg font-semibold text-slate-900">{resource.downloads}</div>
                    <div className="text-[11px] text-slate-400">下载</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-lg font-semibold text-slate-900">{resource.rating.toFixed(1)}</div>
                    <div className="text-[11px] text-slate-400">评分</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-lg font-semibold text-slate-900">{resource.sizeLabel}</div>
                    <div className="text-[11px] text-slate-400">大小</div>
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {resource.tags.map((tag, index) => (
                  <span key={`${tag}-${index}`} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                    {displayPublicText(tag)}
                  </span>
                ))}
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="px-4 pt-4 text-base font-semibold text-slate-900">适合人群</div>
              <div className="px-4 py-3 text-sm leading-7 text-slate-600">{displayPublicText(resource.suitableFor)}</div>
              <div className="divide-y divide-slate-100 border-t border-slate-100">
                {resource.previewPoints.map((item, index) => (
                  <div key={`${item}-${index}`} className="px-4 py-3 text-sm leading-7 text-slate-600">
                    {renderSourceLine(item)}
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div className="text-lg font-semibold text-slate-900">相关推荐</div>
              {relatedState.status === 'loading' ? (
                <StateCard mode="loading" title="正在加载相关推荐" description="同类资源和热门下载正在同步中。" />
              ) : null}
              {relatedState.status === 'success'
                ? relatedState.data
                    .filter((item) => item.id !== resource.id)
                    .slice(0, 3)
                    .map((item) => <ResourceCard key={item.id} resource={item} />)
                : null}
            </section>

            {shouldHidePaidAcquire ? (
              <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <EyeOff size={16} />
                  该资源暂未公开
                </div>
              </section>
            ) : null}

            <BottomActionBar>
              <div className="grid grid-cols-2 gap-3">
                <ActionButton
                  type="button"
                  onClick={async () => {
                    if (!loggedIn) {
                      navigate(buildLoginRoute(`/resources/${resource.id}`));
                      return;
                    }

                    try {
                      const viewer = resource.viewer ?? { isFavorited: false, accessStatus: 'not_acquired' };
                      const result = await toggleResourceFavorite(resource.id, { favorite: !viewer.isFavorited });
                      detailState.setData({
                        ...resource,
                        viewer: { ...viewer, isFavorited: result.favorite },
                      });
                      showToast(result.favorite ? '已加入收藏' : '已取消收藏', 'success');
                    } catch (error) {
                      showToast(getRequestErrorMessage(error, '收藏失败，请稍后重试。'), 'error');
                    }
                  }}
                  variant="secondary"
                >
                  <Bookmark size={16} className={resource.viewer?.isFavorited ? 'fill-blue-600 text-blue-600' : ''} />
                  {resource.viewer?.isFavorited ? '已收藏' : '收藏'}
                </ActionButton>

                {isSourceOnlyResource && resource.sourceUrl ? (
                  <ActionLink href={resource.sourceUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} />
                    查看来源
                  </ActionLink>
                ) : resource.viewer?.accessStatus === 'owned' ? (
                  <ActionButton
                    type="button"
                    onClick={() => void downloadResource()}
                  >
                    <Download size={16} />
                    下载资源
                  </ActionButton>
                ) : resource.price === 0 ? (
                  <ActionButton
                    type="button"
                    onClick={async () => {
                      if (!loggedIn) {
                        navigate(buildLoginRoute(`/resources/${resource.id}`));
                        return;
                      }

                      try {
                        const result = await createResourceAcquire(resource.id, { mode: 'free' });
                        if (result.accessStatus === 'owned') {
                          const viewer = resource.viewer ?? { isFavorited: false, accessStatus: 'not_acquired' };
                          detailState.setData({
                            ...resource,
                            viewer: { ...viewer, accessStatus: 'owned' },
                          });
                          showToast('已加入我的资源', 'success');
                        }
                      } catch (error) {
                        showToast(getRequestErrorMessage(error, '获取资源失败，请稍后重试。'), 'error');
                      }
                    }}
                  >
                    <Download size={16} />
                    免费领取
                  </ActionButton>
                ) : paymentsEnabled ? (
                  <ActionButton
                    type="button"
                    disabled
                    variant="subtle"
                  >
                    <EyeOff size={16} />
                    暂未公开
                  </ActionButton>
                ) : (
                  <ActionButton type="button" disabled variant="subtle">
                    <EyeOff size={16} />
                    暂未公开
                  </ActionButton>
                )}
              </div>
            </BottomActionBar>
          </>
        ) : null}
      </div>
    </div>
  );
}
