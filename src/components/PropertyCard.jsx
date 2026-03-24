import {
  Bath,
  BedDouble,
  CarFront,
  ChevronRight,
  Ruler,
  Sparkles,
} from 'lucide-react'

import { MetricTile } from './CardPrimitives'
import calculateAIDScore from '../utils/calculateAIDScore'

export default function PropertyCard({
  property,
  propertyLoans = [],
  propertyTransactions = [],
  onClick,
  onEdit,
  formatCurrency,
}) {
  const currentValue = Number(property.current_value || 0)
  const totalDebt = propertyLoans.reduce(
    (sum, loan) => sum + Number(loan.current_balance || 0),
    0
  )
  const equity = currentValue - totalDebt
  const aid = calculateAIDScore(property, propertyLoans, propertyTransactions)
  const features = getPropertyFeatures(property)
  const scoreTone = getScoreTone(aid.label)
  const insightLine = buildInsightLine(aid)
  const signalLine = buildSignalLine(aid)
  const hasGrowthSignal = Number.isFinite(aid.metrics.annualGrowthPct)
  const growthTone =
    !hasGrowthSignal
      ? 'bg-gray-50 text-gray-600 border-gray-200'
      : aid.metrics.annualGrowthPct >= 10
      ? 'bg-green-50 text-green-700 border-green-100'
      : aid.metrics.annualGrowthPct >= 0
      ? 'bg-primary-50 text-primary-700 border-primary-100'
      : 'bg-amber-50 text-amber-700 border-amber-100'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick?.()
        }
      }}
      className="group bg-white border border-gray-100 rounded-xl p-4 shadow-sm transition-all hover:border-primary-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer flex flex-col h-full justify-between"
    >
      <div className="space-y-3 flex-1 flex flex-col">
        <div className="min-h-[60px]">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-900">
              {property.address}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {property.suburb}, {property.state}
              {property.property_type ? ` - ${property.property_type}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600">
              <span>View details</span>
              <ChevronRight
                size={16}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </div>

            {onEdit ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onEdit()
                }}
                className="text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Edit
              </button>
            ) : null}
          </div>
        </div>
        </div>

        <div className="min-h-[50px]">
          {(property.property_use === 'owner_occupied' || features.length > 0) ? (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
            {property.property_use === 'owner_occupied' && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-700 whitespace-nowrap">
                Owner Occupied
              </span>
            )}

            {features.map((feature) => {
              const Icon = feature.icon

              return (
                <span
                  key={feature.label}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-600"
                >
                  <Icon size={14} className="text-gray-400" />
                  <span className="whitespace-nowrap">{feature.label}</span>
                </span>
              )
            })}
            </div>
          ) : (
            <div className="min-h-[50px]" />
          )}
        </div>

        <div className="min-h-[110px]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricTile label="Value" value={formatCurrency(currentValue)} />
            <MetricTile label="Loan" value={formatCurrency(totalDebt)} />
            <MetricTile
              label="Equity"
              value={formatCurrency(equity)}
              valueClassName={equity >= 0 ? 'text-green-600' : 'text-red-500'}
            />
            <MetricTile
              label="Yield"
              value={`${aid.metrics.yieldPct.toFixed(2)}%`}
              valueClassName={
                aid.metrics.yieldPct >= 4
                  ? 'text-green-600'
                  : aid.metrics.yieldPct >= 2
                  ? 'text-amber-600'
                  : 'text-red-500'
              }
            />
          </div>
        </div>

        <div className="min-h-[110px]">
          <div className={`rounded-xl border p-3 w-full min-h-[110px] ${scoreTone.container}`}>
            <div className="flex items-center gap-2">
              <Sparkles size={14} className={scoreTone.icon} />
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                AID Score
              </p>
            </div>

            <div className="mt-3 flex items-end justify-between gap-3 flex-wrap">
              <p className={`text-2xl font-bold whitespace-nowrap ${scoreTone.value}`}>
                {aid.score}/100
              </p>
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${scoreTone.badge}`}
              >
                {aid.label}
              </span>
            </div>

            <p className="text-sm text-gray-600 mt-3">{signalLine}</p>
          </div>
        </div>

        <div className="mt-auto space-y-3">
          <div className="min-h-[70px]">
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5 min-h-[70px]">
              <p className="text-sm text-gray-700">{insightLine}</p>
            </div>
          </div>

          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap self-start ${growthTone}`}
          >
            {hasGrowthSignal
              ? `Growth ${aid.metrics.annualGrowthPct >= 0 ? '+' : ''}${aid.metrics.annualGrowthPct.toFixed(1)}% p.a.`
              : 'Growth data incomplete'}
          </span>
        </div>
      </div>
    </div>
  )
}

function getPropertyFeatures(property) {
  const features = []

  if (property.bedrooms) features.push({ icon: BedDouble, label: `${property.bedrooms} bed` })
  if (property.bathrooms) features.push({ icon: Bath, label: `${property.bathrooms} bath` })
  if (property.garages) features.push({ icon: CarFront, label: `${property.garages} car` })
  if (property.land_size) features.push({ icon: Ruler, label: `${property.land_size} sqm` })

  return features
}

function getScoreTone(label) {
  if (label === 'Strong Hold') {
    return {
      container: 'border-green-100 bg-green-50',
      icon: 'text-green-600',
      value: 'text-green-700',
      badge: 'bg-green-100 text-green-700',
    }
  }

  if (label === 'Hold') {
    return {
      container: 'border-primary-100 bg-primary-50',
      icon: 'text-primary-600',
      value: 'text-primary-700',
      badge: 'bg-primary-100 text-primary-700',
    }
  }

  if (label === 'Optimise' || label === 'Refinance') {
    return {
      container: 'border-amber-100 bg-amber-50',
      icon: 'text-amber-600',
      value: 'text-amber-700',
      badge: 'bg-amber-100 text-amber-700',
    }
  }

  return {
    container: 'border-red-100 bg-red-50',
    icon: 'text-red-500',
    value: 'text-red-600',
    badge: 'bg-red-100 text-red-700',
  }
}

function buildInsightLine(aid) {
  return aid.summary
}

function buildSignalLine(aid) {
  if (aid.reasons?.length) {
    return `${aid.confidenceLabel} confidence • ${aid.reasons[0].title}`
  }

  return `${aid.confidenceLabel} confidence decision signal.`
}
