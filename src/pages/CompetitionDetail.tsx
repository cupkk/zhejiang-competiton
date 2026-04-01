import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Share, Star, Sparkles, Users, FileText, ChevronRight } from 'lucide-react';
import { competitions, teams, resources } from '@/data/mock';
import { cn } from '@/lib/utils';

export default function CompetitionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('详情');
  
  const comp = competitions.find(c => c.id === id) || competitions[0];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="relative h-56 w-full">
        <img src={comp.image} alt={comp.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        <div className="absolute top-8 left-4 right-4 flex justify-between items-center z-10">
          <button onClick={() => navigate(-1)} className="w-8 h-8 bg-black/20 backdrop-blur-md rounded-full flex items-center justify-center text-white">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex space-x-2">
            <button className="w-8 h-8 bg-black/20 backdrop-blur-md rounded-full flex items-center justify-center text-white">
              <Share className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="absolute bottom-4 left-5 right-5 text-white">
          <div className="flex space-x-2 mb-2">
            <span className="bg-blue-600 text-[10px] px-2 py-1 rounded-md font-medium">{comp.status}</span>
            <span className="bg-white/20 backdrop-blur-md text-[10px] px-2 py-1 rounded-md">{comp.level}</span>
          </div>
          <h1 className="text-xl font-bold leading-tight">{comp.title}</h1>
        </div>
      </div>

      {/* AI Helper */}
      <div className="px-5 -mt-4 relative z-20 mb-4">
        <div 
          onClick={() => navigate('/ai')}
          className="bg-white rounded-2xl p-4 shadow-lg shadow-slate-200/50 border border-slate-100 flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">AI 帮我分析</h3>
              <p className="text-[10px] text-slate-500">基于你的专业评估匹配度</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white sticky top-0 z-30 border-b border-slate-100 px-5 flex space-x-6">
        {['详情', '资料', '组队'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "py-3 text-sm font-medium relative",
              activeTab === tab ? "text-blue-600" : "text-slate-500"
            )}
          >
            {tab}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-5">
        {activeTab === '详情' && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-400 mb-1">面向对象</h4>
              <p className="text-sm text-slate-900">{comp.target}</p>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-400 mb-1">报名截止</h4>
              <p className="text-sm text-slate-900">{comp.deadline} <span className="text-red-500 text-xs ml-2">(剩 {comp.daysLeft} 天)</span></p>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-400 mb-1">竞赛简介</h4>
              <p className="text-sm text-slate-700 leading-relaxed">{comp.description}</p>
            </div>
          </div>
        )}

        {activeTab === '资料' && (
          <div className="space-y-3">
            {resources.map(res => (
              <div key={res.id} onClick={() => navigate(`/resources/detail/${res.id}`)} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-start space-x-4 cursor-pointer">
                <div className="w-12 h-16 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-blue-500" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-slate-900 line-clamp-2 mb-1">{res.title}</h4>
                  <div className="flex items-center text-[10px] text-slate-500 space-x-2">
                    <span>{res.type}</span>
                    <span>·</span>
                    <span>{res.downloads} 次下载</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === '组队' && (
          <div className="space-y-3">
            {teams.filter(t => t.compId === comp.id).map(team => (
              <div key={team.id} onClick={() => navigate(`/teams/detail/${team.id}`)} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 cursor-pointer">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-sm font-bold text-slate-900 line-clamp-2 flex-1 pr-4">{team.title}</h4>
                  <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded-full whitespace-nowrap">
                    缺 {team.max - team.current} 人
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {team.missingRoles.map(role => (
                    <span key={role} className="text-[10px] border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                      缺 {role}
                    </span>
                  ))}
                </div>
                <div className="flex items-center space-x-2">
                  <img src={team.author.avatar} alt="" className="w-5 h-5 rounded-full" />
                  <span className="text-xs text-slate-500">{team.author.name} 发起</span>
                </div>
              </div>
            ))}
            <button className="w-full py-3 border border-dashed border-blue-300 text-blue-600 rounded-xl text-sm font-medium flex items-center justify-center">
              <Users className="w-4 h-4 mr-2" /> 发布我的组队招募
            </button>
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 px-5 py-3 pb-safe flex items-center space-x-4 z-50">
        <button className="flex flex-col items-center justify-center text-slate-500">
          <Star className="w-5 h-5 mb-1" />
          <span className="text-[10px]">收藏</span>
        </button>
        <button className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-transform">
          立即报名 / 去组队
        </button>
      </div>
    </div>
  );
}
