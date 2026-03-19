import { useState } from 'react'
import { supabase } from '../supabase'
import { X, Plus, Trash2 } from 'lucide-react'

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

const toMonthly = (amount, frequency) => {
  const multipliers = { Weekly: 52 / 12, Fortnightly: 26 / 12, Monthly: 1, Quarterly: 1 / 3, Annual: 1 / 12 }
  return Number(amount) * (multipliers[frequency] || 1)
}

const frequencyHint = {
  Weekly: '× 52 ÷ 12 = monthly equiv.',
  Fortnightly: '× 26 ÷ 12 = monthly equiv.',
  Monthly: 'entered as monthly',
  Quarterly: '÷ 3 = monthly equiv.',
  Annual: '÷ 12 = monthly equiv.',
}

const makeRow = (propertyUse, type = 'income') => ({
  type,
  category: type === 'income'
    ? (propertyUse === 'owner_occupied' ? 'Other Income' : 'Rental Income')
    : (propertyUse === 'owner_occupied' ? 'Mortgage Repayment' : 'Mortgage Repayment'),
  amount: '',
  frequency: type === 'income' ? 'Weekly' : 'Monthly',
  date: new Date().toISOString().slice(0, 10),
  description: ''
})

export default function CashFlowModal({ onClose, onSave, userId, propertyId, properties }) {
  const selectedProperty = properties.find(p => p.id === propertyId) || properties[0]
  const propertyUse = selectedProperty?.property_use || 'investment'

  const [currentPropertyId, setCurrentPropertyId] = useState(propertyId || properties[0]?.id || '')
  const [rows, setRows] = useState([makeRow(propertyUse)])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const currentPropUse = properties.find(p => p.id === currentPropertyId)?.property_use || 'investment'
  const incomeCategories = currentPropUse === 'owner_occupied' ? OWNER_INCOME : INVESTMENT_INCOME
  const expenseCategories = currentPropUse === 'owner_occupied' ? OWNER_EXPENSE : INVESTMENT_EXPENSE

  const updateRow = (index, field, value) => {
    setRows(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      // Auto-set default category when type changes
      if (field === 'type') {
        updated[index].category = value === 'income'
          ? incomeCategories[0]
          : expenseCategories[0]
        updated[index].frequency = value === 'income' ? 'Weekly' : 'Monthly'
      }
      return updated
    })
  }

  const addRow = () => setRows(prev => [...prev, makeRow(currentPropUse)])
  const removeRow = (index) => setRows(prev => prev.filter((_, i) => i !== index))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const valid = rows.filter(r => r.amount && Number(r.amount) > 0)
    if (valid.length === 0) { setError('Please enter at least one amount'); return }

    setLoading(true)
    setError(null)

    const inserts = valid.map(row => ({
      user_id: userId,
      property_id: currentPropertyId,
      type: row.type,
      category: row.category,
      amount: Number(row.amount),
      frequency: row.frequency,
      date: row.date,
      description: row.description || null
    }))

    const { error } = await supabase.from('transactions').insert(inserts)

    if (error) { setError(error.message); setLoading(false) }
    else { onSave(); onClose() }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Add Transactions</h2>
            <p className="text-xs text-gray-400 mt-0.5">Add multiple income and expense entries at once</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>}

          {/* Property selector */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
            <select value={currentPropertyId} onChange={e => setCurrentPropertyId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              {properties.map(p => <option key={p.id} value={p.id}>{p.address}</option>)}
            </select>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-12 gap-2 mb-2 px-1">
            <div className="col-span-2 text-xs font-medium text-gray-500">Type</div>
            <div className="col-span-3 text-xs font-medium text-gray-500">Category</div>
            <div className="col-span-2 text-xs font-medium text-gray-500">Amount ($)</div>
            <div className="col-span-2 text-xs font-medium text-gray-500">Frequency</div>
            <div className="col-span-2 text-xs font-medium text-gray-500">Date</div>
            <div className="col-span-1"></div>
          </div>

          {/* Transaction rows */}
          <div className="space-y-2">
            {rows.map((row, index) => {
              const categories = row.type === 'income' ? incomeCategories : expenseCategories
              const monthly = row.amount ? toMonthly(row.amount, row.frequency) : null

              return (
                <div key={index} className="grid grid-cols-12 gap-2 items-start">

                  {/* Type toggle */}
                  <div className="col-span-2">
                    <select value={row.type} onChange={e => updateRow(index, 'type', e.target.value)}
                      className={`w-full px-2 py-2 rounded-lg text-xs font-medium border focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                        row.type === 'income'
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : 'bg-red-50 border-red-200 text-red-600'
                      }`}>
                      <option value="income">↑ Income</option>
                      <option value="expense">↓ Expense</option>
                    </select>
                  </div>

                  {/* Category */}
                  <div className="col-span-3">
                    <select value={row.category} onChange={e => updateRow(index, 'category', e.target.value)}
                      className="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500">
                      {categories.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* Amount */}
                  <div className="col-span-2">
                    <input type="number" min="0" step="0.01" placeholder="0"
                      value={row.amount} onChange={e => updateRow(index, 'amount', e.target.value)}
                      className="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    {monthly !== null && row.frequency !== 'Monthly' && (
                      <p className="text-xs text-gray-400 mt-0.5 px-1">
                        ≈ ${Math.round(monthly).toLocaleString()}/mo
                      </p>
                    )}
                  </div>

                  {/* Frequency */}
                  <div className="col-span-2">
                    <select value={row.frequency} onChange={e => updateRow(index, 'frequency', e.target.value)}
                      className="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500">
                      {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
                    </select>
                  </div>

                  {/* Date */}
                  <div className="col-span-2">
                    <input type="date" value={row.date} onChange={e => updateRow(index, 'date', e.target.value)}
                      className="w-full px-2 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>

                  {/* Delete row */}
                  <div className="col-span-1 flex justify-center pt-2">
                    {rows.length > 1 && (
                      <button type="button" onClick={() => removeRow(index)}
                        className="text-gray-300 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Add row button */}
          <button type="button" onClick={addRow}
            className="mt-3 flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium">
            <Plus size={13} />
            Add another line
          </button>

          {/* Summary */}
          {rows.some(r => r.amount) && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-gray-500 mb-1">Monthly equivalent summary</p>
              <div className="flex gap-6">
                <span className="text-xs text-green-600">
                  Income: ${Math.round(rows.filter(r => r.type === 'income' && r.amount)
                    .reduce((s, r) => s + toMonthly(r.amount, r.frequency), 0)).toLocaleString()}/mo
                </span>
                <span className="text-xs text-red-500">
                  Expenses: ${Math.round(rows.filter(r => r.type === 'expense' && r.amount)
                    .reduce((s, r) => s + toMonthly(r.amount, r.frequency), 0)).toLocaleString()}/mo
                </span>
                <span className="text-xs font-medium text-gray-700">
                  Net: ${Math.round(rows.filter(r => r.amount)
                    .reduce((s, r) => s + (r.type === 'income' ? 1 : -1) * toMonthly(r.amount, r.frequency), 0)).toLocaleString()}/mo
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-5">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Saving...' : `Save ${rows.filter(r => r.amount).length} Transaction${rows.filter(r => r.amount).length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}