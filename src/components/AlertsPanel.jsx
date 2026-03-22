import { AlertTriangle, Bell, TrendingDown, CreditCard, ShieldAlert } from 'lucide-react'

export default function AlertsPanel({ alerts = [] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Alerts</h2>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Priority signals that need attention across your portfolio.
        </p>
      </div>

      <div className="p-6">
        {alerts.length === 0 ? (
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-sm text-gray-500">
            No active alerts right now.
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className={`rounded-xl p-4 border ${toneMap(alert.tone)}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{iconMap(alert.icon)}</div>
                  <div>
                    <p className="text-sm font-semibold">{alert.title}</p>
                    <p className="text-sm mt-1 opacity-90">{alert.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function toneMap(tone) {
  if (tone === 'red') return 'bg-red-50 border-red-100 text-red-700'
  if (tone === 'amber') return 'bg-amber-50 border-amber-100 text-amber-700'
  return 'bg-blue-50 border-blue-100 text-blue-700'
}

function iconMap(icon) {
  switch (icon) {
    case 'cashflow':
      return <TrendingDown size={16} />
    case 'mortgage':
      return <CreditCard size={16} />
    case 'risk':
      return <ShieldAlert size={16} />
    default:
      return <AlertTriangle size={16} />
  }
}