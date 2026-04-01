import type { AiConversationBootstrap, AiReplyResult, PostItem } from '../frontend/src/types/entities';
import type {
  AiBootstrapQuery,
  AiReplyPayload,
  FavoriteMutationResult,
  PostQuery,
  PublishPostPayload,
  SearchQuery,
  ToggleFavoritePayload,
} from '../frontend/src/types/api';
import {
  buildCurrentUser,
  createId,
  createModerationTask,
  getAll,
  getOne,
  isCommentLiked,
  isFavorited,
  isPostLiked,
  justNowLabel,
  mapComment,
  mapModerationTask,
  mapPost,
  nowIso,
  pushNotification,
  run,
} from './helpers.ts';
import type {
  CommentPayload,
  CommentMutationResult,
  CommentRow,
  LikeMutationResult,
  ModerationTaskQuery,
  ModerationTaskRow,
  PostCommentItem,
  PostRow,
  ReportPayload,
  ReportResult,
  ReportRow,
  ReviewModerationPayload,
  ReviewModerationResult,
} from './models.ts';

function getPostRow(id: string) {
  const post = getOne<PostRow>(
    `
      SELECT id, title, excerpt, content_json, category, author_user_id, author_name, author_mark,
             likes_count, comments_count, tags_json, time_label, related_competition_id, related_resource_id,
             moderation_status
      FROM posts
      WHERE id = @id
    `,
    { id }
  );

  if (!post) {
    throw new Error('post_not_found');
  }

  return post;
}

function getCommentRow(id: string) {
  const comment = getOne<CommentRow>(
    `
      SELECT id, post_id, user_id, parent_comment_id, reply_to_comment_id,
             author_name, author_mark, content, likes_count, moderation_status, created_at
      FROM comments
      WHERE id = @id
    `,
    { id }
  );

  if (!comment) {
    throw new Error('comment_not_found');
  }

  return comment;
}

function requireVisible<T extends { moderation_status: string }>(row: T, userId?: string, ownerId?: string | null) {
  if (row.moderation_status === 'approved') {
    return row;
  }

  if (userId && ownerId && userId === ownerId) {
    return row;
  }

  throw new Error('content_not_available');
}

function updatePostCommentCount(postId: string) {
  run(
    `
      UPDATE posts
      SET comments_count = (
        SELECT COUNT(*) FROM comments WHERE post_id = @postId AND moderation_status = 'approved'
      ),
      updated_at = @updatedAt
      WHERE id = @postId
    `,
    { postId, updatedAt: nowIso() }
  );
}

function updatePostLikeCount(postId: string) {
  run(
    `
      UPDATE posts
      SET likes_count = (
        SELECT COUNT(*) FROM post_likes WHERE post_id = @postId
      ),
      updated_at = @updatedAt
      WHERE id = @postId
    `,
    { postId, updatedAt: nowIso() }
  );
}

function updateCommentLikeCount(commentId: string) {
  run(
    `
      UPDATE comments
      SET likes_count = (
        SELECT COUNT(*) FROM comment_likes WHERE comment_id = @commentId
      ),
      updated_at = @updatedAt
      WHERE id = @commentId
    `,
    { commentId, updatedAt: nowIso() }
  );
}

function ensureReportTargetExists(payload: ReportPayload) {
  if (payload.targetType === 'post') {
    getPostRow(payload.targetId);
    return;
  }

  if (payload.targetType === 'comment') {
    getCommentRow(payload.targetId);
    return;
  }

  if (payload.targetType === 'team') {
    const row = getOne<{ id: string }>(`SELECT id FROM teams WHERE id = @id`, { id: payload.targetId });
    if (!row) {
      throw new Error('team_not_found');
    }
    return;
  }

  const resource = getOne<{ id: string }>(`SELECT id FROM resources WHERE id = @id`, { id: payload.targetId });
  if (!resource) {
    throw new Error('resource_not_found');
  }
}

function resolveCommentReplyContext(postId: string, payload: CommentPayload) {
  const content = payload.content.trim();
  if (!content) {
    throw new Error('comment_content_required');
  }

  const rawParent = payload.parentCommentId ? getCommentRow(payload.parentCommentId) : null;
  const rawReplyTo = payload.replyToCommentId ? getCommentRow(payload.replyToCommentId) : null;

  if (rawParent && rawParent.post_id !== postId) {
    throw new Error('comment_parent_invalid');
  }

  if (rawReplyTo && rawReplyTo.post_id !== postId) {
    throw new Error('comment_parent_invalid');
  }

  const parent = rawParent
    ? getCommentRow(rawParent.parent_comment_id || rawParent.id)
    : rawReplyTo
      ? getCommentRow(rawReplyTo.parent_comment_id || rawReplyTo.id)
      : null;

  if (parent && parent.post_id !== postId) {
    throw new Error('comment_parent_invalid');
  }

  if (rawReplyTo && parent && rawReplyTo.id !== parent.id && rawReplyTo.parent_comment_id !== parent.id) {
    throw new Error('comment_parent_invalid');
  }

  return {
    content,
    parentComment: parent,
    replyToComment: rawReplyTo ?? rawParent ?? parent,
  };
}

export function listFeaturedPosts(limit = 2, userId?: string) {
  return getAll<PostRow>(
    `
      SELECT id, title, excerpt, content_json, category, author_user_id, author_name, author_mark,
             likes_count, comments_count, tags_json, time_label, related_competition_id, related_resource_id,
             moderation_status
      FROM posts
      WHERE moderation_status = 'approved'
      ORDER BY likes_count DESC, created_at DESC
      LIMIT @limit
    `,
    { limit }
  ).map((row) => mapPost(row, userId));
}

export function listPosts(query: PostQuery = {}, userId?: string) {
  const category = query.category ?? '推荐';
  const rows = getAll<PostRow>(
    `
      SELECT id, title, excerpt, content_json, category, author_user_id, author_name, author_mark,
             likes_count, comments_count, tags_json, time_label, related_competition_id, related_resource_id,
             moderation_status
      FROM posts
      WHERE moderation_status = 'approved'
      ORDER BY created_at DESC
    `
  );

  return (category === '推荐' ? rows : rows.filter((item) => item.category === category)).map((row) =>
    mapPost(row, userId)
  );
}

export function getPostDetail(id: string, userId?: string) {
  const row = getPostRow(id);
  return mapPost(requireVisible(row, userId, row.author_user_id), userId);
}

export function patchPostFavorite(userId: string, id: string, payload: ToggleFavoritePayload): FavoriteMutationResult {
  getPostDetail(id, userId);
  const existing = getOne<{ id: string }>(
    `SELECT id FROM favorites WHERE user_id = @userId AND target_type = 'post' AND target_id = @targetId`,
    { userId, targetId: id }
  );

  if (payload.favorite && !existing) {
    run(
      `
        INSERT INTO favorites (id, user_id, target_type, target_id, created_at)
        VALUES (@id, @userId, 'post', @targetId, @createdAt)
      `,
      { id: createId('fav'), userId, targetId: id, createdAt: nowIso() }
    );
  }

  if (!payload.favorite && existing) {
    run(`DELETE FROM favorites WHERE id = @id`, { id: existing.id });
  }

  return {
    targetId: id,
    favorite: payload.favorite,
  };
}

export function createPost(userId: string, payload: PublishPostPayload) {
  const user = buildCurrentUser(userId);
  const id = createId('p');
  const content = payload.content
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  run(
    `
      INSERT INTO posts (
        id, title, excerpt, content_json, category, author_user_id, author_name, author_mark,
        likes_count, comments_count, tags_json, time_label, related_competition_id, related_resource_id,
        moderation_status, created_at, updated_at
      ) VALUES (
        @id, @title, @excerpt, @contentJson, @category, @authorUserId, @authorName, @authorMark,
        0, 0, @tagsJson, @timeLabel, NULL, NULL, 'approved', @createdAt, @updatedAt
      )
    `,
    {
      id,
      title: payload.title,
      excerpt: payload.content.slice(0, 72),
      contentJson: JSON.stringify(content),
      category: payload.category,
      authorUserId: userId,
      authorName: user.name,
      authorMark: user.mark,
      tagsJson: JSON.stringify(payload.tags),
      timeLabel: justNowLabel(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
  );

  createModerationTask('post', id, 'post_publish_review', '新发布帖子待审核');
  return getPostDetail(id, userId);
}

export function listPostComments(postId: string, userId?: string): PostCommentItem[] {
  getPostDetail(postId, userId);
  const rows = getAll<CommentRow>(
    `
      SELECT id, post_id, user_id, parent_comment_id, reply_to_comment_id,
             author_name, author_mark, content, likes_count, moderation_status, created_at
      FROM comments
      WHERE post_id = @postId AND moderation_status = 'approved'
      ORDER BY created_at ASC
    `,
    { postId }
  );

  const rowById = new Map(rows.map((row) => [row.id, row]));
  const commentById = new Map(
    rows.map((row) => [
      row.id,
      mapComment(row, isCommentLiked(userId, row.id), {
        replyToAuthorName: row.reply_to_comment_id ? rowById.get(row.reply_to_comment_id)?.author_name : undefined,
      }),
    ])
  );

  const roots: PostCommentItem[] = [];

  for (const row of rows) {
    const comment = commentById.get(row.id)!;
    if (row.parent_comment_id) {
      const parent = commentById.get(row.parent_comment_id);
      if (parent) {
        parent.replies = [...(parent.replies ?? []), comment];
        parent.replyCount = (parent.replyCount ?? 0) + 1;
        continue;
      }
    }

    roots.push(comment);
  }

  return roots.reverse();
}

export function createPostComment(userId: string, postId: string, payload: CommentPayload): CommentMutationResult {
  const post = getPostDetail(postId, userId);
  const user = buildCurrentUser(userId);
  const commentId = createId('comment');
  const replyContext = resolveCommentReplyContext(postId, payload);

  run(
    `
      INSERT INTO comments (
        id, post_id, user_id, parent_comment_id, reply_to_comment_id,
        author_name, author_mark, content, likes_count, moderation_status, created_at, updated_at
      ) VALUES (
        @id, @postId, @userId, @parentCommentId, @replyToCommentId,
        @authorName, @authorMark, @content, 0, 'approved', @createdAt, @updatedAt
      )
    `,
    {
      id: commentId,
      postId,
      userId,
      parentCommentId: replyContext.parentComment?.id || null,
      replyToCommentId: replyContext.replyToComment?.id || null,
      authorName: user.name,
      authorMark: user.mark,
      content: replyContext.content,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
  );

  updatePostCommentCount(postId);
  createModerationTask('comment', commentId, 'comment_review', '新评论进入审核队列');

  const postRow = getPostRow(postId);
  if (postRow.author_user_id && postRow.author_user_id !== userId) {
    pushNotification(postRow.author_user_id, {
      category: '系统',
      title: replyContext.parentComment ? '你的评论收到了回复' : '你的帖子有了新评论',
      content: replyContext.parentComment
        ? `${user.name} 回复了你在「${post.title}」下的评论。`
        : `${user.name} 评论了你发布的「${post.title}」。`,
      linkType: 'post',
      linkId: postId,
      linkScene: replyContext.parentComment ? 'comment_reply' : undefined,
      commentId,
      ctaText: '查看帖子',
    });
  }

  const replyTargetUserId =
    replyContext.replyToComment?.user_id &&
    replyContext.replyToComment.user_id !== userId &&
    replyContext.replyToComment.user_id !== postRow.author_user_id
      ? replyContext.replyToComment.user_id
      : null;

  if (replyTargetUserId) {
    pushNotification(replyTargetUserId, {
      category: '系统',
      title: '你收到了新的回复',
      content: `${user.name} 回复了你在「${post.title}」下的评论。`,
      linkType: 'post',
      linkId: postId,
      linkScene: 'comment_reply',
      commentId,
      ctaText: '查看回复',
    });
  }

  return {
    commentId,
    postId,
    parentCommentId: replyContext.parentComment?.id || undefined,
    replyToCommentId: replyContext.replyToComment?.id || undefined,
    status: 'approved',
  };
}

export function togglePostLike(userId: string, postId: string, liked: boolean): LikeMutationResult {
  getPostDetail(postId, userId);
  const existing = getOne<{ id: string }>(`SELECT id FROM post_likes WHERE user_id = @userId AND post_id = @postId`, {
    userId,
    postId,
  });

  if (liked && !existing) {
    run(
      `
        INSERT INTO post_likes (id, post_id, user_id, created_at)
        VALUES (@id, @postId, @userId, @createdAt)
      `,
      { id: createId('plike'), postId, userId, createdAt: nowIso() }
    );
  }

  if (!liked && existing) {
    run(`DELETE FROM post_likes WHERE id = @id`, { id: existing.id });
  }

  updatePostLikeCount(postId);
  const likes = getOne<{ likes_count: number }>(`SELECT likes_count FROM posts WHERE id = @postId`, { postId })?.likes_count ?? 0;
  return { targetId: postId, liked, likes };
}

export function toggleCommentLike(userId: string, commentId: string, liked: boolean): LikeMutationResult {
  getCommentRow(commentId);
  const existing = getOne<{ id: string }>(
    `SELECT id FROM comment_likes WHERE user_id = @userId AND comment_id = @commentId`,
    { userId, commentId }
  );

  if (liked && !existing) {
    run(
      `
        INSERT INTO comment_likes (id, comment_id, user_id, created_at)
        VALUES (@id, @commentId, @userId, @createdAt)
      `,
      { id: createId('clike'), commentId, userId, createdAt: nowIso() }
    );
  }

  if (!liked && existing) {
    run(`DELETE FROM comment_likes WHERE id = @id`, { id: existing.id });
  }

  updateCommentLikeCount(commentId);
  const likes =
    getOne<{ likes_count: number }>(`SELECT likes_count FROM comments WHERE id = @commentId`, { commentId })?.likes_count ??
    0;
  return { targetId: commentId, liked, likes };
}

export function createReport(userId: string, payload: ReportPayload): ReportResult {
  ensureReportTargetExists(payload);
  const reportId = createId('report');
  run(
    `
      INSERT INTO reports (
        id, reporter_user_id, target_type, target_id, reason, detail, status, created_at, updated_at
      ) VALUES (
        @id, @userId, @targetType, @targetId, @reason, @detail, 'pending', @createdAt, @updatedAt
      )
    `,
    {
      id: reportId,
      userId,
      targetType: payload.targetType,
      targetId: payload.targetId,
      reason: payload.reason,
      detail: payload.detail || null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
  );
  createModerationTask('report', reportId, 'report_review', `${payload.targetType} 举报待审核`);
  return { reportId, status: 'pending' };
}

export function listReports() {
  return getAll<ReportRow>(
    `
      SELECT id, reporter_user_id, target_type, target_id, reason, detail, status, created_at, updated_at
      FROM reports
      ORDER BY created_at DESC
    `
  );
}

export function listModerationTasks(query: ModerationTaskQuery = {}) {
  return getAll<ModerationTaskRow>(
    `
      SELECT id, target_type, target_id, action, status, note, created_at, reviewed_at
      FROM moderation_tasks
      WHERE (@status IS NULL OR status = @status)
        AND (@targetType IS NULL OR target_type = @targetType)
      ORDER BY created_at DESC
    `,
    {
      status: query.status || null,
      targetType: query.targetType || null,
    }
  ).map(mapModerationTask);
}

export function reviewModerationTask(taskId: string, payload: ReviewModerationPayload): ReviewModerationResult {
  const task = getOne<ModerationTaskRow>(
    `
      SELECT id, target_type, target_id, action, status, note, created_at, reviewed_at
      FROM moderation_tasks
      WHERE id = @taskId
    `,
    { taskId }
  );

  if (!task) {
    throw new Error('moderation_task_not_found');
  }

  if (task.target_type === 'post') {
    run(`UPDATE posts SET moderation_status = @status, updated_at = @updatedAt WHERE id = @targetId`, {
      status: payload.status === 'rejected' ? 'rejected' : 'approved',
      updatedAt: nowIso(),
      targetId: task.target_id,
    });
  }

  if (task.target_type === 'comment') {
    run(`UPDATE comments SET moderation_status = @status, updated_at = @updatedAt WHERE id = @targetId`, {
      status: payload.status === 'rejected' ? 'rejected' : 'approved',
      updatedAt: nowIso(),
      targetId: task.target_id,
    });
    const comment = getCommentRow(task.target_id);
    updatePostCommentCount(comment.post_id);
  }

  if (task.target_type === 'team') {
    run(`UPDATE teams SET moderation_status = @status, updated_at = @updatedAt WHERE id = @targetId`, {
      status: payload.status === 'rejected' ? 'rejected' : 'approved',
      updatedAt: nowIso(),
      targetId: task.target_id,
    });
  }

  if (task.target_type === 'report') {
    run(`UPDATE reports SET status = @status, updated_at = @updatedAt WHERE id = @targetId`, {
      status:
        payload.status === 'approved' ? 'resolved' : payload.status === 'rejected' ? 'rejected' : 'processing',
      updatedAt: nowIso(),
      targetId: task.target_id,
    });
  }

  run(
    `
      UPDATE moderation_tasks
      SET status = @status, note = @note, reviewed_at = @reviewedAt
      WHERE id = @taskId
    `,
    {
      status: payload.status,
      note: payload.note || null,
      reviewedAt: nowIso(),
      taskId,
    }
  );

  return { taskId, status: payload.status };
}

export function getAiBootstrap(query: AiBootstrapQuery = {}): AiConversationBootstrap {
  if (query.source === 'competition' && query.id) {
    return {
      source: 'competition',
      targetTitle: query.id,
      openingMessage: '告诉我你的年级、专业和当前准备阶段，我会从方向选择、资料准备和组队策略三方面给出建议。',
    };
  }

  if (query.source === 'resource' && query.id) {
    return {
      source: 'resource',
      targetTitle: query.id,
      openingMessage: '告诉我你现在的目标和时间预算，我会帮你判断这份资源应该现在用，还是稍后再投入。',
    };
  }

  return {
    source: 'general',
    openingMessage: '告诉我你的目标、年级和专业，我会帮你判断接下来优先做竞赛、资源准备还是组队。',
  };
}

export function replyAi(_payload: AiReplyPayload): AiReplyResult {
  return {
    reply: '先聚焦一个最近两周能推进的目标，再围绕它补资源、找队友、做交付。不要同时铺太多线。',
  };
}
