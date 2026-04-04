import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

import ActionCard from '../components/dashboard/ActionCard'
import MetricRow from '../components/dashboard/MetricRow'
import SectionCard from '../components/dashboard/SectionCard'
import useFinancialData from '../hooks/useFinancialData'
import usePortfolioData from '../hooks/usePortfolioData'
import calculateBorrowingPower from '../lib/borrowingPowerEngine'
import { supabase } from '../supabase'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))

function formatMaybeCurrency(value, suffix = '') {
  if (!Number.isFinite(Number(value))) return '—'
  return `${formatCurrency(value)}${suffix}`
}

function formatMaybePercent(value) {
  if (!Number.isFinite(Number(value))) return '—'
  return `${Number(value).toFixed(1)}%`
}

function formatMaybeRatio(value) {
  if (!Number.isFinite(Number(value))) return '—'
  return `${Number(value).toFixed(2)}x`
}

function estimateUnlockPotential(actions) {
  return actions.reduce(
    (max, action) => Math.max(max, Number(action?.borrowingUplift || 0)),
    0
  )
}

function getActionRoute(action) {
  if (action.type === 'data') return '/financials'
  if (action.type === 'surplus') return '/cashflow'
  return '/mortgages'
}

export default function BorrowingPowerExplained() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const { loans, transactions } = usePortfolioData(session)
  const { financialProfile, liabilities } = useFinancialData()

  useEffect(() => {
    let active = true

    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        if (active) setSession(currentSession || null)
      })
      .catch(() => {
        if (active) setSession(null)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession || null)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const analysis = useMemo(
    () =>
      calculateBorrowingPower({
        financialProfile,
        liabilities,
        loans,
        transactions,
      }),
    [financialProfile, liabilities, loans, transactions]
  )

  const inputs = analysis.inputs || {}
  const assumptions = analysis.assumptions || analysis.assumptions_detail || {}
  const derived = analysis.derived || {}
  const constraints = analysis.constraints || []
  const actions = analysis.actions || []
  const unlockPotential = estimateUnlockPotential(actions)

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl px-4 py-8">
        <SectionCard
          eyebrow="Borrowing Power"
          title="Borrowing Power Explained"
          description="See how Equifolio translated your recorded income, living costs, liabilities, and mortgage commitments into a lender-style borrowing view."
        >
          <p className="mb-4 text-xs text-gray-500">
            Borrowing capacity estimates may differ from lender assessments.
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <SummaryMetric
              label="Current capacity"
              value={formatMaybeCurrency(analysis.borrowing_power_estimate)}
            />
            <SummaryMetric
              label="Unlock potential"
              value={unlockPotential > 0 ? formatCurrency(unlockPotential) : '—'}
            />
            <SummaryMetric
              label="Actual monthly surplus"
              value={formatMaybeCurrency(analysis.actual_monthly_surplus, '/month')}
            />
            <SummaryMetric
              label="Serviceability surplus"
              value={formatMaybeCurrency(analysis.net_monthly_surplus, '/month')}
            />
          </div>
        </SectionCard>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionCard
            eyebrow="Income"
            title="Income"
            description="Actual recorded income and the assessed income figure lenders use after applying shading."
          >
            <div className="space-y-3">
              <MetricRow
                label="Base income"
                value={formatMaybeCurrency(inputs.household_income_annual, '/year')}
                helper="Employment, partner, and other income before lender-style shading."
              />
              <MetricRow
                label="Other income"
                value={formatMaybeCurrency(inputs.other_income_annual, '/year')}
                helper="Non-salary income currently included in the financial profile."
              />
              <MetricRow
                label="Rental income"
                value={formatMaybeCurrency(inputs.rental_income_from_tracked_properties_monthly, '/month')}
                helper="Tracked property income before the lender-style rental shading factor is applied."
              />
              <MetricRow
                label="Assessed income"
                value={formatMaybeCurrency(derived.adjusted_income_monthly, '/month')}
                helper="Income is shaded down to reflect tax and conservative lender servicing treatment."
                emphasis
              />
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Living Costs"
            title="Living costs and liabilities"
            description="Your recorded living costs and liabilities, alongside the assessed commitments lenders use in serviceability."
          >
            <div className="space-y-3">
              <MetricRow
                label="Actual living expenses"
                value={formatMaybeCurrency(analysis.user_living_expenses, '/month')}
                helper="Your recorded non-debt living costs."
              />
              <MetricRow
                label="Lender benchmark"
                value={formatMaybeCurrency(analysis.benchmark_expenses, '/month')}
                helper={
                  inputs.borrower_count != null && inputs.dependants != null
                    ? `A lender-style minimum living-cost benchmark for ${inputs.borrower_count} borrower${inputs.borrower_count === 1 ? '' : 's'} and ${inputs.dependants} dependant${inputs.dependants === 1 ? '' : 's'}.`
                    : 'A lender-style minimum living-cost benchmark based on household size and dependants.'
                }
              />
              <MetricRow
                label="Assessed living expenses"
                value={formatMaybeCurrency(analysis.assessed_living_expenses, '/month')}
                helper="The borrowing engine uses the higher of your recorded living expenses or the lender benchmark."
              />
              <MetricRow
                label="Credit cards (assessed)"
                value={formatMaybeCurrency(analysis.estimated_credit_card_commitments_monthly, '/month')}
                helper="Unused limits still count. Lenders treat cards as about 3% of the limit when servicing debt."
              />
              <MetricRow
                label="Other liabilities (actual)"
                value={formatMaybeCurrency(analysis.personal_liability_repayments_monthly, '/month')}
                helper="Personal loan, car loan, and other recorded liability repayments in your actual monthly position."
              />
              <MetricRow
                label="Total liabilities used in serviceability"
                value={formatMaybeCurrency(analysis.total_monthly_liability_repayments, '/month')}
                helper="This is the lender-view liability figure used in serviceability after credit-card assessment logic."
              />
            </div>
          </SectionCard>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionCard
            eyebrow="Mortgage Commitments"
            title="Mortgage commitments"
            description="Existing mortgages are assessed at a lender-buffered servicing rate, not just at your current product repayments."
          >
            <div className="space-y-3">
              <MetricRow
                label="Actual repayments"
                value={formatMaybeCurrency(derived.actual_mortgage_repayments_monthly, '/month')}
                helper="These are the mortgage repayments currently recorded against the portfolio."
              />
              <MetricRow
                label="Assessed repayments"
                value={formatMaybeCurrency(derived.assessed_mortgage_commitments_monthly, '/month')}
                helper="Banks assess debt at a higher buffered repayment to test resilience under stress."
              />
              <MetricRow
                label="Mortgage commitments used"
                value={formatMaybeCurrency(derived.mortgage_commitments_used_monthly, '/month')}
                helper="This is the monthly mortgage commitment actually fed into serviceability."
              />
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Lender View"
            title="Serviceability result"
            description="This is the lender-assessed view, not your real cash-in-bank position."
          >
            <div className="space-y-3">
              <MetricRow
                label="Actual monthly surplus"
                value={formatMaybeCurrency(analysis.actual_monthly_surplus, '/month')}
                helper="Your real monthly position using actual income, recorded living costs, actual liabilities, and current mortgage repayments."
              />
              <MetricRow
                label="Serviceability surplus"
                value={formatMaybeCurrency(derived.net_monthly_surplus, '/month')}
                helper="Surplus after lender-style income shading, assessment buffers, and assessed commitments."
                emphasis
              />
              <MetricRow
                label="Current borrowing capacity"
                value={formatMaybeCurrency(derived.borrowing_power_estimate)}
                helper="The amount of additional debt the current surplus can support under the assessment rate."
              />
              <MetricRow
                label="Unlock potential"
                value={unlockPotential > 0 ? formatCurrency(unlockPotential) : '—'}
                helper="Potential uplift from the strongest currently identified borrowing improvement action."
              />
              <MetricRow
                label="DTI ratio"
                value={formatMaybeRatio(derived.dti_ratio)}
                helper="Debt-to-income shows how much total debt is already being carried relative to annual gross income."
              />
              <MetricRow
                label="Assessment rate"
                value={formatMaybePercent(assumptions.assessment_rate_pct)}
                helper="Banks add a servicing buffer above the current rate to avoid overstating borrowing power."
              />
              <MetricRow
                label="Credit card factor"
                value={
                  assumptions.credit_card_commitment_rate
                    ? `${Math.round(Number(assumptions.credit_card_commitment_rate) * 100)}% of limit`
                    : '—'
                }
                helper="Even unused limits are treated as recurring commitments by lenders."
              />
            </div>
          </SectionCard>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr,1.05fr]">
          <SectionCard
            eyebrow="Constraints"
            title="What is constraining you"
            description="The largest factors currently reducing borrowing capacity or lender confidence."
          >
            <div className="space-y-3">
              {constraints.length > 0 ? (
                constraints.map((constraint, index) => (
                  <MetricRow
                    key={constraint.title}
                    label={`#${index + 1} ${constraint.title}`}
                    value={
                      constraint.borrowingImpact > 0
                        ? formatCurrency(constraint.borrowingImpact)
                        : 'Qualitative'
                    }
                    helper={constraint.description}
                  />
                ))
              ) : (
                <EmptyMessage text="No material borrowing constraints are currently standing out from the recorded data." />
              )}
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Actions"
            title="What to do next"
            description="The next actions most likely to improve borrowing power, serviceability, or lender confidence."
          >
            <div className="grid grid-cols-1 gap-4">
              {actions.length > 0 ? (
                actions.map((action, index) => (
                  <ActionCard
                    key={action.label}
                    rank={index + 1}
                    title={action.label}
                    impact={
                      action.borrowingUplift > 0
                        ? `+${formatCurrency(action.borrowingUplift)}`
                        : action.impact
                    }
                    explanation={action.impact}
                    featured={index === 0}
                    onExplore={() => navigate(getActionRoute(action))}
                  />
                ))
              ) : (
                <EmptyMessage text="No clear borrowing-improvement actions are currently being suggested from the recorded data." />
              )}
            </div>
          </SectionCard>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => navigate('/growth-scenarios')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
          >
            View full growth scenarios
            <ArrowRight size={15} />
          </button>
        </div>
      </main>
    </div>
  )
}

function SummaryMetric({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function EmptyMessage({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-5 text-sm text-gray-500">
      {text}
    </div>
  )
}
