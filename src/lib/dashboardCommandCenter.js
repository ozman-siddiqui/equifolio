import calculateBorrowingPower from './borrowingPowerEngine'
import { buildPortfolioRefinanceRanking } from './refinanceEngine'
import buildPortfolioGrowthScenarios from './portfolioGrowthScenarios'

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

function formatCurrency(amount) {
  return amount.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  })
}

function getPropertyStatus({ hasLoanCoverage, netCashFlow, refinanceCandidate, alerts }) {
  if (!hasLoanCoverage || netCashFlow < 0 || alerts.some((alert) => alert.urgent)) {
    return 'Risk'
  }

  if (refinanceCandidate || netCashFlow > 0) {
    return 'Opportunity'
  }

  return 'Healthy'
}

function getConfidenceBadge({ dashboardCompleteness, borrowingAnalysis, type }) {
  if (type === 'setup') return 'High'
  if (type === 'refinance') {
    return dashboardCompleteness.loanDataComplete ? 'High' : 'Medium'
  }

  if (borrowingAnalysis?.status === 'ready') return 'High'
  if (borrowingAnalysis?.status === 'partial') return 'Medium'
  return 'Low'
}

function getPriorityLabel(priority) {
  if (priority >= 90) return 'High'
  if (priority >= 70) return 'Medium'
  return 'Low'
}

const EFFORT_WEIGHTS = {
  low: 1,
  medium: 3,
  high: 5,
}

function normalizeActionType(action) {
  const kind = String(action?.kind || '').toLowerCase()
  const category = String(action?.category || '').toLowerCase()

  if (kind === 'cashflow' || category === 'cash flow') return 'cashflow'
  if (
    kind === 'refinance' ||
    kind === 'borrowing' ||
    category === 'borrowing' ||
    String(action?.id || '').includes('credit-card') ||
    String(action?.id || '').includes('liabilities')
  ) {
    return 'borrowing'
  }

  return 'optimisation'
}

function getActionSequenceLabel(rank) {
  if (rank === 1) return 'Start here'
  if (rank === 2) return 'Next priority'
  return 'Then consider'
}

function sequenceActions({ actions = [], netMonthlySurplus = 0, topConstraints = [] }) {
  const primaryConstraintTypes = topConstraints.map((constraint) => constraint?.type)
  const hasLiabilityConstraint = primaryConstraintTypes.includes('liabilities')
  const hasMortgageConstraint = primaryConstraintTypes.includes('mortgages')

  const sequenced = actions.map((action) => {
    const yearlyImpact = Number(action?.yearlyImpact || 0)
    const borrowingUplift = Number(action?.borrowingLift || 0)
    const normalizedType = normalizeActionType(action)
    const effortWeight =
      EFFORT_WEIGHTS[String(action?.effort || '').toLowerCase()] ?? EFFORT_WEIGHTS.medium

    let dependencyRank = 0
    let reason = 'Improves the strongest available financial outcome with manageable effort.'

    if (netMonthlySurplus < 0 && normalizedType === 'cashflow') {
      dependencyRank = 1000
      reason = 'Improves cash flow before expanding borrowing capacity.'
    } else if (
      hasLiabilityConstraint &&
      (String(action?.id || '').includes('credit-card') ||
        String(action?.id || '').includes('liabilities'))
    ) {
      dependencyRank = 500
      reason = 'Directly addresses the liability drag currently limiting serviceability.'
    } else if (
      hasMortgageConstraint &&
      (String(action?.id || '').includes('mortgage') ||
        String(action?.id || '').includes('loan') ||
        action?.kind === 'refinance' ||
        String(action?.route || '').includes('mortgages'))
    ) {
      dependencyRank = 400
      reason = 'Targets the mortgage commitments currently constraining borrowing capacity.'
    } else if (normalizedType === 'borrowing' && borrowingUplift > 0) {
      reason = 'Creates the strongest borrowing improvement from your current position.'
    } else if (normalizedType === 'cashflow') {
      reason = 'Strengthens portfolio resilience and frees up monthly cash flow.'
    } else if (normalizedType === 'optimisation') {
      reason = 'Improves efficiency after the highest-friction constraints are addressed.'
    }

    const score = yearlyImpact * 0.5 + borrowingUplift * 0.4 - effortWeight

    return {
      ...action,
      action_type: normalizedType,
      actionScore: score,
      dependencyRank,
      sequenceReason: reason,
    }
  })

  return sequenced
    .sort((a, b) => {
      if (b.dependencyRank !== a.dependencyRank) {
        return b.dependencyRank - a.dependencyRank
      }

      if (b.actionScore !== a.actionScore) {
        return b.actionScore - a.actionScore
      }

      return b.priority - a.priority
    })
    .map((action, index) => ({
      ...action,
      rank: index + 1,
      sequenceLabel: getActionSequenceLabel(index + 1),
    }))
}

function createAction({
  id,
  title,
  route,
  priority,
  category,
  effort,
  confidence,
  problem,
  whyItMatters,
  monthlyImpact = null,
  yearlyImpact = null,
  borrowingLift = null,
  impactLabel = null,
  kind,
  actionClass = 'DIRECT_FINANCIAL',
}) {
  const isDirectFinancial = actionClass === 'DIRECT_FINANCIAL'
  const monthlyImpactValue =
    isDirectFinancial && monthlyImpact != null && Number.isFinite(Number(monthlyImpact))
      ? Math.abs(Number(monthlyImpact))
      : null
  const yearlyImpactValue =
    isDirectFinancial && yearlyImpact != null && Number.isFinite(Number(yearlyImpact))
      ? Math.abs(Number(yearlyImpact))
      : monthlyImpactValue != null
        ? monthlyImpactValue * 12
        : null
  const borrowingImpactValue =
    isDirectFinancial &&
    borrowingLift != null &&
    Number.isFinite(Number(borrowingLift)) &&
    Number(borrowingLift) > 0
      ? Number(borrowingLift)
      : null

  return {
    id,
    title,
    route,
    priority,
    priorityLabel: getPriorityLabel(priority),
    category,
    effort,
    confidence,
    problem,
    whyItMatters,
    monthlyImpact: monthlyImpactValue,
    yearlyImpact: yearlyImpactValue,
    borrowingLift: borrowingImpactValue,
    actionClass,
    monthlyImpactDisplay:
      monthlyImpactValue != null ? `+ ${formatCurrency(monthlyImpactValue)}/month` : null,
    yearlyImpactDisplay:
      yearlyImpactValue != null ? `+ ${formatCurrency(yearlyImpactValue)}/year` : null,
    borrowingImpactDisplay:
      borrowingImpactValue != null ? `+ ${formatCurrency(borrowingImpactValue)} borrowing` : null,
    hasCalculatedImpact: Boolean(
      monthlyImpactValue != null || yearlyImpactValue != null || borrowingImpactValue != null
    ),
    displayImpactType:
      impactLabel ||
      (isDirectFinancial ? null : 'Strategic action'),
    impactLabel,
    impact:
      impactLabel ||
      (borrowingImpactValue
        ? `+${formatCurrency(borrowingImpactValue)} borrowing capacity`
        : yearlyImpactValue
          ? `+${formatCurrency(yearlyImpactValue)}/year`
          : !isDirectFinancial
            ? 'Improves financial positioning'
            : null),
    kind,
  }
}

function buildSetupAction({ id, title, impact, route, priority }) {
  return createAction({
    id,
    title,
    route,
    priority,
    category: 'Setup',
    effort: 'Low',
    confidence: 'High',
    problem: 'Key data is still missing from the decision layer.',
    whyItMatters: 'Without it, Equifolio cannot show a lender-grade or portfolio-grade recommendation.',
    impactLabel: impact,
    kind: 'setup',
    actionClass: 'INDIRECT',
  })
}

function getTradeoffRiskLabel(value) {
  const normalized = String(value || '').toLowerCase()
  if (normalized.includes('higher')) return 'high'
  if (normalized.includes('moderate') || normalized.includes('medium')) return 'medium'
  return 'low'
}

export default function buildDashboardCommandCenter({
  properties = [],
  loans = [],
  transactions = [],
  alerts = [],
  borrowingAnalysis = null,
  dashboardCompleteness = null,
  dashboardState = null,
  financialProfile = null,
  liabilities = [],
}) {
  const propertiesMissingLoanCoverage = properties.filter(
    (property) => !loans.some((loan) => String(loan.property_id) === String(property.id))
  )
  const hasIncompleteLoanCoverage = properties.length > 0 && propertiesMissingLoanCoverage.length > 0

  const totalValue = properties.reduce((sum, property) => sum + Number(property.current_value || 0), 0)
  const totalDebt = loans.reduce((sum, loan) => sum + Number(loan.current_balance || 0), 0)
  const netEquity = hasIncompleteLoanCoverage ? null : Math.round(totalValue - totalDebt)
  const usableEquity =
    hasIncompleteLoanCoverage ? null : Math.round(Math.max(totalValue * 0.8 - totalDebt, 0))

  const propertySummaries = properties.map((property) => {
    const propertyLoans = loans.filter((loan) => String(loan.property_id) === String(property.id))
    const propertyTransactions = transactions.filter(
      (transaction) => String(transaction.property_id) === String(property.id)
    )

    const income = propertyTransactions
      .filter((transaction) => transaction.type === 'income')
      .reduce((sum, transaction) => sum + toMonthly(transaction.amount, transaction.frequency), 0)
    const expenses = propertyTransactions
      .filter((transaction) => transaction.type === 'expense')
      .reduce((sum, transaction) => sum + toMonthly(transaction.amount, transaction.frequency), 0)
    const debt = propertyLoans.reduce((sum, loan) => sum + Number(loan.current_balance || 0), 0)
    const equity = propertyLoans.length > 0 ? Math.round(Number(property.current_value || 0) - debt) : null
    const propertyAlerts = alerts.filter((alert) => String(alert.propertyId) === String(property.id))

    return {
      property,
      loans: propertyLoans,
      income: Math.round(income),
      expenses: Math.round(expenses),
      netCashFlow: Math.round(income - expenses),
      debt: Math.round(debt),
      equity,
      hasLoanCoverage: propertyLoans.length > 0,
      alerts: propertyAlerts,
    }
  })

  const refinanceRanking = buildPortfolioRefinanceRanking(loans, properties)
  const refinanceByPropertyId = Object.fromEntries(
    refinanceRanking.map((analysis) => [String(analysis.propertyId), analysis])
  )

  const portfolioProperties = propertySummaries
    .map((summary) => ({
      id: summary.property.id,
      address: summary.property.address,
      location: [summary.property.suburb, summary.property.state].filter(Boolean).join(', '),
      equity: summary.equity,
      cashFlow: summary.netCashFlow,
      status: getPropertyStatus({
        hasLoanCoverage: summary.hasLoanCoverage,
        netCashFlow: summary.netCashFlow,
        refinanceCandidate: refinanceByPropertyId[String(summary.property.id)]?.hasMeaningfulOpportunity,
        alerts: summary.alerts,
      }),
      hasLoanCoverage: summary.hasLoanCoverage,
      route: `/property/${summary.property.id}`,
    }))
    .sort((a, b) => {
      const order = { Risk: 0, Opportunity: 1, Healthy: 2 }
      return order[a.status] - order[b.status] || a.cashFlow - b.cashFlow
    })

  const monthlyPropertyCashFlow = propertySummaries.reduce(
    (sum, propertySummary) => sum + propertySummary.netCashFlow,
    0
  )
  const currentBorrowingCapacity = Math.max(
    0,
    Number(borrowingAnalysis?.borrowing_power_estimate || 0)
  )

  const actions = []
  const opportunities = []

  if (!dashboardCompleteness?.hasProperties) {
    actions.push(
      buildSetupAction({
        id: 'add-property',
        title: 'Add your first property',
        impact: 'Unlock portfolio-level equity and cash flow tracking',
        route: '/properties',
        priority: 100,
      })
    )
  }

  if (dashboardCompleteness?.hasProperties && !dashboardCompleteness?.hasLoans) {
    actions.push(
      buildSetupAction({
        id: 'add-first-mortgage',
        title: 'Add mortgage details',
        impact: 'Unlock equity, LVR, and refinance actions',
        route: '/mortgages',
        priority: 98,
      })
    )
  }

  if (hasIncompleteLoanCoverage) {
    actions.push(createAction({
      id: 'complete-loan-coverage',
      title: 'Complete mortgage coverage across the portfolio',
      route: '/mortgages',
      priority: 97,
      category: 'Setup',
      effort: 'Low',
      confidence: 'High',
      problem: 'One or more properties do not yet have mortgage coverage recorded.',
      whyItMatters: 'Missing debt makes equity, LVR, leverage, and borrowing interpretations unreliable.',
      impactLabel: 'Unlock accurate equity, LVR, and leverage decisions',
      kind: 'setup',
    }))
  }

  if (!dashboardCompleteness?.hasFinancialProfile || !dashboardCompleteness?.financialProfileComplete) {
    actions.push(
      buildSetupAction({
        id: 'complete-financial-profile',
        title: 'Complete your financial profile',
        impact: 'Unlock borrowing power plus actual and lender-view surplus analysis',
        route: '/financials',
        priority: 96,
      })
    )
  }

  if (!dashboardCompleteness?.hasLiabilitiesData) {
    actions.push(
      buildSetupAction({
        id: 'add-liabilities',
        title: 'Add liabilities',
        impact: 'Improve serviceability and borrowing confidence',
        route: '/financials',
        priority: 95,
      })
    )
  }

  const worstCashFlowProperty = [...propertySummaries]
    .filter((summary) => summary.netCashFlow < 0)
    .sort((a, b) => a.netCashFlow - b.netCashFlow)[0]

  if (worstCashFlowProperty) {
    const monthlyImpact = Math.abs(worstCashFlowProperty.netCashFlow)
    const action = createAction({
      id: `cashflow-${worstCashFlowProperty.property.id}`,
      title: `Recover ${formatCurrency(monthlyImpact)}/month at ${worstCashFlowProperty.property.address}`,
      route: `/property/${worstCashFlowProperty.property.id}`,
      priority: 92,
      category: 'Cash Flow',
      effort: 'Medium',
      confidence: 'High',
      problem: `${worstCashFlowProperty.property.address} is currently running negative each month.`,
      whyItMatters: 'This weakens portfolio resilience and reduces free cash flow that could be redirected elsewhere.',
      monthlyImpact,
      yearlyImpact: monthlyImpact * 12,
      kind: 'cashflow',
      actionClass: 'DIRECT_FINANCIAL',
    })

    actions.push(action)
    opportunities.push({
      ...action,
      description: 'Review rent, recurring expenses, and mortgage structure to restore monthly surplus.',
    })
  }

  const topRefinance = refinanceRanking.find((analysis) => analysis.hasMeaningfulOpportunity)
  if (topRefinance) {
    const monthlyImpact = Math.round(Number(topRefinance.monthlySavings || 0))
    const action = createAction({
      id: `refinance-${topRefinance.loanId}`,
      title: `Unlock ${topRefinance.annualSavings.toLocaleString('en-AU', {
        style: 'currency',
        currency: 'AUD',
        maximumFractionDigits: 0,
      })}/year at ${topRefinance.propertyAddress}`,
      route: '/mortgages',
      priority: 90,
      category: 'Borrowing',
      effort: 'Medium',
      confidence: topRefinance.confidenceLabel,
      problem: `The current loan structure is leaving about ${formatCurrency(monthlyImpact)}/month on the table.`,
      whyItMatters: 'Recovered savings improve surplus, refinance flexibility, and debt efficiency.',
      monthlyImpact,
      yearlyImpact: topRefinance.annualSavings,
      kind: 'refinance',
      actionClass: 'DIRECT_FINANCIAL',
    })

    actions.push(action)
    opportunities.push({
      ...action,
      description: topRefinance.summary,
    })
  }

  const estimatedCardCommitment = Number(
    borrowingAnalysis?.estimated_credit_card_commitments_monthly ||
      borrowingAnalysis?.derived?.estimated_card_commitment_monthly ||
      0
  )
  const creditCardLimitTotal = Number(
    borrowingAnalysis?.totalRevolvingCreditLimits || borrowingAnalysis?.inputs?.credit_card_limits_total || 0
  )

  if (creditCardLimitTotal > 0 && estimatedCardCommitment > 0) {
    const reducedCreditLiabilities = Array.isArray(liabilities)
      ? liabilities.map((liability) =>
          liability?.type === 'credit_card'
            ? { ...liability, credit_limit: 0, monthly_repayment: 0 }
            : liability
        )
      : []
    const improvedBorrowingAnalysis = calculateBorrowingPower({
      financialProfile,
      liabilities: reducedCreditLiabilities,
      loans,
      transactions,
    })
    const borrowingLift = Math.max(
      0,
      Number(improvedBorrowingAnalysis?.borrowing_power_estimate || 0) - currentBorrowingCapacity
    )

    if (borrowingLift > 0) {
      const action = createAction({
        id: 'reduce-credit-card-limits',
        title: `Unlock ${formatCurrency(borrowingLift)} borrowing capacity by reducing credit card limits`,
        route: '/financials',
        priority: 88,
        category: 'Borrowing',
        effort: 'Low',
        confidence: getConfidenceBadge({
          dashboardCompleteness,
          borrowingAnalysis,
          type: 'borrowing',
        }),
        problem: `Current credit card limits are treated as about ${formatCurrency(estimatedCardCommitment)}/month of lender-assessed liability.`,
        whyItMatters: 'Even unused limits reduce borrowing capacity because lenders shade them into serviceability.',
        monthlyImpact: estimatedCardCommitment,
        yearlyImpact: estimatedCardCommitment * 12,
        borrowingLift,
        kind: 'borrowing',
        actionClass: 'DIRECT_FINANCIAL',
      })

      actions.push(action)
      opportunities.push({
        ...action,
        description: `Current credit card limits total ${creditCardLimitTotal.toLocaleString('en-AU', {
          style: 'currency',
          currency: 'AUD',
          maximumFractionDigits: 0,
        })}. Lower limits reduce assessed monthly commitments.`,
      })
    }
  }

  if (borrowingAnalysis?.serviceability_status === 'not_serviceable' || borrowingAnalysis?.serviceability_status === 'tight') {
    opportunities.push(createAction({
      id: 'tight-serviceability',
      title: 'Restore household serviceability',
      route: '/financials',
      priority: 84,
      category: 'Borrowing',
      effort: 'High',
      confidence: borrowingAnalysis?.confidenceLabel || 'Medium',
      problem: 'Current monthly commitments are absorbing most of the usable household income.',
      whyItMatters: 'That leaves little room for additional debt servicing, rate shocks, or portfolio growth.',
      monthlyImpact: Math.abs(Number(borrowingAnalysis?.net_monthly_surplus || 0)),
      kind: 'borrowing',
      actionClass: 'INDIRECT',
      impactLabel: 'Improves borrowing accuracy',
    }))
  }

  const urgentAlerts = []

  if (topRefinance?.daysUntilFixedExpiry != null && topRefinance.daysUntilFixedExpiry <= 30) {
    urgentAlerts.push({
      id: `urgent-refinance-${topRefinance.loanId}`,
      title: `Fixed rate expiry approaching at ${topRefinance.propertyAddress}`,
      impact: `${topRefinance.annualSavings.toLocaleString('en-AU', {
        style: 'currency',
        currency: 'AUD',
        maximumFractionDigits: 0,
      })}/year opportunity`,
      route: '/mortgages',
    })
  }

  if (monthlyPropertyCashFlow < 0) {
    urgentAlerts.push({
      id: 'urgent-cashflow',
      title: 'Portfolio cash flow is negative',
      impact: `${Math.abs(monthlyPropertyCashFlow).toLocaleString('en-AU', {
        style: 'currency',
        currency: 'AUD',
        maximumFractionDigits: 0,
      })}/month drag`,
      route: '/cashflow',
    })
  }

  const sortedUniqueActions = Array.from(
    new Map(
      actions
        .filter(
          (action) => action.hasCalculatedImpact || action.actionClass === 'INDIRECT'
        )
        .map((action) => [action.id, action])
    ).values()
  )

  const fallbackBorrowingUplift = Math.max(
    0,
    ...(Array.isArray(borrowingAnalysis?.actions)
      ? borrowingAnalysis.actions.map((action) => Number(action?.borrowingUplift || 0))
      : [0])
  )
  const fallbackActions = [
    createAction({
      id: 'review-borrowing-position',
      title: 'Review borrowing position',
      route: borrowingAnalysis?.status === 'insufficient_data' ? '/financials' : '/mortgages',
      priority: 30,
      category: 'Borrowing',
      effort: 'Low',
      confidence: borrowingAnalysis?.confidenceLabel || 'Medium',
      problem: 'Borrowing assumptions should be checked against the current mortgage stack.',
      whyItMatters: 'Serviceability shifts quickly when debt, liabilities, and living costs are out of date.',
      borrowingLift: fallbackBorrowingUplift || null,
      kind: 'borrowing',
      actionClass: 'INDIRECT',
      impactLabel: 'Improves borrowing accuracy',
    }),
    createAction({
      id: 'review-property-cashflow',
      title: 'Review property cash flow',
      route: '/cashflow',
      priority: 29,
      category: 'Cash Flow',
      effort: 'Medium',
      confidence: 'Medium',
      problem: 'Cash flow assumptions are only as good as the recurring income and expense data underneath them.',
      whyItMatters: 'Property-level cash performance flows into both portfolio resilience and serviceability decisions.',
      kind: 'cashflow',
      actionClass: 'INDIRECT',
      impactLabel: 'Improves financial positioning',
    }),
  ].filter((action) => action.hasCalculatedImpact)

  fallbackActions.forEach((fallbackAction) => {
    if (sortedUniqueActions.length < 3 && !sortedUniqueActions.some((action) => action.id === fallbackAction.id)) {
      sortedUniqueActions.push(fallbackAction)
    }
  })

  const sequencedActions = sequenceActions({
    actions: sortedUniqueActions,
    netMonthlySurplus: Number(borrowingAnalysis?.net_monthly_surplus || 0),
    topConstraints: borrowingAnalysis?.topConstraints || [],
  })

  const topActions = sequencedActions.slice(0, 3)
  const opportunityList = Array.from(
    new Map(
      [...opportunities, ...sequencedActions.slice(3)].map((opportunity) => [
        opportunity.id,
        opportunity,
      ])
    ).values()
  ).slice(0, 8)

  const hero = {
    netPosition: {
      value: netEquity,
      subtitle:
        netEquity == null
          ? 'Add mortgage details for all properties to reveal net portfolio equity.'
          : 'Assets minus debt across your current portfolio.',
      helper:
        netEquity == null
          ? 'Mortgage coverage incomplete'
          : 'Equity available for optimisation',
      cta:
        netEquity == null
          ? { label: 'Add Mortgage', route: '/mortgages' }
          : { label: 'Review portfolio', route: '/properties' },
    },
    monthlyPosition: {
      propertyCashFlow: Math.round(monthlyPropertyCashFlow),
      householdSurplus: borrowingAnalysis?.status === 'insufficient_data' ? null : Number(borrowingAnalysis?.net_monthly_surplus ?? null),
      subtitle:
        'Property cash flow, actual monthly surplus, and lender-view serviceability are shown separately.',
      cta:
        borrowingAnalysis?.status === 'insufficient_data'
          ? { label: 'Complete Financials', route: '/financials' }
          : { label: 'Explore cash flow', route: '/cashflow' },
    },
    borrowingPower: {
      currentCapacity:
        borrowingAnalysis?.status === 'insufficient_data'
          ? null
          : Number(borrowingAnalysis?.borrowing_power_estimate ?? 0),
      unlockPotential:
        topActions.find((action) => action.borrowingLift)?.borrowingLift ?? null,
      potentialImprovement:
        topActions.find((action) => action.kind === 'borrowing')?.impact ||
        'More upside emerges as financial data quality improves',
      subtitle:
        borrowingAnalysis?.status === 'insufficient_data'
          ? 'Complete your Financials layer to unlock borrowing capacity.'
          : borrowingAnalysis?.status === 'partial'
            ? 'Estimate is conservative until liabilities are fully captured.'
            : 'Current borrowing capacity based on your recorded household, liabilities, and mortgages.',
      cta:
        borrowingAnalysis?.status === 'insufficient_data'
          ? { label: 'Complete Financials', route: '/financials' }
          : { label: 'Explore borrowing', route: '/mortgages' },
      unlockPotentialLabel: null,
    },
    usableEquity,
  }

  hero.borrowingPower.unlockPotentialLabel =
    hero.borrowingPower.unlockPotential != null
      ? `+${formatCurrency(hero.borrowingPower.unlockPotential)}`
      : null

  const growthScenarios = buildPortfolioGrowthScenarios({
    properties,
    loans,
    transactions,
    borrowingAnalysis,
    usableEquity,
    availableCash: Number(financialProfile?.cash_available_for_investment || 0),
    portfolioCashFlow: monthlyPropertyCashFlow,
  })

  const capacityUseCases = (growthScenarios.feasibleStrategies || []).map((scenario) => ({
    id: scenario.id,
    title: scenario.title,
    estimatedPriceRange: scenario.recommendedPurchaseRange.label,
    expectedRentalYield:
      scenario.estimatedGrossYield > 0 ? `${scenario.estimatedGrossYield.toFixed(1)}% gross yield` : 'Wait',
    equityUsage:
      scenario.depositRequired > 0
        ? `${formatCurrency(scenario.depositRequired)} deposit`
        : 'Preserve liquidity',
    depositRequired:
      scenario.depositRequired > 0 ? formatCurrency(scenario.depositRequired) : 'Not currently suggested',
    monthlyCashFlow:
      scenario.strategyType === 'optimise_first'
        ? 'Improve resilience first'
        : `${scenario.estimatedMonthlyCashFlow >= 0 ? '+' : '-'}${formatCurrency(
            Math.abs(scenario.estimatedMonthlyCashFlow)
          )}/month`,
    outcome: scenario.rationale,
    riskLevel: scenario.riskLevel,
    breakdown: scenario.breakdown,
  }))

  const currentAnnualCashImpact = Math.round(monthlyPropertyCashFlow * 12)
  const topRankedAction = topActions[0] || null
  const compareOptions = [
    {
      id: 'do-nothing',
      scenario: 'Do nothing',
      annualImpact: currentAnnualCashImpact,
      borrowing: currentBorrowingCapacity,
      risk: 'low',
      description:
        currentAnnualCashImpact < 0
          ? `You continue losing ${formatCurrency(Math.abs(currentAnnualCashImpact))}/year with no improvement in borrowing capacity.`
          : 'Your current position stays unchanged, with no improvement in borrowing capacity.',
    },
  ]

  if (topRankedAction) {
    const improvedAnnualImpact = Math.round(
      currentAnnualCashImpact + Number(topRankedAction.yearlyImpact || 0)
    )
    compareOptions.push({
      id: 'apply-top-action',
      scenario: 'Apply top recommendation',
      annualImpact: improvedAnnualImpact,
      borrowing: Math.round(
        currentBorrowingCapacity + Number(topRankedAction.borrowingLift || 0)
      ),
      risk: 'low',
      description: `Improves your position by ${formatCurrency(
        Number(topRankedAction.yearlyImpact || 0)
      )}/year${topRankedAction.borrowingLift ? ` and strengthens borrowing capacity by ${formatCurrency(Number(topRankedAction.borrowingLift || 0))}` : ''}.`,
    })
  }

  if (growthScenarios.viability?.state === 'READY') {
    const buyNowScenario = (growthScenarios.feasibleStrategies || []).find(
      (scenario) =>
        scenario.strategyType === 'larger_property' ||
        scenario.strategyType === 'two_smaller_properties'
    )

    if (buyNowScenario) {
      compareOptions.push({
        id: 'buy-now',
        scenario: 'Buy now',
        annualImpact: Math.round(
          currentAnnualCashImpact + Number(buyNowScenario.estimatedMonthlyCashFlow || 0) * 12
        ),
        borrowing: Math.round(
          Number(buyNowScenario.borrowingCapacityAfterPurchase || currentBorrowingCapacity)
        ),
        risk: getTradeoffRiskLabel(buyNowScenario.riskLevel),
        description: 'Increases portfolio size but reduces short-term cash flow and borrowing headroom.',
      })
    }
  }

  const completeChecks = [
    dashboardCompleteness?.hasProperties,
    dashboardCompleteness?.hasLoans,
    dashboardCompleteness?.financialProfileComplete,
    dashboardCompleteness?.hasLiabilitiesData,
    !hasIncompleteLoanCoverage,
    dashboardState?.hasCashFlow,
  ]

  const dataCoveragePct = Math.round(
    (completeChecks.filter(Boolean).length / completeChecks.length) * 100
  )

  return {
    hero,
    topActions,
    opportunities: opportunityList,
    urgentAlerts,
    portfolioProperties,
    capacityUseCases,
    unlockActions: topActions.map((action) => ({
      id: action.id,
      title: action.title,
      route: action.route,
      whyItMatters: action.whyItMatters,
      ctaLabel: 'Explore',
      impact:
        action.borrowingLift != null
          ? `+${formatCurrency(action.borrowingLift)}`
          : action.yearlyImpact != null
            ? `+${formatCurrency(action.yearlyImpact)}/year`
            : action.impactLabel || action.impact,
    })),
    topActionSummaries: topActions.map((action, index) => ({
      id: action.id,
      rank: action.rank ?? index + 1,
      sequenceLabel: action.sequenceLabel,
      reason: action.sequenceReason,
      title: action.title,
      priority: action.priorityLabel,
      impact:
        action.borrowingLift != null
          ? `+${formatCurrency(action.borrowingLift)}`
          : action.yearlyImpact != null
            ? `+${formatCurrency(action.yearlyImpact)}/year`
            : action.impactLabel || action.impact,
      route: action.route,
    })),
    growthScenarios,
    compareOptions,
    dataCoveragePct,
    decisionConfidence:
      borrowingAnalysis?.confidenceLabel ||
      (dashboardCompleteness?.confidenceLevel === 'high'
        ? 'High'
        : dashboardCompleteness?.confidenceLevel === 'medium'
          ? 'Medium'
          : 'Low'),
  }
}
