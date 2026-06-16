import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import logoWordmark from '../assets/logo/logo_wordmark.svg'
import PasswordField from '../components/PasswordField'
import Button from '../components/Button'
import AuthActionLoading from '../components/AuthActionLoading'
import '../styles/AuthPage.css'

function ForgotPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  return token ? <ResetPassword token={token} /> : <RequestReset />
}

function RequestReset() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1500))
    setLoading(false)
    setSent(true)
  }

  return (
    <div className="auth-page">
      {loading && <AuthActionLoading primary="Sending reset link" secondary="Please wait" />}


      <div className="auth-container">
        <div className="auth-top-right">
          <img src={logoWordmark} alt="Meridian" className="auth-logo-wordmark" />
        </div>

        <div className="auth-form-wrap">

          {!sent ? (
            <>
              <h1 className="auth-title">Forgot password?</h1>
              <p className="auth-subtitle">
                No worries. Enter your email and we'll send you a reset link.
              </p>
                <form className="auth-form" onSubmit={handleSubmit}>
                  <div className="auth-field">
                    <label htmlFor="email">Email address</label>
                    <input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <Button type="submit" disabled={!email || loading}>
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </Button>
                </form>
            </>
            ) : (
              <>
                <p className="auth-subtitle" style={{ marginBottom: 0 }}>
                  We've sent a password reset link to{' '}
                  <strong>{email}</strong>. Please check your inbox.
                </p>
                <p className="auth-subtitle" style={{ marginTop: 16 }}>
                  Didn't receive the email?{' '}
                  <button
                    type="button"
                    className="auth-link-btn"
                    onClick={() => setSent(false)}
                  >
                    Click to resend
                  </button>
                </p>
              </>
            )}
        </div>

        <p className="auth-toggle">
          <Link to="/login" className="auth-link-btn">
            &larr; Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

function ResetPassword({ token }: { token: string }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(7)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1500))
    setLoading(false)
    setDone(true)
  }

  useEffect(() => {
    if (!done) return
    if (countdown === 0) {
      navigate('/login')
      return
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [done, countdown, navigate])

  return (
    <div className="auth-page">
      {loading && <AuthActionLoading primary="Resetting password" secondary="Please wait" />}


      <div className="auth-container">
        <div className="auth-top-right">
          <img src={logoWordmark} alt="Meridian" className="auth-logo-wordmark" />
        </div>

        <div className="auth-form-wrap">

          {!done ? (
            <>
              <h1 className="auth-title">Reset your password</h1>
              <p className="auth-subtitle">
                We'll send a reset link to the email associated with your account
              </p>
              <form className="auth-form" onSubmit={handleSubmit}>
                <PasswordField
                  id="password"
                  label="New password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Enter new password"
                  required
                  minLength={8}
                />

                <PasswordField
                  id="confirmPassword"
                  label="Confirm new password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Repeat new password"
                  required
                  minLength={8}
                />

                <Button type="submit" disabled={!password || !confirmPassword || password !== confirmPassword || loading}>
                  {loading ? 'Resetting...' : 'Reset password'}
                </Button>
              </form>
            </>
          ) : (
            <>
              <h1 className="auth-title">Password reset successful</h1>
              <p className="auth-subtitle" style={{ marginBottom: 0 }}>
                Redirecting to login in{' '}
                <span className="auth-countdown">{countdown}</span>{' '}secs...
              </p>
            </>
          )}
        </div>

        {!done && (
          <p className="auth-toggle">
            <Link to="/login" className="auth-link-btn">
              &larr; Back to sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}

export default ForgotPasswordPage
