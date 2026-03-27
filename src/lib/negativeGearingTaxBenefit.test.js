import assert from 'node:assert/strict'

import {
  NEGATIVE_GEARING_TAX_BENEFIT_EXAMPLES,
  calculateNegativeGearingTaxBenefit,
} from './negativeGearingTaxBenefit.js'

const noBenefit = calculateNegativeGearingTaxBenefit({
  ownershipStructure: 'individual',
  userTaxableIncome: 120000,
  annualPropertyCashFlow: 3000,
})

assert.deepEqual(noBenefit, {
  annualPropertyCashFlow: 3000,
  annualLoss: 0,
  totalTaxableLoss: 0,
  depreciationAnnual: 0,
  depreciationMonthly: 0,
  depreciationTaxBenefitMonthly: 0,
  userAllocatedLoss: 0,
  partnerAllocatedLoss: 0,
  userTaxBenefitAnnual: 0,
  partnerTaxBenefitAnnual: 0,
  totalTaxBenefitAnnual: 0,
  totalTaxBenefitMonthly: 0,
  taxBenefitAnnual: 0,
  taxBenefitMonthly: 0,
  ownershipStructure: 'individual',
  ownershipSplitUserPct: 100,
  ownershipSplitPartnerPct: 0,
})

const individualOwnership = calculateNegativeGearingTaxBenefit({
  ownershipStructure: 'individual',
  userTaxableIncome: 120000,
  annualPropertyCashFlow: -12000,
})

assert.deepEqual(individualOwnership, {
  annualPropertyCashFlow: -12000,
  annualLoss: 12000,
  totalTaxableLoss: 12000,
  depreciationAnnual: 0,
  depreciationMonthly: 0,
  depreciationTaxBenefitMonthly: 0,
  userAllocatedLoss: 12000,
  partnerAllocatedLoss: 0,
  userTaxBenefitAnnual: 3600,
  partnerTaxBenefitAnnual: 0,
  totalTaxBenefitAnnual: 3600,
  totalTaxBenefitMonthly: 300,
  taxBenefitAnnual: 3600,
  taxBenefitMonthly: 300,
  ownershipStructure: 'individual',
  ownershipSplitUserPct: 100,
  ownershipSplitPartnerPct: 0,
})

const jointFiftyFifty = calculateNegativeGearingTaxBenefit({
  ownershipStructure: 'joint',
  ownershipSplitUserPct: 50,
  ownershipSplitPartnerPct: 50,
  userTaxableIncome: 120000,
  partnerTaxableIncome: 80000,
  annualPropertyCashFlow: -12000,
})

assert.deepEqual(jointFiftyFifty, {
  annualPropertyCashFlow: -12000,
  annualLoss: 12000,
  totalTaxableLoss: 12000,
  depreciationAnnual: 0,
  depreciationMonthly: 0,
  depreciationTaxBenefitMonthly: 0,
  userAllocatedLoss: 6000,
  partnerAllocatedLoss: 6000,
  userTaxBenefitAnnual: 1800,
  partnerTaxBenefitAnnual: 1800,
  totalTaxBenefitAnnual: 3600,
  totalTaxBenefitMonthly: 300,
  taxBenefitAnnual: 3600,
  taxBenefitMonthly: 300,
  ownershipStructure: 'joint',
  ownershipSplitUserPct: 50,
  ownershipSplitPartnerPct: 50,
})

const jointSeventyThirty = calculateNegativeGearingTaxBenefit({
  ownershipStructure: 'joint',
  ownershipSplitUserPct: 70,
  ownershipSplitPartnerPct: 30,
  userTaxableIncome: 180000,
  partnerTaxableIncome: 50000,
  annualPropertyCashFlow: -12000,
})

assert.deepEqual(jointSeventyThirty, {
  annualPropertyCashFlow: -12000,
  annualLoss: 12000,
  totalTaxableLoss: 12000,
  depreciationAnnual: 0,
  depreciationMonthly: 0,
  depreciationTaxBenefitMonthly: 0,
  userAllocatedLoss: 8400,
  partnerAllocatedLoss: 3600,
  userTaxBenefitAnnual: 3108,
  partnerTaxBenefitAnnual: 1080,
  totalTaxBenefitAnnual: 4188,
  totalTaxBenefitMonthly: 349,
  taxBenefitAnnual: 4188,
  taxBenefitMonthly: 349,
  ownershipStructure: 'joint',
  ownershipSplitUserPct: 70,
  ownershipSplitPartnerPct: 30,
})

const withDepreciation = calculateNegativeGearingTaxBenefit({
  ownershipStructure: 'joint',
  ownershipSplitUserPct: 50,
  ownershipSplitPartnerPct: 50,
  userTaxableIncome: 120000,
  partnerTaxableIncome: 80000,
  annualPropertyCashFlow: -12000,
  includeDepreciation: true,
  annualDepreciation: 8000,
})

assert.deepEqual(withDepreciation, {
  annualPropertyCashFlow: -12000,
  annualLoss: 12000,
  totalTaxableLoss: 20000,
  depreciationAnnual: 8000,
  depreciationMonthly: 666.67,
  depreciationTaxBenefitMonthly: 200,
  userAllocatedLoss: 10000,
  partnerAllocatedLoss: 10000,
  userTaxBenefitAnnual: 3000,
  partnerTaxBenefitAnnual: 3000,
  totalTaxBenefitAnnual: 6000,
  totalTaxBenefitMonthly: 500,
  taxBenefitAnnual: 6000,
  taxBenefitMonthly: 500,
  ownershipStructure: 'joint',
  ownershipSplitUserPct: 50,
  ownershipSplitPartnerPct: 50,
})

const legacyMonthlyInput = calculateNegativeGearingTaxBenefit({
  annualTaxableIncome: 120000,
  monthlyPreTaxPropertyCashFlow: -500,
})

assert.equal(legacyMonthlyInput.totalTaxBenefitAnnual, 1800)
assert.equal(legacyMonthlyInput.totalTaxBenefitMonthly, 150)
assert.equal(NEGATIVE_GEARING_TAX_BENEFIT_EXAMPLES.length, 3)

console.log('Ownership-aware negative gearing tax benefit tests passed')
