import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import AppShell from '../components/layout/AppShell'
import { DOCTOR_NAV } from '../constants/nav'
import { StatusBadge } from '../components/ui/StatusBadge'
import StatCard from '../components/ui/StatCard'
import { langLabel } from '../utils/language'

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

const PAGE_SIZE_OPTIONS = [10, 20, 50]

export default function PrescriptionsListPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce search input
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 350)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [search])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit }
      if (debouncedSearch) params.search = debouncedSearch
      if (statusFilter) params.status = statusFilter
      const r = await api.get('/prescriptions', { params })
      const payload = r.data.data
      setPrescriptions(payload.data ?? [])
      setTotal(payload.total ?? 0)
    } catch {
      toast.error('Failed to load')
    } finally {
      setLoading(false)
    }
  }, [page, limit, debouncedSearch, statusFilter])

  useEffect(() => { fetchAll() }, [fetchAll])

  const totalPages = Math.ceil(total / limit)

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
        <StatCard label="Total" value={total} />
        <StatCard label="Rendered" value={prescriptions.filter(p => p.status === 'RENDERED').length} />
        <StatCard label="Sent" value={prescriptions.filter(p => p.status === 'SENT').length} />
      </div>

      {/* Toolbar */}
      <div className="filter-bar">
        <div className="filter-search">
          <svg className="filter-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="input-field"
            placeholder="Search by patient or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input-field filter-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">All statuses</option>
          <option value="UPLOADED">Uploaded</option>
          <option value="RENDERED">Rendered</option>
          <option value="SENT">Sent</option>
        </select>
        <select className="input-field filter-select-sm" value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1) }}>
          {PAGE_SIZE_OPTIONS.map(n => (
            <option key={n} value={n}>{n} / page</option>
          ))}
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
            ) : prescriptions.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--ink-light)' }}>
                  <svg style={{ margin: '0 auto 12px', opacity: .3 }} width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <p style={{ fontSize: 13 }}>{debouncedSearch || statusFilter ? 'No results found' : 'No prescriptions yet'}</p>
                  {!debouncedSearch && !statusFilter && (
                    <button onClick={() => navigate('/prescriptions/new')}
                      style={{ fontSize: 12, color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 6, fontFamily: 'var(--font-sans)' }}>
                      Create your first prescription →
                    </button>
                  )}
                </td>
              </tr>
            ) : prescriptions.map(p => (
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
                <td>{langLabel(p.language)}</td>
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination-bar">
            <p style={{ fontSize: 11, color: 'var(--ink-light)' }}>
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
            </p>
            <div className="pagination-controls">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="btn btn-ghost btn-sm" style={{ opacity: page === 1 ? .4 : 1 }}>Prev</button>
              <span style={{ fontSize: 12, color: 'var(--ink-light)' }}>{page} / {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="btn btn-ghost btn-sm" style={{ opacity: page === totalPages ? .4 : 1 }}>Next</button>
            </div>
          </div>
        )}
      </div>

      {!loading && (
        <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 10, textAlign: 'right' }}>
          {total} prescription{total !== 1 ? 's' : ''}
          {statusFilter && ` · ${statusFilter}`}
        </p>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  )
}
