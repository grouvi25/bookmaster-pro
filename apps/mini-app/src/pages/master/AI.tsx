import { useState, useRef, useEffect } from 'react';
import { aiApi } from '@/api/endpoints';
import { SendHorizontal } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIAssistant() {
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
    <div className="flex flex-col h-[calc(100vh-56px)] animate-fade-in">
      {/* Сообщения */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[85%] ${
              msg.role === 'user' ? 'ml-auto' : 'mr-auto'
            }`}
          >
            <div
              className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-tg-button text-tg-button-text rounded-br-md'
                  : 'bg-tg-secondary text-tg-text rounded-bl-md'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="mr-auto">
            <div className="bg-tg-secondary rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-tg-hint rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-tg-hint rounded-full animate-bounce [animation-delay:0.1s]" />
                <div className="w-2 h-2 bg-tg-hint rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ввод */}
      <div className="border-t border-gray-100 p-3 bg-tg-bg">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Напишите вопрос..."
            className="flex-1 px-4 py-2.5 bg-tg-secondary rounded-xl text-sm outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="px-3 py-2.5 bg-tg-button text-tg-button-text rounded-xl disabled:opacity-50"
          >
            <SendHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
