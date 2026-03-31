import { startTransition, useEffect, useMemo, useState } from 'react'

import useFinancialData from '../hooks/useFinancialData'
import usePortfolioData from '../hooks/usePortfolioData'
import calculateBorrowingPower from '../lib/borrowingPowerEngine'
import buildPortfolioGrowthScenarios, {
  calculateEconomicOutcome,
} from '../lib/portfolioGrowthScenarios'
import { calculateNegativeGearingTaxBenefit } from '../lib/negativeGearingTaxBenefit'
import { calculateAfterTaxHoldingCost } from '../lib/afterTaxHoldingCost'
import { normalizeTaxOwnership } from '../lib/taxOwnership'
import { useGrowthScenariosUiStore } from '../stores/growthScenariosUiStore'

const MAX_ANNUAL_DEPRECIATION = 20000
const HIGH_DEPRECIATION_WARNING_THRESHOLD = 15000
const DEPOSIT_PURCHASE_POWER_LEVELS = [5, 10, 15, 20, 25]
const DEPOSIT_STRATEGY_OPTIONS = [
  { value: '20', label: '20% deposit (default)', depositRatio: 0.2 },
  { value: '10', label: '10% deposit + LMI', depositRatio: 0.1 },
  { value: '5', label: '5% deposit + LMI', depositRatio: 0.05 },
]
const INTEREST_RATE_QUICK_PICKS = [5.8, 6.5, 7.0, 8.0]
const STRESS_TEST_RATES = [5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5]
const DEFAULT_DEBT_RATE_PCT = 5.8

function getConfidenceLabel(score) {
  if (score >= 85) return 'High'
  if (score >= 65) return 'Medium'
  return 'Low'
}

function getConfidenceSummary(score) {
  if (score >= 85) return 'High confidence based on complete data'
  if (score >= 65) return 'Medium confidence based on partial data'
  return 'Lower confidence due to missing or limited data'
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))
}

function getSafeNumber(value) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : null
}

function parseCurrencyAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0

  const normalizedValue = String(value ?? '').replace(/[^\d.-]/g, '')
  const numericValue = Number(normalizedValue)

  return Number.isFinite(numericValue) ? numericValue : 0
}

function sanitizeSavingsInput(value) {
  const digitsOnly = String(value ?? '').replace(/[^\d]/g, '')
  if (digitsOnly === '') return ''
  return digitsOnly.replace(/^0+(?=\d)/, '')
}

function sanitizeDecimalInput(value, { maxDecimals = 2 } = {}) {
  const rawValue = String(value ?? '')
  const digitsAndDots = rawValue.replace(/[^\d.]/g, '')

  if (digitsAndDots === '') return ''

  const [integerPartRaw = '', ...fractionParts] = digitsAndDots.split('.')
  const normalizedIntegerPart = integerPartRaw.replace(/^0+(?=\d)/, '')
  const fractionPart = fractionParts.join('').slice(0, maxDecimals)

  if (digitsAndDots.startsWith('.')) {
    return fractionPart ? `0.${fractionPart}` : '0.'
  }

  if (rawValue.endsWith('.') && fractionPart === '') {
    return `${normalizedIntegerPart || '0'}.`
  }

  return fractionPart ? `${normalizedIntegerPart || '0'}.${fractionPart}` : normalizedIntegerPart
}

function normalizeInterestRateInput(value, fallback) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) return fallback
  return Math.min(15, numericValue)
}

function normalizeScenario(scenario) {
  const breakdown = scenario?.breakdown || {}

  return {
    ...scenario,
    capitalBreakdown: {
      usableEquityBeforeBuffer:
        breakdown.capital?.usableEquityBeforeBuffer ?? formatCurrency(0),
      usableEquityAfterBuffer:
        breakdown.capital?.usableEquityAfterBuffer ?? formatCurrency(0),
      cashAvailableForInvestment:
        breakdown.capital?.cashAvailableForInvestment ?? formatCurrency(0),
      cashUsed: breakdown.capital?.cashUsed ?? formatCurrency(0),
      totalCapitalUsed: breakdown.capital?.totalCapitalUsed ?? formatCurrency(0),
      bufferRetained: breakdown.capital?.bufferRetained ?? formatCurrency(0),
      totalDeployableCapital:
        breakdown.capital?.totalDeployableCapital ?? formatCurrency(0),
    },
    purchaseStructure: {
      targetPrice: breakdown.purchaseStructure?.targetPrice ?? formatCurrency(0),
      depositPct: breakdown.purchaseStructure?.depositPct ?? '0%',
      depositAmount: breakdown.purchaseStructure?.depositAmount ?? formatCurrency(0),
      acquisitionCosts:
        breakdown.purchaseStructure?.acquisitionCosts ?? formatCurrency(0),
      lmiEstimate: breakdown.purchaseStructure?.lmiEstimate ?? formatCurrency(0),
      totalCapitalRequired:
        breakdown.purchaseStructure?.totalCapitalRequired ?? formatCurrency(0),
    },
    loanStructure: {
      baseLoanSize: breakdown.loanStructure?.baseLoanSize ?? formatCurrency(0),
      lmiEstimate: breakdown.loanStructure?.lmiEstimate ?? formatCurrency(0),
      loanSize: breakdown.loanStructure?.loanSize ?? formatCurrency(0),
      interestRate: breakdown.loanStructure?.interestRate ?? '0.0%',
      monthlyRepayment: breakdown.loanStructure?.monthlyRepayment ?? formatCurrency(0),
    },
    cashFlowBreakdown: {
      rentalIncome: breakdown.cashFlow?.rentalIncome ?? `${formatCurrency(0)}/month`,
      expenses: breakdown.cashFlow?.expenses ?? `${formatCurrency(0)}/month`,
      netCashFlow: breakdown.cashFlow?.netCashFlow ?? `${formatCurrency(0)}/month`,
    },
    serviceabilityImpact: {
      surplusBefore:
        breakdown.serviceabilityImpact?.surplusBefore ?? formatCurrency(0),
      surplusAfter:
        breakdown.serviceabilityImpact?.surplusAfter ?? formatCurrency(0),
      borrowingCapacityAfterPurchase:
        breakdown.serviceabilityImpact?.borrowingCapacityAfterPurchase ??
        formatCurrency(0),
    },
    growthAssumptions: {
      growthRate: breakdown.growthAssumptions?.growthRate ?? '0.0%',
      fiveYearValue: breakdown.growthAssumptions?.fiveYearValue ?? formatCurrency(0),
      equityCreated: breakdown.growthAssumptions?.equityCreated ?? formatCurrency(0),
    },
    constraints: Array.isArray(breakdown.constraints) ? breakdown.constraints : [],
    projectionData: Array.isArray(scenario?.projectionData) ? scenario.projectionData : [],
    isFeasible: scenario?.isFeasible !== false,
    feasibilityMessage: scenario?.feasibilityMessage ?? null,
    additionalCapitalRequired: Number(scenario?.additionalCapitalRequired || 0),
  }
}

function AssumptionTrace({ text, className = '' }) {
  if (!text) return null

  return (
    <p className={`${className} mt-2 text-[11px] leading-[1.5] text-[var(--color-text-tertiary)]`.trim()}>
      {text}
    </p>
  )
}

function BreakdownRow({ label, value, strong = false, helper = null }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <span
          className={`text-[13px] leading-[1.6] ${
            strong ? 'font-medium text-slate-700' : 'font-normal text-[var(--color-text-secondary)]'
          }`}
        >
          {label}
        </span>
        {helper ? (
          <p className="mt-1 text-[11px] leading-[1.5] text-[var(--color-text-tertiary)]">
            {helper}
          </p>
        ) : null}
      </div>
      <span
        className={`text-right text-[13px] leading-[1.6] ${
          strong ? 'font-medium text-[var(--color-text-primary)]' : 'font-normal text-[var(--color-text-primary)]'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function TaxAssumptionsContent({
  ownershipStructure,
  ownershipSplitUserInput,
  ownershipSplitPartnerInput,
  ownershipSplitInlineError,
  showJointOwnershipIncomeWarning,
  onOwnershipStructureChange,
  onOwnershipSplitUserChange,
  onOwnershipSplitPartnerChange,
  taxIncomeBasisLabel,
  includeDepreciation,
  annualDepreciation,
  className = '',
}) {
  return (
    <div className={`${className} space-y-4 rounded-[1.5rem] border border-slate-200/75 bg-slate-50/70 px-5 py-5 md:px-6 md:py-6`.trim()}>
      <div className="flex items-start justify-between gap-4">
        <span className="text-[1.03rem] text-slate-500">Ownership</span>
        <select
          value={ownershipStructure}
          onChange={(event) => onOwnershipStructureChange(event.target.value)}
          className="min-w-[11rem] rounded-xl border border-slate-200/75 bg-white px-4 py-3 text-right text-[1.03rem] font-medium text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
        >
          <option value="individual">Individual</option>
          <option value="joint">Joint ownership</option>
        </select>
      </div>

      {ownershipStructure === 'joint' ? (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <span className="text-[1.03rem] text-slate-500">Split</span>
            <span className="text-right text-[1.03rem] font-medium text-slate-950">
              {`${ownershipSplitUserInput || '0'} / ${ownershipSplitPartnerInput || '0'}`}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-slate-500">User %</label>
              <input
                type="text"
                inputMode="decimal"
                value={ownershipSplitUserInput}
                onChange={(event) => onOwnershipSplitUserChange(event.target.value)}
                className="w-full rounded-xl border border-slate-200/75 bg-white px-4 py-3 text-[1.03rem] font-medium text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-slate-500">Partner %</label>
              <input
                type="text"
                inputMode="decimal"
                value={ownershipSplitPartnerInput}
                onChange={(event) => onOwnershipSplitPartnerChange(event.target.value)}
                className="w-full rounded-xl border border-slate-200/75 bg-white px-4 py-3 text-[1.03rem] font-medium text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
              />
            </div>
          </div>

          {ownershipSplitInlineError ? (
            <p className="text-sm text-red-600">{ownershipSplitInlineError}</p>
          ) : null}
          {showJointOwnershipIncomeWarning ? (
            <p className="text-sm text-amber-700">
              Add partner income to estimate joint ownership tax benefit accurately.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4">
          <span className="text-[1.03rem] text-slate-500">Split</span>
          <span className="text-right text-[1.03rem] font-medium text-slate-950">100 / 0</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <span className="text-[1.03rem] text-slate-500">Income source basis</span>
        <span className="text-right text-[1.03rem] font-medium text-slate-950">
          {taxIncomeBasisLabel}
        </span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <span className="text-[1.03rem] text-slate-500">Tax regime</span>
        <span className="text-right text-[1.03rem] font-medium text-slate-950">
          Australian resident individual
        </span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <span className="text-[1.03rem] text-slate-500">Depreciation</span>
        <span className="text-right text-[1.03rem] font-medium text-slate-950">
          {includeDepreciation
            ? `Included (${formatCurrency(annualDepreciation)}/year)`
            : 'Not included'}
        </span>
      </div>
    </div>
  )
}

function ChartInsight({ text }) {
  if (!text) return null

  return (
    <p className="mt-4 text-[13px] font-normal leading-[1.6] text-[var(--color-text-secondary)]">
      {text}
    </p>
  )
}

function GraphPanel({
  children,
  preface = null,
  insight = null,
  confidenceLabel = null,
  warning = null,
  traceability = null,
  note = null,
}) {
  return (
    <div>
      {preface ? (
        <p className="mb-4 max-w-[42rem] text-[13px] font-normal leading-[1.6] text-[var(--color-text-secondary)]">
          {preface}
        </p>
      ) : null}
      {children}
      {insight || traceability || note || confidenceLabel ? (
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[1.15fr_1fr]">
          <div className="rounded-[1.45rem] border border-slate-200/80 bg-slate-50/80 px-4 py-4 md:px-5">
            <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
              Insight
            </p>
            {insight ? (
              <p className="mt-3 text-[13px] font-normal leading-[1.6] text-[var(--color-text-secondary)]">
                {insight}
              </p>
            ) : null}
            {note ? (
              <p className="mt-2 text-[11px] leading-[1.5] text-[var(--color-text-tertiary)]">
                {note}
              </p>
            ) : null}
          </div>
          <div className="rounded-[1.45rem] border border-slate-200/80 bg-white px-4 py-4 md:px-5">
            <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
              Traceability
            </p>
            <div className="mt-3 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-x-4 md:gap-y-2">
              {traceability ? (
                <p className="text-[11px] leading-[1.5] text-[var(--color-text-tertiary)]">
                  {traceability}
                </p>
              ) : null}
              {confidenceLabel ? (
                <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
                  Confidence: {confidenceLabel}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {warning ? (
        <p className="mt-2 text-[13px] font-normal leading-[1.6] text-amber-700">{warning}</p>
      ) : null}
    </div>
  )
}

function AnalysisChartCard({
  title,
  subtitle = null,
  xLabel,
  yLabel,
  points,
  data = null,
  series = null,
  tooltipContextLabel = null,
  tooltipContextFormatter = null,
  tooltipValueFormatter = null,
  tooltipSupportingRows = null,
  yAxisInlineLabel = false,
  lineColor = '#0F172A',
  accentColor = '#C2410C',
  fill = false,
}) {
  const [hoverIndex, setHoverIndex] = useState(null)
  const [hoverPosition, setHoverPosition] = useState(null)
  const width = 860
  const height = 356
  const left = yAxisInlineLabel ? 96 : 88
  const right = 28
  const top = yAxisInlineLabel ? 46 : 30
  const bottom = 60
  const innerWidth = width - left - right
  const innerHeight = height - top - bottom
  const hasSeries = Array.isArray(series) && Array.isArray(data) && data.length > 0
  const safePoints =
    !hasSeries && points.length > 0 ? points : !hasSeries ? [{ label: '', value: 0 }] : []
  const safeSeries = hasSeries
    ? series.filter((entry) => entry && entry.dataKey)
    : [
        {
          dataKey: 'value',
          label: title,
          color: lineColor,
          accentColor,
          fill,
        },
      ]
  const chartData = hasSeries
    ? data
    : safePoints.map((point) => ({
        label: point.label,
        value: Number(point.value || 0),
        highlight: point.highlight === true,
      }))
  const allValues = hasSeries
    ? chartData.flatMap((datum) =>
        safeSeries
          .map((entry) => Number(datum?.[entry.dataKey]))
          .filter((value) => Number.isFinite(value))
      )
    : safePoints.map((point) => Number(point.value || 0))
  const minValue = Math.min(...allValues)
  const maxValue = Math.max(...allValues)
  const paddedMin = minValue > 0 ? 0 : minValue * 1.05
  const paddedMax = maxValue === paddedMin ? paddedMin + 1 : maxValue * 1.08
  const getX = (index) =>
    left +
    (chartData.length === 1 ? innerWidth / 2 : (index / (chartData.length - 1)) * innerWidth)
  const getY = (value) => {
    const ratio = (Number(value || 0) - paddedMin) / (paddedMax - paddedMin)
    return top + innerHeight - ratio * innerHeight
  }
  const buildSeriesPath = (dataKey) =>
    chartData
      .map((datum, index) => {
        const value = Number(datum?.[dataKey] ?? 0)
        return `${index === 0 ? 'M' : 'L'} ${getX(index).toFixed(2)} ${getY(value).toFixed(2)}`
      })
      .join(' ')
  const buildFillPath = (path) =>
    `${path} L ${left + innerWidth} ${top + innerHeight} L ${left} ${top + innerHeight} Z`
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const value = paddedMax - ((paddedMax - paddedMin) / 4) * index
    return {
      value,
      y: top + (innerHeight / 4) * index,
    }
  })
  const hoveredDatum =
    hoverIndex !== null && hoverIndex >= 0 && hoverIndex < chartData.length
      ? chartData[hoverIndex]
      : null
  const hoveredYearOrLabel =
    typeof tooltipContextFormatter === 'function'
      ? tooltipContextFormatter(hoveredDatum)
      : hoveredDatum?.label ??
        (Number.isFinite(Number(hoveredDatum?.year)) ? `Year ${hoveredDatum?.year}` : '')
  const primarySeries = safeSeries.find((entry) => entry.showInTooltip !== false) || safeSeries[0]
  const defaultValueFormatter = (value) =>
    typeof tooltipValueFormatter === 'function' ? tooltipValueFormatter(value) : formatCurrency(value)
  const supportingRows =
    typeof tooltipSupportingRows === 'function' ? tooltipSupportingRows(hoveredDatum, safeSeries) : []
  const visibleTooltipSeries = safeSeries.filter((entry) => {
    if (entry.showInTooltip === false || !hoveredDatum) return false
    return Number.isFinite(Number(hoveredDatum?.[entry.dataKey]))
  })
  const tooltipHeightEstimate =
    78 +
    visibleTooltipSeries.length * 28 +
    supportingRows.length * 24 +
    (primarySeries && Number.isFinite(Number(hoveredDatum?.[primarySeries.dataKey])) ? 18 : 0)
  const tooltipWidthEstimate = 252

  return (
    <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.35)] md:p-6">
      <div className="mb-5">
        <p className="text-[15px] font-medium text-[var(--color-text-primary)]">{title}</p>
        {subtitle ? (
          <p className="mt-1.5 max-w-[44rem] text-[13px] font-normal leading-[1.6] text-[var(--color-text-secondary)]">
            {subtitle}
          </p>
        ) : null}
      </div>

      <div className="rounded-[1.45rem] border border-slate-100 bg-slate-50/40 p-4 md:p-5">
        {hasSeries ? (
          <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.93rem] font-medium text-slate-700">
            {safeSeries
              .filter((entry) => entry.showInLegend !== false)
              .map((entry) => (
                <div key={entry.dataKey} className="flex items-center gap-3">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span>{entry.label}</span>
                </div>
              ))}
          </div>
        ) : null}
        <div className="relative">
          {hoveredDatum && hoverPosition ? (
            <div
              className="pointer-events-none absolute z-10 min-w-[15rem] max-w-[16rem] rounded-[1.2rem] border border-slate-200/85 bg-white/97 px-4 py-3.5 shadow-[0_24px_50px_-28px_rgba(15,23,42,0.42)] backdrop-blur"
              style={{
                left: `${Math.max(
                  12,
                  Math.min(
                    hoverPosition.x > hoverPosition.containerWidth * 0.58
                      ? hoverPosition.x - tooltipWidthEstimate - 16
                      : hoverPosition.x + 16,
                    hoverPosition.containerWidth - tooltipWidthEstimate - 12
                  )
                )}px`,
                top: `${Math.max(
                  12,
                  Math.min(
                    hoverPosition.y - tooltipHeightEstimate / 2,
                    hoverPosition.containerHeight - tooltipHeightEstimate - 12
                  )
                )}px`,
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                {tooltipContextLabel || xLabel}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{hoveredYearOrLabel}</p>
              {primarySeries && Number.isFinite(Number(hoveredDatum?.[primarySeries.dataKey])) ? (
                <div className="mt-3 rounded-[0.95rem] bg-slate-50/90 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: primarySeries.color }}
                      />
                      <span className="text-sm text-slate-600">{primarySeries.label}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-950">
                      {defaultValueFormatter(hoveredDatum?.[primarySeries.dataKey])}
                    </span>
                  </div>
                </div>
              ) : null}
              <div className="mt-3 space-y-2.5">
                {safeSeries
                  .filter(
                    (entry) =>
                      entry.showInTooltip !== false && entry.dataKey !== primarySeries?.dataKey
                  )
                  .map((entry) => {
                    const value = hoveredDatum?.[entry.dataKey]
                    if (!Number.isFinite(Number(value))) return null

                    return (
                      <div key={entry.dataKey} className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="text-sm text-slate-600">{entry.label}</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-950">
                          {defaultValueFormatter(value)}
                        </span>
                      </div>
                    )
                  })}
                {supportingRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-slate-500">{row.label}</span>
                    <span className="text-sm font-semibold text-slate-950">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <svg viewBox={`0 0 ${width} ${height}`} className="h-[356px] w-full" aria-hidden="true">
            {yAxisInlineLabel ? (
              <text
                x={left}
                y={22}
                textAnchor="start"
                className="fill-slate-500 text-[11px] font-semibold uppercase tracking-[0.22em]"
              >
                {yLabel}
              </text>
            ) : null}
          {hoverIndex !== null ? (
            <line
              x1={getX(hoverIndex)}
              y1={top}
              x2={getX(hoverIndex)}
              y2={top + innerHeight}
              stroke="#CBD5E1"
              strokeWidth="1.2"
              strokeDasharray="4 6"
            />
          ) : null}
          <g stroke="#E7EDF3" strokeWidth="1">
            {yTicks.map((tick) => (
              <line
                key={`grid-${tick.y}`}
                x1={left}
                y1={tick.y}
                x2={left + innerWidth}
                y2={tick.y}
              />
            ))}
          </g>
          <g stroke="#EEF2F6" strokeWidth="1">
            {chartData.map((point, index) => {
              const x = getX(index)
              return <line key={`v-${point.label}`} x1={x} y1={top} x2={x} y2={top + innerHeight} />
            })}
          </g>
          <line x1={left} y1={top} x2={left} y2={top + innerHeight} stroke="#CBD5E1" strokeWidth="1.2" />
          <line
            x1={left}
            y1={top + innerHeight}
            x2={left + innerWidth}
            y2={top + innerHeight}
            stroke="#CBD5E1"
            strokeWidth="1.2"
          />

          {safeSeries.map((entry) => {
            const path = buildSeriesPath(entry.dataKey)
            const shouldFill = entry.fill === true || (!hasSeries && fill)

            return (
              <g key={entry.dataKey}>
                {shouldFill ? (
                  <path d={buildFillPath(path)} fill={entry.color} opacity="0.09" />
                ) : null}
                <path
                  d={path}
                  fill="none"
                  stroke={entry.color}
                  strokeWidth={entry.strokeWidth ?? 4}
                  strokeLinecap="round"
                  strokeDasharray={entry.strokeDasharray}
                />
                {chartData.map((point, index) => {
                  const value = Number(point?.[entry.dataKey] ?? 0)
                  if (!Number.isFinite(value)) return null

                  const isAccent =
                    entry.dataKey === 'value'
                      ? point.highlight === true
                      : point[entry.highlightKey || 'highlight'] === true
                  const x = getX(index)
                  const y = getY(value)

                  return (
                    <circle
                      key={`${entry.dataKey}-${point.label}-${index}`}
                      cx={x}
                      cy={y}
                      r={isAccent ? 6 : entry.dotRadius ?? 4.5}
                      fill={isAccent ? entry.accentColor || accentColor : entry.color}
                      stroke="#FFFFFF"
                      strokeWidth={2.5}
                      opacity={entry.showDots === false ? 0 : 1}
                    />
                  )
                })}
              </g>
            )
          })}

          {yTicks.map((tick) => (
            <text
              key={`label-${tick.y}`}
              x={left - 14}
              y={tick.y + 5}
              textAnchor="end"
              className="fill-slate-500 text-[11px] font-medium"
            >
              {formatCurrency(Math.round(tick.value))}
            </text>
          ))}

          {chartData.map((point, index) => {
            const x = getX(index)
            const shouldShowLabel =
              hasSeries
                ? index === 0 ||
                  index === chartData.length - 1 ||
                  Number(point?.year || 0) % 5 === 0
                : true
            if (!shouldShowLabel) return null
            return (
              <text
              key={`x-${point.label}`}
              x={x}
              y={height - 18}
              textAnchor="middle"
              className="fill-slate-500 text-[11px] font-medium"
            >
              {point.label ?? point.year}
            </text>
            )
          })}

          <text
            x={left + innerWidth / 2}
            y={height - 3}
            textAnchor="middle"
            className="fill-slate-500 text-[11px] font-semibold uppercase tracking-[0.18em]"
          >
            {xLabel}
          </text>
          {!yAxisInlineLabel ? (
            <text
              x={20}
              y={top + innerHeight / 2}
              textAnchor="middle"
              transform={`rotate(-90 20 ${top + innerHeight / 2})`}
              className="fill-slate-500 text-[12px] font-medium"
            >
              {yLabel}
            </text>
          ) : null}
          {chartData.map((point, index) => {
            const x = getX(index)
            const segmentWidth = chartData.length === 1 ? innerWidth : innerWidth / chartData.length
            return (
              <rect
                key={`hover-${point.label}-${index}`}
                x={Math.max(left, x - segmentWidth / 2)}
                y={top}
                width={Math.min(segmentWidth, left + innerWidth - Math.max(left, x - segmentWidth / 2))}
                height={innerHeight}
                fill="transparent"
                onMouseEnter={(event) => {
                  const svgRect = event.currentTarget.ownerSVGElement.getBoundingClientRect()
                  const primaryValue = Number(chartData[index]?.[primarySeries?.dataKey] ?? 0)
                  setHoverIndex(index)
                  setHoverPosition({
                    x: (getX(index) / width) * svgRect.width,
                    y: (getY(primaryValue) / height) * svgRect.height,
                    containerWidth: svgRect.width,
                    containerHeight: svgRect.height,
                  })
                }}
                onMouseMove={(event) => {
                  const svgRect = event.currentTarget.ownerSVGElement.getBoundingClientRect()
                  const primaryValue = Number(chartData[index]?.[primarySeries?.dataKey] ?? 0)
                  setHoverIndex(index)
                  setHoverPosition({
                    x: (getX(index) / width) * svgRect.width,
                    y: (getY(primaryValue) / height) * svgRect.height,
                    containerWidth: svgRect.width,
                    containerHeight: svgRect.height,
                  })
                }}
                onMouseLeave={() => {
                  setHoverIndex(null)
                  setHoverPosition(null)
                }}
              />
            )
          })}
          </svg>
        </div>
      </div>
    </div>
  )
}

function DepreciationControls({
  includeDepreciation,
  annualDepreciationInput,
  annualDepreciation,
  onIncludeDepreciationChange,
  onAnnualDepreciationChange,
}) {
  const showHighDepreciationWarning =
    Number(annualDepreciation || 0) > HIGH_DEPRECIATION_WARNING_THRESHOLD

  return (
    <div className="rounded-[1.5rem] border border-slate-200/75 bg-white px-5 py-5 md:px-6 md:py-6">
      <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-slate-500">
        Depreciation (optional)
      </p>
      <label className="mt-4 flex items-center justify-between gap-4 text-[1.03rem] text-slate-700">
        <span>Include non-cash depreciation to improve your tax position</span>
        <input
          type="checkbox"
          checked={includeDepreciation}
          onChange={(event) => onIncludeDepreciationChange(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
        />
      </label>
      {includeDepreciation ? (
        <div className="mt-4">
          <label className="mb-2 block text-sm text-slate-500">Annual depreciation estimate</label>
          <input
            type="text"
            inputMode="numeric"
            value={annualDepreciationInput}
            onChange={(event) => onAnnualDepreciationChange(event.target.value)}
            onBlur={() =>
              onAnnualDepreciationChange(
                String(
                  Math.max(
                    0,
                    Math.min(MAX_ANNUAL_DEPRECIATION, Number(annualDepreciationInput || 0))
                  )
                )
              )
            }
            className="w-full rounded-[1rem] border border-slate-200/75 bg-white px-4 py-4 text-[1.03rem] font-medium text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
          />
          <p className="mt-3 text-sm text-slate-500">
            Typical range: $3,000-$10,000 depending on property
          </p>
          {showHighDepreciationWarning ? (
            <p className="mt-2 text-sm text-amber-700">
              High depreciation - ensure this reflects a new or recently built property
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function MonthlyCashFlowBreakdown({
  scenario,
  taxOwnership = null,
  includeDepreciation = false,
  annualDepreciation = 0,
  className = '',
}) {
  if (!scenario) return null

  const scenarioPurchasePrice = getSafeNumber(scenario.scenarioPurchasePrice)
  const scenarioLoanAmount = getSafeNumber(scenario.scenarioLoanAmount)
  const hasTaxableIncome =
    Number(taxOwnership?.userTaxableIncome || 0) > 0 &&
    (taxOwnership?.ownershipStructure !== 'joint' ||
      Number(taxOwnership?.partnerTaxableIncome || 0) > 0)
  const monthlyRent = Number(scenario.monthlyRentalIncome || 0)
  const monthlyRepayment = Number(scenario.monthlyLoanRepayment || 0)
  const monthlyExpenses = Number(scenario.monthlyPropertyExpenses || 0)
  const netCashFlow = Number(scenario.estimatedMonthlyCashFlow || 0)
  const expenseBreakdown = scenario.monthlyExpenseBreakdown || {}
  const repaymentTypeLabel =
    String(scenario.repaymentType || '').trim().toLowerCase() === 'interest only'
      ? 'IO'
      : 'P&I'
  const scenarioRatePct = Number(scenario.scenarioInterestRatePct || 0)
  const negativeGearing = hasTaxableIncome
    ? calculateNegativeGearingTaxBenefit({
        ownershipStructure: taxOwnership?.ownershipStructure,
        ownershipSplitUserPct: taxOwnership?.ownershipSplitUserPct,
        ownershipSplitPartnerPct: taxOwnership?.ownershipSplitPartnerPct,
        userTaxableIncome: taxOwnership?.userTaxableIncome,
        partnerTaxableIncome: taxOwnership?.partnerTaxableIncome,
        monthlyPreTaxPropertyCashFlow: netCashFlow,
        includeDepreciation,
        annualDepreciation,
      })
    : null
  const afterTaxHoldingCost = hasTaxableIncome
    ? calculateAfterTaxHoldingCost({
        monthlyPreTaxPropertyCashFlow: netCashFlow,
        taxBenefitMonthly: negativeGearing.totalTaxBenefitMonthly,
      })
    : null
  const safeTotalTaxBenefitMonthly = getSafeNumber(negativeGearing?.totalTaxBenefitMonthly)
  const safeUserTaxBenefitAnnual = getSafeNumber(negativeGearing?.userTaxBenefitAnnual)
  const safePartnerTaxBenefitAnnual = getSafeNumber(negativeGearing?.partnerTaxBenefitAnnual)
  const safeUserAllocatedLoss = getSafeNumber(negativeGearing?.userAllocatedLoss)
  const safePartnerAllocatedLoss = getSafeNumber(negativeGearing?.partnerAllocatedLoss)
  const safeAfterTaxMonthlyImpact = getSafeNumber(afterTaxHoldingCost?.afterTaxMonthlyCashFlow)
  const safeDepreciationTaxBenefitMonthly = getSafeNumber(
    negativeGearing?.depreciationTaxBenefitMonthly
  )
  const safeBaseTaxBenefitMonthly =
    safeTotalTaxBenefitMonthly !== null && safeDepreciationTaxBenefitMonthly !== null
      ? Math.max(safeTotalTaxBenefitMonthly - safeDepreciationTaxBenefitMonthly, 0)
      : null
  const hasCompleteTaxResult =
    safeTotalTaxBenefitMonthly !== null &&
    safeUserTaxBenefitAnnual !== null &&
    safePartnerTaxBenefitAnnual !== null &&
    safeUserAllocatedLoss !== null &&
    safePartnerAllocatedLoss !== null &&
    safeAfterTaxMonthlyImpact !== null &&
    safeDepreciationTaxBenefitMonthly !== null &&
    safeBaseTaxBenefitMonthly !== null

  return (
    <details
      className={`${className} rounded-[2rem] border border-slate-200/75 bg-slate-50/70 px-5 py-4 md:px-6`.trim()}
    >
      <summary className="cursor-pointer list-none text-sm font-medium text-slate-700 marker:hidden">
        View monthly cash flow breakdown
      </summary>
      <div className="mt-4 rounded-[1.5rem] border border-slate-200/75 bg-white p-5 md:p-6">
        {scenarioPurchasePrice !== null && scenarioLoanAmount !== null ? (
          <p className="mb-4 text-sm text-slate-600">
            Based on ~{formatCurrency(scenarioPurchasePrice)} purchase price with{' '}
            {formatCurrency(scenarioLoanAmount)} loan at {scenarioRatePct.toFixed(1)}%
          </p>
        ) : null}
        <AssumptionTrace
          text={`Inputs used: rent, loan repayment, and property expenses · Assumptions: ${repaymentTypeLabel} repayment at ${scenarioRatePct.toFixed(1)}% and structured expense allowances`}
          className="mb-4"
        />
        <div className="space-y-3">
          <BreakdownRow label="Rent" value={formatCurrency(monthlyRent)} />
          <BreakdownRow
            label={`Loan repayment (${repaymentTypeLabel} @ ${scenarioRatePct.toFixed(1)}%)`}
            value={`-${formatCurrency(Math.abs(monthlyRepayment))}`}
          />
          <div className="rounded-xl border border-slate-200/75 bg-slate-50/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Expenses
            </p>
            <div className="mt-3 space-y-3">
              <BreakdownRow
                label="Property management"
                value={`-${formatCurrency(Math.abs(Number(expenseBreakdown.propertyManagement || 0)))}`}
              />
              <BreakdownRow
                label="Council + water"
                value={`-${formatCurrency(
                  Math.abs(
                    Number((expenseBreakdown.councilWater ?? expenseBreakdown.councilRates) || 0)
                  )
                )}`}
              />
              <BreakdownRow
                label="Insurance"
                value={`-${formatCurrency(Math.abs(Number(expenseBreakdown.insurance || 0)))}`}
              />
              <BreakdownRow
                label="Maintenance (estimated)"
                value={`-${formatCurrency(Math.abs(Number(expenseBreakdown.maintenance || 0)))}`}
              />
              <BreakdownRow
                label="Vacancy buffer"
                value={`-${formatCurrency(Math.abs(Number(expenseBreakdown.vacancyBuffer || 0)))}`}
              />
              <BreakdownRow
                label="Total expenses"
                value={`-${formatCurrency(Math.abs(monthlyExpenses))}`}
                strong
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Assumptions: Property management{' '}
              {(
                Number(expenseBreakdown.assumptions?.propertyManagementRate || 0) * 100
              ).toFixed(1)}
              % of rent, vacancy buffer{' '}
              {(
                Number(expenseBreakdown.assumptions?.vacancyBufferRate || 0) * 100
              ).toFixed(1)}
              % of rent, council + water{' '}
              {formatCurrency(expenseBreakdown.assumptions?.councilWaterMonthly || 0)}/month,
              insurance {formatCurrency(expenseBreakdown.assumptions?.insuranceMonthly || 0)}
              /month, maintenance{' '}
              {(
                Number(expenseBreakdown.assumptions?.maintenanceAnnualRate || 0) * 100
              ).toFixed(1)}
              % of property value / year.
            </p>
          </div>
          <BreakdownRow
            label="Net cash flow"
            value={`${netCashFlow >= 0 ? '+' : '-'}${formatCurrency(Math.abs(netCashFlow))}/month`}
            strong
          />
          {hasTaxableIncome && afterTaxHoldingCost && hasCompleteTaxResult ? (
            <>
              <BreakdownRow
                label="Tax benefit"
                value={`+${formatCurrency(safeBaseTaxBenefitMonthly)}/month`}
              />
              <BreakdownRow
                label="Depreciation benefit"
                value={`+${formatCurrency(safeDepreciationTaxBenefitMonthly)}/month`}
              />
              <BreakdownRow
                label="After-tax net impact"
                value={`${safeAfterTaxMonthlyImpact >= 0 ? '+' : '-'}${formatCurrency(
                  Math.abs(safeAfterTaxMonthlyImpact)
                )}/month`}
                strong
              />
              <p className="text-xs text-slate-500">
                Tax benefit is estimated from current income and Australian tax brackets.
              </p>
              {includeDepreciation &&
              getSafeNumber(negativeGearing?.depreciationTaxBenefitMonthly) !== null ? (
                <p className="text-xs text-slate-500">
                  Depreciation adds an estimated +
                  {formatCurrency(negativeGearing.depreciationTaxBenefitMonthly)}/month to tax
                  benefit.
                </p>
              ) : null}
            </>
          ) : hasTaxableIncome ? (
            <p className="text-xs text-slate-500">
              Tax estimate unavailable until ownership inputs are complete.
            </p>
          ) : (
            <p className="text-xs text-slate-500">Add income to estimate tax benefit</p>
          )}
        </div>
      </div>
    </details>
  )
}

function ScenarioFundingBreakdown({ breakdown, className = '' }) {
  if (!breakdown) return null

  return (
    <div
      className={`${className} rounded-[2rem] border border-slate-200/75 bg-slate-50/70 px-6 py-6 md:px-8 md:py-8`.trim()}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
        Funding Breakdown
      </p>
      <div className="mt-5 space-y-3">
        <BreakdownRow label="Available capital" value={breakdown.availableCapital} strong />
        <BreakdownRow label="Deposit required" value={breakdown.depositRequired} />
        <BreakdownRow label="Acquisition costs" value={breakdown.acquisitionCosts} />
        <BreakdownRow label="Total required" value={breakdown.totalRequiredCapital} strong />
        <BreakdownRow label="Remaining gap" value={breakdown.remainingCapitalGap} strong />
      </div>
    </div>
  )
}

function ScenarioMetric({ label, value, className = '', valueClassName = '' }) {
  return (
    <div
      className={`flex min-w-0 w-full overflow-hidden rounded-xl bg-slate-50 px-4 py-4 transition-[opacity,transform,background-color] duration-200 ${className}`.trim()}
    >
      <div className="flex min-w-0 w-full flex-col items-start gap-3">
        <p className="text-[10px] font-medium uppercase leading-tight tracking-[0.16em] text-slate-500 md:text-[11px]">
          {label}
        </p>
        <p
          className={`min-w-0 max-w-full truncate whitespace-nowrap text-[20px] font-semibold leading-none tracking-tight text-slate-900 transition-[opacity,transform,color] duration-200 md:text-[22px] ${valueClassName}`.trim()}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

export default function PortfolioGrowthScenariosRebuild() {
  const { properties, loans, transactions, loading: portfolioLoading } = usePortfolioData()
  const { financialProfile, liabilities, loading: financialLoading } = useFinancialData()
  const [isScenarioRefreshing, setIsScenarioRefreshing] = useState(false)
  const [isDeferredAnalysisReady, setIsDeferredAnalysisReady] = useState(false)
  const activeTab = useGrowthScenariosUiStore((state) => state.activeTab)
  const setActiveTab = useGrowthScenariosUiStore((state) => state.setActiveTab)
  const includeDepreciation = useGrowthScenariosUiStore((state) => state.includeDepreciation)
  const setIncludeDepreciation = useGrowthScenariosUiStore(
    (state) => state.setIncludeDepreciation
  )
  const annualDepreciationInput = useGrowthScenariosUiStore(
    (state) => state.annualDepreciationInput
  )
  const setAnnualDepreciationInput = useGrowthScenariosUiStore(
    (state) => state.setAnnualDepreciationInput
  )
  const isAdvancedAnalysisOpen = useGrowthScenariosUiStore(
    (state) => state.isAdvancedAnalysisOpen
  )
  const setIsAdvancedAnalysisOpen = useGrowthScenariosUiStore(
    (state) => state.setIsAdvancedAnalysisOpen
  )
  const isAdvancedAssumptionsOpen = useGrowthScenariosUiStore(
    (state) => state.isAdvancedAssumptionsOpen
  )
  const setIsAdvancedAssumptionsOpen = useGrowthScenariosUiStore(
    (state) => state.setIsAdvancedAssumptionsOpen
  )
  const ownershipOverride = useGrowthScenariosUiStore((state) => state.ownershipOverride)
  const setOwnershipOverride = useGrowthScenariosUiStore(
    (state) => state.setOwnershipOverride
  )
  const depositStrategy = useGrowthScenariosUiStore((state) => state.depositStrategy)
  const setDepositStrategy = useGrowthScenariosUiStore((state) => state.setDepositStrategy)
  const selectedInterestRate = useGrowthScenariosUiStore(
    (state) => state.selectedInterestRate
  )
  const setSelectedInterestRate = useGrowthScenariosUiStore(
    (state) => state.setSelectedInterestRate
  )
  const interestRateInput = useGrowthScenariosUiStore((state) => state.interestRateInput)
  const setInterestRateInput = useGrowthScenariosUiStore(
    (state) => state.setInterestRateInput
  )
  const microLabelClass =
    'text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]'
  const hasUsableScenarioInputs =
    properties.length > 0 ||
    loans.length > 0 ||
    transactions.length > 0 ||
    Boolean(financialProfile) ||
    liabilities.length > 0
  const annualDepreciation = Math.max(
    0,
    Math.min(MAX_ANNUAL_DEPRECIATION, Number(annualDepreciationInput || 0))
  )
  const selectedDepositStrategy =
    DEPOSIT_STRATEGY_OPTIONS.find((option) => option.value === depositStrategy) ||
    DEPOSIT_STRATEGY_OPTIONS[0]
  const depositSliderIndex = Math.max(
    0,
    DEPOSIT_STRATEGY_OPTIONS.findIndex((option) => option.value === selectedDepositStrategy.value)
  )
  const derivedDepositStrategyLabel =
    selectedDepositStrategy.depositRatio <= 0.1
      ? 'High leverage (LMI likely)'
      : selectedDepositStrategy.depositRatio < 0.2
        ? 'Standard lending'
        : 'Low leverage'
  const borrowingAnalysis = useMemo(
    () =>
      calculateBorrowingPower({
        financialProfile,
        liabilities,
        loans,
        transactions,
      }),
    [financialProfile, liabilities, loans, transactions]
  )
  const usableEquity = useMemo(() => {
    const totalValue = properties.reduce((sum, property) => sum + Number(property?.current_value || 0), 0)
    const totalDebt = loans.reduce((sum, loan) => sum + Number(loan?.current_balance || 0), 0)
    return Math.max(Math.round(totalValue * 0.8 - totalDebt), 0)
  }, [properties, loans])
  const defaultInterestRate = useMemo(() => {
    const validRates = loans
      .map((loan) => Number(loan?.interest_rate))
      .filter((rate) => Number.isFinite(rate) && rate > 0)

    if (!validRates.length) return DEFAULT_DEBT_RATE_PCT
    return validRates.reduce((sum, rate) => sum + rate, 0) / validRates.length
  }, [loans])
  const effectiveInterestRate = normalizeInterestRateInput(
    selectedInterestRate,
    defaultInterestRate
  )
  const portfolioCashFlow = useMemo(
    () =>
      transactions
        .filter((transaction) => transaction?.property_id)
        .reduce((sum, transaction) => {
          const multiplier =
            transaction?.type === 'income' ? 1 : transaction?.type === 'expense' ? -1 : 0
          const normalizedFrequency = String(transaction?.frequency || '').trim().toLowerCase()
          const amount = Number(transaction?.amount || 0)

          if (!Number.isFinite(amount)) return sum

          switch (normalizedFrequency) {
            case 'weekly':
              return sum + multiplier * ((amount * 52) / 12)
            case 'fortnightly':
              return sum + multiplier * ((amount * 26) / 12)
            case 'monthly':
              return sum + multiplier * amount
            case 'quarterly':
              return sum + multiplier * (amount / 3)
            case 'annual':
            case 'yearly':
              return sum + multiplier * (amount / 12)
            default:
              return sum + multiplier * amount
          }
        }, 0),
    [transactions]
  )
  const baselineScenarioModel = useMemo(
    () =>
      buildPortfolioGrowthScenarios({
        properties,
        loans,
        transactions,
        borrowingAnalysis,
        usableEquity,
        availableCash: 0,
        config: {
          depositRatio: selectedDepositStrategy.depositRatio,
          interestRatePct: effectiveInterestRate,
        },
        portfolioCashFlow,
      }),
    [
      properties,
      loans,
      transactions,
      borrowingAnalysis,
      usableEquity,
      selectedDepositStrategy.depositRatio,
      effectiveInterestRate,
      portfolioCashFlow,
    ]
  )
  const scenarioModel = baselineScenarioModel
  const normalizedScenarios = useMemo(
    () => (scenarioModel.scenarios || []).map(normalizeScenario),
    [scenarioModel.scenarios]
  )
  const recommendedScenario = useMemo(
    () =>
      normalizedScenarios.find(
        (scenario) => scenario.id === scenarioModel.recommendedStrategy?.id
      ) || null,
    [normalizedScenarios, scenarioModel.recommendedStrategy?.id]
  )
  const secondaryScenarios = useMemo(
    () =>
      normalizedScenarios.filter(
        (scenario) =>
          scenario.id !== scenarioModel.recommendedStrategy?.id &&
          scenario.scenarioState !== 'blocked'
      ),
    [normalizedScenarios, scenarioModel.recommendedStrategy?.id]
  )
  const blockedScenarios = useMemo(
    () => normalizedScenarios.filter((scenario) => scenario.scenarioState === 'blocked'),
    [normalizedScenarios]
  )
  const hasExecutableScenario = Boolean(recommendedScenario?.isExecutable)
  const topAlternativeScenario = blockedScenarios[0] || secondaryScenarios[0] || null
  const recommendedScenarioAnchorPrice = getSafeNumber(recommendedScenario?.scenarioPurchasePrice)
  const recommendedScenarioLoanAmount = getSafeNumber(recommendedScenario?.scenarioLoanAmount)
  const recommendedScenarioDepositPct = getSafeNumber(recommendedScenario?.scenarioDepositPct)
  const baselineCapitalGap = Number(scenarioModel.recommendedStrategy?.requiredCapitalGap || 0)
  const recommendedTotalRequiredCapital =
    Number(recommendedScenario?.depositRequired || 0) +
    Number(recommendedScenario?.estimatedAcquisitionCosts || 0)
  const recommendedAvailableCapital = Number(scenarioModel.inputs?.usableEquityAfterBuffer || 0)
  const remainingCapitalGap = Math.max(
    0,
    recommendedTotalRequiredCapital - recommendedAvailableCapital
  )
  const recommendedWealthBreakdown = useMemo(
    () => {
      const totalEquityAvailable = parseCurrencyAmount(
        recommendedScenario?.capitalBreakdown?.usableEquityBeforeBuffer ??
          scenarioModel.inputs?.usableEquity ??
          0
      )
      const usableEquity = parseCurrencyAmount(
        recommendedScenario?.capitalBreakdown?.usableEquityAfterBuffer ??
          recommendedAvailableCapital
      )
      const bufferRetainedAmount = Math.max(totalEquityAvailable - usableEquity, 0)
      const bufferRetainedPct =
        totalEquityAvailable > 0 ? (bufferRetainedAmount / totalEquityAvailable) * 100 : 0

      return {
        availableCapital:
          recommendedScenario?.capitalBreakdown?.usableEquityAfterBuffer ??
          formatCurrency(recommendedAvailableCapital),
        totalEquityAvailable: formatCurrency(totalEquityAvailable),
        bufferRetained: formatCurrency(bufferRetainedAmount),
        bufferRetainedPct: `${bufferRetainedPct.toFixed(1)}%`,
        usableEquity: formatCurrency(usableEquity),
        depositRequired:
          recommendedScenario?.purchaseStructure?.depositAmount ??
          formatCurrency(recommendedScenario?.depositRequired || 0),
        acquisitionCosts:
          recommendedScenario?.purchaseStructure?.acquisitionCosts ??
          formatCurrency(recommendedScenario?.estimatedAcquisitionCosts || 0),
        totalRequiredCapital:
          recommendedScenario?.purchaseStructure?.totalCapitalRequired ??
          formatCurrency(recommendedTotalRequiredCapital),
        remainingCapitalGap: formatCurrency(remainingCapitalGap),
      }
    },
    [
      recommendedAvailableCapital,
      recommendedScenario,
      recommendedTotalRequiredCapital,
      remainingCapitalGap,
      scenarioModel.inputs?.usableEquity,
    ]
  )
  const profileOwnership = useMemo(
    () =>
      normalizeTaxOwnership({
        ownershipStructure: financialProfile?.ownership_structure,
        ownershipSplitUserPct: financialProfile?.ownership_split_user_pct,
        ownershipSplitPartnerPct: financialProfile?.ownership_split_partner_pct,
      }),
    [financialProfile]
  )
  const ownershipStructure =
    ownershipOverride?.ownershipStructure ?? profileOwnership.ownershipStructure
  const ownershipSplitUserInput = String(
    ownershipOverride?.ownershipSplitUserPct ??
      profileOwnership.ownershipSplitUserPct ??
      (ownershipStructure === 'joint' ? '50' : '100')
  )
  const ownershipSplitPartnerInput = String(
    ownershipOverride?.ownershipSplitPartnerPct ??
      profileOwnership.ownershipSplitPartnerPct ??
      (ownershipStructure === 'joint' ? '50' : '0')
  )
  const ownershipSplitUserPct =
    getSafeNumber(ownershipSplitUserInput) ?? (ownershipStructure === 'joint' ? 50 : 100)
  const ownershipSplitPartnerPct =
    getSafeNumber(ownershipSplitPartnerInput) ?? (ownershipStructure === 'joint' ? 50 : 0)
  const ownershipSplitInlineError =
    ownershipStructure === 'joint' &&
    Math.abs(ownershipSplitUserPct + ownershipSplitPartnerPct - 100) > 0.001
      ? 'Ownership split must total 100%'
      : null
  const taxOwnership = useMemo(() => {
    const normalizedOwnership = normalizeTaxOwnership({
      ownershipStructure,
      ownershipSplitUserPct,
      ownershipSplitPartnerPct,
    })
    const userTaxableIncome =
      Number(financialProfile?.employment_income_annual || 0) +
      Number(financialProfile?.other_income_annual || 0)
    const partnerTaxableIncome = Number(financialProfile?.partner_income_annual || 0)

    return {
      ...normalizedOwnership,
      userTaxableIncome: Number.isFinite(userTaxableIncome) ? userTaxableIncome : 0,
      partnerTaxableIncome: Number.isFinite(partnerTaxableIncome) ? partnerTaxableIncome : 0,
      hasUserIncome: userTaxableIncome > 0,
      hasPartnerIncome: partnerTaxableIncome > 0,
    }
  }, [financialProfile, ownershipStructure, ownershipSplitUserPct, ownershipSplitPartnerPct])
  const showJointOwnershipIncomeWarning =
    ownershipStructure === 'joint' && !taxOwnership.hasPartnerIncome
  const hasTaxableIncome =
    taxOwnership.hasUserIncome &&
    (taxOwnership.ownershipStructure !== 'joint' || taxOwnership.hasPartnerIncome)
  const taxIncomeBasisLabel =
    taxOwnership.ownershipStructure === 'joint' ? 'user + partner' : 'user'
  const handleOwnershipStructureChange = (nextOwnershipStructure) => {
    if (nextOwnershipStructure === 'joint') {
      setOwnershipOverride({
        ownershipStructure: 'joint',
        ownershipSplitUserPct: '50',
        ownershipSplitPartnerPct: '50',
      })
      return
    }

    setOwnershipOverride({
      ownershipStructure: 'individual',
      ownershipSplitUserPct: '100',
      ownershipSplitPartnerPct: '0',
    })
  }
  const handleOwnershipSplitUserChange = (nextValue) => {
    setOwnershipOverride((prev) => ({
      ownershipStructure,
      ownershipSplitUserPct: sanitizeDecimalInput(nextValue),
      ownershipSplitPartnerPct:
        prev?.ownershipSplitPartnerPct ?? ownershipSplitPartnerInput,
    }))
  }
  const handleOwnershipSplitPartnerChange = (nextValue) => {
    setOwnershipOverride((prev) => ({
      ownershipStructure,
      ownershipSplitUserPct:
        prev?.ownershipSplitUserPct ?? ownershipSplitUserInput,
      ownershipSplitPartnerPct: sanitizeDecimalInput(nextValue),
    }))
  }
  const handleAnnualDepreciationChange = (nextValue) => {
    setAnnualDepreciationInput(sanitizeSavingsInput(nextValue))
  }
  useEffect(() => {
    setIsScenarioRefreshing(true)
    const timeoutId = setTimeout(() => setIsScenarioRefreshing(false), 200)

    return () => clearTimeout(timeoutId)
  }, [
    annualDepreciation,
    depositStrategy,
    effectiveInterestRate,
    includeDepreciation,
    ownershipSplitPartnerInput,
    ownershipSplitUserInput,
    ownershipStructure,
  ])
  useEffect(() => {
    if (!hasUsableScenarioInputs && (portfolioLoading || financialLoading)) {
      setIsDeferredAnalysisReady(false)
      return
    }

    const frameId = requestAnimationFrame(() => {
      startTransition(() => {
        setIsDeferredAnalysisReady(true)
      })
    })

    return () => cancelAnimationFrame(frameId)
  }, [financialLoading, hasUsableScenarioInputs, portfolioLoading])
  const recommendedScenarioTaxView = useMemo(() => {
    if (!recommendedScenario) return null
    if (!hasTaxableIncome) return null

    const negativeGearing = calculateNegativeGearingTaxBenefit({
      ownershipStructure: taxOwnership.ownershipStructure,
      ownershipSplitUserPct: taxOwnership.ownershipSplitUserPct,
      ownershipSplitPartnerPct: taxOwnership.ownershipSplitPartnerPct,
      userTaxableIncome: taxOwnership.userTaxableIncome,
      partnerTaxableIncome: taxOwnership.partnerTaxableIncome,
      monthlyPreTaxPropertyCashFlow: recommendedScenario.estimatedMonthlyCashFlow,
      includeDepreciation,
      annualDepreciation,
    })
    const afterTaxHoldingCost = calculateAfterTaxHoldingCost({
      monthlyPreTaxPropertyCashFlow: recommendedScenario.estimatedMonthlyCashFlow,
      taxBenefitMonthly: negativeGearing.totalTaxBenefitMonthly,
    })

    return {
      ...negativeGearing,
      ...afterTaxHoldingCost,
      totalTaxBenefitAnnual: negativeGearing.totalTaxBenefitAnnual,
      totalTaxBenefitMonthly: negativeGearing.totalTaxBenefitMonthly,
      afterTaxMonthlyImpact: afterTaxHoldingCost.afterTaxMonthlyCashFlow,
    }
  }, [annualDepreciation, hasTaxableIncome, includeDepreciation, recommendedScenario, taxOwnership])
  const recommendedScenarioSafeTaxView = useMemo(() => {
    if (!recommendedScenarioTaxView) return null

    const totalTaxBenefitMonthly = getSafeNumber(
      recommendedScenarioTaxView.totalTaxBenefitMonthly
    )
    const userTaxBenefitAnnual = getSafeNumber(
      recommendedScenarioTaxView.userTaxBenefitAnnual
    )
    const partnerTaxBenefitAnnual = getSafeNumber(
      recommendedScenarioTaxView.partnerTaxBenefitAnnual
    )
    const userAllocatedLoss = getSafeNumber(recommendedScenarioTaxView.userAllocatedLoss)
    const partnerAllocatedLoss = getSafeNumber(
      recommendedScenarioTaxView.partnerAllocatedLoss
    )
    const afterTaxMonthlyImpact = getSafeNumber(
      recommendedScenarioTaxView.afterTaxMonthlyImpact
    )
    const depreciationAnnual = getSafeNumber(
      recommendedScenarioTaxView.depreciationAnnual
    )
    const depreciationMonthly = getSafeNumber(
      recommendedScenarioTaxView.depreciationMonthly
    )
    const depreciationTaxBenefitMonthly = getSafeNumber(
      recommendedScenarioTaxView.depreciationTaxBenefitMonthly
    )

    if (
      totalTaxBenefitMonthly === null ||
      userTaxBenefitAnnual === null ||
      partnerTaxBenefitAnnual === null ||
      userAllocatedLoss === null ||
      partnerAllocatedLoss === null ||
      afterTaxMonthlyImpact === null ||
      depreciationAnnual === null ||
      depreciationMonthly === null ||
      depreciationTaxBenefitMonthly === null
    ) {
      return null
    }

    return {
      ...recommendedScenarioTaxView,
      totalTaxBenefitMonthly,
      userTaxBenefitAnnual,
      partnerTaxBenefitAnnual,
      userAllocatedLoss,
      partnerAllocatedLoss,
      afterTaxMonthlyImpact,
      depreciationAnnual,
      depreciationMonthly,
      depreciationTaxBenefitMonthly,
    }
  }, [recommendedScenarioTaxView])
  const recommendedScenarioWithEconomicOutcome = useMemo(() => {
    if (!recommendedScenario) return null
    const fiveYearEquity = Number(recommendedScenario?.fiveYearEquityProjection || 0)
    const monthlyAfterTaxCost =
      recommendedScenarioSafeTaxView?.afterTaxMonthlyImpact ?? 0
    const totalCapitalRequired = parseCurrencyAmount(
      recommendedScenario?.purchaseStructure?.totalCapitalRequired || 0
    )

    return {
      ...recommendedScenario,
      economicOutcome5Y: calculateEconomicOutcome({
        fiveYearEquity,
        totalCapitalRequired,
        monthlyAfterTaxCost: Math.abs(monthlyAfterTaxCost),
      }),
    }
  }, [
    recommendedScenario,
    recommendedScenarioSafeTaxView?.afterTaxMonthlyImpact,
  ])
  // Source of truth for the displayed economic outcome card is the enriched recommended scenario.
  const topSuggestedScenario =
    hasExecutableScenario ? recommendedScenarioWithEconomicOutcome || recommendedScenario : null
  const suggestedPathTitle = hasExecutableScenario
    ? 'Buy 1 investment property now'
    : 'No executable acquisition scenario under current settings'
  const suggestedPathDescription = hasExecutableScenario
    ? 'Optimised from your preferred settings to the strongest currently executable purchase path.'
    : null
  const suggestedPathSupportText = hasExecutableScenario
    ? 'This path is fully funded within your current capital and borrowing constraints.'
    : null
  const suggestedPathStatus = hasExecutableScenario ? 'EXECUTABLE NOW' : 'No live acquisition path'
  const wealthOutcomeHoldingCost5Y = useMemo(
    () => Math.abs(Number(recommendedScenarioSafeTaxView?.afterTaxMonthlyImpact ?? 0)) * 12 * 5,
    [recommendedScenarioSafeTaxView?.afterTaxMonthlyImpact]
  )
  const taxTraceability = useMemo(() => {
    const splitLabel =
      ownershipStructure === 'joint'
        ? `${ownershipSplitUserInput || '0'} / ${ownershipSplitPartnerInput || '0'}`
        : '100 / 0'
    return `Inputs used: pre-tax cash flow, ${taxIncomeBasisLabel} income, ownership ${splitLabel} · Assumptions: Australian resident individual tax brackets, depreciation ${
      includeDepreciation ? `included at ${formatCurrency(annualDepreciation)}/year` : 'not included'
    }`
  }, [
    annualDepreciation,
    includeDepreciation,
    ownershipSplitPartnerInput,
    ownershipSplitUserInput,
    ownershipStructure,
    taxIncomeBasisLabel,
  ])
  const recommendedNextMoveSummary = useMemo(() => {
    if (!recommendedScenario) return null

    return {
      // Use the same canonical 5Y equity source as the scenario cards to avoid inconsistent headline values.
      fiveYearEquity: Number(recommendedScenario?.fiveYearEquityProjection ?? 0),
    }
  }, [recommendedScenario])
  const centralBorrowingCapacity = Number(borrowingAnalysis?.borrowing_power_estimate || 0)
  const recommendedPurchasePrice = Number(recommendedScenario?.scenarioPurchasePrice || 0)
  const recommendedDepositAmount = Number(recommendedScenario?.depositRequired || 0)
  const requiredLoan = Math.max(recommendedPurchasePrice - recommendedDepositAmount, 0)
  const limitingFactor =
    !hasExecutableScenario
      ? String(scenarioModel.viability?.limitingFactor || 'capital')
      : remainingCapitalGap > 0
        ? 'capital'
        : requiredLoan > centralBorrowingCapacity
          ? 'borrowing'
          : 'none'
  const isCapitalConstraint = limitingFactor === 'capital'
  const isBorrowingConstraint = limitingFactor === 'borrowing'
  const limitingFactorHeading = !hasExecutableScenario
    ? 'No executable acquisition scenario under current settings'
    : isCapitalConstraint
    ? 'Capital, not borrowing power, is the current constraint'
    : isBorrowingConstraint
      ? 'Borrowing power, not capital, is the current constraint'
      : 'No binding constraint — scenario is executable'
  const limitingFactorSummary = !hasExecutableScenario
    ? scenarioModel.viability?.message ||
      'Current capital, borrowing power, and realistic market-entry assumptions do not yet support a fundable acquisition path.'
    : isCapitalConstraint
    ? 'You appear to have enough borrowing capacity to support the next move, but execution is still limited by available upfront capital.'
    : isBorrowingConstraint
      ? 'Available capital is sufficient, but borrowing capacity does not fully support the loan required for the recommended acquisition.'
      : 'Both available capital and borrowing capacity support the recommended acquisition.'
  const limitingFactorActionLine = !hasExecutableScenario
    ? limitingFactor === 'borrowing'
      ? 'Improving serviceability or reducing purchase size is the fastest way to unlock execution.'
      : 'Closing the capital gap is the fastest way to unlock a realistic acquisition path.'
    : isCapitalConstraint
    ? 'Closing the capital gap is the fastest way to unlock the recommended path.'
    : isBorrowingConstraint
      ? 'Improving serviceability or reducing purchase size is the fastest way to unlock execution.'
      : 'Execution can proceed under the current scenario settings.'
  const assessmentRateValue = Number(
    borrowingAnalysis?.assumptions?.assessment_rate_pct ??
      borrowingAnalysis?.assumptions_detail?.assessment_rate_pct ??
      8.5
  )
  const borrowingSensitivityData = useMemo(() => {
    if (!isDeferredAnalysisReady) return []
    if (!scenarioModel.recommendedStrategy) return []

    return [-1.5, -1.0, -0.5, 0, 0.5, 1.0].map((offset) => {
      const rate = Number((assessmentRateValue + offset).toFixed(1))
      const sensitivityResult = calculateBorrowingPower({
        financialProfile,
        liabilities,
        loans,
        transactions,
        config: {
          assessmentRatePct: rate,
        },
      })

      return {
        rate,
        rateLabel: `${rate.toFixed(1)}%`,
        borrowingCapacity: Number(sensitivityResult?.borrowing_power_estimate || 0),
        confidenceScore: Number(sensitivityResult?.confidence_score ?? 100),
        currentAssessmentMarker:
          Math.abs(rate - assessmentRateValue) < 0.001
            ? Number(sensitivityResult?.borrowing_power_estimate || 0)
            : null,
      }
    })
  }, [
    assessmentRateValue,
    financialProfile,
    isDeferredAnalysisReady,
    liabilities,
    loans,
    scenarioModel.recommendedStrategy,
    transactions,
  ])
  const borrowingSensitivityInsight = useMemo(() => {
    if (borrowingSensitivityData.length < 2) return null

    const lowRateCapacity = Number(borrowingSensitivityData[0]?.borrowingCapacity || 0)
    const highRateCapacity = Number(
      borrowingSensitivityData[borrowingSensitivityData.length - 1]?.borrowingCapacity || 0
    )

    return `Capacity drops by ~${formatCurrency(
      Math.max(0, lowRateCapacity - highRateCapacity)
    )} across typical rate ranges.`
  }, [borrowingSensitivityData])
  const borrowingSensitivityConfidence = useMemo(() => {
    if (!borrowingSensitivityData.length) return null

    const score = Math.min(
      ...borrowingSensitivityData.map((point) => Number(point.confidenceScore ?? 100))
    )

    return {
      score,
      label: getConfidenceLabel(score),
    }
  }, [borrowingSensitivityData])
  const stressTestData = useMemo(() => {
    if (!isDeferredAnalysisReady) return []
    if (!scenarioModel.recommendedStrategy) return []

    return STRESS_TEST_RATES.map((rate) => {
      const stressResult = calculateBorrowingPower({
        financialProfile,
        liabilities,
        loans,
        transactions,
        config: {
          assessmentRatePct: rate,
        },
      })

      const monthlySurplus = Number(stressResult?.net_monthly_surplus || 0)
      const confidenceScore = Number(stressResult?.confidence_score ?? 100)

      return {
        rate,
        rateLabel: `${rate.toFixed(1)}%`,
        monthlySurplus,
        confidenceScore,
        currentAssessmentMarker:
          Math.abs(rate - assessmentRateValue) < 0.001 ? monthlySurplus : null,
      }
    })
  }, [
    assessmentRateValue,
    financialProfile,
    isDeferredAnalysisReady,
    liabilities,
    loans,
    scenarioModel.recommendedStrategy,
    transactions,
  ])
  const stressTestInsight = useMemo(() => {
    if (!stressTestData.length) return null

    const firstNegativePoint = stressTestData.find((point) => Number(point.monthlySurplus) < 0)
    return firstNegativePoint
      ? `Portfolio turns negative above ${firstNegativePoint.rateLabel} rates.`
      : 'Remains positive but borrowing is constrained by lender buffers.'
  }, [stressTestData])
  const stressTestConfidence = useMemo(() => {
    if (!stressTestData.length) return null

    const score = Math.min(
      ...stressTestData.map((point) => Number(point.confidenceScore ?? 100))
    )

    return {
      score,
      label: getConfidenceLabel(score),
    }
  }, [stressTestData])
  const depositPurchasePowerData = useMemo(() => {
    if (!isDeferredAnalysisReady) return []
    if (!scenarioModel.recommendedStrategy || !Number.isFinite(centralBorrowingCapacity)) return []

    const totalDeployableCapital = Number(scenarioModel.inputs?.totalDeployableCapital || 0)
    const acquisitionCostRate = Number(
      scenarioModel.assumptions?.acquisitionCostRate ??
        (Number(recommendedScenario?.estimatedAcquisitionCosts || 0) /
          Math.max(Number(recommendedScenario?.scenarioPurchasePrice || 1), 1))
    )
    const selectedDepositPct = Math.round(selectedDepositStrategy.depositRatio * 100)

    return DEPOSIT_PURCHASE_POWER_LEVELS.map((depositPct) => {
      const depositRatio = depositPct / 100
      const depositBasedPrice =
        depositRatio + acquisitionCostRate > 0
          ? totalDeployableCapital / (depositRatio + acquisitionCostRate)
          : 0
      const maxPurchasePrice = Math.max(0, Math.min(depositBasedPrice, centralBorrowingCapacity))

      return {
        depositPct,
        depositLabel: `${depositPct}%`,
        maxPurchasePrice: Math.round(maxPurchasePrice),
        currentSelectionMarker:
          depositPct === selectedDepositPct ? Math.round(maxPurchasePrice) : null,
      }
    })
  }, [
    centralBorrowingCapacity,
    isDeferredAnalysisReady,
    recommendedScenario?.estimatedAcquisitionCosts,
    recommendedScenario?.scenarioPurchasePrice,
    scenarioModel.assumptions?.acquisitionCostRate,
    scenarioModel.inputs?.totalDeployableCapital,
    scenarioModel.recommendedStrategy,
    selectedDepositStrategy.depositRatio,
  ])
  const equityCashFlowTradeOffData = useMemo(() => {
    if (!isDeferredAnalysisReady) return []
    if (!recommendedScenario?.projectionData?.length) return []

    return recommendedScenario.projectionData.map((point) => ({
      year: Number(point?.year || 0),
      label: `${Number(point?.year || 0)}`,
      propertyValue: Number(point?.propertyValue ?? 0),
      loanBalance: Number(point?.loanBalance ?? 0),
      netEquity: Number(point?.netEquity ?? point?.equity ?? 0),
    }))
  }, [isDeferredAnalysisReady, recommendedScenario])
  const hasLoanBalanceSeries = useMemo(
    () =>
      equityCashFlowTradeOffData.some(
        (point) => Number.isFinite(point?.loanBalance) && Number(point.loanBalance) > 0
      ),
    [equityCashFlowTradeOffData]
  )
  const equityCashFlowTradeOffChart = equityCashFlowTradeOffData.length > 0 ? (
    <AnalysisChartCard
      title="How value, debt, and equity evolve over time"
      subtitle="Property value trends upward, debt amortises lower, and net equity compounds as the spread between them widens."
      xLabel="Years"
      yLabel="Portfolio value ($)"
      tooltipContextLabel="Projection year"
      tooltipContextFormatter={(datum) => `Year ${Number(datum?.year || 0)}`}
      yAxisInlineLabel
      data={equityCashFlowTradeOffData}
      series={[
        {
          dataKey: 'netEquity',
          label: 'Net equity',
          color: '#2F7F6F',
          accentColor: '#1F6B5D',
          fill: true,
          strokeWidth: 4,
        },
        {
          dataKey: 'propertyValue',
          label: 'Property value',
          color: '#9FB3C8',
          strokeWidth: 3.2,
          strokeDasharray: '8 8',
        },
        ...(hasLoanBalanceSeries
          ? [
              {
                dataKey: 'loanBalance',
                label: 'Loan balance',
                color: '#B45309',
                strokeWidth: 3,
                strokeDasharray: '4 6',
              },
            ]
          : []),
      ]}
    />
  ) : null
  const borrowingSensitivityChart = (
    <GraphPanel
      preface="Use this to judge how quickly executable purchase power compresses as lender assessment settings move higher."
      insight={borrowingSensitivityInsight}
      confidenceLabel={borrowingSensitivityConfidence?.label}
      traceability="Inputs used: recorded income, liabilities, mortgages, and lender assessment rate · Assumptions: buffered serviceability at 8.5%"
      note="Borrowing capacity estimates may differ from lender assessments."
    >
      <AnalysisChartCard
        title="Borrowing capacity across rate settings"
        subtitle="Helps test how much acquisition headroom remains before the recommended path becomes materially constrained."
        xLabel="Interest rate (%)"
        yLabel="Borrowing capacity ($)"
        tooltipContextLabel="Interest rate"
        tooltipContextFormatter={(datum) => datum?.rateLabel || ''}
        yAxisInlineLabel
        lineColor="#0F172A"
        accentColor="#C2410C"
        points={borrowingSensitivityData.map((point) => ({
          label: point.rateLabel,
          value: point.borrowingCapacity,
          highlight: point.currentAssessmentMarker !== null,
          confidenceScore: point.confidenceScore,
        }))}
        tooltipSupportingRows={(datum) =>
          Number.isFinite(Number(datum?.confidenceScore))
            ? [
                {
                  label: 'Confidence score',
                  value: `${Math.round(Number(datum.confidenceScore))}%`,
                },
              ]
            : []
        }
      />
    </GraphPanel>
  )
  const stressTestChart = (
    <GraphPanel
      preface="Use this panel to see when higher assessment rates begin to erode monthly resilience."
      insight={stressTestInsight}
      confidenceLabel={stressTestConfidence?.label}
      traceability="Inputs used: recorded income, liabilities, mortgages, and serviceability surplus · Assumptions: lender assessment rates from 5.5% to 8.5%"
    >
      <AnalysisChartCard
        title="Serviceability surplus under stress"
        subtitle="Shows where monthly surplus tightens and when the funding profile starts to become fragile."
        xLabel="Interest rate (%)"
        yLabel="Monthly surplus ($)"
        tooltipContextLabel="Assessment rate"
        tooltipContextFormatter={(datum) => datum?.rateLabel || ''}
        yAxisInlineLabel
        lineColor="#0F172A"
        accentColor="#C2410C"
        points={stressTestData.map((point) => ({
          label: point.rateLabel,
          value: point.monthlySurplus,
          highlight: point.currentAssessmentMarker !== null,
          confidenceScore: point.confidenceScore,
        }))}
        tooltipSupportingRows={(datum) =>
          Number.isFinite(Number(datum?.confidenceScore))
            ? [
                {
                  label: 'Confidence score',
                  value: `${Math.round(Number(datum.confidenceScore))}%`,
                },
              ]
            : []
        }
      />
    </GraphPanel>
  )
  const depositPurchasePowerChart = (
    <GraphPanel
      preface="Use this view to test whether changing deposit structure genuinely expands your executable price range."
      insight="Higher deposit settings lift achievable purchase power, but the curve flattens once borrowing becomes the binding constraint."
      traceability="Inputs used: deployable capital and central borrowing capacity · Assumptions: 20% selected deposit strategy and 5.0% acquisition costs"
    >
      <AnalysisChartCard
        title="Deposit setting vs purchase power"
        subtitle="Shows whether lower upfront capital materially improves range or simply pushes the constraint back to borrowing."
        xLabel="Deposit (%)"
        yLabel="Purchase power ($)"
        tooltipContextLabel="Deposit strategy"
        tooltipContextFormatter={(datum) => datum?.depositLabel || ''}
        yAxisInlineLabel
        lineColor="#0F172A"
        accentColor="#2563EB"
        fill
        points={depositPurchasePowerData.map((point) => ({
          label: point.depositLabel,
          value: point.maxPurchasePrice,
          highlight: point.currentSelectionMarker !== null,
        }))}
        tooltipSupportingRows={(datum) =>
          datum?.currentSelectionMarker !== null
            ? [
                {
                  label: 'Selected scenario',
                  value: 'Current deposit setting',
                },
              ]
            : []
        }
      />
    </GraphPanel>
  )

  return (
    <div className="min-h-screen bg-stone-50">
      <main className="mx-auto max-w-[1680px] px-3 py-6 md:px-4 md:py-10">
        <section className="rounded-[30px] border border-slate-200/80 bg-white px-7 py-6 shadow-[0_6px_20px_rgba(15,23,42,0.03)] md:px-9 md:py-7">
          <div className="max-w-[900px]">
            <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
              Growth Scenarios
            </p>

            <h1 className="mt-3 text-[28px] font-medium tracking-[-0.3px] text-[var(--color-text-primary)]">
              Portfolio Growth Scenarios
            </h1>

            <p className="mt-4 max-w-[760px] text-[13px] font-normal leading-[1.6] text-[var(--color-text-secondary)]">
              Compare the next acquisition paths available from your current position and see which one creates the strongest 5-year outcome.
            </p>
          </div>
        </section>

        <section className="sticky top-3 z-30 mt-5">
          <div className="rounded-[1.9rem] border border-slate-200/80 bg-white/95 px-5 py-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.12)] backdrop-blur md:px-6 md:py-5">
            <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[1.25fr_1.2fr_0.95fr]">
              <div className="min-w-0 h-full rounded-[1.4rem] border border-slate-200/70 bg-slate-50/70 px-4 py-4">
                <div className="flex h-full flex-col justify-between">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className={microLabelClass}>Deposit %</p>
                      <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                        {Math.round(selectedDepositStrategy.depositRatio * 100)}%
                      </p>
                    </div>
                    <p className="text-sm text-slate-500">Live capital structure</p>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(DEPOSIT_STRATEGY_OPTIONS.length - 1, 0)}
                    step="1"
                    value={depositSliderIndex}
                    onChange={(event) => {
                      const nextIndex = Number(event.target.value || 0)
                      const nextOption = DEPOSIT_STRATEGY_OPTIONS[nextIndex] || DEPOSIT_STRATEGY_OPTIONS[0]
                      setDepositStrategy(nextOption.value)
                    }}
                    className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-700"
                  />
                </div>
              </div>

              <div className="min-w-0 h-full rounded-[1.4rem] border border-slate-200/70 bg-slate-50/70 px-4 py-4">
                <div className="flex h-full flex-col justify-between">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className={microLabelClass}>Interest Rate</p>
                      <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                        {effectiveInterestRate.toFixed(1)}%
                      </p>
                    </div>
                    <label className="min-w-[96px]">
                      <span className="sr-only">Interest rate assumption</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={
                          interestRateInput === '' && selectedInterestRate === null
                            ? defaultInterestRate.toFixed(1)
                            : interestRateInput
                        }
                        onChange={(event) => {
                          const nextValue = sanitizeDecimalInput(event.target.value)
                          setInterestRateInput(nextValue)

                          if (nextValue === '' || nextValue === '0.' || nextValue.endsWith('.')) return

                          const parsedValue = Number(nextValue)
                          if (!Number.isFinite(parsedValue)) return

                          setSelectedInterestRate(
                            normalizeInterestRateInput(parsedValue, defaultInterestRate)
                          )
                        }}
                        onBlur={() => {
                          const parsedValue = Number(interestRateInput)
                          const fallbackRate = normalizeInterestRateInput(
                            selectedInterestRate,
                            defaultInterestRate
                          )

                          if (interestRateInput === '' || !Number.isFinite(parsedValue)) {
                            setSelectedInterestRate(fallbackRate)
                            setInterestRateInput(fallbackRate.toFixed(1))
                            return
                          }

                          const normalizedValue = normalizeInterestRateInput(
                            parsedValue,
                            defaultInterestRate
                          )
                          setSelectedInterestRate(normalizedValue)
                          setInterestRateInput(normalizedValue.toFixed(1))
                        }}
                        className="w-full rounded-[0.95rem] border border-slate-200 bg-white px-3 py-2 text-right text-[0.98rem] font-medium text-slate-950 outline-none transition-colors focus:border-emerald-300"
                      />
                    </label>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {INTEREST_RATE_QUICK_PICKS.map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => {
                          setSelectedInterestRate(rate)
                          setInterestRateInput(rate.toFixed(1))
                        }}
                        className={`inline-flex min-h-[36px] items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                          Math.abs(effectiveInterestRate - rate) < 0.001
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200/75 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {rate.toFixed(1)}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="min-w-0 h-full rounded-[1.4rem] border border-slate-200/70 bg-slate-50/70 px-4 py-4">
                <div className="flex h-full flex-col justify-between">
                  <div>
                    <p className={microLabelClass}>Ownership</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleOwnershipStructureChange('individual')}
                        className={`rounded-[0.95rem] border px-3 py-2 text-sm font-medium transition-colors ${
                          ownershipStructure !== 'joint'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Individual
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOwnershipStructureChange('joint')}
                        className={`rounded-[0.95rem] border px-3 py-2 text-sm font-medium transition-colors ${
                          ownershipStructure === 'joint'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Joint
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">
                    {ownershipStructure === 'joint' ? 'Split ownership enabled' : 'User-only ownership'}
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Adjust assumptions to stress your acquisition strategy
            </p>
          </div>
        </section>

        <section className="mt-4 rounded-[2rem] border border-slate-200/75 bg-white px-6 py-6 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.12)] md:px-8 md:py-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className={microLabelClass}>Advanced model settings</p>
              <h3 className="mt-2 text-[1.4rem] font-semibold tracking-tight text-slate-950">
                Fine-tune the scenario model
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsAdvancedAssumptionsOpen((current) => !current)}
              className="inline-flex items-center gap-3 rounded-full border border-slate-200/80 bg-slate-50 px-5 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              <span>{isAdvancedAssumptionsOpen ? 'Hide advanced settings' : 'Show advanced settings'}</span>
              <span
                className={`text-base leading-none transition-transform ${
                  isAdvancedAssumptionsOpen ? 'rotate-90' : ''
                }`}
              >
                ›
              </span>
            </button>
          </div>

          {isAdvancedAssumptionsOpen ? (
            <div className="mt-6 rounded-[1.9rem] border border-slate-200/80 bg-slate-50/60 px-6 py-6 md:px-7 md:py-7">
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.85fr_1.15fr]">
                <article className="rounded-[1.7rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.18)] md:px-6 md:py-6">
                  <p className={microLabelClass}>Deposit posture</p>
                  <p className="mt-4 text-[1.05rem] font-semibold text-slate-950">
                    {derivedDepositStrategyLabel}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    Driven directly by the deposit slider above so capital structure stays controlled in one place.
                  </p>
                </article>

                <article className="rounded-[1.7rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.18)] md:px-6 md:py-6">
                  <p className={microLabelClass}>Tax settings</p>
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-slate-600">Income basis</span>
                      <span className="text-right text-sm font-semibold text-slate-950">
                        {taxIncomeBasisLabel}
                      </span>
                    </div>

                    {ownershipStructure === 'joint' ? (
                      <div className="space-y-3 rounded-[1.15rem] border border-slate-200/75 bg-slate-50/70 px-4 py-4">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm text-slate-600">Ownership split</span>
                          <span className="text-sm font-semibold text-slate-950">
                            {`${ownershipSplitUserInput || '0'} / ${ownershipSplitPartnerInput || '0'}`}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm text-slate-500">User %</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={ownershipSplitUserInput}
                              onChange={(event) => handleOwnershipSplitUserChange(event.target.value)}
                              className="w-full rounded-xl border border-slate-200/75 bg-white px-4 py-3 text-[1rem] font-medium text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-sm text-slate-500">Partner %</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={ownershipSplitPartnerInput}
                              onChange={(event) => handleOwnershipSplitPartnerChange(event.target.value)}
                              className="w-full rounded-xl border border-slate-200/75 bg-white px-4 py-3 text-[1rem] font-medium text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                            />
                          </div>
                        </div>
                        {ownershipSplitInlineError ? (
                          <p className="text-sm text-red-600">{ownershipSplitInlineError}</p>
                        ) : null}
                        {showJointOwnershipIncomeWarning ? (
                          <p className="text-sm text-amber-700">
                            Add partner income to estimate joint ownership tax benefit accurately.
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <DepreciationControls
                      includeDepreciation={includeDepreciation}
                      annualDepreciationInput={annualDepreciationInput}
                      annualDepreciation={annualDepreciation}
                      onIncludeDepreciationChange={setIncludeDepreciation}
                      onAnnualDepreciationChange={handleAnnualDepreciationChange}
                    />
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-600">
                    Secondary tax assumptions stay here so the live decision controls above remain clean.
                  </p>
                </article>
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-8 rounded-[30px] border border-slate-200/70 bg-white/50 px-6 py-5 md:px-8 md:py-6">
          <div className="mb-5 md:mb-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">
              Scenario comparison
            </p>
            <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-slate-900 md:text-[24px]">
              Compare your next acquisition paths
            </h2>
            <p className="mt-2.5 max-w-[68ch] text-[14px] leading-6 text-slate-600 md:text-[15px]">
              Review the recommended and alternative paths side by side, including projected
              equity, acquisition size, yield, and execution constraints.
            </p>
          </div>

          <div
            className={`mt-0 grid grid-cols-1 items-stretch gap-6 transition-opacity duration-200 xl:grid-cols-2 xl:gap-6 ${
              isScenarioRefreshing ? 'opacity-60' : 'opacity-100'
            }`}
          >
            <article className="flex h-full min-h-[520px] flex-col rounded-[24px] border border-slate-200/70 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-emerald-100">
              <div className="flex h-full min-h-[520px] w-full flex-col bg-white p-6 md:p-7">
                <div>
                  <div className="flex items-center justify-between gap-6">
                    <div
                      className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ring-1 ${
                        hasExecutableScenario
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                          : 'bg-amber-50 text-amber-700 ring-amber-200'
                      }`}
                    >
                      {hasExecutableScenario ? 'EXECUTABLE NOW' : 'Not executable'}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5 pl-4 text-right">
                      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
                        {hasExecutableScenario ? 'Recommended Path' : 'Current State'}
                      </p>
                      <p className="text-[14px] font-semibold tracking-[-0.01em] text-slate-800">
                        {suggestedPathStatus}
                      </p>
                    </div>
                  </div>

                    <div className="mt-8">
                    <div className="min-h-[56px] flex items-start">
                      <h2 className="overflow-hidden text-ellipsis text-[20px] font-semibold tracking-tight text-slate-900 md:whitespace-nowrap md:text-[22px]">
                        {suggestedPathTitle}
                      </h2>
                    </div>
                    <div className="min-h-[56px]">
                      {suggestedPathDescription ? (
                        <p className="mt-4 text-[14px] leading-relaxed text-slate-600">
                          {suggestedPathDescription}
                        </p>
                      ) : null}
                      {suggestedPathSupportText ? (
                        <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
                          {suggestedPathSupportText}
                        </p>
                      ) : hasExecutableScenario ? null : (
                        <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
                          {scenarioModel.viability?.message ||
                            'Current borrowing capacity, deployable capital, and realistic market-entry assumptions do not yet support a fundable acquisition path.'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="grid grid-cols-2 gap-4">
                    <ScenarioMetric
                      label={hasExecutableScenario ? '5Y Equity' : 'Borrowing Power'}
                      value={
                        hasExecutableScenario
                          ? formatCurrency(topSuggestedScenario?.fiveYearEquityProjection || 0)
                          : formatCurrency(centralBorrowingCapacity || 0)
                      }
                    />
                    <ScenarioMetric
                      label={hasExecutableScenario ? 'Purchase Price' : 'Deployable Capital'}
                      value={
                        hasExecutableScenario
                          ? formatCurrency(topSuggestedScenario?.scenarioPurchasePrice || 0)
                          : formatCurrency(Number(scenarioModel.inputs?.totalDeployableCapital || 0))
                      }
                    />
                    <ScenarioMetric
                      label={hasExecutableScenario ? 'Monthly Cost' : 'Market Entry Floor'}
                      valueClassName="text-[20px] md:text-[22px]"
                      value={
                        hasExecutableScenario
                          ? `${Number(topSuggestedScenario?.estimatedMonthlyCashFlow || 0) >= 0 ? '+' : '-'}${formatCurrency(
                              Math.abs(Number(topSuggestedScenario?.estimatedMonthlyCashFlow || 0))
                            )}`
                          : formatCurrency(Number(scenarioModel.viability?.realisticMarketEntryMin || 0))
                      }
                    />
                    <ScenarioMetric
                      label={hasExecutableScenario ? 'Gross Yield' : 'Unlock Focus'}
                      value={
                        hasExecutableScenario
                          ? `${Number(topSuggestedScenario?.estimatedGrossYield || 0).toFixed(1)}%`
                          : limitingFactor === 'borrowing'
                            ? 'Borrowing uplift'
                            : 'Capital build-up'
                      }
                    />
                  </div>
                </div>

                <div className="mt-auto pt-5">
                  <div
                    className={`flex min-h-[60px] items-center rounded-[16px] px-5 py-4 ${
                      hasExecutableScenario && Number(topSuggestedScenario?.requiredCapitalGap || 0) > 0
                        ? 'bg-amber-50/45 text-amber-700 ring-1 ring-amber-100'
                        : hasExecutableScenario
                          ? 'bg-emerald-50/50 text-emerald-800 ring-1 ring-emerald-100'
                          : 'bg-amber-50/45 text-amber-700 ring-1 ring-amber-100'
                    }`}
                  >
                    <p className="text-[15px] font-medium leading-7">
                      {hasExecutableScenario
                        ? Number(topSuggestedScenario?.requiredCapitalGap || 0) > 0
                          ? `Capital shortfall: ${formatCurrency(topSuggestedScenario?.requiredCapitalGap || 0)}`
                          : 'Fully funded for execution'
                        : 'Blocked paths remain visible below only as non-executable reference scenarios.'}
                    </p>
                  </div>
                </div>
              </div>
            </article>

            <article className="flex h-full min-h-[520px] flex-col rounded-[24px] border border-slate-200/70 bg-white/95 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
              <div className="flex h-full min-h-[520px] w-full flex-col bg-white p-6 md:p-7">
                <div>
                  <div className="flex items-center justify-between gap-6">
                    <div className="inline-flex rounded-full bg-rose-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700 ring-1 ring-rose-200">
                      {String(topAlternativeScenario?.scenarioStateLabel || '').toLowerCase() === 'blocked'
                        ? 'Blocked'
                        : 'Alternative'}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5 pl-4 text-right">
                      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
                        Alternative Path
                      </p>
                      <p className="text-[14px] font-semibold tracking-[-0.01em] text-slate-800">
                        {topAlternativeScenario?.blockedReason ? 'Not executable' : 'Inferior outcome'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-7">
                    <div className="min-h-[56px] flex items-start">
                      <h2 className="overflow-hidden text-ellipsis text-[20px] font-semibold tracking-tight text-slate-900 md:whitespace-nowrap md:text-[22px]">
                        {topAlternativeScenario?.title}
                      </h2>
                    </div>
                    <div className="min-h-[48px]">
                      <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
                        {topAlternativeScenario?.blockedExplanation ||
                          topAlternativeScenario?.stateSummary ||
                          topAlternativeScenario?.rationale ||
                          topAlternativeScenario?.feasibilityMessage}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <ScenarioMetric
                      label="5Y Equity"
                      value={formatCurrency(topAlternativeScenario?.fiveYearEquityProjection || 0)}
                    />
                    <ScenarioMetric
                      label="Purchase Price"
                      value={formatCurrency(topAlternativeScenario?.scenarioPurchasePrice || 0)}
                    />
                    <ScenarioMetric
                      label="Monthly Cost"
                      valueClassName="text-[20px] md:text-[22px]"
                      value={`${Number(topAlternativeScenario?.estimatedMonthlyCashFlow || 0) >= 0 ? '+' : '-'}${formatCurrency(
                        Math.abs(Number(topAlternativeScenario?.estimatedMonthlyCashFlow || 0))
                      )}`}
                    />
                    <ScenarioMetric
                      label="Gross Yield"
                      value={`${Number(topAlternativeScenario?.estimatedGrossYield || 0).toFixed(1)}%`}
                    />
                  </div>
                </div>

                <div className="mt-auto pt-5">
                  <div className="flex min-h-[60px] items-center rounded-[16px] bg-rose-50/55 px-5 py-4 ring-1 ring-rose-100">
                    <p className="text-[15px] font-medium leading-7 text-rose-700">
                      {String(topAlternativeScenario?.blockedReason || '').toLowerCase().includes('floor')
                        ? 'Blocked: below realistic market floor'
                        : Number(topAlternativeScenario?.requiredCapitalGap || 0) > 0
                          ? 'Blocked: insufficient capital'
                          : String(topAlternativeScenario?.blockedReason || '').toLowerCase().includes('service')
                            ? 'Blocked: serviceability constraint'
                            : topAlternativeScenario?.blockedReason ||
                              topAlternativeScenario?.feasibilityMessage ||
                              topAlternativeScenario?.stateSummary ||
                              topAlternativeScenario?.rationale}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>
        {hasExecutableScenario ? (
          <>
        <section className="mt-10 md:mt-12">
          <article
            className={`rounded-[2.15rem] border px-6 pt-6 pb-6 shadow-[0_28px_80px_-50px_rgba(15,23,42,0.2)] md:px-8 ${
              isCapitalConstraint || isBorrowingConstraint
                ? 'border-amber-300/85 bg-gradient-to-r from-amber-50/95 via-amber-50/70 to-rose-50/55'
                : 'border-slate-200/80 bg-white'
            }`}
          >
            <p className={microLabelClass}>Limiting Factor</p>
            <h3 className="mt-4 text-[22px] font-semibold tracking-tight text-slate-900 md:text-[24px]">
              {limitingFactorHeading}
            </h3>
            <p className="mt-3 max-w-[56rem] text-[1.03rem] leading-8 text-slate-700">
              {limitingFactorSummary}
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-[1.4rem] border border-white/80 bg-white/85 px-4 py-4 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.16)]">
                <p className={microLabelClass}>Borrowing Power</p>
                <p className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-950">
                  {Number.isFinite(centralBorrowingCapacity)
                    ? formatCurrency(centralBorrowingCapacity)
                    : 'Unavailable'}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Current borrowing power available under the live lending assumptions.
                </p>
              </div>

              <div className="rounded-[1.4rem] border border-white/80 bg-white/85 px-4 py-4 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.16)]">
                <p className={microLabelClass}>Capital Required</p>
                <p className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-950">
                  {formatCurrency(recommendedTotalRequiredCapital)}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Upfront capital needed to execute the recommended scenario.
                </p>
              </div>

              <div className="rounded-[1.4rem] border border-white/80 bg-white/85 px-4 py-4 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.16)]">
                <p className={microLabelClass}>Capital Shortfall</p>
                <p
                  className={`mt-2 text-[1.35rem] font-semibold tracking-tight ${
                    remainingCapitalGap > 0 ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  {remainingCapitalGap > 0 ? formatCurrency(remainingCapitalGap) : 'No shortfall'}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  The residual gap that still blocks clean execution today.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-white/75 bg-white/85 px-5 py-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)]">
              <p className="text-sm font-medium leading-7 text-slate-700">
                {limitingFactorActionLine}
              </p>
            </div>
          </article>
        </section>

        <section className="mt-10 rounded-[2.1rem] border border-slate-200/80 bg-white px-6 pt-6 pb-6 shadow-[0_28px_80px_-58px_rgba(15,23,42,0.24)] md:mt-12 md:px-8">
          <p className={microLabelClass}>Executive Summary</p>
          <h2 className="mt-4 max-w-[18ch] text-[22px] font-semibold tracking-tight text-slate-900 md:text-[24px]">
            {recommendedNextMoveSummary
              ? `Estimated net equity outcome over 5 years: ${formatCurrency(
                  recommendedNextMoveSummary.fiveYearEquity
                )}`
              : 'Scenario overview'}
          </h2>
          <p className="mt-4 max-w-[52rem] text-[1.03rem] leading-8 text-slate-600">
            {recommendedScenario?.stateSummary ||
              recommendedScenario?.rationale ||
              recommendedScenario?.feasibilityMessage}
          </p>

          <div className="mt-7 grid grid-cols-2 overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-slate-50/70 sm:grid-cols-4">
            <div className="border-b border-slate-200/80 px-5 py-5 sm:border-b-0 sm:border-r">
              <p className={microLabelClass}>Purchase Price</p>
              <p className="mt-2 text-[1.7rem] font-semibold tracking-tight text-slate-950">
                {recommendedScenarioAnchorPrice !== null
                  ? formatCurrency(recommendedScenarioAnchorPrice)
                  : 'Unavailable'}
              </p>
            </div>
            <div className="border-b border-slate-200/80 px-5 py-5 sm:border-b-0 sm:border-r">
              <p className={microLabelClass}>Loan Amount</p>
              <p className="mt-2 text-[1.7rem] font-semibold tracking-tight text-slate-950">
                {recommendedScenarioLoanAmount !== null
                  ? formatCurrency(recommendedScenarioLoanAmount)
                  : 'Unavailable'}
              </p>
            </div>
            <div className="border-r border-slate-200/80 px-5 py-5">
              <p className={microLabelClass}>Deposit %</p>
              <p className="mt-2 text-[1.7rem] font-semibold tracking-tight text-slate-950">
                {recommendedScenarioDepositPct !== null
                  ? `${recommendedScenarioDepositPct.toFixed(0)}%`
                  : 'Unavailable'}
              </p>
            </div>
            <div className="px-5 py-5">
              <p className={microLabelClass}>
                {remainingCapitalGap > 0 ? 'Capital Gap' : 'Funding Status'}
              </p>
              <p
                className={`mt-2 text-[1.7rem] font-semibold tracking-tight ${
                  remainingCapitalGap > 0 ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {remainingCapitalGap > 0 ? formatCurrency(remainingCapitalGap) : 'Fully funded'}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-10 md:mt-12">
          <div className="rounded-[2.2rem] border border-slate-200/80 bg-white px-6 pt-6 pb-6 shadow-[0_24px_70px_-54px_rgba(15,23,42,0.18)] md:px-8">
            <p className={microLabelClass}>Execution Readiness</p>
          <h3 className="mt-4 text-[22px] font-semibold tracking-tight text-slate-900 md:text-[24px]">
            Can this strategy be executed now?
          </h3>
          <p className="mt-4 max-w-[46rem] text-[1.03rem] leading-8 text-slate-600">
            Compare deployable capital with the true upfront requirement and isolate the binding
            execution constraint immediately.
          </p>

            <div className="mt-8 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_auto_1fr_auto_1fr] xl:items-stretch">
              <article className="rounded-[2rem] border border-emerald-200/80 bg-emerald-50/55 px-7 py-8 text-center shadow-[0_20px_50px_-42px_rgba(15,23,42,0.18)] md:px-8 md:py-9">
                <p className={microLabelClass}>Available Capital</p>
                <p className="mt-4 text-[2.55rem] font-semibold tracking-tight text-emerald-800">
                  {formatCurrency(recommendedAvailableCapital)}
                </p>
                <p className="mt-4 text-[1rem] leading-7 text-slate-600">
                  Deployable capital after liquidity buffers and reserve settings are retained.
                </p>
                <div className="mt-5 rounded-[1.25rem] border border-emerald-200/70 bg-white/75 px-4 py-4 text-left">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                    Available capital derived from equity
                  </p>
                  <div className="mt-3 space-y-2.5">
                    <BreakdownRow
                      label="Total equity available"
                      value={recommendedWealthBreakdown.totalEquityAvailable}
                    />
                    <BreakdownRow
                      label={`Buffer retained (${recommendedWealthBreakdown.bufferRetainedPct})`}
                      value={`-${recommendedWealthBreakdown.bufferRetained}`}
                    />
                    <BreakdownRow
                      label="Usable equity"
                      value={recommendedWealthBreakdown.usableEquity}
                      strong
                    />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    A portion of your equity is retained as a safety buffer. The remaining usable
                    equity can be deployed toward the next acquisition.
                  </p>
                </div>
              </article>

              <div className="hidden items-center justify-center text-3xl font-light text-slate-300 xl:flex">
                &rarr;
              </div>

              <article className="rounded-[2rem] border border-slate-200/80 bg-slate-50/65 px-7 py-8 text-center shadow-[0_20px_50px_-42px_rgba(15,23,42,0.16)] md:px-8 md:py-9">
                <p className={microLabelClass}>Required Capital</p>
                <p className="mt-4 text-[2.55rem] font-semibold tracking-tight text-slate-950">
                  {formatCurrency(recommendedTotalRequiredCapital)}
                </p>
                <p className="mt-4 text-[1rem] leading-7 text-slate-600">
                  Most of the upfront requirement comes from the deposit, with the remainder driven
                  by stamp duty and acquisition costs.
                </p>
                <div className="mt-5 rounded-[1.25rem] border border-slate-200/80 bg-white/80 px-4 py-4 text-left">
                  <div className="space-y-2.5">
                    <BreakdownRow
                      label="Deposit"
                      value={recommendedWealthBreakdown.depositRequired}
                    />
                    <BreakdownRow
                      label="Stamp duty + acquisition costs"
                      value={recommendedWealthBreakdown.acquisitionCosts}
                    />
                    <BreakdownRow
                      label="Total required"
                      value={recommendedWealthBreakdown.totalRequiredCapital}
                      strong
                    />
                  </div>
                </div>
              </article>

              <div className="hidden items-center justify-center text-3xl font-light text-slate-300 xl:flex">
                &rarr;
              </div>

              <article className={`rounded-[2rem] border px-7 py-8 text-center shadow-[0_20px_50px_-42px_rgba(15,23,42,0.18)] md:px-8 md:py-9 ${
                remainingCapitalGap > 0
                  ? 'border-amber-200/80 bg-amber-50/60'
                  : 'border-emerald-200/80 bg-emerald-50/55'
              }`}>
                <p className={microLabelClass}>{remainingCapitalGap > 0 ? 'Capital Gap' : 'Surplus'}</p>
                <p
                  className={`mt-4 text-[2.55rem] font-semibold tracking-tight ${
                    remainingCapitalGap > 0 ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  {remainingCapitalGap > 0
                    ? formatCurrency(remainingCapitalGap)
                    : formatCurrency(Math.max(recommendedAvailableCapital - recommendedTotalRequiredCapital, 0))}
                </p>
                <p className="mt-4 text-[1rem] leading-7 text-slate-600">
                  {remainingCapitalGap > 0
                    ? 'This gap must be closed before the transaction is realistically executable.'
                    : 'Current capital clears the upfront hurdle without additional funding.'}
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-[2.25rem] border border-slate-200/80 bg-white px-6 pt-6 pb-6 shadow-[0_28px_80px_-58px_rgba(15,23,42,0.2)] md:mt-12 md:px-8">
          <p className={microLabelClass}>Wealth Outcome</p>
          <h3 className="mt-4 text-[22px] font-semibold tracking-tight text-slate-900 md:text-[24px]">
            Economic outcome after capital and carry
          </h3>
          <p className="mt-4 max-w-[50rem] text-[1.03rem] leading-8 text-slate-600">
            Equity growth is only part of the result. The real decision is what remains after
            capital is committed and the asset is carried through the hold period.
          </p>

          <div className="mt-8 flex flex-col gap-4 xl:flex-row xl:items-stretch xl:gap-5">
            <article className="flex-1 rounded-[1.8rem] border border-slate-200/80 bg-slate-50/70 px-6 py-6 shadow-[0_20px_50px_-42px_rgba(15,23,42,0.14)]">
              <p className={microLabelClass}>5Y Equity</p>
              <p className="mt-3 text-[2.15rem] font-semibold tracking-tight text-slate-950">
                {formatCurrency(topSuggestedScenario?.fiveYearEquityProjection || 0)}
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Projected net equity after 5 years.
              </p>
            </article>

            <div className="flex items-center justify-center text-[2rem] font-light text-slate-300 xl:px-1">
              &minus;
            </div>

            <article className="flex-1 rounded-[1.8rem] border border-slate-200/80 bg-slate-50/70 px-6 py-6 shadow-[0_20px_50px_-42px_rgba(15,23,42,0.14)]">
              <p className={microLabelClass}>Capital Invested</p>
              <p className="mt-3 text-[2.15rem] font-semibold tracking-tight text-slate-950">
                {topSuggestedScenario?.purchaseStructure?.totalCapitalRequired ||
                  recommendedWealthBreakdown.totalRequiredCapital}
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Upfront capital committed.
              </p>
            </article>

            <div className="flex items-center justify-center text-[2rem] font-light text-slate-300 xl:px-1">
              &minus;
            </div>

            <article className="flex-1 rounded-[1.8rem] border border-slate-200/80 bg-slate-50/70 px-6 py-6 shadow-[0_20px_50px_-42px_rgba(15,23,42,0.14)]">
              <p className={microLabelClass}>5Y Holding Cost</p>
              <p className="mt-3 text-[2.15rem] font-semibold tracking-tight text-slate-950">
                {formatCurrency(wealthOutcomeHoldingCost5Y)}
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Total after-tax carry over 5 years.
              </p>
            </article>

            <div className="flex items-center justify-center text-[2rem] font-light text-slate-300 xl:px-1">
              =
            </div>

            <article
              className={`flex-1 rounded-[1.8rem] border px-6 py-6 shadow-[0_20px_50px_-42px_rgba(15,23,42,0.16)] ${
                Number(topSuggestedScenario?.economicOutcome5Y || 0) >= 0
                  ? 'border-emerald-200/80 bg-emerald-50/55'
                  : 'border-rose-200/80 bg-rose-50/55'
              }`}
            >
              <p className={microLabelClass}>Economic Outcome (5Y)</p>
              <p className="mt-3 text-[2.15rem] font-semibold tracking-tight text-slate-950">
                {formatCurrency(topSuggestedScenario?.economicOutcome5Y || 0)}
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Net wealth after capital and carry.
              </p>
            </article>
          </div>
        </section>

        <section className="mt-10 border-b border-slate-200/75 md:mt-12">
          <div className="-mb-px flex flex-wrap gap-2.5 md:gap-3.5">
            <button
              type="button"
              onClick={() => setActiveTab('wealth-growth')}
              className={`rounded-t-[1.5rem] border px-6 py-4 text-[1.03rem] font-medium transition-colors md:px-8 ${
                activeTab === 'wealth-growth'
                  ? 'border-slate-200/80 border-b-white bg-white text-slate-950'
                  : 'border-transparent bg-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Wealth growth
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('funding')}
              className={`rounded-t-[1.5rem] border px-6 py-4 text-[1.03rem] font-medium transition-colors md:px-8 ${
                activeTab === 'funding'
                  ? 'border-slate-200/80 border-b-white bg-white text-slate-950'
                  : 'border-transparent bg-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Funding
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tax-cash-flow')}
              className={`rounded-t-[1.5rem] border px-6 py-4 text-[1.03rem] font-medium transition-colors md:px-8 ${
                activeTab === 'tax-cash-flow'
                  ? 'border-slate-200/80 border-b-white bg-white text-slate-950'
                  : 'border-transparent bg-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Tax &amp; cash flow
            </button>
          </div>
        </section>

        {activeTab === 'wealth-growth' ? (
          <section className="rounded-b-[2rem] rounded-tr-[2rem] border border-t-0 border-slate-200/75 bg-white px-6 pt-6 pb-6 shadow-[0_22px_60px_-50px_rgba(15,23,42,0.16)] md:px-8">
            <div>
              <p className={microLabelClass}>Wealth Growth</p>
              <h3 className="mt-5 text-[22px] font-semibold tracking-tight text-slate-900 md:text-[24px]">
                How the balance sheet improves over time
              </h3>
              <p className="mt-6 max-w-[50rem] text-[1.04rem] leading-8 text-slate-600">
                Track asset growth, debt reduction, and the widening equity spread that drives the
                long-term wealth outcome.
              </p>
            </div>

            <div className="mt-6">{equityCashFlowTradeOffChart}</div>
          </section>
        ) : null}

        {activeTab === 'funding' ? (
          <section className="rounded-b-[2rem] rounded-tr-[2rem] border border-t-0 border-slate-200/75 bg-white px-6 pt-6 pb-6 shadow-[0_22px_60px_-50px_rgba(15,23,42,0.16)] md:px-8">
            <p className={microLabelClass}>Funding</p>
            <h3 className="mt-5 text-[22px] font-semibold tracking-tight text-slate-900 md:text-[24px]">
              Capital required to execute
            </h3>
            <p className="mt-6 max-w-[48rem] text-[1.04rem] leading-8 text-slate-600">
              Read this as an execution bridge: available capital, required capital, and the gap
              that still has to be solved.
            </p>

            <div className="mt-11 rounded-[1.9rem] border border-slate-100/90 bg-slate-50/40 px-6 py-8 md:px-8 md:py-10">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_auto_1fr_auto_1fr] xl:items-center">
              <article className="rounded-[2rem] border border-emerald-200/75 bg-emerald-50/50 px-7 py-8 text-center md:min-h-[248px] md:px-8 md:py-9">
                <p className={microLabelClass}>Available Capital</p>
                <p className="mt-4 text-4xl font-semibold tracking-tight text-emerald-800">
                  {recommendedWealthBreakdown.availableCapital}
                </p>
                <p className="mt-5 text-base leading-8 text-slate-600">
                  Equity and cash already available for deployment after buffers.
                </p>
              </article>

              <div className="hidden text-center text-3xl font-light text-slate-300 xl:block">
                &rarr;
              </div>

              <article className="rounded-[2rem] border border-slate-200/75 bg-slate-50/70 px-7 py-8 text-center md:min-h-[248px] md:px-8 md:py-9">
                <p className={microLabelClass}>Required Capital</p>
                <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
                  {recommendedWealthBreakdown.totalRequiredCapital}
                </p>
                <p className="mt-5 text-base leading-8 text-slate-600">
                  Capital needed to clear deposit, acquisition costs, and get the deal done.
                </p>
              </article>

              <div className="hidden text-center text-3xl font-light text-slate-300 xl:block">
                &rarr;
              </div>

              <article className="rounded-[2rem] border border-amber-200/75 bg-amber-50/50 px-7 py-8 text-center md:min-h-[248px] md:px-8 md:py-9">
                <p className={microLabelClass}>Shortfall</p>
                <p className="mt-4 text-4xl font-semibold tracking-tight text-amber-700">
                  {recommendedWealthBreakdown.remainingCapitalGap}
                </p>
                <p className="mt-5 text-base leading-8 text-slate-600">
                  Residual capital shortfall after currently available funding is applied.
                </p>
              </article>
              </div>
            </div>

            <ScenarioFundingBreakdown
              className="mt-8"
              breakdown={recommendedWealthBreakdown}
            />
          </section>
        ) : null}

        {activeTab === 'tax-cash-flow' ? (
          <section className="rounded-b-[2rem] rounded-tr-[2rem] border border-t-0 border-slate-200/75 bg-white px-6 pt-6 pb-6 shadow-[0_22px_60px_-50px_rgba(15,23,42,0.16)] md:px-8">
            <p className={microLabelClass}>Tax &amp; Cash Flow</p>
            <h3 className="mt-5 text-[22px] font-semibold tracking-tight text-slate-900 md:text-[24px]">
              What the strategy costs to hold each month
            </h3>
            <p className="mt-6 max-w-[50rem] text-[1.04rem] leading-8 text-slate-600">
              This is the monthly carry profile: pre-tax drag, tax offset, and the true after-tax
              holding cost.
            </p>

            <div className="mt-9 rounded-[1.9rem] border border-slate-100/90 bg-slate-50/40 px-6 py-8 md:px-8 md:py-10">
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_auto_1fr_auto_1fr] xl:items-center">
                <article className="min-w-0 w-full overflow-hidden rounded-[2rem] border border-slate-200/75 bg-slate-50/70 px-7 py-8 text-center md:min-h-[285px] md:px-8 md:py-9">
                  <p className={microLabelClass}>Pre-tax</p>
                  <p className="mt-4 whitespace-nowrap text-[28px] font-semibold leading-tight tracking-[-0.03em] text-slate-950 md:text-[30px]">
                    {`${Number(
                      (recommendedScenarioSafeTaxView?.monthlyPreTaxPropertyCashFlow ??
                        recommendedScenario?.estimatedMonthlyCashFlow) ||
                        0
                    ) >= 0 ? '+' : '-'}${formatCurrency(
                      Math.abs(
                        Number(
                          (recommendedScenarioSafeTaxView?.monthlyPreTaxPropertyCashFlow ??
                            recommendedScenario?.estimatedMonthlyCashFlow) ||
                            0
                        )
                      )
                    )}`}
                  </p>
                  <p className="mt-5 text-base leading-8 text-slate-600">
                    Monthly operating result before any tax offset is recognised.
                  </p>
                </article>

                <div className="hidden text-center text-4xl font-light text-slate-300 xl:block">
                  +
                </div>

                <article className="min-w-0 w-full overflow-hidden rounded-[2rem] border border-emerald-200/75 bg-emerald-50/50 px-7 py-8 text-center md:min-h-[285px] md:px-8 md:py-9">
                  <p className={microLabelClass}>ATO Benefit</p>
                  <p className="mt-4 whitespace-nowrap text-[28px] font-semibold leading-tight tracking-[-0.03em] text-emerald-800 md:text-[30px]">
                    {`+${formatCurrency(recommendedScenarioSafeTaxView?.totalTaxBenefitMonthly || 0)}`}
                  </p>
                  <p className="mt-5 text-base leading-8 text-slate-600">
                    {recommendedScenarioSafeTaxView
                      ? `Includes depreciation benefit of +${formatCurrency(
                          recommendedScenarioSafeTaxView.depreciationTaxBenefitMonthly || 0
                        )}/month.`
                      : 'Estimated tax offset based on the current ownership and income profile.'}
                  </p>
                </article>

                <div className="hidden text-center text-4xl font-light text-slate-300 xl:block">
                  =
                </div>

                <article className="min-w-0 w-full overflow-hidden rounded-[2rem] border border-amber-200/75 bg-amber-50/50 px-7 py-8 text-center md:min-h-[285px] md:px-8 md:py-9">
                  <p className={microLabelClass}>Net Cost</p>
                  <p className="mt-4 whitespace-nowrap text-[28px] font-semibold leading-tight tracking-[-0.03em] text-amber-700 md:text-[30px]">
                    {`${Number(
                      (recommendedScenarioSafeTaxView?.afterTaxMonthlyImpact ??
                        recommendedScenario?.estimatedMonthlyCashFlow) ||
                        0
                    ) >= 0 ? '+' : '-'}${formatCurrency(
                      Math.abs(
                        Number(
                          (recommendedScenarioSafeTaxView?.afterTaxMonthlyImpact ??
                            recommendedScenario?.estimatedMonthlyCashFlow) ||
                            0
                        )
                      )
                    )}`}
                  </p>
                  <p className="mt-5 text-base leading-8 text-slate-600">
                    Monthly carry cost after tax offsets are applied.
                  </p>
                </article>
              </div>

              <p className="mt-8 text-[1.03rem] leading-8 text-slate-500">
                Australian resident tax brackets &middot;{' '}
                {includeDepreciation
                  ? `Depreciation included at ${formatCurrency(annualDepreciation)}/year`
                  : 'Depreciation not included'}
              </p>
              <p className="mt-3 text-[1.03rem] leading-8 text-slate-500">
                {taxTraceability}
              </p>
            </div>

            <div className="mt-9 rounded-[2rem] border border-slate-200/75 bg-white px-6 py-8 md:px-8 md:py-9">
              <p className={microLabelClass}>Tax assumptions</p>

              <TaxAssumptionsContent
                className="mt-5"
                ownershipStructure={ownershipStructure}
                ownershipSplitUserInput={ownershipSplitUserInput}
                ownershipSplitPartnerInput={ownershipSplitPartnerInput}
                ownershipSplitInlineError={ownershipSplitInlineError}
                showJointOwnershipIncomeWarning={showJointOwnershipIncomeWarning}
                onOwnershipStructureChange={handleOwnershipStructureChange}
                onOwnershipSplitUserChange={handleOwnershipSplitUserChange}
                onOwnershipSplitPartnerChange={handleOwnershipSplitPartnerChange}
                taxIncomeBasisLabel={taxIncomeBasisLabel}
                includeDepreciation={includeDepreciation}
                annualDepreciation={annualDepreciation}
              />

              <div className="mt-5">
                <DepreciationControls
                  includeDepreciation={includeDepreciation}
                  annualDepreciationInput={annualDepreciationInput}
                  annualDepreciation={annualDepreciation}
                  onIncludeDepreciationChange={setIncludeDepreciation}
                  onAnnualDepreciationChange={handleAnnualDepreciationChange}
                />
              </div>

              <MonthlyCashFlowBreakdown
                className="mt-5"
                scenario={recommendedScenario}
                taxOwnership={taxOwnership}
                includeDepreciation={includeDepreciation}
                annualDepreciation={annualDepreciation}
              />
            </div>
          </section>
        ) : null}
          </>
        ) : (
          <section className="mt-10 rounded-[2rem] border border-amber-200/80 bg-amber-50/55 px-6 py-6 shadow-[0_22px_60px_-50px_rgba(15,23,42,0.16)] md:mt-12 md:px-8">
            <p className={microLabelClass}>Execution Status</p>
            <h3 className="mt-4 text-[22px] font-semibold tracking-tight text-slate-900 md:text-[24px]">
              No executable acquisition scenario under current settings
            </h3>
            <p className="mt-4 max-w-[48rem] text-[1.03rem] leading-8 text-slate-600">
              Scenario ranking now excludes blocked paths. The next step is to improve the binding
              constraint before treating any acquisition as a live option.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-[1.4rem] border border-white/80 bg-white/85 px-4 py-4 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.16)]">
                <p className={microLabelClass}>Borrowing Power</p>
                <p className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-950">
                  {Number.isFinite(centralBorrowingCapacity)
                    ? formatCurrency(centralBorrowingCapacity)
                    : 'Unavailable'}
                </p>
              </div>
              <div className="rounded-[1.4rem] border border-white/80 bg-white/85 px-4 py-4 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.16)]">
                <p className={microLabelClass}>Deployable Capital</p>
                <p className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-950">
                  {formatCurrency(Number(scenarioModel.inputs?.totalDeployableCapital || 0))}
                </p>
              </div>
              <div className="rounded-[1.4rem] border border-white/80 bg-white/85 px-4 py-4 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.16)]">
                <p className={microLabelClass}>Market Entry Floor</p>
                <p className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-950">
                  {formatCurrency(Number(scenarioModel.viability?.realisticMarketEntryMin || 0))}
                </p>
              </div>
            </div>

            <p className="mt-5 text-sm font-medium leading-7 text-slate-700">
              {limitingFactorActionLine}
            </p>
          </section>
        )}

        <section className="mt-10 rounded-[2rem] border border-slate-200/75 bg-white px-6 pt-6 pb-6 shadow-[0_22px_60px_-50px_rgba(15,23,42,0.16)] md:mt-12 md:px-8">
          <p className={microLabelClass}>Confidence</p>
          <p className="mt-4 text-[22px] font-semibold tracking-tight text-slate-900 md:text-[24px]">
            {getConfidenceSummary(Number(scenarioModel.confidence?.score || 0))}
          </p>
          <p className="mt-3 max-w-[38rem] text-[1rem] leading-7 text-slate-600">
            Confidence reflects how complete and internally consistent the scenario inputs are.
          </p>
        </section>

        <section className="mt-10 rounded-[2rem] border border-slate-200/75 bg-white px-6 pt-6 pb-6 shadow-[0_22px_60px_-50px_rgba(15,23,42,0.16)] md:mt-12 md:px-8">
          <p className={microLabelClass}>Advanced analysis</p>
          <h3 className="mt-4 text-[22px] font-semibold tracking-tight text-slate-900 md:text-[24px]">
            Optimise the scenario under tougher rates, tighter buffers, and different capital structures.
          </h3>

          <button
            type="button"
            onClick={() => setIsAdvancedAnalysisOpen((current) => !current)}
            className="mt-6 inline-flex items-center gap-3 rounded-full border border-slate-200/80 bg-slate-50 px-5 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            <span>{isAdvancedAnalysisOpen ? 'Hide advanced analysis' : 'Show advanced analysis'}</span>
            <span
              className={`text-base leading-none transition-transform ${
                isAdvancedAnalysisOpen ? 'rotate-90' : ''
              }`}
            >
              ›
            </span>
          </button>

          {isAdvancedAnalysisOpen ? (
            <div className="mt-9 space-y-10">
              <article className="rounded-[2.1rem] border border-slate-200/80 bg-white px-6 pt-6 pb-6 shadow-[0_24px_70px_-54px_rgba(15,23,42,0.16)] md:px-8">
                <p className={microLabelClass}>Rate Sensitivity</p>
                <h4 className="mt-4 text-[1.7rem] font-semibold tracking-tight text-slate-950">
                  How much borrowing headroom is rate-sensitive?
                </h4>
                <p className="mt-3 max-w-[45rem] text-[1rem] leading-7 text-slate-600">
                  See how quickly lender buffer changes compress purchase power and reduce the
                  range available to the recommended strategy.
                </p>
                <div className="mt-6">{borrowingSensitivityChart}</div>
              </article>

              <article className="rounded-[2.1rem] border border-slate-200/80 bg-white px-6 pt-6 pb-6 shadow-[0_24px_70px_-54px_rgba(15,23,42,0.16)] md:px-8">
                <p className={microLabelClass}>Stress Test</p>
                <h4 className="mt-4 text-[1.7rem] font-semibold tracking-tight text-slate-950">
                  When does serviceability start to tighten?
                </h4>
                <p className="mt-3 max-w-[45rem] text-[1rem] leading-7 text-slate-600">
                  Track how quickly monthly surplus erodes under tougher lending assumptions and
                  where the funding profile begins to lose resilience.
                </p>
                <div className="mt-6">{stressTestChart}</div>
              </article>

              <article className="rounded-[2.1rem] border border-slate-200/80 bg-white px-6 py-7 shadow-[0_24px_70px_-54px_rgba(15,23,42,0.16)] md:px-8 md:py-8">
                <p className={microLabelClass}>Purchase Power</p>
                <h4 className="mt-4 text-[1.7rem] font-semibold tracking-tight text-slate-950">
                  Does deposit structure materially improve range?
                </h4>
                <p className="mt-3 max-w-[45rem] text-[1rem] leading-7 text-slate-600">
                  Compare deposit settings to see whether lower upfront capital truly expands the
                  executable price range or simply shifts the constraint back to borrowing.
                </p>
                <div className="mt-6">{depositPurchasePowerChart}</div>
              </article>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  )
}
