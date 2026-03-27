const AU_RESIDENT_INDIVIDUAL_TAX_BRACKETS = [
  { min: 0, max: 18200, rate: 0 },
  { min: 18200, max: 45000, rate: 0.16 },
  { min: 45000, max: 135000, rate: 0.3 },
  { min: 135000, max: 190000, rate: 0.37 },
  { min: 190000, max: Infinity, rate: 0.45 },
]

function getSafeTaxableIncome(taxableIncome) {
  const numericIncome = Number(taxableIncome)
  if (!Number.isFinite(numericIncome)) return 0
  return Math.max(0, numericIncome)
}

function roundTaxValue(value) {
  return Number(value.toFixed(2))
}

function roundRate(value) {
  return Number(value.toFixed(5))
}

export function calculateAustralianIncomeTax(taxableIncome) {
  const normalizedTaxableIncome = getSafeTaxableIncome(taxableIncome)
  let taxPayableAnnual = 0
  let marginalTaxRate = 0

  for (const bracket of AU_RESIDENT_INDIVIDUAL_TAX_BRACKETS) {
    if (normalizedTaxableIncome <= bracket.min) break

    const taxablePortion = Math.min(normalizedTaxableIncome, bracket.max) - bracket.min
    taxPayableAnnual += taxablePortion * bracket.rate

    if (normalizedTaxableIncome > bracket.min) {
      marginalTaxRate = bracket.rate
    }
  }

  const effectiveTaxRate =
    normalizedTaxableIncome > 0 ? taxPayableAnnual / normalizedTaxableIncome : 0

  return {
    taxableIncome: roundTaxValue(normalizedTaxableIncome),
    taxPayableAnnual: roundTaxValue(taxPayableAnnual),
    effectiveTaxRate: roundRate(effectiveTaxRate),
    marginalTaxRate: roundRate(marginalTaxRate),
  }
}

export const AUSTRALIAN_INCOME_TAX_EXAMPLES = [
  calculateAustralianIncomeTax(50000),
  calculateAustralianIncomeTax(120000),
  calculateAustralianIncomeTax(180000),
  calculateAustralianIncomeTax(250000),
]

export { AU_RESIDENT_INDIVIDUAL_TAX_BRACKETS }
