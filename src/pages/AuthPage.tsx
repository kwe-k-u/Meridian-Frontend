import { useState } from 'react'
import { Link } from 'react-router-dom'
import logoWordmark from '../assets/logo/logo_wordmark.svg'
import ImageCarousel from '../components/ImageCarousel'
import SearchableSelect from '../components/SearchableSelect'
import PasswordField from '../components/PasswordField'
import PasswordStrengthCard from '../components/PasswordStrengthCard'
import GoogleIcon from '../components/GoogleIcon'
import Button from '../components/Button'
import AuthActionLoading from '../components/AuthActionLoading'
import { countries, businessTypes } from '../constants/auth'
import '../styles/AuthPage.css'

function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('signup')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [companyEmail, setCompanyEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [country, setCountry] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [fullName, setFullName] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [confirmFocused, setConfirmFocused] = useState(false)

  const isLogin = mode === 'login'

  const resetSignup = () => {
    setStep(1)
    setCompanyEmail('')
    setCompanyName('')
    setCountry('')
    setBusinessType('')
    setFullName('')
    setSignupPassword('')
    setConfirmPassword('')
  }

  const switchMode = (m: 'login' | 'signup') => {
    setMode(m)
    resetSignup()
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1500))
    setLoading(false)
  }

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault()
    setStep((s) => s + 1)
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1500))
    setLoading(false)
  }

  const stepTitles = ['Create account', 'Set up your company workspace', 'Employee info']

  return (
    <div className="page">
      {loading && (
        <AuthActionLoading
          primary={isLogin ? "We're signing you in..." : 'Creating your account'}
          secondary={isLogin ? 'Signing you in' : 'Creating your company workspace'}
        />
      )}

      <ImageCarousel compact={mode === 'signup' && step > 1} />

      <div className="form-container">
        <div className="auth-top-right">
          <img src={logoWordmark} alt="Meridian" className="auth-logo-wordmark" />
        </div>

        {isLogin ? (
          <>
            <div className="form-wrap">
              <h1 className="title">Sign In</h1>
              <p className="toggle-text">
                Don't have an account?{' '}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => switchMode('signup')}
                >
                  Sign up
                </button>
              </p>

              <form className="form" onSubmit={handleLogin}>
                <div className="field">
                  <label htmlFor="login-email">Email address</label>
                  <input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <PasswordField
                  id="login-password"
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Enter your password"
                  required
                />

                <div className="options-row">
                  <label className="remember-me">
                    <input type="checkbox" />
                    <span>Remember me</span>
                  </label>
                  <Link to="/forgot-password" className="link-forgot">
                    Forgot password?
                  </Link>
                </div>

                <Button type="submit" disabled={loading}>
                  Sign in
                </Button>

                <div className="divider">
                  <span>or</span>
                </div>

                <Button type="button" variant="google">
                  <GoogleIcon />
                  Sign in with Google
                </Button>
              </form>
            </div>

          </>
        ) : (
          <>
            <div className="form-wrap">
              {step > 1 && (
                <button type="button" className="back-btn" onClick={() => setStep((s) => s - 1)}>
                  Back
                </button>
              )}
              <div className="step-content" key={step}>
                <h1 className="title">{stepTitles[step - 1]}</h1>

                {step === 1 ?( <p className="subtitle">
                  Already have an account?{' '}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => switchMode('login')}
                  >
                    Login
                  </button>
                </p>)
                :(<p className="subtitle">
                  Tell us a little about your business so we can personalise your workspace.
                </p>)}

                {step === 1 && (
                  <form className="form" onSubmit={handleNextStep}>
                    <div className="field">
                      <label htmlFor="company-email">Work email</label>
                      <input
                        id="company-email"
                        type="email"
                        placeholder="you@company.com"
                        value={companyEmail}
                        onChange={(e) => setCompanyEmail(e.target.value)}
                        required
                      />
                    </div>

                    <Button type="submit">
                      Create account
                    </Button>

                    <div className="divider">
                      <span>or</span>
                    </div>

                    <Button type="button" variant="google">
                      <GoogleIcon />
                      Sign in with Google
                    </Button>
                  </form>
                )}

                {step === 2 && (
                  <form className="form" onSubmit={handleNextStep}>
                    <div className="field">
                      <label htmlFor="company-name">Company name</label>
                      <input
                        id="company-name"
                        type="text"
                        placeholder="Acme Inc."
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        required
                      />
                    </div>

                    <SearchableSelect
                      label="Country"
                      options={countries}
                      value={country}
                      onChange={setCountry}
                      placeholder="Select your primary country of operation"
                    />

                    <div className="field">
                      <label htmlFor="business-type">Business type</label>
                      <select
                        id="business-type"
                        value={businessType}
                        onChange={(e) => setBusinessType(e.target.value)}
                        required
                      >
                        <option value="" disabled>Select what best describes your company</option>
                        {businessTypes.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <Button type="submit" disabled={!companyName || !country || !businessType}>
                      Continue
                    </Button>
                  </form>
                )}

                {step === 3 && (
                  <form className="form" onSubmit={handleSignup}>
                    <div className="field">
                      <label htmlFor="full-name">Full name</label>
                      <input
                        id="full-name"
                        type="text"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="password-field-group">
                      <PasswordField
                        id="signup-password"
                        label="Password"
                        value={signupPassword}
                        onChange={setSignupPassword}
                        onFocus={() => setPasswordFocused(true)}
                        onBlur={() => setPasswordFocused(false)}
                        placeholder="Create a password"
                        required
                        minLength={8}
                      />

                      <PasswordStrengthCard password={signupPassword} focused={passwordFocused} />
                    </div>

                    <div className="password-field-group">
                      <PasswordField
                        id="confirm-password"
                        label="Confirm password"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        onFocus={() => setConfirmFocused(true)}
                        onBlur={() => setConfirmFocused(false)}
                        placeholder="Repeat your password"
                        required
                        minLength={8}
                      />

                      <PasswordStrengthCard password={confirmPassword} focused={confirmFocused} match={signupPassword} />
                    </div>

                    <Button type="submit" disabled={!fullName || !signupPassword || !confirmPassword || signupPassword !== confirmPassword || loading}>
                      {loading ? 'Creating account...' : 'Create account'}
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default AuthPage
