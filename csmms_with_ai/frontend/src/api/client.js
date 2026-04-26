import axios from 'axios'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8001/api'

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
})

// ─── Services ────────────────────────────────────────────────────────────────
export const servicesApi = {
  list: (params = {}) => api.get('/services', { params }),
  get: (id) => api.get(`/services/${id}`),
  create: (data) => api.post('/services', data),
  update: (id, data) => api.patch(`/services/${id}`, data),
  delete: (id) => api.delete(`/services/${id}`),
  nearby: (params) => api.get('/services/nearby', { params }),
}

// ─── Slots ───────────────────────────────────────────────────────────────────
export const slotsApi = {
  listByService: (serviceId, params = {}) =>
    api.get(`/slots/service/${serviceId}`, { params }),
  create: (data) => api.post('/slots', data),
  block: (slotId, isBlocked) =>
    api.patch(`/slots/${slotId}/block`, { is_blocked: isBlocked }),
  delete: (slotId) => api.delete(`/slots/${slotId}`),
}

// ─── Bookings ─────────────────────────────────────────────────────────────────
export const bookingsApi = {
  create: (data) => api.post('/bookings', data),
  list: (params = {}) => api.get('/bookings', { params }),
  get: (id) => api.get(`/bookings/${id}`),
  updateStatus: (id, status) => api.patch(`/bookings/${id}/status`, { status }),
  reschedule: (id, newSlotId) =>
    api.patch(`/bookings/${id}/reschedule`, null, { params: { new_slot_id: newSlotId } }),
}

// ─── Users ───────────────────────────────────────────────────────────────────
export const usersApi = {
  register: (data) => api.post('/users/register', data),
  get: (id) => api.get(`/users/${id}`),
}

export default api
