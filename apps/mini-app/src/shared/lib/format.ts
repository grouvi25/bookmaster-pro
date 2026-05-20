/**
 * Единая точка форматирования значений в проекте.
 * Все страницы импортируют отсюда — никаких локальных fmtRub/formatDate.
 */
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

/** Форматирует число в рубли: 1500 → "1 500 ₽". */
export function fmtRub(value?: number | string | null): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0);
  if (Number.isNaN(n)) return '0 ₽';
  return `${n.toLocaleString('ru')} ₽`;
}

/** Короткая дата: "12 мая". */
export function fmtDate(value?: string | Date | null): string {
  if (!value) return '';
  try {
    const d = typeof value === 'string' ? parseISO(value) : value;
    return format(d, 'd MMMM', { locale: ru });
  } catch {
    return String(value);
  }
}

/** Полная дата: "12 мая 2026". */
export function fmtFullDate(value?: string | Date | null): string {
  if (!value) return '';
  try {
    const d = typeof value === 'string' ? parseISO(value) : value;
    return format(d, 'd MMMM yyyy', { locale: ru });
  } catch {
    return String(value);
  }
}

/** Дата с днём недели: "пн, 12 мая". */
export function fmtDateWeekday(value?: string | Date | null): string {
  if (!value) return '';
  try {
    const d = typeof value === 'string' ? parseISO(value) : value;
    return format(d, 'EEEEEE, d MMM', { locale: ru });
  } catch {
    return String(value);
  }
}

/** Время: "14:30". */
export function fmtTime(value?: string | Date | null): string {
  if (!value) return '';
  try {
    const d = typeof value === 'string' ? parseISO(value) : value;
    return format(d, 'HH:mm');
  } catch {
    return String(value);
  }
}

/** Дата + время: "12 мая, 14:30". */
export function fmtDateTime(value?: string | Date | null): string {
  if (!value) return '';
  try {
    const d = typeof value === 'string' ? parseISO(value) : value;
    return format(d, 'd MMM, HH:mm', { locale: ru });
  } catch {
    return String(value);
  }
}

/** Прошло часов с момента (округлённо), для UI типа "5 ч назад". */
export function hoursAgo(value?: string | Date | null): string {
  if (!value) return '';
  try {
    const d = typeof value === 'string' ? parseISO(value) : value;
    const diffH = (Date.now() - d.getTime()) / 3600_000;
    if (diffH < 1) return 'только что';
    if (diffH < 24) return `${Math.floor(diffH)} ч назад`;
    return `${Math.floor(diffH / 24)} дн назад`;
  } catch {
    return '';
  }
}
