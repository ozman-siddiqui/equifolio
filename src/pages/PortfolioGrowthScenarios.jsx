import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronRight, Landmark } from 'lucide-react'

import useFinancialData from '../hooks/useFinancialData'
import usePortfolioData from '../hooks/usePortfolioData'
import calculateBorrowingPower from '../lib/borrowingPowerEngine'
import buildPortfolioGrowthScenarios from '../lib/portfolioGrowthScenarios'
import PremiumProjectionChart from '../components/charts/PremiumProjectionChart'

const DEPOSIT_STRATEGY_OPTIONS = [
  { value: '20', label: '20% deposit (default)', depositRatio: 0.2 },
  { value: '10', label: '10% deposit + LMI', depositRatio: 0.1 },
  { value: '5', label: '5% deposit + LMI', depositRatio: 0.05 },
]
const INTEREST_RATE_QUICK_PICKS = [5.8, 6.5, 7.0, 8.0]
const DEPOSIT_PURCHASE_POWER_LEVELS = [5, 10, 15, 20, 25]
const STRESS_TEST_RATES = [5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5]

function getConfidenceLabel(score) {
  if (score >= 85) return 'High'
  if (score >= 65) return 'Medium'
  return 'Low'
}

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))

function clampCashToDeploy(value, maxCashAvailableForInvestment) {
  const numericValue = Number(value)
  const safeMax = Number.isFinite(Number(maxCashAvailableForInvestment))
    ? Math.max(0, Number(maxCashAvailableForInvestment))
    : 0

  if (!Number.isFinite(numericValue)) return 0
  return Math.min(safeMax, Math.max(0, numericValue))
}

function normalizeInterestRateInput(value, fallback) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return fallback
  return Math.min(15, Math.max(0, numericValue))
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

export default function PortfolioGrowthScenarios() {
  const navigate = useNavigate()
  const { properties, loans, transactions, loading } = usePortfolioData()
  const { financialProfile, liabilities } = useFinancialData()
  const rawAvailableCashForInvestment =
    financialProfile?.cash_available_for_investment ?? 0
  const maxCashAvailableForInvestment = Number.isFinite(Number(rawAvailableCashForInvestment))
    ? Math.max(0, Number(rawAvailableCashForInvestment))
    : 0
  const [cashToDeploy, setCashToDeploy] = useState(0)
  const [depositStrategy, setDepositStrategy] = useState('20')
  const [selectedInterestRate, setSelectedInterestRate] = useState(null)
  const [interestRateInput, setInterestRateInput] = useState('')
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

    if (!validRates.length) return 6.2
    return validRates.reduce((sum, rate) => sum + rate, 0) / validRates.length
  }, [loans])
  const effectiveInterestRate = normalizeInterestRateInput(
    selectedInterestRate,
    defaultInterestRate
  )

  const scenarioModel = useMemo(
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
      depositStrategy: selectedDepositStrategy.value,
      depositRatio: selectedDepositStrategy.depositRatio,
      selectedInterestRate,
      effectiveInterestRate,
      defaultInterestRate,
      interestRateInput,
      isSliderDisabled,
      isInputDisabled: false,
      totalDeployableCapital: scenarioModel.inputs?.totalDeployableCapital ?? 0,
      scenarioInputs: scenarioModel.inputs,
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
    }),
    [
      rawAvailableCashForInvestment,
      maxCashAvailableForInvestment,
      cashToDeploy,
      effectiveCashToDeploy,
      isSliderDisabled,
      scenarioModel,
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

    console.debug('Equifolio growth cash allocation debug', {
      rawEquity: scenarioDebug.rawEquity,
      totalPortfolioValue,
      totalPortfolioDebt,
      equityBeforeBuffer: usableEquity,
      safetyBuffer: scenarioModel.assumptions?.liquidityBuffer ?? 0,
      usableEquityAfterBuffer: scenarioModel.inputs?.usableEquityAfterBuffer ?? 0,
      cashToDeploy: effectiveCashToDeploy,
      depositStrategy: selectedDepositStrategy.value,
      depositRatio: selectedDepositStrategy.depositRatio,
      selectedInterestRate,
      effectiveInterestRate,
      defaultInterestRate,
      totalDeployableCapital: scenarioModel.inputs?.totalDeployableCapital ?? 0,
      maxCashAvailableForInvestment,
      slider: {
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
        scenarioCount: scenarioModel.scenarios.length,
      },
    })
  }, [
    effectiveCashToDeploy,
    effectiveInterestRate,
    maxCashAvailableForInvestment,
    scenarioModel.scenarios.length,
    scenarioModel.assumptions,
    scenarioModel.inputs,
    scenarioDebug,
    defaultInterestRate,
    interestRateInput,
    selectedDepositStrategy.depositRatio,
    selectedDepositStrategy.value,
    selectedInterestRate,
    totalPortfolioDebt,
    totalPortfolioValue,
    usableEquity,
  ])

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

    const borrowingAtSelectedRate = calculateBorrowingPower({
      financialProfile,
      liabilities,
      loans,
      transactions,
      config: {
        assessmentRatePct: effectiveInterestRate,
      },
    })
    const borrowingCapacity = Number(borrowingAtSelectedRate?.borrowing_power_estimate || 0)
    const totalDeployableCapital = Number(scenarioModel.inputs?.totalDeployableCapital || 0)
    const selectedDepositPct = Math.round(selectedDepositStrategy.depositRatio * 100)
    const recommendedDepositPct = Math.round(
      Number(scenarioModel.assumptions?.depositRatio || selectedDepositStrategy.depositRatio) * 100
    )

    return DEPOSIT_PURCHASE_POWER_LEVELS.map((depositPct) => {
      const depositRatio = depositPct / 100
      const targetLvr = Math.max(0, 1 - depositRatio)
      const borrowingConstrainedPrice =
        targetLvr > 0 ? borrowingCapacity / targetLvr : 0
      const capitalConstrainedPrice =
        depositRatio > 0
          ? totalDeployableCapital / depositRatio
          : 0
      const maxPurchasePrice = Math.max(
        0,
        Math.min(borrowingConstrainedPrice, capitalConstrainedPrice)
      )
      const limitingFactor =
        capitalConstrainedPrice <= borrowingConstrainedPrice
          ? 'Capital limited'
          : 'Borrowing limited'

      return {
        depositPct,
        depositLabel: `${depositPct}%`,
        maxPurchasePrice: Math.round(maxPurchasePrice),
        requiredDeposit: Math.round(maxPurchasePrice * depositRatio),
        loanSize: Math.round(maxPurchasePrice * targetLvr),
        limitingFactor,
        capitalConstrainedPrice: Math.round(capitalConstrainedPrice),
        borrowingConstrainedPrice: Math.round(borrowingConstrainedPrice),
        currentSelectionMarker:
          depositPct === selectedDepositPct ? Math.round(maxPurchasePrice) : null,
        recommendedMarker:
          depositPct === recommendedDepositPct && recommendedDepositPct !== selectedDepositPct
            ? Math.round(maxPurchasePrice)
            : null,
      }
    })
  }, [
    effectiveInterestRate,
    financialProfile,
    liabilities,
    loans,
    scenarioModel.assumptions,
    scenarioModel.inputs,
    scenarioModel.recommendedStrategy,
    selectedDepositStrategy.depositRatio,
    transactions,
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
  const selectedDepositPurchasePoint = useMemo(
    () =>
      depositPurchasePowerData.find(
        (point) => point.depositPct === Math.round(selectedDepositStrategy.depositRatio * 100)
      ) || depositPurchasePowerData[0],
    [depositPurchasePowerData, selectedDepositStrategy.depositRatio]
  )
  const depositPurchaseInsight = useMemo(() => {
    if (!selectedDepositPurchasePoint) return null
    return `Your purchase is primarily constrained by ${String(
      selectedDepositPurchasePoint.limitingFactor || 'Borrowing limited'
    ).toLowerCase()}.`
  }, [selectedDepositPurchasePoint])
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
        initialCapital,
      }
    })
  }, [recommendedScenario])
  const equityCashFlowInsight = useMemo(() => {
    if (!recommendedScenario || !equityCashFlowTradeOffData.length) return null

    const fiveYearPoint =
      equityCashFlowTradeOffData.find((point) => Number(point.year) === 5) ||
      equityCashFlowTradeOffData[Math.min(5, equityCashFlowTradeOffData.length - 1)]
    const fiveYearEquity = Number(fiveYearPoint?.netEquity || 0)
    const monthlyCashFlow = Number(recommendedScenario.estimatedMonthlyCashFlow || 0)

    if (monthlyCashFlow < 0) {
      return `This strategy builds ~${formatCurrency(
        fiveYearEquity
      )} equity in 5 years but costs ~${formatCurrency(Math.abs(monthlyCashFlow))}/month.`
    }

    return `This strategy generates ~${formatCurrency(
      monthlyCashFlow
    )}/month while building ~${formatCurrency(fiveYearEquity)} equity.`
  }, [equityCashFlowTradeOffData, recommendedScenario])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading growth scenarios...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl px-4 py-8">
        <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm shadow-gray-100/70 md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
            Growth Scenarios
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            Portfolio Growth Scenarios
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600 md:text-base">
            These scenarios show how current borrowing headroom and deployable equity can be
            deployed into the next acquisition path using only the data already stored in Equifolio.
          </p>
        </section>

        <section className="mt-5 rounded-3xl border border-gray-100 bg-white px-5 py-4 shadow-sm shadow-gray-100/70">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <HeaderMetric label="Current capacity" value={formatCurrency(scenarioModel.inputs.borrowingCapacity || 0)} />
            <HeaderMetric
              label="Usable equity (after buffer)"
              value={formatCurrency(scenarioModel.inputs.usableEquityAfterBuffer || 0)}
            />
            <HeaderMetric label="Cash to deploy" value={formatCurrency(effectiveCashToDeploy)} />
            <HeaderMetric label="Total deployable capital" value={formatCurrency(scenarioModel.inputs.totalDeployableCapital || 0)} />
            <HeaderMetric
              label="Debt rate assumption"
              value={`${Number(scenarioModel.assumptions.interestRatePct || 0).toFixed(1)}%`}
            />
          </div>
          <div className="mt-4 flex flex-col gap-1 text-sm text-gray-500 md:flex-row md:items-center md:justify-between">
            <p>
              Includes a safety buffer to maintain liquidity and protect against unexpected costs.
            </p>
            <p>
              Safety buffer applied: {formatCurrency(scenarioModel.assumptions.liquidityBuffer || 0)}
            </p>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm shadow-gray-100/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                Cash Allocation
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-gray-900">
                Adjust cash allocation
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
                Choose how much available cash to deploy alongside usable equity.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                Confidence
              </p>
              <p className="mt-1 text-base font-semibold text-gray-900">
                {scenarioModel.confidence?.label} ({scenarioModel.confidence?.score || 0}%)
              </p>
            </div>
          </div>

          <div className="mt-5">
            <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-5">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                    Cash to deploy
                  </span>
                  <div className="mt-3">
                    <input
                      type="range"
                      min={0}
                      max={maxCashAvailableForInvestment}
                      step={1000}
                      value={effectiveCashToDeploy}
                      onChange={(event) =>
                        setCashToDeploy(
                          clampCashToDeploy(event.target.value, maxCashAvailableForInvestment)
                        )
                      }
                      disabled={isSliderDisabled}
                      className="w-full disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  {isSliderDisabled ? (
                    <p className="mt-2 text-sm text-gray-500">
                      Add cash in Financials to enable.
                    </p>
                  ) : null}
                </div>
                <label className="block lg:w-[160px]">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                    Cash input
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={maxCashAvailableForInvestment}
                    step={1000}
                    value={effectiveCashToDeploy}
                    onChange={(event) =>
                      setCashToDeploy(
                        clampCashToDeploy(
                          event.target.value === '' ? 0 : event.target.value,
                          maxCashAvailableForInvestment
                        )
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-primary-300"
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                    type="number"
                    min={0}
                    max={15}
                    step={0.05}
                    value={
                      interestRateInput === '' && selectedInterestRate === null
                        ? defaultInterestRate.toFixed(2)
                        : interestRateInput
                    }
                    onChange={(event) => {
                      const nextValue = event.target.value
                      setInterestRateInput(nextValue)

                      if (nextValue === '') return

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
                        setInterestRateInput(fallbackRate.toFixed(2))
                        return
                      }

                      const normalizedValue = normalizeInterestRateInput(
                        parsedValue,
                        defaultInterestRate
                      )
                      setSelectedInterestRate(normalizedValue)
                      setInterestRateInput(normalizedValue.toFixed(2))
                    }}
                    className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-primary-300"
                  />
                </label>
                <p className="mt-2 text-sm text-gray-500">
                  Adjust the assumed debt rate to see how strategy outcomes change.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {INTEREST_RATE_QUICK_PICKS.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => {
                        setSelectedInterestRate(rate)
                        setInterestRateInput(rate.toFixed(2))
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
          </div>
          {selectedDepositStrategy.depositRatio < 0.2 ? (
            <div className="mt-4 flex flex-col gap-1 text-sm text-amber-700 md:flex-row md:items-center md:justify-between">
              <p>Indicative only — actual LMI depends on lender, LVR, and borrower profile.</p>
              <p>Lower deposits increase leverage, repayments, and risk.</p>
            </div>
          ) : null}
        </section>

        {scenarioModel.recommendedStrategy ? (
          <section className="mt-5 rounded-[2rem] border border-primary-100 bg-primary-50/60 p-6 shadow-sm shadow-primary-100/40">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-700">
              Recommended Strategy
            </p>
            <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  Option {scenarioModel.recommendedStrategy.selectedOption}: {scenarioModel.recommendedStrategy.title}
                </h2>
                <div className="mt-4 space-y-2 text-sm text-gray-700">
                  {scenarioModel.recommendedStrategy.reasons.map((reason) => (
                    <p key={reason}>• {reason}</p>
                  ))}
                </div>
              </div>
              <div className="max-w-md">
                <p className="text-sm font-semibold text-gray-900">Trade-offs</p>
                <div className="mt-3 space-y-2 text-sm text-gray-700">
                  {scenarioModel.recommendedStrategy.tradeOffs.map((tradeOff) => (
                    <p key={tradeOff}>• {tradeOff}</p>
                  ))}
                </div>
              </div>
            </div>
            {borrowingSensitivityData.length > 0 ? (
              <div className="mt-6">
                <PremiumProjectionChart
                  title="Borrowing sensitivity"
                  subtitle={`Lenders assess borrowing at buffered rates (~${Number(
                    borrowingAnalysis?.assumptions?.assessment_rate_pct ??
                      borrowingAnalysis?.assumptions_detail?.assessment_rate_pct ??
                      8.5
                  ).toFixed(1)}%), not your actual rate.`}
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
                  xAxisKey="rateLabel"
                  xAxisLabel="Interest rate (%)"
                  yAxisLabel="Borrowing capacity ($)"
                  tooltipLabelTitle="Interest rate"
                  getExtraTooltipRows={(datum) => [
                    {
                      label: 'Serviceability surplus',
                      value: formatCurrency(datum?.serviceabilitySurplus ?? 0),
                    },
                  ]}
                  referenceLines={[
                    {
                      axis: 'x',
                      value: `${Number(
                        borrowingAnalysis?.assumptions?.assessment_rate_pct ??
                          borrowingAnalysis?.assumptions_detail?.assessment_rate_pct ??
                          8.5
                      ).toFixed(1)}%`,
                      label: 'Assessment rate (used for borrowing calculation)',
                      labelPosition: 'insideTopRight',
                      stroke: '#C2410C',
                      strokeDasharray: '5 5',
                    },
                  ]}
                  height={320}
                />
                {borrowingSensitivityInsight ? (
                  <p className="mt-4 text-sm leading-6 text-gray-600">
                    {borrowingSensitivityInsight}
                  </p>
                ) : null}
                {borrowingSensitivityConfidence ? (
                  <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-gray-400">
                    Confidence: {borrowingSensitivityConfidence.label}
                  </p>
                ) : null}
              </div>
            ) : null}
            {depositPurchasePowerData.length > 0 ? (
              <div className="mt-6">
                <PremiumProjectionChart
                  title="Deposit vs purchase power"
                  subtitle="See how deposit strategy changes the maximum property price you can support with current capital and borrowing constraints."
                  data={depositPurchasePowerData}
                  series={[
                    {
                      dataKey: 'maxPurchasePrice',
                      label: 'Purchase power',
                      color: '#0F172A',
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
                      label: 'Recommended point',
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
                  ]}
                  xAxisKey="depositLabel"
                  xAxisLabel="Deposit (%)"
                  yAxisLabel="Purchase power ($)"
                  tooltipLabelTitle="Deposit"
                  getExtraTooltipRows={(datum) => [
                    {
                      label: 'Required deposit',
                      value: formatCurrency(datum?.requiredDeposit ?? 0),
                    },
                    {
                      label: 'Loan size',
                      value: formatCurrency(datum?.loanSize ?? 0),
                    },
                    {
                      label: 'Limiting factor',
                      value: datum?.limitingFactor ?? 'Borrowing limited',
                    },
                  ]}
                  height={320}
                />
                {depositPurchaseInsight ? (
                  <p className="mt-4 text-sm leading-6 text-gray-600">
                    {depositPurchaseInsight}
                  </p>
                ) : null}
              </div>
            ) : null}
            {stressTestData.length > 0 ? (
              <div className="mt-6">
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
                  xAxisLabel="Interest rate (%)"
                  yAxisLabel="Monthly surplus ($)"
                  tooltipLabelTitle="Interest rate"
                  getExtraTooltipRows={(datum) => [
                    {
                      label: 'Monthly surplus',
                      value: formatCurrency(datum?.monthlySurplus ?? 0),
                    },
                    {
                      label: 'Status',
                      value: datum?.statusLabel ?? 'Positive buffer',
                    },
                  ]}
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
                {stressTestInsight ? (
                  <p className="mt-4 text-sm leading-6 text-gray-600">{stressTestInsight}</p>
                ) : null}
                {stressTestConfidence ? (
                  <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-gray-400">
                    Confidence: {stressTestConfidence.label}
                  </p>
                ) : null}
              </div>
            ) : null}
            {equityCashFlowTradeOffData.length > 0 ? (
              <div className="mt-6">
                <PremiumProjectionChart
                  title="Equity vs cash flow trade-off"
                  subtitle="See how long-term equity growth compares with the monthly cash-flow pressure of the recommended path."
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
                    },
                    {
                      dataKey: 'monthlyCashFlow',
                      label: 'Monthly cash flow',
                      color: '#C2410C',
                      yAxisId: 'right',
                    },
                    {
                      dataKey: 'breakEvenMarker',
                      label: 'Break-even cash flow',
                      color: '#2563EB',
                      yAxisId: 'right',
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
                      dataKey: 'inflectionMarker',
                      label: 'Equity inflection',
                      color: '#16A34A',
                      yAxisId: 'left',
                      showInTooltip: false,
                      showInLegend: false,
                      strokeWidth: 0,
                      dot: {
                        r: 5.5,
                        stroke: '#FFFFFF',
                        strokeWidth: 2.5,
                        fill: '#16A34A',
                      },
                      activeDot: false,
                      connectNulls: false,
                    },
                  ]}
                  xAxisKey="year"
                  xAxisLabel="Years"
                  yAxisLabel="Net equity ($)"
                  rightYAxisLabel="Monthly cash flow ($)"
                  tooltipLabelTitle="Year"
                  getExtraTooltipRows={(datum) => [
                    {
                      label: 'Loan balance',
                      value: formatCurrency(datum?.loanBalance ?? 0),
                    },
                  ]}
                  height={320}
                />
                {equityCashFlowInsight ? (
                  <p className="mt-4 text-sm leading-6 text-gray-600">
                    {equityCashFlowInsight}
                  </p>
                ) : null}
                {Number(recommendedScenario?.estimatedMonthlyCashFlow || 0) < -500 ? (
                  <p className="mt-2 text-sm leading-6 text-amber-700">
                    Warning: High negative cash flow may impact borrowing and lifestyle.
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {!scenarioModel.recommendedStrategy && scenarioModel.viability?.message ? (
          <section className="mt-5 rounded-[2rem] border border-amber-100 bg-amber-50/70 p-6 shadow-sm shadow-amber-100/50">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
              Market Feasibility
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900">
              {scenarioModel.viability.message}
            </h2>
            <div className="mt-3 space-y-2 text-sm leading-6 text-gray-700">
              <p>Improve capital, unlock more equity, or strengthen serviceability before targeting a realistic market entry point.</p>
              {scenarioModel.viability?.requiredCapitalForMultiPropertyStrategy > 0 ? (
                <p>
                  Additional capital to unlock a multi-property strategy:{' '}
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(scenarioModel.viability.requiredCapitalForMultiPropertyStrategy)}
                  </span>
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {scenarioModel.viability?.limitingFactor === 'capital' ? (
          <section className="mt-5 rounded-[2rem] border border-amber-100 bg-amber-50/70 p-6 shadow-sm shadow-amber-100/50">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
              Limiting Factor
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900">
              You are limited by capital, not borrowing capacity
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <HeaderMetric label="Borrowing capacity" value={formatCurrency(scenarioModel.inputs.borrowingCapacity || 0)} />
              <HeaderMetric label="Capital available for deposit & costs" value={formatCurrency(scenarioModel.viability?.availableCapital || 0)} />
              <HeaderMetric label="Limiting factor" value="Equity / cash" />
            </div>
            <p className="mt-3 text-sm text-gray-600">
              Used for deposit and acquisition costs — not the full property price.
            </p>
          </section>
        ) : null}

        {scenarioModel.scenarios.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
            {normalizedScenarios.map((scenario, index) => (
              <section
                key={scenario.id}
                className={`rounded-[2rem] border bg-white p-6 shadow-sm shadow-gray-100/70 ${
                  scenarioModel.recommendedStrategy?.id === scenario.id
                    ? 'border-primary-200 ring-1 ring-primary-100'
                    : 'border-gray-100'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                      Option {index + 1}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-gray-900">{scenario.title}</h2>
                  </div>
                  <div className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-wide text-primary-700">You can acquire</p>
                    <p className="mt-1 text-lg font-semibold text-primary-700">
                      {scenario.propertyCount} {scenario.propertyCount === 1 ? 'property' : 'properties'}
                    </p>
                    <p className="mt-1 text-sm text-primary-700">{scenario.recommendedPurchaseRange.label}</p>
                  </div>
                </div>

                <div className="mt-5 grid min-h-[248px] grid-cols-1 gap-3 sm:grid-cols-2">
                  <ScenarioMetric label="Recommended range" value={scenario.recommendedPurchaseRange.label} />
                  <ScenarioMetric label="Stretch range" value={scenario.stretchRange.label || 'Not recommended'} />
                  <ScenarioMetric label="Deposit required" value={formatCurrency(scenario.depositRequired)} />
                  <ScenarioMetric label="Acquisition costs" value={formatCurrency(scenario.estimatedAcquisitionCosts)} />
                  <ScenarioMetric label="Loan size" value={formatCurrency(scenario.estimatedLoanSize)} />
                  <ScenarioMetric
                    label="Post-purchase surplus"
                    value={formatCurrency(scenario.estimatedPostPurchaseSurplus)}
                  />
                  <ScenarioMetric
                    label="Monthly cash flow"
                    value={`${scenario.estimatedMonthlyCashFlow >= 0 ? '+' : '-'}${formatCurrency(
                      Math.abs(scenario.estimatedMonthlyCashFlow)
                    )}/month`}
                  />
                  <ScenarioMetric label="Yield" value={`${scenario.estimatedGrossYield.toFixed(1)}% gross`} />
                  <ScenarioMetric
                    label="5-year equity projection"
                    value={formatCurrency(scenario.fiveYearEquityProjection)}
                  />
                  <ScenarioMetric
                    label="Borrowing capacity after purchase"
                    value={formatCurrency(scenario.borrowingCapacityAfterPurchase)}
                  />
                </div>

                <p className="mt-4 text-sm leading-6 text-gray-600">{scenario.rationale}</p>

                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                      Confidence
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {scenario.confidenceLabel} ({scenario.confidenceScore}%)
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                      Capital used
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {formatCurrency(scenario.depositRequired + scenario.estimatedAcquisitionCosts)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      LMI estimate: {formatCurrency(scenario.lmiEstimate ?? 0)}
                    </p>
                  </div>
                </div>

                {scenario.warnings?.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
                      Warnings
                    </p>
                    <div className="mt-2 space-y-1.5 text-sm text-gray-700">
                      {scenario.warnings.map((warning) => (
                        <p key={warning}>• {warning}</p>
                      ))}
                    </div>
                  </div>
                ) : null}

                {!scenario.isFeasible && scenario.feasibilityMessage ? (
                  <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
                      Not currently feasible
                    </p>
                    <p className="mt-2 text-sm leading-6 text-gray-700">
                      {scenario.feasibilityMessage}
                    </p>
                    {scenario.additionalCapitalRequired > 0 ? (
                      <p className="mt-2 text-sm text-gray-700">
                        Additional capital required to reach realistic entry pricing:{' '}
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(scenario.additionalCapitalRequired)}
                        </span>
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <details className="mt-5 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-900">
                    How this strategy is calculated
                  </summary>

                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <BreakdownBlock
                      title="Capital"
                      rows={[
                        ['Usable equity before buffer', scenario.capitalBreakdown?.usableEquityBeforeBuffer ?? formatCurrency(0)],
                        ['Usable equity after buffer', scenario.capitalBreakdown?.usableEquityAfterBuffer ?? formatCurrency(0)],
                        ['Cash used', scenario.capitalBreakdown?.cashUsed ?? formatCurrency(0)],
                        ['Total capital used', scenario.capitalBreakdown?.totalCapitalUsed ?? formatCurrency(0)],
                        ['Buffer retained', scenario.capitalBreakdown?.bufferRetained ?? formatCurrency(0)],
                        ['Total deployable capital', scenario.capitalBreakdown?.totalDeployableCapital ?? formatCurrency(0)],
                      ]}
                    />
                    <BreakdownBlock
                      title="Purchase Structure"
                      rows={[
                        ['Target price', scenario.purchaseStructure?.targetPrice ?? formatCurrency(0)],
                        ['Deposit (%)', scenario.purchaseStructure?.depositPct ?? '0%'],
                        ['Deposit amount', scenario.purchaseStructure?.depositAmount ?? formatCurrency(0)],
                        ['Acquisition costs', scenario.purchaseStructure?.acquisitionCosts ?? formatCurrency(0)],
                        ['LMI estimate', scenario.purchaseStructure?.lmiEstimate ?? formatCurrency(0)],
                        ['Total capital required', scenario.purchaseStructure?.totalCapitalRequired ?? formatCurrency(0)],
                      ]}
                    />
                    <BreakdownBlock
                      title="Loan Structure"
                      rows={[
                        ['Base loan size', scenario.loanStructure?.baseLoanSize ?? formatCurrency(0)],
                        ['LMI estimate', scenario.loanStructure?.lmiEstimate ?? formatCurrency(0)],
                        ['Loan size', scenario.loanStructure?.loanSize ?? formatCurrency(0)],
                        ['Interest rate assumption', scenario.loanStructure?.interestRate ?? '0.0%'],
                        ['Monthly repayment', scenario.loanStructure?.monthlyRepayment ?? formatCurrency(0)],
                      ]}
                    />
                    <BreakdownBlock
                      title="Cash Flow"
                      rows={[
                        ['Rental income', scenario.cashFlowBreakdown?.rentalIncome ?? `${formatCurrency(0)}/month`],
                        ['Expenses', scenario.cashFlowBreakdown?.expenses ?? `${formatCurrency(0)}/month`],
                        ['Net cash flow', scenario.cashFlowBreakdown?.netCashFlow ?? `${formatCurrency(0)}/month`],
                      ]}
                    />
                    <BreakdownBlock
                      title="Serviceability Impact"
                      rows={[
                        ['Surplus before', scenario.serviceabilityImpact?.surplusBefore ?? formatCurrency(0)],
                        ['Surplus after', scenario.serviceabilityImpact?.surplusAfter ?? formatCurrency(0)],
                        ['Borrowing after purchase', scenario.serviceabilityImpact?.borrowingCapacityAfterPurchase ?? formatCurrency(0)],
                      ]}
                    />
                    <BreakdownBlock
                      title="Growth Assumptions"
                      rows={[
                        ['Growth rate', scenario.growthAssumptions?.growthRate ?? '0.0%'],
                        ['5-year value', scenario.growthAssumptions?.fiveYearValue ?? formatCurrency(0)],
                        ['Equity created', scenario.growthAssumptions?.equityCreated ?? formatCurrency(0)],
                      ]}
                    />
                    <BreakdownBlock
                      title="Constraints"
                      rows={
                        (scenario.constraints || []).length > 0
                          ? scenario.constraints.map((constraint, index) => [
                              `Constraint ${index + 1}`,
                              constraint,
                            ])
                          : [['Status', 'No active cap beyond the core assumptions.']]
                      }
                    />
                  </div>
                </details>

                <details className="mt-4 rounded-2xl border border-gray-100 bg-white p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-900">
                    View projection
                  </summary>

                  <div className="mt-4">
                    <PremiumProjectionChart
                      title="30-Year Projection"
                      subtitle="Projected property value, loan balance, and net equity over time."
                      data={scenario.projectionData}
                      series={[
                        { dataKey: 'propertyValue', label: 'Property value', color: '#0F172A' },
                        { dataKey: 'loanBalance', label: 'Loan balance', color: '#C2410C' },
                        { dataKey: 'netEquity', label: 'Net equity', color: '#2563EB' },
                      ]}
                      height={300}
                    />
                  </div>
                </details>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('/properties')}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
                  >
                    Review portfolio
                    <ChevronRight size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/borrowing-power')}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
                  >
                    View borrowing breakdown
                    <ArrowRight size={15} />
                  </button>
                </div>
              </section>
            ))}
          </div>
        ) : (
          <section className="mt-6 rounded-[2rem] border border-dashed border-gray-200 bg-white p-8 text-center shadow-sm shadow-gray-100/70">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-primary-600">
              <Landmark size={22} />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">Growth scenarios need more deployable capacity</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Record more Financials detail or improve borrowing headroom to unlock acquisition scenarios here.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/financials')}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
              >
                Complete Financials
                <ChevronRight size={15} />
              </button>
              <button
                type="button"
                onClick={() => navigate('/borrowing-power')}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
              >
                Review borrowing position
                <ArrowRight size={15} />
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function HeaderMetric({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function ScenarioMetric({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
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
