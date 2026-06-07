/**
 * Platform Adapter — абстракция над Telegram и MAX.
 * Единый интерфейс для обеих платформ.
 *
 * Telegram: глобальный объект window.Telegram.WebApp (telegram-web-app.js)
 * MAX:      глобальный объект window.WebApp (MAX Bridge, max-web-app.js)
 *           https://dev.max.ru/docs/webapps/bridge
 */

export type Platform = 'telegram' | 'max' | 'unknown';

export interface PlatformUser {
  id: string;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  platform: Platform;
}

interface MaxInitDataUnsafe {
  query_id?: string;
  auth_date?: number;
  hash?: string;
  user?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    photo_url?: string;
  };
  chat?: { id: number; type: string };
  start_param?: string;
}

interface MaxWebApp {
  initData?: string;
  initDataUnsafe?: MaxInitDataUnsafe;
  platform?: string;
  version?: string;
  ready?: () => void;
  expand?: () => void;
}

interface TelegramWebApp {
  initData?: string;
  initDataUnsafe?: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
    };
    start_param?: string;
  };
  ready?: () => void;
  expand?: () => void;
}

function getTelegram(): TelegramWebApp | undefined {
  return (window as unknown as Record<string, { WebApp?: TelegramWebApp }>).Telegram?.WebApp;
}

function getMax(): MaxWebApp | undefined {
  // MAX Bridge exposes window.WebApp. Make sure it isn't the Telegram object.
  const w = window as unknown as Record<string, unknown>;
  const maxApp = w.WebApp as MaxWebApp | undefined;
  if (maxApp && (maxApp.initDataUnsafe !== undefined || maxApp.initData !== undefined || maxApp.version !== undefined)) {
    return maxApp;
  }
  return undefined;
}

class PlatformAdapterClass {
  private _platform: Platform = 'unknown';

  get platform(): Platform {
    return this._platform;
  }

  /**
   * Определяем платформу по окружению.
   * MAX проверяем первым: его собственный window.WebApp.
   */
  detectPlatform(): Platform {
    if (typeof window !== 'undefined') {
      // MAX — собственный мост window.WebApp
      const maxApp = getMax();
      if (maxApp && maxApp.initDataUnsafe?.user) {
        this._platform = 'max';
        try {
          maxApp.ready?.();
          maxApp.expand?.();
        } catch { /* noop */ }
        return 'max';
      }
      // Telegram — с initData или user
      const tg = getTelegram();
      if (tg && (tg.initDataUnsafe?.user || tg.initData)) {
        this._platform = 'telegram';
        try {
          tg.ready?.();
          tg.expand?.();
        } catch { /* noop */ }
        return 'telegram';
      }
      // Telegram Desktop: мост есть, но initData пуст — всё равно Telegram.
      // Desktop-клиент иногда инжектит данные с задержкой.
      if (tg) {
        this._platform = 'telegram';
        try {
          tg.ready?.();
          tg.expand?.();
        } catch { /* noop */ }
        return 'telegram';
      }
      // MAX без пользователя (например, открыт вне диалога) — всё равно MAX
      if (maxApp) {
        this._platform = 'max';
        return 'max';
      }
      // Fallback: URL-параметры или UserAgent
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      const haystack = hash + search;
      if (haystack.includes('tgWebAppData') || haystack.includes('tgWebAppPlatform') || /Telegram/i.test(navigator.userAgent || '')) {
        this._platform = 'telegram';
        return 'telegram';
      }
    }
    this._platform = 'unknown';
    return 'unknown';
  }

  /**
   * Проверить, находимся ли мы в Telegram-контексте (даже без initData).
   */
  isTelegramContext(): boolean {
    if (typeof window === 'undefined') return false;
    if (getTelegram()) return true;
    const haystack = (window.location.hash || '') + (window.location.search || '');
    if (haystack.includes('tgWebAppData') || haystack.includes('tgWebAppPlatform')) return true;
    if (/Telegram/i.test(navigator.userAgent || '')) return true;
    return false;
  }

  /**
   * Получить данные текущего пользователя.
   */
  async getUser(): Promise<PlatformUser | null> {
    if (this._platform === 'telegram') {
      return this.getTelegramUser();
    }
    if (this._platform === 'max') {
      return this.getMaxUser();
    }
    return null;
  }

  /**
   * Получить initData для серверной авторизации.
   */
  getInitData(): string {
    if (this._platform === 'telegram') {
      return getTelegram()?.initData || '';
    }
    if (this._platform === 'max') {
      // MAX Bridge отдаёт строку WebAppData в window.WebApp.initData.
      const fromBridge = getMax()?.initData;
      if (fromBridge) return fromBridge;
      // Fallback: WebAppData во фрагменте URL (#WebAppData=...)
      try {
        const frag = window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : '';
        const params = new URLSearchParams(frag);
        return params.get('WebAppData') || '';
      } catch {
        return '';
      }
    }
    return '';
  }

  /**
   * Получить startParam (deep link параметр).
   */
  getStartParam(): string {
    if (this._platform === 'telegram') {
      const tgParam = getTelegram()?.initDataUnsafe?.start_param || '';
      if (tgParam) return tgParam;
    }
    if (this._platform === 'max') {
      const maxParam = getMax()?.initDataUnsafe?.start_param || '';
      if (maxParam) return maxParam;
    }
    // Fallback: query-параметры (?startParam=... / ?startapp=... / ?ref=...)
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('startParam')
      || params.get('startapp')
      || params.get('ref')
      || ''
    );
  }

  private getTelegramUser(): PlatformUser | null {
    const user = getTelegram()?.initDataUnsafe?.user;
    if (!user) return null;
    return {
      id: String(user.id),
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
      photoUrl: user.photo_url,
      platform: 'telegram',
    };
  }

  private getMaxUser(): PlatformUser | null {
    const user = getMax()?.initDataUnsafe?.user;
    if (!user) return null;
    return {
      id: String(user.id),
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
      photoUrl: user.photo_url,
      platform: 'max',
    };
  }
}

export const PlatformAdapter = new PlatformAdapterClass();
