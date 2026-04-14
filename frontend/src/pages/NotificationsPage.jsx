import { useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'
import { Bell, CheckCheck } from 'lucide-react'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    setLoading(true)
    try { const { data } = await api.get('/notifications/'); setNotifications(data) }
    catch { toast.error('Failed') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [])

  const markAllRead = async () => {
    try { await api.put('/notifications/read-all'); fetch(); toast.success('All marked as read') }
    catch { toast.error('Failed') }
  }

  const markRead = async (id) => {
    try { await api.put(`/notifications/${id}/read`); fetch() }
    catch {}
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-slate-500 mt-1">Stay updated on your bookings and services</p>
        </div>
        {notifications.some(n => !n.is_read) && (
          <button onClick={markAllRead} className="btn-secondary flex items-center gap-2 text-sm">
            <CheckCheck size={15} /> Mark all read
          </button>
        )}
      </div>

      {loading ? <div className="text-center py-16 text-slate-400">Loading…</div>
        : notifications.length === 0 ? (
          <div className="text-center py-20">
            <Bell size={48} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-500">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => (
              <div key={n.id} onClick={() => !n.is_read && markRead(n.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${n.is_read ? 'bg-white border-slate-100' : 'bg-primary-50 border-primary-200 hover:bg-primary-100'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className={`font-semibold text-sm ${n.is_read ? 'text-slate-700' : 'text-slate-900'}`}>{n.title}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{n.message}</p>
                    <p className="text-xs text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                  {!n.is_read && <div className="w-2.5 h-2.5 bg-primary-600 rounded-full mt-1 flex-shrink-0" />}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
