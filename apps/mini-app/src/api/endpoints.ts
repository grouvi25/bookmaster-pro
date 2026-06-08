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
  yookassa_account_id?: string | null;
  link_page_enabled?: boolean;
  link_page_theme?: string;
  link_page_links?: { url: string; label?: string }[];
  noshow_deposit_amount?: number;
  noshow_prepay_percent?: number;
  payout_phone?: string;
  payout_card?: string;
  inn?: string;
}

interface ScheduleTemplatePayload {
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start?: string;
  break_end?: string;
  location_id?: number;
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
  time_start: string;
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
  promo_type: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_amount?: number;
  max_uses?: number;
  service_ids?: number[];
  valid_from?: string;
  valid_until?: string;
}

interface LoyaltySettingsPayload {
  referral_bonus?: number;
  streak_bonus?: number;
  earn_rate?: number;
  first_visit_bonus?: number;
  review_bonus?: number;
  birthday_bonus?: number;
  max_spend_percent?: number;
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


interface SupportTicketPayload {
  category?: string;
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
  identify: (initData: string, platform?: string) =>
    api.post('/auth/identify', { init_data: initData, platform }),
  register: (data: { init_data: string; role: string; name?: string; specialization?: string; city?: string; phone?: string; platform?: string; platform_id?: string }) =>
    api.post('/auth/register', {
      init_data: data.init_data,
      role: data.role,
      display_name: data.name,
      specialization: data.specialization,
      city: data.city,
      phone: data.phone,
      platform: data.platform,
      platform_id: data.platform_id,
    }),
  switchRole: (targetRole: string) =>
    api.post('/auth/switch-role', { target_role: targetRole }),
  // Cross-platform linking
  generateLinkCode: () =>
    api.get('/auth/link-code').then(r => r.data),
  applyLinkCode: (code: string) =>
    api.post('/auth/link-account', { code }).then(r => r.data),
  unlinkAccount: (identityId?: number) =>
    api.delete('/auth/link-account', { params: identityId ? { identity_id: identityId } : undefined }).then(r => r.data),
  getLinkedPlatforms: () =>
    api.get('/auth/linked-platforms').then(r => r.data),
  linkByInitData: (data: { init_data: string; code: string; platform?: string }) =>
    api.post('/auth/link-by-init-data', data).then(r => r.data),
};

// ── Masters ──
export const mastersApi = {
  getPublic: (slug: string) => api.get(`/masters/${slug}`),
  getProfile: () => api.get('/masters/me'),
  updateProfile: (data: MasterProfilePayload) =>
    api.patch('/masters/me', data),
  getSchedule: () =>
    api.get('/masters/me/schedule'),
  updateSchedule: (data: ScheduleTemplatePayload[]) =>
    api.put('/masters/me/schedule', data),
  getStats: () => api.get('/masters/me/stats'),
  getNotificationSettings: () => api.get('/masters/me/notification-settings'),
  updateNotificationSettings: (data: Record<string, boolean>) =>
    api.patch('/masters/me/notification-settings', data),
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
    api.get(`/booking/slots/${masterId}`, {
      params: { date, service_id: serviceId, tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
    }),
  getAvailableDates: (masterId: number, serviceId: number) =>
    api.get('/booking/available-dates', {
      params: { master_id: masterId, service_id: serviceId, tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
    }),
  create: (data: BookingPayload) => api.post('/booking/', data),
  cancel: (id: number, reason?: string) =>
    api.patch(`/booking/${id}`, { status: 'cancelled_by_client', cancel_reason: reason }),
  myBookings: (params?: Record<string, string>) =>
    api.get('/booking/client', { params }),
  masterBookings: (params?: Record<string, string>) =>
    api.get('/booking/master', { params }),
  complete: (id: number, priceFinal?: number) =>
    api.patch(`/booking/${id}`, { status: 'completed', price_final: priceFinal }),
  confirm: (id: number) =>
    api.patch(`/booking/${id}`, { status: 'confirmed' }),
  noShow: (id: number) =>
    api.patch(`/booking/${id}`, { status: 'no_show' }),
  cancelByMaster: (id: number, reason?: string) =>
    api.patch(`/booking/${id}`, { status: 'cancelled_by_master', cancel_reason: reason }),
  updateStatus: (id: number, data: { status: string; cancel_reason?: string; master_comment?: string; price_final?: number; event_type?: string }) =>
    api.patch(`/booking/${id}`, data),
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
  cancelAutoRenew: () =>
    api.post('/payments/subscription/cancel-auto-renew'),
  resumeAutoRenew: () =>
    api.post('/payments/subscription/resume-auto-renew'),
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
  update: (id: number, data: Partial<PromoPayload>) => api.patch(`/promo/${id}`, data),
  delete: (id: number) => api.delete(`/promo/${id}`),
  apply: (code: string) => api.post('/auth/apply-promo-code', { code }),
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
  getReferralStats: () => api.get('/loyalty/referrals/stats'),
  getReferralLink: (masterId: number) =>
    api.get(`/loyalty/referral-link/${masterId}`),
};

// ── Reviews ──
export const reviewsApi = {
  getByMaster: (masterId: number, params?: Record<string, string>) =>
    api.get(`/reviews/master/${masterId}`, { params }),
  myReviews: () => api.get('/reviews/client'),
  create: (data: ReviewPayload) => api.post('/reviews/', data),
  reply: (id: number, text: string) =>
    api.post(`/reviews/${id}/reply`, { text }),
  report: (id: number, reason: string) =>
    api.post(`/reviews/${id}/report`, { reason }),
  hide: (id: number, reason: string) =>
    api.post(`/reviews/${id}/hide`, { reason }),
  unhide: (id: number) => api.post(`/reviews/${id}/unhide`),
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
  create: (data: { name: string; phone?: string; birthday?: string; notes?: string; tags?: string[] }) =>
    api.post('/clients/', data),
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
  generateContent: (data: { template_key: string; params: Record<string, string> }) =>
    api.post('/ai/content', data),
  templates: () => api.get('/ai/templates'),
  tokens: () => api.get('/ai/tokens'),
  voiceDiary: (data: { transcript: string; client_id?: number; appointment_id?: number }) =>
    api.post('/ai/voice-diary', data),
  knowledge: {
    list: () => api.get('/ai/knowledge/docs'),
    upload: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post('/ai/knowledge/docs', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    remove: (id: number) => api.delete(`/ai/knowledge/docs/${id}`),
  },
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
  list: (params?: Record<string, string | undefined>) =>
    api.get('/support/tickets/my', { params }),
  create: (data: SupportTicketPayload) =>
    api.post('/support/tickets', data),
  reply: (id: number, text: string) =>
    api.post(`/support/tickets/${id}/reply`, { text }),
  messages: (id: number) => api.get(`/support/tickets/${id}/messages`),
  rate: (id: number, satisfaction: number) =>
    api.post(`/support/tickets/${id}/rate`, { satisfaction }),
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

// ── Agent Payouts ──
export const payoutsApi = {
  acceptAgreement: () => api.post('/payments/agent-agreement/accept'),
  history: () => api.get('/payments/payouts'),
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
  close: (id: number, resolutionNote?: string) =>
    api.post(`/support/tickets/${id}/close`, { resolution_note: resolutionNote }),
  assign: (id: number) => api.post(`/support/tickets/${id}/assign`),
  reply: (id: number, text: string) =>
    api.post(`/support/tickets/${id}/reply`, { text }),
  messages: (id: number) => api.get(`/support/tickets/${id}/messages`),
  slaStats: () => api.get('/support/sla-stats'),
  masterVerify: (masterId: number) =>
    api.post(`/superadmin/masters/${masterId}/verify`),
  mastersList: (params?: Record<string, string | undefined>) =>
    api.get('/superadmin/masters', { params }),
  reviewHide: (id: number, reason: string) =>
    api.post(`/reviews/${id}/hide`, { reason }),
  reviewUnhide: (id: number) => api.post(`/reviews/${id}/unhide`),
};

// ── Superadmin ──
export const superadminApi = {
  dashboard: () => api.get('/superadmin/dashboard'),
  masters: (params?: Record<string, string | undefined>) =>
    api.get('/superadmin/masters', { params }),
  updateMaster: (masterId: number, data: { is_verified?: boolean; is_active?: boolean; current_plan?: string }) =>
    api.patch(`/superadmin/masters/${masterId}`, data),
  verifyMaster: (masterId: number) =>
    api.post(`/superadmin/masters/${masterId}/verify`),
  healthChecks: () => api.get('/superadmin/health'),
  logs: (service: string, tail = 200) =>
    api.get('/superadmin/logs', { params: { service, tail: String(tail) } }),
  auditLog: (params?: Record<string, string>) =>
    api.get('/superadmin/audit-log', { params }),
  finance: (periodDays?: number) =>
    api.get('/superadmin/finance', {
      params: periodDays ? { period_days: periodDays } : undefined,
    }),
  tickets: (params?: Record<string, string | undefined>) =>
    api.get('/superadmin/tickets', { params }),
  ticketDetail: (id: number) => api.get(`/superadmin/tickets/${id}`),
  replyTicket: (id: number, text: string) =>
    api.post(`/superadmin/tickets/${id}/reply`, { text }),
  escalateTicket: (id: number) =>
    api.post(`/superadmin/tickets/${id}/escalate`),
  slaStats: () => api.get('/superadmin/sla-stats'),
  settings: () => api.get('/superadmin/settings'),
  updateSettings: (updates: Record<string, string | number | boolean>) =>
    api.post('/superadmin/settings', updates),
  growth: (periodDays?: number) =>
    api.get('/superadmin/growth', {
      params: periodDays ? { period_days: periodDays } : undefined,
    }),
  promoCodes: () => api.get('/superadmin/promo-codes'),
  createPromoCode: (data: {
    code: string;
    plan?: string;
    duration_days: number;
    max_uses?: number | null;
    valid_until?: string | null;
    note?: string | null;
  }) => api.post('/superadmin/promo-codes', data),
  deactivatePromoCode: (id: number) =>
    api.patch(`/superadmin/promo-codes/${id}/deactivate`),
  grantAccess: (masterId: number, data: {
    plan?: string;
    duration_days: number;
    note?: string | null;
  }) => api.post(`/superadmin/masters/${masterId}/grant-access`, data),
  deleteMaster: (masterId: number) =>
    api.delete(`/superadmin/masters/${masterId}`),
  mergeIdentities: (primaryId: number, secondaryId: number) =>
    api.post('/superadmin/merge-identities', { primary_identity_id: primaryId, secondary_identity_id: secondaryId }),
  masterAccessGrants: (masterId: number) =>
    api.get(`/superadmin/masters/${masterId}/access-grants`),
  broadcastPreview: (data: { plan_filter?: string | null; only_active?: boolean }) =>
    api.post('/superadmin/broadcast/preview', data),
  broadcastSend: (data: {
    text: string;
    plan_filter?: string | null;
    only_active?: boolean;
    button_text?: string | null;
    button_url?: string | null;
  }) => api.post('/superadmin/broadcast/send', data),

  // Модераторы (команда)
  moderators: () => api.get('/superadmin/moderators'),
  addModerator: (data: { platform_id: string; platform?: string }) =>
    api.post('/superadmin/moderators', data),
  removeModerator: (identityId: number) =>
    api.delete(`/superadmin/moderators/${identityId}`),
};


// ── Monitoring (Superadmin) ──
export const monitoringApi = {
  listErrors: (params?: { status?: string; severity?: string; limit?: number; offset?: number }) =>
    api.get('/monitoring/errors', { params }),
  updateErrorStatus: (id: number, data: { status: string }) =>
    api.patch(`/monitoring/errors/${id}`, data),
  getSolutions: (fingerprint: string) =>
    api.get(`/monitoring/solutions/${fingerprint}`),
  createSolution: (data: { fingerprint: string; solution: string }) =>
    api.post('/monitoring/solutions', data),
  listBackups: (limit?: number) =>
    api.get('/monitoring/backups', { params: { limit: limit ?? 30 } }),
  suggestSolution: (errorId: number) =>
    api.post(`/monitoring/errors/${errorId}/suggest-solution`),
};


// ── Messages (внутренняя переписка) ──
export const messagesApi = {
  threads: (params?: { offset?: number; limit?: number }) =>
    api.get(`/messages/threads`, { params }),
  openThread: (params: { client_id?: number; master_id?: number; appointment_id?: number }) =>
    api.post(`/messages/threads/open`, null, { params }),
  messages: (threadId: number, params?: { before_id?: number; limit?: number }) =>
    api.get(`/messages/threads/${threadId}`, { params }),
  send: (threadId: number, data: { text?: string; attachment_url?: string }) =>
    api.post(`/messages/threads/${threadId}/messages`, data),
  markRead: (threadId: number) =>
    api.post(`/messages/threads/${threadId}/read`),
  unread: () =>
    api.get(`/messages/unread`),
};

// ── Expenses ──

export const expensesApi = {
  list: (year?: number, month?: number, category?: string) =>
    api.get('/expenses/', { params: { year, month, category } }),
  stats: () => api.get('/expenses/stats'),
  create: (data: {
    amount: number;
    category?: string;
    description?: string;
    expense_date?: string;
    source?: string;
  }) => api.post('/expenses/', data),
  update: (id: number, data: Record<string, unknown>) =>
    api.patch(`/expenses/${id}`, data),
  delete: (id: number) => api.delete(`/expenses/${id}`),
  parseVoice: (transcript: string) =>
    api.post('/expenses/parse-voice', { transcript }),
  parseReceipt: (formData: FormData) =>
    api.post('/expenses/parse-receipt', formData),
};

// ── Rentals (аренда рабочих мест) ──

export const rentalsApi = {
  listActive: (params?: { city?: string; listing_type?: string; max_price?: number }) =>
    api.get('/rentals/', { params }),
  my: () => api.get('/rentals/my'),
  get: (id: number) => api.get(`/rentals/${id}`),
  create: (data: Record<string, unknown>) => api.post('/rentals/', data),
  update: (id: number, data: Record<string, unknown>) =>
    api.patch(`/rentals/${id}`, data),
  delete: (id: number) => api.delete(`/rentals/${id}`),
  request: (listingId: number, data: { message?: string }) =>
    api.post(`/rentals/${listingId}/request`, data),
  incomingRequests: () => api.get('/rentals/requests/incoming'),
  myRequests: () => api.get('/rentals/requests/my'),
  respond: (requestId: number, approve: boolean) =>
    api.patch(`/rentals/requests/${requestId}`, null, { params: { approve } }),
};
