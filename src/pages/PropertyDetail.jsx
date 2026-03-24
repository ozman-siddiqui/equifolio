import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Bath,
  BedDouble,
  CarFront,
  Home,
  DollarSign,
  CreditCard,
  Pencil,
  Plus,
  Ruler,
  TrendingUp,
  TrendingDown,
  Building2,
  Lightbulb,
  AlertTriangle,
  Trash2,
  Calendar,
} from 'lucide-react'
import { supabase } from '../supabase'

import useFinancialData from '../hooks/useFinancialData'
import usePortfolioData from '../hooks/usePortfolioData'
import AddLoanModal from '../components/AddLoanModal'
import EditLoanModal from '../components/EditLoanModal'
import EditPropertyModal from '../components/EditPropertyModal'
import CashFlowModal from '../components/CashFlowModal'
import EditTransactionModal from '../components/EditTransactionModal'
import RefinanceModal from '../components/RefinanceModal'
import AIScorePanel from '../components/AIScorePanel'
import BorrowingPowerCard from '../components/BorrowingPowerCard'
import OptimisationModal from '../components/OptimisationModal'
import buildBorrowingPowerAnalysis from '../lib/borrowingPowerEngine'
import {
  utilityPrimaryButtonClass,
  utilitySecondaryButtonClass,
} from '../components/CardPrimitives'

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

export default function PropertyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { properties, loans, transactions, loading, fetchData } = usePortfolioData()
  const { financialProfile, liabilities, loading: financialsLoading } = useFinancialData()

  const [showAddLoan, setShowAddLoan] = useState(false)
  const [editingLoan, setEditingLoan] = useState(null)
  const [editingProperty, setEditingProperty] = useState(null)
  const [cashFlowPropertyId, setCashFlowPropertyId] = useState(null)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [refinancingLoan, setRefinancingLoan] = useState(null)
  const [showOptimisationModal, setShowOptimisationModal] = useState(false)

  const cashFlowSectionRef = useRef(null)
  const mortgageSectionRef = useRef(null)

  const property = properties.find((p) => String(p.id) === String(id))

  const propertyLoans = useMemo(() => {
    return loans.filter((l) => String(l.property_id) === String(id))
  }, [loans, id])

  const propertyTransactions = useMemo(() => {
    return transactions
      .filter((t) => String(t.property_id) === String(id))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [transactions, id])

  const propertyFeatures = useMemo(() => getPropertyFeatures(property), [property])

  const metrics = useMemo(() => {
    if (!property) return null

    const currentValue = Number(property.current_value || 0)
    const purchasePrice = Number(property.purchase_price || 0)
    const debt = propertyLoans.reduce(
      (sum, loan) => sum + Number(loan.current_balance || 0),
      0
    )
    const equity = currentValue - debt
    const growth = currentValue - purchasePrice
    const growthPct =
      purchasePrice > 0 ? ((growth / purchasePrice) * 100).toFixed(1) : '0.0'
    const lvr =
      currentValue > 0 ? ((debt / currentValue) * 100).toFixed(1) : '0.0'

    const income = propertyTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + getMonthlyAmount(t.amount, t.frequency), 0)

    const expenses = propertyTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + getMonthlyAmount(t.amount, t.frequency), 0)

    const net = income - expenses

    const uniqueMonths =
      [...new Set(propertyTransactions.map((t) => String(t.date).slice(0, 7)))].length || 1

    const annualNetIncome = ((income - expenses) / uniqueMonths) * 12
    const annualGrossIncome = (income / uniqueMonths) * 12

    const netYield =
      currentValue > 0 ? ((annualNetIncome / currentValue) * 100).toFixed(2) : '0.00'
    const grossYield =
      currentValue > 0 ? ((annualGrossIncome / currentValue) * 100).toFixed(2) : '0.00'

    return {
      currentValue,
      purchasePrice,
      debt,
      equity,
      growth,
      growthPct,
      lvr,
      income,
      expenses,
      net,
      grossYield,
      netYield,
    }
  }, [property, propertyLoans, propertyTransactions])

  const aiInsights = useMemo(() => {
    if (!property || !metrics) return []

    const insights = []

    if (metrics.net < 0) {
      insights.push({
        type: 'negative',
        text: `${property.address} is running at ${formatCurrency(
          metrics.net
        )} net cash flow.`,
      })
    } else if (metrics.net > 0) {
      insights.push({
        type: 'positive',
        text: `${property.address} is generating positive cash flow of ${formatCurrency(
          metrics.net
        )}.`,
      })
    }

    if (Number(metrics.lvr) >= 80) {
      insights.push({
        type: 'warning',
        text: `LVR is ${metrics.lvr}%, which may limit refinance flexibility or usable equity.`,
      })
    } else if (Number(metrics.lvr) <= 60 && metrics.debt > 0) {
      insights.push({
        type: 'positive',
        text: `LVR is ${metrics.lvr}%, which gives this property a relatively strong equity position.`,
      })
    }

    const noIncomeWithExpenses =
      metrics.income === 0 && metrics.expenses > 0 && propertyTransactions.length > 0

    if (noIncomeWithExpenses) {
      insights.push({
        type: 'warning',
        text: 'Expenses are being recorded without income in the current data set.',
      })
    }

    const fixedExpiringSoon = propertyLoans.find((loan) => {
      if (loan.loan_type !== 'Fixed' || !loan.fixed_rate_expiry) return false
      const days = getDaysUntilExpiry(loan.fixed_rate_expiry)
      return days > 0 && days <= 90
    })

    if (fixedExpiringSoon) {
      insights.push({
        type: 'warning',
        text: `${fixedExpiringSoon.lender} fixed rate is expiring soon. Refinance review should start now.`,
      })
    }

    return insights.slice(0, 4)
  }, [property, metrics, propertyTransactions.length, propertyLoans])

  const optimisationActions = useMemo(() => {
    if (!property || !metrics) return []

    const actions = []

    if (metrics.net < 0) {
      actions.push({
        icon: 'cashflow',
        title: 'Review transaction costs',
        description: `This property is negative ${formatCurrency(
          metrics.net
        )}. Review recurring expenses and operating entries.`,
        tone: { bg: 'bg-red-50', text: 'text-red-500' },
        onClick: () => {
          cashFlowSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          setShowOptimisationModal(false)
        },
      })
    }

    if (Number(metrics.lvr) >= 80) {
      actions.push({
        icon: 'mortgage',
        title: 'Review leverage and refinance options',
        description: `LVR is ${metrics.lvr}%, which may reduce flexibility for equity release or refinancing.`,
        tone: { bg: 'bg-amber-50', text: 'text-amber-600' },
        onClick: () => {
          mortgageSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          setShowOptimisationModal(false)
        },
      })
    }

    const fixedExpiringSoon = propertyLoans.find((loan) => {
      if (loan.loan_type !== 'Fixed' || !loan.fixed_rate_expiry) return false
      const days = getDaysUntilExpiry(loan.fixed_rate_expiry)
      return days > 0 && days <= 90
    })

    if (fixedExpiringSoon) {
      actions.push({
        icon: 'risk',
        title: 'Prioritise fixed-rate expiry review',
        description: `${fixedExpiringSoon.lender} fixed rate is expiring soon. Review refinance timing now.`,
        tone: { bg: 'bg-amber-50', text: 'text-amber-600' },
        onClick: () => {
          mortgageSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          setShowOptimisationModal(false)
        },
      })
    }

    if (metrics.net >= 0 && Number(metrics.lvr) < 70) {
      actions.push({
        icon: 'property',
        title: 'Maintain hold strategy',
        description: 'This property looks relatively balanced. Continue monthly monitoring and optimisation.',
        tone: { bg: 'bg-green-50', text: 'text-green-600' },
        onClick: () => {
          cashFlowSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          setShowOptimisationModal(false)
        },
      })
    }

    return actions.slice(0, 4)
  }, [property, metrics, propertyLoans])

  const borrowingPowerAnalysis = useMemo(
    () =>
      buildBorrowingPowerAnalysis({
        financialProfile,
        liabilities,
        loans: propertyLoans,
        transactions: propertyTransactions,
        propertyId: property?.id ?? null,
      }),
      [financialProfile, liabilities, property?.id, propertyLoans, propertyTransactions]
    )

  const handleDeleteTransaction = async (txnId) => {
    if (!window.confirm('Delete this transaction?')) return
    await supabase.from('transactions').delete().eq('id', txnId)
    fetchData()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading property...</div>
      </div>
    )
  }

  if (!property || !metrics) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center max-w-md w-full">
          <Home className="mx-auto text-gray-300 mb-4" size={28} />
          <h2 className="text-xl font-semibold text-gray-900">Property not found</h2>
          <p className="text-sm text-gray-500 mt-2">
            This property does not exist or could not be loaded.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-6 md:p-8">
            <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                    {property.address}
                  </h1>
                  {property.property_use === 'owner_occupied' && (
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                      Owner Occupied
                    </span>
                  )}
                </div>

                <p className="text-gray-500">
                  {property.suburb}, {property.state}
                  {property.property_type ? ` · ${property.property_type}` : ''}
                </p>

                {propertyFeatures.length > 0 ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
                    {propertyFeatures.map((feature) => {
                      const Icon = feature.icon

                      return (
                        <span
                          key={feature.label}
                          className="inline-flex items-center gap-1.5 text-sm text-gray-600"
                        >
                          <Icon size={14} className="text-gray-400" />
                          <span>{feature.label}</span>
                        </span>
                      )
                    })}
                  </div>
                ) : null}
              </div>

              <div className="flex gap-3 flex-wrap shrink-0 items-start">
                <button
                  onClick={() => setCashFlowPropertyId(property.id)}
                  className={utilityPrimaryButtonClass}
                >
                  <DollarSign size={15} className="shrink-0" />
                  <span className="whitespace-nowrap">Add Transaction</span>
                </button>
                <button
                  onClick={() => setShowAddLoan(true)}
                  className={utilitySecondaryButtonClass}
                >
                  <Plus size={15} className="shrink-0" />
                  <span className="whitespace-nowrap">Add Mortgage</span>
                </button>
                <button
                  onClick={() => setEditingProperty(property)}
                  className={utilitySecondaryButtonClass}
                >
                  <Pencil size={15} className="shrink-0" />
                  <span className="whitespace-nowrap">Edit Property</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-6 gap-4 mt-8">
              <Metric label="Current Value" value={formatCurrency(metrics.currentValue)} />
              <Metric label="Debt" value={formatCurrency(metrics.debt)} />
              <Metric
                label="Equity"
                value={formatCurrency(metrics.equity)}
                valueClassName={metrics.equity >= 0 ? 'text-green-600' : 'text-red-500'}
              />
              <Metric label="LVR" value={`${metrics.lvr}%`} />
              <Metric
                label="Growth"
                value={formatCurrency(metrics.growth)}
                valueClassName={metrics.growth >= 0 ? 'text-green-600' : 'text-red-500'}
              />
              <Metric
                label="Net Monthly"
                value={formatCurrency(metrics.net)}
                valueClassName={metrics.net >= 0 ? 'text-green-600' : 'text-red-500'}
              />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <div
              ref={cashFlowSectionRef}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Cash Flow</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Property-level operating activity and transaction management.
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

                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="text-sm px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-gray-700">
                    Gross Yield {metrics.grossYield}%
                  </span>
                  <span
                    className={`text-sm px-3 py-1.5 rounded-full border ${
                      Number(metrics.netYield) >= 0
                        ? 'bg-green-50 border-green-100 text-green-700'
                        : 'bg-red-50 border-red-100 text-red-600'
                    }`}
                  >
                    Net Yield {metrics.netYield}%
                  </span>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <MetricCardMini
                    icon={<TrendingUp size={16} />}
                    label="Income"
                    value={formatCurrency(metrics.income)}
                    valueClassName="text-green-600"
                  />
                  <MetricCardMini
                    icon={<TrendingDown size={16} />}
                    label="Expenses"
                    value={formatCurrency(metrics.expenses)}
                    valueClassName="text-red-500"
                  />
                  <MetricCardMini
                    icon={<DollarSign size={16} />}
                    label="Net"
                    value={formatCurrency(metrics.net)}
                    valueClassName={metrics.net >= 0 ? 'text-green-600' : 'text-red-500'}
                  />
                </div>

                {propertyTransactions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center">
                    <Calendar className="mx-auto text-gray-300 mb-3" size={24} />
                    <h3 className="text-sm font-semibold text-gray-900">No transactions yet</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Add rent, expenses, or other entries for this property.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {propertyTransactions.map((txn) => (
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
                                value={
                                  <TransactionAmount
                                    amount={txn.amount}
                                    type={txn.type}
                                    frequency={txn.frequency}
                                  />
                                }
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 shrink-0">
                            <button
                              onClick={() =>
                                setEditingTransaction({
                                  ...txn,
                                  propertyUse: property.property_use,
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
                )}
              </div>
            </div>

            <div
              ref={mortgageSectionRef}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Mortgages</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Property-specific debt structure and refinance actions.
                </p>
              </div>

              <div className="p-6">
                {propertyLoans.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center">
                    <CreditCard className="mx-auto text-gray-300 mb-3" size={24} />
                    <h3 className="text-sm font-semibold text-gray-900">No mortgages yet</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Add the loans attached to this property.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {propertyLoans.map((loan) => {
                      const daysUntil = getDaysUntilExpiry(loan.fixed_rate_expiry)

                      return (
                        <div
                          key={loan.id}
                          className="rounded-2xl border border-gray-100 p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
                        >
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-gray-900">{loan.lender}</p>
                              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                                {loan.loan_type}
                              </span>
                              <span className="text-sm text-gray-500">{loan.interest_rate}%</span>

                              {loan.loan_type === 'Fixed' &&
                                daysUntil &&
                                daysUntil <= 90 &&
                                daysUntil > 0 && (
                                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                                    <AlertTriangle size={12} />
                                    {daysUntil} days to expiry
                                  </span>
                                )}
                            </div>

                            <p className="text-sm text-gray-500 mt-1">
                              {loan.repayment_type}
                              {loan.fixed_rate_expiry
                                ? ` · Fixed until ${new Date(
                                    loan.fixed_rate_expiry
                                  ).toLocaleDateString('en-AU', {
                                    month: 'short',
                                    year: 'numeric',
                                  })}`
                                : ''}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="text-right">
                              <p className="text-xs text-gray-400">Balance</p>
                              <p className="font-semibold text-gray-900">
                                {formatCurrency(loan.current_balance)}
                              </p>
                            </div>

                            <button
                              onClick={() => setRefinancingLoan({ loan, property })}
                              className="px-3 py-2 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 text-sm font-medium"
                            >
                              Refinance
                            </button>

                            <button
                              onClick={() => setEditingLoan(loan)}
                              className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900">Quick Snapshot</h2>
              <div className="space-y-4 mt-5">
                <MiniRow label="Purchase Price" value={formatCurrency(metrics.purchasePrice)} />
                <MiniRow label="Current Value" value={formatCurrency(metrics.currentValue)} />
                <MiniRow label="Loan Count" value={propertyLoans.length} />
                <MiniRow label="Transaction Count" value={propertyTransactions.length} />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="text-primary-600" size={18} />
                <h2 className="text-lg font-semibold text-gray-900">Property Insights</h2>
              </div>

              <div className="space-y-3">
                {aiInsights.length === 0 ? (
                  <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                    No property insights available yet.
                  </div>
                ) : (
                  aiInsights.map((insight, i) => (
                    <InsightItem key={i} insight={insight} />
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-0 overflow-hidden">
              <AIScorePanel
                property={property}
                loans={propertyLoans}
                transactions={propertyTransactions}
              />
            </div>

            <BorrowingPowerCard
              analysis={borrowingPowerAnalysis}
              loading={financialsLoading}
              title="Borrowing Power Contribution"
              onExplore={() => mortgageSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              onCompleteFinancials={() => navigate('/financials')}
            />
          </div>
        </section>
      </main>

      {showAddLoan && (
        <AddLoanModal
          properties={[property]}
          preselectedPropertyId={property.id}
          onClose={() => setShowAddLoan(false)}
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

      {editingProperty && (
        <EditPropertyModal
          property={editingProperty}
          onClose={() => setEditingProperty(null)}
          onSave={fetchData}
        />
      )}

      {cashFlowPropertyId && (
        <CashFlowModal
          propertyId={cashFlowPropertyId}
          properties={[property]}
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

      {showOptimisationModal && (
        <OptimisationModal
          title="Property Optimisation Options"
          subtitle={`Recommended next actions for ${property.address}.`}
          actions={optimisationActions}
          onClose={() => setShowOptimisationModal(false)}
        />
      )}
    </div>
  )
}

function getDaysUntilExpiry(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
}

function getPropertyFeatures(property) {
  if (!property) return []

  const features = []

  if (property.bedrooms) {
    features.push({ icon: BedDouble, label: `${property.bedrooms} bed` })
  }

  if (property.bathrooms) {
    features.push({ icon: Bath, label: `${property.bathrooms} bath` })
  }

  if (property.garages) {
    features.push({ icon: CarFront, label: `${property.garages} car` })
  }

  if (property.land_size) {
    features.push({ icon: Ruler, label: `${property.land_size} sqm` })
  }

  return features
}

function Metric({ label, value, valueClassName = 'text-gray-900' }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-lg font-semibold mt-1 ${valueClassName}`}>{value}</p>
    </div>
  )
}

function MetricCardMini({ icon, label, value, valueClassName = 'text-gray-900' }) {
  return (
    <div className="bg-gray-50 rounded-2xl p-5">
      <div className="flex items-center gap-2 text-gray-400 mb-3">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${valueClassName}`}>{value}</p>
    </div>
  )
}

function MiniRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
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
      <div className={`text-sm font-medium mt-1 break-words ${valueClassName}`}>{value}</div>
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
  const toneClass = type === 'income' ? 'text-green-600' : 'text-red-500'
  const secondaryToneClass = type === 'income' ? 'text-green-500/80' : 'text-red-400'

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
