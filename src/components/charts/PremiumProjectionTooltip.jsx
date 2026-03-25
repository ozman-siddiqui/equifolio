const defaultCurrencyFormatter = (value) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))

export default function PremiumProjectionTooltip({
  active,
  payload,
  label,
  series = [],
  valueFormatter = defaultCurrencyFormatter,
  labelTitle = 'Year',
  extraRows = [],
  getExtraRows = null,
}) {
  if (!active || !payload?.length) return null

  const payloadBySeriesOrder = series
    .map((seriesItem) =>
      payload.find((entry) => entry.dataKey === seriesItem.dataKey)
    )
    .filter(Boolean)
  const sourceDatum = payloadBySeriesOrder[0]?.payload || payload[0]?.payload || null
  const resolvedExtraRows =
    typeof getExtraRows === 'function' ? getExtraRows(sourceDatum) || [] : extraRows

  return (
    <div className="min-w-[240px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.35)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
        {labelTitle}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{label}</p>
      <div className="mt-3 border-t border-slate-100 pt-2">
        {payloadBySeriesOrder.map((entry, index) => {
          const matchedSeries = series.find((item) => item.dataKey === entry.dataKey)
          const seriesLabel = matchedSeries?.label || entry.name || entry.dataKey

          return (
            <div
              key={entry.dataKey}
              className={`flex items-center justify-between gap-4 py-2 ${
                index === 0 ? '' : 'border-t border-slate-100/80'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="truncate text-sm text-slate-600">{seriesLabel}</span>
              </div>
              <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900">
                {valueFormatter(entry.value)}
              </span>
            </div>
          )
        })}
        {resolvedExtraRows.map((row, index) => (
          <div
            key={`extra-${row.label}-${index}`}
            className={`flex items-center justify-between gap-4 py-2 ${
              payloadBySeriesOrder.length === 0 && index === 0 ? '' : 'border-t border-slate-100/80'
            }`}
          >
            <span className="truncate text-sm text-slate-600">{row.label}</span>
            <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
