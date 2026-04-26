import { Link, useLocation } from 'react-router-dom'
import { BookOpen, MapPin, LayoutDashboard, ShoppingBag } from 'lucide-react'

const navLinks = [
  { to: '/',           label: 'Services',   icon: ShoppingBag },
  { to: '/map',        label: 'Map Discovery', icon: MapPin },
  { to: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
]

export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center shadow-md shadow-brand-200">
              <BookOpen size={18} className="text-white" />
            </div>
            <span className="font-display font-bold text-brand-900 text-lg tracking-tight">
              CS<span className="text-brand-500">MMS</span>
            </span>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {navLinks.map(({ to, label, icon: Icon }) => {
              const active = pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150
                    ${active
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-200'
                      : 'text-slate-600 hover:bg-brand-50 hover:text-brand-600'
                    }`}
                >
                  <Icon size={15} />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Mock user pill */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-100 border-2 border-brand-300 flex items-center justify-center text-brand-700 font-bold text-xs">
              ST
            </div>
            <span className="hidden md:block text-sm font-medium text-slate-700">Student</span>
          </div>
        </div>
      </div>
    </header>
  )
}
