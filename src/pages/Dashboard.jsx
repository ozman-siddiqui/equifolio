import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Building2,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Home,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react'

import AddPropertyModal from '../components/AddPropertyModal'
import AddLoanModal from '../components/AddLoanModal'
import EditPropertyModal from '../components/EditPropertyModal'
import EditLoanModal from '../components/EditLoanModal'
import CashFlowModal from '../components/CashFlowModal'
import EditTransactionModal from '../components/EditTransactionModal'
import { buildAlerts } from '../components/AlertsDropdown'
import RefinanceModal from '../components/RefinanceModal'
import UpgradeModal from '../components/UpgradeModal'
import usePortfolioData from '../hooks/usePortfolioData'

const PLAN_LIMITS = { starter: 3, investor: 10, premium: Infinity }

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

export default function Dashboard({ session, subscription }) {
  const navigate = useNavigate()
  const { properties, loans, transactions, loading, fetchData } = usePortfolioData()

  const [showAddProperty, setShowAddProperty] = useState(false)
  const [showAddLoan, setShowAddLoan] = useState(false)
  const [addLoanPropertyId, setAddLoanPropertyId] = useState(null)
  const [editingProperty, setEditingProperty] = useState(null)
  const [editingLoan, setEditingLoan] = useState(null)
  const [cashFlowPropertyId, setCashFlowPropertyId] = useState(null)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [refinancingLoan, setRefinancingLoan] = useState(null)

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0)

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const thisMonthTxns = transactions.filter((t) => {
    const d = new Date(t.date)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  })

  const portfolioMetrics = useMemo(() => {
    const totalValue = properties.reduce(
      (sum, p) => sum + Number(p.current_value || 0),
      0
    )

    const totalDebt = loans.reduce(
      (sum, l) => sum + Number(l.current_balance || 0),
      0
    )

    const totalEquity = totalValue - totalDebt
    const portfolioLVR =
      totalValue > 0 ? ((totalDebt / totalValue) * 100).toFixed(1) : '0.0'

    const usableEquity = totalValue > 0 ? totalValue * 0.8 - totalDebt : 0

    const totalMonthlyIncome = thisMonthTxns
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + toMonthly(t.amount, t.frequency), 0)

    const totalMonthlyExpenses = thisMonthTxns
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + toMonthly(t.amount, t.frequency), 0)

    const netMonthlyCashFlow = totalMonthlyIncome - totalMonthlyExpenses

    return {
      totalValue,
      totalDebt,
      totalEquity,
      portfolioLVR,
      usableEquity,
      totalMonthlyIncome,
      totalMonthlyExpenses,
      netMonthlyCashFlow,
    }
  }, [properties, loans, thisMonthTxns])

  const alerts = useMemo(() => buildAlerts(properties, loans), [properties, loans])

  const fallbackAlerts = useMemo(() => {
    const derived = []

    const fixedExpiringSoon = loans.filter((loan) => {
      if (loan.loan_type !== 'Fixed' || !loan.fixed_rate_expiry) return false
      const days = Math.ceil(
        (new Date(loan.fixed_rate_expiry) - new Date()) / (1000 * 60 * 60 * 24)
      )
      return days > 0 && days <= 90
    })

    if (fixedExpiringSoon.length > 0) {
      derived.push({
        id: 'fallback-fixed-expiry',
        title: 'Fixed-rate expiry approaching',
        description: `${fixedExpiringSoon.length} mortgage${
          fixedExpiringSoon.length === 1 ? '' : 's'
        } expire within 90 days.`,
        urgent: fixedExpiringSoon.some((loan) => {
          const days = Math.ceil(
            (new Date(loan.fixed_rate_expiry) - new Date()) / (1000 * 60 * 60 * 24)
          )
          return days <= 30
        }),
      })
    }

    if (portfolioMetrics.netMonthlyCashFlow < 0) {
      derived.push({
        id: 'fallback-negative-cashflow',
        title: 'Negative monthly cash flow',
        description: `Portfolio is currently running at ${formatCurrency(
          portfolioMetrics.netMonthlyCashFlow
        )} this month.`,
        urgent: false,
      })
    }

    const highLvrProperties = properties.filter((property) => {
      const propertyLoans = loans.filter(
        (loan) => String(loan.property_id) === String(property.id)
      )
      const debt = propertyLoans.reduce(
        (sum, loan) => sum + Number(loan.current_balance || 0),
        0
      )
      const currentValue = Number(property.current_value || 0)
      const lvr = currentValue > 0 ? (debt / currentValue) * 100 : 0
      return lvr >= 80
    })

    if (highLvrProperties.length > 0) {
      derived.push({
        id: 'fallback-high-lvr',
        title: 'High leverage detected',
        description: `${highLvrProperties.length} propert${
          highLvrProperties.length === 1 ? 'y is' : 'ies are'
        } at or above 80% LVR.`,
        urgent: false,
      })
    }

    return derived
  }, [loans, properties, portfolioMetrics.netMonthlyCashFlow])

  const effectiveAlerts = alerts.length > 0 ? alerts : fallbackAlerts
  const urgentAlerts = effectiveAlerts.filter((a) => a.urgent)
  const nonUrgentAlerts = effectiveAlerts.filter((a) => !a.urgent)

  const topProperties = useMemo(() => {
    return [...properties]
      .map((property) => {
        const propertyLoans = loans.filter(
          (loan) => String(loan.property_id) === String(property.id)
        )

        const debt = propertyLoans.reduce(
          (sum, loan) => sum + Number(loan.current_balance || 0),
          0
        )

        const currentValue = Number(property.current_value || 0)
        const purchasePrice = Number(property.purchase_price || 0)
        const equity = currentValue - debt
        const growth = currentValue - purchasePrice

        return {
          ...property,
          debt,
          equity,
          growth,
        }
      })
      .sort((a, b) => Number(b.current_value || 0) - Number(a.current_value || 0))
      .slice(0, 3)
  }, [properties, loans])

  const strongestGrowthProperty = useMemo(() => {
    if (properties.length === 0) return null

    return [...properties]
      .map((property) => ({
        ...property,
        growth:
          Number(property.current_value || 0) - Number(property.purchase_price || 0),
      }))
      .sort((a, b) => b.growth - a.growth)[0]
  }, [properties])

  const weakestGrowthProperty = useMemo(() => {
    if (properties.length === 0) return null

    return [...properties]
      .map((property) => ({
        ...property,
        growth:
          Number(property.current_value || 0) - Number(property.purchase_price || 0),
      }))
      .sort((a, b) => a.growth - b.growth)[0]
  }, [properties])

  const handleOpenAddProperty = () => {
    const plan = (subscription?.plan || 'starter').toLowerCase()
    const limit = PLAN_LIMITS[plan] || 3

    if (properties.length >= limit) {
      setShowUpgradeModal(true)
    } else {
      setShowAddProperty(true)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading your portfolio...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 py-8">
        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-6 md:p-8 border-b border-gray-100">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 text-xs font-medium text-primary-700 bg-primary-50 px-3 py-1 rounded-full mb-4">
                  <Building2 size={13} />
                  Portfolio Command Centre
                </div>

                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                  Portfolio Dashboard
                </h1>

                <p className="text-gray-500 mt-2 max-w-2xl">
                  Monitor portfolio health, act on urgent lending events, and jump
                  quickly into property, mortgage, and cash flow workflows.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate('/properties')}
                  className="inline-flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                >
                  View Properties
                  <ChevronRight size={16} />
                </button>

                <button
                  onClick={handleOpenAddProperty}
                  className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                >
                  <Plus size={16} />
                  Add Property
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-4 p-6 md:p-8 bg-gray-50/70">
            <KpiCard
              label="Portfolio Value"
              value={formatCurrency(portfolioMetrics.totalValue)}
              helper={`${properties.length} ${
                properties.length === 1 ? 'property' : 'properties'
              }`}
            />
            <KpiCard
              label="Total Equity"
              value={formatCurrency(portfolioMetrics.totalEquity)}
              helper="Value minus debt"
              valueClassName={
                portfolioMetrics.totalEquity >= 0 ? 'text-green-600' : 'text-red-500'
              }
            />
            <KpiCard
              label="Portfolio LVR"
              value={`${portfolioMetrics.portfolioLVR}%`}
              helper="Loan to value ratio"
            />
            <KpiCard
              label="Usable Equity"
              value={formatCurrency(Math.max(0, portfolioMetrics.usableEquity))}
              helper="Available at 80% LVR"
              valueClassName={
                portfolioMetrics.usableEquity >= 0
                  ? 'text-primary-600'
                  : 'text-red-500'
              }
            />
            <KpiCard
              label="Monthly Cash Flow"
              value={
                transactions.length === 0
                  ? '—'
                  : formatCurrency(portfolioMetrics.netMonthlyCashFlow)
              }
              helper={`${now.toLocaleString('en-AU', { month: 'long' })} net`}
              valueClassName={
                portfolioMetrics.netMonthlyCashFlow >= 0
                  ? 'text-green-600'
                  : 'text-red-500'
              }
            />
          </div>
        </section>

        {urgentAlerts.length > 0 && (
          <section className="mt-6 bg-red-50 border border-red-200 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-red-800">
                      {urgentAlerts.length === 1
                        ? '1 urgent alert'
                        : `${urgentAlerts.length} urgent alerts`}
                    </h2>
                    <p className="text-xs text-red-600 mt-1">
                      Action required within 30 days
                    </p>
                  </div>

                  <button
                    onClick={() => navigate('/alerts')}
                    className="inline-flex items-center gap-2 text-sm font-medium text-red-700 hover:text-red-800 transition-colors"
                  >
                    View Alerts
                    <ArrowRight size={15} />
                  </button>
                </div>

                <div className="mt-3 space-y-1.5">
                  {urgentAlerts.slice(0, 3).map((alert) => (
                    <p key={alert.id} className="text-sm text-red-700">
                      · {alert.title}: {alert.description}
                      {typeof alert.days !== 'undefined' ? ` (${alert.days} days)` : ''}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
          <div className="xl:col-span-2 space-y-6">
            <section className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Quick Navigation
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Jump into the right workspace
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <QuickNavCard
                  icon={<Home size={18} className="text-primary-600" />}
                  title="Properties"
                  description="Browse, filter, and drill into each property."
                  actionLabel="Open Properties"
                  onClick={() => navigate('/properties')}
                />

                <QuickNavCard
                  icon={<DollarSign size={18} className="text-green-600" />}
                  title="Cash Flow"
                  description="Review income, expenses, and monthly cash performance."
                  actionLabel="Open Cash Flow"
                  onClick={() => navigate('/cashflow')}
                />

                <QuickNavCard
                  icon={<CreditCard size={18} className="text-orange-600" />}
                  title="Mortgages"
                  description="Monitor balances, fixed rates, and refinance opportunities."
                  actionLabel="Open Mortgages"
                  onClick={() => navigate('/mortgages')}
                />
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Top Properties
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Highest-value properties in your portfolio
                  </p>
                </div>

                <button
                  onClick={() => navigate('/properties')}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
                >
                  View all
                </button>
              </div>

              {topProperties.length === 0 ? (
                <EmptyMiniState
                  title="No properties yet"
                  description="Add your first property to start building your portfolio."
                />
              ) : (
                <div className="space-y-3">
                  {topProperties.map((property) => (
                    <button
                      key={property.id}
                      type="button"
                      onClick={() => navigate(`/property/${property.id}`)}
                      className="w-full text-left rounded-xl border border-gray-100 p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900">
                              {property.address}
                            </p>
                            {property.property_use === 'owner_occupied' && (
                              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                                Owner Occupied
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {property.suburb}, {property.state}
                            {property.property_type ? ` · ${property.property_type}` : ''}
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-4 md:min-w-[320px]">
                          <MiniMetric
                            label="Value"
                            value={formatCurrency(property.current_value)}
                          />
                          <MiniMetric
                            label="Equity"
                            value={formatCurrency(property.equity)}
                            valueClassName={
                              property.equity >= 0 ? 'text-green-600' : 'text-red-500'
                            }
                          />
                          <MiniMetric
                            label="Growth"
                            value={formatCurrency(property.growth)}
                            valueClassName={
                              property.growth >= 0 ? 'text-green-600' : 'text-red-500'
                            }
                          />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="space-y-6">
            <section className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={18} className="text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Portfolio Signals
                </h2>
              </div>

              <div className="space-y-4">
                <SignalCard
                  label="Best performer"
                  title={strongestGrowthProperty?.address || '—'}
                  value={
                    strongestGrowthProperty
                      ? formatCurrency(
                          Number(strongestGrowthProperty.current_value || 0) -
                            Number(strongestGrowthProperty.purchase_price || 0)
                        )
                      : '—'
                  }
                  tone="positive"
                />

                <SignalCard
                  label="Weakest performer"
                  title={weakestGrowthProperty?.address || '—'}
                  value={
                    weakestGrowthProperty
                      ? formatCurrency(
                          Number(weakestGrowthProperty.current_value || 0) -
                            Number(weakestGrowthProperty.purchase_price || 0)
                        )
                      : '—'
                  }
                  tone="negative"
                />

                <SignalCard
                  label="Monthly portfolio net"
                  title={now.toLocaleString('en-AU', {
                    month: 'long',
                    year: 'numeric',
                  })}
                  value={
                    transactions.length === 0
                      ? '—'
                      : formatCurrency(portfolioMetrics.netMonthlyCashFlow)
                  }
                  tone={portfolioMetrics.netMonthlyCashFlow >= 0 ? 'positive' : 'negative'}
                />
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={18} className="text-orange-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Alerts Snapshot
                </h2>
              </div>

              {effectiveAlerts.length === 0 ? (
                <EmptyMiniState
                  title="No alerts right now"
                  description="No current lending or portfolio risk signals detected."
                  icon={<ShieldAlert size={18} className="text-green-600" />}
                />
              ) : (
                <div className="space-y-3">
                  {urgentAlerts.slice(0, 2).map((alert) => (
                    <AlertRow key={alert.id} alert={alert} urgent />
                  ))}
                  {nonUrgentAlerts.slice(0, 2).map((alert) => (
                    <AlertRow key={alert.id} alert={alert} />
                  ))}

                  <button
                    onClick={() => navigate('/alerts')}
                    className="w-full mt-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
                  >
                    View all alerts
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {showAddProperty && (
        <AddPropertyModal
          userId={session.user.id}
          onClose={() => setShowAddProperty(false)}
          onSave={fetchData}
        />
      )}

      {showAddLoan && (
        <AddLoanModal
          userId={session.user.id}
          properties={properties}
          preselectedPropertyId={addLoanPropertyId}
          onClose={() => {
            setShowAddLoan(false)
            setAddLoanPropertyId(null)
          }}
          onSave={fetchData}
        />
      )}

      {editingProperty && (
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
    </div>
  )
}

function KpiCard({
  label,
  value,
  helper,
  valueClassName = 'text-gray-900',
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 min-h-[190px] flex flex-col">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-5 min-h-[2.75rem]">
        {label}
      </p>

      <div className="flex-1 flex items-center min-h-[72px]">
        <p
          className={`text-2xl md:text-3xl lg:text-4xl leading-tight font-bold tracking-tight break-words max-w-full ${valueClassName}`}
        >
          {value}
        </p>
      </div>

      <p className="text-sm text-gray-400 leading-6 min-h-[3rem] mt-3">
        {helper}
      </p>
    </div>
  )
}

function QuickNavCard({ icon, title, description, actionLabel, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-xl border border-gray-100 p-5 hover:bg-gray-50 transition-colors"
    >
      <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
      <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary-600">
        {actionLabel}
        <ChevronRight size={15} />
      </div>
    </button>
  )
}

function MiniMetric({
  label,
  value,
  valueClassName = 'text-gray-900',
}) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-sm font-semibold ${valueClassName}`}>{value}</p>
    </div>
  )
}

function SignalCard({ label, title, value, tone = 'neutral' }) {
  const toneClass =
    tone === 'positive'
      ? 'text-green-600'
      : tone === 'negative'
      ? 'text-red-500'
      : 'text-gray-900'

  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-1">{title}</p>
      <p className={`text-sm font-semibold mt-2 ${toneClass}`}>{value}</p>
    </div>
  )
}

function AlertRow({ alert, urgent = false }) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        urgent
          ? 'border-red-200 bg-red-50'
          : 'border-gray-100 bg-gray-50'
      }`}
    >
      <p
        className={`text-sm font-medium ${
          urgent ? 'text-red-800' : 'text-gray-900'
        }`}
      >
        {alert.title}
      </p>
      <p
        className={`text-xs mt-1 ${
          urgent ? 'text-red-600' : 'text-gray-500'
        }`}
      >
        {alert.description}
        {typeof alert.days !== 'undefined' ? ` (${alert.days} days)` : ''}
      </p>
    </div>
  )
}

function EmptyMiniState({ title, description, icon = null }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 p-5 text-center">
      {icon ? (
        <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-medium text-gray-900">{title}</p>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </div>
  )
}
