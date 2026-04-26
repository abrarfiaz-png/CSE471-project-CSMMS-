import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import {
  LayoutDashboard, Plus, Calendar, BookOpen,
  ToggleLeft, ToggleRight, CheckCircle2, XCircle,
  RotateCcw, Loader2, TrendingUp, Users, Star,
  Settings, AlertCircle, Trash2
} from 'lucide-react'
import { servicesApi, bookingsApi, slotsApi } from '../api/client'
import ServiceForm from '../components/ServiceForm'
import SlotManager from '../components/SlotManager'
import toast from 'react-hot-toast'

const MOCK_PROVIDER_ID = 4  // Replace with auth context in production

const TABS = [
  { id: 'overview',  label: 'Overview',  icon: LayoutDashboard },
  { id: 'services',  label: 'My Services', icon: BookOpen },
  { id: 'slots',     label: 'Slot Manager', icon: Calendar },
  { id: 'bookings',  label: 'Bookings',  icon: Users },
]

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     cls: 'badge-orange', icon: AlertCircle },
  approved:    { label: 'Approved',    cls: 'badge-green',  icon: CheckCircle2 },
  rescheduled: { label: 'Rescheduled', cls: 'badge-blue',   icon: RotateCcw },
  completed:   { label: 'Completed',   cls: 'badge-gray',   icon: CheckCircle2 },
  cancelled:   { label: 'Cancelled',   cls: 'badge-red',    icon: XCircle },
}

const CATEGORY_COLOR = {
  tutoring:          'bg-blue-100 text-blue-700',
  printing:          'bg-slate-100 text-slate-700',
  lab_assistance:    'bg-emerald-100 text-emerald-700',
  equipment_sharing: 'bg-orange-100 text-orange-700',
  other:             'bg-purple-100 text-purple-700',
}

export default function ProviderDashboard() {
  const [tab, setTab] = useState('overview')
  const [services, setServices] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(false)
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [selectedServiceId, setSelectedServiceId] = useState(null)
  const [bookingFilter, setBookingFilter] = useState('')

  // ── Data fetching ────────────────────────────────────────────────────────────
  const fetchServices = async () => {
    setLoading(true)
    try {
      const res = await servicesApi.list()
      // Filter by provider (in production, this comes from auth)
      const mine = res.data.filter((s) => s.provider_id === MOCK_PROVIDER_ID)
      setServices(mine)
      if (!selectedServiceId && mine.length > 0) setSelectedServiceId(mine[0].id)
    } catch {
      toast.error('Failed to load services.')
    } finally {
      setLoading(false)
    }
  }

  const fetchBookings = async () => {
    try {
      const res = await bookingsApi.list({ provider_id: MOCK_PROVIDER_ID })
      setBookings(res.data)
    } catch {
      toast.error('Failed to load bookings.')
    }
  }

  useEffect(() => {
    fetchServices()
    fetchBookings()
  }, [])

  // ── Actions ──────────────────────────────────────────────────────────────────
  const toggleActive = async (svc) => {
    try {
      await servicesApi.update(svc.id, { is_active: !svc.is_active })
      toast.success(svc.is_active ? 'Service deactivated.' : 'Service activated.')
      fetchServices()
    } catch { toast.error('Failed to update service.') }
  }

  const handleBookingStatus = async (bookingId, status) => {
    try {
      await bookingsApi.updateStatus(bookingId, status)
      toast.success(`Booking ${status}.`)
      fetchBookings()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update booking.')
    }
  }

  // ── Stats ────────────────────────────────────────────────────────────────────
  const totalStudents = services.reduce((a, s) => a + (s.total_students_helped || 0), 0)
  const avgRating = services.length
    ? (services.reduce((a, s) => a + (s.average_rating || 0), 0) / services.length).toFixed(1)
    : '—'
  const pendingCount = bookings.filter((b) => b.status === 'pending').length
  const activeCount = services.filter((s) => s.is_active).length

  const filteredBookings = bookingFilter
    ? bookings.filter((b) => b.status === bookingFilter)
    : bookings

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display font-bold text-3xl text-slate-900">Provider Dashboard</h1>
          <p className="text-slate-500 mt-1">Manage your services, time slots, and student bookings.</p>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 bg-white rounded-2xl p-1.5 border border-slate-100 shadow-sm mb-8 w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all
                ${tab === id
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-200'
                  : 'text-slate-600 hover:bg-brand-50 hover:text-brand-600'
                }`}
            >
              <Icon size={15} />
              {label}
              {id === 'bookings' && pendingCount > 0 && (
                <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ──────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-6 fade-up">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Active Services', value: activeCount, icon: BookOpen, color: 'text-brand-500', bg: 'bg-brand-50' },
                { label: 'Pending Bookings', value: pendingCount, icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-50' },
                { label: 'Students Helped', value: totalStudents, icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                { label: 'Avg Rating', value: avgRating, icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-50' },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="card p-5">
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                    <Icon size={20} className={color} />
                  </div>
                  <p className="text-2xl font-display font-bold text-slate-900">{value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Recent bookings preview */}
            <div className="card p-6">
              <h3 className="font-display font-bold text-slate-800 mb-4">Recent Bookings</h3>
              {bookings.slice(0, 5).length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No bookings yet.</p>
              ) : (
                <div className="space-y-3">
                  {bookings.slice(0, 5).map((b) => {
                    const sc = STATUS_CONFIG[b.status] || STATUS_CONFIG.pending
                    return (
                      <div key={b.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {b.service?.title || `Service #${b.service_id}`}
                          </p>
                          <p className="text-xs text-slate-400">
                            {b.slot ? `${format(parseISO(b.slot.slot_date), 'dd MMM')} · ${b.slot.start_time?.slice(0,5)}` : '—'}
                          </p>
                        </div>
                        <span className={sc.cls}>{sc.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Services summary */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-slate-800">My Services</h3>
                <button onClick={() => setTab('services')} className="text-xs text-brand-500 font-semibold hover:underline">
                  Manage all →
                </button>
              </div>
              <div className="space-y-3">
                {services.slice(0, 4).map((svc) => (
                  <div key={svc.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                    <div className={`badge ${CATEGORY_COLOR[svc.category] || 'badge-gray'}`}>
                      {svc.category.replace('_', ' ')}
                    </div>
                    <span className="text-sm font-medium text-slate-800 flex-1 truncate">{svc.title}</span>
                    <div className="flex items-center gap-1 text-xs text-yellow-600">
                      <Star size={12} className="fill-yellow-400 text-yellow-400" />
                      {svc.average_rating.toFixed(1)}
                    </div>
                    <div className={`w-2 h-2 rounded-full ${svc.is_active ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SERVICES TAB ─────────────────────────────────────────────────── */}
        {tab === 'services' && (
          <div className="space-y-5 fade-up">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                <span className="font-semibold text-slate-800">{services.length}</span> services
              </p>
              <button
                onClick={() => setShowServiceForm(true)}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <Plus size={15} /> New Service
              </button>
            </div>

            {/* Service create form (modal-like inline) */}
            {showServiceForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                <ServiceForm
                  onSuccess={() => { setShowServiceForm(false); fetchServices() }}
                  onCancel={() => setShowServiceForm(false)}
                />
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-16 text-slate-400">
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : services.length === 0 ? (
              <div className="card p-12 text-center">
                <BookOpen size={40} className="mx-auto mb-3 text-slate-300" />
                <h3 className="font-display font-bold text-slate-700 text-lg">No services yet</h3>
                <p className="text-slate-400 text-sm mt-1 mb-4">Create your first service to start accepting bookings.</p>
                <button onClick={() => setShowServiceForm(true)} className="btn-primary inline-flex items-center gap-2">
                  <Plus size={15} /> Create Service
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((svc) => (
                  <div key={svc.id} className="card p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`badge ${CATEGORY_COLOR[svc.category] || 'badge-gray'} text-xs`}>
                            {svc.category.replace('_', ' ')}
                          </span>
                          <span className={`badge text-xs ${
                            svc.priority === 'high' ? 'badge-red'
                            : svc.priority === 'medium' ? 'badge-orange'
                            : 'badge-green'
                          }`}>
                            {svc.priority}
                          </span>
                        </div>
                        <h3 className="font-display font-bold text-slate-900 text-base leading-tight truncate">
                          {svc.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{svc.location_name || 'No location set'}</p>
                      </div>
                      {/* Active toggle */}
                      <button
                        onClick={() => toggleActive(svc)}
                        title={svc.is_active ? 'Deactivate' : 'Activate'}
                        className={`flex-shrink-0 transition-colors ${svc.is_active ? 'text-emerald-500 hover:text-red-400' : 'text-slate-300 hover:text-emerald-500'}`}
                      >
                        {svc.is_active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                      </button>
                    </div>

                    {/* Stats row */}
                    <div className="flex gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Star size={11} className="fill-yellow-400 text-yellow-400" />
                        {svc.average_rating.toFixed(1)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={11} /> {svc.total_students_helped} helped
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp size={11} /> {Math.round(svc.completion_rate * 100)}%
                      </span>
                      <span className="font-bold text-brand-600 ml-auto">৳{svc.price_per_hour}/hr</span>
                    </div>

                    {/* Capacity */}
                    <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2">
                      <span>Max {svc.max_capacity_per_day} students/day</span>
                      <span className={`font-semibold ${svc.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {svc.is_active ? '● Active' : '○ Inactive'}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setSelectedServiceId(svc.id); setTab('slots') }}
                        className="btn-secondary text-xs py-1.5 flex-1 flex items-center justify-center gap-1"
                      >
                        <Calendar size={13} /> Manage Slots
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SLOTS TAB ────────────────────────────────────────────────────── */}
        {tab === 'slots' && (
          <div className="fade-up">
            {/* Service selector */}
            {services.length > 0 && (
              <div className="card p-4 mb-6">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Select Service to Manage Slots
                </label>
                <select
                  value={selectedServiceId || ''}
                  onChange={(e) => setSelectedServiceId(Number(e.target.value))}
                  className="input-field max-w-sm"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedServiceId ? (
              <div className="card p-6">
                <SlotManager
                  serviceId={selectedServiceId}
                  serviceTitle={services.find((s) => s.id === selectedServiceId)?.title || ''}
                />
              </div>
            ) : (
              <div className="card p-12 text-center">
                <Calendar size={40} className="mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500">Create a service first to manage slots.</p>
                <button onClick={() => setTab('services')} className="btn-primary mt-4 inline-flex">
                  Go to Services
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── BOOKINGS TAB ─────────────────────────────────────────────────── */}
        {tab === 'bookings' && (
          <div className="space-y-5 fade-up">
            {/* Status filter pills */}
            <div className="flex flex-wrap gap-2">
              {['', 'pending', 'approved', 'rescheduled', 'completed', 'cancelled'].map((s) => (
                <button
                  key={s}
                  onClick={() => setBookingFilter(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                    ${bookingFilter === s
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'
                    }`}
                >
                  {s === '' ? `All (${bookings.length})` : `${STATUS_CONFIG[s]?.label} (${bookings.filter((b) => b.status === s).length})`}
                </button>
              ))}
            </div>

            {filteredBookings.length === 0 ? (
              <div className="card p-12 text-center">
                <Users size={40} className="mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500">No bookings found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBookings.map((booking) => {
                  const sc = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending
                  const StatusIcon = sc.icon
                  return (
                    <div key={booking.id} className="card p-5 flex items-start gap-4 fade-up">
                      <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
                        <Users size={18} className="text-brand-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">
                              {booking.service?.title || `Service #${booking.service_id}`}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Student #{booking.student_id}
                              {booking.slot && (
                                <> · {format(parseISO(booking.slot.slot_date), 'EEE dd MMM')}
                                  {' '}@ {booking.slot.start_time?.slice(0, 5)}–{booking.slot.end_time?.slice(0, 5)}</>
                              )}
                            </p>
                            {booking.notes && (
                              <p className="text-xs text-slate-400 italic mt-1">"{booking.notes}"</p>
                            )}
                          </div>
                          <span className={`${sc.cls} flex items-center gap-1`}>
                            <StatusIcon size={11} /> {sc.label}
                          </span>
                        </div>

                        {/* Provider action buttons */}
                        {booking.status === 'pending' && (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => handleBookingStatus(booking.id, 'approved')}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition-colors border border-emerald-200"
                            >
                              <CheckCircle2 size={13} /> Approve
                            </button>
                            <button
                              onClick={() => handleBookingStatus(booking.id, 'cancelled')}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold transition-colors border border-red-200"
                            >
                              <XCircle size={13} /> Decline
                            </button>
                          </div>
                        )}
                        {booking.status === 'approved' && (
                          <button
                            onClick={() => handleBookingStatus(booking.id, 'completed')}
                            className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 text-xs font-semibold transition-colors border border-brand-200"
                          >
                            <CheckCircle2 size={13} /> Mark Completed
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
