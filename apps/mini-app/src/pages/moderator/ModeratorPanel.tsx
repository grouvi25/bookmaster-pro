/**
 * Модератор — корневой контейнер. Вкладки в `./tabs/*`
 * (ТЗ принцип №1: модульность). Только маршрутизация.
 */
import { useState } from 'react';
import PageHeader from '@/shared/ui/PageHeader';
import ChipTabs from '@/shared/ui/ChipTabs';

import TicketsTab from './tabs/TicketsTab';
import ReviewsTab from './tabs/ReviewsTab';
import VerificationTab from './tabs/VerificationTab';

type ModeratorTab = 'tickets' | 'reviews' | 'verification';

const TABS: { key: ModeratorTab; label: string; emoji: string }[] = [
  { key: 'tickets',      label: 'Тикеты',       emoji: '💬' },
  { key: 'reviews',      label: 'Отзывы',       emoji: '⭐' },
  { key: 'verification', label: 'Верификация',  emoji: '✅' },
];

const TAB_COMPONENTS: Record<ModeratorTab, React.FC> = {
  tickets:      TicketsTab,
  reviews:      ReviewsTab,
  verification: VerificationTab,
};

export default function ModeratorPanel() {
  const [tab, setTab] = useState<ModeratorTab>('tickets');
  const ActiveTab = TAB_COMPONENTS[tab];

  return (
    <div className="px-screen-x pb-24 animate-fade-in">
      <PageHeader title="Модератор" />

      <div className="mb-section-y">
        <ChipTabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      <ActiveTab />
    </div>
  );
}
