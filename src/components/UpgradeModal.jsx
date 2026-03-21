import { useState } from 'react'
import { supabase } from '../supabase'
import { X, Check, Zap } from 'lucide-react'

const PLAN_LIMITS = {
  starter: 3,
  investor: 10,
  premium: Infinity
}

const UPGRADE_OPTIONS = {
  starter: {
    next: 'investor',
    name: 'Investor',
    price: 99,
    limit: '10 properties',
    features: ['Everything in Starter', 'AI buy/hold/sell scoring', 'Refinance scenario modeller', 'Document vault', 'EOFY accountant report']
  },
  investor: {
    next: 'premium',
    name: 'Premium',
    price: 149,
    limit: 'Unlimited properties',
    features: ['Everything in Investor', 'SMSF compliance flags', 'White-label reports', 'Multi-portfolio support', 'Natural language Q&A']
  }
}

export default function UpgradeModal({ onClose, currentPlan, currentCount }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const upgrade = UPGRADE_OPTIONS[currentPlan]
  const limit = PLAN_LIMITS[currentPlan]

  const handleUpgrade = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch(
        'https://fcawdtlcimytvohivhfq.supabase.co/functions/v1/create-checkout-session',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ plan: upgrade.next }),
        }
      )

      const data = await res.json()

      if (data.error) {
        setError(data.error)
        setLoading(false)
        return
      }

      window.location.href = data.url

    } catch (err) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Property limit reached</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Your {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} plan includes up to {limit} {limit === 1 ? 'property' : 'properties'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Upgrade option */}
        {upgrade ? (
          <div className="p-6">
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-5 mb-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-xs font-bold text-primary-600 uppercase tracking-wide">Upgrade to</span>
                  <h3 className="text-xl font-bold text-gray-900">{upgrade.name}</h3>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-gray-900">${upgrade.price}</span>
                  <span className="text-gray-400 text-sm">/mo</span>
                </div>
              </div>
              <p className="text-sm font-medium text-primary-600 mb-3">{upgrade.limit}</p>
              <ul className="space-y-2">
                {upgrade.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check size={14} className="text-green-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
                {error}
              </div>
            )}

            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Zap size={16} />
              {loading ? 'Redirecting to checkout...' : `Upgrade to ${upgrade.name}`}
            </button>

            <button onClick={onClose} className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 py-2">
              Maybe later
            </button>
          </div>
        ) : (
          <div className="p-6 text-center">
            <p className="text-gray-500 text-sm">You're on the highest plan. Contact support for enterprise options.</p>
            <button onClick={onClose} className="mt-4 text-sm text-primary-600 hover:text-primary-700">Close</button>
          </div>
        )}

      </div>
    </div>
  )
}