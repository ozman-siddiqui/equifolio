import { CURRENT_CASH_RATE, STRESS_HEADROOM_BUFFER } from '../config/marketRates.js'
import { calculateBorrowingPower } from './borrowingPowerEngine.js'

export function calculateStressThreshold({
  financialProfile,
  liabilities,
  loans,
  transactions,
  currentCashRate = CURRENT_CASH_RATE,
  additionalMonthlyObligation = 0,
}) {
  const rateMin = 5.0
  const rateMax = 10.0
  const rateStep = 0.25
  const rates = []

  for (let r = rateMin; r <= rateMax + 0.001; r += rateStep) {
    rates.push(Math.round(r * 100) / 100)
  }

  let surplusAtCurrentRate = null

  const series = rates.map((rate) => {
    const result = calculateBorrowingPower({
      financialProfile,
      liabilities,
      loans,
      transactions,
<<<<<<< HEAD
      config: {
        assessmentRatePct: rate,
      },
    })

    const rawSurplus = Number(
      result?.net_monthly_surplus ??
      result?.derived?.net_monthly_surplus ??
      0
    )

    const adjustedSurplus =
      rawSurplus - additionalMonthlyObligation
=======
      config: { assessmentRatePct: rate },
    })

    const rawSurplus = Number(result?.net_monthly_surplus ?? 0)
    const adjustedSurplus = rawSurplus - additionalMonthlyObligation
>>>>>>> dev-ui-experiments

    if (Math.abs(rate - currentCashRate) < 0.001) {
      surplusAtCurrentRate = adjustedSurplus
    }

<<<<<<< HEAD
    return {
      rate,
      rawSurplus,
      adjustedSurplus,
    }
  })

  const firstNegativePoint = series.find(
    (p) => p.adjustedSurplus < 0
  )

=======
    return { rate, rawSurplus, adjustedSurplus }
  })

  const firstNegativePoint = series.find((p) => p.adjustedSurplus < 0)
>>>>>>> dev-ui-experiments
  const maxTestedRate = rateMax

  let stressThresholdRate
  let stressThresholdLabel

  if (firstNegativePoint) {
    stressThresholdRate = firstNegativePoint.rate
    stressThresholdLabel = `${firstNegativePoint.rate.toFixed(2)}%`
  } else {
    stressThresholdRate = maxTestedRate
    stressThresholdLabel = `>${maxTestedRate.toFixed(2)}%`
  }

  let status

  if (!firstNegativePoint) {
    status = 'safe'
<<<<<<< HEAD
  } else if (
    stressThresholdRate >
    currentCashRate + STRESS_HEADROOM_BUFFER
  ) {
    status = 'safe'
  } else if (
    stressThresholdRate > currentCashRate
  ) {
=======
  } else if (stressThresholdRate > currentCashRate + STRESS_HEADROOM_BUFFER) {
    status = 'safe'
  } else if (stressThresholdRate > currentCashRate) {
>>>>>>> dev-ui-experiments
    status = 'warning'
  } else {
    status = 'critical'
  }

  return {
    stressThresholdRate,
    stressThresholdLabel,
    status,
<<<<<<< HEAD
    surplusAtCurrentRate:
      surplusAtCurrentRate ?? 0,
=======
    surplusAtCurrentRate: surplusAtCurrentRate ?? 0,
>>>>>>> dev-ui-experiments
  }
}
