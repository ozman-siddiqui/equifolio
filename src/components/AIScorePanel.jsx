import { useMemo } from 'react'
import {
  Brain,
  ChevronRight,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'

import calculateAIDScore from '../utils/calculateAIDScore'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))

export default function AIScorePanel({ property, loans = [], transactions = [] }) {
  const aid = useMemo(
    () => (property ? calculateAIDScore(property, loans, transactions) : null),
    [property, loans, transactions]
  )

  if (!aid) return null

  const toneClasses = {
    positive: {
      text: 'text-green-700',
      bg: 'bg-green-50',
      border: 'border-green-100',
      badge: 'bg-green-100 text-green-700',
    },
    neutral: {
      text: 'text-primary-700',
      bg: 'bg-primary-50',
      border: 'border-primary-100',
      badge: 'bg-primary-100 text-primary-700',
    },
    warning: {
      text: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      badge: 'bg-amber-100 text-amber-700',
    },
    danger: {
      text: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-100',
      badge: 'bg-red-100 text-red-700',
    },
  }

  const ratingTone =
    aid.label === 'Strong Buy'
      ? toneClasses.positive
      : aid.label === 'Hold'
      ? toneClasses.neutral
      : aid.label === 'Review'
      ? toneClasses.warning
      : toneClasses.danger

  const pillars = [
    {
      key: 'growth',
      title: 'Capital Growth',
      value: `${aid.metrics.annualGrowthPct.toFixed(1)}%`,
      score: aid.breakdown.growth,
      explanation: aid.explanations.growth,
      icon: TrendingUp,
      tone:
        aid.breakdown.growth >= 75 ? 'green' : aid.breakdown.growth >= 50 ? 'amber' : 'red',
    },
    {
      key: 'cashflow',
      title: 'Cashflow Health',
      value: formatCurrency(aid.metrics.monthlyNet),
      score: aid.breakdown.cashflow,
      explanation: aid.explanations.cashflow,
      icon: Wallet,
      tone:
        aid.breakdown.cashflow >= 75 ? 'green' : aid.breakdown.cashflow >= 50 ? 'amber' : 'red',
    },
    {
      key: 'yield',
      title: 'Yield Efficiency',
      value: `${aid.metrics.yieldPct.toFixed(2)}%`,
      score: aid.breakdown.yield,
      explanation: aid.explanations.yield,
      icon: Target,
      tone:
        aid.breakdown.yield >= 75 ? 'green' : aid.breakdown.yield >= 50 ? 'amber' : 'red',
    },
    {
      key: 'risk',
      title: 'Leverage & Risk',
      value: `${aid.metrics.lvr.toFixed(1)}% LVR`,
      score: aid.breakdown.risk,
      explanation: aid.explanations.risk,
      icon: ShieldAlert,
      tone:
        aid.breakdown.risk >= 75 ? 'green' : aid.breakdown.risk >= 50 ? 'amber' : 'red',
    },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="text-primary-600" size={18} />
        <h3 className="font-semibold text-gray-900">AI Decision Engine</h3>
      </div>

      <div className={`rounded-2xl border p-5 ${ratingTone.bg} ${ratingTone.border}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              AID Score
            </p>
            <p className={`text-3xl font-bold mt-1 ${ratingTone.text}`}>{aid.score}/100</p>
          </div>

          <div className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ratingTone.badge}`}>
            {aid.label}
          </div>
        </div>

        <p className="text-sm text-gray-700 mt-3">{aid.explanations.summary}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        {pillars.map((pillar) => (
          <MiniMetric
            key={pillar.key}
            label={pillar.title}
            value={pillar.value}
            score={pillar.score}
            tone={pillar.tone}
          />
        ))}
      </div>

      <div className="mt-5">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Weighted Breakdown</h4>
        <div className="space-y-3">
          {pillars.map((pillar) => (
            <ReasonRow key={pillar.key} pillar={pillar} />
          ))}
        </div>
      </div>

      <div className="mt-5">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Suggested Focus</h4>
        <div className="space-y-2">
          {pillars
            .slice()
            .sort((a, b) => a.score - b.score)
            .slice(0, 2)
            .map((pillar) => (
              <div
                key={pillar.key}
                className="flex items-start gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3"
              >
                <ChevronRight size={14} className="text-primary-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-700">{pillar.explanation}</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

function MiniMetric({ label, value, score, tone }) {
  const toneClass =
    tone === 'green'
      ? 'text-green-600'
      : tone === 'amber'
      ? 'text-amber-600'
      : 'text-red-500'

  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-sm font-semibold mt-1 ${toneClass}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">Sub-score {score}/100</p>
    </div>
  )
}

function ReasonRow({ pillar }) {
  const toneMap = {
    green: 'text-green-600 bg-green-50 border-green-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    red: 'text-red-500 bg-red-50 border-red-100',
  }

  const Icon = pillar.icon || TrendingDown

  return (
    <div className="rounded-xl border border-gray-100 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`p-2 rounded-lg border ${toneMap[pillar.tone]}`}>
            <Icon size={14} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">{pillar.title}</p>
            <p className="text-xs text-gray-500 mt-1">{pillar.explanation}</p>
          </div>
        </div>

        <div
          className={`text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${toneMap[pillar.tone]}`}
        >
          {pillar.score}/100
        </div>
      </div>
    </div>
  )
}
