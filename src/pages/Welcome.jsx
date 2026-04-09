import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const defaultDraft = {
  currentValue: '',
  loanBalance: '',
  interestRate: '',
  rentPerMonth: '',
  propertyUse: 'investment',
  repaymentType: 'pi',
  propertyLabel: '',
  annualIncome: '',
  partnerIncome: '',
  cashSavings: '',
  offsetBalance: '',
  creditCardLimits: '',
}

const colors = {
  darkBg: '#0a1a14',
  greenPrimary: '#1D9E75',
  greenLight: '#5DCAA5',
  darkBorder: '#1a3d2e',
  formBg: '#ffffff',
  inputBg: '#f8f8f6',
  mutedText: '#6b7280',
  lightText: '#a7d7c3',
  strongText: '#e5fff4',
}

const baseInputStyle = {
  width: '100%',
  padding: '9px 12px',
  border: '0.5px solid #d1d5db',
  borderRadius: 8,
  fontSize: 14,
  background: colors.inputBg,
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
}

const baseButtonStyle = {
  background: colors.greenPrimary,
  color: '#ffffff',
  border: 'none',
  borderRadius: 8,
  padding: 11,
  fontSize: 14,
  fontWeight: 500,
  width: '100%',
  cursor: 'pointer',
}

const secondaryButtonStyle = {
  background: 'transparent',
  color: '#285848',
  border: '1px solid #cbd5cf',
  borderRadius: 8,
  padding: 11,
  fontSize: 14,
  fontWeight: 500,
  width: '100%',
  cursor: 'pointer',
}

function parseNumber(value) {
  const normalized = String(value ?? '').replace(/,/g, '').trim()
  if (!normalized) return 0
  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : 0
}

function isFilled(value) {
  return String(value ?? '').trim() !== ''
}

function formatCurrency(value) {
  return `$${Math.round(value || 0).toLocaleString('en-AU')}`
}

function formatCompactRange(value) {
  if (!value || value <= 0) return '$0k'
  return `$${Math.round(value / 1000)}k`
}

function calculateMonthlyRepayment({ balance, annualRate, repaymentType }) {
  if (balance <= 0) return 0
  const monthlyRate = annualRate / 100 / 12

  if (repaymentType === 'io') {
    return (balance * annualRate / 100) / 12
  }

  const termMonths = 300
  if (monthlyRate === 0) return balance / termMonths

  const factor = Math.pow(1 + monthlyRate, termMonths)
  return (balance * (monthlyRate * factor)) / (factor - 1)
}

function buildArcPath(cx, cy, radius, startAngle, endAngle) {
  const start = {
    x: cx + radius * Math.cos((Math.PI / 180) * startAngle),
    y: cy + radius * Math.sin((Math.PI / 180) * startAngle),
  }
  const end = {
    x: cx + radius * Math.cos((Math.PI / 180) * endAngle),
    y: cy + radius * Math.sin((Math.PI / 180) * endAngle),
  }
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`
}

function StepStatus({ number, label, subtitle, status }) {
  const circleStyle =
    status === 'completed'
      ? {
          background: colors.greenPrimary,
          color: '#04150f',
          border: `1px solid ${colors.greenPrimary}`,
        }
      : status === 'active'
        ? {
            background: colors.greenPrimary,
            color: '#ffffff',
            border: `1px solid ${colors.greenPrimary}`,
            boxShadow: '0 10px 24px rgba(29,158,117,0.22)',
          }
        : {
            background: 'transparent',
            color: '#7ba996',
            border: '1px solid #244135',
          }

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div
        style={{
          ...circleStyle,
          width: 36,
          height: 36,
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {status === 'completed' ? '✓' : number}
      </div>
      <div>
        <div
          style={{
            fontSize: 16,
            fontWeight: status === 'active' ? 600 : 500,
            color: status === 'pending' ? '#9bc5b3' : colors.strongText,
          }}
        >
          {label}
        </div>
        <div style={{ marginTop: 3, fontSize: 14, color: '#57967f', lineHeight: 1.45 }}>
          {subtitle}
        </div>
      </div>
    </div>
  )
}

function ToggleButton({ active, label, onClick, roundedLeft, roundedRight }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        textAlign: 'center',
        padding: 8,
        fontSize: 14,
        border: 'none',
        background: active ? colors.greenPrimary : '#f1f5f9',
        color: active ? '#ffffff' : colors.mutedText,
        borderRadius: roundedLeft ? '8px 0 0 8px' : roundedRight ? '0 8px 8px 0' : 0,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function MetricRow({ label, value, hint }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '18px 0',
        borderTop: `1px solid ${colors.darkBorder}`,
      }}
    >
      <div style={{ fontSize: 15, color: '#5fb899', lineHeight: 1.45, maxWidth: 130 }}>{label}</div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#bfeedd' }}>{value}</div>
        {hint ? <div style={{ marginTop: 4, fontSize: 13, color: '#4f8d77' }}>{hint}</div> : null}
      </div>
    </div>
  )
}

export default function Welcome({ session = null }) {
  const navigate = useNavigate()
  const snapshotKey = session?.user?.id
    ? `onboardingSnapshot_${session.user.id}`
    : 'onboardingSnapshot'
  const [draft, setDraft] = useState(() => {
    try {
      const saved = sessionStorage.getItem('vaulta_onboarding_draft')
      return saved ? JSON.parse(saved) : defaultDraft
    } catch {
      return defaultDraft
    }
  })
  const [currentStep, setCurrentStep] = useState(1)
  const [firstName, setFirstName] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [isNameResolved, setIsNameResolved] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingName, setIsSavingName] = useState(false)

  useEffect(() => {
    try {
      sessionStorage.setItem('vaulta_onboarding_draft', JSON.stringify(draft))
    } catch {
      // Ignore storage write failures in onboarding draft mode.
    }
  }, [draft])

  useEffect(() => {
    let active = true

    async function loadFirstName() {
      if (!session?.user?.id) {
        if (!active) return
        setCurrentStep(0)
        setIsNameResolved(true)
        return
      }

      try {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('first_name')
          .eq('user_id', session.user.id)
          .maybeSingle()

        if (!active) return

        const existingFirstName = String(profileData?.first_name ?? '').trim()

        if (existingFirstName) {
          setFirstName(existingFirstName)
          setNameInput(existingFirstName)
          setCurrentStep((prev) => (prev === 0 ? 1 : prev))
        } else {
          setCurrentStep(0)
        }
      } catch {
        if (!active) return
        setCurrentStep(0)
      } finally {
        if (active) setIsNameResolved(true)
      }
    }

    loadFirstName()

    return () => {
      active = false
    }
  }, [session?.user?.id])

  const derived = useMemo(() => {
    const currentValue = parseNumber(draft.currentValue)
    const loanBalance = parseNumber(draft.loanBalance)
    const interestRate = parseNumber(draft.interestRate)
    const rentPerMonth = parseNumber(draft.rentPerMonth)
    const annualIncome = parseNumber(draft.annualIncome)
    const partnerIncome = parseNumber(draft.partnerIncome)
    const cashSavings = parseNumber(draft.cashSavings)
    const offsetBalance = parseNumber(draft.offsetBalance)
    const creditCardLimits = parseNumber(draft.creditCardLimits)
    const annualRent = rentPerMonth * 12
    const netEquity = Math.max(0, currentValue - loanBalance)

    let estimatedBorrowingPower = 0
    if (annualIncome > 0) {
      estimatedBorrowingPower = annualIncome * 6
      if (partnerIncome > 0) {
        estimatedBorrowingPower += partnerIncome * 6
      }
      if (creditCardLimits > 0) {
        estimatedBorrowingPower -= creditCardLimits * 3.8
      }
      estimatedBorrowingPower = Math.max(0, estimatedBorrowingPower)
    }

    let acquisitionReadiness = 0
    if (currentValue > 0) acquisitionReadiness += 14
    if (loanBalance >= 0 && currentValue > 0) acquisitionReadiness += 10
    if (interestRate > 0) acquisitionReadiness += 4
    if (rentPerMonth > 0) acquisitionReadiness += 2

    const stepOneCap = 30
    const stepTwoCap = 50
    const stepThreeCap = 65
    const hasStepTwoData = annualIncome > 0 || partnerIncome > 0
    const hasStepThreeData = cashSavings > 0 || offsetBalance > 0 || creditCardLimits > 0

    if (hasStepTwoData) {
      if (annualIncome > 0) acquisitionReadiness += 12
      if (partnerIncome > 0) acquisitionReadiness += 8
      acquisitionReadiness = Math.min(stepTwoCap, acquisitionReadiness)
    } else {
      acquisitionReadiness = Math.min(stepOneCap, acquisitionReadiness)
    }

    if (hasStepThreeData) {
      if (cashSavings > 0) acquisitionReadiness += 10
      if (offsetBalance > 0) acquisitionReadiness += 3
      if (creditCardLimits > 0) acquisitionReadiness += 2
      acquisitionReadiness = Math.min(stepThreeCap, acquisitionReadiness)
    } else {
      acquisitionReadiness = Math.min(
        hasStepTwoData ? stepTwoCap : stepOneCap,
        acquisitionReadiness
      )
    }

    const indicativePurchaseRangeLow = cashSavings > 0 ? cashSavings * 4.5 : 0
    const indicativePurchaseRangeHigh = cashSavings > 0 ? cashSavings * 5.5 : 0

    const filledFields = [
      draft.currentValue,
      draft.loanBalance,
      draft.interestRate,
      draft.rentPerMonth,
      draft.propertyLabel,
      draft.annualIncome,
      draft.partnerIncome,
      draft.cashSavings,
      draft.offsetBalance,
      draft.creditCardLimits,
    ].filter(isFilled).length

    const confidenceLevel =
      acquisitionReadiness >= 60
        ? 'Indicative'
        : acquisitionReadiness >= 40
          ? 'Early view'
          : 'Getting started'

    const capitalTotal = cashSavings + offsetBalance + Math.max(0, netEquity * 0.2)

    return {
      annualIncome,
      annualRent,
      acquisitionReadiness,
      capitalTotal,
      cashSavings,
      confidenceLevel,
      creditCardLimits,
      filledFields,
      indicativePurchaseRangeHigh,
      indicativePurchaseRangeLow,
      interestRate,
      loanBalance,
      netEquity,
      offsetBalance,
      partnerIncome,
      rentPerMonth,
      currentValue,
      estimatedBorrowingPower,
    }
  }, [draft])

  function updateDraft(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function validateStepOne() {
    const currentValue = parseNumber(draft.currentValue)
    const loanBalance = parseNumber(draft.loanBalance)

    if (currentValue <= 0) {
      setErrorMessage('Current value must be a positive number.')
      return false
    }

    if (!isFilled(draft.loanBalance) || loanBalance < 0) {
      setErrorMessage('Loan balance must be a number greater than or equal to 0.')
      return false
    }

    setErrorMessage('')
    return true
  }

  function validateStepTwo() {
    const annualIncome = parseNumber(draft.annualIncome)

    if (annualIncome <= 0) {
      setErrorMessage('Your annual income must be a positive number.')
      return false
    }

    setErrorMessage('')
    return true
  }

  function validateStepThree() {
    const cashSavings = parseNumber(draft.cashSavings)

    if (cashSavings <= 0) {
      setErrorMessage('Cash savings must be a positive number.')
      return false
    }

    setErrorMessage('')
    return true
  }

  function handleContinue() {
    if (currentStep === 1) {
      if (!validateStepOne()) return
      setCurrentStep(2)
      return
    }

    if (currentStep === 2) {
      if (!validateStepTwo()) return
      setCurrentStep(3)
    }
  }

  async function handleSnapshot() {
    if (isSaving) return

    setIsSaving(true)

    try {
      const snapshot = {
        ...draft,
        finalScore: derived.acquisitionReadiness,
        completedAt: new Date().toISOString(),
      }

      if (session?.user?.id) {
        const employmentIncomeAnnual = parseNumber(draft.annualIncome)
        const partnerIncomeAnnual = parseNumber(draft.partnerIncome)
        const cashAvailableForInvestment = parseNumber(draft.cashSavings)
        const householdIncomeAnnual = employmentIncomeAnnual + partnerIncomeAnnual

        const { error: profileError } = await supabase
          .from('user_financial_profiles')
          .upsert(
            {
              user_id: session.user.id,
              employment_income_annual: employmentIncomeAnnual,
              partner_income_annual: partnerIncomeAnnual,
              household_income_annual: householdIncomeAnnual || null,
              cash_available_for_investment: cashAvailableForInvestment,
            },
            { onConflict: 'user_id' }
          )

        if (profileError) {
          console.error('Welcome completion profile save failed:', profileError)
        }
      }

      sessionStorage.setItem(
        snapshotKey,
        JSON.stringify(snapshot)
      )
      const saved = sessionStorage.getItem(snapshotKey)

      if (!saved) {
        console.error('Onboarding snapshot write verification failed:', {
          snapshotKey,
          userId: session?.user?.id ?? null,
        })
      }

      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.error('Snapshot handoff error:', err)
      navigate('/dashboard', { replace: true })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleNameStep() {
    const trimmedName = nameInput.trim()

    if (!trimmedName) {
      setErrorMessage('Please enter your first name.')
      return
    }

    setErrorMessage('')
    setIsSavingName(true)
    setFirstName(trimmedName)

    try {
      if (session?.user?.id) {
        const { error } = await supabase
          .from('user_profiles')
          .upsert(
            {
              user_id: session.user.id,
              first_name: trimmedName,
            },
            { onConflict: 'user_id' }
          )

        if (error) {
          console.error('First name save failed:', error)
        }
      }
    } catch (err) {
      console.error('First name save failed:', err)
    } finally {
      setCurrentStep(1)
      setIsSavingName(false)
    }
  }

  const progressWidth =
    currentStep === 0 ? '8%' : currentStep === 1 ? '33%' : currentStep === 2 ? '66%' : '90%'
  const gaugeBackground = buildArcPath(90, 90, 68, 180, 360)
  const gaugeForeground = buildArcPath(
    90,
    90,
    68,
    180,
    180 + (derived.acquisitionReadiness / 100) * 180
  )
  const trajectoryLabel =
    derived.acquisitionReadiness < 20
      ? 'Add data to see trajectory'
      : 'Acquisition trajectory'
  const trajectoryPath =
    derived.acquisitionReadiness >= 60
      ? 'M8 66 C46 63, 90 55, 134 41 S188 22, 214 14'
      : derived.acquisitionReadiness >= 20
        ? 'M8 64 C48 63, 92 59, 134 52 S188 41, 214 33'
        : 'M8 52 L214 52'
  const trajectoryStrokeDasharray = derived.acquisitionReadiness < 20 ? '5 5' : undefined

  const usableEquity = Math.max(0, derived.netEquity * 0.2)
  const totalCapital =
    (derived.cashSavings || 0) + (derived.offsetBalance || 0) + (usableEquity || 0)
  const cashPct = totalCapital > 0 ? ((derived.cashSavings || 0) / totalCapital) * 100 : 33
  const offsetPct = totalCapital > 0 ? ((derived.offsetBalance || 0) / totalCapital) * 100 : 33
  const equityPct = totalCapital > 0 ? ((usableEquity || 0) / totalCapital) * 100 : 34

  const stepStatuses = [
    { number: 1, label: 'Properties', subtitle: 'Value, debt, rent, type' },
    { number: 2, label: 'Income', subtitle: 'Serviceability' },
    { number: 3, label: 'Capital', subtitle: 'Deposit & liquidity' },
  ]

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.darkBg,
        padding: 16,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          minHeight: 560,
          maxWidth: 1380,
          margin: '0 auto',
          borderRadius: 24,
          overflow: 'hidden',
          border: `1px solid ${colors.darkBorder}`,
          boxShadow: '0 30px 60px rgba(0,0,0,0.28)',
          background: colors.darkBg,
        }}
      >
        <aside
          style={{
            width: 180,
            flexShrink: 0,
            background: colors.darkBg,
            color: colors.lightText,
            padding: '28px 20px',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 500, letterSpacing: -1, color: '#84ebc7' }}>
            VAULTA
          </div>

          <div style={{ marginTop: 54, display: 'flex', flexDirection: 'column', gap: 28 }}>
            {stepStatuses.map((step) => {
              const status =
                currentStep > step.number ? 'completed' : currentStep === step.number ? 'active' : 'pending'
              return <StepStatus key={step.number} {...step} status={status} />
            })}
          </div>

          <div style={{ marginTop: 'auto', fontSize: 13, lineHeight: 1.6, color: '#4f8d77' }}>
            Encrypted. Never shared.
            <br />
            Used only to generate your first portfolio insight.
          </div>
        </aside>

        <main
          style={{
            flex: 1,
            minWidth: 0,
            background: colors.formBg,
            color: '#121712',
            padding: '26px 34px 28px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {!isNameResolved ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 15, color: '#4d5a52' }}>Loading your onboarding...</div>
            </div>
          ) : (
            <>
          <div
            style={{
              height: 2,
              width: '100%',
              background: '#dce9e2',
              borderRadius: 999,
              overflow: 'hidden',
              marginBottom: 28,
            }}
          >
            <div
              style={{
                width: progressWidth,
                height: '100%',
                background: colors.greenPrimary,
                transition: 'width 180ms ease',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 26 }}>
            {stepStatuses.map((step) => {
              const active = currentStep === step.number
              return (
                <div
                  key={step.number}
                  style={{
                    padding: '12px 18px',
                    borderRadius: 999,
                    border: active ? `1px solid ${colors.greenPrimary}` : '1px solid #c9c2b5',
                    background: active ? colors.greenPrimary : '#f7f3eb',
                    color: active ? '#ffffff' : '#7a7367',
                    fontSize: 14,
                    fontWeight: active ? 600 : 500,
                    lineHeight: 1.15,
                    whiteSpace: 'pre-line',
                  }}
                >
                  {`Step ${step.number} ·\n${step.label}`}
                </div>
              )
            })}
          </div>

          {currentStep === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
              <div
                style={{
                  maxWidth: 520,
                  width: '100%',
                  margin: '0 auto',
                  background: '#0f211a',
                  border: `1px solid ${colors.darkBorder}`,
                  borderRadius: 24,
                  padding: '34px 32px',
                  boxShadow: '0 24px 48px rgba(4, 21, 15, 0.16)',
                }}
              >
                <div style={{ fontSize: 13, letterSpacing: 2.6, textTransform: 'uppercase', color: '#5DCAA5' }}>
                  Welcome
                </div>
                <div style={{ marginTop: 10, fontSize: 38, fontWeight: 500, letterSpacing: -1.3, color: '#f3fff9' }}>
                  Welcome to Vaulta
                </div>
                <div style={{ marginTop: 10, fontSize: 18, lineHeight: 1.6, color: '#c7eadc' }}>
                  What should we call you?
                </div>

                <div style={{ marginTop: 24 }}>
                  <input
                    value={nameInput}
                    onChange={(event) => setNameInput(event.target.value)}
                    placeholder="Your first name"
                    style={baseInputStyle}
                  />
                  <div style={{ marginTop: 8, fontSize: 13, color: '#8bcab2' }}>
                    We&apos;ll use this to personalise your experience
                  </div>
                </div>

                {errorMessage ? (
                  <div style={{ marginTop: 14, fontSize: 13, color: '#ffb4a8' }}>{errorMessage}</div>
                ) : null}

                <div style={{ marginTop: 24 }}>
                  <button
                    type="button"
                    onClick={handleNameStep}
                    disabled={isSavingName}
                    style={{
                      ...baseButtonStyle,
                      opacity: isSavingName ? 0.7 : 1,
                      cursor: isSavingName ? 'default' : 'pointer',
                    }}
                  >
                    Let&apos;s get started →
                  </button>
                  <div style={{ marginTop: 10, fontSize: 12, color: '#8bcab2', textAlign: 'center' }}>
                    Takes about 3 minutes · Your data stays private
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {currentStep === 1 ? (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ fontSize: 15, letterSpacing: 3, color: colors.greenPrimary, textTransform: 'uppercase' }}>
                Step 1 of 3 · Your portfolio
              </div>
              <div style={{ marginTop: 12, fontSize: 40, fontWeight: 500, letterSpacing: -1.5 }}>
                {firstName ? `Welcome, ${firstName}` : 'Your properties'}
              </div>
              <div style={{ marginTop: 14, fontSize: 16, lineHeight: 1.7, color: '#4d5a52', maxWidth: 520 }}>
                Start with your primary property first.
                You&apos;ll be able to add your remaining properties
                from the dashboard after setup.
                We&apos;ll use this to estimate equity position,
                serviceability, and your next acquisition path instantly.
              </div>

              <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <div style={{ fontSize: 14, marginBottom: 8, color: '#374151' }}>Property label / address</div>
                  <input
                    value={draft.propertyLabel}
                    onChange={(event) => updateDraft('propertyLabel', event.target.value)}
                    placeholder="e.g. 19 Barley Street, Brisbane"
                    style={baseInputStyle}
                  />
                  <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>
                    Optional — helps personalise your insights
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 14, marginBottom: 8, color: '#374151' }}>Property use</div>
                  <div
                    style={{
                      display: 'flex',
                      borderRadius: 8,
                      overflow: 'hidden',
                      border: '0.5px solid #d1d5db',
                    }}
                  >
                    <ToggleButton
                      active={draft.propertyUse === 'investment'}
                      label="Investment"
                      onClick={() => updateDraft('propertyUse', 'investment')}
                      roundedLeft
                    />
                    <ToggleButton
                      active={draft.propertyUse === 'owner_occupied'}
                      label="Owner occupied"
                      onClick={() => updateDraft('propertyUse', 'owner_occupied')}
                      roundedRight
                    />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>
                    Affects rental income and serviceability
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, marginBottom: 8, color: '#374151' }}>Current value ($)</div>
                    <input
                      value={draft.currentValue}
                      onChange={(event) => updateDraft('currentValue', event.target.value)}
                      placeholder="750,000"
                      style={baseInputStyle}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, marginBottom: 8, color: '#374151' }}>Loan balance ($)</div>
                    <input
                      value={draft.loanBalance}
                      onChange={(event) => updateDraft('loanBalance', event.target.value)}
                      placeholder="580,000"
                      style={baseInputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, marginBottom: 8, color: '#374151' }}>Interest rate (%)</div>
                    <input
                      value={draft.interestRate}
                      onChange={(event) => updateDraft('interestRate', event.target.value)}
                      placeholder="6.00"
                      style={baseInputStyle}
                    />
                    <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>
                      Unknown? We use 6% as default
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, marginBottom: 8, color: '#374151' }}>Repayment type</div>
                    <div
                      style={{
                        display: 'flex',
                        borderRadius: 8,
                        overflow: 'hidden',
                        border: '0.5px solid #d1d5db',
                      }}
                    >
                      <ToggleButton
                        active={draft.repaymentType === 'pi'}
                        label="P&I"
                        onClick={() => updateDraft('repaymentType', 'pi')}
                        roundedLeft
                      />
                      <ToggleButton
                        active={draft.repaymentType === 'io'}
                        label="IO"
                        onClick={() => updateDraft('repaymentType', 'io')}
                        roundedRight
                      />
                    </div>
                  </div>
                </div>

                {draft.propertyUse === 'investment' ? (
                  <div>
                    <div style={{ fontSize: 14, marginBottom: 8, color: '#374151' }}>
                      Monthly rental income ($)
                    </div>
                    <input
                      value={draft.rentPerMonth}
                      onChange={(event) => updateDraft('rentPerMonth', event.target.value)}
                      placeholder="2,400"
                      style={baseInputStyle}
                    />
                    <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>
                      Materially improves serviceability accuracy
                    </div>
                  </div>
                ) : null}
              </div>

              <div style={{ marginTop: 'auto', paddingTop: 28 }}>
                {errorMessage ? (
                  <div style={{ marginBottom: 12, fontSize: 13, color: '#b42318' }}>{errorMessage}</div>
                ) : null}
                <button type="button" onClick={handleContinue} style={baseButtonStyle}>
                  Continue to income →
                </button>
              </div>
            </div>
          ) : null}

          {currentStep === 2 ? (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ fontSize: 15, letterSpacing: 3, color: colors.greenPrimary, textTransform: 'uppercase' }}>
                Step 2 of 3 · Income
              </div>
              <div style={{ marginTop: 12, fontSize: 40, fontWeight: 500, letterSpacing: -1.5 }}>
                Income
              </div>
              <div style={{ marginTop: 14, fontSize: 16, lineHeight: 1.7, color: '#4d5a52', maxWidth: 520 }}>
                A quick serviceability snapshot is enough here. We only need the core income inputs to
                sharpen your first portfolio insight.
              </div>

              <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 520 }}>
                <div>
                  <div style={{ fontSize: 14, marginBottom: 8, color: '#374151' }}>Your annual income ($)</div>
                  <input
                    value={draft.annualIncome}
                    onChange={(event) => updateDraft('annualIncome', event.target.value)}
                    placeholder="150,000"
                    style={baseInputStyle}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 14, marginBottom: 8, color: '#374151' }}>
                    Partner / household income ($)
                  </div>
                  <input
                    value={draft.partnerIncome}
                    onChange={(event) => updateDraft('partnerIncome', event.target.value)}
                    placeholder="85,000"
                    style={baseInputStyle}
                  />
                  <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>
                    Include if applying jointly
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: 28 }}>
                {errorMessage ? (
                  <div style={{ marginBottom: 12, fontSize: 13, color: '#b42318' }}>{errorMessage}</div>
                ) : null}
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage('')
                      setCurrentStep(1)
                    }}
                    style={secondaryButtonStyle}
                  >
                    ← Back
                  </button>
                  <button type="button" onClick={handleContinue} style={baseButtonStyle}>
                    Continue to capital →
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {currentStep === 3 ? (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ fontSize: 15, letterSpacing: 3, color: colors.greenPrimary, textTransform: 'uppercase' }}>
                Step 3 of 3 · Capital
              </div>
              <div style={{ marginTop: 12, fontSize: 40, fontWeight: 500, letterSpacing: -1.5 }}>
                Capital
              </div>
              <div style={{ marginTop: 14, fontSize: 16, lineHeight: 1.7, color: '#4d5a52', maxWidth: 520 }}>
                Add your current liquidity position.
                We&apos;ll use this to estimate deposit strength
                and your indicative purchase range.
              </div>
              <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 520 }}>
                <div>
                  <div style={{ fontSize: 14, marginBottom: 8, color: '#374151' }}>Available cash outside offset ($)</div>
                  <input
                    value={draft.cashSavings}
                    onChange={(event) => updateDraft('cashSavings', event.target.value)}
                    placeholder="95,000"
                    style={baseInputStyle}
                  />
                  <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>
                    Savings currently available outside your mortgage offset account.
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 14, marginBottom: 8, color: '#374151' }}>Offset balance ($)</div>
                  <input
                    value={draft.offsetBalance}
                    onChange={(event) => updateDraft('offsetBalance', event.target.value)}
                    placeholder="42,000"
                    style={baseInputStyle}
                  />
                  <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>
                    Funds currently sitting in your mortgage offset.
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 14, marginBottom: 8, color: '#374151' }}>Credit card limits ($)</div>
                  <input
                    value={draft.creditCardLimits}
                    onChange={(event) => updateDraft('creditCardLimits', event.target.value)}
                    placeholder="15,000"
                    style={baseInputStyle}
                  />
                  <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>
                    Lenders count your limit, not your balance
                  </div>
                </div>

                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  Calculated at 8.5% assessment rate · Indicative only · Not financial advice
                </div>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: 28 }}>
                {errorMessage ? (
                  <div style={{ marginBottom: 12, fontSize: 13, color: '#b42318' }}>{errorMessage}</div>
                ) : null}
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage('')
                      setCurrentStep(2)
                    }}
                    disabled={isSaving}
                    style={{
                      ...secondaryButtonStyle,
                      opacity: isSaving ? 0.7 : 1,
                      cursor: isSaving ? 'default' : 'pointer',
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSnapshot}
                    disabled={isSaving}
                    style={{
                      ...baseButtonStyle,
                      opacity: isSaving ? 0.7 : 1,
                      cursor: isSaving ? 'default' : 'pointer',
                    }}
                  >
                    {isSaving ? 'Saving your profile...' : 'View my portfolio snapshot →'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
            </>
          )}
        </main>

        <aside
          style={{
            width: 260,
            flexShrink: 0,
            background: colors.darkBg,
            color: colors.lightText,
            padding: '28px 20px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ fontSize: 13, letterSpacing: 2.4, textTransform: 'uppercase', color: '#37b98c' }}>
            LIVE PREVIEW · UPDATES AS YOU TYPE
          </div>

          <div
            style={{
              marginTop: 18,
              padding: '8px 12px',
              borderRadius: 999,
              border: `1px solid ${colors.greenPrimary}`,
              color: '#80e6c4',
              fontSize: 14,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 999, background: colors.greenPrimary }} />
            {derived.confidenceLevel} · {derived.filledFields} inputs
          </div>

          <div style={{ marginTop: 26, display: 'flex', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: 180, height: 120 }}>
              <svg width="180" height="120" viewBox="0 0 180 120">
                <path d={gaugeBackground} fill="none" stroke="#123b2d" strokeWidth="14" strokeLinecap="round" />
                <path d={gaugeForeground} fill="none" stroke={colors.greenLight} strokeWidth="14" strokeLinecap="round" />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingTop: 18,
                }}
              >
                <div style={{ fontSize: 38, fontWeight: 500, letterSpacing: -1.5, color: '#38c29a' }}>
                  {derived.acquisitionReadiness}%
                </div>
                <div style={{ marginTop: 4, fontSize: 14, color: '#5ba88d' }}>acquisition readiness</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <MetricRow
              label="Indicative purchase range"
              value={
                derived.indicativePurchaseRangeLow > 0
                  ? `${formatCompactRange(derived.indicativePurchaseRangeLow)}–${formatCompactRange(derived.indicativePurchaseRangeHigh)}`
                  : 'Complete Step 3'
              }
              hint={derived.cashSavings > 0 ? 'Deposit-led path' : ''}
            />
            <MetricRow label="Net portfolio equity" value={formatCurrency(derived.netEquity)} />
            <MetricRow label="Rate stress threshold" value=">9.25%" />
            <MetricRow
              label="Rental contribution"
              value={derived.annualRent > 0 ? `${formatCurrency(derived.annualRent)}/yr` : '—'}
            />
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 15, color: '#4fa587', marginBottom: 10 }}>{trajectoryLabel}</div>
            <div
              style={{
                height: 88,
                borderRadius: 12,
                border: `1px solid ${colors.darkBorder}`,
                background: '#081711',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <svg width="220" height="88" viewBox="0 0 220 88" style={{ position: 'absolute', inset: 0 }}>
                <path
                  d={trajectoryPath}
                  fill="none"
                  stroke={colors.greenPrimary}
                  strokeWidth="2.5"
                  strokeDasharray={trajectoryStrokeDasharray}
                />
                {derived.acquisitionReadiness >= 20 ? (
                  <circle
                    cx="214"
                    cy={derived.acquisitionReadiness >= 60 ? 14 : 33}
                    r="4"
                    fill={colors.greenLight}
                  />
                ) : null}
              </svg>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 15, color: '#4fa587', marginBottom: 6 }}>Indicative deposit sources</div>
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 9, color: '#5DCAA5', opacity: 0.6, marginBottom: 6 }}>
                Shows where your deposit strength is coming from
              </p>

              <div style={{
                display: 'flex',
                height: 8,
                borderRadius: 4,
                overflow: 'hidden',
                gap: 2,
                marginBottom: 10,
              }}>
                <div style={{
                  width: `${cashPct}%`,
                  background: '#1D9E75',
                  borderRadius: '4px 0 0 4px',
                }} />
                <div style={{
                  width: `${offsetPct}%`,
                  background: '#5DCAA5',
                }} />
                <div style={{
                  width: `${equityPct}%`,
                  background: '#085041',
                  borderRadius: '0 4px 4px 0',
                }} />
              </div>

              {[
                { color: '#1D9E75', label: 'Cash available', value: derived.cashSavings || 0 },
                { color: '#5DCAA5', label: 'Offset funds', value: derived.offsetBalance || 0 },
                { color: '#085041', label: 'Usable equity', value: usableEquity || 0 },
              ].map(item => (
                <div key={item.label} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: item.color,
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 10, color: '#9FE1CB' }}>{item.label}</span>
                  </div>
                  <span style={{ fontSize: 10, color: '#9FE1CB', fontWeight: 500 }}>
                    ${item.value.toLocaleString()}
                  </span>
                </div>
              ))}

              <p style={{ fontSize: 9, color: '#5DCAA5', opacity: 0.5, marginTop: 6 }}>
                Used to estimate your purchase range
              </p>
            </div>
          </div>

          <div
            style={{
              marginTop: 20,
              border: `1px solid ${colors.darkBorder}`,
              borderRadius: 16,
              padding: 16,
              color: '#c1f1e0',
              background: 'rgba(7, 27, 21, 0.65)',
              lineHeight: 1.6,
              fontSize: 14,
            }}
          >
            <div
              style={{
                fontSize: 13,
                letterSpacing: 1.6,
                textTransform: 'uppercase',
                color: '#4cb293',
                marginBottom: 10,
              }}
            >
              Top unlock
            </div>
            {derived.creditCardLimits > 0 ? (
              <div>
                Reducing credit card limit by {formatCurrency(derived.creditCardLimits)} could unlock +
                {formatCurrency(Math.round(derived.creditCardLimits * 3.8))} borrowing capacity
              </div>
            ) : (
              <div>Add your credit card limits to see your top unlock</div>
            )}
          </div>

          <div
            style={{
              marginTop: 20,
              textAlign: 'center',
              fontSize: 14,
              color: '#6aa78f',
              lineHeight: 1.5,
            }}
          >
            Complete all 3 steps to unlock your full dashboard
          </div>

          <div style={{ marginTop: 12, fontSize: 13, color: '#4d8f78', textAlign: 'center' }}>
            Recalculates as you complete each step
          </div>
        </aside>
      </div>
    </div>
  )
}
