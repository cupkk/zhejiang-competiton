import { Text, View } from '@tarojs/components';
import type { PostItem } from '../types/entities';

interface PostCardProps {
  post: PostItem;
  onClick?: () => void;
  onLike?: () => void;
  onFavorite?: () => void;
  likeLoading?: boolean;
  favoriteLoading?: boolean;
}

export function PostCard({
  post,
  onClick,
  onLike,
  onFavorite,
  likeLoading = false,
  favoriteLoading = false,
}: PostCardProps) {
  const handleLikeClick = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    if (!likeLoading) {
      onLike?.();
    }
  };

  const handleFavoriteClick = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    if (!favoriteLoading) {
      onFavorite?.();
    }
  };

  return (
    <View className='post-card interactive-card' onClick={onClick} hoverClass='pressable--hover'>
      <View className='post-card__body'>
        <View className='menu-row__meta'>
          <View className='avatar avatar--small'>
            <Text>{post.authorMark}</Text>
          </View>
          <View>
            <Text className='menu-row__title'>{post.authorName}</Text>
            <Text className='menu-row__desc'>{post.time}</Text>
          </View>
        </View>
        <Text className='post-card__title' style={{ marginTop: '18px' }}>
          {post.title}
        </Text>
        <Text className='detail-paragraph' style={{ marginTop: '12px', fontSize: '22px' }}>
          {post.excerpt}
        </Text>
        <View className='tag-row' style={{ marginTop: '16px' }}>
          {post.tags.map((tag) => (
            <Text key={tag} className='tag'>
              #{tag}
            </Text>
          ))}
        </View>

        <View className='post-card__footer'>
          <View className='split-row post-card__metrics'>
            <Text className={`metric-text ${post.viewer?.isLiked ? 'metric-text--active' : ''}`}>
              {post.viewer?.isLiked ? `已点赞 ${post.likes}` : `点赞 ${post.likes}`}
            </Text>
            <Text className='metric-text'>评论 {post.comments}</Text>
            <Text className={`metric-text ${post.viewer?.isFavorited ? 'metric-text--active' : ''}`}>
              {post.viewer?.isFavorited ? '已收藏' : '未收藏'}
            </Text>
          </View>

          {onLike || onFavorite ? (
            <View className='post-card__actions'>
              {onFavorite ? (
                <View
                  className={`pill-button ${post.viewer?.isFavorited ? 'pill-button--outline' : 'pill-button--ghost'} post-card__action`}
                  onClick={handleFavoriteClick}
                  hoverClass='pressable--hover'
                >
                  <Text>
                    {favoriteLoading
                      ? '处理中...'
                      : post.viewer?.isFavorited
                        ? '取消收藏'
                        : '收藏帖子'}
                  </Text>
                </View>
              ) : null}

              {onLike ? (
                <View
                  className={`pill-button ${post.viewer?.isLiked ? 'pill-button--primary' : 'pill-button--ghost'} post-card__action`}
                  onClick={handleLikeClick}
                  hoverClass='pressable--hover'
                >
                  <Text>{likeLoading ? '处理中...' : post.viewer?.isLiked ? '取消点赞' : '点赞帖子'}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
