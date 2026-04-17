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
    <section className="cursor-default rounded-[18px] border border-slate-300 bg-white px-[26px] py-[22px] shadow-[0_20px_45px_-30px_rgba(15,23,42,0.18)] transition-[transform,box-shadow] duration-150 ease-out will-change-transform hover:-translate-y-[2px] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
        Borrowing Power
      </p>
      <h2
        className="mt-3 text-[20px] font-semibold tracking-[-0.02em] text-gray-900"
        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        Capacity
        <InlineTooltip content="Estimated borrowing capacity based on your current income, lending assumptions, liabilities, and portfolio inputs. Indicative only and not a lending approval." />
      </h2>

      <div className="mt-6">
        <p className="text-[44px] font-extrabold tracking-[-0.05em] text-gray-900">
          {currentCapacity != null ? formatCurrency(currentCapacity) : '-'}
        </p>
        <p className="mt-3 inline-flex w-fit items-center rounded-full bg-[#E8F6EF] px-[12px] py-[4px] text-[11px] font-semibold text-[#085041]">
          {unlockPotential != null ? `+${formatCurrency(unlockPotential)} unlock available` : 'Complete setup to unlock'}
          <InlineTooltip content="The estimated improvement available if key constraints are addressed, such as income capture, liabilities, or portfolio input completeness." size={11} />
        </p>
        {detailRows.length > 0 ? (
          <div className="mt-4 border-t border-[#EEF2F7] pt-4">
            <div className="space-y-[14px]">
              {detailRows.map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-4 text-sm">
                  <span className="text-slate-600">{row.label}</span>
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
          <p className="mt-1 text-sm leading-6 text-slate-500">{warning}</p>
        </div>
      ) : null}

      <p className="mt-5 text-sm leading-6 text-slate-500">{subtitle}</p>

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
