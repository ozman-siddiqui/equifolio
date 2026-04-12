export default function Terms() {
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
            className="rounded-lg px-5 py-2.5 text-sm font-extrabold no-underline"
            style={{ background: '#19C37D', color: '#071C17' }}
          >
            Start free trial
          </a>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-8 py-16">
        <div
          className="mb-8 inline-block rounded-full px-3 py-1 text-xs font-bold"
          style={{ background: '#E8F6EF', color: '#085041' }}
        >
          Last updated April 2026
        </div>

        <h1 className="mb-4 text-3xl font-extrabold tracking-tight" style={{ color: '#0F172A' }}>
          Terms of Use and Disclaimer
        </h1>

        <h2 className="mb-3 mt-8 text-lg font-bold" style={{ color: '#0F172A' }}>
          1. Acceptance of Terms
        </h2>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
          By using Vaulta you agree to these terms. If you do not agree, do not use
          the platform.
        </p>

        <h2 className="mb-3 mt-8 text-lg font-bold" style={{ color: '#0F172A' }}>
          2. General Information Only
        </h2>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
          Vaulta provides general informational insights based on data you enter and
          indicative market benchmarks. All outputs are illustrative estimates.
          Nothing on Vaulta constitutes financial, investment, tax, mortgage, or legal
          advice. Vaulta is not an Australian Financial Services Licence (AFSL)
          holder. Always consult a licensed financial adviser, mortgage broker,
          accountant, or solicitor before making any investment or borrowing
          decisions.
        </p>

        <h2 className="mb-3 mt-8 text-lg font-bold" style={{ color: '#0F172A' }}>
          3. Accuracy of Information
        </h2>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
          Vaulta calculations are indicative only and will differ from formal lender
          assessments. Actual borrowing capacity and investment outcomes may vary
          significantly from Vaulta outputs.
        </p>

        <h2 className="mb-3 mt-8 text-lg font-bold" style={{ color: '#0F172A' }}>
          4. Your Responsibilities
        </h2>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
          You are responsible for:
          <br />
          - Entering accurate and complete information
          <br />
          - Keeping your account credentials secure
          <br />
          - Making your own independent financial decisions
        </p>

        <h2 className="mb-3 mt-8 text-lg font-bold" style={{ color: '#0F172A' }}>
          5. Subscription and Billing
        </h2>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
          Vaulta is a monthly subscription. Cancel anytime from Settings.
          Cancellation takes effect at the end of your billing period. Refunds are
          not provided for partial periods. Pricing may change with 30 days notice.
        </p>

        <h2 className="mb-3 mt-8 text-lg font-bold" style={{ color: '#0F172A' }}>
          6. Intellectual Property
        </h2>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
          All content, features, and functionality of Vaulta are owned by Vaulta and
          protected by applicable intellectual property laws.
        </p>

        <h2 className="mb-3 mt-8 text-lg font-bold" style={{ color: '#0F172A' }}>
          7. Limitation of Liability
        </h2>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
          To the maximum extent permitted by Australian law, Vaulta is not liable for
          any loss or damage arising from your use of the platform, including
          financial losses from decisions made using Vaulta outputs.
        </p>

        <h2 className="mb-3 mt-8 text-lg font-bold" style={{ color: '#0F172A' }}>
          8. Governing Law
        </h2>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
          These terms are governed by the laws of New South Wales, Australia.
        </p>

        <h2 className="mb-3 mt-8 text-lg font-bold" style={{ color: '#0F172A' }}>
          9. Contact
        </h2>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
          For terms enquiries contact:{' '}
          <a
            href="mailto:support@vaulta.com.au"
            className="no-underline"
            style={{ color: '#19C37D' }}
          >
            support@vaulta.com.au
          </a>
        </p>
      </main>

      <footer
        className="px-14 py-8 text-center text-xs"
        style={{ background: '#071C17', color: 'rgba(255,255,255,0.2)' }}
      >
        © 2026 Vaulta. All rights reserved.
      </footer>
    </div>
  )
}
