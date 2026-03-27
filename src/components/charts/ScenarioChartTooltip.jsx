function hasRenderableValue(value) {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

export default function ScenarioChartTooltip({
  contextLabel = '',
  contextValue = '',
  primaryLabel = '',
  primaryValue = '',
  supportingRows = [],
  explanation = '',
  className = '',
}) {
  const hasContext = hasRenderableValue(contextLabel) || hasRenderableValue(contextValue)
  const hasPrimary = hasRenderableValue(primaryLabel) || hasRenderableValue(primaryValue)
  const resolvedSupportingRows = supportingRows.filter(
    (row) => hasRenderableValue(row?.label) && hasRenderableValue(row?.value)
  )
  const hasExplanation = hasRenderableValue(explanation)

  return (
    <div
      className={`w-[248px] max-w-[min(248px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-3 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.28)] backdrop-blur-sm ${className}`.trim()}
    >
      {hasContext ? (
        <div>
          {hasRenderableValue(contextLabel) ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              {contextLabel}
            </p>
          ) : null}
          {hasRenderableValue(contextValue) ? (
            <p className="mt-1 text-sm font-semibold text-slate-950">{contextValue}</p>
          ) : null}
        </div>
      ) : null}

      {hasPrimary ? (
        <div className={`${hasContext ? 'mt-3 border-t border-slate-100 pt-3' : ''}`}>
          {hasRenderableValue(primaryLabel) ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {primaryLabel}
            </p>
          ) : null}
          {hasRenderableValue(primaryValue) ? (
            <p className="mt-1 text-lg font-semibold tracking-tight text-slate-950 tabular-nums">
              {primaryValue}
            </p>
          ) : null}
        </div>
      ) : null}

      {resolvedSupportingRows.length > 0 ? (
        <div className={`${hasContext || hasPrimary ? 'mt-3 border-t border-slate-100 pt-2' : ''}`}>
          {resolvedSupportingRows.map((row, index) => (
            <div
              key={`${row.label}-${index}`}
              className={`flex items-start justify-between gap-4 py-2 ${
                index === 0 ? '' : 'border-t border-slate-100/80'
              }`}
            >
              <span className="min-w-0 break-words text-sm leading-5 text-slate-600">
                {row.label}
              </span>
              <span className="shrink-0 text-right text-sm font-semibold leading-5 tabular-nums text-slate-900">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {hasExplanation ? (
        <div className={`${hasContext || hasPrimary || resolvedSupportingRows.length > 0 ? 'mt-3 border-t border-slate-100 pt-3' : ''}`}>
          <p className="line-clamp-2 break-words text-sm leading-5 text-slate-500">
            {explanation}
          </p>
        </div>
      ) : null}
    </div>
  )
}
