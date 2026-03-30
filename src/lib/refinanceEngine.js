import REFINANCE_CONFIG from './refinanceConfig.js'
import {
  calculateRefinanceSavings,
  estimateInterestBurden,
  estimateRepayment,
  getDaysUntil,
  getEffectiveBalance,
  getRemainingTermMonths,
  normalizeUsageType,
  roundCurrency,
  roundRate,
} from './mortgageMath.js'

const RECOMMENDATION_ORDER = {
  refinance: 3,
  watch: 2,
  competitive: 1,
  insufficient_data: 0,
}

function normalizeRepaymentType(raw) {
  if (!raw) return 'Principal and Interest'
  const s = raw.trim().toLowerCase()
  if (s.includes('interest only') || s === 'io') return 'Interest Only'
  return 'Principal and Interest'
}

function formatMoney(value) {
  return `$${roundCurrency(value).toLocaleString('en-AU')}`
}

function inferFixedVariable(loan) {
  if (loan?.fixed_variable) return String(loan.fixed_variable)
  if (loan?.loan_type) return String(loan.loan_type)
  return 'Variable'
}

function getFallbackCompetitiveRate({
  lvr,
  usageType,
  fixedVariable,
  lender,
  config = REFINANCE_CONFIG,
}) {
  const benchmark = config.benchmarkRates
  const normalizedUsage = normalizeUsageType(usageType)
  const baseRate =
    benchmark.usageBaseRate[normalizedUsage] ?? benchmark.usageBaseRate.investment

  const loanTypeAdjustment = benchmark.loanTypeAdjustments[fixedVariable] ?? 0
  const lvrAdjustment =
    benchmark.lvrBands.find((band) => Number(lvr || 0) <= band.max)?.adjustment ?? 0

  const lenderKey = String(lender || '').trim().toLowerCase()
  const lenderAdjustment = benchmark.lenderAdjustments[lenderKey] ?? 0

  return roundRate(baseRate + loanTypeAdjustment + lvrAdjustment + lenderAdjustment)
}

function resolveBenchmarkRate({ loan, property, lvr, usageType, fixedVariable, config }) {
  const externalCandidates = [
    loan?.benchmark_rate,
    loan?.benchmarkRate,
    loan?.market_benchmark_rate,
    loan?.marketBenchmarkRate,
    loan?.competitive_rate,
    loan?.competitiveRate,
    loan?.target_rate,
    loan?.targetRate,
    property?.benchmark_rate,
    property?.benchmarkRate,
  ]

  const trustedExternalRate = externalCandidates.find((value) => Number(value) > 0)
  if (trustedExternalRate) {
    return {
      targetRate: roundRate(trustedExternalRate),
      benchmarkSource: 'external',
      benchmarkLabel: 'Market benchmark',
      benchmarkFallbackUsed: false,
    }
  }

  return {
    targetRate: getFallbackCompetitiveRate({
      lvr,
      usageType,
      fixedVariable,
      lender: loan?.lender,
      config,
    }),
    benchmarkSource: 'fallback',
    benchmarkLabel: 'Fallback benchmark',
    benchmarkFallbackUsed: true,
  }
}

function getRefinanceConfidence({
  missingInputs,
  warnings,
  hasUsageType,
  hasOffsetAmount,
  benchmarkFallbackUsed,
  termWasAssumed,
  missingRefinanceCost,
}) {
  let score = 86

  if (!hasUsageType) score -= 8
  if (!hasOffsetAmount) score -= 6
  if (termWasAssumed) score -= 10
  if (missingRefinanceCost) score -= 8
  if (benchmarkFallbackUsed) score -= 26
  score -= missingInputs.length * 8
  score -= warnings.length * 4

  const confidenceScore = Math.max(18, Math.min(96, Math.round(score)))
  return {
    confidenceScore,
    confidenceLabel:
      confidenceScore >= 75 ? 'High' : confidenceScore >= 50 ? 'Medium' : 'Low',
  }
}

function getRecommendation({
  targetRate,
  currentRate,
  rateDeltaBps,
  monthlySavings,
  breakEvenMonths,
  remainingTermMonths,
  confidenceScore,
  missingCriticalData,
  benchmarkFallbackUsed,
  annualSavings,
  config = REFINANCE_CONFIG,
}) {
  const thresholds = config.thresholds

  if (missingCriticalData) {
    return {
      refinanceRecommendation: 'Insufficient data',
      recommendationType: 'insufficient_data',
    }
  }

  if (
    targetRate >= currentRate ||
    rateDeltaBps < thresholds.competitiveRateDeltaBps ||
    monthlySavings < thresholds.minMonthlySavings
  ) {
    return {
      refinanceRecommendation: 'Rate appears competitive',
      recommendationType: 'competitive',
    }
  }

  if (!Number.isFinite(breakEvenMonths) || breakEvenMonths > thresholds.maxReviewBreakEvenMonths) {
    return {
      refinanceRecommendation: 'Watchlist',
      recommendationType: 'watch',
    }
  }

  if (Number.isFinite(remainingTermMonths) && breakEvenMonths > remainingTermMonths) {
    return {
      refinanceRecommendation: 'Watchlist',
      recommendationType: 'watch',
    }
  }

  if (annualSavings < thresholds.minAnnualSavings) {
    return {
      refinanceRecommendation: 'Watchlist',
      recommendationType: 'watch',
    }
  }

  if (
    rateDeltaBps >= thresholds.strongRateDeltaBps &&
    annualSavings >= thresholds.strongAnnualSavings &&
    breakEvenMonths <= thresholds.strongBreakEvenMonths &&
    confidenceScore >= 72 &&
    !benchmarkFallbackUsed
  ) {
    return {
      refinanceRecommendation: 'Strong opportunity',
      recommendationType: 'refinance',
    }
  }

  if (
    rateDeltaBps >= thresholds.reviewRateDeltaBps &&
    annualSavings >= thresholds.reviewAnnualSavings &&
    breakEvenMonths <= thresholds.maxReviewBreakEvenMonths &&
    confidenceScore >= 45
  ) {
    return {
      refinanceRecommendation: 'Worth reviewing',
      recommendationType: 'refinance',
    }
  }

  if (rateDeltaBps >= thresholds.watchRateDeltaBps) {
    return {
      refinanceRecommendation: 'Watchlist',
      recommendationType: 'watch',
    }
  }

  return {
    refinanceRecommendation: 'Rate appears competitive',
    recommendationType: 'competitive',
  }
}

function buildReasons({
  currentRate,
  targetRate,
  rateDeltaBps,
  monthlySavings,
  annualSavings,
  remainingTermMonths,
  remainingTermSavings,
  effectiveBalance,
  balance,
  breakEvenMonths,
  recommendationType,
  missingCriticalData,
  benchmarkLabel,
  benchmarkFallbackUsed,
}) {
  const reasons = []

  if (missingCriticalData) {
    reasons.push('Critical loan inputs are missing, so refinance savings cannot be estimated credibly')
    return reasons
  }

  if (targetRate < currentRate) {
    reasons.push(
      `Current rate is ${currentRate.toFixed(2)}%, versus a ${benchmarkLabel.toLowerCase()} of ${targetRate.toFixed(2)}%`
    )
  }

  if (monthlySavings >= 50) {
    reasons.push(
      `Estimated interest savings are about $${roundCurrency(monthlySavings)}/month on an effective balance of $${roundCurrency(effectiveBalance)}`
    )
  }

  if (annualSavings >= 1500) {
    reasons.push(`Annual savings are meaningful at about $${roundCurrency(annualSavings)}/year`)
  }

  if (balance >= 400000 && rateDeltaBps >= 10) {
    reasons.push('Loan balance is large enough for a modest rate reduction to matter')
  }

  if (Number.isFinite(breakEvenMonths) && breakEvenMonths > 0) {
    reasons.push(`Estimated switching costs are recovered in about ${breakEvenMonths} months`)
  }

  if (Number.isFinite(remainingTermMonths) && remainingTermMonths < 12) {
    reasons.push(
      `Only ${remainingTermMonths} months remain, so remaining savings are capped at about $${roundCurrency(remainingTermSavings)}`
    )
  }

  if (recommendationType === 'watch' && Number.isFinite(breakEvenMonths)) {
    reasons.push(`Break-even is about ${breakEvenMonths} months, which weakens the case for switching now`)
  }

  if (recommendationType === 'competitive') {
    reasons.push('Current rate already sits at or below the estimated competitive range')
  }

  if (benchmarkFallbackUsed) {
    reasons.push('The benchmark rate is using a conservative fallback model rather than a market-sourced quote')
  }

  return reasons.slice(0, 3)
}

function buildWarnings({
  termWasAssumed,
  hasUsageType,
  hasOffsetAmount,
  fixedVariable,
  loan,
  benchmarkFallbackUsed,
  remainingTermMonths,
  missingRefinanceCost,
}) {
  const warnings = []

  if (termWasAssumed) {
    warnings.push('Estimated using an assumed remaining term')
  }

  if (!hasUsageType) {
    warnings.push('Specify whether this loan is owner occupied or investment to improve benchmark accuracy')
  }

  if (!hasOffsetAmount) {
    warnings.push('Add offset balance to refine true interest efficiency')
  }

  if (!fixedVariable) {
    warnings.push('Specify whether the loan is fixed or variable to improve benchmark comparison')
  }

  const normalizedRepaymentType = normalizeRepaymentType(loan?.repayment_type)

  if (
    normalizedRepaymentType !== 'Interest Only' &&
    normalizedRepaymentType !== 'Principal and Interest'
  ) {
    warnings.push('Repayment type is unclear, so principal and interest has been assumed where needed')
  }

  if (benchmarkFallbackUsed) {
    warnings.push('Benchmark rate is a fallback estimate, not a market-sourced rate')
  }

  if (Number.isFinite(remainingTermMonths) && remainingTermMonths < 12) {
    warnings.push('Less than 12 months remain, so annual savings are a run-rate rather than a full-year realised outcome')
  }

  if (missingRefinanceCost) {
    warnings.push('Refinance cost is using the default estimate rather than a loan-specific switching cost')
  }

  return warnings
}

function getEstimateQuality({ confidenceScore, benchmarkFallbackUsed, missingInputs }) {
  if (confidenceScore >= 75 && !benchmarkFallbackUsed && missingInputs.length <= 1) {
    return {
      estimateQuality: 'robust',
      estimateQualityLabel: 'Robust estimate',
    }
  }

  if (confidenceScore >= 50 && missingInputs.length <= 3) {
    return {
      estimateQuality: 'partial',
      estimateQualityLabel: 'Partial estimate',
    }
  }

  return {
    estimateQuality: 'weak',
    estimateQualityLabel: 'Weak estimate',
  }
}

function buildConfidenceDrivers({ warnings, missingInputs }) {
  const drivers = [...warnings, ...missingInputs.map((item) => `Missing ${item}`)]
  return drivers.slice(0, 3)
}

function buildDecisionCopy({
  recommendationType,
  annualSavings,
  monthlySavings,
  breakEvenMonths,
  benchmarkFallbackUsed,
  estimateQualityLabel,
  confidenceLabel,
}) {
  if (recommendationType === 'refinance') {
    return {
      heroText: `Potential refinance value ~${formatMoney(annualSavings)}/year`,
      summary:
        benchmarkFallbackUsed
          ? `Savings look meaningful, but this is still a ${estimateQualityLabel.toLowerCase()} using a fallback benchmark.`
          : `Estimated savings are ${formatMoney(monthlySavings)}/month, with switching costs recovered in about ${breakEvenMonths} months.`,
    }
  }

  if (recommendationType === 'watch') {
    return {
      heroText: `Possible refinance value ~${formatMoney(annualSavings)}/year`,
      summary:
        Number.isFinite(breakEvenMonths) && breakEvenMonths > 0
          ? `The savings case is modest or slower to recover, with break-even around ${breakEvenMonths} months.`
          : `There may be some value here, but the savings case is not strong enough yet.`,
    }
  }

  if (recommendationType === 'competitive') {
    return {
      heroText: 'Current pricing looks broadly competitive',
      summary:
        benchmarkFallbackUsed
          ? `No material savings are visible against the fallback estimate. Confidence is ${confidenceLabel.toLowerCase()}.`
          : 'No material refinance savings are visible against the current benchmark.',
    }
  }

  return {
    heroText: 'More loan data is needed before this can be assessed confidently',
    summary: `${estimateQualityLabel}. Confidence is ${confidenceLabel.toLowerCase()} until the missing inputs are added.`,
  }
}

export function buildRefinanceAnalysis(
  loan,
  property = null,
  config = REFINANCE_CONFIG
) {
  const balance = Number(loan?.current_balance || loan?.loan_amount || 0)
  const currentRate = roundRate(loan?.interest_rate)
  const hasUsageType = Boolean(
    property?.usageType || property?.usage_type || property?.property_use
  )
  const usageType = normalizeUsageType(
    property?.usageType || property?.usage_type || property?.property_use
  )
  const fixedVariable = inferFixedVariable(loan)
  const repaymentType = normalizeRepaymentType(loan?.repayment_type)
  const propertyValue = Number(property?.current_value || 0)
  const lvr = propertyValue > 0 && balance > 0 ? (balance / propertyValue) * 100 : 0
  const equity = propertyValue > 0 ? propertyValue - balance : 0
  const offsetAmount = Number(
    loan?.offset_amount ?? loan?.offset_balance ?? config.assumptions.defaultOffsetAmount
  )
  const hasOffsetAmount =
    loan?.offset_amount !== undefined || loan?.offset_balance !== undefined
  const { months: remainingTermMonths, assumed: termWasAssumed } = getRemainingTermMonths(
    loan,
    config.assumptions.defaultRemainingTermMonths
  )
  const effectiveBalance = getEffectiveBalance(balance, offsetAmount)

  const currentRepayment =
    Number(loan?.monthly_repayment || 0) > 0
      ? Number(loan.monthly_repayment)
      : estimateRepayment({
          principal: effectiveBalance,
          annualRate: currentRate,
          repaymentType,
          remainingTermMonths,
        })
  const currentRepaymentEstimated = !(Number(loan?.monthly_repayment || 0) > 0)

  const refinanceCostEstimate = Number(
    loan?.refinance_cost_estimate ?? config.assumptions.defaultRefinanceCostEstimate
  )
  const missingRefinanceCost =
    loan?.refinance_cost_estimate === undefined || loan?.refinance_cost_estimate === null

  const benchmarkState = resolveBenchmarkRate({
    loan,
    property,
    lvr,
    usageType,
    fixedVariable,
    config,
  })
  const targetRate = benchmarkState.targetRate

  const savings = calculateRefinanceSavings({
    balance,
    offsetBalance: offsetAmount,
    currentRate,
    targetRate,
    remainingTermMonths,
    refinanceCostEstimate,
  })

  const estimatedNewRepayment = estimateRepayment({
    principal: effectiveBalance,
    annualRate: targetRate,
    repaymentType,
    remainingTermMonths,
  })

  const missingInputs = []
  if (!balance) missingInputs.push('loan balance')
  if (!currentRate) missingInputs.push('current interest rate')
  if (termWasAssumed) missingInputs.push('loan term remaining')
  if (!hasUsageType) missingInputs.push('owner occupied vs investment status')
  if (!hasOffsetAmount) missingInputs.push('offset balance')
  if (missingRefinanceCost) missingInputs.push('loan-specific refinance cost')

  const warnings = buildWarnings({
    termWasAssumed,
    hasUsageType,
    hasOffsetAmount,
    fixedVariable,
    loan,
    benchmarkFallbackUsed: benchmarkState.benchmarkFallbackUsed,
    remainingTermMonths,
    missingRefinanceCost,
  })

  if (currentRepaymentEstimated) {
    warnings.push('Current repayment was estimated from balance, rate, and repayment type')
  }

  const missingCriticalData = !balance || !currentRate
  const { confidenceScore, confidenceLabel } = getRefinanceConfidence({
    missingInputs,
    warnings,
    hasUsageType,
    hasOffsetAmount,
    benchmarkFallbackUsed: benchmarkState.benchmarkFallbackUsed,
    termWasAssumed,
    missingRefinanceCost,
  })
  const estimateQualityState = getEstimateQuality({
    confidenceScore,
    benchmarkFallbackUsed: benchmarkState.benchmarkFallbackUsed,
    missingInputs,
  })

  const recommendation = getRecommendation({
    targetRate,
    currentRate,
    rateDeltaBps: savings.rateDeltaBps,
    monthlySavings: savings.monthlySavings,
    breakEvenMonths: savings.breakEvenMonths,
    remainingTermMonths,
    confidenceScore,
    missingCriticalData,
    benchmarkFallbackUsed: benchmarkState.benchmarkFallbackUsed,
    annualSavings: savings.annualSavings,
    config,
  })

  const reasons = buildReasons({
    currentRate,
    targetRate,
    rateDeltaBps: savings.rateDeltaBps,
    monthlySavings: savings.monthlySavings,
    annualSavings: savings.annualSavings,
    remainingTermMonths,
    remainingTermSavings: savings.remainingTermSavings,
    effectiveBalance: savings.effectiveBalance,
    balance,
    breakEvenMonths: savings.breakEvenMonths,
    recommendationType: recommendation.recommendationType,
    missingCriticalData,
    benchmarkLabel: benchmarkState.benchmarkLabel,
    benchmarkFallbackUsed: benchmarkState.benchmarkFallbackUsed,
  })

  const userPrompts = []
  if (termWasAssumed) userPrompts.push('Add remaining loan term to improve repayment accuracy')
  if (!hasOffsetAmount) userPrompts.push('Add offset balance to refine true interest efficiency')
  if (!hasUsageType) {
    userPrompts.push(
      'Specify whether this loan is owner occupied or investment to improve benchmark comparison'
    )
  }
  if (benchmarkState.benchmarkFallbackUsed) {
    userPrompts.push('Add a market benchmark rate to replace the fallback comparison')
  }
  if (missingRefinanceCost) {
    userPrompts.push('Add a loan-specific refinance cost estimate to improve break-even accuracy')
  }

  const estimatedInterestBurden = roundCurrency(
    estimateInterestBurden({
      principal: effectiveBalance,
      annualRate: currentRate,
      repaymentType,
      monthlyRepayment: currentRepayment,
    })
  )
  const daysUntilFixedExpiry = getDaysUntil(loan?.fixed_rate_expiry)
  const confidenceDrivers = buildConfidenceDrivers({
    warnings,
    missingInputs,
  })
  const decisionCopy = buildDecisionCopy({
    recommendationType: recommendation.recommendationType,
    annualSavings: savings.annualSavings,
    monthlySavings: savings.monthlySavings,
    breakEvenMonths: savings.breakEvenMonths,
    benchmarkFallbackUsed: benchmarkState.benchmarkFallbackUsed,
    estimateQualityLabel: estimateQualityState.estimateQualityLabel,
    confidenceLabel,
  })

  return {
    propertyId: property?.id ?? loan?.property_id ?? null,
    loanId: loan?.id ?? null,
    propertyAddress: property?.address || 'Unknown property',
    lender: loan?.lender || 'Unknown lender',
    usageType,
    fixedVariable,
    repaymentType,
    currentRate,
    targetRate,
    benchmarkSource: benchmarkState.benchmarkSource,
    benchmarkLabel: benchmarkState.benchmarkLabel,
    benchmarkFallbackUsed: benchmarkState.benchmarkFallbackUsed,
    rateGapPct: savings.rateGapPct,
    rateDeltaBps: savings.rateDeltaBps,
    balance: roundCurrency(balance),
    effectiveBalance: savings.effectiveBalance,
    equity: roundCurrency(equity),
    lvr: Number.isFinite(lvr) ? Number(lvr.toFixed(1)) : 0,
    currentRepayment: roundCurrency(currentRepayment),
    estimatedNewRepayment: roundCurrency(estimatedNewRepayment),
    monthlySavings: savings.monthlySavings,
    annualSavings: savings.annualSavings,
    annualRunRateSavings: savings.annualRunRateSavings,
    threeYearSavings: savings.threeYearSavings,
    fiveYearSavings: savings.fiveYearSavings,
    netThreeYearSavings: savings.netThreeYearSavings,
    netFiveYearSavings: savings.netFiveYearSavings,
    remainingTermSavings: savings.remainingTermSavings,
    refinanceCostEstimate: savings.refinanceCostEstimate,
    breakEvenMonths: savings.breakEvenMonths,
    estimatedInterestBurden,
    annualInterestPaid: savings.annualInterestPaid,
    avoidableInterest: savings.avoidableInterest,
    refinanceRecommendation: recommendation.refinanceRecommendation,
    recommendationType: recommendation.recommendationType,
    confidenceScore,
    confidenceLabel,
    estimateQuality: estimateQualityState.estimateQuality,
    estimateQualityLabel: estimateQualityState.estimateQualityLabel,
    confidenceDrivers,
    reasons,
    warnings,
    missingInputs,
    recommendedNextInputs: userPrompts,
    daysUntilFixedExpiry,
    currentRepaymentEstimated,
    termWasAssumed,
    hasMeaningfulOpportunity: recommendation.recommendationType === 'refinance',
    heroText: decisionCopy.heroText,
    summary: decisionCopy.summary,
  }
}

export function buildPortfolioRefinanceRanking(
  loans = [],
  properties = [],
  config = REFINANCE_CONFIG
) {
  const propertyMap = Object.fromEntries(
    properties.map((property) => [String(property.id), property])
  )

  const analyses = loans.map((loan) =>
    buildRefinanceAnalysis(loan, propertyMap[String(loan.property_id)] || null, config)
  )

  return analyses.sort((a, b) => {
    const recommendationGap =
      RECOMMENDATION_ORDER[b.recommendationType] - RECOMMENDATION_ORDER[a.recommendationType]
    if (recommendationGap !== 0) return recommendationGap

    if (b.annualSavings !== a.annualSavings) return b.annualSavings - a.annualSavings
    if (b.fiveYearSavings !== a.fiveYearSavings) return b.fiveYearSavings - a.fiveYearSavings
    if (b.confidenceScore !== a.confidenceScore) return b.confidenceScore - a.confidenceScore

    const aBreakEven = Number.isFinite(a.breakEvenMonths) ? a.breakEvenMonths : 999
    const bBreakEven = Number.isFinite(b.breakEvenMonths) ? b.breakEvenMonths : 999
    return aBreakEven - bBreakEven
  })
}

export default buildRefinanceAnalysis
