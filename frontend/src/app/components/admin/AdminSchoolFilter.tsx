import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { School } from '../../../types/entities';
import { useAdminSession } from '../../hooks/useAdminSession';
import { fetchSchoolList } from '../../lib/app-service';
import { AdminPanel, cx } from './AdminUi';

interface AdminSchoolFilterProps {
  value: string;
  onChange: (schoolId: string) => void;
  className?: string;
}

export function AdminSchoolFilter({ value, onChange, className }: AdminSchoolFilterProps) {
  const { admin } = useAdminSession();
  const [keyword, setKeyword] = useState('');
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(false);
  const isSchoolScoped = admin?.scope === 'school';

  useEffect(() => {
    if (isSchoolScoped && admin?.schoolId && value !== admin.schoolId) {
      onChange(admin.schoolId);
    }
  }, [admin?.schoolId, isSchoolScoped, onChange, value]);

  useEffect(() => {
    if (isSchoolScoped) {
      return;
    }

    let alive = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      fetchSchoolList({ keyword: keyword.trim() || undefined, limit: 24 })
        .then((items) => {
          if (alive) setSchools(items);
        })
        .catch(() => {
          if (alive) setSchools([]);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 180);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [isSchoolScoped, keyword]);

  return (
    <div className={cx('px-5', className)}>
      <AdminPanel>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">学校范围</div>
            <div className="mt-1 text-xs text-slate-500">
              {isSchoolScoped ? '当前账号仅处理本校内容' : '平台管理员可按学校查看审核队列'}
            </div>
          </div>

          {isSchoolScoped ? (
            <div className="inline-flex min-h-11 items-center rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white">
              {admin?.schoolName || '本校'}
            </div>
          ) : (
            <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(13rem,18rem)_12rem]">
              <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100/70">
                <Search size={16} className="shrink-0 text-slate-400" />
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="搜索学校"
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
              </label>
              <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
              >
                <option value="all">全部学校</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
              <div className="text-xs text-slate-400 sm:col-span-2">{loading ? '正在搜索...' : `${schools.length} 所可选学校`}</div>
            </div>
          )}
        </div>
      </AdminPanel>
    </div>
  );
}
