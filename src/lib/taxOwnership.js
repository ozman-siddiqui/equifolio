export const TAX_OWNERSHIP_STRUCTURES = {
  individual: 'individual',
  joint: 'joint',
}

export function normalizeTaxOwnership({
  ownershipStructure,
  ownershipSplitUserPct,
  ownershipSplitPartnerPct,
} = {}) {
  const normalizedStructure =
    ownershipStructure === TAX_OWNERSHIP_STRUCTURES.joint
      ? TAX_OWNERSHIP_STRUCTURES.joint
      : TAX_OWNERSHIP_STRUCTURES.individual

  if (normalizedStructure === TAX_OWNERSHIP_STRUCTURES.individual) {
    return {
      ownershipStructure: TAX_OWNERSHIP_STRUCTURES.individual,
      ownershipSplitUserPct: 100,
      ownershipSplitPartnerPct: 0,
    }
  }

  const normalizedUserPct = Number.isFinite(Number(ownershipSplitUserPct))
    ? Number(ownershipSplitUserPct)
    : 50
  const normalizedPartnerPct = Number.isFinite(Number(ownershipSplitPartnerPct))
    ? Number(ownershipSplitPartnerPct)
    : 50

  return {
    ownershipStructure: TAX_OWNERSHIP_STRUCTURES.joint,
    ownershipSplitUserPct: normalizedUserPct,
    ownershipSplitPartnerPct: normalizedPartnerPct,
  }
}

export function validateTaxOwnership({
  ownershipStructure,
  ownershipSplitUserPct,
  ownershipSplitPartnerPct,
  partnerIncomeAnnual,
} = {}) {
  const normalizedOwnership = normalizeTaxOwnership({
    ownershipStructure,
    ownershipSplitUserPct,
    ownershipSplitPartnerPct,
  })

  if (normalizedOwnership.ownershipSplitUserPct < 0 || normalizedOwnership.ownershipSplitPartnerPct < 0) {
    return 'Ownership split percentages cannot be negative.'
  }

  const ownershipTotal =
    normalizedOwnership.ownershipSplitUserPct + normalizedOwnership.ownershipSplitPartnerPct

  if (ownershipTotal !== 100) {
    return 'Ownership split percentages must total 100.'
  }

  if (
    normalizedOwnership.ownershipStructure === TAX_OWNERSHIP_STRUCTURES.joint &&
    !(Number.isFinite(Number(partnerIncomeAnnual)) && Number(partnerIncomeAnnual) > 0)
  ) {
    return 'Joint ownership requires partner income data to be available.'
  }

  return ''
}
