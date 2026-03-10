import React from 'react'
import { FileText, LogOut, UserCircle2, LogIn, Shield } from 'lucide-react'
import UserBadge from './UserBadge.jsx'

export default function Navbar({ user, onHome, onProfile, onAdmin, onLogin, onLogout }) {
  return (
    <nav className="sticky top-0 z-40 bg-surface-900/75 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <button onClick={onHome} className="flex items-center gap-2.5 group">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
              boxShadow: '0 0 16px rgba(16,185,129,0.35)',
            }}
          >
            <FileText size={16} className="text-black" strokeWidth={2.5} />
          </div>
          <span className="text-base sm:text-lg font-bold tracking-tight text-white">
            schiro<span className="text-gradient">pdf</span>
          </span>
        </button>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-xs text-slate-400">{user.username}</span>
                <UserBadge tier={user.account_tier} compact />
              </div>
              {user.is_admin && (
                <button onClick={onAdmin} className="btn-ghost text-xs sm:text-sm px-3 py-2">
                  <Shield size={14} />
                  Admin
                </button>
              )}
              <button onClick={onProfile} className="btn-ghost text-xs sm:text-sm px-3 py-2">
                <UserCircle2 size={14} />
                Profile
              </button>
              <button onClick={onLogout} className="btn-primary text-xs sm:text-sm px-3 py-2">
                <LogOut size={14} />
                Logout
              </button>
            </>
          ) : (
            <button onClick={onLogin} className="btn-primary text-xs sm:text-sm px-3 py-2">
              <LogIn size={14} />
              Login
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}
