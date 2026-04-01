import { useState } from 'react';
import { Search, Filter, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { competitions } from '@/data/mock';
import { cn } from '@/lib/utils';

const TABS = ['全部', '国家级', '省级', '校级', '创新创业'];

export default function Competitions() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('全部');

  return (
    <div className="flex flex-col min-h-full bg-slate-50">
      <div className="bg-white sticky top-0 z-40 px-5 pt-8 pb-2 border-b border-slate-100">
        <div className="flex items-center space-x-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索竞赛名称、主办方..."
              className="w-full bg-slate-100 text-sm rounded-full pl-9 pr-4 py-2 focus:outline-none"
            />
          </div>
          <button className="p-2 text-slate-600 bg-slate-100 rounded-full">
            <Filter className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex overflow-x-auto hide-scrollbar space-x-6">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "pb-2 text-sm font-medium whitespace-nowrap transition-colors relative",
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
      </div>

      <div className="p-5 space-y-4">
        {competitions.map(comp => (
          <div 
            key={comp.id}
            onClick={() => navigate(`/competitions/detail/${comp.id}`)}
            className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 cursor-pointer"
          >
            <div className="relative h-32 w-full">
              <img src={comp.image} alt={comp.title} className="w-full h-full object-cover" />
              <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-md flex items-center">
                <Flame className="w-3 h-3 mr-1 text-orange-400" /> {comp.views}
              </div>
              <div className="absolute bottom-2 left-2 flex space-x-1">
                <span className="bg-blue-600 text-white text-[10px] px-2 py-1 rounded-md font-medium">
                  {comp.status}
                </span>
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-bold text-slate-900 text-base mb-2 line-clamp-2">{comp.title}</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{comp.level}</span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{comp.target}</span>
                {comp.tags.slice(0, 1).map(tag => (
                  <span key={tag} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{tag}</span>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">截止: {comp.deadline}</span>
                <span className={cn("font-medium", comp.daysLeft < 10 ? "text-red-500" : "text-slate-500")}>
                  剩 {comp.daysLeft} 天
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
