import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Brain } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import usePortfolioData from '../../hooks/usePortfolioData'
import { supabase } from '../../supabase'
import {
  utilityInlinePrimaryButtonClass,
  utilityPrimaryButtonClass,
  utilitySecondaryButtonClass,
} from '../CardPrimitives'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))

const toFiniteNumber = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function formatRate(value) {
  if (value === '' || value === null || value === undefined) return ''
  return String(value)
}

function formatBreakEven(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return 'Not available'
  return `${Math.round(numeric * 10) / 10} months`
}

function getConfidenceBadgeClass(confidenceLevel) {
  const normalized = String(confidenceLevel || '').toLowerCase()

  if (normalized === 'high') return 'bg-[#E1F5EE] text-[#085041]'
  if (normalized === 'medium') return 'bg-[#FAEEDA] text-[#633806]'
  return 'bg-[#ebebeb] text-[#333333]'
}

function patchNarrativeLenderName(narrative, lender) {
  if (!narrative) return narrative

  const safeLender = String(lender || '').trim() || 'Harbourline Bank'

  return String(narrative)
    .replace(
      /\b(?:Westpac|ANZ|NAB|Commonwealth Bank|CBA|Macquarie|Suncorp|St George|Bankwest)\b/gi,
      safeLender
    )
    .replace(
      new RegExp(`This\\s+${safeLender.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+[^.]*?opportunity shows`, 'i'),
      `This ${safeLender} refinance scenario shows`
    )
    .replace(
      /could potentially save approximately (\$[\d,]+)\s+monthly/gi,
      'indicates an estimated repayment difference of about $1 per month'
    )
    .replace(
      /(\$[\d,]+)\s+monthly/gi,
      '$1 per month'
    )
    .replace(
      /(\$[\d,]+)\/month/gi,
      '$1 per month'
    )
}

async function fetchOpportunityRows(userId) {
  const { data, error } = await supabase
    .from('ai_opportunities')
    .select(
      'id, loan_id, property_id, title, narrative, annual_value_estimate, monthly_value_estimate, break_even_months, priority_score, confidence_level, status'
    )
    .eq('user_id', userId)
    .in('status', ['active', 'reviewing'])
    .order('priority_score', { ascending: false })
    .order('detected_at', { ascending: false })

  if (error) throw error

  const propertyIds = [...new Set((data || []).map((item) => item.property_id).filter(Boolean))]
  if (!propertyIds.length) return data || []

  const { data: properties, error: propertiesError } = await supabase
    .from('properties')
    .select('id, address')
    .in('id', propertyIds)

  if (propertiesError) throw propertiesError

  const propertyMap = Object.fromEntries((properties || []).map((item) => [String(item.id), item]))

  return (data || []).map((item) => ({
    ...item,
    propertyAddress: propertyMap[String(item.property_id)]?.address || 'Unknown property',
  }))
}

async function fetchTracker(userId) {
  const { data, error } = await supabase
    .from('ai_value_tracker')
    .select(
      'user_id, cumulative_opportunity_value, acted_value, total_opportunities_detected, updated_at'
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

async function refreshTrackerForUser(userId, actedIncrement = 0) {
  const { data: allRows, error: allRowsError } = await supabase
    .from('ai_opportunities')
    .select('annual_value_estimate, status')
    .eq('user_id', userId)

  if (allRowsError) throw allRowsError

  const cumulativeOpportunityValue = (allRows || [])
    .filter((item) => ['active', 'reviewing', 'acted'].includes(String(item.status)))
    .reduce((sum, item) => sum + Number(item.annual_value_estimate || 0), 0)

  const { data: trackerRow, error: trackerRowError } = await supabase
    .from('ai_value_tracker')
    .select('user_id, acted_value, total_opportunities_detected')
    .eq('user_id', userId)
    .maybeSingle()

  if (trackerRowError) throw trackerRowError

  const nextActedValue = Number(trackerRow?.acted_value || 0) + Number(actedIncrement || 0)

  const { error: upsertError } = await supabase.from('ai_value_tracker').upsert(
    {
      user_id: userId,
      cumulative_opportunity_value: cumulativeOpportunityValue,
      acted_value: nextActedValue,
      total_opportunities_detected: Number(trackerRow?.total_opportunities_detected || 0),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  if (upsertError) throw upsertError
}

export default function AIOpportunityCard({ currentUserId, loans = [] }) {
  const navigate = useNavigate()
  const portfolioSession = useMemo(
    () => (currentUserId ? { user: { id: currentUserId } } : null),
    [currentUserId]
  )
  const { refreshData } = usePortfolioData(portfolioSession)
  const [loading, setLoading] = useState(true)
  const [opportunities, setOpportunities] = useState([])
  const [tracker, setTracker] = useState(null)
  const [incompleteLoans, setIncompleteLoans] = useState([])
  const [activeActionId, setActiveActionId] = useState(null)
  const [actedFormId, setActedFormId] = useState(null)
  const [securedRates, setSecuredRates] = useState({})
  const [actionError, setActionError] = useState('')

  const hasLoans = Array.isArray(loans) && loans.length > 0

  const loadData = useCallback(
    async () => {
      if (!currentUserId || !hasLoans) {
        setOpportunities([])
        setTracker(null)
        setIncompleteLoans([])
        setLoading(false)
        return
      }

      setLoading(true)
      setActionError('')

      try {
        const { data: detectResponse, error: detectError } = await supabase.functions.invoke(
          'detect-opportunities',
          {
            body: { user_id: currentUserId },
          }
        )

        if (detectError) throw detectError

        const fetchedIncompleteLoans = Array.isArray(detectResponse?.incomplete_loans)
          ? detectResponse.incomplete_loans
          : []

        const nextOpportunities = await fetchOpportunityRows(currentUserId)
        const nextTracker = await fetchTracker(currentUserId)

        setOpportunities(nextOpportunities)
        setTracker(nextTracker)
        setIncompleteLoans(fetchedIncompleteLoans)
      } catch {
        setOpportunities([])
        setTracker(null)
        setIncompleteLoans([])
      } finally {
        setLoading(false)
      }
    },
    [currentUserId, hasLoans]
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  const qualifyingOpportunities = useMemo(
    () =>
      opportunities.filter((opportunity) =>
        ['active', 'reviewing', 'acted'].includes(String(opportunity?.status || '').toLowerCase())
      ),
    [opportunities]
  )
  const topOpportunities = useMemo(() => qualifyingOpportunities.slice(0, 2), [qualifyingOpportunities])
  const cumulativeValue = Number(tracker?.cumulative_opportunity_value || 0)
  const totalDetected = Number(tracker?.total_opportunities_detected || 0)

  const showValueStrip = cumulativeValue > 0 && qualifyingOpportunities.length > 0
  const showNoOpportunities = !loading && hasLoans && qualifyingOpportunities.length === 0
  const shouldRenderNull =
    (!hasLoans && !loading) ||
    (!loading && opportunities.length === 0 && !tracker && !hasLoans)

  const refreshVisibleState = async () => {
    const [nextOpportunities, nextTracker] = await Promise.all([
      fetchOpportunityRows(currentUserId),
      fetchTracker(currentUserId),
    ])
    setOpportunities(nextOpportunities)
    setTracker(nextTracker)
  }

  const rerunOpportunityDetection = async () => {
    const { error } = await supabase.functions.invoke('detect-opportunities', {
      body: { user_id: currentUserId },
    })

    if (error) throw error
  }

  const handleReviewing = async (opportunityId) => {
    setActiveActionId(opportunityId)
    setActionError('')
    try {
      const { error } = await supabase
        .from('ai_opportunities')
        .update({ status: 'reviewing' })
        .eq('id', opportunityId)

      if (error) throw error
      await refreshVisibleState()
    } catch (error) {
      setActionError(error?.message || 'Opportunity status could not be updated.')
    } finally {
      setActiveActionId(null)
    }
  }

  const handleDismiss = async (opportunity) => {
    setActiveActionId(opportunity.id)
    setActionError('')
    try {
      const { error } = await supabase
        .from('ai_opportunities')
        .update({
          status: 'dismissed',
          dismissed_at: new Date().toISOString(),
        })
        .eq('id', opportunity.id)

      if (error) throw error
      await refreshTrackerForUser(currentUserId)
      await refreshVisibleState()
    } catch (error) {
      setActionError(error?.message || 'Opportunity could not be dismissed.')
    } finally {
      setActiveActionId(null)
    }
  }

  const handleConfirmActed = async (opportunity) => {
    setActiveActionId(opportunity.id)
    setActionError('')

    let shouldRollbackOpportunity = false
    try {
      const rawRate = String(securedRates[opportunity.id] || '').trim()
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
        await refreshData()
      }

      await rerunOpportunityDetection()
      await refreshTrackerForUser(currentUserId, Number(opportunity.annual_value_estimate || 0))
      setActedFormId(null)
      setSecuredRates((current) => {
        const next = { ...current }
        delete next[opportunity.id]
        return next
      })
      await refreshVisibleState()
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

      setActionError(error?.message || 'The acted update could not be completed.')
      return false
    } finally {
      setActiveActionId(null)
    }
  }

  if (loading) {
    return (
      <section className="h-full overflow-hidden rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
        <div className="border-b border-[rgba(0,0,0,0.08)] px-[22px] py-[18px]">
          <div className="h-5 w-36 animate-pulse rounded bg-gray-100" />
          <div className="mt-3 h-8 w-2/3 animate-pulse rounded bg-gray-100" />
          <div className="mt-3 h-4 w-full animate-pulse rounded bg-gray-100" />
        </div>
        <div className="px-[22px] py-[18px]">
          <div className="h-40 animate-pulse rounded-[16px] bg-[var(--color-background-secondary)]" />
        </div>
      </section>
    )
  }

  if (shouldRenderNull) return null

  return (
    <section className="h-full overflow-hidden rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <div className="border-b border-[rgba(0,0,0,0.08)] px-[22px] py-[18px]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#E1F5EE] px-[10px] py-[3px] text-[10px] font-medium text-[#085041]">
                <Brain size={13} />
                AI Opportunity Engine
              </div>
              {cumulativeValue > 0 ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-background-secondary)] px-[10px] py-[3px] text-[10px] font-medium text-[var(--color-text-primary)]">
                  <span className="text-[var(--color-text-tertiary)]">Total value identified</span>
                  <span>{formatCurrency(cumulativeValue)}</span>
                </div>
              ) : null}
            </div>
            {showValueStrip ? (
              <>
                <h2 className="mt-4 text-[15px] font-medium text-[var(--color-text-primary)]">
                  Nextiq has identified up to {formatCurrency(cumulativeValue)} in potential
                  repayment savings
                </h2>
                <p className="mt-2 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
                  {totalDetected} opportunities detected since you joined
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-4 text-[15px] font-medium text-[var(--color-text-primary)]">
                  Refinance opportunities
                </h2>
                <p className="mt-2 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
                  Indicative benchmark checks across your recorded mortgages.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-[22px] py-[18px]">
        {incompleteLoans.length > 0 ? (
          <div className="mb-4 rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[#FAEEDA] p-4">
            <p className="text-[13px] leading-[1.6] text-[#633806]">
              Some mortgage details are incomplete. Complete your loan information to unlock
              refinance opportunity detection.
            </p>
            <button
              type="button"
              onClick={() => navigate('/mortgages')}
              className="mt-3 inline-flex items-center gap-2 text-[13px] font-medium text-primary-600 hover:text-primary-700"
            >
              Update mortgages
              <ArrowRight size={15} />
            </button>
          </div>
        ) : null}

        {showNoOpportunities ? (
          <div className="rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-secondary)] p-[18px]">
            <p className="text-[15px] font-medium text-[var(--color-text-primary)]">
              No significant refinance opportunities detected at this time.
            </p>
            <p className="mt-2 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
              We check your loans against current market benchmarks automatically.
            </p>

            <div className="mt-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
                What we monitor
              </p>
              <div className="mt-2">
                <div className="flex items-center justify-between gap-4 border-b-[0.5px] border-[rgba(0,0,0,0.06)] py-[6px] text-[12px]">
                  <span className="text-[var(--color-text-primary)]">Refinance opportunities</span>
                  <span className="text-[var(--color-text-secondary)]">Checked automatically</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b-[0.5px] border-[rgba(0,0,0,0.06)] py-[6px] text-[12px]">
                  <span className="text-[var(--color-text-primary)]">Interest rate benchmarks</span>
                  <span className="text-[var(--color-text-secondary)]">Updated regularly</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b-[0.5px] border-[rgba(0,0,0,0.06)] py-[6px] text-[12px]">
                  <span className="text-[var(--color-text-primary)]">Portfolio health alerts</span>
                  <span className="text-[var(--color-text-secondary)]">Active monitoring</span>
                </div>
              </div>
            </div>

            {(cumulativeValue > 0 || totalDetected > 0) ? (
              <div className="mt-[10px] border-t-[0.5px] border-[rgba(0,0,0,0.06)] pt-[10px]">
                <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
                  Value summary
                </p>
                {cumulativeValue > 0 ? (
                  <p className="mt-1 text-[15px] font-medium text-[var(--color-text-primary)]">
                    {formatCurrency(cumulativeValue)} identified so far
                  </p>
                ) : null}
                {totalDetected > 0 ? (
                  <p className="mt-1 text-[11px] leading-[1.5] text-[var(--color-text-tertiary)]">
                    {totalDetected} opportunities detected since you joined
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            {actionError ? (
              <div className="rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[#FCEBEB] px-4 py-3 text-[13px] text-[#791F1F]">
                {actionError}
              </div>
            ) : null}

            {topOpportunities.map((opportunity) => (
              <article
                key={opportunity.id}
                className="rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] p-[18px] shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
                style={{ borderLeftWidth: 3, borderLeftColor: '#f59e0b' }}
              >
                {(() => {
                  const monthlySaving = toFiniteNumber(opportunity.monthly_value_estimate)
                  const annualSaving =
                    monthlySaving !== null
                      ? monthlySaving * 12
                      : Number(opportunity.annual_value_estimate || 0)
                  const liveLenderName =
                    loans.find((loan) => String(loan?.id) === String(opportunity.loan_id))?.lender ||
                    'Harbourline Bank'
                  const safeOpportunityNarrative = patchNarrativeLenderName(
                    opportunity.narrative,
                    liveLenderName
                  )

                  return (
                    <>
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
                            Refinance scenario
                          </p>
                          <h3 className="mt-3 text-[15px] font-medium text-[var(--color-text-primary)]">
                            {opportunity.propertyAddress}
                          </h3>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-[10px] py-[3px] text-[10px] font-medium ${getConfidenceBadgeClass(
                            opportunity.confidence_level
                          )}`}
                        >
                          {String(opportunity.confidence_level || 'low').replace(/^./, (value) =>
                            value.toUpperCase()
                          )}
                        </span>
                      </div>

                      <p className="mt-4 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
                        {safeOpportunityNarrative}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <div className="inline-flex rounded-full bg-[var(--color-background-secondary)] px-[10px] py-[3px] text-[10px] font-medium text-[var(--color-text-primary)]">
                          {formatCurrency(monthlySaving)}/mo
                        </div>
                        <div className="inline-flex rounded-full bg-[var(--color-background-secondary)] px-[10px] py-[3px] text-[10px] font-medium text-[var(--color-text-primary)]">
                          {formatCurrency(annualSaving)}/yr
                        </div>
                      </div>

                      <p className="mt-3 text-[11px] leading-[1.5] text-[var(--color-text-tertiary)]">
                        Estimated break-even: {formatBreakEven(opportunity.break_even_months)}
                      </p>
                    </>
                  )
                })()}

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleReviewing(opportunity.id)}
                    disabled={activeActionId === opportunity.id}
                    className={utilitySecondaryButtonClass}
                  >
                    Reviewing
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActedFormId((current) => (current === opportunity.id ? null : opportunity.id))
                    }
                    disabled={activeActionId === opportunity.id}
                    className={utilityPrimaryButtonClass}
                  >
                    I&apos;ve acted on this
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDismiss(opportunity)}
                    disabled={activeActionId === opportunity.id}
                    className={utilitySecondaryButtonClass}
                  >
                    Dismiss
                  </button>
                </div>

                {actedFormId === opportunity.id ? (
                  <div className="mt-4 rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-secondary)] p-4">
                    <label className="block text-[13px] font-medium text-[var(--color-text-primary)]">
                      What rate did you secure? (optional)
                    </label>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={formatRate(securedRates[opportunity.id] || '')}
                        onChange={(event) =>
                          setSecuredRates((current) => ({
                            ...current,
                            [opportunity.id]: event.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[13px] text-gray-900 outline-none transition focus:border-primary-400 sm:max-w-[220px]"
                        placeholder="e.g. 5.89"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const wasSuccessful = await handleConfirmActed(opportunity)
                          if (!wasSuccessful) return
                        }}
                        disabled={activeActionId === opportunity.id}
                        className={utilityInlinePrimaryButtonClass}
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}

        <p className="mt-4 text-[11px] leading-[1.5] text-[var(--color-text-tertiary)]">
          These figures are illustrative estimates based on your inputs and indicative market
          benchmarks. They do not constitute financial advice. Actual savings will vary based on
          individual circumstances and lender assessment. Consider discussing options with a
          licensed mortgage broker or credit adviser.
        </p>
      </div>
    </section>
  )
}
