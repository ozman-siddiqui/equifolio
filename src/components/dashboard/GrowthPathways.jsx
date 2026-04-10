import { MARKET_FLOORS } from '../../config/marketFloors'

function formatCurrency(amount) {
  return Number(amount || 0).toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  })
}

const TONE_STYLES = {
  emerald: {
    border: 'border-emerald-200/80',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    panel: 'bg-emerald-50/40',
  },
  amber: {
    border: 'border-amber-200/80',
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
    panel: 'bg-amber-50/40',
  },
  blue: {
    border: 'border-sky-200/80',
    badge: 'bg-sky-50 text-sky-700 ring-sky-200',
    panel: 'bg-sky-50/40',
  },
  slate: {
    border: 'border-slate-200/80',
    badge: 'bg-slate-50 text-slate-700 ring-slate-200',
    panel: 'bg-slate-50/70',
  },
}

const READINESS_TONE_STYLES = {
  ready: {
    border: 'border-emerald-200/80',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    panel: 'bg-emerald-50/40',
    progress: 'bg-emerald-500',
  },
  close: {
    border: 'border-emerald-200/80',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    panel: 'bg-emerald-50/40',
    progress: 'bg-emerald-500',
  },
  building: {
    border: 'border-amber-200/80',
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
    panel: 'bg-amber-50/40',
    progress: 'bg-amber-500',
  },
  early: {
    border: 'border-slate-200/80',
    badge: 'bg-slate-50 text-slate-700 ring-slate-200',
    panel: 'bg-slate-50/70',
    progress: 'bg-slate-400',
  },
}

function formatConstraintLabel(constraint) {
  switch (constraint) {
    case 'borrowing':
      return 'Borrowing capacity'
    case 'capital':
      return 'Capital position'
    case 'data':
      return 'Data completeness'
    case 'cashflow':
      return 'Cash flow health'
    case 'equity':
      return 'Portfolio equity'
    default:
      return 'Readiness'
  }
}

function formatPillarLabel(key) {
  switch (key) {
    case 'dataCompleteness':
      return 'Data completeness'
    case 'borrowingCapacity':
      return 'Borrowing capacity'
    case 'capitalPosition':
      return 'Capital position'
    case 'cashFlowHealth':
      return 'Cash flow health'
    case 'portfolioEquity':
      return 'Portfolio equity'
    default:
      return key
  }
}

function ReadinessScoreBlock({ acquisitionReadiness }) {
  const tone = READINESS_TONE_STYLES[acquisitionReadiness?.band] || READINESS_TONE_STYLES.early
  const primaryConstraint = formatConstraintLabel(acquisitionReadiness?.primaryConstraint)

  return (
    <article
      className={`rounded-[2rem] border bg-white p-6 shadow-sm shadow-gray-100/70 md:p-7 ${tone.border}`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
            Acquisition readiness
          </p>
          <p className="mt-3 text-sm text-gray-600">
            Primary constraint: <span className="font-semibold text-gray-900">{primaryConstraint}</span>
          </p>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            {acquisitionReadiness.topUnlockAction}
          </p>
        </div>

        <div className={`rounded-[1.5rem] border border-white/80 px-5 py-4 text-center shadow-[0_18px_40px_-34px_rgba(15,23,42,0.12)] ${tone.panel}`}>
          <p className="text-4xl font-semibold tracking-tight text-gray-900">
            {acquisitionReadiness.finalScore}%
          </p>
          <div
            className={`mt-3 inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ring-1 ${tone.badge}`}
          >
            {acquisitionReadiness.label}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-5">
        {Object.entries(acquisitionReadiness.pillars || {}).map(([key, pillar]) => (
          <div key={key} className="rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {formatPillarLabel(key)}
            </p>
            <p className="mt-2 text-lg font-semibold text-gray-900">
              {Number(pillar?.score || 0)}%
            </p>
            <div className="mt-3 h-2 rounded-full bg-white">
              <div
                className={`h-2 rounded-full ${tone.progress}`}
                style={{ width: `${Math.max(0, Math.min(100, Number(pillar?.score || 0)))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

function PathwayCard({ badge, title, tone = 'slate', children }) {
  const styles = TONE_STYLES[tone] || TONE_STYLES.slate

  return (
    <article
      className={`rounded-[2rem] border bg-white p-6 shadow-sm shadow-gray-100/70 md:p-7 ${styles.border}`}
    >
      <div
        className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ring-1 ${styles.badge}`}
      >
        {badge}
      </div>

      <div
        className={`mt-5 rounded-[1.5rem] border border-white/80 p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.12)] ${styles.panel}`}
      >
        <h3 className="text-[20px] font-semibold tracking-tight text-gray-900 md:text-[22px]">
          {title}
        </h3>
        <div className="mt-3 space-y-3 text-sm leading-7 text-gray-600 md:text-[15px]">
          {children}
        </div>
      </div>
    </article>
  )
}

function buildCapitalGrowthBody({ availableCapital = 0, metroBlocked = false }) {
  const safeAvailableCapital = Math.max(0, Number(availableCapital || 0))

  return (
    <>
      <p>
        {safeAvailableCapital > 0
          ? `${formatCurrency(safeAvailableCapital)} is currently visible as deployable capital for a larger-asset pathway when conditions support metro-style growth targeting.`
          : 'Available capital is not yet surfacing strongly enough to frame a larger-asset pathway.'}
      </p>
      <p className="text-xs leading-6 text-gray-500">
        {metroBlocked
          ? 'Metro acquisition remains blocked under current settings.'
          : 'Metro acquisition conditions are not currently flagged as blocked.'}
      </p>
    </>
  )
}

function buildHoldingText({ monthlyHoldingLow = 0, monthlyHoldingHigh = 0 }) {
  const holdingMin = Math.min(monthlyHoldingLow, monthlyHoldingHigh)
  const holdingMax = Math.max(monthlyHoldingLow, monthlyHoldingHigh)

  if (holdingMin <= 0 && holdingMax >= 0) {
    return `Estimated holding: -${formatCurrency(Math.abs(holdingMin))} to +${formatCurrency(
      Math.abs(holdingMax)
    )}/month`
  }

  if (holdingMin < 0 && holdingMax < 0) {
    return `Estimated shortfall: -${formatCurrency(Math.abs(holdingMin))} to -${formatCurrency(
      Math.abs(holdingMax)
    )}/month`
  }

  return `Estimated surplus: +${formatCurrency(holdingMin)} to +${formatCurrency(
    holdingMax
  )}/month`
}

function BreakdownRow({ label, value }) {
  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/40 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-gray-900">{formatCurrency(value)}</p>
    </div>
  )
}

function YieldFirstContent({
  yieldFirst,
  availableCapital = 0,
  growthInputs = null,
  borrowingCapacity = 0,
}) {
  if (yieldFirst?.isExecutable) {
    return (
      <PathwayCard badge="Possible Now" title="Yield-first acquisition" tone="emerald">
        <p>
          Properties in the {formatCurrency(yieldFirst.purchaseRangeLow)}-
          {formatCurrency(yieldFirst.purchaseRangeHigh)} range with{' '}
          {yieldFirst.yieldRangeLow}-{yieldFirst.yieldRangeHigh}% gross yield may be near
          cash-flow neutral under current borrowing settings.
        </p>
        <p>{buildHoldingText(yieldFirst)}</p>
        <p className="text-xs leading-6 text-gray-500">
          {yieldFirst.constraintType === 'capital'
            ? 'Currently constrained by available capital'
            : 'Currently constrained by borrowing capacity'}
        </p>
        <p className="text-xs leading-6 text-gray-500">
          Yield and cost estimates are indicative only, based on assumed market conditions.
          Not financial advice. Actual results will vary.
        </p>
      </PathwayCard>
    )
  }

  if (yieldFirst?.constraintType === 'borrowing') {
    const regionalFloor = MARKET_FLOORS.regionalYield
    const gapToEntry = Math.max(0, regionalFloor - Number(yieldFirst.maxPurchase || 0))
    const lenderSupportedLoanAmount =
      Number.isFinite(Number(borrowingCapacity)) && Number(borrowingCapacity) > 0
        ? Number(borrowingCapacity)
        : Number(yieldFirst.maxPurchase || 0) * 0.8
    const cashAvailable = Number(growthInputs?.cashAvailableForInvestment)
    const usableEquity = Number(
      growthInputs?.usableEquity ??
        growthInputs?.usableEquityAfterBuffer
    )
    const rawUsableEquityBeforeBuffer = Number(growthInputs?.rawUsableEquityBeforeBuffer)
    const safetyBufferRetained =
      Number.isFinite(rawUsableEquityBeforeBuffer) && Number.isFinite(usableEquity)
        ? Math.max(0, rawUsableEquityBeforeBuffer - usableEquity)
        : null

    return (
      <PathwayCard badge="Constrained" title="Yield-first acquisition" tone="amber">
        <p>
          Your deployable capital is strong, but current borrowing capacity supports an
          estimated purchase of ~{formatCurrency(yieldFirst.maxPurchase)}, which remains
          below the realistic regional market entry level of ~
          {formatCurrency(MARKET_FLOORS.regionalYield)}.
        </p>
        <p>
          Improving serviceability by reducing liabilities or increasing income could unlock
          this pathway.
        </p>
        <div className="rounded-[1.25rem] border border-amber-200/70 bg-white/80 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
            Financial breakdown
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <BreakdownRow label="Deployable capital" value={availableCapital} />
            <BreakdownRow
              label="Borrowing-supported purchase"
              value={yieldFirst.maxPurchase}
            />
            <BreakdownRow label="Regional market floor" value={regionalFloor} />
            <BreakdownRow label="Gap to entry" value={gapToEntry} />
            <div className="rounded-2xl border border-amber-100 bg-amber-50/40 px-4 py-3 sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Lender-supported loan amount
              </p>
              <p className="mt-1 text-base font-semibold text-gray-900">
                {formatCurrency(lenderSupportedLoanAmount)}
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-[1rem] border border-amber-100/80 bg-amber-50/30 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              Deployable capital breakdown
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Number.isFinite(cashAvailable) ? (
                <BreakdownRow label="Cash available" value={cashAvailable} />
              ) : null}
              {Number.isFinite(usableEquity) ? (
                <BreakdownRow label="Usable equity" value={usableEquity} />
              ) : null}
              {Number.isFinite(safetyBufferRetained) ? (
                <BreakdownRow label="Safety buffer retained" value={safetyBufferRetained} />
              ) : null}
              <div className="rounded-2xl border border-amber-100 bg-white/90 px-4 py-3 sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Total deployable capital
                </p>
                <p className="mt-1 text-base font-semibold text-gray-900">
                  {formatCurrency(availableCapital)}
                </p>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs leading-6 text-gray-500">
            Your capital is sufficient, but lender serviceability currently limits the
            maximum purchase price.
          </p>
        </div>
        <p className="text-xs leading-6 text-gray-500">
          Yield and cost estimates are indicative only, based on assumed market conditions.
          Not financial advice. Actual results will vary.
        </p>
      </PathwayCard>
    )
  }

  return (
    <PathwayCard badge="Explore" title="Yield-first acquisition" tone="amber">
      <p>
        Regional yield properties in the $350k-$480k range may be worth exploring as market
        conditions evolve. Building capital or borrowing capacity could unlock this pathway.
      </p>
      <p className="text-xs leading-6 text-gray-500">
        Yield and cost estimates are indicative only, based on assumed market conditions. Not
        financial advice. Actual results will vary.
      </p>
    </PathwayCard>
  )
}

function TimelineContent({
  acquisitionReadiness,
  yieldFirst,
  topAction,
  borrowingCapacity = 0,
}) {
  const estimatedMonthsToMetro = Number(yieldFirst?.estimatedMonthsToMetro || 0)
  const topActionTitle =
    topAction && typeof topAction === 'object'
      ? topAction.title || null
      : null

  let badge = 'Building'
  let tone = 'blue'
  let body =
    'Continue building capital and improving serviceability toward your next acquisition.'

  if (acquisitionReadiness?.primaryConstraint === 'borrowing') {
    badge = 'In Progress'
    tone = 'blue'
    body = `Borrowing capacity is currently the primary constraint at ${formatCurrency(
      borrowingCapacity
    )}. Reducing liabilities by ~$20k typically unlocks $30-40k in additional borrowing.`
  } else if (acquisitionReadiness?.primaryConstraint === 'capital') {
    badge = 'In Progress'
    tone = 'blue'
    body = `At current portfolio equity growth rate, metro acquisition estimated in ~${estimatedMonthsToMetro} months.`
  } else if (
    acquisitionReadiness?.band === 'ready' ||
    acquisitionReadiness?.band === 'close'
  ) {
    badge = 'Ready'
    tone = 'emerald'
    body =
      'Your current position supports an acquisition move. Review your growth scenarios to explore options.'
  }

  return (
    <PathwayCard badge={badge} title="Acquisition timeline" tone={tone}>
      <p>{body}</p>
      {acquisitionReadiness?.topUnlockAction ? (
        <p className="text-xs leading-6 text-gray-500">
          {acquisitionReadiness.topUnlockAction}
        </p>
      ) : null}
      {topActionTitle ? (
        <p className="text-xs leading-6 text-gray-500">Top action: {topActionTitle}</p>
      ) : null}
    </PathwayCard>
  )
}

export default function GrowthPathways({
  acquisitionReadiness = null,
  yieldFirst = null,
  availableCapital = 0,
  borrowingCapacity = 0,
  growthInputs = null,
  totalPortfolioValue = 0,
  topAction = null,
}) {
  return (
    <section className="space-y-4">
      {acquisitionReadiness ? (
        <ReadinessScoreBlock acquisitionReadiness={acquisitionReadiness} />
      ) : null}

      <PathwayCard badge="Capital Growth" title="Capital growth" tone="slate">
        {buildCapitalGrowthBody({
          availableCapital,
          totalPortfolioValue,
          metroBlocked: Boolean(yieldFirst?.metroBlocked),
        })}
      </PathwayCard>

      <YieldFirstContent
        yieldFirst={yieldFirst}
        availableCapital={availableCapital}
        growthInputs={growthInputs}
        borrowingCapacity={borrowingCapacity}
      />

      <TimelineContent
        acquisitionReadiness={acquisitionReadiness}
        yieldFirst={yieldFirst}
        topAction={topAction}
        borrowingCapacity={borrowingCapacity}
      />
    </section>
  )
}
