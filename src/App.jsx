import React, { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './supabase'

import Auth from './pages/Auth'
import BorrowingPowerExplained from './pages/BorrowingPowerExplained'
import Dashboard from './pages/Dashboard'
import AdminBenchmarks from './pages/AdminBenchmarks'
import PortfolioGrowthScenariosRebuild from './pages/PortfolioGrowthScenariosRebuild'
import Pricing from './pages/Pricing'
import Landing from './pages/Landing'
import HowItWorks from './pages/HowItWorks'
import Features from './pages/Features'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Terms from './pages/Terms'
import Contact from './pages/Contact'
import Properties from './pages/Properties'
import PropertyDetail from './pages/PropertyDetail'
import CashFlow from './pages/CashFlow'
import Mortgages from './pages/Mortgages'
import Alerts from './pages/Alerts'
import Settings from './pages/Settings'
import Welcome from './pages/Welcome'
import Layout from './components/Layout'

const Financials = lazy(() => import('./pages/Financials'))

function FinancialsRouteFallback({ message = 'Loading financials...' }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-6 text-center">
        <p className="text-lg font-semibold text-gray-900">Financials</p>
        <p className="mt-2 text-sm text-gray-500">{message}</p>
      </div>
    </div>
  )
}

function AppRouteFallback({ title, message = 'Something went wrong loading this page. Please refresh or try again.' }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-6 text-center">
        <p className="text-lg font-semibold text-gray-900">{title}</p>
        <p className="mt-2 text-sm text-gray-500">{message}</p>
      </div>
    </div>
  )
}

class FinancialsErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <FinancialsRouteFallback message="Financials is temporarily unavailable. The rest of the app is still available." />
      )
    }

    return this.props.children
  }
}

class AppRouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return <AppRouteFallback title={this.props.title} />
    }

    return this.props.children
  }
}

export default function App() {
  const location = useLocation()
  const [session, setSession] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [ready, setReady] = useState(false)
  const [subscriptionReady, setSubscriptionReady] = useState(false)
  const [welcomeGateReady, setWelcomeGateReady] = useState(false)
  const [requiresWelcome, setRequiresWelcome] = useState(false)

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch {
      // Ignore sign-out errors and clear local state below.
    }
    localStorage.clear()
    sessionStorage.clear()
    window.location.href = '/'
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
      } catch {
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

  const isActive =
    subscription?.status === 'active' || subscription?.status === 'trialing'

  useEffect(() => {
    let isMounted = true

    const resolveWelcomeGate = async () => {
      if (!session?.user?.id || !isActive) {
        if (!isMounted) return
        setRequiresWelcome(false)
        setWelcomeGateReady(true)
        return
      }

      setWelcomeGateReady(false)

      try {
        const [
          { data: propertyRow, error: propertyError },
          { data: profileRow, error: profileError },
        ] = await Promise.all([
          supabase
            .from('properties')
            .select('id')
            .eq('user_id', session.user.id)
            .limit(1)
            .maybeSingle(),
          supabase
            .from('user_financial_profiles')
            .select('user_id')
            .eq('user_id', session.user.id)
            .maybeSingle(),
        ])

        if (propertyError || profileError) {
          throw propertyError || profileError
        }

        if (!isMounted) return

        const hasProperty = !!propertyRow?.id
        const hasProfile = !!profileRow?.user_id

        const hasSnapshot = (() => {
          try {
            const snapshotKey = session?.user?.id
              ? `onboardingSnapshot_${session.user.id}`
              : 'onboardingSnapshot'
            return !!sessionStorage.getItem(snapshotKey)
          } catch {
            return false
          }
        })()
        const nextRequiresWelcome = !hasProperty && !hasProfile && !hasSnapshot

        console.log('Welcome gate', {
          userId: session.user.id,
          propertyRow,
          profileRow,
          propertyError,
          profileError,
          hasProperty,
          hasProfile,
          requiresWelcome: nextRequiresWelcome,
        })

        setRequiresWelcome(nextRequiresWelcome)
        setWelcomeGateReady(true)
      } catch (error) {
        if (!isMounted) return

        const hasSnapshot = (() => {
          try {
            const snapshotKey = session?.user?.id
              ? `onboardingSnapshot_${session.user.id}`
              : 'onboardingSnapshot'
            return !!sessionStorage.getItem(snapshotKey)
          } catch {
            return false
          }
        })()
        const nextRequiresWelcome = !hasSnapshot

        console.log('Welcome gate', {
          userId: session.user.id,
          propertyRow: null,
          profileRow: null,
          propertyError: error,
          profileError: null,
          hasProperty: false,
          hasProfile: false,
          requiresWelcome: nextRequiresWelcome,
        })

        setRequiresWelcome(nextRequiresWelcome)
        setWelcomeGateReady(true)
      }
    }

    resolveWelcomeGate()

    return () => {
      isMounted = false
    }
  }, [session?.user?.id, isActive])

  if (!ready || !subscriptionReady || !welcomeGateReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4" style={{ fontSize: '24px', fontWeight: 500, letterSpacing: '-0.5px' }}>
            <span style={{ color: '#0F172A' }}>next</span>
            <span style={{ color: '#1D9E75' }}>iq</span>
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

  if (!session) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/features" element={<Features />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={<Auth />} />
      </Routes>
    )
  }

  if (!isActive) {
    return (
      <Routes>
        <Route path="/auth" element={<Navigate to="/welcome" replace />} />
        <Route path="/welcome" element={<Welcome session={session} />} />
        <Route path="*" element={<Navigate to="/welcome" replace />} />
      </Routes>
    )
  }

  if (requiresWelcome) {
    const pendingRedirect = sessionStorage.getItem('postLoginRedirect')
    const urlRedirect = new URLSearchParams(window.location.search).get('redirect')
    const redirectTarget = pendingRedirect || urlRedirect

    if (redirectTarget && redirectTarget.startsWith('/')) {
      if (pendingRedirect) sessionStorage.removeItem('postLoginRedirect')
      window.location.replace(redirectTarget)
      return null
    }
    return (
      <Routes>
        <Route path="/welcome" element={<Welcome session={session} />} />
        <Route path="*" element={<Navigate to="/welcome" replace />} />
      </Routes>
    )
  }

  const cachedPages = {
    dashboard: (
      <AppRouteErrorBoundary title="Dashboard">
        <Dashboard session={session} subscription={subscription} />
      </AppRouteErrorBoundary>
    ),
    properties: <Properties />,
    cashflow: <CashFlow />,
    mortgages: <Mortgages session={session} />,
    growthScenarios: (
      <AppRouteErrorBoundary title="Growth Scenarios">
        <PortfolioGrowthScenariosRebuild />
      </AppRouteErrorBoundary>
    ),
    financials: (
      <FinancialsErrorBoundary>
        <Suspense fallback={<FinancialsRouteFallback />}>
          <Financials session={session} />
        </Suspense>
      </FinancialsErrorBoundary>
    ),
  }

  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/welcome" element={<Navigate to="/dashboard" replace />} />
      <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <Landing />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/features" element={<Features />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/contact" element={<Contact />} />
      <Route
        path="/*"
        element={
          <Layout
            session={session}
            subscription={subscription}
            onSignOut={signOut}
            cachedPages={cachedPages}
          />
        }
      >
        <Route index element={null} />
        <Route path="dashboard" element={null} />
        <Route path="properties" element={null} />
        <Route path="property/:id" element={<PropertyDetail />} />
        <Route path="cashflow" element={null} />
        <Route path="mortgages" element={null} />
        <Route path="growth-scenarios" element={null} />
        <Route path="financials" element={null} />
        <Route path="borrowing-power" element={<BorrowingPowerExplained />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="pricing" element={<Pricing session={session} existingPlan={subscription?.plan || null} />} />
        <Route path="settings" element={<Settings session={session} subscription={subscription} />} />
        <Route path="admin/benchmarks" element={<AdminBenchmarks session={session} />} />
      </Route>
    </Routes>
  )
}
