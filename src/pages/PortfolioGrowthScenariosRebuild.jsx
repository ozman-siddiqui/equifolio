import { startTransition, useEffect, useMemo, useRef, useState } from 'react'

import useFinancialData from '../hooks/useFinancialData'
import usePortfolioData from '../hooks/usePortfolioData'
import { buildAlerts } from '../components/AlertsDropdown'
import calculateBorrowingPower from '../lib/borrowingPowerEngine'
import buildDashboardCommandCenter from '../lib/dashboardCommandCenter'
import buildDashboardCompleteness from '../lib/dashboardCompleteness'
import buildDashboardStateResolver from '../lib/dashboardStateResolver'
import buildPortfolioGrowthScenarios, {
  calculateEconomicOutcome,
} from '../lib/portfolioGrowthScenarios'
import { calculateNegativeGearingTaxBenefit } from '../lib/negativeGearingTaxBenefit'
import { calculateAfterTaxHoldingCost } from '../lib/afterTaxHoldingCost'
import { estimateRepayment, getRemainingTermMonths } from '../lib/mortgageMath'
import { normalizeTaxOwnership } from '../lib/taxOwnership'
import { useGrowthScenariosUiStore } from '../stores/growthScenariosUiStore'
import { supabase } from '../supabase'

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
const DEFAULT_LOAN_TERM_MONTHS = 360

function getConfidenceLabel(score) {
  if (score >= 85) return 'Strong'
  if (score >= 65) return 'Moderate'
  return 'Limited'
}

function getConfidenceSummary(score) {
  if (score >= 85) return 'Strong data coverage across scenario inputs'
  if (score >= 65) return 'Moderate data coverage across scenario inputs'
  return 'Limited data coverage across scenario inputs'
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

function formatCompactAmount(value) {
  const n = Math.abs(Number(value || 0))
  const sign = Number(value) < 0 ? '-' : ''
  if (n >= 1_000_000) return `${sign}$${(n / 1_000_000).toFixed(2)}m`
  if (n >= 1_000) return `${sign}$${Math.round(n / 1_000)}k`
  return formatCurrency(Number(value || 0))
}

function projectLoanBalanceAtYear(loan, targetYear) {
  const principal = Number(loan?.current_balance || 0)
  if (!Number.isFinite(principal) || principal <= 0) return 0

  const annualRate = Number(loan?.interest_rate || 0)
  const repaymentType =
    String(loan?.repayment_type || '').trim().toLowerCase() === 'interest only'
      ? 'Interest Only'
      : 'Principal and Interest'
  const { months: remainingTermMonths } = getRemainingTermMonths(
    loan,
    DEFAULT_LOAN_TERM_MONTHS
  )
  const elapsedMonths = Math.max(
    0,
    Math.min(Math.round(Number(targetYear || 0) * 12), remainingTermMonths)
  )

  if (repaymentType === 'Interest Only') {
    return Math.round(principal)
  }

  const repayment = estimateRepayment({
    principal,
    annualRate,
    repaymentType,
    remainingTermMonths,
  })

  if (!Number.isFinite(repayment) || repayment <= 0) return Math.round(principal)

  const monthlyRate = annualRate / 100 / 12
  if (!Number.isFinite(monthlyRate) || monthlyRate <= 0) {
    return Math.max(0, Math.round(principal - repayment * elapsedMonths))
  }

  const growthFactor = Math.pow(1 + monthlyRate, elapsedMonths)
  const remainingBalance =
    principal * growthFactor - repayment * ((growthFactor - 1) / monthlyRate)

  return Math.max(0, Math.round(remainingBalance))
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
    <div className="flex items-start justify-between gap-3 border-b-[0.5px] border-[rgba(0,0,0,0.06)] py-[7px] last:border-b-0">
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
    <div className={`${className} space-y-4 rounded-[16px] border border-[rgba(0,0,0,0.08)] bg-slate-50/70 px-[22px] py-[18px] md:px-[22px] md:py-[18px]`.trim()}>
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
            <p className="text-sm text-[#A32D2D]">{ownershipSplitInlineError}</p>
          ) : null}
          {showJointOwnershipIncomeWarning ? (
            <p className="text-sm text-[#854F0B]">
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
        <div className="mt-[10px] border-t-[0.5px] border-[rgba(0,0,0,0.06)] pt-[10px]">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.15fr_1fr]">
          <div className="rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-slate-50/80 px-[18px] py-[16px] md:px-[18px] md:py-[16px]">
            <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
              Insight
            </p>
            {insight ? (
              <p className="mt-3 text-[12px] font-normal leading-[1.6] text-[var(--color-text-secondary)]">
                {insight}
              </p>
            ) : null}
            {note ? (
              <p className="mt-2 text-[12px] leading-[1.6] text-[var(--color-text-secondary)]">
                {note}
              </p>
            ) : null}
          </div>
          <div className="rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] px-[18px] py-[16px] md:px-[18px] md:py-[16px]">
            <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
              Traceability
            </p>
            <div className="mt-3 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-x-4 md:gap-y-2">
              {traceability ? (
                <p className="text-[12px] leading-[1.6] text-[var(--color-text-secondary)]">
                  {traceability}
                </p>
              ) : null}
              {confidenceLabel ? (
                <p className="text-[12px] font-medium leading-[1.6] text-[var(--color-text-secondary)]">
                  Data coverage: {confidenceLabel}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        </div>
      ) : null}
      {warning ? (
        <p className="mt-2 text-[13px] font-normal leading-[1.6] text-[#854F0B]">{warning}</p>
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
    <div className="rounded-[14px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] px-[18px] py-[16px] shadow-[0_24px_70px_-48px_rgba(15,23,42,0.35)] md:px-[18px] md:py-[16px]">
      <div className="mb-5">
        <p className="text-[15px] font-medium text-[var(--color-text-primary)]">{title}</p>
        {subtitle ? (
          <p className="mt-1.5 max-w-[44rem] text-[13px] font-normal leading-[1.6] text-[var(--color-text-secondary)]">
            {subtitle}
          </p>
        ) : null}
      </div>

      <div className="rounded-[14px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] px-[18px] py-[16px] md:px-[18px] md:py-[16px]">
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
                        stroke="var(--color-background-primary)"
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
        <span>Include non-cash depreciation to model tax effects</span>
        <input
          type="checkbox"
          checked={includeDepreciation}
          onChange={(event) => onIncludeDepreciationChange(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-[#0F6E56] focus:ring-[#0F6E56]"
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
            <p className="mt-2 text-sm text-[#854F0B]">
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
      className={`${className} rounded-[14px] border border-[#EF9F27] bg-[#FAEEDA] px-[18px] py-[16px]`.trim()}
    >
      <summary className="cursor-pointer list-none text-[13px] font-medium text-[var(--color-text-primary)] marker:hidden">
        View monthly cash flow breakdown
      </summary>
      <div className="mt-4 rounded-[14px] border border-[#EF9F27] bg-[var(--color-background-primary)] px-[18px] py-[16px]">
        {scenarioPurchasePrice !== null && scenarioLoanAmount !== null ? (
          <p className="mb-4 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
            Based on ~{formatCurrency(scenarioPurchasePrice)} purchase price with{' '}
            {formatCurrency(scenarioLoanAmount)} loan at {scenarioRatePct.toFixed(1)}%
          </p>
        ) : null}
        <AssumptionTrace
          text={`Inputs used: rent, loan repayment, and property expenses · Assumptions: ${repaymentTypeLabel} repayment at ${scenarioRatePct.toFixed(1)}% and structured expense allowances`}
          className="mb-4"
        />
        <div className="space-y-0">
          <BreakdownRow label="Rent" value={formatCurrency(monthlyRent)} />
          <BreakdownRow
            label={`Loan repayment (${repaymentTypeLabel} @ ${scenarioRatePct.toFixed(1)}%)`}
            value={`-${formatCurrency(Math.abs(monthlyRepayment))}`}
          />
          <div className="rounded-[14px] border border-[#EF9F27] bg-[#FAEEDA] px-[18px] py-[16px]">
            <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
              Expenses
            </p>
            <div className="mt-3 space-y-0">
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
            <p className="mt-3 text-[11px] leading-[1.5] text-[var(--color-text-tertiary)]">
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
              <p className="text-[11px] leading-[1.5] text-[var(--color-text-tertiary)]">
                Tax benefit is estimated from current income and Australian tax brackets.
              </p>
              {includeDepreciation &&
              getSafeNumber(negativeGearing?.depreciationTaxBenefitMonthly) !== null ? (
                <p className="text-[11px] leading-[1.5] text-[var(--color-text-tertiary)]">
                  Depreciation adds an estimated +
                  {formatCurrency(negativeGearing.depreciationTaxBenefitMonthly)}/month to tax
                  benefit.
                </p>
              ) : null}
            </>
          ) : hasTaxableIncome ? (
            <p className="text-[11px] leading-[1.5] text-[var(--color-text-tertiary)]">
              Tax estimate unavailable until ownership inputs are complete.
            </p>
          ) : (
            <p className="text-[11px] leading-[1.5] text-[var(--color-text-tertiary)]">Add income to estimate tax benefit</p>
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
      className={`${className} rounded-[14px] border border-[#c8e8dc] bg-[#f4faf7] px-[18px] py-[16px]`.trim()}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
        Funding Breakdown
      </p>
      <div className="mt-4 space-y-0">
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
      className={`flex min-w-0 w-full overflow-hidden rounded-[14px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-secondary)] px-[18px] py-[16px] transition-[opacity,transform,background-color] duration-200 ${className}`.trim()}
    >
      <div className="flex min-w-0 w-full flex-col items-start gap-3">
        <p className="text-[10px] font-medium uppercase leading-tight tracking-[0.09em] text-[var(--color-text-tertiary)]">
          {label}
        </p>
        <p
          className={`min-w-0 max-w-full truncate whitespace-nowrap text-[20px] font-medium leading-none tracking-[-0.03em] text-[var(--color-text-primary)] transition-[opacity,transform,color] duration-200 md:text-[22px] ${valueClassName}`.trim()}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

export default function PortfolioGrowthScenariosRebuild() {
  const [session, setSession] = useState(null)
  const { properties, loans, transactions, loading: portfolioLoading } = usePortfolioData(session)
  const { financialProfile, liabilities, loading: financialLoading } = useFinancialData()

  useEffect(() => {
    let active = true

    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        if (active) setSession(currentSession || null)
      })
      .catch(() => {
        if (active) setSession(null)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession || null)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])
  const [isScenarioRefreshing, setIsScenarioRefreshing] = useState(false)
  const [isDeferredAnalysisReady, setIsDeferredAnalysisReady] = useState(false)
  const [selectedGrowthRate, setSelectedGrowthRate] = useState(6)
  const [selectedProjectionYears, setSelectedProjectionYears] = useState(10)
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
  const dashboardAlerts = useMemo(() => buildAlerts(properties, loans), [properties, loans])
  const dashboardCompleteness = useMemo(
    () =>
      buildDashboardCompleteness({
        properties,
        loans,
        financialProfile,
        liabilities,
      }),
    [properties, loans, financialProfile, liabilities]
  )
  const dashboardState = useMemo(
    () =>
      buildDashboardStateResolver({
        properties,
        loans,
        transactions,
        financialProfile,
        liabilities,
        dashboardCompleteness,
        borrowingAnalysis,
      }),
    [
      properties,
      loans,
      transactions,
      financialProfile,
      liabilities,
      dashboardCompleteness,
      borrowingAnalysis,
    ]
  )
  const dashboardCommandCenter = useMemo(
    () =>
      buildDashboardCommandCenter({
        properties,
        loans,
        transactions,
        alerts: dashboardAlerts,
        borrowingAnalysis,
        dashboardCompleteness,
        dashboardState,
        financialProfile,
        liabilities,
      }),
    [
      properties,
      loans,
      transactions,
      dashboardAlerts,
      borrowingAnalysis,
      dashboardCompleteness,
      dashboardState,
      financialProfile,
      liabilities,
    ]
  )
  const dashboardTopActionSummaries = useMemo(
    () => (dashboardCommandCenter?.topActionSummaries || []).slice(0, 2),
    [dashboardCommandCenter?.topActionSummaries]
  )
  const currentPortfolioNetEquity = useMemo(
    () =>
      Math.round(
        properties.reduce((sum, property) => sum + Number(property?.current_value || 0), 0) -
          loans.reduce((sum, loan) => sum + Number(loan?.current_balance || 0), 0)
      ),
    [properties, loans]
  )
  const currentPortfolioPropertyValue = useMemo(
    () =>
      properties.reduce((sum, property) => sum + Number(property?.current_value || 0), 0),
    [properties]
  )
  const currentPortfolioLoanBalance = useMemo(
    () => loans.reduce((sum, loan) => sum + Number(loan?.current_balance || 0), 0),
    [loans]
  )
  const projectionStrokeRef = useRef(null)
  const projectionFillRef = useRef(null)
  const projectionEndDotRef = useRef(null)
  const projectionRafRef = useRef([])
  const projectionPulseTimeoutRef = useRef(null)
  const usableEquity = useMemo(() => {
    return Math.max(
      Math.round(currentPortfolioPropertyValue * 0.8 - currentPortfolioLoanBalance),
      0
    )
  }, [currentPortfolioLoanBalance, currentPortfolioPropertyValue])
  const projectionMilestoneYears = useMemo(
    () =>
      selectedProjectionYears === 30
        ? [0, 10, 20, 30]
        : [0, selectedProjectionYears / 2, selectedProjectionYears],
    [selectedProjectionYears]
  )
  const baseBalanceSheetProjection = useMemo(() => {
    const growthMultiplier = 1 + selectedGrowthRate / 100

    return projectionMilestoneYears.map((year) => {
      const propertyValue = Math.round(
        currentPortfolioPropertyValue * Math.pow(growthMultiplier, year)
      )
      const loanBalance = loans.reduce(
        (sum, loan) => sum + projectLoanBalanceAtYear(loan, year),
        0
      )

      return {
        year,
        label: year === 0 ? 'TODAY' : `YR ${year}`,
        propertyValue,
        loanBalance,
        netEquity: Math.round(propertyValue - loanBalance),
      }
    })
  }, [currentPortfolioPropertyValue, loans, projectionMilestoneYears, selectedGrowthRate])

  const projectionStudioModel = useMemo(() => {
    if (currentPortfolioNetEquity <= 0) return null

    const startValue = currentPortfolioNetEquity
    const midpointYears = selectedProjectionYears / 2
    const endYears = selectedProjectionYears
    const growthMultiplier = 1 + selectedGrowthRate / 100
    const midpointValue = Math.round(startValue * Math.pow(growthMultiplier, midpointYears))
    const endValue = Math.round(startValue * Math.pow(growthMultiplier, endYears))
    const growthDelta = endValue - startValue

    return {
      startValue,
      midpointValue,
      endValue,
      midpointYears,
      endYears,
      growthDelta,
    }
  }, [currentPortfolioNetEquity, selectedGrowthRate, selectedProjectionYears])
  // RECONCILIATION RULE:
  // point.value === point.propertyValue - point.loanBalance at every milestone
  // Both Projection Studio chart and Wealth tab must derive net equity this way
  // Do not use projectionStudioModel lump-sum values for chart rendering
  const baseTrajectoryData = useMemo(() => {
    if (!projectionStudioModel) return []

    const startingPoint = {
      propertyValue:
        baseBalanceSheetProjection[0]?.propertyValue ?? currentPortfolioPropertyValue,
      loanBalance:
        baseBalanceSheetProjection[0]?.loanBalance ?? currentPortfolioLoanBalance,
    }
    const midpointPoint = {
      propertyValue:
        baseBalanceSheetProjection.find(
          (point) => point.year === projectionStudioModel.midpointYears
        )?.propertyValue ?? currentPortfolioPropertyValue,
      loanBalance:
        baseBalanceSheetProjection.find(
          (point) => point.year === projectionStudioModel.midpointYears
        )?.loanBalance ?? currentPortfolioLoanBalance,
    }
    const endPoint = {
      propertyValue:
        baseBalanceSheetProjection.find(
          (point) => point.year === projectionStudioModel.endYears
        )?.propertyValue ?? currentPortfolioPropertyValue,
      loanBalance:
        baseBalanceSheetProjection.find(
          (point) => point.year === projectionStudioModel.endYears
        )?.loanBalance ?? currentPortfolioLoanBalance,
    }

    return [
      {
        year: 0,
        label: 'TODAY',
        value: Math.round(
          Number(startingPoint.propertyValue || 0) - Number(startingPoint.loanBalance || 0)
        ),
        propertyValue: startingPoint.propertyValue,
        loanBalance: startingPoint.loanBalance,
      },
      {
        year: projectionStudioModel.midpointYears,
        label: `YR ${projectionStudioModel.midpointYears}`,
        value: Math.round(
          Number(midpointPoint.propertyValue || 0) - Number(midpointPoint.loanBalance || 0)
        ),
        propertyValue: midpointPoint.propertyValue,
        loanBalance: midpointPoint.loanBalance,
      },
      {
        year: projectionStudioModel.endYears,
        label: `YR ${projectionStudioModel.endYears}`,
        value: Math.round(
          Number(endPoint.propertyValue || 0) - Number(endPoint.loanBalance || 0)
        ),
        propertyValue: endPoint.propertyValue,
        loanBalance: endPoint.loanBalance,
      },
    ]
  }, [
    baseBalanceSheetProjection,
    currentPortfolioLoanBalance,
    currentPortfolioPropertyValue,
    projectionStudioModel,
  ])

  // ── Portfolio Wealth Trajectory ──────────────────────────────────────────
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
        availableCash: Math.max(
          0,
          Number(financialProfile?.cash_available_for_investment || 0)
        ),
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
      financialProfile?.cash_available_for_investment,
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
  const hasRecommendedScenario = Boolean(recommendedScenario)
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
  const bestBlockedStrategy = useMemo(
    () =>
      blockedScenarios.length > 0
        ? blockedScenarios.reduce((best, current) => {
            const bestGap =
              Number(best?.requiredCapitalGap ?? best?.additionalCapitalRequired ?? Infinity)
            const currentGap = Number(
              current?.requiredCapitalGap ?? current?.additionalCapitalRequired ?? Infinity
            )
            return currentGap < bestGap ? current : best
          })
        : null,
    [blockedScenarios]
  )
  const hasExecutableScenario = Boolean(recommendedScenario?.isExecutable)
  const topAlternativeScenario = blockedScenarios[0] || secondaryScenarios[0] || null
  const recommendedScenarioAnchorPrice = getSafeNumber(recommendedScenario?.scenarioPurchasePrice)
  const recommendedScenarioLoanAmount = getSafeNumber(recommendedScenario?.scenarioLoanAmount)
  const recommendedScenarioDepositPct = getSafeNumber(recommendedScenario?.scenarioDepositPct)

  const acquisitionTrajectoryData = useMemo(() => {
    if (!projectionStudioModel || !hasExecutableScenario || !recommendedScenario) return []

    const scenarioPurchasePrice = Number(recommendedScenario?.scenarioPurchasePrice || 0)
    const scenarioLoanAmount = Number(recommendedScenario?.scenarioLoanAmount || 0)
    const normalizedProjectionData = Array.isArray(recommendedScenario?.projectionData)
      ? recommendedScenario.projectionData
          .map((point) => ({
            year: Number(point?.year || 0),
            propertyValue: Number(point?.propertyValue ?? 0),
            loanBalance: Number(point?.loanBalance ?? 0),
            netEquity: Number(point?.netEquity ?? point?.equity ?? 0),
          }))
          .filter((point) => Number.isFinite(point.year) && point.year > 0)
          .sort((a, b) => a.year - b.year)
      : []

    const getProjectedScenarioBalanceSheet = (targetYear) => {
      if (targetYear <= 0) {
        return {
          propertyValue: scenarioPurchasePrice,
          loanBalance: scenarioLoanAmount,
        }
      }

      const exactPoint = normalizedProjectionData.find((point) => point.year === targetYear)
      if (exactPoint) {
        return {
          propertyValue: Math.max(0, Number(exactPoint.propertyValue || 0)),
          loanBalance: Math.max(0, Number(exactPoint.loanBalance || 0)),
        }
      }

      const nextPoint = normalizedProjectionData.find((point) => point.year > targetYear)
      const previousCandidates = normalizedProjectionData.filter((point) => point.year < targetYear)
      const previousPoint = previousCandidates[previousCandidates.length - 1] || null

      if (previousPoint && nextPoint) {
        const span = nextPoint.year - previousPoint.year || 1
        const progress = (targetYear - previousPoint.year) / span
        return {
          propertyValue: Math.max(
            0,
            Math.round(
              previousPoint.propertyValue +
                (nextPoint.propertyValue - previousPoint.propertyValue) * progress
            )
          ),
          loanBalance: Math.max(
            0,
            Math.round(
              previousPoint.loanBalance +
                (nextPoint.loanBalance - previousPoint.loanBalance) * progress
            )
          ),
        }
      }

      const lastPoint = normalizedProjectionData[normalizedProjectionData.length - 1] || null
      const priorPoint = normalizedProjectionData.length > 1
        ? normalizedProjectionData[normalizedProjectionData.length - 2]
        : null

      if (lastPoint) {
        const yearsBeyondLastPoint = Math.max(targetYear - lastPoint.year, 0)
        const referencePropertyValue = Number.isFinite(lastPoint.propertyValue) && lastPoint.propertyValue > 0
          ? lastPoint.propertyValue
          : scenarioPurchasePrice * Math.pow(1 + selectedGrowthRate / 100, lastPoint.year)
        const projectedPropertyValue = referencePropertyValue * Math.pow(1 + selectedGrowthRate / 100, yearsBeyondLastPoint)
        const annualLoanReduction =
          priorPoint && lastPoint.year !== priorPoint.year
            ? Math.max(0, (priorPoint.loanBalance - lastPoint.loanBalance) / (lastPoint.year - priorPoint.year))
            : 0
        const projectedLoanBalance = Math.max(0, lastPoint.loanBalance - annualLoanReduction * yearsBeyondLastPoint)
        return {
          propertyValue: Math.max(0, Math.round(projectedPropertyValue)),
          loanBalance: Math.max(0, Math.round(projectedLoanBalance)),
        }
      }

      const fallbackPropertyValue = scenarioPurchasePrice * Math.pow(1 + selectedGrowthRate / 100, targetYear)
      return {
        propertyValue: Math.max(0, Math.round(fallbackPropertyValue)),
        loanBalance: Math.max(0, Math.round(scenarioLoanAmount)),
      }
    }

    return baseTrajectoryData.map((point) => {
      const scenarioBalanceSheet = getProjectedScenarioBalanceSheet(point.year)
      const totalPropertyValue =
        Number(point.propertyValue || 0) + Number(scenarioBalanceSheet.propertyValue || 0)
      const totalLoanBalance =
        Number(point.loanBalance || 0) + Number(scenarioBalanceSheet.loanBalance || 0)
      const baseNetEquity = Math.round(
        Number(point.propertyValue || 0) - Number(point.loanBalance || 0)
      )
      const acquisitionNetEquityContribution = Math.max(
        0,
        Number(scenarioBalanceSheet.propertyValue || 0) - Number(scenarioBalanceSheet.loanBalance || 0)
      )

      return {
        year: point.year,
        label: point.label,
        value: Math.round(baseNetEquity + acquisitionNetEquityContribution),
        propertyValue: Math.round(totalPropertyValue),
        loanBalance: Math.round(totalLoanBalance),
      }
    })
  }, [baseTrajectoryData, hasExecutableScenario, projectionStudioModel, recommendedScenario, selectedGrowthRate])
  const projectionStudioGapBreakdown = useMemo(() => {
    if (!acquisitionTrajectoryData.length || !baseTrajectoryData.length) return null

    const baseTerminalPoint = baseTrajectoryData[baseTrajectoryData.length - 1] || null
    const acquisitionTerminalPoint =
      acquisitionTrajectoryData[acquisitionTrajectoryData.length - 1] || null

    if (!baseTerminalPoint || !acquisitionTerminalPoint) return null

    const addedPropertyTerminalValue = Math.max(
      0,
      Number(acquisitionTerminalPoint.propertyValue || 0) -
        Number(baseTerminalPoint.propertyValue || 0)
    )
    const acquisitionLoanBalance = Math.max(
      0,
      Number(acquisitionTerminalPoint.loanBalance || 0) -
        Number(baseTerminalPoint.loanBalance || 0)
    )
    const addedNetEquity = Math.max(
      0,
      Number(acquisitionTerminalPoint.value || 0) - Number(baseTerminalPoint.value || 0)
    )

    return {
      basePortfolioTerminalNetEquity: Number(baseTerminalPoint.value || 0),
      addedPropertyTerminalValue,
      acquisitionLoanBalance,
      addedNetEquity,
      totalPortfolioTerminalNetEquity: Number(acquisitionTerminalPoint.value || 0),
    }
  }, [acquisitionTrajectoryData, baseTrajectoryData])
  const baseStartValue = baseTrajectoryData[0]?.value ?? 0
  const baseEndValue = baseTrajectoryData[baseTrajectoryData.length - 1]?.value ?? 0
  const baseGrowthDelta = baseEndValue - baseStartValue
  const acquisitionStartValue = acquisitionTrajectoryData[0]?.value ?? 0
  const acquisitionEndValue =
    acquisitionTrajectoryData[acquisitionTrajectoryData.length - 1]?.value ?? 0
  const acquisitionGrowthDelta = acquisitionEndValue - acquisitionStartValue
  const projectionStudioChart = useMemo(() => {
    if (!baseTrajectoryData.length) return null

    const width = 720
    const height = 344
    const milestoneYears =
      selectedProjectionYears === 30
        ? [0, 10, 20, 30]
        : [0, selectedProjectionYears / 2, selectedProjectionYears]
    const xAnchors =
      milestoneYears.length === 4 ? [72, 288, 504, 662] : [72, 360, 662]
    const legend = acquisitionTrajectoryData.length
      ? [
          { label: 'With acquisition', tone: 'acquisition' },
          { label: 'Base portfolio', tone: 'base' },
        ]
      : [{ label: 'Base portfolio', tone: 'base' }]

    const interpolateSeriesValue = (series, targetYear) => {
      if (!Array.isArray(series) || !series.length) return null
      const exactPoint = series.find((point) => point.year === targetYear)
      if (exactPoint) return Number(exactPoint.value || 0)

      const previousPoints = series.filter((point) => point.year < targetYear)
      const nextPoint = series.find((point) => point.year > targetYear)
      const previousPoint = previousPoints[previousPoints.length - 1] || null

      if (previousPoint && nextPoint) {
        const span = nextPoint.year - previousPoint.year || 1
        const progress = (targetYear - previousPoint.year) / span
        return Math.round(previousPoint.value + (nextPoint.value - previousPoint.value) * progress)
      }

      const lastPoint = series[series.length - 1]
      return Number(lastPoint?.value || 0)
    }

    const baseMilestones = milestoneYears.map((year, index) => ({
      year,
      label: year === 0 ? 'Today' : `Yr ${year}`,
      value: interpolateSeriesValue(baseTrajectoryData, year),
      x: xAnchors[index],
    }))
    const acquisitionMilestones = acquisitionTrajectoryData.length
      ? milestoneYears.map((year, index) => ({
          year,
          label: year === 0 ? 'Today' : `Yr ${year}`,
          value: interpolateSeriesValue(acquisitionTrajectoryData, year),
          x: xAnchors[index],
        }))
      : []

    const allValues = [
      ...baseMilestones.map((point) => point.value),
      ...acquisitionMilestones.map((point) => point.value),
    ].filter((value) => Number.isFinite(value))
    const rawMin = Math.min(...allValues)
    const rawMax = Math.max(...allValues)
    const valueRange = Math.max(rawMax - rawMin, rawMax * 0.08, 1)
    const minVal = Math.max(0, rawMin - valueRange * 0.04)
    const maxVal = rawMax + valueRange * 0.03
    const topPad = 8
    const bottomPad = 10
    const plotHeight = height - topPad - bottomPad
    const range = maxVal - minVal || 1
    const scaleY = (value) => topPad + (1 - (value - minVal) / range) * plotHeight

    const buildCurvePath = (points) => {
      if (points.length < 2) return ''
      let path = `M ${points[0].x} ${points[0].y}`
      for (let index = 0; index < points.length - 1; index += 1) {
        const next = points[index + 1]
        path += ` L ${next.x} ${next.y}`
      }
      return path
    }

    const basePoints = baseMilestones.map((point) => ({
      ...point,
      y: scaleY(point.value),
    }))
    const acquisitionPoints = acquisitionMilestones.map((point) => ({
      ...point,
      y: scaleY(point.value),
    }))
    const baseLinePath = buildCurvePath(basePoints)
    const acquisitionLinePath = acquisitionPoints.length ? buildCurvePath(acquisitionPoints) : null
    const baselineY = height - 8
    const acquisitionFillPath = acquisitionPoints.length
      ? `${acquisitionLinePath} L ${acquisitionPoints[acquisitionPoints.length - 1].x} ${baselineY} L ${acquisitionPoints[0].x} ${baselineY} Z`
      : null
    const primaryPoints = acquisitionPoints.length ? acquisitionPoints : basePoints
    const primaryLinePath = acquisitionPoints.length ? acquisitionLinePath : baseLinePath
    const primaryFillPath = acquisitionPoints.length ? acquisitionFillPath : null

    return {
      width,
      height,
      legend,
      baselineY,
      milestoneCount: milestoneYears.length,
      baseMilestones: basePoints,
      baseLinePath,
      acquisitionMilestones: acquisitionPoints,
      acquisitionLinePath,
      acquisitionFillPath,
      primaryPoints,
      primaryLinePath,
      primaryFillPath,
      comparisonActive: acquisitionPoints.length > 0,
    }
  }, [acquisitionTrajectoryData, baseTrajectoryData, selectedProjectionYears])
  useEffect(() => {
    const stroke = projectionStrokeRef.current
    const fill = projectionFillRef.current
    const endpoint = projectionEndDotRef.current

    if (!projectionStudioChart || !stroke || !projectionStudioChart.primaryLinePath) return undefined

    const length = stroke.getTotalLength()
    stroke.style.strokeDasharray = `${length}`
    stroke.style.strokeDashoffset = `${length}`
    stroke.style.transition = 'none'

    if (fill) {
      fill.style.opacity = '0'
      fill.style.transition = 'none'
    }

    if (endpoint) {
      endpoint.style.animation = 'none'
    }

    const firstFrame = requestAnimationFrame(() => {
      const secondFrame = requestAnimationFrame(() => {
        stroke.style.transition = 'stroke-dashoffset 1500ms cubic-bezier(0.4,0,0.2,1)'
        stroke.style.strokeDashoffset = '0'
        if (fill) {
          fill.style.transition = 'opacity 820ms ease-in 260ms'
          fill.style.opacity = '1'
        }
      })
      projectionRafRef.current.push(secondFrame)
    })
    projectionRafRef.current = [firstFrame]

    projectionPulseTimeoutRef.current = window.setTimeout(() => {
      if (endpoint) {
        endpoint.style.animation = 'projectionStudioEndDotPulse 520ms ease-in-out'
      }
    }, 1180)

    return () => {
      projectionRafRef.current.forEach((frame) => cancelAnimationFrame(frame))
      projectionRafRef.current = []
      if (projectionPulseTimeoutRef.current != null) {
        clearTimeout(projectionPulseTimeoutRef.current)
      }
      stroke.style.transition = 'none'
      stroke.style.strokeDashoffset = `${length}`
      if (fill) {
        fill.style.transition = 'none'
        fill.style.opacity = '0'
      }
      if (endpoint) {
        endpoint.style.animation = 'none'
      }
    }
  }, [projectionStudioChart])
  const baselineCapitalGap = Number(scenarioModel.recommendedStrategy?.requiredCapitalGap || 0)
  const recommendedTotalRequiredCapital =
    Number(recommendedScenario?.depositRequired || 0) +
    Number(recommendedScenario?.estimatedAcquisitionCosts || 0)
  const recommendedAvailableCapital = Number(scenarioModel.inputs?.totalDeployableCapital || 0)
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
          recommendedScenario?.capitalBreakdown?.totalDeployableCapital ??
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
  const topSuggestedScenarioAfterTaxSurplus = useMemo(() => {
    if (!hasExecutableScenario || !topSuggestedScenario) return null

    const postPurchaseSurplus = getSafeNumber(topSuggestedScenario.estimatedPostPurchaseSurplus)
    const actualHouseholdMonthlySurplus = getSafeNumber(
      borrowingAnalysis?.actual_monthly_surplus
    )
    const afterTaxMonthlyImpact = getSafeNumber(
      recommendedScenarioSafeTaxView?.afterTaxMonthlyImpact
    )

    if (
      postPurchaseSurplus === null ||
      actualHouseholdMonthlySurplus === null ||
      afterTaxMonthlyImpact === null
    ) {
      return postPurchaseSurplus
    }

    return actualHouseholdMonthlySurplus + afterTaxMonthlyImpact
  }, [
    borrowingAnalysis?.actual_monthly_surplus,
    hasExecutableScenario,
    recommendedScenarioSafeTaxView?.afterTaxMonthlyImpact,
    topSuggestedScenario,
  ])
  const suggestedPathTitle = hasExecutableScenario
    ? 'Scenario A: Single investment property acquisition'
    : 'No acquisition scenario is currently executable'
  const suggestedPathDescription = hasExecutableScenario
    ? 'Calculated from your selected assumptions as the leading feasible scenario under the current model.'
    : null
  const suggestedPathSupportText = hasExecutableScenario
    ? 'This scenario fits within the current capital and borrowing assumptions.'
    : null
  const suggestedPathStatus = hasExecutableScenario ? 'Feasible under current assumptions' : 'No live acquisition path'
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
  const marketEntryFloor = Number(scenarioModel.viability?.realisticMarketEntryMin || 0)
  const blockedBorrowingGap = Math.max(0, marketEntryFloor - Number(centralBorrowingCapacity || 0))
  const bestBlockedPurchasePrice = getSafeNumber(
    bestBlockedStrategy?.fallbackPrice ?? bestBlockedStrategy?.scenarioPurchasePrice
  )
  const bestBlockedRangeLabel =
    bestBlockedPurchasePrice != null
      ? bestBlockedStrategy?.recommendedPurchaseRange?.label ||
        `${formatCurrency(Math.round(bestBlockedPurchasePrice * 0.95))} - ${formatCurrency(
          Math.round(bestBlockedPurchasePrice * 1.1)
        )}`
      : null
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
    ? 'No acquisition scenario is currently executable'
    : isCapitalConstraint
    ? 'Capital, not borrowing power, is the current constraint'
    : isBorrowingConstraint
      ? 'Borrowing power, not capital, is the current constraint'
      : 'No primary constraint identified'
  const limitingFactorSummary = !hasExecutableScenario
    ? scenarioModel.viability?.message ||
      'Current capital, borrowing power, and realistic market-entry assumptions do not yet support a fundable acquisition path.'
    : isCapitalConstraint
    ? 'You appear to have enough borrowing capacity to support the next move, but execution is still limited by available upfront capital.'
    : isBorrowingConstraint
      ? 'Available capital is sufficient, but borrowing capacity does not fully support the loan required for the recommended acquisition.'
      : 'Current available capital and borrowing capacity support this scenario under selected assumptions.'
  const limitingFactorActionLine = !hasExecutableScenario
    ? limitingFactor === 'borrowing'
      ? 'Improving serviceability or reducing purchase size is the fastest way to unlock execution.'
      : 'Closing the capital gap is the fastest way to unlock a realistic acquisition path.'
    : isCapitalConstraint
    ? 'Closing the capital gap is the fastest way to unlock the recommended path.'
    : isBorrowingConstraint
      ? 'Improving serviceability or reducing purchase size is the fastest way to unlock execution.'
      : 'This scenario appears feasible under current inputs and remains subject to lender assessment, valuation, tax outcomes, and market conditions.'
  const assessmentRateValue = Number(
    borrowingAnalysis?.assumptions?.assessment_rate_pct ??
      borrowingAnalysis?.assumptions_detail?.assessment_rate_pct ??
      8.5
  )
  const borrowingSensitivityData = useMemo(() => {
    if (!isDeferredAnalysisReady) return []

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
    transactions,
  ])
  const borrowingSensitivityInsight = useMemo(() => {
    if (borrowingSensitivityData.length < 2) return null

    const lowRateCapacity = Number(borrowingSensitivityData[0]?.borrowingCapacity || 0)
    const highRateCapacity = Number(
      borrowingSensitivityData[borrowingSensitivityData.length - 1]?.borrowingCapacity || 0
    )

    return `Modelled capacity decreases by ~${formatCurrency(
      Math.max(0, lowRateCapacity - highRateCapacity)
    )} across the tested rate range.`
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
    transactions,
  ])
  const stressTestInsight = useMemo(() => {
    if (!stressTestData.length) return null

    const firstNegativePoint = stressTestData.find((point) => Number(point.monthlySurplus) < 0)
    return firstNegativePoint
      ? `Portfolio turns negative above ${firstNegativePoint.rateLabel} rates.`
      : 'Monthly surplus remains positive, though borrowing capacity is constrained by lender buffers.'
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
    if (!Number.isFinite(centralBorrowingCapacity) || centralBorrowingCapacity <= 0) return []

    const totalDeployableCapital = Number(scenarioModel.inputs?.totalDeployableCapital || 0)
    if (totalDeployableCapital <= 0) return []

    const acquisitionCostRate =
      Number(
        scenarioModel.assumptions?.acquisitionCostRate ??
          (Number(recommendedScenario?.estimatedAcquisitionCosts || 0) /
            Math.max(Number(recommendedScenario?.scenarioPurchasePrice || 1), 1))
      ) || 0.05
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
    selectedDepositStrategy.depositRatio,
  ])
  // ── Portfolio-level fallback chart data (no acquisition scenario required) ──

  // Chart 1 fallback: borrowing capacity across fixed assessment rates 5.5–9.0%
  const portfolioFallbackBorrowingData = useMemo(() => {
    if (!isDeferredAnalysisReady) return []
    const rates = [5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0]
    return rates.map((rate) => {
      const result = calculateBorrowingPower({
        financialProfile,
        liabilities,
        loans,
        transactions,
        config: { assessmentRatePct: rate },
      })
      return {
        rateLabel: `${rate.toFixed(1)}%`,
        borrowingCapacity: Number(result?.borrowing_power_estimate || 0),
        confidenceScore: Number(result?.confidence_score ?? 100),
        currentAssessmentMarker:
          Math.abs(rate - assessmentRateValue) < 0.001
            ? Number(result?.borrowing_power_estimate || 0)
            : null,
      }
    })
  }, [assessmentRateValue, financialProfile, isDeferredAnalysisReady, liabilities, loans, transactions])

  // Chart 2 fallback: serviceability surplus across fixed assessment rates 5.5–9.0%
  const portfolioFallbackSurplusData = useMemo(() => {
    if (!isDeferredAnalysisReady) return []
    const rates = [5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0]
    return rates.map((rate) => {
      const result = calculateBorrowingPower({
        financialProfile,
        liabilities,
        loans,
        transactions,
        config: { assessmentRatePct: rate },
      })
      const monthlySurplus = Number(result?.net_monthly_surplus || 0)
      const confidenceScore = Number(result?.confidence_score ?? 100)
      return {
        rateLabel: `${rate.toFixed(1)}%`,
        monthlySurplus,
        confidenceScore,
        currentAssessmentMarker:
          Math.abs(rate - assessmentRateValue) < 0.001 ? monthlySurplus : null,
      }
    })
  }, [assessmentRateValue, financialProfile, isDeferredAnalysisReady, liabilities, loans, transactions])

  // Chart 3 fallback: purchase power across deposit % 10–30% in 2% steps
  // Uses total deployable capital from the current scenario model.
  const portfolioFallbackDepositData = useMemo(() => {
    if (!isDeferredAnalysisReady) return []
    if (!Number.isFinite(centralBorrowingCapacity) || centralBorrowingCapacity <= 0) return []
    const deployable = Number(scenarioModel.inputs?.totalDeployableCapital || 0)
    if (deployable <= 0) return []
    const ACQ_COST_RATE = 0.05
    const selectedDepositPct = Math.round(selectedDepositStrategy.depositRatio * 100)
    const depositLevels = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]
    return depositLevels.map((depositPct) => {
      const depositRatio = depositPct / 100
      const depositBasedPrice =
        depositRatio + ACQ_COST_RATE > 0
          ? deployable / (depositRatio + ACQ_COST_RATE)
          : 0
      const maxPurchasePrice = Math.max(0, Math.min(depositBasedPrice, centralBorrowingCapacity))
      return {
        depositLabel: `${depositPct}%`,
        maxPurchasePrice: Math.round(maxPurchasePrice),
        currentSelectionMarker: depositPct === selectedDepositPct ? Math.round(maxPurchasePrice) : null,
      }
    })
  }, [
    centralBorrowingCapacity,
    isDeferredAnalysisReady,
    scenarioModel.inputs?.totalDeployableCapital,
    selectedDepositStrategy.depositRatio,
  ])

  // ── End portfolio-level fallback chart data ──────────────────────────────

  const activeBorrowingSensitivityData = hasRecommendedScenario
    ? borrowingSensitivityData
    : portfolioFallbackBorrowingData
  const activeBorrowingSensitivityInsight = useMemo(() => {
    if (activeBorrowingSensitivityData.length < 2) return null

    const lowRateCapacity = Number(activeBorrowingSensitivityData[0]?.borrowingCapacity || 0)
    const highRateCapacity = Number(
      activeBorrowingSensitivityData[activeBorrowingSensitivityData.length - 1]?.borrowingCapacity || 0
    )

    return `Modelled capacity decreases by ~${formatCurrency(
      Math.max(0, lowRateCapacity - highRateCapacity)
    )} across the tested rate range.`
  }, [activeBorrowingSensitivityData])
  const activeBorrowingSensitivityConfidence = useMemo(() => {
    if (!activeBorrowingSensitivityData.length) return null

    const score = Math.min(
      ...activeBorrowingSensitivityData.map((point) => Number(point.confidenceScore ?? 100))
    )

    return {
      score,
      label: getConfidenceLabel(score),
    }
  }, [activeBorrowingSensitivityData])
  const activeStressTestData = hasRecommendedScenario ? stressTestData : portfolioFallbackSurplusData
  const activeStressTestInsight = useMemo(() => {
    if (!activeStressTestData.length) return null

    const firstNegativePoint = activeStressTestData.find((point) => Number(point.monthlySurplus) < 0)
    return firstNegativePoint
      ? `Portfolio turns negative above ${firstNegativePoint.rateLabel} rates.`
      : 'Monthly surplus remains positive, though borrowing capacity is constrained by lender buffers.'
  }, [activeStressTestData])
  const activeStressTestConfidence = useMemo(() => {
    if (!activeStressTestData.length) return null

    const score = Math.min(
      ...activeStressTestData.map((point) => Number(point.confidenceScore ?? 100))
    )

    return {
      score,
      label: getConfidenceLabel(score),
    }
  }, [activeStressTestData])
  const activeDepositPurchasePowerData = hasRecommendedScenario
    ? depositPurchasePowerData
    : portfolioFallbackDepositData

  const equityCashFlowTradeOffData = useMemo(() => {
    if (!isDeferredAnalysisReady || !projectionStudioModel) return []

    const growthMultiplier = 1 + selectedGrowthRate / 100
    const wealthChartUsesAcquisitionScenario =
      hasExecutableScenario && acquisitionTrajectoryData.length > 0 && recommendedScenario

    const selectedYears = wealthChartUsesAcquisitionScenario
      ? Array.from(
          new Set(
            [
              0,
              ...recommendedScenario.projectionData
                .map((point) => Number(point?.year || 0))
                .filter((year) => year >= 0 && year <= selectedProjectionYears),
              selectedProjectionYears,
            ].sort((a, b) => a - b)
          )
        )
      : [0, projectionStudioModel.midpointYears, projectionStudioModel.endYears]

    const buildBasePropertyValue = (year) =>
      Math.round(currentPortfolioPropertyValue * Math.pow(growthMultiplier, year))
    const buildBaseLoanBalance = (year) =>
      loans.reduce((sum, loan) => sum + projectLoanBalanceAtYear(loan, year), 0)

    if (!wealthChartUsesAcquisitionScenario) {
      return selectedYears.map((year) => ({
        year,
        label: `${year}`,
        propertyValue: buildBasePropertyValue(year),
        loanBalance: buildBaseLoanBalance(year),
        netEquity: buildBasePropertyValue(year) - buildBaseLoanBalance(year),
      }))
    }

    const scenarioProjectionPoints = recommendedScenario.projectionData
      .map((point) => ({
        year: Number(point?.year || 0),
        propertyValue: Number(point?.propertyValue ?? 0),
        loanBalance: Number(point?.loanBalance ?? 0),
        netEquity: Number(point?.netEquity ?? point?.equity ?? 0),
      }))
      .filter((point) => Number.isFinite(point.year))
      .sort((a, b) => a.year - b.year)

    const interpolateScenarioPoint = (targetYear) => {
      if (!scenarioProjectionPoints.length) {
        return { propertyValue: 0, loanBalance: 0, netEquity: 0 }
      }

      const exactPoint = scenarioProjectionPoints.find((point) => point.year === targetYear)
      if (exactPoint) return exactPoint

      const previousPoints = scenarioProjectionPoints.filter((point) => point.year < targetYear)
      const nextPoint = scenarioProjectionPoints.find((point) => point.year > targetYear)
      const previousPoint = previousPoints[previousPoints.length - 1] || null

      if (previousPoint && nextPoint) {
        const span = nextPoint.year - previousPoint.year || 1
        const progress = (targetYear - previousPoint.year) / span
        return {
          year: targetYear,
          propertyValue: Math.round(
            previousPoint.propertyValue +
              (nextPoint.propertyValue - previousPoint.propertyValue) * progress
          ),
          loanBalance: Math.round(
            previousPoint.loanBalance +
              (nextPoint.loanBalance - previousPoint.loanBalance) * progress
          ),
          netEquity: Math.round(
            previousPoint.netEquity + (nextPoint.netEquity - previousPoint.netEquity) * progress
          ),
        }
      }

      const lastPoint = scenarioProjectionPoints[scenarioProjectionPoints.length - 1]
      return {
        year: targetYear,
        propertyValue: Number(lastPoint?.propertyValue ?? 0),
        loanBalance: Number(lastPoint?.loanBalance ?? 0),
        netEquity: Number(lastPoint?.netEquity ?? 0),
      }
    }

    return selectedYears.map((year) => {
      const basePropertyValue = buildBasePropertyValue(year)
      const baseLoanBalance = buildBaseLoanBalance(year)
      const scenarioPoint = interpolateScenarioPoint(year)
      const totalPropertyValue = basePropertyValue + Number(scenarioPoint.propertyValue || 0)
      const totalLoanBalance = baseLoanBalance + Number(scenarioPoint.loanBalance || 0)

      return {
        year,
        label: `${year}`,
        propertyValue: Math.round(totalPropertyValue),
        loanBalance: Math.round(totalLoanBalance),
        netEquity: Math.round(totalPropertyValue - totalLoanBalance),
      }
    })
  }, [
    acquisitionTrajectoryData,
    currentPortfolioLoanBalance,
    currentPortfolioPropertyValue,
    hasExecutableScenario,
    isDeferredAnalysisReady,
    loans,
    projectionStudioModel,
    recommendedScenario,
    selectedGrowthRate,
    selectedProjectionYears,
  ])
  const hasLoanBalanceSeries = useMemo(
    () =>
      equityCashFlowTradeOffData.some(
        (point) => Number.isFinite(point?.loanBalance) && Number(point.loanBalance) > 0
      ),
    [equityCashFlowTradeOffData]
  )
  const equityCashFlowTradeOffChart = equityCashFlowTradeOffData.length > 0 ? (
    <AnalysisChartCard
      title="How value, debt, and equity change over time"
      subtitle="Property value may trend upward, debt may amortise lower, and net equity may expand as the spread between them changes over time. Loan balance reflects your recorded loan structures. Principal & Interest loans amortise over time, while Interest Only balances remain flat until principal repayments begin."
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
      preface="Use this to observe how indicative purchase capacity changes as lender assessment settings move higher."
      insight={activeBorrowingSensitivityInsight}
      confidenceLabel={activeBorrowingSensitivityConfidence?.label}
      traceability="Inputs used: recorded income, liabilities, mortgages, and lender assessment rate · Assumptions: buffered serviceability at 8.5%"
      note={
        hasRecommendedScenario
          ? 'Borrowing capacity estimates may differ from lender assessments.'
          : 'Based on your current portfolio position without any new acquisition.'
      }
    >
      <AnalysisChartCard
        title="Borrowing capacity under different rate settings"
        subtitle="Shows how much acquisition headroom remains before the current scenario becomes materially constrained."
        xLabel="Interest rate (%)"
        yLabel="Borrowing capacity ($)"
        tooltipContextLabel="Interest rate"
        tooltipContextFormatter={(datum) => datum?.rateLabel || ''}
        yAxisInlineLabel
        lineColor="#0F172A"
        accentColor="#C2410C"
        points={activeBorrowingSensitivityData.map((point) => ({
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
      preface="Use this panel to see how higher assessment rates affect monthly resilience."
      insight={activeStressTestInsight}
      confidenceLabel={activeStressTestConfidence?.label}
      traceability="Inputs used: recorded income, liabilities, mortgages, and serviceability surplus · Assumptions: lender assessment rates from 5.5% to 8.5%"
      note={
        hasRecommendedScenario
          ? null
          : 'Based on your current portfolio position without any new acquisition.'
      }
    >
      <AnalysisChartCard
        title="Serviceability surplus under stress"
        subtitle="Shows where monthly surplus tightens and when the funding profile becomes more constrained."
        xLabel="Interest rate (%)"
        yLabel="Monthly surplus ($)"
        tooltipContextLabel="Assessment rate"
        tooltipContextFormatter={(datum) => datum?.rateLabel || ''}
        yAxisInlineLabel
        lineColor="#0F172A"
        accentColor="#C2410C"
        points={activeStressTestData.map((point) => ({
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
      preface="Use this view to test how changing deposit structure affects indicative price range."
      insight="Higher deposit settings increase indicative purchase capacity, but the curve flattens once borrowing becomes the main constraint."
      traceability="Inputs used: deployable capital and central borrowing capacity · Assumptions: 20% selected deposit strategy and 5.0% acquisition costs"
      note={
        hasRecommendedScenario
          ? null
          : 'Based on your current portfolio position without any new acquisition.'
      }
    >
      <AnalysisChartCard
        title="Deposit setting vs indicative purchase capacity"
        subtitle="Shows whether lower upfront capital expands indicative range or shifts the constraint toward borrowing."
        xLabel="Deposit (%)"
        yLabel="Purchase power ($)"
        tooltipContextLabel="Deposit strategy"
        tooltipContextFormatter={(datum) => datum?.depositLabel || ''}
        yAxisInlineLabel
        lineColor="#0F172A"
        accentColor="#2563EB"
        fill
        points={activeDepositPurchasePowerData.map((point) => ({
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
    <div className="min-h-screen bg-[var(--color-background-tertiary)]">
      <main className="mx-auto max-w-[1680px] px-6 py-6">
        <section className="rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] px-[26px] py-[22px] shadow-[0_6px_20px_rgba(15,23,42,0.03)] md:px-[26px] md:py-[22px]">
          <div className="max-w-[900px]">
            <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
              Growth Scenarios
            </p>

            <h1 className="mt-3 text-[28px] font-medium tracking-[-0.3px] text-[var(--color-text-primary)]">
              Portfolio Growth Scenarios
            </h1>

            <p className="mt-4 max-w-[760px] text-[13px] font-normal leading-[1.6] text-[var(--color-text-secondary)]">
              Stress-test acquisition scenarios using your live portfolio inputs, compare feasible and constrained outcomes, and inspect funding, carry, and wealth effects under different assumptions.
            </p>
          </div>
        </section>

        {hasExecutableScenario ? (
          <section className="z-30 mt-[22px]">
            <div className="rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-white/95 px-[22px] py-[18px] shadow-[0_18px_40px_-28px_rgba(15,23,42,0.12)] backdrop-blur md:px-[22px] md:py-[18px]">
              <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[1.25fr_1.2fr_0.95fr]">
                <div className="min-w-0 h-full rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-slate-50/70 px-[22px] py-[18px]">
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

                <div className="min-w-0 h-full rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-slate-50/70 px-[22px] py-[18px]">
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
                              ? 'border-[#b8e8d8] bg-[#E1F5EE] text-[#085041]'
                              : 'border-slate-200/75 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {rate.toFixed(1)}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="min-w-0 h-full rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-slate-50/70 px-[22px] py-[18px]">
                  <div className="flex h-full flex-col justify-between">
                    <div>
                      <p className={microLabelClass}>Ownership</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleOwnershipStructureChange('individual')}
                          className={`rounded-[0.95rem] border px-3 py-2 text-sm font-medium transition-colors ${
                            ownershipStructure !== 'joint'
                              ? 'border-[#b8e8d8] bg-[#E1F5EE] text-[#085041]'
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
                              ? 'border-[#b8e8d8] bg-[#E1F5EE] text-[#085041]'
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
                Adjust assumptions to test the current acquisition scenario
              </p>
            </div>
          </section>
        ) : null}

        {hasExecutableScenario ? (
          <section className="mt-4 rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-white px-[22px] py-[18px] shadow-[0_20px_50px_-40px_rgba(15,23,42,0.12)] md:px-[22px] md:py-[18px]">
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
            <div className="mt-6 rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-slate-50/60 px-[22px] py-[18px] md:px-[22px] md:py-[18px]">
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.85fr_1.15fr]">
                <article className="rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-white px-[22px] py-[18px] shadow-[0_18px_45px_-40px_rgba(15,23,42,0.18)] md:px-[22px] md:py-[18px]">
                  <p className={microLabelClass}>Deposit posture</p>
                  <p className="mt-4 text-[1.05rem] font-semibold text-slate-950">
                    {derivedDepositStrategyLabel}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    Driven directly by the deposit slider above so capital structure stays controlled in one place.
                  </p>
                </article>

                <article className="rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-white px-[22px] py-[18px] shadow-[0_18px_45px_-40px_rgba(15,23,42,0.18)] md:px-[22px] md:py-[18px]">
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
                          <p className="text-sm text-[#A32D2D]">{ownershipSplitInlineError}</p>
                        ) : null}
                        {showJointOwnershipIncomeWarning ? (
                          <p className="text-sm text-[#854F0B]">
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
        ) : null}

        {/* ── Portfolio Wealth Trajectory ─────────────────────────────── */}
        <section className="mt-[22px] rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] px-[26px] py-[22px] shadow-[0_10px_24px_rgba(15,23,42,0.04)] md:px-[26px] md:py-[22px]">
          {currentPortfolioNetEquity <= 0 ? (
            <div className="rounded-[14px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-secondary)] px-[18px] py-[16px]">
              <p className="text-[15px] font-medium text-[var(--color-text-primary)]">
                Projection Studio becomes available once your portfolio returns to positive net equity.
              </p>
              <p className="mt-2 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
                This view will unlock when your current portfolio position moves back above zero, so the projection starts from a real positive balance-sheet base.
              </p>
            </div>
          ) : (
            <>
              <div>
                <p className={microLabelClass}>PROJECTION STUDIO</p>
                <h2 className="mt-2 text-[15px] font-medium text-[var(--color-text-primary)]">
                  Model your portfolio wealth trajectory
                </h2>
                <p className="mt-2 max-w-[64ch] text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
                  Test how your portfolio may grow over time under different growth assumptions and time horizons.
                </p>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-secondary)] px-[22px] py-[18px]">
                  <p className={microLabelClass}>Growth assumptions</p>
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedGrowthRate(6)}
                      className={`inline-flex items-center rounded-full border px-4 py-2 text-[13px] font-medium ${
                        selectedGrowthRate === 6
                          ? 'border-[#b8e8d8] bg-[#E1F5EE] text-[#085041]'
                          : 'border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] text-[var(--color-text-primary)]'
                      }`}
                    >
                      Base case &middot; 6%
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedGrowthRate(8)}
                      className={`inline-flex items-center rounded-full border px-4 py-2 text-[13px] font-medium ${
                        selectedGrowthRate === 8
                          ? 'border-[#b8e8d8] bg-[#E1F5EE] text-[#085041]'
                          : 'border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] text-[var(--color-text-primary)]'
                      }`}
                    >
                      Medium growth &middot; 8%
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedGrowthRate(10)}
                      className={`inline-flex items-center rounded-full border px-4 py-2 text-[13px] font-medium ${
                        selectedGrowthRate === 10
                          ? 'border-[#b8e8d8] bg-[#E1F5EE] text-[#085041]'
                          : 'border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] text-[var(--color-text-primary)]'
                      }`}
                    >
                      Aggressive &middot; 10%
                    </button>
                  </div>
                </div>

                <div className="rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-secondary)] px-[22px] py-[18px]">
                  <p className={microLabelClass}>Projection horizon</p>
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedProjectionYears(10)}
                      className={`inline-flex items-center rounded-full border px-4 py-2 text-[13px] font-medium ${
                        selectedProjectionYears === 10
                          ? 'border-[#b8e8d8] bg-[#E1F5EE] text-[#085041]'
                          : 'border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] text-[var(--color-text-primary)]'
                      }`}
                    >
                      10Y
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedProjectionYears(20)}
                      className={`inline-flex items-center rounded-full border px-4 py-2 text-[13px] font-medium ${
                        selectedProjectionYears === 20
                          ? 'border-[#b8e8d8] bg-[#E1F5EE] text-[#085041]'
                          : 'border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] text-[var(--color-text-primary)]'
                      }`}
                    >
                      20Y
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedProjectionYears(30)}
                      className={`inline-flex items-center rounded-full border px-4 py-2 text-[13px] font-medium ${
                        selectedProjectionYears === 30
                          ? 'border-[#b8e8d8] bg-[#E1F5EE] text-[#085041]'
                          : 'border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] text-[var(--color-text-primary)]'
                      }`}
                    >
                      30Y
                    </button>
                  </div>
                </div>
              </div>

              <style>{`
                @keyframes projectionStudioEndDotPulse {
                  0% { transform: scale(1); }
                  50% { transform: scale(1.22); }
                  100% { transform: scale(1); }
                }
              `}</style>
              <div className="mt-5">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50/90 px-3.5 py-1.5 text-sm font-medium text-emerald-800">
                    +{formatCompactAmount(
                      projectionStudioChart.comparisonActive
                        ? acquisitionGrowthDelta
                        : baseGrowthDelta
                    )}{' '}
                    {projectionStudioChart.comparisonActive ? 'projected portfolio value with acquisition' : 'projected portfolio growth'} over {selectedProjectionYears} years
                  </span>
                  {projectionStudioChart.comparisonActive ? (
                    <span className="inline-flex rounded-full border border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] px-3.5 py-1.5 text-sm font-medium text-[var(--color-text-secondary)]">
                      +{formatCompactAmount(baseGrowthDelta)} projected base portfolio over {selectedProjectionYears} years
                    </span>
                  ) : null}
                </div>

                <div className="overflow-hidden rounded-[14px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-secondary)] px-[12px] py-[12px]">
                  <div className="w-full">
                    <div className="mb-2 flex flex-wrap items-center gap-4 text-[12px] text-[var(--color-text-secondary)]">
                      {projectionStudioChart.legend.map((item) => (
                        <span key={item.label} className="inline-flex items-center gap-2.5">
                          <span
                            className={`inline-block w-10 rounded-full ${
                              item.tone === 'acquisition' ? 'bg-[#0F6E56]' : ''
                            }`}
                            style={
                              item.tone === 'acquisition'
                                ? { height: 4 }
                                : {
                                    height: 0,
                                    borderTop: '1.5px dashed #c4cbc7',
                                    width: 40,
                                  }
                            }
                          />
                          <span>{item.label}</span>
                        </span>
                      ))}
                    </div>

                    <svg
                      viewBox={`0 0 ${projectionStudioChart.width} ${projectionStudioChart.height}`}
                      className="w-full"
                      style={{ height: 362 }}
                      role="img"
                      aria-label="Portfolio projection chart"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="projectionStudioStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#0f766e" />
                          <stop offset="55%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#34d399" />
                        </linearGradient>
                        <linearGradient id="projectionStudioFill" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="rgba(16,185,129,0.1)" />
                          <stop offset="100%" stopColor="rgba(16,185,129,0.015)" />
                        </linearGradient>
                      </defs>

                      {[0.2, 0.55, 0.9].map((guide) => {
                        const y = 10 + (projectionStudioChart.height - 20) * guide
                        return (
                          <line
                            key={`guide-${guide}`}
                            x1="72"
                            x2="662"
                            y1={y}
                            y2={y}
                            stroke="rgba(15, 23, 42, 0.05)"
                            strokeWidth="1"
                            strokeDasharray="3 8"
                          />
                        )
                      })}

                      {projectionStudioChart.comparisonActive ? (
                        <path
                          d={projectionStudioChart.baseLinePath}
                          fill="none"
                          stroke="#cdd4d0"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeDasharray="5 7"
                        />
                      ) : null}
                      {projectionStudioChart.primaryFillPath ? (
                        <path
                          ref={projectionFillRef}
                          d={projectionStudioChart.primaryFillPath}
                          fill="url(#projectionStudioFill)"
                          style={{ opacity: 0 }}
                        />
                      ) : null}
                      <path
                        ref={projectionStrokeRef}
                        d={projectionStudioChart.primaryLinePath}
                        fill="none"
                        stroke="url(#projectionStudioStroke)"
                        strokeWidth="4.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
                      />

                      {projectionStudioChart.comparisonActive
                        ? projectionStudioChart.baseMilestones.map((point, index) => (
                            <circle
                              key={`base-${point.label}-${index}`}
                              cx={point.x}
                              cy={point.y}
                              r={index === projectionStudioChart.baseMilestones.length - 1 ? 4 : 3}
                              fill="var(--color-background-primary)"
                              stroke="#bcc4bf"
                              strokeWidth="1.5"
                            />
                          ))
                        : null}

                      {projectionStudioChart.primaryPoints.map((point, index) => {
                        const isLast = index === projectionStudioChart.primaryPoints.length - 1
                        const radius = isLast ? 7.5 : 4.5
                        return (
                          <g key={`${point.label || 'primary'}-${index}`}>
                            {isLast ? (
                              <circle cx={point.x} cy={point.y} r="10" fill="rgba(16,185,129,0.12)" />
                            ) : null}
                            <circle
                              ref={isLast ? projectionEndDotRef : null}
                              cx={point.x}
                              cy={point.y}
                              r={radius}
                              fill={isLast ? '#059669' : '#10b981'}
                              stroke="rgba(255,255,255,0.92)"
                              strokeWidth={isLast ? '2.5' : '2'}
                              style={isLast ? { transformOrigin: `${point.x}px ${point.y}px`, animation: 'none' } : undefined}
                            />
                          </g>
                        )
                      })}
                    </svg>

                    <div className="relative mt-3 h-[62px]">
                      {projectionStudioChart.baseMilestones.map((item, index) => {
                        const acquisitionValue = projectionStudioChart.acquisitionMilestones[index]?.value ?? null
                        const primaryValue = acquisitionValue ?? item.value
                        return (
                          <div
                            key={item.label}
                            className="absolute top-0 w-[96px] -translate-x-1/2 text-center"
                            style={{ left: `${(item.x / projectionStudioChart.width) * 100}%` }}
                          >
                            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                              {item.label}
                            </p>
                            <p className="mt-1 text-[13px] font-semibold tracking-tight text-[var(--color-text-primary)]">
                              {formatCompactAmount(primaryValue)}
                            </p>
                            {acquisitionValue !== null ? (
                              <p className="mt-1 text-[11px] leading-[1.35] text-[var(--color-text-tertiary)]">
                                Base {formatCompactAmount(item.value)}
                              </p>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {projectionStudioGapBreakdown ? (
                  <div className="mt-3 rounded-[14px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] px-[16px] py-[14px]">
                    <p className="text-[11px] leading-[1.5] text-[var(--color-text-tertiary)]">
                      The gap between the two paths reflects the acquired property's net equity contribution at the selected horizon, not its full gross value.
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                      {[
                        {
                          label: 'Base portfolio terminal net equity',
                          value: formatCompactAmount(
                            projectionStudioGapBreakdown.basePortfolioTerminalNetEquity
                          ),
                        },
                        {
                          label: 'Added property terminal value',
                          value: formatCompactAmount(
                            projectionStudioGapBreakdown.addedPropertyTerminalValue
                          ),
                        },
                        {
                          label: 'Acquisition loan balance',
                          value: formatCompactAmount(
                            projectionStudioGapBreakdown.acquisitionLoanBalance
                          ),
                        },
                        {
                          label: 'Net additional equity from acquisition',
                          value: formatCompactAmount(
                            projectionStudioGapBreakdown.addedNetEquity
                          ),
                        },
                        {
                          label: 'Total portfolio net equity with acquisition',
                          value: formatCompactAmount(
                            projectionStudioGapBreakdown.totalPortfolioTerminalNetEquity
                          ),
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.06)] bg-[var(--color-background-secondary)] px-[14px] py-[12px]"
                        >
                          <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
                            {item.label}
                          </p>
                          <p className="mt-2 text-[15px] font-medium tracking-tight text-[var(--color-text-primary)]">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-5">
                  <p className="text-[11px] leading-[1.5] text-[var(--color-text-tertiary)]">
                    Estimated outputs based on your selected assumptions.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      {
                        label: 'Projected portfolio value',
                        value: formatCompactAmount(
                          projectionStudioChart?.comparisonActive
                            ? acquisitionEndValue
                            : baseEndValue
                        ),
                      },
                      {
                        label: 'Total growth',
                        value: formatCompactAmount(
                          projectionStudioChart?.comparisonActive
                            ? acquisitionGrowthDelta
                            : baseGrowthDelta
                        ),
                      },
                      {
                        label: 'CAGR',
                        value: `${selectedGrowthRate}%`,
                      },
                      {
                        label: 'Projection horizon',
                        value: `${selectedProjectionYears} years`,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-[14px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] px-[18px] py-[16px]"
                      >
                        <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
                          {item.label}
                        </p>
                        <p className="mt-2 text-[20px] font-medium tracking-[-0.02em] text-[var(--color-text-primary)]">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
        <section className="mt-[22px] rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] px-[22px] py-[22px] shadow-[0_10px_24px_rgba(15,23,42,0.04)] md:px-[26px] md:py-[22px]">
          <div className="mb-5 md:mb-6">
            <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
              Scenario comparison
            </p>
            <h2 className="mt-2 text-[15px] font-medium text-[var(--color-text-primary)]">
              Compare acquisition scenarios
            </h2>
            <p className="mt-2.5 max-w-[68ch] text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
              Review scenario outcomes side by side, including illustrative equity,
              acquisition size, yield, and funding constraints.
            </p>
          </div>

          {!hasExecutableScenario ? (
            <div
              className={`mt-0 transition-opacity duration-200 ${
                isScenarioRefreshing ? 'opacity-60' : 'opacity-100'
              }`}
            >
              <div className="rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] px-6 py-6 shadow-[0_10px_24px_rgba(15,23,42,0.04)] md:px-7">
                <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
                  ACQUISITION READINESS
                </p>
                <h3 className="mt-2 text-[15px] font-medium text-[var(--color-text-primary)]">
                  Building toward your next move
                </h3>
                <p className="mt-2.5 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
                  Here is exactly what changes when you take the top actions.
                </p>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <ScenarioMetric
                    label="Borrowing Power"
                    value={formatCurrency(Number(centralBorrowingCapacity || 0))}
                  />
                  <ScenarioMetric
                    label="Deployable Capital"
                    value={formatCurrency(Number(scenarioModel.inputs?.totalDeployableCapital || 0))}
                  />
                  <ScenarioMetric
                    label="Market Entry Floor"
                    value={formatCurrency(marketEntryFloor)}
                  />
                </div>

                <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                  <div className="rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] px-5 py-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                    <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
                      Primary constraint
                    </p>
                    <h4 className="mt-3 text-[15px] font-medium text-[var(--color-text-primary)]">
                      Primary constraint: Borrowing capacity
                    </h4>
                    <div className="mt-4 space-y-0">
                      <BreakdownRow
                        label="Current"
                        value={formatCurrency(Number(centralBorrowingCapacity || 0))}
                      />
                      <BreakdownRow
                        label="Market floor"
                        value={formatCurrency(marketEntryFloor)}
                      />
                      <BreakdownRow
                        label="Gap to close"
                        value={formatCurrency(blockedBorrowingGap)}
                        strong
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    {dashboardTopActionSummaries.map((action, index) => (
                      <div
                        key={action.id}
                        className="rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-secondary)] px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
                        style={{
                          borderLeftWidth: 3,
                          borderLeftColor: index === 0 ? '#1D9E75' : '#EF9F27',
                        }}
                      >
                        <p className="text-[15px] font-medium text-[var(--color-text-primary)]">
                          {action.title}
                        </p>
                        <p className="mt-2 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
                          Benefit: {action.impact}
                        </p>
                      </div>
                    ))}
                    {dashboardTopActionSummaries.length === 0 ? (
                      <div className="rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-secondary)] px-4 py-4">
                        <p className="text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
                          Action guidance will appear here once optimisation actions are available.
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>

                {bestBlockedRangeLabel ? (
                  <div className="mt-5 rounded-[12px] bg-[#E1F5EE] px-4 py-3">
                    <p className="text-[13px] leading-[1.6] text-[var(--color-text-primary)]">
                      After taking these actions, your executable range opens to approximately{' '}
                      <span className="font-medium">{bestBlockedRangeLabel}</span>.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
          <div
            className={`mt-0 grid grid-cols-1 items-stretch gap-6 transition-opacity duration-200 xl:grid-cols-2 xl:gap-6 ${
              isScenarioRefreshing ? 'opacity-60' : 'opacity-100'
            }`}
          >
            <article className="flex h-full min-h-[520px] flex-col rounded-b-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-[2px] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)]" style={{ borderTopWidth: 3, borderTopColor: '#1D9E75' }}>
              <div className="flex h-full min-h-[520px] w-full flex-col bg-white p-6 md:p-7">
                <div>
                  <div className="flex items-center justify-between gap-6">
                    <div
                      className={`inline-flex rounded-[20px] px-[10px] py-[3px] text-[10px] font-medium ${
                        hasExecutableScenario
                          ? 'bg-[#E1F5EE] text-[#085041]'
                          : 'bg-[#FAEEDA] text-[#633806]'
                      }`}
                    >
                      {hasExecutableScenario ? 'Feasible under current assumptions' : 'Not viable'}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5 pl-4 text-right">
                      <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
                        {hasExecutableScenario ? 'Primary Scenario' : 'Current State'}
                      </p>
                      <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                        {suggestedPathStatus}
                      </p>
                    </div>
                  </div>

                    <div className="mt-8">
                    <div className="min-h-[56px] flex items-start">
                      <h2 className="overflow-hidden text-ellipsis text-[15px] font-medium text-[var(--color-text-primary)] md:whitespace-nowrap">
                        {suggestedPathTitle}
                      </h2>
                    </div>
                    <div className="min-h-[56px]">
                      {suggestedPathDescription ? (
                        <p className="mt-4 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
                          {suggestedPathDescription}
                        </p>
                      ) : null}
                      {suggestedPathSupportText ? (
                        <p className="mt-2 text-[11px] leading-[1.5] text-[var(--color-text-tertiary)]">
                          {suggestedPathSupportText}
                        </p>
                      ) : hasExecutableScenario ? null : (
                        <p className="mt-2 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
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
                      label={hasExecutableScenario ? 'After-tax surplus after acquisition' : 'Market Entry Floor'}
                      valueClassName="text-[20px] md:text-[22px]"
                      value={
                        hasExecutableScenario
                          ? `${Number(topSuggestedScenarioAfterTaxSurplus || 0) >= 0 ? '+' : '-'}${formatCurrency(
                              Math.abs(Number(topSuggestedScenarioAfterTaxSurplus || 0))
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
                        ? 'bg-[#FAEEDA] text-[#633806]'
                        : hasExecutableScenario
                          ? 'bg-[#E1F5EE] text-[#085041]'
                          : 'bg-[#FAEEDA] text-[#633806]'
                    }`}
                  >
                    <p className="text-[15px] font-medium leading-7">
                      {hasExecutableScenario
                        ? Number(topSuggestedScenario?.requiredCapitalGap || 0) > 0
                          ? `Capital shortfall: ${formatCurrency(topSuggestedScenario?.requiredCapitalGap || 0)}`
                          : 'Funding requirement covered'
                        : 'Blocked paths remain visible below only as non-executable reference scenarios.'}
                    </p>
                  </div>
                </div>
              </div>
            </article>

            <article className="flex h-full min-h-[520px] flex-col rounded-[16px] border border-dashed border-[rgba(0,0,0,0.12)] bg-[var(--color-background-primary)] opacity-85">
              <div className="flex h-full min-h-[520px] w-full flex-col bg-white p-6 md:p-7">
                <div>
                  <div className="flex items-center justify-between gap-6">
                    <div className="inline-flex rounded-[20px] bg-[#FCEBEB] px-[10px] py-[3px] text-[10px] font-medium text-[#791F1F]">
                      {String(topAlternativeScenario?.scenarioStateLabel || '').toLowerCase() === 'blocked'
                        ? 'Blocked'
                        : 'Alternative'}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5 pl-4 text-right">
                      <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
                        Secondary Scenario
                      </p>
                      <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                        {topAlternativeScenario?.blockedReason ? 'Currently constrained' : 'Inferior outcome'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-7">
                    <div className="min-h-[56px] flex items-start">
                      <h2 className="overflow-hidden text-ellipsis text-[15px] font-medium text-[var(--color-text-primary)] md:whitespace-nowrap">
                        {topAlternativeScenario?.title}
                      </h2>
                    </div>
                    <div className="min-h-[48px]">
                      <p className="mt-2 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
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
                  <div className="flex min-h-[60px] items-center rounded-[16px] bg-[#FCEBEB] px-5 py-4 ring-1 ring-[#FCEBEB]">
                    <p className="text-[15px] font-medium leading-7 text-[#791F1F]">
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
          )}
        </section>
        {hasExecutableScenario ? (
          <>
        <section className="mt-[22px]">
          <article
            className={`rounded-r-[16px] border-[0.5px] px-[18px] pt-[14px] pb-[18px] shadow-[0_10px_24px_rgba(15,23,42,0.04)] md:px-[18px] ${
              isCapitalConstraint || isBorrowingConstraint || !hasExecutableScenario
                ? 'border-[rgba(0,0,0,0.08)] bg-[#E1F5EE]'
                : 'border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)]'
            }`}
            style={{
              borderLeftWidth: 4,
              borderLeftColor:
                !hasExecutableScenario ? '#1D9E75' : isCapitalConstraint || isBorrowingConstraint ? '#A32D2D' : '#1D9E75',
            }}
          >
            <p className={microLabelClass}>Limiting Factor</p>
            <h3 className="mt-4 text-[15px] font-medium text-[var(--color-text-primary)]">
              {limitingFactorHeading}
            </h3>
            <p className="mt-3 max-w-[56rem] text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
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
                  Current borrowing capacity under the selected lending assumptions.
                </p>
              </div>

              <div className="rounded-[1.4rem] border border-white/80 bg-white/85 px-4 py-4 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.16)]">
                <p className={microLabelClass}>Capital Required</p>
                <p className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-950">
                  {formatCurrency(recommendedTotalRequiredCapital)}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Upfront capital required for the current scenario.
                </p>
              </div>

              <div className="rounded-[1.4rem] border border-white/80 bg-white/85 px-4 py-4 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.16)]">
                <p className={microLabelClass}>Capital Shortfall</p>
                <p
                  className={`mt-2 text-[1.35rem] font-semibold tracking-tight ${
                    remainingCapitalGap > 0 ? 'text-[#854F0B]' : 'text-[#0F6E56]'
                  }`}
                >
                  {remainingCapitalGap > 0 ? formatCurrency(remainingCapitalGap) : 'No shortfall'}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  The remaining funding gap under the current scenario.
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

        <section className="mt-[22px] rounded-[2.1rem] border border-slate-200/80 bg-white px-6 pt-6 pb-6 shadow-[0_28px_80px_-58px_rgba(15,23,42,0.24)] md:px-8">
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

          <div className="mt-7 grid grid-cols-2 overflow-hidden rounded-[1.5rem] border-t-[0.5px] border-t-[rgba(0,0,0,0.06)] border-slate-200/80 bg-slate-50/70 sm:grid-cols-4">
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
                {remainingCapitalGap > 0 ? 'Capital Gap' : 'Scenario Funding Status'}
              </p>
              <p
                className={`mt-2 text-[1.7rem] font-semibold tracking-tight ${
                  remainingCapitalGap > 0 ? 'text-[#854F0B]' : 'text-[#0F6E56]'
                }`}
              >
                {remainingCapitalGap > 0 ? formatCurrency(remainingCapitalGap) : 'Requirement covered'}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-[22px]">
          <div className="rounded-[2.2rem] border border-slate-200/80 bg-white px-6 pt-6 pb-6 shadow-[0_24px_70px_-54px_rgba(15,23,42,0.18)] md:px-8">
            <p className={microLabelClass}>Execution Readiness</p>
          <h3 className="mt-4 text-[22px] font-semibold tracking-tight text-slate-900 md:text-[24px]">
            Does current capital cover the scenario requirement?
          </h3>
          <p className="mt-4 max-w-[46rem] text-[1.03rem] leading-8 text-slate-600">
            Compare deployable capital with the current upfront requirement and identify the main
            funding constraint under the selected assumptions.
          </p>

            <div className="mt-8 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_auto_1fr_auto_1fr] xl:items-stretch">
              <article className="rounded-[2rem] border border-[#b8e8d8] bg-[#E1F5EE] px-7 py-8 text-center shadow-[0_20px_50px_-42px_rgba(15,23,42,0.18)] md:px-8 md:py-9">
                <p className={microLabelClass}>Available Capital</p>
                <p className="mt-4 text-[2.55rem] font-semibold tracking-tight text-[#0F6E56]">
                  {formatCurrency(recommendedAvailableCapital)}
                </p>
                <p className="mt-4 text-[1rem] leading-7 text-slate-600">
                  Capital available after liquidity buffers and reserve settings are retained.
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
                    A portion of equity is retained as a safety buffer. The remaining usable
                    equity is available under the current scenario settings.
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
                  The upfront requirement is primarily driven by deposit, stamp duty, and
                  acquisition costs under the current assumptions.
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
                  ? 'border-[#FAEEDA] bg-[#FAEEDA]'
                  : 'border-[#b8e8d8] bg-[#E1F5EE]'
              }`}>
                <p className={microLabelClass}>{remainingCapitalGap > 0 ? 'Capital Gap' : 'Surplus'}</p>
                <p
                  className={`mt-4 text-[2.55rem] font-semibold tracking-tight ${
                    remainingCapitalGap > 0 ? 'text-[#854F0B]' : 'text-[#0F6E56]'
                  }`}
                >
                  {remainingCapitalGap > 0
                    ? formatCurrency(remainingCapitalGap)
                    : formatCurrency(Math.max(recommendedAvailableCapital - recommendedTotalRequiredCapital, 0))}
                </p>
                <p className="mt-4 text-[1rem] leading-7 text-slate-600">
                  {remainingCapitalGap > 0
                    ? 'This gap must be closed before the transaction is realistically executable.'
                    : 'Current capital exceeds the scenario funding requirement.'}
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="mt-[22px] rounded-[2.25rem] border border-slate-200/80 bg-white px-6 pt-6 pb-6 shadow-[0_28px_80px_-58px_rgba(15,23,42,0.2)] md:px-8">
          <p className={microLabelClass}>Wealth Outcome</p>
          <h3 className="mt-4 text-[22px] font-semibold tracking-tight text-slate-900 md:text-[24px]">
            Estimated net outcome after capital and carry
          </h3>
          <p className="mt-4 max-w-[50rem] text-[1.03rem] leading-8 text-slate-600">
            Equity growth is only one part of the model. This view shows what remains after
            capital is committed and holding costs are applied over the selected horizon.
          </p>

          <div className="mt-8 flex flex-col gap-4 xl:flex-row xl:items-stretch xl:gap-5">
            <article className="flex-1 rounded-[1.8rem] border border-slate-200/80 bg-slate-50/70 px-6 py-6 shadow-[0_20px_50px_-42px_rgba(15,23,42,0.14)]">
              <p className={microLabelClass}>5Y Equity</p>
              <p className="mt-3 text-[2.15rem] font-semibold tracking-tight text-slate-950">
                {formatCurrency(topSuggestedScenario?.fiveYearEquityProjection || 0)}
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Estimated equity position after 5 years.
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
                Upfront capital allocated under the scenario.
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
                Estimated after-tax carry over 5 years.
              </p>
            </article>

            <div className="flex items-center justify-center text-[2rem] font-light text-slate-300 xl:px-1">
              =
            </div>

            <article
              className={`flex-1 rounded-[1.8rem] border px-6 py-6 shadow-[0_20px_50px_-42px_rgba(15,23,42,0.16)] ${
                Number(topSuggestedScenario?.economicOutcome5Y || 0) >= 0
                  ? 'border-[#b8e8d8] bg-[#E1F5EE]'
                  : 'border-[#FCEBEB] bg-[#FCEBEB]'
              }`}
            >
              <p className={microLabelClass}>Economic Outcome (5Y)</p>
              <p className="mt-3 text-[2.15rem] font-semibold tracking-tight text-slate-950">
                {formatCurrency(topSuggestedScenario?.economicOutcome5Y || 0)}
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Estimated net outcome after capital and carry.
              </p>
            </article>
          </div>
        </section>

        <section className="mt-[22px] border-b-[0.5px] border-[rgba(0,0,0,0.06)]">
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
          <section id="wealth-projection" className="rounded-b-[2rem] rounded-tr-[2rem] border border-t-0 border-slate-200/75 bg-white px-6 pt-6 pb-6 shadow-[0_22px_60px_-50px_rgba(15,23,42,0.16)] md:px-8">
            <div>
              <p className={microLabelClass}>Wealth Growth</p>
              <h3 className="mt-5 text-[22px] font-semibold tracking-tight text-slate-900 md:text-[24px]">
                How the balance sheet changes over time
              </h3>
              <p className="mt-6 max-w-[50rem] text-[1.04rem] leading-8 text-slate-600">
                Track asset growth, debt reduction, and the equity spread under the selected
                assumptions over time.
              </p>
            </div>

            <div className="mt-6">{equityCashFlowTradeOffChart}</div>
          </section>
        ) : null}

        {activeTab === 'funding' ? (
          <section className="rounded-b-[2rem] rounded-tr-[2rem] border border-t-0 border-slate-200/75 bg-white px-6 pt-6 pb-6 shadow-[0_22px_60px_-50px_rgba(15,23,42,0.16)] md:px-8">
            <p className={microLabelClass}>Funding</p>
            <h3 className="mt-5 text-[22px] font-semibold tracking-tight text-slate-900 md:text-[24px]">
              Capital required for this scenario
            </h3>
            <p className="mt-6 max-w-[48rem] text-[1.04rem] leading-8 text-slate-600">
              Compare available capital, required capital, and any remaining funding gap under the
              current scenario.
            </p>

            <div className="mt-11 rounded-[1.9rem] border border-slate-100/90 bg-slate-50/40 px-6 py-8 md:px-8 md:py-10">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_auto_1fr_auto_1fr] xl:items-center">
              <article className="rounded-[2rem] border border-[#b8e8d8] bg-[#E1F5EE] px-7 py-8 text-center md:min-h-[248px] md:px-8 md:py-9">
                <p className={microLabelClass}>Available Capital</p>
                <p className="mt-4 text-4xl font-semibold tracking-tight text-[#0F6E56]">
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
                  Capital required for deposit and acquisition costs under the selected scenario.
                </p>
              </article>

              <div className="hidden text-center text-3xl font-light text-slate-300 xl:block">
                &rarr;
              </div>

              <article className="rounded-[2rem] border border-[#FAEEDA] bg-[#FAEEDA] px-7 py-8 text-center md:min-h-[248px] md:px-8 md:py-9">
                <p className={microLabelClass}>Shortfall</p>
                <p className="mt-4 text-4xl font-semibold tracking-tight text-[#854F0B]">
                  {recommendedWealthBreakdown.remainingCapitalGap}
                </p>
                <p className="mt-5 text-base leading-8 text-slate-600">
                  Remaining funding gap after available capital is applied.
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
              Estimated monthly holding cost
            </h3>
            <p className="mt-6 max-w-[50rem] text-[1.04rem] leading-8 text-slate-600">
              Monthly carry profile showing pre-tax cash flow, tax offset, and estimated after-tax
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

                <article className="min-w-0 w-full overflow-hidden rounded-[2rem] border border-[#b8e8d8] bg-[#E1F5EE] px-7 py-8 text-center md:min-h-[285px] md:px-8 md:py-9">
                  <p className={microLabelClass}>ATO Benefit</p>
                  <p className="mt-4 whitespace-nowrap text-[28px] font-semibold leading-tight tracking-[-0.03em] text-[#0F6E56] md:text-[30px]">
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

                <article className="min-w-0 w-full overflow-hidden rounded-[2rem] border border-[#FAEEDA] bg-[#FAEEDA] px-7 py-8 text-center md:min-h-[285px] md:px-8 md:py-9">
                  <p className={microLabelClass}>Net Cost</p>
                  <p className="mt-4 whitespace-nowrap text-[28px] font-semibold leading-tight tracking-[-0.03em] text-[#854F0B] md:text-[30px]">
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
        <section className="mt-[22px] rounded-[2rem] border border-[#FAEEDA] bg-[#FAEEDA] px-6 py-6 shadow-[0_22px_60px_-50px_rgba(15,23,42,0.16)] md:px-8">
            <p className={microLabelClass}>Execution Status</p>
            <h3 className="mt-4 text-[22px] font-semibold tracking-tight text-slate-900 md:text-[24px]">
              No acquisition scenario is currently executable
            </h3>
            <p className="mt-4 max-w-[48rem] text-[1.03rem] leading-8 text-slate-600">
              Your borrowing capacity is the primary constraint right now. The actions below
              directly address this.
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

        <section className="mt-[22px] rounded-[2rem] border border-slate-200/75 bg-white px-6 pt-6 pb-6 shadow-[0_22px_60px_-50px_rgba(15,23,42,0.16)] md:px-8">
          <p className={microLabelClass}>Confidence</p>
          <p className="mt-4 text-[22px] font-semibold tracking-tight text-slate-900 md:text-[24px]">
            {getConfidenceSummary(Number(scenarioModel.confidence?.score || 0))}
          </p>
          <p className="mt-3 max-w-[38rem] text-[1rem] leading-7 text-slate-600">
            This reflects how complete and internally consistent the scenario inputs currently are.
          </p>
        </section>

        <section className="mt-[22px] rounded-[2rem] border border-slate-200/75 bg-white px-6 pt-6 pb-6 shadow-[0_22px_60px_-50px_rgba(15,23,42,0.16)] md:px-8">
          <p className={microLabelClass}>Advanced analysis</p>
          <h3 className="mt-4 text-[22px] font-semibold tracking-tight text-slate-900 md:text-[24px]">
            Test the scenario under tougher rates, tighter buffers, and different capital structures.
          </h3>

          <button
            type="button"
            onClick={() => setIsAdvancedAnalysisOpen((current) => !current)}
            className="mt-6 inline-flex items-center gap-3 rounded-full border border-slate-200/80 bg-slate-50 px-5 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            <span>{isAdvancedAnalysisOpen ? 'Close advanced analysis' : 'Open advanced analysis'}</span>
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
              <article className="rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] px-[18px] pt-[16px] pb-[16px] shadow-[0_24px_70px_-54px_rgba(15,23,42,0.16)] md:px-[18px]">
                <p className={microLabelClass}>Rate Sensitivity</p>
                <h4 className="mt-4 text-[1.7rem] font-semibold tracking-tight text-slate-950">
                  How does borrowing capacity change as rates rise?
                </h4>
                <p className="mt-3 max-w-[45rem] text-[1rem] leading-7 text-slate-600">
                  See how lender buffer changes affect purchase capacity and the range available
                  under the current scenario.
                </p>
                <div className="mt-6">{borrowingSensitivityChart}</div>
              </article>

              <article className="rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] px-[18px] pt-[16px] pb-[16px] shadow-[0_24px_70px_-54px_rgba(15,23,42,0.16)] md:px-[18px]">
                <p className={microLabelClass}>Stress Test</p>
                <h4 className="mt-4 text-[1.7rem] font-semibold tracking-tight text-slate-950">
                  When does serviceability begin to tighten?
                </h4>
                <p className="mt-3 max-w-[45rem] text-[1rem] leading-7 text-slate-600">
                  Track how monthly surplus changes under tougher lending assumptions and where
                  the funding profile begins to weaken.
                </p>
                <div className="mt-6">{stressTestChart}</div>
              </article>

              <article className="rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] px-[18px] py-[16px] shadow-[0_24px_70px_-54px_rgba(15,23,42,0.16)] md:px-[18px] md:py-[16px]">
                <p className={microLabelClass}>Purchase Power</p>
                <h4 className="mt-4 text-[1.7rem] font-semibold tracking-tight text-slate-950">
                  How does deposit structure affect indicative range?
                </h4>
                <p className="mt-3 max-w-[45rem] text-[1rem] leading-7 text-slate-600">
                  Compare deposit settings to see whether lower upfront capital expands the
                  indicative price range or shifts the constraint toward borrowing.
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


