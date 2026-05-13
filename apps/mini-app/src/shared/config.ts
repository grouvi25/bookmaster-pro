export const BOT_USERNAME = import.meta.env.VITE_TG_BOT_USERNAME || 'BookMasterProBot';

export function botLink(startParam?: string): string {
  const base = `https://t.me/${BOT_USERNAME}`;
  return startParam ? `${base}?start=${startParam}` : base;
}
