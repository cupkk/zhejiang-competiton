import { Clock3 } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';

export function History() {
  return (
    <div className="min-h-full bg-slate-50 pb-8">
      <PageHeader title="浏览历史" back />
      <div className="space-y-4 px-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Clock3 size={20} />
            </div>
            <div>
              <div className="text-base font-semibold text-slate-900">暂无浏览记录</div>
              <p className="mt-1 text-sm leading-6 text-slate-500">浏览内容后会显示在这里。</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
