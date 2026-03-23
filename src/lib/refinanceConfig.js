export const REFINANCE_CONFIG = {
  thresholds: {
    competitiveRateDeltaBps: 10,
    watchRateDeltaBps: 10,
    reviewRateDeltaBps: 20,
    strongRateDeltaBps: 40,
    minMonthlySavings: 50,
    minAnnualSavings: 600,
    reviewAnnualSavings: 1200,
    strongAnnualSavings: 2500,
    strongBreakEvenMonths: 12,
    maxReviewBreakEvenMonths: 24,
  },
  assumptions: {
    defaultRemainingTermMonths: 25 * 12,
    defaultRefinanceCostEstimate: 1200,
    defaultOffsetAmount: 0,
  },
  benchmarkRates: {
    usageBaseRate: {
      owner_occupied: 5.42,
      investment: 5.62,
    },
    loanTypeAdjustments: {
      Variable: 0,
      Fixed: 0.08,
      Split: 0.05,
    },
    lvrBands: [
      { max: 60, adjustment: 0 },
      { max: 70, adjustment: 0.05 },
      { max: 80, adjustment: 0.12 },
      { max: 90, adjustment: 0.28 },
      { max: Infinity, adjustment: 0.45 },
    ],
    lenderAdjustments: {
      westpac: 0.02,
      anz: 0.02,
      nab: 0.02,
      cba: 0.02,
      commonwealth: 0.02,
    },
  },
}

export default REFINANCE_CONFIG
