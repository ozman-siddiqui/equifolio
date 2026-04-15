import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  Wallet,
  Landmark,
  BriefcaseBusiness,
  Bell,
  Settings,
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/properties', label: 'Properties', icon: Building2 },
  { to: '/cashflow', label: 'Cash Flow', icon: Wallet },
  { to: '/mortgages', label: 'Mortgages', icon: Landmark },
  { to: '/financials', label: 'Financials', icon: BriefcaseBusiness },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ mobile = false, onNavigate }) {
  if (mobile) {
    return (
      <nav className="p-3 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-4 px-4 py-3 rounded-2xl text-base font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <Icon size={22} />
            <span>{item.label}</span>
          </NavLink>
          )
        })}
      </nav>
    )
  }

  return (
    <aside className="w-64 xl:w-72 bg-white border-r border-gray-100 min-h-screen">
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <div style={{ fontSize: '18px', fontWeight: 500, letterSpacing: '-0.5px', lineHeight: 1 }}>
              <span style={{ color: '#0F172A' }}>next</span>
              <span style={{ color: '#1D9E75' }}>iq</span>
            </div>
            <p className="text-sm text-gray-500 leading-tight">
              Portfolio Intelligence
            </p>
          </div>
        </div>
      </div>

      <nav className="p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
