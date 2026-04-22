import { useEffect, useState } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { CalendarCheck, RefreshCw, X, CheckCircle, Star } from 'lucide-react'

const STATUS_COLOR = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  pending_tutor: 'bg-indigo-100 text-indigo-700',
  rescheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-100 text-red-600'
}

export default function BookingsPage() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState([])
  const [providerBookings, setProviderBookings] = useState([])
  const [tutorPendingBookings, setTutorPendingBookings] = useState([])
  const [tutorRateBookings, setTutorRateBookings] = useState([])
  const [rescheduleBooking, setRescheduleBooking] = useState(null)
  const [rescheduleSlots, setRescheduleSlots] = useState([])
  const [newSlotId, setNewSlotId] = useState(null)
  const [rescheduling, setRescheduling] = useState(false)
  const [ratingModal, setRatingModal] = useState(null)
  const [ratingValue, setRatingValue] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('mine')

  const providerComparisonGroups = providerBookings
    .filter((b) => b.status === 'pending' && !b.awaiting_tutor_approval && b.slot_date && b.slot_time)
    .reduce((acc, booking) => {
      const key = `${booking.service_title}|${booking.slot_date}|${booking.slot_time}`
      if (!acc[key]) {
        acc[key] = {
          key,
          service_title: booking.service_title,
          slot_date: booking.slot_date,
          slot_time: booking.slot_time,
          candidates: [],
        }
      }
      acc[key].candidates.push(booking)
      return acc
    }, {})

  const groupedComparisons = Object.values(providerComparisonGroups)
    .map((group) => ({
      ...group,
      candidates: group.candidates.sort((a, b) => {
        const byRating = (b.student_rating ?? 0) - (a.student_rating ?? 0)
        if (byRating !== 0) return byRating
        return new Date(a.booked_at).getTime() - new Date(b.booked_at).getTime()
      }),
    }))
    .filter((group) => group.candidates.length > 1)

  const fetchBookings = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/bookings/my')
      setBookings(data)
      if (user?.role === 'provider' || user?.role === 'admin') {
        const { data: pd } = await api.get('/bookings/provider')
        setProviderBookings(pd)
      }
      if (user?.role === 'student') {
        const { data: td } = await api.get('/bookings/tutor/pending')
        setTutorPendingBookings(td)
        const { data: tr } = await api.get('/bookings/tutor/completed-to-rate')
        setTutorRateBookings(tr)
      }
    } catch { toast.error('Failed to load bookings') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchBookings() }, [])

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/bookings/${id}/status?status=${status}`)
      toast.success(`Booking ${status}`)
      fetchBookings()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  const cancelMine = async (id) => {
    try {
      await api.put(`/bookings/${id}/cancel`)
      toast.success('Booking cancelled')
      fetchBookings()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  const openReschedule = async (booking) => {
    setRescheduleBooking(booking)
    setNewSlotId(null)
    try {
      const { data } = await api.get(`/services/${booking.service_id}/slots`)
      setRescheduleSlots(data.filter(s => !s.is_blocked && (!s.is_booked || s.id === booking.slot_id)))
    } catch {
      setRescheduleSlots([])
      toast.error('Could not load slots')
    }
  }

  const submitReschedule = async () => {
    if (!newSlotId) return toast.error('Select a new slot')
    setRescheduling(true)
    try {
      await api.put(`/bookings/${rescheduleBooking.id}/reschedule`, { new_slot_id: newSlotId })
      toast.success('Booking rescheduled')
      setRescheduleBooking(null)
      setRescheduleSlots([])
      fetchBookings()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reschedule')
    } finally {
      setRescheduling(false)
    }
  }

  const BookingCard = ({ b, isProvider }) => (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold text-slate-800">{b.service_title}</p>
          <p className="text-xs text-slate-400">{isProvider ? `Student: ${b.student_name}` : `By: ${b.provider_name}`}</p>
        </div>
        <span className={`badge ${STATUS_COLOR[(b.awaiting_tutor_approval ? 'pending_tutor' : b.status)] || 'bg-slate-100 text-slate-500'}`}>
          {b.awaiting_tutor_approval ? 'pending_tutor' : b.status}
        </span>
      </div>
      {isProvider && <p className="text-xs text-slate-500 mb-1">Student rating: {b.student_rating ?? 0}</p>}
      {isProvider && b.tutor_name && <p className="text-xs text-slate-500 mb-1">Tutor: {b.tutor_name}</p>}
      {b.slot_date && (
        <p className="text-sm text-slate-500 flex items-center gap-1.5 mb-1">
          <CalendarCheck size={13} /> {b.slot_date} {b.slot_time && `· ${b.slot_time}`}
        </p>
      )}
      {b.notes && <p className="text-xs text-slate-400 italic mb-2">"{b.notes}"</p>}
      <p className="text-xs text-slate-400 mb-3">Booked: {new Date(b.booked_at).toLocaleDateString()}</p>
      {!isProvider && (
        <p className="text-xs text-slate-400 mb-2">Reschedules used: {b.reschedule_count}/2</p>
      )}

      {isProvider && b.status === 'pending' && !b.awaiting_tutor_approval && (
        <div className="flex gap-2">
          <button onClick={() => updateStatus(b.id, 'approved')} className="btn-primary text-xs py-1.5 flex items-center gap-1">
            <CheckCircle size={13} /> Forward To Tutor
          </button>
          <button onClick={() => updateStatus(b.id, 'cancelled')} className="btn-danger text-xs py-1.5 flex items-center gap-1">
            <X size={13} /> Cancel
          </button>
        </div>
      )}
      {isProvider && b.status === 'approved' && (
        <button onClick={() => updateStatus(b.id, 'completed')} className="btn-primary text-xs py-1.5 flex items-center gap-1">
          <CheckCircle size={13} /> Mark Completed
        </button>
      )}
      {!isProvider && b.status === 'pending' && (
        <button onClick={() => cancelMine(b.id)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
          <X size={13} /> Cancel Booking
        </button>
      )}
      {!isProvider && ['pending', 'approved', 'rescheduled'].includes(b.status) && b.reschedule_count < 2 && (
        <button onClick={() => openReschedule(b)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-2">
          <RefreshCw size={13} /> Reschedule
        </button>
      )}
    </div>
  )

  const tabs = [
    { id: 'mine', label: 'My Bookings' },
    ...(user?.role === 'provider' || user?.role === 'admin' ? [{ id: 'provider', label: 'Service Bookings' }] : []),
    ...(user?.role === 'student' ? [{ id: 'tutor', label: 'Tutor Approvals' }] : []),
  ]

  const tutorDecision = async (id, approve) => {
    try {
      await api.put(`/bookings/${id}/tutor-decision?approve=${approve}`)
      toast.success(approve ? 'Booking approved' : 'Booking rejected')
      fetchBookings()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed')
    }
  }

  const openRateModal = (booking) => {
    setRatingModal(booking)
    setRatingValue(0)
    setRatingComment('')
  }

  const submitStudentRating = async () => {
    if (!ratingModal) return
    if (ratingValue < 1 || ratingValue > 5) {
      toast.error('Please select a rating between 1 and 5')
      return
    }
    setRatingSubmitting(true)
    try {
      await api.post(`/bookings/${ratingModal.id}/rate-student`, { rating: ratingValue, comment: ratingComment || null })
      toast.success('Student rated successfully')
      setRatingModal(null)
      fetchBookings()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to rate student')
    } finally {
      setRatingSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Bookings</h1>
          <p className="text-slate-500 mt-1">Track and manage your service bookings</p>
        </div>
        <button onClick={fetchBookings} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {tabs.length > 1 && (
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading…</div>
      ) : tab === 'mine' ? (
        bookings.length === 0 ? (
          <div className="text-center py-16">
            <CalendarCheck size={48} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-500">No bookings yet. Browse services to book!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {bookings.map(b => <BookingCard key={b.id} b={b} isProvider={false} />)}
          </div>
        )
      ) : tab === 'provider' ? (
        providerBookings.length === 0 ? (
          <div className="text-center py-16 text-slate-400">No bookings for your services yet</div>
        ) : (
          <>
            {groupedComparisons.length > 0 && (
              <div className="card mb-6">
                <h3 className="font-display text-lg font-bold text-slate-800 mb-2">Slot Competition View</h3>
                <p className="text-xs text-slate-500 mb-4">Students are ranked by rating first, then earlier booking time.</p>
                <div className="space-y-4">
                  {groupedComparisons.map((group) => (
                    <div key={group.key} className="border border-slate-200 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{group.service_title}</p>
                          <p className="text-xs text-slate-500">{group.slot_date} · {group.slot_time}</p>
                        </div>
                        <span className="badge bg-amber-100 text-amber-700">{group.candidates.length} requests</span>
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        {group.candidates.map((candidate, idx) => (
                          <div key={candidate.id} className={`rounded-lg border p-3 ${idx === 0 ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-slate-700">{candidate.student_name}</p>
                              {idx === 0 ? <span className="badge bg-emerald-100 text-emerald-700">Best Match</span> : null}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Rating: {candidate.student_rating ?? 0}</p>
                            <p className="text-xs text-slate-500">Booked: {new Date(candidate.booked_at).toLocaleString()}</p>
                            <div className="flex gap-2 mt-3">
                              <button onClick={() => updateStatus(candidate.id, 'approved')} className="btn-primary text-xs py-1.5">Forward</button>
                              <button onClick={() => updateStatus(candidate.id, 'cancelled')} className="btn-danger text-xs py-1.5">Cancel</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              {providerBookings.map(b => <BookingCard key={b.id} b={b} isProvider={true} />)}
            </div>
          </>
        )
      ) : (
        <>
          {tutorPendingBookings.length === 0 ? (
            <div className="text-center py-16 text-slate-400">No tutor approvals pending</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {tutorPendingBookings.map(b => (
                <div key={b.id} className="card">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-slate-800">{b.service_title}</p>
                      <p className="text-xs text-slate-500">Student: {b.student_name} · rating {b.student_rating ?? 0}</p>
                    </div>
                    <span className="badge bg-indigo-100 text-indigo-700">pending_tutor</span>
                  </div>
                  {b.slot_date && <p className="text-xs text-slate-500 mb-2">{b.slot_date} · {b.slot_time}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => tutorDecision(b.id, true)} className="btn-primary text-xs py-1.5">Approve</button>
                    <button onClick={() => tutorDecision(b.id, false)} className="btn-danger text-xs py-1.5">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6">
            <h3 className="font-display text-lg font-bold text-slate-800 mb-3">Completed Services To Rate Students</h3>
            {tutorRateBookings.length === 0 ? (
              <div className="text-slate-400 text-sm">No completed bookings waiting for rating</div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {tutorRateBookings.map(b => (
                  <div key={b.id} className="card">
                    <p className="font-semibold text-slate-800">{b.service_title}</p>
                    <p className="text-xs text-slate-500 mt-1">Student: {b.student_name} · current rating {b.student_rating ?? 0}</p>
                    <button onClick={() => openRateModal(b)} className="btn-primary text-xs py-1.5 mt-3">Rate Student</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {ratingModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-display text-xl font-bold text-slate-800">Rate Student</h3>
            <p className="text-sm text-slate-500 mt-1">{ratingModal.student_name} · {ratingModal.service_title}</p>

            <div className="mt-4 flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRatingValue(n)} className="p-1">
                  <Star size={24} className={n <= ratingValue ? 'text-amber-500 fill-amber-500' : 'text-slate-300'} />
                </button>
              ))}
            </div>

            <div className="mt-4">
              <label className="label">Comment (optional)</label>
              <textarea
                className="input h-20 resize-none"
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Share brief feedback"
              />
            </div>

            <div className="flex gap-3 mt-5">
              <button className="btn-secondary flex-1" onClick={() => setRatingModal(null)}>Cancel</button>
              <button className="btn-primary flex-1" onClick={submitStudentRating} disabled={ratingSubmitting || ratingValue === 0}>
                {ratingSubmitting ? 'Submitting…' : 'Submit Rating'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rescheduleBooking && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-display text-xl font-bold text-slate-800 mb-2">Reschedule Booking</h3>
            <p className="text-sm text-slate-500 mb-4">{rescheduleBooking.service_title}</p>
            <div className="space-y-2 max-h-56 overflow-y-auto mb-4">
              {rescheduleSlots.length === 0 ? (
                <p className="text-sm text-slate-400">No available slots</p>
              ) : (
                rescheduleSlots.map(s => (
                  <button key={s.id} onClick={() => setNewSlotId(s.id)}
                    className={`w-full text-left p-2 rounded-lg border text-sm ${newSlotId === s.id ? 'border-primary-500 bg-primary-50' : 'border-slate-200'}`}>
                    <p className="font-medium">{s.date}</p>
                    <p className="text-xs text-slate-500">{s.start_time} - {s.end_time}</p>
                  </button>
                ))
              )}
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setRescheduleBooking(null)}>Close</button>
              <button className="btn-primary flex-1" onClick={submitReschedule} disabled={rescheduling || !newSlotId}>
                {rescheduling ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
