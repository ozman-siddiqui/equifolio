import { useState } from 'react'

const faqItems = [
  {
    q: 'What is Vaulta?',
    a: 'Vaulta is an intelligent property portfolio platform built for Australian investors with 1 to 5 properties. It brings your properties, loans, cash flow, and household financials into one place, then helps you understand your real position, find opportunities to save money, and decide confidently whether you can buy your next property.',
  },
  {
    q: 'Is Vaulta financial advice?',
    a: 'No. Vaulta provides general informational insights only and does not constitute financial, tax, investment, or lending advice. All outputs are illustrative estimates based on your inputs and indicative market benchmarks. Before making any investment or borrowing decisions, we recommend consulting a licensed financial adviser, mortgage broker, or accountant.',
  },
  {
    q: 'How does Vaulta calculate borrowing capacity?',
    a: 'Vaulta uses a lender-style serviceability model based on your household income, living expenses, existing loan repayments, credit card limits, and liabilities. It applies the standard APRA assessment rate buffer of 3% above the loan rate, which is how Australian lenders stress-test your repayments. The result is an indicative borrowing estimate, not a formal credit assessment.',
  },
  {
    q: 'Can I track multiple properties?',
    a: 'Yes. Vaulta is designed for investors with 1 to 5 properties. The Starter plan supports up to 3 properties. The Investor plan supports unlimited properties. Each property can have its own loan details, cash flow transactions, and mortgage tracking.',
  },
  {
    q: 'How does the RBA intelligence work?',
    a: 'When the Reserve Bank of Australia announces a rate decision, Vaulta automatically calculates the dollar impact on your specific variable loans, property by property. A personalised AI-generated summary is delivered to your inbox the same day, referencing your actual property addresses and repayment figures. The intelligence is powered by Anthropic Claude.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. Vaulta is built on Supabase, which uses PostgreSQL with Row Level Security enforced at the database level. This means your data is isolated at the infrastructure layer, not just in application code. Vaulta does not connect to your bank accounts and does not store login credentials. All data you enter is used only to generate your portfolio insights.',
  },
]

const trustItems = [
  'Lender-grade serviceability calculations',
  'RBA-aware portfolio intelligence',
  'Built for Australian property investors',
  'AI-powered by Anthropic Claude',
]

const starterFeatures = [
  'Up to 3 properties',
  'Borrowing power engine',
  'RBA impact notifications',
  'Cash flow tracker',
  'Rate resilience score',
  'Fixed rate expiry alerts',
]

const investorFeatures = [
  'Everything in Starter',
  'Acquisition feasibility engine',
  '30-year wealth projection',
  'AI-powered RBA narratives',
  'Refinancing opportunity alerts',
  'Stress testing and resilience score',
  'Tax and cash flow modelling',
  'Unlimited properties',
]

const pricingPlans = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$49',
    interval: '/month AUD',
    description:
      'Perfect for investors starting out.',
    features: starterFeatures,
    cta: 'Start 14-day free trial',
    featured: false,
  },
  {
    id: 'investor',
    name: 'Investor',
    price: '$99',
    interval: '/month AUD',
    description:
      'For serious investors building wealth.',
    features: investorFeatures,
    cta: 'Start 14-day free trial →',
    featured: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$149',
    interval: '/month AUD',
    description:
      'For high-net-worth investors and SMSFs.',
    features: [
      'Everything in Investor',
      'SMSF compliance flags',
      'White-label reports',
      'Multi-portfolio support',
      'Natural language Q&A',
      'Weekly AI digest',
      'Dedicated support',
    ],
    cta: 'Start 14-day free trial',
    featured: false,
  },
]

const navLinks = [
  ['Features', '#features'],
  ['How it works', '/how-it-works'],
  ['Pricing', '#pricing'],
]

function SectionBadge({ children }) {
  return (
    <div
      className="inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em]"
      style={{ background: '#E8F6EF', color: '#085041' }}
    >
      {children}
    </div>
  )
}

function Landing() {
  const [openIndex, setOpenIndex] = useState(null)
  const toggle = (index) => setOpenIndex(openIndex === index ? null : index)

  return (
    <div className="min-h-screen bg-white" style={{ color: '#0F172A' }}>
      <nav
        className="flex h-[66px] items-center justify-between px-6 md:px-10 lg:px-14"
        style={{ background: '#071C17' }}
      >
        <a href="#" className="text-xl font-extrabold no-underline" style={{ color: '#19C37D' }}>
          Vaulta
        </a>
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="text-sm no-underline transition-colors"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              {label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <a
            href="/auth"
            className="text-sm font-medium no-underline"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            Log in
          </a>
          <a
            href="/auth"
            className="rounded-lg px-4 py-2 text-sm font-extrabold no-underline md:px-5 md:py-2.5"
            style={{ background: '#19C37D', color: '#071C17' }}
          >
            Start free trial
          </a>
        </div>
      </nav>

      <section
        className="px-6 pb-0 pt-16 text-center md:px-10 lg:px-14 lg:pt-22"
        style={{
          background: '#071C17',
          backgroundImage:
            'radial-gradient(ellipse 70% 55% at 65% 15%, rgba(11,43,35,0.9) 0%, transparent 65%), radial-gradient(ellipse 40% 50% at 10% 90%, rgba(9,36,25,0.7) 0%, transparent 55%)',
        }}
      >
        <div
          className="mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold tracking-wide"
          style={{
            borderColor: 'rgba(25,195,125,0.2)',
            background: 'rgba(25,195,125,0.09)',
            color: '#19C37D',
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full animate-pulse"
            style={{ background: '#19C37D' }}
          />
          AI-powered RBA intelligence, live now
        </div>

        <h1
          className="font-extrabold text-white text-center mx-auto mb-6"
          style={{
            fontSize: 'clamp(36px, 5vw, 58px)',
            lineHeight: '1.05',
            letterSpacing: '-1.5px',
            maxWidth: '820px'
          }}
        >
          See exactly how your portfolio<br />
          is performing. And where<br />
          <em style={{ color: '#19C37D', fontStyle: 'normal' }}>
            you&apos;re losing money.
          </em>
        </h1>

        <p className="mx-auto mb-11 max-w-xl text-lg leading-relaxed md:text-xl" style={{ color: 'rgba(255,255,255,0.48)' }}>
          Track every property, loan, and dollar. Understand your real financial position. Spot
          opportunities to save money before they pass you by.
        </p>

        <div className="mb-5 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href="/auth"
            className="rounded-xl px-9 py-4 text-base font-extrabold no-underline"
            style={{ background: '#19C37D', color: '#071C17' }}
          >
            Start free trial →
          </a>
          <a
            href="#how-it-works"
            className="rounded-xl border px-9 py-4 text-base no-underline"
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.7)',
              borderColor: 'rgba(255,255,255,0.1)',
            }}
          >
            See how it works
          </a>
        </div>

        <p className="mb-14 text-xs tracking-wide" style={{ color: 'rgba(255,255,255,0.2)' }}>
          No credit card required · Australian-built · Cancel anytime
        </p>

        <div className="relative mx-auto max-w-5xl">
          <div
            className="absolute -top-5 right-4 rounded-full px-4 py-2 text-sm font-extrabold md:right-8 md:px-5 md:py-2.5"
            style={{
              background: '#19C37D',
              color: '#071C17',
              boxShadow: '0 6px 24px rgba(25,195,125,0.45)',
            }}
          >
            96% Ready to act
          </div>
          <img
            src="/screenshots/hero-dashboard.webp"
            alt="Vaulta dashboard showing acquisition readiness and investment property purchase range"
            loading="eager"
            className="w-full rounded-t-3xl"
            style={{
              boxShadow:
                '0 -56px 140px rgba(0,0,0,0.75), 0 -12px 40px rgba(0,0,0,0.35)',
            }}
          />
        </div>
      </section>

      <section
        className="flex flex-wrap items-center justify-center gap-4 border-t px-6 py-5 md:px-10 lg:gap-9 lg:px-14"
        style={{ background: '#071C17', borderColor: 'rgba(255,255,255,0.04)' }}
      >
        {trustItems.map((item, index) => (
          <div key={item} className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="h-[5px] w-[5px] rounded-full" style={{ background: '#19C37D' }} />
              <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.32)' }}>
                {item}
              </span>
            </div>
            {index < trustItems.length - 1 ? (
              <span className="hidden h-4 w-px lg:block" style={{ background: 'rgba(255,255,255,0.07)' }} />
            ) : null}
          </div>
        ))}
      </section>

      <section className="px-6 py-11 md:px-10 lg:px-14" style={{ background: '#F0FAF5' }}>
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 text-center sm:grid-cols-2 lg:grid-cols-4 lg:gap-16">
          {[
            ['$3.5m+', 'Portfolio equity tracked', '#0F172A'],
            ['$7,090', 'Average opportunities identified', '#0F172A'],
            ['96%', 'Peak acquisition readiness', '#19C37D'],
            ['30yr', 'Wealth projection horizon', '#0F172A'],
          ].map(([value, label, color]) => (
            <div key={label}>
              <div className="text-5xl font-extrabold tracking-tight" style={{ color }}>
                {value}
              </div>
              <div className="mt-1 text-xs font-medium" style={{ color: '#5E7D6A' }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        id="features"
        className="px-6 py-20 md:px-10 lg:px-14"
        style={{
          background: '#071C17',
          backgroundImage:
            'radial-gradient(ellipse 60% 70% at 80% 50%, #0B2B23 0%, transparent 65%)',
        }}
      >
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <div
              className="mb-5 inline-flex rounded-full px-4 py-1.5 text-xs font-bold"
              style={{ background: 'rgba(25,195,125,0.1)', color: '#19C37D' }}
            >
              AI-Powered Intelligence
            </div>
            <h2 className="mb-4 text-4xl font-extrabold leading-tight tracking-tight text-white md:text-5xl">
              Know what every RBA move means for <span style={{ color: '#19C37D' }}>your</span>{' '}
              portfolio
            </h2>
            <p className="mb-7 text-lg leading-relaxed md:text-xl" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Before the market noise settles, Vaulta calculates the exact dollar impact on each
              of your loans, property by property. Delivered to your inbox the same day.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                ['Your monthly impact', '+$257/mo', '#EF4444'],
                ['Properties monitored', '2 properties', '#FFFFFF'],
                ['Rate change tracked', '4% to 4.25%', '#FFFFFF'],
              ].map(([label, value, color]) => (
                <div
                  key={label}
                  className="rounded-xl border px-5 py-4"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderColor: 'rgba(255,255,255,0.07)',
                  }}
                >
                  <div className="mb-1 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {label}
                  </div>
                  <div className="text-xl font-extrabold" style={{ color }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div
              className="rounded-3xl bg-white p-8"
              style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}
            >
              <div className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: '#19C37D' }}>
                MARKET UPDATE
              </div>
              <h3 className="mb-1 text-lg font-bold text-slate-900">
                RBA move may increase your repayments by $257 per month
              </h3>
              <p className="mb-4 text-sm text-slate-400">Cash rate moved from 4% to 4.25%</p>
              <p
                className="border-l-4 pl-4 text-sm italic leading-7 text-slate-700"
                style={{ borderColor: '#19C37D' }}
              >
                Your monthly repayments will increase by approximately $257 across both properties,
                with the Ingleburn Gardens Drive loan now costing around $4,680 per month and the
                Barley Street interest-only loan approximately $3,610 per month. You should
                immediately review refinancing opportunities for both loans to secure better rates,
                particularly for the Barley Street property which is paying 5.99% interest-only.
              </p>
              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {[
                  ['Monthly impact', '+$257/mo', '#EF4444'],
                  ['Barley Street', '$3,610/mo', '#0F172A'],
                  ['Ingleburn Gardens Drive', '$4,680/mo', '#0F172A'],
                ].map(([label, value, color]) => (
                  <div key={label} className="rounded-xl px-4 py-3" style={{ background: '#F8FAFC' }}>
                    <div className="mb-1 text-xs font-semibold text-slate-400">{label}</div>
                    <div className="text-xl font-extrabold" style={{ color }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <img
              src="/screenshots/rba-intelligence-updated.webp"
              alt="Vaulta RBA intelligence card showing personalised rate impact by property address"
              loading="lazy"
              className="mt-5 w-full rounded-2xl"
            />
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-white px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-5xl">
          <SectionBadge>Money Saving Engine</SectionBadge>
          <h2 className="mb-4 mt-5 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
            Built to find money you didn&apos;t know you were losing
          </h2>
          <p className="mb-10 max-w-xl text-lg leading-relaxed text-slate-500 md:text-xl">
            Ranked, dollar-quantified actions from your real portfolio. Every recommendation is
            specific and immediately actionable.
          </p>

          <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="rounded-3xl border-[1.5px] p-7" style={{ borderColor: '#19C37D', background: '#F0FDF8' }}>
              <div
                className="mb-3 flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold"
                style={{ background: '#DCEFE5', color: '#085041' }}
              >
                #1
              </div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: '#19C37D' }}>
                START HERE
              </div>
              <h3 className="mb-2 text-base font-bold leading-snug text-slate-900">
                Unlock $39,016 in borrowing capacity by reducing credit card limits
              </h3>
              <p className="text-sm leading-relaxed text-slate-500">
                Even unused limits reduce your borrowing capacity. Lenders shade the full limit
                into serviceability calculations regardless of actual balance.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {['+$39,016 borrowing', '+$300 per month', '+$3,600 per year'].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full px-3 py-1 text-xs font-bold"
                    style={{ background: '#DCEFE5', color: '#085041' }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border-[1.5px] p-7" style={{ borderColor: '#FBBF24', background: '#FFFBEB' }}>
              <div
                className="mb-3 flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold"
                style={{ background: '#FEF3C7', color: '#92400E' }}
              >
                #2
              </div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: '#D97706' }}>
                NEXT PRIORITY
              </div>
              <h3 className="mb-2 text-base font-bold leading-snug text-slate-900">
                Strengthen cash flow by $1,056 per month at 19 Barley Street
              </h3>
              <p className="text-sm leading-relaxed text-slate-500">
                Restoring this monthly cash flow strengthens portfolio resilience and creates
                surplus to redeploy toward your next acquisition.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {['+$12,672 per year', '+$1,056 per month'].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full px-3 py-1 text-xs font-bold"
                    style={{ background: '#FEF3C7', color: '#92400E' }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <img
            src="/screenshots/refinance-card-updated.webp"
            alt="Vaulta refinance opportunity showing $3,540 annual saving"
            loading="lazy"
            className="mb-5 w-full rounded-xl"
          />

          <div className="flex flex-col gap-6 rounded-2xl bg-slate-50 p-7 lg:flex-row lg:items-center">
            <div className="flex-1">
              <div className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: '#085041' }}>
                TAX AND CASH FLOW
              </div>
              <h3 className="mb-2 text-lg font-bold text-slate-900">
                What your strategy actually costs to hold each month
              </h3>
              <p className="text-sm leading-relaxed text-slate-500">
                Pre-tax drag, ATO benefit, and true after-tax holding cost. Calculated using
                Australian tax brackets.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="min-w-[90px] rounded-xl border border-slate-200 bg-white p-4 text-center">
                <div className="text-xs font-semibold text-slate-400">PRE-TAX</div>
                <div className="text-3xl font-extrabold" style={{ color: '#EF4444' }}>
                  -$1,035
                </div>
              </div>
              <div className="min-w-[90px] rounded-xl p-4 text-center" style={{ background: '#E8F6EF' }}>
                <div className="text-xs font-semibold" style={{ color: '#085041' }}>
                  ATO BENEFIT
                </div>
                <div className="text-3xl font-extrabold" style={{ color: '#19C37D' }}>
                  +$466
                </div>
              </div>
              <div className="min-w-[90px] rounded-xl p-4 text-center" style={{ background: '#FFFBEB' }}>
                <div className="text-xs font-semibold" style={{ color: '#92400E' }}>
                  NET COST
                </div>
                <div className="text-3xl font-extrabold" style={{ color: '#D97706' }}>
                  -$569
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-20 md:px-10 lg:px-14" style={{ background: '#F6FBF8' }}>
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-13">
          <div>
            <SectionBadge>Decision Engine</SectionBadge>
            <h2 className="mb-4 mt-5 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
              Know what you can do next, before you commit
            </h2>
            <p className="text-lg leading-relaxed text-slate-500 md:text-xl">
              Borrowing power, acquisition feasibility, and execution readiness. All from your
              real numbers, not generic estimates.
            </p>
            <div className="mt-6 flex flex-col gap-5">
              {[
                ['💡', 'Can I buy now?', 'A clear yes or no, with the exact price range you can safely target today.'],
                ['💰', 'What deposit do I need?', 'Available capital versus required. See whether you clear the upfront hurdle.'],
                ['📈', 'What happens after I buy?', 'Cash flow, surplus impact, and 10-year equity trajectory modelled in advance.'],
              ].map(([icon, title, body]) => (
                <div key={title} className="flex items-start gap-4">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
                    style={{ background: '#E8F6EF' }}
                  >
                    {icon}
                  </div>
                  <div>
                    <div className="mb-1 text-base font-bold text-slate-900">{title}</div>
                    <div className="text-sm leading-relaxed text-slate-500">{body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-8 shadow-2xl" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}>
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#085041' }}>
              EXECUTION READINESS
            </div>
            <h3 className="mb-5 mt-2 text-lg font-bold text-slate-900">
              Can this strategy be executed right now?
            </h3>
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl p-5 text-center" style={{ background: '#E8F6EF' }}>
                <div className="mb-1 text-xs font-bold" style={{ color: '#085041' }}>
                  AVAILABLE
                </div>
                <div className="text-4xl font-extrabold" style={{ color: '#085041' }}>
                  $139k
                </div>
                <div className="mt-1 text-xs" style={{ color: '#085041' }}>
                  After buffers
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-5 text-center">
                <div className="mb-1 text-xs font-bold text-slate-400">REQUIRED</div>
                <div className="text-4xl font-extrabold text-slate-900">$125k</div>
                <div className="mt-1 text-xs text-slate-400">Deposit and costs</div>
              </div>
              <div className="rounded-xl p-5 text-center" style={{ background: '#E8F6EF' }}>
                <div className="mb-1 text-xs font-bold" style={{ color: '#085041' }}>
                  SURPLUS
                </div>
                <div className="text-4xl font-extrabold" style={{ color: '#19C37D' }}>
                  $14.5k
                </div>
                <div className="mt-1 text-xs" style={{ color: '#085041' }}>
                  Clears hurdle
                </div>
              </div>
            </div>

            <div className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
              COMPARE YOUR PATHS
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4 text-center">
                <div className="mb-1 text-xs text-slate-400">Do nothing</div>
                <div className="text-lg font-extrabold text-slate-900">$673k</div>
                <div className="mt-1 text-xs text-slate-400">Borrowing today</div>
              </div>
              <div
                className="rounded-xl p-4 text-center outline outline-2"
                style={{ background: '#E8F6EF', outlineColor: '#19C37D' }}
              >
                <div className="mb-1 text-xs" style={{ color: '#085041' }}>
                  Apply action
                </div>
                <div className="text-lg font-extrabold" style={{ color: '#19C37D' }}>
                  $712k
                </div>
                <div className="mt-1 text-xs" style={{ color: '#19C37D' }}>
                  +$39k uplift
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-center">
                <div className="mb-1 text-xs text-slate-400">Buy now</div>
                <div className="text-lg font-extrabold" style={{ color: '#EF4444' }}>
                  -$25k/yr
                </div>
                <div className="mt-1 text-xs text-slate-400">Cash flow risk</div>
              </div>
            </div>

            <div
              className="mt-3 flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between"
              style={{ background: '#F0FDF8' }}
            >
              <div className="text-sm font-semibold" style={{ color: '#085041' }}>
                Available capital clears the upfront hurdle with $14,500 to spare
              </div>
              <span
                className="inline-flex w-fit flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-extrabold"
                style={{ background: '#19C37D', color: '#071C17' }}
              >
                Viable now
              </span>
            </div>

            <img
              src="/screenshots/execution-readiness.webp"
              alt="Vaulta execution readiness showing available versus required capital"
              loading="lazy"
              className="mt-4 w-full rounded-xl"
            />
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto mb-11 max-w-5xl text-center">
          <SectionBadge>Portfolio Command Centre</SectionBadge>
          <h2 className="mb-4 mt-5 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
            Your entire portfolio. Finally in one place.
          </h2>
          <p className="mx-auto max-w-lg text-lg leading-relaxed text-slate-500 md:text-xl">
            Properties, mortgages, cash flow, equity, and alerts. All connected in one intelligent
            platform.
          </p>
        </div>

        <div className="mx-auto mb-4 grid max-w-5xl grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-6">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">NET POSITION</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">Net Equity</div>
            <div className="mb-3 mt-2 text-5xl font-extrabold tracking-tight text-slate-900">$576,500</div>
            <div
              className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: '#E8F6EF', color: '#085041' }}
            >
              Assets minus total debt
            </div>
            <div className="mb-1 mt-4 flex justify-between text-sm text-slate-600">
              <span>19 Barley Street</span>
              <span>$206,500</span>
            </div>
            <div className="mb-1 flex justify-between text-sm text-slate-600">
              <span>54 Ingleburn Gardens</span>
              <span>$370,000</span>
            </div>
            <div className="mt-3 h-1 rounded" style={{ background: '#E8F6EF' }}>
              <div className="h-1 rounded" style={{ width: '65%', background: '#19C37D' }} />
            </div>
            <div className="mt-1 flex justify-between text-xs text-slate-400">
              <span>LVR</span>
              <span>Target 60%</span>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-6">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">MONTHLY POSITION</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">Current monthly surplus</div>
            <div className="mb-3 mt-2 text-5xl font-extrabold tracking-tight text-slate-900">$6,058</div>
            <div
              className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: '#E8F6EF', color: '#085041' }}
            >
              After-tax household surplus
            </div>
            <div className="mb-1 mt-4 flex justify-between text-sm text-slate-600">
              <span>Portfolio cash flow</span>
              <span style={{ color: '#EF4444' }}>-$1,056</span>
            </div>
            <div className="mb-1 flex justify-between text-sm text-slate-600">
              <span>ATO benefit offset</span>
              <span style={{ color: '#19C37D' }}>+$466</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>Net holding cost</span>
              <span style={{ color: '#D97706' }}>-$569/mo</span>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-6">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">BORROWING POWER</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">Capacity</div>
            <div className="mb-3 mt-2 text-5xl font-extrabold tracking-tight text-slate-900">$673,938</div>
            <div
              className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: '#E8F6EF', color: '#085041' }}
            >
              +$39,016 unlock available
            </div>
            <div className="mb-1 mt-4 flex justify-between text-sm text-slate-600">
              <span>Unlock via card limits</span>
              <span style={{ color: '#19C37D' }}>$39,016</span>
            </div>
            <div className="mb-1 flex justify-between text-sm text-slate-600">
              <span>Post-unlock total</span>
              <span style={{ color: '#19C37D' }}>$712,954</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>Assessment rate</span>
              <span>8.5%</span>
            </div>
          </div>
        </div>

        <div className="mx-auto mb-4 grid max-w-5xl grid-cols-1 gap-3 md:grid-cols-2">
          <div
            className="flex flex-col gap-3 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between"
            style={{ background: '#F0FDF8', borderColor: '#BBF7D0' }}
          >
            <div>
              <div className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: '#19C37D' }}>
                RATE RESILIENCE
              </div>
              <div className="text-sm font-bold text-slate-900">
                No stress break point found within the tested range
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Safe headroom across all rate scenarios tested
              </div>
            </div>
            <div className="ml-0 text-3xl font-extrabold sm:ml-4" style={{ color: '#19C37D' }}>
              &gt;10%
            </div>
          </div>
        </div>

        <img
          src="/screenshots/equity-chart.webp"
          alt="Vaulta 30-year portfolio equity projection chart"
          loading="lazy"
          className="mx-auto mt-0 block w-full max-w-5xl rounded-2xl"
        />
        <img
          src="/screenshots/fixed-rate-alert-updated.webp"
          alt="Vaulta fixed rate expiry alert strip"
          loading="lazy"
          className="mx-auto mt-3 block w-full max-w-5xl rounded-xl"
        />
      </section>

      <section id="pricing" className="px-6 py-20 md:px-10 lg:px-14" style={{ background: '#F6FBF8' }}>
        <div className="mx-auto max-w-3xl text-center">
          <SectionBadge>Pricing</SectionBadge>
          <h2 className="mb-4 mt-5 text-4xl font-extrabold tracking-tight md:text-5xl">
            Simple, transparent pricing
          </h2>
          <p className="mb-13 text-lg leading-relaxed text-slate-500 md:text-xl">
            Built for Australian property investors. 14-day free trial on all plans. No lock-in.
            Cancel anytime.
          </p>
          <div className="grid grid-cols-1 gap-6 text-left md:grid-cols-2 lg:grid-cols-3">
            {pricingPlans.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-3xl p-10 ${plan.featured ? 'outline outline-2' : ''}`}
                style={{
                  background: plan.featured ? '#FAFFFC' : '#FFFFFF',
                  outlineColor: plan.featured ? '#19C37D' : 'transparent',
                }}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {plan.name.toUpperCase()}
                  </div>
                  {plan.featured ? (
                    <div
                      className="rounded-full px-3.5 py-1.5 text-xs font-extrabold"
                      style={{ background: '#19C37D', color: '#071C17' }}
                    >
                      Most popular
                    </div>
                  ) : null}
                </div>
                <div className="flex items-end gap-2">
                  <div className="text-6xl font-extrabold tracking-tight" style={{ color: '#0F172A' }}>
                    {plan.price}
                  </div>
                  <div className="text-2xl font-normal text-slate-400">{plan.interval}</div>
                </div>
                <p className="mb-7 mt-5 text-sm leading-relaxed text-slate-500">{plan.description}</p>
                <div className="flex flex-col gap-3.5">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-3 text-sm text-slate-700">
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-extrabold"
                        style={{ background: '#E8F6EF', color: '#19C37D' }}
                      >
                        ✓
                      </span>
                      {feature}
                    </div>
                  ))}
                </div>
                <a
                  href={`/auth?plan=${plan.id}`}
                  className={`mt-8 block w-full rounded-xl py-4 text-center text-sm font-extrabold no-underline ${
                    plan.featured ? '' : 'border-2'
                  }`}
                  style={{
                    background: plan.featured ? '#19C37D' : 'transparent',
                    color: plan.featured ? '#071C17' : '#19C37D',
                    borderColor: plan.featured ? 'transparent' : '#19C37D',
                  }}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-2xl">
          <div className="text-center">
            <SectionBadge>FAQ</SectionBadge>
            <h2 className="mb-4 mt-5 text-4xl font-extrabold tracking-tight md:text-5xl">
              Got questions? We have answers.
            </h2>
            <p className="mb-12 text-lg leading-relaxed text-slate-500">
              Everything you need to know before getting started.
            </p>
          </div>

          <div>
            {faqItems.map((item, index) => {
              const isOpen = openIndex === index

              return (
                <div
                  key={item.q}
                  className={`border-t ${index === faqItems.length - 1 ? 'border-b' : ''}`}
                  style={{ borderColor: '#E8F6EF' }}
                >
                  <button
                    type="button"
                    onClick={() => toggle(index)}
                    className="flex w-full items-center justify-between bg-transparent py-5 text-left outline-none"
                  >
                    <span className="text-base font-bold text-slate-900">{item.q}</span>
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full text-lg font-bold transition-transform duration-200"
                      style={{
                        background: '#E8F6EF',
                        color: '#19C37D',
                        transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                      }}
                    >
                      +
                    </span>
                  </button>
                  {isOpen ? (
                    <div className="pb-5 text-sm leading-relaxed text-slate-500">{item.a}</div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section
        className="px-6 py-24 text-center md:px-10 lg:px-14"
        style={{
          background: '#071C17',
          backgroundImage:
            'radial-gradient(ellipse 60% 80% at 50% 0%, #0B2B23 0%, transparent 65%)',
        }}
      >
        <h2 className="mb-5 text-4xl font-extrabold leading-tight tracking-tight text-white md:text-5xl lg:text-6xl">
          Stop guessing.
          <br />
          <em style={{ color: '#19C37D', fontStyle: 'normal' }}>Start knowing.</em>
        </h2>
        <p className="mx-auto mb-10 max-w-lg text-lg leading-relaxed md:text-xl" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Join Australian property investors who are making decisions with real numbers, not
          guesswork.
        </p>
        <a
          href="#pricing"
          className="inline-flex rounded-xl px-10 py-5 text-lg font-extrabold no-underline"
          style={{ background: '#19C37D', color: '#071C17' }}
        >
          Start free trial →
        </a>
        <p className="mt-5 text-xs tracking-wide" style={{ color: 'rgba(255,255,255,0.18)' }}>
          No credit card required · Cancel anytime · Australian-built
        </p>
      </section>

      <section
        className="px-6 py-6 md:px-10 lg:px-14"
        style={{
          background: '#F6FBF8',
          borderTop: '1px solid #DCEFE5',
          borderBottom: '1px solid #DCEFE5',
        }}
      >
        <div className="mx-auto max-w-4xl text-center text-xs leading-relaxed text-slate-400">
          General information only. Vaulta provides informational insights based on user-supplied
          data and indicative market benchmarks. Outputs do not constitute financial, investment,
          tax, or lending advice. Figures shown are illustrative estimates and subject to lender
          assessment and market conditions. Always consult a licensed financial adviser, mortgage
          broker, or accountant before making investment decisions. Vaulta is not an Australian
          Financial Services Licence holder.
        </div>
      </section>

      <footer className="px-6 pb-8 pt-12 md:px-10 lg:px-14" style={{ background: '#071C17' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-1">
              <div className="mb-3 text-xl font-extrabold" style={{ color: '#19C37D' }}>
                Vaulta
              </div>
              <p className="mb-5 max-w-xs text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Intelligent property portfolio intelligence for Australian investors. Track
                everything, understand your numbers, and uncover opportunities to save.
              </p>
              <div
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  borderColor: 'rgba(25,195,125,0.15)',
                  color: '#5DCAA5',
                }}
              >
                <span className="h-[5px] w-[5px] rounded-full" style={{ background: '#19C37D' }} />
                Australian-built · RBA-aware
              </div>
            </div>

            {[
              ['PRODUCT', ['Features', 'How it works', 'Pricing', 'FAQ', 'Start free trial']],
              ['LEGAL', ['Privacy Policy', 'Terms of Use', 'Disclaimer', 'Cookie Policy']],
              ['SUPPORT', ['Contact us', 'support@vaulta.com.au', 'Report an issue']],
            ].map(([title, links]) => (
              <div key={title}>
                <div
                  className="mb-4 text-xs font-bold uppercase tracking-widest"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                >
                  {title}
                </div>
                <div className="flex flex-col gap-2.5">
                  {links.map((link) => (
                    <a
                      key={link}
                      href={
                        link === 'How it works'
                          ? '/how-it-works'
                          : link === 'Features'
                            ? '#features'
                            : link === 'Pricing'
                              ? '#pricing'
                              : link === 'FAQ'
                                ? '#faq'
                                : link === 'Start free trial'
                                  ? '/auth'
                                  : link === 'Privacy Policy'
                                    ? '/privacy'
                                    : link === 'Terms of Use'
                                      ? '/terms'
                                      : link === 'Disclaimer'
                                        ? '/terms'
                                        : link === 'Cookie Policy'
                                          ? '/privacy'
                                          : link === 'Contact us'
                                            ? '/contact'
                                            : link === 'support@vaulta.com.au'
                                              ? 'mailto:support@vaulta.com.au'
                                              : link === 'Report an issue'
                                                ? '/contact'
                                                : '#'
                      }
                      className="text-sm no-underline"
                      style={{ color: 'rgba(255,255,255,0.45)' }}
                    >
                      {link}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div
            className="flex flex-col gap-4 border-t pt-6 text-xs md:flex-row md:items-center md:justify-between"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}
          >
            <div style={{ color: 'rgba(255,255,255,0.2)' }}>
              © 2026 Vaulta. All rights reserved. Australian-built for Australian property
              investors.
            </div>
            <div className="flex gap-5">
              {['Privacy', 'Terms', 'Disclaimer'].map((link) => (
                <a
                  key={link}
                  href={link === 'Privacy' ? '/privacy' : '/terms'}
                  className="no-underline"
                  style={{ color: 'rgba(255,255,255,0.2)' }}
                >
                  {link}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Landing
