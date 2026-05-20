/**
 * Суперадмин — корневой контейнер. Все вкладки в `./tabs/*` (ТЗ принцип
 * модульности №1). Компонент только маршрутизирует между ними.
 */
import { useState } from 'react';
import PageHeader from '@/shared/ui/PageHeader';
import ChipTabs from '@/shared/ui/ChipTabs';

import { RoleSwitcher, SuperadminReturnButton as ReturnBtn } from './RoleSwitcher';
import DashboardTab from './tabs/DashboardTab';
import MastersTab from './tabs/MastersTab';
import HealthTab from './tabs/HealthTab';
import AuditTab from './tabs/AuditTab';
import FinanceTab from './tabs/FinanceTab';
import TicketsTab from './tabs/TicketsTab';
import SLATab from './tabs/SLATab';
import BroadcastTab from './tabs/BroadcastTab';
import SettingsTab from './tabs/SettingsTab';
import PromoCodesTab from './tabs/PromoCodesTab';
import GrowthTab from './tabs/GrowthTab';

export type SuperadminTab =
  | 'dashboard' | 'masters'  | 'finance'  | 'tickets'
  | 'sla'       | 'broadcast'| 'growth'   | 'promo'
  | 'settings'  | 'health'   | 'audit';

const TABS: { key: SuperadminTab; label: string; emoji: string }[] = [
  { key: 'dashboard', label: 'Обзор',     emoji: '📊' },
  { key: 'masters',   label: 'Мастера',   emoji: '👥' },
  { key: 'finance',   label: 'Финансы',   emoji: '💰' },
  { key: 'tickets',   label: 'Тикеты',    emoji: '🎫' },
  { key: 'sla',       label: 'SLA',       emoji: '⏱️' },
  { key: 'broadcast', label: 'Рассылка',  emoji: '📣' },
  { key: 'growth',    label: 'Рост',      emoji: '📈' },
  { key: 'promo',     label: 'Промо',     emoji: '🎁' },
  { key: 'settings',  label: 'Настройки', emoji: '⚙️' },
  { key: 'health',    label: 'Здоровье',  emoji: '🩺' },
  { key: 'audit',     label: 'Аудит',     emoji: '📜' },
];

const TAB_COMPONENTS: Record<SuperadminTab, React.FC> = {
  dashboard: DashboardTab,
  masters:   MastersTab,
  finance:   FinanceTab,
  tickets:   TicketsTab,
  sla:       SLATab,
  broadcast: BroadcastTab,
  growth:    GrowthTab,
  promo:     PromoCodesTab,
  settings:  SettingsTab,
  health:    HealthTab,
  audit:     AuditTab,
};

export default function SuperadminPanel() {
  const [tab, setTab] = useState<SuperadminTab>('dashboard');
  const ActiveTab = TAB_COMPONENTS[tab];

  return (
    <div className="px-screen-x pt-section-y pb-24 animate-fade-in">
      <PageHeader title="Суперадмин" />
      <RoleSwitcher />

      <div className="mb-5">
        <ChipTabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      <ActiveTab />
    </div>
  );
}

// Re-export для обратной совместимости импорта в App.tsx
export const SuperadminReturnButton = ReturnBtn;
