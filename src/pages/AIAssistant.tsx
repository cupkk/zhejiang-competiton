import { useState } from 'react';
import { ChevronLeft, Send, Sparkles, Bot } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function AIAssistant() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '你好！我是你的校园成长助手。你可以告诉我你的年级、专业和目标，我来帮你规划竞赛或推荐学习资源。' }
  ]);

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages([...messages, { role: 'user', content: input }]);
    setInput('');
    // Mock AI response
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '根据你的情况，我推荐你参加“挑战杯”大学生创业计划竞赛。这是一个含金量很高的国家级比赛，非常适合锻炼你的综合能力。\n\n你可以先去【资源】板块看看历年的优秀商业计划书，或者去【组队】大厅找找缺人的队伍。' 
      }]);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <div className="bg-white px-5 pt-8 pb-4 sticky top-0 z-40 flex items-center justify-between border-b border-slate-100 shadow-sm">
        <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center text-slate-700">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span className="font-bold text-slate-900">AI 成长助手</span>
        </div>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4 hide-scrollbar">
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[80%] rounded-2xl p-3 text-sm leading-relaxed", 
              msg.role === 'user' 
                ? "bg-blue-600 text-white rounded-tr-sm" 
                : "bg-white border border-slate-100 text-slate-700 rounded-tl-sm shadow-sm"
            )}>
              {msg.role === 'assistant' && (
                <div className="flex items-center space-x-1 mb-1 text-blue-600">
                  <Bot className="w-3 h-3" />
                  <span className="text-[10px] font-bold">AI 助手</span>
                </div>
              )}
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border-t border-slate-100 p-4 pb-safe">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="问问我大一该怎么规划..."
            className="flex-1 bg-slate-100 text-sm rounded-full px-4 py-2.5 focus:outline-none"
          />
          <button 
            onClick={handleSend}
            className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white active:scale-95 transition-transform"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
