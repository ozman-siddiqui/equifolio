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
    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm shadow-gray-100/70">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-lg font-semibold text-gray-900">{title}</h2>

      {metrics.length > 0 ? (
        <div className="mt-5 grid gap-3">
          {metrics.map((metric) => {
            const hasDisplayValue = Boolean(metric.displayValue)
            const hasNumericValue = metric.value != null

            return (
              <div
                key={metric.label}
                className="rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-3"
              >
                <p className="text-xs uppercase tracking-wide text-gray-400">{metric.label}</p>
                <p
                  className={`mt-1 text-xl font-semibold ${
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
                  <p className="mt-1 text-xs leading-5 text-gray-500">{metric.helper}</p>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : (
        <>
          <p
            className={`mt-5 text-4xl font-bold tracking-tight ${
              value == null ? 'text-gray-300' : 'text-gray-900'
            }`}
          >
            {value == null ? '-' : formatCurrency(value)}
          </p>
          <p className="mt-2 text-sm font-medium text-gray-500">{helper}</p>
        </>
      )}

      <p className="mt-4 text-sm leading-6 text-gray-600">{subtitle}</p>

      {cta ? (
        <button
          type="button"
          onClick={onClick}
          className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
        >
          {cta.label}
          <ArrowRight size={15} />
        </button>
      ) : null}
    </section>
  )
}
