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
import SetupProgress from '../components/dashboard/SetupProgress'
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
  const [isDashboardMounted, setIsDashboardMounted] = useState(false)

  const handleOpenAddProperty = () => {
    const plan = (subscription?.plan || 'starter').toLowerCase()
    const limit = PLAN_LIMITS[plan] || 3

    if (properties.length >= limit) {
      setShowUpgradeModal(true)
      return
    }

    setShowAddProperty(true)
  }

  useEffect(() => {
    setIsDashboardMounted(true)
  }, [])

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
  const netEquityDetailRows = useMemo(
    () =>
      (commandCenter?.portfolioProperties || [])
        .filter((property) => property?.equity != null)
        .slice(0, 2)
        .map((property) => ({
          label: property.address,
          value: formatCurrency(property.equity),
        })),
    [commandCenter]
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

  const leadScenario =
    commandCenter?.growthScenarios?.feasibleStrategies?.[0] ??
    commandCenter?.growthScenarios?.nearViableStrategies?.[0] ??
    commandCenter?.growthScenarios?.bestBlockedStrategy ??
    null

  const heroRangeLow = leadScenario
    ? Math.round(
        (leadScenario.fallbackPrice ??
          leadScenario.scenarioPurchasePrice ??
          475000) * 0.95
      )
    : null

  const heroRangeHigh = leadScenario
    ? Math.round(
        (leadScenario.fallbackPrice ??
          leadScenario.scenarioPurchasePrice ??
          475000) * 1.10
      )
    : null

  const heroMonthlyHoldingCost = leadScenario
    ? (leadScenario.estimatedMonthlyCashFlow ??
      leadScenario.estimatedPostPurchaseSurplus ??
      null)
    : null

  const heroGrossYield = leadScenario
    ? (leadScenario.estimatedGrossYield ??
      leadScenario.expectedRentalYield ??
      null)
    : null

  const heroFiveYearUplift = leadScenario
    ? (leadScenario.fiveYearEquityProjection ??
      null)
    : null

  const heroYear3Equity =
    leadScenario?.projectionData?.find((point) => point.year === 3)?.netEquity ?? null

  const heroYear5Equity =
    leadScenario?.projectionData?.find((point) => point.year === 5)?.netEquity ??
    leadScenario?.fiveYearEquityProjection ??
    null

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading your portfolio...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        .dashboard-mounted {
          animation: dashboardFadeSlideIn 350ms ease-out both;
        }

        @keyframes dashboardFadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <section
          className={`rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm shadow-gray-100/70 md:p-8 ${isDashboardMounted ? 'dashboard-mounted' : ''}`}
          style={isDashboardMounted ? { animationDelay: '0ms' } : { opacity: 0, transform: 'translateY(8px)' }}
        >
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

        <section
          className={`mt-4 rounded-3xl border border-gray-100 bg-white px-5 py-4 shadow-sm shadow-gray-100/70 ${isDashboardMounted ? 'dashboard-mounted' : ''}`}
          style={isDashboardMounted ? { animationDelay: '0ms' } : { opacity: 0, transform: 'translateY(8px)' }}
        >
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

        <div
          className={`mt-5 mb-[22px] ${isDashboardMounted ? 'dashboard-mounted' : ''}`}
          style={isDashboardMounted ? { animationDelay: '50ms' } : { opacity: 0, transform: 'translateY(8px)' }}
        >
          <HeroDecisionCard
            purchaseRangeLow={heroRangeLow}
            purchaseRangeHigh={heroRangeHigh}
            fiveYearEquityUplift={heroFiveYearUplift}
            monthlyHoldingCost={heroMonthlyHoldingCost}
            grossYield={heroGrossYield}
            currentEquity={commandCenter?.hero?.netPosition?.value ?? commandCenter?.totalValue ?? 0}
            year3Equity={heroYear3Equity}
            year5Equity={heroYear5Equity}
            unlockValue={commandCenter?.hero?.borrowingPower?.unlockPotential ?? 0}
            acquisitionReadinessScore={acquisitionReadiness?.finalScore ?? null}
            acquisitionReadinessLabel={acquisitionReadiness?.label ?? null}
            isExecutable={Boolean(
              (commandCenter?.capacityUseCases?.length ?? 0) > 0 ||
              yieldFirstScenario?.isExecutable ??
              false
            )}
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
            <section
              className={`mt-6 grid grid-cols-1 gap-5 xl:grid-cols-3 ${isDashboardMounted ? 'dashboard-mounted' : ''}`}
              style={isDashboardMounted ? { animationDelay: '120ms' } : { opacity: 0, transform: 'translateY(8px)' }}
            >
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
                      : 'Assets minus total debt'
                  }
                  detailRows={
                    dashboardState.showNetPositionPartial ? [] : netEquityDetailRows
                  }
                  progressInfo={
                    dashboardState.showNetPositionPartial
                      ? null
                      : {
                          label: 'LVR',
                          targetLabel: 'Target 60%',
                          valuePct: 60,
                        }
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
                  value={
                    dashboardState.canShowActualMonthlySurplus
                      ? borrowingPowerAnalysis?.actual_monthly_surplus
                      : null
                  }
                  helper="After-tax household surplus"
                  detailRows={[
                    ...(dashboardState.canShowPropertyCashFlow
                      ? [{
                          label: 'Property cash flow',
                          value: formatCurrency(commandCenter.hero.monthlyPosition.propertyCashFlow),
                          tone:
                            Number(commandCenter.hero.monthlyPosition.propertyCashFlow) >= 0
                              ? 'text-green-600'
                              : 'text-red-500',
                        }]
                      : []),
                    ...(dashboardState.canShowHouseholdSurplus
                      ? [{
                          label: 'Lender serviceability view',
                          value: formatCurrency(commandCenter.hero.monthlyPosition.householdSurplus),
                          tone:
                            Number(commandCenter.hero.monthlyPosition.householdSurplus) >= 0
                              ? 'text-gray-900'
                              : 'text-red-500',
                        }]
                      : []),
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
                  detailRows={[
                    ...(commandCenter.hero.borrowingPower.unlockPotential != null
                      ? [{
                          label: 'Unlock via card limits',
                          value: formatCurrency(commandCenter.hero.borrowingPower.unlockPotential),
                          tone: 'text-green-600',
                        }, {
                          label: 'Post-unlock total',
                          value: formatCurrency(
                            Number(commandCenter.hero.borrowingPower.currentCapacity || 0) +
                              Number(commandCenter.hero.borrowingPower.unlockPotential || 0)
                          ),
                          tone: 'text-green-600',
                        }]
                      : []),
                    ...((borrowingPowerAnalysis?.assumptions?.assessment_rate_pct ??
                      borrowingPowerAnalysis?.assumptions_detail?.assessment_rate_pct) != null
                      ? [{
                          label: 'Assessment rate',
                          value: `${Number(
                            borrowingPowerAnalysis?.assumptions?.assessment_rate_pct ??
                              borrowingPowerAnalysis?.assumptions_detail?.assessment_rate_pct
                          ).toFixed(1)}%`,
                        }]
                      : []),
                  ]}
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

            {dashboardState.canShowBorrowing ? (
              <section
                className={`mt-5 ${isDashboardMounted ? 'dashboard-mounted' : ''}`}
                style={isDashboardMounted ? { animationDelay: '150ms' } : { opacity: 0, transform: 'translateY(8px)' }}
              >
                <BorrowingPowerBreakdown
                  analysis={borrowingPowerAnalysis}
                  onViewFullBreakdown={() => navigate('/borrowing-power')}
                />
              </section>
            ) : null}

            {dashboardState.canShowTopActions ? (
              <section
                className={`mt-6 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm shadow-gray-100/70 md:p-7 ${isDashboardMounted ? 'dashboard-mounted' : ''}`}
                style={isDashboardMounted ? { animationDelay: '180ms' } : { opacity: 0, transform: 'translateY(8px)' }}
              >
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

                <div className="mt-5 grid grid-cols-1 gap-[14px] xl:grid-cols-2">
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
              <section
                className={`mt-6 ${isDashboardMounted ? 'dashboard-mounted' : ''}`}
                style={isDashboardMounted ? { animationDelay: '180ms' } : { opacity: 0, transform: 'translateY(8px)' }}
              >
                <LockedChecklistCard
                  eyebrow="Actions"
                  title="Unlock your top actions"
                  body={dashboardState.topActionsLockedReason}
                  missingSections={dashboardState.missingSections}
                  onAction={(route) => navigate(route)}
                />
              </section>
            )}

            <section
              className={`mt-8 ${isDashboardMounted ? 'dashboard-mounted' : ''}`}
              style={isDashboardMounted ? { animationDelay: '210ms' } : { opacity: 0, transform: 'translateY(8px)' }}
            >
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
              <section
                className={`mt-8 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm shadow-gray-100/70 md:p-7 ${isDashboardMounted ? 'dashboard-mounted' : ''}`}
                style={isDashboardMounted ? { animationDelay: '240ms' } : { opacity: 0, transform: 'translateY(8px)' }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                  Trade-offs
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-gray-900">
                  Compare your options
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Compare the annual cash-flow outcome of staying on your current path, applying the top action, or adding the modeled acquisition.
                </p>

                <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
                  {commandCenter.compareOptions.map((option) => (
                    <CompareOptionCard key={option.id} option={option} />
                  ))}
                </div>
              </section>
            ) : null}

            <section
              className={`mt-5 grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr,0.8fr] ${isDashboardMounted ? 'dashboard-mounted' : ''}`}
              style={isDashboardMounted ? { animationDelay: '270ms' } : { opacity: 0, transform: 'translateY(8px)' }}
            >
              <section
                className="min-h-[140px] rounded-[18px] border p-[22px] md:px-[26px] md:py-[22px]"
                style={{
                  background: 'linear-gradient(135deg, #f4faf7 0%, #ffffff 100%)',
                  borderColor: '#c8e8dc',
                }}
              >
                <div className="flex h-full flex-col justify-between gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#6b7d75]">
                      Growth Scenario Studio
                    </p>
                    <h2 className="mt-2 text-[16px] font-medium text-[#133230]">
                      Stress-test every acquisition path
                    </h2>
                    <p className="mt-3 max-w-xl text-[13px] leading-[1.6] text-[#666666]">
                      Explore multiple buy strategies, compare serviceability outcomes,
                      and model your 30-year wealth trajectory using your real portfolio
                      data.
                    </p>
                  </div>

                  <div className="flex flex-col items-start lg:items-end">
                    <button
                      type="button"
                      onClick={() => navigate('/growth-scenarios')}
                      className="inline-flex h-[44px] items-center rounded-[12px] bg-[#133230] px-[18px] text-[13px] font-medium text-white transition-colors hover:bg-[#0f2927]"
                    >
                      Open Scenario Studio →
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/growth-scenarios')}
                      className="mt-2 inline-flex h-[40px] items-center rounded-[12px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-white px-[18px] text-[13px] text-gray-800 transition-colors hover:bg-gray-50"
                    >
                      Open 30Y Projection
                    </button>
                  </div>
                </div>
              </section>
            </section>

            <section
              className={`mt-5 grid grid-cols-1 gap-[14px] xl:grid-cols-2 xl:items-stretch ${isDashboardMounted ? 'dashboard-mounted' : ''}`}
              style={isDashboardMounted ? { animationDelay: '300ms' } : { opacity: 0, transform: 'translateY(8px)' }}
            >
              <div className="h-full [&>section]:h-full">
                <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm shadow-gray-100/70 md:p-7">
                  <div className="flex items-end justify-between gap-4 border-b border-[rgba(0,0,0,0.08)] pb-5">
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
              </div>

              <div className="h-full [&>*]:h-full">
                <AIOpportunityCard currentUserId={session.user.id} loans={loans} />
              </div>
            </section>

            {dashboardState.canShowBorrowing && Array.isArray(borrowingPowerAnalysis?.topConstraints) && borrowingPowerAnalysis.topConstraints.length > 0 ? (
              <section
                className={`mt-5 rounded-[18px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-white p-6 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-colors hover:border-[rgba(16,92,75,0.14)] md:p-7 ${isDashboardMounted ? 'dashboard-mounted' : ''}`}
                style={isDashboardMounted ? { animationDelay: '360ms' } : { opacity: 0, transform: 'translateY(8px)' }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                  Constraints
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-gray-900">
                  What&apos;s holding you back
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Your borrowing is primarily limited by:
                </p>

                <ul className="mt-5 space-y-3 text-sm leading-6 text-gray-700">
                  {borrowingPowerAnalysis.topConstraints.slice(0, 2).map((constraint) => (
                    <li key={constraint.type} className="flex items-start gap-3 rounded-[14px] border border-[rgba(0,0,0,0.06)] bg-[rgba(248,250,252,0.78)] px-4 py-3.5">
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
            {commandCenter.urgentAlerts.length > 0 ? (
              <section
                className={`mt-5 rounded-[18px] border-[0.5px] border-[rgba(239,68,68,0.18)] bg-[linear-gradient(180deg,rgba(254,242,242,0.68),rgba(255,255,255,1))] p-6 shadow-[0_10px_24px_rgba(239,68,68,0.05)] md:p-7 ${isDashboardMounted ? 'dashboard-mounted' : ''}`}
                style={isDashboardMounted ? { animationDelay: '360ms' } : { opacity: 0, transform: 'translateY(8px)' }}
              >
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
                      className="rounded-[14px] border border-[rgba(239,68,68,0.14)] bg-white/88 p-5 text-left transition-all duration-200 hover:border-[rgba(239,68,68,0.22)] hover:bg-white"
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

            <section
              className={`mt-5 rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.05)] bg-[rgba(248,250,252,0.7)] px-5 py-3 text-center text-[11px] leading-6 text-gray-400 ${isDashboardMounted ? 'dashboard-mounted' : ''}`}
              style={isDashboardMounted ? { animationDelay: '360ms' } : { opacity: 0, transform: 'translateY(8px)' }}
            >
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
  const borrowingLabel =
    option.id === 'do-nothing'
      ? 'Current borrowing headroom'
      : option.id === 'apply-top-action'
        ? 'Borrowing headroom after action'
        : option.id === 'buy-now'
          ? 'Remaining headroom after purchase'
          : 'Borrowing headroom'
  const outcomeHelper =
    option.id === 'do-nothing'
      ? 'Current annual portfolio cash-flow outcome'
      : option.id === 'apply-top-action'
        ? 'Annual outcome after applying the top action'
        : option.id === 'buy-now'
          ? 'Annual outcome after adding the acquisition'
          : null

  return (
    <article className="rounded-3xl border border-gray-100 bg-gray-50/70 p-5 transition-[transform,box-shadow] duration-150 ease-out will-change-transform hover:-translate-y-[2px] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
        {option.scenario}
      </p>
      <p className={`mt-3 text-2xl font-semibold tracking-tight ${annualTone}`}>
        {`${Number(option.annualImpact) >= 0 ? '+' : '-'}${formatCurrency(
          Math.abs(Number(option.annualImpact || 0))
        )}/year`}
      </p>
      {outcomeHelper ? (
        <p className="mt-[6px] text-[12px] leading-[1.5] text-gray-500">{outcomeHelper}</p>
      ) : null}
      <div className="mt-4 space-y-2 text-sm text-gray-600">
        <div className="flex items-center justify-between gap-4">
          <span>{borrowingLabel}</span>
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
