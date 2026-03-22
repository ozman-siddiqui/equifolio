import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const toMonthly = (amount, frequency) => {
  const map = {
    Weekly: 52 / 12, Fortnightly: 26 / 12, Monthly: 1,
    Quarterly: 1 / 3, Annual: 1 / 12
  }
  return Number(amount) * (map[frequency] || 1)
}

const formatCurrency = (amount) => new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', maximumFractionDigits: 0
}).format(amount)

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const income = payload.find(p => p.dataKey === 'income')?.value || 0
  const expenses = payload.find(p => p.dataKey === 'expenses')?.value || 0
  const net = income - expenses
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      <p className="text-green-600">Income: {formatCurrency(income)}</p>
      <p className="text-red-500">Expenses: {formatCurrency(expenses)}</p>
      <p className={`font-semibold mt-1 pt-1 border-t border-gray-100 ${net >= 0 ? 'text-green-600' : 'text-red-500'}`}>
        Net: {formatCurrency(net)}
      </p>
    </div>
  )
}

// Build 12-month projection from transactions
const buildProjection = (transactions, propertyId = null) => {
  const now = new Date()
  const months = []

  // Filter transactions
  const txns = propertyId
    ? transactions.filter(t => t.property_id === propertyId)
    : transactions

  // Get average monthly amounts per category from last 3 months of data
  // For recurring items, use the frequency to project forward
  const recurringIncome = txns
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + toMonthly(t.amount, t.frequency || 'Monthly'), 0)

  const recurringExpenses = txns
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + toMonthly(t.amount, t.frequency || 'Monthly'), 0)

  // Get unique months of data for averaging
  const uniqueMonths = [...new Set(txns.map(t => t.date?.slice(0, 7)))].filter(Boolean)
  const dataMonths = Math.max(uniqueMonths.length, 1)

  // Monthly averages
  const avgMonthlyIncome = recurringIncome / dataMonths
  const avgMonthlyExpenses = recurringExpenses / dataMonths

  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const monthLabel = `${MONTHS[date.getMonth()]} ${date.getFullYear().toString().slice(2)}`
    const isCurrentMonth = i === 0

    months.push({
      month: monthLabel,
      income: Math.round(avgMonthlyIncome),
      expenses: Math.round(avgMonthlyExpenses),
      net: Math.round(avgMonthlyIncome - avgMonthlyExpenses),
      isCurrent: isCurrentMonth,
      isFuture: i > 0,
    })
  }

  return months
}

// Portfolio chart component
export function PortfolioCashFlowChart({ transactions }) {
  const data = useMemo(() => buildProjection(transactions), [transactions])

  const totalAnnualIncome = data.reduce((sum, m) => sum + m.income, 0)
  const totalAnnualExpenses = data.reduce((sum, m) => sum + m.expenses, 0)
  const totalAnnualNet = totalAnnualIncome - totalAnnualExpenses
  const positiveMonths = data.filter(m => m.net >= 0).length

  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">12-Month Cash Flow Projection</h3>
        <p className="text-xs text-gray-400">Add income and expense transactions to see your projection</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">12-Month Cash Flow Projection</h3>
          <p className="text-xs text-gray-400 mt-0.5">Based on your current income and expense patterns</p>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold ${totalAnnualNet >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {formatCurrency(totalAnnualNet)}
          </p>
          <p className="text-xs text-gray-400">projected annual net</p>
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3 mb-4">
        <div className="bg-green-50 rounded-lg px-3 py-1.5">
          <p className="text-xs text-green-600 font-medium">{formatCurrency(totalAnnualIncome)} income</p>
        </div>
        <div className="bg-red-50 rounded-lg px-3 py-1.5">
          <p className="text-xs text-red-500 font-medium">{formatCurrency(totalAnnualExpenses)} expenses</p>
        </div>
        <div className={`rounded-lg px-3 py-1.5 ${positiveMonths >= 6 ? 'bg-green-50' : 'bg-amber-50'}`}>
          <p className={`text-xs font-medium ${positiveMonths >= 6 ? 'text-green-600' : 'text-amber-600'}`}>
            {positiveMonths}/12 positive months
          </p>
        </div>
      </div>

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `$${Math.abs(v / 1000).toFixed(0)}k`}
            width={35}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#E5E7EB" />
          <Bar dataKey="income" name="Income" fill="#16A34A" radius={[3, 3, 0, 0]} opacity={0.85} />
          <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[3, 3, 0, 0]} opacity={0.85} />
        </BarChart>
      </ResponsiveContainer>

      <p className="text-xs text-gray-400 mt-2 text-center">
        Projection based on {transactions.length} recorded transaction{transactions.length !== 1 ? 's' : ''}. Actual results may vary.
      </p>
    </div>
  )
}

// Per-property table component
export function PropertyCashFlowTable({ transactions, propertyId }) {
  const data = useMemo(
    () => buildProjection(transactions, propertyId),
    [transactions, propertyId]
  )

  const propTxns = transactions.filter(t => t.property_id === propertyId)
  if (propTxns.length === 0) return null

  const annualNet = data.reduce((sum, m) => sum + m.net, 0)

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-500">12-Month Projection</p>
        <p className={`text-xs font-semibold ${annualNet >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {formatCurrency(annualNet)} projected annual net
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-gray-400 font-medium py-1.5 pr-3">Month</th>
              <th className="text-right text-gray-400 font-medium py-1.5 px-2">Income</th>
              <th className="text-right text-gray-400 font-medium py-1.5 px-2">Expenses</th>
              <th className="text-right text-gray-400 font-medium py-1.5 pl-2">Net</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className={`border-b border-gray-50 ${row.isCurrent ? 'bg-primary-50' : ''}`}>
                <td className={`py-1.5 pr-3 ${row.isCurrent ? 'font-semibold text-primary-600' : 'text-gray-600'}`}>
                  {row.month} {row.isCurrent && <span className="text-xs text-primary-400">(now)</span>}
                </td>
                <td className="text-right py-1.5 px-2 text-green-600">{formatCurrency(row.income)}</td>
                <td className="text-right py-1.5 px-2 text-red-500">{formatCurrency(row.expenses)}</td>
                <td className={`text-right py-1.5 pl-2 font-medium ${row.net >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatCurrency(row.net)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200">
              <td className="py-2 pr-3 text-gray-700 font-semibold">Annual total</td>
              <td className="text-right py-2 px-2 text-green-600 font-semibold">
                {formatCurrency(data.reduce((s, m) => s + m.income, 0))}
              </td>
              <td className="text-right py-2 px-2 text-red-500 font-semibold">
                {formatCurrency(data.reduce((s, m) => s + m.expenses, 0))}
              </td>
              <td className={`text-right py-2 pl-2 font-bold ${annualNet >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {formatCurrency(annualNet)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}