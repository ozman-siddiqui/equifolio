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

  if (normalized === 'high') return 'bg-green-100 text-green-700'
  if (normalized === 'medium') return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-700'
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
  const { refreshData } = usePortfolioData()
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
      <section className="mt-6 overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="border-b border-gray-100 p-6">
          <div className="h-5 w-36 animate-pulse rounded bg-gray-100" />
          <div className="mt-3 h-8 w-2/3 animate-pulse rounded bg-gray-100" />
          <div className="mt-3 h-4 w-full animate-pulse rounded bg-gray-100" />
        </div>
        <div className="p-6">
          <div className="h-40 animate-pulse rounded-2xl bg-gray-50" />
        </div>
      </section>
    )
  }

  if (shouldRenderNull) return null

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-gray-100 bg-white">
      <div className="border-b border-gray-100 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
              <Brain size={13} />
              AI Opportunity Engine
            </div>
            {showValueStrip ? (
              <>
                <h2 className="mt-4 text-lg md:text-xl font-semibold text-gray-900">
                  Vaulta has identified {formatCurrency(cumulativeValue)} in potential portfolio
                  improvements
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {totalDetected} opportunities detected since you joined
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-4 text-lg md:text-xl font-semibold text-gray-900">
                  Refinance opportunities
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Indicative benchmark checks across your recorded mortgages.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        {incompleteLoans.length > 0 ? (
          <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
            <p className="text-sm text-amber-900">
              Some mortgage details are incomplete. Complete your loan information to unlock
              refinance opportunity detection.
            </p>
            <button
              type="button"
              onClick={() => navigate('/mortgages')}
              className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Update mortgages
              <ArrowRight size={15} />
            </button>
          </div>
        ) : null}

        {showNoOpportunities ? (
          <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-5">
            <p className="text-base font-semibold text-gray-900">
              No significant refinance opportunities detected at this time.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              We check your loans against current market benchmarks automatically.
            </p>

            {cumulativeValue > 0 ? (
              <div className="mt-3 rounded-[10px] border border-emerald-100 bg-[#f4faf7] px-[14px] py-[10px]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Total value identified since joining
                </p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {formatCurrency(cumulativeValue)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {totalDetected} opportunities detected since you joined
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            {actionError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {actionError}
              </div>
            ) : null}

            {topOpportunities.map((opportunity) => (
              <article
                key={opportunity.id}
                className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm shadow-gray-100/70"
                style={{ borderLeftWidth: 3, borderLeftColor: '#f59e0b' }}
              >
                {(() => {
                  const monthlySaving = toFiniteNumber(opportunity.monthly_value_estimate)
                  const annualSaving =
                    monthlySaving !== null
                      ? monthlySaving * 12
                      : Number(opportunity.annual_value_estimate || 0)

                  return (
                    <>
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-gray-400">
                            Refinance Opportunity
                          </p>
                          <h3 className="mt-3 text-base font-semibold text-gray-900">
                            {opportunity.propertyAddress}
                          </h3>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getConfidenceBadgeClass(
                            opportunity.confidence_level
                          )}`}
                        >
                          {String(opportunity.confidence_level || 'low').replace(/^./, (value) =>
                            value.toUpperCase()
                          )}
                        </span>
                      </div>

                      <p className="mt-4 text-sm leading-6 text-gray-600">
                        {opportunity.narrative}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <div className="inline-flex rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-800">
                          {formatCurrency(monthlySaving)}/mo
                        </div>
                        <div className="inline-flex rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-800">
                          {formatCurrency(annualSaving)}/yr
                        </div>
                      </div>

                      <p className="mt-3 text-sm text-gray-500">
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
                  <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                    <label className="block text-sm font-medium text-gray-700">
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
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-primary-400 sm:max-w-[220px]"
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

        <p className="mt-5 text-xs leading-5 text-gray-400">
          These figures are illustrative estimates based on your inputs and indicative market
          benchmarks. They do not constitute financial advice. Actual savings will vary based on
          individual circumstances and lender assessment. Consider discussing options with a
          licensed mortgage broker or credit adviser.
        </p>
      </div>
    </section>
  )
}
