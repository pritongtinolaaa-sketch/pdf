import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  Activity,
  ArrowLeft,
  Ban,
  BarChart3,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Unlock,
  Users,
} from 'lucide-react'
import UserBadge from './UserBadge.jsx'

const tabs = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'credit-audit', label: 'Credit Audit', icon: Activity },
  { id: 'auth-audit', label: 'Auth Audit', icon: ShieldAlert },
]

export default function AdminUsersPage({ token, onBack }) {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState([])
  const [events, setEvents] = useState([])
  const [authEvents, setAuthEvents] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(false)
  const [creditMap, setCreditMap] = useState({})

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const loadUsers = async (q = '') => {
    setLoading(true)
    try {
      const res = await axios.get('/api/admin/users', {
        headers,
        params: q ? { search: q } : undefined,
      })
      setUsers(res.data.users || [])

      const [auditRes, authAuditRes, analyticsRes] = await Promise.all([
        axios.get('/api/admin/audit', { headers, params: q ? { search: q } : undefined }),
        axios.get('/api/admin/auth-audit', { headers, params: q ? { search: q } : undefined }),
        axios.get('/api/admin/analytics', { headers }),
      ])

      setEvents(auditRes.data.events || [])
      setAuthEvents(authAuditRes.data.events || [])
      setAnalytics(analyticsRes.data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load admin data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers('')
  }, [])

  const addCredits = async (userId) => {
    const amount = Number(creditMap[userId] || 0)
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error('Enter a valid credit amount.')
      return
    }

    try {
      await axios.post(`/api/admin/users/${userId}/add-credits`, { amount }, { headers })
      toast.success('Credits added.')
      await loadUsers(search)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not add credits.')
    }
  }

  const blockUser = async (userId) => {
    try {
      await axios.post(`/api/admin/users/${userId}/block`, {}, { headers })
      toast.success('User blocked.')
      await loadUsers(search)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not block user.')
    }
  }

  const unblockUser = async (userId) => {
    try {
      await axios.post(`/api/admin/users/${userId}/unblock`, {}, { headers })
      toast.success('User unblocked.')
      await loadUsers(search)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not unblock user.')
    }
  }

  const deleteUser = async (userId, email) => {
    const ok = window.confirm(`Delete account ${email}? This cannot be undone.`)
    if (!ok) return
    try {
      await axios.delete(`/api/admin/users/${userId}`, { headers })
      toast.success('User deleted.')
      await loadUsers(search)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not delete user.')
    }
  }

  const upgradePremium = async (userId) => {
    try {
      const res = await axios.post(`/api/admin/users/${userId}/upgrade-premium`, {}, { headers })
      toast.success(res.data.message || 'User upgraded to premium.')
      await loadUsers(search)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not upgrade user.')
    }
  }

  const downgradeFree = async (userId, email) => {
    const ok = window.confirm(`Downgrade ${email} to free tier? Their current credits will be kept.`)
    if (!ok) return
    try {
      const res = await axios.post(`/api/admin/users/${userId}/downgrade-free`, {}, { headers })
      toast.success(res.data.message || 'User downgraded to free.')
      await loadUsers(search)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not downgrade user.')
    }
  }

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <button onClick={onBack} className="btn-ghost mb-6 text-sm">
        <ArrowLeft size={14} />
        Back
      </button>

      <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Admin Console</h1>
        <p className="text-slate-400 mb-5">Manage users, account status, and platform activity.</p>

        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-xs sm:text-sm px-3 py-2 rounded-lg flex items-center gap-2 ${active ? 'btn-primary' : 'btn-ghost'}`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="flex gap-2 mb-6">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by username or email"
              className="w-full rounded-xl pl-9 pr-3 py-2.5 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
          <button className="btn-primary text-sm px-4 py-2.5" onClick={() => loadUsers(search)}>
            Search
          </button>
        </div>

        {activeTab === 'users' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-white/10">
                  <th className="text-left py-2">Username</th>
                  <th className="text-left py-2">Email</th>
                  <th className="text-left py-2">Credits</th>
                  <th className="text-left py-2">Badge</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-white/5">
                    <td className="py-2.5 text-white">{u.username}</td>
                    <td className="py-2.5 text-slate-300 break-all">{u.email}</td>
                    <td className="py-2.5 text-slate-200">{u.is_admin ? 'Unlimited' : u.credits}</td>
                    <td className="py-2.5"><UserBadge tier={u.account_tier} compact /></td>
                    <td className="py-2.5">
                      <span className={`text-xs px-2 py-1 rounded-full ${u.is_blocked ? 'text-rose-300 bg-rose-500/20' : 'text-green-300 bg-green-500/20'}`}>
                        {u.is_blocked ? 'Blocked' : 'Active'}
                      </span>
                    </td>
                    <td className="py-2.5">
                      {!u.is_admin ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            value={creditMap[u.id] || ''}
                            onChange={(e) => setCreditMap((p) => ({ ...p, [u.id]: e.target.value }))}
                            placeholder="Credits"
                            className="w-20 rounded-lg px-2 py-1.5 text-slate-200 placeholder-slate-600 text-xs focus:outline-none focus:ring-2 focus:ring-green-500/40"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                          />
                          <button className="btn-ghost text-xs px-2 py-1.5" onClick={() => addCredits(u.id)}>Add</button>
                          {u.account_tier === 'free' && (
                            <button className="btn-ghost text-xs px-2 py-1.5" onClick={() => upgradePremium(u.id)}>
                              <Sparkles size={12} /> Premium
                            </button>
                          )}
                          {u.account_tier === 'premium' && (
                            <button className="btn-ghost text-xs px-2 py-1.5 text-amber-300" onClick={() => downgradeFree(u.id, u.email)}>
                              Downgrade
                            </button>
                          )}
                          {u.is_blocked ? (
                            <button className="btn-ghost text-xs px-2 py-1.5" onClick={() => unblockUser(u.id)}>
                              <Unlock size={12} /> Unblock
                            </button>
                          ) : (
                            <button className="btn-ghost text-xs px-2 py-1.5" onClick={() => blockUser(u.id)}>
                              <Ban size={12} /> Block
                            </button>
                          )}
                          <button className="btn-ghost text-xs px-2 py-1.5 text-rose-300" onClick={() => deleteUser(u.id, u.email)}>
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs">Master admin</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && users.length === 0 && <p className="text-slate-500 text-sm py-4">No users found.</p>}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-5">
            {analytics?.summary ? (
              <>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p className="text-slate-500 text-xs">Total users</p>
                    <p className="text-white text-xl font-semibold">{analytics.summary.total_users}</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p className="text-slate-500 text-xs">Verified users</p>
                    <p className="text-white text-xl font-semibold">{analytics.summary.verified_users}</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p className="text-slate-500 text-xs">Credits used (7d)</p>
                    <p className="text-white text-xl font-semibold">{analytics.summary.credits_used_7d}</p>
                  </div>
                </div>

                <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-slate-300 text-sm font-medium mb-3">Top tool routes</p>
                  <div className="space-y-2">
                    {(analytics.top_tools || []).map((t) => {
                      const maxRuns = Math.max(...(analytics.top_tools || []).map((x) => x.runs), 1)
                      const width = Math.max(8, Math.round((t.runs / maxRuns) * 100))
                      return (
                        <div key={t.route}>
                          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                            <span>{t.route}</span>
                            <span>{t.runs} runs</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${width}%`, background: 'linear-gradient(90deg,#34d399,#10b981)' }} />
                          </div>
                        </div>
                      )
                    })}
                    {(!analytics.top_tools || analytics.top_tools.length === 0) && (
                      <p className="text-slate-500 text-xs">No tool usage recorded yet.</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-slate-500 text-sm">No analytics available yet.</p>
            )}
          </div>
        )}

        {activeTab === 'credit-audit' && (
          <div className="overflow-x-auto max-h-[28rem]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-white/10">
                  <th className="text-left py-2">User</th>
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Delta</th>
                  <th className="text-left py-2">After</th>
                  <th className="text-left py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-white/5">
                    <td className="py-2.5 text-slate-200">{e.username} ({e.email})</td>
                    <td className="py-2.5 text-slate-300">{e.event_type}</td>
                    <td className={`py-2.5 ${e.delta >= 0 ? 'text-green-400' : 'text-rose-400'}`}>{e.delta >= 0 ? `+${e.delta}` : e.delta}</td>
                    <td className="py-2.5 text-slate-300">{e.credits_after ?? '-'}</td>
                    <td className="py-2.5 text-slate-500">{e.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && events.length === 0 && <p className="text-slate-500 text-sm py-4">No credit audit events found.</p>}
          </div>
        )}

        {activeTab === 'auth-audit' && (
          <div className="overflow-x-auto max-h-[28rem]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-white/10">
                  <th className="text-left py-2">Email</th>
                  <th className="text-left py-2">Event</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Details</th>
                  <th className="text-left py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {authEvents.map((e) => (
                  <tr key={e.id} className="border-b border-white/5">
                    <td className="py-2.5 text-slate-200">{e.email || '-'}</td>
                    <td className="py-2.5 text-slate-300">{e.event_type}</td>
                    <td className={`py-2.5 ${e.status === 'success' ? 'text-green-400' : 'text-amber-400'}`}>{e.status}</td>
                    <td className="py-2.5 text-slate-500">{e.details || '-'}</td>
                    <td className="py-2.5 text-slate-500">{e.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && authEvents.length === 0 && <p className="text-slate-500 text-sm py-4">No auth audit events found.</p>}
          </div>
        )}
      </div>
    </section>
  )
}
