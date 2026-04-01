import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Share, Star, Download, ShieldCheck } from 'lucide-react';
import { resources } from '@/data/mock';

export default function ResourceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const res = resources.find(r => r.id === id) || resources[0];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-white px-5 pt-8 pb-4 sticky top-0 z-40 flex items-center justify-between border-b border-slate-100">
        <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center text-slate-700">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="font-bold text-slate-900">资源详情</span>
        <button className="w-8 h-8 flex items-center justify-center text-slate-700">
          <Share className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4 flex space-x-4">
          <img src={res.image} alt={res.title} className="w-24 h-32 object-cover rounded-lg shadow-md" />
          <div className="flex-1 flex flex-col justify-between">
            <h1 className="text-base font-bold text-slate-900 line-clamp-3 leading-snug">{res.title}</h1>
            <div>
              <div className="text-xs text-slate-500 mb-1">格式: {res.type}</div>
              <div className="text-xs text-slate-500">大小: 12.5 MB</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <img src={res.author.avatar} alt="" className="w-10 h-10 rounded-full" />
              <div>
                <div className="text-sm font-bold text-slate-900">{res.author.name}</div>
                <div className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full inline-block mt-0.5">
                  {res.author.title}
                </div>
              </div>
            </div>
            <button className="text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
              关注
            </button>
          </div>
          <div className="h-px bg-slate-100 w-full mb-4" />
          <h3 className="text-sm font-bold text-slate-900 mb-2">资源简介</h3>
          <p className="text-sm text-slate-700 leading-relaxed">{res.description}</p>
        </div>

        <div className="flex items-center justify-center text-xs text-slate-400 space-x-1">
          <ShieldCheck className="w-4 h-4" />
          <span>平台已进行基础安全检测</span>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 px-5 py-3 pb-safe flex items-center space-x-4 z-50">
        <button className="flex flex-col items-center justify-center text-slate-500">
          <Star className="w-5 h-5 mb-1" />
          <span className="text-[10px]">收藏</span>
        </button>
        <button className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-transform flex items-center justify-center">
          <Download className="w-4 h-4 mr-2" />
          {res.price === 0 ? '免费领取' : `¥${res.price} 立即购买`}
        </button>
      </div>
    </div>
  );
}
