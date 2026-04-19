import { useState } from 'react'
import { supabase } from '../supabase'
import { Check, Zap } from 'lucide-react'

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    properties: '1–3 properties',
    description: 'Perfect for investors starting out',
    features: [
      'Portfolio dashboard',
      'Cash flow tracking',
      'Mortgage management',
      'Fixed rate expiry alerts',
      'Net yield calculator',
      'Email support',
    ],
    highlight: false,
  },
  {
    id: 'investor',
    name: 'Investor',
    price: 99,
    properties: '4–10 properties',
    description: 'For serious investors building wealth',
    features: [
      'Everything in Starter',
      'AI buy/hold/sell scoring',
      'Refinance scenario modeller',
      'Document vault',
      'EOFY accountant report',
      'Broker snapshot report',
      'Portfolio health score',
      'Priority support',
    ],
    highlight: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 149,
    properties: 'Unlimited properties',
    description: 'For high-net-worth investors and SMSFs',
    features: [
      'Everything in Investor',
      'SMSF compliance flags',
      'White-label reports',
      'Multi-portfolio support',
      'Natural language Q&A',
      'Weekly AI digest',
      'Dedicated support',
    ],
    highlight: false,
  },
]

export default function Pricing({ session, existingPlan }) {
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState(null)

  const handleSubscribe = async (planId) => {
    setLoading(planId)
    setError(null)

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()

      if (!authSession?.access_token) {
        setError('Session expired. Please sign out and sign back in.')
        setLoading(null)
        return
      }

      const res = await fetch(
        'https://fcawdtlcimytvohivhfq.supabase.co/functions/v1/create-checkout-session',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authSession.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ plan: planId }),
        }
      )

      const text = await res.text()

      let data
      try {
        data = JSON.parse(text)
      } catch {
        setError(`Server error: ${text}`)
        setLoading(null)
        return
      }

      if (data.error) {
        setError(`Error: ${data.error}`)
        setLoading(null)
        return
      }

      if (data.debug) {
        setError(`Stripe response: ${data.debug}`)
        setLoading(null)
        return
      }

      if (!data.url) {
        setError(`No URL returned: ${text}`)
        setLoading(null)
        return
      }

      window.location.href = data.url

    } catch (err) {
      setError(`Network error: ${err.message}`)
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">E</span>
            </div>
            <span className="font-bold text-gray-900 text-lg">Nextiq</span>
          </div>
          {session && (
           <button
  onClick={async () => {
    try { await supabase.auth.signOut() } catch(e) {}
    localStorage.clear()
    window.location.reload()
  }}
  className="text-sm text-gray-500 hover:text-gray-700">
  Sign out
</button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Choose your plan</h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Free during early access. No lock-in.
          </p>
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm inline-block max-w-2xl">
              {error}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div key={plan.id}
              className={`bg-white rounded-2xl border-2 p-8 relative flex flex-col ${
                plan.highlight ? 'border-primary-600 shadow-lg shadow-primary-100' : 'border-gray-100'
              }`}>
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-primary-600 text-white text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1">
                    <Zap size={11} /> MOST POPULAR
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h2>
                <p className="text-sm text-gray-500 mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                  <span className="text-gray-400">/month AUD</span>
                </div>
                <p className="text-sm text-primary-600 font-medium mt-1">{plan.properties}</p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => { window.location.href = '/auth' }}
                className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                  plan.highlight
                    ? 'bg-primary-600 hover:bg-primary-700 text-white'
                    : 'bg-gray-900 hover:bg-gray-800 text-white'
                }`}>
                Join early access
              </button>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-xs text-gray-400">
            Payments secured by Stripe · Australian data residency · Cancel anytime · No lock-in contracts
          </p>
        </div>
      </main>
    </div>
  )
}
