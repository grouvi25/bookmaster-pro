/**
 * Пресеты тем для TapLink-страницы мастера.
 * Мастер выбирает пресет, потом может кастомизировать любое свойство.
 */

export interface ThemeConfig {
  // Фон
  bg_type: 'solid' | 'image';
  bg_color: string;

  // Тексты
  text_color: string;
  hint_color: string;

  // Кнопка CTA
  button_bg: string;
  button_text: string;
  button_radius: number;

  // Карточки
  card_bg: string;
  card_radius: number;
  card_shadow: boolean;

  // Header
  header_bg: string;
  header_style: 'solid' | 'image';

  // Шрифт
  font_style: 'system' | 'rounded' | 'serif';
}

export const DEFAULT_THEME: ThemeConfig = {
  bg_type: 'solid',
  bg_color: '#f8fafc',
  text_color: '#1e293b',
  hint_color: '#64748b',
  button_bg: '#6366f1',
  button_text: '#ffffff',
  button_radius: 16,
  card_bg: '#ffffff',
  card_radius: 16,
  card_shadow: true,
  header_bg: '#6366f1',
  header_style: 'solid',
  font_style: 'system',
};

export interface ThemePreset {
  key: string;
  name: string;
  emoji: string;
  config: ThemeConfig;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    key: 'light',
    name: 'Светлая',
    emoji: '☀️',
    config: {
      ...DEFAULT_THEME,
    },
  },
  {
    key: 'dark',
    name: 'Тёмная',
    emoji: '🌙',
    config: {
      bg_type: 'solid',
      bg_color: '#0f172a',
      text_color: '#f1f5f9',
      hint_color: '#94a3b8',
      button_bg: '#818cf8',
      button_text: '#ffffff',
      button_radius: 16,
      card_bg: '#1e293b',
      card_radius: 16,
      card_shadow: false,
      header_bg: '#1e293b',
      header_style: 'solid',
      font_style: 'system',
    },
  },
  {
    key: 'warm',
    name: 'Тёплая',
    emoji: '🧡',
    config: {
      bg_type: 'solid',
      bg_color: '#fffbeb',
      text_color: '#451a03',
      hint_color: '#92400e',
      button_bg: '#f59e0b',
      button_text: '#ffffff',
      button_radius: 24,
      card_bg: '#ffffff',
      card_radius: 20,
      card_shadow: true,
      header_bg: '#f59e0b',
      header_style: 'solid',
      font_style: 'rounded',
    },
  },
  {
    key: 'ocean',
    name: 'Океан',
    emoji: '🌊',
    config: {
      bg_type: 'solid',
      bg_color: '#f0f9ff',
      text_color: '#0c4a6e',
      hint_color: '#0369a1',
      button_bg: '#0ea5e9',
      button_text: '#ffffff',
      button_radius: 12,
      card_bg: '#ffffff',
      card_radius: 12,
      card_shadow: true,
      header_bg: '#0284c7',
      header_style: 'solid',
      font_style: 'system',
    },
  },
  {
    key: 'minimal',
    name: 'Минимал',
    emoji: '⬜',
    config: {
      bg_type: 'solid',
      bg_color: '#ffffff',
      text_color: '#000000',
      hint_color: '#6b7280',
      button_bg: '#000000',
      button_text: '#ffffff',
      button_radius: 8,
      card_bg: '#f9fafb',
      card_radius: 8,
      card_shadow: false,
      header_bg: '#111827',
      header_style: 'solid',
      font_style: 'system',
    },
  },
  {
    key: 'rose',
    name: 'Розовая',
    emoji: '🌸',
    config: {
      bg_type: 'solid',
      bg_color: '#fff1f2',
      text_color: '#4c0519',
      hint_color: '#9f1239',
      button_bg: '#e11d48',
      button_text: '#ffffff',
      button_radius: 24,
      card_bg: '#ffffff',
      card_radius: 20,
      card_shadow: true,
      header_bg: '#e11d48',
      header_style: 'solid',
      font_style: 'rounded',
    },
  },
];

/** Получить theme_config по имени пресета или вернуть default. */
export function getThemeConfig(
  presetName?: string,
  overrides?: Partial<ThemeConfig>
): ThemeConfig {
  const preset = THEME_PRESETS.find((p) => p.key === presetName);
  const base = preset?.config ?? DEFAULT_THEME;
  return overrides ? { ...base, ...overrides } : base;
}

/** CSS-переменные из theme_config для inline style. */
export function themeToStyle(config: ThemeConfig): React.CSSProperties {
  return {
    '--lp-bg': config.bg_color,
    '--lp-text': config.text_color,
    '--lp-hint': config.hint_color,
    '--lp-btn-bg': config.button_bg,
    '--lp-btn-text': config.button_text,
    '--lp-btn-radius': `${config.button_radius}px`,
    '--lp-card-bg': config.card_bg,
    '--lp-card-radius': `${config.card_radius}px`,
    '--lp-card-shadow': config.card_shadow ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
    '--lp-header-bg': config.header_bg,
  } as React.CSSProperties;
}

/** Font family по стилю. */
export function fontFamily(style: ThemeConfig['font_style']): string {
  switch (style) {
    case 'rounded':
      return "'SF Pro Rounded', -apple-system, system-ui, sans-serif";
    case 'serif':
      return "'Georgia', 'Times New Roman', serif";
    default:
      return "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  }
}
