import { useEffect, useState } from 'react'
import api from '../api'
import { BarChart2, TrendingUp, Users, XCircle, DollarSign, CheckCircle, Download, Calendar, ArrowUp, ArrowDown } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import toast from 'react-hot-toast'

function StatCard({ icon: Icon, label, value, color, change, trend }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="font-display text-3xl font-bold text-slate-800 mt-1">{value}</p>
          {change !== undefined && (
            <div className={`text-xs mt-2 flex items-center gap-1 ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              {trend === 'up' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              {change}% from last month
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </div>
  )
}

function TabButton({ name, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium transition-all ${
        active
          ? 'bg-primary-600 text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {name}
    </button>
  )
}

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [earnings, setEarnings] = useState(null)
  const [trends, setTrends] = useState(null)
  const [cancellations, setCancellations] = useState(null)
  const [insights, setInsights] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [peaks, setPeaks] = useState(null)
  const [report, setReport] = useState(null)
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [daysFilter, setDaysFilter] = useState(90)

  const loadData = async () => {
    setLoading(true)
    try {
      const [a, s, r, e, t, c, i, co, p] = await Promise.all([
        api.get('/services/analytics/provider'),
        api.get('/services/my'),
        api.get('/services/analytics/report'),
        api.get(`/services/analytics/earnings?days=${daysFilter}`),
        api.get(`/services/analytics/booking-trends?days=${daysFilter}`),
        api.get(`/services/analytics/cancellation-analysis?days=${daysFilter}`),
        api.get('/services/analytics/performance-insights'),
        api.get('/services/analytics/trend-comparison'),
        api.get(`/services/analytics/peak-analysis?days=${daysFilter}`)
      ])
      setStats(a.data)
      setServices(s.data)
      setReport(r.data)
      setEarnings(e.data)
      setTrends(t.data)
      setCancellations(c.data)
      setInsights(i.data)
      setComparison(co.data)
      setPeaks(p.data)
    } catch (err) {
      toast.error('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [daysFilter])

  if (loading) return <div className="text-center py-16 text-slate-400">Loading analytics…</div>

  const exportToCSV = () => {
    const headers = ['Metric', 'Value']
    const rows = [
      ['Total Bookings', stats?.total_bookings],
      ['Completed', stats?.completed_bookings],
      ['Cancelled', stats?.cancelled_bookings],
      ['Cancellation Rate', `${stats?.cancellation_ratio}%`],
      ['Total Earnings', earnings?.total_earnings],
      ['Students Helped', stats?.students_helped]
    ]
    
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    toast.success('Analytics exported')
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart2 size={32} className="text-primary-600" /> Advanced Analytics
          </h1>
          <p className="text-slate-500 mt-1">Comprehensive provider performance dashboard</p>
        </div>
        <button
          onClick={exportToCSV}
          className="btn btn-primary-outline flex items-center gap-2"
        >
          <Download size={18} /> Export Report
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-slate-500" />
            <span className="text-sm text-slate-600">Analysis Period:</span>
          </div>
          {[7, 30, 90, 180].map(days => (
            <button
              key={days}
              onClick={() => setDaysFilter(days)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                daysFilter === days
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="card">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <TabButton name="📊 Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
          <TabButton name="💰 Earnings" active={activeTab === 'earnings'} onClick={() => setActiveTab('earnings')} />
          <TabButton name="📈 Trends" active={activeTab === 'trends'} onClick={() => setActiveTab('trends')} />
          <TabButton name="❌ Cancellations" active={activeTab === 'cancellations'} onClick={() => setActiveTab('cancellations')} />
          <TabButton name="⭐ Performance" active={activeTab === 'performance'} onClick={() => setActiveTab('performance')} />
          <TabButton name="🎯 Peak Times" active={activeTab === 'peaks'} onClick={() => setActiveTab('peaks')} />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* OVERVIEW TAB */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Stats */}
          {stats && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard icon={DollarSign} label="Total Earnings" value={`৳${earnings?.total_earnings || 0}`} color="bg-emerald-500" change={comparison?.earnings_growth_percent} trend={comparison?.earnings_growth_percent >= 0 ? 'up' : 'down'} />
                <StatCard icon={Users} label="Students Helped" value={stats.students_helped} color="bg-blue-500" />
                <StatCard icon={CheckCircle} label="Completed" value={stats.completed_bookings} color="bg-green-500" />
                <StatCard icon={BarChart2} label="Total Bookings" value={stats.total_bookings} color="bg-purple-500" change={comparison?.booking_growth_percent} trend={comparison?.booking_growth_percent >= 0 ? 'up' : 'down'} />
                <StatCard icon={XCircle} label="Cancellations" value={stats.cancelled_bookings} color="bg-red-500" />
                <StatCard icon={TrendingUp} label="Cancel Rate" value={`${stats.cancellation_ratio}%`} color="bg-orange-500" />
              </div>

              {/* Booking Breakdown */}
              {stats.total_bookings > 0 && (
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

              {/* Monthly Comparison */}
              {comparison && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="card">
                    <h3 className="font-display font-bold mb-4">{comparison.current_month_name}</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Bookings</span>
                        <span className="font-semibold">{comparison.current_month.total_bookings}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Completed</span>
                        <span className="font-semibold">{comparison.current_month.completed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Earnings</span>
                        <span className="font-semibold">৳{comparison.current_month.earnings}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Completion Rate</span>
                        <span className="font-semibold">{comparison.current_month.completion_rate}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="card">
                    <h3 className="font-display font-bold mb-4">{comparison.previous_month_name}</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Bookings</span>
                        <span className="font-semibold">{comparison.previous_month.total_bookings}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Completed</span>
                        <span className="font-semibold">{comparison.previous_month.completed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Earnings</span>
                        <span className="font-semibold">৳{comparison.previous_month.earnings}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Completion Rate</span>
                        <span className="font-semibold">{comparison.previous_month.completion_rate}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* EARNINGS TAB */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'earnings' && earnings && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-display font-bold mb-4">Total Earnings: ৳{earnings.total_earnings}</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-600 mb-3">By Service</h3>
                <div className="space-y-2">
                  {earnings.by_service?.slice(0, 5).map(s => (
                    <div key={s.service_id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                      <div>
                        <p className="font-medium text-slate-800">{s.title}</p>
                        <p className="text-xs text-slate-500">{s.completed_count} bookings</p>
                      </div>
                      <span className="font-bold text-emerald-600">৳{s.earnings}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-600 mb-3">By Category</h3>
                <div className="space-y-2">
                  {Object.entries(earnings.by_category || {}).map(([cat, amt]) => (
                    <div key={cat} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                      <p className="font-medium text-slate-800">{cat}</p>
                      <span className="font-bold text-emerald-600">৳{amt}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {earnings.daily_earnings?.length > 0 && (
            <div className="card">
              <h2 className="font-display font-bold mb-4">Daily Earnings Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={earnings.daily_earnings}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="earnings" stroke="#10b981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TRENDS TAB */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'trends' && trends && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-display font-bold mb-4">Booking Trends</h2>
            {trends.trends?.length > 0 && (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={trends.trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" fill="#3b82f6" name="Total" />
                  <Bar dataKey="completed" fill="#10b981" name="Completed" />
                  <Bar dataKey="cancelled" fill="#ef4444" name="Cancelled" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* CANCELLATIONS TAB */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'cancellations' && cancellations && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="font-display font-bold mb-4">Overall Metrics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Bookings</span>
                  <span className="font-bold">{cancellations.total_bookings}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Cancelled</span>
                  <span className="font-bold text-red-600">{cancellations.total_cancelled}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Cancellation Rate</span>
                  <span className="font-bold text-red-600">{cancellations.overall_cancellation_rate}%</span>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="font-display font-bold mb-4">By Service</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {Object.entries(cancellations.by_service || {}).map(([svc, data]) => (
                  <div key={svc} className="p-2 rounded-lg bg-slate-50">
                    <div className="flex justify-between">
                      <p className="text-sm font-medium text-slate-800">{svc}</p>
                      <span className="text-sm font-bold text-red-600">{data.rate}%</span>
                    </div>
                    <p className="text-xs text-slate-500">{data.cancelled}/{data.total}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {cancellations.by_month?.length > 0 && (
            <div className="card">
              <h2 className="font-display font-bold mb-4">Monthly Cancellation Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={cancellations.by_month}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="rate" stroke="#ef4444" name="Cancellation %" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* PERFORMANCE TAB */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'performance' && insights && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {insights.top_performing?.map(s => (
              <div key={s.service_id} className="card">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-slate-900 flex-1">{s.title}</h3>
                  <span className="badge bg-green-100 text-green-700">{s.completion_rate}%</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Rating</span>
                    <span className="font-semibold">⭐ {s.average_rating}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Bookings</span>
                    <span className="font-semibold">{s.total_bookings}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Students</span>
                    <span className="font-semibold">{s.students_helped}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">This Week</span>
                    <span className="font-semibold">{s.week_completed} completed</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <h2 className="font-display font-bold mb-4">All Services Performance</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="pb-3 font-medium">Service</th>
                    <th className="pb-3 font-medium">Bookings</th>
                    <th className="pb-3 font-medium">Completion</th>
                    <th className="pb-3 font-medium">Rating</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {insights.services?.map(s => (
                    <tr key={s.service_id}>
                      <td className="py-3 font-medium text-slate-800">{s.title}</td>
                      <td className="py-3">{s.total_bookings}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500" style={{ width: `${s.completion_rate}%` }} />
                          </div>
                          <span className="text-xs font-semibold">{s.completion_rate}%</span>
                        </div>
                      </td>
                      <td className="py-3">⭐ {s.average_rating}</td>
                      <td className="py-3">
                        <span className={`badge text-xs ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                          {s.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* PEAK TIMES TAB */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'peaks' && peaks && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="font-display font-bold mb-4">Peak Hours</h2>
              <div className="space-y-2">
                {peaks.peak_hours?.map((h, i) => (
                  <div key={i} className="p-3 rounded-lg bg-slate-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800">{h.hour}:00 - {h.hour + 1}:00</p>
                        <p className="text-xs text-slate-500">{h.bookings} bookings</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-600">{h.completion_rate}%</p>
                        <p className="text-xs text-slate-500">completion</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2 className="font-display font-bold mb-4">Peak Days</h2>
              <div className="space-y-2">
                {peaks.peak_days?.map((d, i) => (
                  <div key={i} className="p-3 rounded-lg bg-slate-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800">{d.day}</p>
                        <p className="text-xs text-slate-500">{d.bookings} bookings</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-blue-600">{d.completion_rate}%</p>
                        <p className="text-xs text-slate-500">completion</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
