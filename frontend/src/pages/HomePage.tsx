import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AppShell from '../components/layout/AppShell'
import { DOCTOR_NAV } from '../constants/nav'
import StatCard from '../components/ui/StatCard'
import UsageBar from '../components/ui/UsageBar'
import { PlanBadge } from '../components/ui/StatusBadge'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function HomePage() {
  const { user, org, refreshOrg } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { refreshOrg() }, [])

  const used  = org?.usage_this_month ?? 0
  const limit = org?.prescription_limit ?? 99999
  const nearLimit = limit < 99999 && used >= limit * 0.8

  const NewPrescriptionBtn = (
    <button
      className="btn btn-teal btn-sm"
      onClick={() => navigate('/prescriptions/new')}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      New Prescription
    </button>
  )

  return (
    <AppShell navItems={DOCTOR_NAV} topBarRight={NewPrescriptionBtn}>

      {/* Greeting */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-.4px' }}>
            {getGreeting()},{' '}
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400 }}>
              {user?.name?.split(' ')[0]}
            </span>
          </h2>
          {org?.plan && <PlanBadge plan={org.plan} />}
        </div>
        {org && <p style={{ fontSize: 13, color: 'var(--ink-light)' }}>{org.name}</p>}
      </div>

      {/* Limit warning */}
      {nearLimit && (
        <div style={{
          background: 'var(--warning-bg)', border: '1px solid rgba(217,119,6,.2)',
          borderRadius: 10, padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span style={{ fontSize: 12, color: 'var(--warning)' }}>
              {used >= limit ? `Monthly limit reached (${limit} Rx)` : `${used}/${limit} prescriptions used this month`}
            </span>
          </div>
          <button
            onClick={() => navigate('/settings')}
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}
          >
            Upgrade →
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid-3" style={{ gap: 14, marginBottom: 28 }}>
        <StatCard
          label="This month"
          value={used}
          sub={limit < 99999 ? `of ${limit} Rx limit` : 'unlimited'}
        />
        <StatCard
          label="Plan"
          value={org?.plan || '—'}
          sub={limit < 99999 ? `${limit} Rx / mo` : 'Unlimited Rx'}
        />
        <StatCard
          label="Team members"
          value={org?.team_count ?? '—'}
          sub={org?.team_limit ? `of ${org.team_limit} seats` : undefined}
        />
      </div>

      {/* Usage bar */}
      {org && limit < 99999 && (
        <div className="card" style={{ marginBottom: 28, padding: '18px 20px' }}>
          <UsageBar used={used} limit={limit} label="Monthly prescription usage" />
        </div>
      )}

      {/* Main CTA */}
      <div className="grid-2" style={{ gap: 14 }}>
        <button
          className="card"
          onClick={() => navigate('/prescriptions/new')}
          style={{
            textAlign: 'left', cursor: 'pointer', border: 'none',
            background: 'var(--ink)', borderRadius: 14, padding: '24px 22px',
            transition: 'opacity .15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 4 }}>New Prescription</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>Add patient + medicines</p>
        </button>

        <button
          className="card"
          onClick={() => navigate('/prescriptions')}
          style={{ textAlign: 'left', cursor: 'pointer', transition: 'background .15s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--cell)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
        >
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>All Prescriptions</p>
          <p style={{ fontSize: 12, color: 'var(--ink-light)' }}>View & manage history</p>
        </button>
      </div>
    </AppShell>
  )
}
