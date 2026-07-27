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
  getRequiredVerifiedSchoolId,
  getAll,
  getContentSchoolInfo,
  getOne,
  isLikelyCorruptText,
  isCommentLiked,
  isFavorited,
  isPostLiked,
  isContentAccessible,
  justNowLabel,
  mapComment,
  mapModerationTask,
  mapPost,
  nowIso,
  pushNotification,
  run,
  requireContentAccessible,
} from './helpers.ts';
import type {
  CommentPayload,
  CommentMutationResult,
  CommentRow,
  LikeMutationResult,
  AdminContentScope,
  ModerationTaskQuery,
  ModerationTaskRow,
  PostCommentItem,
  PostRow,
  ReportPayload,
  ReportQuery,
  ReportResult,
  ReportRow,
  ReviewModerationPayload,
  ReviewModerationResult,
} from './models.ts';

const publicPostCategories = new Set(['资讯', '经验贴', '问答', '避坑']);

function getPostRow(id: string) {
  const post = getOne<PostRow>(
    `
      SELECT id, title, excerpt, content_json, category, author_user_id, author_name, author_mark,
             likes_count, comments_count, tags_json, time_label, related_competition_id, related_resource_id,
             question_status, accepted_comment_id, school_id, content_scope, moderation_status
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

function requireSchoolVisible<T extends { content_scope?: string | null; school_id?: string | null }>(
  row: T,
  userId?: string,
  _ownerId?: string | null
) {
  return requireContentAccessible(row, userId);
}

function isInCurrentSchoolScope(
  row: { content_scope?: string | null; school_id?: string | null },
  userId?: string,
  _ownerId?: string | null
) {
  return isContentAccessible(row, userId);
}

function getRequiredActiveSchoolId(userId: string) {
  return getRequiredVerifiedSchoolId(userId);
}

function isPostPublicInCurrentCommercialPhase(row: PostRow, userId?: string) {
  if (publicPostCategories.has(row.category)) {
    return true;
  }

  return Boolean(userId && row.author_user_id === userId);
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

function ensureReportTargetExists(userId: string, payload: ReportPayload) {
  if (payload.targetType === 'post') {
    getPostDetail(payload.targetId, userId);
    return;
  }

  if (payload.targetType === 'comment') {
    const comment = getCommentRow(payload.targetId);
    getPostDetail(comment.post_id, userId);
    return;
  }

  if (payload.targetType === 'team') {
    const row = getOne<{ id: string; school_id: string | null; content_scope: string; moderation_status: string }>(
      `SELECT id, school_id, content_scope, moderation_status FROM teams WHERE id = @id`,
      { id: payload.targetId }
    );
    if (!row) {
      throw new Error('team_not_found');
    }
    requireSchoolVisible(requireVisible(row, userId), userId);
    return;
  }

  const resource = getOne<{ id: string; school_id: string | null; content_scope: string; moderation_status: string }>(
    `SELECT id, school_id, content_scope, moderation_status FROM resources WHERE id = @id`,
    { id: payload.targetId }
  );
  if (!resource) {
    throw new Error('resource_not_found');
  }
  requireSchoolVisible(requireVisible(resource, userId), userId);
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
             question_status, accepted_comment_id, school_id, content_scope, moderation_status
      FROM posts
      WHERE moderation_status = 'approved'
      ORDER BY likes_count DESC, created_at DESC
      LIMIT @limit
    `,
    { limit }
  )
    .filter((row) => isInCurrentSchoolScope(row, userId, row.author_user_id))
    .filter((row) => isPostPublicInCurrentCommercialPhase(row, userId))
    .map((row) => mapPost(row, userId));
}

export function listPosts(query: PostQuery = {}, userId?: string) {
  const category = query.category ?? '推荐';
  const keyword = query.keyword?.trim();
  const relatedCompetitionId = query.relatedCompetitionId?.trim();
  const questionFilter = query.questionFilter ?? 'latest';
  const rows = getAll<PostRow>(
    `
      SELECT id, title, excerpt, content_json, category, author_user_id, author_name, author_mark,
             likes_count, comments_count, tags_json, time_label, related_competition_id, related_resource_id,
             question_status, accepted_comment_id, school_id, content_scope, moderation_status
      FROM posts
      WHERE moderation_status = 'approved'
        AND (CAST(@relatedCompetitionId AS TEXT) IS NULL OR related_competition_id = CAST(@relatedCompetitionId AS TEXT))
        AND (
          @questionFilter <> 'unanswered'
          OR (category = '问答' AND question_status = 'open' AND comments_count = 0)
        )
        AND (
          @questionFilter <> 'resolved'
          OR (category = '问答' AND question_status = 'resolved')
        )
        AND (
          @keyword = ''
          OR title LIKE @search
          OR excerpt LIKE @search
          OR content_json LIKE @search
          OR tags_json LIKE @search
        )
      ORDER BY created_at DESC
    `,
    {
      keyword: keyword || '',
      search: `%${keyword || ''}%`,
      relatedCompetitionId: relatedCompetitionId || null,
      questionFilter,
    }
  );

  return (category === '推荐' ? rows : rows.filter((item) => item.category === category))
    .filter((row) => isInCurrentSchoolScope(row, userId, row.author_user_id))
    .filter((row) => isPostPublicInCurrentCommercialPhase(row, userId))
    .map((row) => mapPost(row, userId));
}

export function getPostDetail(id: string, userId?: string) {
  const row = getPostRow(id);
  if (!isPostPublicInCurrentCommercialPhase(row, userId)) {
    throw new Error('content_not_available');
  }
  return mapPost(requireSchoolVisible(requireVisible(row, userId, row.author_user_id), userId, row.author_user_id), userId);
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
  const title = payload.title.trim();
  const rawContent = payload.content.trim();
  if (!title || !rawContent) {
    throw new Error('post_content_required');
  }

  const user = buildCurrentUser(userId);
  const schoolId = getRequiredActiveSchoolId(userId);
  if (payload.relatedCompetitionId) {
    const competition = getOne<{ id: string; school_id: string | null }>(
      `SELECT id, school_id, content_scope FROM competitions WHERE id = @competitionId`,
      { competitionId: payload.relatedCompetitionId }
    );
    if (!competition) throw new Error('competition_not_found');
    requireSchoolVisible(competition, userId);
  }
  const id = createId('p');
  const content = rawContent
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  run(
    `
      INSERT INTO posts (
        id, school_id, content_scope, title, excerpt, content_json, category, author_user_id, author_name, author_mark,
        likes_count, comments_count, tags_json, time_label, related_competition_id, related_resource_id,
        question_status, accepted_comment_id, moderation_status, created_at, updated_at
      ) VALUES (
        @id, @schoolId, 'school', @title, @excerpt, @contentJson, @category, @authorUserId, @authorName, @authorMark,
        0, 0, @tagsJson, @timeLabel, @relatedCompetitionId, NULL, 'open', NULL, 'pending', @createdAt, @updatedAt
      )
    `,
    {
      id,
      schoolId,
      title,
      excerpt: rawContent.slice(0, 72),
      contentJson: JSON.stringify(content),
      category: publicPostCategories.has(payload.category) ? payload.category : '经验贴',
      authorUserId: userId,
      authorName: user.name,
      authorMark: user.mark,
      tagsJson: JSON.stringify(payload.tags),
      relatedCompetitionId: payload.relatedCompetitionId || null,
      timeLabel: justNowLabel(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
  );

  createModerationTask('post', id, 'post_publish_review', '新发布帖子待审核');
  return getPostDetail(id, userId);
}

export function listPostComments(postId: string, userId?: string): PostCommentItem[] {
  const post = getPostDetail(postId, userId);
  const rows = getAll<CommentRow>(
    `
      SELECT id, post_id, user_id, parent_comment_id, reply_to_comment_id,
             author_name, author_mark, content, likes_count, moderation_status, created_at
      FROM comments
      WHERE post_id = @postId AND moderation_status = 'approved'
      ORDER BY created_at ASC
    `,
    { postId }
  ).filter((row) => !isLikelyCorruptText(row.content));

  const rowById = new Map(rows.map((row) => [row.id, row]));
  const commentById = new Map(
    rows.map((row) => [
      row.id,
      mapComment(row, isCommentLiked(userId, row.id), {
        replyToAuthorName: row.reply_to_comment_id ? rowById.get(row.reply_to_comment_id)?.author_name : undefined,
        isAccepted: post.acceptedCommentId === row.id,
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

  for (const root of roots) {
    root.replies?.sort((left, right) => Number(Boolean(right.isAccepted)) - Number(Boolean(left.isAccepted)));
  }
  return roots.reverse().sort((left, right) => Number(Boolean(right.isAccepted)) - Number(Boolean(left.isAccepted)));
}

export function acceptPostAnswer(userId: string, postId: string, commentId: string) {
  const postRow = getPostRow(postId);
  requireSchoolVisible(requireVisible(postRow, userId, postRow.author_user_id), userId, postRow.author_user_id);
  if (postRow.author_user_id !== userId) throw new Error('post_answer_forbidden');
  if (postRow.category !== '问答') throw new Error('post_not_question');

  const comment = getCommentRow(commentId);
  if (comment.post_id !== postId || comment.moderation_status !== 'approved') {
    throw new Error('post_answer_invalid');
  }

  run(
    `
      UPDATE posts
      SET question_status = 'resolved', accepted_comment_id = @commentId, updated_at = @updatedAt
      WHERE id = @postId
    `,
    { postId, commentId, updatedAt: nowIso() }
  );

  if (comment.user_id !== userId) {
    pushNotification(comment.user_id, {
      category: '系统',
      title: '你的回答已被采纳',
      content: `你在「${postRow.title}」下的回答已被发帖人采纳。`,
      linkType: 'post',
      linkId: postId,
      commentId,
      ctaText: '查看问答',
    });
  }

  return getPostDetail(postId, userId);
}

export function createPostComment(userId: string, postId: string, payload: CommentPayload): CommentMutationResult {
  getRequiredActiveSchoolId(userId);
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
        @authorName, @authorMark, @content, 0, 'pending', @createdAt, @updatedAt
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
    status: 'pending',
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
  const comment = getCommentRow(commentId);
  getPostDetail(comment.post_id, userId);
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
  ensureReportTargetExists(userId, payload);
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

function getEffectiveAdminSchoolId(scope?: AdminContentScope, requestedSchoolId?: string) {
  if (scope?.role === 'school_admin') {
    return scope.schoolId || '__no_school_scope__';
  }

  const value = requestedSchoolId?.trim();
  return value && value !== 'all' ? value : '';
}

function isAdminSchoolVisible(schoolId: string | undefined, scope?: AdminContentScope, requestedSchoolId?: string) {
  const effectiveSchoolId = getEffectiveAdminSchoolId(scope, requestedSchoolId);
  return !effectiveSchoolId || schoolId === effectiveSchoolId;
}

export function listReports(query: ReportQuery = {}, scope?: AdminContentScope) {
  return getAll<ReportRow>(
    `
      SELECT id, reporter_user_id, target_type, target_id, reason, detail, status, created_at, updated_at
      FROM reports
      ORDER BY created_at DESC
    `
  )
    .map((row) => {
      const school = getContentSchoolInfo(row.target_type, row.target_id);
      return {
        ...row,
        school_id: school.schoolId,
        school_name: school.schoolName,
      };
    })
    .filter((row) => isAdminSchoolVisible(row.school_id, scope, query.schoolId));
}

export function listModerationTasks(query: ModerationTaskQuery = {}, scope?: AdminContentScope) {
  return getAll<ModerationTaskRow>(
    `
      SELECT id, target_type, target_id, action, status, note, created_at, reviewed_at
      FROM moderation_tasks
      WHERE (CAST(@status AS TEXT) IS NULL OR status = CAST(@status AS TEXT))
        AND (CAST(@targetType AS TEXT) IS NULL OR target_type = CAST(@targetType AS TEXT))
      ORDER BY created_at DESC
    `,
    {
      status: query.status || null,
      targetType: query.targetType || null,
    }
  )
    .map(mapModerationTask)
    .filter((item) => isAdminSchoolVisible(item.schoolId, scope, query.schoolId));
}

export function reviewModerationTask(
  taskId: string,
  payload: ReviewModerationPayload,
  scope?: AdminContentScope
): ReviewModerationResult {
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

  const taskSchool = getContentSchoolInfo(task.target_type, task.target_id);
  if (!isAdminSchoolVisible(taskSchool.schoolId, scope)) {
    throw new Error('admin_scope_forbidden');
  }

  const nextContentStatus = payload.status === 'approved' || payload.status === 'rejected' ? payload.status : null;

  if (task.target_type === 'post' && nextContentStatus) {
    const post = getOne<{ author_user_id: string | null; title: string }>(
      `
        SELECT author_user_id, title
        FROM posts
        WHERE id = @targetId
      `,
      { targetId: task.target_id }
    );

    run(`UPDATE posts SET moderation_status = @status, updated_at = @updatedAt WHERE id = @targetId`, {
      status: nextContentStatus,
      updatedAt: nowIso(),
      targetId: task.target_id,
    });

    if (post?.author_user_id) {
      pushNotification(post.author_user_id, {
        category: '审核',
        title: payload.status === 'approved' ? '帖子审核已通过' : '帖子审核未通过',
        content:
          payload.status === 'approved'
            ? `你发布的「${post.title}」已公开显示。`
            : `你发布的「${post.title}」未通过审核，请调整后重新提交。`,
        linkType: 'post',
        linkId: task.target_id,
        ctaText: '查看帖子',
      });
    }
  }

  if (task.target_type === 'comment' && nextContentStatus) {
    run(`UPDATE comments SET moderation_status = @status, updated_at = @updatedAt WHERE id = @targetId`, {
      status: nextContentStatus,
      updatedAt: nowIso(),
      targetId: task.target_id,
    });
    const comment = getCommentRow(task.target_id);
    updatePostCommentCount(comment.post_id);
    const post = getOne<{ title: string }>(`SELECT title FROM posts WHERE id = @postId`, { postId: comment.post_id });
    pushNotification(comment.user_id, {
      category: '审核',
      title: payload.status === 'approved' ? '评论审核已通过' : '评论审核未通过',
      content:
        payload.status === 'approved'
          ? `你在「${post?.title || '帖子'}」下的评论已公开显示。`
          : `你在「${post?.title || '帖子'}」下的评论未通过审核。`,
      linkType: 'post',
      linkId: comment.post_id,
      commentId: comment.id,
      ctaText: '查看帖子',
    });
  }

  if (task.target_type === 'team' && nextContentStatus) {
    const team = getOne<{ author_user_id: string | null; title: string }>(
      `
        SELECT author_user_id, title
        FROM teams
        WHERE id = @targetId
      `,
      { targetId: task.target_id }
    );

    run(`UPDATE teams SET moderation_status = @status, updated_at = @updatedAt WHERE id = @targetId`, {
      status: nextContentStatus,
      updatedAt: nowIso(),
      targetId: task.target_id,
    });

    if (team?.author_user_id) {
      pushNotification(team.author_user_id, {
        category: '审核',
        title: payload.status === 'approved' ? '组队招募已通过' : '组队招募未通过',
        content:
          payload.status === 'approved'
            ? `你发布的「${team.title}」已出现在组队大厅。`
            : `你发布的「${team.title}」未通过审核，请调整后重新提交。`,
        linkType: 'team',
        linkId: task.target_id,
        ctaText: '查看队伍',
      });
    }
  }

  if (task.target_type === 'resource' && nextContentStatus) {
    const resource = getOne<{ author_user_id: string | null; title: string }>(
      `
        SELECT author_user_id, title
        FROM resources
        WHERE id = @targetId
      `,
      { targetId: task.target_id }
    );

    run(
      `
        UPDATE resources
        SET moderation_status = @status,
            review_note = @reviewNote,
            updated_at = @updatedAt
        WHERE id = @targetId
      `,
      {
        status: nextContentStatus,
        reviewNote: payload.note || null,
        updatedAt: nowIso(),
        targetId: task.target_id,
      }
    );

    if (resource?.author_user_id) {
      pushNotification(resource.author_user_id, {
        category: '审核',
        title: payload.status === 'approved' ? '资源审核已通过' : '资源审核未通过',
        content:
          payload.status === 'approved'
            ? `资源《${resource.title}》已审核通过，现在会出现在资源列表中。`
            : `资源《${resource.title}》未通过审核，请根据审核说明调整后重新投稿。`,
        linkType: 'resource',
        linkId: task.target_id,
        ctaText: '查看资源',
      });
    }
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
