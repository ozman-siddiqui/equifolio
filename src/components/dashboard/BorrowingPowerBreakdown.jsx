import { ArrowRight } from 'lucide-react'
import ExpandablePanel from './ExpandablePanel'
import MetricRow from './MetricRow'
import SectionCard from './SectionCard'

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

function formatMaybeRatio(value) {
  if (!Number.isFinite(Number(value))) return '—'
  return `${Number(value).toFixed(2)}x`
}

function formatMaybePercent(value) {
  if (!Number.isFinite(Number(value))) return '—'
  return `${Number(value).toFixed(1)}%`
}

export default function BorrowingPowerBreakdown({ analysis, onViewFullBreakdown }) {
  if (!analysis || analysis.status === 'error') return null

  const derived = analysis.derived || {}
  const assumptions = analysis.assumptions || analysis.assumptions_detail || {}

  return (
    <ExpandablePanel
      title="How borrowing power is calculated"
      subtitle="A compact lender-view summary of the assessed income, assessed outgoings, and buffered debt commitments currently driving the borrowing result."
    >
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SummarySection
          title="Income"
          rows={[
            {
              label: 'Base income',
              value: formatMaybeCurrency(analysis.inputs?.household_income_annual, '/year'),
              why: 'Recorded salary, partner income, and other income before lender-style shading.',
            },
            {
              label: 'Assessed income',
              value: formatMaybeCurrency(derived.adjusted_income_monthly, '/month'),
              why: 'Income is shaded down for tax and conservative lender servicing treatment before serviceability is assessed.',
            },
          ]}
        />

        <SummarySection
          title="Expenses"
          rows={[
            {
              label: 'Recorded living expenses',
              value: formatMaybeCurrency(analysis.user_living_expenses, '/month'),
              why: 'Your entered non-debt living costs before lender benchmarking is applied.',
            },
            {
              label: 'Lender benchmark',
              value: formatMaybeCurrency(analysis.benchmark_expenses, '/month'),
              why:
                analysis.inputs?.borrower_count != null &&
                analysis.inputs?.dependants != null
                  ? `A lender-style minimum living-cost benchmark for ${analysis.inputs.borrower_count} borrower${analysis.inputs.borrower_count === 1 ? '' : 's'} and ${analysis.inputs.dependants} dependant${analysis.inputs.dependants === 1 ? '' : 's'}.`
                  : 'A lender-style minimum living-cost benchmark based on household size and dependants.',
            },
            {
              label: 'Assessed living expenses used',
              value: formatMaybeCurrency(analysis.assessed_living_expenses, '/month'),
              why: 'The borrowing engine uses the higher of your recorded living expenses or the lender benchmark.',
            },
            {
              label: 'Assessed liabilities',
              value: formatMaybeCurrency(analysis.total_monthly_liability_repayments, '/month'),
              why: 'Existing personal debt commitments reduce lender-assessed serviceability before new borrowing is assessed.',
            },
          ]}
        />

        <SummarySection
          title="Loans"
          rows={[
            {
              label: 'Actual mortgage repayments',
              value: formatMaybeCurrency(derived.actual_mortgage_repayments_monthly, '/month'),
              why: 'These are the mortgage repayments currently recorded across the portfolio.',
            },
            {
              label: 'Assessed repayments',
              value: formatMaybeCurrency(derived.assessed_mortgage_commitments_monthly, '/month'),
              why: 'Lenders assess existing debt at a buffered repayment to test serviceability under pressure.',
            },
          ]}
        />

        <SummarySection
          title="Lender View"
          rows={[
            {
              label: 'Serviceability surplus',
              value: formatMaybeCurrency(derived.net_monthly_surplus, '/month'),
              why: 'Surplus after lender-style income shading, assessment buffers, and assessed commitments.',
            },
            {
              label: 'DTI ratio',
              value: formatMaybeRatio(derived.dti_ratio),
              why: 'Debt-to-income shows how much total debt is already carried relative to annual gross income.',
            },
          ]}
        />

        <SummarySection
          title="Assumptions"
          rows={[
            {
              label: 'Assessment rate',
              value: formatMaybePercent(assumptions.assessment_rate_pct),
              why: 'Banks apply a higher servicing rate than the current product rate to build in a repayment buffer.',
            },
            {
              label: 'Credit card factor',
              value:
                assumptions.credit_card_commitment_rate
                  ? `${Math.round(Number(assumptions.credit_card_commitment_rate) * 100)}% of limit`
                  : '—',
              why: 'Even unused credit card limits are treated as ongoing commitments by lenders.',
            },
          ]}
        />
      </div>

      <button
        type="button"
        onClick={onViewFullBreakdown}
        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
      >
        View full borrowing breakdown
        <ArrowRight size={15} />
      </button>
    </ExpandablePanel>
  )
}

function SummarySection({ title, rows }) {
  return (
    <SectionCard title={title} className="p-0">
      <div className="space-y-3">
        {rows.map((row) => (
          <MetricRow
            key={row.label}
            label={row.label}
            value={row.value}
            helper={row.why}
            emphasis={title === 'Serviceability' && row.label === 'Net monthly surplus'}
          />
        ))}
      </div>
    </SectionCard>
  )
}
