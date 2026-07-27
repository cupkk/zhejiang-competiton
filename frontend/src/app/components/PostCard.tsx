import { Bookmark, Heart, MessageCircle } from 'lucide-react';
import { Link } from 'react-router';
import type { PostItem } from '../../types/entities';
import { displayPostCategory, displayPublicText, formatCount } from '../lib/format';
import { buildPostDetailRoute } from '../lib/routes';

export function PostCard({ post }: { post: PostItem }) {
  const questionLabel =
    post.category !== '问答' ? '' : post.questionStatus === 'resolved' ? '已解决' : post.comments === 0 ? '待回答' : '讨论中';
  return (
    <Link
      to={buildPostDetailRoute(post.id)}
      className="block rounded-lg border border-slate-200 bg-white p-4 transition-colors active:bg-slate-50"
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span className="rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
          {displayPostCategory(post.category)}
        </span>
        <span className="text-[11px] font-medium text-slate-400">{post.time}</span>
        {questionLabel ? (
          <span className={`ml-auto rounded px-2 py-1 text-[10px] font-semibold ${post.questionStatus === 'resolved' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-600'}`}>
            {questionLabel}
          </span>
        ) : null}
        {post.viewer?.isFavorited ? (
          <span className={`${questionLabel ? '' : 'ml-auto'} inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-600`}>
            <Bookmark size={12} /> 已收藏
          </span>
        ) : null}
      </div>

      <h3 className="text-[15px] font-semibold leading-6 text-slate-900">{displayPublicText(post.title)}</h3>
      <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-slate-500">{displayPublicText(post.excerpt)}</p>

      {post.tags.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {post.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">
              {displayPublicText(tag)}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-5 border-t border-slate-100 pt-3 text-[12px] font-semibold text-slate-400">
        <span className="flex items-center gap-1.5">
          <Heart size={15} className={post.viewer?.isLiked ? 'fill-blue-600 text-blue-600' : ''} />
          {formatCount(post.likes)}
        </span>
        <span className="flex items-center gap-1.5">
          <MessageCircle size={15} />
          {formatCount(post.comments)}
        </span>
      </div>
    </Link>
  );
}
