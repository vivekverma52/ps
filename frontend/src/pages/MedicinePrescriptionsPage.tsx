import { useState, useEffect, useRef, useReducer } from 'react'
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

export default function MedicinePrescriptionsPage() {
  const { user } = useAuth()
  const navItems = user?.role === 'PHARMACIST' ? PHARMACIST_NAV : DOCTOR_NAV
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  const [modal, dispatch] = useReducer(modalReducer, MODAL_CLOSED)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef2 = useRef<HTMLInputElement>(null)
  const fileInputRef3 = useRef<HTMLInputElement>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewingImage, setViewingImage] = useState<{ url: string; name: string } | null>(null)
  const [hoveredImage, setHoveredImage] = useState<{ url: string; x: number; y: number } | null>(null)

  useEffect(() => {
    return () => {
      if (modal.imagePreview?.startsWith('blob:')) URL.revokeObjectURL(modal.imagePreview)
      if (modal.imagePreview2?.startsWith('blob:')) URL.revokeObjectURL(modal.imagePreview2)
      if (modal.imagePreview3?.startsWith('blob:')) URL.revokeObjectURL(modal.imagePreview3)
    }
  }, [modal.imagePreview, modal.imagePreview2, modal.imagePreview3])

  function closeModal() {
    if (modal.imagePreview?.startsWith('blob:')) URL.revokeObjectURL(modal.imagePreview)
    if (modal.imagePreview2?.startsWith('blob:')) URL.revokeObjectURL(modal.imagePreview2)
    if (modal.imagePreview3?.startsWith('blob:')) URL.revokeObjectURL(modal.imagePreview3)
    dispatch({ type: 'CLOSE' })
  }

  async function fetchMedicines() {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit }
      if (search) params.search = search
      if (categoryFilter) params.drug_category = categoryFilter
      const { data } = await api.get('/medicine-prescriptions', { params })
      setMedicines(data.data.data)
      setTotal(data.data.total)
    } catch {
      toast.error('Failed to load medicines')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMedicines() }, [page, search, categoryFilter])

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
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Save failed')
    } finally {
      dispatch({ type: 'SET_SAVING', value: false })
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/medicine-prescriptions/${id}`)
      toast.success('Medicine deleted')
      setDeletingId(null)
      fetchMedicines()
    } catch {
      toast.error('Delete failed')
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

  const totalPages = Math.ceil(total / limit)

  const AddBtn = (
    <button className="btn btn-teal btn-sm" onClick={() => dispatch({ type: 'OPEN_CREATE' })}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Add Medicine
    </button>
  )

  const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--ink-light)', marginBottom: 5 }

  return (
    <AppShell navItems={navItems} sectionLabel={user?.role === 'PHARMACIST' ? 'Pharmacist' : undefined} topBarRight={AddBtn}>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--ink-light)' }}
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input className="input-field" style={{ paddingLeft: 32 }}
            placeholder="Search by medicine or generic name…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <input className="input-field" style={{ width: 220 }}
          placeholder="Filter by drug category…"
          value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1) }} />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ width: 26, height: 26, border: '2px solid var(--teal)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
        </div>
      ) : medicines.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-light)', fontSize: 13 }}>
          <p>No medicines found</p>
          <p style={{ fontSize: 12, marginTop: 4, opacity: .7 }}>Add your first medicine using the button above</p>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 }}>
          <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Generic Name</th>
                <th>Category</th>
                <th>Color</th>
                <th>Common Usage</th>
                <th>Image</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {medicines.map(m => (
                <tr key={m._id}>
                  <td>
                    <p style={{ fontWeight: 500, color: 'var(--ink)', fontSize: 13 }}>{m.medicine_name}</p>
                    {m.salt_composition && (
                      <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 2 }}>{m.salt_composition}</p>
                    )}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--ink-light)' }}>{m.generic_name}</td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: 'var(--teal-light)', color: 'var(--teal-dark)' }}>
                      {m.drug_category}
                    </span>
                  </td>
                  <td>
                    {m.color ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          display: 'inline-block', width: 16, height: 16, borderRadius: '50%',
                          background: m.color, border: '1.5px solid rgba(0,0,0,0.12)', flexShrink: 0,
                        }} />
                        <span style={{ fontSize: 12, color: 'var(--ink-light)' }}>{m.color}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--ink-light)', opacity: 0.4 }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--ink-light)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.common_usage}
                  </td>
                  <td>
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
                              width: 52, height: 52, borderRadius: 8, overflow: 'hidden',
                              border: '1.5px solid var(--border)', cursor: 'zoom-in',
                              background: '#f5f5f3', flexShrink: 0,
                              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                            }}
                          >
                            <img src={url} alt={`${m.medicine_name} ${i + 1}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          </div>
                        ) : (
                          <label key={field} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 52, height: 52, borderRadius: 8, border: '1.5px dashed var(--border)', fontSize: 11,
                            color: 'var(--teal)', background: 'var(--teal-light)', flexShrink: 0 }}>
                            {uploadingId === slotKey ? '…' : `+${i + 1}`}
                            <input type="file" accept="image/*" style={{ display: 'none' }}
                              disabled={uploadingId === slotKey}
                              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(m._id, f, field) }} />
                          </label>
                        )
                      })}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => dispatch({ type: 'OPEN_EDIT', medicine: m })}
                        style={{ fontSize: 12, color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
                        Edit
                      </button>
                      <button onClick={() => setDeletingId(m._id)}
                        style={{ fontSize: 12, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 11, color: 'var(--ink-light)' }}>
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="btn btn-ghost btn-sm" style={{ opacity: page === 1 ? .4 : 1 }}>Prev</button>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                  className="btn btn-ghost btn-sm" style={{ opacity: page === totalPages ? .4 : 1 }}>Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && (
        <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 10, textAlign: 'right' }}>
          {total} medicine{total !== 1 ? 's' : ''} in database
        </p>
      )}

      {/* Add / Edit Modal */}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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

      {/* Delete Confirm Modal */}
      {deletingId && (
        <div className="modal-overlay" onClick={() => setDeletingId(null)}>
          <div className="modal-box" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Delete Medicine?</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-light)', marginBottom: 22 }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeletingId(null)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
              <button onClick={() => handleDelete(deletingId)} className="btn btn-danger" style={{ flex: 1 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Hover Image Preview */}
      {hoveredImage && (
        <div
          style={{
            position: 'fixed',
            left: hoveredImage.x,
            top: hoveredImage.y - 8,
            transform: 'translate(-50%, -100%)',
            zIndex: 999,
            pointerEvents: 'none',
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            borderRadius: 12,
            padding: 6,
            boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
            animation: 'fadeInUp 0.12s ease',
          }}
        >
          <img
            src={hoveredImage.url}
            alt="preview"
            style={{ width: 180, height: 180, objectFit: 'contain', borderRadius: 8, display: 'block' }}
          />
        </div>
      )}

      {/* Image Lightbox */}
      {viewingImage && (
        <div
          onClick={() => setViewingImage(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', borderRadius: 16,
              padding: 20, maxWidth: '90vw', maxHeight: '90vh',
              display: 'flex', flexDirection: 'column', gap: 14,
              boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{viewingImage.name}</p>
              <button
                onClick={() => setViewingImage(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-light)', display: 'flex', padding: 2 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <img
              src={viewingImage.url}
              alt={viewingImage.name}
              style={{ maxWidth: '80vw', maxHeight: '70vh', objectFit: 'contain', borderRadius: 10, display: 'block' }}
            />
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translate(-50%, -95%); } to { opacity: 1; transform: translate(-50%, -100%); } }
      `}</style>
    </AppShell>
  )
}
