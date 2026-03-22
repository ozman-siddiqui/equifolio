import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { supabase } from './supabase'

import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Pricing from './pages/Pricing'
import Properties from './pages/Properties'
import PropertyDetail from './pages/PropertyDetail'
import CashFlow from './pages/CashFlow'
import Mortgages from './pages/Mortgages'
import Alerts from './pages/Alerts'
import Settings from './pages/Settings'
import Layout from './components/Layout'

export default function App() {
  const [session, setSession] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [ready, setReady] = useState(false)
  const [subscriptionReady, setSubscriptionReady] = useState(false)

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (e) {}
    localStorage.clear()
    sessionStorage.clear()
    window.location.reload()
  }

  const fetchSubscription = (userId) => {
    setSubscriptionReady(false)
    supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        setSubscription(data || null)
        setSubscriptionReady(true)
      })
      .catch(() => {
        setSubscription(null)
        setSubscriptionReady(true)
      })
  }

  useEffect(() => {
    let isMounted = true

    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!isMounted) return

        if (session) {
          setSession(session)
          fetchSubscription(session.user.id)
        } else {
          setSubscriptionReady(true)
        }
      } catch (e) {
        if (isMounted) setSubscriptionReady(true)
      } finally {
        if (isMounted) setReady(true)
      }
    }

    init()

    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESH_FAILED') {
        setSession(null)
        setSubscription(null)
        setSubscriptionReady(true)
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(session)
        if (session) fetchSubscription(session.user.id)
      }
    })

    return () => {
      isMounted = false
      authSub.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('subscription') === 'success' && session) {
      window.history.replaceState({}, '', '/')
      setTimeout(() => fetchSubscription(session.user.id), 3000)
    }
  }, [session])

  if (!ready || !subscriptionReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-sm font-bold">E</span>
          </div>
          <div className="text-gray-400 text-sm">Loading...</div>
          <button
            onClick={signOut}
            className="mt-6 text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Taking too long? Click here
          </button>
        </div>
      </div>
    )
  }

  if (!session) return <Auth />

  const isActive =
    subscription?.status === 'active' || subscription?.status === 'trialing'

  if (!isActive) {
    return <Pricing session={session} existingPlan={null} />
  }

  return (
    <Routes>
      <Route
        path="/"
        element={<Layout session={session} subscription={subscription} onSignOut={signOut} />}
      >
        <Route
          index
          element={<Dashboard session={session} subscription={subscription} />}
        />
        <Route path="properties" element={<Properties />} />
        <Route path="property/:id" element={<PropertyDetail />} />
        <Route path="cashflow" element={<CashFlow />} />
        <Route path="mortgages" element={<Mortgages />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="pricing" element={<Pricing session={session} existingPlan={subscription?.plan || null} />} />
        <Route path="settings" element={<Settings session={session} subscription={subscription} />} />
      </Route>
    </Routes>
  )
}
