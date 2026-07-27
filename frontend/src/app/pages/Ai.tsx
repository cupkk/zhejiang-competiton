import { Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { AiBootstrapQuery } from '../../types/api';
import type { AiConversationBootstrap } from '../../types/entities';
import { PageHeader } from '../components/PageHeader';
import { StateCard } from '../components/StateCard';
import { useRequestState } from '../hooks/useRequestState';
import { fetchAiConversationBootstrap, sendAiMessage } from '../lib/app-service';

export function Ai() {
  const [searchParams] = useSearchParams();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'assistant' | 'user'; content: string }[]>([]);
  const bootstrapState = useRequestState<AiConversationBootstrap | null>({
    initialData: null,
    fallbackData: null,
    errorMessage: '规划初始化失败，请稍后重试。',
  });

  useEffect(() => {
    void bootstrapState.run(async () => {
      const result = await fetchAiConversationBootstrap({
        source: (searchParams.get('source') || undefined) as AiBootstrapQuery['source'],
        id: searchParams.get('id') || undefined,
      });
      setMessages([{ role: 'assistant', content: result.openingMessage }]);
      return result;
    });
  }, [bootstrapState.run, searchParams]);

  return (
    <div className="min-h-full bg-gray-50 pb-8">
      <PageHeader title="规划" back />

      <div className="space-y-4 px-4">
        {bootstrapState.status === 'loading' ? (
          <StateCard mode="loading" title="正在准备" />
        ) : null}

        {bootstrapState.status === 'error' ? (
          <StateCard
            mode="error"
            title="规划初始化失败"
            description={bootstrapState.errorMessage}
            actionText="重新加载"
            onAction={() =>
              void bootstrapState.run(() =>
                fetchAiConversationBootstrap({
                  source: (searchParams.get('source') || undefined) as AiBootstrapQuery['source'],
                  id: searchParams.get('id') || undefined,
                })
              )
            }
          />
        ) : null}

        <div className="space-y-3">
          {messages.map((item, index) => (
            <div
              key={`${item.role}-${index}`}
              className={`rounded-lg border p-4 text-sm leading-7 ${
                item.role === 'assistant' ? 'border-slate-200 bg-white text-gray-700' : 'border-blue-600 bg-blue-600 text-white'
              }`}
            >
              {item.content}
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <textarea
            aria-label="向 AI 描述你的问题"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={4}
            placeholder="例如：我想参加挑战杯，接下来两周应该先做什么？"
            className="w-full rounded-lg bg-gray-50 px-4 py-3 text-sm outline-none"
          />
          <button
            type="button"
            onClick={async () => {
              if (!input.trim()) {
                return;
              }

              const message = input.trim();
              setMessages((prev) => [...prev, { role: 'user', content: message }]);
              setInput('');

              const result = await sendAiMessage({
                source: bootstrapState.data?.source,
                id: searchParams.get('id') || undefined,
                message,
              });

              setMessages((prev) => [...prev, { role: 'assistant', content: result.reply }]);
            }}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white"
          >
            <Send size={16} />
            发送问题
          </button>
        </div>
      </div>
    </div>
  );
}
