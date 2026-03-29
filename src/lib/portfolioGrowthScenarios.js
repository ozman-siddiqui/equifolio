import { estimateRepayment } from './mortgageMath'

const DEFAULT_DEBT_RATE_PCT = 5.8

const DEFAULT_CONFIG = {
  depositRatio: 0.2,
  targetLvr: 0.8,
  repaymentType: 'Interest Only',
  acquisitionCostRate: 0.05,
  liquidityBuffer: 25000,
  minimumPostPurchaseSurplus: 1500,
  minimumBorrowingThreshold: 350000,
  nearViableGapThreshold: 100000,
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

function getScenarioStateLabel(state) {
  switch (state) {
    case 'recommended':
      return 'Recommended'
    case 'near_viable':
      return 'Near viable'
    case 'stretch':
      return 'Stretch'
    case 'blocked':
    default:
      return 'Blocked'
  }
}

function normalizeDepositRatio(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0 || numericValue >= 1) {
    return DEFAULT_CONFIG.depositRatio
  }

  return numericValue
}

function normalizeInterestRate(value, fallback = DEFAULT_DEBT_RATE_PCT) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) return fallback
  return Math.min(15, numericValue)
}

function normalizeRepaymentType(value) {
  const normalizedValue = String(value || '').trim().toLowerCase()
  if (normalizedValue === 'interest only' || normalizedValue === 'io') {
    return 'Interest Only'
  }
  return 'Principal & Interest'
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

export function calculatePurchasePowerConstraints({
  depositAvailable = 0,
  requiredDepositRatio = DEFAULT_CONFIG.depositRatio,
  borrowingCapacity = 0,
}) {
  const safeDepositAvailable = Math.max(0, Number(depositAvailable || 0))
  const safeDepositRatio = normalizeDepositRatio(requiredDepositRatio)
  const safeBorrowingCapacity = Math.max(0, Number(borrowingCapacity || 0))
  const depositConstrainedPrice =
    safeDepositRatio > 0 ? roundCurrency(safeDepositAvailable / safeDepositRatio) : 0
  const borrowingConstrainedPrice = roundCurrency(safeBorrowingCapacity)
  const maxPurchasePrice = Math.max(
    0,
    Math.min(depositConstrainedPrice, borrowingConstrainedPrice)
  )

  return {
    depositConstrainedPrice,
    borrowingConstrainedPrice,
    maxPurchasePrice,
    limitingFactor:
      depositConstrainedPrice <= borrowingConstrainedPrice ? 'capital' : 'borrowing',
  }
}

export function generateScenarioProjectionData({
  purchasePrice = 0,
  loanSize = 0,
  interestRatePct = DEFAULT_DEBT_RATE_PCT,
  annualGrowthRatePct = 3.5,
  loanTermYears = 30,
  monthlyCashFlow = 0,
  monthlyRentalIncome = 0,
  monthlyExpenses = 0,
  rentalGrowthRatePct = 3,
  expenseGrowthRatePct = 2.5,
}) {
  const safePurchasePrice = Math.max(0, Number(purchasePrice || 0))
  const safeLoanSize = Math.max(0, Number(loanSize || 0))
  const safeInterestRatePct = normalizeInterestRate(
    interestRatePct,
    DEFAULT_DEBT_RATE_PCT
  )
  const safeAnnualGrowthRatePct = Number.isFinite(Number(annualGrowthRatePct))
    ? Number(annualGrowthRatePct)
    : 3.5
  const safeLoanTermYears = normalizeProjectionYears(loanTermYears)
  const safeMonthlyCashFlow = Number.isFinite(Number(monthlyCashFlow))
    ? Number(monthlyCashFlow)
    : 0
  const safeMonthlyRentalIncome = Number.isFinite(Number(monthlyRentalIncome))
    ? Math.max(0, Number(monthlyRentalIncome))
    : 0
  const safeMonthlyExpenses = Number.isFinite(Number(monthlyExpenses))
    ? Math.max(0, Number(monthlyExpenses))
    : 0
  const safeRentalGrowthRatePct = Number.isFinite(Number(rentalGrowthRatePct))
    ? Number(rentalGrowthRatePct)
    : 3
  const safeExpenseGrowthRatePct = Number.isFinite(Number(expenseGrowthRatePct))
    ? Number(expenseGrowthRatePct)
    : 2.5
  const totalMonths = safeLoanTermYears * 12
  const monthlyRepayment = estimateRepayment({
    principal: safeLoanSize,
    annualRate: safeInterestRatePct,
    repaymentType: 'Principal & Interest',
    remainingTermMonths: totalMonths,
  })
  const monthlyRate = safeInterestRatePct / 100 / 12

  let remainingBalance = safeLoanSize
  const baseMonthlyCashFlow =
    safeMonthlyRentalIncome > 0 || safeMonthlyExpenses > 0
      ? safeMonthlyRentalIncome - safeMonthlyExpenses - monthlyRepayment
      : safeMonthlyCashFlow
  const projectionData = [
    {
      year: 0,
      propertyValue: roundCurrency(safePurchasePrice),
      loanBalance: roundCurrency(remainingBalance),
      netEquity: roundCurrency(safePurchasePrice - remainingBalance),
      annualCashFlow: roundCurrency(baseMonthlyCashFlow * 12),
      monthlyCashFlow: roundCurrency(baseMonthlyCashFlow),
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
    const projectedMonthlyRentalIncome =
      safeMonthlyRentalIncome * Math.pow(1 + safeRentalGrowthRatePct / 100, year)
    const projectedMonthlyExpenses =
      safeMonthlyExpenses * Math.pow(1 + safeExpenseGrowthRatePct / 100, year)
    const projectedMonthlyCashFlow =
      safeMonthlyRentalIncome > 0 || safeMonthlyExpenses > 0
        ? projectedMonthlyRentalIncome - projectedMonthlyExpenses - monthlyRepayment
        : safeMonthlyCashFlow

    projectionData.push({
      year,
      propertyValue: roundCurrency(propertyValue),
      loanBalance: roundCurrency(remainingBalance),
      netEquity: roundCurrency(propertyValue - remainingBalance),
      annualCashFlow: roundCurrency(projectedMonthlyCashFlow * 12),
      monthlyCashFlow: roundCurrency(projectedMonthlyCashFlow),
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

  if (validRates.length === 0) return DEFAULT_DEBT_RATE_PCT

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

function getScenarioExpenseComponentMix(properties = [], transactions = []) {
  const investmentProperties = properties.filter((property) => property?.property_use === 'investment')
  const safeTransactions = transactions.filter((transaction) => transaction?.type === 'expense')

  const propertyFieldTotals = investmentProperties.reduce(
    (accumulator, property) => ({
      propertyManagement:
        accumulator.propertyManagement + Number(property?.property_management_monthly || 0),
      councilRates: accumulator.councilRates + Number(property?.council_rates_monthly || 0),
      insurance: accumulator.insurance + Number(property?.insurance_monthly || 0),
      maintenance: accumulator.maintenance + Number(property?.maintenance_monthly || 0),
    }),
    {
      propertyManagement: 0,
      councilRates: 0,
      insurance: 0,
      maintenance: 0,
    }
  )

  const transactionTotals = safeTransactions.reduce(
    (accumulator, transaction) => {
      const category = String(transaction?.category || '').trim().toLowerCase()
      const monthlyAmount = toMonthly(transaction?.amount, transaction?.frequency)

      if (category.includes('property management')) {
        accumulator.propertyManagement += monthlyAmount
      } else if (category.includes('council') || category.includes('water') || category.includes('strata')) {
        accumulator.councilRates += monthlyAmount
      } else if (category.includes('insurance')) {
        accumulator.insurance += monthlyAmount
      } else if (
        category.includes('maintenance') ||
        category.includes('repair') ||
        category.includes('advertising') ||
        category.includes('letting')
      ) {
        accumulator.maintenance += monthlyAmount
      }

      return accumulator
    },
    {
      propertyManagement: 0,
      councilRates: 0,
      insurance: 0,
      maintenance: 0,
    }
  )

  return {
    propertyManagement: Math.max(
      propertyFieldTotals.propertyManagement,
      transactionTotals.propertyManagement
    ),
    councilRates: Math.max(propertyFieldTotals.councilRates, transactionTotals.councilRates),
    insurance: Math.max(propertyFieldTotals.insurance, transactionTotals.insurance),
    maintenance: Math.max(propertyFieldTotals.maintenance, transactionTotals.maintenance),
  }
}

function scaleExpenseComponentsToMonthlyTotal(expenseComponents, monthlyPropertyCosts) {
  const modeledTotal = Math.max(0, Number(monthlyPropertyCosts || 0))
  const explicitTotal = Object.values(expenseComponents).reduce(
    (sum, value) => sum + Math.max(0, Number(value || 0)),
    0
  )

  if (modeledTotal <= 0) {
    return {
      propertyManagement: 0,
      councilRates: 0,
      insurance: 0,
      maintenance: 0,
      vacancyBuffer: 0,
      totalExpenses: 0,
    }
  }

  if (explicitTotal <= 0) {
    return {
      propertyManagement: 0,
      councilRates: 0,
      insurance: 0,
      maintenance: 0,
      vacancyBuffer: roundCurrency(modeledTotal),
      totalExpenses: roundCurrency(modeledTotal),
    }
  }

  const scalingFactor = modeledTotal / explicitTotal
  const propertyManagement = roundCurrency(expenseComponents.propertyManagement * scalingFactor)
  const councilRates = roundCurrency(expenseComponents.councilRates * scalingFactor)
  const insurance = roundCurrency(expenseComponents.insurance * scalingFactor)
  const maintenance = roundCurrency(expenseComponents.maintenance * scalingFactor)
  const allocatedTotal = propertyManagement + councilRates + insurance + maintenance

  return {
    propertyManagement,
    councilRates,
    insurance,
    maintenance,
    vacancyBuffer: roundCurrency(Math.max(modeledTotal - allocatedTotal, 0)),
    totalExpenses: roundCurrency(modeledTotal),
  }
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
  repaymentType = DEFAULT_CONFIG.repaymentType,
  expenseRatio,
  depositRatio = DEFAULT_CONFIG.depositRatio,
  acquisitionCostRate,
  currentSurplus,
  availableCash,
  totalDeployableCapital,
  lmiRateTable = DEFAULT_CONFIG.lmiRateTable,
}) {
  const safeDepositRatio = normalizeDepositRatio(depositRatio)
  const safeRepaymentType = normalizeRepaymentType(repaymentType)
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
  const monthlyLoanRepayment =
    safeRepaymentType === 'Interest Only'
      ? roundCurrency((estimatedLoanSize * (interestRatePct / 100)) / 12)
      : estimateRepayment({
          principal: estimatedLoanSize,
          annualRate: interestRatePct,
          repaymentType: 'Principal & Interest',
          remainingTermMonths: 360,
        })
  console.log('Loan calc:', {
    loan: estimatedLoanSize,
    rate: interestRatePct,
    type: safeRepaymentType,
    monthly: monthlyLoanRepayment,
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
    repaymentType: safeRepaymentType,
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
  repaymentType = DEFAULT_CONFIG.repaymentType,
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
      repaymentType,
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
      repaymentType: evaluation.repaymentType,
    },
    cashFlow: {
      rentalIncome: `${formatCurrency(evaluation.monthlyGrossRent)}/month`,
      expenses: `${formatCurrency(evaluation.monthlyPropertyCosts)}/month`,
      netCashFlow: `${formatCurrency(evaluation.incrementalMonthlyCashFlow)}/month`,
      expenseComponents: {
        propertyManagement: `${formatCurrency(evaluation.expenseBreakdown.propertyManagement)}/month`,
        councilRates: `${formatCurrency(evaluation.expenseBreakdown.councilRates)}/month`,
        insurance: `${formatCurrency(evaluation.expenseBreakdown.insurance)}/month`,
        maintenance: `${formatCurrency(evaluation.expenseBreakdown.maintenance)}/month`,
        vacancyBuffer: `${formatCurrency(evaluation.expenseBreakdown.vacancyBuffer)}/month`,
        totalExpenses: `${formatCurrency(evaluation.expenseBreakdown.totalExpenses)}/month`,
      },
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
  properties,
  transactions,
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
  const usableEquityAfterBuffer = Math.max(0, usableEquity - liquidityBuffer)
  const totalDeployableCapital = Math.max(0, usableEquityAfterBuffer + availableCash)
  const expenseComponentMix = getScenarioExpenseComponentMix(properties, transactions)
  const purchasePower = calculatePurchasePowerConstraints({
    depositAvailable: totalDeployableCapital,
    requiredDepositRatio: depositRatio,
    borrowingCapacity,
  })
  const debtCap = purchasePower.borrowingConstrainedPrice
  const capitalCap = purchasePower.depositConstrainedPrice
  const baseCap = purchasePower.maxPurchasePrice
  const surplusCap = findMaxPriceBySurplus({
    baseCap,
    propertyCount,
    grossYieldPct,
    interestRatePct,
    repaymentType: config.repaymentType,
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

  const minimumFeasiblePropertyPrice = Number(config.realisticMarketEntry?.minPrice || 0)
  const baselineScenarioPrice = roundCurrency(minimumFeasiblePropertyPrice * propertyCount)
  const scenarioCap = finalCap > 0 ? finalCap : baselineScenarioPrice
  const recommendedMin = roundCurrency(scenarioCap * riskConfig.recommendedRangeFloorPct)
  const recommendedMax = scenarioCap
  const stretchMin = roundCurrency(scenarioCap * riskConfig.stretchRangeFloorPct)
  const stretchMax = scenarioCap
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
  evaluation.expenseBreakdown = scaleExpenseComponentsToMonthlyTotal(
    expenseComponentMix,
    evaluation.monthlyPropertyCosts
  )
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
    monthlyRentalIncome: evaluation.monthlyGrossRent,
    monthlyExpenses: evaluation.monthlyPropertyCosts,
  })

  const constraints = []
  if (scenarioCap === debtCap) constraints.push('Borrowing capacity capped the recommended range.')
  if (scenarioCap === capitalCap) constraints.push('Available deposit capital capped the recommended range.')
  if (scenarioCap === surplusCap) {
    constraints.push('Post-purchase surplus threshold capped the recommended range.')
  }

  const assumptions = {
    targetLvr: `${Math.round(getTargetLvrFromDepositRatio(depositRatio) * 100)}%`,
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
  const minimumCapitalForFeasibleStrategy = roundCurrency(
    minimumFeasiblePropertyPrice *
      propertyCount *
      (depositRatio + config.acquisitionCostRate)
  )
  const capitalGap = Math.max(evaluation.totalCapitalRequired - totalDeployableCapital, 0)
  const borrowingGap = Math.max(evaluation.estimatedLoanSize - borrowingCapacity, 0)
  const priceGap = Math.max(
    minimumFeasiblePropertyPrice * propertyCount - recommendedMax,
    0
  )
  let blockedReason = null
  let blockedExplanation = null

  if (perPropertyRecommendedMax < minimumFeasiblePropertyPrice) {
    blockedReason = 'Below realistic market price range'
    blockedExplanation = `The recommended range implies about ${formatCurrency(
      perPropertyRecommendedMax
    )} per property, which sits below the configured Australian market entry floor of ${formatCurrency(
      minimumFeasiblePropertyPrice
    )}.`
  } else if (capitalGap > 0) {
    blockedReason = 'Deposit is insufficient to cover deposit and acquisition costs'
    blockedExplanation =
      'Available deposit capital does not fully cover the required deposit and acquisition costs for this strategy.'
  } else if (borrowingGap > 0) {
    blockedReason = 'Borrowing capacity does not support the required loan size'
    blockedExplanation =
      'The required loan size sits above current borrowing capacity once lender serviceability buffers are applied.'
  }

  const additionalCapitalRequired = Math.max(
    blockedReason === 'Below realistic market price range'
      ? minimumCapitalForFeasibleStrategy - totalDeployableCapital
      : capitalGap,
    0
  )
  const requiredCapitalGap = roundCurrency(
    blockedReason === 'Borrowing capacity does not support the required loan size'
      ? borrowingGap
      : blockedReason === 'Below realistic market price range'
        ? Math.max(additionalCapitalRequired, priceGap)
        : additionalCapitalRequired
  )
  const isFeasible = !blockedReason
  const feasibilityMessage = blockedExplanation
  const scenarioState =
    isFeasible
      ? 'stretch'
      : blockedReason !== 'Below realistic market price range' &&
          requiredCapitalGap > 0 &&
          requiredCapitalGap <= Number(config.nearViableGapThreshold || DEFAULT_CONFIG.nearViableGapThreshold)
        ? 'near_viable'
        : 'blocked'
  const scenarioStateLabel = getScenarioStateLabel(scenarioState)
  const stateSummary =
    scenarioState === 'near_viable'
      ? 'This path is close to executable with a modest uplift in capital or borrowing.'
      : scenarioState === 'blocked'
        ? blockedExplanation ||
          'This path is not currently executable under realistic market and funding assumptions.'
        : 'This strategy is currently executable under the stored assumptions.'

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
    scenarioPurchasePrice: representativePrice,
    scenarioDepositAmount: evaluation.depositRequired,
    scenarioLoanAmount: evaluation.estimatedLoanSize,
    scenarioDepositPct: roundCurrency((evaluation.depositRequired / Math.max(representativePrice, 1)) * 100),
    depositRequired: evaluation.depositRequired,
    estimatedAcquisitionCosts: evaluation.acquisitionCosts,
    lmiEstimate: evaluation.lmiEstimate,
    estimatedLoanSize: evaluation.estimatedLoanSize,
    estimatedPostPurchaseSurplus: evaluation.postPurchaseSurplus,
    estimatedGrossYield: grossYieldPct,
    estimatedMonthlyCashFlow: evaluation.incrementalMonthlyCashFlow,
    monthlyRentalIncome: evaluation.monthlyGrossRent,
    monthlyLoanRepayment: evaluation.monthlyLoanRepayment,
    repaymentType: evaluation.repaymentType,
    scenarioInterestRatePct: interestRatePct,
    monthlyPropertyExpenses: evaluation.monthlyPropertyCosts,
    monthlyExpenseBreakdown: evaluation.expenseBreakdown,
    fiveYearEquityProjection,
    fiveYearValue: roundCurrency(fiveYearValue),
    equityCreated,
    projectionData,
    borrowingCapacityAfterPurchase: roundCurrency(
      Math.max(borrowingCapacity - evaluation.estimatedLoanSize, 0)
    ),
    deployableCapital: totalDeployableCapital,
    allocatedCash: roundCurrency(availableCash),
    depositConstrainedPrice: purchasePower.depositConstrainedPrice,
    borrowingConstrainedPrice: purchasePower.borrowingConstrainedPrice,
    maxPurchasePrice: purchasePower.maxPurchasePrice,
    limitingFactor: purchasePower.limitingFactor,
    usableEquityAfterBuffer,
    cashUsed: evaluation.cashUsed,
    equityUsed: evaluation.equityUsed,
    confidenceScore,
    confidenceLabel: getConfidenceLabel(confidenceScore),
    scenarioState,
    scenarioStateLabel,
    stateSummary,
    isFeasible,
    blockedReason,
    blockedExplanation,
    requiredCapitalGap,
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
  const purchasePower = calculatePurchasePowerConstraints({
    depositAvailable: totalDeployableCapital,
    requiredDepositRatio: mergedConfig.depositRatio,
    borrowingCapacity,
  })
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

  const largerPropertyScenario = buildStrategyScenario({
    id: 'larger-property',
    title: 'Buy 1 larger property',
    strategyType: 'larger_property',
    riskMode: 'growth',
    propertyCount: 1,
    properties,
    transactions,
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
    properties,
    transactions,
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

  const executableStrategies = scenarios.filter((scenario) => scenario.scenarioState !== 'blocked' && scenario.isFeasible)
  const nearViableStrategies = scenarios.filter((scenario) => scenario.scenarioState === 'near_viable')
  const blockedStrategies = scenarios.filter((scenario) => scenario.scenarioState === 'blocked')

  const primaryStrategy =
    executableStrategies
      .sort((a, b) => {
        if (b.estimatedPostPurchaseSurplus !== a.estimatedPostPurchaseSurplus) {
          return b.estimatedPostPurchaseSurplus - a.estimatedPostPurchaseSurplus
        }
        return b.estimatedGrossYield - a.estimatedGrossYield
      })[0] ||
    nearViableStrategies
      .sort((a, b) => (a.requiredCapitalGap || 0) - (b.requiredCapitalGap || 0))[0] ||
    blockedStrategies
      .sort((a, b) => (a.requiredCapitalGap || 0) - (b.requiredCapitalGap || 0))[0] ||
    null

  const classifiedScenarios = scenarios
    .map((scenario) => {
      if (!primaryStrategy) return scenario
      if (scenario.id === primaryStrategy.id) {
        return {
          ...scenario,
          scenarioState: scenario.isFeasible ? 'recommended' : scenario.scenarioState,
          scenarioStateLabel: getScenarioStateLabel(
            scenario.isFeasible ? 'recommended' : scenario.scenarioState
          ),
        }
      }

      if (scenario.isFeasible) {
        return {
          ...scenario,
          scenarioState: 'stretch',
          scenarioStateLabel: getScenarioStateLabel('stretch'),
        }
      }

      return scenario
    })
    .sort((a, b) => {
      const priority = { recommended: 0, near_viable: 1, stretch: 2, blocked: 3 }
      return (priority[a.scenarioState] ?? 99) - (priority[b.scenarioState] ?? 99)
    })

  const recommendedStrategy = primaryStrategy

  if (!primaryStrategy && viabilityState === 'READY') {
    viabilityMessage =
      'Your current capital is not sufficient to acquire a property at realistic market entry levels'
  }

  const limitingFactor = purchasePower.limitingFactor

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
      purchasePower,
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
        classifiedScenarios.find((scenario) => scenario.propertyCount === 2)?.additionalCapitalRequired || 0,
      limitingFactor,
      purchasePower,
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
          scenarioState: recommendedStrategy.scenarioState,
          scenarioStateLabel: recommendedStrategy.scenarioStateLabel,
          stateSummary: recommendedStrategy.stateSummary,
          requiredCapitalGap: recommendedStrategy.requiredCapitalGap || 0,
          reasons: recommendedStrategy.reasons,
          tradeOffs: recommendedStrategy.tradeOffs,
        }
      : null,
    feasibleStrategies: classifiedScenarios.filter((scenario) =>
      ['recommended', 'stretch'].includes(scenario.scenarioState)
    ),
    nearViableStrategies: classifiedScenarios.filter(
      (scenario) => scenario.scenarioState === 'near_viable'
    ),
    blockedStrategies,
    scenarios: classifiedScenarios,
  }
}
