import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronRight, Landmark } from 'lucide-react'

import useFinancialData from '../hooks/useFinancialData'
import usePortfolioData from '../hooks/usePortfolioData'
import calculateBorrowingPower from '../lib/borrowingPowerEngine'
import buildPortfolioGrowthScenarios from '../lib/portfolioGrowthScenarios'

const DEPOSIT_STRATEGY_OPTIONS = [
  { value: '20', label: '20% deposit (default)', depositRatio: 0.2 },
  { value: '10', label: '10% deposit + LMI', depositRatio: 0.1 },
  { value: '5', label: '5% deposit + LMI', depositRatio: 0.05 },
]

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))

function clampCashToDeploy(value, maxCashAvailableForInvestment) {
  const numericValue = Number(value)
  const safeMax = Number.isFinite(Number(maxCashAvailableForInvestment))
    ? Math.max(0, Number(maxCashAvailableForInvestment))
    : 0

  if (!Number.isFinite(numericValue)) return 0
  return Math.min(safeMax, Math.max(0, numericValue))
}

function normalizeScenario(scenario) {
  const breakdown = scenario?.breakdown || {}
  const normalizedScenario = {
    ...scenario,
    capitalBreakdown: {
      usableEquityBeforeBuffer:
        breakdown.capital?.usableEquityBeforeBuffer ?? formatCurrency(0),
      usableEquityAfterBuffer:
        breakdown.capital?.usableEquityAfterBuffer ?? formatCurrency(0),
      cashUsed: breakdown.capital?.cashUsed ?? formatCurrency(0),
      totalCapitalUsed: breakdown.capital?.totalCapitalUsed ?? formatCurrency(0),
      bufferRetained: breakdown.capital?.bufferRetained ?? formatCurrency(0),
      totalDeployableCapital:
        breakdown.capital?.totalDeployableCapital ?? formatCurrency(0),
    },
    purchaseStructure: {
      targetPrice: breakdown.purchaseStructure?.targetPrice ?? formatCurrency(0),
      depositPct: breakdown.purchaseStructure?.depositPct ?? '0%',
      depositAmount: breakdown.purchaseStructure?.depositAmount ?? formatCurrency(0),
      acquisitionCosts:
        breakdown.purchaseStructure?.acquisitionCosts ?? formatCurrency(0),
      lmiEstimate:
        breakdown.purchaseStructure?.lmiEstimate ?? formatCurrency(0),
      totalCapitalRequired:
        breakdown.purchaseStructure?.totalCapitalRequired ?? formatCurrency(0),
    },
    loanStructure: {
      baseLoanSize: breakdown.loanStructure?.baseLoanSize ?? formatCurrency(0),
      lmiEstimate: breakdown.loanStructure?.lmiEstimate ?? formatCurrency(0),
      loanSize: breakdown.loanStructure?.loanSize ?? formatCurrency(0),
      interestRate: breakdown.loanStructure?.interestRate ?? '0.0%',
      monthlyRepayment: breakdown.loanStructure?.monthlyRepayment ?? formatCurrency(0),
    },
    cashFlowBreakdown: {
      rentalIncome: breakdown.cashFlow?.rentalIncome ?? `${formatCurrency(0)}/month`,
      expenses: breakdown.cashFlow?.expenses ?? `${formatCurrency(0)}/month`,
      netCashFlow: breakdown.cashFlow?.netCashFlow ?? `${formatCurrency(0)}/month`,
    },
    serviceabilityImpact: {
      surplusBefore:
        breakdown.serviceabilityImpact?.surplusBefore ?? formatCurrency(0),
      surplusAfter:
        breakdown.serviceabilityImpact?.surplusAfter ?? formatCurrency(0),
      borrowingCapacityAfterPurchase:
        breakdown.serviceabilityImpact?.borrowingCapacityAfterPurchase ??
        formatCurrency(0),
    },
    growthAssumptions: {
      growthRate: breakdown.growthAssumptions?.growthRate ?? '0.0%',
      fiveYearValue:
        breakdown.growthAssumptions?.fiveYearValue ?? formatCurrency(0),
      equityCreated:
        breakdown.growthAssumptions?.equityCreated ?? formatCurrency(0),
    },
    constraints: Array.isArray(breakdown.constraints) ? breakdown.constraints : [],
  }

  if (!breakdown.capital || !breakdown.purchaseStructure) {
    console.warn('Scenario missing capital breakdown', scenario)
  }

  return normalizedScenario
}

export default function PortfolioGrowthScenarios() {
  const navigate = useNavigate()
  const { properties, loans, transactions, loading } = usePortfolioData()
  const { financialProfile, liabilities } = useFinancialData()
  const rawAvailableCashForInvestment =
    financialProfile?.cash_available_for_investment ?? 0
  const maxCashAvailableForInvestment = Number.isFinite(Number(rawAvailableCashForInvestment))
    ? Math.max(0, Number(rawAvailableCashForInvestment))
    : 0
  const [cashToDeploy, setCashToDeploy] = useState(0)
  const [depositStrategy, setDepositStrategy] = useState('20')
  const effectiveCashToDeploy = clampCashToDeploy(
    Number.isFinite(Number(cashToDeploy)) ? Number(cashToDeploy) : 0,
    maxCashAvailableForInvestment
  )
  const isSliderDisabled = maxCashAvailableForInvestment <= 0
  const selectedDepositStrategy =
    DEPOSIT_STRATEGY_OPTIONS.find((option) => option.value === depositStrategy) ||
    DEPOSIT_STRATEGY_OPTIONS[0]

  const borrowingAnalysis = useMemo(
    () =>
      calculateBorrowingPower({
        financialProfile,
        liabilities,
        loans,
        transactions,
      }),
    [financialProfile, liabilities, loans, transactions]
  )

  const usableEquity = useMemo(() => {
    const totalValue = properties.reduce((sum, property) => sum + Number(property?.current_value || 0), 0)
    const totalDebt = loans.reduce((sum, loan) => sum + Number(loan?.current_balance || 0), 0)
    return Math.max(Math.round(totalValue * 0.8 - totalDebt), 0)
  }, [properties, loans])
  const totalPortfolioValue = useMemo(
    () =>
      properties.reduce((sum, property) => sum + Number(property?.current_value || 0), 0),
    [properties]
  )
  const totalPortfolioDebt = useMemo(
    () => loans.reduce((sum, loan) => sum + Number(loan?.current_balance || 0), 0),
    [loans]
  )

  const scenarioModel = useMemo(
    () =>
      buildPortfolioGrowthScenarios({
        properties,
        loans,
        transactions,
        borrowingAnalysis,
        usableEquity,
        availableCash: effectiveCashToDeploy,
        config: {
          depositRatio: selectedDepositStrategy.depositRatio,
        },
        portfolioCashFlow: transactions
          .filter((transaction) => transaction?.property_id)
          .reduce((sum, transaction) => {
            const multiplier =
              transaction?.type === 'income' ? 1 : transaction?.type === 'expense' ? -1 : 0
            const normalizedFrequency = String(transaction?.frequency || '').trim().toLowerCase()
            const amount = Number(transaction?.amount || 0)

            if (!Number.isFinite(amount)) return sum

            switch (normalizedFrequency) {
              case 'weekly':
                return sum + multiplier * ((amount * 52) / 12)
              case 'fortnightly':
                return sum + multiplier * ((amount * 26) / 12)
              case 'monthly':
                return sum + multiplier * amount
              case 'quarterly':
                return sum + multiplier * (amount / 3)
              case 'annual':
              case 'yearly':
                return sum + multiplier * (amount / 12)
              default:
                return sum + multiplier * amount
            }
          }, 0),
      }),
    [
      properties,
      loans,
      transactions,
      borrowingAnalysis,
      usableEquity,
      effectiveCashToDeploy,
      selectedDepositStrategy.depositRatio,
    ]
  )

  const scenarioDebug = useMemo(
    () => ({
      rawEquity: Math.max(totalPortfolioValue - totalPortfolioDebt, 0),
      totalPortfolioValue,
      totalPortfolioDebt,
      equityBeforeBuffer: usableEquity,
      safetyBuffer: scenarioModel.assumptions?.liquidityBuffer ?? 0,
      usableEquityAfterBuffer: scenarioModel.inputs?.usableEquityAfterBuffer ?? 0,
      rawCashAvailableForInvestment: rawAvailableCashForInvestment,
      maxCashAvailableForInvestment,
      cashToDeploy,
      effectiveCashToDeploy,
      depositStrategy: selectedDepositStrategy.value,
      depositRatio: selectedDepositStrategy.depositRatio,
      isSliderDisabled,
      isInputDisabled: false,
      totalDeployableCapital: scenarioModel.inputs?.totalDeployableCapital ?? 0,
      scenarioInputs: scenarioModel.inputs,
      scenarioOutputs: scenarioModel.scenarios.map((scenario) => ({
        id: scenario.id,
        title: scenario.title,
        recommendedRange: scenario.recommendedPurchaseRange?.label,
        depositRequired: scenario.depositRequired,
        acquisitionCosts: scenario.estimatedAcquisitionCosts,
        lmiEstimate: scenario.lmiEstimate ?? 0,
        loanSize: scenario.estimatedLoanSize,
        postPurchaseSurplus: scenario.estimatedPostPurchaseSurplus,
        borrowingCapacityAfterPurchase: scenario.borrowingCapacityAfterPurchase,
      })),
    }),
    [
      rawAvailableCashForInvestment,
      maxCashAvailableForInvestment,
      cashToDeploy,
      effectiveCashToDeploy,
      isSliderDisabled,
      scenarioModel,
      selectedDepositStrategy.depositRatio,
      selectedDepositStrategy.value,
      totalPortfolioDebt,
      totalPortfolioValue,
      usableEquity,
    ]
  )

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__equifolioScenarioDebug = scenarioDebug
    }

    console.debug('Equifolio growth cash allocation debug', {
      rawEquity: scenarioDebug.rawEquity,
      totalPortfolioValue,
      totalPortfolioDebt,
      equityBeforeBuffer: usableEquity,
      safetyBuffer: scenarioModel.assumptions?.liquidityBuffer ?? 0,
      usableEquityAfterBuffer: scenarioModel.inputs?.usableEquityAfterBuffer ?? 0,
      cashToDeploy: effectiveCashToDeploy,
      depositStrategy: selectedDepositStrategy.value,
      depositRatio: selectedDepositStrategy.depositRatio,
      totalDeployableCapital: scenarioModel.inputs?.totalDeployableCapital ?? 0,
      maxCashAvailableForInvestment,
      slider: {
        min: 0,
        max: maxCashAvailableForInvestment,
        value: effectiveCashToDeploy,
      },
      scenarioRecalculationTrigger: {
        cashToDeploy: effectiveCashToDeploy,
        scenarioCount: scenarioModel.scenarios.length,
      },
    })
  }, [
    effectiveCashToDeploy,
    maxCashAvailableForInvestment,
    scenarioModel.scenarios.length,
    scenarioModel.assumptions,
    scenarioModel.inputs,
    scenarioDebug,
    selectedDepositStrategy.depositRatio,
    selectedDepositStrategy.value,
    totalPortfolioDebt,
    totalPortfolioValue,
    usableEquity,
  ])

  const normalizedScenarios = useMemo(
    () => (scenarioModel.scenarios || []).map(normalizeScenario),
    [scenarioModel.scenarios]
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading growth scenarios...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl px-4 py-8">
        <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm shadow-gray-100/70 md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
            Growth Scenarios
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            Portfolio Growth Scenarios
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600 md:text-base">
            These scenarios show how current borrowing headroom and deployable equity can be
            deployed into the next acquisition path using only the data already stored in Equifolio.
          </p>
        </section>

        <section className="mt-5 rounded-3xl border border-gray-100 bg-white px-5 py-4 shadow-sm shadow-gray-100/70">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <HeaderMetric label="Current capacity" value={formatCurrency(scenarioModel.inputs.borrowingCapacity || 0)} />
            <HeaderMetric
              label="Usable equity (after buffer)"
              value={formatCurrency(scenarioModel.inputs.usableEquityAfterBuffer || 0)}
            />
            <HeaderMetric label="Cash to deploy" value={formatCurrency(effectiveCashToDeploy)} />
            <HeaderMetric label="Total deployable capital" value={formatCurrency(scenarioModel.inputs.totalDeployableCapital || 0)} />
            <HeaderMetric
              label="Debt rate assumption"
              value={`${Number(scenarioModel.assumptions.interestRatePct || 0).toFixed(1)}%`}
            />
          </div>
          <div className="mt-4 flex flex-col gap-1 text-sm text-gray-500 md:flex-row md:items-center md:justify-between">
            <p>
              Includes a safety buffer to maintain liquidity and protect against unexpected costs.
            </p>
            <p>
              Safety buffer applied: {formatCurrency(scenarioModel.assumptions.liquidityBuffer || 0)}
            </p>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm shadow-gray-100/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                Cash Allocation
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-gray-900">
                Adjust cash allocation
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
                Choose how much available cash to deploy alongside usable equity.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                Confidence
              </p>
              <p className="mt-1 text-base font-semibold text-gray-900">
                {scenarioModel.confidence?.label} ({scenarioModel.confidence?.score || 0}%)
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr,220px,140px]">
            <div>
              <input
                type="range"
                min={0}
                max={maxCashAvailableForInvestment}
                step={1000}
                value={effectiveCashToDeploy}
                onChange={(event) =>
                  setCashToDeploy(
                    clampCashToDeploy(event.target.value, maxCashAvailableForInvestment)
                  )
                }
                disabled={isSliderDisabled}
                className="w-full disabled:cursor-not-allowed disabled:opacity-50"
              />
              {isSliderDisabled ? (
                <p className="mt-2 text-sm text-gray-500">
                  Add cash in Financials to enable.
                </p>
              ) : null}
            </div>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                Deposit strategy
              </span>
              <select
                value={selectedDepositStrategy.value}
                onChange={(event) => setDepositStrategy(event.target.value || '20')}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-primary-300"
              >
                {DEPOSIT_STRATEGY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                Cash to deploy
              </span>
              <input
                type="number"
                min={0}
                max={maxCashAvailableForInvestment}
                step={1000}
                value={effectiveCashToDeploy}
                onChange={(event) =>
                  setCashToDeploy(
                    clampCashToDeploy(
                      event.target.value === '' ? 0 : event.target.value,
                      maxCashAvailableForInvestment
                    )
                  )
                }
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-primary-300"
              />
            </label>
          </div>
          {selectedDepositStrategy.depositRatio < 0.2 ? (
            <div className="mt-4 flex flex-col gap-1 text-sm text-amber-700 md:flex-row md:items-center md:justify-between">
              <p>Indicative only — actual LMI depends on lender, LVR, and borrower profile.</p>
              <p>Lower deposits increase leverage, repayments, and risk.</p>
            </div>
          ) : null}
        </section>

        {scenarioModel.recommendedStrategy ? (
          <section className="mt-5 rounded-[2rem] border border-primary-100 bg-primary-50/60 p-6 shadow-sm shadow-primary-100/40">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-700">
              Recommended Strategy
            </p>
            <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  Option {scenarioModel.recommendedStrategy.selectedOption}: {scenarioModel.recommendedStrategy.title}
                </h2>
                <div className="mt-4 space-y-2 text-sm text-gray-700">
                  {scenarioModel.recommendedStrategy.reasons.map((reason) => (
                    <p key={reason}>• {reason}</p>
                  ))}
                </div>
              </div>
              <div className="max-w-md">
                <p className="text-sm font-semibold text-gray-900">Trade-offs</p>
                <div className="mt-3 space-y-2 text-sm text-gray-700">
                  {scenarioModel.recommendedStrategy.tradeOffs.map((tradeOff) => (
                    <p key={tradeOff}>• {tradeOff}</p>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {scenarioModel.viability?.limitingFactor === 'capital' ? (
          <section className="mt-5 rounded-[2rem] border border-amber-100 bg-amber-50/70 p-6 shadow-sm shadow-amber-100/50">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
              Limiting Factor
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900">
              You are limited by capital, not borrowing capacity
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <HeaderMetric label="Borrowing capacity" value={formatCurrency(scenarioModel.inputs.borrowingCapacity || 0)} />
              <HeaderMetric label="Max deployable purchase" value={formatCurrency(scenarioModel.viability?.availableCapital || 0)} />
              <HeaderMetric label="Limiting factor" value="Equity / cash" />
            </div>
          </section>
        ) : null}

        {scenarioModel.scenarios.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
            {normalizedScenarios.map((scenario, index) => (
              <section
                key={scenario.id}
                className={`rounded-[2rem] border bg-white p-6 shadow-sm shadow-gray-100/70 ${
                  scenarioModel.recommendedStrategy?.id === scenario.id
                    ? 'border-primary-200 ring-1 ring-primary-100'
                    : 'border-gray-100'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                      Option {index + 1}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-gray-900">{scenario.title}</h2>
                  </div>
                  <div className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-wide text-primary-700">You can acquire</p>
                    <p className="mt-1 text-lg font-semibold text-primary-700">
                      {scenario.propertyCount} {scenario.propertyCount === 1 ? 'property' : 'properties'}
                    </p>
                    <p className="mt-1 text-sm text-primary-700">{scenario.recommendedPurchaseRange.label}</p>
                  </div>
                </div>

                <div className="mt-5 grid min-h-[248px] grid-cols-1 gap-3 sm:grid-cols-2">
                  <ScenarioMetric label="Recommended range" value={scenario.recommendedPurchaseRange.label} />
                  <ScenarioMetric label="Stretch range" value={scenario.stretchRange.label || 'Not recommended'} />
                  <ScenarioMetric label="Deposit required" value={formatCurrency(scenario.depositRequired)} />
                  <ScenarioMetric label="Acquisition costs" value={formatCurrency(scenario.estimatedAcquisitionCosts)} />
                  <ScenarioMetric label="Loan size" value={formatCurrency(scenario.estimatedLoanSize)} />
                  <ScenarioMetric
                    label="Post-purchase surplus"
                    value={formatCurrency(scenario.estimatedPostPurchaseSurplus)}
                  />
                  <ScenarioMetric
                    label="Monthly cash flow"
                    value={`${scenario.estimatedMonthlyCashFlow >= 0 ? '+' : '-'}${formatCurrency(
                      Math.abs(scenario.estimatedMonthlyCashFlow)
                    )}/month`}
                  />
                  <ScenarioMetric label="Yield" value={`${scenario.estimatedGrossYield.toFixed(1)}% gross`} />
                  <ScenarioMetric
                    label="5-year equity projection"
                    value={formatCurrency(scenario.fiveYearEquityProjection)}
                  />
                  <ScenarioMetric
                    label="Borrowing capacity after purchase"
                    value={formatCurrency(scenario.borrowingCapacityAfterPurchase)}
                  />
                </div>

                <p className="mt-4 text-sm leading-6 text-gray-600">{scenario.rationale}</p>

                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                      Confidence
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {scenario.confidenceLabel} ({scenario.confidenceScore}%)
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                      Capital used
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {formatCurrency(scenario.depositRequired + scenario.estimatedAcquisitionCosts)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      LMI estimate: {formatCurrency(scenario.lmiEstimate ?? 0)}
                    </p>
                  </div>
                </div>

                {scenario.warnings?.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
                      Warnings
                    </p>
                    <div className="mt-2 space-y-1.5 text-sm text-gray-700">
                      {scenario.warnings.map((warning) => (
                        <p key={warning}>• {warning}</p>
                      ))}
                    </div>
                  </div>
                ) : null}

                <details className="mt-5 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-900">
                    How this strategy is calculated
                  </summary>

                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <BreakdownBlock
                      title="Capital"
                      rows={[
                        ['Usable equity before buffer', scenario.capitalBreakdown?.usableEquityBeforeBuffer ?? formatCurrency(0)],
                        ['Usable equity after buffer', scenario.capitalBreakdown?.usableEquityAfterBuffer ?? formatCurrency(0)],
                        ['Cash used', scenario.capitalBreakdown?.cashUsed ?? formatCurrency(0)],
                        ['Total capital used', scenario.capitalBreakdown?.totalCapitalUsed ?? formatCurrency(0)],
                        ['Buffer retained', scenario.capitalBreakdown?.bufferRetained ?? formatCurrency(0)],
                        ['Total deployable capital', scenario.capitalBreakdown?.totalDeployableCapital ?? formatCurrency(0)],
                      ]}
                    />
                    <BreakdownBlock
                      title="Purchase Structure"
                      rows={[
                        ['Target price', scenario.purchaseStructure?.targetPrice ?? formatCurrency(0)],
                        ['Deposit (%)', scenario.purchaseStructure?.depositPct ?? '0%'],
                        ['Deposit amount', scenario.purchaseStructure?.depositAmount ?? formatCurrency(0)],
                        ['Acquisition costs', scenario.purchaseStructure?.acquisitionCosts ?? formatCurrency(0)],
                        ['LMI estimate', scenario.purchaseStructure?.lmiEstimate ?? formatCurrency(0)],
                        ['Total capital required', scenario.purchaseStructure?.totalCapitalRequired ?? formatCurrency(0)],
                      ]}
                    />
                    <BreakdownBlock
                      title="Loan Structure"
                      rows={[
                        ['Base loan size', scenario.loanStructure?.baseLoanSize ?? formatCurrency(0)],
                        ['LMI estimate', scenario.loanStructure?.lmiEstimate ?? formatCurrency(0)],
                        ['Loan size', scenario.loanStructure?.loanSize ?? formatCurrency(0)],
                        ['Interest rate assumption', scenario.loanStructure?.interestRate ?? '0.0%'],
                        ['Monthly repayment', scenario.loanStructure?.monthlyRepayment ?? formatCurrency(0)],
                      ]}
                    />
                    <BreakdownBlock
                      title="Cash Flow"
                      rows={[
                        ['Rental income', scenario.cashFlowBreakdown?.rentalIncome ?? `${formatCurrency(0)}/month`],
                        ['Expenses', scenario.cashFlowBreakdown?.expenses ?? `${formatCurrency(0)}/month`],
                        ['Net cash flow', scenario.cashFlowBreakdown?.netCashFlow ?? `${formatCurrency(0)}/month`],
                      ]}
                    />
                    <BreakdownBlock
                      title="Serviceability Impact"
                      rows={[
                        ['Surplus before', scenario.serviceabilityImpact?.surplusBefore ?? formatCurrency(0)],
                        ['Surplus after', scenario.serviceabilityImpact?.surplusAfter ?? formatCurrency(0)],
                        ['Borrowing after purchase', scenario.serviceabilityImpact?.borrowingCapacityAfterPurchase ?? formatCurrency(0)],
                      ]}
                    />
                    <BreakdownBlock
                      title="Growth Assumptions"
                      rows={[
                        ['Growth rate', scenario.growthAssumptions?.growthRate ?? '0.0%'],
                        ['5-year value', scenario.growthAssumptions?.fiveYearValue ?? formatCurrency(0)],
                        ['Equity created', scenario.growthAssumptions?.equityCreated ?? formatCurrency(0)],
                      ]}
                    />
                    <BreakdownBlock
                      title="Constraints"
                      rows={
                        (scenario.constraints || []).length > 0
                          ? scenario.constraints.map((constraint, index) => [
                              `Constraint ${index + 1}`,
                              constraint,
                            ])
                          : [['Status', 'No active cap beyond the core assumptions.']]
                      }
                    />
                  </div>
                </details>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('/properties')}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
                  >
                    Review portfolio
                    <ChevronRight size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/borrowing-power')}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
                  >
                    View borrowing breakdown
                    <ArrowRight size={15} />
                  </button>
                </div>
              </section>
            ))}
          </div>
        ) : (
          <section className="mt-6 rounded-[2rem] border border-dashed border-gray-200 bg-white p-8 text-center shadow-sm shadow-gray-100/70">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-primary-600">
              <Landmark size={22} />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">Growth scenarios need more deployable capacity</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Record more Financials detail or improve borrowing headroom to unlock acquisition scenarios here.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/financials')}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
              >
                Complete Financials
                <ChevronRight size={15} />
              </button>
              <button
                type="button"
                onClick={() => navigate('/borrowing-power')}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
              >
                Review borrowing position
                <ArrowRight size={15} />
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function HeaderMetric({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function ScenarioMetric({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function BreakdownBlock({ title, rows }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
        {title}
      </p>
      <div className="mt-3 space-y-3">
        {rows.map(([label, value]) => (
          <div key={`${title}-${label}`} className="flex items-start justify-between gap-3">
            <span className="text-sm text-gray-500">{label}</span>
            <span className="text-right text-sm font-semibold text-gray-900">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
