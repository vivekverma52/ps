import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import AppShell from '../components/layout/AppShell'
import { DOCTOR_NAV } from '../constants/nav'
import { StatusBadge } from '../components/ui/StatusBadge'
import StatCard from '../components/ui/StatCard'

interface Prescription {
  id: string
  access_token: string
  patient_name: string
  patient_phone: string
  language: string
  status: string
  medicine_count: number
  created_at: string
}

export default function PrescriptionsListPage() {
  const navigate = useNavigate()
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    api.get('/prescriptions')
      .then(r => setPrescriptions(r.data.data ?? []))
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = prescriptions.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = p.patient_name.toLowerCase().includes(q) || (p.patient_phone || '').includes(q)
    const matchStatus = !statusFilter || p.status === statusFilter
    return matchSearch && matchStatus
  })

  const NewBtn = (
    <button className="btn btn-teal btn-sm" onClick={() => navigate('/prescriptions/new')}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      New prescription
    </button>
  )

  return (
    <AppShell navItems={DOCTOR_NAV} topBarRight={NewBtn}>

      {/* Stats row */}
      <div className="grid-3" style={{ gap: 14, marginBottom: 22 }}>
        <StatCard label="Total" value={prescriptions.length} />
        <StatCard label="Rendered" value={prescriptions.filter(p => p.status === 'RENDERED').length} />
        <StatCard label="Sent" value={prescriptions.filter(p => p.status === 'SENT').length} />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1 }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-light)', pointerEvents: 'none' }}
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="input-field"
            style={{ paddingLeft: 34 }}
            placeholder="Search by patient or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Status filter */}
        <select
          className="input-field"
          style={{ width: 160 }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="UPLOADED">Uploaded</option>
          <option value="RENDERED">Rendered</option>
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
              <th>Language</th>
              <th>Medicines</th>
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
                <td colSpan={6} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--ink-light)' }}>
                  <svg style={{ margin: '0 auto 12px', opacity: .3 }} width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <p style={{ fontSize: 13 }}>{search ? 'No results found' : 'No prescriptions yet'}</p>
                  {!search && (
                    <button onClick={() => navigate('/prescriptions/new')}
                      style={{ fontSize: 12, color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 6, fontFamily: 'var(--font-sans)' }}>
                      Create your first prescription →
                    </button>
                  )}
                </td>
              </tr>
            ) : filtered.map(p => (
              <tr key={p.id}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/prescriptions/${p.access_token}`)}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal-dark)' }}>{p.patient_name.charAt(0)}</span>
                    </div>
                    <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{p.patient_name}</span>
                  </div>
                </td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{p.patient_phone || '—'}</td>
                <td>{p.language}</td>
                <td>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: Number(p.medicine_count) > 0 ? 'var(--teal-light)' : 'var(--cell)', color: Number(p.medicine_count) > 0 ? 'var(--teal-dark)' : 'var(--ink-light)' }}>
                    {p.medicine_count}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--ink-light)' }}>
                  {new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td>
                  <StatusBadge status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {!loading && (
        <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 10, textAlign: 'right' }}>
          {filtered.length} prescription{filtered.length !== 1 ? 's' : ''}
          {statusFilter && ` · ${statusFilter}`}
        </p>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  )
}
