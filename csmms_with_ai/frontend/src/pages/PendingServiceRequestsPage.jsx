import { useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'

export default function PendingServiceRequestsPage() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/bookings/provider/pending')
      setRequests(data)
    } catch {
      toast.error('Failed to load pending requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRequests() }, [])

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/bookings/${id}/status?status=${status}`)
      toast.success(status === 'approved' ? 'Forwarded to tutor' : 'Request cancelled')
      fetchRequests()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed')
    }
  }

  const grouped = requests
    .filter((r) => !r.awaiting_tutor_approval)
    .reduce((acc, req) => {
      const key = `${req.service_title}|${req.slot_date || 'no-date'}|${req.slot_time || 'no-time'}`
      if (!acc[key]) {
        acc[key] = {
          key,
          service_title: req.service_title,
          slot_date: req.slot_date,
          slot_time: req.slot_time,
          candidates: [],
        }
      }
      acc[key].candidates.push(req)
      return acc
    }, {})

  const groups = Object.values(grouped).map((g) => ({
    ...g,
    candidates: g.candidates.sort((a, b) => {
      const byRating = (b.student_rating ?? 0) - (a.student_rating ?? 0)
      if (byRating !== 0) return byRating
      return new Date(a.booked_at).getTime() - new Date(b.booked_at).getTime()
    }),
  }))

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Pending Service Requests</h1>
          <p className="text-slate-500 mt-1">Provider-only panel to manage and shortlist requests</p>
        </div>
        <button onClick={fetchRequests} className="btn-secondary text-sm">Refresh</button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading…</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 text-slate-400">No pending requests right now</div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.key} className="card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-slate-800">{group.service_title}</p>
                  <p className="text-xs text-slate-500">{group.slot_date || 'No slot date'} {group.slot_time ? `· ${group.slot_time}` : ''}</p>
                </div>
                <span className="badge bg-amber-100 text-amber-700">{group.candidates.length} requests</span>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                {group.candidates.map((req, idx) => (
                  <div key={req.id} className={`rounded-xl border p-3 ${idx === 0 ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800">{req.student_name}</p>
                      {idx === 0 ? <span className="badge bg-emerald-100 text-emerald-700">Best Match</span> : null}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Student rating: {req.student_rating ?? 0}</p>
                    <p className="text-xs text-slate-500">Booked: {new Date(req.booked_at).toLocaleString()}</p>
                    {req.notes ? <p className="text-xs text-slate-500 mt-1 italic">"{req.notes}"</p> : null}

                    <div className="flex gap-2 mt-3">
                      <button onClick={() => updateStatus(req.id, 'approved')} className="btn-primary text-xs py-1.5">Forward To Tutor</button>
                      <button onClick={() => updateStatus(req.id, 'cancelled')} className="btn-danger text-xs py-1.5">Cancel</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}