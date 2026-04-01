import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronRight } from 'lucide-react'

function formatCurrency(value) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function toFiniteNumber(value) {
  if (value == null || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function formatCompactCurrency(value) {
  const numeric = Math.abs(Number(value || 0))
  if (numeric >= 1000000) return `${value < 0 ? '-' : ''}$${(numeric / 1000000).toFixed(1)}m`
  if (numeric >= 1000) return `${value < 0 ? '-' : ''}$${Math.round(numeric / 1000)}k`
  return `${value < 0 ? '-' : ''}${formatCurrency(numeric)}`
}

function buildLinePath(points) {
  if (!points.length) return ''

  let path = `M ${points[0].x} ${points[0].y}`

  for (let index = 1; index < points.length; index += 1) {
    const current = points[index]
    path += ` L ${current.x} ${current.y}`
  }

  return path
}

function buildAreaPath(points, baselineY) {
  if (!points.length) return ''

  const linePath = buildLinePath(points)
  const lastPoint = points[points.length - 1]
  const firstPoint = points[0]

  return `${linePath} L ${lastPoint.x} ${baselineY} L ${firstPoint.x} ${baselineY} Z`
}

function scaleY(value, minVal, maxVal, svgHeight) {
  const padding = 8
  const drawableHeight = svgHeight - padding * 2
  const range = maxVal - minVal

  if (range === 0) return padding + drawableHeight / 2

  return svgHeight - padding - ((value - minVal) / range) * drawableHeight
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
    <div
      className={`rounded-[1.6rem] border p-4 transition-[transform,box-shadow,border-color] duration-[120ms] ease-out will-change-transform hover:-translate-y-px hover:shadow-[0_2px_10px_rgba(0,0,0,0.04)] md:p-5 ${toneClasses}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {eyebrow}
      </p>
      <p className="mt-3 text-[1.8rem] font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  )
}

export default function HeroDecisionCard({
  purchaseRangeLow = 475000,
  purchaseRangeHigh = 550000,
  fiveYearEquityUplift = 298638,
  monthlyHoldingCost = -982,
  grossYield = 5.5,
  currentEquity = 576500,
  year3Equity = 720000,
  year5Equity = 875138,
  year10Equity = null,
  acquisitionReadinessScore = 79,
  acquisitionReadinessLabel = 'Getting close',
  acquisitionReadiness = null,
  unlockValue = 39016,
  isExecutable = true,
}) {
  const navigate = useNavigate()
  const strokePathRef = useRef(null)
  const fillPathRef = useRef(null)
  const endDotRef = useRef(null)
  const rafRef = useRef([])
  const pulseTimeoutRef = useRef(null)
  const [hasAnimated, setHasAnimated] = useState(false)
  const [isReadinessExpanded, setIsReadinessExpanded] = useState(false)

  const purchaseRangeLowNumber = toFiniteNumber(purchaseRangeLow)
  const purchaseRangeHighNumber = toFiniteNumber(purchaseRangeHigh)
  const fiveYearEquityUpliftNumber = toFiniteNumber(fiveYearEquityUplift)
  const monthlyHoldingCostNumber = toFiniteNumber(monthlyHoldingCost)
  const grossYieldNumber = toFiniteNumber(grossYield)
  const currentEquityNumber = toFiniteNumber(currentEquity)
  const year3EquityNumber = toFiniteNumber(year3Equity)
  const year5EquityNumber = toFiniteNumber(year5Equity)
  const year10EquityNumber = toFiniteNumber(year10Equity)
  const acquisitionReadinessData =
    acquisitionReadiness && typeof acquisitionReadiness === 'object'
      ? acquisitionReadiness
      : acquisitionReadinessScore && typeof acquisitionReadinessScore === 'object'
        ? acquisitionReadinessScore
        : null
  const acquisitionReadinessScoreNumber = toFiniteNumber(
    acquisitionReadinessData?.finalScore ?? acquisitionReadinessScore
  )
  const unlockValueNumber = toFiniteNumber(unlockValue)
  const acquisitionReadinessLabelValue =
    typeof acquisitionReadinessLabel === 'string' && acquisitionReadinessLabel
      ? acquisitionReadinessLabel
      : acquisitionReadinessData?.label ?? 'Getting close'

  const purchaseRangeDisplay =
    purchaseRangeLowNumber != null && purchaseRangeHighNumber != null
      ? `${formatCurrency(purchaseRangeLowNumber)}-${formatCurrency(purchaseRangeHighNumber)}`
      : '--'
  const executableRangeDisplay =
    purchaseRangeLowNumber != null && purchaseRangeHighNumber != null
      ? `${formatCompactCurrency(purchaseRangeLowNumber)}-${formatCompactCurrency(
          purchaseRangeHighNumber
        )}`
      : '--'
  const fiveYearEquityUpliftDisplay =
    fiveYearEquityUpliftNumber != null ? `+${formatCurrency(fiveYearEquityUpliftNumber)}` : '--'
  const monthlyHoldingCostDisplay =
    monthlyHoldingCostNumber != null ? `${formatCompactCurrency(monthlyHoldingCostNumber)}/mo` : '--'
  const grossYieldDisplay = grossYieldNumber != null ? `${grossYieldNumber.toFixed(1)}%` : '--'
  const currentEquityDisplay =
    currentEquityNumber != null ? formatCurrency(currentEquityNumber) : '--'
  const acquisitionReadinessScoreDisplay =
    acquisitionReadinessScoreNumber != null ? `${acquisitionReadinessScoreNumber}%` : '--'
  const acquisitionReadinessBarWidth =
    acquisitionReadinessScoreNumber != null
      ? `${Math.max(0, Math.min(100, acquisitionReadinessScoreNumber))}%`
      : '0%'
  const unlockValueDisplay =
    unlockValueNumber != null ? formatCurrency(unlockValueNumber) : '--'
  const unlockSummaryDisplay =
    unlockValueNumber != null ? `expands purchase range by +${unlockValueDisplay}` : 'Complete setup to unlock'
  const unlockStripDisplay =
    unlockValueNumber != null
      ? `Reduce card limits → +${unlockValueDisplay} borrowing capacity`
      : 'Unavailable until setup complete'
  const hasScenarioData =
    purchaseRangeLowNumber != null &&
    purchaseRangeHighNumber != null &&
    typeof currentEquity === 'number' &&
    typeof year3Equity === 'number' &&
    typeof year5Equity === 'number'
  const isExecutableScenario =
    isExecutable === true &&
    purchaseRangeLowNumber != null &&
    purchaseRangeHighNumber != null
  const isDataRichBlockedScenario = hasScenarioData === true && isExecutableScenario === false
  const hasNoScenarioData = hasScenarioData === false
  const readinessPillars = acquisitionReadinessData?.pillars ?? null
  const toPillarScoreDisplay = (value) => {
    const numeric = toFiniteNumber(value)
    if (numeric == null) return null
    const percentage = numeric <= 1 ? Math.round(numeric * 100) : Math.round(numeric)
    return `${percentage}%`
  }
  const acquisitionSummaryCopy = isExecutableScenario
    ? 'Executable now.'
    : hasScenarioData
      ? 'Building toward viability.'
      : 'Setup in progress.'
  const acquisitionBreakdownRows = [
    {
      label: 'Data completeness',
      value: toPillarScoreDisplay(readinessPillars?.dataCompleteness?.score),
    },
    {
      label: 'Borrowing capacity',
      value: toPillarScoreDisplay(readinessPillars?.borrowingCapacity?.score),
    },
    {
      label: 'Capital position',
      value: toPillarScoreDisplay(readinessPillars?.capitalPosition?.score),
    },
    {
      label: 'Cash flow health',
      value: toPillarScoreDisplay(readinessPillars?.cashFlowHealth?.score),
    },
    {
      label: 'Portfolio equity',
      value: toPillarScoreDisplay(readinessPillars?.portfolioEquity?.score),
    },
  ].filter((row) => row.value != null)
  const hasLimitedReadinessDrivers = acquisitionBreakdownRows.length <= 1

  const baselineYear0 = currentEquityNumber ?? 0
  const baselineYear3 =
    currentEquityNumber != null ? Math.round(currentEquityNumber * Math.pow(1.06, 3)) : 0
  const baselineYear5 =
    currentEquityNumber != null ? Math.round(currentEquityNumber * Math.pow(1.06, 5)) : 0
  const baselineYear10 =
    currentEquityNumber != null ? Math.round(currentEquityNumber * Math.pow(1.06, 10)) : 0
  const acquisitionYear0 = baselineYear0
  const acquisitionYear3 = baselineYear3 + (year3EquityNumber ?? 0)
  const acquisitionYear5 = baselineYear5 + (year5EquityNumber ?? 0)
  const acquisitionYear10 = baselineYear10 + (year10EquityNumber ?? 0)
  const hasYear10Point = year10EquityNumber != null

  const chartFloorY = 182
  const chartXPositions = hasYear10Point
    ? [36, 184, 305, 484]
    : [36, 262, 484]
  const visibleValues = hasScenarioData
    ? hasYear10Point
      ? [
          baselineYear0,
          baselineYear3,
          baselineYear5,
          baselineYear10,
          acquisitionYear0,
          acquisitionYear3,
          acquisitionYear5,
          acquisitionYear10,
        ]
      : [baselineYear0, baselineYear3, baselineYear5, acquisitionYear0, acquisitionYear3, acquisitionYear5]
    : hasYear10Point
      ? [currentEquityNumber ?? 0, baselineYear3, baselineYear5, baselineYear10]
      : [currentEquityNumber ?? 0, baselineYear3, baselineYear5]
  const minVal = Math.min(...visibleValues) * 0.98
  const maxVal = Math.max(...visibleValues) * 1.02
  const toChartY = (value) => scaleY(Number(value || 0), minVal, maxVal, chartFloorY)

  const baselinePoints = hasYear10Point
    ? [
        { x: chartXPositions[0], y: toChartY(baselineYear0), label: 'Today' },
        { x: chartXPositions[1], y: toChartY(baselineYear3), label: 'Year 3' },
        { x: chartXPositions[2], y: toChartY(baselineYear5), label: 'Year 5' },
        { x: chartXPositions[3], y: toChartY(baselineYear10), label: 'Year 10' },
      ]
    : [
        { x: chartXPositions[0], y: toChartY(baselineYear0), label: 'Today' },
        { x: chartXPositions[1], y: toChartY(baselineYear3), label: 'Year 3' },
        { x: chartXPositions[2], y: toChartY(baselineYear5), label: 'Year 5' },
      ]
  const acquisitionPoints = hasYear10Point
    ? [
        { x: chartXPositions[0], y: toChartY(acquisitionYear0), label: 'Today' },
        { x: chartXPositions[1], y: toChartY(acquisitionYear3), label: 'Year 3' },
        { x: chartXPositions[2], y: toChartY(acquisitionYear5), label: 'Year 5' },
        { x: chartXPositions[3], y: toChartY(acquisitionYear10), label: 'Year 10' },
      ]
    : [
        { x: chartXPositions[0], y: toChartY(acquisitionYear0), label: 'Today' },
        { x: chartXPositions[1], y: toChartY(acquisitionYear3), label: 'Year 3' },
        { x: chartXPositions[2], y: toChartY(acquisitionYear5), label: 'Year 5' },
      ]
  const primaryChartPoints = hasScenarioData ? acquisitionPoints : baselinePoints
  const baselinePath = buildLinePath(baselinePoints)
  const primaryPath = buildLinePath(primaryChartPoints)
  const areaPath = buildAreaPath(primaryChartPoints, chartFloorY)
  const chartYear3Display =
    hasScenarioData && acquisitionYear3 > 0
      ? `~${formatCompactCurrency(acquisitionYear3)}`
      : hasNoScenarioData && baselineYear3 > 0
        ? `~${formatCompactCurrency(baselineYear3)}`
        : '--'
  const chartYear5Display =
    hasScenarioData && acquisitionYear5 > 0
      ? `~${formatCurrency(acquisitionYear5)}`
      : hasNoScenarioData && baselineYear5 > 0
        ? `~${formatCurrency(baselineYear5)}`
        : '--'
  const chartYear10Display =
    hasYear10Point && hasScenarioData && acquisitionYear10 > 0
      ? `~${formatCurrency(acquisitionYear10)}`
      : hasYear10Point && hasNoScenarioData && baselineYear10 > 0
        ? `~${formatCurrency(baselineYear10)}`
        : '--'
  const acquisitionDifference = acquisitionYear5 - baselineYear5
  const acquisitionDifferenceDisplay = hasScenarioData
    ? `${acquisitionDifference >= 0 ? '+' : '-'}${formatCurrency(Math.abs(acquisitionDifference))} target property equity by year 5`
    : null

  useEffect(() => {
    const strokeElement = strokePathRef.current
    const fillElement = fillPathRef.current
    const endpointElement = endDotRef.current
    if (!strokeElement) return undefined

    const totalLength = strokeElement.getTotalLength()
    strokeElement.style.strokeDasharray = `${totalLength}`
    strokeElement.style.strokeDashoffset = `${totalLength}`
    strokeElement.style.transition = 'none'

    if (fillElement) {
      fillElement.style.opacity = '0'
      fillElement.style.transition = 'opacity 600ms ease-in 200ms'
    }

    if (endpointElement) {
      endpointElement.style.animation = 'none'
    }

    setHasAnimated(false)

    const firstFrame = requestAnimationFrame(() => {
      const secondFrame = requestAnimationFrame(() => {
        strokeElement.style.transition = 'stroke-dashoffset 900ms ease-in-out'
        strokeElement.style.strokeDashoffset = '0'
        if (fillElement && hasScenarioData) {
          fillElement.style.opacity = '1'
        }
        setHasAnimated(true)
      })
      rafRef.current.push(secondFrame)
    })
    rafRef.current = [firstFrame]

    pulseTimeoutRef.current = window.setTimeout(() => {
      if (endpointElement) {
        endpointElement.style.animation = 'heroDecisionEndDotPulse 400ms ease-in-out'
      }
    }, 950)

    return () => {
      rafRef.current.forEach((frame) => cancelAnimationFrame(frame))
      rafRef.current = []
      if (pulseTimeoutRef.current != null) {
        clearTimeout(pulseTimeoutRef.current)
      }
      strokeElement.style.transition = 'none'
      strokeElement.style.strokeDashoffset = `${totalLength}`
      if (fillElement) {
        fillElement.style.opacity = '0'
      }
      if (endpointElement) {
        endpointElement.style.animation = 'none'
      }
    }
  }, [hasScenarioData, primaryPath])

  return (
    <section className="relative overflow-hidden rounded-[2.4rem] border border-emerald-200/80 bg-white px-7 py-7 pb-4 shadow-[0_40px_120px_-72px_rgba(15,23,42,0.22)] md:px-9 md:py-9 md:pb-6">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-emerald-500 via-emerald-400 to-emerald-300" />
      <div className="pointer-events-none absolute -left-16 top-12 h-48 w-48 rounded-full bg-emerald-100/70 blur-3xl" />
      <div className="pointer-events-none absolute right-12 top-8 h-56 w-56 rounded-full bg-emerald-50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 right-20 h-64 w-64 rounded-full bg-lime-100/60 blur-3xl" />

      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.55fr)_320px] lg:gap-7">
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
                  {isExecutableScenario ? 'Indicatively viable' : 'Building toward'}
                </span>
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                  High confidence
                </span>
              </div>
            </div>
          </div>

          <div className="mt-7 max-w-4xl">
            <h1 className="max-w-3xl text-[2.3rem] font-semibold leading-[1.06] tracking-[-0.04em] text-slate-950 max-[480px]:text-[2rem] md:text-[3.25rem]">
              {isExecutableScenario
                ? 'Buy 1 investment property'
                : 'Building toward your next acquisition'}
              {isExecutableScenario ? (
                <span className="mt-2 block">in the {purchaseRangeDisplay} range</span>
              ) : null}
            </h1>
            <p className="mt-5 max-w-2xl text-[1.05rem] leading-8 text-emerald-800">
              {isExecutableScenario ? (
                <>
                  Based on current inputs, this pathway appears viable and illustrative - subject
                  to lender assessment and market conditions.
                </>
              ) : isDataRichBlockedScenario ? (
                <>
                  Based on current inputs, no currently viable acquisition scenario appears available based on current inputs.
                  Focus on the top actions below to strengthen your position.
                </>
              ) : (
                <>
                  Based on current inputs, no currently viable acquisition scenario appears available based on current inputs.
                  Focus on the top actions below to strengthen your position.
                </>
              )}
            </p>
          </div>

          {hasScenarioData ? (
            <div className="mt-8 grid gap-3 min-[481px]:grid-cols-1 md:grid-cols-2 xl:grid-cols-4 max-[480px]:grid-cols-1">
              <StatTile
                eyebrow="Executable range"
                value={executableRangeDisplay}
                detail="20% deposit - funded"
                tone="highlight"
              />
              <StatTile
                eyebrow="Target property equity (5Y)"
                value={fiveYearEquityUpliftDisplay}
                detail="At 6% annual growth"
              />
              <StatTile
                eyebrow="Estimated monthly cash flow"
                value={monthlyHoldingCostDisplay}
                detail="After tax offset est."
              />
              <StatTile
                eyebrow="Gross yield est."
                value={grossYieldDisplay}
                detail="Regional market"
              />
            </div>
          ) : null}

          <div className="mt-8 rounded-[2rem] border border-emerald-200/80 bg-[radial-gradient(circle_at_top,rgba(209,250,229,0.45),rgba(255,255,255,0.96)_62%)] p-4 shadow-[0_28px_70px_-50px_rgba(16,185,129,0.42)] md:px-5 md:py-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {hasScenarioData
                    ? 'Portfolio equity with vs without acquisition'
                    : 'Current portfolio trajectory'}
                </p>
                {hasScenarioData ? (
                  <>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Compare the illustrative 5-year outcome of
                      <br />
                      taking the next acquisition vs staying on
                      <br />
                      your current path.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-0.5 w-6 rounded-full bg-[#1D9E75]" />
                        With acquisition
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-0.5 w-6 rounded-full"
                          style={{
                            backgroundImage:
                              'repeating-linear-gradient(to right, #b8e8d8 0 8px, transparent 8px 14px)',
                          }}
                        />
                        Without acquisition
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Projected equity path without additional
                    <br />
                    acquisition activity.
                  </p>
                )}
              </div>
              {hasScenarioData && acquisitionDifferenceDisplay ? (
                <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50/90 px-3.5 py-1.5 text-sm font-medium text-emerald-800">
                  {acquisitionDifferenceDisplay}
                </span>
              ) : null}
            </div>

            <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/65 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] md:px-4">
              <svg
                viewBox="0 0 520 200"
                className="h-[188px] w-full max-[480px]:h-[156px]"
                role="img"
                aria-label="Portfolio wealth trajectory chart"
                data-animated={hasAnimated ? 'true' : 'false'}
              >
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

                {hasScenarioData ? (
                  <path ref={fillPathRef} d={areaPath} fill="url(#heroDecisionFill)" style={{ opacity: 0 }} />
                ) : null}
                {hasScenarioData ? (
                  <path
                    d={baselinePath}
                    fill="none"
                    stroke="#b8e8d8"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                    strokeLinecap="round"
                  />
                ) : null}
                <path
                  ref={strokePathRef}
                  d={primaryPath}
                  fill="none"
                  stroke={hasScenarioData ? 'url(#heroDecisionStroke)' : '#1D9E75'}
                  strokeWidth={hasScenarioData ? '2.5' : '3.5'}
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: 1,
                    strokeDashoffset: 1,
                  }}
                />

                <line
                  x1={primaryChartPoints[1].x}
                  y1="34"
                  x2={primaryChartPoints[1].x}
                  y2="182"
                  stroke="#9adfc5"
                  strokeWidth="1.5"
                  strokeDasharray="4 5"
                />

                {primaryChartPoints.map((point, index) => (
                  <g key={point.label}>
                    <circle
                      ref={index === primaryChartPoints.length - 1 ? endDotRef : null}
                      cx={point.x}
                      cy={point.y}
                      r={index === primaryChartPoints.length - 1 ? 6.5 : 4}
                      fill={index === primaryChartPoints.length - 1 ? '#059669' : '#10b981'}
                      style={
                        index === primaryChartPoints.length - 1
                          ? {
                              transformOrigin: `${point.x}px ${point.y}px`,
                              animation: 'none',
                            }
                          : undefined
                      }
                    />
                    {index === primaryChartPoints.length - 1 ? (
                      <circle cx={point.x} cy={point.y} r="12" fill="rgba(16,185,129,0.16)" />
                    ) : null}
                  </g>
                ))}
              </svg>

              <div className="relative mt-1.5 h-[52px] max-[480px]:h-[44px]">
                {[
                  {
                    label: 'Today',
                    value: currentEquityDisplay,
                    point: primaryChartPoints[0],
                    alignClass: 'text-left translate-x-2 max-[480px]:translate-x-0',
                  },
                  {
                    label: 'Year 3',
                    value: chartYear3Display,
                    point: primaryChartPoints[1],
                    alignClass: 'text-center -translate-x-1/2',
                  },
                  {
                    label: 'Year 5',
                    value: chartYear5Display,
                    point: primaryChartPoints[2],
                    alignClass: hasYear10Point
                      ? 'text-center -translate-x-1/2'
                      : 'text-right -translate-x-[calc(100%+8px)] max-[480px]:-translate-x-full',
                  },
                  ...(hasYear10Point
                    ? [
                        {
                          label: 'Year 10',
                          value: chartYear10Display,
                          point: primaryChartPoints[3],
                          alignClass:
                            'text-right -translate-x-[calc(100%+8px)] max-[480px]:-translate-x-full',
                        },
                      ]
                    : []),
                ].map(({ label, value, point, alignClass }) => (
                  <div
                    key={label}
                    className={`absolute top-0 ${alignClass}`}
                    style={{ left: pointToPercentX(point.x) }}
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400 max-[480px]:text-[10px]">{label}</p>
                    <p className="mt-1 text-base font-semibold tracking-tight text-slate-900 max-[480px]:text-[13px]">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-7 rounded-[1.6rem] border border-emerald-200/90 bg-emerald-50/80 px-5 py-4 shadow-[0_18px_40px_-34px_rgba(16,185,129,0.36)]">
            <p className="text-sm leading-6 text-emerald-900">
              <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 align-middle" />
              Next upgrade: reduce credit card limits →
              <span className="font-semibold"> {unlockSummaryDisplay}</span>
              <br />
              without changing your executable path today.
            </p>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-[2rem] border border-emerald-700/90 bg-[linear-gradient(180deg,#12403b_0%,#0f3d38_100%)] px-5 py-4 text-white shadow-[0_30px_80px_-38px_rgba(6,78,59,0.72)]">
            <p className="text-[1.35rem] font-semibold tracking-tight">
              {isExecutableScenario ? 'Deploy this strategy' : 'See what unlocks this'}
            </p>
            <button
              type="button"
              onClick={() => navigate('/growth-scenarios')}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[1.15rem] bg-white px-4 py-3 text-sm font-semibold text-emerald-950 shadow-[0_18px_40px_-28px_rgba(255,255,255,0.28)] transition-all duration-150 ease-out hover:bg-[#eef5f2] hover:shadow-[0_0_0_3px_rgba(29,158,117,0.25)]"
            >
              Explore scenarios
              <ArrowRight size={16} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate('/growth-scenarios')}
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
                {acquisitionReadinessScoreDisplay}
              </p>
              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                {acquisitionReadinessLabelValue}
              </span>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-emerald-50">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-lime-300"
                style={{ width: acquisitionReadinessBarWidth }}
              />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              {acquisitionSummaryCopy}
            </p>
            {acquisitionBreakdownRows.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsReadinessExpanded((current) => !current)}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                >
                  See what drives this score
                  <ChevronRight
                    size={15}
                    className={`transition-transform duration-250 ease-out ${
                      isReadinessExpanded ? 'rotate-90' : ''
                    }`}
                  />
                </button>

                <div
                  className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
                  style={{ maxHeight: isReadinessExpanded ? '320px' : '0px' }}
                >
                  <div className="mt-4 border-t border-[rgba(0,0,0,0.08)] pt-4">
                    <p className="text-[11px] leading-[1.5] text-slate-500">
                      Your acquisition position is derived from the key criteria below.
                    </p>
                    {acquisitionBreakdownRows.length > 0 ? (
                      <div className="mt-3 divide-y divide-[rgba(0,0,0,0.06)]">
                        {acquisitionBreakdownRows.map((row) => (
                          <div
                            key={row.label}
                            className="flex items-center justify-between gap-4 py-2.5 text-sm"
                          >
                            <span className="text-slate-600">{row.label}</span>
                            <span className="font-medium text-slate-900">{row.value}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {hasLimitedReadinessDrivers ? (
                      <p className="mt-3 text-[11px] leading-[1.5] text-slate-500">
                        More score drivers will appear as additional readiness inputs become available.
                      </p>
                    ) : (
                      <p className="mt-3 text-[11px] leading-[1.5] text-slate-500">
                        Weighted to derive your overall acquisition position score.
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <div
            className="rounded-[12px] border px-[14px] py-[10px]"
            style={{ backgroundColor: '#f4faf7', borderColor: '#c8e8dc', color: '#085041' }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Top unlock</p>
            <p className="mt-1 text-[12px] leading-5">
              {unlockStripDisplay}
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




