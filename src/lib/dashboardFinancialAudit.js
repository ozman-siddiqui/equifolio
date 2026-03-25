function roundCurrency(value) {
  return Math.round(Number(value || 0))
}

function toMonthly(amount, frequency) {
  const safeAmount = Number(amount || 0)
  const normalizedFrequency = String(frequency || '').trim().toLowerCase()

  if (!Number.isFinite(safeAmount)) return 0

  switch (normalizedFrequency) {
    case 'weekly':
      return (safeAmount * 52) / 12
    case 'fortnightly':
      return (safeAmount * 26) / 12
    case 'monthly':
      return safeAmount
    case 'quarterly':
      return safeAmount / 3
    case 'annual':
    case 'yearly':
      return safeAmount / 12
    default:
      return safeAmount
  }
}

function formatMetricValue(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && !Number.isFinite(value)) return null
  return value
}

function valuesReconcile(rawResult, displayedResult) {
  const left = formatMetricValue(rawResult)
  const right = formatMetricValue(displayedResult)

  if (left === null && right === null) return true
  if (typeof left === 'number' && typeof right === 'number') {
    return Math.round(left) === Math.round(right)
  }

  return left === right
}

function buildPropertyInputs(properties, transactions) {
  return properties.map((property) => {
    const propertyTransactions = transactions.filter(
      (transaction) => String(transaction?.property_id) === String(property?.id)
    )
    const monthlyIncomeTransactions = roundCurrency(
      propertyTransactions
        .filter((transaction) => transaction?.type === 'income')
        .reduce((sum, transaction) => sum + toMonthly(transaction?.amount, transaction?.frequency), 0)
    )
    const monthlyExpenseTransactions = roundCurrency(
      propertyTransactions
        .filter((transaction) => transaction?.type === 'expense')
        .reduce((sum, transaction) => sum + toMonthly(transaction?.amount, transaction?.frequency), 0)
    )

    return {
      property_id: property?.id,
      current_value: property?.current_value ?? null,
      current_rent_amount: property?.current_rent_amount ?? null,
      current_rent_frequency: property?.current_rent_frequency ?? null,
      ownership_type: property?.property_use ?? null,
      expense_fields: {
        council_rates_monthly: property?.council_rates_monthly ?? null,
        strata_monthly: property?.strata_monthly ?? null,
        insurance_monthly: property?.insurance_monthly ?? null,
        property_management_monthly: property?.property_management_monthly ?? null,
        maintenance_monthly: property?.maintenance_monthly ?? null,
      },
      transaction_summary: {
        monthly_income_transactions: monthlyIncomeTransactions,
        monthly_expense_transactions: monthlyExpenseTransactions,
        net_property_cash_flow_from_transactions: roundCurrency(
          monthlyIncomeTransactions - monthlyExpenseTransactions
        ),
      },
    }
  })
}

function buildLoanInputs(loans, borrowingAnalysis) {
  const diagnostics = Array.isArray(borrowingAnalysis?.debug?.loan_diagnostics)
    ? borrowingAnalysis.debug.loan_diagnostics
    : []

  return loans.map((loan, index) => ({
    property_id: loan?.property_id ?? null,
    loan_id: loan?.id ?? null,
    outstanding_balance: loan?.current_balance ?? null,
    original_loan_amount: loan?.loan_amount ?? null,
    interest_rate: loan?.interest_rate ?? null,
    repayment_amount: loan?.monthly_repayment ?? null,
    repayment_type: loan?.repayment_type ?? null,
    remaining_term_months: loan?.remaining_term_months ?? null,
    remaining_term_years_display: loan?.remaining_term_months
      ? Number(loan.remaining_term_months) / 12
      : null,
    offset_balance: loan?.offset_balance ?? null,
    assessed_repayment_inputs: diagnostics[index] || null,
  }))
}

function buildFinancialInputs(financialProfile) {
  return {
    salary: financialProfile?.employment_income_annual ?? null,
    partner_income: financialProfile?.partner_income_annual ?? null,
    other_income: financialProfile?.other_income_annual ?? null,
    borrower_count: financialProfile?.borrower_count ?? null,
    dependants: financialProfile?.dependants ?? null,
    living_expense_categories: {
      groceries_household_monthly: financialProfile?.groceries_household_monthly ?? null,
      utilities_phone_internet_monthly:
        financialProfile?.utilities_phone_internet_monthly ?? null,
      transport_monthly: financialProfile?.transport_monthly ?? null,
      insurance_monthly: financialProfile?.insurance_monthly ?? null,
      childcare_education_monthly: financialProfile?.childcare_education_monthly ?? null,
      medical_monthly: financialProfile?.medical_monthly ?? null,
      entertainment_lifestyle_monthly:
        financialProfile?.entertainment_lifestyle_monthly ?? null,
      other_non_debt_monthly: financialProfile?.other_non_debt_monthly ?? null,
    },
    total_living_expenses: financialProfile?.living_expenses_monthly ?? null,
  }
}

function buildLiabilityInputs(liabilities) {
  return liabilities.map((liability) => ({
    liability_type: liability?.type ?? null,
    credit_limit: liability?.credit_limit ?? null,
    outstanding_balance: liability?.balance ?? null,
    monthly_repayment: liability?.monthly_repayment ?? null,
    lender_name: liability?.name ?? null,
  }))
}

function buildMetricAudit({
  metric,
  sourceInputs,
  formula,
  intermediateSteps,
  rawResult,
  displayedResult,
  notes,
}) {
  return {
    metric,
    sourceInputs,
    formula,
    intermediateSteps,
    rawResult: formatMetricValue(rawResult),
    displayedResult: formatMetricValue(displayedResult),
    reconciles: valuesReconcile(rawResult, displayedResult) ? 'Yes' : 'No',
    notes,
  }
}

export default function buildDashboardFinancialAudit({
  properties = [],
  loans = [],
  transactions = [],
  financialProfile = null,
  liabilities = [],
  borrowingAnalysis = null,
  dashboardCompleteness = null,
  dashboardState = null,
  commandCenter = null,
  borrowingRenderState = null,
}) {
  const grossMonthlyRentFromTransactions = roundCurrency(
    transactions
      .filter((transaction) => transaction?.type === 'income')
      .reduce((sum, transaction) => sum + toMonthly(transaction?.amount, transaction?.frequency), 0)
  )
  const monthlyPropertyExpensesFromTransactions = roundCurrency(
    transactions
      .filter((transaction) => transaction?.type === 'expense')
      .reduce((sum, transaction) => sum + toMonthly(transaction?.amount, transaction?.frequency), 0)
  )
  const monthlyPropertyCashFlow = roundCurrency(
    grossMonthlyRentFromTransactions - monthlyPropertyExpensesFromTransactions
  )

  const totalPropertyValue = roundCurrency(
    properties.reduce((sum, property) => sum + Number(property?.current_value || 0), 0)
  )
  const totalDebt = roundCurrency(
    loans.reduce((sum, loan) => sum + Number(loan?.current_balance || 0), 0)
  )
  const hasFullMortgageCoverage = Boolean(dashboardState?.hasFullMortgageCoverage)
  const rawNetEquity = hasFullMortgageCoverage ? roundCurrency(totalPropertyValue - totalDebt) : null
  const displayedNetEquity = dashboardState?.showNetPositionPartial
    ? totalPropertyValue
    : commandCenter?.hero?.netPosition?.value ?? null

  const serviceability = borrowingAnalysis?.debug?.serviceability_breakdown || {}
  const currentBorrowingCapacity = Number(borrowingAnalysis?.borrowing_power_estimate ?? 0)
  const unlockPotential = commandCenter?.hero?.borrowingPower?.unlockPotential ?? null
  const topBorrowingAction = commandCenter?.topActions?.find((action) => action.borrowingLift != null) || null

  const metrics = {
    netEquity: buildMetricAudit({
      metric: 'Net Equity',
      sourceInputs: ['properties.current_value', 'loans.current_balance'],
      formula: hasFullMortgageCoverage
        ? 'sum(property current_value) - sum(loan current_balance)'
        : 'Hidden because mortgage coverage is incomplete.',
      intermediateSteps: {
        total_property_value: totalPropertyValue,
        total_debt: totalDebt,
        has_full_mortgage_coverage: hasFullMortgageCoverage,
      },
      rawResult: rawNetEquity,
      displayedResult: displayedNetEquity,
      notes: hasFullMortgageCoverage
        ? 'Debt-dependent net equity is shown only when all properties have mortgage coverage.'
        : 'Dashboard intentionally falls back to asset-only view when one or more properties are missing loan coverage.',
    }),
    propertyCashFlow: buildMetricAudit({
      metric: 'Property Cash Flow',
      sourceInputs: ['transactions.amount', 'transactions.frequency', 'transactions.type'],
      formula:
        'sum(property income transactions converted to monthly) - sum(property expense transactions converted to monthly)',
      intermediateSteps: {
        monthly_income_transactions: grossMonthlyRentFromTransactions,
        monthly_expense_transactions: monthlyPropertyExpensesFromTransactions,
        mortgage_repayments_included: false,
      },
      rawResult: transactions.length > 0 ? monthlyPropertyCashFlow : null,
      displayedResult: dashboardState?.canShowPropertyCashFlow
        ? commandCenter?.hero?.monthlyPosition?.propertyCashFlow ?? null
        : null,
      notes:
        'Property cash flow is transaction-based only. Mortgage repayments are excluded here and handled separately in household serviceability.',
    }),
    actualMonthlySurplus: buildMetricAudit({
      metric: 'Actual Monthly Surplus',
      sourceInputs: [
        'after-tax household income',
        'gross rental income',
        'user_financial_profiles.living_expenses_monthly',
        'property expense transactions',
        'liabilities.monthly_repayment',
        'loans.monthly_repayment',
      ],
      formula:
        'estimated_after_tax_income + gross_rental_income - (actual_living_expenses + property_expenses + actual_liability_repayments + actual_mortgage_repayments)',
      intermediateSteps: {
        estimated_after_tax_income:
          borrowingAnalysis?.derived?.actual_after_tax_income_monthly ?? null,
        gross_rental_income:
          borrowingAnalysis?.inputs?.rental_income_from_tracked_properties_monthly ?? null,
        actual_living_expenses_monthly:
          borrowingAnalysis?.derived?.actual_living_expenses_monthly ?? null,
        property_expenses_monthly:
          borrowingAnalysis?.derived?.actual_property_expenses_monthly ?? null,
        actual_liabilities_monthly:
          borrowingAnalysis?.derived?.actual_liability_repayments_monthly ?? null,
        actual_mortgage_repayments_monthly:
          borrowingAnalysis?.derived?.actual_mortgage_repayments_monthly ?? null,
        actual_total_monthly_outgoings:
          borrowingAnalysis?.derived?.actual_total_monthly_outgoings ?? null,
      },
      rawResult: borrowingAnalysis?.actual_monthly_surplus ?? null,
      displayedResult: dashboardState?.canShowActualMonthlySurplus
        ? borrowingAnalysis?.actual_monthly_surplus ?? null
        : null,
      notes:
        'This is only shown when income, living expenses, liabilities, mortgage repayments, property rent, and property expenses are all present.',
    }),
    householdSurplus: buildMetricAudit({
      metric: 'Serviceability Surplus',
      sourceInputs: [
        'user_financial_profiles.* income fields',
        'user_financial_profiles.living_expenses_monthly',
        'liabilities.monthly_repayment',
        'liabilities.credit_limit',
        'loans.current_balance',
        'loans.monthly_repayment',
        'loans.remaining_term_months',
        'transactions income for rental shading',
      ],
      formula:
        'adjusted_monthly_income + shaded_rental_income - (assessed_living_expenses + total_liability_repayments + assessed_mortgage_commitments)',
      intermediateSteps: {
        gross_annual_income: serviceability.gross_annual_income ?? null,
        adjusted_monthly_income: serviceability.adjusted_monthly_income ?? null,
        living_expenses_monthly: serviceability.living_expenses_monthly ?? null,
        liabilities_monthly: serviceability.liabilities_monthly ?? null,
        actual_mortgage_repayments_monthly: serviceability.actual_mortgage_repayments_monthly ?? null,
        assessed_mortgage_repayments_monthly:
          serviceability.assessed_mortgage_repayments_monthly ?? null,
        rental_income_included_monthly: serviceability.rental_income_included_monthly ?? null,
        total_monthly_outgoings: serviceability.total_monthly_outgoings ?? null,
      },
      rawResult: borrowingAnalysis?.net_monthly_surplus ?? null,
      displayedResult: dashboardState?.canShowHouseholdSurplus
        ? commandCenter?.hero?.monthlyPosition?.householdSurplus ?? null
        : null,
      notes:
        'Only assessed mortgage commitments are subtracted in serviceability. Actual mortgage repayments are transparency-only.',
    }),
    borrowingCapacity: buildMetricAudit({
      metric: 'Current Borrowing Capacity',
      sourceInputs: [
        'borrowingAnalysis.net_monthly_surplus',
        'assessment rate 8.5%',
        'assessment term 30 years',
      ],
      formula:
        'principal supported by max(net_monthly_surplus, 0) using the assessment repayment rate at 8.5% over 30 years',
      intermediateSteps: {
        surplus_used: Math.max(Number(borrowingAnalysis?.net_monthly_surplus || 0), 0),
        serviceability_status: borrowingAnalysis?.serviceability_status ?? null,
        missing_inputs: borrowingAnalysis?.missing_inputs ?? [],
        constraints: borrowingAnalysis?.constraints ?? [],
      },
      rawResult: currentBorrowingCapacity,
      displayedResult: dashboardState?.canShowBorrowing
        ? commandCenter?.hero?.borrowingPower?.currentCapacity ?? null
        : null,
      notes:
        currentBorrowingCapacity <= 0
          ? 'Borrowing capacity is zero because the current serviceable monthly surplus is zero or negative after assessed outgoings.'
          : 'Borrowing capacity is derived directly from the live serviceability result.',
    }),
    unlockPotential: buildMetricAudit({
      metric: 'Unlock Potential',
      sourceInputs: topBorrowingAction
        ? ['topActions borrowingLift from re-simulated live borrowing analysis']
        : ['No live uplift action available'],
      formula: topBorrowingAction
        ? 'improved_live_borrowing_capacity - current_live_borrowing_capacity'
        : 'Hidden when no validated live uplift action exists.',
      intermediateSteps: {
        top_borrowing_action: topBorrowingAction
          ? {
              id: topBorrowingAction.id,
              title: topBorrowingAction.title,
              borrowing_lift: topBorrowingAction.borrowingLift,
              why_it_matters: topBorrowingAction.whyItMatters,
            }
          : null,
      },
      rawResult: unlockPotential,
      displayedResult: dashboardState?.canShowBorrowing
        ? commandCenter?.hero?.borrowingPower?.unlockPotential ?? null
        : null,
      notes:
        'Unlock potential is only valid when it comes from the same live borrowing engine base as current capacity. Static fallback estimates are not allowed.',
    }),
  }

  const reconciliationTable = Object.values(metrics).map((item) => ({
    Metric: item.metric,
    'Source Inputs': item.sourceInputs.join(', '),
    Formula: item.formula,
    'Raw Result': item.rawResult,
    'Displayed Result': item.displayedResult,
    'Reconciles?': item.reconciles,
    Notes: item.notes,
  }))

  const failureModes = {
    livingExpensesCountedMoreThanOnce:
      Number(serviceability.total_monthly_outgoings || 0) >
        Number(serviceability.living_expenses_monthly || 0) +
          Number(serviceability.liabilities_monthly || 0) +
          Number(serviceability.assessed_mortgage_repayments_monthly || 0) ||
      false,
    liabilitiesCountedMoreThanOnce:
      Number(serviceability.liabilities_monthly || 0) >
      Number(borrowingAnalysis?.total_monthly_liability_repayments || 0),
    actualAndAssessedMortgageRepaymentsBothSubtracted:
      Number(serviceability.total_monthly_outgoings || 0) ===
      roundCurrency(
        Number(serviceability.living_expenses_monthly || 0) +
          Number(serviceability.liabilities_monthly || 0) +
          Number(serviceability.actual_mortgage_repayments_monthly || 0) +
          Number(serviceability.assessed_mortgage_repayments_monthly || 0)
      ),
    rentalIncomeExcludedWhileDebtIncluded:
      grossMonthlyRentFromTransactions > 0 &&
      Number(serviceability.assessed_mortgage_repayments_monthly || 0) > 0 &&
      Number(serviceability.rental_income_included_monthly || 0) === 0,
    monthlyAnnualConversionError:
      Number(serviceability.gross_annual_income || 0) > 0 &&
      Number(serviceability.adjusted_monthly_income || 0) >
        Number(serviceability.gross_annual_income || 0),
    missingDataFallbackDrivingConservatism:
      (borrowingAnalysis?.missing_inputs || []).length > 0,
    onboardingMarksCompleteWithoutCalculationReadiness:
      dashboardState?.setupComplete &&
      (!dashboardState?.canShowBorrowing || !dashboardState?.canShowTopActions),
    unlockPotentialOnDisconnectedPath:
      commandCenter?.hero?.borrowingPower?.unlockPotential != null && !topBorrowingAction,
  }

  return {
    timestamp: new Date().toISOString(),
    rawInputs: {
      properties: buildPropertyInputs(properties, transactions),
      mortgages: buildLoanInputs(loans, borrowingAnalysis),
      financials: buildFinancialInputs(financialProfile),
      liabilities: buildLiabilityInputs(liabilities),
    },
    derivedMetrics: metrics,
    reconciliationTable,
    failureModes,
    dashboardState: {
      setupComplete: dashboardState?.setupComplete ?? dashboardState?.isSetupComplete ?? null,
      setupCompletionLabel: dashboardState?.setupCompletionLabel ?? null,
      setupCompletedCount: dashboardState?.setupCompletedCount ?? null,
      canShowNetPosition: dashboardState?.canShowNetPosition ?? null,
      canShowMonthlyPosition: dashboardState?.canShowMonthlyPosition ?? null,
      canShowActualMonthlySurplus: dashboardState?.canShowActualMonthlySurplus ?? null,
      canShowBorrowing: dashboardState?.canShowBorrowing ?? null,
      canShowTopActions: dashboardState?.canShowTopActions ?? null,
      missingSections: dashboardState?.missingSectionIds ?? [],
    },
    borrowingRenderState: {
      state: borrowingRenderState?.state ?? null,
      confidence: borrowingRenderState?.confidence ?? null,
      warning: borrowingRenderState?.warning ?? null,
    },
    debug: {
      gross_annual_income: serviceability.gross_annual_income ?? null,
      adjusted_annual_income:
        serviceability.adjusted_monthly_income != null
          ? roundCurrency(Number(serviceability.adjusted_monthly_income) * 12)
          : null,
      adjusted_monthly_income: serviceability.adjusted_monthly_income ?? null,
      living_expenses_monthly: serviceability.living_expenses_monthly ?? null,
      liabilities_monthly: serviceability.liabilities_monthly ?? null,
      rental_income_included: serviceability.rental_income_included_monthly ?? null,
      actual_mortgage_repayments_monthly:
        serviceability.actual_mortgage_repayments_monthly ?? null,
      assessed_mortgage_repayments_monthly:
        serviceability.assessed_mortgage_repayments_monthly ?? null,
      total_monthly_outgoings: serviceability.total_monthly_outgoings ?? null,
      net_monthly_surplus: serviceability.net_monthly_surplus ?? null,
      borrowing_capacity: serviceability.resulting_borrowing_capacity ?? null,
      unlock_potential: unlockPotential,
      missing_fields_affecting_calculations: borrowingAnalysis?.missing_inputs ?? [],
      assessed_mortgage_commitments:
        borrowingAnalysis?.assessed_mortgage_commitments_monthly ?? null,
    },
    completeness: dashboardCompleteness,
  }
}
