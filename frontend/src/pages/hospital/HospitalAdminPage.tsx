import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import AppShell from '../../components/layout/AppShell'
import { HOSPITAL_ADMIN_NAV } from '../../constants/nav'

interface Hospital {
  id: string
  name: string
  status: 'ACTIVE' | 'SUSPENDED'
  address_line: string | null
  city: string | null
  state: string | null
  pincode: string | null
}

interface StaffMember {
  id: string
  name: string
  email: string
  profile_type: 'DOCTOR' | 'PHARMACIST'
  role_display_name: string | null
  role_color: string | null
  specialization?: string | null
  license_number?: string | null
}

interface StaffData {
  doctors: StaffMember[]
  pharmacists: StaffMember[]
}

const EMPTY_FORM = { name: '', email: '', password: '', role: 'DOCTOR' as 'DOCTOR' | 'PHARMACIST' }

export default function HospitalAdminPage() {
  const { user } = useAuth()
  const hospitalId = user?.hospital_id

  const [hospital, setHospital] = useState<Hospital | null>(null)
  const [staff, setStaff] = useState<StaffData>({ doctors: [], pharmacists: [] })
  const [tab, setTab] = useState<'doctors' | 'pharmacists'>('doctors')
  const [loading, setLoading] = useState(true)

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const fetchData = () => {
    if (!hospitalId) return
    Promise.all([
      api.get(`/organizations/me/hospitals/${hospitalId}`),
      api.get(`/organizations/me/hospitals/${hospitalId}/staff`),
    ])
      .then(([hRes, sRes]) => {
        setHospital(hRes.data?.data ?? hRes.data)
        const staffData = sRes.data?.data ?? sRes.data
        setStaff(staffData ?? { doctors: [], pharmacists: [] })
      })
      .catch(() => toast.error('Failed to load hospital data'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [hospitalId])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createForm.name.trim()) return toast.error('Name is required')
    if (!createForm.email.trim()) return toast.error('Email is required')
    if (createForm.password.length < 6) return toast.error('Password must be at least 6 characters')
    setCreating(true)
    try {
      await api.post(`/organizations/me/hospitals/${hospitalId}/members`, createForm)
      toast.success(`${createForm.role === 'DOCTOR' ? 'Doctor' : 'Pharmacist'} added successfully`)
      setShowCreate(false)
      setCreateForm(EMPTY_FORM)
      fetchData()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add member')
    } finally {
      setCreating(false)
    }
  }

  const handleRemove = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from this hospital?`)) return
    try {
      await api.delete(`/organizations/me/hospitals/${hospitalId}/staff/${userId}`)
      toast.success(`${name} removed`)
      fetchData()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to remove')
    }
  }

  const tabActive: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, color: 'var(--teal)',
    background: 'none', border: 'none', borderBottom: '2px solid var(--teal)',
    paddingBottom: 10, cursor: 'pointer', marginRight: 20,
  }
  const tabInactive: React.CSSProperties = {
    fontSize: 13, fontWeight: 500, color: 'var(--ink-light)',
    background: 'none', border: 'none', borderBottom: '2px solid transparent',
    paddingBottom: 10, cursor: 'pointer', marginRight: 20,
  }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 500, color: 'var(--ink-light)', display: 'block', marginBottom: 3 }
  const val: React.CSSProperties = { fontSize: 13, color: 'var(--ink)', fontWeight: 500 }

  if (loading) {
    return (
      <AppShell navItems={HOSPITAL_ADMIN_NAV} sectionLabel="Hospital">
        <div style={{ color: 'var(--ink-light)', fontSize: 13 }}>Loading…</div>
      </AppShell>
    )
  }

  if (!hospitalId || !hospital) {
    return (
      <AppShell navItems={HOSPITAL_ADMIN_NAV} sectionLabel="Hospital">
        <div style={{ color: 'var(--danger)', fontSize: 13 }}>Hospital not found. Please contact your administrator.</div>
      </AppShell>
    )
  }

  const currentList = tab === 'doctors' ? staff.doctors : staff.pharmacists
  const addrStr = [hospital.address_line, hospital.city, hospital.state, hospital.pincode].filter(Boolean).join(', ')
  const statusBadge = hospital.status === 'ACTIVE'
    ? { background: 'var(--teal-light)', color: 'var(--teal-dark)' }
    : { background: 'var(--cell)', color: 'var(--ink-light)' }

  return (
    <AppShell navItems={HOSPITAL_ADMIN_NAV} sectionLabel="Hospital">
      <div style={{ maxWidth: 800 }}>

        {/* Hospital info */}
        <div className="card" style={{ padding: '20px 22px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{hospital.name}</h2>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, ...statusBadge }}>
              {hospital.status}
            </span>
          </div>
          {addrStr && (
            <div>
              <span style={lbl}>Address</span>
              <span style={val}>{addrStr}</span>
            </div>
          )}
        </div>

        {/* Staff */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 22px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex' }}>
                <button style={tab === 'doctors' ? tabActive : tabInactive} onClick={() => setTab('doctors')}>
                  Doctors ({staff.doctors.length})
                </button>
                <button style={tab === 'pharmacists' ? tabActive : tabInactive} onClick={() => setTab('pharmacists')}>
                  Pharmacists ({staff.pharmacists.length})
                </button>
              </div>
              <div style={{ marginBottom: 10 }}>
                <button className="btn btn-teal btn-sm" onClick={() => {
                  setCreateForm({ ...EMPTY_FORM, role: tab === 'doctors' ? 'DOCTOR' : 'PHARMACIST' })
                  setShowCreate(true)
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Add {tab === 'doctors' ? 'Doctor' : 'Pharmacist'}
                </button>
              </div>
            </div>
          </div>

          {currentList.length === 0 ? (
            <div style={{ padding: '32px 22px', textAlign: 'center', color: 'var(--ink-light)', fontSize: 13 }}>
              No {tab} assigned yet.
              <div style={{ marginTop: 12 }}>
                <button className="btn btn-teal btn-sm" onClick={() => {
                  setCreateForm({ ...EMPTY_FORM, role: tab === 'doctors' ? 'DOCTOR' : 'PHARMACIST' })
                  setShowCreate(true)
                }}>
                  Add {tab === 'doctors' ? 'doctor' : 'pharmacist'}
                </button>
              </div>
            </div>
          ) : (
            <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  {tab === 'doctors' && <th>Specialization</th>}
                  <th>License No.</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {currentList.map(member => (
                  <tr key={member.id}>
                    <td style={{ fontWeight: 500, color: 'var(--ink)' }}>{member.name}</td>
                    <td style={{ color: 'var(--ink-light)' }}>{member.email}</td>
                    {tab === 'doctors' && (
                      <td style={{ color: 'var(--ink-light)' }}>{member.specialization || '—'}</td>
                    )}
                    <td style={{ color: 'var(--ink-light)', fontFamily: 'monospace', fontSize: 12 }}>
                      {member.license_number || '—'}
                    </td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => handleRemove(member.id, member.name)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

      </div>

      {/* Add Member Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                  Add {createForm.role === 'DOCTOR' ? 'Doctor' : 'Pharmacist'}
                </h3>
                <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 3 }}>
                  Will be added to <strong>{hospital.name}</strong>
                </p>
              </div>
              <button onClick={() => setShowCreate(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-light)', display: 'flex' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Role toggle */}
              <div style={{ display: 'flex', gap: 6, padding: 4, background: 'var(--cream-dark)', borderRadius: 8 }}>
                {(['DOCTOR', 'PHARMACIST'] as const).map(r => (
                  <button key={r} type="button"
                    onClick={() => setCreateForm(f => ({ ...f, role: r }))}
                    style={{
                      flex: 1, padding: '7px 0', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                      background: createForm.role === r ? 'var(--surface)' : 'none',
                      color: createForm.role === r ? 'var(--ink)' : 'var(--ink-light)',
                      boxShadow: createForm.role === r ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                    }}>
                    {r === 'DOCTOR' ? 'Doctor' : 'Pharmacist'}
                  </button>
                ))}
              </div>

              <div>
                <label className="label">Full Name *</label>
                <input className="input-field" placeholder="Full name" value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} required />
              </div>

              <div>
                <label className="label">Email *</label>
                <input className="input-field" type="email" placeholder="email@hospital.com" value={createForm.email}
                  onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} required />
              </div>

              <div>
                <label className="label">Password *</label>
                <div style={{ position: 'relative' }}>
                  <input className="input-field" type={showPassword ? 'text' : 'password'}
                    placeholder="Min 6 characters" value={createForm.password}
                    onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                    style={{ paddingRight: 40 }} required />
                  <button type="button" onClick={() => setShowPassword(p => !p)}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-light)', display: 'flex', padding: 2,
                    }}>
                    {showPassword
                      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 4 }}>
                  Share these credentials with the staff member so they can log in.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }}
                  onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-teal" style={{ flex: 1, opacity: creating ? .65 : 1 }}
                  disabled={creating}>
                  {creating ? 'Adding…' : `Add ${createForm.role === 'DOCTOR' ? 'Doctor' : 'Pharmacist'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
