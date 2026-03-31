import { MARKET_FLOORS } from '../config/marketFloors'

function toSafeNumber(value, fallback = 0) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function getCashFlowScore(netMonthlySurplus) {
  if (netMonthlySurplus >= 2000) return 100
  if (netMonthlySurplus >= 500) return 75
  if (netMonthlySurplus >= 0) return 50
  return 25
}

function getPortfolioEquityScore(usableEquity) {
  if (usableEquity === null || usableEquity === undefined) return 0

  const safeUsableEquity = toSafeNumber(usableEquity, 0)

  if (safeUsableEquity >= 200000) return 100
  if (safeUsableEquity >= 100000) return 75
  if (safeUsableEquity >= 50000) return 50
  if (safeUsableEquity >= 0) return 25
  return 0
}

function getBand(finalScore) {
  if (finalScore >= 90) return 'ready'
  if (finalScore >= 70) return 'close'
  if (finalScore >= 40) return 'building'
  return 'early'
}

function getLabel(band) {
  switch (band) {
    case 'ready':
      return 'Ready to act'
    case 'close':
      return 'Getting close'
    case 'building':
      return 'Building toward acquisition'
    default:
      return 'Early stage'
  }
}

function getTopUnlockAction(primaryConstraint) {
  switch (primaryConstraint) {
    case 'borrowing':
      return 'Reduce liabilities or increase income to improve borrowing capacity'
    case 'capital':
      return 'Build deployable capital through equity growth or savings'
    case 'data':
      return 'Complete your mortgage and financial profile data'
    case 'cashflow':
      return 'Improve monthly cash flow position'
    case 'equity':
    default:
      return 'Continue building portfolio equity'
  }
}

export function calculateAcquisitionReadiness(inputs = {}) {
  const {
    borrowingCapacity = 0,
    deployableCapital = 0,
    netMonthlySurplus = 0,
    usableEquity = 0,
    borrowingReady = false,
    financialProfileComplete = false,
    loanDataComplete = false,
    hasLiabilitiesData = false,
    depositRatio = 0,
    acquisitionCostRate = 0,
  } = inputs

  let dataCompletenessScore = 0
  if (borrowingReady) dataCompletenessScore += 40
  if (financialProfileComplete) dataCompletenessScore += 30
  if (loanDataComplete) dataCompletenessScore += 20
  if (hasLiabilitiesData) dataCompletenessScore += 10
  const pillar1Score = Math.min(100, dataCompletenessScore)

  const requiredBorrowing = MARKET_FLOORS.regionalYield * 0.8
  const borrowingRatio =
    requiredBorrowing > 0 ? toSafeNumber(borrowingCapacity) / requiredBorrowing : 0
  const pillar2Score = clampScore(Math.min(100, Math.round(borrowingRatio * 100)))

  const effectiveCapitalRatio =
    (toSafeNumber(depositRatio) || 0.2) +
    (toSafeNumber(acquisitionCostRate) || 0.05)
  const requiredCapital = MARKET_FLOORS.regionalYield * effectiveCapitalRatio
  const capitalRatio =
    requiredCapital > 0 ? toSafeNumber(deployableCapital) / requiredCapital : 0
  const pillar3Score = clampScore(Math.min(100, Math.round(capitalRatio * 100)))

  const pillar4Score = getCashFlowScore(toSafeNumber(netMonthlySurplus))
  const pillar5Score = getPortfolioEquityScore(usableEquity)

  const finalScore = Math.round(
    pillar1Score * 0.2 +
      pillar2Score * 0.25 +
      pillar3Score * 0.25 +
      pillar4Score * 0.15 +
      pillar5Score * 0.15
  )

  const band = getBand(finalScore)
  const label = getLabel(band)

  const pillarEntries = [
    ['data', pillar1Score],
    ['borrowing', pillar2Score],
    ['capital', pillar3Score],
    ['cashflow', pillar4Score],
    ['equity', pillar5Score],
  ]
  const [primaryConstraint] = pillarEntries.reduce((lowest, current) =>
    current[1] < lowest[1] ? current : lowest
  )

  return {
    finalScore,
    band,
    label,
    primaryConstraint,
    topUnlockAction: getTopUnlockAction(primaryConstraint),
    pillars: {
      dataCompleteness: { score: pillar1Score, weight: 0.2 },
      borrowingCapacity: { score: pillar2Score, weight: 0.25 },
      capitalPosition: { score: pillar3Score, weight: 0.25 },
      cashFlowHealth: { score: pillar4Score, weight: 0.15 },
      portfolioEquity: { score: pillar5Score, weight: 0.15 },
    },
  }
}
