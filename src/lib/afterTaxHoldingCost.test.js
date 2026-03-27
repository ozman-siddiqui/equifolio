import assert from 'node:assert/strict'

import {
  AFTER_TAX_HOLDING_COST_EXAMPLES,
  calculateAfterTaxHoldingCost,
} from './afterTaxHoldingCost.js'

const negativeExample = calculateAfterTaxHoldingCost({
  monthlyPreTaxPropertyCashFlow: -1290,
  taxBenefitMonthly: 540,
})

assert.deepEqual(negativeExample, {
  monthlyPreTaxPropertyCashFlow: -1290,
  taxBenefitMonthly: 540,
  afterTaxMonthlyCashFlow: -750,
  cashFlowLabel: 'monthly holding cost',
})

const positiveExample = calculateAfterTaxHoldingCost({
  monthlyPreTaxPropertyCashFlow: 300,
  taxBenefitMonthly: 0,
})

assert.deepEqual(positiveExample, {
  monthlyPreTaxPropertyCashFlow: 300,
  taxBenefitMonthly: 0,
  afterTaxMonthlyCashFlow: 300,
  cashFlowLabel: 'after-tax monthly surplus',
})

const invalidInputExample = calculateAfterTaxHoldingCost({
  monthlyPreTaxPropertyCashFlow: undefined,
  taxBenefitMonthly: 'bad',
})

assert.deepEqual(invalidInputExample, {
  monthlyPreTaxPropertyCashFlow: 0,
  taxBenefitMonthly: 0,
  afterTaxMonthlyCashFlow: 0,
  cashFlowLabel: 'after-tax monthly surplus',
})

assert.equal(AFTER_TAX_HOLDING_COST_EXAMPLES.length, 2)

console.log('After-tax holding cost tests passed')
