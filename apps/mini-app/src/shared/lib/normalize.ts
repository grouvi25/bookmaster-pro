/**
 * Нормализация ответа API — поддержка как массива, так и {items: [...]} формата.
 * Позволяет фронтенду работать с любым форматом без рассинхрона.
 */
export function toArray<T = Record<string, unknown>>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && 'items' in data) {
    return (data as { items: T[] }).items;
  }
  return [];
}
