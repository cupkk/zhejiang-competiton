import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { RequestStateCard } from '../../components/RequestStateCard';
import { TopBar } from '../../components/TopBar';
import { PAGE_ROUTES } from '../../constants/routes';
import { useRequestState } from '../../hooks/useRequestState';
import { fetchAiConversationBootstrap, sendAiMessage } from '../../services/app-service';
import type { AiConversationBootstrap, AiReplyResult, AiSource } from '../../types/entities';

type Role = 'assistant' | 'user';

interface Message {
  role: Role;
  content: string;
}

function normalizeSource(source?: string): AiSource {
  if (source === 'competition' || source === 'resource') {
    return source;
  }

  return 'general';
}

export default function AIPage() {
  const router = useRouter();
  const source = normalizeSource(router.params.source);
  const id = router.params.id;
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastPrompt, setLastPrompt] = useState('');
  const {
    status: bootstrapStatus,
    errorMessage: bootstrapError,
    run: runBootstrap,
  } = useRequestState<AiConversationBootstrap | null>({
    initialData: null,
    fallbackData: null,
    errorMessage: 'AI 上下文加载失败，请稍后重试。',
  });
  const {
    status: replyStatus,
    errorMessage: replyError,
    run: runReply,
    reset: resetReply,
  } = useRequestState<AiReplyResult | null>({
    initialData: null,
    fallbackData: null,
    errorMessage: 'AI 回复失败，请稍后重试。',
  });

  const pageHint = useMemo(() => {
    if (source === 'competition') {
      return '当前会结合竞赛详情，给你准备节奏、资料入口和组队策略建议。';
    }

    if (source === 'resource') {
      return '当前会结合资源详情，帮你判断值不值得现在就投入时间使用。';
    }

    return '当前版本先做校园成长导流和动作建议，不做泛聊天。';
  }, [source]);

  const loadConversation = useCallback(async () => {
    resetReply(null, 'idle');
    setMessages([]);
    setLastPrompt('');
    setInput('');

    const result = await runBootstrap(() => fetchAiConversationBootstrap({ source, id }));
    if (!result) {
      return;
    }

    setMessages([{ role: 'assistant', content: result.openingMessage }]);
  }, [id, resetReply, runBootstrap, source]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  const handleSend = useCallback(
    async (nextMessage = input, options?: { appendUserMessage?: boolean }) => {
      const trimmed = nextMessage.trim();
      if (!trimmed || bootstrapStatus !== 'success' || replyStatus === 'loading') {
        return;
      }

      const appendUserMessage = options?.appendUserMessage ?? true;
      if (appendUserMessage) {
        setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
        setInput('');
      }

      setLastPrompt(trimmed);

      const result = await runReply(() => sendAiMessage({ source, id, message: trimmed }), {
        preserveDataOnError: true,
      });

      if (!result) {
        return;
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: result.reply }]);
    },
    [bootstrapStatus, id, input, replyStatus, runReply, source]
  );

  const sendDisabled = bootstrapStatus !== 'success' || replyStatus === 'loading';

  return (
    <View className='page-shell page-shell--detail'>
      <TopBar title='AI 成长助手' />
      <Text className='page-subtitle' style={{ marginTop: '0', marginBottom: '20px' }}>
        {pageHint}
      </Text>

      <View className='chat-shell'>
        {bootstrapStatus === 'loading' ? (
          <RequestStateCard
            mode='loading'
            title='正在加载 AI 上下文'
            description='正在同步当前页面场景，准备给你更贴近校园项目推进的建议。'
          />
        ) : bootstrapStatus === 'error' ? (
          <RequestStateCard
            mode='error'
            title='AI 上下文加载失败'
            description={bootstrapError}
            actionText='重新加载'
            onAction={() => void loadConversation()}
          />
        ) : bootstrapStatus === 'auth_expired' ? (
          <RequestStateCard
            mode='auth_expired'
            title='登录状态已失效'
            description='重新登录后可以继续同步你的 AI 对话和个性化建议。'
            actionText='重新登录'
            onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
          />
        ) : (
          <>
            {messages.map((message, index) => (
              <View
                key={`${message.role}-${index}`}
                className={`chat-bubble-wrap ${message.role === 'user' ? 'chat-bubble-wrap--user' : ''}`}
              >
                <View
                  className={`chat-bubble ${
                    message.role === 'user' ? 'chat-bubble--user' : 'chat-bubble--assistant'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <Text className='chat-bubble__label'>AI 助手</Text>
                  ) : null}
                  <Text>{message.content}</Text>
                </View>
              </View>
            ))}

            {replyStatus === 'loading' ? (
              <RequestStateCard
                mode='loading'
                title='AI 正在整理建议'
                description='正在结合当前上下文生成下一步行动建议。'
                className='chat-shell__state'
              />
            ) : null}

            {replyStatus === 'error' ? (
              <RequestStateCard
                mode='error'
                title='AI 回复失败'
                description={replyError}
                actionText='重新生成'
                onAction={() => void handleSend(lastPrompt, { appendUserMessage: false })}
                className='chat-shell__state'
              />
            ) : null}

            {replyStatus === 'auth_expired' ? (
              <RequestStateCard
                mode='auth_expired'
                title='登录状态已失效'
                description='重新登录后可以继续同步你的 AI 对话和个性化建议。'
                actionText='重新登录'
                onAction={() => Taro.navigateTo({ url: PAGE_ROUTES.login })}
                className='chat-shell__state'
              />
            ) : null}
          </>
        )}
      </View>

      <View className='chat-input-bar'>
        <Input
          className='chat-input-bar__field'
          value={input}
          placeholder={bootstrapStatus === 'success' ? '问问我大一该怎么规划' : '请先等待 AI 上下文加载完成'}
          disabled={bootstrapStatus !== 'success'}
          onInput={(event) => setInput(event.detail.value)}
          onConfirm={() => void handleSend()}
        />
        <View
          className={`chat-input-bar__send pill-button ${
            sendDisabled ? 'pill-button--ghost' : 'pill-button--primary'
          }`}
          onClick={() => void handleSend()}
          hoverClass={sendDisabled ? undefined : 'pressable--hover'}
        >
          <Text>{replyStatus === 'loading' ? '生成中...' : '发送'}</Text>
        </View>
      </View>
    </View>
  );
}
