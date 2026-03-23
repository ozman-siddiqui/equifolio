import { ArrowRight, TrendingUp, Wallet } from 'lucide-react'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))

export default function BorrowingPowerCard({
  analysis,
  title = 'Borrowing Power Unlock',
  onExplore,
}) {
  if (!analysis) return null

  if (analysis.isBlocked) {
    return (
      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="border-b border-gray-100 p-6">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Add your financial layer before Equifolio estimates borrowing capacity.
          </p>
        </div>

        <div className="space-y-5 p-6">
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
              Action required
            </p>
            <p className="mt-2 text-lg font-semibold text-gray-900">
              {analysis.blockedReason}
            </p>
            <p className="mt-2 text-sm text-gray-600">
              Income, living expenses, and liabilities are required before serviceability can be assessed credibly.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              Confidence unavailable until the Financials profile is connected
            </p>

            <button
              type="button"
              onClick={onExplore}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              <span className="whitespace-nowrap">{analysis.blockedActionLabel || 'Open Financials'}</span>
              <ArrowRight size={14} className="shrink-0" />
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
      <div className="border-b border-gray-100 p-6">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Clear borrowing uplift opportunities based on current serviceability signals.
        </p>
      </div>

      <div className="space-y-5 p-6">
        <div className="rounded-2xl border border-primary-100 bg-primary-50/70 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-primary-700">
            Headline
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            You can unlock +{formatCurrency(analysis.unlockAmount)} borrowing capacity
          </p>
          <p className="mt-2 text-sm text-gray-600">
            Current {formatCurrency(analysis.currentBorrowingPower)} vs potential{' '}
            {formatCurrency(analysis.potentialBorrowingPower)}
          </p>
        </div>

        {analysis.topConstraint ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
              Top constraint
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-900">
              {analysis.topConstraint.title}
            </p>
            <p className="mt-1 text-sm text-gray-600">{analysis.topConstraint.description}</p>
            <p className="mt-2 text-sm font-medium text-amber-700">
              Estimated borrowing impact: {formatCurrency(analysis.topConstraint.borrowingImpact)}
            </p>
          </div>
        ) : null}

        <div>
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-primary-600" />
            <h3 className="text-sm font-semibold text-gray-900">Unlock actions</h3>
          </div>
          <div className="mt-3 space-y-3">
            {analysis.actions.slice(0, 3).map((action) => (
              <div key={action.label} className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{action.label}</p>
                    <p className="mt-1 text-sm text-gray-600">{action.impact}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-primary-700">
                    +{formatCurrency(action.borrowingUplift)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500">
            Confidence {analysis.confidenceLabel} ({analysis.confidenceScore}/100)
          </p>

          <button
            type="button"
            onClick={onExplore}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
          >
            <span className="whitespace-nowrap">Explore borrowing strategy</span>
            <ArrowRight size={14} className="shrink-0" />
          </button>
        </div>
      </div>
    </section>
  )
}
