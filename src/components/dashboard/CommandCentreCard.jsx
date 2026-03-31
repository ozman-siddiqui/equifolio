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
  helper,
  subtitle,
  metrics = [],
  cta,
  onClick,
}) {
  return (
    <section className="rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-white p-7 shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition-transform duration-200 hover:-translate-y-0.5">
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
              value == null ? 'text-gray-300' : 'text-gray-900'
            }`}
          >
            {value == null ? '-' : formatCurrency(value)}
          </p>
          <p className="mt-3 inline-flex w-fit items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
            {helper}
          </p>
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
