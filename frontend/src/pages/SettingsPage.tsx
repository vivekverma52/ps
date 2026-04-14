import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import AppShell from '../components/layout/AppShell'
import { DOCTOR_NAV, PHARMACIST_NAV, ORG_ADMIN_NAV, HOSPITAL_ADMIN_NAV } from '../constants/nav'
import UsageBar from '../components/ui/UsageBar'
import { PlanBadge } from '../components/ui/StatusBadge'

type Tab = 'profile' | 'organization' | 'hospitals' | 'team' | 'billing'

interface Member { id: string; name: string; email: string; role: string; is_owner: boolean }

interface Hospital {
  id: string
  name: string
  status: 'ACTIVE' | 'SUSPENDED'
  phone: string | null
  email: string | null
  // address fields flat from LEFT JOIN
  address_line: string | null
  city: string | null
  state: string | null
  pincode: string | null
}

interface HospitalForm { name: string }
interface AddrForm { address_line: string; city: string; state: string; pincode: string }
interface HospitalCreateForm {
  name: string
  address_line: string; city: string; state: string; pincode: string
  admin_name: string; admin_email: string; admin_password: string
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'organization', label: 'Organization' },
  { id: 'hospitals', label: 'Hospitals' },
  { id: 'team', label: 'Team' },
  { id: 'billing', label: 'Billing' },
]

export default function SettingsPage() {
  const { user, org, refreshOrg } = useAuth()
  const navItems = user?.role === 'HOSPITAL_ADMIN'
    ? HOSPITAL_ADMIN_NAV
    : user?.role === 'ORG_ADMIN'
    ? (user?.hospital_id ? HOSPITAL_ADMIN_NAV : ORG_ADMIN_NAV)
    : user?.role === 'PHARMACIST' ? PHARMACIST_NAV : DOCTOR_NAV
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [members, setMembers] = useState<Member[]>([])
  const [loadingTeam, setLoadingTeam] = useState(false)

  const [hospitals, setHospitals] = useState<Hospital[]>([])
  // Create modal (full)
  const [showHCreate, setShowHCreate] = useState(false)
  const [hCreateForm, setHCreateForm] = useState<HospitalCreateForm>({ name: '', address_line: '', city: '', state: '', pincode: '', admin_name: '', admin_email: '', admin_password: '' })
  const [showAdminPwd, setShowAdminPwd] = useState(false)
  const [hCreating, setHCreating] = useState(false)
  // Edit modal (simple)
  const [hModal, setHModal] = useState<{ open: boolean; editing: Hospital | null }>({ open: false, editing: null })
  const [hForm, setHForm] = useState<HospitalForm>({ name: '' })
  const [hSaving, setHSaving] = useState(false)
  const [addrModal, setAddrModal] = useState<Hospital | null>(null)
  const [addrForm, setAddrForm] = useState<AddrForm>({ address_line: '', city: '', state: '', pincode: '' })
  const [addrSaving, setAddrSaving] = useState(false)

  const profileForm = useForm({ defaultValues: { name: user?.name || '', clinic_name: user?.clinic_name || '' } })
  const orgForm = useForm({ defaultValues: { name: org?.name || '', address: org?.address || '', phone: org?.phone || '', website: org?.website || '' } })

  useEffect(() => {
    if (org) orgForm.reset({ name: org.name, address: org.address || '', phone: org.phone || '', website: org.website || '' })
  }, [org])

  const loadTeam = async () => {
    setLoadingTeam(true)
    try {
      const res = await api.get('/organizations/me/team')
      setMembers(res.data.data.members)
    } catch { toast.error('Failed to load team') }
    finally { setLoadingTeam(false) }
  }

  useEffect(() => { if (activeTab === 'team') loadTeam() }, [activeTab])

  const saveOrg = async (data: any) => {
    try {
      await api.put('/organizations/me', data)
      await refreshOrg()
      toast.success('Organization updated')
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed to update') }
  }

  const removeMember = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from your organization?`)) return
    try { await api.delete(`/organizations/me/members/${id}`); loadTeam(); toast.success(`${name} removed`) }
    catch (err: any) { toast.error(err.response?.data?.message || 'Failed to remove') }
  }

  const loadHospitals = async () => {
    try {
      const res = await api.get('/organizations/me/hospitals')
      setHospitals(res.data?.data ?? res.data ?? [])
    } catch { toast.error('Failed to load hospitals') }
  }

  useEffect(() => { if (activeTab === 'hospitals') loadHospitals() }, [activeTab])

  const openHospitalCreate = () => {
    setHCreateForm({ name: '', address_line: '', city: '', state: '', pincode: '', admin_name: '', admin_email: '', admin_password: '' })
    setShowAdminPwd(false)
    setShowHCreate(true)
  }

  const createHospital = async () => {
    if (!hCreateForm.name.trim())         return toast.error('Hospital name is required')
    if (!hCreateForm.address_line.trim()) return toast.error('Address line is required')
    if (!hCreateForm.city.trim())         return toast.error('City is required')
    if (!hCreateForm.admin_name.trim())   return toast.error('Admin name is required')
    if (!hCreateForm.admin_email.trim())  return toast.error('Admin email is required')
    if (hCreateForm.admin_password.length < 6) return toast.error('Admin password must be at least 6 characters')
    setHCreating(true)
    try {
      await api.post('/organizations/me/hospitals', hCreateForm)
      toast.success('Hospital created')
      setShowHCreate(false)
      loadHospitals()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create hospital')
    } finally {
      setHCreating(false)
    }
  }

  const openHospitalEdit = (h: Hospital) => {
    setHForm({ name: h.name })
    setHModal({ open: true, editing: h })
  }

  const saveHospital = async () => {
    if (!hForm.name.trim()) return toast.error('Hospital name is required')
    setHSaving(true)
    try {
      const payload = { name: hForm.name.trim() }
      if (hModal.editing) {
        await api.put(`/organizations/me/hospitals/${hModal.editing.id}`, payload)
        toast.success('Hospital updated')
      } else {
        await api.post('/organizations/me/hospitals', payload)
        toast.success('Hospital added')
      }
      setHModal({ open: false, editing: null })
      loadHospitals()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save')
    } finally {
      setHSaving(false)
    }
  }

  const toggleHospitalStatus = async (h: Hospital) => {
    try {
      const newStatus = h.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
      await api.put(`/organizations/me/hospitals/${h.id}`, { status: newStatus })
      loadHospitals()
    } catch { toast.error('Failed to update status') }
  }

  const deleteHospital = async (h: Hospital) => {
    if (!confirm(`Delete "${h.name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/organizations/me/hospitals/${h.id}`)
      toast.success('Hospital deleted')
      loadHospitals()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete')
    }
  }

  const openAddrModal = (h: Hospital) => {
    setAddrForm({
      address_line: h.address_line || '',
      city: h.city || '',
      state: h.state || '',
      pincode: h.pincode || '',
    })
    setAddrModal(h)
  }

  const saveAddress = async () => {
    if (!addrModal) return
    setAddrSaving(true)
    try {
      await api.put(`/organizations/me/hospitals/${addrModal.id}/address`, addrForm)
      toast.success('Address saved')
      setAddrModal(null)
      loadHospitals()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save address')
    } finally {
      setAddrSaving(false)
    }
  }

  const upgradePlan = async (plan: string) => {
    try { await api.put('/organizations/me/plan', { plan }); await refreshOrg(); toast.success(`Upgraded to ${plan}`) }
    catch (err: any) { toast.error(err.response?.data?.message || 'Failed to upgrade') }
  }

  const tabStyle = (id: Tab) => ({
    padding: '8px 16px', fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none', cursor: 'pointer',
    fontFamily: 'var(--font-sans)', transition: 'all .12s',
    background: activeTab === id ? 'var(--surface)' : 'none',
    color: activeTab === id ? 'var(--ink)' : 'var(--ink-light)',
    boxShadow: activeTab === id ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
  } as React.CSSProperties)

  return (
    <AppShell navItems={navItems} sectionLabel={
      user?.role === 'HOSPITAL_ADMIN'
        ? 'Hospital'
        : user?.role === 'ORG_ADMIN'
        ? (user?.hospital_id ? 'Hospital' : 'Admin')
        : user?.role === 'PHARMACIST' ? 'Pharmacist' : undefined
    }>
      <div style={{ maxWidth: 720 }}>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--cream-dark)', borderRadius: 10, padding: 3, marginBottom: 24, width: 'fit-content' }}>
          {TABS.map(t => (
            <button key={t.id} style={tabStyle(t.id)} onClick={() => setActiveTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {/* ── Profile ── */}
        {activeTab === 'profile' && (
          <div className="card">
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 20 }}>Profile</h2>
            <form onSubmit={profileForm.handleSubmit(() => toast.success('Profile updated'))}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="label">Full name</label>
                  <input className="input-field" {...profileForm.register('name')} />
                </div>
                <div>
                  <label className="label">Email address</label>
                  <input className="input-field" value={user?.email} readOnly style={{ background: 'var(--cell)', color: 'var(--ink-mid)' }} />
                  <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 4 }}>Email cannot be changed</p>
                </div>
                <div>
                  <label className="label">Role</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--cell)', borderRadius: 8, border: '1.5px solid var(--border-mid)' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--teal-light)', color: 'var(--teal-dark)' }}>{user?.role}</span>
                    {user?.is_owner && (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--warning-bg)', color: 'var(--warning)' }}>Owner</span>
                    )}
                  </div>
                </div>
                {user?.role === 'DOCTOR' && (
                  <div>
                    <label className="label">Clinic name</label>
                    <input className="input-field" {...profileForm.register('clinic_name')} />
                  </div>
                )}
                <div>
                  <button type="submit" className="btn btn-primary">Save changes</button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ── Organization ── */}
        {activeTab === 'organization' && (
          <div className="card">
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 20 }}>Organization</h2>
            {!org ? (
              <p style={{ color: 'var(--ink-light)', fontSize: 13 }}>No organization found.</p>
            ) : (
              <form onSubmit={orgForm.handleSubmit(saveOrg)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label className="label">Organization name</label>
                    <input className="input-field" {...orgForm.register('name', { required: true })} />
                  </div>
                  <div>
                    <label className="label">Address</label>
                    <textarea className="input-field" rows={2} style={{ resize: 'none' }} {...orgForm.register('address')} placeholder="Clinic address" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="label">Phone</label>
                      <input className="input-field" {...orgForm.register('phone')} placeholder="+91 XXXXX XXXXX" />
                    </div>
                    <div>
                      <label className="label">Website</label>
                      <input className="input-field" {...orgForm.register('website')} placeholder="www.yourclinic.com" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button type="submit" className="btn btn-primary" disabled={orgForm.formState.isSubmitting || !user?.is_owner}>
                      Save organization
                    </button>
                    {!user?.is_owner && <p style={{ fontSize: 12, color: 'var(--ink-light)' }}>Only the owner can edit</p>}
                  </div>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── Hospitals ── */}
        {activeTab === 'hospitals' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>Hospitals</h2>
                <p style={{ fontSize: 12, color: 'var(--ink-light)' }}>Manage hospital locations in your organization</p>
              </div>
              {user?.is_owner && (
                <button className="btn btn-teal btn-sm" onClick={openHospitalCreate}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Add Hospital
                </button>
              )}
            </div>

            {hospitals.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '36px 20px' }}>
                <svg style={{ margin: '0 auto 10px', color: 'var(--ink-light)' }} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <line x1="12" y1="3" x2="12" y2="22"/><line x1="3" y1="12" x2="21" y2="12"/>
                </svg>
                <p style={{ fontSize: 13, color: 'var(--ink-light)' }}>No hospitals added yet</p>
                {user?.is_owner && (
                  <button className="btn btn-teal btn-sm" style={{ marginTop: 12 }} onClick={openHospitalCreate}>Add your first hospital</button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {hospitals.map(h => {
                  const addrStr = [h.address_line, h.city, h.state, h.pincode].filter(Boolean).join(', ') || null
                  return (
                    <div key={h.id} className="card" style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{h.name}</span>
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20,
                              background: h.status === 'ACTIVE' ? 'var(--teal-light)' : 'var(--cell)',
                              color: h.status === 'ACTIVE' ? 'var(--teal-dark)' : 'var(--ink-light)',
                            }}>
                              {h.status}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                            {h.phone && <span style={{ fontSize: 12, color: 'var(--ink-light)' }}>{h.phone}</span>}
                            {h.email && <span style={{ fontSize: 12, color: 'var(--ink-light)' }}>{h.email}</span>}
                            {addrStr && <span style={{ fontSize: 12, color: 'var(--ink-light)' }}>{addrStr}</span>}
                          </div>
                        </div>
                        {user?.is_owner && (
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => openAddrModal(h)}>Address</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => openHospitalEdit(h)}>Edit</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => toggleHospitalStatus(h)}
                              style={{ color: h.status === 'ACTIVE' ? 'var(--ink-light)' : 'var(--teal)' }}>
                              {h.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => deleteHospital(h)}>Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Create Hospital Modal (full: info + address + admin credentials) ── */}
        {showHCreate && (
          <div className="modal-overlay" onClick={() => setShowHCreate(false)}>
            <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Add Hospital</h3>
                  <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 3 }}>Hospital details, address and admin account are required</p>
                </div>
                <button onClick={() => setShowHCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-light)', display: 'flex' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Hospital Info */}
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--teal)', margin: 0 }}>Hospital Info</p>
                <div>
                  <label className="label">Hospital Name *</label>
                  <input className="input-field" placeholder="e.g. Apollo Hospital" value={hCreateForm.name}
                    onChange={e => setHCreateForm(f => ({ ...f, name: e.target.value }))} />
                </div>

                {/* Address */}
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--teal)', margin: '6px 0 0' }}>Address *</p>
                <div>
                  <label className="label">Address Line *</label>
                  <input className="input-field" placeholder="Street / Building / Area" value={hCreateForm.address_line}
                    onChange={e => setHCreateForm(f => ({ ...f, address_line: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="label">City *</label>
                    <input className="input-field" placeholder="City" value={hCreateForm.city}
                      onChange={e => setHCreateForm(f => ({ ...f, city: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">State</label>
                    <input className="input-field" placeholder="State" value={hCreateForm.state}
                      onChange={e => setHCreateForm(f => ({ ...f, state: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="label">Pincode</label>
                  <input className="input-field" placeholder="6-digit pincode" value={hCreateForm.pincode}
                    onChange={e => setHCreateForm(f => ({ ...f, pincode: e.target.value }))} />
                </div>

                {/* Admin Credentials */}
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--teal)', margin: '6px 0 0' }}>Admin Account *</p>
                <p style={{ fontSize: 11, color: 'var(--ink-light)', margin: '-8px 0 0' }}>This account will be used by the hospital admin to log in</p>
                <div>
                  <label className="label">Admin Full Name *</label>
                  <input className="input-field" placeholder="Admin full name" value={hCreateForm.admin_name}
                    onChange={e => setHCreateForm(f => ({ ...f, admin_name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Admin Login Email *</label>
                  <input className="input-field" type="email" placeholder="admin@hospital.com" value={hCreateForm.admin_email}
                    onChange={e => setHCreateForm(f => ({ ...f, admin_email: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Admin Password *</label>
                  <div style={{ position: 'relative' }}>
                    <input className="input-field" type={showAdminPwd ? 'text' : 'password'}
                      placeholder="Min 6 characters" value={hCreateForm.admin_password}
                      style={{ paddingRight: 40 }}
                      onChange={e => setHCreateForm(f => ({ ...f, admin_password: e.target.value }))} />
                    <button type="button" onClick={() => setShowAdminPwd(p => !p)} style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-light)', display: 'flex', padding: 2,
                    }}>
                      {showAdminPwd
                        ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowHCreate(false)}>Cancel</button>
                  <button className="btn btn-teal" style={{ flex: 1, opacity: hCreating ? .65 : 1 }} disabled={hCreating} onClick={createHospital}>
                    {hCreating ? 'Creating…' : 'Create Hospital'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit Hospital Modal (simple) ── */}
        {hModal.open && (
          <div className="modal-overlay" onClick={() => setHModal({ open: false, editing: null })}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Edit Hospital</h3>
                <button onClick={() => setHModal({ open: false, editing: null })}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-light)', display: 'flex' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="label">Hospital Name *</label>
                  <input className="input-field" placeholder="e.g. Main Branch" value={hForm.name}
                    onChange={e => setHForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setHModal({ open: false, editing: null })}>Cancel</button>
                  <button className="btn btn-teal" style={{ flex: 1, opacity: hSaving ? .65 : 1 }} disabled={hSaving} onClick={saveHospital}>
                    {hSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Address Modal ── */}
        {addrModal && (
          <div className="modal-overlay" onClick={() => setAddrModal(null)}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Address — {addrModal.name}</h3>
                <button onClick={() => setAddrModal(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-light)', display: 'flex' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="label">Address Line</label>
                  <input className="input-field" placeholder="Street / building" value={addrForm.address_line}
                    onChange={e => setAddrForm(f => ({ ...f, address_line: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="label">City</label>
                    <input className="input-field" placeholder="City" value={addrForm.city}
                      onChange={e => setAddrForm(f => ({ ...f, city: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">State</label>
                    <input className="input-field" placeholder="State" value={addrForm.state}
                      onChange={e => setAddrForm(f => ({ ...f, state: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="label">Pincode</label>
                  <input className="input-field" placeholder="6-digit pincode" value={addrForm.pincode}
                    onChange={e => setAddrForm(f => ({ ...f, pincode: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setAddrModal(null)}>Cancel</button>
                  <button className="btn btn-teal" style={{ flex: 1, opacity: addrSaving ? .65 : 1 }} disabled={addrSaving} onClick={saveAddress}>
                    {addrSaving ? 'Saving…' : 'Save Address'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Team ── */}
        {activeTab === 'team' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div className="card">
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>Members</h2>
              {loadingTeam ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ width: 24, height: 24, border: '2px solid var(--teal)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {members.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--cream)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal-dark)' }}>{m.name.charAt(0)}</span>
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{m.name}</p>
                            {m.is_owner && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 999, background: 'var(--warning-bg)', color: 'var(--warning)' }}>OWNER</span>}
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 999, background: 'var(--teal-light)', color: 'var(--teal-dark)' }}>{m.role}</span>
                          </div>
                          <p style={{ fontSize: 11, color: 'var(--ink-light)' }}>{m.email}</p>
                        </div>
                      </div>
                      {user?.is_owner && !m.is_owner && (
                        <button className="btn btn-danger btn-sm" onClick={() => removeMember(m.id, m.name)}>Remove</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ── Billing ── */}
        {activeTab === 'billing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Current plan</h2>
                {org?.plan && <PlanBadge plan={org.plan} />}
              </div>
              {org && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div style={{ padding: '14px 16px', background: 'var(--cell)', borderRadius: 10 }}>
                      <p style={{ fontSize: 11, color: 'var(--ink-light)', marginBottom: 6 }}>Prescriptions this month</p>
                      <p style={{ fontSize: 24, fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1 }}>{org.usage_this_month || 0}</p>
                      <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 2 }}>of {org.prescription_limit >= 99999 ? '∞' : org.prescription_limit}</p>
                    </div>
                    <div style={{ padding: '14px 16px', background: 'var(--cell)', borderRadius: 10 }}>
                      <p style={{ fontSize: 11, color: 'var(--ink-light)', marginBottom: 6 }}>Team members</p>
                      <p style={{ fontSize: 24, fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1 }}>{org.team_count || 0}</p>
                      <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 2 }}>of {org.team_limit >= 999 ? '∞' : org.team_limit}</p>
                    </div>
                  </div>
                  {org.prescription_limit < 99999 && (
                    <UsageBar used={org.usage_this_month || 0} limit={org.prescription_limit} label="Usage" />
                  )}
                </>
              )}
            </div>

            {org && org.plan !== 'ENTERPRISE' && user?.is_owner && (
              <div className="card">
                <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>Upgrade plan</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {org.plan === 'FREE' && (
                    <div style={{ border: '1.5px solid var(--border-mid)', borderRadius: 12, padding: '18px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                        <p style={{ fontWeight: 600, color: 'var(--ink)' }}>Pro</p>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--info)' }}>₹999/mo</p>
                      </div>
                      {['200 prescriptions/month', '10 team members', 'Priority support'].map(f => (
                        <p key={f} style={{ fontSize: 12, color: 'var(--ink-light)', marginBottom: 6, display: 'flex', gap: 6 }}>
                          <span style={{ color: 'var(--teal)' }}>✓</span> {f}
                        </p>
                      ))}
                      <button className="btn btn-primary" style={{ width: '100%', marginTop: 14 }} onClick={() => upgradePlan('PRO')}>Upgrade to Pro</button>
                    </div>
                  )}
                  <div style={{ border: '1.5px solid var(--ink)', borderRadius: 12, padding: '18px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                      <p style={{ fontWeight: 600, color: 'var(--ink)' }}>Enterprise</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>₹2,999/mo</p>
                    </div>
                    {['Unlimited prescriptions', 'Unlimited team', 'Dedicated SLA support'].map(f => (
                      <p key={f} style={{ fontSize: 12, color: 'var(--ink-light)', marginBottom: 6, display: 'flex', gap: 6 }}>
                        <span style={{ color: 'var(--teal)' }}>✓</span> {f}
                      </p>
                    ))}
                    <button className="btn btn-primary" style={{ width: '100%', marginTop: 14 }} onClick={() => upgradePlan('ENTERPRISE')}>Upgrade to Enterprise</button>
                  </div>
                </div>
                <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 12 }}>* Plan upgrades are instant for demo. Contact sales for billing setup.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  )
}
