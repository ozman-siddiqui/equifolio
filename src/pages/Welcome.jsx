const steps = [
  {
    number: '1',
    title: 'Properties',
    subtitle: 'Value, loan, rent, type',
    status: 'active',
  },
  {
    number: '2',
    title: 'Income',
    subtitle: 'Serviceability',
    status: 'pending',
  },
  {
    number: '3',
    title: 'Capital',
    subtitle: 'Deposit & liquidity',
    status: 'pending',
  },
]

const previewRows = [
  { label: 'Indicative purchase range', value: '$620k–$710k', helper: '20% deposit path' },
  { label: 'Net portfolio equity', value: '$170,000', helper: null },
  { label: 'Rate stress threshold', value: '>9.25%', helper: 'Safe headroom' },
  { label: 'Rental contribution', value: '$28,800/yr', helper: 'Improves serviceability' },
]

function StepRailItem({ step, isLast = false }) {
  const isActive = step.status === 'active'

  return (
    <div className="relative pl-14">
      {!isLast ? (
        <div className="absolute left-[18px] top-11 h-12 w-px bg-[rgba(112,160,143,0.3)]" />
      ) : null}
      <div
        className={`absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
          isActive
            ? 'bg-[#26b389] text-[#041911] shadow-[0_0_20px_rgba(38,179,137,0.24)]'
            : 'border border-[rgba(138,178,162,0.22)] bg-[rgba(16,33,28,0.78)] text-[#91b8ab]'
        }`}
      >
        {step.number}
      </div>
      <p className={`text-[15px] font-medium ${isActive ? 'text-[#d4f5ea]' : 'text-[#9cc0b3]'}`}>
        {step.title}
      </p>
      <p className="mt-1 text-sm text-[#5d8a7a]">{step.subtitle}</p>
    </div>
  )
}

function PreviewRow({ label, value, helper }) {
  return (
    <div className="border-b border-[rgba(110,160,141,0.14)] py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <p className="max-w-[180px] text-[15px] text-[#70a08d]">{label}</p>
        <div className="text-right">
          <p className="text-[16px] font-semibold tracking-tight text-[#d7f6eb]">{value}</p>
          {helper ? <p className="mt-1 text-sm text-[#4f7b6d]">{helper}</p> : null}
        </div>
      </div>
    </div>
  )
}

function MetricField({ label, children, helper = null, optional = false }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <label className="text-[15px] font-medium text-[#f2f2ee]">{label}</label>
        {optional ? (
          <span className="rounded-full bg-[#ece9df] px-2 py-0.5 text-[11px] font-medium text-[#7a776f]">
            optional
          </span>
        ) : null}
      </div>
      {children}
      {helper ? <p className="mt-2 text-sm leading-6 text-[#78766f]">{helper}</p> : null}
    </div>
  )
}

function PlaceholderSparkline() {
  return (
    <svg viewBox="0 0 300 90" className="h-[92px] w-full">
      <defs>
        <linearGradient id="sparkFill" x1="0%" x2="0%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(37,179,137,0.24)" />
          <stop offset="100%" stopColor="rgba(37,179,137,0)" />
        </linearGradient>
      </defs>
      <path
        d="M8 74 C58 68, 84 61, 122 56 S202 43, 246 34 S286 30, 292 28"
        fill="none"
        stroke="#1a8c6b"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M8 74 C58 68, 84 61, 122 56 S202 43, 246 34 S286 30, 292 28 L292 88 L8 88 Z"
        fill="url(#sparkFill)"
      />
      <line x1="234" y1="14" x2="234" y2="84" stroke="#1e7c61" strokeDasharray="4 4" strokeWidth="1" />
      <text x="240" y="36" fill="#51a78b" fontSize="11">threshold</text>
      <circle cx="292" cy="28" r="5" fill="#29c295" />
    </svg>
  )
}

function PlaceholderGauge() {
  return (
    <div className="mx-auto flex h-[180px] w-[240px] items-center justify-center">
      <div className="relative h-[148px] w-[220px] overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-[220px] rounded-[999px] border-[16px] border-[rgba(31,74,60,0.75)]" />
        <div
          className="absolute inset-x-0 bottom-0 h-[220px] rounded-[999px] border-[16px] border-transparent"
          style={{
            borderTopColor: '#41cfaa',
            borderLeftColor: '#41cfaa',
            borderRightColor: '#41cfaa',
            transform: 'rotate(-8deg)',
          }}
        />
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <p className="text-[48px] font-light tracking-[-0.04em] text-[#3ed0aa]">84%</p>
          <p className="mt-1 text-[14px] text-[#6ca895]">acquisition readiness</p>
        </div>
      </div>
    </div>
  )
}

export default function Welcome() {
  return (
    <div className="min-h-screen bg-[#071711] text-white">
      <div className="mx-auto min-h-screen max-w-[1440px] overflow-hidden rounded-[28px] border border-[rgba(112,160,143,0.14)] bg-[#071711] shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <div className="grid min-h-screen grid-cols-[300px_minmax(0,1fr)_508px]">
          <aside className="flex flex-col justify-between border-r border-[rgba(112,160,143,0.12)] bg-[#061c14] px-8 py-10">
            <div>
              <p className="text-[18px] font-medium tracking-[0.08em] text-[#62d8b3]">VAULTA</p>

              <div className="mt-16 space-y-10">
                {steps.map((step, index) => (
                  <StepRailItem
                    key={step.number}
                    step={step}
                    isLast={index === steps.length - 1}
                  />
                ))}
              </div>
            </div>

            <div className="max-w-[180px] text-[15px] leading-8 text-[#477666]">
              <p>Encrypted. Never shared.</p>
              <p>Used only to generate your portfolio intelligence.</p>
            </div>
          </aside>

          <section className="bg-[#f3f1ea] px-11 py-12 text-[#1b1d1b]">
            <div className="mx-auto max-w-[520px]">
              <div className="mb-8 h-1.5 w-full overflow-hidden rounded-full bg-[#d9d3c6]">
                <div className="h-full w-1/3 rounded-full bg-[#24a37c]" />
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="rounded-[28px] bg-[#24a37c] px-7 py-3 text-[18px] font-medium text-white">
                  Step 1 · Properties
                </div>
                <div className="rounded-[28px] border border-[#bdb6a8] px-7 py-3 text-[18px] text-[#6f6b61]">
                  Step 2 · Income
                </div>
                <div className="rounded-[28px] border border-[#bdb6a8] px-7 py-3 text-[18px] text-[#6f6b61]">
                  Step 3 · Capital
                </div>
              </div>

              <p className="mt-8 text-[15px] uppercase tracking-[0.22em] text-[#24a37c]">
                Step 1 of 3 · Your portfolio
              </p>
              <h1 className="mt-4 text-[54px] font-light tracking-[-0.04em] text-[#1e221f]">
                Properties
              </h1>
              <p className="mt-4 max-w-[470px] text-[22px] leading-[1.7] text-[#4b4e4a]">
                Start with what you own. We&apos;ll calculate your equity position, stress threshold,
                and borrowing capacity instantly.
              </p>

              <div className="mt-12 space-y-8">
                <MetricField label="Property address">
                  <input
                    type="text"
                    value="e.g. 19 Barley Street, Brisbane QLD"
                    readOnly
                    className="w-full rounded-[18px] border border-[#b8b1a2] bg-[#f1eee5] px-6 py-4 text-[20px] text-[#7a776f] outline-none"
                  />
                </MetricField>

                <MetricField
                  label="Property type"
                  helper="Affects rental income, tax treatment and portfolio narrative"
                >
                  <div className="grid grid-cols-2 overflow-hidden rounded-[18px] border border-[#b8b1a2] bg-[#f1eee5]">
                    <button
                      type="button"
                      className="bg-[#24a37c] px-6 py-4 text-[18px] font-medium text-white"
                    >
                      Investment
                    </button>
                    <button
                      type="button"
                      className="px-6 py-4 text-[18px] font-medium text-[#4b4e4a]"
                    >
                      Owner occupied
                    </button>
                  </div>
                </MetricField>

                <div className="grid grid-cols-2 gap-5">
                  <MetricField label="Current value ($)">
                    <input
                      type="text"
                      value="750,000"
                      readOnly
                      className="w-full rounded-[18px] border border-[#b8b1a2] bg-[#f1eee5] px-6 py-4 text-[20px] text-[#6b6a63] outline-none"
                    />
                  </MetricField>

                  <MetricField label="Loan balance ($)">
                    <input
                      type="text"
                      value="580,000"
                      readOnly
                      className="w-full rounded-[18px] border border-[#b8b1a2] bg-[#f1eee5] px-6 py-4 text-[20px] text-[#6b6a63] outline-none"
                    />
                  </MetricField>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <MetricField label="Interest rate (%)" helper="Unknown? We use the market rate">
                    <input
                      type="text"
                      value="5.99"
                      readOnly
                      className="w-full rounded-[18px] border border-[#b8b1a2] bg-[#f1eee5] px-6 py-4 text-[20px] text-[#6b6a63] outline-none"
                    />
                  </MetricField>

                  <MetricField label="Repayment type">
                    <div className="grid grid-cols-2 overflow-hidden rounded-[18px] border border-[#b8b1a2] bg-[#f1eee5]">
                      <button
                        type="button"
                        className="px-6 py-4 text-[18px] font-medium text-[#4b4e4a]"
                      >
                        P&amp;I
                      </button>
                      <button
                        type="button"
                        className="bg-[#24a37c] px-6 py-4 text-[18px] font-medium text-white"
                      >
                        IO
                      </button>
                    </div>
                  </MetricField>
                </div>

                <MetricField
                  label="Monthly rental income ($)"
                  optional
                  helper="Materially improves serviceability accuracy"
                >
                  <input
                    type="text"
                    value="2,400"
                    readOnly
                    className="w-full rounded-[18px] border border-[#b8b1a2] bg-[#f1eee5] px-6 py-4 text-[20px] text-[#6b6a63] outline-none"
                  />
                </MetricField>

                <button
                  type="button"
                  className="text-[18px] font-medium text-[#24a37c] transition-colors hover:text-[#1b8f6b]"
                >
                  + Add another property
                </button>

                <button
                  type="button"
                  className="mt-10 w-full rounded-[20px] border border-[#b8b1a2] bg-[#faf9f4] px-8 py-5 text-[24px] font-medium text-[#1e221f] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                >
                  Continue to income →
                </button>
              </div>
            </div>
          </section>

          <aside className="border-l border-[rgba(112,160,143,0.12)] bg-[#061c14] px-9 py-10">
            <div className="mx-auto max-w-[410px]">
              <p className="text-[14px] uppercase tracking-[0.18em] text-[#2aa984]">
                Live preview · updates as you type
              </p>

              <div className="mt-8 inline-flex items-center rounded-full border border-[#1e8c6c] px-5 py-2 text-[15px] font-medium text-[#63d4b0]">
                <span className="mr-2 h-2.5 w-2.5 rounded-full bg-[#2bc79a]" />
                High confidence · 3 inputs
              </div>

              <div className="mt-8 rounded-[28px] border border-[rgba(95,146,127,0.18)] bg-[rgba(7,28,22,0.84)] px-8 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                <PlaceholderGauge />

                <div className="mt-2">
                  {previewRows.map((row) => (
                    <PreviewRow
                      key={row.label}
                      label={row.label}
                      value={row.value}
                      helper={row.helper}
                    />
                  ))}
                </div>

                <div className="mt-6 border-t border-[rgba(110,160,141,0.14)] pt-5">
                  <p className="text-[15px] text-[#70a08d]">Acquisition trajectory</p>
                  <div className="mt-4 rounded-[18px] bg-[rgba(10,35,28,0.82)] px-4 py-4">
                    <PlaceholderSparkline />
                  </div>
                </div>

                <div className="mt-6 border-t border-[rgba(110,160,141,0.14)] pt-5">
                  <p className="text-[15px] text-[#70a08d]">Capital allocation — $170k total</p>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#103528]">
                    <div className="flex h-full">
                      <div className="h-full w-[46%] bg-[#2abb95]" />
                      <div className="h-full w-[29%] bg-[#227e65]" />
                      <div className="h-full w-[25%] bg-[#145342]" />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-5 text-[14px] text-[#5ea68d]">
                    <span>● Cash $95k</span>
                    <span>● Offset $42k</span>
                    <span>● Equity $33k</span>
                  </div>
                </div>

                <div className="mt-7 rounded-[22px] border border-[rgba(71,135,113,0.28)] bg-[rgba(7,22,18,0.76)] px-6 py-5">
                  <p className="text-[13px] uppercase tracking-[0.16em] text-[#2aa984]">Top unlock</p>
                  <p className="mt-4 text-[20px] leading-9 text-[#d4f5ea]">
                    Reducing credit card limit by <span className="text-[#41cfaa]">$15k</span>
                    {' '}unlocks <span className="text-[#41cfaa]">+$52,000</span> borrowing capacity
                  </p>
                </div>

                <button
                  type="button"
                  className="mt-6 w-full rounded-[20px] bg-[#24a37c] px-6 py-5 text-[22px] font-medium text-white shadow-[0_18px_40px_rgba(12,84,62,0.35)]"
                >
                  Explore full dashboard →
                </button>

                <p className="mt-4 text-center text-[14px] text-[#4f7b6d]">
                  Recalculates as you complete each step
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
