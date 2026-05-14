import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiApi } from '@/api/endpoints';
import { useAuthStore } from '@/stores/auth';
import { SendHorizontal, Mic, MicOff, Sparkles, FileText, BookOpen } from 'lucide-react';
import FeatureGate from '@/shared/ui/FeatureGate';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

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
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const sendViaWebSocket = useCallback(
    (userMessage: string) => {
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/ai/chat`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            message: userMessage,
            session_id: sessionId,
            master_id: masterId,
          })
        );
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

        if (data.session_id) {
          setSessionId(data.session_id);
        }

        if (data.chunk) {
          buffer += data.chunk;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.streaming) {
              return [...prev.slice(0, -1), { role: 'assistant', content: buffer, streaming: true }];
            }
            return [...prev, { role: 'assistant', content: buffer, streaming: true }];
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

      ws.onclose = () => {
        wsRef.current = null;
      };
    },
    [sessionId, masterId]
  );

  const fallbackToHTTP = async (userMessage: string) => {
    try {
      const resp = await aiApi.ask({
        message: userMessage,
        session_id: sessionId,
      });
      if (resp.data.session_id) {
        setSessionId(resp.data.session_id);
      }
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.streaming) {
          return [...prev.slice(0, -1), { role: 'assistant', content: resp.data.response || 'Нет ответа' }];
        }
        return [...prev, { role: 'assistant', content: resp.data.response || 'Нет ответа' }];
      });
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

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    sendViaWebSocket(userMessage);
  };

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

  return (
    <div className="flex flex-col h-[calc(100vh-72px)] animate-fade-in">
      {/* Header */}
      <div className="px-4 py-2 flex items-center justify-between bg-surface-primary">
        <h1 className="text-lg font-bold truncate mr-2">AI-ассистент</h1>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => navigate('/master/ai/knowledge')}
            className="p-2 rounded-xl bg-tg-secondary text-tg-text active:scale-95 transition-all"
            title="База знаний"
          >
            <BookOpen className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/master/ai/voice-diary')}
            className="p-2 rounded-xl bg-tg-secondary text-tg-text active:scale-95 transition-all"
            title="Голосовой дневник"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/master/ai/content')}
            className="p-2 rounded-xl bg-tg-secondary text-tg-text active:scale-95 transition-all"
            title="Контент"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </div>
      </div>

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
              {msg.streaming && (
                <span className="inline-block w-1.5 h-4 bg-brand-500 ml-0.5 animate-pulse" />
              )}
            </div>
          </div>
        ))}
        {loading && !messages[messages.length - 1]?.streaming && (
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
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={loading}
            className={`px-3 py-3 rounded-2xl transition-all ${
              recording
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-surface-elevated text-tg-hint'
            } disabled:opacity-40`}
          >
            {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
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
