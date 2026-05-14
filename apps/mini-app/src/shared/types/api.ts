/**
 * API типы — реэкспорт из @bookmaster/shared-types.
 *
 * Локальные определения заменены на общий пакет packages/shared-types.
 * Этот файл сохранён для обратной совместимости импортов.
 */
export type {
  Booking,
  Service,
  ClientCRM,
  MasterProfile,
  Payment,
  MasterSubscription,
  Promo,
  SupportTicket,
  AuditLogEntry,
  BroadcastMessage,
  Consultation,
  LoyaltyTransaction,
  PortfolioItem,
  FeatureFlags,
} from '@bookmaster/shared-types';

export {
  AppointmentStatus,
  BookingSource,
  ConsultationStatus,
  PaymentStatus,
  TariffPlan,
  NoShowRiskLevel,
  TicketStatus,
  TicketPriority,
  LoyaltyTransactionType,
  TariffType,
} from '@bookmaster/shared-types';
