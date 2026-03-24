export const roundCurrency = (value) => Math.round(Number.isFinite(value) ? value : 0)
export const roundRate = (value) => Number(Number(value || 0).toFixed(2))
export const roundBps = (value) => Math.round(Number.isFinite(value) ? value : 0)

export function normalizeUsageType(rawValue) {
  const value = String(rawValue || '')
    .trim()
    .toLowerCase()

  if (value === 'owner occupied' || value === 'owner-occupied' || value === 'owner_occupied') {
    return 'owner_occupied'
  }

  return value === 'investment' ? 'investment' : 'investment'
}

export function getRemainingTermMonths(loan, fallbackMonths) {
  const monthCandidates = [
    loan?.remaining_term_months,
    loan?.term_remaining_months,
    loan?.loan_term_remaining_months,
  ]

  const yearCandidates = [
    loan?.remaining_term_years,
    loan?.term_remaining_years,
    loan?.loan_term_remaining_years,
  ]

  const explicitMonths = monthCandidates.find((value) => Number(value) > 0)
  if (explicitMonths) {
    return {
      months: Math.round(Number(explicitMonths)),
      assumed: false,
    }
  }

  const explicitYears = yearCandidates.find((value) => Number(value) > 0)
  if (explicitYears) {
    return {
      months: Math.round(Number(explicitYears) * 12),
      assumed: false,
    }
  }

  return {
    months: fallbackMonths,
    assumed: true,
  }
}

export function getDaysUntil(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr) - new Date()
  if (!Number.isFinite(diff)) return null
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function estimatePIRepayment(principal, annualRate, months) {
  const safePrincipal = Number(principal || 0)
  const safeMonths = Number(months || 0)
  const safeRate = Number(annualRate || 0)

  if (!safePrincipal || !safeMonths) return 0
  if (safeRate === 0) return safePrincipal / safeMonths

  const monthlyRate = safeRate / 100 / 12
  return (
    (safePrincipal * monthlyRate * Math.pow(1 + monthlyRate, safeMonths)) /
    (Math.pow(1 + monthlyRate, safeMonths) - 1)
  )
}

export function estimateIORepayment(principal, annualRate) {
  return (Number(principal || 0) * Number(annualRate || 0)) / 100 / 12
}

export function estimateRepayment({
  principal,
  annualRate,
  repaymentType,
  remainingTermMonths,
}) {
  return repaymentType === 'Interest Only'
    ? estimateIORepayment(principal, annualRate)
    : estimatePIRepayment(principal, annualRate, remainingTermMonths)
}

export function estimateInterestBurden({
  principal,
  annualRate,
  repaymentType,
  monthlyRepayment,
}) {
  const balance = Number(principal || 0)
  const rate = Number(annualRate || 0)
  if (!balance || !rate) return 0

  const monthlyInterest = (balance * rate) / 100 / 12
  if (repaymentType === 'Interest Only') return monthlyInterest

  const repayment = Number(monthlyRepayment || 0)
  return Math.min(repayment, monthlyInterest)
}

export function getEffectiveBalance(balance, offsetBalance = 0) {
  const safeBalance = Number(balance || 0)
  const safeOffset = Math.max(0, Number(offsetBalance || 0))
  return Math.max(0, safeBalance - safeOffset)
}

export function calculateAnnualInterestFromRate(principal, annualRate) {
  const safePrincipal = Number(principal || 0)
  const safeRate = Number(annualRate || 0)
  if (!safePrincipal || !safeRate) return 0
  return safePrincipal * (safeRate / 100)
}

export function calculateRefinanceSavings({
  balance,
  offsetBalance = 0,
  currentRate,
  targetRate,
  remainingTermMonths = null,
  refinanceCostEstimate = 0,
}) {
  const safeBalance = Number(balance || 0)
  const safeCurrentRate = roundRate(currentRate)
  const safeTargetRate = roundRate(targetRate)
  const safeRemainingTermMonths =
    Number(remainingTermMonths) > 0 ? Math.round(Number(remainingTermMonths)) : null
  const safeRefinanceCostEstimate = Math.max(0, Number(refinanceCostEstimate || 0))
  const effectiveBalance = getEffectiveBalance(safeBalance, offsetBalance)
  const rawRateGapPct = safeCurrentRate - safeTargetRate
  const rateGapPct = rawRateGapPct > 0 ? rawRateGapPct : 0
  const rateDeltaBps = roundBps(rateGapPct * 100)

  // Use a simple interest-differential model so all displayed savings reconcile exactly.
  // This is more defensible than mixing repayment-difference math with benchmark-rate heuristics.
  const annualRunRateSavings = calculateAnnualInterestFromRate(effectiveBalance, rateGapPct)
  const monthlySavings = annualRunRateSavings > 0 ? annualRunRateSavings / 12 : 0
  const annualSavings = monthlySavings * 12
  const breakEvenMonths =
    monthlySavings > 0 ? Math.ceil(safeRefinanceCostEstimate / monthlySavings) : null

  const annualInterestPaid = calculateAnnualInterestFromRate(effectiveBalance, safeCurrentRate)
  const benchmarkAnnualInterest = calculateAnnualInterestFromRate(effectiveBalance, safeTargetRate)
  const avoidableInterest = Math.max(0, annualInterestPaid - benchmarkAnnualInterest)

  const threeYearMonths =
    safeRemainingTermMonths === null ? 36 : Math.min(36, safeRemainingTermMonths)
  const fiveYearMonths =
    safeRemainingTermMonths === null ? 60 : Math.min(60, safeRemainingTermMonths)
  const remainingTermSavings =
    safeRemainingTermMonths === null ? annualSavings : monthlySavings * safeRemainingTermMonths

  return {
    effectiveBalance: roundCurrency(effectiveBalance),
    rateGapPct: roundRate(rateGapPct),
    rateDeltaBps,
    monthlySavings: roundCurrency(monthlySavings),
    annualSavings: roundCurrency(annualSavings),
    annualRunRateSavings: roundCurrency(annualRunRateSavings),
    threeYearSavings: roundCurrency(monthlySavings * threeYearMonths),
    fiveYearSavings: roundCurrency(monthlySavings * fiveYearMonths),
    netThreeYearSavings: roundCurrency(monthlySavings * threeYearMonths - safeRefinanceCostEstimate),
    netFiveYearSavings: roundCurrency(monthlySavings * fiveYearMonths - safeRefinanceCostEstimate),
    remainingTermSavings: roundCurrency(remainingTermSavings),
    refinanceCostEstimate: roundCurrency(safeRefinanceCostEstimate),
    breakEvenMonths,
    annualInterestPaid: roundCurrency(annualInterestPaid),
    benchmarkAnnualInterest: roundCurrency(benchmarkAnnualInterest),
    avoidableInterest: roundCurrency(avoidableInterest),
  }
}
