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
    <section className="cursor-default rounded-[20px] border border-[#EEF2F7] bg-[#F8FAFC] px-[26px] py-[22px] shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition-[transform,box-shadow] duration-150 ease-out will-change-transform hover:-translate-y-[2px] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
        Borrowing Power
      </p>
      <h2 className="mt-3 text-[20px] font-semibold tracking-[-0.02em] text-gray-900">Capacity</h2>

      <div className="mt-6">
        <p className="text-[44px] font-extrabold tracking-[-0.05em] text-gray-900">
          {currentCapacity != null ? formatCurrency(currentCapacity) : '-'}
        </p>
        <p className="mt-3 inline-flex w-fit items-center rounded-full bg-[#E8F6EF] px-[12px] py-[4px] text-[11px] font-semibold text-[#085041]">
          {unlockPotential != null ? `+${formatCurrency(unlockPotential)} unlock available` : 'Complete setup to unlock'}
        </p>
        {detailRows.length > 0 ? (
          <div className="mt-4 border-t border-[#EEF2F7] pt-4">
            <div className="space-y-[14px]">
              {detailRows.map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-4 text-sm">
                  <span className="text-slate-500">{row.label}</span>
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
