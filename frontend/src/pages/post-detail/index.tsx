import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, Textarea, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { EmptyState } from '../../components/EmptyState';
import { RequestStateCard } from '../../components/RequestStateCard';
import { TopBar } from '../../components/TopBar';
import { PUBLISH_POST_CATEGORY_OPTIONS } from '../../constants/enums';
import {
  buildCompetitionDetailRoute,
  buildResourceDetailRoute,
  PAGE_ROUTES,
} from '../../constants/routes';
import { getCompetitionById, getResourceById } from '../../data/mock';
import { useRequestState } from '../../hooks/useRequestState';
import { useSessionUser } from '../../hooks/useSessionUser';
import {
  createPostComment,
  createReport,
  fetchPostComments,
  fetchPostDetail,
  toggleCommentLike,
  togglePostFavorite,
  togglePostLike,
} from '../../services/app-service';
import type { CommentPayload, ReportPayload } from '../../types/api';
import type { Competition, PostCommentItem, PostItem, ResourceItem } from '../../types/entities';
import { ensureLoggedIn } from '../../utils/auth';
import { showPendingToast } from '../../utils/feedback';
import { formatPrice } from '../../utils/format';
import { executeMutation } from '../../utils/mutation';

const fallbackPost: PostItem = {
  id: '',
  title: '',
  excerpt: '',
  content: [],
  category: PUBLISH_POST_CATEGORY_OPTIONS[0],
  authorName: '',
  authorMark: '',
  likes: 0,
  comments: 0,
  tags: [],
  time: '',
  viewer: {
    isLiked: false,
    isFavorited: false,
  },
};

const reportReasons = ['垃圾广告', '不实信息', '侵权冒犯', '其他'];

interface ReplyTargetState {
  parentCommentId: string;
  replyToCommentId: string;
  authorName: string;
}

function updateCommentTree(
  list: PostCommentItem[],
  targetId: string,
  updater: (comment: PostCommentItem) => PostCommentItem
): PostCommentItem[] {
  return list.map((comment) => {
    if (comment.id === targetId) {
      return updater(comment);
    }

    if (!comment.replies?.length) {
      return comment;
    }

    return {
      ...comment,
      replies: updateCommentTree(comment.replies, targetId, updater),
    };
  });
}

function renderCommentContent(comment: PostCommentItem) {
  if (!comment.replyToAuthorName) {
    return comment.content;
  }

  return `回复 ${comment.replyToAuthorName}：${comment.content}`;
}

export default function PostDetailPage() {
  const router = useRouter();
  const postId = router.params.id ?? '';
  const focusCommentId = router.params.commentId ?? '';
  const { loggedIn } = useSessionUser();
  const [commentDraft, setCommentDraft] = useState('');
  const [replyTarget, setReplyTarget] = useState<ReplyTargetState | null>(null);
  const {
    data: post,
    setData: setPost,
    status: postStatus,
    errorMessage: postError,
    run: runPost,
  } = useRequestState<PostItem>({
    initialData: fallbackPost,
    errorMessage: '帖子详情加载失败，请稍后重试。',
  });
  const {
    data: comments,
    setData: setComments,
    status: commentsStatus,
    errorMessage: commentsError,
    run: runComments,
    reset: resetComments,
  } = useRequestState<PostCommentItem[]>({
    initialData: () => [],
    errorMessage: '评论列表加载失败，请稍后重试。',
  });

  const loadPost = useCallback(async () => {
    if (!postId) {
      return;
    }

    await runPost(() => fetchPostDetail(postId));
  }, [postId, runPost]);

  const loadComments = useCallback(async () => {
    if (!postId) {
      resetComments([], 'idle');
      return;
    }

    await runComments(() => fetchPostComments(postId), {
      preserveDataOnError: true,
    });
  }, [postId, resetComments, runComments]);

  useEffect(() => {
    void loadPost();
  }, [loadPost]);

  useEffect(() => {
    if (!post.id || postStatus !== 'success') {
      resetComments([], 'idle');
      return;
    }

    void loadComments();
  }, [loadComments, post.id, postStatus, resetComments]);

  useEffect(() => {
    if (!focusCommentId || commentsStatus !== 'success') {
      return;
    }

    const timer = setTimeout(() => {
      void Taro.pageScrollTo({
        selector: `#comment-${focusCommentId}`,
        offsetTop: 96,
        duration: 280,
      }).catch(() => undefined);
    }, 90);

    return () => clearTimeout(timer);
  }, [commentsStatus, focusCommentId]);

  const relatedCompetition = useMemo<Competition | null>(() => {
    return post.relatedCompetitionId ? getCompetitionById(post.relatedCompetitionId) : null;
  }, [post.relatedCompetitionId]);

  const relatedResource = useMemo<ResourceItem | null>(() => {
    return post.relatedResourceId ? getResourceById(post.relatedResourceId) : null;
  }, [post.relatedResourceId]);

  const pickReportReason = useCallback(async () => {
    try {
      const { tapIndex } = await Taro.showActionSheet({
        itemList: reportReasons,
      });
      return reportReasons[tapIndex] ?? null;
    } catch {
      return null;
    }
  }, []);

  const handleReport = useCallback(
    async (payload: Omit<ReportPayload, 'reason'>) => {
      if (!ensureLoggedIn({ message: '登录后才能提交举报' })) {
        return;
      }

      const reason = await pickReportReason();
      if (!reason) {
        return;
      }

      await executeMutation({
        task: () =>
          createReport({
            ...payload,
            reason,
          }),
        loadingTitle: '提交举报',
        successMessage: '举报已提交，我们会尽快处理。',
        fallbackErrorMessage: '举报提交失败，请稍后重试。',
      });
    },
    [pickReportReason]
  );

  const handleTogglePostLike = useCallback(async () => {
    if (!ensureLoggedIn({ message: '登录后才能点赞帖子' })) {
      return;
    }

    const nextLiked = !post.viewer?.isLiked;
    const result = await executeMutation({
      task: () => togglePostLike(post.id, nextLiked),
      loadingTitle: nextLiked ? '提交点赞' : '取消点赞',
      successMessage: nextLiked ? '已点赞帖子' : '已取消点赞',
      fallbackErrorMessage: '帖子点赞状态更新失败，请稍后重试。',
    });

    if (!result) {
      return;
    }

    setPost((current) => ({
      ...current,
      likes: result.likes,
      viewer: {
        isLiked: result.liked,
        isFavorited: current.viewer?.isFavorited ?? false,
      },
    }));
  }, [post.id, post.viewer?.isLiked, setPost]);

  const handleToggleFavorite = useCallback(async () => {
    if (!ensureLoggedIn({ message: '登录后才能收藏帖子' })) {
      return;
    }

    const nextFavorite = !post.viewer?.isFavorited;
    const result = await executeMutation({
      task: () => togglePostFavorite(post.id, { favorite: nextFavorite }),
      loadingTitle: nextFavorite ? '提交收藏' : '取消收藏',
      successMessage: nextFavorite ? '已收藏帖子' : '已取消收藏',
      fallbackErrorMessage: '帖子收藏状态更新失败，请稍后重试。',
    });

    if (!result) {
      return;
    }

    setPost((current) => ({
      ...current,
      viewer: {
        isLiked: current.viewer?.isLiked ?? false,
        isFavorited: result.favorite,
      },
    }));
  }, [post.id, post.viewer?.isFavorited, setPost]);

  const handleToggleCommentLike = useCallback(
    async (comment: PostCommentItem) => {
      if (!ensureLoggedIn({ message: '登录后才能点赞评论' })) {
        return;
      }

      const nextLiked = !comment.viewer.isLiked;
      const result = await executeMutation({
        task: () => toggleCommentLike(comment.id, nextLiked),
        loadingTitle: nextLiked ? '提交点赞' : '取消点赞',
        successMessage: nextLiked ? '已点赞评论' : '已取消点赞',
        fallbackErrorMessage: '评论点赞状态更新失败，请稍后重试。',
      });

      if (!result) {
        return;
      }

      setComments((current) =>
        updateCommentTree(current, comment.id, (item) => ({
          ...item,
          likes: result.likes,
          viewer: {
            isLiked: result.liked,
          },
        }))
      );
    },
    [setComments]
  );

  const handleReply = useCallback((comment: PostCommentItem) => {
    if (!ensureLoggedIn({ message: '登录后才能回复评论' })) {
      return;
    }

    setReplyTarget({
      parentCommentId: comment.parentCommentId ?? comment.id,
      replyToCommentId: comment.id,
      authorName: comment.authorName,
    });
  }, []);

  const handleSubmitComment = useCallback(async () => {
    const content = commentDraft.trim();

    if (!ensureLoggedIn({ message: '登录后才能发表评论' })) {
      return;
    }

    if (!content) {
      showPendingToast('先写一点评论内容再提交');
      return;
    }

    const payload: CommentPayload = {
      content,
      parentCommentId: replyTarget?.parentCommentId,
      replyToCommentId: replyTarget?.replyToCommentId,
    };

    const result = await executeMutation({
      task: () => createPostComment(post.id, payload),
      loadingTitle: replyTarget ? '发布回复' : '发布评论',
      successMessage: replyTarget ? '回复已发布' : '评论已发布',
      fallbackErrorMessage: replyTarget ? '回复发布失败，请稍后重试。' : '评论发布失败，请稍后重试。',
    });

    if (!result) {
      return;
    }

    setCommentDraft('');
    setReplyTarget(null);
    setPost((current) => ({
      ...current,
      comments: current.comments + 1,
    }));
    void loadComments();
  }, [commentDraft, loadComments, post.id, replyTarget, setPost]);

  const renderCommentCard = useCallback(
    (comment: PostCommentItem, nested = false) => (
      <View
        key={comment.id}
        id={`comment-${comment.id}`}
        className={`${nested ? 'post-comment-card__reply stack' : 'surface-card surface-card--compact stack'} ${
          comment.id === focusCommentId ? 'post-comment-card--highlight' : ''
        }`}
      >
        <View className='split-row'>
          <View className='menu-row__meta'>
            <View className='avatar avatar--small'>
              <Text>{comment.authorMark}</Text>
            </View>
            <View>
              <Text className='menu-row__title'>{comment.authorName}</Text>
              <Text className='menu-row__desc'>{comment.createdAt}</Text>
            </View>
          </View>
          <Text className='tag'>{comment.status}</Text>
        </View>

        {comment.id === focusCommentId ? (
          <Text className='post-comment-card__reply-target'>来自消息提醒</Text>
        ) : null}
        {comment.replyToAuthorName ? (
          <Text className='post-comment-card__reply-target'>回复 {comment.replyToAuthorName}</Text>
        ) : null}
        <Text className='detail-paragraph'>{renderCommentContent(comment)}</Text>

        <View className='post-comment-card__actions'>
          <View
            className='pill-button pill-button--ghost'
            onClick={() => void handleToggleCommentLike(comment)}
            hoverClass='pressable--hover'
          >
            <Text>{comment.viewer.isLiked ? `已点赞 ${comment.likes}` : `点赞 ${comment.likes}`}</Text>
          </View>
          <View
            className='pill-button pill-button--outline'
            onClick={() => handleReply(comment)}
            hoverClass='pressable--hover'
          >
            <Text>回复评论</Text>
          </View>
          <View
            className='pill-button pill-button--outline'
            onClick={() =>
              void handleReport({
                targetType: 'comment',
                targetId: comment.id,
              })
            }
            hoverClass='pressable--hover'
          >
            <Text>举报评论</Text>
          </View>
        </View>

        {comment.replies?.length ? (
          <View className='post-comment-card__thread'>
            {comment.replies.map((reply) => renderCommentCard(reply, true))}
          </View>
        ) : null}
      </View>
    ),
    [focusCommentId, handleReply, handleReport, handleToggleCommentLike]
  );

  if (postStatus === 'loading') {
    return (
      <View className='page-shell page-shell--detail'>
        <TopBar title='帖子详情' />
        <RequestStateCard
          mode='loading'
          title='正在加载帖子详情'
          description='正在同步正文、作者信息和关联内容。'
          className='section'
        />
      </View>
    );
  }

  if (postStatus === 'error') {
    return (
      <View className='page-shell page-shell--detail'>
        <TopBar title='帖子详情' />
        <RequestStateCard
          mode='error'
          title='帖子详情加载失败'
          description={postError}
          actionText='重新加载'
          onAction={() => void loadPost()}
          className='section'
        />
      </View>
    );
  }

  if (postStatus === 'auth_expired') {
    return (
      <View className='page-shell page-shell--detail'>
        <TopBar title='帖子详情' />
        <RequestStateCard
          mode='auth_expired'
          title='登录状态已失效'
          description='重新登录后可以继续同步帖子详情和你的互动状态。'
          actionText='重新登录'
          onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
          className='section'
        />
      </View>
    );
  }

  return (
    <View className='page-shell page-shell--detail'>
      <TopBar
        title='帖子详情'
        rightText='举报'
        onRightClick={() =>
          void handleReport({
            targetType: 'post',
            targetId: post.id,
          })
        }
      />

      <View className='surface-card stack'>
        <View className='menu-row__meta'>
          <View className='avatar'>
            <Text>{post.authorMark}</Text>
          </View>
          <View>
            <Text className='menu-row__title'>{post.authorName}</Text>
            <Text className='menu-row__desc'>
              {post.time} · {post.category}
            </Text>
          </View>
        </View>

        <Text className='page-title' style={{ fontSize: '40px' }}>
          {post.title}
        </Text>

        <View className='detail-summary'>
          <View className='detail-summary__cell'>
            <Text className='detail-summary__label'>点赞</Text>
            <Text className='detail-summary__value'>{post.likes}</Text>
          </View>
          <View className='detail-summary__cell'>
            <Text className='detail-summary__label'>评论</Text>
            <Text className='detail-summary__value'>{post.comments}</Text>
          </View>
          <View className='detail-summary__cell'>
            <Text className='detail-summary__label'>标签数</Text>
            <Text className='detail-summary__value'>{post.tags.length}</Text>
          </View>
        </View>

        <View className='tag-row'>
          {post.tags.map((tag) => (
            <Text key={tag} className='tag'>
              #{tag}
            </Text>
          ))}
        </View>

        <View className='post-detail__actions'>
          <View
            className='pill-button pill-button--ghost'
            onClick={() => void handleTogglePostLike()}
            hoverClass='pressable--hover'
          >
            <Text>{post.viewer?.isLiked ? '已点赞帖子' : '点赞帖子'}</Text>
          </View>
          <View
            className='pill-button pill-button--ghost'
            onClick={() => void handleToggleFavorite()}
            hoverClass='pressable--hover'
          >
            <Text>{post.viewer?.isFavorited ? '已收藏帖子' : '收藏帖子'}</Text>
          </View>
        </View>

        <View className='stack'>
          {post.content.map((paragraph) => (
            <Text key={paragraph} className='detail-paragraph'>
              {paragraph}
            </Text>
          ))}
        </View>
      </View>

      {relatedCompetition ? (
        <View
          className='surface-card section interactive-card'
          onClick={() => Taro.navigateTo({ url: buildCompetitionDetailRoute(relatedCompetition.id) })}
          hoverClass='pressable--hover'
        >
          <Text className='section-title__text' style={{ fontSize: '28px' }}>
            关联竞赛
          </Text>
          <Text className='menu-row__title' style={{ marginTop: '14px' }}>
            {relatedCompetition.title}
          </Text>
          <Text className='menu-row__desc'>
            {relatedCompetition.level} · 截止 {relatedCompetition.deadline}
          </Text>
        </View>
      ) : null}

      {relatedResource ? (
        <View
          className='surface-card section interactive-card'
          onClick={() => Taro.navigateTo({ url: buildResourceDetailRoute(relatedResource.id) })}
          hoverClass='pressable--hover'
        >
          <Text className='section-title__text' style={{ fontSize: '28px' }}>
            关联资源
          </Text>
          <Text className='menu-row__title' style={{ marginTop: '14px' }}>
            {relatedResource.title}
          </Text>
          <Text className='menu-row__desc'>
            {relatedResource.type} · {formatPrice(relatedResource.price)}
          </Text>
        </View>
      ) : null}

      <View className='surface-card section stack post-comment-composer'>
        <View className='split-row'>
          <Text className='section-title__text'>评论区</Text>
          <Text className='metric-text'>{post.comments} 条互动</Text>
        </View>

        {replyTarget ? (
          <View className='post-comment-composer__replying'>
            <Text className='metric-text'>正在回复 {replyTarget.authorName}</Text>
            <View
              className='pill-button pill-button--ghost'
              onClick={() => setReplyTarget(null)}
              hoverClass='pressable--hover'
            >
              <Text>取消回复</Text>
            </View>
          </View>
        ) : null}

        {loggedIn ? (
          <>
            <Textarea
              className='field-shell__textarea'
              value={commentDraft}
              maxlength={200}
              placeholder={replyTarget ? `回复 ${replyTarget.authorName}` : '写下你的经验、补充问题或建议'}
              onInput={(event) => setCommentDraft(event.detail.value)}
            />
            <View className='post-comment-composer__footer'>
              <Text className='metric-text'>{commentDraft.trim().length}/200</Text>
              <View
                className='pill-button pill-button--primary'
                onClick={() => void handleSubmitComment()}
                hoverClass='pressable--hover'
              >
                <Text>{replyTarget ? '发布回复' : '发布评论'}</Text>
              </View>
            </View>
          </>
        ) : (
          <EmptyState
            title='登录后再参与讨论'
            description='评论、回复、点赞和举报都会和账号关联，登录后再继续交流更稳。'
            actionText='去登录'
            onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
          />
        )}
      </View>

      <View className='section'>
        {commentsStatus === 'loading' ? (
          <RequestStateCard
            mode='loading'
            title='正在加载评论'
            description='正在同步最新评论、回复树和互动状态。'
          />
        ) : commentsStatus === 'error' ? (
          <RequestStateCard
            mode='error'
            title='评论加载失败'
            description={commentsError}
            actionText='重新加载'
            onAction={() => void loadComments()}
          />
        ) : commentsStatus === 'auth_expired' ? (
          <RequestStateCard
            mode='auth_expired'
            title='登录状态已失效'
            description='重新登录后可以继续查看评论区并同步你的点赞状态。'
            actionText='重新登录'
            onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
          />
        ) : comments.length === 0 ? (
          <EmptyState
            title='还没有评论'
            description='这篇帖子已经接入真实评论和回复接口，可以从你这条开始。'
          />
        ) : (
          <View className='stack'>{comments.map((item) => renderCommentCard(item))}</View>
        )}
      </View>

      <View className='bottom-bar'>
        <View
          className='bottom-bar__minor pill-button pill-button--ghost'
          onClick={() => void handleTogglePostLike()}
          hoverClass='pressable--hover'
        >
          <Text>{post.viewer?.isLiked ? '已点赞' : '点赞'}</Text>
        </View>
        <View
          className='bottom-bar__major pill-button pill-button--primary'
          onClick={() => void handleSubmitComment()}
          hoverClass='pressable--hover'
        >
          <Text>{replyTarget ? '发布回复' : '发表评论'}</Text>
        </View>
      </View>
    </View>
  );
}
