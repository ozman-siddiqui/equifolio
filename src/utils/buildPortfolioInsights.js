const toMonthly = (amount, frequency) => {
  const map = {
    Weekly: 52 / 12,
    Fortnightly: 26 / 12,
    Monthly: 1,
    Quarterly: 1 / 3,
    Annual: 1 / 12,
  }

  return Number(amount || 0) * (map[frequency] || 1)
}

const getDaysUntil = (dateStr, now) => {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - now) / (1000 * 60 * 60 * 24))
}

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))

export default function buildPortfolioInsights({
  properties = [],
  loans = [],
  transactions = [],
  alerts = [],
  now = new Date(),
}) {
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const thisMonthTransactions = transactions.filter((transaction) => {
    const date = new Date(transaction.date)
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear
  })

  const propertySummaries = properties.map((property) => {
    const propertyLoans = loans.filter(
      (loan) => String(loan.property_id) === String(property.id)
    )
    const propertyTransactions = thisMonthTransactions.filter(
      (transaction) => String(transaction.property_id) === String(property.id)
    )

    const currentValue = Number(property.current_value || 0)
    const purchasePrice = Number(property.purchase_price || 0)
    const debt = propertyLoans.reduce(
      (sum, loan) => sum + Number(loan.current_balance || 0),
      0
    )
    const income = propertyTransactions
      .filter((transaction) => transaction.type === 'income')
      .reduce(
        (sum, transaction) => sum + toMonthly(transaction.amount, transaction.frequency),
        0
      )
    const expenses = propertyTransactions
      .filter((transaction) => transaction.type === 'expense')
      .reduce(
        (sum, transaction) => sum + toMonthly(transaction.amount, transaction.frequency),
        0
      )

    const growth = currentValue - purchasePrice
    const net = income - expenses
    const lvr = currentValue > 0 ? (debt / currentValue) * 100 : 0

    const refinanceCandidate = propertyLoans
      .map((loan) => ({
        ...loan,
        fixedDays: getDaysUntil(loan.fixed_rate_expiry, now),
        rate: Number(loan.interest_rate || 0),
      }))
      .filter(
        (loan) =>
          (loan.loan_type === 'Fixed' &&
            loan.fixedDays !== null &&
            loan.fixedDays > 0 &&
            loan.fixedDays <= 120) ||
          (loan.loan_type !== 'Fixed' && loan.rate >= 6.25)
      )
      .sort((a, b) => {
        const aScore = a.loan_type === 'Fixed' ? a.fixedDays : 999
        const bScore = b.loan_type === 'Fixed' ? b.fixedDays : 999
        return aScore - bScore || b.rate - a.rate
      })[0] || null

    return {
      ...property,
      debt,
      income,
      expenses,
      growth,
      net,
      lvr,
      refinanceCandidate,
      hasNoIncomeWithExpenses: income === 0 && expenses > 0,
    }
  })

  const portfolioNet = propertySummaries.reduce((sum, property) => sum + property.net, 0)
  const urgentAlert = alerts.find((alert) => alert.urgent)
  const insights = []

  const weakestProperty = [...propertySummaries].sort(
    (a, b) => a.net - b.net || a.growth - b.growth
  )[0]

  if (weakestProperty && (weakestProperty.net < 0 || weakestProperty.growth < 0)) {
    const title =
      weakestProperty.net < 0 && weakestProperty.growth < 0
        ? 'Underperforming property needs review'
        : weakestProperty.net < 0
        ? 'Weak cash flow property detected'
        : 'Capital growth is lagging'

    const description =
      weakestProperty.net < 0
        ? `${weakestProperty.address} is currently running at ${formatCurrency(
            weakestProperty.net
          )} for the month and may need rent, debt, or cost optimisation.`
        : `${weakestProperty.address} is sitting at ${formatCurrency(
            weakestProperty.growth
          )} in growth relative to purchase price. Review hold strategy and upside.`

    insights.push({
      id: `underperforming-${weakestProperty.id}`,
      type: 'underperforming_property',
      tone: 'negative',
      priority: weakestProperty.net < 0 && weakestProperty.growth < 0 ? 98 : 88,
      badge: 'Performance',
      title,
      description,
      ctaLabel: 'Review property',
      to: `/property/${weakestProperty.id}`,
    })
  }

  if (portfolioNet < 0) {
    insights.push({
      id: 'portfolio-negative-cashflow',
      type: 'negative_cashflow',
      tone: 'negative',
      priority: 94,
      badge: 'Cash Flow',
      title: 'Portfolio cash flow has turned negative',
      description: `This month is tracking at ${formatCurrency(
        portfolioNet
      )}. Inspect weaker properties and recurring expense pressure.`,
      ctaLabel: 'Open cash flow',
      to: '/cashflow',
    })
  }

  const refinanceTarget = [...propertySummaries]
    .filter((property) => property.refinanceCandidate)
    .sort((a, b) => {
      const aLoan = a.refinanceCandidate
      const bLoan = b.refinanceCandidate
      const aPriority = aLoan.loan_type === 'Fixed' ? aLoan.fixedDays : 999
      const bPriority = bLoan.loan_type === 'Fixed' ? bLoan.fixedDays : 999
      return aPriority - bPriority || bLoan.rate - aLoan.rate
    })[0]

  if (refinanceTarget) {
    const loan = refinanceTarget.refinanceCandidate
    const isFixed = loan.loan_type === 'Fixed' && loan.fixedDays !== null

    insights.push({
      id: `refinance-${loan.id}`,
      type: 'refinance_opportunity',
      tone: 'warning',
      priority: isFixed ? 90 : 78,
      badge: 'Refinance',
      title: isFixed
        ? 'Fixed-rate expiry creates a refinance window'
        : 'Mortgage pricing may be worth testing',
      description: isFixed
        ? `${loan.lender} on ${refinanceTarget.address} expires in ${loan.fixedDays} days. Review available refinance options before rates reset.`
        : `${loan.lender} on ${refinanceTarget.address} is at ${loan.rate.toFixed(
            2
          )}%. Compare refinance options and lender pricing.`,
      ctaLabel: 'Open mortgages',
      to: '/mortgages',
    })
  }

  const riskTarget = [...propertySummaries]
    .filter((property) => property.lvr >= 80 || property.hasNoIncomeWithExpenses)
    .sort((a, b) => {
      const aScore = a.hasNoIncomeWithExpenses ? 100 : a.lvr
      const bScore = b.hasNoIncomeWithExpenses ? 100 : b.lvr
      return bScore - aScore
    })[0]

  if (riskTarget) {
    const title = riskTarget.hasNoIncomeWithExpenses
      ? 'Expense-only activity detected'
      : 'Leverage risk is elevated'
    const description = riskTarget.hasNoIncomeWithExpenses
      ? `${riskTarget.address} has expenses recorded this month without matching income. Check tenancy and expense timing.`
      : `${riskTarget.address} is sitting at ${riskTarget.lvr.toFixed(
          1
        )}% LVR, which may reduce flexibility for refinance or equity release.`

    insights.push({
      id: `risk-${riskTarget.id}`,
      type: 'risk_indicator',
      tone: 'warning',
      priority: riskTarget.hasNoIncomeWithExpenses ? 86 : 84,
      badge: 'Risk',
      title,
      description,
      ctaLabel: 'Inspect property',
      to: `/property/${riskTarget.id}`,
    })
  }

  if (urgentAlert) {
    insights.push({
      id: `urgent-alert-${urgentAlert.id}`,
      type: 'urgent_alert',
      tone: 'warning',
      priority: 82,
      badge: 'Alert',
      title: urgentAlert.title,
      description: `${urgentAlert.description}${
        typeof urgentAlert.days === 'number' ? ` Action is due in ${urgentAlert.days} days.` : ''
      }`,
      ctaLabel: 'View alerts',
      to: '/alerts',
    })
  }

  if (insights.length === 0) {
    insights.push({
      id: 'portfolio-stable',
      type: 'stable',
      tone: 'positive',
      priority: 10,
      badge: 'Stable',
      title: 'Portfolio signals look stable',
      description:
        'No material underperformance, cash flow pressure, or refinance urgency is standing out right now.',
      ctaLabel: 'View properties',
      to: '/properties',
    })
  }

  return insights.sort((a, b) => b.priority - a.priority).slice(0, 4)
}
