/**
 * Platform Adapter — абстракция над Telegram и MAX (VK) API.
 * Единый интерфейс для обеих платформ.
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

class PlatformAdapterClass {
  private _platform: Platform = 'unknown';

  get platform(): Platform {
    return this._platform;
  }

  /**
   * Определяем платформу по окружению.
   */
  detectPlatform(): Platform {
    if (typeof window !== 'undefined') {
      // Telegram
      if ((window as unknown as Record<string, unknown>).Telegram) {
        this._platform = 'telegram';
        return 'telegram';
      }
      // VK MAX — проверяем URL параметры или vk-bridge
      if (
        window.location.search.includes('vk_') ||
        window.location.search.includes('sign=')
      ) {
        this._platform = 'max';
        return 'max';
      }
    }
    this._platform = 'unknown';
    return 'unknown';
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
   * Получить initData для авторизации на сервере.
   */
  getInitData(): string {
    if (this._platform === 'telegram') {
      const tg = (window as unknown as Record<string, { WebApp?: { initData?: string } }>)
        .Telegram;
      return tg?.WebApp?.initData || '';
    }
    // MAX: данные из URL
    return window.location.search;
  }

  /**
   * Получить startParam (deep link параметр).
   */
  getStartParam(): string {
    if (this._platform === 'telegram') {
      const tg = (window as unknown as Record<string, { WebApp?: { initDataUnsafe?: { start_param?: string } } }>)
        .Telegram;
      const tgParam = tg?.WebApp?.initDataUnsafe?.start_param || '';
      if (tgParam) return tgParam;
    }
    // Fallback: check URL query params (used by bot's WebAppInfo url)
    const params = new URLSearchParams(window.location.search);
    return params.get('startParam') || params.get('ref') || '';
  }

  private getTelegramUser(): PlatformUser | null {
    const tg = (window as unknown as Record<string, {
      WebApp?: {
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
          };
        };
      };
    }>).Telegram;
    const user = tg?.WebApp?.initDataUnsafe?.user;
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

  private async getMaxUser(): Promise<PlatformUser | null> {
    try {
      const vkBridge = await import('@vkontakte/vk-bridge');
      const bridge = vkBridge.default;
      await bridge.send('VKWebAppInit');
      const data = await bridge.send('VKWebAppGetUserInfo');
      return {
        id: String(data.id),
        firstName: data.first_name,
        lastName: data.last_name,
        photoUrl: data.photo_200,
        platform: 'max',
      };
    } catch {
      return null;
    }
  }
}

export const PlatformAdapter = new PlatformAdapterClass();
