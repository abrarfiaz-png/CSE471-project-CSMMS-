import { useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'
import { ShieldCheck, Users, AlertTriangle, Activity, BarChart2, CheckCircle } from 'lucide-react'

export default function AdminPage() {
  const [tab, setTab] = useState('dashboard')
  const [dashStats, setDashStats] = useState(null)
  const [users, setUsers] = useState([])
  const [flagged, setFlagged] = useState([])
  const [aiLogs, setAiLogs] = useState([])
  const [overbooking, setOverbooking] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchers = {
      dashboard: () => api.get('/admin/dashboard').then(r => setDashStats(r.data)),
      users: () => api.get('/admin/users').then(r => setUsers(r.data)),
      policies: () => api.get('/admin/flagged-policies').then(r => setFlagged(r.data)),
      ai_logs: () => api.get('/admin/ai-logs').then(r => setAiLogs(r.data)),
      overbooking: () => api.get('/admin/overbooking-monitor').then(r => setOverbooking(r.data)),
    }
    setLoading(true)
    fetchers[tab]?.().catch(() => toast.error('Failed to load')).finally(() => setLoading(false))
  }, [tab])

  const toggleUser = async (id) => {
    try { await api.put(`/admin/users/${id}/toggle`); toast.success('Updated'); api.get('/admin/users').then(r => setUsers(r.data)) }
    catch { toast.error('Failed') }
  }

  const approvePolicy = async (id) => {
    try { await api.put(`/admin/services/${id}/approve-policy`); toast.success('Policy approved'); api.get('/admin/flagged-policies').then(r => setFlagged(r.data)) }
    catch { toast.error('Failed') }
  }

  const tabs = [
    { id: 'dashboard', label: '📊 Overview', icon: BarChart2 },
    { id: 'users', label: '👥 Users', icon: Users },
    { id: 'policies', label: '🚩 Flagged Policies', icon: AlertTriangle },
    { id: 'ai_logs', label: '🤖 AI Logs', icon: Activity },
    { id: 'overbooking', label: '📅 Overbooking', icon: ShieldCheck },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck size={28} className="text-purple-600" /> Admin Panel
        </h1>
        <p className="text-slate-500 mt-1">Manage users, monitor AI activity, oversee platform health</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap bg-slate-100 rounded-xl p-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-16 text-slate-400">Loading…</div> : (
        <>
          {tab === 'dashboard' && dashStats && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Total Users', value: dashStats.total_users, color: 'bg-blue-500' },
                { label: 'Total Services', value: dashStats.total_services, color: 'bg-emerald-500' },
                { label: 'Total Bookings', value: dashStats.total_bookings, color: 'bg-orange-500' },
                { label: 'Marketplace Items', value: dashStats.total_items, color: 'bg-purple-500' },
                { label: 'Flagged Policies', value: dashStats.flagged_policies, color: 'bg-red-500' },
                { label: 'AI Log Entries', value: dashStats.ai_logs, color: 'bg-pink-500' },
              ].map(s => (
                <div key={s.label} className="card">
                  <p className="text-sm text-slate-500">{s.label}</p>
                  <p className="font-display text-3xl font-bold text-slate-800 mt-1">{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'users' && (
            <div className="card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-500">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="px-4 py-3 font-medium">{u.name}</td>
                      <td className="px-4 py-3 text-slate-500">{u.email}</td>
                      <td className="px-4 py-3"><span className={`badge capitalize ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : u.role === 'provider' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{u.role}</span></td>
                      <td className="px-4 py-3"><span className={`badge ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleUser(u.id)} className="text-xs text-primary-600 hover:underline">
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'policies' && (
            flagged.length === 0 ? <div className="text-center py-16 text-slate-400">No flagged policies</div>
              : <div className="space-y-4">
                {flagged.map(s => (
                  <div key={s.id} className="card border-red-100">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-slate-800">{s.title}</p>
                        <p className="text-xs text-slate-500">By {s.provider_name}</p>
                      </div>
                      <span className="badge bg-red-100 text-red-700 flex items-center gap-1"><AlertTriangle size={11} /> Flagged</span>
                    </div>
                    <p className="text-sm text-slate-600 mb-3 p-3 bg-slate-50 rounded-lg">{s.cancellation_policy}</p>
                    <button onClick={() => approvePolicy(s.id)} className="btn-primary text-sm flex items-center gap-1.5">
                      <CheckCircle size={14} /> Override & Approve
                    </button>
                  </div>
                ))}
              </div>
          )}

          {tab === 'ai_logs' && (
            <div className="card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-500">
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">User ID</th>
                    <th className="px-4 py-3 font-medium">Input</th>
                    <th className="px-4 py-3 font-medium">Flagged</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {aiLogs.map(l => (
                    <tr key={l.id}>
                      <td className="px-4 py-3 font-medium capitalize">{l.action_type.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-slate-500">#{l.user_id}</td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{l.input_summary}</td>
                      <td className="px-4 py-3"><span className={`badge ${l.flagged ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{l.flagged ? 'Yes' : 'No'}</span></td>
                      <td className="px-4 py-3 text-slate-400">{new Date(l.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'overbooking' && (
            <div className="space-y-3">
              {overbooking.map(s => (
                <div key={s.service_id} className={`card flex items-center justify-between ${s.is_over_capacity ? 'border-red-200 bg-red-50' : ''}`}>
                  <div>
                    <p className="font-semibold text-slate-800">{s.service_title}</p>
                    <p className="text-sm text-slate-500">{s.active_bookings} / {s.max_capacity} slots filled</p>
                  </div>
                  <div className="text-right">
                    <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${s.is_over_capacity ? 'bg-red-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min((s.active_bookings / s.max_capacity) * 100, 100)}%` }} />
                    </div>
                    {s.is_over_capacity && <span className="text-xs text-red-600 font-medium mt-1 block">At Capacity</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
