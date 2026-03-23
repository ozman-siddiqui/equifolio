const WEIGHTS = {
  growth: 0.3,
  cashflow: 0.25,
  yield: 0.2,
  risk: 0.25,
}

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

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value))

const round = (value) => Math.round(value)

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))
}

function getYearsHeld(purchaseDate) {
  if (!purchaseDate) return null
  const now = new Date()
  const start = new Date(purchaseDate)
  const diffMs = now - start
  if (!Number.isFinite(diffMs) || diffMs <= 0) return null
  return diffMs / (1000 * 60 * 60 * 24 * 365.25)
}

function getAnnualGrowthPct(property) {
  const purchasePrice = Number(property?.purchase_price || 0)
  const currentValue = Number(property?.current_value || 0)
  if (purchasePrice <= 0 || currentValue <= 0) return 0

  const totalGrowthPct = ((currentValue - purchasePrice) / purchasePrice) * 100
  const yearsHeld = getYearsHeld(property?.purchase_date)

  if (!yearsHeld || yearsHeld < 1) {
    return totalGrowthPct
  }

  return (Math.pow(currentValue / purchasePrice, 1 / yearsHeld) - 1) * 100
}

function getGrowthScore(annualGrowthPct) {
  if (annualGrowthPct >= 20) return 100
  if (annualGrowthPct >= 15) return 92
  if (annualGrowthPct >= 10) return 82
  if (annualGrowthPct >= 6) return 68
  if (annualGrowthPct >= 3) return 56
  if (annualGrowthPct >= 0) return 46
  if (annualGrowthPct >= -5) return 28
  return 12
}

function getCashflowMetrics(cashflow) {
  if (Array.isArray(cashflow)) {
    const monthlyIncome = cashflow
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + toMonthly(item.amount, item.frequency), 0)
    const monthlyExpenses = cashflow
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + toMonthly(item.amount, item.frequency), 0)

    return {
      monthlyIncome,
      monthlyExpenses,
      monthlyNet: monthlyIncome - monthlyExpenses,
    }
  }

  const monthlyIncome = Number(cashflow?.monthlyIncome || 0)
  const monthlyExpenses = Number(cashflow?.monthlyExpenses || 0)

  return {
    monthlyIncome,
    monthlyExpenses,
    monthlyNet:
      cashflow?.monthlyNet !== undefined
        ? Number(cashflow.monthlyNet || 0)
        : monthlyIncome - monthlyExpenses,
  }
}

function getCashflowScore(monthlyNet, monthlyIncome) {
  if (monthlyIncome > 0) {
    const margin = monthlyNet / monthlyIncome
    if (margin >= 0.2) return 96
    if (margin >= 0.1) return 86
    if (margin >= 0) return 76
    if (margin >= -0.1) return 58
    if (margin >= -0.2) return 38
    return 12
  }

  if (monthlyNet > 0) return 72
  if (monthlyNet === 0) return 55
  if (monthlyNet >= -250) return 42
  if (monthlyNet >= -750) return 24
  return 10
}

function getYieldScore(yieldPct) {
  if (yieldPct >= 5 && yieldPct <= 6.5) return 92
  if (yieldPct >= 4 && yieldPct < 5) return 82
  if (yieldPct > 6.5 && yieldPct <= 8) return 78
  if (yieldPct >= 3 && yieldPct < 4) return 62
  if (yieldPct >= 2 && yieldPct < 3) return 46
  if (yieldPct >= 0 && yieldPct < 2) return 28
  return 12
}

function getRiskScore(lvr) {
  if (lvr <= 50) return 94
  if (lvr <= 60) return 86
  if (lvr <= 70) return 72
  if (lvr <= 80) return 56
  if (lvr <= 90) return 28
  return 12
}

function getLabel(score) {
  if (score >= 75) return 'Strong Buy'
  if (score >= 60) return 'Hold'
  if (score >= 45) return 'Review'
  return 'Risk'
}

function buildPillarExplanation(type, metrics, score) {
  if (type === 'growth') {
    if (score >= 90) {
      return `Annualised capital growth is ${metrics.annualGrowthPct.toFixed(
        1
      )}%, which is a very strong appreciation signal.`
    }
    if (score >= 70) {
      return `Annualised capital growth is ${metrics.annualGrowthPct.toFixed(
        1
      )}%, which supports the investment case.`
    }
    return `Annualised capital growth is ${metrics.annualGrowthPct.toFixed(
      1
    )}%, so capital appreciation is not yet doing enough heavy lifting.`
  }

  if (type === 'cashflow') {
    if (score >= 80) {
      return `Monthly cash flow is ${formatCurrency(
        metrics.monthlyNet
      )}, giving the property healthy operating support.`
    }
    if (score >= 55) {
      return `Monthly cash flow is ${formatCurrency(
        metrics.monthlyNet
      )}. The property is broadly manageable but not strongly cash generative.`
    }
    return `Monthly cash flow is ${formatCurrency(
      metrics.monthlyNet
    )}, which is dragging the score and needs attention.`
  }

  if (type === 'yield') {
    if (score >= 80) {
      return `Yield is ${metrics.yieldPct.toFixed(
        2
      )}%, which sits in a strong efficiency range for the portfolio.`
    }
    if (score >= 55) {
      return `Yield is ${metrics.yieldPct.toFixed(
        2
      )}%, which is acceptable but not a standout efficiency signal.`
    }
    return `Yield is ${metrics.yieldPct.toFixed(
      2
    )}%, so the asset is not converting value into income efficiently enough.`
  }

  if (score >= 80) {
    return `LVR is ${metrics.lvr.toFixed(
      1
    )}%, which gives the property a strong risk and flexibility position.`
  }
  if (score >= 55) {
    return `LVR is ${metrics.lvr.toFixed(
      1
    )}%, which is manageable but not especially defensive.`
  }
  return `LVR is ${metrics.lvr.toFixed(
    1
  )}%, which raises risk and reduces refinance flexibility.`
}

export function calculateAIDScore(property, loanData = [], cashflowData = []) {
  const loans = Array.isArray(loanData) ? loanData : [loanData].filter(Boolean)
  const { monthlyIncome, monthlyExpenses, monthlyNet } = getCashflowMetrics(cashflowData)

  const currentValue = Number(property?.current_value || 0)
  const purchasePrice = Number(property?.purchase_price || 0)
  const debt = loans.reduce(
    (sum, loan) => sum + Number(loan?.current_balance || 0),
    0
  )

  const annualGrowthPct = getAnnualGrowthPct(property)
  const grossYieldPct = currentValue > 0 ? ((monthlyIncome * 12) / currentValue) * 100 : 0
  const lvr = currentValue > 0 ? (debt / currentValue) * 100 : 0

  const growth = clamp(getGrowthScore(annualGrowthPct))
  const cashflow = clamp(getCashflowScore(monthlyNet, monthlyIncome))
  const yieldScore = clamp(getYieldScore(grossYieldPct))
  const risk = clamp(getRiskScore(lvr))

  let weightedScore =
    growth * WEIGHTS.growth +
    cashflow * WEIGHTS.cashflow +
    yieldScore * WEIGHTS.yield +
    risk * WEIGHTS.risk

  const extremeNegativeCashflow =
    cashflow <= 20 || (monthlyIncome > 0 && monthlyNet / monthlyIncome <= -0.2)

  if (annualGrowthPct > 20 && !extremeNegativeCashflow) {
    weightedScore = Math.max(weightedScore, 70)
  }

  const score = clamp(round(weightedScore))
  const label = getLabel(score)

  const metrics = {
    annualGrowthPct,
    monthlyIncome,
    monthlyExpenses,
    monthlyNet,
    yieldPct: grossYieldPct,
    lvr,
    debt,
    currentValue,
    purchasePrice,
  }

  const breakdown = {
    growth: round(growth),
    cashflow: round(cashflow),
    yield: round(yieldScore),
    risk: round(risk),
  }

  const explanations = {
    growth: buildPillarExplanation('growth', metrics, breakdown.growth),
    cashflow: buildPillarExplanation('cashflow', metrics, breakdown.cashflow),
    yield: buildPillarExplanation('yield', metrics, breakdown.yield),
    risk: buildPillarExplanation('risk', metrics, breakdown.risk),
    summary:
      label === 'Strong Buy'
        ? 'The property is performing well across multiple pillars rather than relying on a single metric.'
        : label === 'Hold'
        ? 'The property is generally balanced, with a few areas that should still be monitored.'
        : label === 'Review'
        ? 'The property has mixed signals and should be reviewed before the next major decision.'
        : 'The property is showing enough weakness that risk management should take priority.',
  }

  return {
    score,
    label,
    breakdown,
    explanations,
    metrics,
  }
}

export default calculateAIDScore
