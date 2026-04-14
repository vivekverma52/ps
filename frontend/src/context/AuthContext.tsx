import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import api from '../services/api'

export interface Organization {
  id: string
  name: string
  slug: string
  plan: 'FREE' | 'PRO' | 'ENTERPRISE'
  prescription_limit: number
  team_limit: number
  owner_id: string
  address?: string
  phone?: string
  website?: string
  usage_this_month?: number
  team_count?: number
  created_at: string
}

export interface User {
  id: string
  name: string
  email: string
  role: 'ORG_ADMIN' | 'HOSPITAL_ADMIN' | 'DOCTOR' | 'PHARMACIST'
  clinic_name?: string
  org_id?: string
  hospital_id?: string | null
  is_owner?: boolean
  is_org_admin?: boolean
  custom_role_id?: string
  role_display_name?: string
}

interface AuthContextType {
  user: User | null
  org: Organization | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => Promise<void>
  refreshOrg: () => Promise<void>
  loading: boolean
}

interface RegisterData {
  name: string
  email: string
  password: string
  role: string
  clinic_name?: string
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadOrg = async () => {
    try {
      const res = await api.get('/organizations/me')
      setOrg(res.data.data)
    } catch {
      // No org or error — silently ignore
    }
  }

  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    const savedUserRaw = localStorage.getItem('user')
    if (savedToken && savedUserRaw) {
      let u: User | null = null
      try {
        u = JSON.parse(savedUserRaw)
      } catch {
        // Corrupt data — clear it and start fresh
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setLoading(false)
        return
      }
      setToken(savedToken)
      setUser(u)
      if (u?.org_id) {
        loadOrg()
      } else {
        setLoading(false)
        return
      }
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password })
    const { token: t, user: u } = res.data.data
    setToken(t)
    setUser(u)
    localStorage.setItem('token', t)
    localStorage.setItem('user', JSON.stringify(u))
    if (u.org_id) await loadOrg()
  }

  const register = async (data: RegisterData) => {
    const res = await api.post('/auth/register', data)
    const { token: t, user: u } = res.data.data
    setToken(t)
    setUser(u)
    localStorage.setItem('token', t)
    localStorage.setItem('user', JSON.stringify(u))
    if (u.org_id) await loadOrg()
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // Ignore errors — always clear local state
    } finally {
      setToken(null)
      setUser(null)
      setOrg(null)
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
  }

  const refreshOrg = async () => {
    await loadOrg()
  }

  return (
    <AuthContext.Provider value={{ user, org, token, login, register, logout, refreshOrg, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
