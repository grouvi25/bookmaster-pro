/**
 * AI-ассистент мастера — чат с WebSocket стримингом.
 *
 * ТЗ "База и Ai" §2.2-2.3:
 * - Header: название, кнопки быстрого доступа (База знаний, Контент, Голосовой),
 *   кнопка новой сессии.
 * - Quick actions карточки при пустом чате.
 * - WebSocket стриминг → fallback на POST /ai/ask.
 * - Голосовой ввод: MediaRecorder → /ai/transcribe → WS send.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiApi } from '@/api/endpoints';
import { useAuthStore } from '@/stores/auth';
import {
  SendHorizontal, Mic, MicOff, Sparkles, FileText, BookOpen, RotateCcw,
} from 'lucide-react';
import Button from '@/shared/ui/Button';
import FeatureGate from '@/shared/ui/FeatureGate';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

const QUICK_ACTIONS = [
  { emoji: '📊', text: 'Сколько записей на этой неделе?' },
  { emoji: '💡', text: 'Как увеличить количество клиентов?' },
  { emoji: '📝', text: 'Составь план постов на неделю' },
  { emoji: '💬', text: 'Помоги ответить на отзыв' },
];

export default function AIAssistant() {
  return (
    <FeatureGate flag="ai_advisor">
      <AIChat />
    </FeatureGate>
  );
}

function AIChat() {
  const navigate = useNavigate();
  const { masterId } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

  // ── WebSocket ──────────────────────────────────────────

  const sendViaWebSocket = useCallback(
    (userMessage: string) => {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/api/v1/ai/chat`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          message: userMessage,
          session_id: sessionId,
          master_id: masterId,
        }));
      };

      let buffer = '';

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.error) {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: data.error },
          ]);
          setLoading(false);
          ws.close();
          return;
        }

        if (data.session_id) setSessionId(data.session_id);

        if (data.chunk) {
          buffer += data.chunk;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.streaming) {
              return [
                ...prev.slice(0, -1),
                { role: 'assistant', content: buffer, streaming: true },
              ];
            }
            return [
              ...prev,
              { role: 'assistant', content: buffer, streaming: true },
            ];
          });
        }

        if (data.done) {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.streaming) {
              return [...prev.slice(0, -1), { role: 'assistant', content: last.content }];
            }
            return prev;
          });
          setLoading(false);
          ws.close();
        }
      };

      ws.onerror = () => {
        fallbackToHTTP(userMessage);
        ws.close();
      };

      ws.onclose = () => { wsRef.current = null; };
    },
    [sessionId, masterId]
  );

  const fallbackToHTTP = async (userMessage: string) => {
    try {
      const resp = await aiApi.ask({ message: userMessage, session_id: sessionId });
      if (resp.data.session_id) setSessionId(resp.data.session_id);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        const content = resp.data.response || 'Нет ответа';
        if (last?.streaming) {
          return [...prev.slice(0, -1), { role: 'assistant', content }];
        }
        return [...prev, { role: 'assistant', content }];
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { status?: number } })?.response?.status === 403
          ? 'AI-ассистент недоступен на вашем тарифе.'
          : 'Произошла ошибка. Попробуйте позже.';
      setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
    } finally {
      setLoading(false);
    }
  };

  // ── Actions ────────────────────────────────────────────

  const handleSend = (text?: string) => {
    const userMessage = (text || input).trim();
    if (!userMessage || loading) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);
    sendViaWebSocket(userMessage);
  };

  const handleNewSession = () => {
    wsRef.current?.close();
    setMessages([]);
    setSessionId(undefined);
    setLoading(false);
  };

  // ── Voice ──────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size < 100) return;

        setLoading(true);
        setMessages((prev) => [...prev, { role: 'user', content: '🎤 Голосовое сообщение...' }]);

        try {
          const formData = new FormData();
          formData.append('audio', blob, 'voice.webm');
          const resp = await fetch('/api/v1/ai/transcribe', {
            method: 'POST',
            body: formData,
            headers: {
              Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
            },
          });
          const data = await resp.json();
          if (data.transcript) {
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'user', content: data.transcript };
              return updated;
            });
            sendViaWebSocket(data.transcript);
          } else {
            setLoading(false);
          }
        } catch {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: 'Не удалось распознать голос.' },
          ]);
          setLoading(false);
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Нет доступа к микрофону.' },
      ]);
    }
  }, [sendViaWebSocket]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }, []);

  // ── Render ─────────────────────────────────────────────

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100dvh-var(--tabbar-height,80px))] animate-fade-in">
      {/* Header */}
      <div className="px-screen-x py-3 flex items-center justify-between border-b border-tg-secondary shrink-0 bg-tg-bg">
        <div>
          <h1 className="text-h2 font-bold">AI-ассистент ✨</h1>
          <p className="text-aux text-tg-hint">Советник для вашего бизнеса</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => navigate('/master/ai/knowledge')}
            className="p-2 rounded-xl bg-tg-secondary text-tg-text interactive"
            title="База знаний"
          >
            <BookOpen className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/master/ai/voice-diary')}
            className="p-2 rounded-xl bg-tg-secondary text-tg-text interactive"
            title="Голосовой дневник"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/master/ai/content')}
            className="p-2 rounded-xl bg-tg-secondary text-tg-text interactive"
            title="Контент"
          >
            <Sparkles className="w-4 h-4" />
          </button>
          <button
            onClick={handleNewSession}
            className="p-2 rounded-xl bg-tg-secondary text-tg-text interactive"
            title="Новая сессия"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-screen-x py-4">
        {/* Quick actions при пустом чате (ТЗ §2.3) */}
        {isEmpty && (
          <div className="flex flex-col items-center py-8">
            <p className="text-body text-tg-hint mb-4 text-center">Чем могу помочь?</p>
            <div className="grid grid-cols-2 gap-2 w-full">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.text}
                  onClick={() => handleSend(action.text)}
                  className="p-3 rounded-card text-left bg-tg-secondary interactive"
                >
                  <div className="text-lg mb-1">{action.emoji}</div>
                  <div className="text-aux font-medium leading-tight">{action.text}</div>
                </button>
              ))}
            </div>

            {/* Доп. кнопки */}
            <div className="flex gap-2 mt-4 w-full">
              <button
                onClick={() => navigate('/master/ai/content')}
                className="flex-1 p-3 rounded-card text-center bg-tg-secondary interactive"
              >
                <div className="text-lg">✏️</div>
                <div className="text-aux font-medium mt-1">Контент</div>
              </button>
              <button
                onClick={() => navigate('/master/ai/voice-diary')}
                className="flex-1 p-3 rounded-card text-center bg-tg-secondary interactive"
              >
                <div className="text-lg">🎙️</div>
                <div className="text-aux font-medium mt-1">Голосовой дневник</div>
              </button>
            </div>
          </div>
        )}

        {/* Сообщения */}
        {!isEmpty && (
          <div className="flex flex-col gap-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`max-w-[85%] ${
                  msg.role === 'user' ? 'ml-auto' : 'mr-auto'
                }`}
              >
                <div
                  className={`rounded-2xl px-4 py-3 text-body leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-tg-button text-tg-button-text rounded-br-lg'
                      : 'bg-tg-secondary text-tg-text rounded-bl-lg'
                  }`}
                >
                  {msg.content}
                  {msg.streaming && (
                    <span className="inline-block w-1.5 h-4 bg-tg-button ml-0.5 animate-pulse align-middle" />
                  )}
                </div>
              </div>
            ))}
            {loading && !messages[messages.length - 1]?.streaming && (
              <div className="mr-auto">
                <div className="bg-tg-secondary rounded-2xl rounded-bl-lg px-4 py-3.5">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-tg-hint/40 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-tg-hint/40 rounded-full animate-bounce [animation-delay:0.15s]" />
                    <div className="w-2 h-2 bg-tg-hint/40 rounded-full animate-bounce [animation-delay:0.3s]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="px-screen-x py-3 border-t border-tg-secondary bg-tg-bg shrink-0 safe-bottom">
        <div className="flex gap-2 items-end">
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={loading}
            className={`w-[50px] h-[50px] rounded-btn flex items-center justify-center transition-all shrink-0 ${
              recording
                ? 'bg-status-danger text-white animate-pulse'
                : 'bg-tg-secondary text-tg-hint'
            } disabled:opacity-40`}
          >
            {recording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Спросите что угодно..."
            className="input-field flex-1"
          />
          <Button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            size="md"
            className="shrink-0 !w-[50px] !px-0"
          >
            <SendHorizontal className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
