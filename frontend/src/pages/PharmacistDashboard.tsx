import { useState, useEffect, useRef, useCallback } from 'react'
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

const PAGE_SIZE_OPTIONS = [10, 20, 50]

export default function PharmacistDashboard() {
  const navigate = useNavigate()
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const prevIdsRef = useRef<Set<string>>(new Set())
  const prevSigRef = useRef<string>('')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search input
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 350)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [search])

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit }
      if (debouncedSearch) params.search = debouncedSearch
      if (statusFilter) params.status = statusFilter
      const res = await api.get('/prescriptions', { params })
      const payload = res.data.data
      const data: Prescription[] = payload.data ?? []
      const newTotal: number = payload.total ?? 0

      const sig = `${newTotal}|${data.map(p => `${p.id}:${p.status}:${p.medicine_count}`).join(',')}`

      if (silent) {
        if (sig === prevSigRef.current) return // nothing changed, skip re-render

        if (prevIdsRef.current.size > 0) {
          const incoming = data.filter(p => !prevIdsRef.current.has(p.id))
          if (incoming.length > 0) {
            toast.success(`${incoming.length} new prescription${incoming.length > 1 ? 's' : ''} received`, { icon: '💊', duration: 4000 })
          }
        }
      }

      prevSigRef.current = sig
      prevIdsRef.current = new Set(data.map(p => p.id))
      setPrescriptions(data)
      setTotal(newTotal)
    } catch {
      if (!silent) toast.error('Failed to load prescriptions')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [page, limit, debouncedSearch, statusFilter])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(() => fetchAll(true), 5000)
    const onVisible = () => { if (document.visibilityState === 'visible') fetchAll(true) }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible) }
  }, [fetchAll])

  const totalPages = Math.ceil(total / limit)
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
      <div className="filter-bar" style={{ marginBottom: 18 }}>
        <div className="filter-search">
          <svg className="filter-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="input-field"
            placeholder="Search patient, doctor, or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input-field filter-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">All statuses</option>
          <option value="UPLOADED">Pending</option>
          <option value="RENDERED">Ready</option>
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
            ) : prescriptions.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--ink-light)', fontSize: 13 }}>
                  {debouncedSearch || statusFilter ? 'No results match your filter' : 'No prescriptions yet — they will appear here automatically'}
                </td>
              </tr>
            ) : prescriptions.map(p => (
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
          {total} prescription{total !== 1 ? 's' : ''} · refreshes only on new data
        </p>
      )}

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
      `}</style>
    </AppShell>
  )
}
