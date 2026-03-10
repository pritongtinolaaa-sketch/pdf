import React, { useEffect, useState } from 'react'
import axios from 'axios'
import toast, { Toaster } from 'react-hot-toast'

import Navbar from './components/Navbar.jsx'
import Hero from './components/Hero.jsx'
import ToolGrid from './components/ToolGrid.jsx'
import ToolModal from './components/ToolModal.jsx'
import AuthModal from './components/AuthModal.jsx'
import ProfilePage from './components/ProfilePage.jsx'
import AdminUsersPage from './components/AdminUsersPage.jsx'

const TOKEN_KEY = 'schiropdf_token'

export default function App() {
  const [activeTool, setActiveTool] = useState(null)
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || '')
  const [user, setUser] = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const [page, setPage] = useState('home')
  const [authLoading, setAuthLoading] = useState(false)

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

  const refreshMe = async () => {
    if (!token) {
      setUser(null)
      return
    }
    try {
      const res = await axios.get('/api/auth/me', { headers: authHeaders })
      setUser(res.data.user)
    } catch (err) {
      localStorage.removeItem(TOKEN_KEY)
      setToken('')
      setUser(null)
    }
  }

  useEffect(() => {
    refreshMe()
  }, [token])

  const handleLoggedIn = ({ token: nextToken, user: nextUser }) => {
    localStorage.setItem(TOKEN_KEY, nextToken)
    setToken(nextToken)
    setUser(nextUser)
    setShowAuth(false)
    if (nextUser.is_verified || nextUser.is_admin) {
      toast.success(`Welcome, ${nextUser.username}!`)
    } else {
      setPage('profile')
      toast('Account created. Verify your email in Profile > Security before using tools.')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setToken('')
    setUser(null)
    setPage('home')
    setActiveTool(null)
    toast.success('Logged out successfully.')
  }

  const handleToolSelect = (tool) => {
    if (!user) {
      setShowAuth(true)
      toast('Please login to use tools.')
      return
    }
    setActiveTool(tool)
  }

  const handleUsernameUpdate = async (username) => {
    if (!token) return
    try {
      const res = await axios.post(
        '/api/auth/update-username',
        { username },
        { headers: authHeaders }
      )
      setUser(res.data.user)
      toast.success('Username updated.')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update username.')
    }
  }

  const openProfile = () => {
    if (!user) {
      setShowAuth(true)
      return
    }
    setPage('profile')
  }

  const refreshAndSetUser = async (maybeUser) => {
    if (maybeUser) {
      setUser(maybeUser)
    }
    await refreshMe()
  }

  return (
    <div className="min-h-screen bg-surface-900 text-slate-100 flex flex-col">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#111f16',
            color: '#e2e8f0',
            border: '1px solid rgba(16,185,129,0.25)',
          },
        }}
      />

      <Navbar
        user={user}
        onHome={() => setPage('home')}
        onProfile={openProfile}
        onAdmin={() => setPage('admin')}
        onLogin={() => setShowAuth(true)}
        onLogout={handleLogout}
      />

      <main className="flex-1">
        {page === 'home' && (
          <>
            <Hero />
            <ToolGrid onToolSelect={handleToolSelect} />
          </>
        )}

        {page === 'profile' && user && (
          <ProfilePage
            token={token}
            user={user}
            onUpdateUsername={handleUsernameUpdate}
            onBack={() => setPage('home')}
            onRefreshUser={refreshAndSetUser}
          />
        )}

        {page === 'admin' && user?.is_admin && (
          <AdminUsersPage token={token} onBack={() => setPage('home')} onRefreshUser={refreshMe} />
        )}
      </main>

      <footer className="relative border-t border-white/5 py-10 text-center" id="about">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 60% 80% at 50% 100%, rgba(16,185,129,0.04) 0%, transparent 70%)' }}
        />
        <div className="relative max-w-7xl mx-auto px-4">
          <p className="text-slate-600 text-xs">
            © {new Date().getFullYear()} schiropdf - secure tools with account credits.
          </p>
        </div>
      </footer>

      {showAuth && (
        <AuthModal
          loading={authLoading}
          setLoading={setAuthLoading}
          onClose={() => setShowAuth(false)}
          onSuccess={handleLoggedIn}
          onRequestProfile={() => setPage('profile')}
        />
      )}

      {activeTool && user && (
        <ToolModal
          tool={activeTool}
          token={token}
          onClose={() => setActiveTool(null)}
          onProcessed={refreshMe}
        />
      )}
    </div>
  )
}
