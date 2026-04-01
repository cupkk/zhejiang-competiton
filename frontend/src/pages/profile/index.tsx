import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { AuthStatusCard } from '../../components/AuthStatusCard';
import { getRuntimeModeLabel } from '../../config/runtime';
import { PAGE_ROUTES, buildTeamsRoute } from '../../constants/routes';
import { useSessionUser } from '../../hooks/useSessionUser';
import { logout } from '../../services/app-service';
import { showSuccessToast } from '../../utils/feedback';
import { pageTopInset } from '../../utils/layout';

const profileMenus = [
  {
    mark: '藏',
    title: '我的收藏',
    desc: '集中查看收藏过的竞赛、资源和社区帖子，形成后续跟进闭环。',
    path: PAGE_ROUTES.favorites,
  },
  {
    mark: '队',
    title: '我的组队',
    desc: '查看我发起的招募、已加入队伍和组队状态变化。',
    path: buildTeamsRoute({ mine: true }),
  },
  {
    mark: '资',
    title: '我的资源',
    desc: '查看已获取的资源、下载记录和资料入口。',
    path: PAGE_ROUTES.myResources,
  },
  {
    mark: '单',
    title: '我的订单',
    desc: '资源与服务购买记录，后续直接对接真实支付状态。',
    path: PAGE_ROUTES.orders,
  },
  {
    mark: '帖',
    title: '发布帖子',
    desc: '围绕经验、问答和避坑内容发帖，沉淀社区内容。',
    path: PAGE_ROUTES.publishPost,
  },
  {
    mark: '招',
    title: '发布组队',
    desc: '发起围绕竞赛或成长目标的团队招募。',
    path: PAGE_ROUTES.publishTeam,
  },
  {
    mark: '信',
    title: '消息中心',
    desc: '审核、订单、组队和活动提醒。',
    path: PAGE_ROUTES.messages,
  },
];

export default function ProfilePage() {
  const { user, loggedIn, setUser } = useSessionUser();

  const openProfileArea = (path: string) => {
    if (!loggedIn) {
      Taro.navigateTo({ url: PAGE_ROUTES.login });
      return;
    }

    Taro.navigateTo({ url: path });
  };

  return (
    <View className='page-shell' style={{ paddingTop: `${pageTopInset}px` }}>
      {user ? (
        <View className='surface-card profile-hero'>
          <View className='split-row'>
            <View className='menu-row__meta'>
              <View className='avatar'>
                <Text>{user.mark}</Text>
              </View>
              <View>
                <Text className='page-title' style={{ fontSize: '38px' }}>
                  {user.name}
                </Text>
                <Text className='page-subtitle' style={{ marginTop: '6px' }}>
                  {user.school} · {user.major} · {user.grade}
                </Text>
              </View>
            </View>
            <View className='profile-hero__badge'>
              <Text>{getRuntimeModeLabel()}</Text>
            </View>
          </View>

          <Text className='detail-paragraph' style={{ marginTop: '18px', fontSize: '22px' }}>
            {user.bio}
          </Text>

          <View className='tag-row' style={{ marginTop: '18px' }}>
            {user.focusTags.map((tag) => (
              <Text key={tag} className='tag tag--strong'>
                {tag}
              </Text>
            ))}
          </View>
        </View>
      ) : (
        <AuthStatusCard
          loggedIn={false}
          guestTitle='先登录，再把个人成长链路跑起来'
          guestDescription='登录后才能查看我的收藏、资源、订单、组队和消息，并开始承接真实微信身份。'
          authedTitle=''
          authedDescription=''
          guestActionText='去登录'
          authedActionText=''
          onGuestAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
          onAuthedAction={() => undefined}
        />
      )}

      <View className='surface-card section'>
        {user ? (
          <View className='stats-grid'>
            <View
              className='stats-grid__cell'
              onClick={() => openProfileArea(PAGE_ROUTES.favorites)}
              hoverClass='pressable--hover'
            >
              <Text className='stats-grid__value'>{user.stats.favorites}</Text>
              <Text className='stats-grid__label'>收藏</Text>
            </View>
            <View className='stats-grid__cell'>
              <Text className='stats-grid__value'>{user.stats.teams}</Text>
              <Text className='stats-grid__label'>组队</Text>
            </View>
            <View className='stats-grid__cell'>
              <Text className='stats-grid__value'>{user.stats.resources}</Text>
              <Text className='stats-grid__label'>资源</Text>
            </View>
            <View
              className='stats-grid__cell'
              onClick={() => openProfileArea(PAGE_ROUTES.messages)}
              hoverClass='pressable--hover'
            >
              <Text className='stats-grid__value'>{user.stats.unreadMessages}</Text>
              <Text className='stats-grid__label'>未读消息</Text>
            </View>
          </View>
        ) : (
          <View className='stack'>
            <Text className='section-title__text' style={{ fontSize: '28px' }}>
              登录后解锁个人工作台
            </Text>
            <View className='stats-grid'>
              <View className='stats-grid__cell'>
                <Text className='stats-grid__value'>--</Text>
                <Text className='stats-grid__label'>收藏沉淀</Text>
              </View>
              <View className='stats-grid__cell'>
                <Text className='stats-grid__value'>--</Text>
                <Text className='stats-grid__label'>组队进度</Text>
              </View>
              <View className='stats-grid__cell'>
                <Text className='stats-grid__value'>--</Text>
                <Text className='stats-grid__label'>资源资产</Text>
              </View>
              <View className='stats-grid__cell'>
                <Text className='stats-grid__value'>--</Text>
                <Text className='stats-grid__label'>站内提醒</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      <View className='stack section'>
        {profileMenus.map((item) => (
          <View
            key={item.title}
            className='profile-menu__item interactive-card'
            onClick={() => openProfileArea(item.path)}
            hoverClass='pressable--hover'
          >
            <View className='team-card__body'>
              <View className='menu-row'>
                <View className='menu-row__meta'>
                  <View className='menu-row__mark'>
                    <Text>{item.mark}</Text>
                  </View>
                  <View>
                    <Text className='menu-row__title'>{item.title}</Text>
                    <Text className='menu-row__desc'>{item.desc}</Text>
                  </View>
                </View>
                <Text className='metric-text metric-text--strong'>
                  {loggedIn ? '进入' : '登录解锁'}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      {user ? (
        <View
          className='pill-button pill-button--ghost section'
          onClick={() => {
            logout();
            setUser(null);
            showSuccessToast('已退出登录');
          }}
          hoverClass='pressable--hover'
        >
          <Text>退出登录</Text>
        </View>
      ) : null}
    </View>
  );
}
