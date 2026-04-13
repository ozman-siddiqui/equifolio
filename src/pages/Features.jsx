export default function Features() {
  return (
    <div className="min-h-screen bg-white" style={{ color: '#0F172A' }}>
      <nav
        className="flex h-[66px] items-center justify-between px-14"
        style={{ backgroundColor: '#071C17' }}
      >
        <a href="/" className="text-xl font-extrabold no-underline" style={{ color: '#19C37D' }}>
          Vaulta
        </a>

        <div className="flex shrink-0 items-center">
          <a
            href="/"
            className="text-sm no-underline"
            style={{ color: 'rgba(255,255,255,0.65)', marginRight: '24px' }}
          >
            Back to home
          </a>

          <a
            href="/auth"
            className="text-sm no-underline"
            style={{ color: 'rgba(255,255,255,0.65)', marginRight: '24px' }}
          >
            Log in
          </a>

          <a
            href="/auth"
            className="rounded-lg px-5 py-2.5 text-sm font-extrabold no-underline"
            style={{ backgroundColor: '#19C37D', color: '#071C17' }}
          >
            Start free trial
          </a>
        </div>
      </nav>

      <section
        className="px-8 py-20 text-center"
        style={{
          background: '#071C17',
          backgroundImage:
            'radial-gradient(ellipse 60% 60% at 60% 30%, #0B2B23 0%, transparent 65%)',
        }}
      >
        <div
          className="mx-auto mb-6 inline-flex items-center rounded-full border px-4 py-2 text-xs font-semibold"
          style={{
            background: 'rgba(25,195,125,0.1)',
            borderColor: 'rgba(25,195,125,0.2)',
            color: '#19C37D',
          }}
        >
          Platform capabilities
        </div>
        <h1 className="mx-auto mb-5 max-w-3xl text-5xl font-extrabold tracking-tight leading-tight text-white">
          Every intelligence layer. Built for Australian property investors.
        </h1>
        <p className="mx-auto mb-10 max-w-xl text-xl text-white/50">
          Five integrated engines that turn your portfolio data into ranked actions, confident
          decisions, and proactive alerts.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {[
            ['Financial Intelligence', '#financial-intelligence'],
            ['Borrowing and Acquisition', '#borrowing-acquisition'],
            ['Opportunity Engine', '#opportunity-engine'],
            ['Wealth Projection', '#wealth-projection'],
            ['Command Centre', '#command-centre'],
          ].map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="rounded-full border px-4 py-2 text-xs no-underline"
              style={{
                background: 'rgba(255,255,255,0.05)',
                borderColor: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              {label}
            </a>
          ))}
        </div>
      </section>

      <section
        id="financial-intelligence"
        className="px-8 py-12 md:py-20"
        style={{ paddingTop: '80px' }}
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <div
              className="mb-4 inline-flex items-center rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: '#E8F6EF', color: '#085041' }}
            >
              Financial Intelligence Engine
            </div>
            <h2 className="mb-4 text-4xl font-extrabold tracking-tight" style={{ color: '#0F172A' }}>
              Know what your portfolio actually costs you after tax
            </h2>
            <p className="mx-auto max-w-2xl text-xl leading-relaxed" style={{ color: '#475569' }}>
              Most investors guess at their real holding cost. Vaulta calculates it — including
              negative gearing, depreciation, and ownership structure — so the number you see is
              your actual after-tax position.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-base font-bold" style={{ color: '#0F172A' }}>
                After-tax cash flow
              </h3>
              <p className="mb-5 text-sm leading-relaxed" style={{ color: '#475569' }}>
                Rental income minus loan repayments, property expenses, and living costs, adjusted
                for your ATO tax benefit. Your true monthly position, not a pre-tax estimate.
              </p>

              <h3 className="mb-2 text-base font-bold" style={{ color: '#0F172A' }}>
                Negative gearing and depreciation
              </h3>
              <p className="mb-5 text-sm leading-relaxed" style={{ color: '#475569' }}>
                Investment properties running at a loss reduce your taxable income. Vaulta models
                this using your actual marginal tax rate. Depreciation is modelled separately as a
                non-cash deduction, improving your ATO benefit without costing you additional cash.
              </p>

              <h3 className="mb-2 text-base font-bold" style={{ color: '#0F172A' }}>
                Individual vs joint ownership
              </h3>
              <p className="mb-5 text-sm leading-relaxed" style={{ color: '#475569' }}>
                A property owned 100% by the higher earner is taxed very differently to one owned
                50/50. Vaulta applies the correct marginal rate to each owner's share, giving you
                an accurate tax benefit specific to your ownership structure.
              </p>

              <h3 className="mb-2 text-base font-bold" style={{ color: '#0F172A' }}>
                Household income integration
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>
                Your combined household income, partner income, and other sources are all factored
                into serviceability and surplus. The engine distinguishes between what you earn and
                what is assessable under lender rules.
              </p>

              <ul className="mt-6 flex flex-col gap-2 text-sm" style={{ color: '#475569' }}>
                {[
                  'Pre-tax cash flow per property and portfolio-wide',
                  'ATO tax benefit including depreciation effect',
                  'True net monthly holding cost after all offsets',
                  'Individual vs joint ownership tax modelling',
                  'Income-aware marginal rate per owner',
                  'Living expenses benchmarked to HEM where applicable',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 rounded-full"
                      style={{ background: '#19C37D' }}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-4">
              <img
                src="/screenshots/tax-cashflow.webp"
                alt="Vaulta tax and cash flow showing pre-tax loss, ATO benefit, and net holding cost"
                className="w-full rounded-2xl"
                loading="lazy"
              />
              <img
                src="/screenshots/tax-settings.webp"
                alt="Vaulta tax ownership settings showing joint ownership and depreciation input"
                className="w-full rounded-2xl"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      <section
        id="borrowing-acquisition"
        className="px-8 py-12 md:py-20"
        style={{ background: '#F6FBF8', borderTop: '1px solid #DCEFE5', paddingTop: '96px' }}
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <div
              className="mb-4 inline-flex items-center rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: '#E8F6EF', color: '#085041' }}
            >
              Borrowing and Acquisition Engine
            </div>
            <h2 className="mb-4 text-4xl font-extrabold tracking-tight" style={{ color: '#0F172A' }}>
              Know exactly what you can borrow — and what to buy next
            </h2>
            <p className="mx-auto max-w-2xl text-xl leading-relaxed" style={{ color: '#475569' }}>
              Lender-style serviceability modelling combined with acquisition feasibility analysis.
              See your real purchase range before you approach a broker.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <img
                src="/screenshots/hero-dashboard.webp"
                alt="Vaulta acquisition decision showing purchase range and readiness score"
                className="w-full rounded-2xl"
                loading="eager"
              />
              <img
                src="/screenshots/execution-readiness.webp"
                alt="Vaulta execution readiness showing available versus required capital"
                className="w-full rounded-2xl"
                loading="lazy"
              />
            </div>
            <div>
              <h3 className="mb-2 text-base font-bold" style={{ color: '#0F172A' }}>
                Lender-grade serviceability
              </h3>
              <p className="mb-5 text-sm leading-relaxed" style={{ color: '#475569' }}>
                Vaulta applies the APRA standard 3% assessment rate buffer, the same stress test
                Australian lenders use. Borrowing capacity is calculated from your real income,
                expenses, existing repayments, credit limits, and liabilities.
              </p>

              <h3 className="mb-2 text-base font-bold" style={{ color: '#0F172A' }}>
                Deposit strategy comparison
              </h3>
              <p className="mb-5 text-sm leading-relaxed" style={{ color: '#475569' }}>
                Model 20%, 10% with LMI, and 5% with LMI side by side. See whether a lower deposit
                genuinely expands your range or simply shifts the constraint back to borrowing
                capacity.
              </p>

              <h3 className="mb-2 text-base font-bold" style={{ color: '#0F172A' }}>
                Execution readiness check
              </h3>
              <p className="mb-5 text-sm leading-relaxed" style={{ color: '#475569' }}>
                Vaulta compares your available capital against the full upfront requirement
                including deposit, stamp duty, and acquisition costs. You see immediately whether
                you clear the hurdle and by how much.
              </p>

              <h3 className="mb-2 text-base font-bold" style={{ color: '#0F172A' }}>
                Trade-off comparison
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>
                Three paths modelled side by side: do nothing, apply the top action, or buy now.
                Each shows borrowing capacity, cash flow impact, and risk level so you choose with
                evidence rather than instinct.
              </p>

              <ul className="mt-6 flex flex-col gap-2 text-sm" style={{ color: '#475569' }}>
                {[
                  'Borrowing capacity at APRA 3% buffer assessment rate',
                  '20% / 10% with LMI / 5% with LMI deposit pathways',
                  'Required deposit vs available capital check',
                  'Executable purchase price range',
                  'Post-acquisition monthly surplus projection',
                  'Do nothing vs act vs buy now comparison',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 rounded-full"
                      style={{ background: '#19C37D' }}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section
        id="opportunity-engine"
        className="px-8 py-12 md:py-20"
        style={{ borderTop: '1px solid #DCEFE5', paddingTop: '96px' }}
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <div
              className="mb-4 inline-flex items-center rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: '#E8F6EF', color: '#085041' }}
            >
              Opportunity Engine
            </div>
            <h2 className="mb-4 text-4xl font-extrabold tracking-tight" style={{ color: '#0F172A' }}>
              Find the money your portfolio is quietly losing
            </h2>
            <p className="mx-auto max-w-2xl text-xl leading-relaxed" style={{ color: '#475569' }}>
              Ranked, dollar-quantified actions from your real portfolio. Every recommendation is
              specific, immediately actionable, and calculated against your actual numbers.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-base font-bold" style={{ color: '#0F172A' }}>
                Ranked action cards
              </h3>
              <p className="mb-5 text-sm leading-relaxed" style={{ color: '#475569' }}>
                Your top two portfolio optimisation actions, ranked by dollar impact. Each includes
                the exact borrowing uplift, monthly cash flow improvement, and annual saving,
                calculated from your specific inputs.
              </p>

              <h3 className="mb-2 text-base font-bold" style={{ color: '#0F172A' }}>
                Refinancing opportunity detection
              </h3>
              <p className="mb-5 text-sm leading-relaxed" style={{ color: '#475569' }}>
                Vaulta compares your rates against market benchmarks continuously. When a gap is
                identified it surfaces the monthly saving, annual saving, and break-even period
                specific to your loan.
              </p>

              <h3 className="mb-2 text-base font-bold" style={{ color: '#0F172A' }}>
                Fixed rate expiry campaign
              </h3>
              <p className="mb-5 text-sm leading-relaxed" style={{ color: '#475569' }}>
                Every fixed rate loan is tracked. Alerts fire at 45, 30, and 14 days before expiry,
                giving you time to compare refinancing options before the rate reverts
                automatically.
              </p>

              <h3 className="mb-2 text-base font-bold" style={{ color: '#0F172A' }}>
                RBA rate decision intelligence
              </h3>
              <p className="mb-5 text-sm leading-relaxed" style={{ color: '#475569' }}>
                When the Reserve Bank moves rates, Vaulta calculates the exact dollar impact on
                each variable loan and delivers a personalised email the same day. Your properties,
                your balances, your repayments.
              </p>

              <h3 className="mb-2 text-base font-bold" style={{ color: '#0F172A' }}>
                Credit limit drag detection
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>
                Unused credit card limits reduce borrowing capacity under lender rules regardless
                of actual balance. Vaulta quantifies this drag in dollars and surfaces it as a
                ranked action when it materially affects your position.
              </p>

              <ul className="mt-6 flex flex-col gap-2 text-sm" style={{ color: '#475569' }}>
                {[
                  'Top 2 actions ranked by dollar impact',
                  'Refinancing opportunity vs market benchmark rate',
                  'Fixed rate expiry alerts at 45, 30, and 14 days',
                  'RBA impact notifications with per-property dollar figure',
                  'AI-generated personalised advisory narrative',
                  'Credit limit drag quantified in borrowing dollars',
                  'Break-even period on refinancing recommendations',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 rounded-full"
                      style={{ background: '#19C37D' }}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-4">
              <img
                src="/screenshots/refinance-card-updated.webp"
                alt="Vaulta refinance opportunity card showing monthly and annual saving"
                className="w-full rounded-2xl"
                loading="lazy"
              />
              <img
                src="/screenshots/rba-intelligence-updated.webp"
                alt="Vaulta RBA intelligence alert showing personalised rate impact"
                className="w-full rounded-2xl"
                loading="lazy"
              />
              <img
                src="/screenshots/fixed-rate-alert-updated.webp"
                alt="Vaulta fixed rate expiry alert"
                className="w-full rounded-2xl"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      <section
        id="wealth-projection"
        className="px-8 py-12 md:py-20"
        style={{ background: '#F6FBF8', borderTop: '1px solid #DCEFE5', paddingTop: '96px' }}
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <div
              className="mb-4 inline-flex items-center rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: '#E8F6EF', color: '#085041' }}
            >
              Wealth Projection Engine
            </div>
            <h2 className="mb-4 text-4xl font-extrabold tracking-tight" style={{ color: '#0F172A' }}>
              See where your portfolio is going — over 5, 10, and 30 years
            </h2>
            <p className="mx-auto max-w-2xl text-xl leading-relaxed" style={{ color: '#475569' }}>
              Long-term equity modelling with acquisition scenarios, amortisation assumptions, and
              rate resilience testing. Understand your trajectory before committing to a strategy.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <img
                src="/screenshots/equity-chart.webp"
                alt="Vaulta 30-year portfolio equity projection chart"
                className="w-full rounded-2xl"
                loading="lazy"
              />
              <img
                src="/screenshots/scenario-modelling.webp"
                alt="Vaulta growth scenario modelling with deposit strategy and growth rate inputs"
                className="w-full rounded-2xl"
                loading="lazy"
              />
            </div>

            <div>
              <h3 className="mb-2 text-base font-bold" style={{ color: '#0F172A' }}>
                30-year equity trajectory
              </h3>
              <p className="mb-5 text-sm leading-relaxed" style={{ color: '#475569' }}>
                Portfolio equity projected from today through 30 years, modelling loan amortisation,
                capital growth, and rental income together. See your net wealth position at year 5,
                10, 20, and 30.
              </p>

              <h3 className="mb-2 text-base font-bold" style={{ color: '#0F172A' }}>
                Acquisition scenario modelling
              </h3>
              <p className="mb-5 text-sm leading-relaxed" style={{ color: '#475569' }}>
                Model the equity difference at year 10 between buying now and waiting. Understand
                whether acquisition timing materially affects your long-term outcome before
                committing to a strategy.
              </p>

              <h3 className="mb-2 text-base font-bold" style={{ color: '#0F172A' }}>
                Growth rate assumptions
              </h3>
              <p className="mb-5 text-sm leading-relaxed" style={{ color: '#475569' }}>
                Adjust capital growth assumptions from conservative to optimistic and see how
                significantly long-term outcomes diverge. Understand which assumptions are doing
                the heavy lifting in your wealth model.
              </p>

              <h3 className="mb-2 text-base font-bold" style={{ color: '#0F172A' }}>
                Rate resilience testing
              </h3>
              <p className="mb-5 text-sm leading-relaxed" style={{ color: '#475569' }}>
                Find the exact cash rate at which your monthly surplus turns negative. This is your
                real risk threshold, stress-tested against your actual portfolio inputs.
              </p>

              <h3 className="mb-2 text-base font-bold" style={{ color: '#0F172A' }}>
                Borrowing sensitivity analysis
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>
                See how borrowing capacity changes as assessment rates move from 7% to 9.5%.
                Understand how quickly your purchase range compresses under tighter lending
                conditions.
              </p>

              <ul className="mt-6 flex flex-col gap-2 text-sm" style={{ color: '#475569' }}>
                {[
                  'Equity trajectory at year 5, 10, 20, and 30',
                  'With acquisition vs without acquisition comparison',
                  'Adjustable annual capital growth assumptions',
                  'Loan amortisation modelled accurately',
                  'Rate resilience score and safe headroom',
                  'Borrowing capacity across assessment rate scenarios',
                  'Surplus under rate stress modelling',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 rounded-full"
                      style={{ background: '#19C37D' }}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      </section>

      <section
        id="command-centre"
        className="px-8 py-12 md:py-20"
        style={{ borderTop: '1px solid #DCEFE5', paddingTop: '96px' }}
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <div
              className="mb-4 inline-flex items-center rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: '#E8F6EF', color: '#085041' }}
            >
              Portfolio Command Centre
            </div>
            <h2 className="mb-4 text-4xl font-extrabold tracking-tight" style={{ color: '#0F172A' }}>
              Your entire portfolio. Finally in one place.
            </h2>
            <p className="mx-auto max-w-2xl text-xl leading-relaxed" style={{ color: '#475569' }}>
              Properties, mortgages, cash flow, equity, alerts, and projections — all connected in
              one intelligent platform that updates in real time when anything changes.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                eyebrow: 'NET EQUITY',
                title: 'Know your true asset position',
                body:
                  'Total property value minus all outstanding loan balances. Updated in real time, shown by property and portfolio-wide with LVR tracking.',
              },
              {
                eyebrow: 'MONTHLY SURPLUS',
                title: 'Know your real cash position',
                body:
                  'After-tax monthly surplus across your entire portfolio. Rental income, repayments, expenses, and ATO benefit consolidated into one number.',
              },
              {
                eyebrow: 'BORROWING POWER',
                title: 'Know what you can unlock today',
                body:
                  'Live borrowing capacity plus the single action that releases the most additional capacity. Post-action total shown immediately.',
              },
              {
                eyebrow: 'RATE INTELLIGENCE',
                title: 'Never be caught off guard',
                body:
                  'RBA impact delivered to your inbox the same day it happens. Per-property repayment change shown on the dashboard before you open the news.',
              },
              {
                eyebrow: 'EXPIRY ALERTS',
                title: 'Act before your rate reverts',
                body:
                  '45-day, 30-day, and 14-day alerts before every fixed rate expiry. Time to compare, decide, and act rather than scramble.',
              },
              {
                eyebrow: 'WEALTH PROJECTION',
                title: 'See the full 30-year picture',
                body:
                  'Equity trajectory from today through 30 years. Acquisition scenario comparison available at any point so you always know what acting now versus waiting actually means.',
              },
            ].map((card) => (
              <div
                key={card.eyebrow}
                className="rounded-2xl border p-6"
                style={{ background: '#F8FAFC', borderColor: '#EEF2F7' }}
              >
                <p
                  className="mb-2 text-xs font-bold uppercase tracking-widest"
                  style={{ color: '#085041' }}
                >
                  {card.eyebrow}
                </p>
                <h3 className="mb-3 text-base font-bold" style={{ color: '#0F172A' }}>
                  {card.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>
                  {card.body}
                </p>
              </div>
            ))}
          </div>

          <p
            className="text-center text-base mt-10 font-semibold"
            style={{ color: '#085041' }}
          >
            Every surface updates the moment your inputs change. One platform. Full portfolio
            intelligence.
          </p>
        </div>
      </section>

      <section
        className="px-8 py-20 text-center"
        style={{
          background: '#071C17',
          backgroundImage:
            'radial-gradient(ellipse 60% 80% at 50% 0%, #0B2B23 0%, transparent 65%)',
        }}
      >
        <h2 className="mb-5 text-5xl font-extrabold tracking-tight text-white">
          Ready to see your portfolio clearly?
        </h2>
        <p className="mx-auto mb-10 max-w-lg text-xl text-white/45">
          Join Australian property investors who are making decisions with real numbers, not
          guesswork.
        </p>
        <a
          href="/auth"
          className="inline-block rounded-xl px-10 py-5 text-lg font-extrabold no-underline"
          style={{ background: '#19C37D', color: '#071C17' }}
        >
          Start free trial →
        </a>
        <p className="mt-5 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          No credit card required · Cancel anytime · Australian-built
        </p>
      </section>

      <footer className="px-14 py-8 text-center" style={{ background: '#071C17' }}>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          © 2026 Vaulta. All rights reserved.
        </p>
      </footer>
    </div>
  )
}
