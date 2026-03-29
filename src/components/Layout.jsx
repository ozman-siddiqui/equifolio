import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import {
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { supabase } from '../supabase'
import Sidebar from './Sidebar'

export default function Layout({ session, onSignOut }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
            <div className="w-10 h-10 rounded-2xl bg-primary-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
              E
            </div>

            <div className="min-w-0">
              <p className="text-xl font-bold text-gray-900 leading-tight">
                Equifolio
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
                  <div className="w-10 h-10 rounded-2xl bg-primary-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
                    E
                  </div>

                  <div className="min-w-0">
                    <p className="text-xl font-bold text-gray-900 leading-tight">
                      Equifolio
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
              <Outlet />
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
