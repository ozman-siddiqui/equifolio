const SCORE_WEIGHTS = {
  growth: 0.22,
  cashflow: 0.22,
  yield: 0.16,
  leverage: 0.18,
  mortgage: 0.12,
  dataCompleteness: 0.1,
}

const SUPPORTED_DECISIONS = [
  'Strong Hold',
  'Hold',
  'Optimise',
  'Refinance',
  'Review',
  'Watchlist',
]

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value))
const round = (value) => Math.round(Number.isFinite(value) ? value : 0)

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))
}

function getUsageType(property) {
  const raw = String(
    property?.usageType || property?.usage_type || property?.property_use || ''
  )
    .trim()
    .toLowerCase()

  if (raw === 'owner occupied' || raw === 'owner-occupied' || raw === 'owner_occupied') {
    return 'owner_occupied'
  }

  return raw === 'investment' ? 'investment' : 'investment'
}

export function getMonthlyAmount(amount, frequency) {
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

function calcPIRepayment(principal, annualRate, months = 30 * 12) {
  const safePrincipal = Number(principal || 0)
  const safeRate = Number(annualRate || 0)
  if (!safePrincipal || !months) return 0
  if (safeRate === 0) return safePrincipal / months

  const monthlyRate = safeRate / 100 / 12
  return (
    (safePrincipal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1)
  )
}

function calcIORepayment(principal, annualRate) {
  return (Number(principal || 0) * (Number(annualRate || 0) / 100)) / 12
}

function getYearsHeld(purchaseDate) {
  if (!purchaseDate) return null
  const now = new Date()
  const start = new Date(purchaseDate)
  const diffMs = now - start
  if (!Number.isFinite(diffMs) || diffMs <= 0) return null
  return diffMs / (1000 * 60 * 60 * 24 * 365.25)
}

function getAnnualGrowthPct(purchasePrice, currentValue, purchaseDate) {
  if (purchasePrice <= 0 || currentValue <= 0) return null
  const yearsHeld = getYearsHeld(purchaseDate)

  if (!yearsHeld || yearsHeld < 1) {
    return ((currentValue - purchasePrice) / purchasePrice) * 100
  }

  return (Math.pow(currentValue / purchasePrice, 1 / yearsHeld) - 1) * 100
}

function getTargetRate(currentRate, loanType, fixedRateExpiry) {
  const safeRate = Number(currentRate || 0)
  const daysUntilExpiry = fixedRateExpiry
    ? Math.ceil((new Date(fixedRateExpiry) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  if (loanType === 'Fixed' && daysUntilExpiry && daysUntilExpiry > 0 && daysUntilExpiry <= 120) {
    return Math.max(5.35, safeRate - 0.6)
  }

  if (safeRate >= 6.6) return Math.max(5.45, safeRate - 0.75)
  if (safeRate >= 6.2) return Math.max(5.45, safeRate - 0.5)
  if (safeRate >= 5.9) return Math.max(5.45, safeRate - 0.3)
  return safeRate
}

function roundRate(rate) {
  return Number(Number(rate || 0).toFixed(2))
}

function getRefinanceOpportunity(loan) {
  const balance = Number(loan.current_balance || 0)
  const currentRate = roundRate(loan.interest_rate)
  const currentRepayment =
    Number(loan.monthly_repayment || 0) > 0
      ? Number(loan.monthly_repayment || 0)
      : loan.repayment_type === 'Interest Only'
      ? calcIORepayment(balance, currentRate)
      : calcPIRepayment(balance, currentRate)

  const targetRate = roundRate(getTargetRate(currentRate, loan.loan_type, loan.fixed_rate_expiry))
  const rateDelta = currentRate - targetRate

  if (targetRate >= currentRate || rateDelta < 0.1) {
    return { targetRate, estimatedMonthlySaving: 0, qualifies: false }
  }

  const refinanceRepayment =
    loan.repayment_type === 'Interest Only'
      ? calcIORepayment(balance, targetRate)
      : calcPIRepayment(balance, targetRate)

  const estimatedMonthlySaving = Math.max(0, currentRepayment - refinanceRepayment)

  return {
    targetRate,
    estimatedMonthlySaving: estimatedMonthlySaving >= 50 ? estimatedMonthlySaving : 0,
    qualifies: estimatedMonthlySaving >= 50,
  }
}

function getCashflowMetrics(transactions) {
  const monthlyIncome = transactions
    .filter((item) => item.type === 'income')
    .reduce((sum, item) => sum + getMonthlyAmount(item.amount, item.frequency), 0)
  const monthlyExpenses = transactions
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + getMonthlyAmount(item.amount, item.frequency), 0)

  return {
    monthlyIncome,
    monthlyExpenses,
    monthlyNet: monthlyIncome - monthlyExpenses,
  }
}

function scoreGrowth(annualGrowthPct, totalAppreciationPct) {
  if (annualGrowthPct === null) return 42
  const totalBonus = totalAppreciationPct >= 40 ? 6 : totalAppreciationPct >= 20 ? 3 : 0

  let base
  if (annualGrowthPct >= 18) base = 94
  else if (annualGrowthPct >= 12) base = 84
  else if (annualGrowthPct >= 8) base = 74
  else if (annualGrowthPct >= 4) base = 62
  else if (annualGrowthPct >= 1) base = 52
  else if (annualGrowthPct >= -2) base = 42
  else if (annualGrowthPct >= -6) base = 24
  else base = 12

  return clamp(base + totalBonus)
}

function scoreCashflow(monthlyNet, monthlyIncome, usageType = 'investment') {
  if (usageType === 'owner_occupied') return 72

  if (monthlyIncome > 0) {
    const margin = monthlyNet / monthlyIncome
    if (margin >= 0.2) return 92
    if (margin >= 0.1) return 82
    if (margin >= 0) return 72
    if (margin >= -0.08) return 58
    if (margin >= -0.18) return 38
    return 18
  }

  if (monthlyNet > 0) return 68
  if (monthlyNet === 0) return 52
  if (monthlyNet >= -250) return 42
  if (monthlyNet >= -750) return 26
  return 12
}

function scoreYield(netYieldPct, grossYieldPct, usageType = 'investment') {
  if (usageType === 'owner_occupied') return 68

  const targetYield = Number.isFinite(netYieldPct) && netYieldPct > 0 ? netYieldPct : grossYieldPct
  if (!Number.isFinite(targetYield) || targetYield <= 0) return 38
  if (targetYield >= 5 && targetYield <= 6.5) return 90
  if (targetYield >= 4 && targetYield < 5) return 80
  if (targetYield > 6.5 && targetYield <= 8) return 76
  if (targetYield >= 3 && targetYield < 4) return 62
  if (targetYield >= 2 && targetYield < 3) return 46
  return 24
}

function scoreLeverage(lvr) {
  if (!Number.isFinite(lvr) || lvr <= 0) return 58
  if (lvr <= 50) return 92
  if (lvr <= 60) return 84
  if (lvr <= 70) return 72
  if (lvr <= 80) return 56
  if (lvr <= 90) return 26
  return 12
}

function scoreMortgageEfficiency({ debt, avgRate, estimatedRefinanceSavings, hasInterestOnlyLoan }) {
  if (debt <= 0) return 78
  if (!Number.isFinite(avgRate) || avgRate <= 0) return 42

  let score = 72
  if (avgRate >= 6.8) score -= 26
  else if (avgRate >= 6.3) score -= 18
  else if (avgRate >= 5.9) score -= 10

  if (estimatedRefinanceSavings >= 300) score -= 24
  else if (estimatedRefinanceSavings >= 150) score -= 16
  else if (estimatedRefinanceSavings >= 75) score -= 8

  if (hasInterestOnlyLoan) score -= 8

  return clamp(score)
}

function buildMissingInputState({ property, loans, transactions, metrics, usageType }) {
  const missingInputs = []
  const recommendedNextInputs = []

  const hasPurchasePrice = Number(property?.purchase_price || 0) > 0
  const hasCurrentValue = Number(property?.current_value || 0) > 0
  const hasLoanBalance = loans.length === 0 || loans.some((loan) => Number(loan.current_balance || 0) > 0)
  const hasLoanRate = loans.length === 0 || loans.some((loan) => Number(loan.interest_rate || 0) > 0)
  const hasTransactions = transactions.length >= 3
  const hasIncome = usageType === 'owner_occupied' ? true : metrics.monthlyIncome > 0
  const hasPropertyUse = Boolean(property?.property_use)
  const hasPropertyType = Boolean(property?.property_type)

  if (!hasPurchasePrice) {
    missingInputs.push('purchase price')
    recommendedNextInputs.push('Add purchase price to strengthen growth analysis')
  }

  if (!hasCurrentValue) {
    missingInputs.push('current value')
    recommendedNextInputs.push('Add an updated property value to improve leverage and growth analysis')
  }

  if (!hasLoanBalance) {
    missingInputs.push('loan balance')
    recommendedNextInputs.push('Add current loan balance to improve leverage and refinance analysis')
  }

  if (!hasLoanRate) {
    missingInputs.push('mortgage rate')
    recommendedNextInputs.push('Add current loan rate to improve refinance analysis')
  }

  if (!hasTransactions && usageType !== 'owner_occupied') {
    missingInputs.push('transaction history')
    recommendedNextInputs.push('Add more transaction history to improve cash flow confidence')
  }

  if (!hasIncome) {
    missingInputs.push('income or rent history')
    recommendedNextInputs.push('Add rent or income transactions to improve yield and cash flow analysis')
  }

  if (!hasPropertyUse) {
    missingInputs.push('occupancy status')
    recommendedNextInputs.push('Add owner-occupied or investment status to improve decision context')
  }

  if (!hasPropertyType) {
    missingInputs.push('property type')
    recommendedNextInputs.push('Add property type to improve comparability and decision quality')
  }

  return { missingInputs, recommendedNextInputs }
}

function scoreDataCompleteness(missingInputs) {
  const missingCount = missingInputs.length
  if (missingCount === 0) return 94
  if (missingCount === 1) return 82
  if (missingCount === 2) return 70
  if (missingCount === 3) return 58
  if (missingCount === 4) return 44
  return 30
}

function calculateConfidence(subScores, availableSignals, dataCompleteness) {
  const values = Object.values(subScores).filter((value) => Number.isFinite(value))
  const avg = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / Math.max(values.length, 1)
  const standardDeviation = Math.sqrt(variance)
  const consistencyScore = clamp(100 - standardDeviation * 1.6)
  const evidenceStrength = clamp((availableSignals / 6) * 100)

  const confidenceScore = round(
    dataCompleteness * 0.5 + consistencyScore * 0.25 + evidenceStrength * 0.25
  )

  return {
    confidenceScore,
    confidenceLabel:
      confidenceScore >= 75 ? 'High' : confidenceScore >= 50 ? 'Medium' : 'Low',
    consistencyScore: round(consistencyScore),
    evidenceStrength: round(evidenceStrength),
  }
}

function buildReasons({ metrics, missingInputs, usageType }) {
  const reasons = []

  if (usageType !== 'owner_occupied' && Number.isFinite(metrics.monthlyNet)) {
    if (metrics.monthlyNet < 0) {
      reasons.push({
        type: 'negative',
        title: 'Negative monthly carry',
        detail: `The property is running at ${formatCurrency(metrics.monthlyNet)}/month.`,
        priority: 95,
      })
    } else if (metrics.monthlyNet > 0) {
      reasons.push({
        type: 'positive',
        title: 'Positive monthly cash flow',
        detail: `Normalized net cash flow is ${formatCurrency(metrics.monthlyNet)}/month.`,
        priority: 74,
      })
    }
  }

  if (metrics.annualGrowthPct !== null) {
    if (metrics.annualGrowthPct >= 10) {
      reasons.push({
        type: 'positive',
        title: 'Strong capital growth',
        detail: `Annualised growth is ${metrics.annualGrowthPct.toFixed(1)}% with total appreciation of ${metrics.totalAppreciationPct.toFixed(1)}%.`,
        priority: 88,
      })
    } else if (metrics.annualGrowthPct < 2) {
      reasons.push({
        type: 'negative',
        title: 'Weak growth support',
        detail: `Annualised growth is only ${metrics.annualGrowthPct.toFixed(1)}%, so capital appreciation is not providing strong support.`,
        priority: 70,
      })
    }
  }

  if (metrics.estimatedRefinanceSavings >= 150) {
    reasons.push({
      type: 'opportunity',
      title: 'Mortgage optimisation available',
      detail: `Estimated refinance savings are about ${formatCurrency(metrics.estimatedRefinanceSavings)}/month.`,
      priority: 90,
    })
  } else if (metrics.avgRate >= 6.3) {
    reasons.push({
      type: 'opportunity',
      title: 'Debt pricing looks expensive',
      detail: `Weighted mortgage rate is ${metrics.avgRate.toFixed(2)}%, which looks expensive for the current profile.`,
      priority: 72,
    })
  }

  if (metrics.lvr >= 80) {
    reasons.push({
      type: 'negative',
      title: 'Leverage risk is elevated',
      detail: `LVR is ${metrics.lvr.toFixed(1)}%, which limits flexibility and increases downside pressure.`,
      priority: 84,
    })
  } else if (metrics.lvr > 0 && metrics.lvr <= 65) {
    reasons.push({
      type: 'positive',
      title: 'Leverage is manageable',
      detail: `LVR is ${metrics.lvr.toFixed(1)}%, which provides a healthier equity buffer.`,
      priority: 62,
    })
  }

  if (usageType !== 'owner_occupied' && metrics.netYieldPct > 0) {
    if (metrics.netYieldPct < 3) {
      reasons.push({
        type: 'negative',
        title: 'Yield is under pressure',
        detail: `Net yield is ${metrics.netYieldPct.toFixed(2)}%, which is weak relative to the property value.`,
        priority: 64,
      })
    } else if (metrics.netYieldPct >= 4) {
      reasons.push({
        type: 'positive',
        title: 'Yield profile is healthy',
        detail: `Net yield is ${metrics.netYieldPct.toFixed(2)}%, which supports the hold case.`,
        priority: 60,
      })
    }
  }

  if (missingInputs.length >= 3) {
    reasons.push({
      type: 'warning',
      title: 'Decision quality is data-limited',
      detail: `${missingInputs.length} important inputs are still missing, which lowers confidence.`,
      priority: 78,
    })
  }

  return reasons.sort((a, b) => b.priority - a.priority)
}

function classifyPropertyProfile(metrics, usageType = 'investment') {
  if (usageType === 'owner_occupied') return 'Balanced Asset'

  const strongGrowth = metrics.annualGrowthPct !== null && metrics.annualGrowthPct >= 8
  const strongYield = metrics.netYieldPct >= 4 || metrics.grossYieldPct >= 5
  const weakYield = metrics.netYieldPct > 0 && metrics.netYieldPct < 3

  if (strongGrowth && weakYield) return 'Growth Asset'
  if (strongYield && (metrics.annualGrowthPct === null || metrics.annualGrowthPct < 6)) {
    return 'Yield Asset'
  }
  return 'Balanced Asset'
}

function buildRecommendedActions(propertyAnalysis) {
  const { metrics, subScores, missingInputs, propertyProfile, usageType } = propertyAnalysis
  const actions = []

  if (usageType === 'owner_occupied') {
    if (metrics.estimatedRefinanceSavings > 100 && metrics.debt > 0) {
      actions.push({
        label: 'Review loan structure',
        impact: `A refinance could improve owner-occupied cash commitments by about ${formatCurrency(metrics.estimatedRefinanceSavings)}/month`,
        type: 'financial',
        priority: 96,
      })
    }

    actions.push({
      label: 'Monitor equity growth',
      impact: metrics.annualGrowthPct !== null
        ? `Annualised equity growth is ${metrics.annualGrowthPct.toFixed(1)}%, which matters more than rental yield here`
        : 'Track updated property value to strengthen long-term equity planning',
      type: 'strategic',
      priority: 90,
    })

    if (metrics.lvr <= 80 && metrics.debt > 0) {
      actions.push({
        label: 'Consider future equity leverage',
        impact: `LVR is ${metrics.lvr.toFixed(1)}%, which may support future borrowing flexibility`,
        type: 'strategic',
        priority: 82,
      })
    } else if (metrics.lvr > 80) {
      actions.push({
        label: 'Monitor leverage closely',
        impact: `LVR is ${metrics.lvr.toFixed(1)}%, so preserving equity flexibility should stay in focus`,
        type: 'financial',
        priority: 80,
      })
    }

    return actions
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3)
      .map((action) => ({
        label: action.label,
        impact: action.impact,
        type: action.type,
      }))
  }

  if (propertyProfile === 'Growth Asset') {
    actions.push({
      label: 'Position this as a growth asset',
      impact: 'This property is better suited to capital growth than income generation',
      type: 'strategic',
      priority: 98,
    })
  } else if (propertyProfile === 'Yield Asset') {
    actions.push({
      label: 'Use this as an income anchor',
      impact: 'The yield profile is carrying more of the investment case than growth',
      type: 'strategic',
      priority: 90,
    })
  } else {
    actions.push({
      label: 'Hold as a balanced asset',
      impact: 'The current mix of growth and income is reasonably balanced',
      type: 'strategic',
      priority: 82,
    })
  }

  if (propertyProfile === 'Growth Asset' && metrics.monthlyNet < 0) {
    actions.push({
      label: 'Offset this with yield elsewhere',
      impact: 'Consider pairing it with a stronger income asset to balance portfolio cash flow',
      type: 'strategic',
      priority: 94,
    })
  }

  if (
    propertyProfile === 'Growth Asset' &&
    metrics.monthlyNet < 0 &&
    metrics.annualGrowthPct !== null &&
    metrics.annualGrowthPct >= 10
  ) {
    actions.push({
      label: 'Accept negative carry selectively',
      impact: 'Current cash flow pressure may be acceptable if growth remains the dominant return driver',
      type: 'strategic',
      priority: 86,
    })
  }

  if (metrics.monthlyNet < 0 && metrics.estimatedRefinanceSavings > 100 && metrics.debt > 0) {
    actions.push({
      label: 'Review refinance options',
      impact: `Modelled repayment difference: about ${formatCurrency(metrics.estimatedRefinanceSavings)}/month`,
      type: 'financial',
      priority: 96,
    })
  }

  if (metrics.monthlyNet < 0 && metrics.netYieldPct > 0 && metrics.netYieldPct < 3) {
    actions.push({
      label: 'Check rent against market rates',
      impact: `Net yield is ${metrics.netYieldPct.toFixed(2)}%, so rent positioning may be worth validating`,
      type: 'financial',
      priority: 88,
    })
  }

  if (metrics.lvr >= 80) {
    actions.push({
      label: 'Monitor leverage closely',
      impact: `LVR is ${metrics.lvr.toFixed(1)}%, which limits refinancing and sale flexibility`,
      type: 'financial',
      priority: 78,
    })
  }

  if (
    metrics.avgRate >= 6.3 &&
    metrics.estimatedRefinanceSavings >= 50 &&
    !actions.some((action) => action.label === 'Review refinance options')
  ) {
    actions.push({
      label: 'Benchmark current loan rate',
      impact: `Current debt is priced at ${metrics.avgRate.toFixed(2)}%, which looks expensive`,
      type: 'financial',
      priority: 72,
    })
  }

  if (subScores.growth < 45 && subScores.yield < 45) {
    actions.push({
      label: 'Review hold thesis',
      impact: 'Weak growth and yield signals suggest this asset needs closer review',
      type: 'strategic',
      priority: 84,
    })
  }

  if (missingInputs.includes('income or rent history')) {
    actions.push({
      label: 'Add current rent inputs',
      impact: 'This will improve cash flow, yield, and rental optimisation accuracy',
      type: 'operational',
      priority: 58,
    })
  }

  return actions
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3)
    .map((action) => ({
      label: action.label,
      impact: action.impact,
      type: action.type,
    }))
}

function buildSummary(decisionLabel, reasons, confidenceLabel, missingInputs) {
  const strongestNegative = reasons.find((reason) => reason.type === 'negative')
  const strongestPositive = reasons.find((reason) => reason.type === 'positive')
  const strongestOpportunity = reasons.find((reason) => reason.type === 'opportunity')
  const lead = strongestNegative || reasons[0]
  const problemSignal = strongestNegative?.detail || lead?.detail || ''
  const opportunitySignal = strongestOpportunity?.detail || strongestPositive?.detail || ''

  if (decisionLabel === 'Refinance') {
    return `Cash flow is being held back by the debt structure. ${opportunitySignal || problemSignal}`.trim()
  }

  if (decisionLabel === 'Optimise') {
    return `This property shows supportive signals, but one weaker input is materially affecting the modelled outcome. ${opportunitySignal || problemSignal}`.trim()
  }

  if (decisionLabel === 'Strong Hold') {
    return `The property is performing strongly across the main investment pillars. ${strongestPositive?.detail || ''}`.trim()
  }

  if (decisionLabel === 'Watchlist') {
    return missingInputs.length > 0
      ? `Decision confidence is limited because core inputs are missing. ${lead?.detail || ''}`.trim()
      : 'Signals are mixed, so this property should stay on watch until the next clear trend appears.'
  }

  if (decisionLabel === 'Review') {
    return `Multiple signals need attention before this property strongly supports the current hold view. ${problemSignal}`.trim()
  }

  return `The property is generally stable, with one area that still needs attention. ${problemSignal || opportunitySignal}`.trim()
}

function getDecisionLabel({
  decisionScore,
  confidenceScore,
  subScores,
  metrics,
  missingInputs,
  usageType,
}) {
  const lowConfidence = confidenceScore < 45 || subScores.dataCompleteness < 40
  const refinanceSignal =
    metrics.debt > 0 &&
    metrics.estimatedRefinanceSavings >= 150 &&
    subScores.mortgage <= 45 &&
    confidenceScore >= 45
  const optimiseSignal =
    metrics.estimatedRefinanceSavings >= 75 ||
    (usageType !== 'owner_occupied' && (subScores.cashflow < 58 || subScores.yield < 58))
  const severeRisk =
    subScores.leverage <= 22 ||
    (usageType !== 'owner_occupied' &&
      (subScores.cashflow <= 22 ||
        (metrics.monthlyIncome > 0 && metrics.monthlyNet / metrics.monthlyIncome <= -0.25)))

  if (lowConfidence || missingInputs.length >= 5) return 'Watchlist'
  if (refinanceSignal) return 'Refinance'
  if (
    decisionScore >= 80 &&
    subScores.growth >= 72 &&
    subScores.leverage >= 55 &&
    subScores.cashflow >= 45
  ) {
    return 'Strong Hold'
  }
  if (decisionScore >= 64 && !severeRisk) return 'Hold'
  if (optimiseSignal && decisionScore >= 50) return 'Optimise'
  if (severeRisk || decisionScore < 48) return 'Review'
  return 'Watchlist'
}

function buildImproveDecisionPrompt(recommendedNextInputs) {
  if (recommendedNextInputs.length === 0) return ''
  return recommendedNextInputs.slice(0, 2).join(' | ')
}

export function calculateAIDScore(property, loanData = [], cashflowData = [], context = {}) {
  const loans = Array.isArray(loanData) ? loanData.filter(Boolean) : [loanData].filter(Boolean)
  const transactions = Array.isArray(cashflowData) ? cashflowData.filter(Boolean) : []

  const monthlyCashflow = getCashflowMetrics(transactions)
  const currentValue = Number(property?.current_value || 0)
  const purchasePrice = Number(property?.purchase_price || 0)
  const usageType = getUsageType(property)
  const debt = loans.reduce((sum, loan) => sum + Number(loan.current_balance || 0), 0)
  const annualGrowthPct = getAnnualGrowthPct(purchasePrice, currentValue, property?.purchase_date)
  const totalAppreciationPct =
    purchasePrice > 0 && currentValue > 0 ? ((currentValue - purchasePrice) / purchasePrice) * 100 : 0
  const lvr = currentValue > 0 && debt > 0 ? (debt / currentValue) * 100 : 0
  const grossYieldPct =
    currentValue > 0 ? ((monthlyCashflow.monthlyIncome * 12) / currentValue) * 100 : 0
  const netYieldPct =
    currentValue > 0 ? ((monthlyCashflow.monthlyNet * 12) / currentValue) * 100 : 0

  const weightedRateNumerator = loans.reduce(
    (sum, loan) => sum + Number(loan.current_balance || 0) * Number(loan.interest_rate || 0),
    0
  )
  const totalLoanBalance = loans.reduce(
    (sum, loan) => sum + Number(loan.current_balance || 0),
    0
  )
  const avgRate =
    totalLoanBalance > 0 ? weightedRateNumerator / totalLoanBalance : Number(loans[0]?.interest_rate || 0)

  const monthlyRepayment = loans.reduce((sum, loan) => {
    const balance = Number(loan.current_balance || 0)
    const rate = Number(loan.interest_rate || 0)
    const recordedRepayment = Number(loan.monthly_repayment || 0)
    if (recordedRepayment > 0) return sum + recordedRepayment
    return sum +
      (loan.repayment_type === 'Interest Only'
        ? calcIORepayment(balance, rate)
        : calcPIRepayment(balance, rate))
  }, 0)

  const estimatedRefinanceSavings = loans.reduce((sum, loan) => {
    const opportunity = getRefinanceOpportunity(loan)
    return sum + opportunity.estimatedMonthlySaving
  }, 0)

  const hasInterestOnlyLoan = loans.some((loan) => loan.repayment_type === 'Interest Only')
  const propertyProfile = classifyPropertyProfile(
    {
      annualGrowthPct,
      grossYieldPct,
      netYieldPct,
    },
    usageType
  )

  const metrics = {
    annualGrowthPct,
    totalAppreciationPct,
    monthlyIncome: monthlyCashflow.monthlyIncome,
    monthlyExpenses: monthlyCashflow.monthlyExpenses,
    monthlyNet: monthlyCashflow.monthlyNet,
    grossYieldPct,
    netYieldPct,
    yieldPct: grossYieldPct,
    debt,
    lvr,
    avgRate,
    monthlyRepayment,
    estimatedRefinanceSavings,
    hasInterestOnlyLoan,
    purchasePrice,
    currentValue,
    propertyProfile,
    usageType,
    portfolioContext: context.portfolioContext || null,
  }

  const { missingInputs, recommendedNextInputs } = buildMissingInputState({
    property,
    loans,
    transactions,
    metrics,
    usageType,
  })

  const subScores = {
    growth: round(scoreGrowth(annualGrowthPct, totalAppreciationPct)),
    cashflow: round(scoreCashflow(monthlyCashflow.monthlyNet, monthlyCashflow.monthlyIncome, usageType)),
    yield: round(scoreYield(netYieldPct, grossYieldPct, usageType)),
    leverage: round(scoreLeverage(lvr)),
    mortgage: round(
      scoreMortgageEfficiency({
        debt,
        avgRate,
        estimatedRefinanceSavings,
        hasInterestOnlyLoan,
      })
    ),
    dataCompleteness: round(scoreDataCompleteness(missingInputs)),
  }

  const availableSignals = [
    annualGrowthPct !== null,
    usageType === 'owner_occupied' || Number.isFinite(monthlyCashflow.monthlyNet),
    usageType === 'owner_occupied' || grossYieldPct > 0 || netYieldPct > 0,
    lvr > 0 || debt === 0,
    debt === 0 || Number.isFinite(avgRate),
    missingInputs.length < 4,
  ].filter(Boolean).length

  let decisionScore

  if (usageType === 'owner_occupied') {
    decisionScore = round(
      subScores.growth * 0.38 +
        subScores.leverage * 0.27 +
        subScores.mortgage * 0.2 +
        subScores.dataCompleteness * 0.15
    )
  } else {
    decisionScore = round(
      subScores.growth * SCORE_WEIGHTS.growth +
        subScores.cashflow * SCORE_WEIGHTS.cashflow +
        subScores.yield * SCORE_WEIGHTS.yield +
        subScores.leverage * SCORE_WEIGHTS.leverage +
        subScores.mortgage * SCORE_WEIGHTS.mortgage +
        subScores.dataCompleteness * SCORE_WEIGHTS.dataCompleteness
    )
  }

  const extremeCashflowStress =
    subScores.cashflow <= 20 ||
    (monthlyCashflow.monthlyIncome > 0 &&
      monthlyCashflow.monthlyNet / monthlyCashflow.monthlyIncome <= -0.25)

  if (annualGrowthPct !== null && annualGrowthPct > 20 && !extremeCashflowStress) {
    decisionScore = Math.max(decisionScore, 70)
  }

  if (usageType === 'owner_occupied') {
    decisionScore = clamp(decisionScore, 58, 88)
  } else if (propertyProfile === 'Balanced Asset') {
    decisionScore = clamp(decisionScore, 60, 75)
  }

  decisionScore = clamp(decisionScore)

  const confidenceState = calculateConfidence(
    subScores,
    availableSignals,
    subScores.dataCompleteness
  )

  const decisionLabel = getDecisionLabel({
    decisionScore,
    confidenceScore: confidenceState.confidenceScore,
    subScores,
    metrics,
    missingInputs,
    usageType,
  })

  const reasons = buildReasons({
    metrics,
    missingInputs,
    usageType,
  }).slice(0, 4)

  const recommendedActions = buildRecommendedActions({
    metrics,
    subScores,
    missingInputs,
    propertyProfile,
    usageType,
    reasons,
    decisionScore,
    confidenceScore: confidenceState.confidenceScore,
    decisionLabel,
  })

  const summary = buildSummary(
    decisionLabel,
    reasons,
    confidenceState.confidenceLabel,
    missingInputs
  )

  return {
    decisionLabel,
    decisionScore,
    confidenceScore: confidenceState.confidenceScore,
    confidenceLabel: confidenceState.confidenceLabel,
    summary,
    reasons,
    recommendedActions,
    subScores,
    missingInputs,
    recommendedNextInputs,
    improveDecisionPrompt: buildImproveDecisionPrompt(recommendedNextInputs),
    metrics,
    propertyProfile,
    usageType,
    supportedDecisionLabels: SUPPORTED_DECISIONS,

    score: decisionScore,
    label: decisionLabel,
    breakdown: {
      growth: subScores.growth,
      cashflow: subScores.cashflow,
      yield: subScores.yield,
      risk: subScores.leverage,
      mortgage: subScores.mortgage,
      dataCompleteness: subScores.dataCompleteness,
    },
    explanations: {
      summary,
      growth:
        annualGrowthPct === null
          ? 'Growth quality is harder to judge because purchase price or value is missing.'
          : `Annualised growth is ${annualGrowthPct.toFixed(1)}% and total appreciation is ${totalAppreciationPct.toFixed(1)}%.`,
      cashflow: `Normalized net cash flow is ${formatCurrency(monthlyCashflow.monthlyNet)}/month.`,
      yield: `Gross yield is ${grossYieldPct.toFixed(2)}% and net yield is ${netYieldPct.toFixed(2)}%.`,
      risk:
        debt > 0
          ? `LVR is ${lvr.toFixed(1)}% against total debt of ${formatCurrency(debt)}.`
          : 'No mortgage leverage is currently recorded.',
      mortgage:
        debt > 0
          ? estimatedRefinanceSavings >= 50
            ? `Weighted mortgage rate is ${avgRate.toFixed(2)}% with estimated refinance savings of ${formatCurrency(estimatedRefinanceSavings)}/month.`
            : `Weighted mortgage rate is ${avgRate.toFixed(2)}%. Current loan rate appears competitive.`
          : 'No active mortgage burden is recorded for this property.',
      dataCompleteness: `Based on availability of key inputs. ${missingInputs.length} important inputs are still missing.`,
    },
  }
}

export default calculateAIDScore
