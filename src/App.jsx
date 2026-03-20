import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Pricing from './pages/Pricing'

export default function App() {
  const [session, setSession] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checkingSubscription, setCheckingSubscription] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchSubscription(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        if (session) fetchSubscription(session.user.id)
        else { setSubscription(null); setLoading(false) }
      }
    )

    return () => authSub.unsubscribe()
  }, [])

  const fetchSubscription = async (userId) => {
    setCheckingSubscription(true)
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single()
    setSubscription(data)
    setLoading(false)
    setCheckingSubscription(false)
  }

  // Handle post-payment redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('subscription') === 'success' && session) {
      window.history.replaceState({}, '', '/')
      // Wait 2 seconds for webhook to fire then re-check
      setTimeout(() => fetchSubscription(session.user.id), 2000)
    }
  }, [session])

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  if (!session) return <Auth />

  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing'
  if (!isActive) return <Pricing session={session} existingPlan={null} />

  return <Dashboard session={session} subscription={subscription} />
}