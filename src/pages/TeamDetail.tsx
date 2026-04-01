import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Share, Users, Clock, MapPin, MessageCircle } from 'lucide-react';
import { teams } from '@/data/mock';

export default function TeamDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const team = teams.find(t => t.id === id) || teams[0];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-24">
      <div className="bg-white px-5 pt-8 pb-4 sticky top-0 z-40 flex items-center justify-between border-b border-slate-100">
        <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center text-slate-700">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="font-bold text-slate-900">组队详情</span>
        <button className="w-8 h-8 flex items-center justify-center text-slate-700">
          <Share className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center space-x-2 mb-3">
            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded-md font-medium">招募中</span>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-md">{team.compName}</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-4 leading-snug">{team.title}</h1>
          
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex items-start space-x-3">
              <Users className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <span className="text-slate-400 mr-2">队伍现状:</span>
                <span className="font-medium text-slate-900">{team.current} / {team.max} 人</span>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Clock className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <span className="text-slate-400 mr-2">招募截止:</span>
                <span className="font-medium text-slate-900">{team.deadline}</span>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <span className="text-slate-400 mr-2">学校要求:</span>
                <span className="font-medium text-slate-900">{team.schoolLimit ? '仅限同校' : '不限学校'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 mb-3">招募要求</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {team.missingRoles.map(role => (
              <span key={role} className="text-xs bg-orange-50 text-orange-600 border border-orange-100 px-3 py-1 rounded-full font-medium">
                急缺: {role}
              </span>
            ))}
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            项目目标是 {team.target}。希望你责任心强，不鸽，有相关经验者优先。每周需要开一次线上同步会。
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 mb-3">发起人</h3>
          <div className="flex items-center space-x-3">
            <img src={team.author.avatar} alt="" className="w-12 h-12 rounded-full" />
            <div>
              <div className="text-sm font-bold text-slate-900">{team.author.name}</div>
              <div className="text-xs text-slate-500 mt-0.5">{team.author.grade} · {team.author.major}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 px-5 py-3 pb-safe flex items-center space-x-4 z-50">
        <button className="flex flex-col items-center justify-center text-slate-500">
          <MessageCircle className="w-5 h-5 mb-1" />
          <span className="text-[10px]">留言</span>
        </button>
        <button className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-transform">
          申请加入
        </button>
      </div>
    </div>
  );
}
