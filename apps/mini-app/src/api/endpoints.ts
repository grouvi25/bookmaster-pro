import api from './client';

// ── Auth ──
export const authApi = {
  identify: (initData: string) =>
    api.post('/auth/identify', { init_data: initData }),
  register: (data: { init_data: string; role: string; name?: string; specialization?: string; city?: string; phone?: string }) =>
    api.post('/auth/register', data),
};

// ── Masters ──
export const mastersApi = {
  getPublic: (slug: string) => api.get(`/masters/${slug}/public`),
  getProfile: () => api.get('/masters/me'),
  updateProfile: (data: Record<string, unknown>) =>
    api.put('/masters/me', data),
  getSchedule: (params?: Record<string, string>) =>
    api.get('/masters/me/schedule', { params }),
  updateSchedule: (data: Record<string, unknown>) =>
    api.put('/masters/me/schedule', data),
  getStats: () => api.get('/masters/me/stats'),
};

// ── Services ──
export const servicesApi = {
  list: (masterId?: number) =>
    api.get('/services', { params: masterId ? { master_id: masterId } : {} }),
  create: (data: Record<string, unknown>) => api.post('/services', data),
  update: (id: number, data: Record<string, unknown>) =>
    api.patch(`/services/${id}`, data),
  delete: (id: number) => api.delete(`/services/${id}`),
  reorder: (order: number[]) => api.post('/services/reorder', { order }),
};

// ── Booking ──
export const bookingApi = {
  getSlots: (masterId: number, date: string) =>
    api.get('/booking/slots', { params: { master_id: masterId, date } }),
  getAvailableDates: (masterId: number, serviceId: number) =>
    api.get('/booking/available-dates', {
      params: { master_id: masterId, service_id: serviceId },
    }),
  create: (data: Record<string, unknown>) => api.post('/booking', data),
  cancel: (id: number) => api.post(`/booking/${id}/cancel`),
  myBookings: (params?: Record<string, string>) =>
    api.get('/booking/my', { params }),
  masterBookings: (params?: Record<string, string>) =>
    api.get('/booking/master', { params }),
  complete: (id: number) => api.post(`/booking/${id}/complete`),
};

// ── Payments ──
export const paymentsApi = {
  create: (data: Record<string, unknown>) => api.post('/payments/create', data),
};

// ── Client Subscriptions ──
export const subscriptionsApi = {
  list: () => api.get('/payments/client-subscriptions'),
  create: (data: Record<string, unknown>) =>
    api.post('/payments/client-subscription', data),
};

// ── Promo ──
export const promoApi = {
  validate: (code: string, masterId: number) =>
    api.post('/promo/validate', { code, master_id: masterId }),
  list: () => api.get('/promo'),
  create: (data: Record<string, unknown>) => api.post('/promo', data),
};

// ── Loyalty ──
export const loyaltyApi = {
  getBalance: (masterId: number) => api.get(`/loyalty/balance/${masterId}`),
  getHistory: (masterId: number) => api.get(`/loyalty/history/${masterId}`),
  processReferral: (referrerCode: string) =>
    api.post('/loyalty/referral', { referrer_code: referrerCode }),
  getSettings: () => api.get('/loyalty/settings'),
  updateSettings: (data: Record<string, unknown>) =>
    api.put('/loyalty/settings', data),
};

// ── Reviews ──
export const reviewsApi = {
  getByMaster: (masterId: number, params?: Record<string, string>) =>
    api.get(`/reviews/master/${masterId}`, { params }),
  create: (data: Record<string, unknown>) => api.post('/reviews', data),
  reply: (id: number, text: string) =>
    api.post(`/reviews/${id}/reply`, { text }),
};

// ── Waitlist ──
export const waitlistApi = {
  join: (data: Record<string, unknown>) => api.post('/waitlist', data),
  confirm: (id: number) => api.post(`/waitlist/${id}/confirm`),
};

// ── Clients (CRM) ──
export const clientsApi = {
  list: (params?: Record<string, string>) =>
    api.get('/clients', { params }),
  get: (id: number) => api.get(`/clients/${id}/detail`),
  addTag: (id: number, data: Record<string, unknown>) =>
    api.patch(`/clients/${id}`, data),
  addNote: (id: number, data: Record<string, unknown>) =>
    api.post(`/clients/${id}/notes`, data),
};

// ── Analytics ──
export const analyticsApi = {
  dashboard: (params?: Record<string, string>) =>
    api.get('/analytics/dashboard', { params }),
  revenue: (params?: Record<string, string>) =>
    api.get('/analytics/revenue', { params }),
};

// ── AI ──
export const aiApi = {
  ask: (data: { message: string; session_id?: string }) =>
    api.post('/ai/ask', data),
  generateContent: (data: Record<string, unknown>) =>
    api.post('/ai/content', data),
  templates: () => api.get('/ai/templates'),
  tokens: () => api.get('/ai/tokens'),
};

// ── Portfolio ──
export const portfolioApi = {
  list: (masterId: number) =>
    api.get('/portfolio', { params: { master_id: masterId } }),
  upload: (formData: FormData) =>
    api.post('/portfolio/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (id: number) => api.delete(`/portfolio/${id}`),
};

// ── Support ──
export const supportApi = {
  list: () => api.get('/support/tickets'),
  create: (data: Record<string, unknown>) =>
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
  createSlot: (data: Record<string, unknown>) =>
    api.post('/consultations/slots', data),
  createSlotsBulk: (data: Record<string, unknown>) =>
    api.post('/consultations/slots/bulk', data),
  deleteSlot: (id: number) => api.delete(`/consultations/slots/${id}`),
  book: (data: Record<string, unknown>) =>
    api.post('/consultations/book', data),
  my: (status?: string) =>
    api.get('/consultations/my', { params: status ? { status } : {} }),
  masterList: (params?: Record<string, string>) =>
    api.get('/consultations/master', { params }),
  stats: () => api.get('/consultations/stats'),
  get: (id: number) => api.get(`/consultations/${id}`),
  update: (id: number, data: Record<string, unknown>) =>
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

// ── Superadmin ──
export const superadminApi = {
  dashboard: () => api.get('/superadmin/dashboard'),
  masters: (params?: Record<string, string>) =>
    api.get('/superadmin/masters', { params }),
  healthChecks: () => api.post('/superadmin/health-checks'),
  auditLog: (params?: Record<string, string>) =>
    api.get('/superadmin/audit-log', { params }),
};
