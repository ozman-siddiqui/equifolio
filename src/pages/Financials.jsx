import { useEffect, useMemo, useState } from 'react'
import {
  BriefcaseBusiness,
  CreditCard,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react'

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
    household_income_annual: '',
    employment_income_annual: '',
    other_income_annual: '',
    partner_income_annual: '',
    living_expenses_monthly: '',
    dependants: '0',
    borrower_count: '1',
  }
}

function defaultLiabilityForm() {
  return {
    name: '',
    type: 'credit_card',
    balance: '',
    monthly_repayment: '',
    credit_limit: '',
    interest_rate: '',
    notes: '',
  }
}

function parseMoney(value) {
  return value === '' ? null : Number(value)
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))
}

export default function Financials({ session = null }) {
  const { financialProfile, liabilities, loading, error, fetchFinancialData } = useFinancialData()

  const [profileForm, setProfileForm] = useState(defaultProfileForm)
  const [profileState, setProfileState] = useState({ loading: false, error: '', success: '' })

  const [showLiabilityForm, setShowLiabilityForm] = useState(false)
  const [editingLiabilityId, setEditingLiabilityId] = useState(null)
  const [liabilityForm, setLiabilityForm] = useState(defaultLiabilityForm)
  const [liabilityState, setLiabilityState] = useState({
    loading: false,
    error: '',
    success: '',
  })

  useEffect(() => {
    const nextForm = !financialProfile
      ? defaultProfileForm()
      : {
          household_income_annual: financialProfile.household_income_annual ?? '',
          employment_income_annual: financialProfile.employment_income_annual ?? '',
          other_income_annual: financialProfile.other_income_annual ?? '',
          partner_income_annual:
            financialProfile.household_income_annual && financialProfile.employment_income_annual
              ? Math.max(
                  Number(financialProfile.household_income_annual || 0) -
                    Number(financialProfile.employment_income_annual || 0) -
                    Number(financialProfile.other_income_annual || 0),
                  0
                )
              : '',
          living_expenses_monthly: financialProfile.living_expenses_monthly ?? '',
          dependants: financialProfile.dependants ?? '0',
          borrower_count: financialProfile.borrower_count ?? '1',
        }

    const timeoutId = window.setTimeout(() => {
      setProfileForm(nextForm)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [financialProfile])

  const liabilitySummary = useMemo(() => {
    const totalBalance = liabilities.reduce(
      (sum, liability) => sum + Number(liability.balance || 0),
      0
    )
    const totalRepayments = liabilities.reduce(
      (sum, liability) => sum + Number(liability.monthly_repayment || 0),
      0
    )

    return {
      count: liabilities.length,
      totalBalance,
      totalRepayments,
    }
  }, [liabilities])

  const openCreateLiability = () => {
    setEditingLiabilityId(null)
    setLiabilityForm(defaultLiabilityForm())
    setLiabilityState({ loading: false, error: '', success: '' })
    setShowLiabilityForm(true)
  }

  const openEditLiability = (liability) => {
    setEditingLiabilityId(liability.id)
    setLiabilityForm({
      name: liability.name || '',
      type: liability.type || 'credit_card',
      balance: liability.balance ?? '',
      monthly_repayment: liability.monthly_repayment ?? '',
      credit_limit: liability.credit_limit ?? '',
      interest_rate: liability.interest_rate ?? '',
      notes: liability.notes || '',
    })
    setLiabilityState({ loading: false, error: '', success: '' })
    setShowLiabilityForm(true)
  }

  const handleProfileChange = (field, value) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleLiabilityChange = (field, value) => {
    setLiabilityForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSaveProfile = async (event) => {
    event.preventDefault()
    setProfileState({ loading: true, error: '', success: '' })

    const employmentIncome = parseMoney(profileForm.employment_income_annual)
    const otherIncome = parseMoney(profileForm.other_income_annual)
    const partnerIncome = parseMoney(profileForm.partner_income_annual)
    const livingExpenses = parseMoney(profileForm.living_expenses_monthly)
    const dependants = Number(profileForm.dependants)
    const borrowerCount = Number(profileForm.borrower_count)

    const numericChecks = [
      employmentIncome,
      otherIncome,
      partnerIncome,
      livingExpenses,
    ].every((value) => value === null || (Number.isFinite(value) && value >= 0))

    if (!numericChecks) {
      setProfileState({
        loading: false,
        error: 'Income and expense values must be 0 or greater.',
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

    if (!Number.isFinite(borrowerCount) || borrowerCount <= 0) {
      setProfileState({
        loading: false,
        error: 'Borrower count must be greater than 0.',
        success: '',
      })
      return
    }

    const householdIncome =
      Number(employmentIncome || 0) + Number(otherIncome || 0) + Number(partnerIncome || 0)

    const { error } = await supabase.from('user_financial_profiles').upsert(
      {
        user_id: session?.user?.id,
        household_income_annual: householdIncome || null,
        employment_income_annual: employmentIncome,
        other_income_annual: otherIncome,
        living_expenses_monthly: livingExpenses,
        dependants,
        borrower_count: borrowerCount,
      },
      { onConflict: 'user_id' }
    )

    if (error) {
      setProfileState({ loading: false, error: error.message, success: '' })
      return
    }

    await fetchFinancialData()
    setProfileState({ loading: false, error: '', success: 'Financial profile saved.' })
  }

  const handleSaveLiability = async (event) => {
    event.preventDefault()
    setLiabilityState({ loading: true, error: '', success: '' })

    const balance = parseMoney(liabilityForm.balance)
    const monthlyRepayment = parseMoney(liabilityForm.monthly_repayment)
    const creditLimit = parseMoney(liabilityForm.credit_limit)
    const interestRate = parseMoney(liabilityForm.interest_rate)

    const numericChecks = [balance, monthlyRepayment, creditLimit, interestRate].every(
      (value) => value === null || (Number.isFinite(value) && value >= 0)
    )

    if (!liabilityForm.name.trim()) {
      setLiabilityState({ loading: false, error: 'Liability name is required.', success: '' })
      return
    }

    if (!numericChecks) {
      setLiabilityState({
        loading: false,
        error: 'Liability numeric values must be 0 or greater.',
        success: '',
      })
      return
    }

    const payload = {
      user_id: session?.user?.id,
      name: liabilityForm.name.trim(),
      type: liabilityForm.type,
      balance,
      monthly_repayment: monthlyRepayment,
      credit_limit: creditLimit,
      interest_rate: interestRate,
      notes: liabilityForm.notes.trim() || null,
    }

    const query = editingLiabilityId
      ? supabase.from('liabilities').update(payload).eq('id', editingLiabilityId)
      : supabase.from('liabilities').insert([payload])

    const { error } = await query

    if (error) {
      setLiabilityState({ loading: false, error: error.message, success: '' })
      return
    }

    await fetchFinancialData()
    setLiabilityState({ loading: false, error: '', success: 'Liability saved.' })
    setShowLiabilityForm(false)
    setEditingLiabilityId(null)
    setLiabilityForm(defaultLiabilityForm())
  }

  const handleDeleteLiability = async (liabilityId) => {
    if (!window.confirm('Delete this liability?')) return
    await supabase.from('liabilities').delete().eq('id', liabilityId)
    fetchFinancialData()
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
                  Add borrower income, living expenses, and liabilities so Equifolio can
                  power serviceability, refinance impact, and borrowing strategy decisions.
                </p>
              </div>

              <button
                type="button"
                onClick={openCreateLiability}
                className={utilityPrimaryButtonClass}
              >
                <Plus size={15} className="shrink-0" />
                <span className="whitespace-nowrap">Add Liability</span>
              </button>
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
              value={liabilitySummary.count}
              helper={`${formatCurrency(liabilitySummary.totalRepayments)}/month in repayments`}
            />
          </div>
        </section>

        {error ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
            <p className="text-sm font-semibold text-amber-800">
              Financial data is not available yet
            </p>
            <p className="mt-1 text-sm text-amber-700">
              The Financials page is isolated for now. If the backend tables are not available yet, the rest of the app will keep working normally.
            </p>
          </section>
        ) : null}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <FinancialCard
            className="xl:col-span-2"
            title="Income Profile"
            description="This feeds future borrowing power and serviceability calculations."
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
            description="This profile powers decision-quality improvements across the platform."
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
              label="Monthly liabilities"
              value={formatCurrency(liabilitySummary.totalRepayments)}
            />
          </FinancialCard>
        </div>

        <FinancialCard
          title="Liabilities"
          description="Track personal debts that affect serviceability and borrowing capacity."
        >
          {showLiabilityForm ? (
            <form onSubmit={handleSaveLiability} className="rounded-2xl border border-gray-100 p-5 bg-gray-50 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Liability name">
                  <input
                    value={liabilityForm.name}
                    onChange={(event) => handleLiabilityChange('name', event.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g. ANZ Rewards Card"
                  />
                </Field>

                <Field label="Type">
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

                <Field label="Balance ($)">
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

                <Field label="Interest rate (%)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={liabilityForm.interest_rate}
                    onChange={(event) =>
                      handleLiabilityChange('interest_rate', event.target.value)
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </Field>
              </div>

              <Field label="Notes">
                <input
                  value={liabilityForm.notes}
                  onChange={(event) => handleLiabilityChange('notes', event.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Optional notes"
                />
              </Field>

              {liabilityState.error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {liabilityState.error}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={liabilityState.loading}
                  className={utilityPrimaryButtonClass}
                >
                  {liabilityState.loading ? 'Saving...' : editingLiabilityId ? 'Save Liability' : 'Add Liability'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowLiabilityForm(false)
                    setEditingLiabilityId(null)
                    setLiabilityForm(defaultLiabilityForm())
                    setLiabilityState({ loading: false, error: '', success: '' })
                  }}
                  className={utilitySecondaryButtonClass}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          <div className="space-y-3">
            {liabilities.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center">
                <CreditCard className="mx-auto mb-3 text-gray-300" size={24} />
                <h3 className="text-sm font-semibold text-gray-900">No liabilities recorded</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Add credit cards, personal loans, or other debts to improve serviceability accuracy.
                </p>
              </div>
            ) : (
              liabilities.map((liability) => (
                <div key={liability.id} className="rounded-2xl border border-gray-100 p-4">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{liability.name}</p>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                          {LIABILITY_TYPES.find((item) => item.value === liability.type)?.label || liability.type}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                        <MiniStat label="Balance" value={formatCurrency(liability.balance)} />
                        <MiniStat
                          label="Repayment"
                          value={formatCurrency(liability.monthly_repayment)}
                        />
                        <MiniStat
                          label="Credit limit"
                          value={liability.credit_limit ? formatCurrency(liability.credit_limit) : '—'}
                        />
                        <MiniStat
                          label="Rate"
                          value={
                            liability.interest_rate || liability.interest_rate === 0
                              ? `${Number(liability.interest_rate).toFixed(2)}%`
                              : '—'
                          }
                        />
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
                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
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
      className={`${nested ? 'rounded-2xl border border-gray-100 bg-gray-50 p-5' : `bg-white rounded-2xl border border-gray-100 p-6 ${className}`}`}
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
