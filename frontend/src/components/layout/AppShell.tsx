import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export type NavItem = {
  id: string
  label: string
  path: string
  icon: React.ReactNode
}

interface AppShellProps {
  children: React.ReactNode
  navItems: NavItem[]
  /** Section label shown above nav items */
  sectionLabel?: string
  topBarRight?: React.ReactNode
}

function MedscriptLogo({ orgName, role }: { orgName?: string; role?: string }) {
  return (
    <div className="sidebar-logo">
      <div className="sidebar-logo-icon">
        <span>Rx</span>
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
          {orgName || 'Medscript'}
        </p>
        {role && (
          <p style={{ fontSize: 11, color: 'var(--ink-light)', lineHeight: 1 }}>{role}</p>
        )}
      </div>
    </div>
  )
}

export default function AppShell({ children, navItems, sectionLabel, topBarRight }: AppShellProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, org, logout } = useAuth()
  const [logoutHover, setLogoutHover] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const activeId = navItems.find(n => location.pathname === n.path || location.pathname.startsWith(n.path + '/'))?.id

  const closeSidebar = () => setSidebarOpen(false)

  const handleNavClick = (path: string) => {
    navigate(path)
    closeSidebar()
  }

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' sidebar-open' : ''}`}
        onClick={closeSidebar}
      />

      {/* Sidebar */}
      <aside className={`app-sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        <MedscriptLogo
          orgName={org?.name}
          role={
            user?.role === 'HOSPITAL_ADMIN'
              ? 'Hospital Admin'
              : user?.role === 'ORG_ADMIN'
              ? (user?.hospital_id ? 'Hospital Admin' : 'Admin Portal')
              : user?.role === 'PHARMACIST' ? 'Pharmacist' : 'Doctor'
          }
        />

        <nav className="sidebar-nav">
          {sectionLabel && <p className="sidebar-section-label">{sectionLabel}</p>}
          {navItems.map(item => (
            <button
              key={item.id}
              className={`sidebar-nav-item${activeId === item.id ? ' active' : ''}`}
              onClick={() => handleNavClick(item.path)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {/* User row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 4px', marginBottom: 4 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--teal-dark)' }}>
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>{user?.name}</p>
              <p style={{ fontSize: 11, color: 'var(--ink-light)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>{user?.email}</p>
            </div>
          </div>
          <button
            className="sidebar-nav-item"
            style={{ color: logoutHover ? 'var(--danger)' : undefined, width: '100%' }}
            onMouseEnter={() => setLogoutHover(true)}
            onMouseLeave={() => setLogoutHover(false)}
            onClick={logout}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="app-main">
        <header className="app-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Hamburger — only visible on mobile via CSS */}
            <button
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(o => !o)}
              aria-label="Toggle navigation"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <h1 style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
              {navItems.find(n => n.id === activeId)?.label ?? 'Dashboard'}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {topBarRight}
          </div>
        </header>

        <main className="app-content">
          {children}
        </main>
      </div>
    </div>
  )
}
