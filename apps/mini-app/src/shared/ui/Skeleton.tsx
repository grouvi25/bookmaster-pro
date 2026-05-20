/**
 * Skeleton loaders.
 *
 * ТЗ "База и Ai" §1.7: pulse 1.5s ease-in-out infinite.
 * Скелетон должен совпадать по форме с реальным контентом, чтобы UI
 * не прыгал на момент подгрузки.
 *
 * Базовые токены:
 *   bg:       bg-tg-secondary (как у настоящих карточек)
 *   radius:   rounded-card (16px) для карточек, rounded-lg (8px) для строк
 *   gap:      card-gap (8px) между карточками в списке
 *   padding:  p-card-inner (14px) внутри карточки
 */
import clsx from 'clsx';
import type { ReactNode } from 'react';

interface SkeletonProps {
  className?: string;
}

/** Базовый блок-плейсхолдер. Используется для строк-полосок текста. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={clsx(
        'animate-pulse rounded-lg bg-tg-secondary',
        className,
      )}
    />
  );
}

/** Контейнер карточки в скелетоне — повторяет форму реального Card. */
function SkeletonCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'animate-pulse bg-tg-secondary rounded-card p-card-inner',
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Универсальные
 * ──────────────────────────────────────────────────────────── */

/** Карточка с двумя строками текста — самый общий fallback. */
export function CardSkeleton() {
  return (
    <SkeletonCard>
      <Skeleton className="h-4 w-1/3 mb-2.5" />
      <Skeleton className="h-3 w-2/3 mb-1.5" />
      <Skeleton className="h-3 w-1/2" />
    </SkeletonCard>
  );
}

/** Список с аватаром слева — клиенты, мастера, локации, обычные records. */
export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-card-gap">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i}>
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0">
              <Skeleton className="h-4 w-1/2 mb-2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Stat-карточки (Dashboard, Finance, Growth)
 * ──────────────────────────────────────────────────────────── */

/** Одна StatCard. Совпадает с `<StatCard>` по высоте: значение + подпись. */
export function StatCardSkeleton() {
  return (
    <SkeletonCard>
      <Skeleton className="h-7 w-20 mb-2" />
      <Skeleton className="h-3 w-24" />
    </SkeletonCard>
  );
}

/** Сетка StatCard 2x N. */
export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-card-gap">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Booking / Schedule
 * ──────────────────────────────────────────────────────────── */

/** Карточка записи: цветная полоса слева, время+имя сверху, услуга снизу,
 *  статус-бейдж справа. Совпадает с master/Schedule список. */
export function BookingCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-card-gap">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i}>
          <div className="flex justify-between items-start gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Skeleton className="w-1 h-10 rounded-full shrink-0" />
              <div className="flex-1 min-w-0">
                <Skeleton className="h-4 w-2/3 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-5 w-20 rounded-badge shrink-0" />
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}

/** Карточка предстоящей записи у клиента (MyBookings):
 *  услуга + бейдж сверху, дата+время+цена снизу. */
export function MyBookingCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-card-gap">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i}>
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1 min-w-0">
              <Skeleton className="h-4 w-2/3 mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-24 rounded-badge shrink-0 ml-2" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-4 w-16" />
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * CRM / Клиенты
 * ──────────────────────────────────────────────────────────── */

/** Карточка клиента в списке: аватар, имя, телефон + кол-во визитов справа. */
export function ClientCardSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} className="!p-3.5">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0">
              <Skeleton className="h-4 w-1/2 mb-2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="w-4 h-4 rounded shrink-0" />
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Услуги / Промо
 * ──────────────────────────────────────────────────────────── */

/** Услуга / промо: название + длительность слева, цена/скидка справа. */
export function ServiceCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-card-gap">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <Skeleton className="h-4 w-2/3 mb-2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-16 shrink-0" />
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Тикеты
 * ──────────────────────────────────────────────────────────── */

/** Тикет: иконка приоритета, тема, бейдж статуса, мета-строка. */
export function TicketCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-card-gap">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i}>
          <div className="flex items-start gap-3">
            <Skeleton className="w-4 h-4 rounded shrink-0 mt-1" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-5 w-20 rounded-badge shrink-0" />
              </div>
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="w-4 h-4 rounded shrink-0" />
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Чат / диалоги
 * ──────────────────────────────────────────────────────────── */

/** Сообщения в чате: левые/правые пузыри переменной ширины. */
export function ChatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => {
        const isUser = i % 2 === 1;
        return (
          <div
            key={i}
            className={clsx(
              'flex',
              isUser ? 'justify-end' : 'justify-start',
            )}
          >
            <Skeleton
              className={clsx(
                'h-12 rounded-card',
                isUser ? 'w-2/3' : 'w-3/5',
              )}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Форма / Settings
 * ──────────────────────────────────────────────────────────── */

/** Форма с полями ввода: лейбл + 50px input. */
export function FormSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i}>
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-[50px] rounded-btn" />
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * Композитные / страничные
 * ──────────────────────────────────────────────────────────── */

/** Базовый PageSkeleton: header + 4 stat-карточки + список. */
export function PageSkeleton() {
  return (
    <div className="px-screen-x py-section-y animate-fade-in">
      <Skeleton className="h-7 w-48 mb-2" />
      <Skeleton className="h-4 w-32 mb-section-y" />
      <StatGridSkeleton count={4} />
      <div className="mt-section-y">
        <ListSkeleton count={3} />
      </div>
    </div>
  );
}

/** Скелетон страницы мастера у клиента (`/m/:slug`):
 *  большой header с аватаром по центру + список услуг + список отзывов. */
export function MasterProfileSkeleton() {
  return (
    <div className="pb-24 animate-fade-in">
      {/* Header */}
      <div className="bg-tg-secondary p-6 text-center">
        <Skeleton className="w-24 h-24 mx-auto mb-3 rounded-3xl" />
        <Skeleton className="h-5 w-40 mx-auto mb-2" />
        <Skeleton className="h-3 w-32 mx-auto" />
      </div>

      {/* Услуги */}
      <div className="px-screen-x mt-6">
        <Skeleton className="h-5 w-24 mb-3" />
        <ServiceCardSkeleton count={3} />
      </div>

      {/* Отзывы */}
      <div className="px-screen-x mt-6">
        <Skeleton className="h-5 w-24 mb-3" />
        <ListSkeleton count={2} />
      </div>
    </div>
  );
}
