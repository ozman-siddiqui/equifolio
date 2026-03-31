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
          Properties in the {formatCurrency(yieldFirst.purchaseRangeLow)}–
          {formatCurrency(yieldFirst.purchaseRangeHigh)} range with{' '}
          {yieldFirst.yieldRangeLow}–{yieldFirst.yieldRangeHigh}% gross yield may be near
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
    const lenderSupportedLoanAmount = Number.isFinite(Number(borrowingCapacity)) && Number(borrowingCapacity) > 0
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
        Regional yield properties in the $350k–$480k range may be worth exploring as market
        conditions evolve. Building capital or borrowing capacity could unlock this pathway.
      </p>
      <p className="text-xs leading-6 text-gray-500">
        Yield and cost estimates are indicative only, based on assumed market conditions. Not
        financial advice. Actual results will vary.
      </p>
    </PathwayCard>
  )
}

function ReadinessContent({ yieldFirst, topAction }) {
  const estimatedMonthsToMetro = Number(yieldFirst?.estimatedMonthsToMetro || 0)
  const metroBlocked = Boolean(yieldFirst?.metroBlocked)
  const topActionTitle =
    topAction && typeof topAction === 'object'
      ? topAction.title || null
      : null

  let badge = 'Ready'
  let tone = 'emerald'
  let body = 'Metro acquisition may be possible under current settings.'

  if (metroBlocked && estimatedMonthsToMetro === 0) {
    badge = 'In Progress'
    tone = 'blue'
    body = 'Gathering more data to estimate your metro readiness timeline.'
  } else if (estimatedMonthsToMetro > 12) {
    badge = 'Building'
    tone = 'blue'
    body = `Building toward metro acquisition — estimated ~${estimatedMonthsToMetro} months at current equity growth rate.`
  } else if (estimatedMonthsToMetro > 0) {
    badge = 'In Progress'
    tone = 'blue'
    body = `Estimated metro acquisition-ready in ~${estimatedMonthsToMetro} months at current portfolio growth rate.`
  }

  return (
    <PathwayCard badge={badge} title="Readiness" tone={tone}>
      <p>{body}</p>
      {topActionTitle ? (
        <p className="text-xs leading-6 text-gray-500">Top action: {topActionTitle}</p>
      ) : null}
    </PathwayCard>
  )
}

export default function GrowthPathways({
  yieldFirst = null,
  availableCapital = 0,
  borrowingCapacity = 0,
  growthInputs = null,
  totalPortfolioValue = 0,
  topAction = null,
}) {
  return (
    <section className="space-y-4">
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

      <ReadinessContent yieldFirst={yieldFirst} topAction={topAction} />
    </section>
  )
}
