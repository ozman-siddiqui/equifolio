import { ArrowRight } from 'lucide-react'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))

function getStatusTone(status) {
  if (status === 'Risk') {
    return 'bg-[#FCEBEB] text-[#791F1F] border-transparent'
  }

  if (status === 'Opportunity') {
    return 'bg-[#FAEEDA] text-[#633806] border-transparent'
  }

  return 'bg-[#E1F5EE] text-[#085041] border-transparent'
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
          : 'Position appears stable'

  return (
    <article className="rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] p-[18px] shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-medium text-[var(--color-text-primary)]">{address}</h3>
          <p className="mt-1 text-[11px] leading-[1.5] text-[var(--color-text-tertiary)]">{location}</p>
        </div>
        <span className={`rounded-full border px-[10px] py-[3px] text-[10px] font-medium ${getStatusTone(status)}`}>
          {status}
        </span>
      </div>

      <p className="mt-2 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">{statusDetail}</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
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
          tone={cashFlow >= 0 ? 'text-[#0F6E56]' : 'text-[#A32D2D]'}
        />
      </div>

      <button
        type="button"
        onClick={onExplore}
        className="mt-4 inline-flex items-center gap-2 text-[13px] font-medium text-primary-600 transition-colors hover:text-primary-700"
      >
        Explore
        <ArrowRight size={15} />
      </button>
    </article>
  )
}

function Metric({ label, value, helper, tone = 'text-gray-900' }) {
  const isPlaceholder = value === '—'

  return (
    <div className="rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-secondary)] px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">{label}</p>
      <p className={`mt-1 text-[26px] font-medium tracking-[-0.5px] ${isPlaceholder ? 'text-gray-300' : tone}`}>
        {value}
      </p>
      <p className="mt-1 text-[11px] leading-[1.5] text-[var(--color-text-tertiary)]">{helper}</p>
    </div>
  )
}
