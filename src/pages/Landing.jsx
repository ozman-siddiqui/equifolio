import { useEffect, useState } from 'react'
import { Wallet, Target, PiggyBank, LineChart } from 'lucide-react'

const faqItems = [
  {
    q: 'What is Nextiq?',
    a: 'Nextiq is an intelligent property portfolio platform built for Australian investors with 1 to 5 properties. It brings your properties, loans, cash flow, and household financials into one place, then helps you understand your real position, identify potential savings opportunities, and review what the model suggests for your next property scenario.',
  },
  {
    q: 'Is Nextiq financial advice?',
    a: 'No. Nextiq provides general informational insights only and does not constitute financial, tax, investment, or lending advice. All outputs are illustrative estimates based on your inputs and indicative market benchmarks. Before making any investment or borrowing decisions, we recommend consulting a licensed financial adviser, mortgage broker, or accountant.',
  },
  {
    q: 'How does Nextiq calculate borrowing capacity?',
    a: 'Nextiq uses a lender-style serviceability model based on your household income, living expenses, existing loan repayments, credit card limits, and liabilities. It applies the standard APRA assessment rate buffer of 3% above the loan rate, which is how Australian lenders stress-test your repayments. The result is an indicative borrowing estimate, not a formal credit assessment.',
  },
  {
    q: 'Can I track multiple properties?',
    a: 'Yes. Nextiq is designed for investors with 1 to 5 properties. The Starter plan supports up to 3 properties. The Investor plan supports unlimited properties. Each property can have its own loan details, cash flow transactions, and mortgage tracking.',
  },
  {
    q: 'How does the RBA intelligence work?',
    a: 'When the Reserve Bank of Australia announces a rate decision, Nextiq automatically calculates the dollar impact on your specific variable loans, property by property. A personalised AI-generated summary is delivered to your inbox the same day, referencing your actual property addresses and repayment figures. The intelligence is powered by Anthropic Claude.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. Nextiq is built on Supabase, which uses PostgreSQL with Row Level Security enforced at the database level. This means your data is isolated at the infrastructure layer, not just in application code. Nextiq does not connect to your bank accounts and does not store login credentials. All data you enter is used only to generate your portfolio insights.',
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
    cta: 'See your numbers',
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
    cta: 'See your numbers',
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
    cta: 'See your numbers',
    featured: false,
  },
]

const navLinks = [
  ['Features', '/features'],
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

  useEffect(() => {
    if (window.location.hash === '#faq') {
      const scrollToFaq = () => {
        const el = document.getElementById('faq')
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }

      setTimeout(scrollToFaq, 0)
      setTimeout(scrollToFaq, 300)
    }
  }, [])

  return (
    <div className="min-h-screen bg-white" style={{ color: '#0F172A' }}>
      <nav
        className="flex h-[66px] items-center justify-between px-6 md:px-10 lg:px-14"
        style={{ background: '#071C17' }}
      >
        <a href="/" className="no-underline" style={{ fontSize: '20px', fontWeight: 500, letterSpacing: '-0.5px' }}>
          <span style={{ color: 'white' }}>next</span>
          <span style={{ color: '#1D9E75' }}>iq</span>
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
          Find out if you can afford your next property.<br />
          <em style={{ color: '#19C37D', fontStyle: 'normal' }}>
            See your real numbers instantly.
          </em>
        </h1>

        <p className="mx-auto mb-11 max-w-xl text-lg leading-relaxed md:text-xl" style={{ color: 'rgba(255,255,255,0.48)' }}>
          Track every property, loan, and dollar. Understand your real financial position. Spot
          potential savings opportunities before they pass you by.
        </p>

        <div className="mb-5 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href="/auth"
            className="rounded-xl px-9 py-4 text-base font-extrabold no-underline"
            style={{ background: '#19C37D', color: '#071C17' }}
          >
            {'See your numbers'}
          </a>
          <p style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.5)',
            marginTop: '10px',
            textAlign: 'center'
          }}>
            Free during early access · No credit check · No bank connection
          </p>
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
          No credit card required | Australian-built | Cancel anytime
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
            96% Scenario readiness
          </div>
          <img
            src="/screenshots/hero-dashboard-1604.webp"
            alt="Nextiq dashboard showing scenario readiness and indicative investment-property range"
            loading="eager"
            className="w-full rounded-t-3xl"
            style={{
              boxShadow:
                '0 -56px 140px rgba(0,0,0,0.75), 0 -12px 40px rgba(0,0,0,0.35)',
            }}
          />
        </div>
      </section>

      <div
        className="py-6 px-8 text-center"
        style={{
          background: '#0B2B23',
          borderTop: '1px solid rgba(25,195,125,0.12)',
          borderBottom: '1px solid rgba(25,195,125,0.12)',
        }}
      >
        <p
          className="text-sm font-medium tracking-wide max-w-3xl mx-auto mb-2"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          Trusted across growing 2-property portfolios through to complex{' '}
          <span style={{ color: '#19C37D', fontWeight: '600' }}>8-property</span>
          {' '}investment books with{' '}
          <span style={{ color: '#19C37D', fontWeight: '600' }}>$13M+</span>
          {' '}in assets and{' '}
          <span style={{ color: '#19C37D', fontWeight: '600' }}>$9M+</span>
          {' '}in equity.
        </p>
        <p
          className="text-xs tracking-wide"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          Built to scale from first investment property to sophisticated multi-asset portfolios.
        </p>
      </div>

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
            ['$13M+', 'Largest portfolio analysed', '#0F172A'],
            ['8', 'Properties managed in one view', '#0F172A'],
            ['$9M+', 'Net equity tracked in real time', '#19C37D'],
            ['$589/mo', 'RBA impact calculated instantly', '#0F172A'],
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

      <section style={{ background: '#F6FBF8' }} className="py-20 px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2
              className="text-4xl font-extrabold tracking-tight mb-4"
              style={{ color: '#0F172A' }}
            >
              Make better property decisions with real numbers
            </h2>
            <p
              className="text-xl leading-relaxed max-w-2xl mx-auto"
              style={{ color: '#475569' }}
            >
              Everything you need to understand your current position, your next move, and the
              risks before you act.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div
              className="rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 shadow-[0_8px_30px_rgba(7,28,23,0.06)] hover:shadow-[0_14px_40px_rgba(7,28,23,0.10)]"
              style={{ background: 'white', border: '1px solid #E8F2EC' }}
            >
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4 text-lg"
                style={{ background: '#E8F6EF', color: '#085041' }}
              >
                <Wallet size={20} strokeWidth={2.75} />
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: '#0F172A' }}>
                True equity position
              </h3>
              <p className="text-sm leading-relaxed mb-5" style={{ color: '#475569' }}>
                See your real net equity across every property, debt position, and live LVR ratio.
              </p>
              <p className="text-xs font-bold" style={{ color: '#19C37D' }}>
                $576k tracked live
              </p>
            </div>

            <div
              className="rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 shadow-[0_8px_30px_rgba(7,28,23,0.06)] hover:shadow-[0_14px_40px_rgba(7,28,23,0.10)]"
              style={{ background: 'white', border: '1px solid #E8F2EC' }}
            >
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4 text-lg"
                style={{ background: '#E8F6EF', color: '#085041' }}
              >
                <Target size={20} strokeWidth={2.75} />
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: '#0F172A' }}>
                Next acquisition range
              </h3>
              <p className="text-sm leading-relaxed mb-5" style={{ color: '#475569' }}>
                Review the property range the model currently indicates using lender-style serviceability rules.
              </p>
              <p className="text-xs font-bold" style={{ color: '#19C37D' }}>
                $523k to $605k indicated
              </p>
            </div>

            <div
              className="rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 shadow-[0_8px_30px_rgba(7,28,23,0.06)] hover:shadow-[0_14px_40px_rgba(7,28,23,0.10)]"
              style={{ background: 'white', border: '1px solid #E8F2EC' }}
            >
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4 text-lg"
                style={{ background: '#E8F6EF', color: '#085041' }}
              >
                <PiggyBank size={20} strokeWidth={2.75} />
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: '#0F172A' }}>
                Money leak detection
              </h3>
              <p className="text-sm leading-relaxed mb-5" style={{ color: '#475569' }}>
                Spot refinancing gaps, rate risk, and unused credit limit drag before it costs you
                money.
              </p>
              <p className="text-xs font-bold" style={{ color: '#19C37D' }}>
                $7,090 identified on average
              </p>
            </div>

            <div
              className="rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 shadow-[0_8px_30px_rgba(7,28,23,0.06)] hover:shadow-[0_14px_40px_rgba(7,28,23,0.10)]"
              style={{ background: 'white', border: '1px solid #E8F2EC' }}
            >
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4 text-lg"
                style={{ background: '#E8F6EF', color: '#085041' }}
              >
                <LineChart size={20} strokeWidth={2.75} />
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: '#0F172A' }}>
                Long-term wealth path
              </h3>
              <p className="text-sm leading-relaxed mb-5" style={{ color: '#475569' }}>
                Compare 5, 10, and 30-year outcomes before committing to your next move.
              </p>
              <p className="text-xs font-bold" style={{ color: '#19C37D' }}>
                30-year projection engine
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Case Study Section */}
      <section style={{ background: '#0A0F0D', padding: 'clamp(80px, 10vw, 120px) 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

          <div style={{ textAlign: 'center', marginBottom: '72px' }}>
            <p style={{
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#1D9E75',
              marginBottom: '20px'
            }}>
              Real Portfolio Snapshot | Sydney, Australia
            </p>

            <h2 style={{
              fontSize: 'clamp(32px, 5vw, 52px)',
              fontWeight: 500,
              letterSpacing: '-1.5px',
              lineHeight: 1.1,
              color: 'white',
              maxWidth: '800px',
              margin: '0 auto 24px'
            }}>
              What the model surfaced in one session
            </h2>

            <p style={{
              fontSize: '18px',
              lineHeight: 1.7,
              color: 'rgba(255,255,255,0.5)',
              maxWidth: '560px',
              margin: '0 auto'
            }}>
              A real investor portfolio. Three signals that were not being
              tracked in spreadsheets. All surfaced in the first session.
            </p>
          </div>

          <div style={{
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '28px',
            padding: 'clamp(40px, 6vw, 72px)',
            background: 'rgba(255,255,255,0.03)',
            marginBottom: '24px'
          }}>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '48px',
              paddingBottom: '48px',
              borderBottom: '1px solid rgba(255,255,255,0.08)'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'rgba(29,158,117,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: '#1D9E75'
                }} />
              </div>

              <div>
                <p style={{
                  fontSize: '15px',
                  fontWeight: 500,
                  color: 'white',
                  marginBottom: '4px'
                }}>
                  Real investor portfolio snapshot
                </p>

                <p style={{
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.4)'
                }}>
                  8 properties | $13.5M gross portfolio | Based on an anonymised live beta portfolio
                </p>
              </div>
            </div>

            <p style={{
              fontSize: 'clamp(16px, 2vw, 20px)',
              lineHeight: 1.75,
              color: 'rgba(255,255,255,0.6)',
              fontWeight: 400,
              marginBottom: '48px',
              maxWidth: '760px'
            }}>
              In one session, Nextiq surfaced three portfolio signals that were
              not being tracked in spreadsheets.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '16px',
              marginBottom: '56px'
            }}>

              <div style={{
                padding: '32px',
                borderRadius: '20px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)'
              }}>
                <p style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: '#1D9E75',
                  marginBottom: '16px'
                }}>
                  Signal 01 - Money leak
                </p>

                <p style={{
                  fontSize: 'clamp(36px, 5vw, 48px)',
                  fontWeight: 500,
                  letterSpacing: '-2px',
                  color: 'white',
                  lineHeight: 1,
                  marginBottom: '12px'
                }}>
                  $589
                  <span style={{
                    fontSize: '16px',
                    fontWeight: 400,
                    color: 'rgba(255,255,255,0.4)',
                    marginLeft: '6px'
                  }}>
                    /mo
                  </span>
                </p>

                <p style={{
                  fontSize: '14px',
                  lineHeight: 1.6,
                  color: 'rgba(255,255,255,0.5)'
                }}>
                  In portfolio leakage identified across loans and cash flow.
                </p>
              </div>

              <div style={{
                padding: '32px',
                borderRadius: '20px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)'
              }}>
                <p style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: '#1D9E75',
                  marginBottom: '16px'
                }}>
                  Signal 02 - Rate expiry
                </p>

                <p style={{
                  fontSize: 'clamp(36px, 5vw, 48px)',
                  fontWeight: 500,
                  letterSpacing: '-2px',
                  color: 'white',
                  lineHeight: 1,
                  marginBottom: '12px'
                }}>
                  47
                  <span style={{
                    fontSize: '16px',
                    fontWeight: 400,
                    color: 'rgba(255,255,255,0.4)',
                    marginLeft: '6px'
                  }}>
                    days
                  </span>
                </p>

                <p style={{
                  fontSize: '14px',
                  lineHeight: 1.6,
                  color: 'rgba(255,255,255,0.5)'
                }}>
                  Until two fixed rates were due to expire with no loan review plan in place.
                </p>
              </div>

              <div style={{
                padding: '32px',
                borderRadius: '20px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)'
              }}>
                <p style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: '#1D9E75',
                  marginBottom: '16px'
                }}>
                  Signal 03 - Scenario readiness
                </p>

                <p style={{
                  fontSize: 'clamp(36px, 5vw, 48px)',
                  fontWeight: 500,
                  letterSpacing: '-2px',
                  color: 'white',
                  lineHeight: 1,
                  marginBottom: '12px'
                }}>
                  $340K
                </p>

                <p style={{
                  fontSize: '14px',
                  lineHeight: 1.6,
                  color: 'rgba(255,255,255,0.5)'
                }}>
                  In capital position quantified for the first time.
                </p>
              </div>

            </div>

            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.08)',
              paddingTop: '40px',
              textAlign: 'center'
            }}>
              <p style={{
                fontSize: '13px',
                fontWeight: 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.25)',
                textAlign: 'center',
                marginBottom: '32px'
              }}>
                Scenario-ready without spreadsheet guesswork
              </p>
              <p style={{
                fontSize: 'clamp(20px, 3vw, 28px)',
                fontWeight: 500,
                letterSpacing: '-0.5px',
                color: 'white',
                lineHeight: 1.4
              }}>
                He had been ready for 6 months.
                <span style={{ color: '#1D9E75' }}> Without knowing it.</span>
              </p>

              <a
                href="/auth"
                style={{
                  display: 'inline-block',
                  marginTop: '32px',
                  padding: '16px 32px',
                  borderRadius: '14px',
                  background: '#1D9E75',
                  color: 'white',
                  textDecoration: 'none',
                  fontWeight: 500,
                  fontSize: '15px',
                  letterSpacing: '-0.2px'
                }}
              >
                Review what the model is surfacing
              </a>
            </div>

          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            paddingTop: '16px'
          }}>
            <p style={{
              fontSize: '14px',
              color: 'rgba(255,255,255,0.35)',
              textAlign: 'center'
            }}>
              Numbers are real. Identity is anonymised with permission.
            </p>
          </div>

        </div>
      </section>      <section
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
              See what every RBA move means for <span style={{ color: '#19C37D' }}>your</span>{' '}
              portfolio
            </h2>
            <p className="mb-7 text-lg leading-relaxed md:text-xl" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Before the market noise settles, Nextiq shows the estimated dollar impact on each of your
              loans, property by property, delivered to your inbox the same day.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                ['Your monthly impact', '+$256/mo', '#EF4444'],
                ['Properties monitored', '2 properties', '#FFFFFF'],
                ['Rate change tracked', '3.85% to 4.1%', '#FFFFFF'],
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
                RBA move may increase your repayments by $256 per month
              </h3>
              <p className="mb-4 text-sm text-slate-400">Cash rate moved from 3.85% to 4.1%</p>
              <p
                className="border-l-4 pl-4 text-sm italic leading-7 text-slate-700"
                style={{ borderColor: '#19C37D' }}
              >
                Your variable loan repayments will increase by approximately $256 per month across
                both properties, with Ingleburn Gardens Drive now costing around $4,680 monthly and
                Barley Street approximately $3,610 monthly. Review refinancing opportunities
                immediately.
              </p>
              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {[
                  ['Monthly impact', '+$256/mo', '#EF4444'],
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
              src="/screenshots/rba-intelligence-1604-final.webp"
              alt="Nextiq RBA intelligence card showing personalised rate impact by property address"
              loading="lazy"
              className="mt-5 w-full rounded-2xl"
            />
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-white px-6 py-20 md:px-10 lg:px-14">
        <div className="mx-auto max-w-5xl">
          <SectionBadge>Cash Flow & Savings Modelling</SectionBadge>
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
                Reducing credit card limits may improve modelled borrowing capacity by $39,016
              </h3>
              <p className="text-sm leading-relaxed text-slate-500">
                Even unused limits reduce your borrowing capacity. Lenders count the full limit
                regardless of actual balance.
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
                surplus for your next acquisition.
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
            src="/screenshots/refinance-card-1604.webp"
            alt="Nextiq refinance opportunity showing $3,540 annual saving"
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
            <SectionBadge>Scenario Modelling Engine</SectionBadge>
            <h2 className="mb-4 mt-5 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
              Know what you can do next, before you commit
            </h2>
            <p className="text-lg leading-relaxed text-slate-500 md:text-xl">
              See your real borrowing power, equity position, and how RBA rate changes affect
              your repayments. No bank connection. No credit check. Just your numbers.
            </p>
            <div className="mt-6 flex flex-col gap-5">
              {[
                ['1', 'What range does the current model indicate?', 'A clear yes or no, with the exact price range you can safely target today.'],
                ['2', 'How much upfront capital is currently modelled?', 'Available capital versus required. See whether you clear the upfront hurdle.'],
                ['3', 'What does the model show post-acquisition?', 'Cash flow, surplus impact, and 10-year equity trajectory modelled before you commit.'],
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
                <div className="mb-1 text-xs text-slate-400">Purchase scenario</div>
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
                Possible under current assumptions
              </span>
            </div>

            <img
              src="/screenshots/execution-readiness-1604.webp"
              alt="Nextiq execution readiness showing available versus required capital"
              loading="lazy"
              className="mt-4 w-full rounded-xl"
            />
          </div>
        </div>
      </section>

      <section id="faq" className="bg-white px-6 py-20 md:px-10 lg:px-14 scroll-mt-6">
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
              +$39,016 modelled improvement available
            </div>
            <div className="mb-1 mt-4 flex justify-between text-sm text-slate-600">
              <span>Modelled improvement via lower card limits</span>
              <span style={{ color: '#19C37D' }}>$39,016</span>
            </div>
            <div className="mb-1 flex justify-between text-sm text-slate-600">
              <span>Modelled total after sensitivity change</span>
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
          alt="Nextiq 30-year portfolio equity projection chart"
          loading="lazy"
          className="mx-auto mt-0 block w-full max-w-5xl rounded-2xl"
        />
        <img
          src="/screenshots/fixed-rate-alert-1604.webp"
          alt="Nextiq fixed rate expiry alert strip"
          loading="lazy"
          className="mx-auto mt-3 block w-full max-w-5xl rounded-xl"
        />
      </section>

      <section id="pricing" className="px-6 py-20 md:px-10 lg:px-14" style={{ background: '#F6FBF8' }}>
        <div className="max-w-7xl mx-auto px-6 text-center">
          <SectionBadge>Pricing</SectionBadge>
          <h2 className="mb-4 mt-5 text-4xl font-extrabold tracking-tight md:text-5xl">
            Simple, transparent pricing
          </h2>
          <p className="mb-13 text-lg leading-relaxed text-slate-500 md:text-xl">
            Built for Australian property investors. Free during early access. No lock-in.
            Cancel anytime.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mt-12">
            <div
              className="rounded-3xl p-10 flex flex-col min-w-0"
              style={{ background: 'white', border: '1px solid #E8F2EC', boxShadow: '0 8px 30px rgba(7,28,23,0.06)' }}
            >
              <div className="mb-6">
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#085041' }}>
                  Starter
                </p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-5xl font-extrabold tracking-tight" style={{ color: '#0F172A' }}>
                    $49
                  </span>
                  <span className="text-base mb-2" style={{ color: '#94A3B8' }}>
                    /mo AUD
                  </span>
                </div>
                <p className="text-sm mt-3" style={{ color: '#475569' }}>
                  For growing investors building their first portfolio.
                </p>
              </div>

              <div
                className="text-sm font-semibold mb-5 py-2 px-3 rounded-xl text-center"
                style={{ background: '#E8F6EF', color: '#085041' }}
              >
                Up to 3 properties
              </div>

              <ul className="flex flex-col gap-4 mb-10 flex-1">
                {[
                  'Full portfolio dashboard',
                  'Net equity and debt tracking',
                  'Monthly cash flow and tax modelling',
                  'Borrowing power estimate',
                  'Acquisition scenario modelling',
                  'Refinance opportunity alerts',
                  'RBA impact notifications',
                  'Fixed rate expiry alerts',
                  '30-year wealth projection',
                  'Stress testing and resilience score',
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm" style={{ color: '#475569' }}>
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-extrabold"
                      style={{ background: '#E8F6EF', color: '#19C37D' }}
                    >
                      +
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              <a
                href="/auth"
                className="w-full rounded-2xl py-4 text-sm font-extrabold text-center no-underline block"
                style={{ border: '2px solid #19C37D', color: '#19C37D' }}
              >
                See your numbers
              </a>
            </div>

            <div
              className="rounded-3xl p-10 flex flex-col min-w-0 scale-[1.02]"
              style={{ background: '#FAFFFC', border: '2px solid #19C37D', boxShadow: '0 16px 48px rgba(7,28,23,0.12)' }}
            >
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#085041' }}>
                    Investor
                  </p>
                  <span
                    className="text-xs font-extrabold px-3 py-1 rounded-full"
                    style={{ background: '#19C37D', color: '#071C17' }}
                  >
                    Most popular
                  </span>
                </div>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-5xl font-extrabold tracking-tight" style={{ color: '#0F172A' }}>
                    $99
                  </span>
                  <span className="text-base mb-2" style={{ color: '#94A3B8' }}>
                    /mo AUD
                  </span>
                </div>
                <p className="text-sm mt-3" style={{ color: '#475569' }}>
                  For active portfolio builders managing multiple properties.
                </p>
              </div>

              <div
                className="text-sm font-semibold mb-5 py-2 px-3 rounded-xl text-center"
                style={{ background: '#E8F6EF', color: '#085041' }}
              >
                Up to 10 properties
              </div>

              <ul className="flex flex-col gap-4 mb-10 flex-1">
                {[
                  'Everything in Starter',
                  'Advanced portfolio scale support',
                  'Larger multi-property books',
                  'Higher scenario modelling limits',
                  'Priority processing for AI analysis',
                  'Best for active portfolio builders',
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm" style={{ color: '#475569' }}>
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-extrabold"
                      style={{ background: '#E8F6EF', color: '#19C37D' }}
                    >
                      +
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              <a
                href="/auth"
                className="w-full rounded-2xl py-4 text-sm font-extrabold text-center no-underline block"
                style={{ background: '#19C37D', color: '#071C17' }}
              >
                See your numbers
              </a>
            </div>

            <div
              className="rounded-3xl p-10 flex flex-col min-w-0"
              style={{ background: 'white', border: '1px solid #E8F2EC', boxShadow: '0 8px 30px rgba(7,28,23,0.06)' }}
            >
              <div className="mb-6">
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#085041' }}>
                  Premium
                </p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-5xl font-extrabold tracking-tight" style={{ color: '#0F172A' }}>
                    $149
                  </span>
                  <span className="text-base mb-2" style={{ color: '#94A3B8' }}>
                    /mo AUD
                  </span>
                </div>
                <p className="text-sm mt-3" style={{ color: '#475569' }}>
                  For sophisticated investors and SMSFs at scale.
                </p>
              </div>

              <div
                className="text-sm font-semibold mb-5 py-2 px-3 rounded-xl text-center"
                style={{ background: '#E8F6EF', color: '#085041' }}
              >
                Unlimited properties
              </div>

              <ul className="flex flex-col gap-4 mb-10 flex-1">
                {[
                  'Everything in Investor',
                  'Unlimited portfolio scale',
                  'Multi-entity and future SMSF ready',
                  'Concierge onboarding support',
                  'Priority customer support',
                  'Premium investor workflows',
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm" style={{ color: '#475569' }}>
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-extrabold"
                      style={{ background: '#E8F6EF', color: '#19C37D' }}
                    >
                      +
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              <a
                href="/auth"
                className="w-full rounded-2xl py-4 text-sm font-extrabold text-center no-underline block"
                style={{ border: '2px solid #19C37D', color: '#19C37D' }}
              >
                See your numbers
              </a>
            </div>
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
          {'Start free trial ->'}
        </a>
        <p className="mt-5 text-xs tracking-wide" style={{ color: 'rgba(255,255,255,0.18)' }}>
          No credit card required | Cancel anytime | Australian-built
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
          General information only. Nextiq provides informational insights based on user-supplied
          data and indicative market benchmarks. Outputs do not constitute financial, investment,
          tax, or lending advice. Figures shown are illustrative estimates and subject to lender
          assessment and market conditions. Always consult a licensed financial adviser, mortgage
          broker, or accountant before making investment decisions. Nextiq is not an Australian
          Financial Services Licence holder.
        </div>
      </section>

      <footer className="px-6 pb-8 pt-12 md:px-10 lg:px-14" style={{ background: '#071C17' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-1">
              <div className="mb-3" style={{ fontSize: '20px', fontWeight: 500, letterSpacing: '-0.5px' }}>
                <span style={{ color: 'white' }}>next</span>
                <span style={{ color: '#1D9E75' }}>iq</span>
              </div>
              <p className="mb-5 max-w-xs text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Intelligent property portfolio platform for Australian investors. Track
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
                Australian-built | RBA-aware
              </div>
            </div>

            {[
              ['PRODUCT', ['Features', 'How it works', 'Pricing', 'FAQ', 'Start free trial']],
              ['LEGAL', ['Privacy Policy', 'Terms of Use', 'Disclaimer', 'Cookie Policy']],
              ['SUPPORT', ['Contact us', 'support@nextiq.com.au', 'Report an issue']],
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
                                ? '/features'
                            : link === 'Pricing'
                              ? '#pricing'
                              : link === 'FAQ'
                                ? '/#faq'
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
                                            : link === 'support@nextiq.com.au'
                                              ? 'mailto:support@nextiq.com.au'
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
              &copy; 2026 Nextiq. All rights reserved. Australian-built for Australian property
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

















