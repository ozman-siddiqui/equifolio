import {
  X,
  TrendingDown,
  CreditCard,
  AlertTriangle,
  Building2,
  ArrowRight,
  DollarSign,
} from 'lucide-react'

export default function OptimisationModal({
  title = 'Optimisation Options',
  subtitle = 'Recommended next actions based on current portfolio signals.',
  actions = [],
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {actions.length === 0 ? (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-500">
              No optimisation actions available yet.
            </div>
          ) : (
            actions.map((action, index) => (
              <button
                key={index}
                type="button"
                onClick={action.onClick}
                className="w-full text-left rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 p-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`p-2 rounded-lg ${action.tone.bg} ${action.tone.text}`}>
                      {renderIcon(action.icon)}
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {action.title}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {action.description}
                      </p>
                    </div>
                  </div>

                  <ArrowRight size={16} className="text-gray-400 flex-shrink-0 mt-1" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function renderIcon(icon) {
  switch (icon) {
    case 'cashflow':
      return <TrendingDown size={16} />
    case 'mortgage':
      return <CreditCard size={16} />
    case 'risk':
      return <AlertTriangle size={16} />
    case 'property':
      return <Building2 size={16} />
    default:
      return <DollarSign size={16} />
  }
}