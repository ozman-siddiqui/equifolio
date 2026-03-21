import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Pricing from './pages/Pricing'

export default function App() {
  const [session, setSession] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)

  const forceSignOut = async () => {
    try { await supabase.auth.signOut() } catch (e) {}
    localStorage.clear()
    sessionStorage.clear()
    setSession(null)
    setSubscription(null)
    setLoading(false)
  }

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
    }
  }

  useEffect(() => {
    // Step 1: get initial session on page load
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setSession(session)
        await fetchSubscription(session.user.id)
      }
      // Always stop loading after initial check — no matter what
      setLoading(false)
    })

    // Step 2: listen for auth changes but NEVER set loading again
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESH_FAILED') {
          setSession(null)
          setSubscription(null)
          return
        }
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session) {
            setSession(session)
            await fetchSubscription(session.user.id)
          }
        }
      }
    )

    // Step 3: recheck session when user returns to tab
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().then(({ data: { session }, error }) => {
          if (error || !session) {
            setSession(null)
            setSubscription(null)
          }
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      authSub.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  // Handle post-Stripe payment redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('subscription') === 'success' && session) {
      window.history.replaceState({}, '', '/')
      setTimeout(() => fetchSubscription(session.user.id), 3000)
    }
  }, [session])

  // Only show loading screen on initial page load
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center mx-auto mb-4">
          <span className="text-white text-sm font-bold">E</span>
        </div>
        <div className="text-gray-400 text-sm">Loading your portfolio...</div>
        <button
          onClick={forceSignOut}
          className="mt-6 text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Taking too long? Click here
        </button>
      </div>
    </div>
  )

  if (!session) return <Auth />

  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing'
  if (!isActive) return <Pricing session={session} existingPlan={null} />

  return <Dashboard session={session} subscription={subscription} />
}
