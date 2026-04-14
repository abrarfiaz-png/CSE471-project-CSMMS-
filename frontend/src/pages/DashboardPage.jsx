import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'
import { ShoppingBag, Briefcase, CalendarCheck, Package, TrendingUp, Bell, Brain, Star } from 'lucide-react'

function StatCard({ icon: Icon, label, value, color, to }) {
  const content = (
    <div className="card hover:shadow-md transition-shadow group">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="font-display text-3xl font-bold text-slate-800 mt-1">{value ?? '–'}</p>
        </div>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </div>
  )
  return to ? <Link to={to}>{content}</Link> : content
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({})
  const [progress, setProgress] = useState(null)
  const [ratingHistory, setRatingHistory] = useState([])
  const [bookings, setBookings] = useState([])
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    api.get('/bookings/my').then(r => setBookings(r.data.slice(0, 4))).catch(() => {})
    api.get('/notifications/').then(r => setNotifications(r.data.slice(0, 4))).catch(() => {})
    if (user?.role === 'student') {
      api.get('/bookings/my/progress').then(r => setProgress(r.data)).catch(() => {})
      api.get('/bookings/my/ratings').then(r => setRatingHistory(r.data.slice(0, 4))).catch(() => {})
    }
    if (user?.role === 'provider' || user?.role === 'admin') {
      api.get('/services/analytics/provider').then(r => setStats(r.data)).catch(() => {})
    }
  }, [user])

  const statusColor = { pending: 'bg-yellow-100 text-yellow-700', approved: 'bg-green-100 text-green-700', rescheduled: 'bg-blue-100 text-blue-700', completed: 'bg-slate-100 text-slate-600', cancelled: 'bg-red-100 text-red-600' }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Good day, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-slate-500 mt-1">Here's what's happening on campus today.</p>
        </div>
        <span className={`badge px-3 py-1.5 text-sm capitalize ${user?.role === 'admin' ? 'bg-purple-100 text-purple-700' : user?.role === 'provider' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
          {user?.role}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ShoppingBag} label="Marketplace" value="Browse" color="bg-blue-500" to="/marketplace" />
        <StatCard icon={Briefcase} label="Services" value="Find" color="bg-emerald-500" to="/services" />
        <StatCard icon={CalendarCheck} label="Bookings" value={bookings.length} color="bg-orange-500" to="/bookings" />
        {user?.role === 'provider' || user?.role === 'admin' ? (
          <StatCard icon={TrendingUp} label="Earnings" value={`৳${stats.estimated_earnings ?? 0}`} color="bg-purple-500" to="/analytics" />
        ) : (
          <StatCard icon={Brain} label="AI Help" value="Try" color="bg-pink-500" to="/ai" />
        )}
      </div>

      {user?.role === 'provider' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Bookings', value: stats.total_bookings ?? 0 },
            { label: 'Completed', value: stats.completed_bookings ?? 0 },
            { label: 'Cancellation %', value: `${stats.cancellation_ratio ?? 0}%` },
            { label: 'Students Helped', value: stats.students_helped ?? 0 },
          ].map(s => (
            <div key={s.label} className="card text-center">
              <p className="font-display text-2xl font-bold text-slate-800">{s.value}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {user?.role === 'student' && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display font-bold text-slate-800">Taken Service Completion</h2>
            <span className="text-sm text-slate-500">{progress?.completion_percent ?? 0}%</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-blue-500"
              style={{ width: `${progress?.completion_percent ?? 0}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
            <p>Completed: {progress?.completed_services ?? 0} / {progress?.taken_services ?? 0}</p>
            <p className="flex items-center gap-1"><Star size={14} /> Rating: {progress?.student_rating ?? 0} ({progress?.ratings_received ?? 0})</p>
          </div>
        </div>
      )}

      {user?.role === 'student' && (
        <div className="card">
          <h2 className="font-display font-bold text-slate-800 mb-3">Student Rating History</h2>
          {ratingHistory.length === 0 ? (
            <p className="text-sm text-slate-400">No tutor ratings yet</p>
          ) : (
            <div className="space-y-3">
              {ratingHistory.map(r => (
                <div key={r.id} className="p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">{r.service_title}</p>
                    <span className="badge bg-amber-100 text-amber-700">{r.rating}/5</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">By tutor: {r.tutor_name}</p>
                  {r.comment && <p className="text-xs text-slate-500 mt-1 italic">"{r.comment}"</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Bookings */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-slate-800">Recent Bookings</h2>
            <Link to="/bookings" className="text-xs text-primary-600 hover:underline">View all</Link>
          </div>
          {bookings.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <CalendarCheck size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No bookings yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map(b => (
                <div key={b.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{b.service_title}</p>
                    <p className="text-xs text-slate-400">{b.provider_name} {b.slot_date ? `· ${b.slot_date}` : ''}</p>
                  </div>
                  <span className={`badge ${statusColor[b.status] || 'bg-slate-100 text-slate-600'}`}>{b.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Notifications */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-slate-800">Notifications</h2>
            <Link to="/notifications" className="text-xs text-primary-600 hover:underline">View all</Link>
          </div>
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Bell size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map(n => (
                <div key={n.id} className={`p-3 rounded-xl ${n.is_read ? 'bg-slate-50' : 'bg-primary-50 border border-primary-100'}`}>
                  <p className="text-sm font-semibold text-slate-700">{n.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <h2 className="font-display font-bold text-slate-800 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/marketplace" className="btn-secondary text-sm">🛒 Browse Marketplace</Link>
          <Link to="/services" className="btn-secondary text-sm">🔍 Find Services</Link>
          {user?.role === 'student' && <Link to="/ai" className="btn-secondary text-sm">🤖 AI Weakness Analysis</Link>}
          {user?.role === 'student' && <Link to="/my-services" className="btn-secondary text-sm">🎓 Tutor Services</Link>}
          {user?.role === 'student' && <Link to="/my-services?new=1" className="btn-secondary text-sm">➕ Add Tutor Service</Link>}
          {(user?.role === 'provider' || user?.role === 'admin') && <>
            <Link to="/my-services" className="btn-secondary text-sm">⚙️ Manage Services</Link>
            <Link to="/analytics" className="btn-secondary text-sm">📊 View Analytics</Link>
          </>}
          {user?.role === 'admin' && <Link to="/admin" className="btn-secondary text-sm">🛡 Admin Panel</Link>}
        </div>
      </div>
    </div>
  )
}
