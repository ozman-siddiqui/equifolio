import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Pricing from './pages/Pricing'

export default function App() {
  const [session, setSession] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchSubscription = async (userId) => {
    try {
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      setSubscription(data || null)
    } catch (err) {
      setSubscription(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Set a maximum loading timeout — never get stuck
    const timeout = setTimeout(() => {
      setLoading(false)
    }, 5000)

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      clearTimeout(timeout)
      if (error || !session) {
        setSession(null)
        setLoading(false)
        return
      }
      setSession(session)
      fetchSubscription(session.user.id)
    })

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Handle token refresh and sign out events
        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESH_FAILED') {
          setSession(null)
          setSubscription(null)
          setLoading(false)
          return
        }
        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          setSession(session)
          if (session) {
            setLoading(true)
            await fetchSubscription(session.user.id)
          } else {
            setLoading(false)
          }
          return
        }
        if (!session) {
          setSession(null)
          setSubscription(null)
          setLoading(false)
        }
      }
    )

    return () => {
      clearTimeout(timeout)
      authSub.unsubscribe()
    }
  }, [])

  // Handle post-payment redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('subscription') === 'success' && session) {
      window.history.replaceState({}, '', '/')
      setLoading(true)
      setTimeout(() => fetchSubscription(session.user.id), 3000)
    }
  }, [session])

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center mx-auto mb-4">
          <span className="text-white text-sm font-bold">E</span>
        </div>
        <div className="text-gray-400 text-sm">Loading your portfolio...</div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-6 text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Taking too long? Sign out
        </button>
      </div>
    </div>
  )

  if (!session) return <Auth />

  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing'
  if (!isActive) return <Pricing session={session} existingPlan={null} />

  return <Dashboard session={session} subscription={subscription} />
}
