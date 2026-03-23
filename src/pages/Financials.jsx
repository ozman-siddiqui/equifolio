import { useEffect, useMemo, useState } from 'react'
import { BriefcaseBusiness, CreditCard, Wallet } from 'lucide-react'

import { supabase } from '../supabase'
import useFinancialData from '../hooks/useFinancialData'
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

function defaultProfileForm() {
  return {
    employment_income_annual: '',
    partner_income_annual: '',
    other_income_annual: '',
    living_expenses_monthly: '',
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

  useEffect(() => {
    const nextForm = !financialProfile
      ? defaultProfileForm()
      : {
          employment_income_annual: financialProfile.employment_income_annual ?? '',
          partner_income_annual:
            financialProfile.household_income_annual != null
              ? Math.max(
                  Number(financialProfile.household_income_annual || 0) -
                    Number(financialProfile.employment_income_annual || 0) -
                    Number(financialProfile.other_income_annual || 0),
                  0
                )
              : '',
          other_income_annual: financialProfile.other_income_annual ?? '',
          living_expenses_monthly: financialProfile.living_expenses_monthly ?? '',
          dependants: financialProfile.dependants ?? '0',
          borrower_count: financialProfile.borrower_count ?? '1',
        }

    const timeoutId = window.setTimeout(() => {
      setProfileForm(nextForm)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [financialProfile])

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
    setProfileForm((prev) => ({ ...prev, [field]: value }))
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
    const livingExpenses = parseMoney(profileForm.living_expenses_monthly)
    const dependants = Number(profileForm.dependants)
    const borrowerCount = Number(profileForm.borrower_count)

    const nonNegativeMoneyFields = [income, partnerIncome, otherIncome, livingExpenses]
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

    const { error: saveError } = await supabase.from('user_financial_profiles').upsert(
      {
        user_id: session.user.id,
        household_income_annual: householdIncome || null,
        employment_income_annual: income,
        other_income_annual: otherIncome,
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

    await fetchFinancialData()
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

                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Financials</h1>
                <p className="text-gray-500 mt-2 max-w-2xl">
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

                <Field label="Other income ($ / year)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={profileForm.other_income_annual}
                    onChange={(event) =>
                      handleProfileChange('other_income_annual', event.target.value)
                    }
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
                title="Expenses"
                description="Living costs are required for future borrowing analysis."
                nested
              >
                <Field label="Living expenses ($ / month)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={profileForm.living_expenses_monthly}
                    onChange={(event) =>
                      handleProfileChange('living_expenses_monthly', event.target.value)
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </Field>
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
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      {children}
    </div>
  )
}

function TopMetricCard({ icon, label, value, helper }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <div className="flex items-center gap-2 text-gray-500">
        {icon}
        <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900 md:text-3xl">{value}</p>
      <p className="mt-2 text-sm text-gray-400">{helper}</p>
    </div>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-100 py-3 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-900 text-right">{value}</span>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-900">{value}</p>
    </div>
  )
}
