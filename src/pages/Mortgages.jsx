import { useMemo, useState } from 'react'
import { CreditCard, Plus, Search, AlertTriangle } from 'lucide-react'
import usePortfolioData from '../hooks/usePortfolioData'
import AddLoanModal from '../components/AddLoanModal'
import EditLoanModal from '../components/EditLoanModal'
import RefinanceModal from '../components/RefinanceModal'

export default function Mortgages() {
  const { properties, loans, loading, fetchData } = usePortfolioData()

  const [showAddLoan, setShowAddLoan] = useState(false)
  const [editingLoan, setEditingLoan] = useState(null)
  const [refinancingLoan, setRefinancingLoan] = useState(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [loanTypeFilter, setLoanTypeFilter] = useState('all')

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0)

  const propertyMap = useMemo(
    () => Object.fromEntries(properties.map((p) => [String(p.id), p])),
    [properties]
  )

  const filteredLoans = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()

    return loans.filter((loan) => {
      const property = propertyMap[String(loan.property_id)]
      const matchesSearch =
        q === '' ||
        [loan.lender, property?.address, property?.suburb, property?.state]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))

      const matchesType =
        loanTypeFilter === 'all' || loan.loan_type === loanTypeFilter

      return matchesSearch && matchesType
    })
  }, [loans, propertyMap, searchTerm, loanTypeFilter])

  const metrics = useMemo(() => {
    const totalDebt = loans.reduce((sum, loan) => sum + Number(loan.current_balance || 0), 0)
    const expiringSoon = loans.filter((loan) => {
      if (loan.loan_type !== 'Fixed' || !loan.fixed_rate_expiry) return false
      const days = Math.ceil((new Date(loan.fixed_rate_expiry) - new Date()) / (1000 * 60 * 60 * 24))
      return days > 0 && days <= 90
    }).length

    return { totalDebt, count: loans.length, expiringSoon }
  }, [loans])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading mortgages...</div>
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
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Mortgages</h1>
                <p className="text-gray-500 mt-2 max-w-2xl">
                  Portfolio-wide debt tracking. Manage refinance opportunities here or from
                  the property detail page.
                </p>
              </div>

              <button
                onClick={() => setShowAddLoan(true)}
                className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
              >
                <Plus size={16} />
                Add Mortgage
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 p-6 md:p-8 bg-gray-50/70">
            <SummaryCard label="Loans" value={metrics.count} />
            <SummaryCard label="Total Debt" value={formatCurrency(metrics.totalDebt)} />
            <SummaryCard
              label="Expiring ≤ 90d"
              value={metrics.expiringSoon}
              valueClassName={metrics.expiringSoon > 0 ? 'text-amber-700' : 'text-gray-900'}
            />
          </div>
        </section>

        <section className="mt-6 bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8">
              <label className="block text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Search</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search lender or property"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="lg:col-span-4">
              <label className="block text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Loan Type</label>
              <select
                value={loanTypeFilter}
                onChange={(e) => setLoanTypeFilter(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Loan Types</option>
                <option value="Fixed">Fixed</option>
                <option value="Variable">Variable</option>
                <option value="Split">Split</option>
              </select>
            </div>
          </div>

          {filteredLoans.length === 0 ? (
            <div className="p-12 text-center">
              <CreditCard className="mx-auto text-gray-300 mb-3" size={28} />
              <h3 className="text-lg font-semibold text-gray-900">No mortgages found</h3>
              <p className="text-sm text-gray-500 mt-2">
                Add a loan or adjust your filters.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filteredLoans.map((loan) => {
                const property = propertyMap[String(loan.property_id)]
                const daysUntil = loan.fixed_rate_expiry
                  ? Math.ceil((new Date(loan.fixed_rate_expiry) - new Date()) / (1000 * 60 * 60 * 24))
                  : null

                return (
                  <div key={loan.id} className="p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{loan.lender}</h3>
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                          {loan.loan_type}
                        </span>
                        <span className="text-sm text-gray-500">{loan.interest_rate}%</span>

                        {loan.loan_type === 'Fixed' && daysUntil && daysUntil > 0 && daysUntil <= 90 && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                            <AlertTriangle size={12} />
                            {daysUntil} days to expiry
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-500 mt-1">
                        {property?.address || 'Unknown property'}
                        {property?.suburb ? ` · ${property.suburb}, ${property.state}` : ''}
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
        </section>
      </main>

      {showAddLoan && (
        <AddLoanModal
          properties={properties}
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

function SummaryCard({ label, value, valueClassName = 'text-gray-900' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl md:text-2xl font-bold ${valueClassName}`}>{value}</p>
    </div>
  )
}