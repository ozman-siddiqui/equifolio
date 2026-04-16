import { useState } from 'react'
import { X, TrendingDown, TrendingUp, Calendar, DollarSign, Info } from 'lucide-react'

const formatCurrency = (amount) => new Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD', maximumFractionDigits: 0
}).format(amount)

const calcPIRepayment = (principal, annualRate, months) => {
  if (annualRate === 0) return principal / months
  const r = annualRate / 100 / 12
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

const calcIORepayment = (principal, annualRate) => {
  return (principal * (annualRate / 100)) / 12
}

export default function RefinanceModal({ loan, property, onClose }) {
  const currentBalance = Number(loan.current_balance)
  const currentRate = Number(loan.interest_rate)
  const currentMonthly = Number(loan.monthly_repayment)
  const isCurrentIO = loan.repayment_type === 'Interest Only'

  const [newRate, setNewRate] = useState(String((currentRate - 0.5).toFixed(2)))
  const [newTerm, setNewTerm] = useState(30)
  const [newRepaymentType, setNewRepaymentType] = useState(isCurrentIO ? 'Interest Only' : 'Principal and Interest')
  const [dischargeFee, setDischargeFee] = useState(300)
  const [applicationFee, setApplicationFee] = useState(500)
  const [valuationFee, setValuationFee] = useState(300)

  const newRateNum = newRate === '' ? 0 : Number(newRate)
  const totalSwitchCost = Number(dischargeFee) + Number(applicationFee) + Number(valuationFee)

  // Current monthly — use recorded value
  const currentMonthlyCalc = currentMonthly > 0 ? currentMonthly
    : isCurrentIO
      ? calcIORepayment(currentBalance, currentRate)
      : calcPIRepayment(currentBalance, currentRate, 30 * 12)

  // New monthly — based on selected repayment type
  const newMonthlyCalc = newRepaymentType === 'Interest Only'
    ? calcIORepayment(currentBalance, newRateNum)
    : calcPIRepayment(currentBalance, newRateNum, newTerm * 12)

  const monthlySaving = currentMonthlyCalc - newMonthlyCalc
  const annualSaving = monthlySaving * 12
  const fiveYearSaving = (annualSaving * 5) - totalSwitchCost
  const breakEvenMonths = totalSwitchCost > 0 && monthlySaving > 0
    ? Math.ceil(totalSwitchCost / monthlySaving) : 0

  const currentTotalInterest = isCurrentIO
    ? calcIORepayment(currentBalance, currentRate) * newTerm * 12
    : (currentMonthlyCalc * newTerm * 12) - currentBalance
  const newTotalInterest = newRepaymentType === 'Interest Only'
    ? calcIORepayment(currentBalance, newRateNum) * newTerm * 12
    : (newMonthlyCalc * newTerm * 12) - currentBalance
  const interestSaving = currentTotalInterest - newTotalInterest

  const isWorthwhile = monthlySaving > 0 && breakEvenMonths < 24 && breakEvenMonths > 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Refinance Modeller</h2>
            <p className="text-sm text-gray-500 mt-0.5">{loan.lender} · {property?.address}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Current loan */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Current Loan</p>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-gray-400">Balance</p>
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(currentBalance)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Rate</p>
                <p className="text-sm font-semibold text-gray-900">{currentRate}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Type</p>
                <p className="text-sm font-semibold text-gray-900">{isCurrentIO ? 'IO' : 'P&I'}</p>
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
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interest Rate (%)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newRate}
                  onChange={e => {
                    const val = e.target.value
                    if (val === '' || /^\d*\.?\d*$/.test(val)) setNewRate(val)
                  }}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Type</label>
                <select
                  value={newRepaymentType}
                  onChange={e => setNewRepaymentType(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option>Principal and Interest</option>
                  <option>Interest Only</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loan Term</label>
                <select
                  value={newTerm}
                  onChange={e => setNewTerm(Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {[10, 15, 20, 25, 30].map(t => (
                    <option key={t} value={t}>{t} years</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Switching costs */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Switching Costs</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Discharge fee ($)</label>
                <input type="number" value={dischargeFee} onChange={e => setDischargeFee(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Application fee ($)</label>
                <input type="number" value={applicationFee} onChange={e => setApplicationFee(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Valuation fee ($)</label>
                <input type="number" value={valuationFee} onChange={e => setValuationFee(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Total: {formatCurrency(totalSwitchCost)}</p>
          </div>

          {/* Results */}
          <div className={`rounded-xl p-5 border-2 ${
            monthlySaving > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-4">
              {monthlySaving > 0
                ? <TrendingDown size={16} className="text-green-600" />
                : <TrendingUp size={16} className="text-red-500" />}
              <p className={`text-sm font-semibold ${monthlySaving > 0 ? 'text-green-800' : 'text-red-700'}`}>
                {monthlySaving > 0
                  ? `Modelled repayment difference from refinance scenario: ${formatCurrency(monthlySaving)}/month`
                  : `You'd pay ${formatCurrency(Math.abs(monthlySaving))}/month more`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white bg-opacity-60 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Monthly saving</p>
                <p className={`text-xl font-bold ${monthlySaving >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {monthlySaving >= 0 ? '+' : ''}{formatCurrency(monthlySaving)}
                </p>
              </div>
              <div className="bg-white bg-opacity-60 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Annual saving</p>
                <p className={`text-xl font-bold ${annualSaving >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {annualSaving >= 0 ? '+' : ''}{formatCurrency(annualSaving)}
                </p>
              </div>
              <div className="bg-white bg-opacity-60 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Break-even</p>
                <p className="text-xl font-bold text-gray-800">
                  {breakEvenMonths > 0 ? `${breakEvenMonths} months` : '—'}
                </p>
              </div>
              <div className="bg-white bg-opacity-60 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">5-year net saving</p>
                <p className={`text-xl font-bold ${fiveYearSaving >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {fiveYearSaving >= 0 ? '+' : ''}{formatCurrency(fiveYearSaving)}
                </p>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-white border-opacity-40">
              <p className="text-xs text-gray-500">
                Total interest over {newTerm} yrs:{' '}
                <span className={`font-semibold ${interestSaving >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {interestSaving >= 0 ? 'save ' : 'pay extra '}{formatCurrency(Math.abs(interestSaving))}
                </span>
              </p>
            </div>

            {monthlySaving > 0 && (
              <div className="mt-2 pt-2 border-t border-white border-opacity-40">
                <p className={`text-xs font-medium ${isWorthwhile ? 'text-green-700' : 'text-amber-700'}`}>
                  {isWorthwhile
                    ? `✓ Worth refinancing — break-even in ${breakEvenMonths} months`
                    : breakEvenMonths > 0
                      ? `⚠ Break-even takes ${breakEvenMonths} months — consider how long you'll keep this loan`
                      : '✓ Saving money with no switching costs'}
                </p>
              </div>
            )}
          </div>

          <p
            style={{
              fontSize: '12px',
              color: '#6B7280',
              fontStyle: 'italic',
              maxWidth: '640px',
              lineHeight: 1.6,
              margin: '16px auto 0',
              textAlign: 'center',
            }}
          >
            Nextiq provides portfolio modelling tools and general information only. Outputs are illustrative and do not constitute personal financial advice, credit advice, or a recommendation to buy, refinance, or apply for any financial product or loan.
          </p>

          {/* New vs current repayment */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">New monthly repayment</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(newMonthlyCalc)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Current repayment</p>
                <p className="text-2xl font-bold text-gray-400 mt-1">{formatCurrency(currentMonthlyCalc)}</p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Info size={12} className="text-gray-300 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400">
              Estimate only. Speak with a mortgage broker before refinancing.
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
