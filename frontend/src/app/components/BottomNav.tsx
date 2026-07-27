import { NavLink } from 'react-router';
import { FolderOpen, Home, Trophy, User, Users } from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: '首页' },
  { to: '/competitions', icon: Trophy, label: '竞赛' },
  { to: '/resources', icon: FolderOpen, label: '资源' },
  { to: '/teams', icon: Users, label: '组队' },
  { to: '/profile', icon: User, label: '我的' },
];

export function BottomNav() {
  return (
    <nav
      aria-label="主导航"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[430px] border-t border-[#dce5f0]/90 bg-[rgba(250,252,255,0.88)] px-5 pb-[calc(env(safe-area-inset-bottom)+0.7rem)] pt-2 shadow-[0_-12px_34px_rgba(29,45,72,0.09)] backdrop-blur-[24px] backdrop-saturate-150 sm:bottom-4 sm:rounded-b-xl md:bottom-8"
    >
      <div className="flex items-center justify-between">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex min-w-[3.8rem] flex-col items-center gap-1 transition-[color,transform] duration-[120ms] ease-out active:scale-[0.97] ${
                isActive ? 'text-[#1769e0]' : 'text-[#7c899c] hover:text-slate-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`flex h-9 w-10 items-center justify-center rounded-full transition-[background-color,color,transform] duration-[120ms] ease-out ${
                    isActive ? 'bg-[#e4efff] text-[#1769e0] shadow-[inset_0_0_0_1px_rgba(23,105,224,0.08)]' : 'bg-transparent'
                  }`}
                >
                  <item.icon size={20} strokeWidth={isActive ? 2.5 : 2.2} />
                </div>
                <span className={`text-[11px] ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
