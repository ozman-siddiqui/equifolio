import assert from 'node:assert/strict'

import { calculateScenarioWealthOutcomes } from './portfolioGrowthScenarios.js'

const baseCase = calculateScenarioWealthOutcomes({
  purchasePrice: 650000,
  deposit: 130000,
  acquisitionCosts: 32500,
  monthlyAfterTaxCashFlow: -750,
  years: 5,
  equityGain: 240000,
})

assert.equal(baseCase.equityGain, 240000)
assert.equal(baseCase.totalCashInvested, 207500)
assert.equal(baseCase.netWealthCreated, 32500)
assert.equal(baseCase.wealthMultiple, 240000 / 207500)

const positiveCashFlowCase = calculateScenarioWealthOutcomes({
  purchasePrice: 650000,
  deposit: 130000,
  acquisitionCosts: 32500,
  monthlyAfterTaxCashFlow: 250,
  years: 5,
  equityGain: 240000,
})

assert.equal(positiveCashFlowCase.totalCashInvested, 147500)
assert.equal(positiveCashFlowCase.netWealthCreated, 92500)

const zeroCapitalCase = calculateScenarioWealthOutcomes({
  deposit: 0,
  acquisitionCosts: 0,
  monthlyAfterTaxCashFlow: 0,
  years: 5,
  equityGain: 0,
})

assert.equal(zeroCapitalCase.totalCashInvested, 0)
assert.equal(zeroCapitalCase.netWealthCreated, 0)
assert.equal(zeroCapitalCase.wealthMultiple, null)

console.log('portfolioGrowthScenarios wealth tests passed')
