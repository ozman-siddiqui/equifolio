function getSafeNumber(value) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

function roundCurrency(value) {
  return Number(value.toFixed(2))
}

export function calculateAfterTaxHoldingCost({
  monthlyPreTaxPropertyCashFlow,
  taxBenefitMonthly,
} = {}) {
  const safeMonthlyPreTaxPropertyCashFlow = getSafeNumber(monthlyPreTaxPropertyCashFlow)
  const safeTaxBenefitMonthly = getSafeNumber(taxBenefitMonthly)
  const afterTaxMonthlyCashFlow = roundCurrency(
    safeMonthlyPreTaxPropertyCashFlow + safeTaxBenefitMonthly
  )

  return {
    monthlyPreTaxPropertyCashFlow: roundCurrency(safeMonthlyPreTaxPropertyCashFlow),
    taxBenefitMonthly: roundCurrency(safeTaxBenefitMonthly),
    afterTaxMonthlyCashFlow,
    cashFlowLabel:
      afterTaxMonthlyCashFlow < 0 ? 'monthly holding cost' : 'after-tax monthly surplus',
  }
}

export const AFTER_TAX_HOLDING_COST_EXAMPLES = [
  calculateAfterTaxHoldingCost({
    monthlyPreTaxPropertyCashFlow: -1290,
    taxBenefitMonthly: 540,
  }),
  calculateAfterTaxHoldingCost({
    monthlyPreTaxPropertyCashFlow: 250,
    taxBenefitMonthly: 0,
  }),
]
