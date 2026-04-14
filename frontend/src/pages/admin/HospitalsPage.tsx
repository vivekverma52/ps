import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../services/api'
import AppShell from '../../components/layout/AppShell'
import { ORG_ADMIN_NAV } from '../../constants/nav'

interface Hospital {
  id: string
  name: string
  slug: string
  status: 'ACTIVE' | 'SUSPENDED'
  created_at: string | null
  email: string | null
  address_line1: string | null
  city: string | null
  state: string | null
  pincode: string | null
}

const EMPTY_FORM = { name: '' }
const EMPTY_ADDR = { address_line1: '', city: '', state: '', pincode: '' }
const EMPTY_CREATE = {
  name: '',
  address_line1: '', city: '', state: '', pincode: '',
  admin_name: '', admin_email: '', admin_password: '',
}

export default function HospitalsPage() {
  const navigate = useNavigate()
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [loading, setLoading] = useState(true)

  // Create modal (full form with address + credentials)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_CREATE)
  const [showAdminPwd, setShowAdminPwd] = useState(false)
  const [creating, setCreating] = useState(false)

  // Edit modal (simple — name/phone/email only)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Hospital | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Address modal
  const [addrHospital, setAddrHospital] = useState<Hospital | null>(null)
  const [addr, setAddr] = useState(EMPTY_ADDR)
  const [savingAddr, setSavingAddr] = useState(false)

  const fetchHospitals = async () => {
    setLoading(true)
    try {
      const res = await api.get('/organizations/me/hospitals')
      setHospitals(res.data?.data ?? res.data ?? [])
    } catch {
      toast.error('Failed to load hospitals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchHospitals() }, [])

  const openCreate = () => {
    setCreateForm(EMPTY_CREATE)
    setShowAdminPwd(false)
    setShowCreate(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      await api.post('/organizations/me/hospitals', createForm)
      toast.success('Hospital created')
      setShowCreate(false)
      fetchHospitals()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create hospital')
    } finally {
      setCreating(false)
    }
  }

  const openEdit = (h: Hospital) => {
    setEditing(h)
    setForm({ name: h.name })
    setShowModal(true)
  }

  const openAddr = (h: Hospital) => {
    setAddrHospital(h)
    setAddr({
      address_line1: h.address_line1 ?? '',
      city: h.city ?? '',
      state: h.state ?? '',
      pincode: h.pincode ?? '',
    })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { name: form.name }
      await api.put(`/organizations/me/hospitals/${editing!.id}`, payload)
      toast.success('Hospital updated')
      setShowModal(false)
      fetchHospitals()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAddr = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addrHospital) return
    setSavingAddr(true)
    try {
      const payload = {
        address_line1: addr.address_line1 || undefined,
        city: addr.city || undefined,
        state: addr.state || undefined,
        pincode: addr.pincode || undefined,
      }
      await api.put(`/organizations/me/hospitals/${addrHospital.id}/address`, payload)
      toast.success('Address saved')
      setAddrHospital(null)
      fetchHospitals()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save address')
    } finally {
      setSavingAddr(false)
    }
  }

  const toggleStatus = async (h: Hospital) => {
    const newStatus = h.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    try {
      await api.put(`/organizations/me/hospitals/${h.id}`, { status: newStatus })
      toast.success(`${h.name} ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}`)
      fetchHospitals()
    } catch {
      toast.error('Failed to update status')
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', background: 'var(--cream)', border: '1px solid var(--border)', color: 'var(--ink)',
    padding: '9px 12px', borderRadius: 10, fontSize: 13, outline: 'none',
    fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--ink-light)', marginBottom: 5 }

  const AddBtn = (
    <button className="btn btn-teal btn-sm" onClick={openCreate}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Add Hospital
    </button>
  )

  return (
    <AppShell navItems={ORG_ADMIN_NAV} sectionLabel="Admin" topBarRight={AddBtn}>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ width: 26, height: 26, border: '2px solid var(--teal)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
        </div>
      ) : hospitals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.8">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', marginBottom: 4 }}>No hospitals yet</p>
          <p style={{ fontSize: 12, color: 'var(--ink-light)', marginBottom: 16 }}>Add a hospital to assign your doctors and pharmacists</p>
          <button className="btn btn-teal btn-sm" onClick={openCreate}>Add your first hospital</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {hospitals.map(h => {
            const isActive = h.status === 'ACTIVE'
            const addrParts = [h.address_line1, h.city, h.state, h.pincode].filter(Boolean)
            const createdDate = h.created_at ? new Date(h.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null

            return (
              <div key={h.id} className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Status bar accent */}
                <div style={{ height: 3, background: isActive ? 'var(--teal)' : 'var(--border)', borderRadius: '12px 12px 0 0' }} />

                <div style={{ padding: '18px 20px 0', display: 'flex', flexDirection: 'column', flex: 1 }}>

                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                        background: isActive ? 'var(--teal-light)' : 'var(--cream-dark)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isActive ? 'var(--teal)' : 'var(--ink-light)'} strokeWidth="1.8">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                          <line x1="9" y1="22" x2="9" y2="12"/><line x1="15" y1="12" x2="15" y2="22"/>
                        </svg>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', margin: 0, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {h.name}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, letterSpacing: .4,
                            background: isActive ? 'rgba(16,185,129,.12)' : 'rgba(107,114,128,.1)',
                            color: isActive ? '#059669' : 'var(--ink-light)',
                          }}>
                            {isActive ? '● ACTIVE' : '○ SUSPENDED'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, marginLeft: 8 }}>
                      <button title="Edit name" onClick={() => openEdit(h)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 7, borderRadius: 8,
                        color: 'var(--ink-light)', display: 'flex', transition: 'background .15s, color .15s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--cream-dark)'; e.currentTarget.style.color = 'var(--ink)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--ink-light)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button title="Update address" onClick={() => openAddr(h)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 7, borderRadius: 8,
                        color: 'var(--ink-light)', display: 'flex', transition: 'background .15s, color .15s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--cream-dark)'; e.currentTarget.style.color = 'var(--ink)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--ink-light)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Info rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, flex: 1 }}>
                    {/* Address */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--cream-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-light)" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                        </svg>
                      </div>
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-light)', margin: '0 0 1px', textTransform: 'uppercase', letterSpacing: .4 }}>Address</p>
                        {addrParts.length > 0 ? (
                          <p style={{ fontSize: 12.5, color: 'var(--ink)', margin: 0, lineHeight: 1.5 }}>
                            {addrParts.join(', ')}
                          </p>
                        ) : (
                          <p style={{ fontSize: 12, color: 'var(--ink-light)', margin: 0, fontStyle: 'italic' }}>Not added yet</p>
                        )}
                      </div>
                    </div>

                    {/* Email */}
                    {h.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--cream-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-light)" strokeWidth="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                          </svg>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-light)', margin: '0 0 1px', textTransform: 'uppercase', letterSpacing: .4 }}>Email</p>
                          <p style={{ fontSize: 12.5, color: 'var(--ink)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.email}</p>
                        </div>
                      </div>
                    )}

                    {/* Created date */}
                    {createdDate && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--cream-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-light)" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                          </svg>
                        </div>
                        <div>
                          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-light)', margin: '0 0 1px', textTransform: 'uppercase', letterSpacing: .4 }}>Added on</p>
                          <p style={{ fontSize: 12.5, color: 'var(--ink)', margin: 0 }}>{createdDate}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border)', padding: '12px 20px 16px' }}>
                  <button className="btn btn-teal btn-sm" style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => navigate(`/admin/hospitals/${h.id}`)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    View Staff
                  </button>
                  <button onClick={() => toggleStatus(h)} style={{
                    border: `1px solid ${isActive ? 'var(--border)' : 'rgba(16,185,129,.3)'}`,
                    borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    color: isActive ? 'var(--ink-light)' : 'var(--teal)',
                    background: isActive ? 'none' : 'rgba(16,185,129,.06)',
                    fontFamily: 'var(--font-sans)', transition: 'all .15s',
                  }}>
                    {isActive ? 'Suspend' : 'Activate'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && hospitals.length > 0 && (
        <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 10, textAlign: 'right' }}>
          {hospitals.length} hospital{hospitals.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* ── Create Hospital Modal (full: hospital + address + admin credentials) ── */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 className="modal-title" style={{ margin: 0 }}>Add Hospital</h2>
                <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 3 }}>Hospital details, address and admin account are required</p>
              </div>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-light)', display: 'flex' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Section: Hospital Info */}
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--teal)', margin: 0 }}>Hospital Info</p>
              <div>
                <label style={lbl}>Hospital Name *</label>
                <input style={inp} placeholder="e.g. Apollo Hospital" value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} required />
              </div>

              {/* Section: Address */}
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--teal)', margin: 0, marginTop: 4 }}>Address *</p>
              <div>
                <label style={lbl}>Address Line *</label>
                <input style={inp} placeholder="Street / Building / Area" value={createForm.address_line1}
                  onChange={e => setCreateForm(f => ({ ...f, address_line1: e.target.value }))} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>City *</label>
                  <input style={inp} placeholder="City" value={createForm.city}
                    onChange={e => setCreateForm(f => ({ ...f, city: e.target.value }))} required />
                </div>
                <div>
                  <label style={lbl}>State</label>
                  <input style={inp} placeholder="State" value={createForm.state}
                    onChange={e => setCreateForm(f => ({ ...f, state: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={lbl}>Pincode</label>
                <input style={inp} placeholder="6-digit pincode" value={createForm.pincode}
                  onChange={e => setCreateForm(f => ({ ...f, pincode: e.target.value }))} />
              </div>

              {/* Section: Admin Credentials */}
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--teal)', margin: 0, marginTop: 4 }}>Admin Account *</p>
              <p style={{ fontSize: 11, color: 'var(--ink-light)', margin: '-10px 0 0' }}>These credentials will be used by the hospital admin to log in</p>
              <div>
                <label style={lbl}>Admin Full Name *</label>
                <input style={inp} placeholder="Admin full name" value={createForm.admin_name}
                  onChange={e => setCreateForm(f => ({ ...f, admin_name: e.target.value }))} required />
              </div>
              <div>
                <label style={lbl}>Admin Email (Login) *</label>
                <input style={inp} type="email" placeholder="admin@hospital.com" value={createForm.admin_email}
                  onChange={e => setCreateForm(f => ({ ...f, admin_email: e.target.value }))} required />
              </div>
              <div>
                <label style={lbl}>Admin Password *</label>
                <div style={{ position: 'relative' }}>
                  <input style={{ ...inp, paddingRight: 40 }}
                    type={showAdminPwd ? 'text' : 'password'}
                    placeholder="Min 6 characters" value={createForm.admin_password}
                    onChange={e => setCreateForm(f => ({ ...f, admin_password: e.target.value }))} required />
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

              <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                <button type="button" onClick={() => setShowCreate(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={creating} className="btn btn-teal" style={{ flex: 1, opacity: creating ? .6 : 1 }}>
                  {creating ? 'Creating…' : 'Create Hospital'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Hospital Modal (simple — name/phone/email only) ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 className="modal-title" style={{ margin: 0 }}>Edit Hospital</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-light)', display: 'flex' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>Hospital Name *</label>
                <input style={inp} placeholder="e.g. Apollo Hospital, Sector 26"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-teal" style={{ flex: 1, opacity: saving ? .6 : 1 }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Address Modal */}
      {addrHospital && (
        <div className="modal-overlay" onClick={() => setAddrHospital(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 className="modal-title" style={{ margin: 0 }}>Update Address</h2>
              <button onClick={() => setAddrHospital(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-light)', display: 'flex' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-light)', marginBottom: 16 }}>
              Address for <strong style={{ color: 'var(--ink)' }}>{addrHospital.name}</strong>
            </p>
            <form onSubmit={handleSaveAddr} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={lbl}>Address Line</label>
                <input style={inp} placeholder="Street / Building / Area"
                  value={addr.address_line1} onChange={e => setAddr(a => ({ ...a, address_line1: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>City</label>
                  <input style={inp} placeholder="City"
                    value={addr.city} onChange={e => setAddr(a => ({ ...a, city: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>State</label>
                  <input style={inp} placeholder="State"
                    value={addr.state} onChange={e => setAddr(a => ({ ...a, state: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={lbl}>Pincode</label>
                <input style={inp} placeholder="6-digit pincode"
                  value={addr.pincode} onChange={e => setAddr(a => ({ ...a, pincode: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                <button type="button" onClick={() => setAddrHospital(null)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={savingAddr} className="btn btn-teal" style={{ flex: 1, opacity: savingAddr ? .6 : 1 }}>
                  {savingAddr ? 'Saving…' : 'Save Address'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  )
}
