import { ArrowRight } from 'lucide-react'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))

export default function CommandCentreCard({
  eyebrow,
  title,
  value = null,
  valueTone = null,
  helper,
  statusBadge = null,
  subtitle,
  metrics = [],
  detailRows = [],
  detailEmptyState = null,
  progressInfo = null,
  cta,
  onClick,
}) {
  return (
    <section className="cursor-default rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-white px-[22px] py-[18px] shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition-[transform,box-shadow] duration-150 ease-out will-change-transform hover:-translate-y-[2px] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-[20px] font-semibold tracking-[-0.02em] text-gray-900">{title}</h2>

      {metrics.length > 0 ? (
        <div className="mt-6 grid gap-3.5">
          {metrics.map((metric) => {
            const hasDisplayValue = Boolean(metric.displayValue)
            const hasNumericValue = metric.value != null

            return (
              <div
                key={metric.label}
                className="rounded-[14px] border-[0.5px] border-[rgba(0,0,0,0.06)] bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(245,247,250,0.82))] px-4 py-3.5"
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-400">{metric.label}</p>
                <p
                  className={`mt-1.5 text-[24px] font-semibold tracking-[-0.02em] ${
                    !hasDisplayValue && !hasNumericValue
                      ? 'text-gray-400'
                      : metric.tone || 'text-gray-900'
                  }`}
                >
                  {hasDisplayValue
                    ? metric.displayValue
                    : hasNumericValue
                      ? formatCurrency(metric.value)
                      : '-'}
                </p>
                {metric.helper ? (
                  <p className="mt-1.5 text-xs leading-5 text-gray-500">{metric.helper}</p>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : (
        <>
          <p
            className={`mt-6 text-[42px] font-semibold tracking-[-0.04em] ${
              value == null ? 'text-gray-300' : valueTone || 'text-gray-900'
            }`}
          >
            {value == null ? '-' : formatCurrency(value)}
          </p>
          <p className="mt-3 inline-flex w-fit items-center rounded-[10px] bg-[#d4f0e6] px-[9px] py-[3px] text-[11px] font-medium text-[#063d2e]">
            {helper}
          </p>
          {statusBadge ? (
            <span
              className="mt-3 ml-2 inline-flex items-center rounded-full px-[10px] py-[3px] text-[10px] font-medium"
              style={{
                backgroundColor: statusBadge.backgroundColor,
                color: statusBadge.color,
              }}
            >
              {statusBadge.label}
            </span>
          ) : null}
          {detailRows.length > 0 ? (
            <div className="mt-5 border-t border-[rgba(0,0,0,0.08)] pt-4">
              <div className="space-y-3">
                {detailRows.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-4 text-sm">
                    <div className="min-w-0">
                      <span className="text-gray-600">{row.label}</span>
                      {row.badge ? (
                        <span
                          className="ml-2 inline-flex rounded-full px-[10px] py-[3px] text-[10px] font-medium"
                          style={{
                            backgroundColor: row.badge.backgroundColor,
                            color: row.badge.color,
                          }}
                        >
                          {row.badge.label}
                        </span>
                      ) : null}
                    </div>
                    <span className={`font-medium ${row.tone || 'text-gray-900'}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : detailEmptyState ? (
            <div className="mt-5 border-t border-[rgba(0,0,0,0.08)] pt-4">
              <p className="text-sm leading-6 text-gray-500">{detailEmptyState}</p>
            </div>
          ) : null}
          {progressInfo ? (
            <div className="mt-5">
              <div className="flex items-center justify-between gap-4 text-[11px] text-gray-400">
                <span>{progressInfo.label}</span>
                <span>{progressInfo.targetLabel}</span>
              </div>
              <div className="mt-2 h-[6px] overflow-hidden rounded-[999px] bg-[#edf2ef]">
                <div
                  className="h-full rounded-[999px] bg-[#1D9E75]"
                  style={{ width: `${Math.max(0, Math.min(100, Number(progressInfo.valuePct || 0)))}%` }}
                />
              </div>
              {progressInfo.note ? (
                <p className="mt-2 text-[11px] leading-5 text-gray-400">
                  {progressInfo.note}
                </p>
              ) : null}
              {progressInfo.badge ? (
                <span
                  className="mt-2 inline-flex rounded-full px-[10px] py-[3px] text-[10px] font-medium"
                  style={{
                    backgroundColor: progressInfo.badge.backgroundColor,
                    color: progressInfo.badge.color,
                  }}
                >
                  {progressInfo.badge.label}
                </span>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <p className="mt-5 text-sm leading-6 text-gray-600">{subtitle}</p>

      {cta ? (
        <button
          type="button"
          onClick={onClick}
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
        >
          {cta.label}
          <ArrowRight size={15} />
        </button>
      ) : null}
    </section>
  )
}
