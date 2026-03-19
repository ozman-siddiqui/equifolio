import { useState } from 'react'
import { supabase } from '../supabase'
import { X } from 'lucide-react'

const INVESTMENT_INCOME = ['Rental Income', 'Bond/Deposit Received', 'Other Income']
const INVESTMENT_EXPENSE = [
  'Mortgage Repayment', 'Council Rates', 'Water Rates', 'Strata / Body Corporate',
  'Landlord Insurance', 'Property Management Fee', 'Maintenance & Repairs',
  'Land Tax', 'Advertising / Letting Fee', 'Other Expense'
]
const OWNER_INCOME = ['Other Income']
const OWNER_EXPENSE = [
  'Mortgage Repayment', 'Council Rates', 'Water Rates', 'Strata / Body Corporate',
  'Home Insurance', 'Electricity', 'Gas', 'Internet / Phone',
  'Lawn Mowing / Garden', 'Maintenance & Repairs', 'Other Expense'
]
const FREQUENCIES = ['Weekly', 'Fortnightly', 'Monthly', 'Quarterly', 'Annual']

export default function EditTransactionModal({ transaction, propertyUse, onClose, onSave }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({
    type: transaction.type || 'income',
    category: transaction.category || '',
    amount: transaction.amount || '',
    frequency: transaction.frequency || 'Monthly',
    date: transaction.date || '',
    description: transaction.description || ''
  })

  const handleChange = (e) => {
    const updated = { ...form, [e.target.name]: e.target.value }
    if (e.target.name === 'type') {
      const isInvestment = propertyUse !== 'owner_occupied'
      updated.category = e.target.value === 'income'
        ? (isInvestment ? 'Rental Income' : 'Other Income')
        : (isInvestment ? 'Mortgage Repayment' : 'Mortgage Repayment')
    }
    setForm(updated)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.from('transactions').update({
      type: form.type,
      category: form.category,
      amount: Number(form.amount),
      frequency: form.frequency,
      date: form.date,
      description: form.description || null
    }).eq('id', transaction.id)

    if (error) { setError(error.message); setLoading(false) }
    else { onSave(); onClose() }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this transaction?')) return
    await supabase.from('transactions').delete().eq('id', transaction.id)
    onSave()
    onClose()
  }

  const isInvestment = propertyUse !== 'owner_occupied'
  const incomeCategories = isInvestment ? INVESTMENT_INCOME : OWNER_INCOME
  const expenseCategories = isInvestment ? INVESTMENT_EXPENSE : OWNER_EXPENSE
  const categories = form.type === 'income' ? incomeCategories : expenseCategories

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Edit Transaction</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          {/* Type toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button"
                onClick={() => handleChange({ target: { name: 'type', value: 'income' } })}
                className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  form.type === 'income'
                    ? 'bg-green-600 text-white'
                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                ↑ Income
              </button>
              <button type="button"
                onClick={() => handleChange({ target: { name: 'type', value: 'expense' } })}
                className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  form.type === 'expense'
                    ? 'bg-red-500 text-white'
                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                ↓ Expense
              </button>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select name="category" value={form.category} onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
              <input name="amount" value={form.amount} onChange={handleChange}
                required type="number" min="0" step="0.01"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>

            {/* Frequency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
              <select name="frequency" value={form.frequency} onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input name="date" value={form.date} onChange={handleChange}
              required type="date"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-400 font-normal">optional</span>
            </label>
            <input name="description" value={form.description} onChange={handleChange}
              placeholder="e.g. March rent payment"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>

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