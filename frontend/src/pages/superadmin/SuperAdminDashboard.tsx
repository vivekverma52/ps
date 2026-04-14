import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import saApi from '../../services/saApi'
import { useSuperAdmin } from '../../context/SuperAdminContext'

interface OrgStats {
  total_orgs: number
  active_orgs: number
  suspended_orgs: number
  total_users: number
  total_prescriptions: number
  prescriptions_this_month: number
}

interface Org {
  id: string
  name: string
  plan: 'FREE' | 'PRO' | 'ENTERPRISE'
  status: 'ACTIVE' | 'SUSPENDED'
  user_count: number
  prescription_count: number
  prescriptions_this_month: number
  owner_name: string
  owner_email: string
  created_at: string
}

// ── Theme helpers ─────────────────────────────────────────────────────────────
function useThemeVars(theme: 'dark' | 'light') {
  if (theme === 'dark') {
    return {
      page:        'var(--dark)',
      topbar:      'var(--dark)',
      topbarBorder:'var(--dark-border)',
      card:        'var(--dark-mid)',
      cardBorder:  'var(--dark-border)',
      rowHover:    'var(--dark-light)',
      inputBg:     'var(--dark-mid)',
      inputBorder: 'var(--dark-border)',
      textPrimary: '#F1F5F9',
      textSub:     '#94A3B8',
      textMuted:   '#64748B',
      divider:     'var(--dark-border)',
    }
  }
  return {
    page:        'var(--cream)',
    topbar:      'var(--surface)',
    topbarBorder:'var(--border)',
    card:        'var(--surface)',
    cardBorder:  'var(--border)',
    rowHover:    'var(--cell)',
    inputBg:     'var(--cream)',
    inputBorder: 'var(--border)',
    textPrimary: 'var(--ink)',
    textSub:     'var(--ink-light)',
    textMuted:   'var(--ink-light)',
    divider:     'var(--border)',
  }
}

// ── Plan badge styles ─────────────────────────────────────────────────────────
const PLAN_BADGE: Record<string, { bg: string; color: string }> = {
  FREE:       { bg: 'rgba(100,116,139,.15)', color: '#94A3B8' },
  PRO:        { bg: 'rgba(99,102,241,.15)',  color: '#818CF8' },
  ENTERPRISE: { bg: 'rgba(168,85,247,.15)',  color: '#C084FC' },
}

// ── Create Org Modal ──────────────────────────────────────────────────────────
function CreateOrgModal({ onClose, onCreated, dark }: {
  onClose: () => void
  onCreated: () => void
  dark: boolean
}) {
  const [form, setForm] = useState({
    org_name: '', plan: 'FREE', admin_name: '', admin_email: '', admin_password: '',
    address: '', phone: '', pharmacist_name: '', pharmacist_email: '', pharmacist_password: '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { pharmacist_name, pharmacist_email, pharmacist_password, ...base } = form
    const hasPharmacist = pharmacist_name || pharmacist_email || pharmacist_password
    if (hasPharmacist && (!pharmacist_name || !pharmacist_email || !pharmacist_password)) {
      toast.error('Fill in all three pharmacist fields or leave them all empty')
      return
    }
    const payload = hasPharmacist
      ? { ...base, pharmacist_name, pharmacist_email, pharmacist_password }
      : base
    setLoading(true)
    try {
      await saApi.post('/superadmin/organizations', payload)
      toast.success(`${form.org_name} created!`)
      onCreated()
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create')
    } finally {
      setLoading(false)
    }
  }

  const cardBg   = dark ? 'var(--dark-mid)'    : 'var(--surface)'
  const cardBdr  = dark ? 'var(--dark-border)'  : 'var(--border)'
  const inputBg  = dark ? 'var(--dark)'         : 'var(--cream)'
  const txtMain  = dark ? '#F1F5F9'             : 'var(--ink)'
  const txtSub   = dark ? '#94A3B8'             : 'var(--ink-light)'
  const txtMuted = dark ? '#64748B'             : 'var(--ink-light)'

  const inp: React.CSSProperties = {
    width: '100%', background: inputBg, border: `1px solid ${cardBdr}`, color: txtMain,
    padding: '9px 12px', borderRadius: 10, fontSize: 13, outline: 'none', fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 500, color: txtSub, marginBottom: 5 }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        style={{ background: cardBg, border: `1px solid ${cardBdr}`, maxWidth: 560 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: txtMain }}>Create Organization</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: txtSub, display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Row 1 */}
          <div>
            <label style={lbl}>Organization Name *</label>
            <input style={inp} placeholder="e.g. Apollo Hospitals" value={form.org_name}
              onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Plan</label>
              <select style={inp} value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                <option value="FREE">Free (10 rx/mo)</option>
                <option value="PRO">Pro (200 rx/mo)</option>
                <option value="ENTERPRISE">Enterprise (Unlimited)</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Phone</label>
              <input style={inp} placeholder="+91 XXXXX XXXXX" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>

          {/* Admin section */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#6366F1', marginBottom: 10 }}>
              Doctor / Admin Account
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Admin Name *</label>
                <input style={inp} placeholder="Full name" value={form.admin_name}
                  onChange={e => setForm(f => ({ ...f, admin_name: e.target.value }))} required />
              </div>
              <div>
                <label style={lbl}>Admin Email *</label>
                <input style={inp} type="email" placeholder="admin@hospital.com" value={form.admin_email}
                  onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} required />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Admin Password *</label>
                <input style={inp} type="password" placeholder="Min 6 characters" value={form.admin_password}
                  onChange={e => setForm(f => ({ ...f, admin_password: e.target.value }))} required />
              </div>
            </div>
          </div>

          {/* Pharmacist section */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#A855F7', marginBottom: 10 }}>
              Pharmacist Account{' '}
              <span style={{ fontSize: 11, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: txtMuted }}>(optional)</span>
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Pharmacist Name</label>
                <input style={inp} placeholder="Full name" value={form.pharmacist_name}
                  onChange={e => setForm(f => ({ ...f, pharmacist_name: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Pharmacist Email</label>
                <input style={inp} type="email" placeholder="pharma@hospital.com" value={form.pharmacist_email}
                  onChange={e => setForm(f => ({ ...f, pharmacist_email: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Pharmacist Password</label>
                <input style={inp} type="password" placeholder="Min 6 characters" value={form.pharmacist_password}
                  onChange={e => setForm(f => ({ ...f, pharmacist_password: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                background: 'none', border: `1px solid ${cardBdr}`, color: txtSub, fontFamily: 'var(--font-sans)' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: 'linear-gradient(135deg, #6366F1, #4F46E5)', color: '#fff', border: 'none',
                opacity: loading ? .6 : 1, fontFamily: 'var(--font-sans)' }}>
              {loading ? 'Creating…' : 'Create Organization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  const { superAdmin, logout, theme, toggleTheme } = useSuperAdmin()
  const navigate = useNavigate()
  const [stats, setStats] = useState<OrgStats | null>(null)
  const [orgs, setOrgs] = useState<Org[]>([])
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)

  const t = useThemeVars(theme)
  const dark = theme === 'dark'

  const fetchData = async () => {
    try {
      const [dashRes, orgsRes] = await Promise.all([
        saApi.get('/superadmin/dashboard'),
        saApi.get('/superadmin/organizations'),
      ])
      setStats(dashRes.data.data.stats)
      setOrgs(orgsRes.data.data)
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const fetchOrgs = async () => {
    const params = new URLSearchParams()
    if (search)      params.append('search', search)
    if (planFilter)  params.append('plan', planFilter)
    if (statusFilter) params.append('status', statusFilter)
    const res = await saApi.get(`/superadmin/organizations?${params}`)
    setOrgs(res.data.data)
  }

  useEffect(() => { if (!loading) fetchOrgs() }, [search, planFilter, statusFilter])

  const toggleStatus = async (org: Org) => {
    const newStatus = org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    try {
      await saApi.put(`/superadmin/organizations/${org.id}`, { status: newStatus })
      toast.success(`${org.name} ${newStatus === 'ACTIVE' ? 'activated' : 'suspended'}`)
      fetchData()
    } catch {
      toast.error('Failed to update')
    }
  }

  const updatePlan = async (orgId: string, plan: string) => {
    try {
      await saApi.put(`/superadmin/organizations/${orgId}`, { plan })
      toast.success('Plan updated')
      fetchData()
    } catch {
      toast.error('Failed to update plan')
    }
  }

  const inp: React.CSSProperties = {
    background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.textPrimary,
    padding: '9px 12px', borderRadius: 10, fontSize: 13, outline: 'none',
    fontFamily: 'var(--font-sans)',
  }

  return (
    <div style={{ background: t.page, minHeight: '100vh', transition: 'background .2s' }}>

      {/* Topbar */}
      <nav style={{
        height: 56, background: t.topbar, borderBottom: `1px solid ${t.topbarBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', position: 'sticky', top: 0, zIndex: 40, transition: 'background .2s',
      }}>
        {/* Logo / brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#6366F1,#4F46E5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 13, color: t.textPrimary }}>Exato Admin</span>
          <span style={{ fontSize: 11, color: t.textMuted }}>Platform Console</span>
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: t.textSub }}>{superAdmin?.name}</span>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: t.card, border: `1px solid ${t.cardBorder}`, cursor: 'pointer', flexShrink: 0,
            }}
          >
            {dark ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textSub} strokeWidth="2">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textSub} strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>

          <button
            onClick={() => { logout(); navigate('/superadmin/login') }}
            style={{
              fontSize: 12, padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
              background: 'none', border: `1px solid ${t.cardBorder}`, color: t.textSub,
              fontFamily: 'var(--font-sans)',
            }}
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px' }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: t.textPrimary, letterSpacing: '-.4px', marginBottom: 3 }}>
              Organizations
            </h1>
            <p style={{ fontSize: 13, color: t.textSub }}>Manage all platform organizations</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10,
              fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
              background: 'linear-gradient(135deg,#6366F1,#4F46E5)', border: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Organization
          </button>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 28 }}>
          {stats && [
            { label: 'Total Orgs',    value: stats.total_orgs,               accent: '#6366F1' },
            { label: 'Active',        value: stats.active_orgs,              accent: '#10B981' },
            { label: 'Suspended',     value: stats.suspended_orgs,           accent: '#EF4444' },
            { label: 'Total Users',   value: stats.total_users,              accent: '#F59E0B' },
            { label: 'All Rx',        value: stats.total_prescriptions,      accent: '#06B6D4' },
            { label: 'Rx This Month', value: stats.prescriptions_this_month, accent: '#EC4899' },
          ].map(s => (
            <div key={s.label} style={{
              background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: '14px 16px',
            }}>
              <p style={{
                fontSize: 26, fontWeight: 700, color: t.textPrimary,
                fontFamily: 'var(--font-serif)', fontStyle: 'italic', lineHeight: 1,
              }}>
                {s.value}
              </p>
              <p style={{ fontSize: 11, color: t.textSub, marginTop: 4 }}>{s.label}</p>
              <div style={{ width: 24, height: 2, background: s.accent, borderRadius: 99, marginTop: 8 }} />
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              style={{ ...inp, paddingLeft: 32, width: '100%', boxSizing: 'border-box' }}
              placeholder="Search organizations…"
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select style={inp} value={planFilter} onChange={e => setPlanFilter(e.target.value)}>
            <option value="">All Plans</option>
            <option value="FREE">Free</option>
            <option value="PRO">Pro</option>
            <option value="ENTERPRISE">Enterprise</option>
          </select>
          <select style={inp} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>

        {/* Table */}
        <div style={{
          background: t.card, border: `1px solid ${t.cardBorder}`,
          borderRadius: 14, overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '3fr 1.5fr 60px 60px 70px 1.5fr 100px',
            padding: '10px 20px', borderBottom: `1px solid ${t.divider}`,
            fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: t.textMuted,
          }}>
            <div>Organization</div>
            <div>Plan</div>
            <div style={{ textAlign: 'center' }}>Users</div>
            <div style={{ textAlign: 'center' }}>Rx</div>
            <div style={{ textAlign: 'center' }}>This Mo.</div>
            <div>Status</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '56px 0' }}>
              <div style={{
                width: 26, height: 26, border: '2px solid #6366F1',
                borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite',
              }} />
            </div>
          ) : orgs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '56px 0', fontSize: 13, color: t.textMuted }}>
              No organizations found
            </div>
          ) : orgs.map(org => (
            <div
              key={org.id}
              style={{
                display: 'grid', gridTemplateColumns: '3fr 1.5fr 60px 60px 70px 1.5fr 100px',
                padding: '14px 20px', alignItems: 'center',
                borderBottom: `1px solid ${t.divider}`, cursor: 'pointer', transition: 'background .12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => navigate(`/superadmin/organizations/${org.id}`)}
            >
              {/* Name + email */}
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, marginBottom: 2 }}>{org.name}</p>
                <p style={{ fontSize: 11, color: t.textMuted }}>{org.owner_email || '—'}</p>
              </div>

              {/* Plan dropdown */}
              <div onClick={e => e.stopPropagation()}>
                <select
                  value={org.plan}
                  onChange={e => updatePlan(org.id, e.target.value)}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                    border: 'none', cursor: 'pointer', outline: 'none', fontFamily: 'var(--font-sans)',
                    background: PLAN_BADGE[org.plan]?.bg ?? 'transparent',
                    color: PLAN_BADGE[org.plan]?.color ?? t.textSub,
                  }}
                >
                  <option value="FREE">FREE</option>
                  <option value="PRO">PRO</option>
                  <option value="ENTERPRISE">ENTERPRISE</option>
                </select>
              </div>

              <div style={{ textAlign: 'center', fontSize: 13, color: t.textSub }}>{org.user_count}</div>
              <div style={{ textAlign: 'center', fontSize: 13, color: t.textSub }}>{org.prescription_count}</div>
              <div style={{ textAlign: 'center', fontSize: 13, color: t.textSub }}>{org.prescriptions_this_month}</div>

              {/* Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => toggleStatus(org)}
                  title={org.status === 'ACTIVE' ? 'Click to suspend' : 'Click to activate'}
                  style={{
                    width: 36, height: 18, borderRadius: 999, border: 'none', cursor: 'pointer',
                    position: 'relative', flexShrink: 0,
                    background: org.status === 'ACTIVE' ? '#10B981' : '#94A3B8',
                    transition: 'background .2s',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 2, left: 2, width: 14, height: 14,
                    background: '#fff', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,.3)',
                    transition: 'transform .2s',
                    transform: org.status === 'ACTIVE' ? 'translateX(18px)' : 'translateX(0)',
                  }} />
                </button>
                <span style={{ fontSize: 11, fontWeight: 600, color: org.status === 'ACTIVE' ? '#10B981' : t.textMuted }}>
                  {org.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                </span>
              </div>

              {/* View */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => navigate(`/superadmin/organizations/${org.id}`)}
                  style={{
                    fontSize: 11, padding: '5px 12px', borderRadius: 7, cursor: 'pointer',
                    border: '1px solid #6366F1', color: '#6366F1', background: 'none',
                    fontFamily: 'var(--font-sans)', fontWeight: 500,
                  }}
                >
                  View
                </button>
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 11, color: t.textMuted, marginTop: 10, textAlign: 'right' }}>
          {orgs.length} organization{orgs.length !== 1 ? 's' : ''}
        </p>
      </div>

      {showCreate && (
        <CreateOrgModal dark={dark} onClose={() => setShowCreate(false)} onCreated={fetchData} />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
