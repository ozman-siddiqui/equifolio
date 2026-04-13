import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { supabase } from '../supabase'
import Sidebar from './Sidebar'

const LAST_AUTHENTICATED_ROUTE_STORAGE_KEY = 'vaulta:last-authenticated-route'
const CACHED_ROUTE_SCROLL_STORAGE_KEY = 'vaulta:cached-route-scroll-positions'

function getCachedPageKey(pathname) {
  if (pathname === '/') return 'dashboard'
  if (pathname === '/dashboard') return 'dashboard'
  if (pathname === '/properties') return 'properties'
  if (pathname === '/cashflow') return 'cashflow'
  if (pathname === '/mortgages') return 'mortgages'
  if (pathname === '/growth-scenarios') return 'growthScenarios'
  if (pathname === '/financials') return 'financials'
  return null
}

function readCachedRouteScrollPositions() {
  try {
    const rawValue = localStorage.getItem(CACHED_ROUTE_SCROLL_STORAGE_KEY)
    if (!rawValue) return {}

    const parsedValue = JSON.parse(rawValue)
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : {}
  } catch {
    return {}
  }
}

function writeCachedRouteScrollPositions(scrollPositions) {
  try {
    localStorage.setItem(
      CACHED_ROUTE_SCROLL_STORAGE_KEY,
      JSON.stringify(scrollPositions)
    )
  } catch {
    // Ignore storage write failures.
  }
}

function readLastAuthenticatedRoute() {
  try {
    return localStorage.getItem(LAST_AUTHENTICATED_ROUTE_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

function writeLastAuthenticatedRoute(route) {
  try {
    localStorage.setItem(LAST_AUTHENTICATED_ROUTE_STORAGE_KEY, route)
  } catch {
    // Ignore storage write failures.
  }
}

export default function Layout({ session, onSignOut, cachedPages = {} }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const activeCachedPageKey = getCachedPageKey(location.pathname)
  const [mountedCachedPages, setMountedCachedPages] = useState(() => {
    const initialKey = getCachedPageKey(window.location.pathname)
    return initialKey ? { [initialKey]: true } : {}
  })
  const previousCachedPageKeyRef = useRef(activeCachedPageKey)
  const cachedScrollPositionsRef = useRef(readCachedRouteScrollPositions())
  const scrollSaveFrameRef = useRef(null)
  const hasAppliedBootRouteRestoreRef = useRef(false)

  const persistScrollPosition = (routeKey, scrollTop) => {
    if (!routeKey) return

    const nextScrollPositions = {
      ...cachedScrollPositionsRef.current,
      [routeKey]: Math.max(0, Math.round(Number(scrollTop) || 0)),
    }

    cachedScrollPositionsRef.current = nextScrollPositions
    writeCachedRouteScrollPositions(nextScrollPositions)
  }

  useLayoutEffect(() => {
    if (hasAppliedBootRouteRestoreRef.current) return
    hasAppliedBootRouteRestoreRef.current = true

    if (location.pathname !== '/') return

    const lastAuthenticatedRoute = readLastAuthenticatedRoute()
    if (
      !lastAuthenticatedRoute ||
      lastAuthenticatedRoute === '/' ||
      lastAuthenticatedRoute === '/pricing'
    ) {
      return
    }

    navigate(lastAuthenticatedRoute, { replace: true })
  }, [location.pathname, navigate])

  useEffect(() => {
    if (!activeCachedPageKey) return
    setMountedCachedPages((current) =>
      current[activeCachedPageKey]
        ? current
        : { ...current, [activeCachedPageKey]: true }
    )
  }, [activeCachedPageKey])

  useEffect(() => {
    const route = `${location.pathname}${location.search}${location.hash}`
    if (route === '/pricing') return
    writeLastAuthenticatedRoute(route)
  }, [location.hash, location.pathname, location.search])

  useEffect(() => {
    if (!activeCachedPageKey) return undefined

    const saveActiveRouteScrollPosition = () => {
      if (scrollSaveFrameRef.current !== null) {
        cancelAnimationFrame(scrollSaveFrameRef.current)
      }

      scrollSaveFrameRef.current = requestAnimationFrame(() => {
        persistScrollPosition(activeCachedPageKey, window.scrollY)
        scrollSaveFrameRef.current = null
      })
    }

    window.addEventListener('scroll', saveActiveRouteScrollPosition, { passive: true })

    return () => {
      window.removeEventListener('scroll', saveActiveRouteScrollPosition)
      if (scrollSaveFrameRef.current !== null) {
        cancelAnimationFrame(scrollSaveFrameRef.current)
        scrollSaveFrameRef.current = null
      }
      persistScrollPosition(activeCachedPageKey, window.scrollY)
    }
  }, [activeCachedPageKey])

  useLayoutEffect(() => {
    const previousCachedPageKey = previousCachedPageKeyRef.current

    if (previousCachedPageKey) {
      persistScrollPosition(previousCachedPageKey, window.scrollY)
    }

    previousCachedPageKeyRef.current = activeCachedPageKey

    if (activeCachedPageKey) {
      const targetScrollY = Number(cachedScrollPositionsRef.current[activeCachedPageKey] ?? 0)
      let frameId = null
      let attempts = 0

      const restoreScrollPosition = () => {
        const maxScrollTop = Math.max(
          document.documentElement.scrollHeight - window.innerHeight,
          0
        )
        const nextScrollY = Math.min(targetScrollY, maxScrollTop)

        window.scrollTo({ top: nextScrollY, behavior: 'auto' })

        if (
          (Math.abs(window.scrollY - nextScrollY) <= 2 && maxScrollTop >= targetScrollY) ||
          attempts >= 10
        ) {
          return
        }

        attempts += 1
        frameId = requestAnimationFrame(restoreScrollPosition)
      }

      restoreScrollPosition()

      return () => {
        if (frameId !== null) {
          cancelAnimationFrame(frameId)
        }
      }
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [activeCachedPageKey])

  const handleSignOut = async () => {
    if (onSignOut) {
      onSignOut()
      return
    }

    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0"
              style={{ background: '#19C37D', color: '#071C17' }}
            >
              V
            </div>

            <div className="min-w-0">
              <p className="text-xl font-bold text-gray-900 leading-tight">
                Vaulta
              </p>
              <p className="text-sm text-gray-500 leading-tight truncate">
                Portfolio Intelligence
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 text-gray-700 bg-white shrink-0"
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      <div className="min-h-screen flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block lg:shrink-0">
          <Sidebar />
        </aside>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation overlay"
            />

            <div className="absolute inset-y-0 left-0 w-[86vw] max-w-[340px] bg-white shadow-2xl flex flex-col">
              <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0"
                    style={{ background: '#19C37D', color: '#071C17' }}
                  >
                    V
                  </div>

                  <div className="min-w-0">
                    <p className="text-xl font-bold text-gray-900 leading-tight">
                      Vaulta
                    </p>
                    <p className="text-sm text-gray-500 leading-tight truncate">
                      Portfolio Intelligence
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 text-gray-700 bg-white shrink-0"
                  aria-label="Close navigation"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <Sidebar mobile onNavigate={() => setMobileMenuOpen(false)} />
              </div>

              <div className="border-t border-gray-100 p-4">
                {session?.user?.email ? (
                  <p className="text-xs text-gray-400 mb-3 truncate">
                    {session.user.email}
                  </p>
                ) : null}

                <button
                  onClick={handleSignOut}
                  className="w-full inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
                  type="button"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Desktop header */}
          <header className="hidden lg:block bg-white border-b border-gray-100">
            <div className="px-5 py-3.5 flex items-center justify-end gap-4">
              <span className="text-sm text-gray-500 hidden xl:block">
                {session?.user?.email}
              </span>

              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
                type="button"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </header>

          <main className="px-3 py-3 md:px-4 md:py-5 lg:p-5">
            <div className="min-w-0">
              {Object.entries(cachedPages).map(([pageKey, pageElement]) =>
                mountedCachedPages[pageKey] ? (
                  <div key={pageKey} hidden={activeCachedPageKey !== pageKey}>
                    {pageElement}
                  </div>
                ) : null
              )}
              {activeCachedPageKey ? null : <Outlet />}
            </div>
          </main>
          <footer className="border-t border-gray-100 px-3 py-3 md:px-4 lg:px-5">
            <p className="text-xs text-gray-500">
              This tool provides general financial information only and does not constitute personal financial advice.
            </p>
          </footer>
        </div>
      </div>
    </div>
  )
}
