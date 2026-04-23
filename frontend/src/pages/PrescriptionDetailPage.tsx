import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../services/api'
import AppShell from '../components/layout/AppShell'
import { DOCTOR_NAV } from '../constants/nav'
import { StatusBadge } from '../components/ui/StatusBadge'
import { langLabel } from '../utils/language'

interface Prescription {
  id: string
  doctor_name: string
  patient_name: string
  patient_phone: string
  language: string
  image_url?: string
  access_token: string
  status: string
  notes?: string
  created_at: string
}

const STATUS_INFO: Record<string, string> = {
  UPLOADED: 'Your prescription has been uploaded. The pharmacist will add medicines and dispatch it to the patient.',
  RENDERED: 'Prescription rendered. Waiting for pharmacist to send to patient.',
  SENT:     'Prescription has been sent to the patient via WhatsApp.',
}

export default function PrescriptionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [prescription, setPrescription] = useState<Prescription | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [saving, setSaving] = useState(false)

  const startEdit = () => {
    setEditName(prescription?.patient_name ?? '')
    setEditPhone(prescription?.patient_phone ?? '')
    setEditing(true)
  }

  const cancelEdit = () => setEditing(false)

  const saveEdit = async () => {
    if (!editName.trim()) { toast.error('Patient name is required'); return }
    setSaving(true)
    try {
      const res = await api.put(`/prescriptions/${id}/patient-details`, {
        patient_name:  editName.trim(),
        patient_phone: editPhone.trim(),
      })
      setPrescription(prev => prev ? { ...prev, ...res.data.data } : prev)
      setEditing(false)
      toast.success('Patient details updated')
    } catch {
      toast.error('Failed to update patient details')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    api.get(`/prescriptions/${id}`)
      .then(res => setPrescription(res.data.data))
      .catch(() => { toast.error('Failed to load prescription'); navigate(-1) })
      .finally(() => setLoading(false))
  }, [id])

  const TopRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {prescription && <StatusBadge status={prescription.status} />}
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/prescriptions')}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        Back
      </button>
    </div>
  )

  if (loading) {
    return (
      <AppShell navItems={DOCTOR_NAV} topBarRight={TopRight}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <div style={{ width: 28, height: 28, border: '2px solid var(--teal)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </AppShell>
    )
  }

  if (!prescription) return null

  return (
    <AppShell navItems={DOCTOR_NAV} topBarRight={TopRight}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Prescription image */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--ink-light)', marginBottom: 12 }}>
            Prescription Image
          </p>
          {prescription.image_url ? (
            <img src={prescription.image_url} alt="Prescription"
              style={{ width: '100%', borderRadius: 10, objectFit: 'contain', maxHeight: 340, background: 'var(--cell)', border: '1px solid var(--border)' }} />
          ) : (
            <div style={{
              height: 220, background: 'var(--cell)', borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px dashed var(--border)',
            }}>
              <p style={{ fontSize: 13, color: 'var(--ink-light)' }}>No image uploaded</p>
            </div>
          )}
          {prescription.notes && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--warning-bg)', borderRadius: 8, border: '1px solid rgba(217,119,6,.15)' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--warning)', marginBottom: 4 }}>Doctor's Notes</p>
              <p style={{ fontSize: 12, color: 'var(--ink)' }}>{prescription.notes}</p>
            </div>
          )}
        </div>

        {/* Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Patient info */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--ink-light)' }}>
                Patient Details
              </p>
              {!editing && (
                <button onClick={startEdit} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: 'var(--teal)', background: 'var(--teal-light)', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit
                </button>
              )}
            </div>

            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <p style={{ fontSize: 10, color: 'var(--ink-light)', marginBottom: 4 }}>Patient Name</p>
                  <input
                    className="input-field"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Patient name"
                    autoFocus
                  />
                </div>
                <div>
                  <p style={{ fontSize: 10, color: 'var(--ink-light)', marginBottom: 4 }}>Mobile Number</p>
                  <input
                    className="input-field"
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    type="tel"
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                  <button className="btn btn-teal btn-sm" onClick={saveEdit} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={cancelEdit} disabled={saving}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    ['Doctor',   `Dr. ${prescription.doctor_name}`],
                    ['Patient',  prescription.patient_name],
                    ['Mobile',   prescription.patient_phone || '—'],
                    ['Language', langLabel(prescription.language)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p style={{ fontSize: 10, color: 'var(--ink-light)', marginBottom: 4 }}>{label}</p>
                      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', background: 'var(--cell)', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 10 }}>
                  {new Date(prescription.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </>
            )}
          </div>

          {/* Status info */}
          <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--teal-light)', border: '1px solid rgba(0,184,148,.15)' }}>
            <p style={{ fontSize: 12, color: 'var(--teal-dark)', lineHeight: 1.55 }}>
              {STATUS_INFO[prescription.status] ?? prescription.status}
            </p>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  )
}
