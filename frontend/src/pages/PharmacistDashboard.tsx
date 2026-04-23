import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../services/api'
import AppShell from '../components/layout/AppShell'
import { PHARMACIST_NAV } from '../constants/nav'
import { langLabel } from '../utils/language'

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

const STATUS_CFG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  UPLOADED: { label: 'Pending', bg: '#fef3c7', color: '#92400e', dot: '#d97706' },
  RENDERED: { label: 'Ready',   bg: '#dbeafe', color: '#1e40af', dot: '#3b82f6' },
  SENT:     { label: 'Sent',    bg: '#dcfce7', color: '#14532d', dot: '#16a34a' },
  ERROR:    { label: 'Error',   bg: '#fee2e2', color: '#991b1b', dot: '#dc2626' },
}

const STATUS_FILTERS = [
  { label: 'All',     value: '' },
  { label: 'Pending', value: 'UPLOADED' },
  { label: 'Ready',   value: 'RENDERED' },
  { label: 'Sent',    value: 'SENT' },
]

const DATE_FILTERS = [
  { label: 'All dates', value: '' },
  { label: 'Today',     value: 'today' },
  { label: 'This week', value: 'week' },
]

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, bg: 'var(--cell)', color: 'var(--ink-light)', dot: 'var(--ink-light)' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600,
      padding: '3px 9px', borderRadius: 999, background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.dot}40`, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  )
}

function SkeletonRows({ count = 7 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i}>
          <td style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="sk" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
              <div>
                <div className="sk" style={{ width: 120, height: 13, borderRadius: 5, marginBottom: 6 }} />
                <div className="sk" style={{ width: 60, height: 10, borderRadius: 4 }} />
              </div>
            </div>
          </td>
          <td style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <div className="sk" style={{ width: 95, height: 12, borderRadius: 4 }} />
          </td>
          <td style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <div className="sk" style={{ width: 100, height: 12, borderRadius: 4 }} />
          </td>
          <td style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
            <div className="sk" style={{ width: 50, height: 22, borderRadius: 999, margin: '0 auto' }} />
          </td>
          <td style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <div className="sk" style={{ width: 60, height: 12, borderRadius: 4, marginBottom: 5 }} />
            <div className="sk" style={{ width: 40, height: 10, borderRadius: 4 }} />
          </td>
          <td style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <div className="sk" style={{ width: 68, height: 22, borderRadius: 999 }} />
          </td>
          <td style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
            <div className="sk" style={{ width: 64, height: 30, borderRadius: 8, marginLeft: 'auto' }} />
          </td>
        </tr>
      ))}
    </>
  )
}

export default function PharmacistDashboard() {
  const navigate = useNavigate()
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('today')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const prevIdsRef     = useRef<Set<string>>(new Set())
  const prevSigRef     = useRef<string>('')
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef      = useRef<HTMLInputElement>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const handleSearch = (value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value)
      setPage(1)
    }, 500)
  }

  // ── Stats (always independent of active filters) ──────────────────────────
  const [stats, setStats] = useState({ today: 0, allTime: 0, pending: 0 })

  const fetchStats = useCallback(async () => {
    try {
      const [todayRes, allRes, pendingRes] = await Promise.all([
        api.get('/prescriptions', { params: { page: 1, limit: 1, date: 'today' } }),
        api.get('/prescriptions', { params: { page: 1, limit: 1 } }),
        api.get('/prescriptions', { params: { page: 1, limit: 1, status: 'UPLOADED' } }),
      ])
      setStats({
        today:   todayRes.data.data.total   ?? 0,
        allTime: allRes.data.data.total     ?? 0,
        pending: pendingRes.data.data.total ?? 0,
      })
    } catch { /* non-critical */ }
  }, [])

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit }
      if (debouncedSearch) params.search = debouncedSearch
      if (statusFilter)    params.status = statusFilter
      if (dateFilter)      params.date   = dateFilter
      const res     = await api.get('/prescriptions', { params })
      const payload = res.data.data
      const data: Prescription[] = payload.data  ?? []
      const newTotal: number     = payload.total ?? 0

      const sig = `${newTotal}|${data.map(p => `${p.id}:${p.status}:${p.medicine_count}`).join(',')}`
      if (silent) {
        if (sig === prevSigRef.current) return
        if (prevIdsRef.current.size > 0) {
          const incoming = data.filter(p => !prevIdsRef.current.has(p.id))
          if (incoming.length > 0) toast.success(`${incoming.length} new prescription${incoming.length > 1 ? 's' : ''} received`, { icon: '💊', duration: 4000 })
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
  }, [page, limit, debouncedSearch, statusFilter, dateFilter])

  // Main table — re-runs when filters / page / search change
  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Stats — run once on mount + on tab focus (independent of table filters)
  useEffect(() => {
    fetchStats()
    const onVisible = () => { if (document.visibilityState === 'visible') fetchStats() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchStats])

  const totalPages   = Math.ceil(total / limit)
  const pendingCount = prescriptions.filter(p => p.status === 'UPLOADED').length

  const clearFilters = () => { setSearch(''); setStatusFilter(''); setDateFilter(''); setPage(1) }

  return (
    <AppShell navItems={PHARMACIST_NAV} sectionLabel="Pharmacist">

      {/* ── Page header ── */}
      {/* <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-.3px', lineHeight: 1.2 }}>Prescriptions</h1>
          <p style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: 4 }}>
            {loading ? 'Loading…' : `${total} ${dateFilter === 'today' ? "today's" : dateFilter === 'week' ? "this week's" : 'total'} prescription${total !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Pending alert badge */}
          {/* {pendingCount > 0 && (
            <button
              onClick={() => { setStatusFilter('UPLOADED'); setPage(1) }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 12, fontWeight: 700, padding: '7px 13px', borderRadius: 999,
                background: '#fef3c7', color: '#92400e',
                border: '1.5px solid #fcd34d', cursor: 'pointer',
                fontFamily: 'var(--font-sans)', transition: 'all .15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#fde68a')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fef3c7')}
            >
              <span style={{ width: 7, height: 7, background: '#d97706', borderRadius: '50%', animation: 'pulse 1.5s ease infinite', flexShrink: 0 }} />
              {pendingCount} Pending
            </button>
          )} */}

          {/* Refresh */}
          {/* <button
            className="btn btn-ghost btn-sm"
            onClick={() => { fetchAll(); fetchStats() }}
            style={{ gap: 6 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Refresh
          </button>
        </div>
      </div> */} 

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          {
            label: "Today's Prescriptions",
            value: stats.today,
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            ),
            iconBg: 'rgba(99,102,241,.1)',
            valueColor: '#4338ca',
            onClick: () => { setDateFilter('today'); setStatusFilter(''); setPage(1) },
          },
          {
            label: 'All Time',
            value: stats.allTime,
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1"/>
              </svg>
            ),
            iconBg: 'var(--teal-light)',
            valueColor: 'var(--teal-dark)',
            onClick: () => { setDateFilter(''); setStatusFilter(''); setPage(1) },
          },
          {
            label: 'Pending',
            value: stats.pending,
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            ),
            iconBg: '#fef3c7',
            valueColor: '#92400e',
            onClick: () => { setStatusFilter('UPLOADED'); setDateFilter(''); setPage(1) },
          },
        ].map(card => (
          <button
            key={card.label}
            onClick={card.onClick}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 18px', borderRadius: 14, cursor: 'pointer',
              background: 'var(--surface)', border: '1px solid var(--border)',
              boxShadow: '0 1px 4px rgba(0,0,0,.05)',
              fontFamily: 'var(--font-sans)', textAlign: 'left',
              transition: 'box-shadow .15s, border-color .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,.1)'; e.currentTarget.style.borderColor = 'var(--border-mid)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.05)'; e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 11, background: card.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {card.icon}
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>
                {card.label}
              </p>
              <p style={{ fontSize: 24, fontWeight: 700, color: card.valueColor, lineHeight: 1 }}>
                {loading && card.value === 0 ? '—' : card.value}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Filter toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>

        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 380 }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--ink-light)' }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={searchRef}
            style={{
              width: '100%', padding: '9px 36px', fontSize: 13,
              border: '1.5px solid var(--border-mid)', borderRadius: 10,
              fontFamily: 'var(--font-sans)', color: 'var(--ink)',
              background: 'var(--surface)', outline: 'none', transition: 'border-color .15s',
            }}
            placeholder="Search patient, doctor, phone…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--teal)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-mid)')}
          />
          {search && (
            <button onClick={() => { handleSearch(''); searchRef.current?.focus() }} style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 3,
              color: 'var(--ink-light)', display: 'flex', lineHeight: 1,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        {/* Date filter chips */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--ink-light)', fontWeight: 500, whiteSpace: 'nowrap' }}>Date:</span>
          {DATE_FILTERS.map(chip => {
            const active = dateFilter === chip.value
            return (
              <button
                key={chip.value}
                onClick={() => { setDateFilter(chip.value); setPage(1) }}
                style={{
                  fontSize: 12, fontWeight: active ? 600 : 500,
                  padding: '7px 14px', borderRadius: 999, whiteSpace: 'nowrap',
                  border: `1.5px solid ${active ? '#6366f1' : 'var(--border-mid)'}`,
                  background: active ? 'rgba(99,102,241,.1)' : 'var(--surface)',
                  color: active ? '#4338ca' : 'var(--ink-light)',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all .15s',
                }}
              >
                {chip.label}
              </button>
            )
          })}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 22, background: 'var(--border-mid)', flexShrink: 0 }} />

        {/* Status filter chips */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--ink-light)', fontWeight: 500, whiteSpace: 'nowrap' }}>Status:</span>
          {STATUS_FILTERS.map(chip => {
            const active = statusFilter === chip.value
            return (
              <button
                key={chip.value}
                onClick={() => { setStatusFilter(chip.value); setPage(1) }}
                style={{
                  fontSize: 12, fontWeight: active ? 600 : 500,
                  padding: '7px 14px', borderRadius: 999, whiteSpace: 'nowrap',
                  border: `1.5px solid ${active ? 'var(--teal)' : 'var(--border-mid)'}`,
                  background: active ? 'var(--teal-light)' : 'var(--surface)',
                  color: active ? 'var(--teal-dark)' : 'var(--ink-light)',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all .15s',
                }}
              >
                {chip.label}
              </button>
            )
          })}
        </div>

        {/* Page size — pushed right */}
        <div style={{ marginLeft: 'auto' }}>
          <select
            style={{
              padding: '7px 10px', fontSize: 12, fontFamily: 'var(--font-sans)',
              border: '1.5px solid var(--border-mid)', borderRadius: 8,
              color: 'var(--ink)', background: 'var(--surface)', cursor: 'pointer', outline: 'none',
            }}
            value={limit}
            onChange={e => { setLimit(Number(e.target.value)); setPage(1) }}
          >
            {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n} / page</option>)}
          </select>
        </div>
      </div>

      {/* ── Table card ── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 1px 6px rgba(0,0,0,.06)',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--cell)' }}>
                {[
                  { label: 'Patient',   align: 'left'   },
                  { label: 'Phone',     align: 'left'   },
                  { label: 'Doctor',    align: 'left'   },
                  { label: 'Medicines', align: 'center' },
                  { label: 'Date',      align: 'left'   },
                  { label: 'Status',    align: 'left'   },
                  { label: '',          align: 'right'  },
                ].map((h, i) => (
                  <th key={i} style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--ink-light)',
                    textTransform: 'uppercase', letterSpacing: '.6px',
                    padding: '10px 18px', textAlign: h.align as any,
                    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                  }}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <SkeletonRows count={7} />

              ) : prescriptions.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '72px 24px', gap: 10 }}>
                      <div style={{ width: 54, height: 54, borderRadius: 16, background: 'var(--cell)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--ink-light)" strokeWidth="1.5">
                          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                          <rect x="9" y="3" width="6" height="4" rx="1"/>
                          <line x1="9" y1="12" x2="15" y2="12"/>
                          <line x1="9" y1="16" x2="13" y2="16"/>
                        </svg>
                      </div>
                      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                        {debouncedSearch || statusFilter ? 'No results found' : 'No prescriptions yet'}
                      </p>
                      <p style={{ fontSize: 13, color: 'var(--ink-light)', textAlign: 'center', maxWidth: 300, lineHeight: 1.6 }}>
                        {debouncedSearch || statusFilter
                          ? 'Try adjusting your search or filters to find what you\'re looking for'
                          : 'Prescriptions from doctors will appear here automatically'}
                      </p>
                      {(debouncedSearch || statusFilter) && (
                        <button onClick={clearFilters} className="btn btn-ghost btn-sm" style={{ marginTop: 6 }}>
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>

              ) : prescriptions.map((p, rowIdx) => {
                const highlight = p.status === 'UPLOADED' && isNew(p.created_at)
                const baseBg    = highlight ? 'rgba(217,119,6,.03)' : rowIdx % 2 !== 0 ? 'rgba(0,0,0,.012)' : 'transparent'
                const hoverBg   = 'rgba(13,148,136,.05)'
                return (
                  <tr
                    key={p.id}
                    style={{ cursor: 'pointer', background: baseBg, transition: 'background .12s' }}
                    onClick={() => navigate(`/pharmacist/prescriptions/${p.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                    onMouseLeave={e => (e.currentTarget.style.background = baseBg)}
                  >
                    {/* Patient */}
                    <td style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                          background: 'linear-gradient(135deg, #ccfbf1 0%, #a7f3d0 100%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 700, color: 'var(--teal-dark)',
                        }}>
                          {p.patient_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>
                            {p.patient_name}
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 1 }}>
                            {langLabel(p.language)}
                          </p>
                        </div>
                        {highlight && (
                          <span style={{
                            fontSize: 9, fontWeight: 800, letterSpacing: '.5px',
                            padding: '2px 6px', borderRadius: 999,
                            background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d',
                          }}>
                            NEW
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Phone */}
                    <td style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--ink-mid)', fontVariantNumeric: 'tabular-nums' }}>
                      {p.patient_phone || <span style={{ color: 'var(--ink-light)' }}>—</span>}
                    </td>

                    {/* Doctor */}
                    <td style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)' }}>
                      <p style={{ fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
                        Dr. {p.doctor_name}
                      </p>
                    </td>

                    {/* Medicines */}
                    <td style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600,
                        padding: '3px 10px', borderRadius: 999,
                        background: Number(p.medicine_count) > 0 ? 'var(--teal-light)' : 'var(--cell)',
                        color: Number(p.medicine_count) > 0 ? 'var(--teal-dark)' : 'var(--ink-light)',
                      }}>
                        {Number(p.medicine_count) > 0 ? (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/>
                            <line x1="9" y1="12" x2="15" y2="12"/><line x1="12" y1="9" x2="12" y2="15"/>
                          </svg>
                        ) : (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                          </svg>
                        )}
                        {p.medicine_count} {p.medicine_count === 1 ? 'med' : 'meds'}
                      </span>
                    </td>

                    {/* Date */}
                    <td style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)' }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.3 }}>
                        {new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 2 }}>
                        {new Date(p.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)' }}>
                      <StatusPill status={p.status} />
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/pharmacist/prescriptions/${p.id}`) }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 12, fontWeight: 500, padding: '6px 12px',
                          borderRadius: 8, border: '1.5px solid var(--border-mid)',
                          background: 'var(--surface)', color: 'var(--ink)',
                          cursor: 'pointer', fontFamily: 'var(--font-sans)',
                          transition: 'all .15s', whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--teal)'; e.currentTarget.style.color = 'var(--teal)'; e.currentTarget.style.background = 'var(--teal-light)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-mid)'; e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.background = 'var(--surface)' }}
                      >
                        View
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--cell)',
          }}>
            <p style={{ fontSize: 12, color: 'var(--ink-light)' }}>
              {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} prescriptions
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="btn btn-ghost btn-sm" style={{ opacity: page === 1 ? .4 : 1, gap: 4 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                Prev
              </button>
              <div style={{
                display: 'flex', gap: 3,
              }}>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const pg = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i
                  return (
                    <button key={pg} onClick={() => setPage(pg)} style={{
                      width: 30, height: 30, borderRadius: 7, border: `1.5px solid ${page === pg ? 'var(--teal)' : 'var(--border-mid)'}`,
                      background: page === pg ? 'var(--teal)' : 'var(--surface)',
                      color: page === pg ? '#fff' : 'var(--ink)',
                      fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    }}>{pg}</button>
                  )
                })}
              </div>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="btn btn-ghost btn-sm" style={{ opacity: page === totalPages ? .4 : 1, gap: 4 }}>
                Next
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
        @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        .sk {
          background: linear-gradient(90deg, #e8e8e4 25%, #f2f2ee 50%, #e8e8e4 75%) !important;
          background-size: 400px 100% !important;
          animation: shimmer 1.3s ease-in-out infinite !important;
        }
      `}</style>
    </AppShell>
  )
}
