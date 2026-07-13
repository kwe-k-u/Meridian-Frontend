import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import logoWordmark from '../assets/logo/logo_wordmark.svg'
import ImageCarousel from '../components/ImageCarousel'
import SearchableSelect from '../components/SearchableSelect'
import PasswordField from '../components/PasswordField'
import PasswordStrengthCard from '../components/PasswordStrengthCard'
import GoogleIcon from '../components/GoogleIcon'
import Button from '../components/Button'
import AuthActionLoading from '../components/AuthActionLoading'
import { countries, businessTypes } from '../constants/auth'
import { ApiService } from '../services/api-service'
import { signInWithGoogle } from '../services/firebase'
import '../styles/AuthPage.css'

// ── AuthPage ──────────────────────────────────────────────────
// Purpose: Login and multi-step signup (company info → profile → password).
// State: mode (login/signup), step (1-3), form fields, error, loading.
// API: ApiService.loginUser, ApiService.registerCompany, ApiService.googleLogin.

function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const auth = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>(location.pathname === '/login' ? 'login' : 'signup')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(() => {
    const s = searchParams.get('step')
    return s ? Number(s) : 1
  })
  const [isGoogleOnboarding, setIsGoogleOnboarding] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [companyEmail, setCompanyEmail] = useState(searchParams.get('email') || '')
  const [companyName, setCompanyName] = useState('')
  const [country, setCountry] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [fullName, setFullName] = useState(searchParams.get('name') || '')
  const [signupPassword, setSignupPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [confirmFocused, setConfirmFocused] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const isLogin = mode === 'login'

  // Where to send the user after a successful login/signup. Only accept an internal path
  // (never `//host` or an absolute URL) so this can't be turned into an open redirect, and
  // never bounce back into the auth pages themselves.
  const getSafeNext = () => {
    const next = searchParams.get('next')
    if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') && !next.startsWith('/signup')) {
      return next
    }
    return '/app/dashboard'
  }

  // Detect Google onboarding (pre-filled step 2 from query params). Runs on every
  // searchParams change, not just mount — handleGoogleSignIn navigates to `/signup?step=2...`
  // which, when already on /signup, doesn't remount this component (same route, only the
  // query string changes), so the step/email/name state below can't rely on useState's
  // lazy initializer alone.
  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (searchParams.get('step') === '2' && emailParam) {
      setIsGoogleOnboarding(true)
      setMode('signup')
      setStep(2)
      setCompanyEmail(emailParam)
      setFullName(searchParams.get('name') || '')
    }
  }, [searchParams])

  // ── Event handlers ──

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
    setErrorMessage('')
    setLoading(true)
    try {
      const response = await ApiService.loginUser({ email, password })
      auth.login(response)
      navigate(getSafeNext())
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to log in.')
    } finally {
      setLoading(false)
    }
  }

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault()
    setStep((s) => s + 1)
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    setLoading(true)
    try {
      const response = await ApiService.registerCompany({
        email: companyEmail,
        company_name: companyName,
        country,
        business_type: businessType,
        username: fullName,
        password: signupPassword,
        password_confirmation: confirmPassword,
      })
      // AuthController::registerCompany always returns access_token on success (201), so the
      // `else` branch below is just a defensive fallback that shouldn't normally trigger.
      if (response.access_token) {
        auth.login(response)
        navigate(getSafeNext())
      } else {
        navigate('/login')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to register company.'
      // If the user already exists (e.g. Google-authenticated user now setting up a company),
      // try creating the company for the already-authenticated user instead.
      if (isGoogleOnboarding && (message.includes('already exists') || message.includes('already taken'))) {
        try {
          const company = await ApiService.createCompany({
            company_name: companyName,
            country,
            business_type: businessType,
          })
          // Append the new company to the user's profile and navigate to dashboard
          const updatedUser = {
            ...auth.user!,
            companies: [...(auth.user?.companies || []), {
              company_id: company.company_id,
              company_name: company.company_name,
              country: company.country || '',
              city_of_operation: company.city_of_operation || '',
              status: company.status,
              preferred_currency: company.preferred_currency,
              created_at: company.created_at,
              updated_at: company.updated_at,
              pivot: {
                user_id: auth.user!.user_id,
                company_id: company.company_id,
                role: 'owner',
                is_default: 1,
                is_enabled: 1,
                joined_at: new Date().toISOString(),
              },
            }],
          }
          auth.login({
            access_token: auth.token!,
            token_type: 'bearer',
            user: updatedUser,
          })
          navigate(getSafeNext())
        } catch {
          setErrorMessage(message)
        }
      } else {
        setErrorMessage(message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setErrorMessage('')
    setLoading(true)
    try {
      const google = await signInWithGoogle()
      const response = await ApiService.googleLogin(google)
      auth.login(response)

      // If the user has no company, redirect to company creation flow
      if (!response.user.companies?.length) {
        const next = searchParams.get('next')
        const nextParam = next ? `&next=${encodeURIComponent(next)}` : ''
        navigate(`/signup?step=2&email=${encodeURIComponent(google.email || '')}&name=${encodeURIComponent(google.displayName || '')}${nextParam}`, { replace: true })
      } else {
        navigate(getSafeNext())
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to sign in with Google.')
    } finally {
      setLoading(false)
    }
  }

  const stepTitles = [
    isGoogleOnboarding ? 'Company details' : 'Create account',
    'Set up your company workspace',
    isGoogleOnboarding ? 'Set a password' : 'Employee info',
  ]

  // ── Render ──

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
                    onChange={(e) => { setEmail(e.target.value); setErrorMessage('') }}
                    required
                  />
                </div>

                <PasswordField
                  id="login-password"
                  label="Password"
                  value={password}
                  onChange={(val) => { setPassword(val); setErrorMessage('') }}
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

                {errorMessage && <div className="error-message">{errorMessage}</div>}

                <Button type="submit" disabled={loading}>
                  Sign in
                </Button>

                <div className="divider">
                  <span>or</span>
                </div>

                <Button type="button" variant="google" onClick={handleGoogleSignIn}>
                  <GoogleIcon />
                  Continue with Google
                </Button>
              </form>
            </div>

          </>
        ) : (
          <>
            <div className="form-wrap">
              {step > 1 && !isGoogleOnboarding && (
                <button type="button" className="back-btn" onClick={() => setStep((s) => s - 1)}>
                  Back
                </button>
              )}
              <div className="step-content" key={step}>
                <h1 className="title">{stepTitles[step - 1]}</h1>

                {step === 1 && !isGoogleOnboarding ? (
                  <p className="subtitle">
                    Already have an account?{' '}
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => switchMode('login')}
                    >
                      Login
                    </button>
                  </p>
                ) : step === 2 && isGoogleOnboarding ? (
                  <p className="subtitle">
                    Your Google account is connected. Now set up your company workspace.
                  </p>
                ) : step < 3 ? (
                  <p className="subtitle">
                    Tell us a little about your business so we can personalise your workspace.
                  </p>
                ) : null}

                {step === 1 && !isGoogleOnboarding && (
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

                    <Button type="button" variant="google" onClick={handleGoogleSignIn}>
                      <GoogleIcon />
                      Continue with Google
                    </Button>
                  </form>
                )}

                {step === 1 && isGoogleOnboarding && (
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
                        disabled
                      />
                    </div>

                    <Button type="submit">
                      Continue
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
                        onChange={(e) => { setFullName(e.target.value); setErrorMessage('') }}
                        required
                      />
                    </div>

                    <div className="password-field-group">
                      <PasswordField
                        id="signup-password"
                        label="Password"
                        value={signupPassword}
                        onChange={(val) => { setSignupPassword(val); setErrorMessage('') }}
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
                        onChange={(val) => { setConfirmPassword(val); setErrorMessage('') }}
                        onFocus={() => setConfirmFocused(true)}
                        onBlur={() => setConfirmFocused(false)}
                        placeholder="Repeat your password"
                        required
                        minLength={8}
                      />

                      <PasswordStrengthCard password={confirmPassword} focused={confirmFocused} match={signupPassword} />
                    </div>

                    {errorMessage && <div className="error-message">{errorMessage}</div>}

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
