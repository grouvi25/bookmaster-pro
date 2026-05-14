/** Настройки бронирования по умолчанию. */
export const BOOKING_DEFAULTS = {
  /** Максимальное количество дней вперёд для записи. */
  MAX_ADVANCE_BOOKING_DAYS: 30,
  /** Время резервирования слота (мин) — по ТЗ 5 мин. */
  SLOT_RESERVE_MINUTES: 5,
  /** Время подтверждения waitlist-записи (мин). */
  WAITLIST_CONFIRM_MINUTES: 30,
  /** Напоминание за N часов до визита. */
  REMINDER_HOURS_BEFORE: 2,
  /** Шаг слотов по умолчанию (мин). */
  DEFAULT_SLOT_STEP_MIN: 30,
  /** Буфер между записями по умолчанию (мин). */
  DEFAULT_BUFFER_MINUTES: 0,
} as const;

/** Тайм-зона по умолчанию (Москва). */
export const DEFAULT_TIMEZONE = 'Europe/Moscow';
