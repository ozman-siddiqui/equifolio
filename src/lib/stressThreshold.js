import calculateBorrowingPower from './borrowingPowerEngine'
import { STRESS_HEADROOM_BUFFER } from '../config/marketRates'

const STRESS_TEST_RATES = [5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5]

export function calculateStressThreshold({
  financialProfile,
  liabilities,
  loans,
  transactions,
  currentCashRate,
  additionalMonthlyObligation = 0,
}) {
  const stressTestData = STRESS_TEST_RATES.map((rate) => {
    const stressResult = calculateBorrowingPower({
      financialProfile,
      liabilities,
      loans,
      transactions,
      config: {
        assessmentRatePct: rate,
      },
    })
    const monthlySurplus = Number(stressResult?.net_monthly_surplus || 0)
    const adjustedSurplus = monthlySurplus - additionalMonthlyObligation

    return {
      rate,
      monthlySurplus,
      adjustedSurplus,
    }
  })

  const maxTestedRate = STRESS_TEST_RATES[STRESS_TEST_RATES.length - 1]
  const firstNegativePoint =
    stressTestData.find((point) => Number(point.adjustedSurplus) < 0) || null
  const currentRateResult = calculateBorrowingPower({
    financialProfile,
    liabilities,
    loans,
    transactions,
    config: {
      assessmentRatePct: currentCashRate,
    },
  })
  const monthlySurplusAtCurrentRate = Number(currentRateResult?.net_monthly_surplus || 0)
  const adjustedSurplusAtCurrentRate =
    monthlySurplusAtCurrentRate - additionalMonthlyObligation

  const stressThresholdRate = firstNegativePoint?.rate ?? maxTestedRate
  const stressThresholdLabel = firstNegativePoint
    ? `${stressThresholdRate.toFixed(2)}%`
    : `>${maxTestedRate.toFixed(2)}%`

  let status = 'safe'
  if (firstNegativePoint) {
    if (stressThresholdRate > currentCashRate + STRESS_HEADROOM_BUFFER) {
      status = 'safe'
    } else if (stressThresholdRate > currentCashRate) {
      status = 'warning'
    } else {
      status = 'critical'
    }
  }
  const surplusAtCurrentRate = adjustedSurplusAtCurrentRate

  console.log('[STRESS DEBUG] additionalMonthlyObligation:', additionalMonthlyObligation)
  console.log('[STRESS DEBUG] firstNegativePoint:', firstNegativePoint)
  console.log('[STRESS DEBUG] surplusAtCurrentRate:', surplusAtCurrentRate)
  console.log('[STRESS DEBUG] stressThresholdRate:', stressThresholdRate)
  console.log('[STRESS DEBUG] stressThresholdLabel:', stressThresholdLabel)
  console.log('[STRESS DEBUG] last 5 series points:', stressTestData.slice(-5).map(p => ({
    rate: p.rate,
    raw: p.monthlySurplus,
    adjusted: p.adjustedSurplus ?? 'NOT SET'
  })))

  return {
    stressThresholdRate,
    stressThresholdLabel,
    status,
    surplusAtCurrentRate,
  }
}
