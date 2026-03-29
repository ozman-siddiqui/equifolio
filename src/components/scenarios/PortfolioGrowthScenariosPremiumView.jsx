function SectionHeader({ eyebrow, title, description, className = '' }) {
  return (
    <div className={className}>
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          {eyebrow}
        </p>
      ) : null}
      {title ? (
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
          {title}
        </h2>
      ) : null}
      {description ? (
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
          {description}
        </p>
      ) : null}
    </div>
  )
}

function MetricTile({
  label,
  value,
  helper = null,
  tone = 'neutral',
  className = '',
}) {
  const toneClasses = {
    neutral: {
      value: 'text-slate-950',
      helper: 'text-slate-500',
    },
    success: {
      value: 'text-emerald-700',
      helper: 'text-emerald-700/70',
    },
    caution: {
      value: 'text-amber-700',
      helper: 'text-amber-700/70',
    },
    danger: {
      value: 'text-rose-700',
      helper: 'text-rose-700/70',
    },
  }

  const resolvedTone = toneClasses[tone] || toneClasses.neutral

  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white px-5 py-4 ${className}`.trim()}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {label}
      </p>
      <p className={`mt-3 text-2xl font-semibold tracking-tight ${resolvedTone.value}`}>
        {value}
      </p>
      {helper ? (
        <p className={`mt-2 text-sm leading-6 ${resolvedTone.helper}`}>{helper}</p>
      ) : null}
    </div>
  )
}

function ScenarioMetricRow({ items = [] }) {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-white/80 bg-white/80 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            {item.label}
          </p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
            {item.value}
          </p>
          {item.helper ? (
            <p className="mt-2 text-sm leading-6 text-slate-500">{item.helper}</p>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function ScenarioCard({
  badge,
  title,
  description,
  metrics = [],
  footer,
  tone = 'neutral',
}) {
  const toneClasses = {
    suggested: {
      card: 'border-emerald-200/70 bg-emerald-50/40',
      badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      footer: 'border-emerald-200/70 bg-emerald-100/70 text-emerald-800',
    },
    blocked: {
      card: 'border-rose-200/70 bg-rose-50/40',
      badge: 'border-rose-200 bg-rose-50 text-rose-700',
      footer: 'border-rose-200/70 bg-rose-100/70 text-rose-800',
    },
    alternative: {
      card: 'border-amber-200/70 bg-amber-50/40',
      badge: 'border-amber-200 bg-amber-50 text-amber-700',
      footer: 'border-amber-200/70 bg-amber-100/70 text-amber-800',
    },
    neutral: {
      card: 'border-slate-200/80 bg-white',
      badge: 'border-slate-200 bg-slate-50 text-slate-700',
      footer: 'border-slate-200/80 bg-slate-50 text-slate-700',
    },
  }

  const resolvedTone = toneClasses[tone] || toneClasses.neutral

  return (
    <section className={`rounded-3xl border p-6 md:p-7 ${resolvedTone.card}`.trim()}>
      {badge ? (
        <div
          className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${resolvedTone.badge}`.trim()}
        >
          {badge}
        </div>
      ) : null}
      <h3 className="mt-5 text-[1.9rem] font-semibold leading-tight tracking-tight text-slate-950">
        {title}
      </h3>
      {description ? (
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">{description}</p>
      ) : null}
      {metrics.length > 0 ? <div className="mt-6"><ScenarioMetricRow items={metrics} /></div> : null}
      {footer ? (
        <div className={`mt-6 rounded-2xl border px-5 py-3 text-sm font-medium ${resolvedTone.footer}`}>
          {footer}
        </div>
      ) : null}
    </section>
  )
}

function TabsNav({ tabs = [], activeTab, onTabChange }) {
  return (
    <div className="border-b border-slate-200/80 px-6 md:px-8">
      <div className="-mb-px flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange?.(tab.id)}
              className={`rounded-t-2xl border px-5 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-slate-200 border-b-white bg-white text-slate-950'
                  : 'border-transparent bg-transparent text-slate-500 hover:text-slate-700'
              }`.trim()}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FundingFlowCard({ label, value, helper, tone = 'neutral' }) {
  const toneClasses = {
    positive: 'border-emerald-200/70 bg-emerald-50/50',
    neutral: 'border-slate-200/80 bg-slate-50/70',
    caution: 'border-amber-200/70 bg-amber-50/50',
    danger: 'border-rose-200/70 bg-rose-50/50',
  }

  return (
    <div className={`rounded-[1.75rem] border px-6 py-6 ${toneClasses[tone] || toneClasses.neutral}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      {helper ? <p className="mt-3 text-sm leading-6 text-slate-600">{helper}</p> : null}
    </div>
  )
}

function TaxSummaryCard({ label, value, unit, helper, tone = 'neutral' }) {
  const toneClasses = {
    positive: 'border-emerald-200/70 bg-emerald-50/50',
    neutral: 'border-slate-200/80 bg-white',
    caution: 'border-amber-200/70 bg-amber-50/50',
    danger: 'border-rose-200/70 bg-rose-50/50',
  }

  return (
    <div className={`rounded-[1.75rem] border px-6 py-6 ${toneClasses[tone] || toneClasses.neutral}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      {unit ? <p className="mt-1 text-sm font-medium text-slate-500">{unit}</p> : null}
      {helper ? <p className="mt-3 text-sm leading-6 text-slate-600">{helper}</p> : null}
    </div>
  )
}

function ChartCanvas({ title, description, chart }) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white px-6 py-6 md:px-8 md:py-8">
      <SectionHeader eyebrow={null} title={title} description={description} />
      <div className="mt-8">{chart}</div>
    </section>
  )
}

function AdvancedAnalysisSection({ title, description, toggleLabel, isOpen, onToggle, children }) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white px-6 py-6 md:px-8 md:py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <SectionHeader eyebrow="Advanced analysis" title={title} description={description} />
        <button
          type="button"
          onClick={() => onToggle?.(!isOpen)}
          className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          {toggleLabel}
        </button>
      </div>
      {isOpen ? <div className="mt-8 space-y-8">{children}</div> : null}
    </section>
  )
}

export default function PortfolioGrowthScenariosPremiumView({
  hero = {},
  scenarioCards = [],
  summaryStrip = [],
  tabs = [],
  activeTab = 'wealth-growth',
  onTabChange,
  wealthTab = {},
  fundingTab = {},
  taxTab = {},
  assumptionsSection = {},
  advancedAnalysis = {},
}) {
  const visibleScenarioCards =
    scenarioCards.length > 0
      ? scenarioCards
      : [
          {
            badge: 'Suggested',
            title: 'Buy 1 larger property',
            description: 'Scenario preview content will render when scenario props are supplied.',
            tone: 'suggested',
            metrics: [],
            footer: 'Capital shortfall: $0',
          },
          {
            badge: 'Alternative',
            title: 'Additional scenario',
            description:
              'Alternative scenario preview will appear when another computed scenario is available.',
            tone: 'neutral',
            metrics: [],
            footer: 'Waiting for scenario comparison data',
          },
        ]

  return (
    <div className="min-h-screen bg-stone-50">
      <main className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-12">
        <section className="rounded-3xl border border-slate-200/80 bg-white px-6 py-7 md:px-8 md:py-9">
          <SectionHeader
            eyebrow={hero.eyebrow || 'Growth scenarios'}
            title={hero.title || 'Portfolio Growth Scenarios'}
            description={hero.description}
          />
          {hero.kpis?.length ? (
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              {hero.kpis.map((item) => (
                <MetricTile
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  helper={item.helper}
                  tone={item.tone}
                />
              ))}
            </div>
          ) : null}
        </section>

        <section className="mt-10 md:mt-12">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {visibleScenarioCards.slice(0, 2).map((card, index) => (
              <ScenarioCard
                key={`${card.title || 'scenario'}-${index}`}
                badge={card.badge}
                title={card.title}
                description={card.description}
                metrics={card.metrics}
                footer={card.footer}
                tone={card.tone}
              />
            ))}
          </div>
        </section>

        <section className="mt-10 md:mt-12">
          <div className="rounded-3xl border border-slate-200/80 bg-white px-6 py-6 md:px-8">
            <SectionHeader
              eyebrow={summaryStrip.eyebrow || 'Scenario summary'}
              title={summaryStrip.title}
              description={summaryStrip.description}
            />
            {summaryStrip.metrics?.length ? (
              <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                {summaryStrip.metrics.map((item) => (
                  <MetricTile
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    helper={item.helper}
                    tone={item.tone}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-10 md:mt-12 overflow-hidden rounded-3xl border border-slate-200/80 bg-white">
          <TabsNav tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />

          {activeTab === 'wealth-growth' ? (
            <div className="px-6 py-6 md:px-8 md:py-8">
              <ChartCanvas
                title={wealthTab.title || 'How your wealth grows over time'}
                description={wealthTab.description}
                chart={wealthTab.chart}
              />
            </div>
          ) : null}

          {activeTab === 'funding' ? (
            <div className="px-6 py-6 md:px-8 md:py-8">
              <SectionHeader
                eyebrow={fundingTab.eyebrow || 'Funding'}
                title={fundingTab.title || 'How this is funded'}
                description={fundingTab.description}
              />
              <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_auto_1fr_auto_1fr] xl:items-center">
                {(fundingTab.cards || []).map((card, index, array) => (
                  <div
                    key={`${card.label}-${index}`}
                    className={index < array.length - 1 ? 'xl:contents' : ''}
                  >
                    <FundingFlowCard
                      label={card.label}
                      value={card.value}
                      helper={card.helper}
                      tone={card.tone}
                    />
                    {index < array.length - 1 ? (
                      <div className="hidden text-center text-2xl font-semibold text-slate-300 xl:block">
                        {card.connector || '→'}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              {fundingTab.children ? <div className="mt-8">{fundingTab.children}</div> : null}
            </div>
          ) : null}

          {activeTab === 'tax-cash-flow' ? (
            <div className="px-6 py-6 md:px-8 md:py-8">
              <SectionHeader
                eyebrow={taxTab.eyebrow || 'Tax & cash flow'}
                title={taxTab.title || 'Tax & cash flow'}
                description={taxTab.description}
              />
              <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_auto_1fr_auto_1fr] xl:items-center">
                {(taxTab.cards || []).map((card, index, array) => (
                  <div
                    key={`${card.label}-${index}`}
                    className={index < array.length - 1 ? 'xl:contents' : ''}
                  >
                    <TaxSummaryCard
                      label={card.label}
                      value={card.value}
                      unit={card.unit}
                      helper={card.helper}
                      tone={card.tone}
                    />
                    {index < array.length - 1 ? (
                      <div className="hidden text-center text-2xl font-semibold text-slate-300 xl:block">
                        {card.connector || '+'}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              {taxTab.assumptionsLine ? (
                <p className="mt-6 text-sm leading-6 text-slate-500">{taxTab.assumptionsLine}</p>
              ) : null}
              {taxTab.children ? <div className="mt-8">{taxTab.children}</div> : null}
            </div>
          ) : null}
        </section>

        <section className="mt-10 md:mt-12 rounded-3xl border border-slate-200/80 bg-white px-6 py-6 md:px-8 md:py-8">
          <SectionHeader
            eyebrow={assumptionsSection.eyebrow || 'Scenario assumptions'}
            title={assumptionsSection.title || 'What this scenario assumes'}
            description={assumptionsSection.description}
          />
          {assumptionsSection.helper ? (
            <p className="mt-3 text-sm leading-6 text-slate-500">{assumptionsSection.helper}</p>
          ) : null}
          {assumptionsSection.content ? <div className="mt-8">{assumptionsSection.content}</div> : null}
        </section>

        <div className="mt-10 md:mt-12">
          <AdvancedAnalysisSection
            title={advancedAnalysis.title || 'Advanced analysis'}
            description={
              advancedAnalysis.description ||
              'Explore how changes in rates, deposits, and borrowing assumptions affect this scenario.'
            }
            toggleLabel={advancedAnalysis.toggleLabel || 'Show advanced analysis'}
            isOpen={Boolean(advancedAnalysis.isOpen)}
            onToggle={advancedAnalysis.onToggle}
          >
            {advancedAnalysis.content}
          </AdvancedAnalysisSection>
        </div>
      </main>
    </div>
  )
}
