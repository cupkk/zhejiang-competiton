import { Settings, ChevronRight, Star, FileText, Users, Clock, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Profile() {
  return (
    <div className="flex flex-col min-h-full bg-slate-50">
      <div className="bg-white px-5 pt-12 pb-6 border-b border-slate-100 relative">
        <button className="absolute top-8 right-5 text-slate-600">
          <Settings className="w-5 h-5" />
        </button>
        <div className="flex items-center space-x-4">
          <img src="https://picsum.photos/seed/myavatar/150/150" alt="Avatar" className="w-16 h-16 rounded-full border-2 border-white shadow-sm" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">李同学</h1>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">A大 · 软件工程</span>
              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">大三</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 grid grid-cols-4 gap-4 text-center">
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-slate-900">12</span>
            <span className="text-[10px] text-slate-500 mt-1">收藏</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-slate-900">3</span>
            <span className="text-[10px] text-slate-500 mt-1">组队</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-slate-900">5</span>
            <span className="text-[10px] text-slate-500 mt-1">资源</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-slate-900">8</span>
            <span className="text-[10px] text-slate-500 mt-1">帖子</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {[
            { icon: Star, label: '我的收藏', color: 'text-yellow-500' },
            { icon: Users, label: '我的组队', color: 'text-orange-500' },
            { icon: FileText, label: '已购资源', color: 'text-teal-500' },
            { icon: Clock, label: '浏览记录', color: 'text-blue-500' },
            { icon: Bell, label: '消息中心', color: 'text-purple-500', badge: 2 },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between p-4 border-b border-slate-50 last:border-0 active:bg-slate-50 cursor-pointer">
              <div className="flex items-center space-x-3">
                <item.icon className={cn("w-5 h-5", item.color)} />
                <span className="text-sm font-medium text-slate-700">{item.label}</span>
              </div>
              <div className="flex items-center space-x-2">
                {item.badge && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
