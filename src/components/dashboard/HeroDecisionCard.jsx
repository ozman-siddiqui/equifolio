import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronRight } from 'lucide-react'

const purchaseRangeLow = 475000
const purchaseRangeHigh = 550000
const fiveYearEquityUplift = 298638
const monthlyHoldingCost = -982
const grossYield = 5.5
const currentEquity = 576500
const year3Equity = 720000
const year5Equity = 875138
const unlockValue = 39016
const acquisitionReadinessScore = 79
const acquisitionReadinessLabel = 'Getting close'
const isExecutable = true

function formatCurrency(value) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatCompactCurrency(value) {
  const numeric = Math.abs(Number(value || 0))
  if (numeric >= 1000000) return `${value < 0 ? '-' : ''}$${(numeric / 1000000).toFixed(1)}m`
  if (numeric >= 1000) return `${value < 0 ? '-' : ''}$${Math.round(numeric / 1000)}k`
  return `${value < 0 ? '-' : ''}${formatCurrency(numeric)}`
}

function buildCurvePath(points) {
  if (!points.length) return ''

  let path = `M ${points[0].x} ${points[0].y}`

  for (let index = 1; index < points.length; index += 1) {
    const current = points[index]
    const previous = points[index - 1]
    const controlX = (previous.x + current.x) / 2
    path += ` C ${controlX} ${previous.y}, ${controlX} ${current.y}, ${current.x} ${current.y}`
  }

  return path
}

function pointToPercentX(pointX, viewBoxWidth = 520) {
  return `${(pointX / viewBoxWidth) * 100}%`
}

function StatTile({ eyebrow, value, detail, tone = 'default' }) {
  const toneClasses =
    tone === 'highlight'
      ? 'border-emerald-200/80 bg-emerald-50/80 shadow-[0_20px_45px_-34px_rgba(16,185,129,0.35)] hover:border-[rgba(0,0,0,0.12)]'
      : 'border-slate-200/80 bg-white/88 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.12)] hover:border-[rgba(0,0,0,0.12)]'

  return (
    <div className={`rounded-[1.6rem] border p-4 transition-[transform,box-shadow,border-color] duration-[120ms] ease-out will-change-transform hover:-translate-y-px hover:shadow-[0_2px_10px_rgba(0,0,0,0.04)] md:p-5 ${toneClasses}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {eyebrow}
      </p>
      <p className="mt-3 text-[1.8rem] font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  )
}

export default function HeroDecisionCard() {
  const pathRef = useRef(null)
  const fillRef = useRef(null)
  const rafRef = useRef([])
  const pulseTimeoutRef = useRef(null)
  const pulseResetTimeoutRef = useRef(null)
  const [hasAnimated, setHasAnimated] = useState(false)
  const [isEndpointPulsing, setIsEndpointPulsing] = useState(false)

  useEffect(() => {
    const pathElement = pathRef.current
    const fillElement = fillRef.current
    if (!pathElement) return undefined

    const totalLength = pathElement.getTotalLength()
    pathElement.style.strokeDasharray = `${totalLength}`
    pathElement.style.strokeDashoffset = `${totalLength}`
    pathElement.style.transition = 'none'

    if (fillElement) {
      fillElement.style.opacity = '0'
      fillElement.style.transition = 'opacity 600ms ease-in 200ms'
    }

    setHasAnimated(false)
    setIsEndpointPulsing(false)

    const firstFrame = requestAnimationFrame(() => {
      const secondFrame = requestAnimationFrame(() => {
        pathElement.style.transition = 'stroke-dashoffset 900ms ease-in-out'
        pathElement.style.strokeDashoffset = '0'
        if (fillElement) {
          fillElement.style.opacity = '1'
        }
        setHasAnimated(true)
      })
      rafRef.current.push(secondFrame)
    })
    rafRef.current = [firstFrame]

    pulseTimeoutRef.current = window.setTimeout(() => {
      setIsEndpointPulsing(true)
      pulseResetTimeoutRef.current = window.setTimeout(() => {
        setIsEndpointPulsing(false)
      }, 400)
    }, 950)

    return () => {
      rafRef.current.forEach((frame) => cancelAnimationFrame(frame))
      rafRef.current = []
      if (pulseTimeoutRef.current != null) {
        clearTimeout(pulseTimeoutRef.current)
      }
      if (pulseResetTimeoutRef.current != null) {
        clearTimeout(pulseResetTimeoutRef.current)
      }
      pathElement.style.transition = 'none'
      pathElement.style.strokeDashoffset = `${totalLength}`
      if (fillElement) {
        fillElement.style.opacity = '0'
      }
    }
  }, [])

  const chartValues = [currentEquity, year3Equity, year5Equity]
  const chartPoints = [
    { x: 36, y: 138, label: 'Today', value: currentEquity },
    { x: 262, y: 78, label: 'Year 3', value: year3Equity },
    { x: 484, y: 42, label: 'Year 5', value: year5Equity },
  ]
  const chartPath = buildCurvePath(chartPoints)
  const areaPath = `${chartPath} L ${chartPoints[chartPoints.length - 1].x} 182 L ${chartPoints[0].x} 182 Z`

  return (
    <section className="relative overflow-hidden rounded-[2.4rem] border border-emerald-200/80 bg-white px-7 py-7 pb-4 shadow-[0_40px_120px_-72px_rgba(15,23,42,0.22)] md:px-9 md:py-9 md:pb-6">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-emerald-500 via-emerald-400 to-emerald-300" />
      <div className="pointer-events-none absolute -left-16 top-12 h-48 w-48 rounded-full bg-emerald-100/70 blur-3xl" />
      <div className="pointer-events-none absolute right-12 top-8 h-56 w-56 rounded-full bg-emerald-50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 right-20 h-64 w-64 rounded-full bg-lime-100/60 blur-3xl" />

      <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.55fr)_320px] xl:gap-7">
        <div className="min-w-0">
          <style>{`
            @keyframes heroDecisionEndDotPulse {
              0% { transform: scale(1); }
              50% { transform: scale(1.4); }
              100% { transform: scale(1); }
            }
          `}</style>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                Your next best move
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  {isExecutable ? 'Appears executable' : 'In progress'}
                </span>
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                  High confidence
                </span>
              </div>
            </div>
          </div>

          <div className="mt-7 max-w-4xl">
            <h1 className="max-w-3xl text-[2.3rem] font-semibold leading-[1.06] tracking-[-0.04em] text-slate-950 md:text-[3.25rem]">
              Buy 1 investment property
              <span className="mt-2 block">
                in the {formatCurrency(purchaseRangeLow)}–{formatCurrency(purchaseRangeHigh)} range
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-[1.05rem] leading-8 text-emerald-800">
              Based on current inputs, this pathway
              <br />
              appears fundable and executable — subject
              <br />
              to lender assessment and market conditions.
            </p>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatTile
              eyebrow="Executable range"
              value={`${formatCompactCurrency(purchaseRangeLow)}–${formatCompactCurrency(
                purchaseRangeHigh
              )}`}
              detail="20% deposit · funded"
              tone="highlight"
            />
            <StatTile
              eyebrow="5-year equity uplift"
              value={`+${formatCurrency(fiveYearEquityUplift)}`}
              detail="At 6% annual growth"
            />
            <StatTile
              eyebrow="Monthly holding cost"
              value={`${formatCompactCurrency(monthlyHoldingCost)}/mo`}
              detail="After tax offset est."
            />
            <StatTile
              eyebrow="Gross yield est."
              value={`${grossYield.toFixed(1)}%`}
              detail="Regional market"
            />
          </div>

          <div className="mt-8 rounded-[2rem] border border-emerald-200/80 bg-[radial-gradient(circle_at_top,rgba(209,250,229,0.45),rgba(255,255,255,0.96)_62%)] p-4 shadow-[0_28px_70px_-50px_rgba(16,185,129,0.42)] md:px-5 md:py-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Portfolio wealth trajectory
                </p>
              </div>
              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50/90 px-3.5 py-1.5 text-sm font-medium text-emerald-800">
                +{formatCurrency(fiveYearEquityUplift)} projected at year 5
              </span>
            </div>

            <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/65 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] md:px-4">
              <svg viewBox="0 0 520 200" className="h-[188px] w-full" role="img" aria-label="Portfolio wealth trajectory chart" data-animated={hasAnimated ? 'true' : 'false'}>
                <defs>
                  <linearGradient id="heroDecisionStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#0f766e" />
                    <stop offset="55%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                  <linearGradient id="heroDecisionFill" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(16,185,129,0.24)" />
                    <stop offset="100%" stopColor="rgba(16,185,129,0.02)" />
                  </linearGradient>
                </defs>

                <path
                  ref={fillRef}
                  d={areaPath}
                  fill="url(#heroDecisionFill)"
                  style={{ opacity: 0 }}
                />
                <path
                  ref={pathRef}
                  d={chartPath}
                  fill="none"
                  stroke="url(#heroDecisionStroke)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: 1,
                    strokeDashoffset: 1,
                  }}
                />

                <line
                  x1={chartPoints[1].x}
                  y1="34"
                  x2={chartPoints[1].x}
                  y2="182"
                  stroke="#9adfc5"
                  strokeWidth="1.5"
                  strokeDasharray="4 5"
                />

                {chartPoints.map((point, index) => (
                  <g key={point.label}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={index === chartPoints.length - 1 ? 6.5 : 4}
                      fill={index === chartPoints.length - 1 ? '#059669' : '#10b981'}
                      style={
                        index === chartPoints.length - 1
                          ? {
                              transformOrigin: `${point.x}px ${point.y}px`,
                              animation: isEndpointPulsing
                                ? 'heroDecisionEndDotPulse 400ms ease-in-out'
                                : 'none',
                            }
                          : undefined
                      }
                    />
                    {index === chartPoints.length - 1 ? (
                      <circle cx={point.x} cy={point.y} r="12" fill="rgba(16,185,129,0.16)" />
                    ) : null}
                  </g>
                ))}
              </svg>

              <div className="relative mt-1.5 h-[52px]">
                {[
                  {
                    label: 'Today',
                    value: formatCurrency(currentEquity),
                    point: chartPoints[0],
                    alignClass: 'text-left translate-x-2',
                  },
                  {
                    label: 'Year 3',
                    value: `~${formatCompactCurrency(year3Equity)}`,
                    point: chartPoints[1],
                    alignClass: 'text-center -translate-x-1/2',
                  },
                  {
                    label: 'Year 5',
                    value: `~${formatCurrency(year5Equity)}`,
                    point: chartPoints[2],
                    alignClass: 'text-right -translate-x-[calc(100%+8px)]',
                  },
                ].map(({ label, value, point, alignClass }) => (
                  <div
                    key={label}
                    className={`absolute top-0 ${alignClass}`}
                    style={{ left: pointToPercentX(point.x) }}
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
                    <p className="mt-1 text-base font-semibold tracking-tight text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-7 rounded-[1.6rem] border border-emerald-200/90 bg-emerald-50/80 px-5 py-4 shadow-[0_18px_40px_-34px_rgba(16,185,129,0.36)]">
            <p className="text-sm leading-6 text-emerald-900">
              <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 align-middle" />
              Next upgrade: reduce credit card limits →
              <span className="font-semibold">
                {' '}expands purchase range by +{formatCurrency(unlockValue)}
              </span>
              <br />
              without changing your executable path today.
            </p>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-[2rem] border border-emerald-700/90 bg-[linear-gradient(180deg,#12403b_0%,#0f3d38_100%)] px-5 py-4 text-white shadow-[0_30px_80px_-38px_rgba(6,78,59,0.72)]">
            <p className="text-[1.35rem] font-semibold tracking-tight">Deploy this strategy</p>
            <button
              type="button"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[1.15rem] bg-white px-4 py-3 text-sm font-semibold text-emerald-950 shadow-[0_18px_40px_-28px_rgba(255,255,255,0.28)] transition-all duration-150 ease-out hover:bg-[#eef5f2] hover:shadow-[0_0_0_3px_rgba(29,158,117,0.25)]"
            >
              Deploy this strategy
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-100 transition-colors hover:text-white"
            >
              Explore full scenario
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            type="button"
            className="rounded-[1.6rem] border border-slate-200 bg-white px-5 py-4 text-left text-sm font-semibold text-slate-800 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.16)] transition-colors duration-150 ease-out hover:bg-[#eef5f2]"
          >
            View 30-year projection
          </button>

          <div className="rounded-[2rem] border border-emerald-200/80 bg-white p-5 shadow-[0_22px_54px_-42px_rgba(16,185,129,0.34)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Acquisition position
            </p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-[2.3rem] font-semibold tracking-tight text-slate-950">
                {acquisitionReadinessScore}%
              </p>
              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                {acquisitionReadinessLabel}
              </span>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-emerald-50">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-lime-300"
                style={{ width: `${acquisitionReadinessScore}%` }}
              />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Executable now.
              <br />
              Optimisation unlocks stronger capacity.
            </p>
          </div>

          <div
            className="rounded-[12px] border px-[14px] py-[10px]"
            style={{ backgroundColor: '#f4faf7', borderColor: '#c8e8dc', color: '#085041' }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Top unlock</p>
            <p className="mt-1 text-[12px] leading-5">
              Reduce card limits → +{formatCurrency(unlockValue)} borrowing capacity
            </p>
          </div>

          <p className="px-2 text-center text-xs leading-6 text-slate-400">
            Illustrative only.
            <br />
            Not financial advice.
          </p>
        </aside>
      </div>
    </section>
  )
}
