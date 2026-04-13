function hasNumber(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
}

function buildMissingSection(itemOrId) {
  const item =
    typeof itemOrId === 'string'
      ? { id: itemOrId, unlocked: true, lockedReason: null, route: null }
      : itemOrId || {}
  const { id, unlocked = true, lockedReason = null, route = null } = item

  switch (id) {
    case 'properties':
      return {
        id,
        label: 'Properties',
        title: 'Add your first property',
        body: 'Start by adding a property to unlock portfolio position, equity, and performance tracking.',
        ctaLabel: 'Add property',
        route: route || '/properties',
        unlocked,
        lockedReason,
      }
    case 'mortgages':
      return {
        id,
        label: 'Mortgages',
        title: 'Add mortgages',
        body: 'Link debt to your properties to calculate net equity, lending exposure, and refinancing opportunities.',
        ctaLabel: 'Add mortgage',
        route: route || '/mortgages',
        unlocked,
        lockedReason,
      }
    case 'financials':
      return {
        id,
        label: 'Financials',
        title: 'Add household financials',
        body: 'Add income and living costs to unlock borrowing power, actual monthly surplus, and serviceability analysis.',
        ctaLabel: 'Open financials',
        route: route || '/financials',
        unlocked,
        lockedReason,
      }
    case 'liabilities':
      return {
        id: 'liabilities',
        label: 'Liabilities',
        title: 'Add liabilities',
        body: 'Include credit cards and personal debts so serviceability and borrowing capacity are accurate.',
        ctaLabel: 'Add liabilities',
        route: route || '/financials',
        unlocked,
        lockedReason,
      }
    case 'cashflow':
      return {
        id: 'cashflow',
        label: 'Cash Flow',
        title: 'Final step: complete your cash flow',
        body: 'Add rent and property expenses for your investment properties to unlock your true monthly position and accurate investment insights. Owner-occupied property costs are included in living expenses. Usually takes under 2 minutes.',
        ctaLabel: 'Update cash flow',
        route: route || '/cashflow',
        unlocked,
        lockedReason,
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
    properties.every(
      (property) =>
        property?.is_debt_free === true ||
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
    hasActualMortgageRepayments &&
    hasPropertyRentData &&
    hasPropertyExpenseData
  const hasCashFlow = hasPropertyRentData && hasPropertyExpenseData

  const setupChecklist = [
    {
      id: 'properties',
      label: 'Properties',
      complete: hasProperties,
      route: '/properties',
      unlocked: true,
      lockedReason: null,
    },
    {
      id: 'mortgages',
      label: 'Mortgages',
      complete: hasMortgages && hasFullMortgageCoverage,
      route: '/mortgages',
      unlocked: hasProperties,
      lockedReason: hasProperties ? null : 'Add a property first',
    },
    {
      id: 'cashflow',
      label: 'Cash Flow',
      complete: hasCashFlow,
      route: '/cashflow',
      required: true,
      unlocked: hasProperties,
      lockedReason: hasProperties ? null : 'Add a property first',
    },
    {
      id: 'financials',
      label: 'Financials',
      complete: hasFinancials,
      route: '/financials',
      unlocked: hasProperties,
      lockedReason: hasProperties ? null : 'Add a property first',
    },
  ]

  const setupCompletedCount = setupChecklist.filter((item) => item.complete).length
  const setupComplete = setupCompletedCount === setupChecklist.length
  const missingSections = setupChecklist
    .filter((item) => !item.complete)
    .map((item) => buildMissingSection(item))

  let stage = 0
  if (hasProperties) stage = 1
  if (hasProperties && hasMortgages && hasFullMortgageCoverage) stage = 2
  if (stage >= 2 && hasFinancials) stage = 3
  if (stage >= 3 && hasLiabilities) stage = 4
  if (stage >= 4 && hasCashFlow) stage = 5

  const canShowNetPosition = hasProperties && hasPropertyValues
  const canShowMonthlyPosition = hasTransactions || hasFinancials
  const canShowBorrowing =
    hasProperties &&
    hasMortgages &&
    hasFinancials
  const canShowTopActions =
    hasProperties &&
    hasMortgages &&
    hasFinancials

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
