function hasNumber(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
}

function buildMissingSection(id) {
  switch (id) {
    case 'properties':
      return {
        id,
        label: 'Properties',
        title: 'Add your first property',
        body: 'Start by adding a property to unlock portfolio position, equity, and performance tracking.',
        ctaLabel: 'Add property',
        route: '/properties',
      }
    case 'mortgages':
      return {
        id,
        label: 'Mortgages',
        title: 'Add mortgages',
        body: 'Link debt to your properties to calculate net equity, lending exposure, and refinancing opportunities.',
        ctaLabel: 'Add mortgage',
        route: '/mortgages',
      }
    case 'financials':
      return {
        id,
        label: 'Financials',
        title: 'Add household financials',
        body: 'Add income and living costs to unlock borrowing power, actual monthly surplus, and serviceability analysis.',
        ctaLabel: 'Open financials',
        route: '/financials',
      }
    case 'liabilities':
      return {
        id: 'liabilities',
        label: 'Liabilities',
        title: 'Add liabilities',
        body: 'Include credit cards and personal debts so serviceability and borrowing capacity are accurate.',
        ctaLabel: 'Add liabilities',
        route: '/financials',
      }
    case 'cashflow':
      return {
        id: 'cashflow',
        label: 'Cash Flow',
        title: 'Final step: complete your cash flow',
        body: 'Add rent and property expenses for your investment properties to unlock your true monthly position and accurate investment insights. Owner-occupied property costs are included in living expenses. Usually takes under 2 minutes.',
        ctaLabel: 'Update cash flow',
        route: '/cashflow',
      }
    default:
      return buildMissingSection('cashflow')
  }
}

export default function buildDashboardStateResolver({
  properties = [],
  loans = [],
  transactions = [],
  dashboardCompleteness = null,
}) {
  const hasProperties = Array.isArray(properties) && properties.length > 0
  const hasPropertyValues =
    hasProperties && properties.some((property) => hasNumber(property?.current_value))
  const hasMortgages = Array.isArray(loans) && loans.length > 0
  const investmentProperties = properties.filter((property) => property?.property_use === 'investment')
  const hasFullMortgageCoverage =
    hasProperties &&
    hasMortgages &&
    properties.every((property) =>
      loans.some((loan) => String(loan?.property_id) === String(property?.id))
    )
  const hasFinancials = Boolean(dashboardCompleteness?.financialProfileComplete)
  const hasLiabilities =
    dashboardCompleteness?.liabilitiesStatus === 'present'
  const hasTransactions =
    Array.isArray(transactions) && transactions.some((transaction) => transaction?.property_id)
  const hasInvestmentProperties = investmentProperties.length > 0
  const hasPropertyRentData =
    (!hasInvestmentProperties ||
      investmentProperties.every((property) =>
        transactions.some(
          (transaction) =>
            String(transaction?.property_id) === String(property?.id) &&
            transaction?.type === 'income'
        )
      ))
  const hasPropertyExpenseData =
    !hasInvestmentProperties ||
    investmentProperties.every((property) =>
      transactions.some(
        (transaction) =>
          String(transaction?.property_id) === String(property?.id) &&
          transaction?.type === 'expense'
      )
    )
  const hasActualMortgageRepayments =
    hasMortgages &&
    hasFullMortgageCoverage &&
    loans.every((loan) => hasNumber(loan?.monthly_repayment))
  const canShowActualMonthlySurplus =
    hasFinancials &&
    hasLiabilities &&
    hasActualMortgageRepayments &&
    hasPropertyRentData &&
    hasPropertyExpenseData
  const hasCashFlow = hasPropertyRentData && hasPropertyExpenseData

  const setupChecklist = [
    { id: 'properties', label: 'Properties', complete: hasProperties, route: '/properties' },
    { id: 'mortgages', label: 'Mortgages', complete: hasMortgages && hasFullMortgageCoverage, route: '/mortgages' },
    { id: 'financials', label: 'Financials', complete: hasFinancials, route: '/financials' },
    { id: 'liabilities', label: 'Liabilities', complete: hasLiabilities, route: '/financials' },
    { id: 'cashflow', label: 'Cash Flow', complete: hasCashFlow, route: '/cashflow', required: true },
  ]

  const setupCompletedCount = setupChecklist.filter((item) => item.complete).length
  const setupComplete = setupCompletedCount === setupChecklist.length
  const missingSections = setupChecklist
    .filter((item) => !item.complete)
    .map((item) => buildMissingSection(item.id))

  let stage = 0
  if (hasProperties) stage = 1
  if (hasProperties && hasMortgages && hasFullMortgageCoverage) stage = 2
  if (stage >= 2 && hasFinancials) stage = 3
  if (stage >= 3 && hasLiabilities) stage = 4
  if (stage >= 4 && hasCashFlow) stage = 5

  const canShowNetPosition = hasProperties && hasPropertyValues
  const canShowMonthlyPosition = hasTransactions || hasFinancials
  const canShowBorrowing = setupComplete
  const canShowTopActions = setupComplete

  return {
    hasProperties,
    hasMortgages,
    hasFinancials,
    hasLiabilities,
    hasCashFlow,
    hasInvestmentProperties,
    hasTransactions,
    hasPropertyValues,
    hasFullMortgageCoverage,
    setupComplete,
    isSetupComplete: setupComplete,
    setupChecklist,
    setupCompletedCount,
    setupCompletionLabel: `${setupCompletedCount}/5 complete`,
    setupCompletionPct: Math.round((setupCompletedCount / setupChecklist.length) * 100),
    stage,
    canShowNetPosition,
    showNetPositionPartial: canShowNetPosition && (!hasMortgages || !hasFullMortgageCoverage),
    canShowMonthlyPosition,
    canShowBorrowing,
    canShowTopActions,
    canShowPropertyCashFlow: hasCashFlow,
    canShowActualMonthlySurplus,
    canShowHouseholdSurplus: hasFinancials,
    actualMonthlySurplusStatus: canShowActualMonthlySurplus ? 'ready' : 'incomplete',
    missingSections,
    missingSectionIds: missingSections.map((section) => section.id),
    borrowingLockedReason: 'Complete setup to unlock borrowing analysis',
    topActionsLockedReason:
      'Complete the missing setup steps below to generate ranked portfolio, borrowing, and refinancing actions.',
    liabilitiesLimitation:
      dashboardCompleteness?.liabilitiesStatus === 'unknown_empty'
        ? 'Liabilities are still treated as incomplete until they are explicitly added.'
        : null,
  }
}
