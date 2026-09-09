// ── App ──────────────────────────────────────────────────────
// Root component defining the app's route structure:
// - Public routes: / (marketing landing page), /login, /signup, /forgot-password
// - Traveler view: /travel/:tripId (wrapped in AppProvider, no auth required — it's a
//   shareable link sent to travelers who don't have Meridian accounts)
// - Authenticated app: /app/* (wrapped in MainLayout with sidebar/topbar), gated by
//   ProtectedRoute — an unauthenticated visitor is redirected to /login?next=<page>, and
//   AuthPage sends them back to that page after they sign in.

import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { CurrencyProvider } from './contexts/CurrencyContext'
import Landing from './pages/Landing'
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
import TravelerPaymentCallback from './pages/TravelerPaymentCallback'
import PayInstallment from './pages/PayInstallment'
import PaymentsOnboarding from './pages/onboarding/PaymentsOnboarding'
import MainLayout from './components/Layout/MainLayout'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <AuthProvider>
      <CurrencyProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/signup" element={<AuthPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route element={<AppProvider><Outlet /></AppProvider>}>
            <Route path="/travel/:tripId" element={<TravelerView />} />
            <Route path="/travel/:tripId/payment-callback" element={<TravelerPaymentCallback />} />
            {/* The customer-facing WeWire "payment link" page — no Meridian account required,
                same public trust model as /travel/:tripId (see App.tsx module comment). */}
            <Route path="/pay" element={<PayInstallment />} />
            <Route path="/pay/:reference" element={<PayInstallment />} />
            <Route element={<ProtectedRoute />}>
              {/* Skippable post-signup wizard (see AuthPage.tsx's handleSignup) — deliberately
                  outside MainLayout, full-screen like AuthPage itself. */}
              <Route path="/app/onboarding/payments" element={<PaymentsOnboarding />} />
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
          </Route>
        </Routes>
      </CurrencyProvider>
    </AuthProvider>
  )
}

export default App
