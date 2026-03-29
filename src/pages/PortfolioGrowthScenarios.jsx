import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ChevronRight, Landmark } from 'lucide-react'

import useFinancialData from '../hooks/useFinancialData'
import usePortfolioData from '../hooks/usePortfolioData'
import calculateBorrowingPower from '../lib/borrowingPowerEngine'
import buildPortfolioGrowthScenarios, {
  calculateScenarioWealthOutcomes,
} from '../lib/portfolioGrowthScenarios'
import { calculateNegativeGearingTaxBenefit } from '../lib/negativeGearingTaxBenefit'
import { calculateAfterTaxHoldingCost } from '../lib/afterTaxHoldingCost'
import { normalizeTaxOwnership } from '../lib/taxOwnership'
import PremiumProjectionChart from '../components/charts/PremiumProjectionChart'
import PortfolioGrowthScenariosPremiumView from '../components/scenarios/PortfolioGrowthScenariosPremiumView'
import {
  getScenarioXAxisLayout,
} from '../components/charts/scenarioChartAxisConfig'
import ScenarioChartTooltip from '../components/charts/ScenarioChartTooltip'

const DEPOSIT_STRATEGY_OPTIONS = [
  { value: '20', label: '20% deposit (default)', depositRatio: 0.2 },
  { value: '10', label: '10% deposit + LMI', depositRatio: 0.1 },
  { value: '5', label: '5% deposit + LMI', depositRatio: 0.05 },
]
const INTEREST_RATE_QUICK_PICKS = [5.8, 6.5, 7.0, 8.0]
const DEPOSIT_PURCHASE_POWER_LEVELS = [5, 10, 15, 20, 25]
const STRESS_TEST_RATES = [5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5]
const DEFAULT_DEBT_RATE_PCT = 5.8
const MAX_ANNUAL_DEPRECIATION = 20000
const HIGH_DEPRECIATION_WARNING_THRESHOLD = 15000

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

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))

function getSafeNumber(value) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : null
}

function clampCashToDeploy(value, maxCashAvailableForInvestment) {
  const numericValue = Number(value)
  const safeMax = Number.isFinite(Number(maxCashAvailableForInvestment))
    ? Math.max(0, Number(maxCashAvailableForInvestment))
    : 0

  if (!Number.isFinite(numericValue)) return 0
  return Math.min(safeMax, Math.max(0, numericValue))
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
  const normalizedScenario = {
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
      lmiEstimate:
        breakdown.purchaseStructure?.lmiEstimate ?? formatCurrency(0),
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
      fiveYearValue:
        breakdown.growthAssumptions?.fiveYearValue ?? formatCurrency(0),
      equityCreated:
        breakdown.growthAssumptions?.equityCreated ?? formatCurrency(0),
    },
    constraints: Array.isArray(breakdown.constraints) ? breakdown.constraints : [],
    projectionData: Array.isArray(scenario?.projectionData) ? scenario.projectionData : [],
    isFeasible: scenario?.isFeasible !== false,
    feasibilityMessage: scenario?.feasibilityMessage ?? null,
    additionalCapitalRequired: Number(scenario?.additionalCapitalRequired || 0),
  }

  if (!breakdown.capital || !breakdown.purchaseStructure) {
    console.warn('Scenario missing capital breakdown', scenario)
  }

  return normalizedScenario
}

function getConstraintBannerTitle(limitingFactor) {
  if (limitingFactor === 'capital') {
    return 'Capital is your constraint ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â not borrowing capacity'
  }

  if (limitingFactor === 'borrowing') {
    return 'Borrowing capacity is your constraint ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â not capital'
  }

  return 'Capital and borrowing capacity are closely balanced'
}

function ConstraintBanner({
  borrowingCapacity,
  availableCapital,
  limitingFactor,
}) {
  const limitingFactorLabel =
    limitingFactor === 'capital'
      ? 'Capital constraint'
      : limitingFactor === 'borrowing'
        ? 'Borrowing constraint'
        : 'Balanced constraint'

  return (
    <section className="rounded-[1.75rem] border border-gray-200/80 border-l-4 border-l-teal-500 bg-white px-5 py-5 md:px-7 md:py-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 shrink-0 rounded-full bg-teal-500" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-700">
              Limiting factor
            </p>
          </div>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">
            {getConstraintBannerTitle(limitingFactor)}
          </p>
          <p className="mt-2 text-sm text-gray-600">{limitingFactorLabel}</p>
        </div>
        <div className="flex flex-wrap gap-3 md:justify-end">
          <div className="rounded-full bg-gray-50 px-4 py-3 text-right">
            <p className="text-2xl font-bold tracking-tight text-gray-950">
              {formatCurrency(borrowingCapacity)}
            </p>
            <p className="mt-1 text-sm text-gray-500">Borrowing capacity</p>
          </div>
          <div className="rounded-full bg-gray-50 px-4 py-3 text-right">
            <p className="text-2xl font-bold tracking-tight text-gray-950">
              {formatCurrency(availableCapital)}
            </p>
            <p className="mt-1 text-sm text-gray-500">Available capital</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function PortfolioGrowthScenarios() {
  const { properties, loans, transactions, loading } = usePortfolioData()
  const { financialProfile, liabilities } = useFinancialData()
  const rawAvailableCashForInvestment =
    financialProfile?.cash_available_for_investment ?? 0
  const maxCashAvailableForInvestment = Number.isFinite(Number(rawAvailableCashForInvestment))
    ? Math.max(0, Number(rawAvailableCashForInvestment))
    : 0
  const [cashToDeploy, setCashToDeploy] = useState(0)
  const [cashInputValue, setCashInputValue] = useState('0')
  const savingsInputRef = useRef(null)
  const [depositStrategy, setDepositStrategy] = useState('20')
  const [selectedInterestRate, setSelectedInterestRate] = useState(null)
  const [interestRateInput, setInterestRateInput] = useState('')
  const [isAdvancedAnalysisOpen, setIsAdvancedAnalysisOpen] = useState(false)
  const [activePremiumTab, setActivePremiumTab] = useState('wealth-growth')
  const effectiveCashToDeploy = clampCashToDeploy(
    Number.isFinite(Number(cashToDeploy)) ? Number(cashToDeploy) : 0,
    maxCashAvailableForInvestment
  )
  const isSliderDisabled = maxCashAvailableForInvestment <= 0
  const selectedDepositStrategy =
    DEPOSIT_STRATEGY_OPTIONS.find((option) => option.value === depositStrategy) ||
    DEPOSIT_STRATEGY_OPTIONS[0]

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
  const totalPortfolioValue = useMemo(
    () =>
      properties.reduce((sum, property) => sum + Number(property?.current_value || 0), 0),
    [properties]
  )
  const totalPortfolioDebt = useMemo(
    () => loans.reduce((sum, loan) => sum + Number(loan?.current_balance || 0), 0),
    [loans]
  )
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
        portfolioCashFlow: transactions
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
      }),
    [
      properties,
      loans,
      transactions,
      borrowingAnalysis,
      usableEquity,
      effectiveInterestRate,
      selectedDepositStrategy.depositRatio,
    ]
  )
  const savingsSimulationModel = useMemo(
    () =>
      buildPortfolioGrowthScenarios({
        properties,
        loans,
        transactions,
        borrowingAnalysis,
        usableEquity,
        availableCash: effectiveCashToDeploy,
        config: {
          depositRatio: selectedDepositStrategy.depositRatio,
          interestRatePct: effectiveInterestRate,
        },
        portfolioCashFlow: transactions
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
      }),
    [
      properties,
      loans,
      transactions,
      borrowingAnalysis,
      usableEquity,
      effectiveCashToDeploy,
      effectiveInterestRate,
      selectedDepositStrategy.depositRatio,
    ]
  )
  const scenarioModel = baselineScenarioModel
  const centralBorrowingCapacity = Number(scenarioModel?.inputs?.borrowingCapacity)
  const hasCentralBorrowingCapacity = Number.isFinite(centralBorrowingCapacity)
  const scenarioDebtRateAssumption =
    Number.isFinite(Number(scenarioModel.assumptions?.interestRatePct)) &&
    Number(scenarioModel.assumptions?.interestRatePct) > 0
      ? Number(scenarioModel.assumptions?.interestRatePct)
      : effectiveInterestRate > 0
        ? effectiveInterestRate
        : defaultInterestRate
  const baselineCapitalGap = Number(scenarioModel.recommendedStrategy?.requiredCapitalGap || 0)
  const totalSavings = maxCashAvailableForInvestment
  const recommendedTotalRequiredCapital = Number(
    (scenarioModel.scenarios || []).find(
      (scenario) => scenario.id === scenarioModel.recommendedStrategy?.id
    )?.depositRequired || 0
  ) + Number(
    (scenarioModel.scenarios || []).find(
      (scenario) => scenario.id === scenarioModel.recommendedStrategy?.id
    )?.estimatedAcquisitionCosts || 0
  )
  const recommendedAvailableCapital = Number(scenarioModel.inputs?.usableEquityAfterBuffer || 0)
  const enteredSavings = Math.max(0, effectiveCashToDeploy)
  const appliedSavingsToGap = Math.min(enteredSavings, Math.max(0, baselineCapitalGap))
  const unusedSavings = Math.max(0, enteredSavings - appliedSavingsToGap)
  const savingsSliderMax = Math.max(0, baselineCapitalGap)
  const savingsSliderStep =
    savingsSliderMax > 20000 ? 1000 : savingsSliderMax > 5000 ? 500 : 100
  const recommendedSafetyBuffer = Number(scenarioModel.assumptions?.liquidityBuffer || 0)
  const recommendedSavingsToApply = Math.max(
    0,
    Math.min(baselineCapitalGap, Math.max(0, totalSavings - recommendedSafetyBuffer))
  )
  const remainingCapitalGap = Math.max(
    0,
    recommendedTotalRequiredCapital - (recommendedAvailableCapital + appliedSavingsToGap)
  )
  const remainingSavings = Math.max(0, totalSavings - appliedSavingsToGap)
  const isBelowSafetyBuffer = remainingSavings < recommendedSafetyBuffer
  const capitalGapProgress = baselineCapitalGap > 0
    ? Math.min(appliedSavingsToGap / baselineCapitalGap, 1)
    : 1

  const scenarioDebug = useMemo(
    () => ({
      rawEquity: Math.max(totalPortfolioValue - totalPortfolioDebt, 0),
      totalPortfolioValue,
      totalPortfolioDebt,
      equityBeforeBuffer: usableEquity,
      safetyBuffer: scenarioModel.assumptions?.liquidityBuffer ?? 0,
      usableEquityAfterBuffer: scenarioModel.inputs?.usableEquityAfterBuffer ?? 0,
      rawCashAvailableForInvestment: rawAvailableCashForInvestment,
      maxCashAvailableForInvestment,
      cashToDeploy,
      effectiveCashToDeploy,
      enteredSavings,
      depositStrategy: selectedDepositStrategy.value,
      depositRatio: selectedDepositStrategy.depositRatio,
      selectedInterestRate,
      effectiveInterestRate,
      defaultInterestRate,
      interestRateInput,
      isSliderDisabled,
      isInputDisabled: false,
      baselineCapitalGap,
      totalSavings,
      unusedSavings,
      remainingCapitalGap,
      remainingSavings,
      recommendedSafetyBuffer,
      isBelowSafetyBuffer,
      totalDeployableCapital: scenarioModel.inputs?.totalDeployableCapital ?? 0,
      simulatedTotalDeployableCapital:
        savingsSimulationModel.inputs?.totalDeployableCapital ?? 0,
      scenarioInputs: scenarioModel.inputs,
      simulatedScenarioInputs: savingsSimulationModel.inputs,
      scenarioOutputs: scenarioModel.scenarios.map((scenario) => ({
        id: scenario.id,
        title: scenario.title,
        recommendedRange: scenario.recommendedPurchaseRange?.label,
        depositRequired: scenario.depositRequired,
        acquisitionCosts: scenario.estimatedAcquisitionCosts,
        lmiEstimate: scenario.lmiEstimate ?? 0,
        loanSize: scenario.estimatedLoanSize,
        postPurchaseSurplus: scenario.estimatedPostPurchaseSurplus,
        borrowingCapacityAfterPurchase: scenario.borrowingCapacityAfterPurchase,
      })),
      simulatedScenarioOutputs: savingsSimulationModel.scenarios.map((scenario) => ({
        id: scenario.id,
        title: scenario.title,
        requiredCapitalGap: scenario.requiredCapitalGap,
        deployableCapital: scenario.deployableCapital,
      })),
    }),
    [
      rawAvailableCashForInvestment,
      maxCashAvailableForInvestment,
      cashToDeploy,
      effectiveCashToDeploy,
      enteredSavings,
      isSliderDisabled,
      baselineCapitalGap,
      unusedSavings,
      remainingCapitalGap,
      remainingSavings,
      totalSavings,
      recommendedSafetyBuffer,
      isBelowSafetyBuffer,
      scenarioModel,
      savingsSimulationModel,
      defaultInterestRate,
      effectiveInterestRate,
      interestRateInput,
      selectedInterestRate,
      selectedDepositStrategy.depositRatio,
      selectedDepositStrategy.value,
      totalPortfolioDebt,
      totalPortfolioValue,
      usableEquity,
    ]
  )

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__equifolioScenarioDebug = scenarioDebug
    }

    console.debug('Equifolio growth capital gap debug', {
      rawEquity: scenarioDebug.rawEquity,
      totalPortfolioValue,
      totalPortfolioDebt,
      equityBeforeBuffer: usableEquity,
      safetyBuffer: scenarioModel.assumptions?.liquidityBuffer ?? 0,
      usableEquityAfterBuffer: scenarioModel.inputs?.usableEquityAfterBuffer ?? 0,
      baselineCapitalGap,
      cashAppliedInSimulation: effectiveCashToDeploy,
      enteredSavings,
      appliedSavingsToGap,
      unusedSavings,
      remainingCapitalGap,
      remainingSavings,
      totalSavings,
      recommendedSafetyBuffer,
      isBelowSafetyBuffer,
      recommendedTotalRequiredCapital,
      recommendedAvailableCapital,
      capitalGapProgress,
      depositStrategy: selectedDepositStrategy.value,
      depositRatio: selectedDepositStrategy.depositRatio,
      selectedInterestRate,
      effectiveInterestRate,
      defaultInterestRate,
      totalDeployableCapital: scenarioModel.inputs?.totalDeployableCapital ?? 0,
      simulatedTotalDeployableCapital:
        savingsSimulationModel.inputs?.totalDeployableCapital ?? 0,
      maxCashAvailableForInvestment,
      optionalSavingsControl: {
        min: 0,
        max: maxCashAvailableForInvestment,
        value: effectiveCashToDeploy,
      },
      interestRateControl: {
        min: 0,
        max: 15,
        value: effectiveInterestRate,
        rawInput: interestRateInput,
      },
      scenarioRecalculationTrigger: {
        cashToDeploy: effectiveCashToDeploy,
        interestRate: effectiveInterestRate,
        baselineScenarioCount: scenarioModel.scenarios.length,
        simulationScenarioCount: savingsSimulationModel.scenarios.length,
      },
    })
  }, [
    baselineCapitalGap,
    appliedSavingsToGap,
    capitalGapProgress,
    enteredSavings,
    effectiveCashToDeploy,
    effectiveInterestRate,
    isBelowSafetyBuffer,
    maxCashAvailableForInvestment,
    remainingCapitalGap,
    remainingSavings,
    unusedSavings,
    recommendedSafetyBuffer,
    recommendedAvailableCapital,
    recommendedTotalRequiredCapital,
    scenarioModel.scenarios.length,
    scenarioModel.assumptions,
    scenarioModel.inputs,
    savingsSimulationModel.inputs,
    savingsSimulationModel.scenarios.length,
    scenarioDebug,
    defaultInterestRate,
    interestRateInput,
    selectedDepositStrategy.depositRatio,
    selectedDepositStrategy.value,
    selectedInterestRate,
    totalSavings,
    totalPortfolioDebt,
    totalPortfolioValue,
    usableEquity,
  ])
  const normalizedScenarios = useMemo(
    () => (scenarioModel.scenarios || []).map(normalizeScenario),
    [scenarioModel.scenarios]
  )
  const viableScenarios = useMemo(
    () =>
      normalizedScenarios.filter((scenario) =>
        ['recommended', 'stretch'].includes(scenario.scenarioState)
      ),
    [normalizedScenarios]
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
  const feasibleStrategyCount = viableScenarios.length
  const recommendedScenario = useMemo(
    () =>
      normalizedScenarios.find(
        (scenario) => scenario.id === scenarioModel.recommendedStrategy?.id
      ) || null,
    [normalizedScenarios, scenarioModel.recommendedStrategy?.id]
  )
  const recommendedScenarioRangeLabel = recommendedScenario?.recommendedPurchaseRange?.label || null
  const recommendedScenarioAnchorPrice = getSafeNumber(recommendedScenario?.scenarioPurchasePrice)
  const recommendedScenarioDepositAmount = getSafeNumber(recommendedScenario?.scenarioDepositAmount)
  const recommendedScenarioLoanAmount = getSafeNumber(recommendedScenario?.scenarioLoanAmount)
  const recommendedScenarioDepositPct = getSafeNumber(recommendedScenario?.scenarioDepositPct)
  const profileOwnership = useMemo(
    () =>
      normalizeTaxOwnership({
        ownershipStructure: financialProfile?.ownership_structure,
        ownershipSplitUserPct: financialProfile?.ownership_split_user_pct,
        ownershipSplitPartnerPct: financialProfile?.ownership_split_partner_pct,
      }),
    [financialProfile]
  )
  const [ownershipOverride, setOwnershipOverride] = useState(null)
  const [includeDepreciation, setIncludeDepreciation] = useState(false)
  const [annualDepreciationInput, setAnnualDepreciationInput] = useState('8000')
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
  const ownershipSplitUserPct = getSafeNumber(ownershipSplitUserInput) ??
    (ownershipStructure === 'joint' ? 50 : 100)
  const ownershipSplitPartnerPct = getSafeNumber(ownershipSplitPartnerInput) ??
    (ownershipStructure === 'joint' ? 50 : 0)
  const annualDepreciation = Math.max(
    0,
    Math.min(MAX_ANNUAL_DEPRECIATION, Number(annualDepreciationInput || 0))
  )
  const ownershipSplitUserPctNumber = Number(ownershipSplitUserPct || 0)
  const ownershipSplitPartnerPctNumber = Number(ownershipSplitPartnerPct || 0)
  const ownershipSplitInlineError =
    ownershipStructure === 'joint' &&
    (
      !Number.isFinite(ownershipSplitUserPctNumber) ||
      !Number.isFinite(ownershipSplitPartnerPctNumber) ||
      ownershipSplitUserPctNumber < 0 ||
      ownershipSplitUserPctNumber > 100 ||
      ownershipSplitPartnerPctNumber < 0 ||
      ownershipSplitPartnerPctNumber > 100 ||
      ownershipSplitUserPctNumber + ownershipSplitPartnerPctNumber !== 100
    )
      ? 'Ownership split must total 100%'
      : ''
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
  }, [financialProfile, ownershipSplitPartnerPct, ownershipSplitUserPct, ownershipStructure])
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
  const growthRateAssumptionPct = Number(scenarioModel.assumptions?.growthRatePct || 0)
  const recommendationTraceability = useMemo(() => {
    const parts = []
    if (recommendedScenarioAnchorPrice !== null) {
      parts.push(`Inputs used: purchase price ${formatCurrency(recommendedScenarioAnchorPrice)}`)
    } else {
      parts.push('Inputs used: scenario purchase structure')
    }
    parts.push('loan, rent, and property expenses')
    parts.push(
      `Assumptions: ${growthRateAssumptionPct.toFixed(1)}% annual growth and ${Number(
        scenarioDebtRateAssumption || 0
      ).toFixed(1)}% debt rate`
    )
    return parts.join(' ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· ')
  }, [
    growthRateAssumptionPct,
    recommendedScenarioAnchorPrice,
    scenarioDebtRateAssumption,
  ])
  const taxTraceability = useMemo(() => {
    const splitLabel =
      ownershipStructure === 'joint'
        ? `${ownershipSplitUserInput || '0'} / ${ownershipSplitPartnerInput || '0'}`
        : '100 / 0'
    return `Inputs used: pre-tax cash flow, ${taxIncomeBasisLabel} income, ownership ${splitLabel} ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· Assumptions: Australian resident individual tax brackets, depreciation ${
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
  const simulatedScenarioLookup = useMemo(
    () => new Map((savingsSimulationModel.scenarios || []).map((scenario) => [scenario.id, scenario])),
    [savingsSimulationModel.scenarios]
  )
  const topSuggestedScenario = useMemo(() => {
    if (!recommendedScenario) return null
    const simulatedScenario = simulatedScenarioLookup.get(recommendedScenario.id)
    return effectiveCashToDeploy > 0 && simulatedScenario ? simulatedScenario : recommendedScenario
  }, [effectiveCashToDeploy, recommendedScenario, simulatedScenarioLookup])
  const topAlternativeScenario = useMemo(() => {
    const sourceScenario = blockedScenarios[0] || secondaryScenarios[0] || null
    if (!sourceScenario) return null
    const simulatedScenario = simulatedScenarioLookup.get(sourceScenario.id)
    return effectiveCashToDeploy > 0 && simulatedScenario ? simulatedScenario : sourceScenario
  }, [blockedScenarios, effectiveCashToDeploy, secondaryScenarios, simulatedScenarioLookup])
  const borrowingSensitivityData = useMemo(() => {
    if (!scenarioModel.recommendedStrategy) return []
    const assessmentRate = Number(
      borrowingAnalysis?.assumptions?.assessment_rate_pct ??
        borrowingAnalysis?.assumptions_detail?.assessment_rate_pct ??
        8.5
    )
    const sensitivityRates = [-1.5, -1.0, -0.5, 0, 0.5, 1.0].map((offset) =>
      Number((assessmentRate + offset).toFixed(1))
    )

    return sensitivityRates.map((rate) => {
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
        serviceabilitySurplus: Number(sensitivityResult?.net_monthly_surplus || 0),
        confidenceScore: Number(sensitivityResult?.confidence_score ?? 100),
        currentAssessmentMarker:
          Math.abs(rate - assessmentRate) < 0.001
            ? Number(sensitivityResult?.borrowing_power_estimate || 0)
            : null,
      }
    })
  }, [
    borrowingAnalysis?.assumptions?.assessment_rate_pct,
    borrowingAnalysis?.assumptions_detail?.assessment_rate_pct,
    financialProfile,
    liabilities,
    loans,
    scenarioModel.recommendedStrategy,
    transactions,
  ])
  const depositPurchasePowerData = useMemo(() => {
    if (!scenarioModel.recommendedStrategy) return []
    if (!Number.isFinite(centralBorrowingCapacity)) {
      console.warn('Deposit graph missing central borrowing capacity input')
      return []
    }

    const borrowingCapacity = Math.max(0, centralBorrowingCapacity)
    const totalDeployableCapital = Number(scenarioModel.inputs?.totalDeployableCapital || 0)
    const acquisitionCostRate = Number(scenarioModel.assumptions?.acquisitionCostRate || 0)
    const selectedDepositPct = Math.round(selectedDepositStrategy.depositRatio * 100)
    const recommendedDepositPct = Math.round(
      Number(scenarioModel.assumptions?.depositRatio || selectedDepositStrategy.depositRatio) * 100
    )

    const baseData = DEPOSIT_PURCHASE_POWER_LEVELS.map((depositPct) => {
      const depositRatio = depositPct / 100
      const depositBasedPrice =
        depositRatio + acquisitionCostRate > 0
          ? totalDeployableCapital / (depositRatio + acquisitionCostRate)
          : 0
      const targetLvr = Math.max(0, 1 - depositRatio)
      const actualAchievablePrice = Math.max(
        0,
        Math.min(depositBasedPrice, borrowingCapacity)
      )
      const limitingFactor =
        depositBasedPrice < borrowingCapacity
          ? 'capital'
          : borrowingCapacity < depositBasedPrice
            ? 'borrowing'
            : 'balanced'

      return {
        depositPct,
        depositLabel: `${depositPct}%`,
        maxPurchasePrice: Math.round(actualAchievablePrice),
        requiredDeposit: Math.round(actualAchievablePrice * depositRatio),
        estimatedAcquisitionCosts: Math.round(actualAchievablePrice * acquisitionCostRate),
        loanSize: Math.round(actualAchievablePrice * targetLvr),
        limitingFactor:
          limitingFactor === 'capital'
            ? 'Capital limited'
            : limitingFactor === 'borrowing'
              ? 'Borrowing limited'
              : 'Balanced',
        limitingFactorKey: limitingFactor,
        depositConstrainedPrice: Math.round(depositBasedPrice),
        borrowingConstrainedPrice: Math.round(borrowingCapacity),
        currentSelectionMarker:
          depositPct === selectedDepositPct ? Math.round(actualAchievablePrice) : null,
        recommendedMarker:
          depositPct === recommendedDepositPct && recommendedDepositPct !== selectedDepositPct
            ? Math.round(actualAchievablePrice)
            : null,
      }
    })
    const debugPoint = baseData.find((point) => point.depositPct === selectedDepositPct) || baseData[0]
    console.log('Deposit graph point', {
      depositRatio: debugPoint ? debugPoint.depositPct / 100 : null,
      depositBasedPurchasePower: debugPoint?.depositConstrainedPrice ?? 0,
      borrowingCapacity,
      actualAchievablePurchasePower: debugPoint?.maxPurchasePrice ?? 0,
      limitingFactor: debugPoint?.limitingFactorKey ?? 'balanced',
    })
    const intersectionPoint =
      baseData.find(
        (point) =>
          Number(point.depositConstrainedPrice || 0) >
          Number(point.borrowingConstrainedPrice || 0)
      ) || null

    return baseData.map((point) => ({
      ...point,
      borrowingLimitLine: Number(point.borrowingConstrainedPrice || 0),
      borrowingCapIntersection:
        intersectionPoint && intersectionPoint.depositPct === point.depositPct
          ? Number(point.maxPurchasePrice || 0)
          : null,
      cappedRegionValue:
        Number(point.depositConstrainedPrice || 0) >
        Number(point.borrowingConstrainedPrice || 0)
          ? Number(point.maxPurchasePrice || 0)
          : null,
    }))
  }, [
    centralBorrowingCapacity,
    scenarioModel.assumptions,
    scenarioModel.inputs,
    scenarioModel.recommendedStrategy,
    selectedDepositStrategy.depositRatio,
  ])
  const stressTestData = useMemo(() => {
    if (!scenarioModel.recommendedStrategy) return []

    const assessmentRate = Number(
      borrowingAnalysis?.assumptions?.assessment_rate_pct ??
        borrowingAnalysis?.assumptions_detail?.assessment_rate_pct ??
        8.5
    )

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

      const rawServiceabilitySurplus = Number(stressResult?.net_monthly_surplus)
      const usedFallback = !Number.isFinite(rawServiceabilitySurplus)
      const monthlySurplus = usedFallback ? 0 : rawServiceabilitySurplus
      const baseConfidenceScore = Number(stressResult?.confidence_score ?? 100)
      const confidenceScore = Math.max(
        0,
        usedFallback ? Math.min(baseConfidenceScore, 60) : baseConfidenceScore
      )

      return {
        rate,
        rateLabel: `${rate.toFixed(1)}%`,
        monthlySurplus,
        confidenceScore,
        confidenceLabel: getConfidenceLabel(confidenceScore),
        usedFallback,
        statusLabel: monthlySurplus >= 0 ? 'Positive buffer' : 'Negative cash flow',
        currentAssessmentMarker:
          Math.abs(rate - assessmentRate) < 0.001 ? monthlySurplus : null,
      }
    })
  }, [
    borrowingAnalysis?.assumptions?.assessment_rate_pct,
    borrowingAnalysis?.assumptions_detail?.assessment_rate_pct,
    financialProfile,
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
  const borrowingSensitivityInsight = useMemo(() => {
    if (borrowingSensitivityData.length < 2) return null

    const lowRateCapacity = Number(borrowingSensitivityData[0]?.borrowingCapacity || 0)
    const highRateCapacity = Number(
      borrowingSensitivityData[borrowingSensitivityData.length - 1]?.borrowingCapacity || 0
    )
    const capacityDrop = Math.max(0, lowRateCapacity - highRateCapacity)

    return `Capacity drops by ~${formatCurrency(capacityDrop)} across typical rate ranges.`
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
  const assessmentRateValue = Number(
    borrowingAnalysis?.assumptions?.assessment_rate_pct ??
      borrowingAnalysis?.assumptions_detail?.assessment_rate_pct ??
      8.5
  )
  const selectedDepositPurchasePoint = useMemo(
    () =>
      depositPurchasePowerData.find(
        (point) => point.depositPct === Math.round(selectedDepositStrategy.depositRatio * 100)
      ) || depositPurchasePowerData[0],
    [depositPurchasePowerData, selectedDepositStrategy.depositRatio]
  )
  const depositPurchaseInsight = useMemo(() => {
    if (!selectedDepositPurchasePoint) return null
    const limitingFactor = String(
      selectedDepositPurchasePoint.limitingFactorKey || 'borrowing'
    ).toLowerCase()

    if (limitingFactor === 'capital') {
      return 'At this deposit level, your purchase power is limited by capital.'
    }

    if (limitingFactor === 'balanced') {
      return 'At this deposit level, capital and borrowing capacity are equally constraining.'
    }

    return 'At this deposit level, your purchase power is limited by borrowing capacity.'
  }, [selectedDepositPurchasePoint])
  const depositBorrowingLimit = Number(
    depositPurchasePowerData[0]?.borrowingConstrainedPrice || 0
  )
  useEffect(() => {
    console.log('Dashboard borrowing capacity:', centralBorrowingCapacity)
    console.log('Graph borrowing capacity:', centralBorrowingCapacity)
  }, [centralBorrowingCapacity])
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
  const equityCashFlowTradeOffData = useMemo(() => {
    if (!recommendedScenario?.projectionData?.length) return []

    const projectionData = recommendedScenario.projectionData
    const initialEquityDelta = Math.max(
      Number(projectionData[1]?.netEquity || 0) - Number(projectionData[0]?.netEquity || 0),
      0
    )
    const initialCapital = Number(
      recommendedScenario.depositRequired + recommendedScenario.estimatedAcquisitionCosts
    )

    return projectionData.map((point) => {
      const yearlyEquityGain =
        Number(point?.netEquity || 0) -
        Number(projectionData[Math.max(Number(point?.year || 0) - 1, 0)]?.netEquity || 0)
      const isBreakEvenCashFlowPoint =
        Number(point?.monthlyCashFlow || 0) >= 0 && Math.abs(Number(point?.monthlyCashFlow || 0)) < 1
      const isInflectionPoint =
        Number(point?.year || 0) > 0 &&
        initialEquityDelta > 0 &&
        yearlyEquityGain >= initialEquityDelta * 1.15
          ? Number(point?.netEquity || 0)
          : null

      return {
        ...point,
        breakEvenMarker: isBreakEvenCashFlowPoint ? Number(point?.monthlyCashFlow || 0) : null,
        inflectionMarker: isInflectionPoint,
        fiveYearProjectionMarker:
          Number(point?.year || 0) === 5 ? Number(point?.netEquity || 0) : null,
        initialCapital,
      }
    })
  }, [recommendedScenario])
  const fiveYearEquitySourceOfTruth = useMemo(() => {
    if (!equityCashFlowTradeOffData.length) return 0

    const fiveYearPoint =
      equityCashFlowTradeOffData.find((point) => Number(point.year) === 5) ||
      equityCashFlowTradeOffData[Math.min(5, equityCashFlowTradeOffData.length - 1)]

    return Number(fiveYearPoint?.netEquity || 0)
  }, [equityCashFlowTradeOffData])
  const recommendedNextMoveSummary = useMemo(() => {
    if (!recommendedScenario?.projectionData?.length) return null

    const tenYearPoint =
      recommendedScenario.projectionData.find((point) => Number(point.year) === 10) ||
      null

    const tenYearEquity = Number(tenYearPoint?.netEquity || 0)

    return {
      fiveYearEquity: fiveYearEquitySourceOfTruth,
      tenYearEquity,
      monthlyCashFlowImpact: Number(recommendedScenario.estimatedMonthlyCashFlow || 0),
    }
  }, [fiveYearEquitySourceOfTruth, recommendedScenario])
  const recommendedWealthOutcome = useMemo(() => {
    if (!recommendedScenario) return null

    const wealthOutcome = calculateScenarioWealthOutcomes({
      purchasePrice: recommendedScenario.scenarioPurchasePrice,
      deposit: recommendedScenario.depositRequired,
      acquisitionCosts: recommendedScenario.estimatedAcquisitionCosts,
      monthlyAfterTaxCashFlow:
        recommendedScenarioSafeTaxView?.afterTaxMonthlyImpact ??
        recommendedScenario.estimatedMonthlyCashFlow,
      years: 5,
      equityGain: fiveYearEquitySourceOfTruth,
    })

    const equityGain = getSafeNumber(wealthOutcome.equityGain)
    const totalCashInvested = getSafeNumber(wealthOutcome.totalCashInvested)
    const netWealthCreated = getSafeNumber(wealthOutcome.netWealthCreated)
    const wealthMultiple = getSafeNumber(wealthOutcome.wealthMultiple)

    if (
      equityGain === null ||
      totalCashInvested === null ||
      netWealthCreated === null
    ) {
      return null
    }

    return {
      equityGain,
      totalCashInvested,
      netWealthCreated,
      wealthMultiple,
    }
  }, [fiveYearEquitySourceOfTruth, recommendedScenario, recommendedScenarioSafeTaxView])
  const recommendedWealthBreakdown = useMemo(() => {
    if (!recommendedScenario || !recommendedWealthOutcome) return null

    const years = 5
    const totalRequiredCapital =
      (getSafeNumber(recommendedScenario.depositRequired) ?? 0) +
      (getSafeNumber(recommendedScenario.estimatedAcquisitionCosts) ?? 0)
    const usableEquityAvailable = getSafeNumber(scenarioModel.inputs?.usableEquityAfterBuffer) ?? 0
    const capitalGap = Math.max(totalRequiredCapital - usableEquityAvailable, 0)
    const cashUsed = Math.min(appliedSavingsToGap, capitalGap, totalRequiredCapital)
    const equityUsed = Math.min(
      usableEquityAvailable,
      Math.max(totalRequiredCapital - cashUsed, 0)
    )
    const upfrontCashToday = Math.max(0, capitalGap - cashUsed)
    const afterTaxMonthlyImpact =
      getSafeNumber(recommendedScenarioSafeTaxView?.afterTaxMonthlyImpact) ??
      Number(recommendedScenario.estimatedMonthlyCashFlow || 0)
    const ongoingContribution = Math.abs(afterTaxMonthlyImpact) * 12 * years

    console.log({
      totalRequiredCapital,
      equityUsed,
      cashUsed,
      capitalGap,
      upfrontCashToday,
      ongoingContribution,
    })

    return {
      totalRequiredCapital,
      equityUsed,
      cashUsed,
      capitalGap,
      upfrontCashToday,
      ongoingContribution,
      totalCapitalDeployed:
        equityUsed + cashUsed + upfrontCashToday + ongoingContribution,
    }
  }, [
    appliedSavingsToGap,
    recommendedScenario,
    recommendedScenarioSafeTaxView,
    recommendedWealthOutcome,
    scenarioModel.inputs?.usableEquityAfterBuffer,
  ])
  const scenarioComparisonWealthMap = useMemo(() => {
    const scenariosForComparison = normalizedScenarios.filter((scenario) => scenario?.id)

    return new Map(
      scenariosForComparison.map((scenario) => {
        const fiveYearPoint =
          scenario.projectionData?.find((point) => Number(point?.year) === 5) ||
          scenario.projectionData?.[Math.min(5, Math.max((scenario.projectionData?.length || 1) - 1, 0))] ||
          null
        const equityGain = Number(fiveYearPoint?.netEquity || scenario.fiveYearEquityProjection || 0)
        const afterTaxMonthlyCashFlow =
          scenario.id === recommendedScenario?.id
            ? recommendedScenarioSafeTaxView?.afterTaxMonthlyImpact ??
              scenario.estimatedMonthlyCashFlow
            : scenario.estimatedMonthlyCashFlow

        return [
          scenario.id,
          calculateScenarioWealthOutcomes({
            purchasePrice: scenario.scenarioPurchasePrice,
            deposit: scenario.depositRequired,
            acquisitionCosts: scenario.estimatedAcquisitionCosts,
            monthlyAfterTaxCashFlow: afterTaxMonthlyCashFlow,
            years: 5,
            equityGain,
          }),
        ]
      })
    )
  }, [normalizedScenarios, recommendedScenario?.id, recommendedScenarioSafeTaxView])
  useEffect(() => {
    if (recommendedScenario && equityCashFlowTradeOffData.length > 0) {
      console.log('5-year equity (source of truth):', fiveYearEquitySourceOfTruth)
    }
  }, [equityCashFlowTradeOffData.length, fiveYearEquitySourceOfTruth, recommendedScenario])
  useEffect(() => {
    if (!recommendedWealthOutcome) return

    console.log('Wealth calculation check', {
      equityGain: recommendedWealthOutcome.equityGain,
      totalCashInvested: recommendedWealthOutcome.totalCashInvested,
      netWealthCreated: recommendedWealthOutcome.netWealthCreated,
      wealthMultiple: recommendedWealthOutcome.wealthMultiple,
    })
  }, [recommendedWealthOutcome])
  useEffect(() => {
    if (!recommendedWealthBreakdown) return

    console.log({
      totalRequiredCapital: recommendedWealthBreakdown.totalRequiredCapital,
      equityUsed: recommendedWealthBreakdown.equityUsed,
      cashUsed: recommendedWealthBreakdown.cashUsed,
      capitalGap: recommendedWealthBreakdown.capitalGap,
      upfrontCashToday: recommendedWealthBreakdown.upfrontCashToday,
      ongoingContribution: recommendedWealthBreakdown.ongoingContribution,
    })
  }, [recommendedWealthBreakdown])
  const primaryGraphKey = useMemo(() => {
    if (scenarioModel.viability?.limitingFactor === 'capital' && depositPurchasePowerData.length > 0) {
      return 'deposit'
    }
    if (
      scenarioModel.viability?.limitingFactor === 'borrowing' &&
      borrowingSensitivityData.length > 0
    ) {
      return 'borrowing'
    }
    if (borrowingSensitivityData.length > 0) return 'borrowing'
    if (depositPurchasePowerData.length > 0) return 'deposit'
    if (stressTestData.length > 0) return 'stress'
    if (equityCashFlowTradeOffData.length > 0) return 'equity'
    return null
  }, [
    borrowingSensitivityData.length,
    depositPurchasePowerData.length,
    equityCashFlowTradeOffData.length,
    scenarioModel.viability?.limitingFactor,
    stressTestData.length,
  ])
  const renderBorrowingSensitivityTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null

    const datum = payload[0]?.payload
    if (!datum) return null

    return (
      <ScenarioChartTooltip
        contextLabel="Interest rate"
        contextValue={datum?.rateLabel ?? ''}
        primaryLabel="Borrowing capacity"
        primaryValue={formatCurrency(datum?.borrowingCapacity ?? 0)}
        supportingRows={[
          {
            label: 'Serviceability surplus',
            value: formatCurrency(datum?.serviceabilitySurplus ?? 0),
          },
        ]}
        explanation="Borrowing capacity is assessed using lender serviceability rules at this rate."
      />
    )
  }
  const renderDepositPurchaseTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null

    const datum = payload[0]?.payload
    if (!datum) return null

    return (
      <ScenarioChartTooltip
        contextLabel="Deposit"
        contextValue={datum?.depositLabel ?? ''}
        primaryLabel="Achievable purchase power"
        primaryValue={formatCurrency(datum?.maxPurchasePrice ?? 0)}
        supportingRows={[
          {
            label: 'Limiting factor',
            value:
              datum?.limitingFactorKey === 'capital'
                ? 'Capital'
                : datum?.limitingFactorKey === 'borrowing'
                  ? 'Borrowing'
                  : 'Balanced',
          },
          Number(datum?.requiredDeposit) > 0
            ? {
                label: 'Required deposit',
                value: formatCurrency(datum?.requiredDeposit ?? 0),
              }
            : null,
        ].filter(Boolean)}
        explanation={
          datum?.limitingFactorKey === 'capital'
            ? 'Your available capital is the main constraint at this deposit level.'
            : datum?.limitingFactorKey === 'borrowing'
              ? 'Your borrowing capacity is the main constraint at this deposit level.'
              : 'Capital and borrowing capacity are equally constraining at this deposit level.'
        }
      />
    )
  }
  const renderStressTestTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null

    const datum = payload[0]?.payload
    if (!datum) return null

    return (
      <ScenarioChartTooltip
        contextLabel="Interest rate"
        contextValue={datum?.rateLabel ?? ''}
        primaryLabel="Serviceability surplus"
        primaryValue={formatCurrency(datum?.monthlySurplus ?? 0)}
        supportingRows={[
          datum?.statusLabel
            ? {
                label: 'Threshold state',
                value:
                  datum.statusLabel === 'Positive buffer'
                    ? 'Healthy'
                    : datum.statusLabel === 'Negative cash flow'
                      ? 'Negative'
                      : 'Tightening',
              }
            : null,
        ].filter(Boolean)}
        explanation="Higher assessment rates reduce serviceability headroom."
      />
    )
  }
  const renderEquityCashFlowTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null

    const datum = payload[0]?.payload
    if (!datum) return null

    return (
      <ScenarioChartTooltip
        contextLabel="Year"
        contextValue={String(datum?.year ?? '')}
        primaryLabel={Number(datum?.year) === 5 ? '5-year projection' : 'Net equity'}
        primaryValue={formatCurrency(datum?.netEquity ?? 0)}
        supportingRows={[
          Number.isFinite(Number(datum?.propertyValue))
            ? {
                label: 'Property value',
                value: formatCurrency(datum?.propertyValue ?? 0),
              }
            : null,
          Number.isFinite(Number(datum?.loanBalance))
            ? {
                label: 'Loan balance',
                value: formatCurrency(datum?.loanBalance ?? 0),
              }
            : null,
        ].filter(Boolean)}
        explanation="Illustrative projection based on assumed growth and loan conditions."
      />
    )
  }
  const borrowingSensitivityChart = borrowingSensitivityData.length > 0 ? (
    <GraphPanel
      title="Borrowing sensitivity"
      preface="Your borrowing is assessed at ~8.5%, not your actual loan rate."
      insight={borrowingSensitivityInsight}
      confidenceLabel={borrowingSensitivityConfidence?.label}
      traceability={`Inputs used: recorded income, liabilities, mortgages, and lender assessment rate ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· Assumptions: buffered serviceability at ${assessmentRateValue.toFixed(
        1
      )}%`}
      note="Borrowing capacity estimates may differ from lender assessments."
    >
      <PremiumProjectionChart
        title="Borrowing sensitivity"
        data={borrowingSensitivityData}
        series={[
          {
            dataKey: 'borrowingCapacity',
            label: 'Borrowing capacity',
            color: '#0F172A',
          },
          {
            dataKey: 'currentAssessmentMarker',
            label: 'Assessment rate used',
            color: '#C2410C',
            showInTooltip: false,
            showInLegend: false,
            strokeWidth: 0,
            dot: {
              r: 6,
              stroke: '#FFFFFF',
              strokeWidth: 2.75,
              fill: '#C2410C',
            },
            activeDot: false,
            connectNulls: false,
          },
        ]}
        xAxisKey="rate"
        xAxisType="number"
        xAxisDomain={[
          Math.min(...borrowingSensitivityData.map((point) => Number(point.rate || 0))),
          Math.max(...borrowingSensitivityData.map((point) => Number(point.rate || 0))),
        ]}
        xAxisTicks={borrowingSensitivityData.map((point) => Number(point.rate || 0))}
        xAxisTickFormatter={(value) => `${Number(value).toFixed(1)}%`}
        xAxisConfig={getScenarioXAxisLayout('Interest rate (%)')}
        xAxisLabel="Interest rate (%)"
        yAxisLabel="Borrowing capacity ($)"
        tooltipContent={renderBorrowingSensitivityTooltip}
        referenceLines={[
          {
            axis: 'x',
            value: assessmentRateValue,
            labelLines: ['8.5%', 'Assessment rate'],
            stroke: '#B85C5C',
            strokeWidth: 2,
            strokeOpacity: 1,
            ifOverflow: 'extendDomain',
            isFront: true,
            labelColor: '#B85C5C',
          },
        ]}
        height={320}
      />
    </GraphPanel>
  ) : null
  useEffect(() => {
    if (borrowingSensitivityData.length > 0) {
      console.log('Rendering assessment ReferenceLine at x=8.5')
    }
  }, [borrowingSensitivityData.length])
  const depositPurchasePowerChart = !hasCentralBorrowingCapacity ? (
    <GraphPanel
      title="Deposit vs purchase power"
      warning="Deposit graph missing central borrowing capacity input."
    >
      <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.35)]">
        <p className="text-sm leading-6 text-slate-600">
          Borrowing capacity is unavailable from the central serviceability engine, so this graph is
          temporarily paused rather than estimated locally.
        </p>
      </div>
    </GraphPanel>
  ) : depositPurchasePowerData.length > 0 ? (
    <GraphPanel
      title="Deposit vs purchase power"
      insight={depositPurchaseInsight}
      traceability={`Inputs used: deployable capital and central borrowing capacity ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· Assumptions: ${Math.round(
        selectedDepositStrategy.depositRatio * 100
      )}% selected deposit strategy and ${(
        Number(scenarioModel.assumptions?.acquisitionCostRate || 0) * 100
      ).toFixed(1)}% acquisition costs`}
    >
      <PremiumProjectionChart
        title="Deposit vs purchase power"
        subtitle="See how deposit strategy changes the maximum property price you can support with current capital and borrowing constraints."
        data={depositPurchasePowerData}
        series={[
          {
            dataKey: 'maxPurchasePrice',
            label: 'Achievable purchase power',
            color: '#0F172A',
          },
          {
            dataKey: 'cappedRegionValue',
            label: 'Capped by borrowing',
            color: '#CBD5E1',
            strokeWidth: 2,
            strokeDasharray: '4 6',
            showInLegend: false,
          },
          {
            dataKey: 'currentSelectionMarker',
            label: 'Current selection',
            color: '#C2410C',
            showInTooltip: false,
            showInLegend: false,
            strokeWidth: 0,
            dot: {
              r: 5.5,
              stroke: '#FFFFFF',
              strokeWidth: 2.5,
              fill: '#C2410C',
            },
            activeDot: false,
            connectNulls: false,
          },
          {
            dataKey: 'recommendedMarker',
            label: 'Suggested point',
            color: '#2563EB',
            showInTooltip: false,
            showInLegend: false,
            strokeWidth: 0,
            dot: {
              r: 5.5,
              stroke: '#FFFFFF',
              strokeWidth: 2.5,
              fill: '#2563EB',
            },
            activeDot: false,
            connectNulls: false,
          },
          {
            dataKey: 'borrowingCapIntersection',
            label: 'Borrowing cap intersection',
            color: '#C2410C',
            showInTooltip: false,
            showInLegend: false,
            strokeWidth: 0,
            dot: {
              r: 6,
              stroke: '#FFFFFF',
              strokeWidth: 2.75,
              fill: '#C2410C',
            },
            activeDot: false,
            connectNulls: false,
          },
        ]}
        xAxisKey="depositLabel"
        xAxisConfig={getScenarioXAxisLayout('Deposit (%)')}
        xAxisLabel="Deposit (%)"
        yAxisLabel="Purchase power ($)"
        tooltipContent={renderDepositPurchaseTooltip}
        referenceLines={[
          {
            axis: 'y',
            value: depositBorrowingLimit,
            label: 'Borrowing limit',
            labelPosition: 'insideTopRight',
            stroke: '#C2410C',
            strokeDasharray: '5 5',
          },
        ]}
        height={320}
      />
    </GraphPanel>
  ) : null
  const stressTestChart = stressTestData.length > 0 ? (
    <GraphPanel
      title="Stress test: rate vs surplus"
      insight={stressTestInsight}
      confidenceLabel={stressTestConfidence?.label}
      traceability={`Inputs used: recorded income, liabilities, mortgages, and serviceability surplus ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· Assumptions: lender assessment rates from ${STRESS_TEST_RATES[0].toFixed(
        1
      )}% to ${STRESS_TEST_RATES[STRESS_TEST_RATES.length - 1].toFixed(1)}%`}
    >
      <PremiumProjectionChart
        title="Stress test: rate vs surplus"
        subtitle="See where serviceability surplus tightens as lender assessment rates rise."
        data={stressTestData}
        series={[
          {
            dataKey: 'monthlySurplus',
            label: 'Monthly surplus',
            color: '#0F172A',
          },
          {
            dataKey: 'currentAssessmentMarker',
            label: 'Assessment rate used',
            color: '#C2410C',
            showInTooltip: false,
            showInLegend: false,
            strokeWidth: 0,
            dot: {
              r: 6,
              stroke: '#FFFFFF',
              strokeWidth: 2.75,
              fill: '#C2410C',
            },
            activeDot: false,
            connectNulls: false,
          },
        ]}
        xAxisKey="rateLabel"
        xAxisConfig={getScenarioXAxisLayout('Interest rate (%)')}
        xAxisLabel="Interest rate (%)"
        yAxisLabel="Monthly surplus ($)"
        tooltipContent={renderStressTestTooltip}
        referenceLines={[
          {
            axis: 'y',
            value: 0,
            label: 'Break-even point',
            labelPosition: 'insideTopRight',
            stroke: '#C2410C',
            strokeDasharray: '5 5',
          },
          {
            axis: 'x',
            value: `${Number(
              borrowingAnalysis?.assumptions?.assessment_rate_pct ??
                borrowingAnalysis?.assumptions_detail?.assessment_rate_pct ??
                8.5
            ).toFixed(1)}%`,
            label: 'Assessment rate',
            labelPosition: 'insideTopRight',
            stroke: '#C2410C',
            strokeDasharray: '5 5',
          },
        ]}
        height={320}
      />
    </GraphPanel>
  ) : null
  const equityCashFlowTradeOffChart = equityCashFlowTradeOffData.length > 0 ? (
    <GraphPanel
      title="How your wealth grows over time"
      preface={
        fiveYearEquitySourceOfTruth > 0
          ? `~${formatCurrency(fiveYearEquitySourceOfTruth)} equity at 5 years`
          : null
      }
      insight="Projected equity growth reflects assumed value growth and debt reduction over time."
      traceability={`Inputs used: scenario purchase price, loan, rent, and expenses ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· Assumptions: ${growthRateAssumptionPct.toFixed(
        1
      )}% annual growth, ${Number(scenarioDebtRateAssumption || 0).toFixed(
        1
      )}% debt rate, and rental growth over time`}
    >
      <PremiumProjectionChart
        title="How your wealth grows over time"
        subtitle="Illustrative projection based on assumed growth and loan conditions"
        data={equityCashFlowTradeOffData}
        series={[
          {
            dataKey: 'netEquity',
            label: 'Net equity',
            color: '#0F172A',
            yAxisId: 'left',
          },
          {
            dataKey: 'propertyValue',
            label: 'Property value',
            color: '#94A3B8',
            yAxisId: 'left',
            strokeWidth: 2,
            strokeOpacity: 0.55,
          },
          {
            dataKey: 'fiveYearProjectionMarker',
            label: '5-year projection',
            color: '#0F172A',
            yAxisId: 'left',
            showInLegend: false,
            showInTooltip: false,
            strokeWidth: 0,
            dot: {
              r: 5.5,
              stroke: '#FFFFFF',
              strokeWidth: 2.5,
              fill: '#0F172A',
            },
            activeDot: {
              r: 6,
              stroke: '#FFFFFF',
              strokeWidth: 2.5,
              fill: '#0F172A',
            },
            connectNulls: false,
          },
        ]}
        xAxisKey="year"
        xAxisType="number"
        xAxisDomain={[0, 30]}
        xAxisTicks={[0, 5, 10, 15, 20, 25, 30]}
        xAxisTickFormatter={(value) => `${Number(value)}`}
        xAxisConfig={getScenarioXAxisLayout('Years')}
        xAxisLabel="Years"
        yAxisLabel="Net equity ($)"
        tooltipContent={renderEquityCashFlowTooltip}
        height={320}
      />
    </GraphPanel>
  ) : null

  const scenarioAssumptionsSection = (
    <section className="mt-5 rounded-[2rem] border border-gray-100 bg-white p-4 shadow-sm shadow-gray-100/70">
      <div className="rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
          Confidence
        </p>
        <p className="mt-1 text-base font-semibold text-gray-900">
          {getConfidenceSummary(scenarioModel.confidence?.score || 0)}
        </p>
      </div>

      <details className="group mt-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white px-4 py-3 marker:hidden">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Scenario assumptions
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Adjust deposit strategy and debt rate assumptions to see how outcomes change.
            </p>
          </div>
          <ChevronRight
            size={18}
            className="shrink-0 text-gray-400 transition-transform duration-300 group-open:rotate-90"
          />
        </summary>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <label className="block rounded-2xl border border-gray-100 bg-white p-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Deposit strategy
            </span>
            <select
              value={selectedDepositStrategy.value}
              onChange={(event) => setDepositStrategy(event.target.value || '20')}
              className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-primary-300"
            >
              {DEPOSIT_STRATEGY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                Interest rate assumption
              </span>
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
                className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-primary-300"
              />
            </label>
            <p className="mt-2 text-sm text-gray-500">
              Adjust the assumed debt rate to see how scenario outcomes change.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {INTEREST_RATE_QUICK_PICKS.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => {
                    setSelectedInterestRate(rate)
                    setInterestRateInput(rate.toFixed(1))
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    Math.abs(effectiveInterestRate - rate) < 0.001
                      ? 'border-primary-200 bg-primary-50 text-primary-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {rate.toFixed(1)}%
                </button>
              ))}
            </div>
          </div>
        </div>
      </details>
      {selectedDepositStrategy.depositRatio < 0.2 ? (
        <div className="mt-4 flex flex-col gap-1 text-sm text-amber-700 md:flex-row md:items-center md:justify-between">
          <p>Indicative only - actual LMI depends on lender, LVR, and borrower profile.</p>
          <p>Lower deposits increase leverage, repayments, and risk.</p>
        </div>
      ) : null}
    </section>
  )
  const showInlineRecommendedWealthSection = false

  // Keep the primary-graph selection logic available even though advanced analysis now owns graph rendering.
  void primaryGraphKey
  void equityCashFlowTradeOffChart

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading growth scenarios...</div>
      </div>
    )
  }

  return (
    <PortfolioGrowthScenariosPremiumView
      hero={{
        eyebrow: 'Growth scenarios',
        title: 'Portfolio Growth Scenarios',
        description:
          'These scenarios show how current borrowing headroom and deployable equity can be deployed into the next acquisition path using only the data already stored in Equifolio.',
        kpis: [
          {
            label: 'Borrowing capacity',
            value: formatCurrency(scenarioModel.inputs.borrowingCapacity || 0),
          },
          {
            label: 'Available capital',
            value: formatCurrency(
              scenarioModel?.inputs?.totalDeployableCapital ??
                scenarioModel?.viability?.availableCapital ??
                0
            ),
          },
          {
            label: 'Limiting factor',
            value:
              scenarioModel?.viability?.limitingFactor === 'capital'
                ? 'Equity / cash'
                : scenarioModel?.viability?.limitingFactor === 'borrowing'
                  ? 'Borrowing capacity'
                  : 'Balanced',
            helper: scenarioModel?.viability?.message || null,
            tone:
              scenarioModel?.viability?.limitingFactor === 'capital'
                ? 'caution'
                : scenarioModel?.viability?.limitingFactor === 'borrowing'
                  ? 'danger'
                  : 'neutral',
          },
        ],
      }}
      scenarioCards={
        scenarioModel.recommendedStrategy
          ? [
              {
                badge: 'Suggested',
                title: topSuggestedScenario?.title || 'Buy 1 larger property',
                description:
                  topSuggestedScenario?.stateSummary ||
                  topSuggestedScenario?.rationale ||
                  topSuggestedScenario?.feasibilityMessage ||
                  'Based on your current position and selected assumptions',
                tone: 'suggested',
                metrics: [
                  {
                    label: '5Y equity',
                    value: formatCurrency(topSuggestedScenario?.fiveYearEquityProjection || 0),
                  },
                  {
                    label: 'Purchase price',
                    value: formatCurrency(topSuggestedScenario?.scenarioPurchasePrice || 0),
                  },
                  {
                    label: 'Monthly cost',
                    value: `${Number(topSuggestedScenario?.estimatedMonthlyCashFlow || 0) >= 0 ? '+' : '-'}${formatCurrency(
                      Math.abs(Number(topSuggestedScenario?.estimatedMonthlyCashFlow || 0))
                    )}/month`,
                  },
                  {
                    label: 'Yield',
                    value: `${Number(topSuggestedScenario?.estimatedGrossYield || 0).toFixed(1)}% gross`,
                  },
                ],
                footer:
                  Number(topSuggestedScenario?.requiredCapitalGap || 0) > 0
                    ? `Capital shortfall: ${formatCurrency(topSuggestedScenario?.requiredCapitalGap || 0)}`
                    : topSuggestedScenario?.feasibilityMessage ||
                      topSuggestedScenario?.stateSummary ||
                      topSuggestedScenario?.rationale ||
                      'Fully funded based on current inputs',
              },
              topAlternativeScenario
                ? {
                    badge:
                      String(topAlternativeScenario?.scenarioStateLabel || '').toLowerCase() ===
                      'blocked'
                        ? 'Blocked'
                        : 'Alternative',
                    title: topAlternativeScenario?.title || 'Additional scenario',
                    description:
                      topAlternativeScenario?.blockedExplanation ||
                      topAlternativeScenario?.stateSummary ||
                      topAlternativeScenario?.rationale ||
                      topAlternativeScenario?.feasibilityMessage,
                    tone:
                      String(topAlternativeScenario?.scenarioStateLabel || '').toLowerCase() ===
                      'blocked'
                        ? 'blocked'
                        : 'alternative',
                    metrics: [
                      {
                        label: '5Y equity',
                        value: formatCurrency(topAlternativeScenario?.fiveYearEquityProjection || 0),
                      },
                      {
                        label: 'Purchase price',
                        value: formatCurrency(topAlternativeScenario?.scenarioPurchasePrice || 0),
                      },
                      {
                        label: 'Monthly cost',
                        value: `${Number(topAlternativeScenario?.estimatedMonthlyCashFlow || 0) >= 0 ? '+' : '-'}${formatCurrency(
                          Math.abs(Number(topAlternativeScenario?.estimatedMonthlyCashFlow || 0))
                        )}/month`,
                      },
                      {
                        label: 'Yield',
                        value: `${Number(topAlternativeScenario?.estimatedGrossYield || 0).toFixed(1)}% gross`,
                      },
                    ],
                    footer:
                      topAlternativeScenario?.blockedReason ||
                      topAlternativeScenario?.feasibilityMessage ||
                      topAlternativeScenario?.stateSummary ||
                      topAlternativeScenario?.rationale,
                  }
                : {
                    badge: 'Alternative',
                    title: 'Additional scenario',
                    description:
                      'Alternative scenario preview will appear when another computed scenario is available.',
                    tone: 'neutral',
                    metrics: [],
                    footer: 'Waiting for an additional computed scenario',
                  },
            ]
          : []
      }
      summaryStrip={{
        eyebrow: 'Scenario summary',
        title:
          scenarioModel.recommendedStrategy && recommendedScenario && recommendedNextMoveSummary
            ? `Estimated equity growth: ~${formatCurrency(
                recommendedNextMoveSummary.fiveYearEquity
              )} over 5 years`
            : scenarioModel.viability?.message || 'Scenario overview',
        description:
          scenarioModel.recommendedStrategy && recommendedScenario
            ? 'Based on your current position, borrowing capacity, and selected assumptions'
            : 'Current purchase capacity based on the inputs already available in Equifolio.',
        metrics:
          scenarioModel.recommendedStrategy && recommendedScenario
            ? [
                {
                  label: 'Purchase price',
                  value:
                    recommendedScenarioAnchorPrice !== null
                      ? formatCurrency(recommendedScenarioAnchorPrice)
                      : 'Unavailable',
                },
                {
                  label: 'Loan amount',
                  value:
                    recommendedScenarioLoanAmount !== null
                      ? formatCurrency(recommendedScenarioLoanAmount)
                      : 'Unavailable',
                },
                {
                  label: 'Deposit %',
                  value:
                    recommendedScenarioDepositPct !== null
                      ? `${recommendedScenarioDepositPct.toFixed(0)}%`
                      : 'Unavailable',
                  helper:
                    baselineCapitalGap > 0
                      ? 'Additional funding required'
                      : 'Fully funded based on your inputs',
                  tone: baselineCapitalGap > 0 ? 'caution' : 'success',
                },
              ]
            : [
                {
                  label: 'Borrowing capacity',
                  value: formatCurrency(scenarioModel.inputs.borrowingCapacity || 0),
                },
                {
                  label: 'Available capital',
                  value: formatCurrency(scenarioModel.inputs.totalDeployableCapital || 0),
                },
                {
                  label: 'Additional capital required',
                  value: formatCurrency(baselineCapitalGap),
                },
              ],
      }}
      tabs={[
        { id: 'wealth-growth', label: 'Wealth growth' },
        { id: 'funding', label: 'Funding' },
        { id: 'tax-cash-flow', label: 'Tax & cash flow' },
      ]}
      activeTab={activePremiumTab}
      onTabChange={setActivePremiumTab}
      wealthTab={{
        title: 'How your wealth grows over time',
        description: recommendedScenario
          ? `Illustrative projection based on assumed growth and loan conditions. 5-year equity: ~${formatCurrency(
              fiveYearEquitySourceOfTruth
            )}.`
          : 'Illustrative projection based on the currently selected scenario.',
        chart: equityCashFlowTradeOffChart,
      }}
      fundingTab={{
        eyebrow: 'Funding',
        title: 'How this is funded',
        description:
          'Available capital, required capital, and any remaining shortfall using the current scenario assumptions.',
        cards: [
          {
            label: 'Available capital',
            value: formatCurrency(recommendedAvailableCapital + appliedSavingsToGap),
            helper: 'Usable equity plus allocated savings',
            tone: 'positive',
            connector: '→',
          },
          {
            label: 'Required capital',
            value: formatCurrency(
              recommendedWealthBreakdown?.totalRequiredCapital ?? recommendedTotalRequiredCapital
            ),
            helper: 'Deposit and acquisition costs',
            tone: 'neutral',
            connector: '→',
          },
          {
            label: 'Shortfall',
            value: formatCurrency(remainingCapitalGap),
            helper:
              remainingCapitalGap > 0
                ? 'Additional capital still required'
                : 'No additional upfront cash required based on current inputs',
            tone: remainingCapitalGap > 0 ? 'danger' : 'positive',
          },
        ],
        children: (
          <>
            {recommendedWealthBreakdown ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  This scenario uses your existing equity and allocated savings.
                </p>
                <ScenarioFundingBreakdown
                  scenario={recommendedScenario}
                  summaryText="View detailed breakdown"
                />
              </div>
            ) : null}
          </>
        ),
      }}
      taxTab={{
        eyebrow: 'Tax & cash flow',
        title: 'Tax & cash flow',
        description: 'Monthly cost story based on the currently calculated tax-aware scenario values.',
        cards: recommendedScenarioSafeTaxView
          ? [
              {
                label: 'Pre-tax',
                value: `${recommendedScenarioSafeTaxView.monthlyPreTaxPropertyCashFlow >= 0 ? '+' : '-'}${formatCurrency(
                  Math.abs(recommendedScenarioSafeTaxView.monthlyPreTaxPropertyCashFlow)
                )}`,
                unit: 'per month',
                helper: 'Monthly property result before tax is applied.',
                tone: 'neutral',
                connector: '+',
              },
              {
                label: 'ATO benefit',
                value: `+${formatCurrency(recommendedScenarioSafeTaxView.totalTaxBenefitMonthly)}`,
                unit: 'per month',
                helper: 'Indicative tax offset based on current ownership and income inputs.',
                tone: 'positive',
                connector: '=',
              },
              {
                label: 'Net cost',
                value: `${recommendedScenarioSafeTaxView.afterTaxMonthlyImpact >= 0 ? '+' : '-'}${formatCurrency(
                  Math.abs(recommendedScenarioSafeTaxView.afterTaxMonthlyImpact)
                )}`,
                unit: 'per month',
                helper: 'Estimated monthly cost after tax is taken into account.',
                tone: 'caution',
              },
            ]
          : [
              {
                label: 'Pre-tax',
                value: `${Number(recommendedScenario?.estimatedMonthlyCashFlow || 0) >= 0 ? '+' : '-'}${formatCurrency(
                  Math.abs(Number(recommendedScenario?.estimatedMonthlyCashFlow || 0))
                )}`,
                unit: 'per month',
                helper: 'Monthly property result before tax is applied.',
                tone: 'neutral',
                connector: '+',
              },
              {
                label: 'ATO benefit',
                value: formatCurrency(0),
                unit: 'per month',
                helper: 'Add ownership and income details to estimate tax benefit.',
                tone: 'positive',
                connector: '=',
              },
              {
                label: 'Net cost',
                value: `${Number(recommendedScenario?.estimatedMonthlyCashFlow || 0) >= 0 ? '+' : '-'}${formatCurrency(
                  Math.abs(Number(recommendedScenario?.estimatedMonthlyCashFlow || 0))
                )}`,
                unit: 'per month',
                helper: 'Current monthly impact without a completed tax estimate.',
                tone: 'caution',
              },
            ],
        assumptionsLine: taxTraceability,
        children: (
          <div className="space-y-6">
            <details className="rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
              <summary className="cursor-pointer list-none text-sm font-medium text-gray-700 marker:hidden">
                View tax settings
              </summary>
              <TaxAssumptionsContent
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
              <DepreciationControls
                includeDepreciation={includeDepreciation}
                annualDepreciationInput={annualDepreciationInput}
                annualDepreciation={annualDepreciation}
                onIncludeDepreciationChange={setIncludeDepreciation}
                onAnnualDepreciationChange={handleAnnualDepreciationChange}
              />
            </details>
            <MonthlyCashFlowBreakdown
              scenario={recommendedScenario}
              taxOwnership={taxOwnership}
              includeDepreciation={includeDepreciation}
              annualDepreciation={annualDepreciation}
            />
          </div>
        ),
      }}
      assumptionsSection={{
        eyebrow: 'Scenario assumptions',
        title: 'What this scenario assumes',
        description: 'Adjust deposit strategy and debt rate assumptions to see how outcomes change.',
        content: scenarioAssumptionsSection?.props?.children ?? scenarioAssumptionsSection,
      }}
      advancedAnalysis={{
        title: 'Advanced analysis',
        description:
          'Explore how changes in rates, deposits, and borrowing assumptions affect this scenario.',
        toggleLabel: 'Show advanced analysis',
        isOpen: isAdvancedAnalysisOpen,
        onToggle: setIsAdvancedAnalysisOpen,
        content: (
          <>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Borrowing capacity sensitivity
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  See how borrowing capacity changes across different interest rates
                </p>
              </div>
              {borrowingSensitivityChart}
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Interest rate stress test
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  See how higher rates affect serviceability and funding pressure
                </p>
              </div>
              {stressTestChart}
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Deposit vs purchase power
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  See how deposit levels affect the purchase range this scenario can support
                </p>
              </div>
              {depositPurchasePowerChart}
            </div>
          </>
        ),
      }}
    />
  )
}
function getBlockedStrategyAction(strategy) {
  const reason = String(strategy?.reason || '').toLowerCase()

  if (reason.includes('market price')) {
    return 'Increase capital or explore a stronger single-property scenario first'
  }

  if (reason.includes('deposit')) {
    return 'Build more deposit capital or unlock additional equity'
  }

  if (reason.includes('borrowing')) {
    return 'Improve serviceability before taking on this loan size'
  }

  return 'Strengthen capital or borrowing capacity before retrying this path'
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
      {preface ? <p className="mb-3 text-sm leading-6 text-gray-600">{preface}</p> : null}
      {children}
      {insight ? <ChartInsight text={insight} /> : null}
      {traceability ? <AssumptionTrace text={traceability} /> : null}
      {note ? <p className="mt-2 text-xs text-gray-500">{note}</p> : null}
      {confidenceLabel ? (
        <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-gray-400">
          Confidence: {confidenceLabel}
        </p>
      ) : null}
      {warning ? <p className="mt-2 text-sm leading-6 text-amber-700">{warning}</p> : null}
    </div>
  )
}

function ChartInsight({ text }) {
  if (!text) return null

  return <p className="mt-4 text-sm leading-6 text-gray-600">{text}</p>
}

function AssumptionTrace({ text, className = '' }) {
  if (!text) return null

  return <p className={`${className} mt-2 text-xs leading-5 text-gray-500`.trim()}>{text}</p>
}

function HeaderMetric({ label, value }) {
  return (
    <div className="py-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-gray-900">{value}</p>
    </div>
  )
}

function OutcomeMetric({ label, value, forcePositive = false, emphasis = false }) {
  const safeValue = Number(value || 0)
  const displayValue = forcePositive ? Math.abs(safeValue) : safeValue

  return (
    <div className="py-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
        {label}
      </p>
      <p className={`mt-1 tracking-tight text-gray-900 ${emphasis ? 'text-xl font-bold' : 'text-lg font-semibold'}`}>
        {`${displayValue >= 0 ? '+' : '-'}${formatCurrency(Math.abs(displayValue))}`}
      </p>
    </div>
  )
}

function ScenarioMetric({ label, value }) {
  return (
    <div className="py-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold tracking-tight text-gray-900">{value}</p>
    </div>
  )
}

function BreakdownBlock({ title, rows }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
        {title}
      </p>
      <div className="mt-3 space-y-3">
        {rows.map(([label, value]) => (
          <div key={`${title}-${label}`} className="flex items-start justify-between gap-3">
            <span className="text-sm text-gray-500">{label}</span>
            <span className="text-right text-sm font-semibold text-gray-900">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScenarioFundingBreakdown({ scenario, summaryText = 'View funding breakdown', className = '' }) {
  if (!scenario) return null

  const totalRequiredCapital = Number(scenario.depositRequired || 0) + Number(scenario.estimatedAcquisitionCosts || 0)
  const usableEquityAfterBuffer = Number(scenario.usableEquityAfterBuffer || 0)
  const allocatedCash = Number(scenario.allocatedCash || 0)
  const totalAvailableCapital = Number(scenario.deployableCapital || 0)
  const capitalDelta = totalAvailableCapital - totalRequiredCapital
  const hasCapitalSurplus = capitalDelta >= 0

  return (
    <details className={`${className} rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3`.trim()}>
      <summary className="cursor-pointer list-none text-sm text-gray-600 marker:hidden">
        {summaryText}
        <span className="ml-2 font-semibold text-primary-700">View breakdown ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¾</span>
      </summary>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
            Purchase assumptions
          </p>
          <div className="mt-3 space-y-3">
            <BreakdownRow label="Target purchase price" value={scenario.purchaseStructure?.targetPrice ?? formatCurrency(0)} />
            <BreakdownRow label="Deposit strategy" value={scenario.purchaseStructure?.depositPct ?? '0%'} />
            <BreakdownRow label="Number of properties" value={String(scenario.propertyCount || 0)} />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
            Funding required
          </p>
          <div className="mt-3 space-y-3">
            <BreakdownRow label="Deposit required" value={formatCurrency(scenario.depositRequired)} />
            <BreakdownRow label="Acquisition costs" value={formatCurrency(scenario.estimatedAcquisitionCosts)} />
            <BreakdownRow label="Total required capital" value={formatCurrency(totalRequiredCapital)} strong />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
            Funding available
          </p>
          <div className="mt-3 space-y-3">
            <BreakdownRow label="Usable equity" value={formatCurrency(usableEquityAfterBuffer)} />
            <BreakdownRow label="Allocated cash" value={formatCurrency(allocatedCash)} />
            <BreakdownRow label="Total available capital" value={formatCurrency(totalAvailableCapital)} strong />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
            Result
          </p>
          <div className="mt-3 space-y-3">
            <BreakdownRow
              label={hasCapitalSurplus ? 'Capital surplus' : 'Capital shortfall'}
              value={formatCurrency(Math.abs(capitalDelta))}
              strong
            />
          </div>
        </div>
      </div>
    </details>
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
    <details className={`${className} rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3`.trim()}>
      <summary className="cursor-pointer list-none text-sm font-medium text-gray-700 marker:hidden">
        View monthly cash flow breakdown
      </summary>
      <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4">
        {scenarioPurchasePrice !== null && scenarioLoanAmount !== null ? (
          <p className="mb-4 text-sm text-gray-600">
            Based on ~{formatCurrency(scenarioPurchasePrice)} purchase price with{' '}
            {formatCurrency(scenarioLoanAmount)} loan at {scenarioRatePct.toFixed(1)}%
          </p>
        ) : null}
        <AssumptionTrace
          text={`Inputs used: rent, loan repayment, and property expenses ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· Assumptions: ${repaymentTypeLabel} repayment at ${scenarioRatePct.toFixed(
            1
          )}% and structured expense allowances`}
          className="mb-4"
        />
        <div className="space-y-3">
          <BreakdownRow label="Rent" value={formatCurrency(monthlyRent)} />
          <BreakdownRow
            label={`Loan repayment (${repaymentTypeLabel} @ ${scenarioRatePct.toFixed(1)}%)`}
            value={`-${formatCurrency(Math.abs(monthlyRepayment))}`}
          />
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
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
            <p className="mt-3 text-xs text-gray-500">
              Assumptions: Property management {((Number(expenseBreakdown.assumptions?.propertyManagementRate || 0)) * 100).toFixed(1)}% of rent, vacancy buffer {((Number(expenseBreakdown.assumptions?.vacancyBufferRate || 0)) * 100).toFixed(1)}% of rent, council + water {formatCurrency(expenseBreakdown.assumptions?.councilWaterMonthly || 0)}/month, insurance {formatCurrency(expenseBreakdown.assumptions?.insuranceMonthly || 0)}/month, maintenance {((Number(expenseBreakdown.assumptions?.maintenanceAnnualRate || 0)) * 100).toFixed(1)}% of property value / year.
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
              <p className="text-xs text-gray-500">
                Tax benefit is estimated from current income and Australian tax brackets.
              </p>
              {includeDepreciation && getSafeNumber(negativeGearing?.depreciationTaxBenefitMonthly) !== null ? (
                <p className="text-xs text-gray-500">
                  Depreciation adds an estimated +{formatCurrency(
                    negativeGearing.depreciationTaxBenefitMonthly
                  )}/month to tax benefit.
                </p>
              ) : null}
            </>
          ) : hasTaxableIncome ? (
            <p className="text-xs text-gray-500">
              Tax estimate unavailable until ownership inputs are complete.
            </p>
          ) : (
            <p className="text-xs text-gray-500">
              Add income to estimate tax benefit
            </p>
          )}
        </div>
      </div>
    </details>
  )
}

function BreakdownRow({ label, value, strong = false, helper = null }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <span className={`text-sm ${strong ? 'font-medium text-gray-700' : 'text-gray-500'}`}>
          {label}
        </span>
        {helper ? <p className="mt-1 text-xs text-gray-500">{helper}</p> : null}
      </div>
      <span className={`text-right text-sm ${strong ? 'font-semibold text-gray-900' : 'font-medium text-gray-900'}`}>
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
}) {
  return (
    <div className="mt-3 space-y-2 text-xs text-gray-600">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm text-gray-500">Ownership</span>
        <select
          value={ownershipStructure}
          onChange={(event) => onOwnershipStructureChange(event.target.value)}
          className="min-w-[10rem] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="individual">Individual</option>
          <option value="joint">Joint ownership</option>
        </select>
      </div>
      {ownershipStructure === 'joint' ? (
        <div className="space-y-3">
          <BreakdownRow
            label="Split"
            value={`${ownershipSplitUserInput || '0'} / ${ownershipSplitPartnerInput || '0'}`}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-gray-500">User %</label>
              <input
                type="text"
                inputMode="decimal"
                value={ownershipSplitUserInput}
                onChange={(event) => onOwnershipSplitUserChange(event.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-500">Partner %</label>
              <input
                type="text"
                inputMode="decimal"
                value={ownershipSplitPartnerInput}
                onChange={(event) => onOwnershipSplitPartnerChange(event.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
        <BreakdownRow label="Split" value="100 / 0" />
      )}
      <BreakdownRow label="Income source basis" value={taxIncomeBasisLabel} />
      <BreakdownRow label="Tax regime" value="Australian resident individual" />
      <BreakdownRow
        label="Depreciation"
        value={
          includeDepreciation
            ? `Included (${formatCurrency(annualDepreciation)}/year)`
            : 'Not included'
        }
      />
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
    <div className="mt-3 rounded-xl border border-gray-100 bg-white px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">
        Depreciation (optional)
      </p>
      <label className="mt-3 flex items-center justify-between gap-3 text-sm text-gray-700">
        <span>Include non-cash depreciation to improve your tax position</span>
        <input
          type="checkbox"
          checked={includeDepreciation}
          onChange={(event) => onIncludeDepreciationChange(event.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
      </label>
      {includeDepreciation ? (
        <div className="mt-3">
          <label className="mb-1 block text-sm text-gray-500">
            Annual depreciation estimate
          </label>
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
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p className="mt-2 text-xs text-gray-500">
            Typical range: $3,000-$10,000 depending on property
          </p>
          {showHighDepreciationWarning ? (
            <p className="mt-2 text-xs text-amber-700">
              High depreciation - ensure this reflects a new or recently built property
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}



