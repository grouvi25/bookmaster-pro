import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import App from './App';
import './index.css';
import { loadPlatformSDK } from './platform/sdk-loader';

// ─── Кастомный focusManager для мини-приложений ──────────────────────
// Telegram/MAX WebView не всегда кидают стандартные window 'focus'/'blur'.
// Используем visibilitychange — он работает надёжно в любом WebView.
focusManager.setEventListener((handleFocus) => {
  const onVisibilityChange = () => {
    handleFocus(document.visibilityState === 'visible');
  };
  const onFocus = () => handleFocus(true);
  const onBlur = () => handleFocus(false);
  document.addEventListener('visibilitychange', onVisibilityChange);
  // fallback на стандартные события
  window.addEventListener('focus', onFocus);
  window.addEventListener('blur', onBlur);
  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('blur', onBlur);
  };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Данные «свежие» 30 с — быстрое переключение вкладок не вызывает запросов.
      // После 30 с данные считаются stale: при навигации / фокусе
      // React Query покажет кеш мгновенно и обновит в фоне (stale-while-revalidate).
      staleTime: 30_000,
      // Кеш живёт 5 мин — даже после размонтирования компонента данные в памяти.
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  },
});

function render() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>
  );
}

// Грузим SDK нужной платформы (с таймаутом внутри), затем рендерим.
loadPlatformSDK().finally(render);
