/** Пороги антиноу-шоу скоринга. */
export const NOSHOW_THRESHOLDS = {
  /** Показать опцию предоплаты. */
  SHOW_PREPAY_OPTION: 0.3,
  /** Рекомендовать предоплату. */
  RECOMMEND_PREPAY: 0.5,
  /** Требовать предоплату автоматически. */
  REQUIRE_PREPAY: 0.7,
} as const;

/** Веса факторов скоринга. */
export const NOSHOW_SCORING_WEIGHTS = {
  NO_SHOW_THIS_MASTER: 0.40,
  NO_SHOW_OTHER_MASTERS: 0.25,
  LAST_MINUTE_CANCEL: 0.07,
  NEW_CLIENT: 0.15,
  HAS_REVIEW: -0.10,
  ONLINE_PAYMENT: -0.08,
  LOYAL_VISITOR: -0.10,
} as const;

/** Дефолтные настройки no-show для мастера. */
export const NOSHOW_DEFAULTS = {
  DEPOSIT_AMOUNT: 0,
  PREPAY_PERCENT: 0,
  AI_THRESHOLD: 70,
  BLACKLIST_COUNT: 2,
} as const;
