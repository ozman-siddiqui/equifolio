import { ArrowRight } from 'lucide-react'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))

function getStatusTone(status) {
  if (status === 'Risk') {
    return 'bg-red-50 text-red-700 border-red-100'
  }

  if (status === 'Opportunity') {
    return 'bg-amber-50 text-amber-700 border-amber-100'
  }

  return 'bg-green-50 text-green-700 border-green-100'
}

export default function PropertyCard({
  address,
  location,
  equity,
  cashFlow,
  status,
  hasLoanCoverage,
  onExplore,
}) {
  const statusDetail =
    !hasLoanCoverage
      ? 'Mortgage details missing'
      : cashFlow < 0
        ? 'Negative cash flow'
        : status === 'Opportunity'
          ? 'Optimisation available'
          : 'Position looks stable'

  return (
    <article className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm shadow-gray-100/70">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-gray-900">{address}</h3>
          <p className="mt-1 text-sm text-gray-500">{location}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${getStatusTone(status)}`}>
          {status}
        </span>
      </div>

      <p className="mt-2 text-sm text-gray-500">{statusDetail}</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Metric
          label="Equity"
          value={hasLoanCoverage && equity != null ? formatCurrency(equity) : '—'}
          helper={
            hasLoanCoverage ? 'Current value less recorded debt' : 'Mortgage details needed'
          }
        />
        <Metric
          label="Cash flow"
          value={formatCurrency(cashFlow)}
          helper="Recurring property income less expenses"
          tone={cashFlow >= 0 ? 'text-green-600' : 'text-red-500'}
        />
      </div>

      <button
        type="button"
        onClick={onExplore}
        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
      >
        Explore
        <ArrowRight size={15} />
      </button>
    </article>
  )
}

function Metric({ label, value, helper, tone = 'text-gray-900' }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${value === '—' ? 'text-gray-300' : tone}`}>
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-gray-500">{helper}</p>
    </div>
  )
}
