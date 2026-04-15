import { ArrowRight, TrendingUp } from 'lucide-react'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))

export default function BorrowingPowerCard({
  analysis,
  title = 'Borrowing Power Unlock',
  onExplore,
  onCompleteFinancials,
  loading = false,
}) {
  if (loading) {
    return (
      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="border-b border-gray-100 p-6">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
        </div>
        <div className="p-6 text-sm text-gray-500">Loading borrowing power...</div>
      </section>
    )
  }

  if (!analysis || analysis.error || analysis.status === 'error') {
    return (
      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="border-b border-gray-100 p-6">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Borrowing power is temporarily unavailable for the current mortgage set.
          </p>
        </div>

        <div className="space-y-5 p-6">
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
              Review required
            </p>
            <p className="mt-2 text-lg font-semibold text-gray-900">
              Review mortgage details to restore borrowing power insights
            </p>
            <p className="mt-2 text-sm text-gray-600">
              One or more mortgage inputs could not be assessed safely.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              Missing inputs: {(analysis?.missing_inputs || analysis?.missingInputs || []).join(', ')}
            </p>

            <button
              type="button"
              onClick={onExplore}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              <span className="whitespace-nowrap">Review Mortgages</span>
              <ArrowRight size={14} className="shrink-0" />
            </button>
          </div>
        </div>
      </section>
    )
  }

  if (analysis.isBlocked) {
    return (
      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="border-b border-gray-100 p-6">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Add your financial layer before Nextiq estimates borrowing capacity.
          </p>
        </div>

        <div className="space-y-5 p-6">
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
              Action required
            </p>
            <p className="mt-2 text-lg font-semibold text-gray-900">
              Add your financial profile to calculate borrowing power
            </p>
            <p className="mt-2 text-sm text-gray-600">
              Add your financial profile before Nextiq estimates borrowing capacity.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              Missing inputs: {(analysis.missing_inputs || analysis.missingInputs || []).join(', ')}
            </p>

            <button
              type="button"
              onClick={onCompleteFinancials || onExplore}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              <span className="whitespace-nowrap">Complete Financials</span>
              <ArrowRight size={14} className="shrink-0" />
            </button>
          </div>
        </div>
      </section>
    )
  }

  if (analysis.status === 'partial') {
    return (
      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="border-b border-gray-100 p-6">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Conservative estimate based on partial Financials data.
          </p>
        </div>

        <div className="space-y-5 p-6">
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
              Partial data
            </p>
            <p className="mt-2 text-lg font-semibold text-gray-900">
              Add liabilities for a more accurate borrowing power estimate
            </p>
            <p className="mt-2 text-sm text-gray-600">
              Current estimate: {formatCurrency(analysis.borrowing_power_estimate)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
            <InlineMetric
              label="Serviceability surplus"
              value={formatCurrency(analysis.net_monthly_surplus)}
            />
            <InlineMetric
              label="Serviceability"
              value={formatStatusLabel(analysis.serviceability_status)}
            />
          </div>

          <CalculationBreakdown analysis={analysis} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              Missing inputs: {(analysis.missing_inputs || analysis.missingInputs || []).join(', ')}
            </p>

            <button
              type="button"
              onClick={onCompleteFinancials || onExplore}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              <span className="whitespace-nowrap">Add liabilities</span>
              <ArrowRight size={14} className="shrink-0" />
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
      <div className="border-b border-gray-100 p-6">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Clear borrowing uplift opportunities based on the current lender-view serviceability result.
        </p>
      </div>

      <div className="space-y-5 p-6">
        <div className="rounded-2xl border border-primary-100 bg-primary-50/70 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-primary-700">
            Borrowing power estimate
          </p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {formatCurrency(analysis.borrowing_power_estimate)}
          </p>
          <p className="mt-2 text-sm text-gray-600">
            Conservative estimate using your financial profile and liabilities.
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Borrowing capacity estimates may differ from lender assessments.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
          <InlineMetric
            label="Actual monthly surplus"
            value={formatMaybeCurrency(analysis.actual_monthly_surplus)}
          />
          <InlineMetric
            label="Serviceability surplus"
            value={formatCurrency(analysis.net_monthly_surplus)}
          />
          <InlineMetric
            label="DTI ratio"
            value={
              Number.isFinite(analysis.debt_to_income_ratio)
                ? `${Number(analysis.debt_to_income_ratio).toFixed(2)}x`
                : 'n/a'
            }
          />
          <InlineMetric
            label="Serviceability"
            value={formatStatusLabel(analysis.serviceability_status)}
          />
          <InlineMetric label="Liability repayments" value={formatCurrency(analysis.total_monthly_liability_repayments)} />
        </div>

        <CalculationBreakdown analysis={analysis} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500">
            Confidence {analysis.confidenceLabel} ({analysis.confidenceScore}/100)
          </p>

          <button
            type="button"
            onClick={onExplore}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
          >
            <span className="whitespace-nowrap">Explore borrowing strategy</span>
            <ArrowRight size={14} className="shrink-0" />
          </button>
        </div>
      </div>
    </section>
  )
}

function CalculationBreakdown({ analysis }) {
  const inputs = analysis.inputs || {}
  const derived = analysis.derived || {}
  const assumptions = analysis.assumptions || analysis.assumptions_detail || {}

  return (
    <details className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
      <summary className="cursor-pointer list-none text-sm font-semibold text-gray-900">
        How this was calculated
      </summary>

      <div className="mt-4 space-y-4 text-sm">
        <div className="rounded-xl border border-gray-100 bg-white px-3 py-3">
          <p className="text-xs leading-relaxed text-gray-600">
            Rental income is assessed at 75% of gross rent to account for vacancy,
            property costs, and lender buffers.
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white px-3 py-3">
          <p className="text-xs leading-relaxed text-gray-600">
            Serviceability surplus is a lender-view figure, not a real cash-in-bank number.
            It uses shaded income, assessed commitments, and lender buffers.
          </p>
        </div>

        <BreakdownSection
          title="Inputs"
          rows={[
            ['Salary', formatMaybeCurrency(inputs.salary_annual, '/year')],
            ['Partner income', formatMaybeCurrency(inputs.partner_income_annual, '/year')],
            ['Other income', formatMaybeCurrency(inputs.other_income_annual, '/year')],
            ['Borrowers', formatMaybeNumber(inputs.borrower_count)],
            ['Dependants', formatMaybeNumber(inputs.dependants)],
            ['Living expenses (user)', formatMaybeCurrency(inputs.user_living_expenses_monthly, '/month')],
            ['Liability repayments (actual)', formatMaybeCurrency(inputs.personal_liability_repayments_monthly, '/month')],
            ['Credit card limits', formatMaybeCurrency(inputs.credit_card_limits_total)],
            ['Rental income from tracked properties (actual)', formatMaybeCurrency(inputs.rental_income_from_tracked_properties_monthly, '/month')],
            ['Mortgage repayments from tracked loans (actual)', formatMaybeCurrency(inputs.actual_mortgage_repayments_from_tracked_loans_monthly, '/month')],
          ]}
        />

        <BreakdownSection
          title="Assumptions"
          rows={[
            ['Income shading', formatPercent(assumptions.income_shading_factor)],
            ['Rental shading', formatPercent(assumptions.rental_shading_factor)],
            ['Card commitment rate', formatPercent(assumptions.credit_card_commitment_rate)],
            ['Assessment rate', formatPercentFromNumber(assumptions.assessment_rate_pct)],
            ['Benchmark expenses', formatBenchmarkRule(assumptions.benchmark_expense_rule)],
            ['Mortgage commitment basis', formatMaybeText(assumptions.mortgage_commitment_basis_used)],
          ]}
        />
        {Array.isArray(assumptions.notes) && assumptions.notes.length > 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Assumption notes
            </p>
            <div className="mt-2 space-y-1.5">
              {assumptions.notes.map((note) => (
                <p key={note} className="text-xs leading-relaxed text-gray-600">
                  {note}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        <BreakdownSection
          title="Derived"
          rows={[
            ['Assessed income', formatMaybeCurrency(derived.adjusted_income_monthly, '/month')],
            ['Rental income (used after shading)', formatMaybeCurrency(derived.usable_rental_income_monthly, '/month')],
            ['Credit card commitment (estimated)', formatMaybeCurrency(derived.estimated_card_commitment_monthly, '/month')],
            ['Mortgage repayments (actual)', formatMaybeCurrency(derived.actual_mortgage_repayments_monthly, '/month')],
            ['Mortgage commitments (assessed)', formatMaybeCurrency(derived.assessed_mortgage_commitments_monthly, '/month')],
            ['Mortgage commitments used', formatMaybeCurrency(derived.mortgage_commitments_used_monthly, '/month')],
            ['Actual monthly surplus', formatMaybeCurrency(derived.actual_monthly_surplus, '/month')],
            ['Total usable income', formatMaybeCurrency(derived.total_usable_income_monthly, '/month')],
            ['Total outgoings', formatMaybeCurrency(derived.total_monthly_outgoings, '/month')],
            ['Serviceability surplus', formatMaybeCurrency(derived.net_monthly_surplus, '/month')],
            ['Borrowing power estimate', formatMaybeCurrency(derived.borrowing_power_estimate)],
            ['Total debt for DTI', formatMaybeCurrency(derived.total_debt_for_dti)],
            ['Gross annual income', formatMaybeCurrency(derived.gross_annual_income, '/year')],
            ['DTI ratio', formatMaybeRatio(derived.dti_ratio)],
          ]}
        />
      </div>
    </details>
  )
}

function BreakdownSection({ title, rows }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</p>
      <div className="mt-2 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4">
            <span className="text-gray-500">{label}</span>
            <span className="text-right font-medium text-gray-900">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatStatusLabel(status) {
  if (status === 'strong') return 'Strong'
  if (status === 'moderate') return 'Moderate'
  if (status === 'tight') return 'Tight'
  if (status === 'not_serviceable') return 'Not serviceable'
  return 'n/a'
}

function formatMaybeCurrency(amount, suffix = '') {
  if (!Number.isFinite(Number(amount))) return 'n/a'
  return `${formatCurrency(amount)}${suffix}`
}

function formatMaybeNumber(value) {
  if (!Number.isFinite(Number(value))) return 'n/a'
  return Number(value)
}

function formatPercent(value) {
  if (!Number.isFinite(Number(value))) return 'n/a'
  return `${Math.round(Number(value) * 100)}%`
}

function formatPercentFromNumber(value) {
  if (!Number.isFinite(Number(value))) return 'n/a'
  return `${Number(value).toFixed(1)}%`
}

function formatMaybeRatio(value) {
  if (!Number.isFinite(Number(value))) return 'n/a'
  return `${Number(value).toFixed(2)}x`
}

function formatMaybeText(value) {
  if (!value) return 'n/a'
  if (value === 'assessed') return 'Assessed'
  if (value === 'actual') return 'Actual'
  if (value === 'mixed') return 'Mixed'
  return value
}

function formatBenchmarkRule(rule) {
  if (!rule) return 'n/a'
  return `$${Number(rule.base || 0)} + $${Number(rule.per_borrower || 0)}/borrower + $${Number(
    rule.per_dependant || 0
  )}/dependant`
}

function InlineMetric({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 truncate font-semibold text-gray-900">{value}</p>
    </div>
  )
}
