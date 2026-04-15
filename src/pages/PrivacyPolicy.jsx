export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <nav
        className="flex h-[66px] items-center justify-between px-6 md:px-10 lg:px-14"
        style={{ background: '#071C17' }}
      >
        <a href="/" className="no-underline" style={{ fontSize: '20px', fontWeight: 500, letterSpacing: '-0.5px' }}>
          <span style={{ color: 'white' }}>next</span>
          <span style={{ color: '#1D9E75' }}>iq</span>
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
          Privacy Policy
        </h1>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
          Nextiq is committed to protecting your privacy. This policy explains what
          information we collect, how we use it, and how we keep it safe.
        </p>

        <h2 className="mb-3 mt-8 text-lg font-bold" style={{ color: '#0F172A' }}>
          1. Information We Collect
        </h2>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
          We collect information you provide directly:
        </p>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
          - Name and email address when you register
          <br />
          - Property details including addresses and values
          <br />
          - Mortgage and loan information
          <br />
          - Household income, expenses, and liabilities
          <br />
          - Cash flow transactions for your properties
        </p>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
          We also collect usage data to improve the platform.
        </p>

        <h2 className="mb-3 mt-8 text-lg font-bold" style={{ color: '#0F172A' }}>
          2. How We Use Your Information
        </h2>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
          We use your information to:
        </p>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
          - Provide portfolio tracking and analysis features
          <br />
          - Calculate borrowing capacity and financial insights
          <br />
          - Generate personalised RBA impact notifications
          <br />
          - Send fixed rate expiry alerts and relevant updates
          <br />
          - Improve and maintain the Nextiq platform
        </p>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
          We do not sell your personal information. We do not use your data for
          advertising purposes.
        </p>

        <h2 className="mb-3 mt-8 text-lg font-bold" style={{ color: '#0F172A' }}>
          3. Data Storage and Security
        </h2>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
          Your data is stored using Supabase, a PostgreSQL database with Row Level
          Security enforced at the database level. Your data is isolated at the
          infrastructure layer and cannot be accessed by other users. All data is
          stored in Australia (ap-southeast-2 region).
        </p>

        <h2 className="mb-3 mt-8 text-lg font-bold" style={{ color: '#0F172A' }}>
          4. Third Party Services
        </h2>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
          Nextiq uses these third party services:
        </p>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
          - Supabase — database and authentication
          <br />
          - Stripe — payment processing
          <br />
          - Resend — transactional email delivery
          <br />
          - Anthropic — AI-powered narrative generation
        </p>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
          Each service operates under its own privacy policy. We only share the
          minimum data necessary for each service to function.
        </p>

        <h2 className="mb-3 mt-8 text-lg font-bold" style={{ color: '#0F172A' }}>
          5. Your Rights
        </h2>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
          You have the right to access, correct, or delete your personal information.
          To exercise these rights, contact us at{' '}
          <a
            href="mailto:support@nextiq.com.au"
            className="no-underline"
            style={{ color: '#19C37D' }}
          >
            support@nextiq.com.au
          </a>
          .
        </p>

        <h2 className="mb-3 mt-8 text-lg font-bold" style={{ color: '#0F172A' }}>
          6. Cookies
        </h2>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
          Nextiq uses essential session cookies for authentication only. We do not
          use tracking or advertising cookies.
        </p>

        <h2 className="mb-3 mt-8 text-lg font-bold" style={{ color: '#0F172A' }}>
          7. Changes to This Policy
        </h2>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
          We may update this policy from time to time. We will notify you of
          significant changes by email. Continued use of Nextiq after changes
          constitutes acceptance of the updated policy.
        </p>

        <h2 className="mb-3 mt-8 text-lg font-bold" style={{ color: '#0F172A' }}>
          8. Contact
        </h2>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>
          For privacy enquiries contact:{' '}
          <a
            href="mailto:support@nextiq.com.au"
            className="no-underline"
            style={{ color: '#19C37D' }}
          >
            support@nextiq.com.au
          </a>
        </p>
      </main>

      <footer
        className="px-14 py-8 text-center text-xs"
        style={{ background: '#071C17', color: 'rgba(255,255,255,0.2)' }}
      >
        © 2026 Nextiq. All rights reserved.
      </footer>
    </div>
  )
}


