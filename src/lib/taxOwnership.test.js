import assert from 'node:assert/strict'

import {
  normalizeTaxOwnership,
  validateTaxOwnership,
} from './taxOwnership.js'

assert.deepEqual(
  normalizeTaxOwnership({
    ownershipStructure: 'individual',
    ownershipSplitUserPct: 70,
    ownershipSplitPartnerPct: 30,
  }),
  {
    ownershipStructure: 'individual',
    ownershipSplitUserPct: 100,
    ownershipSplitPartnerPct: 0,
  }
)

assert.deepEqual(
  normalizeTaxOwnership({
    ownershipStructure: 'joint',
  }),
  {
    ownershipStructure: 'joint',
    ownershipSplitUserPct: 50,
    ownershipSplitPartnerPct: 50,
  }
)

assert.deepEqual(
  normalizeTaxOwnership({
    ownershipStructure: 'joint',
    ownershipSplitUserPct: 70,
    ownershipSplitPartnerPct: 30,
  }),
  {
    ownershipStructure: 'joint',
    ownershipSplitUserPct: 70,
    ownershipSplitPartnerPct: 30,
  }
)

assert.equal(
  validateTaxOwnership({
    ownershipStructure: 'joint',
    ownershipSplitUserPct: 70,
    ownershipSplitPartnerPct: 20,
    partnerIncomeAnnual: 50000,
  }),
  'Ownership split percentages must total 100.'
)

assert.equal(
  validateTaxOwnership({
    ownershipStructure: 'joint',
    ownershipSplitUserPct: 50,
    ownershipSplitPartnerPct: 50,
    partnerIncomeAnnual: 0,
  }),
  'Joint ownership requires partner income data to be available.'
)

assert.equal(
  validateTaxOwnership({
    ownershipStructure: 'joint',
    ownershipSplitUserPct: 50,
    ownershipSplitPartnerPct: 50,
    partnerIncomeAnnual: 50000,
  }),
  ''
)

console.log('Tax ownership normalization/tests passed')
