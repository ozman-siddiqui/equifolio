import {
  CreditCard,
  Pencil,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Trash2,
  ChevronRight,
  Calendar,
  Building2,
  Activity,
  AlertTriangle,
} from 'lucide-react'

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

export default function PropertyCard({
  property,
  loans,
  transactions,
  thisMonthTxns,
  now,
  expandedCashFlow,
  toggleCashFlow,
  navigate,
  setEditingTransaction,
  handleDeleteTransaction,
  setRefinancingLoan,
  setEditingLoan,
  setCashFlowPropertyId,
  setAddLoanPropertyId,
  setShowAddLoan,
  setEditingProperty,
  formatCurrency,
}) {
  const propertyLoans = loans.filter((l) => l.property_id === property.id)

  const propertyDebt = propertyLoans.reduce(
    (sum, l) => sum + Number(l.current_balance || 0),
    0
  )

  const equity = Number(property.current_value || 0) - propertyDebt

  const lvr =
    Number(property.current_value) > 0
      ? ((propertyDebt / Number(property.current_value)) * 100).toFixed(1)
      : 0

  const growth =
    Number(property.current_value || 0) - Number(property.purchase_price || 0)

  const growthPct =
    Number(property.purchase_price) > 0
      ? (
          (growth / Number(property.purchase_price)) *
          100
        ).toFixed(1)
      : '0.0'

  const allPropTxns = transactions.filter((t) => t.property_id === property.id)

  const propThisMonth = thisMonthTxns.filter((t) => t.property_id === property.id)

  const propIncome = propThisMonth
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + toMonthly(t.amount, t.frequency), 0)

  const propExpenses = propThisMonth
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + toMonthly(t.amount, t.frequency), 0)

  const propNet = propIncome - propExpenses

  const allIncome = allPropTxns
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + toMonthly(t.amount, t.frequency), 0)

  const allExpenses = allPropTxns
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + toMonthly(t.amount, t.frequency), 0)

  const uniqueMonths =
    [...new Set(allPropTxns.map((t) => String(t.date).slice(0, 7)))].length || 1

  const annualNetIncome = ((allIncome - allExpenses) / uniqueMonths) * 12
  const annualGrossIncome = (allIncome / uniqueMonths) * 12

  const netYield =
    Number(property.current_value) > 0
      ? ((annualNetIncome / Number(property.current_value)) * 100).toFixed(2)
      : null

  const grossYield =
    Number(property.current_value) > 0
      ? ((annualGrossIncome / Number(property.current_value)) * 100).toFixed(2)
      : null

  const isExpanded = expandedCashFlow.has(property.id)
  const isOwnerOccupied = property.property_use === 'owner_occupied'

  const sortedTxns = [...allPropTxns].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'income' ? -1 : 1
    return new Date(b.date) - new Date(a.date)
  })

  const latestTxn = sortedTxns[0] || null

  const getDaysUntilExpiry = (dateStr) => {
    if (!dateStr) return null
    return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
  }

  const getExpiryBadge = (days) => {
    if (days <= 30) {
      return {
        bg: 'bg-red-100',
        text: 'text-red-700',
        label: `${days}d left`,
      }
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

  const loansExpiringSoon = propertyLoans.filter((loan) => {
    if (loan.loan_type !== 'Fixed' || !loan.fixed_rate_expiry) return false
    const days = getDaysUntilExpiry(loan.fixed_rate_expiry)
    return days !== null && days > 0 && days <= 90
  })

  const monthlyNetTone =
    propNet > 0
      ? 'text-green-600 bg-green-50 border-green-100'
      : propNet < 0
      ? 'text-red-600 bg-red-50 border-red-100'
      : 'text-gray-600 bg-gray-50 border-gray-200'

  return (
    <div className="p-6">
      <button
        type="button"
        onClick={() => navigate(`/property/${property.id}`)}
        className="w-full text-left rounded-2xl border border-transparent hover:border-gray-200 hover:bg-gray-50 transition-all p-4 -m-4 mb-0 group"
      >
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="font-semibold text-gray-900 group-hover:text-primary-700 transition-colors text-base md:text-lg">
                {property.address}
              </h3>

              {isOwnerOccupied && (
                <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-medium">
                  Owner Occupied
                </span>
              )}

              {property.property_type && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
                  {property.property_type}
                </span>
              )}

              {loansExpiringSoon.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-700 px-2.5 py-1 rounded-full font-medium">
                  <AlertTriangle size={12} />
                  Fixed rate expiring
                </span>
              )}
            </div>

            <p className="text-sm text-gray-500">
              {property.suburb}, {property.state}
              {property.bedrooms ? ` · ${property.bedrooms} bed` : ''}
              {property.bathrooms ? ` ${property.bathrooms} bath` : ''}
              {property.land_size ? ` · ${property.land_size}m²` : ''}
              {property.garages ? ` · ${property.garages} garage` : ''}
            </p>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-white border border-gray-200 px-2.5 py-1 rounded-full">
                <Building2 size={12} />
                {propertyLoans.length} {propertyLoans.length === 1 ? 'mortgage' : 'mortgages'}
              </span>

              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-white border border-gray-200 px-2.5 py-1 rounded-full">
                <Activity size={12} />
                {allPropTxns.length} {allPropTxns.length === 1 ? 'transaction' : 'transactions'}
              </span>

              {latestTxn && (
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-white border border-gray-200 px-2.5 py-1 rounded-full">
                  <Calendar size={12} />
                  Latest {new Date(latestTxn.date).toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-3 text-xs">
              <span className="text-primary-600 font-medium">View details</span>
              <ChevronRight
                size={14}
                className="text-primary-600 group-hover:translate-x-0.5 transition-transform"
              />
            </div>
          </div>

          <div className="flex-shrink-0 xl:text-right">
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
              Current value
            </p>
            <p className="font-bold text-gray-900 text-2xl">
              {formatCurrency(property.current_value)}
            </p>
            <p
              className={`text-sm font-medium mt-1 ${
                growth >= 0 ? 'text-green-600' : 'text-red-500'
              }`}
            >
              {growth >= 0 ? '+' : ''}
              {formatCurrency(growth)} ({growthPct}%)
            </p>

            <div className="mt-3 flex xl:justify-end">
              <span
                className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${monthlyNetTone}`}
              >
                {propThisMonth.length === 0
                  ? 'No cash flow this month'
                  : `This month: ${formatCurrency(propNet)} net`}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          <MetricItem
            label="Equity"
            value={formatCurrency(equity)}
            valueClassName={equity >= 0 ? 'text-green-600' : 'text-red-500'}
          />
          <MetricItem
            label="Debt"
            value={formatCurrency(propertyDebt)}
          />
          <MetricItem
            label="LVR"
            value={`${lvr}%`}
          />
          <MetricItem
            label="Net Yield"
            value={netYield ? `${netYield}%` : '—'}
            valueClassName={
              netYield && Number(netYield) >= 0 ? 'text-green-600' : 'text-gray-900'
            }
          />
        </div>
      </button>

      <div className="mt-5 pt-4 border-t border-gray-50">
        <button
          type="button"
          onClick={() => toggleCashFlow(property.id)}
          className="w-full flex items-center justify-between gap-4 group"
        >
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-medium text-gray-500">
                Cash Flow —{' '}
                {now.toLocaleString('en-AU', {
                  month: 'long',
                  year: 'numeric',
                })}
              </span>

              {!isExpanded && propThisMonth.length > 0 && (
                <>
                  <span className="text-xs text-green-600 font-medium">
                    {formatCurrency(propIncome)} in
                  </span>
                  <span className="text-xs text-red-500 font-medium">
                    {formatCurrency(propExpenses)} out
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      propNet >= 0 ? 'text-green-600' : 'text-red-500'
                    }`}
                  >
                    {formatCurrency(propNet)} net
                  </span>
                </>
              )}

              {!isExpanded && propThisMonth.length === 0 && (
                <span className="text-xs text-gray-400 italic">
                  No entries this month
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {allPropTxns.length > 0 && grossYield && netYield && (
              <span className="hidden md:inline text-xs text-gray-400">
                Gross {grossYield}% · Net{' '}
                <span
                  className={
                    Number(netYield) >= 0
                      ? 'text-green-600 font-medium'
                      : 'text-red-500 font-medium'
                  }
                >
                  {netYield}%
                </span>
              </span>
            )}

            {isExpanded ? (
              <ChevronUp size={14} className="text-gray-400" />
            ) : (
              <ChevronDown size={14} className="text-gray-400" />
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="mt-3 space-y-4">
            {propThisMonth.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-3 border-b border-gray-50">
                <SoftMetricItem
                  label="Income this month"
                  value={formatCurrency(propIncome)}
                  valueClassName="text-green-600"
                />
                <SoftMetricItem
                  label="Expenses this month"
                  value={formatCurrency(propExpenses)}
                  valueClassName="text-red-500"
                />
                <SoftMetricItem
                  label="Net this month"
                  value={formatCurrency(propNet)}
                  valueClassName={propNet >= 0 ? 'text-green-600' : 'text-red-500'}
                />
              </div>
            )}

            {sortedTxns.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-2">
                No transactions yet. Click Add Transaction below to start tracking.
              </p>
            ) : (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">
                  All Transactions
                </p>

                <div className="space-y-1">
                  {sortedTxns.map((txn) => (
                    <div
                      key={txn.id}
                      className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50 group/txn gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            txn.type === 'income' ? 'bg-green-500' : 'bg-red-400'
                          }`}
                        />

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-medium text-gray-700">
                              {txn.category}
                            </span>
                            {txn.description && (
                              <span className="text-xs text-gray-400">
                                · {txn.description}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="text-xs text-gray-400">
                              {new Date(txn.date).toLocaleDateString('en-AU', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            <span className="text-xs text-gray-400">
                              · /{formatFrequency(txn.frequency || 'Monthly')}
                            </span>
                            {txn.frequency && txn.frequency !== 'Monthly' && (
                              <span className="text-xs text-gray-400">
                                · ≈ {formatCurrency(toMonthly(txn.amount, txn.frequency))}/mo
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        <div className="text-right">
                          <span
                            className={`text-xs font-semibold ${
                              txn.type === 'income'
                                ? 'text-green-600'
                                : 'text-red-500'
                            }`}
                          >
                            {txn.type === 'income' ? '+' : '-'}
                            {formatCurrency(txn.amount)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover/txn:opacity-100 transition-opacity">
                          <button
                            onClick={() =>
                              setEditingTransaction({
                                ...txn,
                                propertyUse: property.property_use,
                              })
                            }
                            className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
                            title="Edit transaction"
                            type="button"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction(txn.id)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            title="Delete transaction"
                            type="button"
                          >
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

      {propertyLoans.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-50">
          <div className="flex items-center justify-between gap-4 mb-2">
            <p className="text-xs text-gray-400">Mortgages</p>
            {loansExpiringSoon.length > 0 && (
              <span className="text-xs font-medium text-orange-700 bg-orange-50 px-2 py-1 rounded-full">
                {loansExpiringSoon.length} rate
                {loansExpiringSoon.length === 1 ? '' : 's'} expiring within 90d
              </span>
            )}
          </div>

          <div className="space-y-2">
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
                  className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 text-sm py-2"
                >
                  <div className="text-gray-600 flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-800">{loan.lender}</span>
                    <span>·</span>
                    <span>
                      {loan.loan_type} {loan.interest_rate}%
                    </span>

                    {loan.loan_type === 'Fixed' && loan.fixed_rate_expiry && (
                      <span className="text-xs text-gray-400">
                        · Fixed until{' '}
                        {new Date(loan.fixed_rate_expiry).toLocaleDateString(
                          'en-AU',
                          { month: 'short', year: 'numeric' }
                        )}
                      </span>
                    )}

                    {badge && (
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}
                      >
                        {badge.label}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-medium text-gray-900">
                      {formatCurrency(loan.current_balance)}
                    </span>
                    <button
                      onClick={() => setRefinancingLoan({ loan, property })}
                      className="flex items-center gap-1 text-xs bg-primary-50 hover:bg-primary-100 text-primary-600 font-medium px-2 py-1 rounded-md transition-colors"
                      type="button"
                    >
                      Refinance
                    </button>
                    <button
                      onClick={() => setEditingLoan(loan)}
                      className="text-gray-400 hover:text-primary-600 transition-colors"
                      type="button"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-gray-50">
        <button
          onClick={() => setCashFlowPropertyId(property.id)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-green-600 font-medium transition-colors"
          type="button"
        >
          <DollarSign size={13} />
          Add Transaction
        </button>

        <span className="text-gray-200">·</span>

        <button
          onClick={() => {
            setAddLoanPropertyId(property.id)
            setShowAddLoan(true)
          }}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 font-medium transition-colors"
          type="button"
        >
          <CreditCard size={13} />
          Add Mortgage
        </button>

        <span className="text-gray-200">·</span>

        <button
          onClick={() => setEditingProperty(property)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 font-medium transition-colors"
          type="button"
        >
          <Pencil size={13} />
          Edit Property
        </button>
      </div>
    </div>
  )
}

function MetricItem({ label, value, valueClassName = 'text-gray-900' }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-sm font-semibold ${valueClassName}`}>{value}</p>
    </div>
  )
}

function SoftMetricItem({ label, value, valueClassName = 'text-gray-900' }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-sm font-semibold mt-1 ${valueClassName}`}>{value}</p>
    </div>
  )
}