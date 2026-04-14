import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEffect, useState } from 'react'
import api from '../api'
import {
  LayoutDashboard, ShoppingBag, Briefcase, CalendarCheck, Package,
  Settings, Brain, Bell, BarChart2, ShieldCheck, LogOut, Menu, X, GraduationCap, ClipboardList
} from 'lucide-react'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    api.get('/notifications/unread-count').then(r => setUnread(r.data.count)).catch(() => {})
    const interval = setInterval(() => {
      api.get('/notifications/unread-count').then(r => setUnread(r.data.count)).catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/marketplace', icon: ShoppingBag, label: 'Marketplace' },
    { to: '/services', icon: Briefcase, label: 'Services' },
    { to: '/bookings', icon: CalendarCheck, label: 'My Bookings' },
    { to: '/my-items', icon: Package, label: 'My Listings' },
    ...(user?.role === 'student' ? [
      { to: '/my-services', icon: Settings, label: 'Tutor Services' },
    ] : []),
    ...(user?.role === 'provider' || user?.role === 'admin' ? [
      { to: '/my-services', icon: Settings, label: 'My Services' },
      ...(user?.role === 'provider' ? [{ to: '/pending-service-requests', icon: ClipboardList, label: 'Pending Service Requests' }] : []),
      { to: '/analytics', icon: BarChart2, label: 'Analytics' },
    ] : []),
    { to: '/ai', icon: Brain, label: 'AI Assistant' },
    { to: '/notifications', icon: Bell, label: 'Notifications', badge: unread },
    ...(user?.role === 'admin' ? [{ to: '/admin', icon: ShieldCheck, label: 'Admin Panel' }] : []),
  ]

  const roleBadgeColor = { student: 'bg-blue-100 text-blue-700', provider: 'bg-emerald-100 text-emerald-700', admin: 'bg-purple-100 text-purple-700' }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed lg:static z-30 inset-y-0 left-0 w-64 bg-white border-r border-slate-100 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
              <GraduationCap size={20} className="text-white" />
            </div>
            <div>
              <p className="font-display font-bold text-slate-900 leading-none">CSMMS</p>
              <p className="text-xs text-slate-400 mt-0.5">Campus Marketplace</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, badge }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
              <Icon size={17} />
              <span>{label}</span>
              {badge > 0 && <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{badge}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary-700 text-sm">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{user?.name}</p>
              <span className={`badge ${roleBadgeColor[user?.role] || 'bg-slate-100 text-slate-600'}`}>{user?.role}</span>
            </div>
          </div>
          <button onClick={() => { logout(); navigate('/login') }} className="w-full flex items-center gap-2 text-sm text-slate-500 hover:text-red-500 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50">
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-slate-100">
            <Menu size={20} />
          </button>
          <span className="font-display font-bold text-slate-800">CSMMS</span>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
