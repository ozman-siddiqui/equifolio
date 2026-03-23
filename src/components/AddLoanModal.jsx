import { useState } from 'react'
import { supabase } from '../supabase'
import { X } from 'lucide-react'

export default function AddLoanModal({ onClose, onSave, userId, properties, preselectedPropertyId }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({
    property_id: preselectedPropertyId || properties[0]?.id || '',
    lender: '',
    loan_amount: '',
    current_balance: '',
    interest_rate: '',
    loan_type: 'Variable',
    fixed_variable: 'Variable',
    repayment_type: 'Principal and Interest',
    fixed_rate_expiry: '',
    monthly_repayment: '',
    interest_only_expiry: '',
    remaining_term_years: '',
    offset_balance: '',
    refinance_cost_estimate: ''
  })

  const handleChange = (e) => {
    const updated = { ...form, [e.target.name]: e.target.value }
    if (e.target.name === 'loan_type' && e.target.value !== 'Fixed') {
      updated.fixed_rate_expiry = ''
    }
    if (e.target.name === 'repayment_type' && e.target.value !== 'Interest Only') {
      updated.interest_only_expiry = ''
    }
    setForm(updated)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const remainingTermYears = Number(form.remaining_term_years)
    const offsetBalance = form.offset_balance === '' ? null : Number(form.offset_balance)
    const refinanceCostEstimate =
      form.refinance_cost_estimate === '' ? null : Number(form.refinance_cost_estimate)

    if (!Number.isFinite(remainingTermYears) || remainingTermYears <= 0) {
      setError('Remaining term must be greater than 0 years.')
      setLoading(false)
      return
    }

    if (offsetBalance !== null && offsetBalance < 0) {
      setError('Offset balance must be 0 or greater.')
      setLoading(false)
      return
    }

    if (refinanceCostEstimate !== null && refinanceCostEstimate < 0) {
      setError('Estimated refinance cost must be 0 or greater.')
      setLoading(false)
      return
    }

    const { error } = await supabase.from('loans').insert([{
      ...form,
      user_id: userId,
      loan_amount: Number(form.loan_amount),
      current_balance: Number(form.current_balance),
      interest_rate: Number(form.interest_rate),
      monthly_repayment: Number(form.monthly_repayment),
      fixed_rate_expiry: form.loan_type === 'Fixed' && form.fixed_rate_expiry ? form.fixed_rate_expiry : null,
      interest_only_expiry: form.repayment_type === 'Interest Only' && form.interest_only_expiry ? form.interest_only_expiry : null,
      fixed_variable: form.fixed_variable,
      remaining_term_months: Math.round(remainingTermYears * 12),
      offset_balance: offsetBalance,
      refinance_cost_estimate: refinanceCostEstimate,
    }])

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      onSave()
      onClose()
    }
  }

  const isFixed = form.loan_type === 'Fixed'
  const isInterestOnly = form.repayment_type === 'Interest Only'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Add Mortgage</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
            <select name="property_id" value={form.property_id} onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              {properties.map(p => <option key={p.id} value={p.id}>{p.address}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lender</label>
            <input name="lender" value={form.lender} onChange={handleChange} required placeholder="Commonwealth Bank"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Original Loan Amount ($)</label>
              <input name="loan_amount" value={form.loan_amount} onChange={handleChange} required type="number" min="0" placeholder="600000"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Balance ($)</label>
              <input name="current_balance" value={form.current_balance} onChange={handleChange} required type="number" min="0" placeholder="550000"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Interest Rate (%)</label>
              <input name="interest_rate" value={form.interest_rate} onChange={handleChange} required type="number" min="0" step="0.01" placeholder="6.14"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Repayment ($)</label>
              <input name="monthly_repayment" value={form.monthly_repayment} onChange={handleChange} required type="number" min="0" placeholder="3200"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loan Type</label>
              <select name="loan_type" value={form.loan_type} onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option>Variable</option>
                <option>Fixed</option>
                <option>Split</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Type</label>
              <select name="repayment_type" value={form.repayment_type} onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option>Principal and Interest</option>
                <option>Interest Only</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate Type</label>
              <select
                name="fixed_variable"
                value={form.fixed_variable}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option>Variable</option>
                <option>Fixed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remaining Term (Years)</label>
              <input
                name="remaining_term_years"
                value={form.remaining_term_years}
                onChange={handleChange}
                required
                type="number"
                min="0.1"
                step="0.1"
                placeholder="25"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Offset Balance ($)</label>
              <input
                name="offset_balance"
                value={form.offset_balance}
                onChange={handleChange}
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Refinance Cost ($)</label>
              <input
                name="refinance_cost_estimate"
                value={form.refinance_cost_estimate}
                onChange={handleChange}
                type="number"
                min="0"
                step="0.01"
                placeholder="1200"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {isFixed && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fixed Rate Expiry Date</label>
              <input name="fixed_rate_expiry" value={form.fixed_rate_expiry} onChange={handleChange} type="date"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          )}

          {isInterestOnly && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Interest Only Expiry Date</label>
              <input name="interest_only_expiry" value={form.interest_only_expiry} onChange={handleChange} type="date"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Saving...' : 'Add Mortgage'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
