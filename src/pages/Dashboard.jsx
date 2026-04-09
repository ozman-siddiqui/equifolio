import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Lock, Plus, Siren, Sparkles } from 'lucide-react'

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
import { calculateStressThreshold } from '../lib/stressThreshold.js'
import buildDashboardCommandCenter, { buildOnboardingSnapshotCommandCenter } from '../lib/dashboardCommandCenter'
import buildDashboardCompleteness from '../lib/dashboardCompleteness'
import buildDashboardStateResolver from '../lib/dashboardStateResolver'
import { CURRENT_CASH_RATE, fetchCurrentCashRate } from '../config/marketRates.js'
import { getDaysUntil } from '../lib/dateUtils.js'
import { calculateAcquisitionReadiness } from '../lib/acquisitionReadinessScore'
import { calculateYieldFirstScenario } from '../lib/yieldFirstStrategy'
import { supabase } from '../supabase'

const PLAN_LIMITS = { starter: 3, investor: 10, premium: Infinity }

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))

export default function Dashboard({ session, subscription }) {
  const navigate = useNavigate()
  const { properties, loans, transactions, loading, fetchData } = usePortfolioData(session)
  const { financialProfile, liabilities, loading: financialDataLoading } = useFinancialData()
  const userId = session?.user?.id ?? null
  const snapshotKey = userId
    ? `onboardingSnapshot_${userId}`
    : 'onboardingSnapshot'

  const [showAddProperty, setShowAddProperty] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [isDashboardMounted, setIsDashboardMounted] = useState(false)
  const [liveCashRate, setLiveCashRate] = useState(CURRENT_CASH_RATE)
  const [latestRateImpact, setLatestRateImpact] = useState(null)
  const [firstName, setFirstName] = useState('')
  const [isFirstNameResolved, setIsFirstNameResolved] = useState(() => !session?.user?.id)
  const [onboardingSnapshot, setOnboardingSnapshot] = useState(() => {
    try {
      const raw = sessionStorage.getItem(snapshotKey)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

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

  useEffect(() => {
    let active = true

    fetchCurrentCashRate().then((rate) => {
      if (active) setLiveCashRate(Number(rate ?? CURRENT_CASH_RATE))
    })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadLatestRateImpact() {
      if (!session?.user?.id) {
        setLatestRateImpact(null)
        return
      }

      const { data, error } = await supabase
        .from('portfolio_rate_impacts')
        .select('*')
        .eq('user_id', session.user.id)
        .is('dismissed_at', null)
        .order('computed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!active) return

      if (error) {
        setLatestRateImpact(null)
        return
      }

      setLatestRateImpact(data ?? null)
    }

    loadLatestRateImpact()

    return () => {
      active = false
    }
  }, [session?.user?.id])

  useEffect(() => {
    let active = true

    async function loadFirstName() {
      if (active) setIsFirstNameResolved(false)

      if (!session?.user?.id) {
        if (active) {
          setFirstName('')
          setIsFirstNameResolved(true)
        }
        return
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('first_name')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (!active) return

      if (error || !data?.first_name) {
        setFirstName('')
        setIsFirstNameResolved(true)
        return
      }

      setFirstName(data.first_name)
      setIsFirstNameResolved(true)
    }

    loadFirstName()

    return () => {
      active = false
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (!latestRateImpact?.id) return
    if (latestRateImpact.narrative) return
    if (!session?.user?.id) return

    async function generateNarrative() {
      try {
        const { data, error } = await supabase.functions.invoke(
          'generate-rba-narrative',
          { body: { rate_impact_id: latestRateImpact.id } }
        )
        if (!error && data?.narrative) {
          setLatestRateImpact(prev =>
            prev ? { ...prev, narrative: data.narrative } : null
          )
        }
      } catch {
        // Narrative generation failure must never break the banner
      }
    }

    generateNarrative()
  }, [latestRateImpact?.id, latestRateImpact?.narrative, session?.user?.id])

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

  const stressThreshold = useMemo(() => {
    if (!financialProfile || !loans?.length) return null
    return calculateStressThreshold({
      financialProfile,
      liabilities: liabilities || [],
      loans,
      transactions: transactions || [],
      currentCashRate: liveCashRate,
      additionalMonthlyObligation: 0,
    })
  }, [financialProfile, liabilities, loans, transactions, liveCashRate])

  const fixedRateExpiry = useMemo(() => {
    if (!loans?.length) return null

    const fixedLoans = loans
      .filter(loan =>
        loan.loan_type === 'Fixed' &&
        loan.fixed_rate_expiry
      )
      .map(loan => ({
        loanId: loan.id,
        lender: loan.lender,
        propertyId: loan.property_id,
        propertyAddress: properties?.find(p => p.id === loan.property_id)?.address ?? null,
        expiryDate: loan.fixed_rate_expiry,
        daysUntil: getDaysUntil(loan.fixed_rate_expiry),
        currentRate: loan.interest_rate,
        balance: loan.current_balance,
      }))
      .filter(loan =>
        loan.daysUntil !== null &&
        loan.daysUntil >= 0 &&
        loan.daysUntil <= 47
      )
      .sort((a, b) => a.daysUntil - b.daysUntil)

    if (!fixedLoans.length) return null

    const soonest = fixedLoans[0]

    const touchpoint =
      soonest.daysUntil <= 14 ? 'urgent' :
      soonest.daysUntil <= 30 ? 'decision' :
      'education'

    return {
      soonest,
      allExpiring: fixedLoans,
      touchpoint,
      count: fixedLoans.length,
    }
  }, [loans, properties])

  const rawDashboardCompleteness = useMemo(
    () =>
      buildDashboardCompleteness({
        properties,
        loans,
        financialProfile,
        liabilities,
      }),
    [properties, loans, financialProfile, liabilities]
  )

  const dashboardCompleteness = useMemo(() => {
    const liabilitiesStepComplete =
      Boolean(rawDashboardCompleteness?.financialProfileComplete) &&
      !financialDataLoading &&
      Array.isArray(liabilities)

    if (
      rawDashboardCompleteness?.hasLiabilitiesData ||
      !liabilitiesStepComplete
    ) {
      return rawDashboardCompleteness
    }

    return {
      ...rawDashboardCompleteness,
      hasLiabilitiesData: true,
      liabilitiesStatus: 'reviewed_empty',
      messages: {
        ...rawDashboardCompleteness?.messages,
        liabilities: 'Liabilities reviewed through Financials.',
      },
    }
  }, [financialDataLoading, liabilities, rawDashboardCompleteness])

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

  const usingOnboardingSnapshot = useMemo(
    () => Boolean(onboardingSnapshot) && !dashboardState?.setupComplete,
    [onboardingSnapshot, dashboardState?.setupComplete]
  )

  const hasLivePropertyValues = useMemo(
    () =>
      Array.isArray(properties) &&
      properties.some((property) => Number(property?.current_value || 0) > 0),
    [properties]
  )
  const hasLiveMortgageRows = useMemo(
    () => Array.isArray(loans) && loans.length > 0,
    [loans]
  )
  const hasFullLiveMortgageCoverage = useMemo(
    () =>
      hasLivePropertyValues &&
      Array.isArray(properties) &&
      properties.length > 0 &&
      properties.every((property) =>
        loans.some((loan) => String(loan?.property_id) === String(property?.id))
      ),
    [hasLivePropertyValues, loans, properties]
  )

  const hasLiveHeroInputs = useMemo(() => {
    return hasLivePropertyValues && hasLiveMortgageRows
  }, [hasLiveMortgageRows, hasLivePropertyValues])

  const incompleteSteps = useMemo(() => {
    const noLivePropertyYet =
      usingOnboardingSnapshot && !dashboardCompleteness?.hasProperties
    const sectionMap = {
      properties: {
        label: noLivePropertyYet ? 'Add your first property' : 'Add remaining properties',
        to: '/properties',
        unlocked: true,
        lockedReason: null,
      },
      mortgages: {
        label: 'Complete mortgage details',
        to: '/mortgages',
        unlocked: noLivePropertyYet ? false : true,
        lockedReason: noLivePropertyYet ? 'Add a property first' : null,
      },
      cashflow: {
        label: 'Add property cash flow & expenses',
        to: '/cashflow',
        unlocked: noLivePropertyYet ? false : true,
        lockedReason: noLivePropertyYet ? 'Add a property first' : null,
      },
      financials: {
        label: 'Add household financials',
        to: '/financials',
        unlocked: noLivePropertyYet ? false : true,
        lockedReason: noLivePropertyYet ? 'Add a property first' : null,
      },
    }

    return (dashboardState?.missingSections || [])
      .map((section) => {
        const mapped = sectionMap[section?.id]
        if (!mapped) return null

        return {
          id: section?.id,
          ...mapped,
          unlocked: section?.unlocked ?? mapped.unlocked,
          lockedReason: section?.lockedReason ?? mapped.lockedReason,
        }
      })
      .filter(Boolean)
  }, [dashboardCompleteness?.hasProperties, dashboardState?.missingSections, usingOnboardingSnapshot])

  const workflowSteps = useMemo(() => {
    const priorityOrder =
      usingOnboardingSnapshot && !dashboardCompleteness?.hasProperties
        ? ['properties', 'mortgages', 'cashflow', 'financials', 'liabilities']
        : ['properties', 'mortgages', 'cashflow', 'financials', 'liabilities']
    const prioritizedSteps = priorityOrder
      .map((id) => incompleteSteps.find((step) => step.id === id))
      .filter(Boolean)

    return prioritizedSteps.length > 0 ? prioritizedSteps : incompleteSteps
  }, [dashboardCompleteness?.hasProperties, incompleteSteps, usingOnboardingSnapshot])

  const primaryWorkflowStep = workflowSteps[0] ?? null
  const queuedWorkflowSteps = workflowSteps.slice(1, 4)
  const primaryWorkflowCtaLabel = primaryWorkflowStep?.id === 'properties'
    ? 'Add property →'
    : primaryWorkflowStep?.id === 'mortgages'
    ? 'Complete mortgage details →'
    : primaryWorkflowStep?.id === 'cashflow'
    ? 'Open cash flow →'
    : primaryWorkflowStep?.id === 'financials'
      ? 'Open financials →'
      : primaryWorkflowStep?.id === 'liabilities'
        ? 'Add liabilities →'
        : 'Continue →'
  const topUnlockCopy = primaryWorkflowStep?.id === 'properties'
    ? 'Add your first property to activate the Command Centre'
    : primaryWorkflowStep?.id === 'mortgages'
    ? 'Complete mortgage details to unlock equity and lending insights'
    : primaryWorkflowStep?.id === 'cashflow'
    ? 'Add cash flow to unlock your true monthly position'
    : primaryWorkflowStep?.id === 'financials'
      ? 'Complete financials to unlock borrowing insights'
      : primaryWorkflowStep?.id === 'liabilities'
        ? 'Add liabilities to improve borrowing accuracy'
        : null
  const heroPrimaryCta = primaryWorkflowStep?.unlocked === false
    ? { label: 'Model next acquisition →', route: '/growth-scenarios' }
    : primaryWorkflowStep?.id === 'properties'
      ? { label: 'Add your first property', route: '/properties' }
    : primaryWorkflowStep?.id === 'mortgages'
      ? { label: 'Complete mortgage details', route: '/mortgages' }
    : primaryWorkflowStep?.id === 'cashflow'
      ? { label: 'Open cash flow', route: '/cashflow' }
      : primaryWorkflowStep?.id === 'financials'
        ? { label: 'Open financials', route: '/financials' }
        : primaryWorkflowStep?.id === 'liabilities'
          ? { label: 'Add liabilities', route: '/financials' }
          : { label: 'Model next acquisition →', route: '/growth-scenarios' }

  const totalSections = 5
  const completedSections =
    totalSections - (incompleteSteps?.length ?? totalSections)
  const dataCoveragePct =
    Math.round((completedSections / totalSections) * 100)
  const snapshotConfidenceLabel =
    dataCoveragePct >= 90 ? 'High'
    : dataCoveragePct >= 70 ? 'Indicative'
    : dataCoveragePct >= 40 ? 'Low'
    : 'Early stage'

  const effectiveDashboardState = useMemo(() => {
    if (!usingOnboardingSnapshot) {
      return {
        ...dashboardState,
        canShowNetPosition:
          dashboardState?.canShowNetPosition || hasLivePropertyValues,
        showNetPositionPartial: hasLivePropertyValues
          ? !hasFullLiveMortgageCoverage
          : dashboardState?.showNetPositionPartial,
      }
    }

    return {
      ...dashboardState,
      hasProperties: true,
      canShowNetPosition: true,
      showNetPositionPartial: hasLivePropertyValues
        ? !hasFullLiveMortgageCoverage
        : false,
      canShowMonthlyPosition: true,
      canShowPropertyCashFlow: true,
      canShowHouseholdSurplus: true,
      canShowTopActions: true,
    }
  }, [
    dashboardState,
    hasFullLiveMortgageCoverage,
    hasLivePropertyValues,
    usingOnboardingSnapshot,
  ])

  useEffect(() => {
    console.log('[Dashboard] financial/shared-state update', {
      financialProfile,
      liabilities,
      borrowingPowerAnalysis,
      borrowingPowerEstimate:
        borrowingPowerAnalysis?.borrowing_power_estimate ?? null,
      netMonthlySurplus:
        borrowingPowerAnalysis?.net_monthly_surplus ?? null,
      canShowBorrowing: effectiveDashboardState?.canShowBorrowing ?? null,
      canShowActualMonthlySurplus:
        effectiveDashboardState?.canShowActualMonthlySurplus ?? null,
    })
  }, [
    borrowingPowerAnalysis,
    effectiveDashboardState?.canShowActualMonthlySurplus,
    effectiveDashboardState?.canShowBorrowing,
    financialProfile,
    liabilities,
  ])

  const baseCommandCenter = useMemo(
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

  const onboardingCommandCenter = useMemo(
    () =>
      usingOnboardingSnapshot
        ? buildOnboardingSnapshotCommandCenter(onboardingSnapshot)
        : null,
    [usingOnboardingSnapshot, onboardingSnapshot]
  )

  const commandCenter =
    usingOnboardingSnapshot && !hasLiveHeroInputs
      ? (onboardingCommandCenter ?? baseCommandCenter)
      : baseCommandCenter

  const hasLiveEquityInputs = useMemo(
    () => !['properties', 'mortgages'].some((id) =>
      dashboardState?.missingSections?.some(
        (section) => section?.id === id
      )
    ),
    [dashboardState?.missingSections]
  )

  const growthScenarios = commandCenter?.growthScenarios

  const borrowingRenderState = useMemo(() => {
    const analysisStatus = borrowingPowerAnalysis?.status
    const confidence = borrowingPowerAnalysis?.confidenceLabel || 'Low'

    if (usingOnboardingSnapshot) {
      return {
        state: 'snapshot',
        confidence: commandCenter?.decisionConfidence || 'Medium',
        warning:
          'Indicative based on onboarding snapshot. Complete portfolio details for higher confidence.',
      }
    }

    if (!effectiveDashboardState?.canShowBorrowing) {
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
  }, [
    commandCenter?.decisionConfidence,
    effectiveDashboardState?.canShowBorrowing,
    borrowingPowerAnalysis?.status,
    borrowingPowerAnalysis?.confidenceLabel,
    usingOnboardingSnapshot,
  ])

  const totalPropertyValue = useMemo(
    () => properties.reduce((sum, property) => sum + Number(property?.current_value || 0), 0),
    [properties]
  )
  const totalRecordedDebt = useMemo(
    () => loans.reduce((sum, loan) => sum + Number(loan?.current_balance || 0), 0),
    [loans]
  )
  const currentLvrPct = useMemo(() => {
    if (!totalPropertyValue || effectiveDashboardState.showNetPositionPartial) return null
    return (totalRecordedDebt / totalPropertyValue) * 100
  }, [effectiveDashboardState.showNetPositionPartial, totalPropertyValue, totalRecordedDebt])
  const portfolioProperties = commandCenter?.portfolioProperties
  const netEquityDetailRows = useMemo(
    () =>
      (portfolioProperties || [])
        .filter((property) => property?.equity != null)
        .map((property) => ({
          label: property.address,
          value: formatCurrency(property.equity),
          tone: Number(property.equity) < 0 ? 'text-[#A32D2D]' : 'text-gray-900',
          badge:
            Number(property.equity) < 0
              ? {
                  label: 'Negative equity',
                  backgroundColor: '#FCEBEB',
                  color: '#791F1F',
                }
              : null,
        })),
    [portfolioProperties]
  )
  const capacityUseCaseCount = commandCenter?.capacityUseCases?.length ?? 0

  const yieldFirstScenario = useMemo(
    () => {
      if (!borrowingPowerAnalysis || !growthScenarios) return null

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
        metroBlocked: capacityUseCaseCount === 0,
      })

      return result
    },
    [borrowingPowerAnalysis, growthScenarios, totalPropertyValue, capacityUseCaseCount]
  )

  const acquisitionReadiness = useMemo(() => {
    if (!growthScenarios || !yieldFirstScenario) return null

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
        dashboardCompleteness?.hasLiabilitiesData
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
    growthScenarios,
    yieldFirstScenario,
    borrowingPowerAnalysis,
    dashboardCompleteness,
    liabilities,
  ])

  const leadScenario = useMemo(
    () =>
      commandCenter?.growthScenarios?.feasibleStrategies?.[0] ??
      commandCenter?.growthScenarios?.nearViableStrategies?.[0] ??
      commandCenter?.growthScenarios?.bestBlockedStrategy ??
      null,
    [commandCenter?.growthScenarios]
  )

  const equityLeadScenario = useMemo(
    () =>
      hasLiveEquityInputs
        ? (
            baseCommandCenter?.growthScenarios?.feasibleStrategies?.[0] ??
            baseCommandCenter?.growthScenarios?.nearViableStrategies?.[0] ??
            baseCommandCenter?.growthScenarios?.bestBlockedStrategy ??
            null
          )
        : null,
    [hasLiveEquityInputs, baseCommandCenter?.growthScenarios]
  )

  const equityProjectionData = useMemo(
    () => (hasLiveEquityInputs ? baseCommandCenter?.equityProjectionData ?? null : null),
    [hasLiveEquityInputs, baseCommandCenter?.equityProjectionData]
  )

  const isAcquisitionMode =
    Boolean(leadScenario) &&
    Number(borrowingPowerAnalysis?.borrowing_power_estimate ?? 0) > 0 &&
    incompleteSteps.length === 0

  async function handleDismissRateImpact() {
    if (!latestRateImpact?.id) return

    const dismissedAt = new Date().toISOString()

    const { error } = await supabase
      .from('portfolio_rate_impacts')
      .update({ dismissed_at: dismissedAt })
      .eq('id', latestRateImpact.id)

    if (!error) {
      setLatestRateImpact((prev) =>
        prev ? { ...prev, dismissed_at: dismissedAt } : null
      )
      setLatestRateImpact(null)
    }
  }

  const heroDecisionProps = useMemo(() => {
    const snapshotCurrentValue = Number(onboardingSnapshot?.currentValue ?? 0)
    const snapshotLoanBalance = Number(onboardingSnapshot?.loanBalance ?? 0)
    const snapshotEquityBase =
      Number.isFinite(snapshotCurrentValue) && Number.isFinite(snapshotLoanBalance)
        ? Math.max(0, snapshotCurrentValue - snapshotLoanBalance)
        : null
    const liveEquityBase =
      hasLivePropertyValues
        ? (
            commandCenter?.hero?.netPosition?.value ??
            commandCenter?.totalValue ??
            0
          )
        : (
            (usingOnboardingSnapshot ? snapshotEquityBase : null) ??
            commandCenter?.hero?.netPosition?.value ??
            commandCenter?.totalValue ??
            0
          )
    const purchasePrice =
      commandCenter?.hero?.purchaseRangeLow ??
      leadScenario?.fallbackPrice ??
      leadScenario?.scenarioPurchasePrice ??
      (liveEquityBase > 0 ? Math.round(liveEquityBase * 0.8) : 475000)
    const baseAcquisitionReadiness =
      commandCenter?.hero?.acquisitionReadiness ?? acquisitionReadiness

    return {
      purchaseRangeLow:
        commandCenter?.hero?.purchaseRangeLow ??
        (leadScenario ? Math.round(purchasePrice * 0.95) : null) ??
        (liveEquityBase > 0 ? Math.round(liveEquityBase * 0.8) : null),
      purchaseRangeHigh:
        commandCenter?.hero?.purchaseRangeHigh ??
        (leadScenario ? Math.round(purchasePrice * 1.1) : null) ??
        (liveEquityBase > 0 ? Math.round(liveEquityBase * 1.2) : null),
      fiveYearEquityUplift: leadScenario?.fiveYearEquityProjection ?? null,
      currentHouseholdSurplus: borrowingPowerAnalysis?.actual_monthly_surplus ?? null,
      afterTaxAcquisitionImpact: leadScenario?.afterTaxMonthlyImpact ?? null,
      monthlyHoldingCost:
        isAcquisitionMode && leadScenario
          ? (
              (
                borrowingPowerAnalysis?.actual_monthly_surplus ?? 0
              ) +
              (
                leadScenario?.afterTaxMonthlyImpact ??
                0
              )
            )
          : (
              effectiveDashboardState.canShowActualMonthlySurplus
                ? (
                    borrowingPowerAnalysis?.actual_monthly_surplus ??
                    commandCenter?.hero?.monthlyPosition?.householdSurplus ??
                    null
                  )
                : null
            ),
      postAcquisitionSurplus:
        isAcquisitionMode && leadScenario
          ? (
              (
                borrowingPowerAnalysis?.actual_monthly_surplus ?? 0
              ) +
              (
                leadScenario?.afterTaxMonthlyImpact ??
                0
              )
            )
          : null,
      grossYield: commandCenter?.hero?.grossYield ??
        leadScenario?.estimatedGrossYield ??
        leadScenario?.expectedRentalYield ??
        null,
      currentEquity: liveEquityBase,
      year3Equity:
        equityProjectionData?.find(
          (point) => Number(point.year) === 3
        )?.netEquity ??
        equityLeadScenario?.projectionData?.find(
          (point) => Number(point.year) === 3
        )?.netEquity ?? null,
      year5Equity:
        equityProjectionData?.find(
          (point) => Number(point.year) === 5
        )?.netEquity ??
        equityLeadScenario?.projectionData?.find(
          (point) => Number(point.year) === 5
        )?.netEquity ?? null,
      year10Equity:
        equityProjectionData?.find(
          (point) => Number(point.year) === 10
        )?.netEquity ??
        equityLeadScenario?.projectionData?.find(
          (point) => Number(point.year) === 10
        )?.netEquity ?? null,
      unlockValue: usingOnboardingSnapshot || effectiveDashboardState.canShowBorrowing
        ? commandCenter?.hero?.borrowingPower?.unlockPotential ?? null
        : null,
      stressThreshold: commandCenter?.hero?.stressThreshold ?? stressThreshold,
      fixedRateExpiry,
      rateImpact: latestRateImpact,
      onDismissRateImpact: handleDismissRateImpact,
      acquisitionReadiness:
        usingOnboardingSnapshot && baseAcquisitionReadiness
          ? { ...baseAcquisitionReadiness, label: 'Indicative' }
          : baseAcquisitionReadiness,
      acquisitionReadinessScore:
        (usingOnboardingSnapshot
          ? Number(onboardingSnapshot?.finalScore ?? null)
          : null) ??
        commandCenter?.hero?.acquisitionReadiness?.finalScore ??
        acquisitionReadiness?.finalScore ??
        null,
      acquisitionReadinessLabel: usingOnboardingSnapshot
        ? 'Acquisition readiness'
        : commandCenter?.hero?.acquisitionReadiness?.label ??
            acquisitionReadiness?.label ??
            null,
      subtitle: isAcquisitionMode
        ? 'Based on current inputs, this pathway appears viable and illustrative - subject to lender assessment and market conditions.'
        : 'Your existing portfolio is compounding. Focus on the top actions below to unlock your next acquisition move.',
      isFirstNameResolved,
      monthlyTileEyebrow: isAcquisitionMode ? 'After-tax surplus' : 'Monthly surplus / gap',
      monthlyTileDetail: isAcquisitionMode
        ? 'Based on active acquisition scenario'
        : effectiveDashboardState.canShowActualMonthlySurplus
          ? 'Live estimate · refine expenses for accuracy'
          : 'Add income, expenses and liabilities to unlock your monthly position.',
      primaryCtaLabel: heroPrimaryCta.label,
      primaryCtaRoute: heroPrimaryCta.route,
      firstName: firstName || null,
      isAcquisitionMode,
      confidenceChipLabel: usingOnboardingSnapshot
        ? 'Indicative'
        : incompleteSteps.length > 0
          ? 'Setup-based readiness'
          : 'High confidence',
      topUnlockCopy,
      isExecutable: Boolean(
        capacityUseCaseCount > 0 ||
        (yieldFirstScenario?.isExecutable ?? false)
      ),
    }
  }, [
    equityProjectionData,
    equityLeadScenario,
    leadScenario,
    commandCenter?.hero?.netPosition?.value,
    commandCenter?.hero?.purchaseRangeLow,
    commandCenter?.hero?.purchaseRangeHigh,
    borrowingPowerAnalysis?.actual_monthly_surplus,
    commandCenter?.hero?.monthlyPosition?.propertyCashFlow,
    commandCenter?.hero?.monthlyPosition?.householdSurplus,
    commandCenter?.hero?.grossYield,
    commandCenter?.hero?.borrowingPower?.unlockPotential,
    commandCenter?.hero?.stressThreshold,
    commandCenter?.hero?.acquisitionReadiness,
    commandCenter?.totalValue,
    effectiveDashboardState.canShowBorrowing,
    hasLivePropertyValues,
    stressThreshold,
    fixedRateExpiry,
    latestRateImpact,
    acquisitionReadiness?.finalScore,
    acquisitionReadiness?.label,
    incompleteSteps.length,
    firstName,
    isFirstNameResolved,
    topUnlockCopy,
    capacityUseCaseCount,
    isAcquisitionMode,
    heroPrimaryCta.label,
    heroPrimaryCta.route,
    usingOnboardingSnapshot,
    onboardingSnapshot?.currentValue,
    onboardingSnapshot?.loanBalance,
    onboardingSnapshot?.finalScore,
    yieldFirstScenario?.isExecutable,
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
      <style>{`
        @keyframes vaulta-strip-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
          70%  { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
          100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }

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
        {usingOnboardingSnapshot && !hasLiveHeroInputs && !dashboardCompleteness?.hasProperties && properties.length === 0 && (
          <div style={{
            background: '#f0fdf7',
            borderBottom: '1px solid #1D9E75',
            padding: '6px 20px',
            marginBottom: 16,
            fontSize: 12,
            color: '#065F46'
          }}>
            <span>Snapshot loaded · 1 property, income, and capital captured</span>
          </div>
        )}
        {incompleteSteps.length > 0 && (
          <div style={{
            background: '#fffbeb',
            border: '1.5px solid #f59e0b',
            borderRadius: 10,
            padding: '16px 20px',
            marginBottom: 20,
            animation: 'vaulta-strip-pulse 2s ease-in-out 3',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}>
              <div>
                <span style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#92400e',
                }}>
                  {primaryWorkflowStep
                    ? `Next → ${primaryWorkflowStep.label}`
                    : 'Complete your setup to unlock full insights'}
                </span>
                <div style={{
                  fontSize: 13,
                  color: '#b45309',
                  fontWeight: 500,
                  marginTop: 4,
                }}>
                  {queuedWorkflowSteps.length > 0
                    ? `Then → ${queuedWorkflowSteps.map((step) => step.label).join(' · ')}`
                    : `Platform setup · ${dataCoveragePct}% complete · ${incompleteSteps.length} step${incompleteSteps.length === 1 ? '' : 's'} remaining`}
                </div>
              </div>
              {primaryWorkflowStep?.unlocked === false ? (
                <span
                  title={primaryWorkflowStep.lockedReason || 'Add a property first'}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#78716c',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {primaryWorkflowStep.lockedReason || 'Add a property first'}
                </span>
              ) : (
                <Link
                  to={primaryWorkflowStep?.to || '/properties'}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#92400e',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {primaryWorkflowCtaLabel}
                </Link>
              )}
            </div>
            <div style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
            }}>
              {incompleteSteps.map(item => (
                item.unlocked === false ? (
                  <span
                    key={item.label}
                    title={item.lockedReason || 'Add a property first'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      color: '#78716c',
                      background: '#f5f5f4',
                      border: '1px solid #d6d3d1',
                      borderRadius: 20,
                      padding: '5px 12px',
                      fontWeight: 500,
                      cursor: 'not-allowed',
                      opacity: 0.9,
                    }}
                  >
                    <Lock size={11} />
                    {item.lockedReason || 'Add a property first'}
                  </span>
                ) : (
                  <Link
                    key={item.label}
                    to={item.to}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      color: '#92400e',
                      background: '#fef3c7',
                      border: '1px solid #fcd34d',
                      borderRadius: 20,
                      padding: '5px 12px',
                      textDecoration: 'none',
                      fontWeight: 500,
                    }}
                  >
                    <span style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#f59e0b',
                      display: 'inline-block',
                    }} />
                    {item.label}
                  </Link>
                )
              ))}
            </div>
            <p style={{
              fontSize: 11,
              color: '#b45309',
              marginTop: 10,
              marginBottom: 0,
            }}>
              Complete remaining setup to unlock accurate
              borrowing, cash flow, and portfolio insights.
            </p>
          </div>
        )}
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
              {usingOnboardingSnapshot ? (
                <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-700 md:text-[15px]">
                  Indicative based on onboarding snapshot. Complete more detail across properties,
                  cash flow, and financials for higher confidence.
                </p>
              ) : null}
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

        <div
          className={`mt-5 mb-[22px] ${isDashboardMounted ? 'dashboard-mounted' : ''}`}
          style={isDashboardMounted ? { animationDelay: '50ms' } : { opacity: 0, transform: 'translateY(8px)' }}
        >
          <HeroDecisionCard {...heroDecisionProps} />
        </div>

        <section
          className={`mb-[22px] rounded-[1.5rem] border border-gray-100 bg-white/80 px-4 py-3 shadow-sm shadow-gray-100/50 ${isDashboardMounted ? 'dashboard-mounted' : ''}`}
          style={isDashboardMounted ? { animationDelay: '90ms' } : { opacity: 0, transform: 'translateY(8px)' }}
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-5">
              <StripMetric
                label="Platform setup"
                value={`${dataCoveragePct}% complete`}
              />
              <StripMetric
                label="Decision Confidence"
                value={
                  usingOnboardingSnapshot
                    ? snapshotConfidenceLabel
                    : commandCenter.decisionConfidence
                }
              />
            </div>

            <p className="text-xs text-gray-500">
              Better data coverage sharpens borrowing, refinance, and portfolio actions.
            </p>
          </div>
        </section>

        {!effectiveDashboardState.hasProperties ? (
          <section className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
            {effectiveDashboardState.missingSections.map((section) => (
              <DashboardPromptCard
                key={section.id}
                eyebrow={section.label}
                title={section.title}
                body={section.body}
                ctaLabel={section.unlocked === false ? (section.lockedReason || 'Add a property first') : section.ctaLabel}
                onAction={() => navigate(section.unlocked === false ? '/properties' : section.route)}
              />
            ))}
          </section>
        ) : (
          <>
            <section
              className={`mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3 ${isDashboardMounted ? 'dashboard-mounted' : ''}`}
              style={isDashboardMounted ? { animationDelay: '120ms' } : { opacity: 0, transform: 'translateY(8px)' }}
            >
              {effectiveDashboardState.canShowNetPosition ? (
                <CommandCentreCard
                  eyebrow="Net Position"
                  title={effectiveDashboardState.showNetPositionPartial ? 'Asset Value' : 'Net Equity'}
                  value={
                    effectiveDashboardState.showNetPositionPartial
                      ? totalPropertyValue
                      : commandCenter.hero.netPosition.value
                  }
                  valueTone={
                    !effectiveDashboardState.showNetPositionPartial &&
                    Number(commandCenter.hero.netPosition.value) < 0
                      ? 'text-[#A32D2D]'
                      : null
                  }
                  helper={
                    effectiveDashboardState.showNetPositionPartial
                      ? 'Asset-only view until all mortgages are recorded'
                      : 'Assets minus total debt'
                  }
                  statusBadge={
                    !effectiveDashboardState.showNetPositionPartial &&
                    Number(commandCenter.hero.netPosition.value) < 0
                      ? {
                          label: 'Negative equity',
                          backgroundColor: '#FCEBEB',
                          color: '#791F1F',
                        }
                      : null
                  }
                  detailRows={
                    effectiveDashboardState.showNetPositionPartial ? [] : netEquityDetailRows
                  }
                  detailEmptyState={
                    effectiveDashboardState.showNetPositionPartial
                      ? null
                      : 'No properties recorded yet'
                  }
                  progressInfo={
                    effectiveDashboardState.showNetPositionPartial
                      ? null
                      : {
                          label: 'LVR',
                          targetLabel: 'Target 60%',
                          valuePct: currentLvrPct ?? 0,
                          badge:
                            currentLvrPct != null && currentLvrPct > 100
                              ? {
                                  label: 'Above 100% LVR',
                                  backgroundColor: '#FAEEDA',
                                  color: '#633806',
                                }
                              : null,
                        }
                  }
                  subtitle={
                    effectiveDashboardState.showNetPositionPartial
                      ? 'Add mortgage details for every property to calculate true net equity, leverage, and LVR.'
                      : commandCenter.hero.netPosition.subtitle
                  }
                  cta={{
                    label: effectiveDashboardState.showNetPositionPartial ? 'Add Mortgage' : commandCenter.hero.netPosition.cta.label,
                  }}
                  onClick={() =>
                    navigate(
                      effectiveDashboardState.showNetPositionPartial
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

              {effectiveDashboardState.canShowMonthlyPosition ? (
                <CommandCentreCard
                  eyebrow="Monthly Position"
                  title="Current monthly surplus"
                  value={
                    effectiveDashboardState.canShowActualMonthlySurplus
                      ? borrowingPowerAnalysis?.actual_monthly_surplus ??
                        commandCenter.hero.monthlyPosition.householdSurplus
                      : null
                  }
                  helper={
                    effectiveDashboardState.canShowActualMonthlySurplus
                      ? 'After-tax household surplus'
                      : 'Complete cash flow to unlock'
                  }
                  detailRows={[
                    ...(effectiveDashboardState.canShowPropertyCashFlow
                      ? [{
                          label: 'Portfolio property cash flow',
                          value: formatCurrency(commandCenter.hero.monthlyPosition.propertyCashFlow),
                          tone:
                            Number(commandCenter.hero.monthlyPosition.propertyCashFlow) >= 0
                              ? 'text-green-600'
                              : 'text-red-500',
                        }]
                      : []),
                  ]}
                  subtitle={
                    effectiveDashboardState.canShowActualMonthlySurplus
                      ? 'Your current household position and portfolio property cash flow are shown separately.'
                      : 'Add income, expenses and liabilities to unlock your monthly position.'
                  }
                  cta={{
                    label:
                      !effectiveDashboardState.canShowActualMonthlySurplus || !effectiveDashboardState.canShowPropertyCashFlow
                        ? 'Go to Cash Flow'
                        : effectiveDashboardState.canShowHouseholdSurplus
                          ? 'Explore cash flow'
                          : 'Open financials',
                  }}
                  onClick={() =>
                    navigate(
                      !effectiveDashboardState.canShowActualMonthlySurplus || !effectiveDashboardState.canShowPropertyCashFlow
                        ? '/cashflow'
                        : effectiveDashboardState.canShowHouseholdSurplus
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

              {usingOnboardingSnapshot || effectiveDashboardState.canShowBorrowing ? (
                <DashboardBorrowingPowerCard
                  currentCapacity={commandCenter.hero.borrowingPower.currentCapacity}
                  unlockPotential={
                    borrowingRenderState.state === 'locked'
                      ? null
                      : commandCenter.hero.borrowingPower.unlockPotential
                  }
                  detailRows={[
                    ...((borrowingRenderState.state !== 'locked' &&
                      commandCenter.hero.borrowingPower.unlockPotential != null)
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
                    usingOnboardingSnapshot
                      ? 'Indicative based on onboarding snapshot. Complete financial details for a fuller lender-grade view.'
                      : borrowingRenderState.state === 'warning'
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
                  ctaLabel={effectiveDashboardState.missingSections[0]?.ctaLabel || 'Open setup'}
                  onAction={() => navigate(effectiveDashboardState.missingSections[0]?.route || '/financials')}
                />
              )}
            </section>

            {effectiveDashboardState.canShowBorrowing && !usingOnboardingSnapshot ? (
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

            {usingOnboardingSnapshot || effectiveDashboardState.canShowTopActions ? (
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
                    {usingOnboardingSnapshot
                      ? 'Indicative next steps based on your onboarding snapshot. Complete more detail to sharpen prioritisation.'
                      : 'Ranked actions unlocked from validated portfolio, mortgage, and household inputs.'}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-[14px] md:grid-cols-2">
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
                  body={effectiveDashboardState.topActionsLockedReason}
                  missingSections={effectiveDashboardState.missingSections}
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

            {Number(effectiveDashboardState?.setupCompletionPct ?? 0) === 100 || usingOnboardingSnapshot ? (
              <section className="hidden">
                <p className="text-sm text-gray-600">
                  Portfolio data complete · Decision confidence: {
                    usingOnboardingSnapshot
                      ? snapshotConfidenceLabel
                      : commandCenter.decisionConfidence
                  } ·
                  {' '}Data coverage: {dataCoveragePct}%
                </p>
              </section>
            ) : (
              <SetupProgress state={effectiveDashboardState} onOpenSection={(route) => navigate(route)} />
            )}

            {effectiveDashboardState.canShowBorrowing && commandCenter.compareOptions?.length > 0 ? (
              <section
                className={`mt-8 rounded-[16px] border border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] p-[22px] shadow-[0_10px_24px_rgba(15,23,42,0.04)] md:px-[26px] md:py-[22px] ${isDashboardMounted ? 'dashboard-mounted' : ''}`}
                style={isDashboardMounted ? { animationDelay: '240ms' } : { opacity: 0, transform: 'translateY(8px)' }}
              >
                <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
                  Trade-offs
                </p>
                <h2 className="mt-2 text-[15px] font-medium text-[var(--color-text-primary)]">
                  {commandCenter?.compareSectionTitle ?? 'Compare your options'}
                </h2>
                <p className="mt-2 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
                  {commandCenter?.compareMetric === 'borrowing'
                    ? 'Compare borrowing capacity outcomes while keeping annual portfolio cash flow visible as a secondary metric.'
                    : 'Compare the annual cash-flow outcome of staying on your current path, applying the top action, or adding the modeled acquisition.'}
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                className="min-h-[140px] rounded-[16px] border-[0.5px] p-[22px] shadow-[0_10px_24px_rgba(15,23,42,0.04)] md:px-[26px] md:py-[22px]"
                style={{
                  background: 'linear-gradient(135deg, #f4faf7 0%, var(--color-background-primary) 100%)',
                  borderColor: 'rgba(0,0,0,0.08)',
                }}
              >
                <div className="flex h-full flex-col justify-between gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
                      Growth Scenario Studio
                    </p>
                    <h2 className="mt-2 text-[15px] font-medium text-[var(--color-text-primary)]">
                      Stress-test every acquisition path
                    </h2>
                    <p className="mt-3 max-w-xl text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
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
                      Explore scenarios
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/growth-scenarios#wealth-projection')}
                      className="mt-2 inline-flex h-[42px] items-center rounded-[14px] border px-[18px] text-[13px] font-medium text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_18px_rgba(15,23,42,0.04)] transition-[transform,background,border-color,box-shadow] duration-150 ease-out hover:-translate-y-px hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_12px_22px_rgba(15,23,42,0.06)]"
                      style={{
                        borderColor: 'rgba(15, 110, 86, 0.14)',
                        background: 'linear-gradient(180deg, #ffffff 0%, #f8fbfa 100%)',
                      }}
                    >
                      View 30-year projection
                    </button>
                  </div>
                </div>
              </section>
            </section>

            <section
              className={`mt-5 grid grid-cols-1 gap-[14px] md:grid-cols-2 md:items-stretch ${isDashboardMounted ? 'dashboard-mounted' : ''}`}
              style={isDashboardMounted ? { animationDelay: '300ms' } : { opacity: 0, transform: 'translateY(8px)' }}
            >
              <div className="h-full [&>section]:h-full">
                <section className="h-full rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] p-[22px] shadow-[0_10px_24px_rgba(15,23,42,0.04)] md:px-[26px] md:py-[22px]">
                  <div className="flex items-end justify-between gap-4 border-b border-[rgba(0,0,0,0.08)] pb-4">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
                        Portfolio
                      </p>
                      <h2 className="mt-2 text-[15px] font-medium text-[var(--color-text-primary)]">
                        Properties at a glance
                      </h2>
                      <p className="mt-2 max-w-2xl text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
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

                  <div className="mt-4 space-y-3">
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

            {effectiveDashboardState.canShowBorrowing && Array.isArray(borrowingPowerAnalysis?.topConstraints) && borrowingPowerAnalysis.topConstraints.length > 0 ? (
              <section
                className={`mt-5 ${isDashboardMounted ? 'dashboard-mounted' : ''}`}
                style={isDashboardMounted ? { animationDelay: '360ms' } : { opacity: 0, transform: 'translateY(8px)' }}
              >
                <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
                  Constraints
                </p>
                <h2 className="mt-2 text-[15px] font-medium text-[var(--color-text-primary)]">
                  What&apos;s holding you back
                </h2>
                <p className="mt-2 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">
                  Your borrowing is primarily limited by:
                </p>

                <ul className="mt-4 space-y-2 text-sm leading-6 text-gray-700">
                  {borrowingPowerAnalysis.topConstraints.slice(0, 2).map((constraint) => (
                    <li
                      key={constraint.type}
                      className="flex items-center justify-between gap-4 rounded-r-[10px] border border-[rgba(0,0,0,0.08)] bg-[var(--color-background-secondary)] px-[14px] py-[10px]"
                      style={{
                        borderLeftWidth: 3,
                        borderLeftColor:
                          constraint.severity === 'High'
                            ? '#A32D2D'
                            : '#EF9F27',
                      }}
                    >
                      <p className="text-[13px] leading-[1.6] text-[var(--color-text-primary)]">
                        {constraint.message}
                      </p>
                      <span
                        className="shrink-0 rounded-full px-[10px] py-[3px] text-[10px] font-medium"
                        style={{
                          backgroundColor:
                            constraint.severity === 'High' ? '#FCEBEB' : '#FAEEDA',
                          color: constraint.severity === 'High' ? '#791F1F' : '#633806',
                        }}
                      >
                        {constraint.severity}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {commandCenter.urgentAlerts.length > 0 ? (
              <section
                className={`mt-5 ${isDashboardMounted ? 'dashboard-mounted' : ''}`}
                style={isDashboardMounted ? { animationDelay: '360ms' } : { opacity: 0, transform: 'translateY(8px)' }}
              >
                <div className="flex items-center gap-2 text-[#791F1F]">
                  <Siren size={18} />
                  <p className="text-[10px] font-medium uppercase tracking-[0.09em]">
                    Smart Alerts
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {commandCenter.urgentAlerts.map((alert) => (
                    <button
                      key={alert.id}
                      type="button"
                      onClick={() => navigate(alert.route)}
                      className="rounded-r-[12px] border border-[rgba(0,0,0,0.08)] bg-[#FCEBEB] px-4 py-3 text-left transition-all duration-200 hover:border-[rgba(0,0,0,0.08)] hover:bg-[#FCEBEB]"
                      style={{ borderLeftWidth: 3, borderLeftColor: '#A32D2D' }}
                    >
                      <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                        {alert.title}
                      </p>
                      <p className="mt-1 text-[13px] leading-[1.6] text-[#A32D2D]">{alert.impact}</p>
                      <p className="mt-3 inline-flex items-center gap-2 text-[13px] font-medium text-primary-600">
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
            onClick={() => onAction(section.unlocked === false ? '/properties' : section.route)}
            className={`flex w-full items-start justify-between gap-4 rounded-2xl border px-4 py-4 text-left transition-colors ${
              section.unlocked === false
                ? 'cursor-not-allowed border-gray-100 bg-gray-50/50 opacity-70'
                : 'border-gray-100 bg-gray-50/70 hover:bg-gray-50'
            }`}
            title={section.unlocked === false ? section.lockedReason : undefined}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">{section.label}</p>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                {section.unlocked === false ? (section.lockedReason || 'Add a property first') : section.body}
              </p>
            </div>
            <span className={`shrink-0 text-sm font-semibold ${
              section.unlocked === false ? 'text-gray-500' : 'text-primary-600'
            }`}>
              {section.unlocked === false ? 'Start with properties' : section.ctaLabel}
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
  const headlineValue =
    option.headlineValue ?? option.annualImpact
  const headlineLabel =
    option.headlineLabel ?? 'Annual cash flow'
  const isHeadlineCashFlow =
    String(headlineLabel || '').toLowerCase().includes('cash flow')
  const annualTone =
    Number(headlineValue) >= 0 ? 'text-[#0F6E56]' : 'text-[#A32D2D]'
  const accentColor =
    option.id === 'do-nothing'
      ? '#F09595'
      : option.id === 'apply-top-action'
        ? '#1D9E75'
        : '#EF9F27'
  const borrowingLabel =
    option.id === 'do-nothing'
      ? 'Current borrowing headroom'
      : option.id === 'apply-top-action'
        ? 'Borrowing headroom after action'
        : option.id === 'buy-now'
          ? 'Remaining headroom after purchase'
          : 'Borrowing headroom'

  return (
    <article
      className="rounded-[16px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] p-[22px] transition-[transform,box-shadow] duration-150 ease-out will-change-transform hover:-translate-y-[2px] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]"
      style={{ borderTopWidth: 3, borderTopColor: accentColor }}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
        {option.scenario}
      </p>
      <p className={`mt-3 text-[26px] font-medium tracking-[-0.5px] ${annualTone}`}>
        {typeof headlineValue === 'number'
          ? isHeadlineCashFlow
            ? `${headlineValue < 0 ? '-' : '+'}${formatCurrency(Math.abs(headlineValue))}/year`
            : formatCurrency(headlineValue)
          : '—'}
      </p>
      <p className="mt-[6px] text-[12px] leading-[1.5] text-[var(--color-text-secondary)]">
        {headlineLabel}
      </p>
      {option.secondaryValue !== undefined && option.secondaryLabel ? (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm text-slate-500">
            {option.secondaryLabel}
          </span>
          <span className="text-sm font-medium text-slate-700">
            {typeof option.secondaryValue === 'number' &&
            option.secondaryLabel?.toLowerCase().includes('cash flow')
              ? `${option.secondaryValue < 0 ? '-' : '+'}${formatCurrency(Math.abs(option.secondaryValue))}/year`
              : typeof option.secondaryValue === 'number'
                ? formatCurrency(option.secondaryValue)
                : '—'}
          </span>
        </div>
      ) : null}
      {typeof option.delta === 'number' && option.delta !== 0 ? (
        <div className="mt-2">
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            +{formatCurrency(option.delta)} {option.deltaLabel ?? 'improvement'}
          </span>
        </div>
      ) : null}
      <div className="mt-4 space-y-2 text-[13px] text-[var(--color-text-secondary)]">
        <div className="flex items-center justify-between gap-4">
          <span>{borrowingLabel}</span>
          <span className="font-medium text-[var(--color-text-primary)]">
            {formatCurrency(option.borrowing)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>Risk</span>
          <span
            className="rounded-full px-[10px] py-[3px] text-[10px] font-medium capitalize"
            style={{
              backgroundColor:
                option.risk === 'low'
                  ? '#ebebeb'
                  : option.risk === 'medium'
                    ? '#FAEEDA'
                    : '#FCEBEB',
              color:
                option.risk === 'low'
                  ? '#333'
                  : option.risk === 'medium'
                    ? '#633806'
                    : '#791F1F',
            }}
          >
            {option.risk}
          </span>
        </div>
      </div>
      <p className="mt-4 text-[13px] leading-[1.6] text-[var(--color-text-secondary)]">{option.description}</p>
    </article>
  )
}




