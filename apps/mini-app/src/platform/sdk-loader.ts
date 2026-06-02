/**
 * SDK Loader — динамически подгружает SDK только нужной платформы.
 *
 * Раньше оба SDK (Telegram + MAX) висели блокирующими <script> в <head>.
 * В Telegram это незаметно (клиент инжектит мост мгновенно), а в MAX
 * блокирующий запрос к st.max.ru тормозил старт мини-приложения на секунды.
 *
 * Теперь: определяем платформу по окружению ДО загрузки SDK, грузим только
 * один скрипт асинхронно и с таймаутом, чтобы зависший CDN не блокировал
 * запуск навсегда.
 */

const TG_SDK = 'https://telegram.org/js/telegram-web-app.js';
const MAX_SDK = 'https://st.max.ru/js/max-web-app.js';
const LOAD_TIMEOUT_MS = 4000;

export type DetectedPlatform = 'telegram' | 'max' | 'unknown';

/**
 * Эвристическое определение платформы ДО загрузки SDK.
 * Telegram кладёт tgWebAppData в hash; MAX — WebAppData.
 */
function detectPlatformEarly(): DetectedPlatform {
  if (typeof window === 'undefined') return 'unknown';

  const w = window as unknown as Record<string, unknown>;

  // Если мост уже доступен (некоторые клиенты инжектят его сами)
  if (w.Telegram && (w.Telegram as { WebApp?: unknown }).WebApp) return 'telegram';

  const hash = window.location.hash || '';
  const search = window.location.search || '';
  const haystack = `${hash}${search}`;

  if (haystack.includes('tgWebAppData') || haystack.includes('tgWebAppPlatform')) {
    return 'telegram';
  }
  if (haystack.includes('WebAppData') || haystack.includes('max')) {
    return 'max';
  }

  // User-Agent эвристика как последний резерв
  const ua = navigator.userAgent || '';
  if (/Telegram/i.test(ua)) return 'telegram';

  return 'unknown';
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    s.onload = finish;
    s.onerror = finish; // не валим старт, если SDK не загрузился
    setTimeout(finish, LOAD_TIMEOUT_MS); // защита от зависшего CDN
    document.head.appendChild(s);
  });
}

/**
 * Грузит SDK нужной платформы. Если платформу определить не удалось,
 * грузим Telegram (основная платформа) и MAX параллельно, но асинхронно —
 * рендер при этом уже не блокируется.
 */
export async function loadPlatformSDK(): Promise<DetectedPlatform> {
  const platform = detectPlatformEarly();

  if (platform === 'telegram') {
    await loadScript(TG_SDK);
    return 'telegram';
  }
  if (platform === 'max') {
    await loadScript(MAX_SDK);
    return 'max';
  }

  // unknown — грузим оба, но асинхронно и с таймаутом (не блокирует надолго)
  await Promise.race([
    Promise.all([loadScript(TG_SDK), loadScript(MAX_SDK)]),
    new Promise<void>((r) => setTimeout(r, LOAD_TIMEOUT_MS)),
  ]);
  return 'unknown';
}
