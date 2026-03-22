import { useMemo } from 'react'
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Scale,
  ChevronRight,
} from 'lucide-react'

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

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))

export default function AIScorePanel({ property, loans = [], transactions = [] }) {
  const aid = useMemo(() => {
    if (!property) return null

    const currentValue = Number(property.current_value || 0)
    const purchasePrice = Number(property.purchase_price || 0)
    const debt = loans.reduce((sum, loan) => sum + Number(loan.current_balance || 0), 0)
    const equity = currentValue - debt
    const lvr = currentValue > 0 ? (debt / currentValue) * 100 : 0
    const growthPct =
      purchasePrice > 0 ? ((currentValue - purchasePrice) / purchasePrice) * 100 : 0

    const monthlyIncome = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + toMonthly(t.amount, t.frequency), 0)

    const monthlyExpenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + toMonthly(t.amount, t.frequency), 0)

    const monthlyNet = monthlyIncome - monthlyExpenses

    const netYield =
      currentValue > 0 ? ((monthlyNet * 12) / currentValue) * 100 : 0

    const fixedLoans = loans.filter((loan) => loan.loan_type === 'Fixed')
    const fixedExpiringSoon = fixedLoans.some((loan) => {
      if (!loan.fixed_rate_expiry) return false
      const days = Math.ceil(
        (new Date(loan.fixed_rate_expiry) - new Date()) / (1000 * 60 * 60 * 24)
      )
      return days > 0 && days <= 90
    })

    let score = 50

    if (monthlyNet > 0) score += 18
    else if (monthlyNet < 0) score -= 18

    if (netYield > 3) score += 10
    else if (netYield > 1) score += 6
    else if (netYield < 0) score -= 10

    if (lvr < 60) score += 12
    else if (lvr < 70) score += 8
    else if (lvr < 80) score += 2
    else score -= 12

    if (growthPct > 20) score += 10
    else if (growthPct > 10) score += 6
    else if (growthPct < 0) score -= 8

    if (fixedExpiringSoon) score -= 6

    if (transactions.length === 0) score -= 8

    score = Math.max(0, Math.min(100, Math.round(score)))

    let decision = 'Hold'
    if (score >= 75) decision = 'Strong Hold'
    else if (score >= 60) decision = 'Hold'
    else if (score >= 45) decision = 'Review'
    else decision = 'Action Needed'

    const rating =
      score >= 75
        ? { label: 'Strong', tone: 'green' }
        : score >= 60
        ? { label: 'Healthy', tone: 'green' }
        : score >= 45
        ? { label: 'Mixed', tone: 'amber' }
        : { label: 'Weak', tone: 'red' }

    const reasons = []

    reasons.push({
      label: 'Cash Flow',
      value: monthlyNet >= 0 ? 'Positive' : 'Negative',
      tone: monthlyNet >= 0 ? 'green' : 'red',
      detail: formatCurrency(monthlyNet),
      icon: monthlyNet >= 0 ? 'up' : 'down',
    })

    reasons.push({
      label: 'Leverage',
      value: `${lvr.toFixed(1)}% LVR`,
      tone: lvr < 70 ? 'green' : lvr < 80 ? 'amber' : 'red',
      detail: formatCurrency(equity) + ' equity',
      icon: 'scale',
    })

    reasons.push({
      label: 'Capital Growth',
      value: `${growthPct.toFixed(1)}%`,
      tone: growthPct >= 0 ? 'green' : 'red',
      detail: formatCurrency(currentValue - purchasePrice),
      icon: growthPct >= 0 ? 'up' : 'down',
    })

    if (fixedExpiringSoon) {
      reasons.push({
        label: 'Rate Risk',
        value: 'Expiry Soon',
        tone: 'amber',
        detail: 'Fixed rate review needed',
        icon: 'risk',
      })
    }

    const actions = []

    if (monthlyNet < 0) {
      actions.push('Review recurring expenses and mortgage burden.')
    }

    if (lvr >= 80) {
      actions.push('High leverage may reduce flexibility for equity release or refinancing.')
    }

    if (fixedExpiringSoon) {
      actions.push('Start refinance review before the fixed rate expires.')
    }

    if (monthlyNet > 0 && lvr < 70 && growthPct > 10) {
      actions.push('This asset looks resilient. Consider hold or optimise strategy.')
    }

    if (actions.length === 0) {
      actions.push('This property is relatively balanced. Monitor performance monthly.')
    }

    return {
      score,
      decision,
      rating,
      monthlyNet,
      lvr,
      netYield,
      growthPct,
      reasons,
      actions: actions.slice(0, 3),
    }
  }, [property, loans, transactions])

  if (!aid) return null

  const toneClasses = {
    green: {
      text: 'text-green-700',
      bg: 'bg-green-50',
      border: 'border-green-100',
    },
    amber: {
      text: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
    },
    red: {
      text: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-100',
    },
  }

  const ratingTone = toneClasses[aid.rating.tone]

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="text-primary-600" size={18} />
        <h3 className="font-semibold text-gray-900">AI Decision Engine</h3>
      </div>

      <div className={`rounded-2xl border p-4 ${ratingTone.bg} ${ratingTone.border}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              AID V2 Score
            </p>
            <p className={`text-3xl font-bold mt-1 ${ratingTone.text}`}>{aid.score}/100</p>
          </div>

          <div className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ratingTone.bg} ${ratingTone.text}`}>
            {aid.rating.label}
          </div>
        </div>

        <div className="mt-3">
          <p className="text-sm text-gray-700">
            Recommended stance: <span className="font-semibold">{aid.decision}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4">
        <MiniMetric
          label="Cash Flow"
          value={formatCurrency(aid.monthlyNet)}
          valueClassName={aid.monthlyNet >= 0 ? 'text-green-600' : 'text-red-500'}
        />
        <MiniMetric
          label="LVR"
          value={`${aid.lvr.toFixed(1)}%`}
          valueClassName={
            aid.lvr < 70 ? 'text-green-600' : aid.lvr < 80 ? 'text-amber-600' : 'text-red-500'
          }
        />
        <MiniMetric
          label="Net Yield"
          value={`${aid.netYield.toFixed(2)}%`}
          valueClassName={aid.netYield >= 0 ? 'text-green-600' : 'text-red-500'}
        />
      </div>

      <div className="mt-5">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Drivers</h4>
        <div className="space-y-2">
          {aid.reasons.map((reason) => (
            <ReasonRow key={reason.label} reason={reason} />
          ))}
        </div>
      </div>

      <div className="mt-5">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Suggested Focus</h4>
        <div className="space-y-2">
          {aid.actions.map((action, index) => (
            <div
              key={index}
              className="flex items-start gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3"
            >
              <ChevronRight size={14} className="text-primary-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-700">{action}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MiniMetric({ label, value, valueClassName = 'text-gray-900' }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-sm font-semibold mt-1 ${valueClassName}`}>{value}</p>
    </div>
  )
}

function ReasonRow({ reason }) {
  const toneMap = {
    green: 'text-green-600 bg-green-50 border-green-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    red: 'text-red-500 bg-red-50 border-red-100',
  }

  const icon =
    reason.icon === 'up' ? (
      <TrendingUp size={14} />
    ) : reason.icon === 'down' ? (
      <TrendingDown size={14} />
    ) : reason.icon === 'risk' ? (
      <ShieldAlert size={14} />
    ) : (
      <Scale size={14} />
    )

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`p-2 rounded-lg border ${toneMap[reason.tone]}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">{reason.label}</p>
          <p className="text-xs text-gray-500 truncate">{reason.detail}</p>
        </div>
      </div>

      <div
        className={`text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${toneMap[reason.tone]}`}
      >
        {reason.value}
      </div>
    </div>
  )
}