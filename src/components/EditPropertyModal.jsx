import { useState } from 'react'
import { supabase } from '../supabase'
import { X } from 'lucide-react'

const RENT_FREQUENCIES = ['weekly', 'fortnightly', 'monthly', 'annual']

export default function EditPropertyModal({ property, onClose, onSave }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({
    address: property.address || '',
    suburb: property.suburb || '',
    state: property.state || 'NSW',
    property_type: property.property_type || 'House',
    property_use: property.property_use || 'investment',
    purchase_price: property.purchase_price || '',
    current_value: property.current_value || '',
    purchase_date: property.purchase_date || '',
    bedrooms: property.bedrooms || '',
    bathrooms: property.bathrooms || '',
    land_size: property.land_size || '',
    garages: property.garages || '',
    lease_expiry_date: property.lease_expiry_date || '',
    current_rent_amount: property.current_rent_amount ?? '',
    current_rent_frequency: property.current_rent_frequency || 'weekly',
  })

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.from('properties').update({
      address: form.address,
      suburb: form.suburb,
      state: form.state,
      property_type: form.property_type,
      property_use: form.property_use,
      purchase_price: Number(form.purchase_price),
      current_value: Number(form.current_value),
      purchase_date: form.purchase_date,
      bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
      bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
      land_size: form.land_size ? Number(form.land_size) : null,
      garages: form.garages ? Number(form.garages) : null,
      lease_expiry_date: form.lease_expiry_date || null,
      current_rent_amount:
        form.property_use === 'investment' && form.current_rent_amount !== ''
          ? Number(form.current_rent_amount)
          : null,
      current_rent_frequency:
        form.property_use === 'investment' && form.current_rent_amount !== ''
          ? form.current_rent_frequency
          : null,
    }).eq('id', property.id)

    if (error) { setError(error.message); setLoading(false) }
    else { onSave(); onClose() }
  }

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this property? This will also delete all associated mortgages and transactions.')) return
    await supabase.from('properties').delete().eq('id', property.id)
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Edit Property</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Property Use</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setForm({ ...form, property_use: 'investment' })}
                className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  form.property_use === 'investment'
                    ? 'bg-primary-600 text-white'
                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                Investment Property
              </button>
              <button type="button" onClick={() => setForm({ ...form, property_use: 'owner_occupied' })}
                className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  form.property_use === 'owner_occupied'
                    ? 'bg-primary-600 text-white'
                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                Owner Occupied
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
            <input name="address" value={form.address} onChange={handleChange} required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Suburb</label>
              <input name="suburb" value={form.suburb} onChange={handleChange} required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <select name="state" value={form.state} onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                {['NSW','VIC','QLD','WA','SA','TAS','ACT','NT'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
            <select name="property_type" value={form.property_type} onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              {['House','Apartment','Townhouse','Villa','Land','Commercial'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price ($)</label>
              <input name="purchase_price" value={form.purchase_price} onChange={handleChange} required type="number" min="0"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Value ($)</label>
              <input name="current_value" value={form.current_value} onChange={handleChange} required type="number" min="0"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
            <input name="purchase_date" value={form.purchase_date} onChange={handleChange} required type="date"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bedrooms</label>
              <input name="bedrooms" value={form.bedrooms} onChange={handleChange} type="number" min="0" max="20"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bathrooms</label>
              <input name="bathrooms" value={form.bathrooms} onChange={handleChange} type="number" min="0" max="20"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Land Size (m²)</label>
              <input name="land_size" value={form.land_size} onChange={handleChange} type="number" min="0"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Garages</label>
              <input name="garages" value={form.garages} onChange={handleChange} type="number" min="0" max="10"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          {form.property_use === 'investment' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Rent <span className="text-gray-400 font-normal">optional</span>
                  </label>
                  <input
                    name="current_rent_amount"
                    value={form.current_rent_amount}
                    onChange={handleChange}
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rent Frequency
                  </label>
                  <select
                    name="current_rent_frequency"
                    value={form.current_rent_frequency}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {RENT_FREQUENCIES.map((frequency) => (
                      <option key={frequency} value={frequency}>
                        {frequency.charAt(0).toUpperCase() + frequency.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lease Expiry Date <span className="text-gray-400 font-normal">optional</span>
                </label>
                <input name="lease_expiry_date" value={form.lease_expiry_date} onChange={handleChange} type="date"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleDelete}
              className="px-4 py-2.5 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50">
              Delete
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
