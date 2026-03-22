import { Outlet } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { supabase } from '../supabase'
import Sidebar from './Sidebar'

export default function Layout({ session }) {
  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />

      <div className="flex-1 min-w-0">
        <header className="bg-white border-b border-gray-100">
          <div className="px-6 py-4 flex items-center justify-end gap-4">
            <span className="text-sm text-gray-500 hidden md:block">
              {session?.user?.email}
            </span>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </header>

        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}