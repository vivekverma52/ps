import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../services/api'
import AppShell from '../components/layout/AppShell'
import { PHARMACIST_NAV } from '../constants/nav'
import { StatusBadge } from '../components/ui/StatusBadge'

interface Prescription {
  id: string
  access_token: string
  patient_name: string
  patient_phone: string
  doctor_name: string
  language: string
  status: string
  medicine_count: number
  created_at: string
}

function isNew(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() < 5 * 60 * 1000
}

export default function PharmacistDashboard() {
  const navigate = useNavigate()
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const prevIdsRef = useRef<Set<string>>(new Set())

  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/prescriptions')
      const data: Prescription[] = res.data.data ?? []

      if (silent && prevIdsRef.current.size > 0) {
        const incoming = data.filter(p => !prevIdsRef.current.has(p.id))
        if (incoming.length > 0) {
          toast.success(`${incoming.length} new prescription${incoming.length > 1 ? 's' : ''} received`, { icon: '💊', duration: 4000 })
        }
      }
      prevIdsRef.current = new Set(data.map(p => p.id))
      setPrescriptions(data)
    } catch {
      if (!silent) toast.error('Failed to load prescriptions')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
    const interval = setInterval(() => fetchAll(true), 5000)
    const onVisible = () => { if (document.visibilityState === 'visible') fetchAll(true) }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  const filtered = prescriptions.filter(p => {
    const q = search.toLowerCase()
    const matchSearch =
      p.patient_name.toLowerCase().includes(q) ||
      p.doctor_name.toLowerCase().includes(q) ||
      (p.patient_phone || '').includes(q)
    const matchStatus = !statusFilter || p.status === statusFilter
    return matchSearch && matchStatus
  })

  const pendingCount = prescriptions.filter(p => p.status === 'UPLOADED').length

  const TopRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {pendingCount > 0 && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, background: 'var(--warning-bg)', color: 'var(--warning)', padding: '4px 10px', borderRadius: 999 }}>
          <span style={{ width: 6, height: 6, background: 'var(--warning)', borderRadius: '50%', animation: 'pulse 1.5s ease infinite' }} />
          {pendingCount} pending
        </span>
      )}
      <button className="btn btn-ghost btn-sm" onClick={() => fetchAll()}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M23 4v6h-6M1 20v-6h6"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
        Refresh
      </button>
    </div>
  )

  return (
    <AppShell navItems={PHARMACIST_NAV} sectionLabel="Pharmacist" topBarRight={TopRight}>

      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-light)', pointerEvents: 'none' }}
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="input-field"
            style={{ paddingLeft: 34 }}
            placeholder="Search patient, doctor, or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field"
          style={{ width: 160 }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="UPLOADED">Pending</option>
          <option value="RENDERED">Ready</option>
          <option value="SENT">Sent</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 }}>
        <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Phone</th>
              <th>Doctor</th>
              <th style={{ textAlign: 'center' }}>Medicines</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '48px 0' }}>
                  <div style={{ width: 28, height: 28, border: '2px solid var(--teal)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--ink-light)', fontSize: 13 }}>
                  {search || statusFilter ? 'No results match your filter' : 'No prescriptions yet — they will appear here automatically'}
                </td>
              </tr>
            ) : filtered.map(p => (
              <tr
                key={p.id}
                style={{ cursor: 'pointer', background: p.status === 'UPLOADED' && isNew(p.created_at) ? 'rgba(217,119,6,.04)' : undefined }}
                onClick={() => navigate(`/pharmacist/prescriptions/${p.id}`)}
              >
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal-dark)' }}>{p.patient_name.charAt(0)}</span>
                    </div>
                    <div>
                      <p style={{ fontWeight: 500, color: 'var(--ink)', fontSize: 13 }}>{p.patient_name}</p>
                      <p style={{ fontSize: 11, color: 'var(--ink-light)' }}>{p.language}</p>
                    </div>
                  </div>
                </td>
                <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{p.patient_phone || '—'}</td>
                <td style={{ fontSize: 13 }}>Dr. {p.doctor_name}</td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: Number(p.medicine_count) > 0 ? 'var(--teal-light)' : 'var(--cell)', color: Number(p.medicine_count) > 0 ? 'var(--teal-dark)' : 'var(--ink-light)' }}>
                    {p.medicine_count}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--ink-light)' }}>
                  <div>{new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                  <div>{new Date(p.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {p.status === 'UPLOADED' && isNew(p.created_at) && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--warning)', letterSpacing: '.5px' }}>NEW</span>
                    )}
                    <StatusBadge status={p.status} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {!loading && (
        <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 10, textAlign: 'right' }}>
          {filtered.length} prescription{filtered.length !== 1 ? 's' : ''} · auto-refreshes every 5s
        </p>
      )}

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
      `}</style>
    </AppShell>
  )
}
