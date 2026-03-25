import { estimateRepayment, getRemainingTermMonths } from './mortgageMath.js'

const BORROWING_POWER_CONFIG = {
  // Banks assess new debt at a buffered servicing rate, not the headline product rate.
  // We use a fixed conservative assessment rate here to avoid overstating capacity.
  assessmentRatePct: 8.5,
  assessmentTermYears: 30,
  surplusUsePct: 1,
  // This is a simple proxy for tax plus lender income shading.
  // We intentionally avoid using gross income directly in serviceability.
  incomeAdjustmentFactor: 0.7,
  // Rental income is typically shaded by lenders to allow for vacancy and operating friction.
  // We use 75% here as a conservative, explicit proxy rather than counting full gross rent.
  rentalIncomeShadingFactor: 0.75,
  expenseFloorMonthly: {
    base: 2000,
    perBorrower: 800,
    dependant: 500,
  },
  partialConfidenceScore: 58,
  insufficientConfidenceScore: 32,
}

function roundCurrency(value) {
  return Math.round(Number(value || 0))
}

function annualToMonthly(amount) {
  const safeAmount = Number(amount)
  if (!Number.isFinite(safeAmount) || safeAmount < 0) return null
  return safeAmount / 12
}

function resolvePartnerIncomeAnnual(financialProfile) {
  const explicitPartnerIncome = Number(financialProfile?.partner_income_annual)
  if (Number.isFinite(explicitPartnerIncome) && explicitPartnerIncome >= 0) {
    return explicitPartnerIncome
  }

  const annualHouseholdIncome = Number(financialProfile?.household_income_annual)
  const annualEmploymentIncome = Number(financialProfile?.employment_income_annual)
  const annualOtherIncome = Number(financialProfile?.other_income_annual)

  if (!Number.isFinite(annualHouseholdIncome) || annualHouseholdIncome < 0) {
    return null
  }

  return Math.max(
    annualHouseholdIncome -
      Math.max(Number.isFinite(annualEmploymentIncome) ? annualEmploymentIncome : 0, 0) -
      Math.max(Number.isFinite(annualOtherIncome) ? annualOtherIncome : 0, 0),
    0
  )
}

function transactionToMonthly(amount, frequency) {
  const safeAmount = Number(amount || 0)
  const normalizedFrequency = String(frequency || '').trim().toLowerCase()

  if (!Number.isFinite(safeAmount) || safeAmount < 0) return 0

  switch (normalizedFrequency) {
    case 'weekly':
      return (safeAmount * 52) / 12
    case 'fortnightly':
      return (safeAmount * 26) / 12
    case 'monthly':
      return safeAmount
    case 'quarterly':
      return safeAmount / 3
    case 'yearly':
    case 'annual':
      return safeAmount / 12
    default:
      return safeAmount
  }
}

function getProtectedLivingExpenses({
  livingExpensesMonthly,
  dependants = 0,
  borrowerCount = 1,
  config = BORROWING_POWER_CONFIG,
}) {
  const normalizedBorrowerCount = Math.max(0, Number(borrowerCount || 0))
  const normalizedDependants = Math.max(0, Number(dependants || 0))
  const benchmarkExpenses =
    config.expenseFloorMonthly.base +
    normalizedBorrowerCount * config.expenseFloorMonthly.perBorrower +
    normalizedDependants * config.expenseFloorMonthly.dependant

  const reported = Number(livingExpensesMonthly)
  if (!Number.isFinite(reported) || reported < 0) {
    return {
      userLivingExpenses: null,
      benchmarkExpenses,
      assessedLivingExpenses: benchmarkExpenses,
      usedFloor: true,
    }
  }

  return {
    userLivingExpenses: reported,
    benchmarkExpenses,
    assessedLivingExpenses: Math.max(reported, benchmarkExpenses),
    usedFloor: reported < benchmarkExpenses,
  }
}

function estimatePrincipalFromMonthlyRepayment({
  monthlyRepayment,
  annualRatePct,
  termYears,
}) {
  const payment = Number(monthlyRepayment || 0)
  const annualRate = Number(annualRatePct || 0)
  const totalMonths = Math.max(1, Math.round(Number(termYears || 0) * 12))

  if (!Number.isFinite(payment) || payment <= 0) return 0

  const monthlyRate = annualRate / 100 / 12
  if (!Number.isFinite(monthlyRate) || monthlyRate <= 0) {
    return roundCurrency(payment * totalMonths)
  }

  const growthFactor = Math.pow(1 + monthlyRate, totalMonths)
  const principal = payment * ((growthFactor - 1) / (monthlyRate * growthFactor))

  return roundCurrency(Math.max(0, principal))
}

function buildConstraint({ type, title, description, borrowingImpact = 0 }) {
  return {
    type,
    title,
    description,
    borrowingImpact: roundCurrency(Math.max(0, borrowingImpact)),
  }
}

function buildAction({ label, impact, borrowingUplift = 0, type = 'financials' }) {
  return {
    label,
    impact,
    borrowingUplift: roundCurrency(Math.max(0, borrowingUplift)),
    type,
  }
}

function getConfidenceLabel(score) {
  if (score >= 75) return 'High'
  if (score >= 50) return 'Medium'
  return 'Low'
}

function getServiceabilityStatus(netMonthlySurplus) {
  if (netMonthlySurplus <= 0) return 'not_serviceable'
  if (netMonthlySurplus < 1500) return 'tight'
  if (netMonthlySurplus < 3000) return 'moderate'
  return 'strong'
}

function getConstraintSeverity(score) {
  if (!Number.isFinite(score)) return 'medium'
  if (score >= 0.45) return 'high'
  if (score >= 0.25) return 'medium'
  return 'low'
}

function buildTopConstraints({
  adjustedMonthlyIncome,
  userLivingExpenses,
  benchmarkExpenses,
  assessedLivingExpenses,
  totalMonthlyLiabilityRepayments,
  assessedMortgageCommitmentsMonthly,
  borrowerCount,
  dependants,
}) {
  const income = Number(adjustedMonthlyIncome)
  if (!Number.isFinite(income) || income <= 0) return []

  const recordedExpenses = Number(userLivingExpenses)
  const benchmark = Number(benchmarkExpenses)
  const expenseRatio = Number(assessedLivingExpenses || 0) / income
  const liabilityRatio = Number(totalMonthlyLiabilityRepayments || 0) / income
  const mortgageRatio = Number(assessedMortgageCommitmentsMonthly || 0) / income
  const hasRecordedExpenseOverride =
    Number.isFinite(recordedExpenses) &&
    Number.isFinite(benchmark) &&
    recordedExpenses > benchmark
  const benchmarkMessage =
    Number.isFinite(borrowerCount) && Number.isFinite(dependants)
      ? `Lender minimum living-cost assumptions for ${borrowerCount} borrower${borrowerCount === 1 ? '' : 's'} and ${dependants} dependant${dependants === 1 ? '' : 's'} are driving the assessment`
      : 'Lender living-expense benchmark for your household size is reducing your borrowing capacity'

  const constraints = [
    {
      type: hasRecordedExpenseOverride
        ? 'recorded_expense_constraint'
        : 'benchmark_expense_constraint',
      score: expenseRatio,
      message: hasRecordedExpenseOverride
        ? 'Recorded living expenses are reducing your borrowing capacity'
        : benchmarkMessage,
    },
    {
      type: 'liabilities',
      score: liabilityRatio,
      message: 'Existing liabilities are limiting your serviceability',
    },
    {
      type: 'mortgages',
      score: mortgageRatio,
      message: 'Current mortgage commitments are constraining your borrowing',
    },
  ]
    .filter((constraint) => Number.isFinite(constraint.score) && constraint.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((constraint) => ({
      ...constraint,
      severity: getConstraintSeverity(constraint.score),
    }))

  return constraints
}

function getEstimatedLiabilityRepayment(liability) {
  const rawRepayment = liability?.monthly_repayment
  const hasExplicitRepayment =
    rawRepayment !== null && rawRepayment !== undefined && rawRepayment !== ''
  const repayment = hasExplicitRepayment ? Number(rawRepayment) : Number.NaN

  if (
    liability?.type === 'credit_card' &&
    (!hasExplicitRepayment || !Number.isFinite(repayment) || repayment <= 0)
  ) {
    const creditLimit = Number(liability?.credit_limit)
    if (Number.isFinite(creditLimit) && creditLimit > 0) {
      return {
        monthlyRepayment: creditLimit * 0.03,
        usedEstimate: true,
        hasRepaymentData: false,
      }
    }
  }

  if (hasExplicitRepayment && Number.isFinite(repayment) && repayment >= 0) {
    return {
      monthlyRepayment: repayment,
      usedEstimate: false,
      hasRepaymentData: true,
    }
  }

  return {
    monthlyRepayment: 0,
    usedEstimate: false,
    hasRepaymentData: false,
  }
}

function getLoanCommitmentMeta(loan, config = BORROWING_POWER_CONFIG) {
  const currentBalance = Number(loan?.current_balance)
  const originalLoanAmount = Number(loan?.loan_amount)
  const currentRepayment = Number(loan?.monthly_repayment)
  const hasCurrentBalance = Number.isFinite(currentBalance) && currentBalance > 0
  const hasOriginalLoanAmount = Number.isFinite(originalLoanAmount) && originalLoanAmount > 0
  const hasCurrentRepayment = Number.isFinite(currentRepayment) && currentRepayment >= 0
  const repaymentType =
    loan?.repayment_type === 'Interest Only' ? 'Interest Only' : 'Principal & Interest'

  if (!hasCurrentBalance && !hasCurrentRepayment) {
    return {
      monthlyCommitment: 0,
      actualRepayment: 0,
      assessedRepayment: 0,
      basis: 'none',
      hasCommitmentData: false,
      usedFallbackRepayment: false,
      usedAssessedRepayment: false,
      usedAssumedTerm: false,
      outstandingBalance: 0,
      usedOriginalLoanAmount: hasOriginalLoanAmount,
    }
  }

  if (!hasCurrentBalance && hasCurrentRepayment) {
    return {
      monthlyCommitment: currentRepayment,
      actualRepayment: currentRepayment,
      assessedRepayment: 0,
      basis: 'actual_fallback',
      hasCommitmentData: false,
      usedFallbackRepayment: true,
      usedAssessedRepayment: false,
      usedAssumedTerm: false,
      outstandingBalance: 0,
      usedOriginalLoanAmount: hasOriginalLoanAmount,
    }
  }

  const { months, assumed } = getRemainingTermMonths(
    loan,
    config.assessmentTermYears * 12
  )
  const rawAssessedRepayment = estimateRepayment({
    principal: currentBalance,
    annualRate: config.assessmentRatePct,
    repaymentType,
    remainingTermMonths: months,
  })
  const hasValidAssessedRepayment =
    Number.isFinite(rawAssessedRepayment) && rawAssessedRepayment >= 0

  if (!hasValidAssessedRepayment) {
    return {
      monthlyCommitment: hasCurrentRepayment ? currentRepayment : 0,
      actualRepayment: hasCurrentRepayment ? currentRepayment : 0,
      assessedRepayment: 0,
      basis: hasCurrentRepayment ? 'actual_fallback' : 'none',
      hasCommitmentData: false,
      usedFallbackRepayment: hasCurrentRepayment,
      usedAssessedRepayment: false,
      usedAssumedTerm: assumed,
      outstandingBalance: currentBalance,
      usedOriginalLoanAmount: false,
    }
  }

  const assessedRepayment = rawAssessedRepayment

  return {
    monthlyCommitment: assessedRepayment,
    actualRepayment: hasCurrentRepayment ? currentRepayment : 0,
    assessedRepayment,
    basis: 'assessed',
    hasCommitmentData: true,
    usedFallbackRepayment: false,
    usedAssessedRepayment: true,
    usedAssumedTerm: assumed,
    outstandingBalance: currentBalance,
    usedOriginalLoanAmount: false,
  }
}

export function calculateBorrowingPower({
  financialProfile = null,
  liabilities = null,
  loans = null,
  transactions = null,
  propertyId = null,
  config = {},
} = {}) {
  const runtimeConfig = {
    ...BORROWING_POWER_CONFIG,
    ...config,
    expenseFloorMonthly: {
      ...BORROWING_POWER_CONFIG.expenseFloorMonthly,
      ...(config.expenseFloorMonthly || {}),
    },
  }
  const missingInputs = []
  const assumptionNotes = [
    `Assessment rate ${runtimeConfig.assessmentRatePct.toFixed(1)}%`,
    `${runtimeConfig.assessmentTermYears}-year assessment term`,
    `${Math.round(runtimeConfig.surplusUsePct * 100)}% surplus usage buffer`,
  ]

  const dependants = Number(financialProfile?.dependants)
  const borrowerCount = Number(financialProfile?.borrower_count)
  const annualEmploymentIncome = Number(financialProfile?.employment_income_annual)
  const annualPartnerIncome = resolvePartnerIncomeAnnual(financialProfile)
  const annualOtherIncome = Number(financialProfile?.other_income_annual)
  const annualHouseholdIncome =
    Math.max(Number.isFinite(annualEmploymentIncome) ? annualEmploymentIncome : 0, 0) +
    Math.max(Number.isFinite(annualPartnerIncome) ? annualPartnerIncome : 0, 0) +
    Math.max(Number.isFinite(annualOtherIncome) ? annualOtherIncome : 0, 0)
  const monthlyOtherIncome = annualToMonthly(financialProfile?.other_income_annual)
  const monthlyEmploymentIncome = annualToMonthly(financialProfile?.employment_income_annual)
  const monthlyPartnerIncome = annualToMonthly(annualPartnerIncome)

  let monthlyHouseholdIncome = null
  if (monthlyEmploymentIncome != null || monthlyPartnerIncome != null) {
    monthlyHouseholdIncome =
      Math.max(Number(monthlyEmploymentIncome || 0), 0) +
      Math.max(Number(monthlyPartnerIncome || 0), 0)
  }

  if (monthlyHouseholdIncome == null) {
    missingInputs.push('household income')
  }

  if (!Number.isFinite(Number(financialProfile?.living_expenses_monthly))) {
    missingInputs.push('living expenses')
  }

  if (!Number.isFinite(borrowerCount) || borrowerCount < 1) {
    missingInputs.push('borrower count')
  }

  const liabilitiesProvided = Array.isArray(liabilities)
  if (!liabilitiesProvided) {
    missingInputs.push('liabilities')
  }

  const normalizedLiabilities = liabilitiesProvided ? liabilities : []
  const hasLiabilities = normalizedLiabilities.length > 0
  const liabilityRepaymentMeta = normalizedLiabilities.map(getEstimatedLiabilityRepayment)
  const hasRepaymentData =
    hasLiabilities &&
    normalizedLiabilities.every((liability, index) => {
      if (liability?.type === 'credit_card') return true
      return liabilityRepaymentMeta[index].hasRepaymentData
    })
  const usedEstimatedRepayments = liabilityRepaymentMeta.some((item) => item.usedEstimate)
  const hasIncompleteLiabilityDetails =
    hasLiabilities &&
    normalizedLiabilities.some((liability, index) => {
      if (liability?.type === 'credit_card') {
        const creditLimit = Number(liability?.credit_limit)
        return !Number.isFinite(creditLimit) || creditLimit < 0
      }

      return !liabilityRepaymentMeta[index].hasRepaymentData
    })

  if (liabilitiesProvided && !hasLiabilities) {
    missingInputs.push('liabilities')
  }

  if (hasIncompleteLiabilityDetails) {
    missingInputs.push('liability details')
  }

  const loansProvided = Array.isArray(loans)
  if (!loansProvided) {
    missingInputs.push('loan commitments')
  }

  const normalizedLoans = loansProvided ? loans : []
  const loanCommitmentMeta = normalizedLoans.map((loan) =>
    getLoanCommitmentMeta(loan, runtimeConfig)
  )
  const hasLoans = normalizedLoans.length > 0
  const hasLoanCommitmentData =
    hasLoans && loanCommitmentMeta.every((loanMeta) => loanMeta.hasCommitmentData)
  const hasIncompleteLoanDetails =
    hasLoans &&
    loanCommitmentMeta.some(
      (loanMeta) => !loanMeta.hasCommitmentData || loanMeta.usedFallbackRepayment
    )

  if (loansProvided && hasLoans && hasIncompleteLoanDetails) {
    missingInputs.push('loan details')
  }

  const normalizedTransactions = Array.isArray(transactions) ? transactions : []
  const grossMonthlyRentalIncome = roundCurrency(
    normalizedTransactions
      .filter((transaction) => transaction?.type === 'income')
      .reduce(
        (sum, transaction) => sum + transactionToMonthly(transaction?.amount, transaction?.frequency),
        0
      )
  )
  const usableMonthlyRentalIncome = roundCurrency(
    grossMonthlyRentalIncome * BORROWING_POWER_CONFIG.rentalIncomeShadingFactor
  )
  const actualMonthlyPropertyExpenses = roundCurrency(
    normalizedTransactions
      .filter((transaction) => transaction?.type === 'expense')
      .reduce(
        (sum, transaction) => sum + transactionToMonthly(transaction?.amount, transaction?.frequency),
        0
      )
  )

  const requiredInputsMissing =
    missingInputs.includes('household income') ||
    missingInputs.includes('living expenses') ||
    missingInputs.includes('borrower count')

  const {
    userLivingExpenses,
    benchmarkExpenses,
    assessedLivingExpenses,
    usedFloor,
  } = getProtectedLivingExpenses({
    livingExpensesMonthly: financialProfile?.living_expenses_monthly,
    dependants: Number.isFinite(dependants) ? dependants : 0,
    borrowerCount: Number.isFinite(borrowerCount) ? borrowerCount : 1,
    config: runtimeConfig,
  })

  if (usedFloor) {
    assumptionNotes.push(
      `Living expenses assessed at benchmark floor ${roundCurrency(benchmarkExpenses)}/month`
    )
  }

  if (usedEstimatedRepayments) {
    assumptionNotes.push('Estimated 3% monthly repayment used for credit card limits with no recorded repayment')
  }

  if (loanCommitmentMeta.some((loanMeta) => loanMeta.usedAssessedRepayment)) {
    assumptionNotes.push(
      `Existing loan commitments assessed at ${runtimeConfig.assessmentRatePct.toFixed(1)}% to reflect conservative lender servicing`
    )
  }

  if (loanCommitmentMeta.some((loanMeta) => loanMeta.usedAssumedTerm)) {
    assumptionNotes.push(
      `Default ${runtimeConfig.assessmentTermYears}-year term used where remaining loan term was missing`
    )
  }

  if (loanCommitmentMeta.some((loanMeta) => loanMeta.usedFallbackRepayment)) {
    assumptionNotes.push('Current repayment used where loan balance details were incomplete')
  }
  if (loanCommitmentMeta.some((loanMeta) => loanMeta.usedOriginalLoanAmount)) {
    assumptionNotes.push('Original loan amount was ignored for serviceability where current balance was missing')
  }

  const totalMonthlyLiabilityRepayments = roundCurrency(
    liabilityRepaymentMeta.reduce((sum, item) => sum + Number(item.monthlyRepayment || 0), 0)
  )
  const actualTotalLiabilityRepaymentsMonthly = roundCurrency(
    normalizedLiabilities.reduce((sum, liability) => {
      const repayment = Number(liability?.monthly_repayment)
      return Number.isFinite(repayment) && repayment >= 0 ? sum + repayment : sum
    }, 0)
  )
  const actualPersonalLiabilityRepaymentsMonthly = roundCurrency(
    normalizedLiabilities.reduce((sum, liability, index) => {
      if (liability?.type === 'credit_card') return sum
      return sum + Number(liabilityRepaymentMeta[index].monthlyRepayment || 0)
    }, 0)
  )
  const estimatedCreditCardCommitmentsMonthly = roundCurrency(
    normalizedLiabilities.reduce((sum, liability, index) => {
      if (liability?.type !== 'credit_card') return sum
      return sum + Number(liabilityRepaymentMeta[index].monthlyRepayment || 0)
    }, 0)
  )
  const actualMortgageRepaymentsMonthly = roundCurrency(
    loanCommitmentMeta.reduce((sum, item) => sum + Number(item.actualRepayment || 0), 0)
  )
  const totalMonthlyLoanCommitments = roundCurrency(
    loanCommitmentMeta.reduce((sum, item) => sum + Number(item.monthlyCommitment || 0), 0)
  )
  const assessedMortgageCommitmentsMonthly = roundCurrency(
    loanCommitmentMeta.reduce((sum, item) => sum + Number(item.assessedRepayment || 0), 0)
  )

  const totalOutstandingLiabilityBalance = roundCurrency(
    normalizedLiabilities.reduce((sum, liability) => sum + Number(liability?.balance || 0), 0)
  )
  const totalOutstandingLoanBalance = roundCurrency(
    loanCommitmentMeta.reduce((sum, item) => sum + Number(item.outstandingBalance || 0), 0)
  )

  const totalRevolvingCreditLimits = roundCurrency(
    normalizedLiabilities.reduce((sum, liability) => {
      if (liability?.type !== 'credit_card') return sum
      return sum + Number(liability?.credit_limit || 0)
    }, 0)
  )
  const totalLiabilityCount = normalizedLiabilities.length
  const totalLoanCount = normalizedLoans.length

  const grossMonthlyHouseholdIncome = roundCurrency(monthlyHouseholdIncome)
  const grossMonthlyOtherIncome = roundCurrency(monthlyOtherIncome)
  const grossTotalMonthlyIncome = roundCurrency(
    Math.max(0, Number(monthlyHouseholdIncome || 0) + Number(monthlyOtherIncome || 0))
  )
  const actualAfterTaxIncomeMonthly = roundCurrency(
    grossTotalMonthlyIncome * runtimeConfig.incomeAdjustmentFactor
  )
  const adjustedIncomeAnnual = roundCurrency(
    grossTotalMonthlyIncome * 12 * runtimeConfig.incomeAdjustmentFactor
  )
  const adjustedMonthlyIncome = roundCurrency(adjustedIncomeAnnual / 12)
  const totalUsableMonthlyIncome = roundCurrency(
    adjustedMonthlyIncome + usableMonthlyRentalIncome
  )

  assumptionNotes.push(
    `Income adjusted to ${Math.round(
      runtimeConfig.incomeAdjustmentFactor * 100
    )}% of gross for tax and lender shading`
  )
  if (grossMonthlyRentalIncome > 0) {
    assumptionNotes.push(
      `Rental income shaded to ${Math.round(
        runtimeConfig.rentalIncomeShadingFactor * 100
      )}% of gross rent`
    )
  }

  const totalMonthlyExpenses = roundCurrency(
    Math.max(
      0,
      assessedLivingExpenses +
        totalMonthlyLiabilityRepayments +
        totalMonthlyLoanCommitments
    )
  )
  const netMonthlySurplus = roundCurrency(totalUsableMonthlyIncome - totalMonthlyExpenses)
  const actualTotalMonthlyIncome = roundCurrency(
    actualAfterTaxIncomeMonthly + grossMonthlyRentalIncome
  )
  const actualLivingExpensesMonthly =
    userLivingExpenses == null ? null : roundCurrency(userLivingExpenses)
  const hasActualIncomeData = grossTotalMonthlyIncome > 0
  const hasActualLivingExpensesData = actualLivingExpensesMonthly != null
  const hasActualLiabilityData = liabilitiesProvided && hasLiabilities
  const hasActualMortgageRepaymentData =
    hasLoans &&
    normalizedLoans.every((loan) => {
      const repayment = Number(loan?.monthly_repayment)
      return Number.isFinite(repayment) && repayment >= 0
    })
  const hasPropertyRentData = normalizedTransactions.some(
    (transaction) => transaction?.type === 'income'
  )
  const hasPropertyExpenseData = normalizedTransactions.some(
    (transaction) => transaction?.type === 'expense'
  )
  const actualTotalMonthlyOutgoings =
    actualLivingExpensesMonthly == null
      ? null
      : roundCurrency(
          Math.max(
            0,
            actualLivingExpensesMonthly +
              actualMonthlyPropertyExpenses +
              actualTotalLiabilityRepaymentsMonthly +
              actualMortgageRepaymentsMonthly
          )
        )
  const actualMonthlySurplusReady =
    hasActualIncomeData &&
    hasActualLivingExpensesData &&
    hasActualLiabilityData &&
    hasActualMortgageRepaymentData &&
    hasPropertyRentData &&
    hasPropertyExpenseData
  const actualMonthlySurplus =
    !actualMonthlySurplusReady || actualLivingExpensesMonthly == null
      ? null
      : roundCurrency(actualTotalMonthlyIncome - actualTotalMonthlyOutgoings)

  const annualGrossIncome = roundCurrency(grossTotalMonthlyIncome * 12)
  const debtToIncomeRatio =
    annualGrossIncome > 0
      ? Number(
          (
            (totalOutstandingLiabilityBalance + totalOutstandingLoanBalance) /
            annualGrossIncome
          ).toFixed(2)
        )
      : null

  const serviceableRepaymentCapacity = roundCurrency(
    Math.max(0, netMonthlySurplus) * runtimeConfig.surplusUsePct
  )
  const borrowingPowerEstimate = estimatePrincipalFromMonthlyRepayment({
    monthlyRepayment: serviceableRepaymentCapacity,
    annualRatePct: runtimeConfig.assessmentRatePct,
    termYears: runtimeConfig.assessmentTermYears,
  })

  let status = 'ready'
  if (requiredInputsMissing) {
    status = 'insufficient_data'
  } else if (
    missingInputs.includes('liabilities') ||
    missingInputs.includes('liability details') ||
    missingInputs.includes('loan commitments') ||
    missingInputs.includes('loan details')
  ) {
    status = 'partial'
  }

  const constraints = []
  const actions = []

  if (netMonthlySurplus <= 0) {
    constraints.push(
      buildConstraint({
        type: 'surplus',
        title: 'Monthly surplus is constrained',
        description:
          'Living costs and recorded liability repayments currently leave no surplus available for new debt servicing.',
        borrowingImpact: Math.abs(netMonthlySurplus) * 12 * 4,
      })
    )
  }

  if (usedFloor) {
    constraints.push(
      buildConstraint({
        type: 'expense_floor',
        title: 'Expense floor is protecting serviceability',
        description:
          'Reported living expenses are below the conservative assessment floor used in this estimate.',
        borrowingImpact: 0,
      })
    )
  }

  if (debtToIncomeRatio != null && debtToIncomeRatio >= 0.5) {
    constraints.push(
      buildConstraint({
        type: 'dti',
        title: 'Consumer debt is elevated relative to income',
        description:
          'Outstanding liabilities are high relative to recorded annual income, which can limit additional borrowing.',
        borrowingImpact: totalOutstandingLiabilityBalance * 0.25,
      })
    )
  }

  if (missingInputs.includes('liabilities')) {
    actions.push(
      buildAction({
        label: 'Add liabilities',
        impact: 'Complete liabilities data to improve serviceability accuracy',
        borrowingUplift: 0,
        type: 'data',
      })
    )
  }

  if (missingInputs.includes('liability details')) {
    actions.push(
      buildAction({
        label: 'Complete liability details',
        impact: 'Repayment or credit limit data is required for a stronger borrowing estimate',
        borrowingUplift: 0,
        type: 'data',
      })
    )
  }

  if (missingInputs.includes('loan commitments') || missingInputs.includes('loan details')) {
    actions.push(
      buildAction({
        label: 'Complete mortgage commitments',
        impact: 'Loan balances, terms, and repayments are needed for a stronger borrowing estimate',
        borrowingUplift: 0,
        type: 'data',
      })
    )
  }

  if (netMonthlySurplus <= 0) {
    actions.push(
      buildAction({
        label: 'Increase monthly surplus',
        impact: 'Reducing living costs or debt repayments improves serviceability capacity',
        borrowingUplift: Math.abs(netMonthlySurplus) * 12 * 4,
        type: 'surplus',
      })
    )
  }

  const confidenceScore =
    status === 'insufficient_data'
      ? runtimeConfig.insufficientConfidenceScore
      : status === 'partial'
        ? Math.max(
          46,
          runtimeConfig.partialConfidenceScore -
              (missingInputs.includes('loan commitments') ? 8 : 0) -
              (missingInputs.includes('loan details') ? 6 : 0)
          )
        : Math.max(72, usedFloor ? 76 : 82)

  const confidenceLabel = getConfidenceLabel(confidenceScore)
  const serviceabilityStatus = getServiceabilityStatus(netMonthlySurplus)
  const topConstraints = buildTopConstraints({
    adjustedMonthlyIncome,
    userLivingExpenses,
    benchmarkExpenses,
    assessedLivingExpenses,
    totalMonthlyLiabilityRepayments,
    assessedMortgageCommitmentsMonthly,
    borrowerCount,
    dependants,
  })
  const topConstraint = constraints[0] || null
  const loanDiagnostics = loanCommitmentMeta.map((loanMeta, index) => ({
    loanIndex: index,
    basis: loanMeta.basis,
    actualRepayment: roundCurrency(loanMeta.actualRepayment),
    assessedRepayment: roundCurrency(loanMeta.assessedRepayment),
    monthlyCommitment: roundCurrency(loanMeta.monthlyCommitment),
    outstandingBalance: roundCurrency(loanMeta.outstandingBalance),
    usedFallbackRepayment: loanMeta.usedFallbackRepayment,
    usedAssumedTerm: loanMeta.usedAssumedTerm,
    hasCommitmentData: loanMeta.hasCommitmentData,
    usedOriginalLoanAmount: loanMeta.usedOriginalLoanAmount,
  }))
  const inputs = {
    salary_annual:
      Number.isFinite(annualEmploymentIncome) && annualEmploymentIncome >= 0
        ? roundCurrency(annualEmploymentIncome)
        : null,
    partner_income_annual:
      Number.isFinite(annualPartnerIncome) ? roundCurrency(annualPartnerIncome) : null,
    other_income_annual:
      Number.isFinite(annualOtherIncome) && annualOtherIncome >= 0
        ? roundCurrency(annualOtherIncome)
        : null,
    household_income_annual:
      Number.isFinite(annualHouseholdIncome) && annualHouseholdIncome >= 0
        ? roundCurrency(annualHouseholdIncome)
        : null,
    borrower_count: Number.isFinite(borrowerCount) ? borrowerCount : null,
    dependants: Number.isFinite(dependants) ? dependants : null,
    user_living_expenses_monthly:
      userLivingExpenses == null ? null : roundCurrency(userLivingExpenses),
    personal_liability_repayments_monthly: actualPersonalLiabilityRepaymentsMonthly,
    credit_card_limits_total: totalRevolvingCreditLimits,
    liability_count: totalLiabilityCount,
    rental_income_from_tracked_properties_monthly: grossMonthlyRentalIncome,
    actual_mortgage_repayments_from_tracked_loans_monthly: actualMortgageRepaymentsMonthly,
    loan_count: totalLoanCount,
  }
  const assumptionsDetail = {
    income_shading_factor: runtimeConfig.incomeAdjustmentFactor,
    rental_shading_factor: runtimeConfig.rentalIncomeShadingFactor,
    credit_card_commitment_rate: 0.03,
    assessment_rate_pct: runtimeConfig.assessmentRatePct,
    assessment_term_years: runtimeConfig.assessmentTermYears,
    surplus_use_factor: runtimeConfig.surplusUsePct,
    benchmark_expense_rule: {
      base: runtimeConfig.expenseFloorMonthly.base,
      per_borrower: runtimeConfig.expenseFloorMonthly.perBorrower,
      per_dependant: runtimeConfig.expenseFloorMonthly.dependant,
      applied: usedFloor,
    },
    mortgage_commitment_basis_used: loanCommitmentMeta.some(
      (item) => item.basis === 'actual_fallback'
    )
      ? 'mixed'
      : 'assessed',
    notes: assumptionNotes,
  }
  const derived = {
    actual_income_monthly: actualTotalMonthlyIncome,
    actual_after_tax_income_monthly: actualAfterTaxIncomeMonthly,
    actual_property_expenses_monthly: actualMonthlyPropertyExpenses,
    adjusted_income_monthly: adjustedMonthlyIncome,
    usable_rental_income_monthly: usableMonthlyRentalIncome,
    actual_liability_repayments_monthly: actualTotalLiabilityRepaymentsMonthly,
    actual_living_expenses_monthly: actualLivingExpensesMonthly,
    actual_total_monthly_outgoings: actualTotalMonthlyOutgoings,
    actual_monthly_surplus: actualMonthlySurplus,
    estimated_card_commitment_monthly: estimatedCreditCardCommitmentsMonthly,
    actual_mortgage_repayments_monthly: actualMortgageRepaymentsMonthly,
    assessed_mortgage_commitments_monthly: assessedMortgageCommitmentsMonthly,
    mortgage_commitments_used_monthly: totalMonthlyLoanCommitments,
    total_usable_income_monthly: totalUsableMonthlyIncome,
    total_monthly_outgoings: totalMonthlyExpenses,
    net_monthly_surplus: netMonthlySurplus,
    borrowing_power_estimate: roundCurrency(borrowingPowerEstimate),
    total_debt_for_dti: totalOutstandingLiabilityBalance + totalOutstandingLoanBalance,
    gross_annual_income: annualGrossIncome,
    dti_ratio: debtToIncomeRatio,
  }

  const result = {
    status,
    scope: propertyId ? 'property' : 'portfolio',
    gross_monthly_household_income: grossMonthlyHouseholdIncome,
    gross_monthly_other_income: grossMonthlyOtherIncome,
    gross_total_monthly_income: grossTotalMonthlyIncome,
    actual_total_monthly_income: actualTotalMonthlyIncome,
    actual_after_tax_income_monthly: actualAfterTaxIncomeMonthly,
    adjusted_income_annual: adjustedIncomeAnnual,
    adjusted_monthly_income: adjustedMonthlyIncome,
    gross_monthly_rental_income: grossMonthlyRentalIncome,
    usable_monthly_rental_income: usableMonthlyRentalIncome,
    monthly_household_income: roundCurrency(
      grossMonthlyHouseholdIncome * runtimeConfig.incomeAdjustmentFactor
    ),
    monthly_other_income: roundCurrency(
      grossMonthlyOtherIncome * runtimeConfig.incomeAdjustmentFactor
    ),
    total_monthly_income: totalUsableMonthlyIncome,
    user_living_expenses:
      userLivingExpenses == null ? null : roundCurrency(userLivingExpenses),
    benchmark_expenses: roundCurrency(benchmarkExpenses),
    assessed_living_expenses: roundCurrency(assessedLivingExpenses),
    total_monthly_living_expenses: roundCurrency(assessedLivingExpenses),
    personal_liability_repayments_monthly: actualPersonalLiabilityRepaymentsMonthly,
    actual_total_liability_repayments_monthly: actualTotalLiabilityRepaymentsMonthly,
    estimated_credit_card_commitments_monthly: estimatedCreditCardCommitmentsMonthly,
    total_monthly_liability_repayments: totalMonthlyLiabilityRepayments,
    actual_mortgage_repayments_monthly: actualMortgageRepaymentsMonthly,
    actual_property_expenses_monthly: actualMonthlyPropertyExpenses,
    assessed_mortgage_commitments_monthly: assessedMortgageCommitmentsMonthly,
    mortgage_commitments_monthly: totalMonthlyLoanCommitments,
    total_monthly_loan_commitments: totalMonthlyLoanCommitments,
    total_monthly_outgoings: totalMonthlyExpenses,
    total_monthly_expenses: totalMonthlyExpenses,
    net_monthly_surplus: netMonthlySurplus,
    actual_monthly_surplus: actualMonthlySurplus,
    total_debt_for_dti: totalOutstandingLiabilityBalance + totalOutstandingLoanBalance,
    dti_ratio: debtToIncomeRatio,
    debt_to_income_ratio: debtToIncomeRatio,
    borrowing_power_estimate: roundCurrency(borrowingPowerEstimate),
    serviceability_status: serviceabilityStatus,
    assumptions: assumptionsDetail,
    inputs,
    assumptions_detail: assumptionsDetail,
    derived,
    debug: {
      loan_count: totalLoanCount,
      loan_diagnostics: loanDiagnostics,
      total_mortgage_commitments_monthly: totalMonthlyLoanCommitments,
      borrowing_status: status,
      serviceability_breakdown: {
        gross_annual_income: annualGrossIncome,
        actual_monthly_income: actualTotalMonthlyIncome,
        actual_after_tax_income_monthly: actualAfterTaxIncomeMonthly,
        actual_living_expenses_monthly: actualLivingExpensesMonthly,
        actual_property_expenses_monthly: actualMonthlyPropertyExpenses,
        actual_liabilities_monthly: actualTotalLiabilityRepaymentsMonthly,
        adjusted_monthly_income: adjustedMonthlyIncome,
        living_expenses_monthly: roundCurrency(assessedLivingExpenses),
        liabilities_monthly: totalMonthlyLiabilityRepayments,
        actual_mortgage_repayments_monthly: actualMortgageRepaymentsMonthly,
        assessed_mortgage_repayments_monthly: assessedMortgageCommitmentsMonthly,
        rental_income_included_monthly: usableMonthlyRentalIncome,
        actual_total_monthly_outgoings: actualTotalMonthlyOutgoings,
        actual_monthly_surplus: actualMonthlySurplus,
        actual_monthly_surplus_ready: actualMonthlySurplusReady,
        total_monthly_outgoings: totalMonthlyExpenses,
        net_monthly_surplus: netMonthlySurplus,
        resulting_borrowing_capacity: roundCurrency(borrowingPowerEstimate),
      },
    },
    flags: {
      usedExpenseFloor: usedFloor,
      liabilitiesIncluded: liabilitiesProvided && hasLiabilities,
      loansIncluded: loansProvided && hasLoans,
      revolvingCreditLimitsIncluded: totalRevolvingCreditLimits > 0,
      has_liabilities: hasLiabilities,
      has_repayment_data: hasRepaymentData,
      used_estimated_repayments: usedEstimatedRepayments,
      has_loan_commitments: hasLoans,
      has_loan_commitment_data: hasLoanCommitmentData,
      actual_monthly_surplus_ready: actualMonthlySurplusReady,
      has_actual_income_data: hasActualIncomeData,
      has_actual_living_expenses_data: hasActualLivingExpensesData,
      has_actual_liability_data: hasActualLiabilityData,
      has_actual_mortgage_repayments_data: hasActualMortgageRepaymentData,
      has_property_rent_data: hasPropertyRentData,
      has_property_expense_data: hasPropertyExpenseData,
      mortgage_commitments_basis: loanCommitmentMeta.some(
        (item) => item.basis === 'actual_fallback'
      )
        ? 'mixed'
        : 'assessed',
    },
    missing_inputs: missingInputs,

    // Backward-compatible keys for existing consumers.
    currentBorrowingPower: roundCurrency(borrowingPowerEstimate),
    potentialBorrowingPower: roundCurrency(borrowingPowerEstimate),
    unlockAmount: 0,
    netDisposableIncome: netMonthlySurplus,
    monthlyIncome: totalUsableMonthlyIncome,
    monthlyExpenses: totalMonthlyExpenses,
    stressedRepayments: totalMonthlyLiabilityRepayments + totalMonthlyLoanCommitments,
    estimatedLivingExpenses: roundCurrency(assessedLivingExpenses),
    constraints,
    topConstraint,
    actions: actions.slice(0, 3),
    topConstraints,
    confidenceScore,
    confidenceLabel,
    missingInputs,
    isBlocked: status === 'insufficient_data',
    blockedReason:
      status === 'insufficient_data'
        ? 'Financial profile is incomplete'
        : null,
    blockedActionLabel:
      status === 'insufficient_data' ? 'Complete Financials' : null,
    totalOutstandingLiabilityBalance,
    totalOutstandingLoanBalance,
    totalRevolvingCreditLimits,
  }

  return result
}

export const buildBorrowingPowerAnalysis = calculateBorrowingPower

export default calculateBorrowingPower
