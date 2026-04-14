import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import AppShell from '../components/layout/AppShell'
import { DOCTOR_NAV, PHARMACIST_NAV } from '../constants/nav'

/* ── Doctor nav ── */
/* ── Pharmacist nav ── */
interface Hospital {
  id: string
  name: string
}

interface DoctorProfile {
  id: string
  hospital_id: string | null
  role_id: string | null
  specialization: string | null
  license_number: string | null
  registration_number: string | null
}

interface PharmacistProfile {
  id: string
  hospital_id: string | null
  role_id: string | null
  license_number: string | null
  pharmacy_registration: string | null
}

type DoctorForm = {
  specialization: string
  license_number: string
  registration_number: string
  hospital_id: string
}

type PharmacistForm = {
  license_number: string
  pharmacy_registration: string
  hospital_id: string
}

export default function ProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<DoctorProfile | PharmacistProfile | null>(null)
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const isDoctor = user?.role === 'DOCTOR'
  const isPharmacist = user?.role === 'PHARMACIST'

  const doctorForm = useForm<DoctorForm>()
  const pharmacistForm = useForm<PharmacistForm>()

  useEffect(() => {
    const endpoint = isDoctor
      ? '/profiles/doctors/me'
      : isPharmacist
      ? '/profiles/pharmacists/me'
      : null

    if (!endpoint) {
      setLoading(false)
      return
    }

    Promise.all([
      api.get(endpoint),
      api.get('/organizations/me/hospitals'),
    ])
      .then(([pRes, hRes]) => {
        const p = pRes.data?.data ?? pRes.data
        setProfile(p)
        setHospitals(hRes.data?.data ?? hRes.data ?? [])

        if (isDoctor) {
          const dp = p as DoctorProfile
          doctorForm.reset({
            specialization: dp.specialization || '',
            license_number: dp.license_number || '',
            registration_number: dp.registration_number || '',
            hospital_id: dp.hospital_id || '',
          })
        } else if (isPharmacist) {
          const pp = p as PharmacistProfile
          pharmacistForm.reset({
            license_number: pp.license_number || '',
            pharmacy_registration: pp.pharmacy_registration || '',
            hospital_id: pp.hospital_id || '',
          })
        }
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [])

  const onSaveDoctor = async (data: DoctorForm) => {
    setSaving(true)
    try {
      const payload: Record<string, string | null> = {
        specialization: data.specialization || null,
        license_number: data.license_number || null,
        registration_number: data.registration_number || null,
        hospital_id: data.hospital_id || null,
      }
      await api.put('/profiles/doctors/me', payload)
      toast.success('Profile updated')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const onSavePharmacist = async (data: PharmacistForm) => {
    setSaving(true)
    try {
      const payload: Record<string, string | null> = {
        license_number: data.license_number || null,
        pharmacy_registration: data.pharmacy_registration || null,
        hospital_id: data.hospital_id || null,
      }
      await api.put('/profiles/pharmacists/me', payload)
      toast.success('Profile updated')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const navItems = isPharmacist ? PHARMACIST_NAV : DOCTOR_NAV
  const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--ink-light)', marginBottom: 5 }

  const sectionLabel = isPharmacist ? 'Pharmacist' : undefined

  if (loading) {
    return (
      <AppShell navItems={navItems} sectionLabel={sectionLabel}>
        <div style={{ color: 'var(--ink-light)', fontSize: 13 }}>Loading…</div>
      </AppShell>
    )
  }

  if (!isDoctor && !isPharmacist) {
    return (
      <AppShell navItems={navItems} sectionLabel={sectionLabel}>
        <div style={{ color: 'var(--ink-light)', fontSize: 13 }}>Profile management is not available for your role.</div>
      </AppShell>
    )
  }

  return (
    <AppShell navItems={navItems} sectionLabel={sectionLabel}>
      <div style={{ maxWidth: 520 }}>

        {/* Account info (read-only) */}
        <div className="card" style={{ padding: '20px 22px', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>Account</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <span style={lbl}>Name</span>
              <input className="input-field" readOnly value={user?.name || ''} style={{ background: 'var(--cell)', color: 'var(--ink-light)' }} />
            </div>
            <div>
              <span style={lbl}>Email</span>
              <input className="input-field" readOnly value={user?.email || ''} style={{ background: 'var(--cell)', color: 'var(--ink-light)' }} />
            </div>
            <div>
              <span style={lbl}>Role</span>
              <input className="input-field" readOnly value={user?.role_display_name || user?.role || ''} style={{ background: 'var(--cell)', color: 'var(--ink-light)' }} />
            </div>
          </div>
        </div>

        {/* Doctor profile form */}
        {isDoctor && (
          <form onSubmit={doctorForm.handleSubmit(onSaveDoctor)}>
            <div className="card" style={{ padding: '20px 22px', marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>Doctor Profile</h2>

              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Hospital</label>
                <select className="input-field" {...doctorForm.register('hospital_id')}>
                  <option value="">— Not assigned —</option>
                  {hospitals.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Specialization</label>
                <input className="input-field" placeholder="e.g. Cardiology"
                  {...doctorForm.register('specialization')} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>License Number</label>
                <input className="input-field" placeholder="Medical license number"
                  {...doctorForm.register('license_number')} />
              </div>

              <div>
                <label style={lbl}>Registration Number</label>
                <input className="input-field" placeholder="Medical council registration"
                  {...doctorForm.register('registration_number')} />
              </div>
            </div>

            <button type="submit" disabled={saving} className="btn btn-teal"
              style={{ opacity: saving ? .65 : 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              {saving ? (
                <>
                  <div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                  Saving…
                </>
              ) : 'Save Profile'}
            </button>
          </form>
        )}

        {/* Pharmacist profile form */}
        {isPharmacist && (
          <form onSubmit={pharmacistForm.handleSubmit(onSavePharmacist)}>
            <div className="card" style={{ padding: '20px 22px', marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>Pharmacist Profile</h2>

              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Hospital</label>
                <select className="input-field" {...pharmacistForm.register('hospital_id')}>
                  <option value="">— Not assigned —</option>
                  {hospitals.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>License Number</label>
                <input className="input-field" placeholder="Pharmacist license number"
                  {...pharmacistForm.register('license_number')} />
              </div>

              <div>
                <label style={lbl}>Pharmacy Registration</label>
                <input className="input-field" placeholder="Pharmacy registration number"
                  {...pharmacistForm.register('pharmacy_registration')} />
              </div>
            </div>

            <button type="submit" disabled={saving} className="btn btn-teal"
              style={{ opacity: saving ? .65 : 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              {saving ? (
                <>
                  <div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                  Saving…
                </>
              ) : 'Save Profile'}
            </button>
          </form>
        )}

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  )
}
