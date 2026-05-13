/** Запись (бронирование) */
export interface Booking {
  id: number;
  master_id: number;
  client_id: number | null;
  service_id: number | null;
  date: string;
  time_start: string;
  time_end: string;
  time?: string;
  status: string;
  client_name: string | null;
  client_phone: string | null;
  client_comment: string | null;
  master_comment: string | null;
  service_name?: string;
  duration_min?: number;
  price?: number;
  price_final: number | null;
  discount_amount: number;
  source: string;
}

/** Услуга */
export interface Service {
  id: number;
  master_id: number;
  name: string;
  duration_min: number;
  price: number;
  price_max: number | null;
  description: string | null;
  category: string | null;
  is_active: boolean;
  is_online: boolean;
  is_consultation: boolean;
  consultation_url: string | null;
  sort_order: number;
}

/** Клиент (CRM-карточка) */
export interface ClientCRM {
  id: number;
  client_id?: number;
  name?: string;
  display_name?: string;
  phone: string | null;
  tags: string[];
  notes?: string;
  master_notes?: string;
  first_visit_date: string | null;
  last_visit_date: string | null;
  visits_count?: number;
  visit_count?: number;
  total_spent?: number;
  total_revenue?: number;
  no_show_count?: number;
  loyalty_points?: number;
  source: string | null;
}

/** Мастер (публичный профиль) */
export interface MasterProfile {
  id: number;
  display_name: string;
  slug: string;
  specialization: string | null;
  description: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  accept_online_payment: boolean;
  buffer_minutes: number;
  link_page_enabled: boolean;
  link_page_theme: string;
  link_page_links: { url: string; label?: string }[];
  current_plan: string;
  is_verified: boolean;
  rating_avg: number;
  rating_count: number;
  total_clients: number;
  total_appointments: number;
}

/** Платёж */
export interface Payment {
  id: number;
  appointment_id: number | null;
  master_id: number;
  client_id: number | null;
  amount_total: number;
  amount_paid: number;
  payment_type: string | null;
  status: string;
  yookassa_payment_id: string | null;
}

/** Подписка мастера */
export interface MasterSubscription {
  id: number;
  master_id: number;
  plan: string;
  price: number;
  billing_period: string;
  status: string;
  started_at: string;
  next_billing: string;
}

/** Промокод */
export interface Promo {
  id: number;
  master_id: number;
  promo_type: string;
  code: string | null;
  discount_type: string;
  discount_value: number;
  discount_percent?: number;
  discount_amount?: number;
  max_uses: number | null;
  usage_count?: number;
  used_count?: number;
  is_active: boolean;
}

/** Тикет поддержки */
export interface SupportTicket {
  id: number;
  master_id: number;
  subject: string;
  message?: string;
  status: string;
  created_at: string;
}

/** Аудит-лог */
export interface AuditLogEntry {
  action: string;
  user_name: string;
  details: string;
  created_at: string;
}

/** Рассылка */
export interface BroadcastMessage {
  id: number;
  title: string;
  message: string;
  segment: string;
  status: string;
  sent_count?: number;
  created_at: string;
}

/** Консультация */
export interface Consultation {
  id: number;
  master_id: number;
  client_id: number | null;
  service_id: number | null;
  status: string;
  date: string;
  time_start: string;
  client_name?: string;
  service_name?: string;
  notes?: string;
}

/** Лояльность — история */
export interface LoyaltyTransaction {
  id: number;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

/** Портфолио */
export interface PortfolioItem {
  id: number;
  image_url: string;
  description: string | null;
}
