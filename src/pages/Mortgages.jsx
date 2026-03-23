import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CreditCard,
  PiggyBank,
  Plus,
  Search,
  Sparkles,
  TrendingDown,
} from 'lucide-react'

import AddLoanModal from '../components/AddLoanModal'
import EditLoanModal from '../components/EditLoanModal'
import RefinanceModal from '../components/RefinanceModal'
import {
  utilityInlinePrimaryButtonClass,
  utilityPrimaryButtonClass,
  utilitySecondaryButtonClass,
} from '../components/CardPrimitives'
import usePortfolioData from '../hooks/usePortfolioData'
import { buildPortfolioRefinanceRanking } from '../lib/refinanceEngine'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))

const formatPercent = (value) => `${Number(value || 0).toFixed(2)}%`

function getRecommendationTone(type) {
  if (type === 'refinance') {
    return {
      card: 'border-green-200 bg-green-50/40',
      badge: 'bg-green-100 text-green-700',
      icon: 'text-green-600',
    }
  }

  if (type === 'watch') {
    return {
      card: 'border-amber-200 bg-amber-50/40',
      badge: 'bg-amber-100 text-amber-700',
      icon: 'text-amber-600',
    }
  }

  if (type === 'insufficient_data') {
    return {
      card: 'border-red-200 bg-red-50/40',
      badge: 'bg-red-100 text-red-700',
      icon: 'text-red-600',
    }
  }

  return {
    card: 'border-gray-200 bg-white',
    badge: 'bg-gray-100 text-gray-600',
    icon: 'text-gray-500',
  }
}

function getConfidenceBadgeClass(label) {
  if (label === 'High') return 'bg-green-100 text-green-700'
  if (label === 'Medium') return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-600'
}

export default function Mortgages({ session = null }) {
  const navigate = useNavigate()
  const { properties, loans, loading, fetchData } = usePortfolioData()

  const [showAddLoan, setShowAddLoan] = useState(false)
  const [editingLoan, setEditingLoan] = useState(null)
  const [refinancingLoan, setRefinancingLoan] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loanTypeFilter, setLoanTypeFilter] = useState('all')

  const refinanceAnalyses = useMemo(
    () => buildPortfolioRefinanceRanking(loans, properties),
    [loans, properties]
  )

  const filteredAnalyses = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return refinanceAnalyses.filter((analysis) => {
      const matchesSearch =
        query === '' ||
        [analysis.lender, analysis.propertyAddress]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))

      const matchesType =
        loanTypeFilter === 'all' || String(analysis.fixedVariable) === loanTypeFilter

      return matchesSearch && matchesType
    })
  }, [loanTypeFilter, refinanceAnalyses, searchTerm])

  const overview = useMemo(() => {
    const totalDebt = refinanceAnalyses.reduce((sum, analysis) => sum + analysis.balance, 0)
    const monthlyRepayments = refinanceAnalyses.reduce(
      (sum, analysis) => sum + analysis.currentRepayment,
      0
    )
    const positiveSavingsCount = refinanceAnalyses.filter(
      (analysis) => analysis.annualSavings > 0
    ).length
    const annualSavings = refinanceAnalyses.reduce(
      (sum, analysis) => sum + Math.max(0, Number(analysis.annualSavings || 0)),
      0
    )
    const hasLowConfidenceSavings = refinanceAnalyses.some(
      (analysis) => analysis.annualSavings > 0 && analysis.confidenceLabel === 'Low'
    )

    return {
      loanCount: refinanceAnalyses.length,
      totalDebt,
      monthlyRepayments,
      positiveSavingsCount,
      annualSavings,
      hasLowConfidenceSavings,
    }
  }, [refinanceAnalyses])

  const topRanking = useMemo(
    () =>
      refinanceAnalyses
        .filter((analysis) => analysis.recommendationType !== 'insufficient_data')
        .slice(0, 3),
    [refinanceAnalyses]
  )

  const topOpportunityLoanId = useMemo(() => {
    const top = refinanceAnalyses.find(
      (analysis) => analysis.recommendationType === 'refinance' && analysis.annualSavings > 0
    )
    return top?.loanId ?? null
  }, [refinanceAnalyses])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading mortgages...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <div className="border-b border-gray-100 p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
                  <Sparkles size={13} />
                  Refinance Engine v2
                </div>

                <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Mortgages</h1>

                <p className="mt-2 max-w-3xl text-gray-500">
                  Quantify real refinance impact across the portfolio, rank the best opportunities,
                  and highlight where more data is needed before switching.
                </p>
              </div>

              <div className="flex shrink-0 items-start">
                <button
                  type="button"
                  onClick={() => setShowAddLoan(true)}
                  className={utilityPrimaryButtonClass}
                >
                  <Plus size={15} className="shrink-0" />
                  <span className="whitespace-nowrap">Add Mortgage</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 bg-gray-50/70 p-6 md:grid-cols-2 xl:grid-cols-4 md:p-8">
            <TopMetricCard
              icon={<CreditCard size={16} className="text-primary-600" />}
              label="Loans"
              value={overview.loanCount}
              helper="Active debt facilities analysed"
            />
            <TopMetricCard
              icon={<Building2 size={16} className="text-orange-600" />}
              label="Total Debt"
              value={formatCurrency(overview.totalDebt)}
              helper="Combined outstanding balances"
            />
            <TopMetricCard
              icon={<TrendingDown size={16} className="text-green-600" />}
              label="Monthly Repayments"
              value={formatCurrency(overview.monthlyRepayments)}
              helper="Current scheduled repayments across loans"
            />
            <TopMetricCard
              icon={<PiggyBank size={16} className="text-amber-600" />}
              label="Potential Annual Savings"
              value={formatCurrency(overview.annualSavings)}
              helper={
                overview.annualSavings > 0
                  ? overview.hasLowConfidenceSavings
                    ? `Estimated / Low confidence across ${overview.positiveSavingsCount} loan${
                        overview.positiveSavingsCount !== 1 ? 's' : ''
                      }`
                    : `${overview.positiveSavingsCount} loan${
                        overview.positiveSavingsCount !== 1 ? 's' : ''
                      } with positive refinance savings`
                  : 'No positive refinance savings detected'
              }
              valueClassName={
                overview.annualSavings > 0 ? 'text-amber-700' : 'text-gray-900'
              }
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <div className="border-b border-gray-100 p-6">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary-600" />
              <h2 className="text-base font-semibold text-gray-900">Portfolio ranking</h2>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Loans are ranked by recommendation strength, savings impact, confidence, and break-even speed.
            </p>
          </div>

          <div className="divide-y divide-gray-100">
            {topRanking.length > 0 ? (
              topRanking.map((analysis, index) => (
                <RankingRow key={analysis.loanId || `${analysis.propertyId}-${index}`} analysis={analysis} rank={index + 1} />
              ))
            ) : (
              <div className="p-6 text-sm text-gray-500">
                Add loan details to generate refinance ranking across the portfolio.
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <div className="grid grid-cols-1 gap-4 border-b border-gray-100 p-6 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
                Search
              </label>
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search lender or property"
                  className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="lg:col-span-4">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
                Loan Type
              </label>
              <select
                value={loanTypeFilter}
                onChange={(event) => setLoanTypeFilter(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All loan types</option>
                <option value="Variable">Variable</option>
                <option value="Fixed">Fixed</option>
                <option value="Split">Split</option>
              </select>
            </div>
          </div>

          {filteredAnalyses.length === 0 ? (
            <div className="p-12 text-center">
              <CreditCard className="mx-auto mb-3 text-gray-300" size={28} />
              <h2 className="text-lg font-semibold text-gray-900">No mortgages found</h2>
              <p className="mt-2 text-sm text-gray-500">
                Add a loan or adjust your filters to surface refinance analysis.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 p-6 xl:grid-cols-2">
              {filteredAnalyses.map((analysis) => (
                <MortgageAnalysisCard
                  key={analysis.loanId || `${analysis.propertyId}-${analysis.lender}`}
                  analysis={analysis}
                  isTopOpportunity={String(analysis.loanId) === String(topOpportunityLoanId)}
                  onExploreRefinance={() => {
                    const loan = loans.find((item) => String(item.id) === String(analysis.loanId))
                    const property = properties.find(
                      (item) => String(item.id) === String(analysis.propertyId)
                    )
                    if (loan) {
                      setRefinancingLoan({ loan, property: property || null })
                    }
                  }}
                  onEdit={() => {
                    const loan = loans.find((item) => String(item.id) === String(analysis.loanId))
                    if (loan) setEditingLoan(loan)
                  }}
                  onViewProperty={() =>
                    analysis.propertyId ? navigate(`/property/${analysis.propertyId}`) : null
                  }
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {showAddLoan ? (
        <AddLoanModal
          userId={session?.user?.id}
          properties={properties}
          onClose={() => setShowAddLoan(false)}
          onSave={fetchData}
        />
      ) : null}

      {editingLoan ? (
        <EditLoanModal
          loan={editingLoan}
          onClose={() => setEditingLoan(null)}
          onSave={fetchData}
        />
      ) : null}

      {refinancingLoan ? (
        <RefinanceModal
          loan={refinancingLoan.loan}
          property={refinancingLoan.property}
          onClose={() => setRefinancingLoan(null)}
        />
      ) : null}
    </div>
  )
}

function MortgageAnalysisCard({
  analysis,
  isTopOpportunity = false,
  onExploreRefinance,
  onEdit,
  onViewProperty,
}) {
  const tone = getRecommendationTone(analysis.recommendationType)

  return (
    <article
      className={`flex h-full flex-col rounded-2xl border p-5 shadow-sm md:p-6 ${tone.card}`}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">
              {analysis.lender || 'Unnamed lender'}
            </h2>
            <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600">
              {analysis.fixedVariable || 'Loan'}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone.badge}`}>
              {analysis.refinanceRecommendation}
            </span>
            {isTopOpportunity ? (
              <span className="rounded-full bg-primary-100 px-2.5 py-1 text-xs font-medium text-primary-700">
                Top opportunity
              </span>
            ) : null}
          </div>

          <p className="text-sm text-gray-500">
            {analysis.propertyAddress}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          {analysis.propertyId ? (
            <button type="button" onClick={onViewProperty} className={utilitySecondaryButtonClass}>
              View property
            </button>
          ) : null}

          <button type="button" onClick={onEdit} className={utilitySecondaryButtonClass}>
            Edit
          </button>
        </div>
      </div>

      <section className="mt-5 rounded-2xl border border-gray-100 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Primary decision
            </p>
            <p className="mt-2 text-xl font-bold text-gray-900">
              {analysis.heroText}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              {analysis.refinanceRecommendation}
            </p>
            <p className="mt-2 text-xs text-gray-400">
              {analysis.estimateQualityLabel} | Benchmark:{' '}
              {analysis.benchmarkFallbackUsed ? 'Fallback estimate' : 'Market-sourced'}
            </p>
          </div>

          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${getConfidenceBadgeClass(
              analysis.confidenceLabel
            )}`}
          >
            Confidence {analysis.confidenceLabel}
          </span>
        </div>
      </section>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-gray-600 lg:grid-cols-5">
        <InlineMetric label="Current" value={formatPercent(analysis.currentRate)} />
        <InlineMetric label="Benchmark" value={formatPercent(analysis.targetRate)} />
        <InlineMetric label="Rate gap" value={`${analysis.rateDeltaBps} bps`} />
        <InlineMetric label="Monthly" value={formatCurrency(analysis.monthlySavings)} />
        <InlineMetric
          label="Break-even"
          value={
            Number.isFinite(analysis.breakEvenMonths)
              ? `${analysis.breakEvenMonths} mo`
              : 'n/a'
          }
        />
      </div>

      <section className="mt-5 space-y-2">
        <p className="text-sm text-gray-600">{analysis.reasons[0] || analysis.summary}</p>
        <p className="text-sm text-gray-500">
          Annual interest ~{formatCurrency(analysis.annualInterestPaid)} | Avoidable interest ~
          {formatCurrency(analysis.avoidableInterest)}/year
        </p>
        {analysis.confidenceDrivers?.length > 0 ? (
          <p className="text-xs text-gray-400">
            Confidence drivers: {analysis.confidenceDrivers.join(' | ')}
          </p>
        ) : null}
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onExploreRefinance}
          className={utilityInlinePrimaryButtonClass}
        >
          <span className="whitespace-nowrap">Explore refinance</span>
          <ArrowRight size={14} className="shrink-0" />
        </button>

        {Number.isFinite(analysis.daysUntilFixedExpiry) &&
        analysis.daysUntilFixedExpiry > 0 &&
        analysis.daysUntilFixedExpiry <= 120 ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700">
            <CalendarClock size={13} />
            Fixed rate expires in {analysis.daysUntilFixedExpiry} days
          </span>
        ) : null}
      </div>
    </article>
  )
}

function InlineMetric({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 truncate font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function RankingRow({ analysis, rank }) {
  const tone = getRecommendationTone(analysis.recommendationType)

  return (
    <div className="flex flex-col gap-3 p-6 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-gray-900">{rank}.</span>
          <p className="truncate text-sm font-semibold text-gray-900">{analysis.propertyAddress}</p>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone.badge}`}>
            {analysis.refinanceRecommendation}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {analysis.lender} | {formatPercent(analysis.currentRate)} now vs{' '}
          {formatPercent(analysis.targetRate)}{' '}
          {analysis.benchmarkFallbackUsed ? 'fallback benchmark' : 'market benchmark'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="font-semibold text-gray-900">
          Save {formatCurrency(analysis.annualSavings)}/year
        </span>
        <span className="text-gray-500">
          Break-even{' '}
          {Number.isFinite(analysis.breakEvenMonths)
            ? `${analysis.breakEvenMonths} months`
            : 'n/a'}
        </span>
      </div>
    </div>
  )
}

function TopMetricCard({ icon, label, value, helper, valueClassName = 'text-gray-900' }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <div className="flex items-center gap-2 text-gray-500">
        {icon}
        <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className={`mt-3 whitespace-nowrap text-2xl font-bold md:text-3xl ${valueClassName}`}>
        {value}
      </p>
      <p className="mt-2 text-sm text-gray-400">{helper}</p>
    </div>
  )
}
