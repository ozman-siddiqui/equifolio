import { useMemo } from 'react'
import {
  Brain,
  CircleHelp,
  ShieldAlert,
  Sparkles,
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

  const keyDrivers = useMemo(() => {
    if (!aid?.reasons?.length) return []

    const strongestPositive = aid.reasons.find((reason) => reason.type === 'positive')
    const strongestNegative = aid.reasons.find((reason) => reason.type === 'negative')
    const strongestOpportunity = aid.reasons.find((reason) => reason.type === 'opportunity')
    const fallbackWarning = aid.reasons.find((reason) => reason.type === 'warning')

    return [
      strongestNegative || fallbackWarning,
      strongestPositive,
      strongestOpportunity,
    ]
      .filter(Boolean)
      .slice(0, 3)
  }, [aid])

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
    aid.decisionLabel === 'Strong Hold'
      ? toneClasses.positive
      : aid.decisionLabel === 'Hold'
      ? toneClasses.neutral
      : aid.decisionLabel === 'Optimise' || aid.decisionLabel === 'Refinance'
      ? toneClasses.warning
      : toneClasses.danger

  const pillars = [
    {
      key: 'growth',
      title: 'Growth',
      value:
        aid.metrics.annualGrowthPct === null
          ? 'Missing'
          : `${aid.metrics.annualGrowthPct.toFixed(1)}%`,
      score: aid.subScores.growth,
      explanation: aid.explanations.growth,
      icon: TrendingUp,
      tone:
        aid.subScores.growth >= 75 ? 'green' : aid.subScores.growth >= 50 ? 'amber' : 'red',
    },
    {
      key: 'cashflow',
      title: 'Cash Flow',
      value: formatCurrency(aid.metrics.monthlyNet),
      score: aid.subScores.cashflow,
      explanation: aid.explanations.cashflow,
      icon: Wallet,
      tone:
        aid.subScores.cashflow >= 75 ? 'green' : aid.subScores.cashflow >= 50 ? 'amber' : 'red',
    },
    {
      key: 'yield',
      title: 'Yield',
      value: `${aid.metrics.netYieldPct.toFixed(2)}%`,
      score: aid.subScores.yield,
      explanation: aid.explanations.yield,
      icon: Sparkles,
      tone:
        aid.subScores.yield >= 75 ? 'green' : aid.subScores.yield >= 50 ? 'amber' : 'red',
    },
    {
      key: 'leverage',
      title: 'Leverage',
      value: `${aid.metrics.lvr.toFixed(1)}%`,
      score: aid.subScores.leverage,
      explanation: aid.explanations.risk,
      icon: ShieldAlert,
      tone:
        aid.subScores.leverage >= 75 ? 'green' : aid.subScores.leverage >= 50 ? 'amber' : 'red',
    },
    {
      key: 'mortgage',
      title: 'Mortgage',
      value:
        aid.metrics.debt > 0
          ? aid.metrics.estimatedRefinanceSavings >= 50
            ? `${formatCurrency(aid.metrics.estimatedRefinanceSavings)}/mo`
            : 'Rate looks competitive'
          : 'No loan data',
      score: aid.subScores.mortgage,
      explanation: aid.explanations.mortgage,
      icon: CircleHelp,
      tone:
        aid.subScores.mortgage >= 75 ? 'green' : aid.subScores.mortgage >= 50 ? 'amber' : 'red',
    },
    {
      key: 'dataCompleteness',
      title: 'Data completeness',
      value: `${aid.subScores.dataCompleteness}/100`,
      score: aid.subScores.dataCompleteness,
      explanation: aid.explanations.dataCompleteness,
      icon: Brain,
      tone:
        aid.subScores.dataCompleteness >= 75
          ? 'green'
          : aid.subScores.dataCompleteness >= 50
          ? 'amber'
          : 'red',
    },
  ].filter((pillar) =>
    aid.usageType === 'owner_occupied'
      ? pillar.key !== 'cashflow' && pillar.key !== 'yield'
      : true
  )

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
              Decision Score
            </p>
            <p className={`text-3xl font-bold mt-1 ${ratingTone.text}`}>
              {aid.decisionScore}/100
            </p>
            <p className="mt-2 text-sm font-medium text-gray-700">{aid.propertyProfile}</p>
            <p className="text-sm text-gray-600 mt-2">
              Confidence {aid.confidenceScore}/100 | {aid.confidenceLabel}
            </p>
          </div>

          <div className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ratingTone.badge}`}>
            {aid.decisionLabel}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Key Drivers</h4>
        <div className="space-y-3">
          {keyDrivers.map((reason) => (
            <ReasonRow key={reason.title} reason={reason} emphasised />
          ))}
        </div>
      </div>

      {aid.recommendedActions?.length ? (
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Recommended actions</h4>
          <div className="space-y-3">
            {aid.recommendedActions.map((action) => (
              <ActionRow key={action.label} action={action} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
        <h4 className="text-sm font-semibold text-gray-900">Summary</h4>
        <p className="mt-2 line-clamp-2 text-sm text-gray-600">{aid.summary}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
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

      {aid.missingInputs.length > 0 ? (
        <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <h4 className="text-sm font-semibold text-gray-900">Improve Decision Quality</h4>
          <p className="text-sm text-gray-600 mt-1">{aid.improveDecisionPrompt}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {aid.recommendedNextInputs.slice(0, 3).map((item) => (
              <span
                key={item}
                className="inline-flex items-center rounded-full bg-white border border-gray-200 px-2.5 py-1 text-xs text-gray-600"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}
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
    <div className="min-w-0 rounded-xl border border-gray-100 bg-gray-50/70 p-3">
      <p className="break-words text-[11px] uppercase tracking-wide leading-tight text-gray-400">
        {label}
      </p>
      <p className={`mt-1 min-w-0 break-words text-sm font-medium leading-tight ${toneClass}`}>
        {value}
      </p>
      <p className="mt-1 break-words text-[11px] leading-tight text-gray-400">
        Sub-score {score}/100
      </p>
    </div>
  )
}

function ReasonRow({ reason, emphasised = false }) {
  const toneMap = {
    positive: 'text-green-600 bg-green-50 border-green-100',
    opportunity: 'text-primary-600 bg-primary-50 border-primary-100',
    negative: 'text-red-500 bg-red-50 border-red-100',
    warning: 'text-amber-600 bg-amber-50 border-amber-100',
  }

  const Icon =
    reason.type === 'positive'
      ? TrendingUp
      : reason.type === 'opportunity'
      ? Sparkles
      : reason.type === 'warning'
      ? ShieldAlert
      : TrendingDown

  return (
    <div className={`rounded-xl border p-3 ${emphasised ? 'border-gray-200 bg-white' : 'border-gray-100'}`}>
      <div className="flex items-start gap-3 min-w-0">
        <div className={`p-2 rounded-lg border ${toneMap[reason.type] || toneMap.warning}`}>
          <Icon size={14} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{reason.title}</p>
          <p className={`${emphasised ? 'text-sm' : 'text-xs'} text-gray-600 mt-1`}>
            {reason.detail}
          </p>
        </div>
      </div>
    </div>
  )
}

function ActionRow({ action }) {
  const toneMap = {
    strategic: 'border-primary-200 bg-primary-50 text-primary-700',
    financial: 'border-amber-200 bg-amber-50 text-amber-700',
    operational: 'border-gray-200 bg-white text-gray-700',
  }

  const badgeMap = {
    strategic: 'Strategy',
    financial: 'Optimise',
    operational: 'Data',
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-start gap-3">
        <div className={`rounded-lg border p-2 ${toneMap[action.type] || toneMap.operational}`}>
          <Sparkles size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{action.label}</p>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
              {badgeMap[action.type] || badgeMap.operational}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">{action.impact}</p>
        </div>
      </div>
    </div>
  )
}
