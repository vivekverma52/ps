import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useSuperAdmin } from '../../context/SuperAdminContext'

export default function SuperAdminLoginPage() {
  const { login, theme, toggleTheme } = useSuperAdmin()
  const navigate = useNavigate()
  const dark = theme === 'dark'

  const t = {
    page:        dark ? 'var(--dark)'        : 'var(--cream)',
    card:        dark ? 'var(--dark-mid)'    : 'var(--surface)',
    cardBorder:  dark ? 'var(--dark-border)' : 'var(--border)',
    inputBg:     dark ? 'var(--dark)'        : 'var(--cream)',
    inputBorder: dark ? 'var(--dark-border)' : 'var(--border)',
    textPrimary: dark ? '#F1F5F9'            : 'var(--ink)',
    textSub:     dark ? '#94A3B8'            : 'var(--ink-light)',
    textMuted:   dark ? '#64748B'            : 'var(--ink-light)',
  }

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return toast.error('Enter credentials')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/superadmin/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.textPrimary,
    padding: '11px 14px', borderRadius: 10, fontSize: 13, outline: 'none',
    fontFamily: 'var(--font-sans)', boxSizing: 'border-box', transition: 'border-color .15s',
  }

  return (
    <div style={{ minHeight: '100vh', background: t.page, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s' }}>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        title={dark ? 'Switch to light' : 'Switch to dark'}
        style={{
          position: 'fixed', top: 16, right: 16, width: 34, height: 34, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          background: t.card, border: `1px solid ${t.cardBorder}`,
        }}
      >
        {dark ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textSub} strokeWidth="2">
            <circle cx="12" cy="12" r="5"/>
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textSub} strokeWidth="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        )}
      </button>

      <div style={{ width: '100%', maxWidth: 400, padding: '0 20px' }}>
        {/* Logo / heading */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16, background: 'linear-gradient(135deg,#6366F1,#4F46E5)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 style={{
            fontSize: 26, fontWeight: 700, color: t.textPrimary, marginBottom: 5,
            fontFamily: 'var(--font-sans)',
          }}>
            Exato Admin
          </h1>
          <p style={{ fontSize: 13, color: t.textSub }}>Platform Superadmin Portal</p>
        </div>

        {/* Form card */}
        <div style={{
          background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 16,
          padding: '28px 28px', transition: 'background .2s',
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: t.textSub, marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                style={inp}
                placeholder="admin@exato.in"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={e => (e.target.style.borderColor = '#6366F1')}
                onBlur={e => (e.target.style.borderColor = t.inputBorder)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: t.textSub, marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                style={inp}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={e => (e.target.style.borderColor = '#6366F1')}
                onBlur={e => (e.target.style.borderColor = t.inputBorder)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
                color: '#fff', cursor: 'pointer', border: 'none', fontFamily: 'var(--font-sans)',
                background: 'linear-gradient(135deg,#6366F1,#4F46E5)',
                opacity: loading ? .65 : 1, marginTop: 4,
              }}
            >
              {loading ? 'Signing in…' : 'Access Admin Panel'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, marginTop: 20, color: t.textMuted }}>
          Restricted access — Exato Technologies internal use only
        </p>
      </div>
    </div>
  )
}
