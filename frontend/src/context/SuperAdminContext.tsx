import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import saApi from '../services/saApi'

interface SuperAdmin {
  id: string
  name: string
  email: string
}

export type SATheme = 'dark' | 'light'

interface SuperAdminContextType {
  superAdmin: SuperAdmin | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  loading: boolean
  theme: SATheme
  toggleTheme: () => void
}

const SuperAdminContext = createContext<SuperAdminContextType | null>(null)

export function SuperAdminProvider({ children }: { children: ReactNode }) {
  const [superAdmin, setSuperAdmin] = useState<SuperAdmin | null>(null)
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState<SATheme>(() =>
    (localStorage.getItem('sa_theme') as SATheme) || 'dark'
  )

  const toggleTheme = () => {
    setTheme(t => {
      const next = t === 'dark' ? 'light' : 'dark'
      localStorage.setItem('sa_theme', next)
      return next
    })
  }

  useEffect(() => {
    const saved = localStorage.getItem('sa_user')
    const token = localStorage.getItem('sa_token')
    if (saved && token) {
      try {
        setSuperAdmin(JSON.parse(saved))
      } catch {
        localStorage.removeItem('sa_user')
        localStorage.removeItem('sa_token')
      }
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    const res = await saApi.post('/auth/superadmin/login', { email, password })
    const { token, superAdmin: sa } = res.data.data
    setSuperAdmin(sa)
    localStorage.setItem('sa_token', token)
    localStorage.setItem('sa_user', JSON.stringify(sa))
  }

  const logout = () => {
    setSuperAdmin(null)
    localStorage.removeItem('sa_token')
    localStorage.removeItem('sa_user')
  }

  return (
    <SuperAdminContext.Provider value={{ superAdmin, login, logout, loading, theme, toggleTheme }}>
      {children}
    </SuperAdminContext.Provider>
  )
}

export function useSuperAdmin() {
  const ctx = useContext(SuperAdminContext)
  if (!ctx) throw new Error('useSuperAdmin must be inside SuperAdminProvider')
  return ctx
}
