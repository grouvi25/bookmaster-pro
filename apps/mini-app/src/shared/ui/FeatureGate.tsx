import type { ReactNode } from 'react';
import { useFeatureFlag, type FeatureFlags } from '@/hooks/useFeatureFlag';
import { useNavigate } from 'react-router-dom';
import {
  Users, Sparkles, Gift, CalendarClock, Globe,
  FileText, Mic, BarChart3,
  Check, Lock, type LucideIcon,
} from 'lucide-react';

type FeatureFlagKey = keyof Omit<FeatureFlags, 'tariff_plan'>;

interface FeatureInfo {
  /** Тариф, с которого фича доступна. */
  tariff: string;
  /** Заголовок locked-экрана. */
  title: string;
  /** Короткое описание ценности. */
  subtitle: string;
  Icon: LucideIcon;
  /** Что получит мастер — список возможностей. */
  perks: string[];
}

/**
 * Реестр описаний фич для locked-экрана.
 * Показываем не «купи», а «вот что ты получишь».
 */
const FEATURE_INFO: Record<string, FeatureInfo> = {
  crm_enabled: {
    tariff: 'Базовый',
    title: 'CRM — база клиентов',
    subtitle: 'Вся история ваших клиентов в одном месте',
    Icon: Users,
    perks: [
      'Карточки клиентов с историей визитов',
      'Телефоны, заметки и теги по каждому',
      'Сумма выручки и количество визитов',
      'Поиск по имени и номеру телефона',
      'Сегменты для рассылок и акций',
    ],
  },
  ai_advisor: {
    tariff: 'Профи',
    title: 'AI-ассистент',
    subtitle: 'Личный помощник, который знает ваш бизнес',
    Icon: Sparkles,
    perks: [
      'Чат-советник по вашим записям и клиентам',
      'Идеи постов и ответы на отзывы',
      'Подсказки, как увеличить поток клиентов',
      'Голосовой ввод вопросов',
      'Анализ загрузки и выручки',
    ],
  },
  ai_content: {
    tariff: 'Профи+AI',
    title: 'AI контент-мастер',
    subtitle: 'Тексты для соцсетей за пару секунд',
    Icon: FileText,
    perks: [
      'Готовые посты для соцсетей и сторис',
      'Ответы на отзывы клиентов',
      'FAQ и описания услуг',
      'Прогревы и акционные тексты',
      'Шаблоны под вашу нишу',
    ],
  },
  ai_voice: {
    tariff: 'Профи+AI',
    title: 'Голосовой дневник',
    subtitle: 'Надиктовали — AI оформил заметку',
    Icon: Mic,
    perks: [
      'Голосовые заметки после визита',
      'AI расшифровывает и структурирует',
      'История заметок по клиентам',
      'Быстрее, чем печатать вручную',
    ],
  },
  loyalty_enabled: {
    tariff: 'Профи',
    title: 'Программа лояльности',
    subtitle: 'Возвращайте клиентов бонусами',
    Icon: Gift,
    perks: [
      'Начисление баллов за визиты',
      'Списание баллов в счёт оплаты',
      'Гибкие правила начисления',
      'История баллов по каждому клиенту',
    ],
  },
  client_subscriptions: {
    tariff: 'Профи',
    title: 'Абонементы',
    subtitle: 'Продавайте пакеты услуг наперёд',
    Icon: CalendarClock,
    perks: [
      'Пакеты на несколько визитов',
      'Автосписание визитов из абонемента',
      'Контроль остатка по клиенту',
      'Стабильный доход вперёд',
    ],
  },
  widget_enabled: {
    tariff: 'Базовый',
    title: 'Виджет для сайта',
    subtitle: 'Онлайн-запись прямо на вашем сайте',
    Icon: Globe,
    perks: [
      'Кнопка записи для вашего сайта',
      'Встраиваемый календарь слотов',
      'Запись без перехода в мессенджер',
      'Настройка под ваш бренд',
    ],
  },
  analytics_enabled: {
    tariff: 'Профи',
    title: 'Аналитика и дашборд',
    subtitle: 'Видно, что приносит деньги',
    Icon: BarChart3,
    perks: [
      'Выручка и динамика по периодам',
      'Загрузка и топ-услуги',
      'Удержание клиентов (retention)',
      'Воронка записей',
    ],
  },
};

const DEFAULT_INFO: FeatureInfo = {
  tariff: 'Профи',
  title: 'Премиум-функция',
  subtitle: 'Доступно на старших тарифах',
  Icon: Lock,
  perks: ['Расширенные возможности для вашего бизнеса'],
};

interface FeatureGateProps {
  flag: FeatureFlagKey;
  children: ReactNode;
  fallback?: ReactNode;
}

export default function FeatureGate({ flag, children, fallback }: FeatureGateProps) {
  const enabled = useFeatureFlag(flag);

  if (enabled) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return <FeatureLockedScreen flag={flag} />;
}

function FeatureLockedScreen({ flag }: { flag: string }) {
  const navigate = useNavigate();
  const info = FEATURE_INFO[flag] || DEFAULT_INFO;
  const { Icon } = info;

  return (
    <div className="px-screen-x py-section-y flex flex-col items-center">
      <div className="w-full max-w-md flex flex-col items-center">
        <div className="relative mb-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center">
            <Icon className="w-8 h-8 text-brand-500" strokeWidth={1.6} />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-tg-bg border border-tg-secondary flex items-center justify-center">
            <Lock className="w-3 h-3 text-tg-hint" />
          </div>
        </div>

        <h2 className="text-h1 font-bold text-center mb-1">{info.title}</h2>
        <p className="text-tg-hint text-center text-body mb-5">{info.subtitle}</p>

        <div className="w-full bg-surface-elevated rounded-card p-4 mb-3">
          <div className="text-xs font-semibold text-tg-hint mb-3 uppercase tracking-wide">
            Что вы получите
          </div>
          <div className="flex flex-col gap-2.5">
            {info.perks.map((perk) => (
              <div key={perk} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-accent-emerald/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-accent-emerald" strokeWidth={2.5} />
                </div>
                <span className="text-sm text-tg-text">{perk}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full bg-brand-500/10 border border-brand-500/20 rounded-card px-4 py-3 mb-5 text-center">
          <span className="text-sm text-tg-text">
            Доступно на тарифе{' '}
            <span className="font-bold text-brand-600">«{info.tariff}»</span> и выше
          </span>
        </div>

        <button
          onClick={() => navigate('/billing')}
          className="w-full h-[52px] px-6 bg-tg-button text-tg-button-text rounded-btn text-[16px] font-semibold interactive"
        >
          Перейти на «{info.tariff}»
        </button>
      </div>
    </div>
  );
}
