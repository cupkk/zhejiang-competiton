import { Link } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { StateCard } from '../components/StateCard';
import { routes } from '../lib/routes';

export function RefundResult() {
  return (
    <div className="min-h-full bg-gray-50 pb-8">
      <PageHeader title="状态记录" back />

      <div className="space-y-4 px-4">
        <StateCard
          mode="error"
          title="暂时没有可处理的记录"
          description="请返回资源页继续浏览内容。"
        />

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mt-4 flex gap-3">
            <Link to={routes.resources} className="inline-flex min-h-11 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">
              去资源大厅
            </Link>
            <Link to={routes.orders} className="inline-flex min-h-11 items-center rounded-lg bg-gray-100 px-4 text-sm font-semibold text-gray-700">
              返回记录
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
