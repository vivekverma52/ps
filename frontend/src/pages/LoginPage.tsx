import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

type Mode = 'login' | 'register' | 'forgot'
type ForgotStep = 'email' | 'otp' | 'password'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [forgotStep, setForgotStep] = useState<ForgotStep>('email')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotOtp, setForgotOtp] = useState('')
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const { register: reg, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm()

  const getRedirectPath = (u: any) => {
    if (u.role === 'HOSPITAL_ADMIN') return '/hospital-admin'
    if (u.role === 'ORG_ADMIN' || u.is_org_admin) {
      return u.hospital_id ? '/hospital-admin' : '/admin'
    }
    if (u.role === 'PHARMACIST') return '/pharmacist'
    return '/home'
  }

  const switchMode = (m: Mode) => {
    reset()
    setForgotStep('email')
    setForgotEmail('')
    setForgotOtp('')
    setMode(m)
  }

  const onSubmit = async (data: any) => {
    try {
      if (mode === 'login') {
        await login(data.email, data.password)
        const u = JSON.parse(localStorage.getItem('user') || '{}')
        navigate(getRedirectPath(u))

      } else if (mode === 'register') {
        await register({ ...data, role: data.role || 'DOCTOR' })
        const u = JSON.parse(localStorage.getItem('user') || '{}')
        navigate(getRedirectPath(u))

      } else if (mode === 'forgot') {
        if (forgotStep === 'email') {
          await api.post('/auth/forgot-password', { email: data.email })
          setForgotEmail(data.email)
          setForgotStep('otp')
          reset()
        } else if (forgotStep === 'otp') {
          // Validate OTP is 6 digits — actual check happens on reset
          setForgotOtp(data.otp)
          setForgotStep('password')
          reset()
        } else if (forgotStep === 'password') {
          await api.post('/auth/reset-password', { email: forgotEmail, otp: forgotOtp, password: data.password })
          toast.success('Password reset! Please sign in.')
          switchMode('login')
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Something went wrong')
    }
  }

  const currentRole = watch('role') || 'DOCTOR'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex' }}>
      {/* Left panel — branding */}
      <div style={{
        width: 420, flexShrink: 0, background: 'var(--ink)', display: 'flex', flexDirection: 'column',
        padding: '56px 52px', position: 'relative', overflow: 'hidden',
      }} className="hidden-mobile">
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
        }} />
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 60 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: '-.5px' }}>Rx</span>
            </div>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>Medi lingua Vani</span>
          </div>
          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', marginBottom: 14 }}>
            Trusted by clinics across India
          </p>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, fontSize: 38, color: '#fff', lineHeight: 1.1, letterSpacing: '-.5px', marginBottom: 20 }}>
            Prescriptions,<br />done right.
          </h2>
          <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.5)', lineHeight: 1.7, maxWidth: 290 }}>
            From handwritten pad to WhatsApp video — in one workflow. For doctors, pharmacists, and clinics.
          </p>
        </div>
        <div style={{ position: 'relative', zIndex: 2, marginTop: 'auto' }}>
          {['OCR prescription digitization', 'WhatsApp video delivery', 'Multi-hospital management', 'Role-based team access'].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--teal)', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,.55)' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Mobile logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 36 }} className="show-mobile">
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>Rx</span>
            </div>
            <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>Medi lingua vani</span>
          </div>

          {/* ── Forgot / OTP / New password flow ── */}
          {mode === 'forgot' ? (
            <>
              <button
                onClick={() => forgotStep === 'email' ? switchMode('login') : setForgotStep(forgotStep === 'password' ? 'otp' : 'email')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-light)', fontSize: 13, fontFamily: 'var(--font-sans)', padding: 0, marginBottom: 28 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
                {forgotStep === 'email' ? 'Back to sign in' : 'Back'}
              </button>

              {/* Step indicators */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                {(['email', 'otp', 'password'] as ForgotStep[]).map((s, i) => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                      background: forgotStep === s ? 'var(--teal)' : (['email', 'otp', 'password'].indexOf(forgotStep) > i) ? 'var(--teal-light)' : 'var(--cream-dark)',
                      color: forgotStep === s ? '#fff' : (['email', 'otp', 'password'].indexOf(forgotStep) > i) ? 'var(--teal)' : 'var(--ink-light)',
                    }}>{i + 1}</div>
                    {i < 2 && <div style={{ width: 20, height: 1, background: 'var(--border)' }} />}
                  </div>
                ))}
              </div>

              {/* Step 1 — Email */}
              {forgotStep === 'email' && (
                <>
                  <div style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-.5px' }}>Forgot password?</h1>
                    <p style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 4 }}>Enter your email and we'll send a 6-digit OTP.</p>
                  </div>
                  <form onSubmit={handleSubmit(onSubmit)}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <label className="label">Email address</label>
                        <input className={`input-field${errors.email ? ' error' : ''}`} type="email" placeholder="you@example.com"
                          {...reg('email', { required: true })} />
                        {errors.email && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>Email is required</p>}
                      </div>
                      <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 4 }}>
                        {isSubmitting ? 'Sending…' : 'Send OTP'}
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* Step 2 — OTP */}
              {forgotStep === 'otp' && (
                <>
                  <div style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-.5px' }}>Enter OTP</h1>
                    <p style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 4 }}>
                      We sent a 6-digit code to <strong style={{ color: 'var(--ink)' }}>{forgotEmail}</strong>. It expires in 10 minutes.
                    </p>
                  </div>
                  <form onSubmit={handleSubmit(onSubmit)}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <label className="label">6-digit OTP</label>
                        <input
                          className={`input-field${errors.otp ? ' error' : ''}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="······"
                          style={{ letterSpacing: 8, fontSize: 20, textAlign: 'center' }}
                          {...reg('otp', { required: true, pattern: /^\d{6}$/ })}
                        />
                        {errors.otp && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>Enter the 6-digit code from your email</p>}
                      </div>
                      <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 4 }}>
                        {isSubmitting ? 'Verifying…' : 'Verify OTP'}
                      </button>
                      <button type="button" onClick={() => { reset(); setForgotStep('email') }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--teal)', fontSize: 13, fontFamily: 'var(--font-sans)', textAlign: 'center' }}>
                        Resend OTP
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* Step 3 — New password */}
              {forgotStep === 'password' && (
                <>
                  <div style={{ marginBottom: 24 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-.5px' }}>Set new password</h1>
                    <p style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 4 }}>Almost done — choose a strong new password.</p>
                  </div>
                  <form onSubmit={handleSubmit(onSubmit)}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <label className="label">New password</label>
                        <input className={`input-field${errors.password ? ' error' : ''}`} type="password" placeholder="Min 6 characters"
                          {...reg('password', { required: true, minLength: 6 })} />
                        {errors.password && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>Min 6 characters required</p>}
                      </div>
                      <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 4 }}>
                        {isSubmitting ? 'Resetting…' : 'Reset password'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </>
          ) : (
            <>
              {/* Header */}
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-.5px' }}>
                  {mode === 'login' ? 'Welcome back' : 'Create account'}
                </h1>
                <p style={{ fontSize: 13, color: 'var(--ink-light)', marginTop: 4 }}>
                  {mode === 'login' ? 'Sign in to your Medi lingua Vani account' : 'Get started — it only takes a minute'}
                </p>
              </div>

              {/* Tab switcher */}
              <div style={{ display: 'flex', background: 'var(--cream-dark)', borderRadius: 9, padding: 3, marginBottom: 24 }}>
                {(['login', 'register'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => switchMode(m)}
                    style={{
                      flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 500, borderRadius: 7, border: 'none', cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      background: mode === m ? 'var(--surface)' : 'none',
                      color: mode === m ? 'var(--ink)' : 'var(--ink-light)',
                      boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                      transition: 'all .15s',
                    }}
                  >
                    {m === 'login' ? 'Sign in' : 'Register'}
                  </button>
                ))}
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {mode === 'register' && (
                    <>
                      <div>
                        <label className="label">Full name</label>
                        <input
                          className={`input-field${errors.name ? ' error' : ''}`}
                          placeholder="Dr. Ravi Sharma"
                          {...reg('name', { required: true })}
                        />
                        {errors.name && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>Name is required</p>}
                      </div>
                      <div>
                        <label className="label">I am a</label>
                        <select className="input-field" {...reg('role')}>
                          <option value="DOCTOR">Doctor</option>
                          <option value="ADMIN">Admin (Organization Owner)</option>
                          <option value="PHARMACIST">Pharmacist</option>
                        </select>
                      </div>
                      {currentRole !== 'PHARMACIST' && (
                        <div>
                          <label className="label">
                            {currentRole === 'ADMIN' ? 'Organization name' : 'Clinic name (optional)'}
                          </label>
                          <input
                            className="input-field"
                            placeholder={currentRole === 'ADMIN' ? 'e.g. Apollo Healthcare' : 'Optional'}
                            {...reg('clinic_name')}
                          />
                          {currentRole === 'ADMIN' && (
                            <p style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 4 }}>
                              This is your organization's name. You'll add individual hospitals from the admin portal.
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  <div>
                    <label className="label">Email address</label>
                    <input
                      className={`input-field${errors.email ? ' error' : ''}`}
                      type="email"
                      placeholder="you@example.com"
                      {...reg('email', { required: true })}
                    />
                    {errors.email && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>Email is required</p>}
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <label className="label" style={{ margin: 0 }}>Password</label>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => switchMode('forgot')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--teal)', fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-sans)', padding: 0 }}
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <input
                      className={`input-field${errors.password ? ' error' : ''}`}
                      type="password"
                      placeholder="Min 6 characters"
                      {...reg('password', { required: true, minLength: 6 })}
                    />
                    {errors.password && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>Min 6 characters required</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-primary btn-lg"
                    style={{ width: '100%', marginTop: 4 }}
                  >
                    {isSubmitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
                  </button>
                </div>
              </form>

              <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-light)', marginTop: 20 }}>
                {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--teal)', fontWeight: 500, fontSize: 12, fontFamily: 'var(--font-sans)' }}
                >
                  {mode === 'login' ? 'Register' : 'Sign in'}
                </button>
              </p>
            </>
          )}

          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-light)', marginTop: 36 }}>
            © 2026 Askim Technologies Pvt. Ltd.
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) { .hidden-mobile { display: none !important; } }
        @media (min-width: 769px) { .show-mobile { display: none !important; } }
      `}</style>
    </div>
  )
}
