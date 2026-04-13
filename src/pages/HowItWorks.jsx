const stepNavItems = [
  ['Setup', '#step-1'],
  ['Tax intelligence', '#step-2'],
  ['Stress testing', '#step-3'],
  ['Alerts', '#step-4'],
  ['Decision engine', '#step-5'],
]

const steps = [
  {
    id: 'step-1',
    number: '1',
    tag: 'SETUP',
    title: 'Add your portfolio numbers',
    background: '#FFFFFF',
    body:
      'Vaulta does not connect to your bank account. You enter your real numbers directly — giving you full control over what is modelled and ensuring nothing is missed or misread.',
    bullets: [
      'Properties and current market values',
      'Mortgage balances, interest rates, and loan types',
      'Rental income and property expenses',
      'Household income and living costs',
      'Personal liabilities and credit card limits',
    ],
    screenshots: [
      {
        src: '/screenshots/hero-dashboard.webp',
        alt: 'Vaulta dashboard showing acquisition readiness and portfolio position',
        loading: 'eager',
      },
    ],
  },
  {
    id: 'step-2',
    number: '2',
    tag: 'INTELLIGENCE',
    title: 'Understand your true financial position',
    background: '#F6FBF8',
    body:
      'Most investors have no idea what their property actually costs them after tax. Vaulta calculates your after-tax holding cost, tax benefit from negative gearing, and the real impact of depreciation on your position — adjusted for your specific ownership structure.',
    sections: [
      {
        heading: 'Tax modelling that reflects your reality',
        body:
          "Whether you own individually or jointly, Vaulta applies the correct tax bracket to each owner's share of the investment. A property owned jointly 50/50 is taxed differently than one owned 100% by the higher-income earner — and that difference matters significantly for your real holding cost.",
      },
      {
        heading: 'Depreciation — the often-missed tax advantage',
        body:
          'Vaulta lets you include non-cash depreciation in your tax calculation. Depreciation reduces your taxable income without costing you cash, improving your ATO benefit and lowering your true net monthly holding cost. Most investors either forget this or guess at the number.',
      },
    ],
    bullets: [
      'Pre-tax cash flow across your full portfolio',
      'ATO tax benefit including depreciation effect',
      'True net monthly holding cost after all offsets',
      'Individual vs joint ownership tax modelling',
      'Income-aware marginal rate for each owner',
    ],
    screenshots: [
      {
        src: '/screenshots/tax-cashflow.webp',
        alt: 'Vaulta tax and cash flow showing pre-tax loss, ATO benefit, and net holding cost',
        loading: 'lazy',
      },
      {
        src: '/screenshots/tax-settings.webp',
        alt: 'Vaulta tax ownership settings showing joint ownership split and depreciation',
        loading: 'lazy',
      },
    ],
  },
  {
    id: 'step-3',
    number: '3',
    tag: 'STRESS TESTING',
    title: 'Know your breaking point before markets move',
    background: '#FFFFFF',
    body:
      'Rising interest rates compress borrowing power and monthly surplus faster than most investors realise. Vaulta models your portfolio across multiple rate scenarios so you understand your risk exposure before a lender assessment makes it real.',
    sections: [
      {
        heading: 'Rate sensitivity analysis',
        body:
          'See how your borrowing capacity changes as assessment rates move from 7% to 9.5%. Understand how quickly your purchase range compresses under tighter lending conditions.',
      },
      {
        heading: 'Serviceability under stress',
        body:
          'Model your monthly surplus across a range of interest rates. Find the rate at which your cash flow turns negative and your portfolio starts losing resilience. This is your real risk threshold — not a broker estimate.',
      },
      {
        heading: 'Deposit structure versus purchase power',
        body:
          'Test whether a lower deposit genuinely expands your price range or simply shifts the binding constraint back to borrowing capacity. Not all deposit strategies improve your outcome.',
      },
    ],
    bullets: [
      'Borrowing capacity across interest rate scenarios',
      'Monthly surplus under rate stress',
      'Deposit structure versus purchase power analysis',
      'Rate resilience score and safe headroom',
    ],
    screenshots: [
      {
        src: '/screenshots/execution-readiness.webp',
        alt: 'Vaulta execution readiness showing available versus required capital',
        loading: 'lazy',
      },
    ],
  },
  {
    id: 'step-4',
    number: '4',
    tag: 'ALERTS',
    title: 'Receive proactive intelligence before it matters',
    background: '#F6FBF8',
    body:
      'Vaulta does not wait for you to log in and check. It monitors your portfolio continuously and sends personalised alerts when something requires your attention — before it impacts your cash flow or borrowing position.',
    sections: [
      {
        heading: 'RBA rate decision alerts',
        body:
          'When the Reserve Bank of Australia moves the cash rate, Vaulta calculates the exact dollar impact on each of your variable loans and delivers a personalised email the same day. Not generic market commentary. Your numbers, your properties, your repayments.',
      },
      {
        heading: 'Fixed rate expiry campaign',
        body:
          'Vaulta tracks every fixed rate loan in your portfolio and triggers a multi-touchpoint email campaign starting 45 days before expiry. You receive reminders at 45, 30, and 14 days — giving you time to compare refinancing options before the rate automatically reverts.',
      },
      {
        heading: 'Refinancing opportunity detection',
        body:
          'Vaulta continuously compares your current rates against market benchmarks. When a material gap is identified, it surfaces an opportunity showing estimated monthly saving, annual saving, and break-even period — specific to your loan.',
      },
    ],
    bullets: [
      'RBA alerts with per-property dollar impact',
      'Fixed rate expiry at 45, 30, and 14 days',
      'Refinancing opportunities versus market benchmarks',
      'AI-generated personalised narratives by property',
    ],
    screenshots: [
      {
        src: '/screenshots/rba-intelligence-updated.webp',
        alt: 'Vaulta RBA intelligence alert showing personalised rate impact by property',
        loading: 'lazy',
      },
      {
        src: '/screenshots/fixed-rate-alert-updated.webp',
        alt: 'Vaulta fixed rate expiry alert',
        loading: 'lazy',
      },
    ],
  },
  {
    id: 'step-5',
    number: '5',
    tag: 'DECISION ENGINE',
    title: 'Model your next acquisition before you commit',
    background: '#FFFFFF',
    body:
      'When you are ready to grow your portfolio, Vaulta builds a complete acquisition scenario from your real inputs. It shows your executable price range, required deposit, post-purchase cash flow, and projected equity trajectory — so you can see the full picture before you approach a broker or make an offer.',
    sections: [
      {
        heading: 'Scenario modelling with real assumptions',
        body:
          'Model acquisitions across different deposit strategies — 5%, 10%, or 20% — and see whether a lower deposit genuinely expands your price range or shifts the constraint to borrowing capacity. Test different annual growth assumptions and view your projected portfolio wealth at 10, 20, and 30 years.',
      },
      {
        heading: 'Execution readiness check',
        body:
          'Vaulta compares your available deployable capital against the full upfront requirement — deposit plus stamp duty and acquisition costs. You see immediately whether your current capital clears the hurdle.',
      },
      {
        heading: 'Trade-off comparison',
        body:
          'Compare three paths side by side: do nothing, apply the top recommended action, or buy now. Each path shows borrowing capacity, cash flow impact, and risk level — so you can make an informed choice rather than a gut-feel one.',
      },
    ],
    bullets: [
      'Executable purchase price range',
      'Required deposit and available capital check',
      'Post-acquisition monthly surplus',
      'Year 3, 5, and 10 equity trajectory',
      'Deposit strategy comparison',
      'Do nothing vs act vs buy now trade-off',
    ],
    screenshots: [
      {
        src: '/screenshots/hero-dashboard.webp',
        alt: 'Vaulta acquisition decision showing price range and readiness score',
        loading: 'lazy',
      },
      {
        src: '/screenshots/equity-chart.webp',
        alt: 'Vaulta 30-year portfolio equity projection',
        loading: 'lazy',
      },
    ],
  },
]

function StepSection({ step }) {
  return (
    <section id={step.id} className="px-8 py-16" style={{ background: step.background }}>
      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <div
            className="mb-6 flex h-12 w-12 items-center justify-center rounded-full text-lg font-extrabold"
            style={{ background: '#E8F6EF', color: '#085041' }}
          >
            {step.number}
          </div>
          <div className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: '#19C37D' }}>
            {step.tag}
          </div>
          <h2 className="mb-4 text-2xl font-extrabold tracking-tight" style={{ color: '#0F172A' }}>
            {step.title}
          </h2>
          <p className="mb-4 text-base leading-relaxed" style={{ color: '#475569' }}>
            {step.body}
          </p>

          {step.sections?.map((section) => (
            <div key={section.heading}>
              <h3 className="mb-2 mt-5 text-sm font-bold" style={{ color: '#0F172A' }}>
                {section.heading}
              </h3>
              <p className="text-base leading-relaxed" style={{ color: '#475569' }}>
                {section.body}
              </p>
            </div>
          ))}

          <div className="mt-5 space-y-1">
            {step.bullets.map((item) => (
              <div key={item} className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                <span
                  className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ background: '#19C37D' }}
                />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {step.screenshots.map((screenshot) => (
            <img
              key={screenshot.src}
              src={screenshot.src}
              alt={screenshot.alt}
              className="w-full rounded-2xl"
              loading={screenshot.loading}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-white">
      <nav
        className="flex h-[66px] items-center justify-between px-6 md:px-10 lg:px-14"
        style={{ background: '#071C17' }}
      >
        <a href="/" className="text-xl font-extrabold no-underline" style={{ color: '#19C37D' }}>
          Vaulta
        </a>
        <div className="flex items-center">
          <a
            href="/"
            className="mr-4 text-sm no-underline md:mr-6"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            Back to home
          </a>
          <a
            href="/auth"
            className="mr-4 text-sm no-underline md:mr-6"
            style={{ color: 'rgba(255,255,255,0.5)' }}
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
        className="px-8 py-20 text-center"
        style={{
          background: '#071C17',
          backgroundImage:
            'radial-gradient(ellipse 60% 60% at 60% 30%, #0B2B23 0%, transparent 65%)',
        }}
      >
        <div
          className="mb-6 inline-flex rounded-full border px-4 py-2 text-xs font-semibold"
          style={{
            background: 'rgba(25,195,125,0.1)',
            borderColor: 'rgba(25,195,125,0.2)',
            color: '#19C37D',
          }}
        >
          How Vaulta works
        </div>
        <h1 className="mx-auto mb-5 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight text-white md:text-5xl">
          From portfolio setup to
          <br />
          confident decisions
        </h1>
        <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed md:text-xl" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Vaulta turns your property data into a decision-grade financial model in minutes. No
          bank connections. No spreadsheets. No guesswork.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {[
            'Built for Australian investors',
            'Lender-grade calculations',
            'AI-powered intelligence',
          ].map((pill) => (
            <div
              key={pill}
              className="rounded-full border px-4 py-2 text-xs"
              style={{
                background: 'rgba(255,255,255,0.05)',
                borderColor: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              {pill}
            </div>
          ))}
        </div>
      </section>

      <section
        className="sticky top-0 z-50 border-b bg-white px-8 py-3"
        style={{ borderColor: '#E8F6EF' }}
      >
        <div className="mx-auto flex max-w-4xl flex-nowrap items-center justify-start gap-2 overflow-x-auto md:flex-wrap md:justify-center">
          {stepNavItems.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="rounded-full border px-4 py-2 text-xs font-semibold no-underline whitespace-nowrap transition-colors"
              style={{ borderColor: '#E8F6EF', color: '#475569' }}
            >
              {label}
            </a>
          ))}
        </div>
      </section>

      {steps.map((step) => (
        <StepSection key={step.id} step={step} />
      ))}

      <section
        className="px-8 py-20 text-center"
        style={{
          background: '#071C17',
          backgroundImage:
            'radial-gradient(ellipse 60% 80% at 50% 0%, #0B2B23 0%, transparent 65%)',
        }}
      >
        <h2 className="mb-5 text-4xl font-extrabold tracking-tight text-white md:text-5xl">
          Ready to see your portfolio clearly?
        </h2>
        <p className="mx-auto mb-10 max-w-lg text-lg leading-relaxed md:text-xl" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Join Australian property investors who are making decisions with real numbers, not
          guesswork.
        </p>
        <a
          href="/auth"
          className="inline-flex rounded-xl px-10 py-5 text-lg font-extrabold no-underline"
          style={{ background: '#19C37D', color: '#071C17' }}
        >
          Start free trial →
        </a>
        <p className="mt-5 text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          No credit card required · Cancel anytime · Australian-built
        </p>
      </section>

      <footer className="px-14 py-8 text-center text-xs" style={{ background: '#071C17', color: 'rgba(255,255,255,0.2)' }}>
        © 2026 Vaulta. All rights reserved.
      </footer>
    </div>
  )
}
