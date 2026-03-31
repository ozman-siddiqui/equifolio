import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { Home, Plus, Search, Building2 } from 'lucide-react'

import AddPropertyModal from '../components/AddPropertyModal'
import EditPropertyModal from '../components/EditPropertyModal'
import UpgradeModal from '../components/UpgradeModal'
import PropertyCard from '../components/PropertyCard'
import { utilityPrimaryButtonClass } from '../components/CardPrimitives'
import usePortfolioData from '../hooks/usePortfolioData'

const PLAN_LIMITS = { starter: 3, investor: 10, premium: Infinity }

export default function Properties() {
  const navigate = useNavigate()

  const [session, setSession] = useState(null)
  const [subscription, setSubscription] = useState(null)

  const { properties, loans, transactions, loading, fetchData } = usePortfolioData()

  const [showAddProperty, setShowAddProperty] = useState(false)
  const [editingProperty, setEditingProperty] = useState(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [propertyUseFilter, setPropertyUseFilter] = useState('all')
  const [sortBy, setSortBy] = useState('value_desc')

  const handlePortfolioSave = (options) => fetchData(options)

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

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0)

  const metrics = useMemo(() => {
    const totalValue = properties.reduce((sum, p) => sum + Number(p.current_value || 0), 0)
    const totalDebt = loans.reduce((sum, l) => sum + Number(l.current_balance || 0), 0)
    return {
      count: properties.length,
      totalValue,
      totalDebt,
      totalEquity: totalValue - totalDebt,
    }
  }, [properties, loans])

  const filteredProperties = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()

    const filtered = properties.filter((property) => {
      const matchesSearch =
        q === '' ||
        [property.address, property.suburb, property.state, property.property_type]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))

      const matchesUse =
        propertyUseFilter === 'all' || property.property_use === propertyUseFilter

      return matchesSearch && matchesUse
    })

    return [...filtered].sort((a, b) => {
      const aValue = Number(a.current_value || 0)
      const bValue = Number(b.current_value || 0)

      const aGrowth = Number(a.current_value || 0) - Number(a.purchase_price || 0)
      const bGrowth = Number(b.current_value || 0) - Number(b.purchase_price || 0)

      if (sortBy === 'value_asc') return aValue - bValue
      if (sortBy === 'growth_desc') return bGrowth - aGrowth
      if (sortBy === 'growth_asc') return aGrowth - bGrowth
      if (sortBy === 'address_asc') return String(a.address || '').localeCompare(String(b.address || ''))
      return bValue - aValue
    })
  }, [properties, searchTerm, propertyUseFilter, sortBy])

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
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-medium text-primary-700 bg-primary-50 px-3 py-1 rounded-full mb-4">
                  <Building2 size={13} />
                  Portfolio Workspace
                </div>
                <h1 className="text-[28px] font-medium tracking-[-0.3px] text-[var(--color-text-primary)]">
                  Properties
                </h1>
                <p className="mt-2 max-w-2xl text-[13px] font-normal leading-[1.6] text-[var(--color-text-secondary)]">
                  Browse your portfolio at a glance. Open any property to manage cash flow,
                  mortgages, refinance options, and AI insights.
                </p>
              </div>

              <button
                onClick={handleOpenAddProperty}
                className={utilityPrimaryButtonClass}
              >
                <Plus size={15} />
                Add Property
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 p-6 md:p-8 bg-gray-50/70">
            <SummaryCard label="Properties" value={metrics.count} />
            <SummaryCard label="Portfolio Value" value={formatCurrency(metrics.totalValue)} />
            <SummaryCard label="Total Debt" value={formatCurrency(metrics.totalDebt)} />
            <SummaryCard
              label="Total Equity"
              value={formatCurrency(metrics.totalEquity)}
              valueClassName={metrics.totalEquity >= 0 ? 'text-green-600' : 'text-red-500'}
            />
          </div>
        </section>

        <section className="mt-6 bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-6">
                <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
                  Search
                </label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by address, suburb, state, or property type"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="lg:col-span-3">
                <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
                  Use
                </label>
                <select
                  value={propertyUseFilter}
                  onChange={(e) => setPropertyUseFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Uses</option>
                  <option value="owner_occupied">Owner Occupied</option>
                  <option value="investment">Investment</option>
                </select>
              </div>

              <div className="lg:col-span-3">
                <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">
                  Sort
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="value_desc">Value: High to Low</option>
                  <option value="value_asc">Value: Low to High</option>
                  <option value="growth_desc">Growth: High to Low</option>
                  <option value="growth_asc">Growth: Low to High</option>
                  <option value="address_asc">Address: A-Z</option>
                </select>
              </div>
            </div>
          </div>

          {filteredProperties.length === 0 ? (
            <div className="p-12 text-center">
              <Home className="mx-auto text-gray-300 mb-3" size={28} />
              <h3 className="text-[15px] font-medium text-[var(--color-text-primary)]">No properties found</h3>
              <p className="mt-2 text-[13px] font-normal leading-[1.6] text-[var(--color-text-secondary)]">
                Try another filter or add your first property.
              </p>
            </div>
          ) : (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              {filteredProperties.map((property) => {
                const propertyLoans = loans.filter(
                  (l) => String(l.property_id) === String(property.id)
                )
                const propertyTransactions = transactions.filter(
                  (t) => String(t.property_id) === String(property.id)
                )

                return (
                  <PropertyCard
                    key={property.id}
                    property={property}
                    propertyLoans={propertyLoans}
                    propertyTransactions={propertyTransactions}
                    formatCurrency={formatCurrency}
                    onClick={() => navigate(`/property/${property.id}`)}
                    onEdit={() => setEditingProperty(property)}
                  />
                )
              })}
            </div>
          )}
        </section>
      </main>

      {showAddProperty && session?.user?.id && (
        <AddPropertyModal
          userId={session.user.id}
          onClose={() => setShowAddProperty(false)}
          onSave={handlePortfolioSave}
        />
      )}

      {editingProperty && session?.user?.id && (
        <EditPropertyModal
          property={editingProperty}
          userId={session.user.id}
          onClose={() => setEditingProperty(null)}
          onSave={handlePortfolioSave}
        />
      )}

      {showUpgradeModal && (
        <UpgradeModal
          currentPlan={subscription?.plan || 'starter'}
          currentCount={properties.length}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
    </div>
  )
}

function SummaryCard({ label, value, valueClassName = 'text-gray-900' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.09em] text-[var(--color-text-tertiary)]">{label}</p>
      <p className={`text-[26px] font-medium tracking-[-0.5px] ${valueClassName}`}>{value}</p>
    </div>
  )
}
