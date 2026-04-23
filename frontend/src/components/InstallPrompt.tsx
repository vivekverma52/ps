import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream
    const standalone = (window.navigator as any).standalone === true
    if (ios && !standalone) setIsIOS(true)

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    if (isIOS) setVisible(true)
  }, [isIOS])

  if (!visible) return null

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setVisible(false)
    setDeferredPrompt(null)
  }

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: 16, right: 16, zIndex: 9999,
      background: 'var(--surface, #fff)', border: '1px solid var(--border, #e5e7eb)',
      borderRadius: 16, padding: '14px 16px', boxShadow: '0 8px 32px rgba(0,0,0,.12)',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: '#0d9488',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'Georgia,serif' }}>Rx</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: 'var(--ink, #111)' }}>Install Medscript</p>
        {isIOS ? (
          <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-light, #666)', marginTop: 2 }}>
            Tap <strong>Share</strong> then <strong>Add to Home Screen</strong>
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-light, #666)', marginTop: 2 }}>
            Install for quick access, works offline
          </p>
        )}
      </div>
      {!isIOS && (
        <button onClick={handleInstall} style={{
          background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8,
          padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
        }}>
          Install
        </button>
      )}
      <button onClick={() => setVisible(false)} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 4,
        color: 'var(--ink-light, #666)', flexShrink: 0, fontSize: 16, lineHeight: 1,
      }}>
        ✕
      </button>
    </div>
  )
}
