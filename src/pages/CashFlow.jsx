import { useMemo, useState } from 'react'
import {
  DollarSign,
  Search,
  TrendingUp,
  TrendingDown,
  Calendar,
  Building2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  AlertTriangle,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Pencil,
  Trash2,
} from 'lucide-react'
import { supabase } from '../supabase'
import usePortfolioData from '../hooks/usePortfolioData'
import CashFlowModal from '../components/CashFlowModal'
import EditTransactionModal from '../components/EditTransactionModal'
import OptimisationModal from '../components/OptimisationModal'

const toMonthly = (amount, frequency) => {
  const map = {
    Weekly: 52 / 12,
    Fortnightly: 26 / 12,
    Monthly: 1,
    Quarterly: 1 / 3,
    Annual: 1 / 12,
  }
  return Number(amount || 0) * (map[frequency] || 1)
}

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))

export default function CashFlow() {
  const { properties, transactions, loading, fetchData } = usePortfolioData()

  const [cashFlowPropertyId, setCashFlowPropertyId] = useState(null)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [expandedProperties, setExpandedProperties] = useState(new Set())
  const [showOptimisationModal, setShowOptimisationModal] = useState(false)

  const currentMonthDefault = new Date().toISOString().slice(0, 7)

  const [searchTerm, setSearchTerm] = useState('')
  const [propertyFilter, setPropertyFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState(currentMonthDefault)

  const propertyMap = useMemo(
    () => Object.fromEntries(properties.map((p) => [String(p.id), p])),
    [properties]
  )

  const monthOptions = useMemo(() => {
    const months = [
      ...new Set(
        transactions.map((t) => String(t.date || '').slice(0, 7)).filter(Boolean)
      ),
    ]
    return months.sort((a, b) => b.localeCompare(a))
  }, [transactions])

  const filteredTransactions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()

    return transactions
      .filter((txn) => {
        const property = propertyMap[String(txn.property_id)]

        const matchesSearch =
          q === '' ||
          [
            txn.category,
            txn.description,
            property?.address,
            property?.suburb,
            property?.state,
          ]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))

        const matchesProperty =
          propertyFilter === 'all' ||
          String(txn.property_id) === String(propertyFilter)

        const matchesType = typeFilter === 'all' || txn.type === typeFilter

        const matchesMonth =
          monthFilter === 'all' || String(txn.date).slice(0, 7) === monthFilter

        return matchesSearch && matchesProperty && matchesType && matchesMonth
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [transactions, propertyMap, searchTerm, propertyFilter, typeFilter, monthFilter])

  const metrics = useMemo(() => {
    const income = filteredTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + toMonthly(t.amount, t.frequency), 0)

    const expenses = filteredTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + toMonthly(t.amount, t.frequency), 0)

    return {
      income,
      expenses,
      net: income - expenses,
    }
  }, [filteredTransactions])

  const propertySummaries = useMemo(() => {
    const grouped = new Map()

    filteredTransactions.forEach((txn) => {
      const propertyId = String(txn.property_id)
      const property = propertyMap[propertyId]

      if (!grouped.has(propertyId)) {
        grouped.set(propertyId, {
          propertyId,
          property,
          income: 0,
          expenses: 0,
          transactionCount: 0,
          latestDate: txn.date,
          transactions: [],
        })
      }

      const entry = grouped.get(propertyId)
      const monthlyAmount = toMonthly(txn.amount, txn.frequency)

      if (txn.type === 'income') entry.income += monthlyAmount
      else entry.expenses += monthlyAmount

      entry.transactionCount += 1
      entry.transactions.push(txn)

      if (new Date(txn.date) > new Date(entry.latestDate)) {
        entry.latestDate = txn.date
      }
    })

    return Array.from(grouped.values())
      .map((entry) => ({
        ...entry,
        net: entry.income - entry.expenses,
        transactions: entry.transactions.sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        ),
      }))
      .sort((a, b) => {
        const aAddress = a.property?.address || ''
        const bAddress = b.property?.address || ''
        return aAddress.localeCompare(bAddress)
      })
  }, [filteredTransactions, propertyMap])

  const latestActivity = useMemo(
    () => filteredTransactions.slice(0, 6),
    [filteredTransactions]
  )

  const aiInsights = useMemo(() => {
    if (!propertySummaries.length) return []

    const insights = []

    const worst = [...propertySummaries].sort((a, b) => a.net - b.net)[0]
    const best = [...propertySummaries].sort((a, b) => b.net - a.net)[0]

    if (worst && worst.net < 0) {
      insights.push({
        type: 'negative',
        text: `${worst.property?.address || 'One property'} is negative ${formatCurrency(
          worst.net
        )}. Review mortgage structure or recurring costs.`,
      })
    }

    if (best && best.net > 0) {
      insights.push({
        type: 'positive',
        text: `${best.property?.address || 'One property'} is your strongest performer at ${formatCurrency(
          best.net
        )}.`,
      })
    }

    const totalIncome = propertySummaries.reduce((sum, s) => sum + s.income, 0)
    const topIncome = [...propertySummaries].sort((a, b) => b.income - a.income)[0]

    if (topIncome && totalIncome > 0) {
      const share = Math.round((topIncome.income / totalIncome) * 100)
      if (share >= 70) {
        insights.push({
          type: 'warning',
          text: `${share}% of income comes from ${
            topIncome.property?.address || 'one property'
          }. This creates income concentration risk.`,
        })
      }
    }

    if (metrics.net < 0) {
      insights.push({
        type: 'negative',
        text: `Portfolio cash flow is negative ${formatCurrency(
          metrics.net
        )} for the selected filters.`,
      })
    }

    const noIncomeProperties = propertySummaries.filter(
      (p) => p.income === 0 && p.expenses > 0
    )
    if (noIncomeProperties.length > 0) {
      insights.push({
        type: 'warning',
        text: `${noIncomeProperties.length} propert${
          noIncomeProperties.length === 1 ? 'y has' : 'ies have'
        } expenses recorded but no income in this period.`,
      })
    }

    return insights.slice(0, 4)
  }, [propertySummaries, metrics.net])

  const optimisationActions = useMemo(() => {
    const actions = []

    const negativeProperties = propertySummaries.filter((p) => p.net < 0)
    const expenseOnlyProperties = propertySummaries.filter(
      (p) => p.income === 0 && p.expenses > 0
    )

    if (negativeProperties.length > 0) {
      const worst = [...negativeProperties].sort((a, b) => a.net - b.net)[0]

      actions.push({
        icon: 'cashflow',
        title: 'Review weakest cash-flow property',
        description: `${worst.property?.address || 'Property'} is currently the weakest performer at ${formatCurrency(
          worst.net
        )}.`,
        tone: { bg: 'bg-red-50', text: 'text-red-500' },
        onClick: () => {
          setExpandedProperties((prev) => {
            const next = new Set(prev)
            next.add(worst.propertyId)
            return next
          })
          setShowOptimisationModal(false)
        },
      })
    }

    if (expenseOnlyProperties.length > 0) {
      const target = expenseOnlyProperties[0]
      actions.push({
        icon: 'risk',
        title: 'Inspect properties with expenses but no income',
        description: `${target.property?.address || 'A property'} has expenses recorded without income in the selected period.`,
        tone: { bg: 'bg-amber-50', text: 'text-amber-600' },
        onClick: () => {
          setExpandedProperties((prev) => {
            const next = new Set(prev)
            next.add(target.propertyId)
            return next
          })
          setShowOptimisationModal(false)
        },
      })
    }

    if (propertySummaries.length > 0) {
      const best = [...propertySummaries].sort((a, b) => b.net - a.net)[0]
      actions.push({
        icon: 'property',
        title: 'Review strongest performer',
        description: `${best.property?.address || 'Property'} is your strongest cash-flow asset at ${formatCurrency(
          best.net
        )}.`,
        tone: { bg: 'bg-green-50', text: 'text-green-600' },
        onClick: () => {
          setExpandedProperties((prev) => {
            const next = new Set(prev)
            next.add(best.propertyId)
            return next
          })
          setShowOptimisationModal(false)
        },
      })
    }

    return actions.slice(0, 4)
  }, [propertySummaries])

  const toggleProperty = (propertyId) => {
    setExpandedProperties((prev) => {
      const next = new Set(prev)
      if (next.has(propertyId)) next.delete(propertyId)
      else next.add(propertyId)
      return next
    })
  }

  const handleDeleteTransaction = async (txnId) => {
    if (!window.confirm('Delete this transaction?')) return
    await supabase.from('transactions').delete().eq('id', txnId)
    fetchData()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading cash flow...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 py-8">
        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-6 md:p-8 border-b border-gray-100">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                  Cash Flow
                </h1>
                <p className="text-gray-500 mt-2 max-w-2xl">
                  Portfolio-wide cash flow workspace. Review property performance
                  first, then inspect transaction-level detail only when needed.
                </p>
              </div>

              <button
                onClick={() => setCashFlowPropertyId(properties[0]?.id || null)}
                disabled={properties.length === 0}
                className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
              >
                <DollarSign size={16} />
                Add Transaction
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 md:p-8 bg-gray-50/70">
            <MetricCard
              icon={<TrendingUp size={16} />}
              label="Income"
              value={formatCurrency(metrics.income)}
              valueClassName="text-green-600"
            />
            <MetricCard
              icon={<TrendingDown size={16} />}
              label="Expenses"
              value={formatCurrency(metrics.expenses)}
              valueClassName="text-red-500"
            />
            <MetricCard
              icon={<DollarSign size={16} />}
              label="Net"
              value={formatCurrency(metrics.net)}
              valueClassName={metrics.net >= 0 ? 'text-green-600' : 'text-red-500'}
            />
          </div>
        </section>

        <section className="mt-6 bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-4">
                <label className="block text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
                  Search
                </label>
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search category, note, or address"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="lg:col-span-3">
                <label className="block text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
                  Property
                </label>
                <select
                  value={propertyFilter}
                  onChange={(e) => setPropertyFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Properties</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.address}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="block text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
                  Type
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Types</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>

              <div className="lg:col-span-3">
                <label className="block text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
                  Month
                </label>
                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Months</option>
                  {monthOptions.map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {propertySummaries.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="mx-auto text-gray-300 mb-3" size={26} />
              <h3 className="text-lg font-semibold text-gray-900">
                No transactions found
              </h3>
              <p className="text-sm text-gray-500 mt-2">
                Try changing filters or add a new transaction.
              </p>
            </div>
          ) : (
            <>
              <div className="p-6 border-b border-gray-100 bg-gray-50/40">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Property Performance
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Grouped portfolio cash flow by property.
                    </p>
                  </div>

                  <button
                    onClick={() => setShowOptimisationModal(true)}
                    className="text-sm text-primary-600 font-medium hover:underline"
                    type="button"
                  >
                    Explore optimisation options →
                  </button>
                </div>

                <div className="space-y-4">
                  {propertySummaries.map((entry) => {
                    const isExpanded = expandedProperties.has(entry.propertyId)

                    return (
                      <div
                        key={entry.propertyId}
                        className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
                      >
                        <div className="p-5">
                          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Building2 size={16} className="text-gray-400" />
                                <h3 className="font-semibold text-gray-900 truncate">
                                  {entry.property?.address || 'Unknown property'}
                                </h3>
                              </div>

                              <p className="text-sm text-gray-500 mt-1">
                                {entry.property?.suburb && entry.property?.state
                                  ? `${entry.property.suburb}, ${entry.property.state}`
                                  : 'No suburb/state available'}
                              </p>

                              <p className="text-xs text-gray-400 mt-4">
                                Latest activity:{' '}
                                {entry.latestDate
                                  ? new Date(entry.latestDate).toLocaleDateString('en-AU')
                                  : '—'}
                              </p>
                            </div>

                            <div className="flex flex-col items-stretch xl:items-end gap-4 xl:min-w-[560px]">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                                <MiniStat
                                  label="Income"
                                  value={formatCurrency(entry.income)}
                                  valueClassName="text-green-600"
                                />
                                <MiniStat
                                  label="Expenses"
                                  value={formatCurrency(entry.expenses)}
                                  valueClassName="text-red-500"
                                />
                                <MiniStat
                                  label="Net"
                                  value={formatCurrency(entry.net)}
                                  valueClassName={
                                    entry.net >= 0 ? 'text-green-600' : 'text-red-500'
                                  }
                                />
                                <MiniStat label="Entries" value={entry.transactionCount} />
                              </div>

                              <button
                                onClick={() => toggleProperty(entry.propertyId)}
                                className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 self-end"
                              >
                                {isExpanded ? 'Hide entries' : 'View entries'}
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-gray-100 p-4 md:p-5 bg-white">
                            <div className="space-y-3">
                              {entry.transactions.map((txn) => (
                                <div
                                  key={txn.id}
                                  className="rounded-2xl border border-gray-100 p-4"
                                >
                                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span
                                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                                            txn.type === 'income'
                                              ? 'bg-green-50 text-green-700'
                                              : 'bg-red-50 text-red-700'
                                          }`}
                                        >
                                          {txn.type}
                                        </span>
                                        <span className="text-sm font-semibold text-gray-900">
                                          {txn.category}
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                                        <Field
                                          label="Date"
                                          value={new Date(txn.date).toLocaleDateString('en-AU')}
                                        />
                                        <Field
                                          label="Description"
                                          value={txn.description || '—'}
                                        />
                                        <Field
                                          label="Amount"
                                          value={`${txn.type === 'income' ? '+' : '-'}${formatCurrency(
                                            Math.abs(txn.amount)
                                          )}`}
                                          valueClassName={
                                            txn.type === 'income'
                                              ? 'text-green-600'
                                              : 'text-red-500'
                                          }
                                        />
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-2 shrink-0">
                                      <button
                                        onClick={() =>
                                          setEditingTransaction({
                                            ...txn,
                                            propertyUse: entry.property?.property_use,
                                          })
                                        }
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium"
                                        type="button"
                                      >
                                        <Pencil size={14} />
                                        Edit
                                      </button>

                                      <button
                                        onClick={() => handleDeleteTransaction(txn.id)}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-red-500 hover:bg-gray-50 text-sm font-medium"
                                        type="button"
                                      >
                                        <Trash2 size={14} />
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="bg-white border border-gray-100 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Lightbulb className="text-primary-600" size={18} />
                      <h3 className="font-semibold text-gray-900">AI Insights</h3>
                    </div>

                    <div className="space-y-3">
                      {aiInsights.length === 0 ? (
                        <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                          No insights available for the selected filters yet.
                        </div>
                      ) : (
                        aiInsights.map((insight, i) => (
                          <InsightItem key={i} insight={insight} />
                        ))
                      )}
                    </div>
                  </div>

                  <div className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Activity size={18} className="text-gray-500" />
                      <h3 className="font-semibold text-gray-900">
                        Latest Activity
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {latestActivity.length === 0 ? (
                        <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                          No recent activity for the selected filters.
                        </div>
                      ) : (
                        latestActivity.map((txn) => {
                          const property = propertyMap[String(txn.property_id)]

                          return (
                            <div
                              key={txn.id}
                              className="flex items-center gap-3 rounded-xl border border-gray-100 p-3"
                            >
                              <div
                                className={`p-2 rounded-lg ${
                                  txn.type === 'income'
                                    ? 'bg-green-50 text-green-600'
                                    : 'bg-red-50 text-red-500'
                                }`}
                              >
                                {txn.type === 'income' ? (
                                  <ArrowUpRight size={14} />
                                ) : (
                                  <ArrowDownRight size={14} />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-gray-700">
                                  <span className="font-medium">{txn.category}</span> —{' '}
                                  {property?.address || 'Unknown property'}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {new Date(txn.date).toLocaleDateString('en-AU')}
                                </p>
                              </div>

                              <div
                                className={`text-sm font-semibold whitespace-nowrap ${
                                  txn.type === 'income'
                                    ? 'text-green-600'
                                    : 'text-red-500'
                                }`}
                              >
                                {txn.type === 'income' ? '+' : '-'}
                                {formatCurrency(Math.abs(txn.amount))}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </main>

      {cashFlowPropertyId && (
        <CashFlowModal
          propertyId={cashFlowPropertyId}
          properties={properties}
          onClose={() => setCashFlowPropertyId(null)}
          onSave={fetchData}
        />
      )}

      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          propertyUse={editingTransaction.propertyUse}
          onClose={() => setEditingTransaction(null)}
          onSave={fetchData}
        />
      )}

      {showOptimisationModal && (
        <OptimisationModal
          title="Portfolio Optimisation Options"
          subtitle="Recommended next actions based on filtered cash flow performance."
          actions={optimisationActions}
          onClose={() => setShowOptimisationModal(false)}
        />
      )}
    </div>
  )
}

function MetricCard({ icon, label, value, valueClassName = 'text-gray-900' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 text-gray-400 mb-3">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-xl md:text-2xl font-bold ${valueClassName}`}>{value}</p>
    </div>
  )
}

function MiniStat({ label, value, valueClassName = 'text-gray-900' }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-sm font-semibold mt-1 ${valueClassName}`}>{value}</p>
    </div>
  )
}

function InsightItem({ insight }) {
  const config = {
    positive: {
      icon: <TrendingUp size={14} />,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    negative: {
      icon: <TrendingDown size={14} />,
      color: 'text-red-500',
      bg: 'bg-red-50',
    },
    warning: {
      icon: <AlertTriangle size={14} />,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  }

  const c = config[insight.type] || config.warning

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl ${c.bg}`}>
      <div className={`${c.color} mt-0.5`}>{c.icon}</div>
      <p className="text-sm text-gray-700">{insight.text}</p>
    </div>
  )
}

function Field({ label, value, valueClassName = 'text-gray-900' }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-sm font-medium mt-1 break-words ${valueClassName}`}>{value}</p>
    </div>
  )
}