function SupportBullet({ children }) {
  return (
    <div className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
      <span
        className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full"
        style={{ background: '#19C37D' }}
      />
      <span>{children}</span>
    </div>
  )
}

function ContactCard({ title, body, href }) {
  return (
    <div className="mb-4 rounded-2xl border p-6" style={{ background: '#F8FAFC', borderColor: '#EEF2F7' }}>
      <h2 className="mb-2 text-base font-bold" style={{ color: '#0F172A' }}>
        {title}
      </h2>
      <p className="mb-3 text-sm" style={{ color: '#475569' }}>
        {body}
      </p>
      <a href={href} className="text-sm font-semibold no-underline" style={{ color: '#19C37D' }}>
        support@nextiq.com.au
      </a>
    </div>
  )
}

export default function Contact() {
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

      <main className="mx-auto max-w-4xl px-8 py-16">
        <div
          className="mb-8 inline-block rounded-full px-3 py-1 text-xs font-bold"
          style={{ background: '#E8F6EF', color: '#085041' }}
        >
          Beta — we respond within 24 hours
        </div>

        <h1 className="mb-4 text-3xl font-extrabold tracking-tight" style={{ color: '#0F172A' }}>
          Contact and Support
        </h1>

        <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
          <div>
            <div className="mb-4 rounded-2xl p-6" style={{ background: '#E8F6EF' }}>
              <h2 className="mb-2 text-base font-bold" style={{ color: '#0F172A' }}>
                General enquiries
              </h2>
              <p className="mb-3 text-sm" style={{ color: '#475569' }}>
                Questions about Nextiq, your account, or how features work.
              </p>
              <a
                href="mailto:support@nextiq.com.au"
                className="text-sm font-semibold no-underline"
                style={{ color: '#19C37D' }}
              >
                support@nextiq.com.au
              </a>
            </div>

            <ContactCard
              title="Report an issue"
              body="Found a bug or something not working as expected? Let us know."
              href="mailto:support@nextiq.com.au?subject=Issue%20report"
            />

            <ContactCard
              title="Privacy and data"
              body="Questions about your data, deletion requests, or privacy concerns."
              href="mailto:support@nextiq.com.au?subject=Privacy%20enquiry"
            />

            <p className="mt-2 text-sm" style={{ color: '#6B7280' }}>
              We are a small team. We aim to respond to all enquiries within 24
              hours on business days.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-base font-bold" style={{ color: '#0F172A' }}>
              When contacting support
            </h2>
            <div className="flex flex-col gap-2">
              <SupportBullet>Your account email address</SupportBullet>
              <SupportBullet>Which page or feature the issue relates to</SupportBullet>
              <SupportBullet>What you expected to happen</SupportBullet>
              <SupportBullet>What actually happened</SupportBullet>
              <SupportBullet>Any error messages you saw</SupportBullet>
            </div>

            <h2 className="mb-4 mt-8 text-base font-bold" style={{ color: '#0F172A' }}>
              Common questions
            </h2>

            <div className="mb-5">
              <h3 className="mb-1 text-sm font-bold" style={{ color: '#0F172A' }}>
                Can I export my data?
              </h3>
              <p className="text-sm" style={{ color: '#475569' }}>
                Data export is on our roadmap. Contact us and we can assist manually
                in the meantime.
              </p>
            </div>

            <div className="mb-5">
              <h3 className="mb-1 text-sm font-bold" style={{ color: '#0F172A' }}>
                How do I cancel my subscription?
              </h3>
              <p className="text-sm" style={{ color: '#475569' }}>
                Cancel anytime from your Settings page. Access continues until end of
                billing period.
              </p>
            </div>

            <div className="mb-5">
              <h3 className="mb-1 text-sm font-bold" style={{ color: '#0F172A' }}>
                Is my financial data safe?
              </h3>
              <p className="text-sm" style={{ color: '#475569' }}>
                Yes. All data is stored in Australia using enterprise-grade database
                security with row-level isolation. We never sell your data.
              </p>
            </div>
          </div>
        </div>
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


