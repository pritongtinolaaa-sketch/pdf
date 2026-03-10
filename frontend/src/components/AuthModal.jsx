import React, { useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'

export default function AuthModal({ onClose, onSuccess, loading, setLoading }) {
  const [mode, setMode] = useState('login')
  const [forgotMode, setForgotMode] = useState(false)
  const [resetForm, setResetForm] = useState({ email: '', code: '', new_password: '' })
  const [form, setForm] = useState({ email: '', password: '', username: '' })

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const payload = {
        email: form.email.trim(),
        password: form.password,
      }
      if (mode === 'register') payload.username = form.username.trim()

      const res = await axios.post(endpoint, payload)
      if (mode === 'register' && res.data.dev_verification_code) {
        toast(`Dev verification code: ${res.data.dev_verification_code}`)
      }
      onSuccess(res.data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  const requestReset = async () => {
    if (!resetForm.email.trim()) {
      toast.error('Email is required.')
      return
    }
    setLoading(true)
    try {
      const res = await axios.post('/api/auth/request-password-reset', { email: resetForm.email.trim() })
      if (res.data.dev_reset_code) {
        toast(`Dev reset code: ${res.data.dev_reset_code}`)
      }
      toast.success('If your account exists, reset code has been sent.')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reset request failed.')
    } finally {
      setLoading(false)
    }
  }

  const confirmReset = async () => {
    setLoading(true)
    try {
      await axios.post('/api/auth/reset-password', {
        email: resetForm.email.trim(),
        code: resetForm.code.trim(),
        new_password: resetForm.new_password,
      })
      toast.success('Password reset successful. Please login now.')
      setForgotMode(false)
      setMode('login')
      setResetForm({ email: '', code: '', new_password: '' })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Password reset failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'rgba(12,22,16,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">
            {mode === 'login' ? 'Login to schiropdf' : 'Create your account'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {!forgotMode && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 rounded-lg text-sm ${mode === 'login' ? 'btn-primary' : 'btn-ghost'}`}
              type="button"
            >
              Login
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2 rounded-lg text-sm ${mode === 'register' ? 'btn-primary' : 'btn-ghost'}`}
              type="button"
            >
              Register
            </button>
          </div>
        )}

        {!forgotMode ? (
          <form onSubmit={submit} className="space-y-3">
          {mode === 'register' && (
            <input
              required
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              placeholder="Username"
              className="w-full rounded-xl px-3 py-2.5 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          )}

          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            placeholder="Email"
            className="w-full rounded-xl px-3 py-2.5 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          />

          <input
            required
            minLength={6}
            type="password"
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            placeholder="Password"
            className="w-full rounded-xl px-3 py-2.5 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          />

          <button disabled={loading} className="btn-primary w-full py-2.5 text-sm" type="submit">
            {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
          </button>

          {mode === 'login' && (
            <button
              type="button"
              className="text-xs text-slate-400 hover:text-green-400 w-full text-center"
              onClick={() => setForgotMode(true)}
            >
              Forgot password?
            </button>
          )}

          {mode === 'register' && (
            <p className="text-xs text-slate-500 text-center">
              New accounts get 30 credits. Master email gets unlimited admin access.
            </p>
          )}
          </form>
        ) : (
          <div className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={resetForm.email}
              onChange={(e) => setResetForm((p) => ({ ...p, email: e.target.value }))}
              className="w-full rounded-xl px-3 py-2.5 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <button type="button" className="btn-ghost w-full py-2.5 text-sm" onClick={requestReset} disabled={loading}>
              Send reset code
            </button>

            <input
              placeholder="Reset code"
              value={resetForm.code}
              onChange={(e) => setResetForm((p) => ({ ...p, code: e.target.value }))}
              className="w-full rounded-xl px-3 py-2.5 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <input
              type="password"
              minLength={6}
              placeholder="New password"
              value={resetForm.new_password}
              onChange={(e) => setResetForm((p) => ({ ...p, new_password: e.target.value }))}
              className="w-full rounded-xl px-3 py-2.5 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <button type="button" className="btn-primary w-full py-2.5 text-sm" onClick={confirmReset} disabled={loading}>
              Reset password
            </button>
            <button
              type="button"
              className="text-xs text-slate-400 hover:text-green-400 w-full text-center"
              onClick={() => setForgotMode(false)}
            >
              Back to login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
