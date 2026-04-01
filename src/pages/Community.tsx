import { useState } from 'react';
import { Search, MessageSquare, Heart, Edit3 } from 'lucide-react';
import { posts } from '@/data/mock';
import { cn } from '@/lib/utils';

const TABS = ['推荐', '经验贴', '问答', '避坑'];

export default function Community() {
  const [activeTab, setActiveTab] = useState('推荐');

  return (
    <div className="flex flex-col min-h-full bg-slate-50 relative">
      <div className="bg-white sticky top-0 z-40 px-5 pt-8 pb-2 border-b border-slate-100">
        <h1 className="text-xl font-bold text-slate-900 mb-4">交流社区</h1>
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
        {posts.map(post => (
          <div key={post.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center space-x-2 mb-3">
              <img src={post.author.avatar} alt="" className="w-8 h-8 rounded-full" />
              <div>
                <div className="text-xs font-bold text-slate-900">{post.author.name}</div>
                <div className="text-[10px] text-slate-400">{post.time}</div>
              </div>
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-2">{post.title}</h3>
            <p className="text-xs text-slate-600 line-clamp-3 mb-3 leading-relaxed">{post.content}</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {post.tags.map(tag => (
                <span key={tag} className="text-[10px] bg-slate-50 text-slate-500 px-2 py-1 rounded-md">
                  #{tag}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between text-slate-400 text-xs pt-3 border-t border-slate-50">
              <div className="flex space-x-4">
                <button className="flex items-center space-x-1"><Heart className="w-4 h-4" /> <span>{post.likes}</span></button>
                <button className="flex items-center space-x-1"><MessageSquare className="w-4 h-4" /> <span>{post.comments}</span></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="fixed bottom-24 right-5 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-500/30 flex items-center justify-center active:scale-95 transition-transform z-40">
        <Edit3 className="w-5 h-5" />
      </button>
    </div>
  );
}
