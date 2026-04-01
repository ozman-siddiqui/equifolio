import { useEffect, useMemo, useState } from 'react'
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
import { supabase } from '../supabase'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))

const formatPercent = (value) => `${Number(value || 0).toFixed(2)}%`

const toFiniteNumber = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

const formatConfidenceLabel = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'high') return 'High'
  if (normalized === 'medium') return 'Medium'
  if (normalized === 'low') return 'Low'
  return 'Low'
}

function getRecommendationTone(type) {
  if (type === 'refinance') {
    return {
      card: 'border-[#b8e8d8] bg-[#E1F5EE]',
      badge: 'rounded-[20px] bg-[#E1F5EE] px-[10px] py-[3px] text-[10px] font-medium text-[#085041]',
      icon: 'text-[#0F6E56]',
    }
  }

  if (type === 'watch') {
    return {
      card: 'border-[#FAEEDA] bg-[#FAEEDA]',
      badge: 'rounded-[20px] bg-[#FAEEDA] px-[10px] py-[3px] text-[10px] font-medium text-[#633806]',
      icon: 'text-[#854F0B]',
    }
  }

  if (type === 'insufficient_data') {
    return {
      card: 'border-[#FCEBEB] bg-[#FCEBEB]',
      badge: 'rounded-[20px] bg-[#FCEBEB] px-[10px] py-[3px] text-[10px] font-medium text-[#791F1F]',
      icon: 'text-[#A32D2D]',
    }
  }

  return {
    card: 'border-gray-200 bg-white',
    badge: 'rounded-[20px] bg-[#ebebeb] px-[10px] py-[3px] text-[10px] font-medium text-[#333]',
    icon: 'text-gray-500',
  }
}

function getConfidenceBadgeClass(label) {
  if (label === 'High') return 'rounded-[20px] bg-[#E1F5EE] px-[10px] py-[3px] text-[10px] font-medium text-[#085041]'
  if (label === 'Medium') return 'rounded-[20px] bg-[#FAEEDA] px-[10px] py-[3px] text-[10px] font-medium text-[#633806]'
  return 'rounded-[20px] bg-[#ebebeb] px-[10px] py-[3px] text-[10px] font-medium text-[#333]'
}

export default function Mortgages({ session = null }) {
  const navigate = useNavigate()
  const { properties, loans, loading, fetchData } = usePortfolioData()
  const handlePortfolioSave = async (options) => fetchData(options)
  const handleLoanSave = async (options) => {
    await fetchData(options)
    await rerunOpportunityDetection()
    await refreshOpportunities()
  }

  const [showAddLoan, setShowAddLoan] = useState(false)
  const [editingLoan, setEditingLoan] = useState(null)
  const [refinancingLoan, setRefinancingLoan] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loanTypeFilter, setLoanTypeFilter] = useState('all')
  const [financialPrompt, setFinancialPrompt] = useState(null)
  const [opportunitiesByLoanId, setOpportunitiesByLoanId] = useState({})
  const [activeOpportunityId, setActiveOpportunityId] = useState(null)
  const [opportunityActionError, setOpportunityActionError] = useState('')

  useEffect(() => {
    let active = true

    const loadFinancialPrompt = async () => {
      try {
        if (!session?.user?.id) {
          if (active) setFinancialPrompt(null)
          return
        }

        const [{ data: profile, error: profileError }, { count, error: liabilitiesError }] =
          await Promise.all([
            supabase
              .from('user_financial_profiles')
              .select('user_id')
              .eq('user_id', session.user.id)
              .maybeSingle(),
            supabase
              .from('liabilities')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', session.user.id),
          ])

        if (profileError || liabilitiesError) {
          throw profileError || liabilitiesError
        }

        if (!active) return

        if (!profile) {
          setFinancialPrompt({
            tone: 'primary',
            message: 'Add your financial profile to unlock more accurate refinance and borrowing insights',
            cta: 'Complete Financials',
          })
          return
        }

        if (!count) {
          setFinancialPrompt({
            tone: 'secondary',
            message: 'Add liabilities to improve serviceability and borrowing accuracy',
            cta: 'Add liabilities',
          })
          return
        }

        setFinancialPrompt(null)
      } catch {
        if (active) setFinancialPrompt(null)
      }
    }

    loadFinancialPrompt()

    return () => {
      active = false
    }
  }, [session])

  useEffect(() => {
    let active = true

    const loadOpportunities = async () => {
      try {
        if (!session?.user?.id) {
          if (active) setOpportunitiesByLoanId({})
          return
        }

        const { data, error } = await supabase
          .from('ai_opportunities')
          .select(
            'id, loan_id, property_id, title, narrative, annual_value_estimate, monthly_value_estimate, break_even_months, priority_score, confidence_level, status, metadata'
          )
          .eq('user_id', session.user.id)
          .eq('opportunity_type', 'refinance')
          .in('status', ['active', 'reviewing'])
          .order('priority_score', { ascending: false })

        if (error) throw error
        if (!active) return

        const nextByLoanId = {}
        for (const row of data || []) {
          const loanId = String(row.loan_id || '')
          if (!loanId || nextByLoanId[loanId]) continue
          nextByLoanId[loanId] = row
        }

        setOpportunitiesByLoanId(nextByLoanId)
      } catch {
        if (active) setOpportunitiesByLoanId({})
      }
    }

    loadOpportunities()

    return () => {
      active = false
    }
  }, [session])

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

  const refreshOpportunities = async () => {
    if (!session?.user?.id) {
      setOpportunitiesByLoanId({})
      return
    }

    const { data, error } = await supabase
      .from('ai_opportunities')
      .select(
        'id, loan_id, property_id, title, narrative, annual_value_estimate, monthly_value_estimate, break_even_months, priority_score, confidence_level, status, metadata'
      )
      .eq('user_id', session.user.id)
      .eq('opportunity_type', 'refinance')
      .in('status', ['active', 'reviewing'])
      .order('priority_score', { ascending: false })

    if (error) throw error

    const nextByLoanId = {}
    for (const row of data || []) {
      const loanId = String(row.loan_id || '')
      if (!loanId || nextByLoanId[loanId]) continue
      nextByLoanId[loanId] = row
    }

    setOpportunitiesByLoanId(nextByLoanId)
  }

  const rerunOpportunityDetection = async () => {
    if (!session?.user?.id) return

    const { error } = await supabase.functions.invoke('detect-opportunities', {
      body: { user_id: session.user.id },
    })

    if (error) throw error
  }

  const recalculateValueTracker = async (actedIncrement = 0) => {
    if (!session?.user?.id) return

    const { data: allRows, error: allRowsError } = await supabase
      .from('ai_opportunities')
      .select('annual_value_estimate, status')
      .eq('user_id', session.user.id)

    if (allRowsError) throw allRowsError

    const cumulativeOpportunityValue = (allRows || [])
      .filter((item) => ['active', 'reviewing', 'acted'].includes(String(item.status)))
      .reduce((sum, item) => sum + Number(item.annual_value_estimate || 0), 0)

    const { data: trackerRow, error: trackerRowError } = await supabase
      .from('ai_value_tracker')
      .select('user_id, acted_value, total_opportunities_detected')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (trackerRowError) throw trackerRowError

    const nextActedValue = Number(trackerRow?.acted_value || 0) + Number(actedIncrement || 0)

    const { error: upsertError } = await supabase.from('ai_value_tracker').upsert(
      {
        user_id: session.user.id,
        cumulative_opportunity_value: cumulativeOpportunityValue,
        acted_value: nextActedValue,
        total_opportunities_detected: Number(trackerRow?.total_opportunities_detected || 0),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (upsertError) throw upsertError
  }

  const handleReviewOpportunity = async (opportunityId) => {
    setActiveOpportunityId(opportunityId)
    setOpportunityActionError('')
    try {
      const { error } = await supabase
        .from('ai_opportunities')
        .update({ status: 'reviewing' })
        .eq('id', opportunityId)

      if (error) throw error
      await refreshOpportunities()
    } catch (error) {
      setOpportunityActionError(error?.message || 'Opportunity status could not be updated.')
    } finally {
      setActiveOpportunityId(null)
    }
  }

  const handleDismissOpportunity = async (opportunity) => {
    setActiveOpportunityId(opportunity.id)
    setOpportunityActionError('')
    try {
      const { error } = await supabase
        .from('ai_opportunities')
        .update({
          status: 'dismissed',
          dismissed_at: new Date().toISOString(),
        })
        .eq('id', opportunity.id)

      if (error) throw error
      await recalculateValueTracker()
      await refreshOpportunities()
    } catch (error) {
      setOpportunityActionError(error?.message || 'Opportunity could not be dismissed.')
    } finally {
      setActiveOpportunityId(null)
    }
  }

  const handleActedOpportunity = async (opportunity, securedRate) => {
    setActiveOpportunityId(opportunity.id)
    setOpportunityActionError('')

    let shouldRollbackOpportunity = false
    try {
      const rawRate = String(securedRate || '').trim()
      const parsedRate = rawRate ? Number(rawRate) : null
      const nextRate =
        parsedRate !== null && Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : null

      if (rawRate && nextRate === null) {
        throw new Error('Please enter a valid secured rate greater than 0, or leave it blank.')
      }

      const { error: updateOpportunityError } = await supabase
        .from('ai_opportunities')
        .update({
          status: 'acted',
          acted_at: new Date().toISOString(),
          new_rate_secured: nextRate,
        })
        .eq('id', opportunity.id)

      if (updateOpportunityError) throw updateOpportunityError
      shouldRollbackOpportunity = nextRate !== null

      if (nextRate !== null) {
        if (!opportunity.loan_id) {
          throw new Error(
            'This opportunity is missing a linked loan and could not update the mortgage rate.'
          )
        }

        const { error: updateLoanError } = await supabase
          .from('loans')
          .update({ interest_rate: nextRate })
          .eq('id', opportunity.loan_id)

        if (updateLoanError) throw updateLoanError
        shouldRollbackOpportunity = false
        await fetchData({ force: true })
      }

      await rerunOpportunityDetection()
      await recalculateValueTracker(Number(opportunity.annual_value_estimate || 0))
      await refreshOpportunities()
      return true
    } catch (error) {
      if (shouldRollbackOpportunity) {
        await supabase
          .from('ai_opportunities')
          .update({
            status: opportunity.status || 'active',
            acted_at: null,
            new_rate_secured: null,
          })
          .eq('id', opportunity.id)
      }

      setOpportunityActionError(error?.message || 'The acted update could not be completed.')
      return false
    } finally {
      setActiveOpportunityId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background-tertiary)] flex items-center justify-center">
        <div className="text-gray-400">Loading mortgages...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-background-tertiary)]">
      <main className="mx-auto max-w-7xl space-y-[22px] px-6 py-6">
        {financialPrompt ? (
          <section
            className={`rounded-2xl border p-5 md:p-6 ${
              financialPrompt.tone === 'primary'
                ? 'border-[#b8e8d8] bg-[#E1F5EE]'
                : 'border-[#FAEEDA] bg-[#FAEEDA]'
            }`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p
                className={`text-sm font-medium ${
                  financialPrompt.tone === 'primary'
                    ? 'text-[#085041]'
                    : 'text-[#854F0B]'
                }`}
              >
                {financialPrompt.message}
              </p>

              <button
                type="button"
                onClick={() => navigate('/financials')}
                className={
                  financialPrompt.tone === 'primary'
                    ? utilityPrimaryButtonClass
                    : utilitySecondaryButtonClass
                }
              >
                {financialPrompt.cta}
              </button>
            </div>
          </section>
        ) : null}

        <section className="overflow-hidden rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)]">
          <div className="border-b-[0.5px] border-[rgba(0,0,0,0.06)] p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="mb-4 inline-flex items-center gap-2 rounded-[20px] bg-[#E1F5EE] px-[10px] py-[3px] text-[10px] font-medium text-[#085041]">
                  <Sparkles size={13} />
                  Refinance Engine v2
                </div>

                <h1 className="text-[28px] font-medium tracking-[-0.3px] text-[var(--color-text-primary)]">Mortgages</h1>

                <p className="mt-2 max-w-3xl text-[13px] font-normal leading-[1.6] text-[var(--color-text-secondary)]">
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
              icon={<CreditCard size={16} className="text-[#0F6E56]" />}
              label="Loans"
              value={overview.loanCount}
              helper="Active debt facilities analysed"
            />
            <TopMetricCard
              icon={<Building2 size={16} className="text-[#854F0B]" />}
              label="Total Debt"
              value={formatCurrency(overview.totalDebt)}
              helper="Combined outstanding balances"
            />
            <TopMetricCard
              icon={<TrendingDown size={16} className="text-[#0F6E56]" />}
              label="Monthly Repayments"
              value={formatCurrency(overview.monthlyRepayments)}
              helper="Current scheduled repayments across loans"
            />
            <TopMetricCard
              icon={<PiggyBank size={16} className="text-[#854F0B]" />}
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
                overview.annualSavings > 0 ? 'text-[#854F0B]' : 'text-gray-900'
              }
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)]">
          <div className="border-b-[0.5px] border-[rgba(0,0,0,0.06)] p-6">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[#0F6E56]" />
              <h2 className="text-[15px] font-medium text-[var(--color-text-primary)]">Portfolio ranking</h2>
            </div>
            <p className="mt-2 text-[13px] font-normal leading-[1.6] text-[var(--color-text-secondary)]">
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

        <section className="overflow-hidden rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)]">
          <div className="grid grid-cols-1 gap-4 border-b-[0.5px] border-[rgba(0,0,0,0.06)] p-6 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
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
              <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
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
                  opportunity={opportunitiesByLoanId[String(analysis.loanId)] || null}
                  activeOpportunityId={activeOpportunityId}
                  actionError={opportunityActionError}
                  isTopOpportunity={String(analysis.loanId) === String(topOpportunityLoanId)}
                  onReviewOpportunity={handleReviewOpportunity}
                  onDismissOpportunity={handleDismissOpportunity}
                  onActedOpportunity={handleActedOpportunity}
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
          onSave={handleLoanSave}
        />
      ) : null}

      {editingLoan ? (
        <EditLoanModal
          loan={editingLoan}
          onClose={() => setEditingLoan(null)}
          onSave={handleLoanSave}
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
  opportunity = null,
  activeOpportunityId = null,
  actionError = '',
  isTopOpportunity = false,
  onReviewOpportunity,
  onDismissOpportunity,
  onActedOpportunity,
  onExploreRefinance,
  onEdit,
  onViewProperty,
}) {
  const opportunityMetadata =
    opportunity?.metadata && typeof opportunity.metadata === 'object' ? opportunity.metadata : {}
  const opportunityMonthlySavings = toFiniteNumber(opportunity?.monthly_value_estimate)
  const opportunityAnnualSavings =
    opportunityMonthlySavings !== null
      ? opportunityMonthlySavings * 12
      : toFiniteNumber(opportunity?.annual_value_estimate)
  const opportunityBreakEvenMonths = toFiniteNumber(opportunity?.break_even_months)
  const opportunityBenchmarkRate = toFiniteNumber(opportunityMetadata?.benchmark_rate)
  const opportunityRateGapPct = toFiniteNumber(opportunityMetadata?.rate_gap_pct)
  const opportunityConfidenceLabel = formatConfidenceLabel(opportunity?.confidence_level)
  const hasLiveOpportunity = Boolean(opportunity)
  const tone = getRecommendationTone(
    hasLiveOpportunity ? 'refinance' : analysis.recommendationType
  )
  const primaryDecisionTitle = hasLiveOpportunity
    ? `Potential refinance value ~${formatCurrency(opportunityAnnualSavings)}/year`
    : analysis.heroText
  const primaryDecisionSummary = hasLiveOpportunity
    ? opportunity?.status === 'reviewing'
      ? 'This refinance opportunity is currently marked for review.'
      : 'This refinance opportunity is active against the stored benchmark comparison.'
    : analysis.refinanceRecommendation
  const primaryDecisionMeta = hasLiveOpportunity
    ? 'Source: active AI opportunity'
    : `${analysis.estimateQualityLabel} | Benchmark: ${
        analysis.benchmarkFallbackUsed ? 'Fallback estimate' : 'Market-sourced'
      }`
  const displayConfidenceLabel = hasLiveOpportunity
    ? opportunityConfidenceLabel
    : analysis.confidenceLabel
  const benchmarkMetricValue = hasLiveOpportunity
    ? opportunityBenchmarkRate !== null
      ? formatPercent(opportunityBenchmarkRate)
      : 'n/a'
    : formatPercent(analysis.targetRate)
  const rateGapMetricValue = hasLiveOpportunity
    ? opportunityRateGapPct !== null
      ? `${Math.round(opportunityRateGapPct * 100)} bps`
      : 'n/a'
    : `${analysis.rateDeltaBps} bps`
  const monthlyMetricValue = hasLiveOpportunity
    ? formatCurrency(opportunityMonthlySavings)
    : formatCurrency(analysis.monthlySavings)
  const breakEvenMetricValue = hasLiveOpportunity
    ? Number.isFinite(opportunityBreakEvenMonths)
      ? `${opportunityBreakEvenMonths} mo`
      : 'n/a'
    : Number.isFinite(analysis.breakEvenMonths)
      ? `${analysis.breakEvenMonths} mo`
      : 'n/a'
  const recommendationBadgeLabel = hasLiveOpportunity
    ? opportunity?.status === 'reviewing'
      ? 'Reviewing opportunity'
      : 'Refinance opportunity'
    : analysis.refinanceRecommendation
  const [showOpportunityDetails, setShowOpportunityDetails] = useState(false)
  const [showActedForm, setShowActedForm] = useState(false)
  const [securedRate, setSecuredRate] = useState('')

  return (
    <article
      className={`flex h-full flex-col rounded-[16px] border border-[rgba(0,0,0,0.08)] px-[22px] py-[18px] transition-[transform,box-shadow,border-color] duration-150 ease-[ease] will-change-transform hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] md:px-[22px] md:py-[18px] ${tone.card}`}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">
              {analysis.lender || 'Unnamed lender'}
            </h2>
            <span className="rounded-[20px] bg-[#ebebeb] px-[10px] py-[3px] text-[10px] font-medium text-[#333]">
              {analysis.fixedVariable || 'Loan'}
            </span>
            <span className={tone.badge}>
              {recommendationBadgeLabel}
            </span>
            {isTopOpportunity ? (
              <span className="rounded-[20px] bg-[#E1F5EE] px-[10px] py-[3px] text-[10px] font-medium text-[#085041]">
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

      <section className="mt-5 rounded-[16px] border border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] px-[22px] py-[18px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Primary decision
            </p>
            <p className="mt-2 text-xl font-bold text-gray-900">
              {primaryDecisionTitle}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              {primaryDecisionSummary}
            </p>
            <p className="mt-2 text-xs text-gray-400">
              {primaryDecisionMeta}
            </p>
          </div>

          <span
            className={getConfidenceBadgeClass(
              displayConfidenceLabel
            )}
          >
            Confidence {displayConfidenceLabel}
          </span>
        </div>
      </section>

      {opportunity ? (
        <section
          className="mt-4 rounded-[16px] border border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] px-[22px] py-[18px]"
          style={{ borderLeftWidth: 3, borderLeftColor: '#f59e0b' }}
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
            Opportunity Detected
          </p>
          <p className="mt-2 text-sm font-semibold text-gray-900">
            {formatCurrency(opportunityMonthlySavings)}/month estimated saving
          </p>

          <button
            type="button"
            onClick={() => setShowOpportunityDetails((current) => !current)}
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary-600 transition-colors hover:text-primary-700"
          >
            {showOpportunityDetails ? 'Hide ↑' : 'View details →'}
          </button>

          {showOpportunityDetails ? (
            <p className="mt-3 text-sm leading-6 text-gray-600">{opportunity.narrative}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onReviewOpportunity?.(opportunity.id)}
              disabled={activeOpportunityId === opportunity.id}
              className={utilitySecondaryButtonClass}
            >
              Reviewing
            </button>
            <button
              type="button"
              onClick={() => setShowActedForm((current) => !current)}
              disabled={activeOpportunityId === opportunity.id}
              className={utilityInlinePrimaryButtonClass}
            >
              I&apos;ve acted on this
            </button>
            <button
              type="button"
              onClick={() => onDismissOpportunity?.(opportunity)}
              disabled={activeOpportunityId === opportunity.id}
              className={utilitySecondaryButtonClass}
            >
              Dismiss
            </button>
          </div>

          {actionError ? (
            <div className="mt-4 rounded-xl border border-[#FCEBEB] bg-[#FCEBEB] px-4 py-3 text-sm text-[#791F1F]">
              {actionError}
            </div>
          ) : null}

          {showActedForm ? (
            <div className="mt-4 rounded-[16px] border border-[rgba(0,0,0,0.08)] bg-gray-50/70 px-[22px] py-[18px]">
              <label className="block text-sm font-medium text-gray-700">
                What rate did you secure? (optional)
              </label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={securedRate}
                  onChange={(event) => setSecuredRate(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-primary-400 sm:max-w-[220px]"
                  placeholder="e.g. 5.89"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const wasSuccessful = await onActedOpportunity?.(opportunity, securedRate)
                    if (!wasSuccessful) return
                    setShowActedForm(false)
                    setSecuredRate('')
                  }}
                  disabled={activeOpportunityId === opportunity.id}
                  className={utilityInlinePrimaryButtonClass}
                >
                  Confirm
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-gray-600 lg:grid-cols-5">
        <InlineMetric label="Current" value={formatPercent(analysis.currentRate)} />
        <InlineMetric label="Benchmark" value={benchmarkMetricValue} />
        <InlineMetric label="Rate gap" value={rateGapMetricValue} />
        <InlineMetric label="Monthly" value={monthlyMetricValue} />
        <InlineMetric label="Break-even" value={breakEvenMetricValue} />
      </div>

      <section className="mt-5 space-y-2">
        {hasLiveOpportunity ? (
          <p className="text-sm text-gray-600">{opportunity.narrative}</p>
        ) : (
          <>
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
          </>
        )}
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
          <span className="inline-flex items-center gap-2 rounded-[20px] bg-[#FAEEDA] px-[10px] py-[3px] text-[10px] font-medium text-[#633806]">
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
    <div className="min-w-0 rounded-[16px] border border-[rgba(0,0,0,0.08)] bg-gray-50/70 px-[22px] py-[18px]">
      <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-1 truncate text-[13px] font-normal leading-[1.6] text-[var(--color-text-primary)]">{value}</p>
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
    <div className="rounded-[16px] border border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] px-[22px] py-[18px]">
      <div className="flex items-center gap-2 text-gray-500">
        {icon}
        <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">{label}</p>
      </div>
      <p className={`mt-3 whitespace-nowrap text-[26px] font-medium tracking-[-0.5px] ${valueClassName}`}>
        {value}
      </p>
      <p className="mt-2 text-[11px] leading-[1.5] text-[var(--color-text-tertiary)]">{helper}</p>
    </div>
  )
}
