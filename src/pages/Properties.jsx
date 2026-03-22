import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import {
  Home,
  Plus,
  Building2,
  CreditCard,
  TrendingUp,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'

import AddPropertyModal from '../components/AddPropertyModal'
import AddLoanModal from '../components/AddLoanModal'
import EditPropertyModal from '../components/EditPropertyModal'
import EditLoanModal from '../components/EditLoanModal'
import CashFlowModal from '../components/CashFlowModal'
import EditTransactionModal from '../components/EditTransactionModal'
import RefinanceModal from '../components/RefinanceModal'
import UpgradeModal from '../components/UpgradeModal'
import PropertyCard from '../components/PropertyCard'
import usePortfolioData from '../hooks/usePortfolioData'

const PLAN_LIMITS = { starter: 3, investor: 10, premium: Infinity }

export default function Properties() {
  const navigate = useNavigate()

  const [session, setSession] = useState(null)
  const [subscription, setSubscription] = useState(null)

  const { properties, loans, transactions, loading, fetchData } = usePortfolioData()

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

  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('value_desc')
  const [propertyUseFilter, setPropertyUseFilter] = useState('all')
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('all')

  useEffect(() => {
    initialisePage()
  }, [])

  const initialisePage = async () => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession()

    setSession(currentSession || null)

    if (currentSession?.user?.id) {
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', currentSession.user.id)
        .maybeSingle()

      setSubscription(subData || null)
    }
  }

  const toggleCashFlow = (id) => {
    setExpandedCashFlow((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

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
      (sum, property) => sum + Number(property.current_value || 0),
      0
    )

    const totalDebt = loans.reduce(
      (sum, loan) => sum + Number(loan.current_balance || 0),
      0
    )

    const totalEquity = totalValue - totalDebt

    const totalGrowth = properties.reduce((sum, property) => {
      return (
        sum +
        (Number(property.current_value || 0) -
          Number(property.purchase_price || 0))
      )
    }, 0)

    return {
      totalValue,
      totalDebt,
      totalEquity,
      totalGrowth,
    }
  }, [properties, loans])

  const propertyTypeOptions = useMemo(() => {
    const uniqueTypes = [
      ...new Set(
        properties
          .map((property) => property.property_type)
          .filter(Boolean)
      ),
    ]

    return uniqueTypes.sort((a, b) => a.localeCompare(b))
  }, [properties])

  const filteredAndSortedProperties = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    const filtered = properties.filter((property) => {
      const matchesSearch =
        normalizedSearch === '' ||
        [
          property.address,
          property.suburb,
          property.state,
          property.property_type,
        ]
          .filter(Boolean)
          .some((field) =>
            String(field).toLowerCase().includes(normalizedSearch)
          )

      const matchesUse =
        propertyUseFilter === 'all' ||
        property.property_use === propertyUseFilter

      const matchesType =
        propertyTypeFilter === 'all' ||
        property.property_type === propertyTypeFilter

      return matchesSearch && matchesUse && matchesType
    })

    const sorted = [...filtered].sort((a, b) => {
      const aValue = Number(a.current_value || 0)
      const bValue = Number(b.current_value || 0)
      const aPurchase = Number(a.purchase_price || 0)
      const bPurchase = Number(b.purchase_price || 0)
      const aGrowth = aValue - aPurchase
      const bGrowth = bValue - bPurchase
      const aAddress = String(a.address || '')
      const bAddress = String(b.address || '')

      switch (sortBy) {
        case 'value_asc':
          return aValue - bValue
        case 'value_desc':
          return bValue - aValue
        case 'growth_desc':
          return bGrowth - aGrowth
        case 'growth_asc':
          return aGrowth - bGrowth
        case 'address_asc':
          return aAddress.localeCompare(bAddress)
        case 'address_desc':
          return bAddress.localeCompare(aAddress)
        case 'recently_added':
        default:
          return String(b.id).localeCompare(String(a.id))
      }
    })

    return sorted
  }, [properties, searchTerm, propertyUseFilter, propertyTypeFilter, sortBy])

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    sortBy !== 'value_desc' ||
    propertyUseFilter !== 'all' ||
    propertyTypeFilter !== 'all'

  const clearFilters = () => {
    setSearchTerm('')
    setSortBy('value_desc')
    setPropertyUseFilter('all')
    setPropertyTypeFilter('all')
  }

  const handleDeleteTransaction = async (txnId) => {
    if (!window.confirm('Delete this transaction?')) return
    await supabase.from('transactions').delete().eq('id', txnId)
    fetchData()
  }

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
        <div className="text-gray-400">Loading properties...</div>
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
                  Portfolio Properties
                </div>

                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                  Properties
                </h1>

                <p className="text-gray-500 mt-2 max-w-2xl">
                  View, manage, and drill into each property across value, debt,
                  cash flow, and mortgage structure.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
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

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 p-6 md:p-8 bg-gray-50/70">
            <SummaryCard
              icon={<Home size={16} />}
              label="Properties"
              value={properties.length}
            />
            <SummaryCard
              icon={<TrendingUp size={16} />}
              label="Portfolio Value"
              value={formatCurrency(portfolioMetrics.totalValue)}
            />
            <SummaryCard
              icon={<CreditCard size={16} />}
              label="Total Debt"
              value={formatCurrency(portfolioMetrics.totalDebt)}
            />
            <SummaryCard
              icon={<Building2 size={16} />}
              label="Total Equity"
              value={formatCurrency(portfolioMetrics.totalEquity)}
              valueClassName={
                portfolioMetrics.totalEquity >= 0
                  ? 'text-green-600'
                  : 'text-red-500'
              }
            />
          </div>
        </section>

        <section className="mt-6 bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div>
                <h2 className="font-semibold text-gray-900">Your Properties</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {filteredAndSortedProperties.length === 0
                    ? 'No matching properties'
                    : `${filteredAndSortedProperties.length} ${
                        filteredAndSortedProperties.length === 1
                          ? 'property'
                          : 'properties'
                      } shown`}
                  {properties.length > 0 &&
                  filteredAndSortedProperties.length !== properties.length
                    ? ` · ${properties.length} total`
                    : ''}
                </p>
              </div>

              {properties.length > 0 && (
                <div className="text-sm text-gray-400">
                  Click any property card to view full details
                </div>
              )}
            </div>

            {properties.length > 0 && (
              <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-5">
                  <label className="block text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
                    Search
                  </label>
                  <div className="relative">
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by address, suburb, state, or type"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                <div className="lg:col-span-3">
                  <label className="block text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
                    Sort
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="value_desc">Value: High to Low</option>
                    <option value="value_asc">Value: Low to High</option>
                    <option value="growth_desc">Growth: High to Low</option>
                    <option value="growth_asc">Growth: Low to High</option>
                    <option value="address_asc">Address: A to Z</option>
                    <option value="address_desc">Address: Z to A</option>
                    <option value="recently_added">Recently Added</option>
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
                    Use
                  </label>
                  <select
                    value={propertyUseFilter}
                    onChange={(e) => setPropertyUseFilter(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="all">All Uses</option>
                    <option value="owner_occupied">Owner Occupied</option>
                    <option value="investment">Investment</option>
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
                    Type
                  </label>
                  <select
                    value={propertyTypeFilter}
                    onChange={(e) => setPropertyTypeFilter(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="all">All Types</option>
                    {propertyTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {properties.length > 0 && hasActiveFilters && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full">
                  <SlidersHorizontal size={13} />
                  Filters active
                </div>

                {searchTerm.trim() !== '' && (
                  <FilterPill
                    label={`Search: ${searchTerm}`}
                    onClear={() => setSearchTerm('')}
                  />
                )}

                {propertyUseFilter !== 'all' && (
                  <FilterPill
                    label={`Use: ${
                      propertyUseFilter === 'owner_occupied'
                        ? 'Owner Occupied'
                        : 'Investment'
                    }`}
                    onClear={() => setPropertyUseFilter('all')}
                  />
                )}

                {propertyTypeFilter !== 'all' && (
                  <FilterPill
                    label={`Type: ${propertyTypeFilter}`}
                    onClear={() => setPropertyTypeFilter('all')}
                  />
                )}

                {sortBy !== 'value_desc' && (
                  <FilterPill
                    label="Custom sort"
                    onClear={() => setSortBy('value_desc')}
                  />
                )}

                <button
                  onClick={clearFilters}
                  className="text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {properties.length === 0 ? (
            <div className="p-12 md:p-16 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Home className="text-gray-400" size={26} />
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No properties yet
              </h3>

              <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
                Add your first property to start tracking portfolio value, cash
                flow, mortgages, and deeper AI-driven insights.
              </p>

              <button
                onClick={handleOpenAddProperty}
                className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
              >
                <Plus size={16} />
                Add your first property
              </button>
            </div>
          ) : filteredAndSortedProperties.length === 0 ? (
            <div className="p-12 md:p-16 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Search className="text-gray-400" size={24} />
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No matching properties
              </h3>

              <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
                Try adjusting your search or filters to find the property you’re
                looking for.
              </p>

              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
              >
                <X size={16} />
                Clear filters
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filteredAndSortedProperties.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  loans={loans}
                  transactions={transactions}
                  thisMonthTxns={thisMonthTxns}
                  now={now}
                  expandedCashFlow={expandedCashFlow}
                  toggleCashFlow={toggleCashFlow}
                  navigate={navigate}
                  setEditingTransaction={setEditingTransaction}
                  handleDeleteTransaction={handleDeleteTransaction}
                  setRefinancingLoan={setRefinancingLoan}
                  setEditingLoan={setEditingLoan}
                  setCashFlowPropertyId={setCashFlowPropertyId}
                  setAddLoanPropertyId={setAddLoanPropertyId}
                  setShowAddLoan={setShowAddLoan}
                  setEditingProperty={setEditingProperty}
                  formatCurrency={formatCurrency}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {showAddProperty && session?.user?.id && (
        <AddPropertyModal
          userId={session.user.id}
          onClose={() => setShowAddProperty(false)}
          onSave={fetchData}
        />
      )}

      {showAddLoan && session?.user?.id && (
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
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  valueClassName = 'text-gray-900',
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 text-gray-400 mb-3">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className={`text-xl md:text-2xl font-bold ${valueClassName}`}>
        {value}
      </p>
    </div>
  )
}

function FilterPill({ label, onClear }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-full">
      {label}
      <button
        onClick={onClear}
        className="text-gray-400 hover:text-gray-600 transition-colors"
        type="button"
      >
        <X size={12} />
      </button>
    </span>
  )
}