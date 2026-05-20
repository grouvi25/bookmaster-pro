/**
 * MasterLayout — обёртка для всех мастерских страниц.
 *
 * Даёт:
 * - pb-24 (место для TabBar снизу, 96px)
 * - bg-tg-bg text-tg-text (гарантия цветов темы)
 * - animate-fade-in (появление экрана по ТЗ §1.7)
 * - min-h-screen (контент не "схлопывается" на пустых страницах)
 *
 * НЕ даёт px-screen-x — страницы сами решают где нужен отступ
 * (для full-bleed элементов типа календаря в Schedule).
 *
 * Используется как Route layout с <Outlet>.
 */
import { Outlet } from 'react-router-dom';

export default function MasterLayout() {
  return (
    <div className="min-h-screen bg-tg-bg text-tg-text pb-24 animate-fade-in">
      <Outlet />
    </div>
  );
}
