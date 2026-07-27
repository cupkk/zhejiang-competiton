import { useNavigate } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { StateCard } from '../components/StateCard';
import { routes } from '../lib/routes';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-full bg-[#f6f7f9] pb-8">
      <PageHeader title="页面不存在" back fallbackTo={routes.home} />
      <div className="px-4">
        <StateCard
          mode="empty"
          title="没有找到这个页面"
          description="链接可能已经失效。"
          actionText="返回首页"
          onAction={() => navigate(routes.home, { replace: true })}
        />
      </div>
    </div>
  );
}
