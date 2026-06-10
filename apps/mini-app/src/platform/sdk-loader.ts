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
 *
 * ВАЖНО: index.html НЕ должен содержать статических <script> для SDK —
 * иначе они создадут window.Telegram.WebApp до вызова detectPlatformEarly()
 * и сломают определение MAX-платформы.
 */

const TG_SDK = 'https://telegram.org/js/telegram-web-app.js';
const MAX_SDK = 'https://st.max.ru/js/max-web-app.js';
const LOAD_TIMEOUT_MS = 4000;

export type DetectedPlatform = 'telegram' | 'max' | 'unknown';

/**
 * Эвристическое определение платформы ДО загрузки SDK.
 * Telegram кладёт tgWebAppData в hash; MAX — WebAppData.
 * Нативные клиенты могут инжектить мосты до старта React.
 */
function detectPlatformEarly(): DetectedPlatform {
  if (typeof window === 'undefined') return 'unknown';

  const w = window as unknown as Record<string, unknown>;

  // MAX нативный мост: window.WebApp с initData/initDataUnsafe
  // Проверяем ДО Telegram, потому что если TG SDK был случайно загружен,
  // window.Telegram.WebApp будет пустышкой, а window.WebApp — настоящим MAX.
  const maxApp = w.WebApp as { initData?: string; initDataUnsafe?: unknown; version?: string } | undefined;
  if (maxApp && (maxApp.initData || maxApp.initDataUnsafe || maxApp.version)) {
    return 'max';
  }

  // Telegram нативный мост: window.Telegram.WebApp с initData
  if (w.Telegram && (w.Telegram as { WebApp?: { initData?: string } }).WebApp) {
    const tgWebApp = (w.Telegram as { WebApp: { initData?: string } }).WebApp;
    // Только если initData не пустая — если пустая, мост может быть от CDN-скрипта
    if (tgWebApp.initData) return 'telegram';
  }

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
    // Telegram Desktop (нативный клиент) инжектирует window.Telegram.WebApp
    // с заполненным initData через нативный бридж, без URL-хэша.
    // Если загрузить CDN-скрипт — он перезапишет initData пустой строкой
    // (CDN читает initData из URL-хэша, которого на Desktop-нативе нет).
    // Решение: если initData уже есть — CDN не нужен, пропускаем загрузку.
    const existingTgWebApp =
      (window as unknown as Record<string, { WebApp?: { initData?: string } }>)
        .Telegram?.WebApp;
    if (existingTgWebApp?.initData) {
      return 'telegram';
    }
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
