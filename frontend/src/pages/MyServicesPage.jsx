import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, X, Calendar, Shield, AlertTriangle, CheckCircle } from 'lucide-react'

const CATEGORIES = ['Tutoring', 'Printing', 'Lab Assistance', 'Equipment Sharing', 'Mentoring', 'Other']
const PRIORITIES = ['high', 'medium', 'low']

export default function MyServicesPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [services, setServices] = useState([])
  const [tutors, setTutors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showSlotForm, setShowSlotForm] = useState(null)
  const [showPolicyModal, setShowPolicyModal] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', category: 'Tutoring', price_per_hour: '', priority: 'medium', max_daily_capacity: 5, location_name: '', location_lat: '', location_lng: '', cancellation_policy: '', tutor_id: '' })
  const [slotForm, setSlotForm] = useState({ date: '', start_time: '', end_time: '' })
  const [policyResult, setPolicyResult] = useState(null)
  const [validating, setValidating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [locating, setLocating] = useState(false)

  const canCreateService = user?.role === 'student' || user?.role === 'admin'
  const canManageSlots = user?.role === 'provider' || user?.role === 'admin'

  const fetch = async () => {
    setLoading(true)
    try { const { data } = await api.get('/services/my'); setServices(data) }
    catch { toast.error('Failed to load services') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [])

  useEffect(() => {
    if (user?.role === 'admin') {
      api.get('/services/tutors').then(r => setTutors(r.data)).catch(() => setTutors([]))
    }
  }, [user])

  useEffect(() => {
    if (searchParams.get('new') === '1' && canCreateService) {
      setShowForm(true)
      searchParams.delete('new')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams, canCreateService])

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((p) => ({
          ...p,
          location_lat: pos.coords.latitude.toFixed(6),
          location_lng: pos.coords.longitude.toFixed(6),
          location_name: p.location_name || 'My Current Location',
        }))
        toast.success('Current location added')
        setLocating(false)
      },
      () => {
        toast.error('Could not fetch current location')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const createService = async e => {
    e.preventDefault()
    if (!canCreateService) {
      toast.error('Only students can add tutor services')
      return
    }
    setSubmitting(true)
    try {
      const payload = { ...form, price_per_hour: parseFloat(form.price_per_hour), max_daily_capacity: parseInt(form.max_daily_capacity) }
      if (!payload.location_lat) delete payload.location_lat
      if (!payload.location_lng) delete payload.location_lng
      if (user?.role === 'admin') {
        payload.tutor_id = payload.tutor_id ? parseInt(payload.tutor_id) : null
      } else {
        delete payload.tutor_id
      }
      await api.post('/services/', payload)
      toast.success('Service created!')
      setShowForm(false)
      setForm({ title: '', description: '', category: 'Tutoring', price_per_hour: '', priority: 'medium', max_daily_capacity: 5, location_name: '', location_lat: '', location_lng: '', cancellation_policy: '', tutor_id: '' })
      fetch()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
    finally { setSubmitting(false) }
  }

  const addSlot = async e => {
    e.preventDefault()
    if (!canManageSlots) {
      toast.error('Only providers or admin can manage slots')
      return
    }
    try {
      await api.post(`/services/${showSlotForm}/slots`, slotForm)
      toast.success('Slot added!')
        const updatePriority = async (serviceId, priority) => {
          try {
            await api.put(`/services/${serviceId}/priority`, { priority })
            toast.success('Priority updated')
            fetch()
          } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to update priority')
          }
        }

      setShowSlotForm(null)
      setSlotForm({ date: '', start_time: '', end_time: '' })
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  const validatePolicy = async (service) => {
    if (!service.cancellation_policy || service.cancellation_policy.trim() === '') {
      return toast.error('No policy to validate')
    }
    setShowPolicyModal(service)
    setPolicyResult(null)
    setValidating(true)
    try {
      const { data } = await api.post('/ai/validate-policy', { policy_text: service.cancellation_policy, service_id: service.id })
      setPolicyResult(data)
    } catch { setPolicyResult({ is_valid: false, flagged: true, issues: ['Validation service unavailable'], suggestions: 'Try again later' }) }
    finally { setValidating(false) }
  }

  const PRIORITY_COLOR = { high: 'bg-red-100 text-red-700', medium: 'bg-yellow-100 text-yellow-700', low: 'bg-green-100 text-green-700' }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">My Services</h1>
          <p className="text-slate-500 mt-1">Manage tutoring services, slots, and policy flow</p>
        </div>
        {canCreateService && <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus size={16} /> New Service</button>}
      </div>

      {loading ? <div className="text-center py-16 text-slate-400">Loading…</div>
        : services.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-500 mb-4">No services yet. Create your first one!</p>
            {canCreateService ? <button onClick={() => setShowForm(true)} className="btn-primary">Create Service</button> : <p className="text-sm text-slate-400">As a provider, you manage slots, bookings, and priorities for assigned services.</p>}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {services.map(s => (
              <div key={s.id} className="card">
                <div className="flex items-start justify-between mb-2">
                  <p className="font-semibold text-slate-800">{s.title}</p>
                  <span className={`badge ${PRIORITY_COLOR[s.priority]}`}>{s.priority}</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">{s.category} · ৳{s.price_per_hour}/hr</p>
                {s.tutor_name && <p className="text-xs text-slate-500 mb-2">Tutor: {s.tutor_name}</p>}
                {(user?.role === 'provider' || user?.role === 'admin') && (
                  <div className="mb-3">
                    <label className="label">Service Priority</label>
                    <select className="input" value={s.priority} onChange={(e) => updatePriority(s.id, e.target.value)}>
                      {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
                  <span>📚 {s.students_helped} helped</span>
                  <span>📋 {s.total_bookings} bookings</span>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  {s.policy_validated ? (
                    <span className={`badge flex items-center gap-1 ${s.policy_flagged ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {s.policy_flagged ? <AlertTriangle size={11} /> : <CheckCircle size={11} />}
                      {s.policy_flagged ? 'Policy Flagged' : 'Policy OK'}
                    </span>
                  ) : (
                    <span className="badge bg-slate-100 text-slate-500">Policy Unvalidated</span>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {canManageSlots && (
                    <button onClick={() => setShowSlotForm(s.id)} className="btn-secondary text-xs py-1.5 flex items-center gap-1">
                      <Calendar size={13} /> Add Slot
                    </button>
                  )}
                  <button onClick={() => validatePolicy(s)} className="btn-secondary text-xs py-1.5 flex items-center gap-1">
                    <Shield size={13} /> Validate Policy
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Create Service Modal */}
      {showForm && canCreateService && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 my-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold text-xl">Create Service</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={createService} className="space-y-3">
              <div><label className="label">Title</label><input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required /></div>
              <div><label className="label">Description</label><textarea className="input h-16 resize-none" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
              {user?.role === 'admin' && (
                <div>
                  <label className="label">Assign Tutor (Student)</label>
                  <select className="input" value={form.tutor_id} onChange={e => setForm(p => ({ ...p, tutor_id: e.target.value }))} required>
                    <option value="">Select a tutor</option>
                    {tutors.map(t => (
                      <option key={t.id} value={t.id}>{t.name} · rating {t.student_rating}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Category</label>
                  <select className="input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} disabled={user?.role === 'student'}>
                    {(user?.role === 'student' ? ['Tutoring'] : CATEGORIES).map(c => <option key={c}>{c}</option>)}
                  </select></div>
                <div><label className="label">Priority</label>
                  <select className="input" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                    {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                  </select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Price/hr (৳)</label><input className="input" type="number" min="0" value={form.price_per_hour} onChange={e => setForm(p => ({ ...p, price_per_hour: e.target.value }))} required /></div>
                <div><label className="label">Max Daily Capacity</label><input className="input" type="number" min="1" value={form.max_daily_capacity} onChange={e => setForm(p => ({ ...p, max_daily_capacity: e.target.value }))} /></div>
              </div>
              <div><label className="label">Location Name (optional)</label><input className="input" placeholder="e.g. Library Room 201" value={form.location_name} onChange={e => setForm(p => ({ ...p, location_name: e.target.value }))} /></div>
              <button type="button" onClick={useCurrentLocation} className="btn-secondary w-full" disabled={locating}>
                {locating ? 'Getting location…' : 'Use Current Location'}
              </button>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Latitude (optional)</label><input className="input" type="number" step="any" placeholder="23.8103" value={form.location_lat} onChange={e => setForm(p => ({ ...p, location_lat: e.target.value }))} /></div>
                <div><label className="label">Longitude (optional)</label><input className="input" type="number" step="any" placeholder="90.4125" value={form.location_lng} onChange={e => setForm(p => ({ ...p, location_lng: e.target.value }))} /></div>
              </div>
              <div><label className="label">Cancellation Policy</label><textarea className="input h-16 resize-none" placeholder="e.g. 24-hour cancellation required…" value={form.cancellation_policy} onChange={e => setForm(p => ({ ...p, cancellation_policy: e.target.value }))} /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">{submitting ? 'Creating…' : 'Create Service'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Slot Modal */}
      {showSlotForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold text-xl">Add Time Slot</h3>
              <button onClick={() => setShowSlotForm(null)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={addSlot} className="space-y-3">
              <div><label className="label">Date</label><input className="input" type="date" value={slotForm.date} onChange={e => setSlotForm(p => ({ ...p, date: e.target.value }))} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Start Time</label><input className="input" type="time" value={slotForm.start_time} onChange={e => setSlotForm(p => ({ ...p, start_time: e.target.value }))} required /></div>
                <div><label className="label">End Time</label><input className="input" type="time" value={slotForm.end_time} onChange={e => setSlotForm(p => ({ ...p, end_time: e.target.value }))} required /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowSlotForm(null)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Add Slot</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Policy Validation Modal */}
      {showPolicyModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-xl">Policy Validation</h3>
              <button onClick={() => setShowPolicyModal(null)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl mb-4">
              <p className="text-xs font-semibold text-slate-500 mb-1">POLICY TEXT</p>
              <p className="text-sm text-slate-700">{showPolicyModal.cancellation_policy}</p>
            </div>
            {validating ? (
              <div className="text-center py-6 text-slate-400">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                AI is reviewing your policy…
              </div>
            ) : policyResult ? (
              <div className={`p-4 rounded-xl ${policyResult.flagged ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {policyResult.flagged ? <AlertTriangle size={18} className="text-red-600" /> : <CheckCircle size={18} className="text-green-600" />}
                  <p className="font-semibold text-sm">{policyResult.flagged ? 'Policy Flagged' : 'Policy Approved'}</p>
                </div>
                {policyResult.issues?.length > 0 && (
                  <ul className="text-xs text-red-700 list-disc list-inside mb-2">
                    {policyResult.issues.map((i, idx) => <li key={idx}>{i}</li>)}
                  </ul>
                )}
                <p className="text-xs text-slate-600">{policyResult.suggestions}</p>
                {policyResult.note && <p className="text-xs text-slate-400 mt-2 italic">{policyResult.note}</p>}
              </div>
            ) : null}
            <button onClick={() => setShowPolicyModal(null)} className="btn-secondary w-full mt-4">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
