export const BOT_USERNAME = import.meta.env.VITE_TG_BOT_USERNAME;
export const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;

export function botLink(startParam?: string): string {
  const base = `https://t.me/${BOT_USERNAME}`;
  return startParam ? `${base}?start=${startParam}` : base;
}

export function pageUrl(slug: string): string {
  return `${APP_URL}/p/${slug}`;
}
