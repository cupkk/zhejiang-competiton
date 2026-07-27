import { Bookmark, CheckCircle2, Flag, Heart, Reply } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import type { PostCommentItem, PostItem } from '../../types/entities';
import { PageHeader } from '../components/PageHeader';
import { StateCard } from '../components/StateCard';
import { hasVerifiedSchool, SchoolVerificationNotice } from '../components/SchoolVerificationNotice';
import { Toast, useToast } from '../components/Toast';
import { ActionButton, textAreaClass } from '../components/ui';
import { useRequestState } from '../hooks/useRequestState';
import { useSession } from '../hooks/useSession';
import {
  acceptPostAnswer,
  createPostComment,
  createReport,
  fetchPostComments,
  fetchPostDetail,
  toggleCommentLike,
  togglePostFavorite,
  togglePostLike,
} from '../lib/app-service';
import { displayPostCategory, displayPublicText, formatDateTimeLabel } from '../lib/format';
import { dataCacheKeys } from '../lib/query-cache';
import { getRequestErrorMessage } from '../lib/request-error';
import { buildLoginRoute, routes } from '../lib/routes';

function renderPostParagraph(paragraph: string) {
  const publicParagraph = displayPublicText(paragraph);
  const sourceMatch = publicParagraph.match(/^(原文[：:]\s*)(https?:\/\/\S+)$/);
  const urlOnlyMatch = publicParagraph.match(/^(https?:\/\/\S+)$/);

  if (sourceMatch) {
    const [, label, url] = sourceMatch;
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

  if (urlOnlyMatch) {
    const [url] = urlOnlyMatch;
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center break-all font-medium text-blue-600 underline underline-offset-4"
      >
        {url}
      </a>
    );
  }

  return publicParagraph;
}

export function PostDetail() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const { loggedIn, user } = useSession();
  const [commentText, setCommentText] = useState('');
  const [replyTarget, setReplyTarget] = useState<PostCommentItem | null>(null);
  const [reportTarget, setReportTarget] = useState<{ targetType: 'post' | 'comment'; targetId: string; title: string } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [acceptingCommentId, setAcceptingCommentId] = useState('');
  const { toast, showToast, clearToast } = useToast();
  const detailState = useRequestState<PostItem | null>({
    initialData: null,
    fallbackData: null,
    errorMessage: '帖子详情加载失败，请稍后重试。',
    cacheKey: params.id ? dataCacheKeys.postDetail(params.id) : undefined,
  });
  const commentState = useRequestState<PostCommentItem[]>({
    initialData: () => [],
    errorMessage: '评论加载失败，请稍后重试。',
    cacheKey: params.id ? dataCacheKeys.postComments(params.id) : undefined,
  });

  useEffect(() => {
    if (!params.id) {
      return;
    }

    void detailState.run(async () => {
      const detail = await fetchPostDetail(params.id!);
      void commentState.run(() => fetchPostComments(params.id!), { preserveDataOnError: true, revalidate: true });
      return detail;
    }, { preserveDataOnError: true, revalidate: true });
  }, [commentState.run, detailState.run, params.id]);

  const highlightCommentId = searchParams.get('commentId');
  const post = detailState.data;
  const renderedComments = useMemo(() => commentState.data, [commentState.data]);

  async function submitReport() {
    if (!reportTarget || !reportReason.trim()) {
      return;
    }

    try {
      await createReport({
        targetType: reportTarget.targetType,
        targetId: reportTarget.targetId,
        reason: reportReason.trim(),
      });
      setReportTarget(null);
      setReportReason('');
      showToast('举报已提交', 'success');
    } catch (error) {
      showToast(getRequestErrorMessage(error, '举报失败，请稍后重试。'), 'error');
    }
  }

  async function acceptAnswer(commentId: string) {
    if (!post) return;
    setAcceptingCommentId(commentId);
    try {
      const nextPost = await acceptPostAnswer(post.id, { commentId });
      detailState.setData(nextPost);
      await commentState.run(() => fetchPostComments(post.id), { forceRefresh: true, preserveDataOnError: true });
      showToast('已采纳回答', 'success');
    } catch (error) {
      showToast(getRequestErrorMessage(error, '采纳失败，请稍后重试。'), 'error');
    } finally {
      setAcceptingCommentId('');
    }
  }

  return (
    <div className="min-h-full bg-slate-50 pb-8">
      <Toast toast={toast} onClose={clearToast} />
      <PageHeader title="帖子详情" back fallbackTo={routes.community} />

      <div className="space-y-4 px-4">
        {detailState.status === 'loading' ? (
          <StateCard mode="loading" title="正在加载帖子详情" description="帖子内容、互动状态和评论区正在同步中。" />
        ) : null}

        {detailState.status === 'error' ? (
          <StateCard
            mode="error"
            title="帖子详情加载失败"
            description={detailState.errorMessage}
            actionText="重新加载"
            onAction={() => params.id && void detailState.run(() => fetchPostDetail(params.id!), { forceRefresh: true })}
          />
        ) : null}

        {detailState.status === 'success' && post ? (
          <>
            <article className="rounded-lg border border-slate-200 bg-white p-4">
              {post.moderationStatus && post.moderationStatus !== 'approved' ? (
                <div
                  className={`mb-3 rounded-lg px-3 py-2 text-sm font-semibold ${
                    post.moderationStatus === 'rejected'
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {post.moderationStatus === 'rejected' ? '帖子未通过审核' : '帖子审核中，仅自己可见'}
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                  {displayPostCategory(post.category)}
                </span>
                <span className="text-xs text-slate-400">{post.time}</span>
                {post.category === '问答' ? (
                  <span className={`ml-auto rounded-md px-2 py-1 text-xs font-semibold ${post.questionStatus === 'resolved' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-600'}`}>
                    {post.questionStatus === 'resolved' ? '已解决' : post.comments === 0 ? '待回答' : '讨论中'}
                  </span>
                ) : null}
              </div>

              <h1 className="mt-3 text-2xl font-semibold leading-tight text-slate-950">{displayPublicText(post.title)}</h1>
              <div className="mt-3 text-sm text-slate-500">
                {displayPublicText(post.authorName)} · {displayPublicText(post.authorMark)}
              </div>

              <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600">
                {post.content.map((paragraph) => (
                  <p key={paragraph}>{renderPostParagraph(paragraph)}</p>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {post.tags.map((tag, index) => (
                  <span key={`${tag}-${index}`} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                    {displayPublicText(tag)}
                  </span>
                ))}
              </div>
            </article>

            <section className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="grid grid-cols-3 gap-3">
                <ActionButton
                  type="button"
                  onClick={async () => {
                    if (!loggedIn) {
                      navigate(buildLoginRoute(`/posts/${post.id}`));
                      return;
                    }

                    try {
                      const viewer = post.viewer ?? { isLiked: false, isFavorited: false };
                      const result = await togglePostLike(post.id, !viewer.isLiked);
                      detailState.setData({
                        ...post,
                        likes: result.likes,
                        viewer: { ...viewer, isLiked: result.liked },
                      });
                    } catch (error) {
                      showToast(getRequestErrorMessage(error, '点赞失败，请稍后重试。'), 'error');
                    }
                  }}
                  variant="secondary"
                >
                  <Heart size={16} className={post.viewer?.isLiked ? 'fill-blue-600 text-blue-600' : ''} />
                  {post.likes}
                </ActionButton>

                <ActionButton
                  type="button"
                  onClick={async () => {
                    if (!loggedIn) {
                      navigate(buildLoginRoute(`/posts/${post.id}`));
                      return;
                    }

                    try {
                      const viewer = post.viewer ?? { isLiked: false, isFavorited: false };
                      const result = await togglePostFavorite(post.id, { favorite: !viewer.isFavorited });
                      detailState.setData({
                        ...post,
                        viewer: { ...viewer, isFavorited: result.favorite },
                      });
                      showToast(result.favorite ? '已加入收藏' : '已取消收藏', 'success');
                    } catch (error) {
                      showToast(getRequestErrorMessage(error, '收藏失败，请稍后重试。'), 'error');
                    }
                  }}
                  variant="secondary"
                >
                  <Bookmark size={16} className={post.viewer?.isFavorited ? 'fill-blue-600 text-blue-600' : ''} />
                  收藏
                </ActionButton>

                <ActionButton
                  type="button"
                  onClick={async () => {
                    if (!loggedIn) {
                      navigate(buildLoginRoute(`/posts/${post.id}`));
                      return;
                    }

                    setReportTarget({ targetType: 'post', targetId: post.id, title: post.title });
                    setReportReason('');
                  }}
                  variant="secondary"
                >
                  <Flag size={16} />
                  举报
                </ActionButton>
              </div>
            </section>

            {reportTarget ? (
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-base font-semibold text-slate-900">举报内容</div>
                <div className="mt-1 text-xs text-slate-500">{reportTarget.title}</div>
                <textarea
                  rows={3}
                  value={reportReason}
                  onChange={(event) => setReportReason(event.target.value)}
                  name="report-reason"
                  aria-label="举报原因"
                  placeholder="写清楚原因，便于管理员判断"
                  className={`${textAreaClass} mt-3`}
                />
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <ActionButton type="button" variant="secondary" onClick={() => setReportTarget(null)}>
                    取消
                  </ActionButton>
                  <ActionButton type="button" disabled={!reportReason.trim()} onClick={() => void submitReport()}>
                    提交举报
                  </ActionButton>
                </div>
              </section>
            ) : null}

            {loggedIn && !hasVerifiedSchool(user) ? <SchoolVerificationNotice /> : <section className="rounded-lg border border-slate-200 bg-white p-4">
              {replyTarget ? (
                <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                  正在回复：{replyTarget.authorName}
                  <button type="button" onClick={() => setReplyTarget(null)} className="ml-2 min-h-11 min-w-11 font-bold underline">
                    取消
                  </button>
                </div>
              ) : null}

              <textarea
                rows={4}
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                name="comment-content"
                aria-label="评论内容"
                placeholder="写下你的看法或补充经验"
                className={textAreaClass}
              />

              <ActionButton
                type="button"
                onClick={async () => {
                  if (!loggedIn) {
                    navigate(buildLoginRoute(`/posts/${post.id}`));
                    return;
                  }

                  if (!commentText.trim()) {
                    return;
                  }

                  try {
                    const result = await createPostComment(post.id, {
                      content: commentText.trim(),
                      parentCommentId: replyTarget?.parentCommentId || replyTarget?.id,
                      replyToCommentId: replyTarget?.id,
                    });
                    setCommentText('');
                    setReplyTarget(null);
                    if (result.status === 'pending') {
                      showToast('评论已提交审核', 'success');
                    } else {
                      await commentState.run(() => fetchPostComments(post.id), { forceRefresh: true });
                    }
                  } catch (error) {
                    showToast(getRequestErrorMessage(error, '评论失败，请稍后重试。'), 'error');
                  }
                }}
                className="mt-3"
              >
                <Reply size={16} />
                发布评论
              </ActionButton>
            </section>}

            <section className="space-y-3">
              {commentState.status === 'loading' ? (
                <StateCard mode="loading" title="正在加载评论" description="评论内容和互动状态正在同步中。" />
              ) : null}

              {commentState.status === 'error' ? (
                <StateCard
                  mode="error"
                  title="评论加载失败"
                  description={commentState.errorMessage}
                  actionText="重新加载"
                  onAction={() => post && void commentState.run(() => fetchPostComments(post.id), { forceRefresh: true })}
                />
              ) : null}

              {commentState.status === 'success' && renderedComments.length === 0 ? (
                <StateCard mode="empty" title="还没有评论" description="你可以成为第一个留言的人。" />
              ) : null}

              {commentState.status === 'success'
                ? renderedComments.map((comment) => (
                    <div
                      key={comment.id}
                      className={`rounded-lg border bg-white p-4 ${comment.isAccepted ? 'border-emerald-200' : 'border-slate-200'} ${
                        highlightCommentId === comment.id ? 'ring-2 ring-blue-100' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold text-slate-900">{comment.authorName}</div>
                          <div className="text-xs text-slate-400">{formatDateTimeLabel(comment.createdAt)}</div>
                          {comment.isAccepted ? (
                            <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 size={14} aria-hidden="true" />已采纳
                            </div>
                          ) : null}
                        </div>
                        <ActionButton
                          type="button"
                          onClick={async () => {
                            if (!loggedIn) {
                              navigate(buildLoginRoute(`/posts/${post.id}`));
                              return;
                            }

                            try {
                              await toggleCommentLike(comment.id, !comment.viewer.isLiked);
                              await commentState.run(() => fetchPostComments(post.id), { forceRefresh: true, preserveDataOnError: true });
                            } catch (error) {
                              showToast(getRequestErrorMessage(error, '点赞失败，请稍后重试。'), 'error');
                            }
                          }}
                          variant="subtle"
                  className="px-3 py-2 text-xs"
                        >
                          <Heart size={14} className={comment.viewer.isLiked ? 'fill-blue-600 text-blue-600' : ''} />
                          {comment.likes}
                        </ActionButton>
                      </div>

                      <div className="mt-3 text-sm leading-7 text-slate-600">
                        {comment.replyToAuthorName ? (
                          <span className="font-bold text-blue-600">@{comment.replyToAuthorName} </span>
                        ) : null}
                        {comment.content}
                      </div>

                      <div className="mt-3 flex gap-3">
                        {post.category === '问答' && post.viewer?.isOwner && post.questionStatus !== 'resolved' && !comment.isAccepted ? (
                          <button type="button" disabled={Boolean(acceptingCommentId)} onClick={() => void acceptAnswer(comment.id)} className="min-h-11 px-1 text-xs font-bold text-emerald-700 disabled:opacity-60">
                            {acceptingCommentId === comment.id ? '采纳中…' : '采纳回答'}
                          </button>
                        ) : null}
                        <button type="button" onClick={() => setReplyTarget(comment)} className="min-h-11 min-w-11 px-1 text-xs font-bold text-blue-600">
                          回复
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!loggedIn) {
                              navigate(buildLoginRoute(`/posts/${post.id}`));
                              return;
                            }

                            setReportTarget({ targetType: 'comment', targetId: comment.id, title: `评论：${comment.content.slice(0, 24)}` });
                            setReportReason('');
                          }}
                          className="min-h-11 min-w-11 px-1 text-xs font-bold text-slate-400"
                        >
                          举报
                        </button>
                      </div>

                      {comment.replies?.length ? (
                        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                          {comment.replies.map((reply) => (
                            <div
                              key={reply.id}
                              className={`rounded-lg bg-slate-50 px-3 py-2.5 ${
                                highlightCommentId === reply.id ? 'ring-2 ring-blue-100' : ''
                              }`}
                            >
                              <div className="text-sm font-bold text-slate-900">{reply.authorName}</div>
                              {reply.isAccepted ? (
                                <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={13} aria-hidden="true" />已采纳</div>
                              ) : null}
                              <div className="mt-2 text-sm leading-7 text-slate-600">
                                {reply.replyToAuthorName ? (
                                  <span className="font-bold text-blue-600">@{reply.replyToAuthorName} </span>
                                ) : null}
                                {reply.content}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))
                : null}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
