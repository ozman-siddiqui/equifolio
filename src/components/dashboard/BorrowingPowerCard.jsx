import { ArrowRight } from 'lucide-react'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))

export default function BorrowingPowerCard({
  currentCapacity,
  unlockPotential,
  subtitle,
  warning = null,
  confidence = null,
  cta,
  onCta,
}) {
  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm shadow-gray-100/70">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
        Borrowing Power
      </p>
      <h2 className="mt-3 text-lg font-semibold text-gray-900">Capacity</h2>

      <div className="mt-5">
        <p className="text-xs uppercase tracking-wide text-primary-700">Unlock potential</p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-primary-700">
          {unlockPotential != null ? `+${formatCurrency(unlockPotential)}` : '-'}
        </p>
      </div>

      <div className="mt-5">
        <p className="text-xs uppercase tracking-wide text-gray-400">Current capacity</p>
        <p className="mt-1 text-2xl font-semibold text-gray-900">
          {currentCapacity != null ? formatCurrency(currentCapacity) : '-'}
        </p>
      </div>

      {warning ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            {confidence ? `${confidence} confidence` : 'Confidence note'}
          </p>
          <p className="mt-1 text-sm leading-6 text-amber-900">{warning}</p>
        </div>
      ) : null}

      <p className="mt-4 text-sm leading-6 text-gray-600">{subtitle}</p>

      <button
        type="button"
        onClick={onCta}
        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
      >
        {cta.label}
        <ArrowRight size={15} />
      </button>
    </section>
  )
}
