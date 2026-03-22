import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import {
  Home, AlertCircle, Plus, LogOut, CreditCard, Pencil,
  DollarSign, ChevronDown, ChevronUp, Trash2
} from 'lucide-react'
import AddPropertyModal from '../components/AddPropertyModal'
import AddLoanModal from '../components/AddLoanModal'
import EditPropertyModal from '../components/EditPropertyModal'
import EditLoanModal from '../components/EditLoanModal'
import CashFlowModal from '../components/CashFlowModal'
import EditTransactionModal from '../components/EditTransactionModal'
import AlertsDropdown, { buildAlerts } from '../components/AlertsDropdown'
import AIScorePanel from '../components/AIScorePanel'
import RefinanceModal from '../components/RefinanceModal'
import { PortfolioCashFlowChart, PropertyCashFlowTable } from '../components/CashFlowProjection'
import UpgradeModal from '../components/UpgradeModal'

const PLAN_LIMITS = { starter: 3, investor: 10, premium: Infinity }

const toMonthly = (amount, frequency) => {
  const map = { Weekly: 52 / 12, Fortnightly: 26 / 12, Monthly: 1, Quarterly: 1 / 3, Annual: 1 / 12 }
  return Number(amount) * (map[frequency] || 1)
}

const formatFrequency = (f) => {
  const map = { Weekly: 'wk', Fortnightly: 'fn', Monthly: 'mo', Quarterly: 'qtr', Annual: 'yr' }
  return map[f] || 'mo'
}

export default function Dashboard({ session, subscription }) {
  const [properties, setProperties] = useState([])
  const [loans, setLoans] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddProperty, setShowAddProperty] = useState(false)
  const [showAddLoan, setShowAddLoan] = useState(false)
  const [addLoanPropertyId, setAddLoanPropertyId] = useState(null)
  const [editingProperty, setEditingProperty] = useState(null)
  const [editingLoan, setEditingLoan] = useState(null)
  const [cashFlowPropertyId, setCashFlowPropertyId] = useState(null)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [expandedCashFlow, setExpandedCashFlow] = useState(new Set())
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [refinancingLoan, setRefinancingLoan] = useState(null)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const [{ data: props }, { data: lns }, { data: txns }] = await Promise.all([
      supabase.from('properties').select('*').order('created_at', { ascending: false }),
      supabase.from('loans').select('*'),
      supabase.from('transactions').select('*').order('date', { ascending: false })
    ])
    setProperties(props || [])
    setLoans(lns || [])
    setTransactions(txns || [])
    setLoading(false)
  }

  const toggleCashFlow = (id) => {
    setExpandedCashFlow(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const formatCurrency = (amount) => new Intl.NumberFormat('en-AU', {
    style: 'currency', currency: 'AUD', maximumFractionDigits: 0
  }).format(amount)

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const thisMonthTxns = transactions.filter(t => {
    const d = new Date(t.date)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  })

  const totalValue = properties.reduce((sum, p) => sum + Number(p.current_value), 0)
  const totalDebt = loans.reduce((sum, l) => sum + Number(l.current_balance), 0)
  const totalEquity = totalValue - totalDebt
  const portfolioLVR = totalValue > 0 ? (totalDebt / totalValue * 100).toFixed(1) : 0
  const usableEquity = totalValue > 0 ? (totalValue * 0.8 - totalDebt) : 0

  const totalMonthlyIncome = thisMonthTxns
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + toMonthly(t.amount, t.frequency), 0)
  const totalMonthlyExpenses = thisMonthTxns
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + toMonthly(t.amount, t.frequency), 0)
  const netMonthlyCashFlow = totalMonthlyIncome - totalMonthlyExpenses

  const getDaysUntilExpiry = (dateStr) => {
    if (!dateStr) return null
    return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
  }

  const getExpiryBadge = (days) => {
    if (days <= 30) return { bg: 'bg-red-100', text: 'text-red-700', label: `${days}d left` }
    if (days <= 60) return { bg: 'bg-orange-100', text: 'text-orange-700', label: `${days}d left` }
    return { bg: 'bg-amber-100', text: 'text-amber-700', label: `${days}d left` }
  }

  const handleDeleteTransaction = async (txnId) => {
    if (!window.confirm('Delete this transaction?')) return
    await supabase.from('transactions').delete().eq('id', txnId)
    fetchData()
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-400">Loading your portfolio...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">E</span>
            </div>
            <span className="font-bold text-gray-900 text-lg">Equifolio</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden md:block">{session.user.email}</span>
            <AlertsDropdown properties={properties} loans={loans} />
            <button onClick={() => supabase.auth.signOut()}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Title row */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Portfolio Dashboard</h1>
            <p className="text-gray-500 mt-1">
              {properties.length === 0
                ? 'Add your first property to get started'
                : `${properties.length} ${properties.length === 1 ? 'property' : 'properties'} in your portfolio`}
            </p>
          </div>
          <button
            onClick={() => {
              const plan = (subscription?.plan || 'starter').toLowerCase()
              const limit = PLAN_LIMITS[plan] || 3
              if (properties.length >= limit) {
                setShowUpgradeModal(true)
              } else {
                setShowAddProperty(true)
              }
            }}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus size={16} /> Add Property
          </button>
        </div>

        {/* Urgent alerts banner */}
        {(() => {
          const urgentAlerts = buildAlerts(properties, loans).filter(a => a.urgent)
          if (urgentAlerts.length === 0) return null
          return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 animate-pulse flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">
                    {urgentAlerts.length === 1 ? '1 urgent alert' : `${urgentAlerts.length} urgent alerts`} — action required within 30 days
                  </p>
                  <div className="mt-1 space-y-0.5">
                    {urgentAlerts.map(a => (
                      <p key={a.id} className="text-xs text-red-600">
                        · {a.title}: {a.description} ({a.days} days)
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* 5 metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Portfolio Value</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalValue)}</p>
            <p className="text-xs text-gray-400 mt-1">{properties.length} {properties.length === 1 ? 'property' : 'properties'}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Equity</p>
            <p className={`text-2xl font-bold ${totalEquity >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(totalEquity)}</p>
            <p className="text-xs text-gray-400 mt-1">Value minus debt</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Portfolio LVR</p>
            <p className="text-2xl font-bold text-gray-900">{portfolioLVR}%</p>
            <p className="text-xs text-gray-400 mt-1">Loan to value ratio</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Usable Equity</p>
            <p className={`text-2xl font-bold ${usableEquity >= 0 ? 'text-primary-600' : 'text-red-500'}`}>
              {formatCurrency(Math.max(0, usableEquity))}
            </p>
            <p className="text-xs text-gray-400 mt-1">Available at 80% LVR</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Monthly Cash Flow</p>
            <p className={`text-2xl font-bold ${netMonthlyCashFlow >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {transactions.length === 0 ? '—' : formatCurrency(netMonthlyCashFlow)}
            </p>
            <p className="text-xs text-gray-400 mt-1">{now.toLocaleString('en-AU', { month: 'long' })} net</p>
          </div>
        </div>

    
        {/* Properties list */}
        <div className="bg-white rounded-xl border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Your Properties</h2>
          </div>

          {properties.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Home className="text-gray-400" size={24} />
              </div>
              <h3 className="font-medium text-gray-900 mb-1">No properties yet</h3>
              <p className="text-sm text-gray-500 mb-4">Add your first investment property to start tracking your portfolio</p>
              <button
                onClick={() => {
                  const plan = (subscription?.plan || 'starter').toLowerCase()
                  const limit = PLAN_LIMITS[plan] || 3
                  if (properties.length >= limit) {
                    setShowUpgradeModal(true)
                  } else {
                    setShowAddProperty(true)
                  }
                }}
                className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors">
                Add your first property
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {properties.map(property => {

                const propertyLoans = loans.filter(l => l.property_id === property.id)
                const propertyDebt = propertyLoans.reduce((sum, l) => sum + Number(l.current_balance), 0)
                const equity = Number(property.current_value) - propertyDebt
                const lvr = propertyDebt > 0 ? (propertyDebt / Number(property.current_value) * 100).toFixed(1) : 0
                const growth = Number(property.current_value) - Number(property.purchase_price)
                const growthPct = ((growth / Number(property.purchase_price)) * 100).toFixed(1)

                const allPropTxns = transactions.filter(t => t.property_id === property.id)

                const propThisMonth = thisMonthTxns.filter(t => t.property_id === property.id)
                const propIncome = propThisMonth.filter(t => t.type === 'income')
                  .reduce((sum, t) => sum + toMonthly(t.amount, t.frequency), 0)
                const propExpenses = propThisMonth.filter(t => t.type === 'expense')
                  .reduce((sum, t) => sum + toMonthly(t.amount, t.frequency), 0)
                const propNet = propIncome - propExpenses

                const allIncome = allPropTxns.filter(t => t.type === 'income')
                  .reduce((sum, t) => sum + toMonthly(t.amount, t.frequency), 0)
                const allExpenses = allPropTxns.filter(t => t.type === 'expense')
                  .reduce((sum, t) => sum + toMonthly(t.amount, t.frequency), 0)
                const uniqueMonths = [...new Set(allPropTxns.map(t => t.date.slice(0, 7)))].length || 1
                const annualNetIncome = ((allIncome - allExpenses) / uniqueMonths) * 12
                const annualGrossIncome = (allIncome / uniqueMonths) * 12
                const netYield = Number(property.current_value) > 0
                  ? ((annualNetIncome / Number(property.current_value)) * 100).toFixed(2) : null
                const grossYield = Number(property.current_value) > 0
                  ? ((annualGrossIncome / Number(property.current_value)) * 100).toFixed(2) : null

                const isExpanded = expandedCashFlow.has(property.id)
                const isOwnerOccupied = property.property_use === 'owner_occupied'

                const sortedTxns = [...allPropTxns].sort((a, b) => {
                  if (a.type !== b.type) return a.type === 'income' ? -1 : 1
                  return new Date(b.date) - new Date(a.date)
                })

                return (
                  <div key={property.id} className="p-6">

                    {/* Address + value */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">{property.address}</h3>
                          {isOwnerOccupied && (
                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                              Owner Occupied
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {property.suburb}, {property.state} · {property.property_type}
                          {property.bedrooms ? ` · ${property.bedrooms} bed` : ''}
                          {property.bathrooms ? ` ${property.bathrooms} bath` : ''}
                          {property.land_size ? ` · ${property.land_size}m²` : ''}
                          {property.garages ? ` · ${property.garages} garage` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{formatCurrency(property.current_value)}</p>
                        <p className={`text-sm ${growth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {growth >= 0 ? '+' : ''}{formatCurrency(growth)} ({growthPct}%)
                        </p>
                      </div>
                    </div>

                    {/* Equity row */}
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-gray-400">Equity</p>
                        <p className={`text-sm font-medium ${equity >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {formatCurrency(equity)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">LVR</p>
                        <p className="text-sm font-medium text-gray-900">{lvr}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Debt</p>
                        <p className="text-sm font-medium text-gray-900">{formatCurrency(propertyDebt)}</p>
                      </div>
                    </div>

                    {/* Collapsible cash flow section */}
                    <div className="mt-4 pt-4 border-t border-gray-50">

                      <button type="button" onClick={() => toggleCashFlow(property.id)}
                        className="w-full flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-gray-500">
                            Cash Flow — {now.toLocaleString('en-AU', { month: 'long', year: 'numeric' })}
                          </span>
                          {!isExpanded && propThisMonth.length > 0 && (
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span className="text-green-600">{formatCurrency(propIncome)}</span>
                              <span>in</span>
                              <span className="text-red-500">{formatCurrency(propExpenses)}</span>
                              <span>out</span>
                              <span className={`font-semibold ${propNet >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                → {formatCurrency(propNet)} net
                              </span>
                            </div>
                          )}
                          {!isExpanded && propThisMonth.length === 0 && (
                            <span className="text-xs text-gray-400 italic">No entries this month</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {allPropTxns.length > 0 && grossYield && netYield && (
                            <span className="text-xs text-gray-400">
                              Gross {grossYield}% · Net{' '}
                              <span className={Number(netYield) >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                                {netYield}%
                              </span>
                            </span>
                          )}
                          {isExpanded
                            ? <ChevronUp size={14} className="text-gray-400" />
                            : <ChevronDown size={14} className="text-gray-400" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="mt-3 space-y-3">

                          {propThisMonth.length > 0 && (
                            <div className="grid grid-cols-3 gap-4 pb-3 border-b border-gray-50">
                              <div>
                                <p className="text-xs text-gray-400">Income this month</p>
                                <p className="text-sm font-medium text-green-600">{formatCurrency(propIncome)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400">Expenses this month</p>
                                <p className="text-sm font-medium text-red-500">{formatCurrency(propExpenses)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400">Net this month</p>
                                <p className={`text-sm font-medium ${propNet >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                  {formatCurrency(propNet)}
                                </p>
                              </div>
                            </div>
                          )}

                          {sortedTxns.length === 0 ? (
                            <p className="text-xs text-gray-400 italic py-2">
                              No transactions yet. Click Add Transaction below to start tracking.
                            </p>
                          ) : (
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-2">All Transactions</p>
                              <div className="space-y-1">
                                {sortedTxns.map(txn => (
                                  <div key={txn.id}
                                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 group/txn">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                        txn.type === 'income' ? 'bg-green-500' : 'bg-red-400'
                                      }`} />
                                      <div className="min-w-0">
                                        <span className="text-xs font-medium text-gray-700">{txn.category}</span>
                                        {txn.description && (
                                          <span className="text-xs text-gray-400 ml-1.5">· {txn.description}</span>
                                        )}
                                        <span className="text-xs text-gray-400 ml-1.5">
                                          · {new Date(txn.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                                      <div className="text-right">
                                        <span className={`text-xs font-semibold ${
                                          txn.type === 'income' ? 'text-green-600' : 'text-red-500'
                                        }`}>
                                          {txn.type === 'income' ? '+' : '-'}${Number(txn.amount).toLocaleString()}
                                        </span>
                                        <span className="text-xs text-gray-400 ml-1">
                                          /{formatFrequency(txn.frequency || 'Monthly')}
                                        </span>
                                        {txn.frequency && txn.frequency !== 'Monthly' && (
                                          <p className="text-xs text-gray-400">
                                            ≈ {formatCurrency(toMonthly(txn.amount, txn.frequency))}/mo
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 opacity-0 group-hover/txn:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => setEditingTransaction({ ...txn, propertyUse: property.property_use })}
                                          className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
                                          title="Edit transaction">
                                          <Pencil size={12} />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteTransaction(txn.id)}
                                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                          title="Delete transaction">
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}



                        </div>
                      )}
                    </div>

                    {/* Mortgages */}
                    {propertyLoans.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-50">
                        <p className="text-xs text-gray-400 mb-2">Mortgages</p>
                        {propertyLoans.map(loan => {
                          const daysUntil = getDaysUntilExpiry(loan.fixed_rate_expiry)
                          const badge = loan.loan_type === 'Fixed' && daysUntil !== null && daysUntil > 0
                            ? getExpiryBadge(daysUntil) : null
                          return (
                            <div key={loan.id} className="flex items-center justify-between text-sm py-1">
                              <span className="text-gray-600 flex items-center gap-2 flex-wrap">
                                {loan.lender} · {loan.loan_type} {loan.interest_rate}%
                                {loan.loan_type === 'Fixed' && loan.fixed_rate_expiry && (
                                  <span className="text-xs text-gray-400">
                                    · Fixed until {new Date(loan.fixed_rate_expiry).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}
                                  </span>
                                )}
                                {badge && (
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                                    {badge.label}
                                  </span>
                                )}
                              </span>
                              <div className="flex items-center gap-3">
                                <span className="font-medium text-gray-900">{formatCurrency(loan.current_balance)}</span>
                                <button
                                  onClick={() => setRefinancingLoan({ loan, property })}
                                  className="flex items-center gap-1 text-xs bg-primary-50 hover:bg-primary-100 text-primary-600 font-medium px-2 py-1 rounded-md transition-colors">
                                  Refinance
                                </button>
                                <button onClick={() => setEditingLoan(loan)}
                                  className="text-gray-400 hover:text-primary-600 transition-colors">
                                  <Pencil size={14} />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* AI Score Panel */}
                    <AIScorePanel
                      property={property}
                      loans={propertyLoans}
                      transactions={allPropTxns}
                    />

                    {/* Action buttons */}
                    <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-50">
                      <button onClick={() => setCashFlowPropertyId(property.id)}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-green-600 font-medium transition-colors">
                        <DollarSign size={13} /> Add Transaction
                      </button>
                      <span className="text-gray-200">·</span>
                      <button onClick={() => { setAddLoanPropertyId(property.id); setShowAddLoan(true) }}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 font-medium transition-colors">
                        <CreditCard size={13} /> Add Mortgage
                      </button>
                      <span className="text-gray-200">·</span>
                      <button onClick={() => setEditingProperty(property)}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 font-medium transition-colors">
                        <Pencil size={13} /> Edit Property
                      </button>
                    </div>

                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {showAddProperty && (
        <AddPropertyModal userId={session.user.id} onClose={() => setShowAddProperty(false)} onSave={fetchData} />
      )}
      {showAddLoan && (
        <AddLoanModal userId={session.user.id} properties={properties} preselectedPropertyId={addLoanPropertyId}
          onClose={() => { setShowAddLoan(false); setAddLoanPropertyId(null) }} onSave={fetchData} />
      )}
      {editingProperty && (
        <EditPropertyModal property={editingProperty} userId={session.user.id}
          onClose={() => setEditingProperty(null)} onSave={fetchData} />
      )}
      {editingLoan && (
        <EditLoanModal loan={editingLoan} onClose={() => setEditingLoan(null)} onSave={fetchData} />
      )}
      {showUpgradeModal && (
        <UpgradeModal
          currentPlan={subscription?.plan || 'starter'}
          currentCount={properties.length}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
      {refinancingLoan && (
        <RefinanceModal
          loan={refinancingLoan.loan}
          property={refinancingLoan.property}
          onClose={() => setRefinancingLoan(null)}
        />
      )}
      {cashFlowPropertyId && (
        <CashFlowModal userId={session.user.id} propertyId={cashFlowPropertyId} properties={properties}
          onClose={() => setCashFlowPropertyId(null)} onSave={fetchData} />
      )}
      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          propertyUse={editingTransaction.propertyUse}
          onClose={() => setEditingTransaction(null)}
          onSave={fetchData}
        />
      )}
    </div>
  )
}

