import { estimateRepayment } from './mortgageMath'

const DEFAULT_CONFIG = {
  depositRatio: 0.2,
  targetLvr: 0.8,
  acquisitionCostRate: 0.05,
  liquidityBuffer: 25000,
  minimumPostPurchaseSurplus: 1500,
  minimumBorrowingThreshold: 350000,
  realisticMarketEntry: {
    minPrice: 450000,
    maxPrice: 600000,
  },
  lmiRateTable: [
    { minLvr: 0.95, rate: 0.04 },
    { minLvr: 0.9, rate: 0.025 },
    { minLvr: 0.85, rate: 0.0125 },
  ],
  riskModes: {
    growth: { grossYieldPct: 4.4, recommendedRangeFloorPct: 0.78, stretchRangeFloorPct: 0.9 },
    balanced: { grossYieldPct: 5.2, recommendedRangeFloorPct: 0.72, stretchRangeFloorPct: 0.86 },
    yield: { grossYieldPct: 6.0, recommendedRangeFloorPct: 0.68, stretchRangeFloorPct: 0.82 },
  },
}

function roundCurrency(value) {
  return Math.round(Number(value || 0))
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))
}

function formatRange(min, max, suffix = '') {
  return `${formatCurrency(min)} - ${formatCurrency(max)}${suffix}`
}

function getConfidenceLabel(score) {
  if (score >= 75) return 'High'
  if (score >= 55) return 'Medium'
  return 'Low'
}

function normalizeDepositRatio(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0 || numericValue >= 1) {
    return DEFAULT_CONFIG.depositRatio
  }

  return numericValue
}

function normalizeInterestRate(value, fallback = 6.2) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return fallback
  return Math.min(15, Math.max(0, numericValue))
}

function getTargetLvrFromDepositRatio(depositRatio) {
  return Math.max(0, Math.min(1, 1 - normalizeDepositRatio(depositRatio)))
}

function getIndicativeLmiRate(targetLvr, lmiRateTable = DEFAULT_CONFIG.lmiRateTable) {
  const safeTargetLvr = Number(targetLvr || 0)
  if (!Number.isFinite(safeTargetLvr) || safeTargetLvr <= 0.8) return 0

  const matchedTier = lmiRateTable.find((tier) => safeTargetLvr >= Number(tier?.minLvr || 0))
  return matchedTier ? Number(matchedTier.rate || 0) : 0
}

function normalizeProjectionYears(value) {
  const numericValue = Math.round(Number(value || 0))
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 30
  return Math.max(1, Math.min(numericValue, 40))
}

export function generateScenarioProjectionData({
  purchasePrice = 0,
  loanSize = 0,
  interestRatePct = 6.2,
  annualGrowthRatePct = 3.5,
  loanTermYears = 30,
  monthlyCashFlow = 0,
}) {
  const safePurchasePrice = Math.max(0, Number(purchasePrice || 0))
  const safeLoanSize = Math.max(0, Number(loanSize || 0))
  const safeInterestRatePct = Number.isFinite(Number(interestRatePct))
    ? Math.max(0, Number(interestRatePct))
    : 6.2
  const safeAnnualGrowthRatePct = Number.isFinite(Number(annualGrowthRatePct))
    ? Number(annualGrowthRatePct)
    : 3.5
  const safeLoanTermYears = normalizeProjectionYears(loanTermYears)
  const safeMonthlyCashFlow = Number.isFinite(Number(monthlyCashFlow))
    ? Number(monthlyCashFlow)
    : 0
  const totalMonths = safeLoanTermYears * 12
  const monthlyRepayment = estimateRepayment({
    principal: safeLoanSize,
    annualRate: safeInterestRatePct,
    repaymentType: 'Principal & Interest',
    remainingTermMonths: totalMonths,
  })
  const monthlyRate = safeInterestRatePct / 100 / 12

  let remainingBalance = safeLoanSize
  const projectionData = [
    {
      year: 0,
      propertyValue: roundCurrency(safePurchasePrice),
      loanBalance: roundCurrency(remainingBalance),
      netEquity: roundCurrency(safePurchasePrice - remainingBalance),
      annualCashFlow: roundCurrency(safeMonthlyCashFlow * 12),
      monthlyCashFlow: roundCurrency(safeMonthlyCashFlow),
    },
  ]

  for (let year = 1; year <= safeLoanTermYears; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      if (remainingBalance <= 0) {
        remainingBalance = 0
        break
      }

      const interestPortion = remainingBalance * monthlyRate
      const principalPortion =
        safeInterestRatePct === 0
          ? remainingBalance / Math.max(totalMonths - ((year - 1) * 12 + month), 1)
          : Math.max(monthlyRepayment - interestPortion, 0)

      remainingBalance = Math.max(remainingBalance - principalPortion, 0)
    }

    const propertyValue = safePurchasePrice * Math.pow(1 + safeAnnualGrowthRatePct / 100, year)
    projectionData.push({
      year,
      propertyValue: roundCurrency(propertyValue),
      loanBalance: roundCurrency(remainingBalance),
      netEquity: roundCurrency(propertyValue - remainingBalance),
      annualCashFlow: roundCurrency(safeMonthlyCashFlow * 12),
      monthlyCashFlow: roundCurrency(safeMonthlyCashFlow),
    })
  }

  return projectionData
}

function toMonthly(amount, frequency) {
  const safeAmount = Number(amount || 0)
  const normalizedFrequency = String(frequency || '').trim().toLowerCase()

  if (!Number.isFinite(safeAmount)) return 0

  switch (normalizedFrequency) {
    case 'weekly':
      return (safeAmount * 52) / 12
    case 'fortnightly':
      return (safeAmount * 26) / 12
    case 'monthly':
      return safeAmount
    case 'quarterly':
      return safeAmount / 3
    case 'annual':
    case 'yearly':
      return safeAmount / 12
    default:
      return safeAmount
  }
}

function getAverageInterestRate(loans) {
  const validRates = loans
    .map((loan) => Number(loan?.interest_rate))
    .filter((rate) => Number.isFinite(rate) && rate > 0)

  if (validRates.length === 0) return 6.2

  return validRates.reduce((sum, rate) => sum + rate, 0) / validRates.length
}

function getPortfolioYield(properties, transactions, fallbackYieldPct) {
  const investmentValue = properties
    .filter((property) => property?.property_use === 'investment')
    .reduce((sum, property) => sum + Number(property?.current_value || 0), 0)

  const grossMonthlyRent = transactions
    .filter((transaction) => transaction?.type === 'income')
    .reduce((sum, transaction) => sum + toMonthly(transaction?.amount, transaction?.frequency), 0)

  if (investmentValue <= 0 || grossMonthlyRent <= 0) return fallbackYieldPct

  const annualYieldPct = (grossMonthlyRent * 12 * 100) / investmentValue
  return Math.min(Math.max(annualYieldPct, fallbackYieldPct - 0.5), fallbackYieldPct + 0.8)
}

function getExpenseRatio(transactions) {
  const grossMonthlyRent = transactions
    .filter((transaction) => transaction?.type === 'income')
    .reduce((sum, transaction) => sum + toMonthly(transaction?.amount, transaction?.frequency), 0)
  const monthlyPropertyExpenses = transactions
    .filter((transaction) => transaction?.type === 'expense')
    .reduce((sum, transaction) => sum + toMonthly(transaction?.amount, transaction?.frequency), 0)

  if (grossMonthlyRent <= 0 || monthlyPropertyExpenses <= 0) return 0.28

  const ratio = monthlyPropertyExpenses / grossMonthlyRent
  return Math.min(Math.max(ratio, 0.18), 0.45)
}

function getGrowthRate(properties) {
  const validRates = properties
    .map((property) => {
      const currentValue = Number(property?.current_value)
      const purchasePrice = Number(property?.purchase_price)
      const purchaseDate = property?.purchase_date ? new Date(property.purchase_date) : null

      if (
        !Number.isFinite(currentValue) ||
        !Number.isFinite(purchasePrice) ||
        currentValue <= 0 ||
        purchasePrice <= 0 ||
        !purchaseDate ||
        Number.isNaN(purchaseDate.getTime())
      ) {
        return null
      }

      const yearsHeld = Math.max(
        (Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25),
        0.5
      )
      const rate = Math.pow(currentValue / purchasePrice, 1 / yearsHeld) - 1
      return Number.isFinite(rate) && rate > 0 ? rate : null
    })
    .filter(Boolean)

  if (validRates.length === 0) return 0.035

  const average = validRates.reduce((sum, rate) => sum + rate, 0) / validRates.length
  return Math.min(Math.max(average, 0.025), 0.06)
}

function evaluateScenarioAtPrice({
  purchasePrice,
  propertyCount,
  grossYieldPct,
  interestRatePct,
  expenseRatio,
  depositRatio = DEFAULT_CONFIG.depositRatio,
  acquisitionCostRate,
  currentSurplus,
  availableCash,
  totalDeployableCapital,
  lmiRateTable = DEFAULT_CONFIG.lmiRateTable,
}) {
  const safeDepositRatio = normalizeDepositRatio(depositRatio)
  const targetLvr = getTargetLvrFromDepositRatio(safeDepositRatio)
  const depositRequired = roundCurrency(purchasePrice * safeDepositRatio)
  const acquisitionCosts = roundCurrency(purchasePrice * acquisitionCostRate)
  const totalCapitalRequired = depositRequired + acquisitionCosts
  const baseLoanSize = roundCurrency(purchasePrice * targetLvr)
  const lmiRate = getIndicativeLmiRate(targetLvr, lmiRateTable)
  const lmiEstimate = roundCurrency(baseLoanSize * lmiRate)
  const estimatedLoanSize = roundCurrency(baseLoanSize + lmiEstimate)
  const monthlyGrossRent = (purchasePrice * (grossYieldPct / 100)) / 12
  const monthlyPropertyCosts = monthlyGrossRent * expenseRatio
  const monthlyLoanRepayment = estimateRepayment({
    principal: estimatedLoanSize,
    annualRate: interestRatePct,
    repaymentType: 'Principal & Interest',
    remainingTermMonths: 360,
  })
  const incrementalMonthlyCashFlow = roundCurrency(
    monthlyGrossRent - monthlyPropertyCosts - monthlyLoanRepayment
  )
  const postPurchaseSurplus = roundCurrency(currentSurplus + incrementalMonthlyCashFlow)
  const cashUsed = roundCurrency(Math.min(Math.max(Number(availableCash || 0), 0), totalCapitalRequired))
  const equityUsed = roundCurrency(Math.max(totalCapitalRequired - cashUsed, 0))
  const retainedCapital = roundCurrency(
    Math.max(Number(totalDeployableCapital || 0) - totalCapitalRequired, 0)
  )

  return {
    propertyCount,
    purchasePrice: roundCurrency(purchasePrice),
    depositRatio: safeDepositRatio,
    depositRequired,
    acquisitionCosts,
    totalCapitalRequired,
    lmiEstimate,
    lmiRate,
    baseLoanSize,
    estimatedLoanSize,
    monthlyGrossRent: roundCurrency(monthlyGrossRent),
    monthlyPropertyCosts: roundCurrency(monthlyPropertyCosts),
    incrementalMonthlyCashFlow,
    postPurchaseSurplus,
    monthlyLoanRepayment: roundCurrency(monthlyLoanRepayment),
    grossYieldPct,
    cashUsed,
    equityUsed,
    retainedCapital,
  }
}

function findMaxPriceBySurplus({
  baseCap,
  propertyCount,
  grossYieldPct,
  interestRatePct,
  expenseRatio,
  depositRatio = DEFAULT_CONFIG.depositRatio,
  acquisitionCostRate,
  currentSurplus,
  minimumPostPurchaseSurplus,
  availableCash,
  totalDeployableCapital,
  lmiRateTable = DEFAULT_CONFIG.lmiRateTable,
}) {
  if (baseCap <= 0) return 0

  let low = 0
  let high = baseCap

  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) / 2
    const evaluation = evaluateScenarioAtPrice({
      purchasePrice: mid,
      propertyCount,
      grossYieldPct,
      interestRatePct,
      expenseRatio,
      depositRatio,
      acquisitionCostRate,
      currentSurplus,
      availableCash,
      totalDeployableCapital,
      lmiRateTable,
    })

    if (evaluation.postPurchaseSurplus >= minimumPostPurchaseSurplus) {
      low = mid
    } else {
      high = mid
    }
  }

  return roundCurrency(low)
}

function buildBreakdown({
  evaluation,
  recommendedMin,
  recommendedMax,
  stretchMin,
  stretchMax,
  capitalCap,
  debtCap,
  surplusCap,
  availableCapital,
  liquidityBuffer,
  availableCash,
  usableEquityBeforeBuffer,
  usableEquityAfterBuffer,
  assumptions,
  constraints,
  growthRate,
  fiveYearValue,
  equityCreated,
  borrowingCapacity,
  confidenceScore,
  warnings,
}) {
  return {
    derivedFrom: {
      borrowingCapacityCap: formatCurrency(debtCap),
      capitalCap: formatCurrency(capitalCap),
      surplusCap: formatCurrency(surplusCap),
      finalCap: formatCurrency(Math.min(debtCap, capitalCap, surplusCap)),
    },
    purchaseRange: {
      recommended: formatRange(recommendedMin, recommendedMax),
      stretch: stretchMax > 0 ? formatRange(stretchMin, stretchMax) : null,
    },
    assumptions,
    constraints,
    confidenceScore,
    warnings,
    capital: {
      usableEquityBeforeBuffer: formatCurrency(usableEquityBeforeBuffer),
      usableEquityAfterBuffer: formatCurrency(usableEquityAfterBuffer),
      cashUsed: formatCurrency(evaluation.cashUsed),
      totalCapitalUsed: formatCurrency(evaluation.totalCapitalRequired),
      bufferRetained: formatCurrency(liquidityBuffer + evaluation.retainedCapital),
      totalDeployableCapital: formatCurrency(availableCapital),
      cashAvailableForInvestment: formatCurrency(availableCash),
    },
    purchaseStructure: {
      targetPrice: formatCurrency(evaluation.purchasePrice),
      depositPct: `${Math.round(evaluation.depositRatio * 100)}%`,
      depositAmount: formatCurrency(evaluation.depositRequired),
      acquisitionCosts: formatCurrency(evaluation.acquisitionCosts),
      lmiEstimate: formatCurrency(evaluation.lmiEstimate),
      totalCapitalRequired: formatCurrency(evaluation.totalCapitalRequired),
    },
    loanStructure: {
      baseLoanSize: formatCurrency(evaluation.baseLoanSize),
      lmiEstimate: formatCurrency(evaluation.lmiEstimate),
      loanSize: formatCurrency(evaluation.estimatedLoanSize),
      interestRate: `${Number(assumptions.interestRatePct || 0).toFixed(1)}%`,
      monthlyRepayment: formatCurrency(evaluation.monthlyLoanRepayment),
    },
    cashFlow: {
      rentalIncome: `${formatCurrency(evaluation.monthlyGrossRent)}/month`,
      expenses: `${formatCurrency(evaluation.monthlyPropertyCosts)}/month`,
      netCashFlow: `${formatCurrency(evaluation.incrementalMonthlyCashFlow)}/month`,
    },
    serviceabilityImpact: {
      surplusBefore: formatCurrency(assumptions.surplusBefore),
      surplusAfter: formatCurrency(evaluation.postPurchaseSurplus),
      borrowingCapacityAfterPurchase: formatCurrency(
        Math.max(borrowingCapacity - evaluation.estimatedLoanSize, 0)
      ),
    },
    growthAssumptions: {
      growthRate: `${(growthRate * 100).toFixed(1)}%`,
      fiveYearValue: formatCurrency(fiveYearValue),
      equityCreated: formatCurrency(equityCreated),
    },
  }
}

function buildStrategyScenario({
  id,
  title,
  strategyType,
  riskMode,
  propertyCount,
  grossYieldPct,
  expenseRatio,
  interestRatePct,
  growthRate,
  borrowingCapacity,
  usableEquity,
  availableCash,
  currentSurplus,
  config,
  confidenceScore,
}) {
  const riskConfig = config.riskModes[riskMode]
  const liquidityBuffer = config.liquidityBuffer
  const depositRatio = normalizeDepositRatio(config.depositRatio)
  const targetLvr = getTargetLvrFromDepositRatio(depositRatio)
  const usableEquityAfterBuffer = Math.max(0, usableEquity - liquidityBuffer)
  const totalDeployableCapital = Math.max(0, usableEquityAfterBuffer + availableCash)
  const debtCap = roundCurrency(borrowingCapacity / targetLvr)
  const capitalCap = roundCurrency(
    totalDeployableCapital / (depositRatio + config.acquisitionCostRate)
  )
  const baseCap = Math.max(0, Math.min(debtCap, capitalCap))
  const surplusCap = findMaxPriceBySurplus({
    baseCap,
    propertyCount,
    grossYieldPct,
    interestRatePct,
    expenseRatio,
    depositRatio,
    acquisitionCostRate: config.acquisitionCostRate,
    currentSurplus,
    minimumPostPurchaseSurplus: config.minimumPostPurchaseSurplus,
    availableCash,
    totalDeployableCapital,
    lmiRateTable: config.lmiRateTable,
  })
  const finalCap = Math.max(0, Math.min(baseCap, surplusCap || baseCap))

  if (finalCap <= 0) {
    return null
  }

  const recommendedMin = roundCurrency(finalCap * riskConfig.recommendedRangeFloorPct)
  const recommendedMax = finalCap
  const stretchMin = roundCurrency(finalCap * riskConfig.stretchRangeFloorPct)
  const stretchMax = finalCap
  const representativePrice = roundCurrency((recommendedMin + recommendedMax) / 2)
  const evaluation = evaluateScenarioAtPrice({
    purchasePrice: representativePrice,
    propertyCount,
    grossYieldPct,
    interestRatePct,
    expenseRatio,
    depositRatio,
    acquisitionCostRate: config.acquisitionCostRate,
    currentSurplus,
    availableCash,
    totalDeployableCapital,
    lmiRateTable: config.lmiRateTable,
  })
  const fiveYearValue = representativePrice * Math.pow(1 + growthRate, 5)
  const fiveYearEquityProjection = roundCurrency(fiveYearValue - evaluation.estimatedLoanSize)
  const equityCreated = roundCurrency(
    Math.max(fiveYearEquityProjection - evaluation.totalCapitalRequired, 0)
  )
  const projectionData = generateScenarioProjectionData({
    purchasePrice: representativePrice,
    loanSize: evaluation.estimatedLoanSize,
    interestRatePct,
    annualGrowthRatePct: growthRate * 100,
    loanTermYears: 30,
    monthlyCashFlow: evaluation.incrementalMonthlyCashFlow,
  })

  const constraints = []
  if (finalCap === debtCap) constraints.push('Borrowing capacity capped the recommended range.')
  if (finalCap === capitalCap) constraints.push('Deposit and acquisition costs capped the recommended range.')
  if (finalCap === surplusCap) {
    constraints.push('Post-purchase surplus threshold capped the recommended range.')
  }

  const assumptions = {
    targetLvr: `${Math.round(targetLvr * 100)}%`,
    depositRatio: `${Math.round(depositRatio * 100)}%`,
    acquisitionCostRate: `${Math.round(config.acquisitionCostRate * 100)}%`,
    lmiEstimateMode: 'Indicative only — actual LMI depends on lender, LVR, and borrower profile.',
    liquidityBuffer: formatCurrency(config.liquidityBuffer),
    minimumPostPurchaseSurplus: formatCurrency(config.minimumPostPurchaseSurplus),
    grossYield: `${grossYieldPct.toFixed(1)}%`,
    assessmentMode: strategyType,
    interestRatePct,
    surplusBefore: currentSurplus,
  }

  const warnings = []
  if (evaluation.incrementalMonthlyCashFlow < 0) {
    warnings.push('Cash flow turns negative after purchase.')
  }
  if (evaluation.postPurchaseSurplus < config.minimumPostPurchaseSurplus) {
    warnings.push('Post-purchase surplus falls below the resilience threshold.')
  }
  if (evaluation.lmiEstimate > 0) {
    warnings.push('Lower deposits increase leverage, repayments, and risk.')
  }

  const reasons =
    strategyType === 'larger_property'
      ? [
          'Uses borrowing capacity to target one larger asset.',
          'Favours growth concentration over diversification.',
          `Estimated gross yield remains around ${grossYieldPct.toFixed(1)}%.`,
        ]
      : [
          'Spreads risk across two smaller assets.',
          'Improves diversification while preserving flexibility.',
          `Targets a stronger blended gross yield around ${grossYieldPct.toFixed(1)}%.`,
        ]
  const tradeOffs =
    strategyType === 'larger_property'
      ? ['Higher concentration risk', 'Lower diversification across markets']
      : ['More moving parts to manage', 'Lower growth concentration in a single asset']
  const perPropertyRecommendedMax = roundCurrency(recommendedMax / propertyCount)
  const minimumFeasiblePropertyPrice = Number(config.realisticMarketEntry?.minPrice || 0)
  const minimumCapitalForFeasibleStrategy = roundCurrency(
    minimumFeasiblePropertyPrice *
      propertyCount *
      (depositRatio + config.acquisitionCostRate)
  )
  const additionalCapitalRequired = Math.max(
    minimumCapitalForFeasibleStrategy - totalDeployableCapital,
    0
  )
  const isFeasible = perPropertyRecommendedMax >= minimumFeasiblePropertyPrice
  const feasibilityMessage = isFeasible
    ? null
    : 'This strategy falls below realistic market entry pricing and is not currently feasible.'

  return {
    id,
    title,
    strategyType,
    riskMode,
    riskLevel:
      riskMode === 'growth' ? 'Higher' : riskMode === 'balanced' ? 'Moderate' : 'Lower',
    propertyCount,
    recommendedPurchaseRange: {
      min: recommendedMin,
      max: recommendedMax,
      label:
        propertyCount === 1
          ? formatRange(recommendedMin, recommendedMax)
          : formatRange(
              roundCurrency(recommendedMin / propertyCount),
              roundCurrency(recommendedMax / propertyCount),
              ' each'
            ),
    },
    stretchRange: {
      min: stretchMin,
      max: stretchMax,
      label:
        propertyCount === 1
          ? formatRange(stretchMin, stretchMax)
          : formatRange(
              roundCurrency(stretchMin / propertyCount),
              roundCurrency(stretchMax / propertyCount),
              ' each'
            ),
    },
    depositRequired: evaluation.depositRequired,
    estimatedAcquisitionCosts: evaluation.acquisitionCosts,
    lmiEstimate: evaluation.lmiEstimate,
    estimatedLoanSize: evaluation.estimatedLoanSize,
    estimatedPostPurchaseSurplus: evaluation.postPurchaseSurplus,
    estimatedGrossYield: grossYieldPct,
    estimatedMonthlyCashFlow: evaluation.incrementalMonthlyCashFlow,
    monthlyRentalIncome: evaluation.monthlyGrossRent,
    monthlyPropertyExpenses: evaluation.monthlyPropertyCosts,
    fiveYearEquityProjection,
    fiveYearValue: roundCurrency(fiveYearValue),
    equityCreated,
    projectionData,
    borrowingCapacityAfterPurchase: roundCurrency(
      Math.max(borrowingCapacity - evaluation.estimatedLoanSize, 0)
    ),
    deployableCapital: totalDeployableCapital,
    usableEquityAfterBuffer,
    cashUsed: evaluation.cashUsed,
    equityUsed: evaluation.equityUsed,
    confidenceScore,
    confidenceLabel: getConfidenceLabel(confidenceScore),
    isFeasible,
    feasibilityMessage,
    additionalCapitalRequired,
    warnings,
    reasons,
    tradeOffs,
    rationale:
      strategyType === 'larger_property'
        ? 'Concentrates capacity into one larger asset while keeping post-purchase surplus above the minimum resilience threshold.'
        : 'Splits capacity across two smaller acquisitions to diversify entry points while preserving liquidity and serviceability.',
    breakdown: buildBreakdown({
      evaluation,
      recommendedMin,
      recommendedMax,
      stretchMin,
      stretchMax,
      capitalCap,
      debtCap,
      surplusCap,
      availableCapital: totalDeployableCapital,
      liquidityBuffer,
      availableCash,
      usableEquityBeforeBuffer: usableEquity,
      usableEquityAfterBuffer,
      assumptions,
      constraints,
      growthRate,
      fiveYearValue,
      equityCreated,
      borrowingCapacity,
      confidenceScore,
      warnings,
    }),
  }
}

function buildWaitScenario({ currentSurplus, borrowingCapacity, usableEquity }) {
  return {
    id: 'optimise-first',
    title: 'Optimise first, then acquire',
    strategyType: 'optimise_first',
    riskMode: 'balanced',
    riskLevel: 'Low',
    propertyCount: 0,
    recommendedPurchaseRange: { min: 0, max: 0, label: 'Hold acquisition until constraints improve' },
    stretchRange: { min: 0, max: 0, label: null },
    depositRequired: 0,
    estimatedAcquisitionCosts: 0,
    lmiEstimate: 0,
    estimatedLoanSize: 0,
    estimatedPostPurchaseSurplus: roundCurrency(currentSurplus),
    estimatedGrossYield: 0,
    estimatedMonthlyCashFlow: 0,
    fiveYearEquityProjection: 0,
    projectionData: [],
    borrowingCapacityAfterPurchase: roundCurrency(Math.max(borrowingCapacity, 0)),
    rationale:
      usableEquity <= 0
        ? 'Usable equity is not yet available for a clean deposit strategy.'
        : 'Current surplus is too tight to support a resilient acquisition without first improving serviceability or liquidity.',
    breakdown: {
      derivedFrom: {
        borrowingCapacityCap: formatCurrency(borrowingCapacity),
        capitalCap: formatCurrency(usableEquity),
        surplusCap: formatCurrency(currentSurplus),
        finalCap: formatCurrency(0),
      },
      purchaseRange: {
        recommended: 'No acquisition range recommended yet',
        stretch: null,
      },
      assumptions: {
        action: 'Improve serviceability before deploying additional debt.',
      },
      constraints: ['Current financial resilience is below the minimum post-purchase threshold.'],
      postPurchase: {
        estimatedLoanSize: formatCurrency(0),
        estimatedAcquisitionCosts: formatCurrency(0),
        depositRequired: formatCurrency(0),
        estimatedPostPurchaseSurplus: formatCurrency(currentSurplus),
        estimatedMonthlyCashFlow: formatCurrency(0),
      },
    },
  }
}

function buildConstrainedScenario({
  currentSurplus,
  borrowingCapacity,
  usableEquity,
  availableCash,
  minimumBorrowingThreshold,
}) {
  return {
    id: 'capital-constrained',
    title: 'Lower-cost market or improve capital first',
    strategyType: 'capital_constrained',
    riskMode: 'balanced',
    riskLevel: 'Moderate',
    propertyCount: 0,
    recommendedPurchaseRange: { min: 0, max: 0, label: 'Constrained by deposit and acquisition costs' },
    stretchRange: { min: 0, max: 0, label: null },
    depositRequired: 0,
    estimatedAcquisitionCosts: 0,
    lmiEstimate: 0,
    estimatedLoanSize: 0,
    estimatedPostPurchaseSurplus: roundCurrency(currentSurplus),
    estimatedGrossYield: 0,
    estimatedMonthlyCashFlow: 0,
    fiveYearEquityProjection: 0,
    projectionData: [],
    borrowingCapacityAfterPurchase: roundCurrency(Math.max(borrowingCapacity, 0)),
    rationale:
      'Borrowing capacity is viable, but current equity and liquidity do not yet support a clean deposit-and-costs position for the next acquisition.',
    breakdown: {
      derivedFrom: {
        borrowingCapacityCap: formatCurrency(borrowingCapacity),
        capitalCap: formatCurrency(usableEquity + availableCash),
        surplusCap: formatCurrency(currentSurplus),
        finalCap: formatCurrency(0),
      },
      purchaseRange: {
        recommended: 'Improve capital position before targeting a purchase range',
        stretch: null,
      },
      assumptions: {
        minimumBorrowingThreshold: formatCurrency(minimumBorrowingThreshold),
        action: 'Improve capital, preserve liquidity, or target a lower-cost market first.',
      },
      constraints: ['Current equity or cash position is insufficient for deposit plus acquisition costs.'],
      postPurchase: {
        estimatedLoanSize: formatCurrency(0),
        estimatedAcquisitionCosts: formatCurrency(0),
        depositRequired: formatCurrency(0),
        estimatedPostPurchaseSurplus: formatCurrency(currentSurplus),
        estimatedMonthlyCashFlow: formatCurrency(0),
      },
    },
  }
}

export default function buildPortfolioGrowthScenarios({
  properties = [],
  loans = [],
  transactions = [],
  borrowingAnalysis = null,
  usableEquity = 0,
  availableCash = 0,
  portfolioCashFlow = 0,
  config = {},
}) {
  const hasExplicitTargetLvr = Number.isFinite(Number(config.targetLvr))
  const safeDepositRatio = hasExplicitTargetLvr
    ? normalizeDepositRatio(1 - Number(config.targetLvr))
    : normalizeDepositRatio(config.depositRatio)
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    depositRatio: safeDepositRatio,
    targetLvr: hasExplicitTargetLvr
      ? Math.max(0, Math.min(1, Number(config.targetLvr)))
      : getTargetLvrFromDepositRatio(safeDepositRatio),
    riskModes: {
      ...DEFAULT_CONFIG.riskModes,
      ...(config.riskModes || {}),
    },
  }

  const borrowingCapacity = Math.max(0, Number(borrowingAnalysis?.borrowing_power_estimate || 0))
  const currentSurplus = roundCurrency(Number(borrowingAnalysis?.net_monthly_surplus || 0))
  const liabilitiesMonthly = roundCurrency(
    Number(borrowingAnalysis?.total_monthly_liability_repayments || 0)
  )
  const mortgageCommitmentsMonthly = roundCurrency(
    Number(borrowingAnalysis?.mortgage_commitments_monthly || 0)
  )
  const availableEquity = Math.max(0, Number(usableEquity || 0))
  const cashOnHand = Math.max(0, Number(availableCash || 0))
  const usableEquityAfterBuffer = Math.max(0, availableEquity - mergedConfig.liquidityBuffer)
  const totalDeployableCapital = Math.max(0, usableEquityAfterBuffer + cashOnHand)
  const growthRate = getGrowthRate(properties)
  const defaultInterestRatePct = getAverageInterestRate(loans)
  const interestRatePct = normalizeInterestRate(
    config.interestRatePct,
    defaultInterestRatePct
  )
  const expenseRatio = getExpenseRatio(transactions)
  const growthYieldPct = getPortfolioYield(
    properties,
    transactions,
    mergedConfig.riskModes.growth.grossYieldPct
  )
  const balancedYieldPct = getPortfolioYield(
    properties,
    transactions,
    mergedConfig.riskModes.balanced.grossYieldPct
  )

  const scenarios = []
  const minimumCapitalForAcquisition = roundCurrency(
    mergedConfig.minimumBorrowingThreshold *
      (mergedConfig.depositRatio + mergedConfig.acquisitionCostRate)
  )
  let viabilityState = 'READY'
  let viabilityMessage = null

  if (borrowingCapacity < mergedConfig.minimumBorrowingThreshold || currentSurplus < 0) {
    viabilityState = 'NOT_READY'
    viabilityMessage = 'Your current position is not suitable for acquisition yet'
  } else if (totalDeployableCapital < minimumCapitalForAcquisition) {
    viabilityState = 'CONSTRAINED'
    viabilityMessage = 'Lower-cost market or improve capital first'
  }

  const confidenceInputs = [
    Number.isFinite(Number(borrowingAnalysis?.borrowing_power_estimate)),
    Number.isFinite(availableEquity),
    Number.isFinite(cashOnHand),
    transactions.some((transaction) => transaction?.type === 'income'),
    transactions.some((transaction) => transaction?.type === 'expense'),
  ]
  const confidenceScore = Math.round(
    (confidenceInputs.filter(Boolean).length / confidenceInputs.length) * 100
  )

  if (viabilityState === 'NOT_READY') {
    scenarios.push(
      buildWaitScenario({
      currentSurplus,
      borrowingCapacity,
      usableEquity: usableEquityAfterBuffer + cashOnHand,
      })
    )
  } else if (viabilityState === 'CONSTRAINED') {
    scenarios.push(
      buildConstrainedScenario({
      currentSurplus,
      borrowingCapacity,
      usableEquity: usableEquityAfterBuffer,
        availableCash: cashOnHand,
        minimumBorrowingThreshold: mergedConfig.minimumBorrowingThreshold,
      })
    )
  }

  if (viabilityState === 'READY') {
    const largerPropertyScenario = buildStrategyScenario({
      id: 'larger-property',
      title: 'Buy 1 larger property',
      strategyType: 'larger_property',
      riskMode: 'growth',
      propertyCount: 1,
      grossYieldPct: growthYieldPct,
      expenseRatio,
      interestRatePct,
      growthRate,
      borrowingCapacity,
      usableEquity: availableEquity,
      availableCash: cashOnHand,
      currentSurplus,
      config: mergedConfig,
      confidenceScore,
    })

    if (largerPropertyScenario) {
      scenarios.push(largerPropertyScenario)
    }

    const twoPropertyScenario = buildStrategyScenario({
      id: 'two-smaller-properties',
      title: 'Buy 2 smaller properties',
      strategyType: 'two_smaller_properties',
      riskMode: 'balanced',
      propertyCount: 2,
      grossYieldPct: balancedYieldPct,
      expenseRatio,
      interestRatePct,
      growthRate,
      borrowingCapacity,
      usableEquity: availableEquity,
      availableCash: cashOnHand,
      currentSurplus,
      config: mergedConfig,
      confidenceScore,
    })

    if (twoPropertyScenario) {
      scenarios.push(twoPropertyScenario)
    }

    if (
      scenarios.length === 0 ||
      currentSurplus < mergedConfig.minimumPostPurchaseSurplus ||
      borrowingCapacity <= 0
    ) {
      scenarios.push(
        buildWaitScenario({
          currentSurplus,
          borrowingCapacity,
          usableEquity: usableEquityAfterBuffer + cashOnHand,
        })
      )
    }
  }

  const feasibleStrategies = scenarios.filter(
    (scenario) =>
      scenario.strategyType !== 'optimise_first' &&
      scenario.strategyType !== 'capital_constrained' &&
      scenario.isFeasible !== false
  )

  const recommendedStrategy =
    viabilityState !== 'READY'
      ? null
      : feasibleStrategies.sort((a, b) => {
          if (b.estimatedPostPurchaseSurplus !== a.estimatedPostPurchaseSurplus) {
            return b.estimatedPostPurchaseSurplus - a.estimatedPostPurchaseSurplus
          }
          return b.estimatedGrossYield - a.estimatedGrossYield
        })[0] || null

  if (viabilityState === 'READY' && feasibleStrategies.length === 0) {
    viabilityMessage =
      'Your current capital is not sufficient to acquire a property at realistic market entry levels'
  }

  const limitingFactor =
    viabilityState === 'CONSTRAINED' || totalDeployableCapital < borrowingCapacity / mergedConfig.targetLvr
      ? 'capital'
      : 'borrowing'

  return {
    inputs: {
      borrowingCapacity,
      rawUsableEquityBeforeBuffer: availableEquity,
      usableEquityAfterBuffer,
      usableEquity: usableEquityAfterBuffer,
      cashAvailableForInvestment: cashOnHand,
      availableCash: cashOnHand,
      totalDeployableCapital,
      householdSurplus: currentSurplus,
      liabilitiesMonthly,
      mortgageCommitmentsMonthly,
      portfolioCashFlow: roundCurrency(portfolioCashFlow),
    },
    assumptions: {
      depositRatio: mergedConfig.depositRatio,
      targetLvr: mergedConfig.targetLvr,
      acquisitionCostRate: mergedConfig.acquisitionCostRate,
      liquidityBuffer: mergedConfig.liquidityBuffer,
      minimumPostPurchaseSurplus: mergedConfig.minimumPostPurchaseSurplus,
      minimumBorrowingThreshold: mergedConfig.minimumBorrowingThreshold,
      interestRatePct,
      defaultInterestRatePct,
      expenseRatio,
      growthRatePct: growthRate * 100,
    },
    viability: {
      state: viabilityState,
      message: viabilityMessage,
      minimumBorrowingThreshold: mergedConfig.minimumBorrowingThreshold,
      availableCapital: totalDeployableCapital,
      minimumCapitalForAcquisition,
      realisticMarketEntryMin: mergedConfig.realisticMarketEntry.minPrice,
      realisticMarketEntryMax: mergedConfig.realisticMarketEntry.maxPrice,
      requiredCapitalForMultiPropertyStrategy:
        scenarios.find((scenario) => scenario.propertyCount === 2)?.additionalCapitalRequired || 0,
      limitingFactor,
    },
    confidence: {
      score: confidenceScore,
      label: getConfidenceLabel(confidenceScore),
    },
    recommendedStrategy: recommendedStrategy
      ? {
          id: recommendedStrategy.id,
          title: recommendedStrategy.title,
          selectedOption:
            recommendedStrategy.strategyType === 'larger_property' ? 'A' : 'B',
          reasons: recommendedStrategy.reasons,
          tradeOffs: recommendedStrategy.tradeOffs,
        }
      : null,
    scenarios,
  }
}
