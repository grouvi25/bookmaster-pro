import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { messagesApi } from '@/api/endpoints';
import PageHeader from '@/shared/ui/PageHeader';
import EmptyState from '@/shared/ui/EmptyState';
import Card from '@/shared/ui/Card';
import { BookingCardSkeleton } from '@/shared/ui/Skeleton';
import ChatScreen from '@/pages/master/ChatScreen';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Thread {
  id: number;
  master_id: number;
  client_id: number;
  last_message_at: string | null;
  last_message_text: string | null;
  master_unread: number;
  client_unread: number;
  partner_name: string | null;
  partner_avatar: string | null;
}

export default function Messages() {
  const location = useLocation();
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [pendingThreadId, setPendingThreadId] = useState<number | null>(null);

  // Если перешли из карточки клиента / записи — сразу открываем чат
  useEffect(() => {
    const state = location.state as { openThread?: Thread; openThreadId?: number } | null;
    if (state?.openThread) {
      setActiveThread(state.openThread);
      window.history.replaceState({}, '');
    } else if (state?.openThreadId) {
      setPendingThreadId(state.openThreadId);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const { data, isLoading } = useQuery({
    queryKey: ['message-threads'],
    queryFn: () => messagesApi.threads().then(r => r.data),
    refetchInterval: 15_000,
  });

  // Deep-link по push «Ответить»: открываем тред по id, когда список загрузился
  useEffect(() => {
    if (pendingThreadId && data?.items) {
      const t = (data.items as Thread[]).find((x) => x.id === pendingThreadId);
      if (t) {
        setActiveThread(t);
        setPendingThreadId(null);
      }
    }
  }, [pendingThreadId, data]);

  if (activeThread) {
    return (
      <ChatScreen
        threadId={activeThread.id}
        partnerName={activeThread.partner_name || 'Чат'}
        partnerAvatar={activeThread.partner_avatar}
        onBack={() => setActiveThread(null)}
      />
    );
  }

  const threads: Thread[] = data?.items || [];

  return (
    <div className="px-screen-x pb-24">
      <PageHeader title="Чаты" />

      {isLoading ? (
        <div className="space-y-3">
          <BookingCardSkeleton />
          <BookingCardSkeleton />
        </div>
      ) : threads.length === 0 ? (
        <EmptyState
          emoji="💬"
          title="Нет диалогов"
          description="Когда вы или собеседник напишете первое сообщение, диалог появится здесь"
        />
      ) : (
        <div className="space-y-2">
          {threads.map(t => {
            const unread = t.master_unread + t.client_unread;
            return (
              <Card
                key={t.id}
                className="cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => setActiveThread(t)}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full bg-brand-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {t.partner_avatar ? (
                      <img src={t.partner_avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-semibold text-brand-500">
                        {(t.partner_name || '?')[0].toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm truncate">
                        {t.partner_name || 'Без имени'}
                      </span>
                      {t.last_message_at && (
                        <span className="text-xs text-tg-hint shrink-0 ml-2">
                          {formatDistanceToNow(new Date(t.last_message_at), {
                            addSuffix: true,
                            locale: ru,
                          })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-tg-hint truncate">
                        {t.last_message_text || 'Нет сообщений'}
                      </p>
                      {unread > 0 && (
                        <span className="ml-2 shrink-0 bg-brand-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
