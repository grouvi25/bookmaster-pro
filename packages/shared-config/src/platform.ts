/** Поддерживаемые платформы. */
export const Platform = {
  TELEGRAM: 'telegram',
  VK_MAX: 'vk_max',
  WEB: 'web',
} as const;

export type PlatformType = (typeof Platform)[keyof typeof Platform];

/** AI провайдеры. */
export const AIProvider = {
  OPENAI: 'openai',
  YANDEX_GPT: 'yandexgpt',
  CLAUDE: 'claude',
} as const;

export type AIProviderType = (typeof AIProvider)[keyof typeof AIProvider];

/** Модели OpenAI по умолчанию. */
export const OPENAI_DEFAULTS = {
  MODEL_DEFAULT: 'gpt-4o-mini',
  MODEL_FAST: 'gpt-4o-mini',
  MODEL_SMART: 'gpt-4o',
  EMBEDDING_MODEL: 'text-embedding-ada-002',
  WHISPER_MODEL: 'whisper-1',
} as const;

/** Версия API. */
export const API_VERSION = 'v1';
