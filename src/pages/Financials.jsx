import { useEffect, useMemo, useState } from 'react'
import { BriefcaseBusiness, CreditCard, Wallet } from 'lucide-react'

import { supabase } from '../supabase'
import useFinancialData from '../hooks/useFinancialData'
import { normalizeTaxOwnership, validateTaxOwnership } from '../lib/taxOwnership'
import {
  utilityPrimaryButtonClass,
  utilitySecondaryButtonClass,
} from '../components/CardPrimitives'

const LIABILITY_TYPES = [
  { value: 'credit_card', label: 'Credit card' },
  { value: 'personal_loan', label: 'Personal loan' },
  { value: 'car_loan', label: 'Car loan' },
  { value: 'student_loan', label: 'Student loan' },
  { value: 'buy_now_pay_later', label: 'Buy now pay later' },
  { value: 'tax_debt', label: 'Tax debt' },
  { value: 'other', label: 'Other' },
]

const EXPENSE_CATEGORY_FIELDS = [
  {
    key: 'groceries_household_monthly',
    label: 'Groceries & household ($ / month)',
  },
  {
    key: 'utilities_phone_internet_monthly',
    label: 'Utilities, phone & internet ($ / month)',
  },
  {
    key: 'transport_monthly',
    label: 'Transport ($ / month)',
  },
  {
    key: 'insurance_monthly',
    label: 'Insurance ($ / month)',
  },
  {
    key: 'childcare_education_monthly',
    label: 'Childcare & education ($ / month)',
  },
  {
    key: 'medical_monthly',
    label: 'Medical ($ / month)',
  },
  {
    key: 'entertainment_lifestyle_monthly',
    label: 'Entertainment & lifestyle ($ / month)',
  },
  {
    key: 'other_non_debt_monthly',
    label: 'Other non-debt costs ($ / month)',
  },
]

function defaultProfileForm() {
  return {
    employment_income_annual: '',
    partner_income_annual: '',
    other_income_annual: '',
    cash_available_for_investment: '',
    ownership_structure: 'individual',
    ownership_split_user_pct: '100',
    ownership_split_partner_pct: '0',
    groceries_household_monthly: '',
    utilities_phone_internet_monthly: '',
    transport_monthly: '',
    insurance_monthly: '',
    childcare_education_monthly: '',
    medical_monthly: '',
    entertainment_lifestyle_monthly: '',
    other_non_debt_monthly: '',
    dependants: '0',
    borrower_count: '1',
  }
}

function defaultLiabilityForm() {
  return {
    type: 'credit_card',
    name: '',
    credit_limit: '',
    balance: '',
    monthly_repayment: '',
  }
}

function shouldShowCreditLimit(type) {
  return type === 'credit_card'
}

function parseMoney(value) {
  if (value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function sumMoney(values) {
  return values.reduce((sum, value) => sum + Number(value || 0), 0)
}

function hasExpenseBreakdown(profile) {
  return EXPENSE_CATEGORY_FIELDS.some(({ key }) => profile?.[key] != null)
}

function derivePartnerIncome(profile) {
  if (profile?.partner_income_annual != null) {
    return profile.partner_income_annual
  }

  if (profile?.household_income_annual == null) {
    return ''
  }

  return Math.max(
    Number(profile.household_income_annual || 0) -
      Number(profile.employment_income_annual || 0) -
      Number(profile.other_income_annual || 0),
    0
  )
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))
}

export default function Financials({ session = null }) {
  const { financialProfile, loading, error, fetchFinancialData } = useFinancialData()

  const [profileForm, setProfileForm] = useState(defaultProfileForm)
  const [profileDirty, setProfileDirty] = useState(false)
  const [profileState, setProfileState] = useState({
    loading: false,
    error: '',
    success: '',
  })
  const [liabilities, setLiabilities] = useState([])
  const [liabilitiesLoading, setLiabilitiesLoading] = useState(true)
  const [liabilitiesError, setLiabilitiesError] = useState('')
  const [showLiabilityForm, setShowLiabilityForm] = useState(false)
  const [editingLiabilityId, setEditingLiabilityId] = useState(null)
  const [liabilityForm, setLiabilityForm] = useState(defaultLiabilityForm)
  const [liabilityState, setLiabilityState] = useState({
    loading: false,
    error: '',
    success: '',
  })
  const liabilitiesSummary = useMemo(() => {
    const totalCount = liabilities.length
    const totalOutstandingBalance = liabilities.reduce(
      (sum, liability) => sum + Number(liability.balance || 0),
      0
    )
    const totalMonthlyRepayments = liabilities.reduce(
      (sum, liability) => sum + Number(liability.monthly_repayment || 0),
      0
    )
    const totalRevolvingCreditLimits = liabilities.reduce((sum, liability) => {
      if (liability.type !== 'credit_card') return sum
      return sum + Number(liability.credit_limit || 0)
    }, 0)

    return {
      totalCount,
      totalOutstandingBalance,
      totalMonthlyRepayments,
      totalRevolvingCreditLimits,
    }
  }, [liabilities])

  const livingExpenseCategories = useMemo(
    () =>
      EXPENSE_CATEGORY_FIELDS.map(({ key }) => parseMoney(profileForm[key])).filter(
        (value) => value !== null
      ),
    [profileForm]
  )

  const totalLivingExpenses = useMemo(
    () => sumMoney(livingExpenseCategories),
    [livingExpenseCategories]
  )
  const ownershipDraft = useMemo(
    () =>
      normalizeTaxOwnership({
        ownershipStructure: profileForm.ownership_structure,
        ownershipSplitUserPct: parseMoney(profileForm.ownership_split_user_pct),
        ownershipSplitPartnerPct: parseMoney(profileForm.ownership_split_partner_pct),
      }),
    [
      profileForm.ownership_structure,
      profileForm.ownership_split_partner_pct,
      profileForm.ownership_split_user_pct,
    ]
  )
  const ownershipSplitTotal =
    Number(ownershipDraft.ownershipSplitUserPct || 0) +
    Number(ownershipDraft.ownershipSplitPartnerPct || 0)
  const ownershipSplitInlineError =
    profileForm.ownership_structure === 'joint' && ownershipSplitTotal !== 100
      ? 'Ownership split must total 100.'
      : ''
  const showPartnerIncomeWarning =
    profileForm.ownership_structure === 'joint' &&
    !(Number(parseMoney(profileForm.partner_income_annual)) > 0)

  useEffect(() => {
    if (profileDirty) return

    const usesCategoryBreakdown = hasExpenseBreakdown(financialProfile)
    const legacyLivingExpenses =
      !usesCategoryBreakdown && financialProfile?.living_expenses_monthly != null
        ? financialProfile.living_expenses_monthly
        : ''

    const normalizedOwnership = normalizeTaxOwnership({
      ownershipStructure: financialProfile?.ownership_structure,
      ownershipSplitUserPct: financialProfile?.ownership_split_user_pct,
      ownershipSplitPartnerPct: financialProfile?.ownership_split_partner_pct,
    })

    const nextForm = !financialProfile
      ? defaultProfileForm()
      : {
          employment_income_annual: financialProfile.employment_income_annual ?? '',
          partner_income_annual: derivePartnerIncome(financialProfile),
          other_income_annual: financialProfile.other_income_annual ?? '',
          cash_available_for_investment:
            financialProfile.cash_available_for_investment ?? '',
          ownership_structure: normalizedOwnership.ownershipStructure,
          ownership_split_user_pct: String(normalizedOwnership.ownershipSplitUserPct),
          ownership_split_partner_pct: String(normalizedOwnership.ownershipSplitPartnerPct),
          groceries_household_monthly: financialProfile.groceries_household_monthly ?? '',
          utilities_phone_internet_monthly:
            financialProfile.utilities_phone_internet_monthly ?? '',
          transport_monthly: financialProfile.transport_monthly ?? '',
          insurance_monthly: financialProfile.insurance_monthly ?? '',
          childcare_education_monthly: financialProfile.childcare_education_monthly ?? '',
          medical_monthly: financialProfile.medical_monthly ?? '',
          entertainment_lifestyle_monthly:
            financialProfile.entertainment_lifestyle_monthly ?? '',
          other_non_debt_monthly:
            financialProfile.other_non_debt_monthly ?? legacyLivingExpenses,
          dependants: financialProfile.dependants ?? '0',
          borrower_count: financialProfile.borrower_count ?? '1',
        }

    setProfileForm(nextForm)
  }, [financialProfile, profileDirty])

  useEffect(() => {
    let active = true

    const loadLiabilities = async () => {
      setLiabilitiesLoading(true)
      setLiabilitiesError('')

      try {
        if (!session?.user?.id) {
          if (!active) return
          setLiabilities([])
          return
        }

        const { data, error: fetchError } = await supabase
          .from('liabilities')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })

        if (fetchError) {
          throw fetchError
        }

        if (!active) return
        setLiabilities(data || [])
      } catch (fetchError) {
        if (!active) return
        setLiabilities([])
        setLiabilitiesError(fetchError?.message || 'Liabilities could not be loaded.')
      } finally {
        if (active) {
          setLiabilitiesLoading(false)
        }
      }
    }

    loadLiabilities()

    return () => {
      active = false
    }
  }, [session])

  const handleProfileChange = (field, value) => {
    setProfileDirty(true)
    setProfileState((prev) => ({
      ...prev,
      error: '',
      success: '',
    }))
    setProfileForm((prev) => {
      if (field === 'ownership_structure') {
        if (value === 'joint') {
          const normalizedOwnership = normalizeTaxOwnership({
            ownershipStructure: 'joint',
            ownershipSplitUserPct: parseMoney(prev.ownership_split_user_pct),
            ownershipSplitPartnerPct: parseMoney(prev.ownership_split_partner_pct),
          })

          return {
            ...prev,
            ownership_structure: 'joint',
            ownership_split_user_pct: String(normalizedOwnership.ownershipSplitUserPct),
            ownership_split_partner_pct: String(normalizedOwnership.ownershipSplitPartnerPct),
          }
        }

        return {
          ...prev,
          ownership_structure: 'individual',
          ownership_split_user_pct: '100',
          ownership_split_partner_pct: '0',
        }
      }

      return { ...prev, [field]: value }
    })
  }

  const handleLiabilityChange = (field, value) => {
    setLiabilityForm((prev) => {
      const next = { ...prev, [field]: value }

      if (field === 'type' && !shouldShowCreditLimit(value)) {
        next.credit_limit = ''
      }

      return next
    })
  }

  const fetchLiabilities = async () => {
    setLiabilitiesLoading(true)
    setLiabilitiesError('')

    try {
      if (!session?.user?.id) {
        setLiabilities([])
        return
      }

      const { data, error: fetchError } = await supabase
        .from('liabilities')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (fetchError) {
        throw fetchError
      }

      setLiabilities(data || [])
    } catch (fetchError) {
      setLiabilities([])
      setLiabilitiesError(fetchError?.message || 'Liabilities could not be loaded.')
    } finally {
      setLiabilitiesLoading(false)
    }
  }

  const handleSaveProfile = async (event) => {
    event.preventDefault()
    setProfileState({ loading: true, error: '', success: '' })

    const income = parseMoney(profileForm.employment_income_annual)
    const partnerIncome = parseMoney(profileForm.partner_income_annual)
    const otherIncome = parseMoney(profileForm.other_income_annual)
    const cashAvailableForInvestment = parseMoney(
      profileForm.cash_available_for_investment
    )
    const ownership = normalizeTaxOwnership({
      ownershipStructure: profileForm.ownership_structure,
      ownershipSplitUserPct: parseMoney(profileForm.ownership_split_user_pct),
      ownershipSplitPartnerPct: parseMoney(profileForm.ownership_split_partner_pct),
    })
    const expenseCategoryValues = EXPENSE_CATEGORY_FIELDS.map(({ key }) => parseMoney(profileForm[key]))
    const dependants = Number(profileForm.dependants)
    const borrowerCount = Number(profileForm.borrower_count)

    const nonNegativeMoneyFields = [
      income,
      partnerIncome,
      otherIncome,
      cashAvailableForInvestment,
      ...expenseCategoryValues,
    ]
    const hasInvalidMoney = nonNegativeMoneyFields.some(
      (value) => value !== null && (!Number.isFinite(value) || value < 0)
    )

    if (hasInvalidMoney) {
      setProfileState({
        loading: false,
        error: 'Income and expense values must be valid numbers 0 or greater.',
        success: '',
      })
      return
    }

    if (!Number.isFinite(dependants) || dependants < 0) {
      setProfileState({
        loading: false,
        error: 'Dependants must be 0 or greater.',
        success: '',
      })
      return
    }

    if (!Number.isFinite(borrowerCount) || borrowerCount < 1) {
      setProfileState({
        loading: false,
        error: 'Borrower count must be 1 or greater.',
        success: '',
      })
      return
    }

    const ownershipValidationError = validateTaxOwnership({
      ...ownership,
      partnerIncomeAnnual: partnerIncome,
    })

    if (ownershipValidationError) {
      setProfileState({
        loading: false,
        error: ownershipValidationError,
        success: '',
      })
      return
    }

    if (!session?.user?.id) {
      setProfileState({
        loading: false,
        error: 'You must be signed in to save your financial profile.',
        success: '',
      })
      return
    }

    const householdIncome =
      Number(income || 0) + Number(partnerIncome || 0) + Number(otherIncome || 0)
    const livingExpenses = sumMoney(expenseCategoryValues)

    const { error: saveError } = await supabase.from('user_financial_profiles').upsert(
      {
        user_id: session.user.id,
        household_income_annual: householdIncome || null,
        employment_income_annual: income,
        partner_income_annual: partnerIncome,
        other_income_annual: otherIncome,
        cash_available_for_investment: cashAvailableForInvestment,
        ownership_structure: ownership.ownershipStructure,
        ownership_split_user_pct: ownership.ownershipSplitUserPct,
        ownership_split_partner_pct: ownership.ownershipSplitPartnerPct,
        groceries_household_monthly: expenseCategoryValues[0],
        utilities_phone_internet_monthly: expenseCategoryValues[1],
        transport_monthly: expenseCategoryValues[2],
        insurance_monthly: expenseCategoryValues[3],
        childcare_education_monthly: expenseCategoryValues[4],
        medical_monthly: expenseCategoryValues[5],
        entertainment_lifestyle_monthly: expenseCategoryValues[6],
        other_non_debt_monthly: expenseCategoryValues[7],
        living_expenses_monthly: livingExpenses,
        dependants,
        borrower_count: borrowerCount,
      },
      { onConflict: 'user_id' }
    )

    if (saveError) {
      setProfileState({
        loading: false,
        error: saveError.message || 'Financial profile could not be saved.',
        success: '',
      })
      return
    }

    await fetchFinancialData({ force: true })
    setProfileDirty(false)
    setProfileState({
      loading: false,
      error: '',
      success: 'Financial profile saved.',
    })
  }

  const openCreateLiability = () => {
    setEditingLiabilityId(null)
    setLiabilityForm(defaultLiabilityForm())
    setLiabilityState({ loading: false, error: '', success: '' })
    setShowLiabilityForm(true)
  }

  const openEditLiability = (liability) => {
    setEditingLiabilityId(liability.id)
    setLiabilityForm({
      type: liability.type || 'credit_card',
      name: liability.name || '',
      credit_limit: liability.credit_limit ?? '',
      balance: liability.balance ?? '',
      monthly_repayment: liability.monthly_repayment ?? '',
    })
    setLiabilityState({ loading: false, error: '', success: '' })
    setShowLiabilityForm(true)
  }

  const closeLiabilityForm = () => {
    setShowLiabilityForm(false)
    setEditingLiabilityId(null)
    setLiabilityForm(defaultLiabilityForm())
    setLiabilityState({ loading: false, error: '', success: '' })
  }

  const handleSaveLiability = async (event) => {
    event.preventDefault()
    setLiabilityState({ loading: true, error: '', success: '' })

    const creditLimit = parseMoney(liabilityForm.credit_limit)
    const outstandingBalance = parseMoney(liabilityForm.balance)
    const monthlyRepayment = parseMoney(liabilityForm.monthly_repayment)

    const visibleNumericFields = shouldShowCreditLimit(liabilityForm.type)
      ? [creditLimit, outstandingBalance, monthlyRepayment]
      : [outstandingBalance, monthlyRepayment]

    const invalidNumeric = visibleNumericFields.some(
      (value) => value !== null && (!Number.isFinite(value) || value < 0)
    )

    if (!session?.user?.id) {
      setLiabilityState({
        loading: false,
        error: 'You must be signed in to save liabilities.',
        success: '',
      })
      return
    }

    if (!liabilityForm.type) {
      setLiabilityState({
        loading: false,
        error: 'Liability type is required.',
        success: '',
      })
      return
    }

    if (!liabilityForm.name.trim()) {
      setLiabilityState({
        loading: false,
        error: 'Lender or provider name is required.',
        success: '',
      })
      return
    }

    if (invalidNumeric) {
      setLiabilityState({
        loading: false,
        error: 'Credit limit, outstanding balance, and monthly repayment must be valid numbers 0 or greater.',
        success: '',
      })
      return
    }

    const payload = {
      user_id: session.user.id,
      type: liabilityForm.type,
      name: liabilityForm.name.trim(),
      credit_limit: shouldShowCreditLimit(liabilityForm.type) ? creditLimit : null,
      balance: outstandingBalance,
      monthly_repayment: monthlyRepayment,
    }

    const query = editingLiabilityId
      ? supabase.from('liabilities').update(payload).eq('id', editingLiabilityId)
      : supabase.from('liabilities').insert([payload])

    const { error: saveError } = await query

    if (saveError) {
      setLiabilityState({
        loading: false,
        error: saveError.message || 'Liability could not be saved.',
        success: '',
      })
      return
    }

    await fetchLiabilities()
    setLiabilityState({
      loading: false,
      error: '',
      success: editingLiabilityId ? 'Liability updated.' : 'Liability added.',
    })
    setShowLiabilityForm(false)
    setEditingLiabilityId(null)
    setLiabilityForm(defaultLiabilityForm())
  }

  const handleDeleteLiability = async (liabilityId) => {
    if (!window.confirm('Delete this liability?')) return

    const { error: deleteError } = await supabase.from('liabilities').delete().eq('id', liabilityId)

    if (deleteError) {
      setLiabilitiesError(deleteError.message || 'Liability could not be deleted.')
      return
    }

    await fetchLiabilities()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading financials...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-6 md:p-8 border-b border-gray-100">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-medium text-primary-700 bg-primary-50 px-3 py-1 rounded-full mb-4">
                  <Wallet size={13} />
                  Financial Data Layer
                </div>

                <h1 className="text-[28px] font-medium tracking-[-0.3px] text-[var(--color-text-primary)]">Financials</h1>
                <p className="mt-2 max-w-2xl text-[13px] font-normal leading-[1.6] text-[var(--color-text-secondary)]">
                  Add borrower income and living expenses so Equifolio can build a
                  reliable financial profile for future serviceability and borrowing decisions.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 bg-gray-50/70 p-6 md:grid-cols-3 md:p-8">
            <TopMetricCard
              icon={<BriefcaseBusiness size={16} className="text-primary-600" />}
              label="Household Income"
              value={formatCurrency(financialProfile?.household_income_annual || 0)}
              helper="Annual borrower income on file"
            />
            <TopMetricCard
              icon={<Wallet size={16} className="text-orange-600" />}
              label="Living Expenses"
              value={formatCurrency(financialProfile?.living_expenses_monthly || 0)}
              helper="Monthly living expense baseline"
            />
            <TopMetricCard
              icon={<CreditCard size={16} className="text-red-500" />}
              label="Liabilities"
              value={liabilitiesLoading ? '...' : liabilities.length}
              helper={liabilitiesError ? 'Unavailable' : 'Tracked personal liabilities'}
            />
          </div>
        </section>

        {error ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
            <p className="text-sm font-semibold text-amber-800">
              Financial profile data is not available yet
            </p>
            <p className="mt-1 text-sm text-amber-700">
              This page will stay stable even if the backend table is not available yet.
            </p>
          </section>
        ) : null}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <FinancialCard
            className="xl:col-span-2"
            title="Income Profile"
            description="This is the only active section in this rollout step."
          >
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Income ($ / year)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={profileForm.employment_income_annual}
                    onChange={(event) =>
                      handleProfileChange('employment_income_annual', event.target.value)
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </Field>

                <Field label="Partner income ($ / year)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={profileForm.partner_income_annual}
                    onChange={(event) =>
                      handleProfileChange('partner_income_annual', event.target.value)
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </Field>

                <Field
                  label="Other income ($ / year)"
                  helper="Include non-salary income such as bonuses, dividends, trust distributions, or side income. Do not include rent from investment properties already tracked in Equifolio, so it is not counted twice."
                >
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={profileForm.other_income_annual}
                    onChange={(event) =>
                      handleProfileChange('other_income_annual', event.target.value)
                    }
                    placeholder="e.g. bonus, dividends, trust distribution"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </Field>

                <Field
                  label="Cash available for investment ($)"
                  helper="Liquid cash you are willing to deploy toward deposits and acquisition costs."
                >
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={profileForm.cash_available_for_investment}
                    onChange={(event) =>
                      handleProfileChange(
                        'cash_available_for_investment',
                        event.target.value
                      )
                    }
                    placeholder="e.g. 50000"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </Field>

                <Field label="Borrower count">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={profileForm.borrower_count}
                    onChange={(event) =>
                      handleProfileChange('borrower_count', event.target.value)
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </Field>

                <Field label="Dependants">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={profileForm.dependants}
                    onChange={(event) => handleProfileChange('dependants', event.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </Field>
              </div>

              <FinancialCard
                title="Tax Ownership"
                description="Used to estimate property tax benefits correctly."
                nested
              >
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    Tax benefits are estimated using ownership split and each owner&apos;s taxable income.
                  </p>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label="Ownership structure">
                      <select
                        value={profileForm.ownership_structure}
                        onChange={(event) =>
                          handleProfileChange('ownership_structure', event.target.value)
                        }
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="individual">Individual</option>
                        <option value="joint">Joint ownership</option>
                      </select>
                    </Field>
                  </div>

                  {profileForm.ownership_structure === 'joint' ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Field label="User %">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={profileForm.ownership_split_user_pct}
                            onChange={(event) =>
                              handleProfileChange(
                                'ownership_split_user_pct',
                                event.target.value
                              )
                            }
                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </Field>

                        <Field label="Partner %">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={profileForm.ownership_split_partner_pct}
                            onChange={(event) =>
                              handleProfileChange(
                                'ownership_split_partner_pct',
                                event.target.value
                              )
                            }
                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </Field>
                      </div>

                      {ownershipSplitInlineError ? (
                        <p className="text-sm text-red-600">{ownershipSplitInlineError}</p>
                      ) : (
                        <p className="text-sm text-gray-500">
                          Split total: {ownershipSplitTotal} / 100
                        </p>
                      )}

                      {showPartnerIncomeWarning ? (
                        <p className="text-sm text-amber-700">
                          Add partner income to estimate joint ownership tax benefit accurately.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Individual ownership uses a 100 / 0 split.
                    </p>
                  )}
                </div>
              </FinancialCard>

              <FinancialCard
                title="Expenses"
                description="Category-based living costs are saved as a compatibility total for future analysis."
                nested
              >
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    Include only personal and household living costs such as groceries, utilities,
                    transport, insurance, childcare, and lifestyle expenses.
                  </p>
                  <p className="text-sm text-gray-500">
                    Do NOT include:
                    <br />
                    - mortgage repayments
                    <br />
                    - personal loans or car loans
                    <br />
                    - credit card repayments
                    <br />
                    - investment property expenses
                  </p>
                  <p className="text-sm text-gray-500">
                    Equifolio accounts for debts and investment property costs separately.
                  </p>
                  <p className="text-xs text-gray-400">
                    Do not include investment property costs here - they are already accounted for
                    in rental income adjustments.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {EXPENSE_CATEGORY_FIELDS.map((field) => (
                      <Field key={field.key} label={field.label}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={profileForm[field.key]}
                          onChange={(event) =>
                            handleProfileChange(field.key, event.target.value)
                          }
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </Field>
                    ))}
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Total monthly living expenses
                    </p>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {formatCurrency(totalLivingExpenses)}
                    </p>
                  </div>
                </div>
              </FinancialCard>

              {profileState.error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {profileState.error}
                </div>
              ) : null}

              {profileState.success ? (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  {profileState.success}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={profileState.loading}
                className={utilityPrimaryButtonClass}
              >
                {profileState.loading ? 'Saving...' : 'Save Financial Profile'}
              </button>
            </form>
          </FinancialCard>

          <FinancialCard
            title="Current Financial Layer"
            description="Current saved values from your financial profile."
          >
            <SummaryRow label="Profile status" value={financialProfile ? 'Connected' : 'Missing'} />
            <SummaryRow
              label="Borrower count"
              value={financialProfile?.borrower_count || '—'}
            />
            <SummaryRow
              label="Dependants"
              value={financialProfile?.dependants ?? '—'}
            />
            <SummaryRow
              label="Living expenses"
              value={formatCurrency(financialProfile?.living_expenses_monthly || 0)}
            />
            <SummaryRow
              label="Cash available for investment"
              value={formatCurrency(
                financialProfile?.cash_available_for_investment || 0
              )}
            />
          </FinancialCard>
        </div>

        <FinancialCard
          title="Liabilities"
          description="Track personal debts separately from property loans."
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <TopMetricCard
                icon={<CreditCard size={16} className="text-primary-600" />}
                label="Liabilities Count"
                value={liabilitiesSummary.totalCount}
                helper="Total liabilities on file"
              />
              <TopMetricCard
                icon={<Wallet size={16} className="text-orange-600" />}
                label="Outstanding Balance"
                value={formatCurrency(liabilitiesSummary.totalOutstandingBalance)}
                helper="Total balance across liabilities"
              />
              <TopMetricCard
                icon={<Wallet size={16} className="text-red-500" />}
                label="Monthly Repayments"
                value={formatCurrency(liabilitiesSummary.totalMonthlyRepayments)}
                helper="Combined monthly repayments"
              />
              <TopMetricCard
                icon={<CreditCard size={16} className="text-primary-600" />}
                label="Revolving Limits"
                value={formatCurrency(liabilitiesSummary.totalRevolvingCreditLimits)}
                helper="Credit card limits only"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-gray-500">
                Liability type maps to the backend `type` field, lender/provider maps to `name`,
                and outstanding balance maps to `balance`.
              </p>
              <button
                type="button"
                onClick={openCreateLiability}
                className={utilityPrimaryButtonClass}
              >
                Add Liability
              </button>
            </div>

            {liabilitiesError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {liabilitiesError}
              </div>
            ) : null}

            {showLiabilityForm ? (
              <form onSubmit={handleSaveLiability} className="rounded-2xl border border-gray-100 bg-gray-50 p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Liability type">
                    <select
                      value={liabilityForm.type}
                      onChange={(event) => handleLiabilityChange('type', event.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {LIABILITY_TYPES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Lender / provider">
                    <input
                      value={liabilityForm.name}
                      onChange={(event) => handleLiabilityChange('name', event.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="e.g. ANZ Rewards Card"
                    />
                  </Field>

                  <Field label="Outstanding balance ($)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={liabilityForm.balance}
                      onChange={(event) => handleLiabilityChange('balance', event.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </Field>

                  <Field label="Monthly repayment ($)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={liabilityForm.monthly_repayment}
                      onChange={(event) =>
                        handleLiabilityChange('monthly_repayment', event.target.value)
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </Field>

                  {shouldShowCreditLimit(liabilityForm.type) ? (
                    <Field label="Credit limit ($)">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={liabilityForm.credit_limit}
                        onChange={(event) =>
                          handleLiabilityChange('credit_limit', event.target.value)
                        }
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </Field>
                  ) : null}
                </div>

                {liabilityState.error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {liabilityState.error}
                  </div>
                ) : null}

                {liabilityState.success ? (
                  <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    {liabilityState.success}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={liabilityState.loading}
                    className={utilityPrimaryButtonClass}
                  >
                    {liabilityState.loading
                      ? 'Saving...'
                      : editingLiabilityId
                        ? 'Save Liability'
                        : 'Add Liability'}
                  </button>
                  <button
                    type="button"
                    onClick={closeLiabilityForm}
                    className={utilitySecondaryButtonClass}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}

            {liabilitiesLoading ? (
              <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
                Loading liabilities...
              </div>
            ) : liabilities.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center">
                <CreditCard className="mx-auto mb-3 text-gray-300" size={24} />
                <h3 className="text-sm font-semibold text-gray-900">No liabilities recorded</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Add credit cards, personal loans, or other personal debts here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {liabilities.map((liability) => (
                  <div key={liability.id} className="rounded-2xl border border-gray-100 p-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">{liability.name}</p>
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                            {LIABILITY_TYPES.find((option) => option.value === liability.type)?.label || liability.type}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-sm">
                          <MiniStat label="Outstanding balance" value={formatCurrency(liability.balance)} />
                          <MiniStat label="Monthly repayment" value={formatCurrency(liability.monthly_repayment)} />
                          {shouldShowCreditLimit(liability.type) ? (
                            <MiniStat label="Credit limit" value={formatCurrency(liability.credit_limit)} />
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditLiability(liability)}
                          className={utilitySecondaryButtonClass}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLiability(liability.id)}
                          className={utilitySecondaryButtonClass}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FinancialCard>
      </main>
    </div>
  )
}

function FinancialCard({ title, description, children, className = '', nested = false }) {
  return (
    <section
      className={
        nested
          ? 'rounded-2xl border border-gray-100 bg-gray-50 p-5'
          : `bg-white rounded-2xl border border-gray-100 p-6 ${className}`
      }
    >
      <div className={nested ? '' : 'mb-5'}>
        <h2 className="text-[15px] font-medium text-[var(--color-text-primary)]">{title}</h2>
        <p className="mt-1 text-[13px] font-normal leading-[1.6] text-[var(--color-text-secondary)]">{description}</p>
      </div>
      {children}
    </section>
  )
}

function Field({ label, helper = '', children }) {
  return (
    <div>
      <p className="mb-2 text-[15px] font-medium text-[var(--color-text-primary)]">{label}</p>
      {helper ? <p className="mb-2 text-[11px] leading-[1.5] text-[var(--color-text-tertiary)]">{helper}</p> : null}
      {children}
    </div>
  )
}

function TopMetricCard({ icon, label, value, helper }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <div className="flex items-center gap-2 text-gray-500">
        {icon}
        <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">{label}</p>
      </div>
      <p className="mt-3 text-[26px] font-medium tracking-[-0.5px] text-[var(--color-text-primary)]">{value}</p>
      <p className="mt-2 text-[11px] leading-[1.5] text-[var(--color-text-tertiary)]">{helper}</p>
    </div>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-100 py-3 last:border-0">
      <span className="text-[13px] font-normal leading-[1.6] text-[var(--color-text-secondary)]">{label}</span>
      <span className="text-right text-[13px] font-normal leading-[1.6] text-[var(--color-text-primary)]">{value}</span>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div>
      <p className="text-[11px] leading-[1.5] text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-1 text-[13px] font-normal leading-[1.6] text-[var(--color-text-primary)]">{value}</p>
    </div>
  )
}
