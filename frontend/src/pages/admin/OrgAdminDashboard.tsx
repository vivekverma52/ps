import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AppShell from '../../components/layout/AppShell'
import { ORG_ADMIN_NAV } from '../../constants/nav'
import StatCard from '../../components/ui/StatCard'
import UsageBar from '../../components/ui/UsageBar'
import { PlanBadge } from '../../components/ui/StatusBadge'

export default function OrgAdminDashboard() {
  const { org, refreshOrg } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { refreshOrg() }, [])

  const used  = org?.usage_this_month ?? 0
  const limit = org?.prescription_limit ?? 99999

  const InviteBtn = (
    <button className="btn btn-teal btn-sm" onClick={() => navigate('/admin/team')}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Invite member
    </button>
  )

  return (
    <AppShell navItems={ORG_ADMIN_NAV} sectionLabel="Admin" topBarRight={InviteBtn}>

      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-.4px' }}>
              {org?.name || 'Organization'}
            </h2>
            {org?.plan && <PlanBadge plan={org.plan} />}
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-light)' }}>Organization admin dashboard</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid-3" style={{ gap: 14, marginBottom: 22 }}>
        <StatCard
          label="Prescriptions this month"
          value={used}
          sub={limit < 99999 ? `of ${limit} limit` : 'unlimited'}
        />
        <StatCard
          label="Team members"
          value={org?.team_count ?? '—'}
          sub={org?.team_limit ? `of ${org.team_limit} seats` : undefined}
        />
        <StatCard
          label="Current plan"
          value={org?.plan || '—'}
          sub="Billed monthly"
        />
      </div>

      {/* Usage bar */}
      {org && limit < 99999 && (
        <div className="card" style={{ padding: '18px 20px', marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>Monthly usage</span>
            {org.plan !== 'ENTERPRISE' && (
              <button
                onClick={() => navigate('/settings')}
                style={{ fontSize: 12, color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500 }}
              >
                Upgrade plan →
              </button>
            )}
          </div>
          <UsageBar used={used} limit={limit} showCount />
        </div>
      )}

      {/* Quick actions */}
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--ink-light)', marginBottom: 12 }}>Quick actions</p>
      <div className="grid-2" style={{ gap: 14 }}>
        {[
          {
            label: 'Manage Hospitals',
            desc: 'Add hospitals and manage locations in your org',
            path: '/admin/hospitals',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <line x1="12" y1="3" x2="12" y2="22"/><line x1="3" y1="12" x2="21" y2="12"/>
              </svg>
            ),
          },
          {
            label: 'Manage Team',
            desc: 'Add doctors, pharmacists and manage members',
            path: '/admin/team',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            ),
          },
          {
            label: 'Manage Roles',
            desc: 'Create and configure custom roles and permissions',
            path: '/admin/roles',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            ),
          },
          {
            label: 'Medicine Database',
            desc: 'Browse and manage the medicine library',
            path: '/medicine-prescriptions',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
              </svg>
            ),
          },
          {
            label: 'Settings',
            desc: 'Organization profile, billing and preferences',
            path: '/settings',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            ),
          },
        ].map(a => (
          <button
            key={a.label}
            className="card"
            onClick={() => navigate(a.path)}
            style={{ textAlign: 'left', cursor: 'pointer', transition: 'background .15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--cell)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
          >
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              {a.icon}
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{a.label}</p>
            <p style={{ fontSize: 12, color: 'var(--ink-light)', lineHeight: 1.5 }}>{a.desc}</p>
          </button>
        ))}
      </div>
    </AppShell>
  )
}
