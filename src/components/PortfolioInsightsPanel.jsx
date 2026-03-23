import { ArrowRight, Brain, ShieldAlert, TrendingDown, TrendingUp } from 'lucide-react'

export default function PortfolioInsightsPanel({ insights = [], onNavigate }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-medium text-primary-700 bg-primary-50 px-3 py-1 rounded-full mb-4">
              <Brain size={13} />
              Intelligent Layer
            </div>
            <h2 className="text-lg md:text-xl font-semibold text-gray-900">
              Portfolio Insights
            </h2>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              Ranked opportunities and risks generated from your live property, loan, and cash flow data.
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map((insight) => {
            const tone = getToneConfig(insight.tone)
            const Icon = tone.icon

            return (
              <div
                key={insight.id}
                className={`rounded-2xl border p-5 ${tone.container}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tone.iconWrap}`}>
                    <Icon size={18} className={tone.iconClass} />
                  </div>

                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone.badge}`}>
                    {insight.badge}
                  </span>
                </div>

                <h3 className="text-base font-semibold text-gray-900 mt-4">
                  {insight.title}
                </h3>
                <p className="text-sm text-gray-600 mt-2">
                  {insight.description}
                </p>

                {insight.ctaLabel && insight.to ? (
                  <button
                    type="button"
                    onClick={() => onNavigate?.(insight.to)}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
                  >
                    {insight.ctaLabel}
                    <ArrowRight size={15} />
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function getToneConfig(tone) {
  if (tone === 'negative') {
    return {
      container: 'border-red-100 bg-red-50/70',
      iconWrap: 'bg-white',
      iconClass: 'text-red-500',
      badge: 'bg-red-100 text-red-700',
      icon: TrendingDown,
    }
  }

  if (tone === 'warning') {
    return {
      container: 'border-amber-100 bg-amber-50/70',
      iconWrap: 'bg-white',
      iconClass: 'text-amber-600',
      badge: 'bg-amber-100 text-amber-700',
      icon: ShieldAlert,
    }
  }

  return {
    container: 'border-green-100 bg-green-50/70',
    iconWrap: 'bg-white',
    iconClass: 'text-green-600',
    badge: 'bg-green-100 text-green-700',
    icon: TrendingUp,
  }
}
