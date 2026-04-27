import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import AppShell from '../components/layout/AppShell'
import { DOCTOR_NAV } from '../constants/nav'
import StatCard from '../components/ui/StatCard'
import UsageBar from '../components/ui/UsageBar'
import { PlanBadge } from '../components/ui/StatusBadge'
import api from '../services/api'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function HomePage() {
  const { user, org, refreshOrg } = useAuth()
  const navigate = useNavigate()

  // Quick upload state
  const [showQuickSheet, setShowQuickSheet]   = useState(false)
  const [quickFile, setQuickFile]             = useState<File | null>(null)
  const [quickPreview, setQuickPreview]       = useState<string | null>(null)
  const [uploading, setUploading]             = useState(false)
  const cameraRef  = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  useEffect(() => { refreshOrg() }, [])

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => { if (quickPreview) URL.revokeObjectURL(quickPreview) }
  }, [quickPreview])

  const used      = org?.usage_this_month ?? 0
  const limit     = org?.prescription_limit ?? 99999
  const nearLimit = limit < 99999 && used >= limit * 0.8

  const handleQuickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setQuickFile(f)
    if (quickPreview) URL.revokeObjectURL(quickPreview)
    setQuickPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null)
    setShowQuickSheet(false)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const handleQuickUpload = async () => {
    if (!quickFile) return
    setUploading(true)
    try {
      // Step 1: get a pre-signed S3 PUT URL
      const mimetype = quickFile.type || 'image/jpeg'
      const urlRes = await api.post('/prescriptions/upload-url', {
        filename: quickFile.name,
        mimetype,
      })
      const { upload_url, key } = urlRes.data.data

      // Step 2: upload file directly to S3
      const s3Res = await fetch(upload_url, {
        method: 'PUT',
        body: quickFile,
        headers: { 'Content-Type': mimetype },
      })
      if (!s3Res.ok) throw new Error(`Image upload failed (${s3Res.status})`)

      // Step 3: create the prescription record with the S3 key
      const res = await api.post('/prescriptions', {
        language:  'hi',
        image_key: key,
      })
      const prescription = res.data.data
      toast.success('Prescription uploaded!')
      if (quickPreview) URL.revokeObjectURL(quickPreview)
      setQuickFile(null)
      setQuickPreview(null)
      navigate(`/prescriptions/${prescription.id}`)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleCancelQuick = () => {
    if (quickPreview) URL.revokeObjectURL(quickPreview)
    setQuickFile(null)
    setQuickPreview(null)
    setShowQuickSheet(false)
  }

  const NewPrescriptionBtn = (
    <button className="btn btn-teal btn-sm" onClick={() => navigate('/prescriptions/new')}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      New Prescription
    </button>
  )

  return (
    <AppShell navItems={DOCTOR_NAV} topBarRight={NewPrescriptionBtn}>

      {/* Hidden file inputs */}
      <input ref={cameraRef}  type="file" accept="image/*" capture="environment"
        style={{ display: 'none' }} onChange={handleQuickFile} />
      <input ref={galleryRef} type="file" accept="image/*,.pdf"
        style={{ display: 'none' }} onChange={handleQuickFile} />

      {/* Greeting */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-.4px' }}>
            {getGreeting()},{' '}
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400 }}>
              {user?.name?.split(' ')[0]}
            </span>
          </h2>
          {org?.plan && <PlanBadge plan={org.plan} />}
        </div>
        {org && <p style={{ fontSize: 13, color: 'var(--ink-light)' }}>{org.name}</p>}
      </div>

      {/* Limit warning */}
      {nearLimit && (
        <div style={{
          background: 'var(--warning-bg)', border: '1px solid rgba(217,119,6,.2)',
          borderRadius: 10, padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span style={{ fontSize: 12, color: 'var(--warning)' }}>
              {used >= limit ? `Monthly limit reached (${limit} Rx)` : `${used}/${limit} prescriptions used this month`}
            </span>
          </div>
          <button onClick={() => navigate('/settings')}
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
            Upgrade →
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid-3" style={{ gap: 14, marginBottom: 28 }}>
        <StatCard label="This month" value={used} sub={limit < 99999 ? `of ${limit} Rx limit` : 'unlimited'} />
        <StatCard label="Plan" value={org?.plan || '—'} sub={limit < 99999 ? `${limit} Rx / mo` : 'Unlimited Rx'} />
        <StatCard label="Team members" value={org?.team_count ?? '—'} sub={org?.team_limit ? `of ${org.team_limit} seats` : undefined} />
      </div>

      {/* Usage bar */}
      {org && limit < 99999 && (
        <div className="card" style={{ marginBottom: 28, padding: '18px 20px' }}>
          <UsageBar used={used} limit={limit} label="Monthly prescription usage" />
        </div>
      )}

      {/* Main CTA — 3 cards */}
      <div className="grid-3" style={{ gap: 14 }}>

        {/* New Prescription (full form) */}
        <button className="card" onClick={() => navigate('/prescriptions/new')}
          style={{ textAlign: 'left', cursor: 'pointer', border: 'none', background: 'var(--ink)', borderRadius: 14, padding: '24px 22px', transition: 'opacity .15s' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 4 }}>New Prescription</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>Add patient + upload image</p>
        </button>

        {/* Quick Upload (image only) */}
        <button className="card" onClick={() => setShowQuickSheet(true)}
          style={{ textAlign: 'left', cursor: 'pointer', border: '2px dashed var(--teal)', borderRadius: 14, padding: '24px 22px', transition: 'background .15s', background: 'var(--teal-light)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,184,148,.12)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--teal-light)')}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(0,184,148,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--teal-dark)', marginBottom: 4 }}>Quick Upload</p>
          <p style={{ fontSize: 12, color: 'var(--teal)' }}>Image only — no form</p>
        </button>

        {/* All Prescriptions */}
        <button className="card" onClick={() => navigate('/prescriptions')}
          style={{ textAlign: 'left', cursor: 'pointer', transition: 'background .15s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--cell)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>All Prescriptions</p>
          <p style={{ fontSize: 12, color: 'var(--ink-light)' }}>View &amp; manage history</p>
        </button>
      </div>

      {/* ── Quick Upload bottom sheet ── */}
      {showQuickSheet && (
        <>
          {/* Backdrop */}
          <div onClick={() => setShowQuickSheet(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200 }} />

          {/* Sheet */}
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201,
            background: 'var(--surface)', borderRadius: '20px 20px 0 0',
            padding: '20px 24px 36px', boxShadow: '0 -8px 32px rgba(0,0,0,.15)',
          }}>
            {/* Handle */}
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 20px' }} />
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Quick Upload</p>
            <p style={{ fontSize: 12, color: 'var(--ink-light)', marginBottom: 20 }}>
              Upload just the image — patient details can be filled later by the pharmacist
            </p>

            <div style={{ display: 'flex', gap: 12 }}>
              {/* Take Photo */}
              <button onClick={() => { setShowQuickSheet(false); setTimeout(() => cameraRef.current?.click(), 100) }}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                  padding: '20px 12px', borderRadius: 14,
                  border: '2px solid var(--teal)', background: 'var(--teal-light)',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.8">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal-dark)' }}>Take Photo</span>
                <span style={{ fontSize: 11, color: 'var(--teal)', opacity: .8 }}>Use camera</span>
              </button>

              {/* Gallery */}
              <button onClick={() => { setShowQuickSheet(false); setTimeout(() => galleryRef.current?.click(), 100) }}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                  padding: '20px 12px', borderRadius: 14,
                  border: '2px solid var(--border)', background: 'var(--surface)',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ink-light)" strokeWidth="1.8">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Choose File</span>
                <span style={{ fontSize: 11, color: 'var(--ink-light)', opacity: .8 }}>Gallery / PDF</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Quick Upload preview & confirm ── */}
      {quickFile && (
        <>
          {/* Backdrop */}
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 200 }} />

          {/* Modal */}
          <div style={{
            position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 201, width: 'min(92vw, 380px)',
            background: 'var(--surface)', borderRadius: 18,
            padding: '22px 22px 24px', boxShadow: '0 16px 48px rgba(0,0,0,.2)',
          }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Ready to upload</p>
            <p style={{ fontSize: 12, color: 'var(--ink-light)', marginBottom: 14 }}>{quickFile.name}</p>

            {/* Preview */}
            {quickPreview ? (
              <img src={quickPreview} alt="Preview"
                style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 10,
                  background: 'var(--cell)', border: '1px solid var(--border)', marginBottom: 16 }} />
            ) : (
              <div style={{ height: 100, background: 'var(--cell)', borderRadius: 10, border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: 'var(--ink-light)' }}>PDF — ready to upload</p>
              </div>
            )}

            <p style={{ fontSize: 11, color: 'var(--ink-light)', marginBottom: 16, lineHeight: 1.5 }}>
              Patient name and phone will be auto-filled by OCR. The pharmacist can edit them if needed.
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleQuickUpload} disabled={uploading}
                className="btn btn-teal"
                style={{ flex: 1, justifyContent: 'center', opacity: uploading ? .65 : 1 }}>
                {uploading ? (
                  <>
                    <div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                    Uploading…
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                    </svg>
                    Upload Now
                  </>
                )}
              </button>
              <button onClick={handleCancelQuick} disabled={uploading}
                className="btn btn-ghost" style={{ flex: 'none', padding: '0 18px' }}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  )
}
