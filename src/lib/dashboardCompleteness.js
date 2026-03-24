function hasNonNullNumber(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
}

function getFinancialProfileStatus(financialProfile) {
  const hasFinancialProfile = Boolean(financialProfile)
  const hasIncomeData =
    hasNonNullNumber(financialProfile?.employment_income_annual) ||
    hasNonNullNumber(financialProfile?.partner_income_annual) ||
    hasNonNullNumber(financialProfile?.household_income_annual) ||
    hasNonNullNumber(financialProfile?.other_income_annual)
  const hasLivingExpenses = hasNonNullNumber(financialProfile?.living_expenses_monthly)
  const hasBorrowerCount = Number(financialProfile?.borrower_count) >= 1
  const hasDependants = Number(financialProfile?.dependants) >= 0
  const isComplete =
    hasFinancialProfile &&
    hasIncomeData &&
    hasLivingExpenses &&
    hasBorrowerCount &&
    hasDependants

  return {
    hasFinancialProfile,
    financialProfileComplete: isComplete,
    missingCoreFields: [
      !hasIncomeData ? 'income' : null,
      !hasLivingExpenses ? 'living expenses' : null,
      !hasBorrowerCount ? 'borrower count' : null,
      !hasDependants ? 'dependants' : null,
    ].filter(Boolean),
  }
}

function getLiabilitiesStatus(liabilities) {
  if (!Array.isArray(liabilities)) {
    return {
      hasLiabilitiesData: false,
      liabilitiesStatus: 'missing',
      liabilitiesMessage: 'Liabilities data has not been loaded yet.',
    }
  }

  if (liabilities.length > 0) {
    return {
      hasLiabilitiesData: true,
      liabilitiesStatus: 'present',
      liabilitiesMessage: `${liabilities.length} liabilit${liabilities.length === 1 ? 'y' : 'ies'} recorded.`,
    }
  }

  return {
    hasLiabilitiesData: false,
    liabilitiesStatus: 'unknown_empty',
    liabilitiesMessage:
      'No liabilities are recorded. The current data model cannot confirm whether this means zero liabilities or an incomplete section.',
  }
}

function getLoanDataStatus(loans) {
  if (!Array.isArray(loans) || loans.length === 0) {
    return {
      hasLoans: false,
      loanDataComplete: false,
      incompleteLoanCount: 0,
      missingLoanFields: [],
    }
  }

  const missingFieldSet = new Set()
  let incompleteLoanCount = 0

  loans.forEach((loan) => {
    const missingFields = []

    if (!hasNonNullNumber(loan?.current_balance) && !hasNonNullNumber(loan?.loan_amount)) {
      missingFields.push('balance')
    }
    if (!hasNonNullNumber(loan?.interest_rate)) {
      missingFields.push('interest rate')
    }
    if (!hasNonNullNumber(loan?.monthly_repayment)) {
      missingFields.push('monthly repayment')
    }
    if (!hasNonNullNumber(loan?.remaining_term_months)) {
      missingFields.push('remaining term')
    }
    if (!loan?.repayment_type) {
      missingFields.push('repayment type')
    }

    if (missingFields.length > 0) {
      incompleteLoanCount += 1
      missingFields.forEach((field) => missingFieldSet.add(field))
    }
  })

  return {
    hasLoans: true,
    loanDataComplete: incompleteLoanCount === 0,
    incompleteLoanCount,
    missingLoanFields: [...missingFieldSet],
  }
}

export function buildDashboardCompleteness({
  properties = [],
  loans = [],
  financialProfile = null,
  liabilities = null,
} = {}) {
  const hasProperties = Array.isArray(properties) && properties.length > 0
  const hasLoans = Array.isArray(loans) && loans.length > 0
  const profileStatus = getFinancialProfileStatus(financialProfile)
  const liabilityStatus = getLiabilitiesStatus(liabilities)
  const loanStatus = getLoanDataStatus(loans)

  const refinanceReady = hasProperties && hasLoans
  const borrowingReady =
    hasProperties &&
    hasLoans &&
    profileStatus.financialProfileComplete &&
    liabilityStatus.hasLiabilitiesData

  let completenessLevel = 'low'
  if (borrowingReady) {
    completenessLevel = 'high'
  } else if (hasProperties && hasLoans && profileStatus.hasFinancialProfile) {
    completenessLevel = 'medium'
  }

  return {
    hasProperties,
    hasLoans,
    hasFinancialProfile: profileStatus.hasFinancialProfile,
    financialProfileComplete: profileStatus.financialProfileComplete,
    loanDataComplete: loanStatus.loanDataComplete,
    incompleteLoanCount: loanStatus.incompleteLoanCount,
    missingLoanFields: loanStatus.missingLoanFields,
    hasLiabilitiesData: liabilityStatus.hasLiabilitiesData,
    liabilitiesStatus: liabilityStatus.liabilitiesStatus,
    borrowingReady,
    refinanceReady,
    completenessLevel,
    confidenceLevel: completenessLevel,
    messages: {
      properties: hasProperties ? 'Properties connected.' : 'Add a property to unlock portfolio workflows.',
      loans: hasLoans ? 'Loans connected.' : 'Add a loan to unlock refinance and leverage workflows.',
      refinance:
        loanStatus.loanDataComplete
          ? 'Loan data is complete enough for refinance insights.'
          : loanStatus.hasLoans
            ? `Mortgage and refinance insights are using partial loan data. Missing: ${loanStatus.missingLoanFields.join(', ')}.`
            : 'Add a loan to unlock refinance and leverage workflows.',
      financialProfile: profileStatus.financialProfileComplete
        ? 'Financial profile complete.'
        : profileStatus.hasFinancialProfile
          ? `Complete financial profile fields: ${profileStatus.missingCoreFields.join(', ')}.`
          : 'Add a financial profile to unlock borrowing analysis.',
      liabilities: liabilityStatus.liabilitiesMessage,
    },
    missingFinancialProfileFields: profileStatus.missingCoreFields,
    limitation:
      liabilityStatus.liabilitiesStatus === 'unknown_empty'
        ? 'Current schema cannot distinguish zero liabilities from liabilities section not yet completed.'
        : null,
  }
}

export default buildDashboardCompleteness
