import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import AppShell from '../components/layout/AppShell'
import { DOCTOR_NAV } from '../constants/nav'

const LANGUAGES = [
  { label: 'Hindi',    value: 'hi' },
  { label: 'English',  value: 'en' },
  { label: 'Marathi',  value: 'mr' },
  { label: 'Tamil',    value: 'ta' },
  { label: 'Telugu',   value: 'te' },
  { label: 'Bengali',  value: 'bn' },
  { label: 'Gujarati', value: 'gu' },
  { label: 'Kannada',  value: 'kn' },
  { label: 'Punjabi',  value: 'pa' },
  { label: 'Odia',     value: 'or' },
]

export default function NewPrescriptionPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm<{
    doctor_name: string
    patient_name: string
    patient_phone: string
    language: string
    notes: string
  }>({ defaultValues: { doctor_name: user?.name || '', language: 'hi' } })

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview) }
  }, [preview])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (f.type.startsWith('image/')) {
      if (preview) URL.revokeObjectURL(preview)
      setPreview(URL.createObjectURL(f))
    } else {
      if (preview) URL.revokeObjectURL(preview)
      setPreview(null)
    }
  }

  const onSubmit = async (data: any) => {
    try {
      const form = new FormData()
      form.append('patient_name', data.patient_name)
      form.append('patient_phone', data.patient_phone)
      form.append('language', data.language)
      if (data.notes) form.append('notes', data.notes)
      if (file) form.append('image', file)
      const res = await api.post('/prescriptions', form)
      const prescription = res.data.data

      // Save demo interpreted data (replace with real AI service call later)
      if (prescription?.id) {
        try {
          const demoData = {
            status: 'success',
            metadata: {
              language: data.language,
              patient_name: data.patient_name,
              patient_phone: data.patient_phone,
              processed_at: new Date().toISOString(),
              unique_id: prescription.id.slice(0, 8),
            },
            interpreted_data: {
              patient_details: {
                name: data.patient_name,
                phone: data.patient_phone,
                date: new Date().toLocaleDateString('en-IN'),
              },
              doctor_details: {
                name: '',
                qualifications: '',
                contact: '',
              },
              hospital_details: {
                name: '',
                address: '',
              },
              medicines: [
                {
                  medicine_name: 'Paracetamol 500mg',
                  dosage: '1 tablet',
                  duration: '5 Days',
                  instructions: 'After food',
                },
                {
                  medicine_name: 'ORS Sachets',
                  dosage: 'Two sachets',
                  duration: 'As needed',
                  instructions: 'Dissolve in water and consume',
                },
              ],
            },
            raw_extracted_text: '(Demo — connect VITE_AI_SERVICE_URL for real OCR)',
          }
          await api.put(`/prescriptions/${prescription.id}/interpreted-data`, demoData)
        } catch {
          // non-critical
        }
      }

      toast.success('Prescription uploaded!')
      navigate('/prescriptions')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Upload failed')
    }
  }

  const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--ink-light)', marginBottom: 5 }

  const BackBtn = (
    <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 12H5M12 5l-7 7 7 7"/>
      </svg>
      Back
    </button>
  )

  return (
    <AppShell navItems={DOCTOR_NAV} topBarRight={BackBtn}>
      <div style={{ maxWidth: 520 }}>
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: '22px 22px' }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 18 }}>New Prescription</h2>

            {/* Doctor name (read-only) */}
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Doctor</label>
              <input className="input-field" readOnly value={user?.name || ''} style={{ background: 'var(--cell)', color: 'var(--ink-light)' }} />
            </div>

            {/* Patient name */}
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Patient Name *</label>
              <input className="input-field" placeholder="Patient full name"
                {...register('patient_name', { required: 'Patient name is required' })} />
              {errors.patient_name && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{errors.patient_name.message as string}</p>}
            </div>

            {/* Phone */}
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Patient Mobile *</label>
              <input className="input-field" type="tel" placeholder="10-digit number"
                {...register('patient_phone', {
                  required: 'Phone number is required',
                  pattern: { value: /^\d{10}$/, message: '10 digit number required' },
                })} />
              {errors.patient_phone && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{errors.patient_phone.message as string}</p>}
            </div>

            {/* Language */}
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Language</label>
              <select className="input-field" {...register('language')}>
                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>

            {/* File upload */}
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Upload Prescription Image</label>

              {/* Hidden inputs */}
              <input id="file-camera" type="file" accept="image/*" capture="environment" onChange={handleFile}
                style={{ display: 'none' }} />
              <input id="file-gallery" type="file" accept="image/*,.pdf" onChange={handleFile}
                style={{ display: 'none' }} />

              {!file ? (
                <div style={{ display: 'flex', gap: 10 }}>
                  {/* Take Photo */}
                  <label htmlFor="file-camera" style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 8, padding: '18px 12px', border: '2px dashed var(--border)', borderRadius: 12,
                    cursor: 'pointer', background: 'transparent', transition: 'border-color .15s',
                  }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.8">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--teal)' }}>Take Photo</span>
                    <span style={{ fontSize: 10, color: 'var(--ink-light)', opacity: .7 }}>Use camera</span>
                  </label>

                  {/* Choose from Gallery / File */}
                  <label htmlFor="file-gallery" style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 8, padding: '18px 12px', border: '2px dashed var(--border)', borderRadius: 12,
                    cursor: 'pointer', background: 'transparent', transition: 'border-color .15s',
                  }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--ink-light)" strokeWidth="1.8">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-light)' }}>Gallery / File</span>
                    <span style={{ fontSize: 10, color: 'var(--ink-light)', opacity: .7 }}>JPG, PNG, PDF</span>
                  </label>
                </div>
              ) : (
                <div style={{
                  border: '2px dashed var(--teal)', borderRadius: 12, padding: 16,
                  textAlign: 'center', background: 'var(--teal-light)',
                }}>
                  {preview ? (
                    <img src={preview} alt="Preview" style={{ maxHeight: 180, margin: '0 auto', borderRadius: 8, objectFit: 'contain', display: 'block' }} />
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--teal)' }}>✓ {file.name}</p>
                  )}
                </div>
              )}

              {file && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                  <p style={{ fontSize: 11, color: 'var(--teal)' }}>✓ {file.name}</p>
                  <button type="button"
                    onClick={() => { setFile(null); if (preview) URL.revokeObjectURL(preview); setPreview(null) }}
                    style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label style={lbl}>Doctor's Notes <span style={{ fontWeight: 400 }}>(optional)</span></label>
              <textarea className="input-field" rows={2} style={{ resize: 'none' }}
                placeholder="Any additional instructions…" {...register('notes')} />
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="btn btn-teal"
            style={{ opacity: isSubmitting ? .65 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {isSubmitting ? (
              <>
                <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                Uploading…
              </>
            ) : 'Upload Prescription'}
          </button>
        </form>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  )
}
