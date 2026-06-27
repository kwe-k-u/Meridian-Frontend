// ── App ──────────────────────────────────────────────────────
// Root component defining the app's route structure:
// - Public routes: /, /login, /signup, /forgot-password
// - Traveler view: /travel/:tripId (wrapped in AppProvider)
// - Authenticated app: /app/* (wrapped in MainLayout with sidebar/topbar)

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
