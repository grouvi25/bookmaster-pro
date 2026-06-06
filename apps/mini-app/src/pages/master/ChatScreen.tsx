import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { messagesApi } from '@/api/endpoints';
import { ChevronLeft, Send } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAuthStore } from '@/stores/auth';

interface Message {
  id: number;
  thread_id: number;
  sender_role: string;
  sender_id: number;
  text: string | null;
  attachment_url: string | null;
  is_read: boolean;
  created_at: string;
}

interface Props {
  threadId: number;
  partnerName: string;
  partnerAvatar?: string | null;
  onBack: () => void;
}

export default function ChatScreen({ threadId, partnerName, partnerAvatar, onBack }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [wsMessages, setWsMessages] = useState<Message[]>([]);
  const [online, setOnline] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const role = useAuthStore(s => s.role);

  // Определяем роль отправителя
  const myRole = role === 'client' ? 'client' : 'master';

  // Fetch messages
  const { data, isLoading } = useQuery({
    queryKey: ['chat-messages', threadId],
    queryFn: () => messagesApi.messages(threadId).then(r => r.data),
  });

  const apiMessages: Message[] = data?.items || [];

  // Merge API + WS messages (dedupe by id)
  const allMessages = useCallback(() => {
    const map = new Map<number, Message>();
    apiMessages.forEach(m => map.set(m.id, m));
    wsMessages.forEach(m => map.set(m.id, m));
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [apiMessages, wsMessages]);

  const messages = allMessages();

  // WebSocket connection
  useEffect(() => {
    const token = localStorage.getItem('bm_access_token');
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/messages/ws/${threadId}?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setOnline(true);

    ws.onmessage = (event) => {
      try {
        const msg: Message = JSON.parse(event.data);
        setWsMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });

        // Mark as read if from partner
        if (msg.sender_role !== myRole) {
          ws.send(JSON.stringify({ type: 'read' }));
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setOnline(false);
      // Reconnect after 3 seconds
      setTimeout(() => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
      }, 3000);
    };

    // Mark existing messages as read
    messagesApi.markRead(threadId).catch(() => {});

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [threadId, myRole]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Auto-grow textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 112) + 'px';
  }, [text]);

  // Send message
  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setText('');

    try {
      // Try WebSocket first
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'message', text: trimmed }));
      } else {
        // Fallback to REST
        const resp = await messagesApi.send(threadId, { text: trimmed });
        setWsMessages(prev => [...prev, resp.data]);
      }
    } catch {
      setText(trimmed); // restore text on error
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }

    // Invalidate thread list for unread count
    queryClient.invalidateQueries({ queryKey: ['message-threads'] });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date
  const groupedByDate: { date: string; messages: Message[] }[] = [];
  let currentDate = '';
  messages.forEach(m => {
    const d = format(new Date(m.created_at), 'd MMMM', { locale: ru });
    if (d !== currentDate) {
      currentDate = d;
      groupedByDate.push({ date: d, messages: [m] });
    } else {
      groupedByDate[groupedByDate.length - 1].messages.push(m);
    }
  });

  const handleBack = () => {
    queryClient.invalidateQueries({ queryKey: ['message-threads'] });
    onBack();
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-tg-bg text-tg-text animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2.5 bg-surface-primary border-b border-tg-secondary shrink-0 safe-area-top">
        <button
          onClick={handleBack}
          aria-label="Назад"
          className="p-1 -ml-1 active:scale-90 transition-transform"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center shrink-0 overflow-hidden">
          {partnerAvatar ? (
            <img src={partnerAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-base font-semibold text-brand-500">
              {(partnerName || '?')[0].toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm truncate leading-tight">{partnerName}</h2>
          <span className={clsx(
            'text-[11px] leading-tight',
            online ? 'text-green-500' : 'text-tg-hint'
          )}>
            {online ? 'в сети' : 'не в сети'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-8">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-tg-hint text-sm">
              Начните диалог — напишите первое сообщение
            </p>
          </div>
        ) : (
          groupedByDate.map(group => (
            <div key={group.date}>
              {/* Date divider */}
              <div className="flex items-center justify-center mb-3">
                <span className="text-[11px] text-tg-hint bg-tg-secondary/60 px-3 py-0.5 rounded-full">
                  {group.date}
                </span>
              </div>

              {/* Messages */}
              <div className="space-y-1.5">
                {group.messages.map(m => {
                  const isMine = m.sender_role === myRole;
                  return (
                    <div
                      key={m.id}
                      className={clsx(
                        'flex',
                        isMine ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={clsx(
                          'max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-snug shadow-sm',
                          isMine
                            ? 'bg-brand-500 text-white rounded-br-md'
                            : 'bg-surface-primary rounded-bl-md'
                        )}
                      >
                        {m.attachment_url && (
                          <img
                            src={m.attachment_url}
                            alt=""
                            className="rounded-xl mb-1 max-h-48 object-cover"
                          />
                        )}
                        {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                        <div
                          className={clsx(
                            'text-[10px] mt-0.5 text-right',
                            isMine ? 'text-white/60' : 'text-tg-hint'
                          )}
                        >
                          {format(new Date(m.created_at), 'HH:mm')}
                          {isMine && (
                            <span className="ml-1">{m.is_read ? '✓✓' : '✓'}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-tg-secondary bg-surface-primary px-3 py-2 safe-area-bottom">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Сообщение..."
            rows={1}
            className="flex-1 resize-none text-sm py-2.5 px-3.5 rounded-2xl bg-tg-bg outline-none max-h-28 border border-tg-secondary focus:border-brand-500 transition-colors"
            style={{ minHeight: '40px' }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            aria-label="Отправить"
            className={clsx(
              'p-2.5 rounded-full transition-all shrink-0',
              text.trim()
                ? 'bg-brand-500 text-white active:scale-90'
                : 'bg-tg-secondary text-tg-hint'
            )}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
