import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import logoWordmark from '../assets/logo/logo_wordmark.svg'
import PasswordField from '../components/PasswordField'
import PasswordStrengthCard from '../components/PasswordStrengthCard'
import Button from '../components/Button'
import AuthActionLoading from '../components/AuthActionLoading'
import { ApiService } from '../services/api-service'
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

  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    setLoading(true)
    try {
      await ApiService.requestPasswordReset({ email })
      sessionStorage.setItem('resetEmail', email)
      setSent(true)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to request reset link.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      {loading && <AuthActionLoading primary="Sending reset link" secondary="Please wait" />}


      <div className="form-container">
        <div className="auth-top-right">
          <img src={logoWordmark} alt="Meridian" className="auth-logo-wordmark" />
        </div>

        <div className="form-wrap">

          {!sent ? (
            <>
              <h1 className="title">Forgot password?</h1>
              <p className="subtitle">
                No worries. Enter your email and we'll send you a reset link.
              </p>
                <form className="form" onSubmit={handleSubmit}>
                  <div className="field">
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

                  {errorMessage && <div className="error-message">{errorMessage}</div>}

                  <Button type="submit" disabled={!email || loading}>
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </Button>
                </form>
            </>
            ) : (
              <>
                <p className="subtitle mb-0">
                  We've sent a password reset link to{' '}
                  <strong>{email}</strong>. Please check your inbox.
                </p>
                <p className="subtitle mt-16">
                  Didn't receive the email?{' '}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => setSent(false)}
                  >
                    Click to resend
                  </button>
                </p>
              </>
            )}
        </div>

        <p className="toggle-text">
          <Link to="/login" className="link-btn">
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
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [confirmFocused, setConfirmFocused] = useState(false)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [countdown, setCountdown] = useState(7)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    setLoading(true)
    try {
      const email = sessionStorage.getItem('resetEmail')
      if (!email) throw new Error('Session expired. Please request a new reset link.')
      await ApiService.resetPassword({ email, token, password , password_confirmation: confirmPassword})
      sessionStorage.removeItem('resetEmail')
      setDone(true)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to reset password.')
    } finally {
      setLoading(false)
    }
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
    <div className="page">
      {loading && <AuthActionLoading primary="Resetting password" secondary="Please wait" />}


      <div className="form-container">
        <div className="auth-top-right">
          <img src={logoWordmark} alt="Meridian" className="auth-logo-wordmark" />
        </div>

        <div className="form-wrap">

          {!done ? (
            <>
              <h1 className="title">Reset your password</h1>
              <p className="subtitle">
                We'll send a reset link to the email associated with your account
              </p>
              <form className="form" onSubmit={handleSubmit}>
                <div className="password-field-group">
                  <PasswordField
                    id="password"
                    label="New password"
                    value={password}
                    onChange={setPassword}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    placeholder="Enter new password"
                    required
                    minLength={8}
                  />

                  <PasswordStrengthCard password={password} focused={passwordFocused} />
                </div>

                <div className="password-field-group">
                  <PasswordField
                    id="confirmPassword"
                    label="Confirm new password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    onFocus={() => setConfirmFocused(true)}
                    onBlur={() => setConfirmFocused(false)}
                    placeholder="Repeat new password"
                    required
                    minLength={8}
                  />

                  <PasswordStrengthCard password={confirmPassword} focused={confirmFocused} match={password} />
                </div>

                {errorMessage && <div className="error-message">{errorMessage}</div>}

                <Button type="submit" disabled={!password || !confirmPassword || password !== confirmPassword || loading}>
                  {loading ? 'Resetting...' : 'Reset password'}
                </Button>
              </form>
            </>
          ) : (
            <>
              <h1 className="title">Password reset successful</h1>
              <p className="subtitle mb-0">
                Redirecting to login in{' '}
                <span className="countdown">{countdown}</span>{' '}secs...
              </p>
            </>
          )}
        </div>

        {!done && (
          <p className="toggle-text">
            <Link to="/login" className="link-btn">
              &larr; Back to sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}

export default ForgotPasswordPage
