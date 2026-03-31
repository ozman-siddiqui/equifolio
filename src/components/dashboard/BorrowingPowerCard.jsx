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
    <section className="rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-white p-7 shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition-transform duration-200 hover:-translate-y-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
        Borrowing Power
      </p>
      <h2 className="mt-3 text-[20px] font-semibold tracking-[-0.02em] text-gray-900">Capacity</h2>

      <div className="mt-6">
        <p className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">Unlock potential</p>
        <p className="mt-2 text-[34px] font-semibold tracking-[-0.03em] text-primary-700">
          {unlockPotential != null ? `+${formatCurrency(unlockPotential)}` : '-'}
        </p>
      </div>

      <div className="mt-6 rounded-[14px] border-[0.5px] border-[rgba(0,0,0,0.06)] bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(245,247,250,0.82))] px-4 py-3.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">Current capacity</p>
        <p className="mt-1.5 text-[28px] font-semibold tracking-[-0.03em] text-gray-900">
          {currentCapacity != null ? formatCurrency(currentCapacity) : '-'}
        </p>
      </div>

      {warning ? (
        <div className="mt-5 rounded-[14px] border border-amber-200 bg-amber-50/70 px-4 py-3.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            {confidence ? `${confidence} confidence` : 'Confidence note'}
          </p>
          <p className="mt-1 text-sm leading-6 text-amber-900">{warning}</p>
        </div>
      ) : null}

      <p className="mt-5 text-sm leading-6 text-gray-600">{subtitle}</p>

      <button
        type="button"
        onClick={onCta}
        className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
      >
        {cta.label}
        <ArrowRight size={15} />
      </button>
    </section>
  )
}
