import { buildPortfolioRefinanceRanking } from './refinanceEngine.js'
import {
  estimateRepayment,
  getRemainingTermMonths,
  normalizeUsageType,
  roundCurrency,
} from './mortgageMath.js'

const BORROWING_POWER_CONFIG = {
  multiplier: 6,
  stressRateBufferPct: 3,
  estimatedLivingExpensesMonthly: {
    base: 3500,
    perProperty: 250,
    ownerOccupied: 450,
  },
  rentUpliftAssumptionPct: 0.05,
  missingIncomeCapturePct: 80,
}

function getMonthlyAmount(amount, frequency) {
  const safeAmount = Number(amount || 0)
  const normalizedFrequency = String(frequency || '').trim().toLowerCase()

  switch (normalizedFrequency) {
    case 'weekly':
      return (safeAmount * 52) / 12
    case 'fortnightly':
      return (safeAmount * 26) / 12
    case 'monthly':
      return safeAmount
    case 'quarterly':
      return safeAmount / 3
    case 'yearly':
    case 'annual':
      return safeAmount / 12
    default:
      return safeAmount
  }
}

function getPropertyScopeIds(properties, scopePropertyId) {
  if (scopePropertyId == null) return new Set(properties.map((property) => String(property.id)))
  return new Set([String(scopePropertyId)])
}

function calculateStressedRepayment(loan) {
  const balance = Number(loan.current_balance || loan.loan_amount || 0)
  const currentRate = Number(loan.interest_rate || 0)
  const { months } = getRemainingTermMonths(loan, 25 * 12)
  const repaymentType =
    loan.repayment_type === 'Interest Only' ? 'Interest Only' : 'Principal & Interest'

  return estimateRepayment({
    principal: balance,
    annualRate: currentRate + BORROWING_POWER_CONFIG.stressRateBufferPct,
    repaymentType,
    remainingTermMonths: months,
  })
}

function getBaseBorrowingCapacity(monthlyDisposableIncome) {
  return roundCurrency(
    Math.max(0, monthlyDisposableIncome) * 12 * BORROWING_POWER_CONFIG.multiplier
  )
}

function buildConstraint({ type, title, description, borrowingImpact }) {
  return {
    type,
    title,
    description,
    borrowingImpact: roundCurrency(Math.max(0, borrowingImpact)),
  }
}

function buildAction({ label, impact, borrowingUplift, type }) {
  return {
    label,
    impact,
    borrowingUplift: roundCurrency(Math.max(0, borrowingUplift)),
    type,
  }
}

export function buildBorrowingPowerAnalysis({
  properties = [],
  loans = [],
  transactions = [],
  propertyId = null,
}) {
  const scopedPropertyIds = getPropertyScopeIds(properties, propertyId)
  const scopedProperties = properties.filter((property) =>
    scopedPropertyIds.has(String(property.id))
  )
  const scopedLoans = loans.filter((loan) => scopedPropertyIds.has(String(loan.property_id)))
  const scopedTransactions = transactions.filter((transaction) =>
    scopedPropertyIds.has(String(transaction.property_id))
  )

  const monthlyIncome = scopedTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + getMonthlyAmount(transaction.amount, transaction.frequency), 0)

  const monthlyExpenses = scopedTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + getMonthlyAmount(transaction.amount, transaction.frequency), 0)

  const stressedRepayments = scopedLoans.reduce(
    (sum, loan) => sum + calculateStressedRepayment(loan),
    0
  )

  const ownerOccupiedCount = scopedProperties.filter(
    (property) => normalizeUsageType(property.usageType || property.property_use) === 'owner_occupied'
  ).length

  const estimatedLivingExpenses =
    BORROWING_POWER_CONFIG.estimatedLivingExpensesMonthly.base +
    scopedProperties.length * BORROWING_POWER_CONFIG.estimatedLivingExpensesMonthly.perProperty +
    ownerOccupiedCount * BORROWING_POWER_CONFIG.estimatedLivingExpensesMonthly.ownerOccupied

  const netDisposableIncome =
    monthlyIncome - monthlyExpenses - stressedRepayments - estimatedLivingExpenses

  const currentBorrowingPower = getBaseBorrowingCapacity(netDisposableIncome)

  const refinanceRanking = buildPortfolioRefinanceRanking(scopedLoans, scopedProperties)
  const refinanceOpportunity = refinanceRanking.find(
    (analysis) => analysis.recommendationType === 'refinance'
  )

  const constraints = []
  const actions = []
  const missingInputs = []

  if (scopedLoans.some((loan) => Number(loan.interest_rate || 0) <= 0)) {
    missingInputs.push('current loan rate')
  }

  if (scopedLoans.some((loan) => Number(loan.monthly_repayment || 0) <= 0)) {
    missingInputs.push('current loan repayment')
  }

  if (netDisposableIncome < 0) {
    constraints.push(
      buildConstraint({
        type: 'cashflow',
        title: 'Disposable income is negative',
        description:
          'Current income, expenses, and stressed loan repayments leave little serviceability headroom.',
        borrowingImpact: getBaseBorrowingCapacity(Math.abs(netDisposableIncome)),
      })
    )
  }

  const repaymentBurden =
    monthlyIncome > 0 ? stressedRepayments / monthlyIncome : scopedLoans.length > 0 ? 1 : 0
  if (repaymentBurden >= 0.45) {
    constraints.push(
      buildConstraint({
        type: 'repayment',
        title: 'Repayment burden is high',
        description: 'Stress-tested repayments are consuming too much income for lenders to ignore.',
        borrowingImpact: getBaseBorrowingCapacity(stressedRepayments * 0.12),
      })
    )
  }

  const portfolioValue = scopedProperties.reduce(
    (sum, property) => sum + Number(property.current_value || 0),
    0
  )
  const portfolioDebt = scopedLoans.reduce(
    (sum, loan) => sum + Number(loan.current_balance || 0),
    0
  )
  const lvr = portfolioValue > 0 ? (portfolioDebt / portfolioValue) * 100 : 0
  if (lvr >= 80) {
    constraints.push(
      buildConstraint({
        type: 'lvr',
        title: 'Leverage is constraining flexibility',
        description: `Portfolio LVR is ${lvr.toFixed(1)}%, which can limit new borrowing approvals.`,
        borrowingImpact: getBaseBorrowingCapacity((lvr - 70) * 18),
      })
    )
  }

  const investmentProperties = scopedProperties.filter(
    (property) => normalizeUsageType(property.usageType || property.property_use) === 'investment'
  )
  const hasInvestmentIncome = scopedTransactions.some((transaction) => transaction.type === 'income')
  if (investmentProperties.length > 0 && !hasInvestmentIncome) {
    constraints.push(
      buildConstraint({
        type: 'missing_income',
        title: 'Rental income is not fully captured',
        description:
          'Lenders cannot credit income that is missing from the current data set.',
        borrowingImpact: getBaseBorrowingCapacity(1800),
      })
    )
    missingInputs.push('rental income')
  }

  if (refinanceOpportunity) {
    actions.push(
      buildAction({
        label: 'Refinance the strongest debt opportunity',
        impact: `Reduce interest cost by about $${refinanceOpportunity.monthlySavings}/month`,
        borrowingUplift: getBaseBorrowingCapacity(refinanceOpportunity.monthlySavings),
        type: 'refinance',
      })
    )
  }

  const topInvestmentProperty = investmentProperties
    .map((property) => {
      const propertyTransactions = scopedTransactions.filter(
        (transaction) => String(transaction.property_id) === String(property.id)
      )
      const income = propertyTransactions
        .filter((transaction) => transaction.type === 'income')
        .reduce(
          (sum, transaction) => sum + getMonthlyAmount(transaction.amount, transaction.frequency),
          0
        )
      return { property, income }
    })
    .sort((a, b) => b.income - a.income)[0]

  if (topInvestmentProperty?.income > 0) {
    const monthlyRentUplift =
      topInvestmentProperty.income * BORROWING_POWER_CONFIG.rentUpliftAssumptionPct
    actions.push(
      buildAction({
        label: 'Review rent against market levels',
        impact: `A 5% rent uplift could add about $${roundCurrency(monthlyRentUplift)}/month`,
        borrowingUplift: getBaseBorrowingCapacity(monthlyRentUplift),
        type: 'rent',
      })
    )
  }

  if (investmentProperties.length > 0 && !hasInvestmentIncome) {
    actions.push(
      buildAction({
        label: 'Add verified rental income',
        impact: 'Capturing missing rent gives lenders more income to assess',
        borrowingUplift: getBaseBorrowingCapacity(
          1800 * BORROWING_POWER_CONFIG.missingIncomeCapturePct
        ),
        type: 'income',
      })
    )
  }

  if (netDisposableIncome < 0) {
    actions.push(
      buildAction({
        label: 'Move the portfolio back to positive carry',
        impact: 'Removing the current negative monthly drag improves borrowing serviceability',
        borrowingUplift: getBaseBorrowingCapacity(Math.abs(netDisposableIncome) * 0.65),
        type: 'cashflow',
      })
    )
  }

  const dedupedActions = actions
    .sort((a, b) => b.borrowingUplift - a.borrowingUplift)
    .filter(
      (action, index, list) => list.findIndex((item) => item.label === action.label) === index
    )
    .slice(0, 3)

  const potentialBorrowingPower =
    currentBorrowingPower +
    dedupedActions.reduce((sum, action) => sum + action.borrowingUplift, 0)

  const confidenceScore = Math.max(
    30,
    Math.min(
      92,
      84 -
        missingInputs.length * 14 -
        (investmentProperties.length > 0 && !hasInvestmentIncome ? 10 : 0) -
        (scopedLoans.some((loan) => !loan.monthly_repayment) ? 8 : 0)
    )
  )

  const confidenceLabel =
    confidenceScore >= 75 ? 'High' : confidenceScore >= 50 ? 'Medium' : 'Low'

  const topConstraint = constraints.sort((a, b) => b.borrowingImpact - a.borrowingImpact)[0] || null
  const unlockAmount = Math.max(0, potentialBorrowingPower - currentBorrowingPower)

  return {
    currentBorrowingPower,
    potentialBorrowingPower,
    unlockAmount,
    netDisposableIncome: roundCurrency(netDisposableIncome),
    monthlyIncome: roundCurrency(monthlyIncome),
    monthlyExpenses: roundCurrency(monthlyExpenses),
    stressedRepayments: roundCurrency(stressedRepayments),
    estimatedLivingExpenses: roundCurrency(estimatedLivingExpenses),
    constraints: constraints
      .sort((a, b) => b.borrowingImpact - a.borrowingImpact)
      .slice(0, 3),
    topConstraint,
    actions: dedupedActions,
    confidenceScore,
    confidenceLabel,
    missingInputs,
    scope: propertyId ? 'property' : 'portfolio',
  }
}

export default buildBorrowingPowerAnalysis
