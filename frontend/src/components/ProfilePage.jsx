import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { ArrowLeft, BadgeCheck, Coins, MailCheck, ShoppingCart, User } from 'lucide-react'
import UserBadge from './UserBadge.jsx'

export default function ProfilePage({ user, token, onUpdateUsername, onBack, onRefreshUser }) {
  const [username, setUsername] = useState(user.username || '')
  const [verificationCode, setVerificationCode] = useState('')
  const [tiers, setTiers] = useState([])
  const [events, setEvents] = useState([])
  const [purchases, setPurchases] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [privacyMode, setPrivacyMode] = useState(localStorage.getItem('schiropdf_privacy_mode') === '1')
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const submitUsername = (e) => {
    e.preventDefault()
    onUpdateUsername(username)
  }

  const sendVerificationCode = async () => {
    try {
      const res = await axios.post('/api/auth/send-verification-code', {}, { headers })
      if (res.data.dev_verification_code) {
        toast(`Dev verification code: ${res.data.dev_verification_code}`)
      }
      toast.success(res.data.message || 'Verification code sent.')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send verification code.')
    }
  }

  const verifyEmail = async () => {
    try {
      const res = await axios.post('/api/auth/verify-email', { code: verificationCode.trim() }, { headers })
      toast.success(res.data.message || 'Email verified.')
      setVerificationCode('')
      onRefreshUser(res.data.user)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Verification failed.')
    }
  }

  const loadBilling = async () => {
    try {
      const [tiersRes, histRes] = await Promise.all([
        axios.get('/api/billing/tiers'),
        axios.get('/api/credits/history', { headers }),
      ])
      setTiers(tiersRes.data.tiers || [])
      setEvents(histRes.data.events || [])
      setPurchases(histRes.data.purchases || [])
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load billing data.')
    } finally {
      setLoadingHistory(false)
    }
  }

  const buyTier = async (tierId) => {
    try {
      const res = await axios.post('/api/billing/purchase', { tier_id: tierId }, { headers })
      toast.success(res.data.message || 'Purchase successful.')
      onRefreshUser(res.data.user)
      loadBilling()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Purchase failed.')
    }
  }

  useEffect(() => {
    setLoadingHistory(true)
    loadBilling()
  }, [])

  useEffect(() => {
    localStorage.setItem('schiropdf_privacy_mode', privacyMode ? '1' : '0')
  }, [privacyMode])

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-6">
      <button onClick={onBack} className="btn-ghost text-sm">
        <ArrowLeft size={14} />
        Back
      </button>

      <div className="rounded-2xl p-6 sm:p-8" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Hi, {user.username}</h1>
          <UserBadge tier={user.account_tier} />
        </div>
        <p className="text-slate-400 mb-8">Manage your account, credits, and security.</p>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div className="flex items-center gap-2 text-green-400 text-sm mb-2">
              <Coins size={14} />
              Available Credits
            </div>
            <p className="text-white text-2xl font-bold">{user.is_admin ? 'Unlimited' : user.credits}</p>
          </div>

          <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
              <User size={14} />
              Account
            </div>
            <p className="text-white font-semibold break-all">{user.email}</p>
          </div>

          <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
              <BadgeCheck size={14} />
              Verification
            </div>
            <p className="text-white font-semibold">{user.is_verified || user.is_admin ? 'Verified' : 'Pending verification'}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 className="text-white font-semibold mb-3">Edit Username</h2>
            <form onSubmit={submitUsername} className="space-y-3">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                minLength={2}
                required
                className="w-full rounded-xl px-3 py-2.5 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
              <button className="btn-primary text-sm px-5 py-2.5" type="submit">Save username</button>
            </form>
          </div>

          <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 className="text-white font-semibold mb-3">Security: Email Verification</h2>
            {user.is_verified || user.is_admin ? (
              <p className="text-green-400 text-sm flex items-center gap-2"><MailCheck size={14} /> Your email is verified.</p>
            ) : (
              <div className="space-y-3">
                <button type="button" className="btn-ghost text-sm px-4 py-2" onClick={sendVerificationCode}>
                  Send verification code
                </button>
                <input
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="w-full rounded-xl px-3 py-2.5 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                <button type="button" className="btn-primary text-sm px-4 py-2" onClick={verifyEmail}>
                  Verify email
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><ShoppingCart size={16} /> Buy Credits</h2>
        <p className="text-slate-400 mb-5 text-sm">Choose a tier and instantly top up your account.</p>
        <div className="grid md:grid-cols-3 gap-4">
          {tiers.map((tier) => (
            <div key={tier.id} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <p className="text-white font-semibold mb-1">{tier.name}</p>
              <p className="text-green-400 text-sm mb-1">+{tier.credits} credits</p>
              <p className="text-slate-400 text-sm mb-3">${tier.price_usd.toFixed(2)}</p>
              <button className="btn-primary text-xs px-3 py-2" onClick={() => buyTier(tier.id)} disabled={user.is_admin}>
                {user.is_admin ? 'Admin unlimited' : 'Buy now'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-6">
        <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 className="text-white font-semibold mb-4">Credit Event History</h3>
          <div className="max-h-80 overflow-auto text-sm">
            <table className="w-full">
              <thead>
                <tr className="text-slate-500 border-b border-white/10">
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Delta</th>
                  <th className="text-left py-2">After</th>
                  <th className="text-left py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-white/5">
                    <td className="py-2 text-slate-200">{e.event_type}</td>
                    <td className={`py-2 ${e.delta >= 0 ? 'text-green-400' : 'text-rose-400'}`}>{e.delta >= 0 ? `+${e.delta}` : e.delta}</td>
                    <td className="py-2 text-slate-300">{e.credits_after ?? '-'}</td>
                    <td className="py-2 text-slate-500">{e.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loadingHistory && events.length === 0 && <p className="text-slate-500 text-xs py-3">No events yet.</p>}
          </div>
        </div>

        <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 className="text-white font-semibold mb-4">Purchase History</h3>
          <div className="max-h-80 overflow-auto text-sm">
            <table className="w-full">
              <thead>
                <tr className="text-slate-500 border-b border-white/10">
                  <th className="text-left py-2">Tier</th>
                  <th className="text-left py-2">Credits</th>
                  <th className="text-left py-2">Price</th>
                  <th className="text-left py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} className="border-b border-white/5">
                    <td className="py-2 text-slate-200">{p.tier_name}</td>
                    <td className="py-2 text-green-400">+{p.credits_added}</td>
                    <td className="py-2 text-slate-300">${Number(p.price_usd).toFixed(2)}</td>
                    <td className="py-2 text-slate-500">{p.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loadingHistory && purchases.length === 0 && <p className="text-slate-500 text-xs py-3">No purchases yet.</p>}
          </div>
        </div>
      </div>

      <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="text-white font-semibold mb-3">Privacy & Data Lifecycle</h3>
        <div className="flex items-center justify-between rounded-xl px-4 py-3 mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <p className="text-slate-200 text-sm font-medium">Privacy mode</p>
            <p className="text-slate-500 text-xs">Minimize retained diagnostics on the client for this browser.</p>
          </div>
          <button
            onClick={() => setPrivacyMode((p) => !p)}
            className={`px-3 py-1.5 rounded-lg text-xs ${privacyMode ? 'btn-primary' : 'btn-ghost'}`}
          >
            {privacyMode ? 'Enabled' : 'Disabled'}
          </button>
        </div>
        <ul className="text-xs text-slate-500 space-y-1">
          <li>- Uploaded files are processed in-memory and are not permanently stored.</li>
          <li>- Verification/reset codes expire in 15 minutes.</li>
          <li>- Credit and auth event logs are retained for admin audit and abuse prevention.</li>
          <li>- Use privacy mode when working on shared machines.</li>
        </ul>
      </div>
    </section>
  )
}
