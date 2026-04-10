import assert from 'node:assert/strict'

import {
  AUSTRALIAN_INCOME_TAX_EXAMPLES,
  calculateAustralianIncomeTax,
} from './australianIncomeTax.js'

const EXAMPLE_EXPECTATIONS = [
  {
    taxableIncome: 50000,
    taxPayableAnnual: 5788,
    effectiveTaxRate: 0.11576,
    marginalTaxRate: 0.3,
  },
  {
    taxableIncome: 120000,
    taxPayableAnnual: 26788,
    effectiveTaxRate: 0.22323,
    marginalTaxRate: 0.3,
  },
  {
    taxableIncome: 180000,
    taxPayableAnnual: 47938,
    effectiveTaxRate: 0.26632,
    marginalTaxRate: 0.37,
  },
  {
    taxableIncome: 250000,
    taxPayableAnnual: 78638,
    effectiveTaxRate: 0.31455,
    marginalTaxRate: 0.45,
  },
]

for (const expected of EXAMPLE_EXPECTATIONS) {
  const actual = calculateAustralianIncomeTax(expected.taxableIncome)

  assert.equal(actual.taxableIncome, expected.taxableIncome)
  assert.equal(actual.taxPayableAnnual, expected.taxPayableAnnual)
  assert.equal(actual.effectiveTaxRate, expected.effectiveTaxRate)
  assert.equal(actual.marginalTaxRate, expected.marginalTaxRate)
}

assert.equal(calculateAustralianIncomeTax(-1000).taxPayableAnnual, 0)
assert.equal(calculateAustralianIncomeTax(0).effectiveTaxRate, 0)
assert.equal(AUSTRALIAN_INCOME_TAX_EXAMPLES.length, 4)

console.log('Australian income tax examples/tests passed')
