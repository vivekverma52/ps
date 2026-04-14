import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import AppShell from '../../components/layout/AppShell'
import { ORG_ADMIN_NAV } from '../../constants/nav'

interface Member {
  id: string
  name: string
  email: string
  role: string
  is_owner: boolean
  is_org_admin: boolean
  role_display_name?: string
  role_color?: string
  created_at: string
}

interface Role {
  id: string
  name: string
  display_name: string
  color: string
}

export default function TeamPage() {
  const { org } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'DOCTOR' })
  const [creating, setCreating] = useState(false)
  const [assigningRole, setAssigningRole] = useState<{ userId: string; name: string } | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState('')

  const loadData = async () => {
    try {
      const [teamRes, rolesRes] = await Promise.all([
        api.get('/organizations/me/team'),
        api.get('/roles'),
      ])
      setMembers(teamRes.data.data.members)
      setRoles(rolesRes.data.data)
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [])

  const createMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      await api.post('/organizations/me/members', createForm)
      toast.success(`${createForm.role === 'PHARMACIST' ? 'Pharmacist' : 'Doctor'} account created!`)
      setCreateForm({ name: '', email: '', password: '', role: 'DOCTOR' })
      loadData()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create account')
    } finally { setCreating(false) }
  }

  const assignRole = async () => {
    if (!assigningRole || !selectedRoleId) return
    try {
      await api.post('/roles/assign', { user_id: assigningRole.userId, role_id: selectedRoleId })
      toast.success(`Role assigned to ${assigningRole.name}`)
      setAssigningRole(null)
      loadData()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed')
    }
  }

  const removeMember = async (memberId: string, name: string) => {
    if (!confirm(`Remove ${name} from your organization?`)) return
    try {
      await api.delete(`/organizations/me/members/${memberId}`)
      toast.success(`${name} removed`)
      loadData()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed')
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', background: 'var(--cream)', border: '1px solid var(--border)', color: 'var(--ink)',
    padding: '9px 12px', borderRadius: 10, fontSize: 13, outline: 'none',
    fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
  }

  const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--ink-light)', marginBottom: 5 }

  const TopRight = org ? (
    <span style={{ fontSize: 12, color: 'var(--ink-light)' }}>
      {org.team_count} members
    </span>
  ) : undefined

  return (
    <AppShell navItems={ORG_ADMIN_NAV} sectionLabel="Admin" topBarRight={TopRight}>
      <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Add member panel */}
        <div className="card" style={{ padding: '20px 22px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>Add Team Member</h2>

          <form onSubmit={createMember} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 12, color: 'var(--ink-light)', marginTop: -4 }}>
                Create a Doctor or Pharmacist account directly — they can log in immediately.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lbl}>Role</label>
                  <select style={inp} value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="DOCTOR">Doctor</option>
                    <option value="PHARMACIST">Pharmacist</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Full Name</label>
                  <input style={inp} placeholder={createForm.role === 'PHARMACIST' ? 'Pharmacist name' : 'Dr. Full Name'}
                    value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label style={lbl}>Email</label>
                <input style={inp} type="email" placeholder="email@hospital.com"
                  value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              <div>
                <label style={lbl}>Password</label>
                <input style={inp} type="password" placeholder="Min 6 characters"
                  value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} required />
              </div>
              <button type="submit" disabled={creating} className="btn btn-teal" style={{ alignSelf: 'flex-start', opacity: creating ? .6 : 1 }}>
                {creating ? 'Creating…' : `Create ${createForm.role === 'PHARMACIST' ? 'Pharmacist' : 'Doctor'} Account`}
              </button>
            </form>
        </div>

        {/* Members list */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Team Members ({members.length})</h2>
          </div>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '36px 0' }}>
              <div style={{ width: 24, height: 24, border: '2px solid var(--teal)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
            </div>
          ) : members.map(m => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 20px', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: m.role_color || 'var(--teal)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{m.name}</span>
                    {m.is_owner && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(245,158,11,.1)', color: '#D97706', fontWeight: 600 }}>Owner</span>}
                    {m.is_org_admin && !m.is_owner && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--teal-light)', color: 'var(--teal-dark)', fontWeight: 600 }}>Admin</span>}
                    {m.role_display_name ? (
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600, color: '#fff', background: m.role_color || 'var(--teal)' }}>
                        {m.role_display_name}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--cell)', color: 'var(--ink-light)', fontWeight: 500 }}>{m.role}</span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--ink-light)' }}>{m.email}</p>
                </div>
              </div>
              {!m.is_owner && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setAssigningRole({ userId: m.id, name: m.name }); setSelectedRoleId('') }}
                    className="btn btn-ghost btn-sm">
                    Assign Role
                  </button>
                  <button onClick={() => removeMember(m.id, m.name)} className="btn btn-danger btn-sm">
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

      </div>

      {/* Assign role modal */}
      {assigningRole && (
        <div className="modal-overlay" onClick={() => setAssigningRole(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Assign Role</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-light)', marginBottom: 14 }}>
              Select a role for <strong style={{ color: 'var(--ink)' }}>{assigningRole.name}</strong>
            </p>
            <select className="input-field" style={{ marginBottom: 18 }}
              value={selectedRoleId} onChange={e => setSelectedRoleId(e.target.value)}>
              <option value="">Select a role…</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.display_name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setAssigningRole(null)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
              <button onClick={assignRole} disabled={!selectedRoleId} className="btn btn-teal" style={{ flex: 1, opacity: !selectedRoleId ? .5 : 1 }}>
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  )
}
