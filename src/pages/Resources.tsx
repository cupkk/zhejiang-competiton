import { useState } from 'react';
import { Search, Download, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { resources } from '@/data/mock';

export default function Resources() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-full bg-slate-50">
      <div className="bg-white sticky top-0 z-40 px-5 pt-8 pb-4 border-b border-slate-100">
        <h1 className="text-xl font-bold text-slate-900 mb-4">学习资源库</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索资料、模板、真题..."
            className="w-full bg-slate-100 text-sm rounded-full pl-9 pr-4 py-2.5 focus:outline-none"
          />
        </div>
      </div>

      <div className="p-5 space-y-4">
        {resources.map(res => (
          <div 
            key={res.id}
            onClick={() => navigate(`/resources/detail/${res.id}`)}
            className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex space-x-4 cursor-pointer"
          >
            <img src={res.image} alt={res.title} className="w-20 h-28 object-cover rounded-lg flex-shrink-0" />
            <div className="flex-1 flex flex-col justify-between py-1">
              <div>
                <h3 className="font-bold text-slate-900 text-sm line-clamp-2 mb-1">{res.title}</h3>
                <div className="flex flex-wrap gap-1 mb-2">
                  {res.tags.map(tag => (
                    <span key={tag} className="text-[10px] bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between mt-auto">
                <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                  <span className="flex items-center"><Download className="w-3 h-3 mr-0.5" /> {res.downloads}</span>
                  <span className="flex items-center"><Star className="w-3 h-3 mr-0.5 text-yellow-400" /> {res.rating}</span>
                </div>
                <span className="text-sm font-bold text-blue-600">
                  {res.price === 0 ? '免费' : `¥${res.price}`}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
