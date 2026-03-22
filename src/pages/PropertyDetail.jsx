import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Home,
  MapPin,
  Pencil,
  CreditCard,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Calendar,
  Trash2,
} from 'lucide-react'

import { supabase } from '../supabase'
import usePortfolioData from '../hooks/usePortfolioData'
import AIScorePanel from '../components/AIScorePanel'
import AddLoanModal from '../components/AddLoanModal'
import EditPropertyModal from '../components/EditPropertyModal'
import EditLoanModal from '../components/EditLoanModal'
import CashFlowModal from '../components/CashFlowModal'
import EditTransactionModal from '../components/EditTransactionModal'
import RefinanceModal from '../components/RefinanceModal'

const toMonthly = (amount, frequency) => {
  const map = {
    Weekly: 52 / 12,
    Fortnightly: 26 / 12,
    Monthly: 1,
    Quarterly: 1 / 3,
    Annual: 1 / 12,
  }
  return Number(amount) * (map[frequency] || 1)
}

const formatFrequency = (f) => {
  const map = {
    Weekly: 'wk',
    Fortnightly: 'fn',
    Monthly: 'mo',
    Quarterly: 'qtr',
    Annual: 'yr',
  }
  return map[f] || 'mo'
}

export default function PropertyDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { properties, loans, transactions, loading, fetchData } = usePortfolioData()

  const [session, setSession] = useState(null)
  const [editingProperty, setEditingProperty] = useState(null)
  const [showAddLoan, setShowAddLoan] = useState(false)
  const [editingLoan, setEditingLoan] = useState(null)
  const [cashFlowPropertyId, setCashFlowPropertyId] = useState(null)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [refinancingLoan, setRefinancingLoan] = useState(null)

  useEffect(() => {
    const initialiseSession = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      setSession(currentSession || null)
    }

    initialiseSession()
  }, [])

  const property = useMemo(
    () => properties.find((p) => String(p.id) === String(id)),
    [properties, id]
  )

  const propertyLoans = useMemo(
    () => loans.filter((l) => String(l.property_id) === String(id)),
    [loans, id]
  )

  const propertyTransactions = useMemo(
    () => transactions.filter((t) => String(t.property_id) === String(id)),
    [transactions, id]
  )

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0)

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const thisMonthTxns = propertyTransactions.filter((t) => {
    const d = new Date(t.date)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  })

  const sortedTransactions = [...propertyTransactions].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'income' ? -1 : 1
    return new Date(b.date) - new Date(a.date)
  })

  const debt = propertyLoans.reduce(
    (sum, loan) => sum + Number(loan.current_balance || 0),
    0
  )

  const currentValue = Number(property?.current_value || 0)
  const purchasePrice = Number(property?.purchase_price || 0)
  const equity = currentValue - debt
  const growth = currentValue - purchasePrice

  const lvr =
    currentValue > 0 ? ((debt / currentValue) * 100).toFixed(1) : '0.0'

  const growthPct =
    purchasePrice > 0 ? ((growth / purchasePrice) * 100).toFixed(1) : '0.0'

  const monthlyIncome = thisMonthTxns
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + toMonthly(t.amount, t.frequency), 0)

  const monthlyExpenses = thisMonthTxns
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + toMonthly(t.amount, t.frequency), 0)

  const monthlyNet = monthlyIncome - monthlyExpenses

  const allIncome = propertyTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + toMonthly(t.amount, t.frequency), 0)

  const allExpenses = propertyTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + toMonthly(t.amount, t.frequency), 0)

  const uniqueMonths =
    [...new Set(propertyTransactions.map((t) => String(t.date).slice(0, 7)))]
      .length || 1

  const annualGrossIncome = (allIncome / uniqueMonths) * 12
  const annualNetIncome = ((allIncome - allExpenses) / uniqueMonths) * 12

  const grossYield =
    currentValue > 0 ? ((annualGrossIncome / currentValue) * 100).toFixed(2) : null

  const netYield =
    currentValue > 0 ? ((annualNetIncome / currentValue) * 100).toFixed(2) : null

  const getDaysUntilExpiry = (dateStr) => {
    if (!dateStr) return null
    return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
  }

  const getExpiryBadge = (days) => {
    if (days <= 30) {
      return { bg: 'bg-red-100', text: 'text-red-700', label: `${days}d left` }
    }
    if (days <= 60) {
      return {
        bg: 'bg-orange-100',
        text: 'text-orange-700',
        label: `${days}d left`,
      }
    }
    return {
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      label: `${days}d left`,
    }
  }

  const handleDeleteTransaction = async (txnId) => {
    if (!window.confirm('Delete this transaction?')) return
    await supabase.from('transactions').delete().eq('id', txnId)
    fetchData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400">Loading property...</div>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10">
        <button
          onClick={() => navigate('/properties')}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Properties
        </button>

        <div className="mt-6 bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={24} className="text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Property not found</h1>
          <p className="text-gray-500 mt-2">
            The property you’re looking for could not be found.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate('/properties')}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Properties
      </button>

      <div className="mt-6 bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-6 md:p-8 border-b border-gray-100">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-primary-700 bg-primary-50 px-3 py-1 rounded-full">
                  <Home size={13} />
                  Property Detail
                </span>

                {property.property_use === 'owner_occupied' && (
                  <span className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-medium">
                    Owner Occupied
                  </span>
                )}
              </div>

              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                {property.address}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 mt-3">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} />
                  {property.suburb}, {property.state}
                </span>
                <span>{property.property_type}</span>
                {property.bedrooms ? <span>{property.bedrooms} bed</span> : null}
                {property.bathrooms ? <span>{property.bathrooms} bath</span> : null}
                {property.garages ? <span>{property.garages} garage</span> : null}
                {property.land_size ? <span>{property.land_size}m² land</span> : null}
              </div>

              <div className="mt-5">
                <p className="text-xs uppercase tracking-wide text-gray-400">
                  Current value
                </p>
                <div className="flex items-end gap-3 flex-wrap">
                  <p className="text-3xl font-bold text-gray-900">
                    {formatCurrency(property.current_value)}
                  </p>
                  <p
                    className={`text-sm font-medium ${
                      growth >= 0 ? 'text-green-600' : 'text-red-500'
                    }`}
                  >
                    {growth >= 0 ? '+' : ''}
                    {formatCurrency(growth)} ({growthPct}%)
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setCashFlowPropertyId(property.id)}
                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <DollarSign size={16} />
                Add Transaction
              </button>

              <button
                onClick={() => setShowAddLoan(true)}
                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <CreditCard size={16} />
                Add Mortgage
              </button>

              <button
                onClick={() => setEditingProperty(property)}
                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors"
              >
                <Pencil size={16} />
                Edit Property
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 md:p-8 bg-gray-50/70 border-b border-gray-100">
          <MetricCard
            label="Equity"
            value={formatCurrency(equity)}
            valueClassName={equity >= 0 ? 'text-green-600' : 'text-red-500'}
          />
          <MetricCard
            label="Debt"
            value={formatCurrency(debt)}
          />
          <MetricCard
            label="LVR"
            value={`${lvr}%`}
          />
          <MetricCard
            label="Net Yield"
            value={netYield ? `${netYield}%` : '—'}
            valueClassName={
              netYield && Number(netYield) >= 0 ? 'text-green-600' : 'text-gray-900'
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        <div className="xl:col-span-2 space-y-6">
          <section className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Cash Flow
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {now.toLocaleString('en-AU', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>

              <button
                onClick={() => setCashFlowPropertyId(property.id)}
                className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                Add transaction
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SoftMetricCard
                label="Income this month"
                value={formatCurrency(monthlyIncome)}
                valueClassName="text-green-600"
              />
              <SoftMetricCard
                label="Expenses this month"
                value={formatCurrency(monthlyExpenses)}
                valueClassName="text-red-500"
              />
              <SoftMetricCard
                label="Net this month"
                value={formatCurrency(monthlyNet)}
                valueClassName={monthlyNet >= 0 ? 'text-green-600' : 'text-red-500'}
              />
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-100 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">
                  Yield Snapshot
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Gross yield</span>
                    <span className="font-medium text-gray-900">
                      {grossYield ? `${grossYield}%` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Net yield</span>
                    <span
                      className={`font-medium ${
                        netYield && Number(netYield) >= 0
                          ? 'text-green-600'
                          : 'text-gray-900'
                      }`}
                    >
                      {netYield ? `${netYield}%` : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">
                  Transaction Volume
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Total entries</span>
                    <span className="font-medium text-gray-900">
                      {propertyTransactions.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Months tracked</span>
                    <span className="font-medium text-gray-900">
                      {uniqueMonths}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-4 mb-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  Transaction History
                </h3>
              </div>

              {sortedTransactions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 p-6 text-sm text-gray-400 italic">
                  No transactions yet. Add your first transaction to start tracking this property properly.
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedTransactions.map((txn) => (
                    <div
                      key={txn.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              txn.type === 'income' ? 'bg-green-500' : 'bg-red-400'
                            }`}
                          />
                          <p className="text-sm font-medium text-gray-900">
                            {txn.category}
                          </p>
                          {txn.description ? (
                            <p className="text-sm text-gray-400 truncate">
                              · {txn.description}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-3 flex-wrap mt-1 text-xs text-gray-400">
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={12} />
                            {new Date(txn.date).toLocaleDateString('en-AU', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                          <span>
                            /{formatFrequency(txn.frequency || 'Monthly')}
                          </span>
                          {txn.frequency && txn.frequency !== 'Monthly' ? (
                            <span>
                              ≈ {formatCurrency(toMonthly(txn.amount, txn.frequency))}/mo
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p
                            className={`text-sm font-semibold ${
                              txn.type === 'income'
                                ? 'text-green-600'
                                : 'text-red-500'
                            }`}
                          >
                            {txn.type === 'income' ? '+' : '-'}
                            {formatCurrency(txn.amount)}
                          </p>
                        </div>

                        <button
                          onClick={() =>
                            setEditingTransaction({
                              ...txn,
                              propertyUse: property.property_use,
                            })
                          }
                          className="p-2 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-white transition-colors"
                          title="Edit transaction"
                        >
                          <Pencil size={15} />
                        </button>

                        <button
                          onClick={() => handleDeleteTransaction(txn.id)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-white transition-colors"
                          title="Delete transaction"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Mortgages
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Lending structure for this property
                </p>
              </div>

              <button
                onClick={() => setShowAddLoan(true)}
                className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                Add mortgage
              </button>
            </div>

            {propertyLoans.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-6 text-sm text-gray-400 italic">
                No mortgages added yet for this property.
              </div>
            ) : (
              <div className="space-y-3">
                {propertyLoans.map((loan) => {
                  const daysUntil = getDaysUntilExpiry(loan.fixed_rate_expiry)
                  const badge =
                    loan.loan_type === 'Fixed' &&
                    daysUntil !== null &&
                    daysUntil > 0
                      ? getExpiryBadge(daysUntil)
                      : null

                  return (
                    <div
                      key={loan.id}
                      className="rounded-xl border border-gray-100 p-4"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900">
                              {loan.lender}
                            </p>
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                              {loan.loan_type}
                            </span>
                            <span className="text-xs text-gray-500">
                              {loan.interest_rate}%
                            </span>
                            {badge && (
                              <span
                                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}
                              >
                                {badge.label}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm text-gray-500">
                            <span>Balance {formatCurrency(loan.current_balance)}</span>
                            {loan.fixed_rate_expiry ? (
                              <span>
                                Fixed until{' '}
                                {new Date(loan.fixed_rate_expiry).toLocaleDateString(
                                  'en-AU',
                                  { month: 'short', year: 'numeric' }
                                )}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setRefinancingLoan({ loan, property })}
                            className="px-3 py-2 text-xs font-medium rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors"
                          >
                            Refinance
                          </button>
                          <button
                            onClick={() => setEditingLoan(loan)}
                            className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={18} className="text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">AI Insights</h2>
            </div>

            <AIScorePanel
              property={property}
              loans={propertyLoans}
              transactions={propertyTransactions}
            />
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Property Snapshot
            </h2>

            <div className="space-y-3 text-sm">
              <SnapshotRow label="Purchase Price" value={formatCurrency(property.purchase_price)} />
              <SnapshotRow label="Current Value" value={formatCurrency(property.current_value)} />
              <SnapshotRow label="Equity" value={formatCurrency(equity)} />
              <SnapshotRow label="Debt" value={formatCurrency(debt)} />
              <SnapshotRow label="LVR" value={`${lvr}%`} />
              <SnapshotRow label="Growth" value={`${formatCurrency(growth)} (${growthPct}%)`} />
              <SnapshotRow label="Gross Yield" value={grossYield ? `${grossYield}%` : '—'} />
              <SnapshotRow label="Net Yield" value={netYield ? `${netYield}%` : '—'} />
            </div>
          </section>
        </div>
      </div>

      {showAddLoan && session?.user?.id && (
        <AddLoanModal
          userId={session.user.id}
          properties={properties}
          preselectedPropertyId={property.id}
          onClose={() => setShowAddLoan(false)}
          onSave={fetchData}
        />
      )}

      {editingProperty && session?.user?.id && (
        <EditPropertyModal
          property={editingProperty}
          userId={session.user.id}
          onClose={() => setEditingProperty(null)}
          onSave={fetchData}
        />
      )}

      {editingLoan && (
        <EditLoanModal
          loan={editingLoan}
          onClose={() => setEditingLoan(null)}
          onSave={fetchData}
        />
      )}

      {cashFlowPropertyId && session?.user?.id && (
        <CashFlowModal
          userId={session.user.id}
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

      {refinancingLoan && (
        <RefinanceModal
          loan={refinancingLoan.loan}
          property={refinancingLoan.property}
          onClose={() => setRefinancingLoan(null)}
        />
      )}
    </div>
  )
}

function MetricCard({ label, value, valueClassName = 'text-gray-900' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className={`text-2xl font-bold ${valueClassName}`}>{value}</p>
    </div>
  )
}

function SoftMetricCard({ label, value, valueClassName = 'text-gray-900' }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className={`text-xl font-bold ${valueClassName}`}>{value}</p>
    </div>
  )
}

function SnapshotRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value}</span>
    </div>
  )
}