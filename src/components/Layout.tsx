import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, Trophy, Folder, MessageSquare, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const NAV_ITEMS = [
  { id: 'home', path: '/', icon: Home, label: '首页' },
  { id: 'competitions', path: '/competitions', icon: Trophy, label: '竞赛' },
  { id: 'resources', path: '/resources', icon: Folder, label: '资源' },
  { id: 'community', path: '/community', icon: MessageSquare, label: '社区' },
  { id: 'profile', path: '/profile', icon: User, label: '我的' },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  // Hide bottom nav on detail pages
  const isDetail = location.pathname.includes('/detail') || location.pathname.includes('/ai');

  return (
    <div className="mx-auto max-w-md h-screen flex flex-col bg-slate-50 relative overflow-hidden shadow-2xl sm:border-x sm:border-slate-200">
      <main className="flex-1 overflow-y-auto hide-scrollbar relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="min-h-full pb-20"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {!isDetail && (
        <nav className="absolute bottom-0 w-full bg-white/80 backdrop-blur-md border-t border-slate-100 pb-safe pt-2 px-6 flex justify-between items-center z-50">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center justify-center w-12 h-12 relative"
              >
                <Icon
                  className={cn(
                    "w-6 h-6 mb-1 transition-colors duration-200",
                    isActive ? "text-blue-600" : "text-slate-400"
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium transition-colors duration-200",
                    isActive ? "text-blue-600" : "text-slate-400"
                  )}
                >
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -top-2 w-8 h-1 bg-blue-600 rounded-full"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
