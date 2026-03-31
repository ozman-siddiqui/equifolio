import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Plus, Siren, Sparkles } from 'lucide-react'

import AddPropertyModal from '../components/AddPropertyModal'
import UpgradeModal from '../components/UpgradeModal'
import ActionCard from '../components/dashboard/ActionCard'
import AIOpportunityCard from '../components/dashboard/AIOpportunityCard'
import CommandCentreCard from '../components/dashboard/CommandCentreCard'
import DashboardPromptCard from '../components/dashboard/DashboardPromptCard'
import DashboardBorrowingPowerCard from '../components/dashboard/BorrowingPowerCard'
import BorrowingPowerBreakdown from '../components/dashboard/BorrowingPowerBreakdown'
import HeroDecisionCard from '../components/dashboard/HeroDecisionCard'
import PropertyCard from '../components/dashboard/PropertyCard'
import ScenarioCard from '../components/dashboard/ScenarioCard'
import SetupProgress from '../components/dashboard/SetupProgress'
import GrowthPathways from '../components/dashboard/GrowthPathways'
import { buildAlerts } from '../components/AlertsDropdown'
import { utilityPrimaryButtonClass, utilitySecondaryButtonClass } from '../components/CardPrimitives'
import useFinancialData from '../hooks/useFinancialData'
import usePortfolioData from '../hooks/usePortfolioData'
import calculateBorrowingPower from '../lib/borrowingPowerEngine'
import buildDashboardCommandCenter from '../lib/dashboardCommandCenter'
import buildDashboardCompleteness from '../lib/dashboardCompleteness'
import buildDashboardFinancialAudit from '../lib/dashboardFinancialAudit'
import buildDashboardStateResolver from '../lib/dashboardStateResolver'
import { calculateAcquisitionReadiness } from '../lib/acquisitionReadinessScore'
import { calculateYieldFirstScenario } from '../lib/yieldFirstStrategy'

const PLAN_LIMITS = { starter: 3, investor: 10, premium: Infinity }

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))

export default function Dashboard({ session, subscription }) {
  const navigate = useNavigate()
  const { properties, loans, transactions, loading, fetchData } = usePortfolioData()
  const { financialProfile, liabilities } = useFinancialData()

  const [showAddProperty, setShowAddProperty] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const handleOpenAddProperty = () => {
    const plan = (subscription?.plan || 'starter').toLowerCase()
    const limit = PLAN_LIMITS[plan] || 3

    if (properties.length >= limit) {
      setShowUpgradeModal(true)
      return
    }

    setShowAddProperty(true)
  }

  const alerts = useMemo(() => buildAlerts(properties, loans), [properties, loans])

  const borrowingPowerAnalysis = useMemo(() => {
    try {
      return calculateBorrowingPower({
        financialProfile,
        liabilities,
        loans,
        transactions,
      })
    } catch (error) {
      console.error('Borrowing power analysis failed', {
        error,
        loanCount: Array.isArray(loans) ? loans.length : 0,
      })

      return {
        status: 'error',
        isBlocked: true,
        confidenceLabel: 'Low',
      }
    }
  }, [financialProfile, liabilities, loans, transactions])

  const dashboardCompleteness = useMemo(
    () =>
      buildDashboardCompleteness({
        properties,
        loans,
        financialProfile,
        liabilities,
      }),
    [properties, loans, financialProfile, liabilities]
  )

  const dashboardState = useMemo(
    () =>
      buildDashboardStateResolver({
        properties,
        loans,
        transactions,
        financialProfile,
        liabilities,
        dashboardCompleteness,
        borrowingAnalysis: borrowingPowerAnalysis,
      }),
    [
      properties,
      loans,
      transactions,
      financialProfile,
      liabilities,
      dashboardCompleteness,
      borrowingPowerAnalysis,
    ]
  )

  const commandCenter = useMemo(
    () =>
      buildDashboardCommandCenter({
        properties,
        loans,
        transactions,
        alerts,
        borrowingAnalysis: borrowingPowerAnalysis,
        dashboardCompleteness,
        dashboardState,
        financialProfile,
        liabilities,
      }),
    [
      properties,
      loans,
      transactions,
      alerts,
      borrowingPowerAnalysis,
      dashboardCompleteness,
      dashboardState,
      financialProfile,
      liabilities,
    ]
  )

  const growthScenarios = commandCenter?.growthScenarios

  const borrowingRenderState = useMemo(() => {
    const setupComplete = Boolean(dashboardState?.setupComplete)
    const analysisStatus = borrowingPowerAnalysis?.status
    const confidence = borrowingPowerAnalysis?.confidenceLabel || 'Low'

    if (!setupComplete) {
      return {
        state: 'locked',
        confidence,
        warning: null,
      }
    }

    if (analysisStatus === 'error') {
      return {
        state: 'warning',
        confidence: 'Low',
        warning:
          'Borrowing inputs are complete, but one or more mortgage assumptions could not be assessed cleanly. Review the breakdown before acting.',
      }
    }

    if (analysisStatus === 'partial') {
      return {
        state: 'warning',
        confidence,
        warning:
          'Borrowing analysis is shown using inferred or partial inputs. Review the explainability notes before acting.',
      }
    }

    return {
      state: 'ready',
      confidence,
      warning: null,
    }
  }, [dashboardState, borrowingPowerAnalysis])

  const dashboardFinancialAudit = useMemo(
    () =>
      buildDashboardFinancialAudit({
        properties,
        loans,
        transactions,
        financialProfile,
        liabilities,
        borrowingAnalysis: borrowingPowerAnalysis,
        dashboardCompleteness,
        dashboardState,
        commandCenter,
        borrowingRenderState,
      }),
    [
      properties,
      loans,
      transactions,
      financialProfile,
      liabilities,
      borrowingPowerAnalysis,
      dashboardCompleteness,
      dashboardState,
      commandCenter,
      borrowingRenderState,
    ]
  )

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__equifolioDashboardAudit = dashboardFinancialAudit
    }

    console.debug('Equifolio dashboard financial audit', dashboardFinancialAudit)
  }, [dashboardFinancialAudit])

  useEffect(() => {
    const borrowingSnapshot = {
      scope: 'dashboard',
      inputs: {
        financialProfilePresent: Boolean(financialProfile),
        liabilityCount: Array.isArray(liabilities) ? liabilities.length : null,
        loanCount: Array.isArray(loans) ? loans.length : null,
        transactionCount: Array.isArray(transactions) ? transactions.length : null,
      },
      calculatedSurplus: borrowingPowerAnalysis?.net_monthly_surplus ?? null,
      borrowingCapacity: borrowingPowerAnalysis?.borrowing_power_estimate ?? null,
      assessedMortgageCommitments:
        borrowingPowerAnalysis?.assessed_mortgage_commitments_monthly ?? null,
    }

    if (typeof window !== 'undefined') {
      window.__equifolioBorrowingSnapshots = {
        ...(window.__equifolioBorrowingSnapshots || {}),
        dashboard: borrowingSnapshot,
      }
    }

    const debugPayload = {
      setupComplete: dashboardState?.isSetupComplete,
      unifiedSetupComplete: dashboardState?.setupComplete,
      setupProgress: {
        setupCompletionLabel: dashboardState?.setupCompletionLabel,
        stage: dashboardState?.stage,
        checklist: dashboardState?.setupChecklist,
      },
      financialProfile,
      liabilities,
      loans,
      borrowingInputs: borrowingSnapshot.inputs,
      assessedMortgageCommitments:
        borrowingPowerAnalysis?.assessed_mortgage_commitments_monthly ?? null,
      calculatedSurplus: borrowingSnapshot.calculatedSurplus,
      borrowingCapacity: borrowingSnapshot.borrowingCapacity,
      borrowingRenderState: borrowingRenderState.state,
      borrowingConfidenceState: borrowingRenderState.confidence,
    }

    console.debug('Equifolio borrowing render debug', debugPayload)

    if (dashboardState?.setupComplete && borrowingRenderState.state === 'locked') {
      console.warn('Setup/borrowing state mismatch detected', debugPayload)
    }
  }, [
    dashboardState,
    financialProfile,
    liabilities,
    loans,
    transactions,
    borrowingPowerAnalysis,
    borrowingRenderState,
  ])

  const totalPropertyValue = useMemo(
    () => properties.reduce((sum, property) => sum + Number(property?.current_value || 0), 0),
    [properties]
  )

  const yieldFirstScenario = useMemo(
    () => {
      if (!commandCenter || !borrowingPowerAnalysis || !growthScenarios) return null

      const borrowingCapacity = Number(
        borrowingPowerAnalysis?.borrowing_power_estimate
      )
      const deployableCapital = Number(
        growthScenarios?.inputs?.totalDeployableCapital
      )
      const totalPortfolioValue = Number(totalPropertyValue)

      if (
        !Number.isFinite(borrowingCapacity) ||
        !Number.isFinite(deployableCapital) ||
        !Number.isFinite(totalPortfolioValue)
      ) {
        return null
      }

      const result = calculateYieldFirstScenario({
        borrowingCapacity,
        deployableCapital,
        interestRatePct: Number(
          growthScenarios?.assumptions?.interestRatePct ??
            growthScenarios?.assumptions?.defaultInterestRatePct ??
            5.8
        ),
        depositRatio: Number(growthScenarios?.assumptions?.depositRatio ?? 0.2),
        acquisitionCostRate: Number(
          growthScenarios?.assumptions?.acquisitionCostRate ?? 0.05
        ),
        netMonthlySurplus: Number(
          borrowingPowerAnalysis?.net_monthly_surplus ?? 0
        ),
        totalPortfolioValue,
        metroBlocked: (commandCenter?.capacityUseCases?.length || 0) === 0,
      })

      return result
    },
    [borrowingPowerAnalysis, commandCenter, growthScenarios, totalPropertyValue]
  )

  const acquisitionReadiness = useMemo(() => {
    if (!commandCenter || !growthScenarios || !yieldFirstScenario) return null

    return calculateAcquisitionReadiness({
      borrowingCapacity: Number(
        borrowingPowerAnalysis?.borrowing_power_estimate ?? 0
      ),
      deployableCapital: Number(
        growthScenarios?.inputs?.totalDeployableCapital ?? 0
      ),
      netMonthlySurplus: Number(
        borrowingPowerAnalysis?.net_monthly_surplus ?? 0
      ),
      usableEquity:
        growthScenarios?.inputs?.usableEquity ?? null,
      borrowingReady: Boolean(
        dashboardCompleteness?.borrowingReady
      ),
      financialProfileComplete: Boolean(
        dashboardCompleteness?.financialProfileComplete
      ),
      loanDataComplete: Boolean(
        dashboardCompleteness?.loanDataComplete
      ),
      hasLiabilitiesData: Boolean(
        Array.isArray(liabilities) && liabilities.length > 0
      ),
      setupCompletionPct: Number(
        dashboardCompleteness?.setupCompletionPct ?? 0
      ),
      yieldFirstExecutable: Boolean(
        yieldFirstScenario?.isExecutable
      ),
      yieldFirstConstraintType:
        yieldFirstScenario?.constraintType ?? null,
      estimatedMonthsToMetro: Number(
        yieldFirstScenario?.estimatedMonthsToMetro ?? 0
      ),
      totalDeployableCapital: Number(
        growthScenarios?.inputs?.totalDeployableCapital ?? 0
      ),
      depositRatio: Number(
        growthScenarios?.assumptions?.depositRatio ?? 0.2
      ),
      acquisitionCostRate: Number(
        growthScenarios?.assumptions?.acquisitionCostRate ?? 0.05
      )
    })
  }, [
    commandCenter,
    growthScenarios,
    yieldFirstScenario,
    borrowingPowerAnalysis,
    dashboardCompleteness,
    liabilities,
  ])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading your portfolio...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl px-4 py-8">
        <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm shadow-gray-100/70 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                Portfolio
              </p>

              <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
                Portfolio Command Centre
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600 md:text-base">
                Your current position, constraints, and next best actions.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate('/properties')}
                className={utilitySecondaryButtonClass}
              >
                View Properties
                <ChevronRight size={15} />
              </button>

              <button
                type="button"
                onClick={handleOpenAddProperty}
                className={utilityPrimaryButtonClass}
              >
                <Plus size={15} />
                Add Property
              </button>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-gray-100 bg-white px-5 py-4 shadow-sm shadow-gray-100/70">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-6">
              <StripMetric
                label="Data Coverage"
                value={`${commandCenter.dataCoveragePct}%`}
              />
              <StripMetric
                label="Decision Confidence"
                value={commandCenter.decisionConfidence}
              />
            </div>

            <p className="text-sm text-gray-500">
              Better data coverage sharpens borrowing, refinance, and portfolio actions.
            </p>
          </div>
        </section>

        <div className="mt-5 mb-[22px]">
          <HeroDecisionCard
            purchaseRangeLow={475000}
            purchaseRangeHigh={550000}
            fiveYearEquityUplift={298638}
            monthlyHoldingCost={-982}
            grossYield={5.5}
            currentEquity={576500}
            year3Equity={720000}
            year5Equity={875138}
            unlockValue={39016}
            acquisitionReadinessScore={79}
            acquisitionReadinessLabel="Getting close"
            isExecutable={true}
          />
        </div>

        {!dashboardState.hasProperties ? (
          <section className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
            {dashboardState.missingSections.map((section) => (
              <DashboardPromptCard
                key={section.id}
                eyebrow={section.label}
                title={section.title}
                body={section.body}
                ctaLabel={section.ctaLabel}
                onAction={() => navigate(section.route)}
              />
            ))}
          </section>
        ) : (
          <>
            <section className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
              {dashboardState.canShowNetPosition ? (
                <CommandCentreCard
                  eyebrow="Net Position"
                  title={dashboardState.showNetPositionPartial ? 'Asset Value' : 'Net Equity'}
                  value={
                    dashboardState.showNetPositionPartial
                      ? totalPropertyValue
                      : commandCenter.hero.netPosition.value
                  }
                  helper={
                    dashboardState.showNetPositionPartial
                      ? 'Asset-only view until all mortgages are recorded'
                      : commandCenter.hero.netPosition.helper
                  }
                  subtitle={
                    dashboardState.showNetPositionPartial
                      ? 'Add mortgage details for every property to calculate true net equity, leverage, and LVR.'
                      : commandCenter.hero.netPosition.subtitle
                  }
                  cta={{
                    label: dashboardState.showNetPositionPartial ? 'Add Mortgage' : commandCenter.hero.netPosition.cta.label,
                  }}
                  onClick={() =>
                    navigate(
                      dashboardState.showNetPositionPartial
                        ? '/mortgages'
                        : commandCenter.hero.netPosition.cta.route
                    )
                  }
                />
              ) : (
                <DashboardPromptCard
                  eyebrow="Net Position"
                  title="Add property values"
                  body="Portfolio position only appears when your properties have current values recorded."
                  ctaLabel="Review properties"
                  onAction={() => navigate('/properties')}
                />
              )}

              {dashboardState.canShowMonthlyPosition ? (
                <CommandCentreCard
                  eyebrow="Monthly Position"
                  title="Cash Flow and Surplus"
                  metrics={[
                    {
                      label: 'Property cash flow',
                      value: dashboardState.canShowPropertyCashFlow
                        ? commandCenter.hero.monthlyPosition.propertyCashFlow
                        : null,
                      helper: dashboardState.canShowPropertyCashFlow
                        ? 'Portfolio-level property inflows less property expenses'
                        : 'Add rent and property expenses to unlock portfolio cash flow',
                      tone:
                        commandCenter.hero.monthlyPosition.propertyCashFlow >= 0
                          ? 'text-green-600'
                          : 'text-red-500',
                    },
                    {
                      label: 'Actual monthly surplus',
                      value: dashboardState.canShowActualMonthlySurplus
                        ? borrowingPowerAnalysis?.actual_monthly_surplus
                        : null,
                      displayValue: dashboardState.canShowActualMonthlySurplus
                        ? null
                        : 'Incomplete',
                      helper: dashboardState.canShowActualMonthlySurplus
                        ? 'Estimated after tax. Uses after-tax income, recorded rent, property expenses, actual liabilities, and current mortgage repayments.'
                        : 'Complete cash flow tracking to calculate your real monthly position.',
                      tone:
                        Number(borrowingPowerAnalysis?.actual_monthly_surplus) >= 0
                          ? 'text-primary-700'
                          : dashboardState.canShowActualMonthlySurplus
                            ? 'text-red-500'
                            : 'text-gray-500',
                    },
                    {
                      label: 'Serviceability surplus',
                      value: dashboardState.canShowHouseholdSurplus
                        ? commandCenter.hero.monthlyPosition.householdSurplus
                        : null,
                      helper: dashboardState.canShowHouseholdSurplus
                        ? 'Surplus after lender-style income shading, assessment buffers, and assessed commitments.'
                        : 'Add Financials to unlock serviceability surplus analysis',
                      tone:
                        Number(commandCenter.hero.monthlyPosition.householdSurplus) >= 0
                          ? 'text-primary-700'
                          : 'text-red-500',
                    },
                  ]}
                  subtitle="Property cash flow, your real monthly position, and the lender view are shown separately."
                  cta={{
                    label:
                      !dashboardState.canShowActualMonthlySurplus || !dashboardState.canShowPropertyCashFlow
                        ? 'Go to Cash Flow'
                        : dashboardState.canShowHouseholdSurplus
                          ? 'Explore cash flow'
                          : 'Open financials',
                  }}
                  onClick={() =>
                    navigate(
                      !dashboardState.canShowActualMonthlySurplus || !dashboardState.canShowPropertyCashFlow
                        ? '/cashflow'
                        : dashboardState.canShowHouseholdSurplus
                          ? '/cashflow'
                          : '/financials'
                    )
                  }
                />
              ) : (
                <DashboardPromptCard
                  eyebrow="Monthly Position"
                  title="Complete monthly position inputs"
                  body="Add property transactions and household financials to unlock portfolio cash flow, actual monthly surplus, and lender-view serviceability analysis."
                  ctaLabel="Open setup"
                  onAction={() => navigate('/financials')}
                />
              )}

              {dashboardState.canShowBorrowing ? (
                <DashboardBorrowingPowerCard
                  currentCapacity={commandCenter.hero.borrowingPower.currentCapacity}
                  unlockPotential={commandCenter.hero.borrowingPower.unlockPotential}
                  subtitle={
                    borrowingRenderState.state === 'warning'
                      ? 'Borrowing output is available, but confidence is reduced. Use the breakdown before acting.'
                      : 'Additional borrowing headroom visible from your next best move'
                  }
                  warning={borrowingRenderState.warning}
                  confidence={borrowingRenderState.confidence}
                  cta={{ label: 'Explore scenarios' }}
                  onCta={() => navigate('/growth-scenarios')}
                />
              ) : (
                <DashboardPromptCard
                  eyebrow="Borrowing Power"
                  title="Complete setup to unlock borrowing analysis"
                  body="Borrowing power stays locked until Financials, liabilities, and mortgage commitments are fully recorded."
                  ctaLabel={dashboardState.missingSections[0]?.ctaLabel || 'Open setup'}
                  onAction={() => navigate(dashboardState.missingSections[0]?.route || '/financials')}
                />
              )}
            </section>

            {dashboardState.canShowTopActions ? (
              <section className="mt-6 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm shadow-gray-100/70 md:p-7">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                    Actions
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-gray-900">
                    What to fix first
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    Ranked actions unlocked from validated portfolio, mortgage, and household inputs.
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {commandCenter.topActions.slice(0, 2).map((action, index) => (
                    <ActionCard
                      key={action.id}
                      rank={action.rank ?? index + 1}
                      sequenceLabel={action.sequenceLabel}
                      title={action.title}
                      impact={action.impactLabel || action.impact}
                      monthlyImpact={action.monthlyImpactDisplay}
                      yearlyImpact={action.yearlyImpactDisplay}
                      borrowingImpact={action.borrowingImpactDisplay}
                      rankReason={action.sequenceReason}
                      explanation={action.whyItMatters || action.problem}
                      featured={index === 0}
                      onExplore={() => navigate(action.route)}
                    />
                  ))}
                </div>
              </section>
            ) : (
              <section className="mt-6">
                <LockedChecklistCard
                  eyebrow="Actions"
                  title="Unlock your top actions"
                  body={dashboardState.topActionsLockedReason}
                  missingSections={dashboardState.missingSections}
                  onAction={(route) => navigate(route)}
                />
              </section>
            )}

            <section className="mt-8">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-[rgba(0,0,0,0.08)]" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                  Below the fold · compare paths
                </p>
                <div className="h-px flex-1 bg-[rgba(0,0,0,0.08)]" />
              </div>
            </section>

            {Number(dashboardState?.setupCompletionPct ?? 0) === 100 ? (
              <section className="hidden">
                <p className="text-sm text-gray-600">
                  Portfolio data complete · Decision confidence: {commandCenter.decisionConfidence} ·
                  {' '}Data coverage: {commandCenter.dataCoveragePct}%
                </p>
              </section>
            ) : (
              <SetupProgress state={dashboardState} onOpenSection={(route) => navigate(route)} />
            )}

            {dashboardState.canShowBorrowing && commandCenter.compareOptions?.length > 0 ? (
              <section className="mt-8 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm shadow-gray-100/70 md:p-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                  Trade-offs
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-gray-900">
                  Compare your options
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  See the financial consequences of staying put, applying the top recommendation, or deploying capital now.
                </p>

                <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
                  {commandCenter.compareOptions.map((option) => (
                    <CompareOptionCard key={option.id} option={option} />
                  ))}
                </div>
              </section>
            ) : null}

            <section className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr,0.8fr]">
              {dashboardState.canShowBorrowing && commandCenter.capacityUseCases.length > 0 ? (
                <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm shadow-gray-100/70 md:p-7">
                  <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                        Growth
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-gray-900">
                        Deploy your borrowing capacity
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                        Engine-generated acquisition scenarios based on your real serviceability and capital position.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {commandCenter.capacityUseCases.slice(0, 3).map((scenario, index) => (
                      <ScenarioCard
                        key={scenario.id}
                        label={`Option ${String.fromCharCode(65 + index)}`}
                        title={scenario.title}
                        priceRangeLabel={scenario.estimatedPriceRangeLabel}
                        priceRange={scenario.estimatedPriceRange}
                        yieldText={scenario.expectedRentalYield}
                        metricText={scenario.monthlyCashFlow}
                        rationale={scenario.outcome}
                        onExplore={() => navigate('/growth-scenarios')}
                      />
                    ))}
                  </div>
                </section>
              ) : dashboardState.canShowBorrowing ? (
                <GrowthPathways
                  yieldFirst={yieldFirstScenario}
                  acquisitionReadiness={acquisitionReadiness}
                  topAction={commandCenter?.topActions?.[0] || null}
                  borrowingCapacity={Number(
                    borrowingPowerAnalysis?.borrowing_power_estimate ?? 0
                  )}
                  availableCapital={Number(
                    growthScenarios?.inputs?.totalDeployableCapital ?? 0
                  )}
                  growthInputs={growthScenarios?.inputs ?? null}
                  totalPortfolioValue={Number(totalPropertyValue)}
                />
              ) : (
                <LockedChecklistCard
                  eyebrow="Growth"
                  title="Complete setup to unlock borrowing analysis"
                  body="Scenarios only appear when serviceability inputs are complete enough to support a real borrowing view."
                  missingSections={dashboardState.missingSections}
                  onAction={(route) => navigate(route)}
                />
              )}
            </section>

            <section className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr,0.8fr]">
              <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm shadow-gray-100/70 md:p-7">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                      Portfolio
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-gray-900">
                      Properties at a glance
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                      Each property shows its current position, so you can spot where
                      the next intervention matters most.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate('/properties')}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
                  >
                    View all
                    <ChevronRight size={15} />
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  {commandCenter.portfolioProperties.length > 0 ? (
                    commandCenter.portfolioProperties.map((property) => (
                      <PropertyCard
                        key={property.id}
                        address={property.address}
                        location={property.location}
                        equity={property.equity}
                        cashFlow={property.cashFlow}
                        status={property.status}
                        hasLoanCoverage={property.hasLoanCoverage}
                        onExplore={() => navigate(property.route)}
                      />
                    ))
                  ) : (
                    <EmptyState
                      title="No properties yet"
                      description="Add your first property to activate the Command Centre."
                      actionLabel="Add Property"
                      onAction={handleOpenAddProperty}
                    />
                  )}
                </div>
              </section>

              <AIOpportunityCard currentUserId={session.user.id} loans={loans} />
            </section>

            {dashboardState.canShowBorrowing && Array.isArray(borrowingPowerAnalysis?.topConstraints) && borrowingPowerAnalysis.topConstraints.length > 0 ? (
              <section className="mt-5 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm shadow-gray-100/70 md:p-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                  Constraints
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-gray-900">
                  What&apos;s holding you back
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Your borrowing is primarily limited by:
                </p>

                <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-700">
                  {borrowingPowerAnalysis.topConstraints.slice(0, 2).map((constraint) => (
                    <li key={constraint.type} className="flex items-start gap-3">
                      <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary-600" />
                      <div>
                        <p className="font-medium text-gray-900">{constraint.message}</p>
                        <p className="text-xs uppercase tracking-wide text-gray-400">
                          {constraint.severity} severity
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {dashboardState.canShowBorrowing ? (
              <section className="mt-5">
                <BorrowingPowerBreakdown
                  analysis={borrowingPowerAnalysis}
                  onViewFullBreakdown={() => navigate('/borrowing-power')}
                />
              </section>
            ) : null}

            {commandCenter.urgentAlerts.length > 0 ? (
              <section className="mt-5 rounded-[2rem] border border-red-100 bg-red-50/70 p-6 md:p-7">
                <div className="flex items-center gap-2 text-red-700">
                  <Siren size={18} />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em]">
                    Smart Alerts
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {commandCenter.urgentAlerts.map((alert) => (
                    <button
                      key={alert.id}
                      type="button"
                      onClick={() => navigate(alert.route)}
                      className="rounded-2xl border border-red-100 bg-white/80 p-5 text-left transition-colors hover:bg-white"
                    >
                      <p className="text-sm font-semibold text-gray-900">{alert.title}</p>
                      <p className="mt-2 text-sm font-medium text-red-700">{alert.impact}</p>
                      <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-600">
                        Explore
                        <ChevronRight size={15} />
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="mt-5 pb-2 text-center text-xs leading-6 text-gray-400">
              <p>Illustrative only. Not financial advice.</p>
            </section>
          </>
        )}
      </main>

      {showAddProperty ? (
        <AddPropertyModal
          userId={session.user.id}
          onClose={() => setShowAddProperty(false)}
          onSave={fetchData}
        />
      ) : null}

      {showUpgradeModal ? (
        <UpgradeModal
          currentPlan={subscription?.plan || 'starter'}
          currentCount={properties.length}
          onClose={() => setShowUpgradeModal(false)}
        />
      ) : null}
    </div>
  )
}

function StripMetric({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function LockedChecklistCard({ eyebrow, title, body, missingSections, onAction }) {
  return (
    <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm shadow-gray-100/70 md:p-7">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-gray-900">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-gray-600">{body}</p>

      <div className="mt-5 space-y-3">
        {missingSections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => onAction(section.route)}
            className="flex w-full items-start justify-between gap-4 rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-4 text-left transition-colors hover:bg-gray-50"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">{section.label}</p>
              <p className="mt-1 text-sm leading-6 text-gray-600">{section.body}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-primary-600">
              {section.ctaLabel}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function EmptyState({ title, description, actionLabel = null, onAction = null }) {
  return (
    <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50/60 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary-600 shadow-sm shadow-gray-100/80">
        <Sparkles size={18} />
      </div>
      <p className="mt-4 text-base font-semibold text-gray-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>
      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
        >
          {actionLabel}
          <ChevronRight size={15} />
        </button>
      ) : null}
    </div>
  )
}

function CompareOptionCard({ option }) {
  const annualTone =
    Number(option.annualImpact) >= 0 ? 'text-primary-700' : 'text-red-500'

  return (
    <article className="rounded-3xl border border-gray-100 bg-gray-50/70 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
        {option.scenario}
      </p>
      <p className={`mt-3 text-2xl font-semibold tracking-tight ${annualTone}`}>
        {`${Number(option.annualImpact) >= 0 ? '+' : '-'}${formatCurrency(
          Math.abs(Number(option.annualImpact || 0))
        )}/year`}
      </p>
      <div className="mt-4 space-y-2 text-sm text-gray-600">
        <div className="flex items-center justify-between gap-4">
          <span>Borrowing position</span>
          <span className="font-semibold text-gray-900">
            {formatCurrency(option.borrowing)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>Risk</span>
          <span className="font-semibold capitalize text-gray-900">{option.risk}</span>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-gray-600">{option.description}</p>
    </article>
  )
}
