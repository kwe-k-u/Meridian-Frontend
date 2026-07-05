// ── App ──────────────────────────────────────────────────────
// Root component defining the app's route structure:
// - Public routes: /, /login, /signup, /forgot-password
// - Traveler view: /travel/:tripId (wrapped in AppProvider)
// - Authenticated app: /app/* (wrapped in MainLayout with sidebar/topbar)
//
// Note: none of the /app/* routes actually check auth.isAuthenticated — there's no
// protected-route wrapper here or in MainLayout.tsx. An unauthenticated visitor can
// navigate straight to e.g. /app/dashboard by URL; the page will render but its API calls
// will fail (no Bearer token set), typically showing empty/error states rather than
// redirecting to /login.

import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import AuthPage from './pages/AuthPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import { AppProvider } from './contexts/AppContext'
import Dashboard from './pages/Dashboard'
import Trips from './pages/Trips'
import TripDetail from './pages/TripDetail'
import Messages from './pages/Messages'
import Travelers from './pages/Travelers'
import Financials from './pages/Financials'
import Pricing from './pages/Pricing'
import PaymentCallback from './pages/PaymentCallback'
import Settings from './pages/Settings'
import Help from './pages/Help'
import GuideArticle from './pages/GuideArticle'
import TravelerView from './components/TravelerView'
import MainLayout from './components/Layout/MainLayout'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/signup" element={<AuthPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route element={<AppProvider><Outlet /></AppProvider>}>
          <Route path="/travel/:tripId" element={<TravelerView />} />
          <Route path="/app" element={<MainLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="trips" element={<Trips />} />
            <Route path="trips/:tripId" element={<TripDetail />} />
            <Route path="messages" element={<Messages />} />
            <Route path="messages/:convoId" element={<Messages />} />
            <Route path="travelers" element={<Travelers />} />
            <Route path="financials" element={<Financials />} />
            <Route path="pricing" element={<Pricing />} />
            <Route path="payments/callback" element={<PaymentCallback />} />
            <Route path="settings" element={<Settings />} />
            <Route path="settings/:tab" element={<Settings />} />
            <Route path="help" element={<Help />} />
            <Route path="help/:guideId" element={<GuideArticle />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
