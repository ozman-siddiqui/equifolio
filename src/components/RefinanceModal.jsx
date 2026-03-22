import { useState } from 'react'
import { X, TrendingDown, Calendar, DollarSign, Info } from 'lucide-react'

const formatCurrency = (amount) => new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', maximumFractionDigits: 0
}).format(amount)

const calcMonthlyRepayment = (principal, annualRate, months) => {
  if (annualRate === 0) return principal / months
  const r = annualRate / 100 / 12
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

export default function RefinanceModal({ loan, property, onClose }) {
  const currentBalance = Number(loan.current_balance)
  const currentRate = Number(loan.interest_rate)

  // Calculate remaining term from current repayment
  const currentMonthly = Number(loan.monthly_repayment)

  const [newRate, setNewRate] = useState((currentRate - 0.5).toFixed(2))
  const [newTerm, setNewTerm] = useState(30)
  const [dischargeFee, setDischargeFee] = useState(300)
  const [applicationFee, setApplicationFee] = useState(500)
  const [valuationFee, setValuationFee] = useState(300)

  const newRateNum = Number(newRate)
  const totalSwitchCost = Number(dischargeFee) + Number(applicationFee) + Number(valuationFee)

  // Current monthly (use recorded repayment)
  const currentMonthlyCalc = currentMonthly > 0
    ? currentMonthly
    : calcMonthlyRepayment(currentBalance, currentRate, 30 * 12)

  // New monthly repayment
  const newMonthlyCalc = calcMonthlyRepayment(currentBalance, newRateNum, newTerm * 12)

  const monthlySaving = currentMonthlyCalc - newMonthlyCalc
  const annualSaving = monthlySaving * 12
  const fiveYearSaving = (annualSaving * 5) - totalSwitchCost
  const breakEvenMonths = totalSwitchCost > 0 && monthlySaving > 0
    ? Math.ceil(totalSwitchCost / monthlySaving)
    : 0

  // Total interest comparison over new term
  const currentTotalInterest = (currentMonthlyCalc * newTerm * 12) - currentBalance
  const newTotalInterest = (newMonthlyCalc * newTerm * 12) - currentBalance
  const interestSaving = currentTotalInterest - newTotalInterest

  const isWorthwhile = monthlySaving > 0 && breakEvenMonths < 24

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Refinance Modeller</h2>
            <p className="text-sm text-gray-500 mt-0.5">{loan.lender} · {property?.address}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Current loan summary */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Current Loan</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-400">Balance</p>
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(currentBalance)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Rate</p>
                <p className="text-sm font-semibold text-gray-900">{currentRate}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Monthly</p>
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(currentMonthlyCalc)}</p>
              </div>
            </div>
          </div>

          {/* New loan inputs */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">New Loan Scenario</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Interest Rate (%)</label>
                <input
                  type="number"
                  value={newRate}
                  onChange={e => setNewRate(e.target.value)}
                  step="0.05"
                  min="0"
                  max="20"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loan Term (years)</label>
                <select
                  value={newTerm}
                  onChange={e => setNewTerm(Number(e.target.value))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {[10, 15, 20, 25, 30].map(t => (
                    <option key={t} value={t}>{t} years</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Switch costs */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Switching Costs</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Discharge fee ($)</label>
                <input
                  type="number"
                  value={dischargeFee}
                  onChange={e => setDischargeFee(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Application fee ($)</label>
                <input
                  type="number"
                  value={applicationFee}
                  onChange={e => setApplicationFee(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Valuation fee ($)</label>
                <input
                  type="number"
                  value={valuationFee}
                  onChange={e => setValuationFee(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Total switching cost: {formatCurrency(totalSwitchCost)}
            </p>
          </div>

          {/* Results */}
          <div className={`rounded-xl p-5 border-2 ${
            monthlySaving > 0
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown size={16} className={monthlySaving > 0 ? 'text-green-600' : 'text-red-500'} />
              <p className={`text-sm font-semibold ${monthlySaving > 0 ? 'text-green-800' : 'text-red-700'}`}>
                {monthlySaving > 0
                  ? `You could save ${formatCurrency(monthlySaving)}/month by refinancing`
                  : `This rate is higher — you'd pay ${formatCurrency(Math.abs(monthlySaving))}/month more`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white bg-opacity-60 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign size={12} className="text-gray-400" />
                  <p className="text-xs text-gray-500">Monthly saving</p>
                </div>
                <p className={`text-xl font-bold ${monthlySaving >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {monthlySaving >= 0 ? '+' : ''}{formatCurrency(monthlySaving)}
                </p>
              </div>

              <div className="bg-white bg-opacity-60 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign size={12} className="text-gray-400" />
                  <p className="text-xs text-gray-500">Annual saving</p>
                </div>
                <p className={`text-xl font-bold ${annualSaving >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {annualSaving >= 0 ? '+' : ''}{formatCurrency(annualSaving)}
                </p>
              </div>

              <div className="bg-white bg-opacity-60 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar size={12} className="text-gray-400" />
                  <p className="text-xs text-gray-500">Break-even point</p>
                </div>
                <p className="text-xl font-bold text-gray-800">
                  {breakEvenMonths > 0 ? `${breakEvenMonths} months` : '—'}
                </p>
              </div>

              <div className="bg-white bg-opacity-60 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign size={12} className="text-gray-400" />
                  <p className="text-xs text-gray-500">5-year net saving</p>
                </div>
                <p className={`text-xl font-bold ${fiveYearSaving >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {fiveYearSaving >= 0 ? '+' : ''}{formatCurrency(fiveYearSaving)}
                </p>
              </div>
            </div>

            {/* Interest saving over term */}
            <div className="mt-3 pt-3 border-t border-white border-opacity-50">
              <p className="text-xs text-gray-500">
                Total interest saving over {newTerm} years:{' '}
                <span className={`font-semibold ${interestSaving >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {interestSaving >= 0 ? '+' : ''}{formatCurrency(interestSaving)}
                </span>
              </p>
            </div>

            {/* Verdict */}
            {monthlySaving > 0 && (
              <div className={`mt-3 pt-3 border-t border-white border-opacity-50`}>
                <p className={`text-xs font-medium ${isWorthwhile ? 'text-green-700' : 'text-amber-700'}`}>
                  {isWorthwhile
                    ? `✓ Refinancing looks worthwhile — you'd break even in ${breakEvenMonths} months`
                    : `⚠ Break-even takes ${breakEvenMonths} months — consider if you'll keep this loan that long`}
                </p>
              </div>
            )}
          </div>

          {/* New monthly repayment */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">New monthly repayment</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(newMonthlyCalc)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">vs current</p>
                <p className="text-2xl font-bold text-gray-400 mt-1">{formatCurrency(currentMonthlyCalc)}</p>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-2">
            <Info size={12} className="text-gray-300 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400">
              This is an estimate only. Actual savings depend on your full loan terms, offset balances, and lender fees. Speak with a mortgage broker before refinancing.
            </p>
          </div>

          <button onClick={onClose}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}