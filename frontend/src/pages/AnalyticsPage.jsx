import { useEffect, useState } from 'react'
import api from '../api'
import { BarChart2, TrendingUp, Users, XCircle, DollarSign, CheckCircle } from 'lucide-react'

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="font-display text-3xl font-bold text-slate-800 mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState(null)
  const [report, setReport] = useState(null)
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMonths, setSelectedMonths] = useState(6)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('/services/analytics/provider'),
      api.get('/services/my'),
      api.get('/services/analytics/report', { params: { months: selectedMonths, history_limit: 120 } })
    ]).then(([a, s, r]) => {
      setStats(a.data)
      setServices(s.data)
      setReport(r.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [selectedMonths])

  if (loading) return <div className="text-center py-16 text-slate-400">Loading analytics…</div>

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BarChart2 size={28} className="text-primary-600" /> Analytics Dashboard
        </h1>
        <p className="text-slate-500 mt-1">Track your service performance and earnings</p>
        {report?.generated_at && (
          <p className="text-xs text-slate-400 mt-1">
            Report generated: {new Date(report.generated_at).toLocaleString()}
          </p>
        )}
      </div>

      <div className="card flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Report Window</label>
        <select
          className="input w-auto min-w-[140px]"
          value={selectedMonths}
          onChange={(e) => setSelectedMonths(Number(e.target.value))}
        >
          <option value={3}>Last 3 months</option>
          <option value={6}>Last 6 months</option>
          <option value={12}>Last 12 months</option>
          <option value={24}>Last 24 months</option>
        </select>
        <p className="text-xs text-slate-500">This updates booking history, service efficiency, and monthly summary.</p>
      </div>

      {(stats || report?.summary) && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard icon={DollarSign} label="Estimated Earnings" value={`৳${stats?.estimated_earnings ?? report?.summary?.estimated_earnings ?? 0}`} color="bg-emerald-500" />
          <StatCard icon={Users} label="Students Helped" value={stats?.students_helped ?? 0} color="bg-blue-500" />
          <StatCard icon={CheckCircle} label="Completed" value={stats?.completed_bookings ?? report?.summary?.completed_bookings ?? 0} color="bg-green-500" />
          <StatCard icon={BarChart2} label="Total Bookings" value={stats?.total_bookings ?? report?.summary?.total_bookings ?? 0} color="bg-purple-500" />
          <StatCard icon={XCircle} label="Cancellations" value={stats?.cancelled_bookings ?? report?.summary?.cancelled_bookings ?? 0} color="bg-red-500" />
          <StatCard icon={TrendingUp} label="Cancel Rate" value={`${stats?.cancellation_ratio ?? report?.summary?.cancellation_rate ?? 0}%`} color="bg-orange-500" />
        </div>
      )}

      {/* Booking performance bar */}
      {stats && stats.total_bookings > 0 && (
        <div className="card">
          <h2 className="font-display font-bold mb-4">Booking Breakdown</h2>
          <div className="space-y-3">
            {[
              { label: 'Completed', value: stats.completed_bookings, color: 'bg-green-500' },
              { label: 'Cancelled', value: stats.cancelled_bookings, color: 'bg-red-400' },
              { label: 'Other', value: stats.total_bookings - stats.completed_bookings - stats.cancelled_bookings, color: 'bg-slate-300' }
            ].filter(s => s.value > 0).map(s => (
              <div key={s.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">{s.label}</span>
                  <span className="font-semibold">{s.value} ({Math.round(s.value / stats.total_bookings * 100)}%)</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${s.color} rounded-full transition-all`} style={{ width: `${(s.value / stats.total_bookings) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-service breakdown */}
      {services.length > 0 && (
        <div className="card">
          <h2 className="font-display font-bold mb-4">Service Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="pb-3 font-medium">Service</th>
                  <th className="pb-3 font-medium">Priority</th>
                  <th className="pb-3 font-medium">Price/hr</th>
                  <th className="pb-3 font-medium">Bookings</th>
                  <th className="pb-3 font-medium">Students</th>
                  <th className="pb-3 font-medium">Policy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {services.map(s => (
                  <tr key={s.id}>
                    <td className="py-3 font-medium text-slate-800">{s.title}</td>
                    <td className="py-3"><span className={`badge capitalize ${s.priority === 'high' ? 'bg-red-100 text-red-700' : s.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{s.priority}</span></td>
                    <td className="py-3 text-slate-600">৳{s.price_per_hour}</td>
                    <td className="py-3 text-slate-600">{s.total_bookings}</td>
                    <td className="py-3 text-slate-600">{s.students_helped}</td>
                    <td className="py-3">
                      {!s.policy_validated ? <span className="badge bg-slate-100 text-slate-500">Unvalidated</span>
                        : s.policy_flagged ? <span className="badge bg-red-100 text-red-700">Flagged</span>
                        : <span className="badge bg-green-100 text-green-700">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {report?.service_efficiency?.length > 0 && (
        <div className="card">
          <h2 className="font-display font-bold mb-4">Service Efficiency Report</h2>
          <div className="space-y-2">
            {report.service_efficiency.map((s) => (
              <div key={s.service_id} className="p-3 rounded-xl bg-slate-50">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">{s.service_title}</p>
                  <span className="badge bg-blue-100 text-blue-700">{s.efficiency_percent}%</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Bookings: {s.total_bookings} · Completed: {s.completed_bookings} · Cancelled: {s.cancelled_bookings}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {report?.monthly_summary?.length > 0 && (
        <div className="card">
          <h2 className="font-display font-bold mb-4">Monthly Performance Summary</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="pb-3 font-medium">Month</th>
                  <th className="pb-3 font-medium">Bookings</th>
                  <th className="pb-3 font-medium">Completed</th>
                  <th className="pb-3 font-medium">Cancelled</th>
                  <th className="pb-3 font-medium">Completion %</th>
                  <th className="pb-3 font-medium">Cancel %</th>
                  <th className="pb-3 font-medium">Earnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {report.monthly_summary.map((m) => (
                  <tr key={m.month}>
                    <td className="py-3 font-medium text-slate-800">{m.month}</td>
                    <td className="py-3 text-slate-600">{m.bookings}</td>
                    <td className="py-3 text-slate-600">{m.completed}</td>
                    <td className="py-3 text-slate-600">{m.cancelled}</td>
                    <td className="py-3 text-slate-600">{m.completion_rate}%</td>
                    <td className="py-3 text-slate-600">{m.cancellation_rate}%</td>
                    <td className="py-3 text-slate-600">৳{m.earnings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {report?.booking_history?.length > 0 && (
        <div className="card">
          <h2 className="font-display font-bold mb-4">Booking History Report</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {report.booking_history.slice(0, 20).map((b) => (
              <div key={b.booking_id} className="p-3 rounded-xl bg-slate-50 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{b.service_title}</p>
                  <p className="text-xs text-slate-500">{new Date(b.booked_at).toLocaleString()}</p>
                  <p className="text-xs text-slate-400">Student: {b.student_name || 'N/A'}</p>
                </div>
                <div className="text-right">
                  <span className={`badge ${b.status === 'completed' ? 'bg-green-100 text-green-700' : b.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{b.status}</span>
                  <p className="text-xs text-slate-500 mt-1">৳{b.amount}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
