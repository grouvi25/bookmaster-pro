import { useState, useRef, useEffect } from 'react';
import { aiApi } from '@/api/endpoints';
import { SendHorizontal } from 'lucide-react';
import FeatureGate from '@/shared/ui/FeatureGate';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIAssistant() {
  return (
    <FeatureGate flag="ai_advisor">
      <AIChat />
    </FeatureGate>
  );
}

function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Привет! Я ваш AI-ассистент. Могу помочь с:\n\n' +
        '\u2022 Анализом бизнеса и советами\n' +
        '\u2022 Генерацией текстов для описаний услуг\n' +
        '\u2022 Ответами на отзывы клиентов\n' +
        '\u2022 Подсказками по маркетингу\n\n' +
        'Спрашивайте!',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const resp = await aiApi.ask({
        message: userMessage,
        session_id: sessionId,
      });
      if (resp.data.session_id) {
        setSessionId(resp.data.session_id);
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: resp.data.response || 'Нет ответа' },
      ]);
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { status?: number } })?.response?.status === 403
          ? 'AI-ассистент недоступен на вашем тарифе.'
          : 'Произошла ошибка. Попробуйте позже.';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: errorMsg },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-72px)] animate-fade-in">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[82%] ${
              msg.role === 'user' ? 'ml-auto' : 'mr-auto'
            }`}
          >
            <div
              className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-brand-500 text-white rounded-br-lg shadow-button'
                  : 'bg-surface-elevated shadow-card text-tg-text rounded-bl-lg'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="mr-auto">
            <div className="bg-surface-elevated shadow-card rounded-2xl rounded-bl-lg px-4 py-3.5">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-tg-hint/40 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-tg-hint/40 rounded-full animate-bounce [animation-delay:0.15s]" />
                <div className="w-2 h-2 bg-tg-hint/40 rounded-full animate-bounce [animation-delay:0.3s]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 bg-surface-primary">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Напишите вопрос..."
            className="input-field"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="px-4 py-3 bg-brand-500 text-white rounded-2xl shadow-button disabled:opacity-40 active:scale-[0.95] transition-all"
          >
            <SendHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
