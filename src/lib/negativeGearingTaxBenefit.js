import { calculateAustralianIncomeTax } from './australianIncomeTax.js'
import {
  normalizeTaxOwnership,
  TAX_OWNERSHIP_STRUCTURES,
} from './taxOwnership.js'

function getSafeNumber(value) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

function roundCurrency(value) {
  return Number(value.toFixed(2))
}

function resolveAnnualPropertyCashFlow({
  annualPropertyCashFlow,
  monthlyPreTaxPropertyCashFlow,
} = {}) {
  const explicitAnnualCashFlow = Number(annualPropertyCashFlow)
  if (Number.isFinite(explicitAnnualCashFlow)) {
    return roundCurrency(explicitAnnualCashFlow)
  }

  return roundCurrency(getSafeNumber(monthlyPreTaxPropertyCashFlow) * 12)
}

function calculateOwnerTaxBenefit(ownerTaxableIncome, allocatedLoss) {
  const safeTaxableIncome = Math.max(0, getSafeNumber(ownerTaxableIncome))
  const safeAllocatedLoss = Math.max(0, getSafeNumber(allocatedLoss))
  const taxBefore = calculateAustralianIncomeTax(safeTaxableIncome)
  const taxAfter = calculateAustralianIncomeTax(
    Math.max(0, safeTaxableIncome - safeAllocatedLoss)
  )

  return roundCurrency(Math.max(0, taxBefore.taxPayableAnnual - taxAfter.taxPayableAnnual))
}

export function calculateNegativeGearingTaxBenefit({
  ownershipStructure,
  ownershipSplitUserPct,
  ownershipSplitPartnerPct,
  userTaxableIncome,
  partnerTaxableIncome,
  annualTaxableIncome,
  annualPropertyCashFlow,
  monthlyPreTaxPropertyCashFlow,
  includeDepreciation,
  annualDepreciation,
} = {}) {
  const resolvedOwnership = normalizeTaxOwnership({
    ownershipStructure,
    ownershipSplitUserPct,
    ownershipSplitPartnerPct,
  })
  const resolvedAnnualPropertyCashFlow = resolveAnnualPropertyCashFlow({
    annualPropertyCashFlow,
    monthlyPreTaxPropertyCashFlow,
  })

  const safeAnnualDepreciation = Math.max(0, getSafeNumber(annualDepreciation))
  const depreciationAnnual =
    includeDepreciation === true ? roundCurrency(safeAnnualDepreciation) : 0
  const depreciationMonthly = roundCurrency(depreciationAnnual / 12)

  if (resolvedAnnualPropertyCashFlow >= 0) {
    return {
      annualPropertyCashFlow: resolvedAnnualPropertyCashFlow,
      annualLoss: 0,
      totalTaxableLoss: 0,
      depreciationAnnual,
      depreciationMonthly,
      depreciationTaxBenefitMonthly: 0,
      userAllocatedLoss: 0,
      partnerAllocatedLoss: 0,
      userTaxBenefitAnnual: 0,
      partnerTaxBenefitAnnual: 0,
      totalTaxBenefitAnnual: 0,
      totalTaxBenefitMonthly: 0,
      taxBenefitAnnual: 0,
      taxBenefitMonthly: 0,
      ownershipStructure: resolvedOwnership.ownershipStructure,
      ownershipSplitUserPct: resolvedOwnership.ownershipSplitUserPct,
      ownershipSplitPartnerPct: resolvedOwnership.ownershipSplitPartnerPct,
    }
  }

  const annualLoss = roundCurrency(Math.abs(resolvedAnnualPropertyCashFlow))
  const totalTaxableLoss = roundCurrency(annualLoss + depreciationAnnual)
  const resolvedUserTaxableIncome =
    resolvedOwnership.ownershipStructure === TAX_OWNERSHIP_STRUCTURES.individual
      ? annualTaxableIncome ?? userTaxableIncome
      : userTaxableIncome
  const resolvedPartnerTaxableIncome =
    resolvedOwnership.ownershipStructure === TAX_OWNERSHIP_STRUCTURES.individual
      ? 0
      : partnerTaxableIncome

  const userAllocatedLoss = roundCurrency(
    totalTaxableLoss * (resolvedOwnership.ownershipSplitUserPct / 100)
  )
  const partnerAllocatedLoss =
    resolvedOwnership.ownershipStructure === TAX_OWNERSHIP_STRUCTURES.joint
      ? roundCurrency(totalTaxableLoss * (resolvedOwnership.ownershipSplitPartnerPct / 100))
      : 0

  const userTaxBenefitAnnual = calculateOwnerTaxBenefit(
    resolvedUserTaxableIncome,
    userAllocatedLoss
  )
  const partnerTaxBenefitAnnual =
    resolvedOwnership.ownershipStructure === TAX_OWNERSHIP_STRUCTURES.joint
      ? calculateOwnerTaxBenefit(resolvedPartnerTaxableIncome, partnerAllocatedLoss)
      : 0

  const totalTaxBenefitAnnual = roundCurrency(
    userTaxBenefitAnnual + partnerTaxBenefitAnnual
  )
  const baseTaxBenefitAnnual = roundCurrency(
    calculateOwnerTaxBenefit(
      resolvedUserTaxableIncome,
      roundCurrency(annualLoss * (resolvedOwnership.ownershipSplitUserPct / 100))
    ) +
      (
        resolvedOwnership.ownershipStructure === TAX_OWNERSHIP_STRUCTURES.joint
          ? calculateOwnerTaxBenefit(
              resolvedPartnerTaxableIncome,
              roundCurrency(annualLoss * (resolvedOwnership.ownershipSplitPartnerPct / 100))
            )
          : 0
      )
  )
  const depreciationTaxBenefitAnnual = roundCurrency(
    Math.max(totalTaxBenefitAnnual - baseTaxBenefitAnnual, 0)
  )

  return {
    annualPropertyCashFlow: resolvedAnnualPropertyCashFlow,
    annualLoss,
    totalTaxableLoss,
    depreciationAnnual,
    depreciationMonthly,
    depreciationTaxBenefitMonthly: roundCurrency(depreciationTaxBenefitAnnual / 12),
    userAllocatedLoss,
    partnerAllocatedLoss,
    userTaxBenefitAnnual,
    partnerTaxBenefitAnnual,
    totalTaxBenefitAnnual,
    totalTaxBenefitMonthly: roundCurrency(totalTaxBenefitAnnual / 12),
    taxBenefitAnnual: totalTaxBenefitAnnual,
    taxBenefitMonthly: roundCurrency(totalTaxBenefitAnnual / 12),
    ownershipStructure: resolvedOwnership.ownershipStructure,
    ownershipSplitUserPct: resolvedOwnership.ownershipSplitUserPct,
    ownershipSplitPartnerPct: resolvedOwnership.ownershipSplitPartnerPct,
  }
}

export const NEGATIVE_GEARING_TAX_BENEFIT_EXAMPLES = [
  calculateNegativeGearingTaxBenefit({
    ownershipStructure: 'individual',
    userTaxableIncome: 120000,
    annualPropertyCashFlow: -12000,
  }),
  calculateNegativeGearingTaxBenefit({
    ownershipStructure: 'joint',
    ownershipSplitUserPct: 50,
    ownershipSplitPartnerPct: 50,
    userTaxableIncome: 120000,
    partnerTaxableIncome: 80000,
    annualPropertyCashFlow: -12000,
  }),
  calculateNegativeGearingTaxBenefit({
    ownershipStructure: 'joint',
    ownershipSplitUserPct: 70,
    ownershipSplitPartnerPct: 30,
    userTaxableIncome: 180000,
    partnerTaxableIncome: 50000,
    annualPropertyCashFlow: -12000,
  }),
]
