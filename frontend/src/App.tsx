import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SuperAdminProvider, useSuperAdmin } from './context/SuperAdminContext'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'

// Public pages
const LandingPage                  = lazy(() => import('./pages/LandingPage'))
const LoginPage                    = lazy(() => import('./pages/LoginPage'))
const PublicPage                   = lazy(() => import('./pages/PublicPage'))

// Doctor / user pages
const HomePage                     = lazy(() => import('./pages/HomePage'))
const NewPrescriptionPage          = lazy(() => import('./pages/NewPrescriptionPage'))
const PrescriptionDetailPage       = lazy(() => import('./pages/PrescriptionDetailPage'))
const PrescriptionsListPage        = lazy(() => import('./pages/PrescriptionsListPage'))
const PharmacistDashboard          = lazy(() => import('./pages/PharmacistDashboard'))
const PharmacistPrescriptionDetail = lazy(() => import('./pages/PharmacistPrescriptionDetail'))
const SettingsPage                 = lazy(() => import('./pages/SettingsPage'))
const MedicinePrescriptionsPage    = lazy(() => import('./pages/MedicinePrescriptionsPage'))

// Org Admin pages
const OrgAdminDashboard            = lazy(() => import('./pages/admin/OrgAdminDashboard'))
const RolesPage                    = lazy(() => import('./pages/admin/RolesPage'))
const TeamPage                     = lazy(() => import('./pages/admin/TeamPage'))
const HospitalsPage                = lazy(() => import('./pages/admin/HospitalsPage'))
const HospitalDetailPage           = lazy(() => import('./pages/admin/HospitalDetailPage'))
const HospitalAdminPage            = lazy(() => import('./pages/hospital/HospitalAdminPage'))

// Profile
const ProfilePage                  = lazy(() => import('./pages/ProfilePage'))

// Superadmin pages
const SuperAdminLoginPage          = lazy(() => import('./pages/superadmin/SuperAdminLoginPage'))
const SuperAdminDashboard          = lazy(() => import('./pages/superadmin/SuperAdminDashboard'))
const SuperAdminOrgDetail          = lazy(() => import('./pages/superadmin/SuperAdminOrgDetail'))

// ─── Route guards ─────────────────────────────────────────────────────────────

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { superAdmin, loading } = useSuperAdmin()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F172A' }}>
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!superAdmin) return <Navigate to="/superadmin/login" replace />
  return <>{children}</>
}

function OrgAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  // Hospital-scoped admins have their own portal
  if (user.role === 'HOSPITAL_ADMIN' || (user.role === 'ORG_ADMIN' && user.hospital_id)) return <Navigate to="/hospital-admin" replace />
  if (user.role !== 'ORG_ADMIN' && !user.is_org_admin) return <Navigate to="/home" replace />
  return <>{children}</>
}

function HospitalAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  // Only hospital-scoped admins can access this portal
  if (user.role !== 'HOSPITAL_ADMIN' && (user.role !== 'ORG_ADMIN' || !user.hospital_id)) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/" replace />
  if (user.role === 'HOSPITAL_ADMIN') return <Navigate to="/hospital-admin" replace />
  if (user.role === 'ORG_ADMIN' || user.is_org_admin) {
    if (user.hospital_id) return <Navigate to="/hospital-admin" replace />
    return <Navigate to="/admin" replace />
  }
  if (user.role === 'PHARMACIST') return <Navigate to="/pharmacist" replace />
  return <Navigate to="/home" replace />
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <SuperAdminProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              style: { fontSize: '14px', borderRadius: '12px', fontFamily: 'DM Sans, sans-serif' },
              success: { iconTheme: { primary: '#1D9E75', secondary: '#fff' } },
            }}
          />
          <ErrorBoundary>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>}>
          <Routes>
            {/* ── Public ── */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<LoginPage />} />
            <Route path="/public/:token" element={<PublicPage />} />
            <Route path="/app" element={<RootRedirect />} />

            {/* ── Superadmin Portal ── */}
            <Route path="/superadmin/login" element={<SuperAdminLoginPage />} />
            <Route path="/superadmin/dashboard" element={
              <SuperAdminRoute><SuperAdminDashboard /></SuperAdminRoute>
            } />
            <Route path="/superadmin/organizations/:id" element={
              <SuperAdminRoute><SuperAdminOrgDetail /></SuperAdminRoute>
            } />

            {/* ── Hospital Admin Portal ── */}
            <Route path="/hospital-admin" element={
              <HospitalAdminRoute><HospitalAdminPage /></HospitalAdminRoute>
            } />

            {/* ── Org Admin Portal ── */}
            <Route path="/admin" element={
              <OrgAdminRoute><OrgAdminDashboard /></OrgAdminRoute>
            } />
            <Route path="/admin/roles" element={
              <OrgAdminRoute><RolesPage /></OrgAdminRoute>
            } />
            <Route path="/admin/team" element={
              <OrgAdminRoute><TeamPage /></OrgAdminRoute>
            } />
            <Route path="/admin/hospitals" element={
              <OrgAdminRoute><HospitalsPage /></OrgAdminRoute>
            } />
            <Route path="/admin/hospitals/:id" element={
              <OrgAdminRoute><HospitalDetailPage /></OrgAdminRoute>
            } />

            {/* ── Doctor routes ── */}
            <Route path="/home" element={
              <ProtectedRoute role="DOCTOR"><HomePage /></ProtectedRoute>
            } />
            <Route path="/prescriptions" element={
              <ProtectedRoute role="DOCTOR"><PrescriptionsListPage /></ProtectedRoute>
            } />
            <Route path="/prescriptions/new" element={
              <ProtectedRoute role="DOCTOR"><NewPrescriptionPage /></ProtectedRoute>
            } />
            <Route path="/prescriptions/:id" element={
              <ProtectedRoute><PrescriptionDetailPage /></ProtectedRoute>
            } />

            {/* ── Medicine Prescriptions (Doctor + Org Admin) ── */}
            <Route path="/medicine-prescriptions" element={
              <ProtectedRoute><MedicinePrescriptionsPage /></ProtectedRoute>
            } />

            {/* ── Pharmacist ── */}
            <Route path="/pharmacist" element={
              <ProtectedRoute role="PHARMACIST"><PharmacistDashboard /></ProtectedRoute>
            } />
            <Route path="/pharmacist/prescriptions/:id" element={
              <ProtectedRoute role="PHARMACIST"><PharmacistPrescriptionDetail /></ProtectedRoute>
            } />

            {/* ── Profile (doctors + pharmacists) ── */}
            <Route path="/profile" element={
              <ProtectedRoute><ProfilePage /></ProtectedRoute>
            } />

            {/* ── Settings (all authenticated users) ── */}
            <Route path="/settings" element={
              <ProtectedRoute><SettingsPage /></ProtectedRoute>
            } />

            {/* ── 404 ── */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </AuthProvider>
    </SuperAdminProvider>
  )
}
