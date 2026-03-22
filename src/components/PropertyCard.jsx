import {
  Bath,
  BedDouble,
  Building2,
  CarFront,
  ChevronRight,
  CreditCard,
  Home,
  Ruler,
} from 'lucide-react'

export default function PropertyCard({
  property,
  propertyLoans = [],
  propertyTransactions = [],
  onClick,
  onEdit,
  formatCurrency,
}) {
  const currentValue = Number(property.current_value || 0)
  const purchasePrice = Number(property.purchase_price || 0)
  const totalDebt = propertyLoans.reduce(
    (sum, loan) => sum + Number(loan.current_balance || 0),
    0
  )
  const equity = currentValue - totalDebt
  const growth = currentValue - purchasePrice
  const growthPct =
    purchasePrice > 0 ? ((growth / purchasePrice) * 100).toFixed(1) : '0.0'
  const lvr = currentValue > 0 ? ((totalDebt / currentValue) * 100).toFixed(1) : '0.0'
  const features = getPropertyFeatures(property)

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md hover:border-gray-200 transition-all">
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={onClick}
          className="flex-1 text-left group"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-700 transition-colors">
              {property.address}
            </h3>

            {property.property_use === 'owner_occupied' && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                Owner Occupied
              </span>
            )}
          </div>

          <p className="text-sm text-gray-500 mt-1">
            {property.suburb}, {property.state}
            {property.property_type ? ` - ${property.property_type}` : ''}
          </p>

          {features.length > 0 ? (
            <div className="flex flex-wrap gap-x-3 gap-y-2 mt-3">
              {features.map((feature) => {
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

          <div className="flex flex-wrap gap-2 mt-4">
            <Chip
              icon={<Building2 size={12} />}
              label={`${propertyLoans.length} mortgage${propertyLoans.length === 1 ? '' : 's'}`}
            />
            <Chip
              icon={<CreditCard size={12} />}
              label={`${propertyTransactions.length} transaction${propertyTransactions.length === 1 ? '' : 's'}`}
            />
            <Chip icon={<Home size={12} />} label={`LVR ${lvr}%`} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
            <Metric label="Value" value={formatCurrency(currentValue)} />
            <Metric label="Debt" value={formatCurrency(totalDebt)} />
            <Metric
              label="Equity"
              value={formatCurrency(equity)}
              valueClassName={equity >= 0 ? 'text-green-600' : 'text-red-500'}
            />
            <Metric
              label="Growth"
              value={`${growth >= 0 ? '+' : ''}${formatCurrency(growth)}`}
              subValue={`${growthPct}%`}
              valueClassName={growth >= 0 ? 'text-green-600' : 'text-red-500'}
            />
          </div>

          <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary-600">
            View property workspace
            <ChevronRight
              size={16}
              className="group-hover:translate-x-0.5 transition-transform"
            />
          </div>
        </button>

        <div className="flex-shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  )
}

function Chip({ icon, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-100 text-xs text-gray-600">
      {icon}
      {label}
    </span>
  )
}

function Metric({ label, value, subValue, valueClassName = 'text-gray-900' }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-sm font-semibold ${valueClassName}`}>{value}</p>
      {subValue ? <p className="text-xs text-gray-400 mt-0.5">{subValue}</p> : null}
    </div>
  )
}

function getPropertyFeatures(property) {
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
