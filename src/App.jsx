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
    try {
      await supabase.auth.signOut()
    } catch (e) {
      // ignore
    }
    // Clear everything manually as fallback
    localStorage.clear()
    setSession(null)
    setSubscription(null)
    setLoading(false)
  }

  const fetchSubscription = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        // If we get an auth error fetching subscription, session is broken
        if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
          await forceSignOut()
          return
        }
      }
      setSubscription(data || null)
    } catch (err) {
      setSubscription(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Hard timeout — never get stuck loading more than 6 seconds
    const timeout = setTimeout(() => {
      setLoading(false)
    }, 6000)

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      clearTimeout(timeout)

      if (error || !session) {
        setSession(null)
        setLoading(false)
        return
      }

      // Check if token is expired
      const expiresAt = session.expires_at
      const now = Math.floor(Date.now() / 1000)
      if (expiresAt && expiresAt < now) {
        // Try to refresh
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError || !refreshed.session) {
          await forceSignOut()
          return
        }
        setSession(refreshed.session)
        fetchSubscription(refreshed.session.user.id)
        return
      }

      setSession(session)
      fetchSubscription(session.user.id)
    })

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
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
        }
      }
    )

    return () => {
      clearTimeout(timeout)
      authSub.unsubscribe()
    }
  }, [])

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
  if (!isActive) return <Pricing session={session} existingPlan={null} onSignOut={forceSignOut} />

  return <Dashboard session={session} subscription={subscription} />
}