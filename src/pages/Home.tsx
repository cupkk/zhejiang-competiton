import { Search, Sparkles, Compass, BookOpen, Users, FileText, ChevronRight, Clock, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { competitions, teams } from '@/data/mock';
import { cn } from '@/lib/utils';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-full bg-slate-50">
      {/* Header */}
      <header className="px-5 pt-8 pb-4 bg-white sticky top-0 z-40">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Hi, 同学 👋</h1>
            <p className="text-sm text-slate-500 mt-0.5">今天想提升点什么？</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-600">
            A大
          </div>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="w-full bg-slate-100 text-slate-900 text-sm rounded-full pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            placeholder="搜竞赛、找资料、看面经..."
          />
        </div>
      </header>

      <div className="px-5 py-4 space-y-6">
        {/* AI Hero Banner */}
        <div 
          onClick={() => navigate('/ai')}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-teal-500 p-5 text-white shadow-lg shadow-blue-500/20 cursor-pointer active:scale-[0.98] transition-transform"
        >
          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-2">
              <Sparkles className="w-5 h-5 text-yellow-300" />
              <h2 className="text-lg font-bold">不知道参加什么比赛？</h2>
            </div>
            <p className="text-blue-50 text-sm mb-4 opacity-90">让 AI 校园助手帮你一键规划成长路径</p>
            <div className="inline-flex items-center bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-medium">
              立即提问 <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </div>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute right-10 top-4 w-16 h-16 bg-teal-400/20 rounded-full blur-xl"></div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: Compass, label: '找竞赛', color: 'bg-blue-100 text-blue-600', path: '/competitions' },
            { icon: BookOpen, label: '找资料', color: 'bg-teal-100 text-teal-600', path: '/resources' },
            { icon: Users, label: '找队友', color: 'bg-orange-100 text-orange-600', path: '/competitions' },
            { icon: FileText, label: '看攻略', color: 'bg-purple-100 text-purple-600', path: '/community' },
          ].map((item, i) => (
            <div key={i} onClick={() => navigate(item.path)} className="flex flex-col items-center gap-2 cursor-pointer">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", item.color)}>
                <item.icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium text-slate-700">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Urgent Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center">
              <Clock className="w-4 h-4 mr-1.5 text-orange-500" /> 近期急需
            </h3>
            <span className="text-xs text-slate-500">查看更多</span>
          </div>
          <div className="flex overflow-x-auto hide-scrollbar -mx-5 px-5 space-x-4 pb-4">
            {competitions.filter(c => c.daysLeft < 20).map(comp => (
              <div 
                key={comp.id} 
                onClick={() => navigate(`/competitions/detail/${comp.id}`)}
                className="min-w-[240px] bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex-shrink-0 cursor-pointer"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold px-2 py-1 bg-red-100 text-red-600 rounded-md">
                    距截止 {comp.daysLeft} 天
                  </span>
                  <span className="text-[10px] text-slate-400">{comp.level}</span>
                </div>
                <h4 className="font-bold text-sm text-slate-900 line-clamp-2 mb-2">{comp.title}</h4>
                <div className="flex flex-wrap gap-1">
                  {comp.tags.slice(0, 2).map(tag => (
                    <span key={tag} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Mixed Feed */}
        <section>
          <h3 className="text-base font-bold text-slate-900 mb-3">为你推荐</h3>
          <div className="space-y-4">
            {teams.map(team => (
              <div key={team.id} onClick={() => navigate(`/teams/detail/${team.id}`)} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <img src={team.author.avatar} alt="" className="w-6 h-6 rounded-full" />
                    <span className="text-xs font-medium text-slate-700">{team.author.name} · 招募队友</span>
                  </div>
                  <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded-full font-medium">
                    缺 {team.max - team.current} 人
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-900 mb-2">{team.title}</h4>
                <div className="flex items-center space-x-2 text-xs text-slate-500">
                  <Trophy className="w-3 h-3" />
                  <span className="truncate">{team.compName}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
