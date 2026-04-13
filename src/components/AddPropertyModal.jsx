import { useState } from 'react'
import { supabase } from '../supabase'
import { X } from 'lucide-react'

const RENT_FREQUENCIES = ['weekly', 'fortnightly', 'monthly', 'annual']

export default function AddPropertyModal({ onClose, onSave, userId }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({
    address: '',
    suburb: '',
    state: 'NSW',
    property_type: 'House',
    property_use: 'investment',
    is_debt_free: false,
    purchase_price: '',
    current_value: '',
    purchase_date: '',
    bedrooms: '',
    bathrooms: '',
    land_size: '',
    garages: '',
    lease_expiry_date: '',
    current_rent_amount: '',
    current_rent_frequency: 'weekly',
  })

  const handleFieldChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))
  const handleChange = (e) => handleFieldChange(e.target.name, e.target.value)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const {
      data: { session: liveSession },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !liveSession?.user?.id) {
      console.error('AddPropertyModal live session check failed', {
        userId,
        sessionError,
        liveSession,
      })
      setError('Your session has expired. Please sign in again and retry.')
      setLoading(false)
      return
    }

    const payload = {
      address: form.address,
      suburb: form.suburb,
      state: form.state,
      property_type: form.property_type,
      property_use: form.property_use,
      is_debt_free: form.is_debt_free === true,
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
      user_id: liveSession.user.id,
    }

    console.log('AddPropertyModal insert attempt', {
      userId,
      payload,
      payloadUserId: payload.user_id,
    })

    const { error: insertError } = await supabase.from('properties').insert([payload])

    if (insertError) {
      console.error('AddPropertyModal insert failed', {
        userId,
        payload,
        payloadUserId: payload.user_id,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code,
      })
      setError(insertError.message)
      setLoading(false)
      return
    }

    try {
      await onSave({ force: true })
      onClose()
    } catch (refreshError) {
      setError(
        refreshError?.message ||
          'Property was added, but the latest portfolio data could not be refreshed.'
      )
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Add Property</h2>
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
            <input name="address" value={form.address} onChange={handleChange} required placeholder="123 Main Street"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Suburb</label>
              <input name="suburb" value={form.suburb} onChange={handleChange} required placeholder="Surry Hills"
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
              <input name="purchase_price" value={form.purchase_price} onChange={handleChange} required type="number" min="0" placeholder="750000"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Value ($)</label>
              <input name="current_value" value={form.current_value} onChange={handleChange} required type="number" min="0" placeholder="900000"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Owned outright
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                This property has no mortgage or outstanding debt
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleFieldChange('is_debt_free', !form.is_debt_free)}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
              style={{
                background: form.is_debt_free ? '#19C37D' : '#E2E8F0'
              }}
            >
              <span
                className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
                style={{
                  transform: form.is_debt_free ? 'translateX(22px)' : 'translateX(2px)'
                }}
              />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
            <input name="purchase_date" value={form.purchase_date} onChange={handleChange} required type="date"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bedrooms</label>
              <input name="bedrooms" value={form.bedrooms} onChange={handleChange} type="number" min="0" max="20" placeholder="3"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bathrooms</label>
              <input name="bathrooms" value={form.bathrooms} onChange={handleChange} type="number" min="0" max="20" placeholder="2"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Land Size (m²) <span className="text-gray-400 font-normal">optional</span></label>
              <input name="land_size" value={form.land_size} onChange={handleChange} type="number" min="0" placeholder="450"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Garages <span className="text-gray-400 font-normal">optional</span></label>
              <input name="garages" value={form.garages} onChange={handleChange} type="number" min="0" max="10" placeholder="1"
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
                    placeholder="800"
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
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Saving...' : 'Add Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
