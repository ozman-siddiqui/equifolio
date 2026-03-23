import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  CreditCard,
  PiggyBank,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingDown,
} from 'lucide-react'

import AddLoanModal from '../components/AddLoanModal'
import EditLoanModal from '../components/EditLoanModal'
import RefinanceModal from '../components/RefinanceModal'
import {
  MetricTile,
  utilityInlinePrimaryButtonClass,
  utilityPrimaryButtonClass,
  utilitySecondaryButtonClass,
} from '../components/CardPrimitives'
import usePortfolioData from '../hooks/usePortfolioData'

const TERM_MONTHS = 30 * 12

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0)

const formatPercent = (value) => `${Number(value || 0).toFixed(2)}%`

const calcPIRepayment = (principal, annualRate, months = TERM_MONTHS) => {
  const safePrincipal = Number(principal || 0)
  if (!safePrincipal || !months) return 0
  if (annualRate === 0) return safePrincipal / months

  const monthlyRate = annualRate / 100 / 12
  return (
    (safePrincipal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1)
  )
}

const calcIORepayment = (principal, annualRate) => {
  const safePrincipal = Number(principal || 0)
  if (!safePrincipal) return 0
  return (safePrincipal * (annualRate / 100)) / 12
}

const getDaysUntil = (dateStr) => {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
}

const getOpportunityTone = (saving, lvr, daysUntilExpiry) => {
  if (saving >= 250 || (daysUntilExpiry && daysUntilExpiry > 0 && daysUntilExpiry <= 60)) {
    return 'high'
  }
  if (saving >= 100 || lvr >= 80) return 'medium'
  return 'stable'
}

const getTargetRate = (currentRate, loanType, daysUntilExpiry) => {
  const rate = Number(currentRate || 0)

  if (loanType === 'Fixed' && daysUntilExpiry && daysUntilExpiry > 0 && daysUntilExpiry <= 120) {
    return Math.max(5.35, rate - 0.6)
  }

  if (rate >= 6.6) return Math.max(5.45, rate - 0.75)
  if (rate >= 6.2) return Math.max(5.45, rate - 0.5)
  if (rate >= 5.9) return Math.max(5.45, rate - 0.3)
  return rate
}

function buildLoanInsights({
  loan,
  property,
  currentRate,
  currentMonthly,
  lvr,
  estimatedMonthlySaving,
  targetRate,
  daysUntilExpiry,
}) {
  const insights = []

  if (currentRate >= 6.2) {
    insights.push({
      title: 'You may be overpaying interest',
      description: `${loan.lender || 'This lender'} is currently charging ${formatPercent(
        currentRate
      )}. A market check could improve monthly cash flow.`,
      tone: 'warning',
    })
  }

  if (estimatedMonthlySaving >= 120) {
    insights.push({
      title: 'Refinance opportunity detected',
      description: `Refinancing toward ${formatPercent(
        targetRate
      )} could reduce repayments by about ${formatCurrency(estimatedMonthlySaving)}/month.`,
      tone: 'positive',
    })
  }

  if (lvr >= 80) {
    insights.push({
      title: 'Leverage risk is elevated',
      description: `${property?.address || 'This property'} is sitting at ${lvr.toFixed(
        1
      )}% LVR, which may restrict lender options.`,
      tone: 'warning',
    })
  }

  if (loan.loan_type === 'Fixed' && daysUntilExpiry && daysUntilExpiry > 0 && daysUntilExpiry <= 120) {
    insights.push({
      title: 'Fixed-rate review window is open',
      description: `The fixed period ends in ${daysUntilExpiry} days. Reviewing options before rollover can reduce repayment shock.`,
      tone: 'warning',
    })
  }

  if (insights.length === 0) {
    insights.push({
      title: 'Loan looks broadly stable',
      description: `Repayments are tracking at ${formatCurrency(
        currentMonthly
      )}/month with no immediate refinance trigger standing out.`,
      tone: 'neutral',
    })
  }

  return insights.slice(0, 2)
}

export default function Mortgages({ session = null }) {
  const navigate = useNavigate()
  const { properties, loans, loading, fetchData } = usePortfolioData()

  const [showAddLoan, setShowAddLoan] = useState(false)
  const [editingLoan, setEditingLoan] = useState(null)
  const [refinancingLoan, setRefinancingLoan] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loanTypeFilter, setLoanTypeFilter] = useState('all')

  const propertyMap = useMemo(
    () => Object.fromEntries(properties.map((property) => [String(property.id), property])),
    [properties]
  )

  const enrichedLoans = useMemo(() => {
    return loans.map((loan) => {
      const property = propertyMap[String(loan.property_id)] || null
      const balance = Number(loan.current_balance || loan.loan_amount || 0)
      const rate = Number(loan.interest_rate || 0)
      const propertyValue = Number(property?.current_value || 0)
      const lvr = propertyValue > 0 ? (balance / propertyValue) * 100 : 0
      const daysUntilExpiry = getDaysUntil(loan.fixed_rate_expiry)
      const repayment =
        Number(loan.monthly_repayment || 0) > 0
          ? Number(loan.monthly_repayment || 0)
          : loan.repayment_type === 'Interest Only'
          ? calcIORepayment(balance, rate)
          : calcPIRepayment(balance, rate)

      const targetRate = getTargetRate(rate, loan.loan_type, daysUntilExpiry)
      const refinanceRepayment =
        loan.repayment_type === 'Interest Only'
          ? calcIORepayment(balance, targetRate)
          : calcPIRepayment(balance, targetRate)
      const estimatedMonthlySaving = Math.max(0, repayment - refinanceRepayment)
      const tone = getOpportunityTone(estimatedMonthlySaving, lvr, daysUntilExpiry)
      const insights = buildLoanInsights({
        loan,
        property,
        currentRate: rate,
        currentMonthly: repayment,
        lvr,
        estimatedMonthlySaving,
        targetRate,
        daysUntilExpiry,
      })

      return {
        loan,
        property,
        balance,
        rate,
        repayment,
        lvr,
        daysUntilExpiry,
        targetRate,
        estimatedMonthlySaving,
        insights,
        tone,
      }
    })
  }, [loans, propertyMap])

  const filteredLoans = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return enrichedLoans.filter((entry) => {
      const matchesSearch =
        query === '' ||
        [
          entry.loan.lender,
          entry.property?.address,
          entry.property?.suburb,
          entry.property?.state,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))

      const matchesType =
        loanTypeFilter === 'all' || String(entry.loan.loan_type) === loanTypeFilter

      return matchesSearch && matchesType
    })
  }, [enrichedLoans, loanTypeFilter, searchTerm])

  const overview = useMemo(() => {
    const totalDebt = enrichedLoans.reduce((sum, entry) => sum + entry.balance, 0)
    const monthlyRepayments = enrichedLoans.reduce((sum, entry) => sum + entry.repayment, 0)
    const opportunities = enrichedLoans.filter(
      (entry) => entry.estimatedMonthlySaving >= 120 || entry.tone !== 'stable'
    ).length
    const estimatedSavings = enrichedLoans.reduce(
      (sum, entry) => sum + entry.estimatedMonthlySaving,
      0
    )

    return {
      count: enrichedLoans.length,
      totalDebt,
      monthlyRepayments,
      opportunities,
      estimatedSavings,
    }
  }, [enrichedLoans])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading mortgages...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-6 md:p-8 border-b border-gray-100">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 text-xs font-medium text-primary-700 bg-primary-50 px-3 py-1 rounded-full mb-4">
                  <Sparkles size={13} />
                  Mortgage Optimisation Hub
                </div>

                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                  Mortgages
                </h1>

                <p className="text-gray-500 mt-2 max-w-2xl">
                  Review debt structure, surface refinance opportunities, and focus on the loans most likely to improve portfolio cash flow.
                </p>
              </div>

              <div className="shrink-0 flex items-start">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 p-6 md:p-8 bg-gray-50/70">
            <TopMetricCard
              icon={<CreditCard size={16} className="text-primary-600" />}
              label="Loans"
              value={overview.count}
              helper="Active debt facilities tracked"
            />
            <TopMetricCard
              icon={<Building2 size={16} className="text-orange-600" />}
              label="Total Debt"
              value={formatCurrency(overview.totalDebt)}
              helper="Combined current loan balances"
            />
            <TopMetricCard
              icon={<TrendingDown size={16} className="text-green-600" />}
              label="Monthly Repayments"
              value={formatCurrency(overview.monthlyRepayments)}
              helper="Current aggregate repayment load"
            />
            <TopMetricCard
              icon={<PiggyBank size={16} className="text-amber-600" />}
              label="Refinance Signals"
              value={`${overview.opportunities} / ${overview.count || 0}`}
              helper={
                overview.estimatedSavings > 0
                  ? `${formatCurrency(overview.estimatedSavings)}/month potential`
                  : 'No immediate savings signal'
              }
              valueClassName={overview.opportunities > 0 ? 'text-amber-700' : 'text-gray-900'}
            />
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8">
              <label className="block text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="lg:col-span-4">
              <label className="block text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
                Loan Type
              </label>
              <select
                value={loanTypeFilter}
                onChange={(event) => setLoanTypeFilter(event.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All loan types</option>
                <option value="Fixed">Fixed</option>
                <option value="Variable">Variable</option>
                <option value="Split">Split</option>
              </select>
            </div>
          </div>

          {filteredLoans.length === 0 ? (
            <div className="p-12 text-center">
              <CreditCard className="mx-auto text-gray-300 mb-3" size={28} />
              <h2 className="text-lg font-semibold text-gray-900">No mortgages found</h2>
              <p className="text-sm text-gray-500 mt-2">
                Add a loan or adjust your filters to see optimisation opportunities.
              </p>
            </div>
          ) : (
            <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-5">
              {filteredLoans.map((entry) => (
                <MortgageOpportunityCard
                  key={entry.loan.id}
                  entry={entry}
                  onExploreRefinance={() =>
                    setRefinancingLoan({ loan: entry.loan, property: entry.property })
                  }
                  onEdit={() => setEditingLoan(entry.loan)}
                  onViewProperty={() =>
                    entry.property?.id ? navigate(`/property/${entry.property.id}`) : null
                  }
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {showAddLoan && (
        <AddLoanModal
          userId={session?.user?.id}
          properties={properties}
          onClose={() => setShowAddLoan(false)}
          onSave={fetchData}
        />
      )}

      {editingLoan && (
        <EditLoanModal
          loan={editingLoan}
          onClose={() => setEditingLoan(null)}
          onSave={fetchData}
        />
      )}

      {refinancingLoan && (
        <RefinanceModal
          loan={refinancingLoan.loan}
          property={refinancingLoan.property}
          onClose={() => setRefinancingLoan(null)}
        />
      )}
    </div>
  )
}

function MortgageOpportunityCard({ entry, onExploreRefinance, onEdit, onViewProperty }) {
  const {
    loan,
    property,
    balance,
    rate,
    repayment,
    lvr,
    estimatedMonthlySaving,
    targetRate,
    insights,
    tone,
    daysUntilExpiry,
  } = entry

  const toneClass =
    tone === 'high'
      ? 'border-amber-200 bg-amber-50/40'
      : tone === 'medium'
      ? 'border-gray-200 bg-gray-50/60'
      : 'border-gray-100 bg-white'

  const badgeClass =
    tone === 'high'
      ? 'bg-amber-100 text-amber-700'
      : tone === 'medium'
      ? 'bg-primary-50 text-primary-700'
      : 'bg-gray-100 text-gray-600'

  return (
    <article className={`rounded-2xl border p-5 md:p-6 shadow-sm h-full flex flex-col ${toneClass}`}>
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-4 items-start">
        <div className="min-w-0 space-y-2 min-h-[4.75rem]">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-900">
              {loan.lender || 'Unnamed lender'}
            </h2>
            <span className="text-xs px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-600">
              {loan.loan_type || 'Loan'}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badgeClass}`}>
              {tone === 'high'
                ? 'High priority'
                : tone === 'medium'
                ? 'Worth reviewing'
                : 'Stable'}
            </span>
          </div>

          <p className="text-sm text-gray-500 min-h-[2.5rem]">
            {property?.address || 'Unknown property'}
            {property?.suburb ? ` | ${property.suburb}, ${property.state}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end sm:self-start">
          {property?.id ? (
            <button
              type="button"
              onClick={onViewProperty}
              className={utilitySecondaryButtonClass}
            >
              View property
            </button>
          ) : null}

          <button
            type="button"
            onClick={onEdit}
            className={utilitySecondaryButtonClass}
          >
            Edit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
        <MetricTile label="Balance" value={formatCurrency(balance)} />
        <MetricTile label="Rate" value={formatPercent(rate)} />
        <MetricTile label="Repayment" value={formatCurrency(repayment)} />
        <MetricTile
          label="LVR"
          value={`${lvr.toFixed(1)}%`}
          valueClassName={
            lvr >= 80 ? 'text-red-500' : lvr >= 70 ? 'text-amber-600' : 'text-green-600'
          }
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 content-start min-h-[8.5rem]">
        {insights.map((insight) => (
          <InsightPanel key={insight.title} insight={insight} />
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-4 md:p-5">
        <div className="flex flex-col gap-4 min-w-0">
          <p className="text-xs uppercase tracking-wide text-gray-400">
            Estimated savings if refinanced
          </p>
          {estimatedMonthlySaving > 0 ? (
            <>
              <p className="text-base font-semibold text-gray-900">
                Refinancing from {formatPercent(rate)} to {formatPercent(targetRate)} could save{' '}
                <span className="text-green-600 whitespace-nowrap">
                  {formatCurrency(estimatedMonthlySaving)}/month
                </span>
              </p>
              <p className="text-sm text-gray-500">
                This is an estimate based on the current balance and repayment type already stored in the app.
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-semibold text-gray-900">
                No meaningful refinance saving detected right now
              </p>
              <p className="text-sm text-gray-500">
                Keep monitoring lender pricing and review again when market rates or your fixed term changes.
              </p>
            </>
          )}

          <div className="pt-2">
            <button
              type="button"
              onClick={onExploreRefinance}
              className={utilityInlinePrimaryButtonClass}
            >
              <span className="whitespace-nowrap">Explore refinance</span>
              <ArrowRight size={14} className="shrink-0" />
            </button>
          </div>
        </div>
      </div>

      {loan.loan_type === 'Fixed' && daysUntilExpiry && daysUntilExpiry > 0 && daysUntilExpiry <= 120 ? (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700">
          <CalendarClock size={13} />
          Fixed rate expires in {daysUntilExpiry} days
        </div>
      ) : null}
    </article>
  )
}

function InsightPanel({ insight }) {
  const toneClass =
    insight.tone === 'positive'
      ? 'bg-green-50 border-green-100 text-green-700'
      : insight.tone === 'warning'
      ? 'bg-amber-50 border-amber-100 text-amber-700'
      : 'bg-gray-50 border-gray-100 text-gray-700'

  const Icon =
    insight.tone === 'positive'
      ? PiggyBank
      : insight.tone === 'warning'
      ? AlertTriangle
      : ShieldAlert

  return (
    <div className={`rounded-2xl border p-4 min-h-[92px] ${toneClass}`}>
      <div className="flex items-start gap-3">
        <Icon size={16} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{insight.title}</p>
          <p className="text-sm mt-1">{insight.description}</p>
        </div>
      </div>
    </div>
  )
}

function TopMetricCard({ icon, label, value, helper, valueClassName = 'text-gray-900' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 text-gray-500">
        {icon}
        <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-2xl md:text-3xl font-bold mt-3 whitespace-nowrap ${valueClassName}`}>
        {value}
      </p>
      <p className="text-sm text-gray-400 mt-2">{helper}</p>
    </div>
  )
}
