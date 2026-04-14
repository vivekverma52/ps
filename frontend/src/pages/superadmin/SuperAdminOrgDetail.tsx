import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import saApi from '../../services/saApi'
import { useSuperAdmin } from '../../context/SuperAdminContext'

interface OrgDetail {
  id: string
  name: string
  plan: string
  status: string
  prescription_limit: number
  team_limit: number
  user_count: number
  prescription_count: number
  prescriptions_this_month: number
  owner_name: string
  owner_email: string
  address?: string
  phone?: string
  website?: string
  created_at: string
  users: any[]
  roles: any[]
  recent_prescriptions: any[]
}

type Tab = 'overview' | 'users' | 'roles' | 'prescriptions'

function useThemeVars(theme: 'dark' | 'light') {
  if (theme === 'dark') return {
    page: 'var(--dark)', topbar: 'var(--dark)', topbarBorder: 'var(--dark-border)',
    card: 'var(--dark-mid)', cardBorder: 'var(--dark-border)',
    rowBg: 'var(--dark)', tabBg: 'var(--dark-light)',
    inp: 'var(--dark)', inpBorder: 'var(--dark-border)',
    textPrimary: '#F1F5F9', textSub: '#94A3B8', textMuted: '#64748B',
  }
  return {
    page: 'var(--cream)', topbar: 'var(--surface)', topbarBorder: 'var(--border)',
    card: 'var(--surface)', cardBorder: 'var(--border)',
    rowBg: 'var(--cream)', tabBg: 'var(--cell)',
    inp: 'var(--cream)', inpBorder: 'var(--border)',
    textPrimary: 'var(--ink)', textSub: 'var(--ink-light)', textMuted: 'var(--ink-light)',
  }
}

const PLAN_BADGE: Record<string, { bg: string; color: string }> = {
  FREE:       { bg: 'rgba(100,116,139,.15)', color: '#94A3B8' },
  PRO:        { bg: 'rgba(99,102,241,.15)',  color: '#818CF8' },
  ENTERPRISE: { bg: 'rgba(168,85,247,.15)',  color: '#C084FC' },
}

const RX_STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  SENT:     { bg: 'rgba(16,185,129,.12)',  color: '#10B981' },
  RENDERED: { bg: 'rgba(99,102,241,.12)', color: '#818CF8' },
  UPLOADED: { bg: 'rgba(245,158,11,.12)', color: '#F59E0B' },
}

export default function SuperAdminOrgDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useSuperAdmin()
  const [org, setOrg] = useState<OrgDetail | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)

  const t = useThemeVars(theme)
  const dark = theme === 'dark'

  const fetchOrg = async () => {
    try {
      const res = await saApi.get(`/superadmin/organizations/${id}`)
      setOrg(res.data.data)
    } catch {
      toast.error('Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchOrg() }, [id])

  const updatePlan = async (plan: string) => {
    try {
      await saApi.put(`/superadmin/organizations/${id}`, { plan })
      toast.success('Plan updated')
      fetchOrg()
    } catch { toast.error('Failed') }
  }

  const toggleStatus = async () => {
    if (!org) return
    const newStatus = org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    try {
      await saApi.put(`/superadmin/organizations/${id}`, { status: newStatus })
      toast.success(`Organization ${newStatus === 'ACTIVE' ? 'activated' : 'suspended'}`)
      fetchOrg()
    } catch { toast.error('Failed') }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: t.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, border: '2px solid #6366F1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (!org) return (
    <div style={{ minHeight: '100vh', background: t.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: t.textSub, fontSize: 14 }}>Organization not found</p>
    </div>
  )

  const inp: React.CSSProperties = {
    background: t.inp, border: `1px solid ${t.inpBorder}`, color: t.textPrimary,
    padding: '8px 12px', borderRadius: 10, fontSize: 13, outline: 'none',
    fontFamily: 'var(--font-sans)',
  }

  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 500, color: t.textSub, marginBottom: 5,
  }

  return (
    <div style={{ background: t.page, minHeight: '100vh', transition: 'background .2s' }}>

      {/* Topbar */}
      <nav style={{
        height: 56, background: t.topbar, borderBottom: `1px solid ${t.topbarBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', position: 'sticky', top: 0, zIndex: 40, transition: 'background .2s',
      }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate('/superadmin/dashboard')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textSub, display: 'flex' }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <div style={{ width: 1, height: 16, background: t.cardBorder }} />
          <span style={{ fontSize: 12, color: t.textSub }}>Organizations</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 500, color: t.textPrimary }}>{org.name}</span>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: t.card, border: `1px solid ${t.cardBorder}`, cursor: 'pointer',
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
      </nav>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 32px' }}>

        {/* Org header card */}
        <div style={{
          background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 14,
          padding: '22px 24px', marginBottom: 20,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <h1 style={{ fontSize: 20, fontWeight: 600, color: t.textPrimary, letterSpacing: '-.3px' }}>
                {org.name}
              </h1>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, letterSpacing: '.3px',
                background: PLAN_BADGE[org.plan]?.bg ?? 'transparent',
                color: PLAN_BADGE[org.plan]?.color ?? t.textSub,
              }}>{org.plan}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                background: org.status === 'ACTIVE' ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)',
                color: org.status === 'ACTIVE' ? '#10B981' : '#EF4444',
              }}>{org.status}</span>
            </div>
            <p style={{ fontSize: 13, color: t.textSub }}>
              Admin: {org.owner_name} · {org.owner_email}
            </p>
            {org.phone && <p style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{org.phone}</p>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <select style={{ ...inp, fontSize: 12 }} value={org.plan} onChange={e => updatePlan(e.target.value)}>
              <option value="FREE">Free Plan</option>
              <option value="PRO">Pro Plan</option>
              <option value="ENTERPRISE">Enterprise</option>
            </select>
            <button
              onClick={toggleStatus}
              title={org.status === 'ACTIVE' ? 'Click to suspend' : 'Click to activate'}
              style={{
                width: 40, height: 20, borderRadius: 999, border: 'none', cursor: 'pointer',
                position: 'relative', flexShrink: 0,
                background: org.status === 'ACTIVE' ? '#10B981' : '#94A3B8',
                transition: 'background .2s',
              }}
            >
              <span style={{
                position: 'absolute', top: 2, left: 2, width: 16, height: 16,
                background: '#fff', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,.3)',
                transition: 'transform .2s',
                transform: org.status === 'ACTIVE' ? 'translateX(20px)' : 'translateX(0)',
              }} />
            </button>
            <span style={{ fontSize: 11, fontWeight: 600, color: org.status === 'ACTIVE' ? '#10B981' : t.textMuted }}>
              {org.status === 'ACTIVE' ? 'Active' : 'Suspended'}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Team Members',  value: org.user_count,               accent: '#6366F1' },
            { label: 'Total Rx',      value: org.prescription_count,        accent: '#06B6D4' },
            { label: 'This Month',    value: org.prescriptions_this_month,  accent: '#EC4899' },
            { label: 'Roles Defined', value: org.roles?.length || 0,        accent: '#10B981' },
          ].map(s => (
            <div key={s.label} style={{
              background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: '14px 16px',
            }}>
              <p style={{
                fontSize: 26, fontWeight: 700, color: t.textPrimary,
                fontFamily: 'var(--font-serif)', fontStyle: 'italic', lineHeight: 1,
              }}>{s.value}</p>
              <p style={{ fontSize: 11, color: t.textSub, marginTop: 4 }}>{s.label}</p>
              <div style={{ width: 20, height: 2, background: s.accent, borderRadius: 99, marginTop: 8 }} />
            </div>
          ))}
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'inline-flex', gap: 3, padding: 4, borderRadius: 12,
          background: t.tabBg, marginBottom: 14,
        }}>
          {(['overview', 'users', 'roles', 'prescriptions'] as Tab[]).map(tabItem => (
            <button
              key={tabItem}
              onClick={() => setTab(tabItem)}
              style={{
                padding: '7px 16px', borderRadius: 9, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none',
                fontFamily: 'var(--font-sans)', textTransform: 'capitalize', transition: 'all .15s',
                background: tab === tabItem ? '#6366F1' : 'transparent',
                color: tab === tabItem ? '#fff' : t.textSub,
              }}
            >
              {tabItem}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 14, padding: '22px 24px' }}>

          {/* Overview */}
          {tab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: t.textMuted, marginBottom: 14 }}>
                  Organization Details
                </p>
                <dl style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    ['Name', org.name],
                    ['Plan', org.plan],
                    ['Status', org.status],
                    ['Rx Limit', org.prescription_limit === 99999 ? 'Unlimited' : `${org.prescription_limit}/month`],
                    ['Team Limit', org.team_limit === 999 ? 'Unlimited' : `${org.team_limit} members`],
                    ['Created', new Date(org.created_at).toLocaleDateString()],
                    ['Address', org.address || '—'],
                    ['Phone', org.phone || '—'],
                    ['Website', org.website || '—'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                      <dt style={{ width: 90, flexShrink: 0, color: t.textMuted }}>{k}</dt>
                      <dd style={{ color: t.textPrimary }}>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: t.textMuted, marginBottom: 14 }}>
                  Admin Account
                </p>
                <dl style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[['Name', org.owner_name || '—'], ['Email', org.owner_email || '—']].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                      <dt style={{ width: 90, flexShrink: 0, color: t.textMuted }}>{k}</dt>
                      <dd style={{ color: t.textPrimary }}>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}

          {/* Users */}
          {tab === 'users' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary }}>
                  Team Members ({org.users?.length || 0})
                </p>
                <span style={{ fontSize: 11, color: t.textMuted }}>
                  Members are added by the org admin
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(org.users || []).map((u: any) => (
                  <div key={u.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '11px 14px', borderRadius: 10, border: `1px solid ${t.cardBorder}`,
                    background: t.rowBg,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', background: '#6366F1',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
                      }}>
                        {u.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: t.textPrimary }}>{u.name}</span>
                          {u.is_owner && (
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(245,158,11,.12)', color: '#F59E0B', fontWeight: 600 }}>Owner</span>
                          )}
                          {u.is_org_admin && !u.is_owner && (
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(99,102,241,.12)', color: '#818CF8', fontWeight: 600 }}>Admin</span>
                          )}
                          <span style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600, color: '#fff',
                            background: u.role_color || '#6366F1',
                          }}>
                            {u.role_display_name || u.role}
                          </span>
                        </div>
                        <p style={{ fontSize: 11, color: t.textMuted }}>{u.email}</p>
                      </div>
                    </div>
                    <p style={{ fontSize: 11, color: t.textMuted }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Roles */}
          {tab === 'roles' && (
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, marginBottom: 16 }}>
                Defined Roles ({org.roles?.length || 0})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(org.roles || []).map((r: any) => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '11px 14px', borderRadius: 10, border: `1px solid ${t.cardBorder}`,
                    background: t.rowBg,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 500, color: t.textPrimary }}>{r.display_name}</p>
                        <p style={{ fontSize: 11, color: t.textMuted }}>Base: {r.base_role} · {r.name}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', maxWidth: 320, justifyContent: 'flex-end' }}>
                      {r.permissions && Object.entries(
                        JSON.parse(typeof r.permissions === 'string' ? r.permissions : JSON.stringify(r.permissions))
                      ).filter(([, v]) => v).map(([k]) => (
                        <span key={k} style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 999,
                          background: t.tabBg, color: t.textSub,
                        }}>
                          {(k as string).replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prescriptions */}
          {tab === 'prescriptions' && (
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, marginBottom: 16 }}>
                Recent Prescriptions
              </p>
              {(!org.recent_prescriptions || org.recent_prescriptions.length === 0) ? (
                <p style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: t.textMuted }}>
                  No prescriptions yet
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {org.recent_prescriptions.map((p: any) => (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '11px 14px', borderRadius: 10, border: `1px solid ${t.cardBorder}`,
                      background: t.rowBg,
                    }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 500, color: t.textPrimary }}>{p.patient_name}</p>
                        <p style={{ fontSize: 11, color: t.textMuted }}>Dr. {p.doctor_name}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
                          background: RX_STATUS_BADGE[p.status]?.bg ?? 'transparent',
                          color: RX_STATUS_BADGE[p.status]?.color ?? t.textSub,
                        }}>{p.status}</span>
                        <p style={{ fontSize: 11, color: t.textMuted }}>
                          {new Date(p.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>


      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
