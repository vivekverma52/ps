import { useState, useEffect, useRef, useReducer, useCallback } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import AppShell from '../components/layout/AppShell'
import { DOCTOR_NAV, PHARMACIST_NAV } from '../constants/nav'

interface Medicine {
  _id: string
  medicine_name: string
  generic_name: string
  medicine_image: string | null
  medicine_image_2: string | null
  medicine_image_3: string | null
  common_usage: string
  alternative_medicines: string[]
  drug_category: string
  color: string | null
  manufacturer_name: string | null
  marketer_name: string | null
  salt_composition: string | null
  tablet_color: string | null
  appearance: string | null
  createdAt: string
}

const EMPTY_FORM = {
  medicine_name: '', generic_name: '', common_usage: '',
  alternative_medicines: '', drug_category: '', color: '',
  manufacturer_name: '', marketer_name: '', salt_composition: '',
  tablet_color: '', appearance: '',
}

type FormState = typeof EMPTY_FORM
type ImageSlot = 1 | 2 | 3

type ModalState = {
  open: boolean; editing: Medicine | null; form: FormState; saving: boolean
  imageFile: File | null; imagePreview: string | null
  imageFile2: File | null; imagePreview2: string | null
  imageFile3: File | null; imagePreview3: string | null
}

type ModalAction =
  | { type: 'OPEN_CREATE' }
  | { type: 'OPEN_EDIT'; medicine: Medicine }
  | { type: 'CLOSE' }
  | { type: 'SET_FIELD'; key: keyof FormState; value: string }
  | { type: 'SET_IMAGE'; slot: ImageSlot; file: File; preview: string }
  | { type: 'CLEAR_IMAGE'; slot: ImageSlot }
  | { type: 'SET_SAVING'; value: boolean }

const MODAL_CLOSED: ModalState = {
  open: false, editing: null, form: EMPTY_FORM, saving: false,
  imageFile: null, imagePreview: null,
  imageFile2: null, imagePreview2: null,
  imageFile3: null, imagePreview3: null,
}

function modalReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case 'OPEN_CREATE': return { ...MODAL_CLOSED, open: true }
    case 'OPEN_EDIT':
      return {
        open: true, editing: action.medicine, saving: false,
        imageFile: null, imagePreview: action.medicine.medicine_image || null,
        imageFile2: null, imagePreview2: action.medicine.medicine_image_2 || null,
        imageFile3: null, imagePreview3: action.medicine.medicine_image_3 || null,
        form: {
          medicine_name: action.medicine.medicine_name,
          generic_name: action.medicine.generic_name,
          common_usage: action.medicine.common_usage,
          alternative_medicines: action.medicine.alternative_medicines.join(', '),
          drug_category: action.medicine.drug_category,
          color: action.medicine.color || '',
          manufacturer_name: action.medicine.manufacturer_name || '',
          marketer_name: action.medicine.marketer_name || '',
          salt_composition: action.medicine.salt_composition || '',
          tablet_color: action.medicine.tablet_color || '',
          appearance: action.medicine.appearance || '',
        },
      }
    case 'CLOSE': return { ...MODAL_CLOSED }
    case 'SET_FIELD': return { ...state, form: { ...state.form, [action.key]: action.value } }
    case 'SET_IMAGE':
      if (action.slot === 1) return { ...state, imageFile: action.file, imagePreview: action.preview }
      if (action.slot === 2) return { ...state, imageFile2: action.file, imagePreview2: action.preview }
      return { ...state, imageFile3: action.file, imagePreview3: action.preview }
    case 'CLEAR_IMAGE':
      if (action.slot === 1) return { ...state, imageFile: null, imagePreview: null }
      if (action.slot === 2) return { ...state, imageFile2: null, imagePreview2: null }
      return { ...state, imageFile3: null, imagePreview3: null }
    case 'SET_SAVING': return { ...state, saving: action.value }
    default: return state
  }
}

// ── Skeleton shimmer row ──────────────────────────────────────────────────────
function SkeletonRows({ n = 8 }: { n?: number }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <tr key={i}>
          {[200, 130, 100, 60, 160, 130, 80].map((w, j) => (
            <td key={j} style={{ padding: '14px 16px' }}>
              <div className="sk" style={{ height: 13, width: w, borderRadius: 6 }} />
              {j === 0 && <div className="sk" style={{ height: 10, width: w * 0.6, borderRadius: 6, marginTop: 6 }} />}
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]

export default function MedicinePrescriptionsPage() {
  const { user } = useAuth()
  const navItems = user?.role === 'PHARMACIST' ? PHARMACIST_NAV : DOCTOR_NAV

  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [stats, setStats] = useState<{ total: number } | null>(null)
  const [statsVisible, setStatsVisible] = useState(false)

  const [modal, dispatch] = useReducer(modalReducer, MODAL_CLOSED)
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const fileInputRef2 = useRef<HTMLInputElement>(null)
  const fileInputRef3 = useRef<HTMLInputElement>(null)
  const [uploadingId, setUploadingId]   = useState<string | null>(null)
  const [viewingImage, setViewingImage] = useState<{ url: string; name: string } | null>(null)
  const [hoveredImage, setHoveredImage] = useState<{ url: string; x: number; y: number } | null>(null)

  useEffect(() => {
    return () => {
      if (modal.imagePreview?.startsWith('blob:'))  URL.revokeObjectURL(modal.imagePreview)
      if (modal.imagePreview2?.startsWith('blob:')) URL.revokeObjectURL(modal.imagePreview2)
      if (modal.imagePreview3?.startsWith('blob:')) URL.revokeObjectURL(modal.imagePreview3)
    }
  }, [modal.imagePreview, modal.imagePreview2, modal.imagePreview3])

  function closeModal() {
    if (modal.imagePreview?.startsWith('blob:'))  URL.revokeObjectURL(modal.imagePreview)
    if (modal.imagePreview2?.startsWith('blob:')) URL.revokeObjectURL(modal.imagePreview2)
    if (modal.imagePreview3?.startsWith('blob:')) URL.revokeObjectURL(modal.imagePreview3)
    dispatch({ type: 'CLOSE' })
  }

  // ── Data fetching ───────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/medicine-prescriptions', { params: { page: 1, limit: 1 } })
      setStats({ total: data.data.total })
      setStatsVisible(true)
    } catch {}
  }, [])

  const fetchMedicines = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit }
      if (debouncedSearch) params.search = debouncedSearch
      if (categoryFilter)  params.drug_category = categoryFilter
      const { data } = await api.get('/medicine-prescriptions', { params })
      setMedicines(data.data.data)
      setTotal(data.data.total)
    } catch {
      toast.error('Failed to load medicines')
    } finally {
      setLoading(false)
    }
  }, [page, limit, debouncedSearch, categoryFilter])

  useEffect(() => { fetchMedicines() }, [fetchMedicines])

  useEffect(() => { fetchStats() }, [fetchStats])

  // ── Search debounce ─────────────────────────────────────────────────────────

  const handleSearch = (value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value)
      setPage(1)
    }, 500)
  }

  // ── Save / delete ───────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    dispatch({ type: 'SET_SAVING', value: true })
    try {
      const payload = {
        ...modal.form,
        alternative_medicines: modal.form.alternative_medicines.split(',').map(s => s.trim()).filter(Boolean),
      }
      let savedId: string
      if (modal.editing) {
        await api.put(`/medicine-prescriptions/${modal.editing._id}`, payload)
        savedId = modal.editing._id
        toast.success('Medicine updated')
      } else {
        const { data } = await api.post('/medicine-prescriptions', payload)
        savedId = data.data._id
        toast.success('Medicine added')
      }
      const imageUploads: [File, string][] = []
      if (modal.imageFile)  imageUploads.push([modal.imageFile,  'medicine_image'])
      if (modal.imageFile2) imageUploads.push([modal.imageFile2, 'medicine_image_2'])
      if (modal.imageFile3) imageUploads.push([modal.imageFile3, 'medicine_image_3'])
      for (const [file, field] of imageUploads) {
        const fd = new FormData()
        fd.append('image', file)
        await api.post(`/medicine-prescriptions/${savedId}/image?field=${field}`, fd, { headers: { 'Content-Type': undefined } })
      }
      closeModal()
      fetchMedicines()
      fetchStats()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Save failed')
    } finally {
      dispatch({ type: 'SET_SAVING', value: false })
    }
  }

  async function handleImageUpload(id: string, file: File, field = 'medicine_image') {
    setUploadingId(`${id}_${field}`)
    try {
      const fd = new FormData()
      fd.append('image', file)
      await api.post(`/medicine-prescriptions/${id}/image?field=${field}`, fd, { headers: { 'Content-Type': undefined } })
      toast.success('Image uploaded')
      fetchMedicines()
    } catch {
      toast.error('Image upload failed')
    } finally {
      setUploadingId(null)
    }
  }

  // ── Pagination ──────────────────────────────────────────────────────────────

  const totalPages = Math.ceil(total / limit)

  function pageNumbers(): (number | '…')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '…')[] = []
    if (page <= 4) {
      pages.push(1, 2, 3, 4, 5, '…', totalPages)
    } else if (page >= totalPages - 3) {
      pages.push(1, '…', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
    } else {
      pages.push(1, '…', page - 1, page, page + 1, '…', totalPages)
    }
    return pages
  }

  // ── Styles shared ───────────────────────────────────────────────────────────

  const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--ink-light)', marginBottom: 5 }

  const isFiltered = debouncedSearch || categoryFilter

  return (
    <AppShell navItems={navItems} sectionLabel={user?.role === 'PHARMACIST' ? 'Pharmacist' : undefined}>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      {/* <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: 0, letterSpacing: '-0.3px' }}>
            Medicine Database
          </h1>
          <p style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 4 }}>
            {statsVisible && stats
              ? `${stats.total.toLocaleString()} medicine${stats.total !== 1 ? 's' : ''} in database`
              : 'Loading…'}
          </p>
        </div>
        <button
          className="btn btn-teal"
          onClick={() => dispatch({ type: 'OPEN_CREATE' })}
          style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Medicine
        </button>
      </div> */}

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
        {/* Total in DB */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
          padding: '10px 14px', borderLeft: '3px solid #7c3aed',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Total in Database</p>
            <p style={{ fontSize: 11, color: 'var(--ink-light)', margin: '2px 0 0' }}>All time</p>
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: 0, lineHeight: 1 }}>
            {statsVisible && stats
              ? stats.total.toLocaleString()
              : <span className="sk" style={{ display: 'inline-block', width: 40, height: 22, borderRadius: 5, verticalAlign: 'middle' }} />}
          </p>
        </div>

        {/* Filtered / Showing */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
          padding: '10px 14px', borderLeft: '3px solid var(--teal)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              {isFiltered ? 'Search Results' : 'Showing'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--ink-light)', margin: '2px 0 0' }}>
              {isFiltered ? 'matching filters' : 'medicines'}
            </p>
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: 0, lineHeight: 1 }}>
            {loading
              ? <span className="sk" style={{ display: 'inline-block', width: 40, height: 22, borderRadius: 5, verticalAlign: 'middle' }} />
              : total.toLocaleString()}
          </p>
        </div>

        {/* Page info */}
        {/* <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
          padding: '10px 14px', borderLeft: '3px solid #f59e0b',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Current Page</p>
            <p style={{ fontSize: 11, color: 'var(--ink-light)', margin: '2px 0 0' }}>
              {totalPages > 1 ? `of ${totalPages} pages` : 'entries'}
            </p>
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: 0, lineHeight: 1 }}>
            {loading
              ? <span className="sk" style={{ display: 'inline-block', width: 40, height: 22, borderRadius: 5, verticalAlign: 'middle' }} />
              : medicines.length}
          </p>
        </div> */}

        <button
          className="btn btn-teal"
          onClick={() => dispatch({ type: 'OPEN_CREATE' })}
          style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Medicine
        </button>

      </div>

      {/* ── Filter toolbar ────────────────────────────────────────────────── */}
      <div className="filter-bar" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', marginBottom: 16 }}>
        {/* Debounced search */}
        <div className="filter-search">
          <svg className="filter-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="input-field"
            placeholder="Search medicine or generic name…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            style={{ paddingRight: search ? 28 : undefined }}
          />
          {search && (
            <button
              onClick={() => { handleSearch(''); setDebouncedSearch('') }}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--ink-light)', display: 'flex', alignItems: 'center', padding: 2 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {/* Category filter */}
        <div style={{ position: 'relative', width: 160, flexShrink: 0 }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-light)', pointerEvents: 'none' }}
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          <input
            className="input-field"
            placeholder="Drug category…"
            value={categoryFilter}
            onChange={e => { setCategoryFilter(e.target.value); setPage(1) }}
            style={{ paddingLeft: 28, paddingRight: categoryFilter ? 28 : undefined }}
          />
          {categoryFilter && (
            <button
              onClick={() => { setCategoryFilter(''); setPage(1) }}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--ink-light)', display: 'flex', alignItems: 'center', padding: 2 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {/* Page size */}
        <select
          className="input-field filter-select-sm"
          value={limit}
          onChange={e => { setLimit(Number(e.target.value)); setPage(1) }}
        >
          {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.015)' }}>
                {['Medicine', 'Generic Name', 'Category', 'Color', 'Common Usage', 'Images', ''].map(h => (
                  <th key={h} style={{
                    padding: '11px 16px', textAlign: 'left', fontSize: 11,
                    fontWeight: 600, color: 'var(--ink-light)', letterSpacing: '0.04em',
                    textTransform: 'uppercase', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows n={limit > 10 ? 8 : limit} />
              ) : medicines.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '60px 0', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="1.5">
                        <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
                      </svg>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>No medicines found</p>
                      <p style={{ fontSize: 12, color: 'var(--ink-light)', margin: 0 }}>
                        {isFiltered ? 'Try a different search or clear filters' : 'Add your first medicine using the button above'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                medicines.map(m => (
                  <tr
                    key={m._id}
                    style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(13,148,136,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    {/* Medicine name */}
                    <td style={{ padding: '14px 16px', minWidth: 180 }}>
                      <p style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13, margin: 0 }}>{m.medicine_name}</p>
                      {m.salt_composition && (
                        <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 3, margin: '3px 0 0' }}>{m.salt_composition}</p>
                      )}
                    </td>

                    {/* Generic name */}
                    <td style={{ padding: '14px 16px', color: 'var(--ink-light)', minWidth: 130 }}>
                      {m.generic_name}
                    </td>

                    {/* Category */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
                        background: 'var(--teal-light)', color: 'var(--teal-dark)',
                        whiteSpace: 'nowrap',
                      }}>
                        {m.drug_category}
                      </span>
                    </td>

                    {/* Color */}
                    <td style={{ padding: '14px 16px' }}>
                      {m.color ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            display: 'inline-block', width: 14, height: 14, borderRadius: '50%',
                            background: m.color, border: '1.5px solid rgba(0,0,0,0.12)', flexShrink: 0,
                          }} />
                          <span style={{ fontSize: 12, color: 'var(--ink-light)' }}>{m.color}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--ink-light)', opacity: 0.4 }}>—</span>
                      )}
                    </td>

                    {/* Common usage */}
                    <td style={{
                      padding: '14px 16px', fontSize: 12, color: 'var(--ink-light)',
                      maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {m.common_usage}
                    </td>

                    {/* Images */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(['medicine_image', 'medicine_image_2', 'medicine_image_3'] as const).map((field, i) => {
                          const url = m[field]
                          const slotKey = `${m._id}_${field}`
                          return url ? (
                            <div
                              key={field}
                              onClick={() => setViewingImage({ url, name: m.medicine_name })}
                              onMouseEnter={e => {
                                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                                setHoveredImage({ url, x: rect.left + rect.width / 2, y: rect.top })
                              }}
                              onMouseLeave={() => setHoveredImage(null)}
                              style={{
                                width: 48, height: 48, borderRadius: 8, overflow: 'hidden',
                                border: '1.5px solid var(--border)', cursor: 'zoom-in',
                                background: '#f5f5f3', flexShrink: 0,
                                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                              }}
                            >
                              <img src={url} alt={`${m.medicine_name} ${i + 1}`}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            </div>
                          ) : (
                            <label key={field} style={{
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: 48, height: 48, borderRadius: 8, border: '1.5px dashed var(--border)',
                              fontSize: 11, color: 'var(--teal)', background: 'var(--teal-light)', flexShrink: 0,
                            }}>
                              {uploadingId === slotKey ? '…' : `+${i + 1}`}
                              <input type="file" accept="image/*" style={{ display: 'none' }}
                                disabled={uploadingId === slotKey}
                                onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(m._id, f, field) }} />
                            </label>
                          )
                        })}
                      </div>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          onClick={() => dispatch({ type: 'OPEN_EDIT', medicine: m })}
                          style={{
                            fontSize: 12, color: 'var(--teal)', background: 'var(--teal-light)',
                            border: '1px solid rgba(13,148,136,0.2)', borderRadius: 7,
                            cursor: 'pointer', padding: '5px 12px', fontFamily: 'var(--font-sans)',
                            fontWeight: 500, transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(13,148,136,0.15)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'var(--teal-light)')}
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ─────────────────────────────────────────────────── */}
        {!loading && totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 20px', borderTop: '1px solid var(--border)',
            background: 'rgba(0,0,0,0.01)', flexWrap: 'wrap', gap: 10,
          }}>
            <p style={{ fontSize: 12, color: 'var(--ink-light)', margin: 0 }}>
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total.toLocaleString()}
            </p>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                style={{
                  padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)',
                  background: 'var(--surface)', cursor: page === 1 ? 'not-allowed' : 'pointer',
                  opacity: page === 1 ? 0.4 : 1, fontSize: 12, color: 'var(--ink)',
                  fontFamily: 'var(--font-sans)', transition: 'background 0.1s',
                }}
              >← Prev</button>

              {pageNumbers().map((p, i) =>
                p === '…' ? (
                  <span key={`e${i}`} style={{ padding: '5px 4px', fontSize: 12, color: 'var(--ink-light)' }}>…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    style={{
                      padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)',
                      background: page === p ? 'var(--teal)' : 'var(--surface)',
                      color: page === p ? '#fff' : 'var(--ink)',
                      cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-sans)',
                      fontWeight: page === p ? 600 : 400, transition: 'background 0.1s',
                      minWidth: 34,
                    }}
                  >{p}</button>
                )
              )}

              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                style={{
                  padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)',
                  background: 'var(--surface)', cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  opacity: page === totalPages ? 0.4 : 1, fontSize: 12, color: 'var(--ink)',
                  fontFamily: 'var(--font-sans)', transition: 'background 0.1s',
                }}
              >Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────── */}
      {modal.open && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 className="modal-title" style={{ margin: 0 }}>{modal.editing ? 'Edit Medicine' : 'Add Medicine'}</h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-light)', display: 'flex' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '65vh', overflowY: 'auto', paddingRight: 4 }}>
              <div className="form-grid-2">
                <div>
                  <label style={lbl}>Medicine Name *</label>
                  <input className="input-field" placeholder="e.g. Paracetamol 500mg"
                    value={modal.form.medicine_name}
                    onChange={e => dispatch({ type: 'SET_FIELD', key: 'medicine_name', value: e.target.value })} required />
                </div>
                <div>
                  <label style={lbl}>Generic Name *</label>
                  <input className="input-field" placeholder="e.g. Acetaminophen"
                    value={modal.form.generic_name}
                    onChange={e => dispatch({ type: 'SET_FIELD', key: 'generic_name', value: e.target.value })} required />
                </div>
              </div>
              <div className="form-grid-2">
                <div>
                  <label style={lbl}>Drug Category *</label>
                  <input className="input-field" placeholder="e.g. Analgesic / Antipyretic"
                    value={modal.form.drug_category}
                    onChange={e => dispatch({ type: 'SET_FIELD', key: 'drug_category', value: e.target.value })} required />
                </div>
                <div>
                  <label style={lbl}>Color <span style={{ fontWeight: 400, color: 'var(--ink-light)' }}>(optional)</span></label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="color"
                      value={modal.form.color || '#1D9E75'}
                      onChange={e => dispatch({ type: 'SET_FIELD', key: 'color', value: e.target.value })}
                      style={{ width: 36, height: 36, padding: 2, border: '1.5px solid var(--border)', borderRadius: 8, cursor: 'pointer', background: 'none' }}
                    />
                    <input
                      className="input-field"
                      placeholder="#rrggbb or name"
                      value={modal.form.color}
                      onChange={e => dispatch({ type: 'SET_FIELD', key: 'color', value: e.target.value })}
                      style={{ flex: 1 }}
                    />
                    {modal.form.color && (
                      <button type="button"
                        onClick={() => dispatch({ type: 'SET_FIELD', key: 'color', value: '' })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-light)', padding: 0, display: 'flex' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label style={lbl}>Salt Composition</label>
                <input className="input-field" placeholder="e.g. Paracetamol 500mg"
                  value={modal.form.salt_composition}
                  onChange={e => dispatch({ type: 'SET_FIELD', key: 'salt_composition', value: e.target.value })} />
              </div>
              <div className="form-grid-2">
                <div>
                  <label style={lbl}>Manufacturer Name</label>
                  <input className="input-field" placeholder="e.g. Sun Pharma"
                    value={modal.form.manufacturer_name}
                    onChange={e => dispatch({ type: 'SET_FIELD', key: 'manufacturer_name', value: e.target.value })} />
                </div>
                <div>
                  <label style={lbl}>Marketer Name</label>
                  <input className="input-field" placeholder="e.g. Abbott India"
                    value={modal.form.marketer_name}
                    onChange={e => dispatch({ type: 'SET_FIELD', key: 'marketer_name', value: e.target.value })} />
                </div>
              </div>
              <div className="form-grid-2">
                <div>
                  <label style={lbl}>Tablet Color</label>
                  <input className="input-field" placeholder="e.g. White, Yellow"
                    value={modal.form.tablet_color}
                    onChange={e => dispatch({ type: 'SET_FIELD', key: 'tablet_color', value: e.target.value })} />
                </div>
                <div>
                  <label style={lbl}>Appearance</label>
                  <input className="input-field" placeholder="e.g. Round, Film-coated"
                    value={modal.form.appearance}
                    onChange={e => dispatch({ type: 'SET_FIELD', key: 'appearance', value: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={lbl}>Common Usage *</label>
                <textarea className="input-field" rows={2} style={{ resize: 'none' }}
                  placeholder="e.g. Fever, mild to moderate pain relief"
                  value={modal.form.common_usage}
                  onChange={e => dispatch({ type: 'SET_FIELD', key: 'common_usage', value: e.target.value })} required />
              </div>
              <div>
                <label style={lbl}>Alternative Medicines <span style={{ fontWeight: 400, color: 'var(--ink-light)' }}>(comma separated)</span></label>
                <input className="input-field" placeholder="e.g. Dolo 650, Crocin, Calpol"
                  value={modal.form.alternative_medicines}
                  onChange={e => dispatch({ type: 'SET_FIELD', key: 'alternative_medicines', value: e.target.value })} />
              </div>

              {/* Image upload — 3 slots */}
              <div>
                <label style={lbl}>Medicine Images <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {(
                    [
                      { slot: 1 as ImageSlot, ref: fileInputRef,  preview: modal.imagePreview,  label: 'Image 1' },
                      { slot: 2 as ImageSlot, ref: fileInputRef2, preview: modal.imagePreview2, label: 'Image 2' },
                      { slot: 3 as ImageSlot, ref: fileInputRef3, preview: modal.imagePreview3, label: 'Image 3' },
                    ] as const
                  ).map(({ slot, ref, preview, label }) => (
                    <div key={slot}>
                      <p style={{ fontSize: 10, color: 'var(--ink-light)', marginBottom: 4, textAlign: 'center' }}>{label}</p>
                      <input ref={ref} type="file" accept=".jpg,.jpeg,.png,.webp" style={{ display: 'none' }}
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (!f) return
                          if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
                          dispatch({ type: 'SET_IMAGE', slot, file: f, preview: URL.createObjectURL(f) })
                        }} />
                      {preview ? (
                        <div style={{ border: '1px solid var(--teal)', borderRadius: 8, overflow: 'hidden', background: 'var(--teal-light)' }}>
                          <img src={preview} alt={label} style={{ width: '100%', height: 80, objectFit: 'contain', padding: 4 }} />
                          <div style={{ display: 'flex', borderTop: '1px solid var(--teal)' }}>
                            <button type="button" onClick={() => ref.current?.click()}
                              style={{ flex: 1, fontSize: 11, color: 'var(--teal)', background: 'var(--surface)', border: 'none', cursor: 'pointer', padding: '5px 0', fontFamily: 'var(--font-sans)' }}>
                              Change
                            </button>
                            <button type="button" onClick={() => {
                              if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
                              dispatch({ type: 'CLEAR_IMAGE', slot })
                              if (ref.current) ref.current.value = ''
                            }} style={{ flex: 1, fontSize: 11, color: 'var(--danger)', background: 'var(--surface)', border: 'none', borderLeft: '1px solid var(--teal)', cursor: 'pointer', padding: '5px 0', fontFamily: 'var(--font-sans)' }}>
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => ref.current?.click()}
                          style={{ width: '100%', border: '2px dashed var(--border)', borderRadius: 8, padding: '14px 0',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                            background: 'none', cursor: 'pointer', transition: 'border-color .15s' }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--teal)')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-light)" strokeWidth="1.5">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                          </svg>
                          <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>Upload</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, paddingTop: 4, position: 'sticky', bottom: 0, background: 'var(--surface)', paddingBottom: 2 }}>
                <button type="button" onClick={closeModal} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={modal.saving} className="btn btn-teal" style={{ flex: 1, opacity: modal.saving ? .6 : 1 }}>
                  {modal.saving ? 'Saving…' : modal.editing ? 'Update' : 'Add Medicine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Hover Image Preview ──────────────────────────────────────────── */}
      {hoveredImage && (
        <div style={{
          position: 'fixed', left: hoveredImage.x, top: hoveredImage.y - 8,
          transform: 'translate(-50%, -100%)', zIndex: 999, pointerEvents: 'none',
          background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12,
          padding: 6, boxShadow: '0 8px 32px rgba(0,0,0,0.22)', animation: 'fadeInUp 0.12s ease',
        }}>
          <img src={hoveredImage.url} alt="preview"
            style={{ width: 180, height: 180, objectFit: 'contain', borderRadius: 8, display: 'block' }} />
        </div>
      )}

      {/* ── Image Lightbox ───────────────────────────────────────────────── */}
      {viewingImage && (
        <div onClick={() => setViewingImage(null)} style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#000', borderRadius: 16, padding: 20,
            maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: 14,
            boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>{viewingImage.name}</p>
              <button onClick={() => setViewingImage(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', display: 'flex', padding: 2 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <img src={viewingImage.url} alt={viewingImage.name}
              style={{ maxWidth: '80vw', maxHeight: '70vh', objectFit: 'contain', borderRadius: 10, display: 'block' }} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translate(-50%, -95%); } to { opacity: 1; transform: translate(-50%, -100%); } }
        @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        .sk {
          background: linear-gradient(90deg, var(--border) 25%, rgba(0,0,0,0.04) 50%, var(--border) 75%);
          background-size: 400px 100%;
          animation: shimmer 1.4s ease infinite;
        }
      `}</style>
    </AppShell>
  )
}
