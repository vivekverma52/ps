import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { QRCodeSVG } from 'qrcode.react'
import api from '../services/api'
import AppShell from '../components/layout/AppShell'
import { PHARMACIST_NAV } from '../constants/nav'
import { StatusBadge } from '../components/ui/StatusBadge'

interface Medicine {
  id: string
  name: string
  quantity: string
  frequency: string
  course: string
  description?: string
}

interface ExtractedMedicine {
  medicine_name: string
  dosage?: string
  duration?: string
  instructions?: string
  time_of_day?: string | string[]
  with_food?: string
  text?: { en?: string }
}

interface InterpretedData {
  medicines?: Medicine[]
  ocr_source?: boolean
  interpreted_data?: {
    medicines?: ExtractedMedicine[]
    doctor_details?: { name?: string; qualifications?: string; contact?: string }
    hospital_details?: { name?: string; address?: string }
    patient_details?: { name?: string; phone?: string; date?: string }
  }
  metadata?: { processed_at?: string }
  status?: string
}

interface Prescription {
  id: string
  doctor_name: string
  patient_name: string
  patient_phone: string
  language: string
  image_url?: string
  video_url?: string
  access_token: string
  status: string
  notes?: string
  created_at: string
  interpreted_data?: InterpretedData
}

const FREQ_OPTIONS = ['Morning', 'Afternoon', 'Night']
const EMPTY_FORM = { name: '', quantity: '1', frequency: [] as string[], course: '', description: '' }

// ── Shared field styles ──────────────────────────────────────────────────────
const field: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)',
  padding: '8px 11px', borderRadius: 9, fontSize: 13, outline: 'none',
  fontFamily: 'var(--font-sans)', width: '100%', boxSizing: 'border-box',
}
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 500, color: 'var(--ink-light)', display: 'block', marginBottom: 4 }

// ── Inline Medicine Form (add OR edit) ────────────────────────────────────────
function MedicineForm({
  prescriptionId, initial, submitLabel, onDone, onCancel,
}: {
  prescriptionId: string
  initial: typeof EMPTY_FORM & { id?: string }
  submitLabel: string
  onDone: () => void
  onCancel?: () => void
}) {
  const [form, setForm] = useState(initial)
  const [allMedicines, setAllMedicines] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSug, setShowSug] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const nameRef    = useRef<HTMLInputElement>(null)
  const sugRef     = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load full medicine list from MongoDB on mount
  useEffect(() => {
    api.get('/prescriptions/medicines/search?q=')
      .then(res => {
        const data: string[] = res.data.data ?? []
        setAllMedicines(data)
        setSuggestions(data)
      })
      .catch(() => {})
  }, [])

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sugRef.current && !sugRef.current.contains(e.target as Node) && e.target !== nameRef.current) {
        setShowSug(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const searchMedicines = (q: string) => {
    setForm(f => ({ ...f, name: q }))
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/prescriptions/medicines/search?q=${encodeURIComponent(q)}`)
        const data: string[] = res.data.data ?? []
        setSuggestions(data)
        setShowSug(data.length > 0)
      } catch { setSuggestions(allMedicines) }
    }, 300)
  }

  const handleFocus = () => {
    setSuggestions(form.name.trim() ? suggestions : allMedicines)
    setShowSug(true)
  }

  const toggleFreq = (f: string) => {
    setForm(prev => ({
      ...prev,
      frequency: prev.frequency.includes(f)
        ? prev.frequency.filter(x => x !== f)
        : [...prev.frequency, f],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Medicine name is required')
    if (form.frequency.length === 0) return toast.error('Select at least one frequency')
    if (!form.course.trim()) return toast.error('Duration / course is required')

    setSubmitting(true)
    try {
      const body: any = {
        name: form.name.trim(),
        quantity: form.quantity || '1',
        frequency: form.frequency.join(', '),
        course: form.course.trim(),
      }
      if (form.description.trim()) body.description = form.description.trim()

      if (initial.id) {
        await api.put(`/prescriptions/${prescriptionId}/medicines/${initial.id}`, body)
        toast.success('Medicine updated')
      } else {
        await api.post(`/prescriptions/${prescriptionId}/medicines`, body)
        toast.success(`${form.name.trim()} added`)
      }
      onDone()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save medicine')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Medicine name + autocomplete */}
      <div style={{ position: 'relative' }}>
        <label style={lbl}>Medicine Name *</label>
        <input
          ref={nameRef}
          style={field}
          placeholder="Click or type to search medicines"
          value={form.name}
          autoFocus={!initial.id}
          onChange={e => searchMedicines(e.target.value)}
          onFocus={handleFocus}
          autoComplete="off"
        />
        {showSug && suggestions.length > 0 && (
          <div ref={sugRef} style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: 2,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,.1)', maxHeight: 180, overflowY: 'auto',
          }}>
            {suggestions.map(s => (
              <button key={s} type="button"
                onClick={() => { setForm(f => ({ ...f, name: s })); setShowSug(false) }}
                style={{
                  width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none',
                  border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink)',
                  fontFamily: 'var(--font-sans)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--teal-light)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quantity + Course */}
      <div className="form-grid-2">
        <div>
          <label style={lbl}>Quantity per Day *</label>
          <input style={field} type="number" min="1" max="10" value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
        </div>
        <div>
          <label style={lbl}>Duration / Course *</label>
          <input style={field} placeholder="e.g. 5 Days" value={form.course}
            onChange={e => setForm(f => ({ ...f, course: e.target.value }))} />
        </div>
      </div>

      {/* Frequency checkboxes */}
      <div>
        <label style={lbl}>Frequency *</label>
        <div style={{ display: 'flex', gap: 10 }}>
          {FREQ_OPTIONS.map(opt => {
            const checked = form.frequency.includes(opt)
            return (
              <button key={opt} type="button" onClick={() => toggleFreq(opt)} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '7px 13px',
                borderRadius: 9, border: `1.5px solid ${checked ? 'var(--teal)' : 'var(--border)'}`,
                background: checked ? 'var(--teal-light)' : 'var(--surface)',
                cursor: 'pointer', fontSize: 12, fontWeight: 500,
                color: checked ? 'var(--teal-dark)' : 'var(--ink-light)',
                fontFamily: 'var(--font-sans)', transition: 'all .12s',
              }}>
                <span style={{
                  width: 14, height: 14, borderRadius: 4, border: `2px solid ${checked ? 'var(--teal)' : 'var(--border)'}`,
                  background: checked ? 'var(--teal)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {checked && (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  )}
                </span>
                {opt}
              </button>
            )
          })}
        </div>
      </div>

      {/* Description */}
      <div>
        <label style={lbl}>Instructions (optional)</label>
        <textarea style={{ ...field, resize: 'none', lineHeight: 1.5 }} rows={2}
          placeholder="e.g. After food, before sleep…"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={submitting} className="btn btn-teal" style={{ flex: 1, justifyContent: 'center', opacity: submitting ? .65 : 1 }}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel} style={{ flex: 'none', padding: '0 18px' }}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

// ── OCR Medicine inline edit / add form ──────────────────────────────────────
const TIME_SLOTS = ['Morning', 'Afternoon', 'Night'] as const
const FOOD_OPTIONS = ['Before food', 'After food', 'With food'] as const

const EMPTY_OCR = {
  medicine_name: '',
  dosage: '',
  instructions: '',
  duration: '',
  time_of_day: [] as string[],
  with_food: '',
  text: { en: '' },
}

function OcrMedicineForm({ initial, onSave, onCancel }: {
  initial: typeof EMPTY_OCR
  onSave: (data: typeof EMPTY_OCR) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<typeof EMPTY_OCR>({
    ...EMPTY_OCR,
    ...initial,
    time_of_day: Array.isArray(initial.time_of_day)
      ? initial.time_of_day
      : initial.time_of_day ? (initial.time_of_day as string).split(',').map(s => s.trim()).filter(Boolean) : [],
    text: initial.text ?? { en: '' },
  })
  const [allMedicines, setAllMedicines] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSug, setShowSug] = useState(false)
  const nameRef     = useRef<HTMLInputElement>(null)
  const sugRef      = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load full medicine list from MongoDB on mount
  useEffect(() => {
    api.get('/prescriptions/medicines/search?q=')
      .then(res => {
        const data: string[] = res.data.data ?? []
        setAllMedicines(data)
        setSuggestions(data)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sugRef.current && !sugRef.current.contains(e.target as Node) && e.target !== nameRef.current)
        setShowSug(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const searchMedicines = (q: string) => {
    setForm(f => ({ ...f, medicine_name: q }))
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/prescriptions/medicines/search?q=${encodeURIComponent(q)}`)
        const data: string[] = res.data.data ?? []
        setSuggestions(data)
        setShowSug(data.length > 0)
      } catch { setSuggestions(allMedicines) }
    }, 300)
  }

  const handleFocusOcr = () => {
    setSuggestions(form.medicine_name.trim() ? suggestions : allMedicines)
    setShowSug(true)
  }

  const setField = (k: 'dosage' | 'instructions' | 'duration' | 'with_food') =>
    (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const toggleTime = (slot: string) =>
    setForm(f => ({
      ...f,
      time_of_day: f.time_of_day.includes(slot)
        ? f.time_of_day.filter(t => t !== slot)
        : [...f.time_of_day, slot],
    }))

  const accentColor = 'rgb(99,102,241)'
  const accentLight = 'rgba(99,102,241,.12)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Medicine name + autocomplete from MongoDB */}
      <div style={{ position: 'relative' }}>
        <label style={lbl}>Medicine Name *</label>
        <input
          ref={nameRef}
          style={field}
          autoFocus
          autoComplete="off"
          value={form.medicine_name}
          placeholder="Click or type to search medicines…"
          onChange={e => searchMedicines(e.target.value)}
          onFocus={handleFocusOcr}
        />
        {showSug && suggestions.length > 0 && (
          <div ref={sugRef} style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, marginTop: 2,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,.1)', maxHeight: 180, overflowY: 'auto',
          }}>
            {suggestions.map(s => (
              <button key={s} type="button"
                onClick={() => { setForm(f => ({ ...f, medicine_name: s })); setShowSug(false) }}
                style={{
                  width: '100%', textAlign: 'left', padding: '9px 14px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--font-sans)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = accentLight)}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Dosage + Duration */}
      <div className="form-grid-2">
        <div>
          <label style={lbl}>Dosage</label>
          <input style={field} value={form.dosage} onChange={setField('dosage')} placeholder="e.g. 1 tablet" />
        </div>
        <div>
          <label style={lbl}>Duration</label>
          <input style={field} value={form.duration} onChange={setField('duration')} placeholder="e.g. 5 days" />
        </div>
      </div>

      {/* Time of day */}
      <div>
        <label style={lbl}>Time of Day</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {TIME_SLOTS.map(slot => {
            const checked = form.time_of_day.includes(slot)
            return (
              <button key={slot} type="button" onClick={() => toggleTime(slot)} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px 0', borderRadius: 9,
                border: `1.5px solid ${checked ? accentColor : 'var(--border)'}`,
                background: checked ? accentLight : 'var(--surface)',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                color: checked ? accentColor : 'var(--ink-light)',
                fontFamily: 'var(--font-sans)', transition: 'all .12s',
              }}>
                <span style={{
                  width: 14, height: 14, borderRadius: 4,
                  border: `2px solid ${checked ? accentColor : 'var(--border)'}`,
                  background: checked ? accentColor : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {checked && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><path d="M20 6L9 17l-5-5"/></svg>}
                </span>
                {slot}
              </button>
            )
          })}
        </div>
      </div>

      {/* With food */}
      <div>
        <label style={lbl}>With Food</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {FOOD_OPTIONS.map(opt => {
            const selected = form.with_food === opt
            return (
              <button key={opt} type="button"
                onClick={() => setForm(f => ({ ...f, with_food: selected ? '' : opt }))}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 9, fontSize: 11, fontWeight: 600,
                  border: `1.5px solid ${selected ? accentColor : 'var(--border)'}`,
                  background: selected ? accentLight : 'var(--surface)',
                  color: selected ? accentColor : 'var(--ink-light)',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all .12s',
                }}>
                {opt}
              </button>
            )
          })}
        </div>
      </div>

      {/* Instructions */}
      <div>
        <label style={lbl}>Instructions</label>
        <input style={field} value={form.instructions} onChange={setField('instructions')} placeholder="e.g. May cause drowsiness" />
      </div>

      {/* English text for video */}
      <div>
        <label style={lbl}>Display Text (English)</label>
        <input style={field}
          value={form.text?.en ?? ''}
          onChange={e => setForm(f => ({ ...f, text: { en: e.target.value } }))}
          placeholder="e.g. Take Paracetamol after meals" />
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button type="button" style={{
          flex: 1, padding: '9px 0', borderRadius: 9, border: 'none',
          background: accentColor, color: '#fff', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'var(--font-sans)',
        }}
          onClick={() => {
            if (!form.medicine_name.trim()) return toast.error('Medicine name is required')
            onSave({ ...form, medicine_name: form.medicine_name.trim() })
          }}>
          Save
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel} style={{ flex: 'none', padding: '0 18px' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PharmacistPrescriptionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [prescription, setPrescription] = useState<Prescription | null>(null)
  const [loading, setLoading] = useState(true)
  const [rendering, setRendering] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [sending, setSending] = useState(false)
  const [importingIdx, setImportingIdx] = useState<number | null>(null)
  const [importedIdxs, setImportedIdxs] = useState<Set<number>>(new Set())
  const [ocrEditIdx, setOcrEditIdx] = useState<number | null>(null)
  const [showAddOcr, setShowAddOcr] = useState(false)
  const [ocrSaving, setOcrSaving] = useState(false)
  const [showAddManual, setShowAddManual] = useState(false)
  const [editManualId, setEditManualId] = useState<string | null>(null)
  const [deletingMedId, setDeletingMedId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'manual'; id: string; name: string } | { type: 'ocr'; idx: number; name: string } | null>(null)
  const [editingPatient, setEditingPatient] = useState(false)
  const [patientForm, setPatientForm] = useState({ patient_name: '', patient_phone: '' })
  const [savingPatient, setSavingPatient] = useState(false)

  const publicUrl = `${window.location.origin}/public/${prescription?.access_token}`

  const fetchPrescription = async () => {
    try {
      const res = await api.get(`/prescriptions/${id}`)
      setPrescription(res.data.data)
    } catch {
      toast.error('Failed to load prescription')
      navigate('/pharmacist')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPrescription() }, [id])

  const handleImportMedicine = async (med: ExtractedMedicine, idx: number) => {
    setImportingIdx(idx)
    try {
      const body: any = {
        name: med.medicine_name,
        quantity: '1',
        frequency: 'Morning',
        course: med.duration || 'As needed',
      }
      const desc = [med.dosage, med.instructions].filter(Boolean).join(' — ')
      if (desc) body.description = desc
      await api.post(`/prescriptions/${id}/medicines`, body)
      toast.success(`${med.medicine_name} imported`)
      setImportedIdxs(prev => new Set(prev).add(idx))
      fetchPrescription()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Import failed')
    } finally {
      setImportingIdx(null)
    }
  }

  const handleImportAll = async (medicines: ExtractedMedicine[]) => {
    for (let i = 0; i < medicines.length; i++) {
      if (!importedIdxs.has(i)) {
        await handleImportMedicine(medicines[i], i)
      }
    }
  }

  // ── OCR medicine CRUD ─────────────────────────────────────────────────
  const saveOcrMedicines = async (updatedMeds: typeof EMPTY_OCR[]) => {
    setOcrSaving(true)
    try {
      // Always use prescription.id (UUID), never the URL param which may be access_token
      const rxId = prescription!.id
      const current = (prescription!.interpreted_data as any) ?? {}
      const payload = {
        ...current,
        interpreted_data: {
          ...(current.interpreted_data ?? {}),
          medicines: updatedMeds,
        },
      }
      await api.put(`/prescriptions/${rxId}/interpreted-data`, payload)
      await fetchPrescription()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save medicines')
    } finally {
      setOcrSaving(false)
    }
  }

  const getOcrMeds = (): typeof EMPTY_OCR[] =>
    ((prescription!.interpreted_data?.interpreted_data?.medicines ?? []) as ExtractedMedicine[])
      .map(m => ({
        medicine_name: m.medicine_name ?? '',
        dosage:        m.dosage        ?? '',
        instructions:  m.instructions  ?? '',
        duration:      m.duration      ?? '',
        time_of_day:   Array.isArray(m.time_of_day)
          ? m.time_of_day
          : m.time_of_day ? String(m.time_of_day).split(',').map(s => s.trim()).filter(Boolean) : [],
        with_food: typeof m.with_food === 'string' ? m.with_food : '',
        text: { en: m.text?.en ?? '' },
      }))

  const handleOcrEdit = async (idx: number, updated: typeof EMPTY_OCR) => {
    const meds: typeof EMPTY_OCR[] = getOcrMeds()
    meds[idx] = updated
    await saveOcrMedicines(meds)
    setOcrEditIdx(null)
    toast.success('Medicine updated')
  }

  const handleOcrDelete = (idx: number, name: string) => {
    setConfirmDelete({ type: 'ocr', idx, name })
  }

  const confirmOcrDelete = async (idx: number) => {
    const meds: typeof EMPTY_OCR[] = getOcrMeds()
    meds.splice(idx, 1)
    await saveOcrMedicines(meds)
    toast.success('Medicine removed')
  }

  const handleOcrAdd = async (newMed: typeof EMPTY_OCR) => {
    const meds: typeof EMPTY_OCR[] = getOcrMeds()
    meds.push(newMed)
    await saveOcrMedicines(meds)
    setShowAddOcr(false)
    setOcrEditIdx(null)
    toast.success(`${newMed.medicine_name} added`)
  }


  const handleDeleteMed = (medId: string, name: string) => {
    setConfirmDelete({ type: 'manual', id: medId, name })
  }

  const confirmManualDelete = async (medId: string) => {
    setDeletingMedId(medId)
    try {
      await api.delete(`/prescriptions/${prescription!.id}/medicines/${medId}`)
      toast.success('Medicine removed')
      fetchPrescription()
    } catch {
      toast.error('Failed to remove medicine')
    } finally {
      setDeletingMedId(null)
    }
  }

  const handleSavePatient = async () => {
    if (!patientForm.patient_name.trim()) return toast.error('Patient name is required')
    if (!/^\d{10}$/.test(patientForm.patient_phone.trim())) return toast.error('Enter a valid 10-digit phone number')
    setSavingPatient(true)
    try {
      await api.put(`/prescriptions/${prescription!.id}/patient-details`, {
        patient_name: patientForm.patient_name.trim(),
        patient_phone: patientForm.patient_phone.trim(),
      })
      toast.success('Patient details updated')
      setEditingPatient(false)
      fetchPrescription()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update patient details')
    } finally {
      setSavingPatient(false)
    }
  }

  const handleRender = async () => {
    const pharmacistMeds = prescription?.interpreted_data?.medicines?.length ?? 0
    const ocrMeds = (prescription?.interpreted_data as any)?.interpreted_data?.medicines?.length ?? 0
    if (pharmacistMeds === 0 && ocrMeds === 0) return toast.error('Add at least one medicine before rendering')
    setRendering(true)
    try {
      await api.put(`/prescriptions/${prescription!.id}/render`, { video_url: null })
      toast.success('Render job sent!')
      fetchPrescription()
    } catch {
      toast.error('Render failed')
    } finally {
      setRendering(false)
    }
  }

  const handleSend = async () => {
    if (!prescription) return
    const msg = encodeURIComponent(
      `Hello ${prescription.patient_name},\n\nYour prescription from Dr. ${prescription.doctor_name} is ready.\n\nView here: ${publicUrl}\n\n- ExatoTechnologies`
    )
    window.open(`https://wa.me/91${prescription.patient_phone}?text=${msg}`, '_blank')
    setSending(true)
    try {
      await api.put(`/prescriptions/${prescription.id}/status`, { status: 'SENT' })
      toast.success('Sent to patient!')
      fetchPrescription()
    } catch {
      toast.error('Could not update status')
    } finally {
      setSending(false)
    }
  }

  const BackBtn = (
    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/pharmacist')}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 12H5M12 5l-7 7 7 7"/>
      </svg>
      Back
    </button>
  )

  if (loading) return (
    <AppShell navItems={PHARMACIST_NAV} sectionLabel="Pharmacist" topBarRight={BackBtn}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <div style={{ width: 28, height: 28, border: '2px solid var(--teal)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      </div>
    </AppShell>
  )

  if (!prescription) return null

  const alreadySent = prescription.status === 'SENT'

  const TopRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <StatusBadge status={prescription.status} />
      {BackBtn}
    </div>
  )

  return (
    <AppShell navItems={PHARMACIST_NAV} sectionLabel="Pharmacist" topBarRight={TopRight}>

      {/* ── Patient banner ── */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>

        {editingPatient ? (
          /* ── Edit mode ── */
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--ink-light)', marginBottom: 12 }}>
              Edit Patient Details
            </p>
            <div className="form-grid-2" style={{ marginBottom: 10 }}>
              <div>
                <label style={lbl}>Patient Name *</label>
                <input
                  className="input-field"
                  value={patientForm.patient_name}
                  onChange={e => setPatientForm(f => ({ ...f, patient_name: e.target.value }))}
                  placeholder="Full name"
                  autoFocus
                />
              </div>
              <div>
                <label style={lbl}>Mobile Number *</label>
                <input
                  className="input-field"
                  value={patientForm.patient_phone}
                  onChange={e => setPatientForm(f => ({ ...f, patient_phone: e.target.value }))}
                  placeholder="10-digit number"
                  type="tel"
                  maxLength={10}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-teal btn-sm" onClick={handleSavePatient} disabled={savingPatient}>
                {savingPatient ? 'Saving…' : 'Save'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingPatient(false)} disabled={savingPatient}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* ── Display mode ── */
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--teal-dark)' }}>
                  {prescription.patient_name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: 0, marginBottom: 2 }}>{prescription.patient_name}</h2>
                <p style={{ fontSize: 12, color: 'var(--ink-light)' }}>{prescription.patient_phone}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 10, color: 'var(--ink-light)', marginBottom: 2 }}>Prescribed by</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Dr. {prescription.doctor_name}</p>
                </div>
                <button
                  onClick={() => {
                    setPatientForm({ patient_name: prescription.patient_name, patient_phone: prescription.patient_phone })
                    setEditingPatient(true)
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: 'var(--teal)', background: 'var(--teal-light)', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', flexShrink: 0 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit
                </button>
              </div>
            </div>
            <div className="info-grid-3">
              {[
                ['Language', prescription.language],
                ['Date', new Date(prescription.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })],
                ['Medicines', `${prescription.interpreted_data?.medicines?.length ?? 0} added`],
              ].map(([label, value]) => (
                <div key={label} style={{ background: 'var(--cell)', borderRadius: 9, padding: '7px 12px' }}>
                  <p style={{ fontSize: 10, color: 'var(--ink-light)', marginBottom: 2 }}>{label}</p>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{value}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Main grid ── */}
      <div className="detail-grid">

        {/* LEFT col: image + actions + qr */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Prescription image */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--ink-light)', marginBottom: 10 }}>
              Prescription Image
            </p>
            {prescription.image_url ? (
              <img src={prescription.image_url} alt="Prescription"
                style={{ width: '100%', borderRadius: 10, objectFit: 'contain', maxHeight: 320, background: 'var(--cell)', border: '1px solid var(--border)' }} />
            ) : (
              <div style={{ height: 160, background: 'var(--cell)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed var(--border)' }}>
                <p style={{ fontSize: 13, color: 'var(--ink-light)' }}>No image uploaded</p>
              </div>
            )}
            {prescription.notes && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--warning-bg)', borderRadius: 8, border: '1px solid rgba(217,119,6,.15)' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--warning)', marginBottom: 3 }}>Doctor's Notes</p>
                <p style={{ fontSize: 12, color: 'var(--ink)' }}>{prescription.notes}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--ink-light)', marginBottom: 12 }}>Actions</p>
            <div className="info-grid-3">
              <button onClick={handleRender} disabled={rendering} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                padding: '14px 8px', borderRadius: 10, border: 'none', cursor: rendering ? 'not-allowed' : 'pointer',
                background: 'var(--teal)', color: '#fff', fontSize: 10, fontWeight: 700,
                letterSpacing: '.4px', textTransform: 'uppercase', fontFamily: 'var(--font-sans)',
                opacity: rendering ? .65 : 1,
              }}>
                {rendering
                  ? <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                  : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                }
                {rendering ? 'Rendering…' : 'Render'}
              </button>

              <button
                disabled={downloading}
                onClick={async () => {
                  if (!prescription.video_url) {
                    toast.error('Video not ready yet — render the prescription first')
                    return
                  }
                  setDownloading(true)
                  try {
                    const res = await api.get(`/prescriptions/${prescription.id}/download-video`)
                    const { url, filename } = res.data.data
                    const a = document.createElement('a')
                    a.href = url
                    a.download = filename
                    a.target = '_blank'
                    a.click()
                  } catch {
                    toast.error('Download failed')
                  } finally {
                    setDownloading(false)
                  }
                }} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                  padding: '14px 8px', borderRadius: 10, border: 'none',
                  cursor: downloading ? 'not-allowed' : 'pointer',
                  background: 'var(--teal)', color: '#fff', fontSize: 10, fontWeight: 700,
                  letterSpacing: '.4px', textTransform: 'uppercase', fontFamily: 'var(--font-sans)',
                  opacity: downloading ? .65 : 1,
                }}>
                {downloading
                  ? <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                  : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                }
                {downloading ? 'Downloading…' : 'Download'}
              </button>

              <button onClick={handleSend} disabled={sending || alreadySent} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                padding: '14px 8px', borderRadius: 10, border: 'none', cursor: alreadySent ? 'default' : 'pointer',
                background: alreadySent ? '#16a34a' : '#25D366', color: '#fff', fontSize: 10, fontWeight: 700,
                letterSpacing: '.4px', textTransform: 'uppercase', fontFamily: 'var(--font-sans)',
                opacity: sending ? .65 : 1,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                </svg>
                {alreadySent ? 'Sent ✓' : 'Send to Patient'}
              </button>
            </div>
          </div>

  
          {prescription.video_url && (
            <div className="card" style={{ padding: '16px 18px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--ink-light)', marginBottom: 10 }}>Rendered Video</p>
              <video src={prescription.video_url} controls style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)' }} />
            </div>
          )}
        </div>

        {/* RIGHT col: extracted data + medicines list + inline add/edit */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── AI Extracted Data Panel ── */}
          {(() => {
            const ai = prescription.interpreted_data
            // Show only when the OCR SQS consumer has processed this prescription
            if (!ai || !ai.ocr_source) return null
            const extracted = ai.interpreted_data
            const extractedMeds = extracted?.medicines ?? []
            const hospital = extracted?.hospital_details
            const doctor = extracted?.doctor_details
            const isOcr = (ai as any).ocr_source === true
            return (
              <div className="card" style={{ padding: '16px 18px', border: `1.5px solid ${isOcr ? 'rgba(99,102,241,.35)' : 'rgba(0,184,148,.3)'}`, background: isOcr ? 'linear-gradient(135deg, rgba(99,102,241,.04) 0%, var(--surface) 100%)' : 'linear-gradient(135deg, rgba(0,184,148,.04) 0%, var(--surface) 100%)' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: isOcr ? 'rgba(99,102,241,.12)' : 'var(--teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isOcr ? (
                        /* Scan / OCR icon */
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(99,102,241)" strokeWidth="2">
                          <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
                          <line x1="3" y1="12" x2="21" y2="12"/>
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
                          <circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                        </svg>
                      )}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                          {isOcr ? 'OCR Extracted Data' : 'AI Extracted Data'}
                        </p>
                        {isOcr && (
                          <span style={{
                            fontSize: 9, fontWeight: 800, letterSpacing: '.6px',
                            padding: '2px 7px', borderRadius: 20,
                            background: 'rgba(99,102,241,.12)', color: 'rgb(79,70,229)',
                            border: '1px solid rgba(99,102,241,.25)',
                            textTransform: 'uppercase',
                          }}>
                            OCR
                          </span>
                        )}
                      </div>
                      {ai.metadata?.processed_at && (
                        <p style={{ fontSize: 10, color: 'var(--ink-light)', margin: 0 }}>
                          Processed {new Date(ai.metadata.processed_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: isOcr ? 'rgba(99,102,241,.1)' : 'var(--teal-light)', color: isOcr ? 'rgb(79,70,229)' : 'var(--teal-dark)' }}>
                    {ai.status === 'success' ? 'Success' : ai.status}
                  </span>
                </div>

                {/* ── Patient Details (editable) ── */}
                <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 9, background: 'var(--cell)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editingPatient ? 10 : 0 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Patient Details</p>
                    {!editingPatient && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 10 }}
                        onClick={() => {
                          setPatientForm({ patient_name: prescription.patient_name, patient_phone: prescription.patient_phone })
                          setEditingPatient(true)
                        }}>
                        Edit
                      </button>
                    )}
                  </div>

                  {editingPatient ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>
                        <label style={{ ...lbl, marginBottom: 3 }}>Patient Name *</label>
                        <input
                          style={field}
                          value={patientForm.patient_name}
                          onChange={e => setPatientForm(f => ({ ...f, patient_name: e.target.value }))}
                          placeholder="Patient full name"
                        />
                      </div>
                      <div>
                        <label style={{ ...lbl, marginBottom: 3 }}>Mobile Number *</label>
                        <input
                          style={field}
                          value={patientForm.patient_phone}
                          onChange={e => setPatientForm(f => ({ ...f, patient_phone: e.target.value }))}
                          placeholder="10-digit number"
                          type="tel"
                          maxLength={10}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-teal"
                          style={{ flex: 1, justifyContent: 'center', fontSize: 12, opacity: savingPatient ? .65 : 1 }}
                          disabled={savingPatient}
                          onClick={handleSavePatient}>
                          {savingPatient ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 12 }}
                          onClick={() => setEditingPatient(false)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="form-grid-2" style={{ marginTop: 8 }}>
                      <div>
                        <p style={{ fontSize: 10, color: 'var(--ink-light)', marginBottom: 2 }}>Name</p>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{prescription.patient_name}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 10, color: 'var(--ink-light)', marginBottom: 2 }}>Mobile</p>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{prescription.patient_phone}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Hospital + Doctor */}
                {(hospital?.name || doctor?.name) && (
                  <div className="form-grid-2" style={{ marginBottom: 12 }}>
                    {hospital?.name && (
                      <div style={{ background: 'var(--cell)', borderRadius: 8, padding: '8px 10px' }}>
                        <p style={{ fontSize: 10, color: 'var(--ink-light)', marginBottom: 2 }}>Hospital</p>
                        <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.4 }}>{hospital.name}</p>
                        {hospital.address && <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 2 }}>{hospital.address}</p>}
                      </div>
                    )}
                    {doctor?.name && (
                      <div style={{ background: 'var(--cell)', borderRadius: 8, padding: '8px 10px' }}>
                        <p style={{ fontSize: 10, color: 'var(--ink-light)', marginBottom: 2 }}>Doctor</p>
                        <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>{doctor.name}</p>
                        {doctor.qualifications && <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 2 }}>{doctor.qualifications}</p>}
                      </div>
                    )}
                  </div>
                )}

                {/* Extracted medicines — editable */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>
                    Medicines ({extractedMeds.length})
                  </p>
                  <button
                    onClick={() => { setShowAddOcr(true); setOcrEditIdx(null) }}
                    className="btn btn-teal btn-sm"
                    disabled={ocrSaving || showAddOcr}
                    style={{ fontSize: 11 }}>
                    + Add Medicine
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {extractedMeds.map((m, i) =>
                    ocrEditIdx === i ? (
                      /* ── Inline edit row ── */
                      <div key={i} style={{ padding: 14, borderRadius: 10, background: 'rgba(99,102,241,.06)', border: '1.5px solid rgba(99,102,241,.25)' }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: 'rgb(79,70,229)', marginBottom: 10 }}>Edit medicine #{i + 1}</p>
                        <OcrMedicineForm
                          initial={{
                            medicine_name: m.medicine_name,
                            dosage:        m.dosage        ?? '',
                            instructions:  m.instructions  ?? '',
                            duration:      m.duration      ?? '',
                            time_of_day:   Array.isArray(m.time_of_day)
                              ? m.time_of_day
                              : m.time_of_day ? String(m.time_of_day).split(',').map(s => s.trim()).filter(Boolean) : [],
                            with_food: typeof m.with_food === 'string' ? m.with_food : '',
                            text: { en: m.text?.en ?? '' },
                          }}
                          onSave={updated => handleOcrEdit(i, updated)}
                          onCancel={() => setOcrEditIdx(null)}
                        />
                      </div>
                    ) : (
                      /* ── Display row ── */
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px', borderRadius: 9, background: 'var(--cell)', border: '1px solid var(--border)' }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(99,102,241,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgb(79,70,229)' }}>{i + 1}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{m.medicine_name}</p>
                          {/* Time of day chips */}
                          {(() => {
                            const times: string[] = Array.isArray(m.time_of_day)
                              ? m.time_of_day
                              : m.time_of_day ? String(m.time_of_day).split(',').map(s => s.trim()).filter(Boolean) : []
                            return times.length > 0 ? (
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                                {times.map(t => (
                                  <span key={t} style={{
                                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                                    background: 'rgba(99,102,241,.12)', color: 'rgb(79,70,229)',
                                    border: '1px solid rgba(99,102,241,.25)',
                                  }}>{t}</span>
                                ))}
                                {m.with_food && (
                                  <span style={{
                                    fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                                    background: 'rgba(0,184,148,.1)', color: 'var(--teal-dark)',
                                    border: '1px solid rgba(0,184,148,.2)',
                                  }}>{m.with_food}</span>
                                )}
                              </div>
                            ) : null
                          })()}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
                            {m.dosage       && <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>Dosage: <span style={{ color: 'var(--ink)' }}>{m.dosage}</span></span>}
                            {m.duration     && <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>Duration: <span style={{ color: 'var(--ink)' }}>{m.duration}</span></span>}
                            {m.instructions && <span style={{ fontSize: 11, color: 'var(--ink-light)', width: '100%' }}>Instructions: <span style={{ color: 'var(--ink)' }}>{m.instructions}</span></span>}
                            {m.text?.en     && <span style={{ fontSize: 11, color: 'var(--ink-light)', width: '100%' }}>Text: <span style={{ color: 'var(--ink)' }}>{m.text.en}</span></span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button
                            onClick={() => { setOcrEditIdx(i); setShowAddOcr(false) }}
                            className="btn btn-ghost btn-sm"
                            disabled={ocrSaving}
                            style={{ fontSize: 11 }}>
                            Edit
                          </button>
                          <button
                            onClick={() => handleOcrDelete(i, m.medicine_name)}
                            className="btn btn-ghost btn-sm"
                            disabled={ocrSaving}
                            style={{ fontSize: 11, color: '#ef4444' }}>
                            {ocrSaving ? '…' : '✕'}
                          </button>
                        </div>
                      </div>
                    )
                  )}

                  {extractedMeds.length === 0 && !showAddOcr && (
                    <p style={{ fontSize: 12, color: 'var(--ink-light)', fontStyle: 'italic' }}>No medicines yet. Click "+ Add Medicine" to add one.</p>
                  )}

                  {/* ── Add new OCR medicine form ── */}
                  {showAddOcr && (
                    <div style={{ padding: 14, borderRadius: 10, background: 'rgba(99,102,241,.06)', border: '1.5px solid rgba(99,102,241,.25)' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'rgb(79,70,229)', marginBottom: 10 }}>Add Medicine</p>
                      <OcrMedicineForm
                        initial={EMPTY_OCR}
                        onSave={handleOcrAdd}
                        onCancel={() => setShowAddOcr(false)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* ── Manual Medicines Panel (always visible) ── */}
          {(() => {
            const manualMeds: Medicine[] = prescription.interpreted_data?.medicines ?? []
            return (
              <div className="card" style={{ padding: '16px 18px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
                        <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
                      </svg>
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Medicines</p>
                      <p style={{ fontSize: 10, color: 'var(--ink-light)', margin: 0 }}>
                        {manualMeds.length === 0 ? 'No medicines added yet' : `${manualMeds.length} medicine${manualMeds.length > 1 ? 's' : ''} added`}
                      </p>
                    </div>
                  </div>
                  {!showAddManual && editManualId === null && (
                    <button
                      className="btn btn-teal btn-sm"
                      onClick={() => { setShowAddManual(true); setEditManualId(null) }}
                      style={{ fontSize: 11 }}>
                      + Add Medicine
                    </button>
                  )}
                </div>

                {/* No OCR notice — shown only when OCR has not processed this prescription */}
                {(!prescription.interpreted_data || !(prescription.interpreted_data as any).ocr_source) && (
                  <div style={{ marginBottom: 12, padding: '9px 12px', borderRadius: 9, background: 'rgba(217,119,6,.07)', border: '1px solid rgba(217,119,6,.2)' }}>
                    <p style={{ fontSize: 11, color: '#92400e', margin: 0 }}>
                      OCR service is not running. Add medicines manually below, then click <strong>Render</strong>.
                    </p>
                  </div>
                )}

                {/* Medicine list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {manualMeds.map(med =>
                    editManualId === med.id ? (
                      <div key={med.id} style={{ padding: 14, borderRadius: 10, background: 'var(--teal-light)', border: '1.5px solid rgba(0,184,148,.3)' }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--teal-dark)', marginBottom: 10 }}>Edit medicine</p>
                        <MedicineForm
                          prescriptionId={prescription.id}
                          initial={{
                            id: med.id,
                            name: med.name,
                            quantity: med.quantity,
                            frequency: med.frequency ? med.frequency.split(', ') : [],
                            course: med.course,
                            description: med.description ?? '',
                          }}
                          submitLabel="Save Changes"
                          onDone={() => { setEditManualId(null); fetchPrescription() }}
                          onCancel={() => setEditManualId(null)}
                        />
                      </div>
                    ) : (
                      <div key={med.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px', borderRadius: 9, background: 'var(--cell)', border: '1px solid var(--border)' }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5">
                            <path d="M12 5v14M5 12h14"/>
                          </svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>{med.name}</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
                            {med.quantity  && <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>Qty: <span style={{ color: 'var(--ink)' }}>{med.quantity}/day</span></span>}
                            {med.frequency && <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>Freq: <span style={{ color: 'var(--ink)' }}>{med.frequency}</span></span>}
                            {med.course    && <span style={{ fontSize: 11, color: 'var(--ink-light)' }}>Duration: <span style={{ color: 'var(--ink)' }}>{med.course}</span></span>}
                            {med.description && <span style={{ fontSize: 11, color: 'var(--ink-light)', width: '100%' }}>Note: <span style={{ color: 'var(--ink)' }}>{med.description}</span></span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => { setEditManualId(med.id); setShowAddManual(false) }}
                            style={{ fontSize: 11 }}>
                            Edit
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleDeleteMed(med.id, med.name)}
                            disabled={deletingMedId === med.id}
                            style={{ fontSize: 11, color: '#ef4444' }}>
                            {deletingMedId === med.id ? '…' : '✕'}
                          </button>
                        </div>
                      </div>
                    )
                  )}

                  {manualMeds.length === 0 && !showAddManual && (
                    <p style={{ fontSize: 12, color: 'var(--ink-light)', fontStyle: 'italic' }}>
                      No medicines added. Click "+ Add Medicine" to start.
                    </p>
                  )}

                  {/* Add form */}
                  {showAddManual && (
                    <div style={{ padding: 14, borderRadius: 10, background: 'var(--teal-light)', border: '1.5px solid rgba(0,184,148,.3)' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--teal-dark)', marginBottom: 10 }}>Add Medicine</p>
                      <MedicineForm
                        prescriptionId={prescription.id}
                        initial={{ ...EMPTY_FORM }}
                        submitLabel="Add Medicine"
                        onDone={() => { setShowAddManual(false); fetchPrescription() }}
                        onCancel={() => setShowAddManual(false)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

        </div>
      </div>

      {/* Remove Medicine Confirmation Dialog */}
      {confirmDelete && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 360, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#1a1a2e' }}>Remove Medicine</div>
            <div style={{ fontSize: 14, color: '#555', marginBottom: 24 }}>
              Are you sure you want to remove <strong>"{confirmDelete.name}"</strong>? This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setConfirmDelete(null)}
                style={{ minWidth: 80 }}
              >
                Cancel
              </button>
              <button
                className="btn btn-sm"
                style={{ background: '#ef4444', color: '#fff', minWidth: 80, border: 'none' }}
                disabled={!!deletingMedId}
                onClick={async () => {
                  const snap = confirmDelete
                  setConfirmDelete(null)
                  if (snap.type === 'manual') {
                    await confirmManualDelete(snap.id)
                  } else {
                    await confirmOcrDelete(snap.idx)
                  }
                }}
              >
                {deletingMedId ? '…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  )
}
