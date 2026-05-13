import api from './client';

// ── Payload types ──

interface MasterProfilePayload {
  display_name?: string;
  description?: string;
  city?: string;
  specialization?: string;
  avatar_url?: string;
  cover_url?: string;
  phone?: string;
  address?: string;
  accept_online_payment?: boolean;
  buffer_minutes?: number;
  link_page_enabled?: boolean;
  link_page_theme?: string;
  link_page_links?: { url: string; label?: string }[];
  noshow_deposit_amount?: number;
  noshow_prepay_percent?: number;
}

interface SchedulePayload {
  working_days?: number[];
  start_time?: string;
  end_time?: string;
  slot_duration?: number;
  break_between?: number;
}

interface ServicePayload {
  name: string;
  price: number;
  duration_min: number;
  price_max?: number;
  category?: string;
  description?: string;
}

interface BookingPayload {
  master_id: number | null;
  service_id: number | null;
  date: string;
  time: string;
  client_name?: string;
  client_phone?: string;
  promo_code?: string;
  use_loyalty_points?: boolean;
}

interface PaymentPayload {
  booking_id?: number;
  appointment_id?: number;
  amount: number;
  method?: string;
  type?: string;
}

interface ClientSubscriptionPayload {
  master_id: number;
  service_id?: number;
  total_visits: number;
  price: number;
}

interface PromoPayload {
  code: string;
  discount_type?: string;
  discount_value?: number;
  discount_percent?: number;
  discount_amount?: number;
  valid_until?: string;
  max_uses?: number;
}

interface LoyaltySettingsPayload {
  cashback_percent?: number;
  welcome_bonus?: number;
  review_bonus?: number;
  referral_bonus?: number;
}

interface ReviewPayload {
  master_id?: number;
  booking_id?: number;
  appointment_id?: number;
  rating: number;
  text?: string;
}

interface WaitlistPayload {
  master_id: number;
  service_id: number;
  preferred_date?: string;
  preferred_time?: string;
  note?: string;
  phone?: string;
  comment?: string;
}

interface ClientTagPayload {
  tags?: string[];
  segment?: string;
}

interface ClientNotePayload {
  text: string;
}

interface AIContentPayload {
  type: string;
  context?: string;
  language?: string;
}

interface SupportTicketPayload {
  subject: string;
  message: string;
  priority?: string;
}

interface ConsultationSlotPayload {
  date: string;
  start_time: string;
  end_time?: string;
  service_id?: number;
  price?: number;
}

interface ConsultationBookPayload {
  slot_id: number;
  client_name?: string;
  note?: string;
}

interface ConsultationUpdatePayload {
  status?: string;
  notes?: string;
}

interface BroadcastPayload {
  title: string;
  message?: string;
  text?: string;
  segment?: string;
  segment_filter?: Record<string, unknown>;
  filters?: Record<string, string>;
}

interface BroadcastPreviewPayload {
  title?: string;
  text?: string;
  segment?: string;
  segment_filter?: Record<string, unknown>;
  filters?: Record<string, string>;
}

interface LocationPayload {
  name: string;
  address: string;
  city?: string;
  lat?: number;
  lng?: number;
  is_default?: boolean;
}

// ── Auth ──
export const authApi = {
  identify: (initData: string) =>
    api.post('/auth/identify', { init_data: initData }),
  register: (data: { init_data: string; role: string; name?: string; specialization?: string; city?: string; phone?: string }) =>
    api.post('/auth/register', data),
};

// ── Masters ──
export const mastersApi = {
  getPublic: (slug: string) => api.get(`/masters/${slug}`),
  getProfile: () => api.get('/masters/me'),
  updateProfile: (data: MasterProfilePayload) =>
    api.patch('/masters/me', data),
  getSchedule: (params?: Record<string, string>) =>
    api.get('/masters/me/schedule', { params }),
  updateSchedule: (data: SchedulePayload) =>
    api.put('/masters/me/schedule', data),
  getStats: () => api.get('/masters/me/stats'),
};

// ── Services ──
export const servicesApi = {
  list: (masterId?: number) =>
    masterId
      ? api.get(`/services/master/${masterId}`)
      : api.get('/services/my'),
  create: (data: ServicePayload) => api.post('/services/', data),
  update: (id: number, data: Partial<ServicePayload>) =>
    api.patch(`/services/${id}`, data),
  delete: (id: number) => api.delete(`/services/${id}`),
  reorder: (order: number[]) => api.post('/services/reorder', { order }),
};

// ── Booking ──
export const bookingApi = {
  getSlots: (masterId: number, date: string, serviceId: number) =>
    api.get(`/booking/slots/${masterId}`, { params: { date, service_id: serviceId } }),
  getAvailableDates: (masterId: number, serviceId: number) =>
    api.get('/booking/available-dates', {
      params: { master_id: masterId, service_id: serviceId },
    }),
  create: (data: BookingPayload) => api.post('/booking/', data),
  cancel: (id: number) =>
    api.patch(`/booking/${id}`, { status: 'cancelled_by_client' }),
  myBookings: (params?: Record<string, string>) =>
    api.get('/booking/client', { params }),
  masterBookings: (params?: Record<string, string>) =>
    api.get('/booking/master', { params }),
  complete: (id: number) =>
    api.patch(`/booking/${id}`, { status: 'completed' }),
};

// ── Payments ──
export const paymentsApi = {
  create: (data: PaymentPayload) => api.post('/payments/create', data),
  refund: (id: number) => api.post(`/payments/refund/${id}`),
};

// ── Master Billing ──
export const billingApi = {
  current: () => api.get('/payments/subscription'),
  subscribe: (data: { plan: string; billing_period: string }) =>
    api.post('/payments/subscription', data),
};

// ── Feature Flags ──
export const featureFlagsApi = {
  get: () => api.get('/feature-flags'),
};

// ── Client Subscriptions ──
export const subscriptionsApi = {
  list: () => api.get('/payments/client-subscriptions'),
  create: (data: ClientSubscriptionPayload) =>
    api.post('/payments/client-subscription', data),
  packages: (masterId: number) =>
    api.get('/payments/subscription-packages', { params: { master_id: masterId } }),
};

// ── Promo ──
export const promoApi = {
  validate: (code: string, masterId: number) =>
    api.post('/promo/validate', { code, master_id: masterId }),
  list: () => api.get('/promo/'),
  create: (data: PromoPayload) => api.post('/promo/', data),
};

// ── Loyalty ──
export const loyaltyApi = {
  getBalance: (masterId: number) => api.get(`/loyalty/balance/${masterId}`),
  getHistory: (masterId: number) => api.get(`/loyalty/history/${masterId}`),
  processReferral: (referrerCode: string) =>
    api.post('/loyalty/referral', { referrer_code: referrerCode }),
  getSettings: () => api.get('/loyalty/settings'),
  updateSettings: (data: LoyaltySettingsPayload) =>
    api.put('/loyalty/settings', data),
};

// ── Reviews ──
export const reviewsApi = {
  getByMaster: (masterId: number, params?: Record<string, string>) =>
    api.get(`/reviews/master/${masterId}`, { params }),
  create: (data: ReviewPayload) => api.post('/reviews/', data),
  reply: (id: number, text: string) =>
    api.post(`/reviews/${id}/reply`, { text }),
};

// ── Waitlist ──
export const waitlistApi = {
  join: (data: WaitlistPayload) => api.post('/waitlist/', data),
  confirm: (id: number) => api.post(`/waitlist/${id}/confirm`),
};

// ── Clients (CRM) ──
export const clientsApi = {
  list: (params?: Record<string, string>) =>
    api.get('/clients/', { params }),
  get: (id: number) => api.get(`/clients/${id}/detail`),
  addTag: (id: number, data: ClientTagPayload) =>
    api.patch(`/clients/${id}`, data),
  addNote: (id: number, data: ClientNotePayload) =>
    api.post(`/clients/${id}/notes`, data),
};

// ── Analytics ──
export const analyticsApi = {
  dashboard: (params?: Record<string, string>) =>
    api.get('/analytics/dashboard', { params }),
  revenue: (params?: Record<string, string>) =>
    api.get('/analytics/revenue', { params }),
  funnel: (params?: Record<string, string>) =>
    api.get('/analytics/funnel', { params }),
};

// ── AI ──
export const aiApi = {
  ask: (data: { message: string; session_id?: string }) =>
    api.post('/ai/ask', data),
  generateContent: (data: AIContentPayload) =>
    api.post('/ai/content', data),
  templates: () => api.get('/ai/templates'),
  tokens: () => api.get('/ai/tokens'),
  voiceDiary: (data: { transcript: string; client_id?: number; appointment_id?: number }) =>
    api.post('/ai/voice-diary', data),
};

// ── Portfolio ──
export const portfolioApi = {
  list: (masterId: number) =>
    api.get(`/portfolio/master/${masterId}`),
  upload: (data: { s3_key: string; caption?: string; client_id?: number; appointment_id?: number }) =>
    api.post('/portfolio/', data),
  delete: (id: number) => api.delete(`/portfolio/${id}`),
};

// ── Support ──
export const supportApi = {
  list: () => api.get('/support/tickets/my'),
  create: (data: SupportTicketPayload) =>
    api.post('/support/tickets', data),
  reply: (id: number, text: string) =>
    api.post(`/support/tickets/${id}/reply`, { text }),
};

// ── Consultations ──
export const consultationsApi = {
  getSlots: (masterId: number, serviceId?: number) =>
    api.get(`/consultations/slots/${masterId}`, {
      params: serviceId ? { service_id: serviceId } : {},
    }),
  createSlot: (data: ConsultationSlotPayload) =>
    api.post('/consultations/slots', data),
  createSlotsBulk: (data: { slots: ConsultationSlotPayload[] }) =>
    api.post('/consultations/slots/bulk', data),
  deleteSlot: (id: number) => api.delete(`/consultations/slots/${id}`),
  book: (data: ConsultationBookPayload) =>
    api.post('/consultations/book', data),
  my: (status?: string) =>
    api.get('/consultations/my', { params: status ? { status } : {} }),
  masterList: (params?: Record<string, string>) =>
    api.get('/consultations/master', { params }),
  stats: () => api.get('/consultations/stats'),
  get: (id: number) => api.get(`/consultations/${id}`),
  update: (id: number, data: ConsultationUpdatePayload) =>
    api.patch(`/consultations/${id}`, data),
  cancel: (id: number, reason?: string) =>
    api.post(`/consultations/${id}/cancel`, null, {
      params: reason ? { reason } : {},
    }),
  convert: (id: number, appointmentId: number) =>
    api.post(`/consultations/${id}/convert`, {
      appointment_id: appointmentId,
    }),
};

// ── Broadcast ──
export const broadcastApi = {
  list: () => api.get('/broadcast/'),
  create: (data: BroadcastPayload) => api.post('/broadcast/', data),
  previewSegment: (data: BroadcastPreviewPayload) =>
    api.post('/broadcast/preview-segment', data),
  send: (id: number) => api.post(`/broadcast/${id}/send`),
};

// ── NPS ──
export const npsApi = {
  current: () => api.get('/nps/current'),
  submit: (data: { score: number; comment?: string }) =>
    api.post('/nps/submit', data),
  dashboard: (quarter?: string) =>
    api.get('/nps/dashboard', { params: quarter ? { quarter } : {} }),
};

// ── Locations ──
export const locationsApi = {
  list: () => api.get('/masters/me/locations'),
  create: (data: LocationPayload) =>
    api.post('/masters/me/locations', data),
  update: (id: number, data: Partial<LocationPayload>) =>
    api.patch(`/masters/me/locations/${id}`, data),
  delete: (id: number) => api.delete(`/masters/me/locations/${id}`),
};

// ── Uploads (S3) ──
export const uploadsApi = {
  getPresignedUrl: (folder: string, extension: string) =>
    api.post('/uploads/presigned-url', null, { params: { folder, extension } }),
  uploadFile: (file: File, folder: string = 'uploads') => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/uploads/file', formData, {
      params: { folder },
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ── Blocked Slots ──
export const blockedSlotsApi = {
  list: () => api.get('/booking/blocked'),
  create: (data: { date_from: string; date_to: string; time_from?: string; time_to?: string; reason?: string }) =>
    api.post('/booking/blocked', data),
  delete: (id: number) => api.delete(`/booking/blocked/${id}`),
};

// ── Moderation ──
export const moderationApi = {
  queue: (params?: Record<string, string | undefined>) =>
    api.get('/support/tickets/queue', { params }),
  resolve: (id: number) => api.post(`/support/tickets/${id}/resolve`),
  reply: (id: number, text: string) =>
    api.post(`/support/tickets/${id}/reply`, { text }),
  messages: (id: number) => api.get(`/support/tickets/${id}/messages`),
  masterVerify: (masterId: number) =>
    api.post(`/superadmin/masters/${masterId}/verify`),
  mastersList: (params?: Record<string, string | undefined>) =>
    api.get('/superadmin/masters', { params }),
};

// ── Superadmin ──
export const superadminApi = {
  dashboard: () => api.get('/superadmin/dashboard'),
  masters: (params?: Record<string, string | undefined>) =>
    api.get('/superadmin/masters', { params }),
  healthChecks: () => api.get('/superadmin/health'),
  auditLog: (params?: Record<string, string>) =>
    api.get('/superadmin/audit-log', { params }),
  finance: () => api.get('/superadmin/finance'),
  tickets: (params?: Record<string, string | undefined>) =>
    api.get('/superadmin/tickets', { params }),
  escalateTicket: (id: number) =>
    api.post(`/superadmin/tickets/${id}/escalate`),
  settings: () => api.get('/superadmin/settings'),
  growth: () => api.get('/superadmin/growth'),
};
