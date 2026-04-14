import { NavItem } from '../components/layout/AppShell'

// ── Shared icon SVGs ──────────────────────────────────────────────────────────

const IconHome = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)

const IconPrescriptions = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
)

const IconMedicines = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
  </svg>
)

const IconProfile = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
)

const IconSettings = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l-.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)

const IconDashboard = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7"/>
    <rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/>
  </svg>
)

const IconHospital = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <line x1="12" y1="3" x2="12" y2="22"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
  </svg>
)

const IconTeam = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

const IconRoles = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)

// ── Nav definitions ───────────────────────────────────────────────────────────

export const DOCTOR_NAV: NavItem[] = [
  { id: 'home',          label: 'Home',         path: '/home',                   icon: IconHome },
  { id: 'prescriptions', label: 'Prescriptions', path: '/prescriptions',          icon: IconPrescriptions },
  { id: 'medicines',     label: 'Medicine DB',  path: '/medicine-prescriptions', icon: IconMedicines },
  { id: 'profile',       label: 'Profile',      path: '/profile',                icon: IconProfile },
  { id: 'settings',      label: 'Settings',     path: '/settings',               icon: IconSettings },
]

export const PHARMACIST_NAV: NavItem[] = [
  { id: 'prescriptions', label: 'Prescriptions', path: '/pharmacist',             icon: IconPrescriptions },
  { id: 'medicines',     label: 'Medicine DB',  path: '/medicine-prescriptions', icon: IconMedicines },
  { id: 'profile',       label: 'Profile',      path: '/profile',                icon: IconProfile },
  { id: 'settings',      label: 'Settings',     path: '/settings',               icon: IconSettings },
]

export const ORG_ADMIN_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/admin',           icon: IconDashboard },
  { id: 'hospitals', label: 'Hospitals', path: '/admin/hospitals', icon: IconHospital },
  { id: 'team',      label: 'Team',      path: '/admin/team',      icon: IconTeam },
  { id: 'roles',     label: 'Roles',     path: '/admin/roles',     icon: IconRoles },
  { id: 'settings',  label: 'Settings',  path: '/settings',        icon: IconSettings },
]

export const HOSPITAL_ADMIN_NAV: NavItem[] = [
  { id: 'hospital', label: 'My Hospital', path: '/hospital-admin', icon: IconHospital },
  { id: 'settings', label: 'Settings',    path: '/settings',       icon: IconSettings },
]
