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
  detailRows = [],
  subtitle,
  warning = null,
  confidence = null,
  cta,
  onCta,
}) {
  return (
    <section className="cursor-default rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-white px-[22px] py-[18px] shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition-[transform,box-shadow] duration-150 ease-out will-change-transform hover:-translate-y-[2px] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
        Borrowing Power
      </p>
      <h2 className="mt-3 text-[20px] font-semibold tracking-[-0.02em] text-gray-900">Capacity</h2>

      <div className="mt-6">
        <p className="text-[42px] font-semibold tracking-[-0.04em] text-gray-900">
          {currentCapacity != null ? formatCurrency(currentCapacity) : '-'}
        </p>
        <p className="mt-3 inline-flex w-fit items-center rounded-[10px] bg-[#d4f0e6] px-[9px] py-[3px] text-[11px] font-medium text-[#063d2e]">
          {unlockPotential != null ? `+${formatCurrency(unlockPotential)} unlock available` : 'Complete setup to unlock'}
        </p>
        {detailRows.length > 0 ? (
          <div className="mt-5 border-t border-[rgba(0,0,0,0.08)] pt-4">
            <div className="space-y-3">
              {detailRows.map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-4 text-sm">
                  <span className="text-gray-600">{row.label}</span>
                  <span className={`font-medium ${row.tone || 'text-gray-900'}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
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
