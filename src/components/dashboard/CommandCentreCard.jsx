import { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { ArrowRight, Info } from 'lucide-react'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))

const InlineTooltip = ({ content, size = 12 }) => {
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)
  const tipRef = useRef(null)
  const rect = ref.current?.getBoundingClientRect()

  const tooltipWidth = 280
  const padding = 16
  const viewportHeight = window.innerHeight
  const tooltipHeight = 60
  const centeredX = rect ? rect.left + rect.width / 2 : 0
  const minX = padding + tooltipWidth / 2
  const maxX = window.innerWidth - padding - tooltipWidth / 2
  const clampedX = Math.min(Math.max(centeredX, minX), maxX)
  const finalTop =
    rect && rect.bottom + tooltipHeight + 12 > viewportHeight
      ? rect.top - tooltipHeight - 8
      : (rect?.bottom || 0) + 4

  useEffect(() => {
    const handle = (e) => {
      if (
        tipRef.current &&
        !tipRef.current.contains(e.target) &&
        ref.current &&
        !ref.current.contains(e.target)
      ) {
        setVisible(false)
      }
    }
    if (visible) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [visible])

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onClick={(e) => {
          e.stopPropagation()
          setVisible((v) => !v)
        }}
        style={{
          cursor: 'pointer',
          marginLeft: 4,
          opacity: 0.6,
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        <Info size={size} />
      </span>

      {visible && rect
        ? ReactDOM.createPortal(
            <div
              ref={tipRef}
              style={{
                position: 'fixed',
                top: finalTop,
                left: clampedX,
                transform: 'translateX(-50%)',
                zIndex: 9999,
                background: '#0F172A',
                color: 'rgba(255,255,255,0.85)',
                fontSize: '12px',
                lineHeight: 1.6,
                padding: '10px 14px',
                borderRadius: '10px',
                maxWidth: '280px',
                width: 'max-content',
                textAlign: 'left',
                boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.08)',
                pointerEvents: 'auto',
                textTransform: 'none',
                letterSpacing: '0',
                fontWeight: 400,
              }}
            >
              {content}
            </div>,
            document.body
          )
        : null}
    </>
  )
}

export default function CommandCentreCard({
  eyebrow,
  title,
  tooltip = null,
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
    <section className="cursor-default rounded-[20px] border border-[#EEF2F7] bg-[#F8FAFC] px-[26px] py-[22px] shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition-[transform,box-shadow] duration-150 ease-out will-change-transform hover:-translate-y-[2px] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
        {eyebrow}
      </p>
      <h2
        className="mt-3 text-[20px] font-semibold tracking-[-0.02em] text-gray-900"
        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        {title}
        {tooltip ? <InlineTooltip content={tooltip} size={12} /> : null}
      </h2>

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
            className={`mt-4 text-[44px] font-extrabold tracking-[-0.05em] ${
              value == null ? 'text-gray-300' : valueTone || 'text-gray-900'
            }`}
          >
            {value == null ? '-' : formatCurrency(value)}
          </p>
          <p className="mt-3 inline-flex w-fit items-center rounded-full bg-[#E8F6EF] px-[12px] py-[4px] text-[11px] font-semibold text-[#085041]">
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
            <div className="mt-4 border-t border-[#EEF2F7] pt-4">
              <div className="space-y-[14px]">
                {detailRows.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-4 text-sm">
                    <div className="min-w-0">
                      <span className="text-slate-500">{row.label}</span>
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
            <div className="mt-4 border-t border-[#EEF2F7] pt-4">
              <p className="text-sm leading-6 text-gray-500">{detailEmptyState}</p>
            </div>
          ) : null}
          {progressInfo ? (
            <div className="mt-5">
              <div className="flex items-center justify-between gap-4 text-[11px] text-gray-400">
                <span className="inline-flex items-center">
                  {progressInfo.label}
                  {progressInfo.tooltip ? (
                    <InlineTooltip content={progressInfo.tooltip} size={11} />
                  ) : null}
                </span>
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
