import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Calendar,
  DollarSign,
  Pencil,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { MetricTile, utilityPrimaryButtonClass } from '../components/CardPrimitives'
import { supabase } from '../supabase'
import usePortfolioData from '../hooks/usePortfolioData'
import CashFlowModal from '../components/CashFlowModal'
import EditTransactionModal from '../components/EditTransactionModal'

function getMonthlyAmount(amount, frequency) {
  const safeAmount = Number(amount || 0)
  const normalizedFrequency = String(frequency || '').trim().toLowerCase()

  switch (normalizedFrequency) {
    case 'weekly':
      return (safeAmount * 52) / 12
    case 'fortnightly':
      return (safeAmount * 26) / 12
    case 'monthly':
      return safeAmount
    case 'quarterly':
      return safeAmount / 3
    case 'yearly':
    case 'annual':
      return safeAmount / 12
    default:
      return safeAmount
  }
}

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))

const formatMonthLabel = (monthKey) => {
  if (!monthKey) return 'Unknown'
  const [year, month] = String(monthKey).split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })
}

export default function CashFlow() {
  const [session, setSession] = useState(null)
  const { properties, transactions, loading, fetchData } = usePortfolioData(session)
  const handlePortfolioSave = (options = {}) =>
    fetchData({
      ...options,
      force: true,
      userId: session?.user?.id ?? null,
    })

  const [cashFlowPropertyId, setCashFlowPropertyId] = useState(null)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [selectedDetailPropertyId, setSelectedDetailPropertyId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    let active = true

    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        if (active) setSession(currentSession || null)
      })
      .catch(() => {
        if (active) setSession(null)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession || null)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const effectiveDetailPropertyId =
    selectedDetailPropertyId || String(properties[0]?.id || 'portfolio')

  const propertyMap = useMemo(
    () => Object.fromEntries(properties.map((property) => [String(property.id), property])),
    [properties]
  )

  const propertyBreakdown = useMemo(() => {
    return properties
      .map((property) => {
        const propertyTransactions = transactions.filter(
          (transaction) => String(transaction.property_id) === String(property.id)
        )

        const income = propertyTransactions
          .filter((transaction) => transaction.type === 'income')
          .reduce(
            (sum, transaction) => sum + getMonthlyAmount(transaction.amount, transaction.frequency),
            0
          )

        const expenses = propertyTransactions
          .filter((transaction) => transaction.type === 'expense')
          .reduce(
            (sum, transaction) => sum + getMonthlyAmount(transaction.amount, transaction.frequency),
            0
          )

        const latestDate = propertyTransactions
          .map((transaction) => transaction.date)
          .filter(Boolean)
          .sort((a, b) => new Date(b) - new Date(a))[0]

        return {
          propertyId: String(property.id),
          property,
          income,
          expenses,
          net: income - expenses,
          transactionCount: propertyTransactions.length,
          latestDate,
        }
      })
      .sort((a, b) => b.net - a.net)
  }, [properties, transactions])

  const portfolioSummary = useMemo(() => {
    const income = propertyBreakdown.reduce((sum, property) => sum + property.income, 0)
    const expenses = propertyBreakdown.reduce((sum, property) => sum + property.expenses, 0)

    return {
      income,
      expenses,
      net: income - expenses,
    }
  }, [propertyBreakdown])

  const trendScopeTransactions = useMemo(() => {
    if (effectiveDetailPropertyId === 'portfolio') return transactions

    return transactions.filter(
      (transaction) => String(transaction.property_id) === String(effectiveDetailPropertyId)
    )
  }, [transactions, effectiveDetailPropertyId])

  const monthlyTrendData = useMemo(() => {
    const grouped = new Map()

    trendScopeTransactions.forEach((transaction) => {
      const monthKey = String(transaction.date || '').slice(0, 7)
      if (!monthKey) return

      if (!grouped.has(monthKey)) {
        grouped.set(monthKey, { month: monthKey, income: 0, expenses: 0, net: 0 })
      }

      const entry = grouped.get(monthKey)
      const monthlyAmount = getMonthlyAmount(transaction.amount, transaction.frequency)

      if (transaction.type === 'income') entry.income += monthlyAmount
      else entry.expenses += monthlyAmount

      entry.net = entry.income - entry.expenses
    })

    const ordered = Array.from(grouped.values()).sort((a, b) =>
      a.month.localeCompare(b.month)
    )

    return ordered.slice(-6).map((entry) => ({
      ...entry,
      label: formatMonthLabel(entry.month),
    }))
  }, [trendScopeTransactions])

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((transaction) => {
        const matchesProperty =
          selectedDetailPropertyId === 'portfolio' ||
          String(transaction.property_id) === String(effectiveDetailPropertyId)

        const matchesStart = !startDate || transaction.date >= startDate
        const matchesEnd = !endDate || transaction.date <= endDate

        return matchesProperty && matchesStart && matchesEnd
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [transactions, selectedDetailPropertyId, effectiveDetailPropertyId, startDate, endDate])

  const filteredSummary = useMemo(() => {
    const income = filteredTransactions
      .filter((transaction) => transaction.type === 'income')
      .reduce(
        (sum, transaction) => sum + getMonthlyAmount(transaction.amount, transaction.frequency),
        0
      )

    const expenses = filteredTransactions
      .filter((transaction) => transaction.type === 'expense')
      .reduce(
        (sum, transaction) => sum + getMonthlyAmount(transaction.amount, transaction.frequency),
        0
      )

    return {
      income,
      expenses,
      net: income - expenses,
    }
  }, [filteredTransactions])

  const handleDeleteTransaction = async (transactionId) => {
    if (!window.confirm('Delete this transaction?')) return
    const { error } = await supabase.from('transactions').delete().eq('id', transactionId)

    if (error) {
      window.alert(error.message)
      return
    }

    await fetchData({
      force: true,
      userId: session?.user?.id ?? null,
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background-tertiary)] flex items-center justify-center">
        <div className="text-gray-400">Loading cash flow...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-background-tertiary)]">
      <main className="mx-auto max-w-7xl space-y-[22px] px-6 py-6">
        <section className="overflow-hidden rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)]">
          <div className="border-b-[0.5px] border-[rgba(0,0,0,0.06)] p-6 md:p-8">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="min-w-0 flex-1">
                <h1 className="text-[28px] font-medium tracking-[-0.3px] text-[var(--color-text-primary)]">
                  Cash Flow
                </h1>
                <p className="mt-2 max-w-2xl text-[13px] font-normal leading-[1.6] text-[var(--color-text-secondary)]">
                  Start with the portfolio picture, compare property-level performance,
                  then drill into filtered transaction detail only when you need it.
                </p>
                <p className="mt-3 max-w-3xl text-[12px] font-normal leading-[1.6] text-[var(--color-text-tertiary)]">
                  Cash flow should be recorded only for investment properties. Owner-occupied properties should not include rental income, management fees, or operating expenses.
                </p>
              </div>

              <div className="shrink-0 flex items-start">
                <button
                  onClick={() =>
                    setCashFlowPropertyId(
                      effectiveDetailPropertyId === 'portfolio'
                        ? properties[0]?.id || null
                        : effectiveDetailPropertyId
                    )
                  }
                  disabled={properties.length === 0}
                  className={`${utilityPrimaryButtonClass} disabled:bg-gray-300 disabled:shadow-none`}
                >
                  <DollarSign size={15} className="shrink-0" />
                  <span className="whitespace-nowrap">Add Transaction</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 md:p-8 bg-gray-50/70">
            <MetricCard
              icon={<TrendingUp size={16} />}
              label="Total Income"
              value={formatCurrency(portfolioSummary.income)}
              valueClassName="text-[#0F6E56]"
            />
            <MetricCard
              icon={<TrendingDown size={16} />}
              label="Total Expenses"
              value={formatCurrency(portfolioSummary.expenses)}
              valueClassName="text-[#A32D2D]"
            />
            <MetricCard
              icon={<DollarSign size={16} />}
              label="Net Cash Flow"
              value={formatCurrency(portfolioSummary.net)}
              valueClassName={
                portfolioSummary.net >= 0 ? 'text-[#0F6E56]' : 'text-[#A32D2D]'
              }
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)]">
          <div className="border-b-[0.5px] border-[rgba(0,0,0,0.06)] p-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <h2 className="text-[15px] font-medium text-[var(--color-text-primary)]">Trend</h2>
                <p className="mt-1 text-[13px] font-normal leading-[1.6] text-[var(--color-text-secondary)]">
                  Monthly cash flow trend for the selected detail scope.
                </p>
              </div>

              <div className="w-full lg:w-[280px]">
                <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
                  Scope
                </label>
                <select
                  value={effectiveDetailPropertyId}
                  onChange={(event) => setSelectedDetailPropertyId(event.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="portfolio">Portfolio summary</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.address}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="p-6">
            {monthlyTrendData.length === 0 ? (
              <EmptyState
                icon={<Activity size={20} className="text-gray-300" />}
                title="No trend data yet"
                description="Add transactions to start seeing monthly cash flow movement."
              />
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#94A3B8' }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#94A3B8' }}
                      tickFormatter={(value) => `$${Math.abs(value / 1000).toFixed(0)}k`}
                      width={42}
                    />
                    <Tooltip content={<TrendTooltip />} />
                    <Bar dataKey="income" fill="#22C55E" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="expenses" fill="#F87171" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)]">
          <div className="border-b-[0.5px] border-[rgba(0,0,0,0.06)] p-6">
            <h2 className="text-[15px] font-medium text-[var(--color-text-primary)]">Property Breakdown</h2>
            <p className="mt-1 text-[13px] font-normal leading-[1.6] text-[var(--color-text-secondary)]">
              Compare each property at a glance before drilling into detailed transactions.
            </p>
          </div>

          <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
            {propertyBreakdown.length === 0 ? (
              <div className="xl:col-span-2">
                <EmptyState
                  icon={<Building2 size={20} className="text-gray-300" />}
                  title="No property cash flow yet"
                  description="Add transactions to start building property-level cash flow views."
                />
              </div>
            ) : (
              propertyBreakdown.map((entry) => (
                <button
                  key={entry.propertyId}
                  type="button"
                  onClick={() => setSelectedDetailPropertyId(entry.propertyId)}
                  className={`text-left rounded-[16px] border border-[rgba(0,0,0,0.08)] px-[22px] py-[18px] transition-transform duration-150 ease-[ease] will-change-transform hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] ${
                    String(effectiveDetailPropertyId) === String(entry.propertyId)
                      ? 'border-[#b8e8d8] bg-[#E1F5EE] shadow-sm shadow-[#b8e8d8]/60'
                      : 'bg-[var(--color-background-primary)] hover:bg-gray-50 hover:border-gray-200'
                  }`}
                >
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-gray-400 shrink-0" />
                        <h3 className="break-words text-[15px] font-medium text-[var(--color-text-primary)]">
                          {entry.property.address}
                        </h3>
                      </div>

                      <p className="mt-1 text-[13px] font-normal leading-[1.6] text-[var(--color-text-secondary)]">
                        {entry.property.suburb}, {entry.property.state}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                      <span className="whitespace-nowrap">
                        {entry.transactionCount} transaction
                        {entry.transactionCount === 1 ? '' : 's'}
                      </span>
                      {entry.latestDate ? (
                        <span className="whitespace-nowrap">
                          Latest {new Date(entry.latestDate).toLocaleDateString('en-AU')}
                        </span>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <MetricTile
                        label="Income"
                        value={formatCurrency(entry.income)}
                        valueClassName="text-[#0F6E56]"
                      />
                      <MetricTile
                        label="Expenses"
                        value={formatCurrency(entry.expenses)}
                        valueClassName="text-[#A32D2D]"
                      />
                      <MetricTile
                        label="Net"
                        value={formatCurrency(entry.net)}
                        valueClassName={entry.net >= 0 ? 'text-[#0F6E56]' : 'text-[#A32D2D]'}
                      />
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-[18px] border border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)]">
          <div className="border-b-[0.5px] border-[rgba(0,0,0,0.06)] p-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div>
                <h2 className="text-[15px] font-medium text-[var(--color-text-primary)]">Transactions</h2>
                <p className="mt-1 text-[13px] font-normal leading-[1.6] text-[var(--color-text-secondary)]">
                  Filter to one property or stay at portfolio level, then narrow by date range.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full lg:max-w-3xl">
                <div>
                  <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
                    Property
                  </label>
                  <select
                    value={effectiveDetailPropertyId}
                    onChange={(event) => setSelectedDetailPropertyId(event.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="portfolio">Portfolio summary</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.address}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
                    End date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <MetricCard
                icon={<TrendingUp size={16} />}
                label="Filtered Income"
                value={formatCurrency(filteredSummary.income)}
                valueClassName="text-[#0F6E56]"
              />
              <MetricCard
                icon={<TrendingDown size={16} />}
                label="Filtered Expenses"
                value={formatCurrency(filteredSummary.expenses)}
                valueClassName="text-[#A32D2D]"
              />
              <MetricCard
                icon={<DollarSign size={16} />}
                label="Filtered Net"
                value={formatCurrency(filteredSummary.net)}
                valueClassName={filteredSummary.net >= 0 ? 'text-[#0F6E56]' : 'text-[#A32D2D]'}
              />
            </div>

            {filteredTransactions.length === 0 ? (
              <EmptyState
                icon={<Calendar size={20} className="text-gray-300" />}
                title="No transactions found"
                description="Adjust the property or date filters, or add a new transaction."
              />
            ) : (
              <div className="space-y-3">
                {filteredTransactions.map((transaction) => {
                  const property = propertyMap[String(transaction.property_id)]

                  return (
                    <div
                      key={transaction.id}
                      className="rounded-[16px] border border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] px-[22px] py-[18px]"
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center rounded-[20px] px-[10px] py-[3px] text-[10px] font-medium ${
                                transaction.type === 'income'
                                  ? 'bg-[#E1F5EE] text-[#085041]'
                                  : 'bg-[#FCEBEB] text-[#791F1F]'
                              }`}
                            >
                              {transaction.type}
                            </span>
                            <span className="text-sm font-semibold text-gray-900">
                              {transaction.category}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3">
                            <Field
                              label="Property"
                              value={property?.address || 'Unknown property'}
                            />
                            <Field
                              label="Date"
                              value={new Date(transaction.date).toLocaleDateString('en-AU')}
                            />
                            <Field
                              label="Description"
                              value={transaction.description || '—'}
                            />
                            <Field
                              label="Amount"
                              value={
                                <TransactionAmount
                                  amount={transaction.amount}
                                  type={transaction.type}
                                  frequency={transaction.frequency}
                                />
                              }
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 shrink-0">
                          <button
                            onClick={() =>
                              setEditingTransaction({
                                ...transaction,
                                propertyUse: property?.property_use,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium"
                            type="button"
                          >
                            <Pencil size={14} />
                            Edit
                          </button>

                          <button
                            onClick={() => handleDeleteTransaction(transaction.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-[#A32D2D] hover:bg-gray-50"
                            type="button"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      {cashFlowPropertyId && (
        <CashFlowModal
          propertyId={cashFlowPropertyId}
          properties={properties}
          onClose={() => setCashFlowPropertyId(null)}
          onSave={handlePortfolioSave}
        />
      )}

      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          propertyUse={editingTransaction.propertyUse}
          onClose={() => setEditingTransaction(null)}
          onSave={handlePortfolioSave}
        />
      )}
    </div>
  )
}

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  const income = payload.find((item) => item.dataKey === 'income')?.value || 0
  const expenses = payload.find((item) => item.dataKey === 'expenses')?.value || 0
  const net = income - expenses

  return (
    <div className="rounded-[16px] border border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] p-3 text-xs shadow-lg">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      <p className="text-[#0F6E56]">Income: {formatCurrency(income)}</p>
      <p className="text-[#A32D2D]">Expenses: {formatCurrency(expenses)}</p>
      <p className={`mt-1 font-semibold ${net >= 0 ? 'text-[#0F6E56]' : 'text-[#A32D2D]'}`}>
        Net: {formatCurrency(net)}
      </p>
    </div>
  )
}

function MetricCard({ icon, label, value, valueClassName = 'text-gray-900' }) {
  return (
    <div className="rounded-[16px] border border-[rgba(0,0,0,0.08)] bg-[var(--color-background-primary)] px-[22px] py-[18px]">
      <div className="flex items-center gap-2 text-gray-400 mb-3">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">{label}</span>
      </div>
      <p className={`text-[26px] font-medium tracking-[-0.5px] ${valueClassName}`}>{value}</p>
    </div>
  )
}

function Field({ label, value, valueClassName = 'text-gray-900' }) {
  return (
    <div>
      <p className="text-[11px] leading-[1.5] text-[var(--color-text-tertiary)]">{label}</p>
      <div className={`mt-1 break-words text-[13px] font-normal leading-[1.6] ${valueClassName}`}>{value}</div>
    </div>
  )
}

function TransactionAmount({ amount, type, frequency }) {
  const signedAmount = `${type === 'income' ? '+' : '-'}${formatCurrency(Math.abs(amount))}`
  const normalizedFrequency = String(frequency || '').trim().toLowerCase()
  const frequencyLabel = normalizedFrequency
    ? `${normalizedFrequency.charAt(0).toUpperCase()}${normalizedFrequency.slice(1)}`
    : ''
  const monthlyEquivalent = normalizedFrequency
    ? getMonthlyAmount(Math.abs(amount), normalizedFrequency)
    : null
  const toneClass = type === 'income' ? 'text-[#0F6E56]' : 'text-[#A32D2D]'
  const secondaryToneClass = type === 'income' ? 'text-[#0F6E56]/80' : 'text-[#A32D2D]/80'

  return (
    <div className="space-y-0.5">
      <p className={toneClass}>{signedAmount}</p>
      {frequencyLabel ? (
        <p className="text-xs text-gray-400">{frequencyLabel}</p>
      ) : null}
      {monthlyEquivalent !== null && normalizedFrequency !== 'monthly' ? (
        <p className={`text-xs ${secondaryToneClass}`}>
          ≈ {formatCurrency(monthlyEquivalent)} / month
        </p>
      ) : null}
    </div>
  )
}

function EmptyState({ icon, title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center">
      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
        {icon}
      </div>
      <p className="text-[15px] font-medium text-[var(--color-text-primary)]">{title}</p>
      <p className="mt-1 text-[13px] font-normal leading-[1.6] text-[var(--color-text-secondary)]">{description}</p>
    </div>
  )
}
