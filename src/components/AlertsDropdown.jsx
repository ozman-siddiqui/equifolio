import { useState, useEffect, useRef } from 'react'
import { Bell, X, AlertTriangle, Clock, Home } from 'lucide-react'
import { getDaysUntil } from '../lib/dateUtils.js'

const getUrgency = (days) => {
  if (days <= 30) return { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-500', label: 'Urgent' }
  if (days <= 60) return { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-500', label: 'Soon' }
  return { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-500', label: '90 days' }
}

export const buildAlerts = (properties, loans) => {
  const alerts = []

  loans.forEach(loan => {
    if (loan.loan_type !== 'Fixed' || !loan.fixed_rate_expiry) return
    const days = getDaysUntil(loan.fixed_rate_expiry)
    if (days === null || days > 90 || days < 0) return
    const property = properties.find(p => p.id === loan.property_id)
    alerts.push({
      id: `fixed-${loan.id}`,
      type: 'fixed_rate',
      days,
      title: 'Fixed rate expiring',
      description: `${loan.lender} loan on ${property?.address || 'unknown property'}`,
      detail: `Expires ${new Date(loan.fixed_rate_expiry).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      icon: Clock,
      urgent: days <= 30,
    })
  })

  loans.forEach(loan => {
    if (loan.repayment_type !== 'Interest Only' || !loan.interest_only_expiry) return
    const days = getDaysUntil(loan.interest_only_expiry)
    if (days === null || days > 90 || days < 0) return
    const property = properties.find(p => p.id === loan.property_id)
    alerts.push({
      id: `io-${loan.id}`,
      type: 'interest_only',
      days,
      title: 'Interest-only period ending',
      description: `${loan.lender} loan on ${property?.address || 'unknown property'}`,
      detail: `Switches to P&I ${new Date(loan.interest_only_expiry).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      icon: AlertTriangle,
      urgent: days <= 30,
    })
  })

  properties.forEach(property => {
    if (!property.lease_expiry_date) return
    const days = getDaysUntil(property.lease_expiry_date)
    if (days === null || days > 90 || days < 0) return
    alerts.push({
      id: `lease-${property.id}`,
      type: 'lease',
      days,
      title: 'Lease expiring',
      description: property.address,
      detail: `Expires ${new Date(property.lease_expiry_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      icon: Home,
      urgent: days <= 30,
    })
  })

  return alerts.sort((a, b) => a.days - b.days)
}

export default function AlertsDropdown({ properties, loans }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const alerts = buildAlerts(properties, loans)
  const count = alerts.length
  const hasUrgent = alerts.some(a => a.urgent)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell size={20} />
        {count > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 w-4 h-4 text-white text-xs font-bold rounded-full flex items-center justify-center ${
            hasUrgent ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
          }`}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">
              Alerts {count > 0 && <span className="text-red-500">({count})</span>}
            </h3>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {count === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No alerts right now</p>
                <p className="text-xs text-gray-400 mt-1">
                  Add fixed rate expiry and lease dates to see alerts here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {alerts.map(alert => {
                  const urgency = getUrgency(alert.days)
                  const Icon = alert.icon
                  return (
                    <div key={alert.id} className={`px-4 py-3 ${urgency.bg}`}>
                      <div className="flex items-start gap-3">
                        <div className={`p-1.5 rounded-lg border ${urgency.border} flex-shrink-0 mt-0.5`}>
                          <Icon size={14} className={urgency.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-xs font-semibold ${urgency.color}`}>{alert.title}</p>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0 ${urgency.badge}`}>
                              {alert.days}d
                            </span>
                          </div>
                          <p className="text-xs text-gray-700 mt-0.5 truncate">{alert.description}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{alert.detail}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {count > 0 && (
            <div className="px-4 py-2 border-t border-gray-100">
              <p className="text-xs text-gray-400 text-center">
                {alerts.filter(a => a.urgent).length > 0
                  ? `${alerts.filter(a => a.urgent).length} urgent — action required`
                  : 'Review upcoming dates with your broker'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
