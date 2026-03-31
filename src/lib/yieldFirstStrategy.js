import { MARKET_FLOORS } from '../config/marketFloors'

export function calculateYieldFirstScenario(inputs = {}) {
  const {
    borrowingCapacity = 0,
    deployableCapital = 0,
    interestRatePct = 0,
    depositRatio = 0,
    acquisitionCostRate = 0,
    netMonthlySurplus = 0,
    totalPortfolioValue = 0,
    metroBlocked = false,
  } = inputs

  const safeBorrowingCapacity = Number(borrowingCapacity) || 0
  const safeDeployableCapital = Number(deployableCapital) || 0
  const safeInterestRatePct = Number(interestRatePct) || 0
  const safeDepositRatio = Number(depositRatio) || 0
  const safeAcquisitionCostRate = Number(acquisitionCostRate) || 0
  const safeTotalPortfolioValue = Number(totalPortfolioValue) || 0

  const borrowingDenominator = 1 - safeDepositRatio
  const capitalDenominator = safeDepositRatio + safeAcquisitionCostRate

  const maxFromBorrowing =
    borrowingDenominator > 0 ? safeBorrowingCapacity / borrowingDenominator : 0

  const maxFromCapital =
    capitalDenominator > 0 ? safeDeployableCapital / capitalDenominator : 0

  const maxPurchase = Math.min(maxFromBorrowing, maxFromCapital)

  const YIELD_LOW = 0.06
  const YIELD_HIGH = 0.08
  const EXPENSE_RATE = 0.015
  const MAX_SHORTFALL = 150
  const interestRate = safeInterestRatePct / 100

  const lowDenominator = YIELD_HIGH - interestRate - EXPENSE_RATE
  const highDenominator = YIELD_LOW - interestRate - EXPENSE_RATE

  const neutralPriceLow =
    lowDenominator !== 0
      ? Math.abs((-MAX_SHORTFALL * 12) / lowDenominator)
      : MARKET_FLOORS.regionalYield

  const neutralPriceHigh =
    highDenominator !== 0
      ? Math.abs((-MAX_SHORTFALL * 12) / highDenominator)
      : MARKET_FLOORS.regionalYield

  const purchaseLow = Math.round(
    Math.max(
      MARKET_FLOORS.regionalYield,
      Math.min(neutralPriceLow, maxPurchase)
    )
  )

  const purchaseHigh = Math.round(
    Math.max(
      MARKET_FLOORS.regionalYield,
      Math.min(neutralPriceHigh, maxPurchase)
    )
  )

  const midPrice = (purchaseLow + purchaseHigh) / 2
  const monthlyMortgage = (midPrice * interestRate) / 12
  const monthlyRentLow = (midPrice * YIELD_LOW) / 12
  const monthlyRentHigh = (midPrice * YIELD_HIGH) / 12
  const monthlyExpenses = (midPrice * EXPENSE_RATE) / 12

  const monthlyHoldingLow = Math.round(
    monthlyMortgage + monthlyExpenses - monthlyRentHigh
  )

  const monthlyHoldingHigh = Math.round(
    monthlyMortgage + monthlyExpenses - monthlyRentLow
  )

  const requiredCapital =
    MARKET_FLOORS.metro * (safeDepositRatio + safeAcquisitionCostRate)

  const capitalGap = Math.max(0, requiredCapital - safeDeployableCapital)
  const monthlyEquityGrowth = (safeTotalPortfolioValue * 0.06) / 12

  const estimatedMonthsToMetro =
    capitalGap > 0 && monthlyEquityGrowth > 0
      ? Math.min(60, Math.round(capitalGap / monthlyEquityGrowth))
      : 0

  const isExecutable =
    maxPurchase >= MARKET_FLOORS.regionalYield &&
    purchaseLow >= MARKET_FLOORS.regionalYield

  const constraintType = maxFromCapital < maxFromBorrowing ? 'capital' : 'borrowing'

  return {
    isExecutable,
    purchaseRangeLow: purchaseLow,
    purchaseRangeHigh: purchaseHigh,
    monthlyHoldingLow,
    monthlyHoldingHigh,
    yieldRangeLow: YIELD_LOW * 100,
    yieldRangeHigh: YIELD_HIGH * 100,
    constraintType,
    estimatedMonthsToMetro,
    maxPurchase: Math.round(maxPurchase),
    capitalGap: Math.round(capitalGap),
    metroBlocked,
    netMonthlySurplus,
  }
}
