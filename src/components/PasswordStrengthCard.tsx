interface Props {
  password: string
  focused: boolean
  match?: string
}

interface StrengthInfo {
  label: string
  level: number
  color: string
}

function getStrength(password: string): StrengthInfo {
  let points = 0

  if (password.length >= 8) points++ //test for password length
  if (/[a-z]/.test(password)) points++ // test for lower case
  if (/[A-Z]/.test(password)) points++ //test for upper case
  if (/[^a-zA-Z\d]/.test(password)) points++ // test for special character

  if (points === 1) return { label: 'Weak', level: 1, color: '#f97316' }
  if (points === 2) return { label: 'Fair', level: 2, color: '#eab308' }
  if (points === 3) return { label: 'Strong', level: 3, color: '#66d890' }
  return { label: 'Very strong', level: 4, color: '#16a34a' }
}

// ── PasswordStrengthCard ─────────────────────────────────────
// Purpose: Displays password strength meter (Weak → Very strong) and optional match indicator.
// Props: password: string; focused: boolean; match?: string — confirm password to compare
function PasswordStrengthCard({ password, focused, match }: Props) {
  const strength = getStrength(password)

  if (match !== undefined) {
    const matched = password === match
    return (
      <div className="password-strength-tooltip" aria-live="polite">
        {focused && match && (
          <div className="password-strength-card">
            <span className="password-strength-match" style={{ color: matched ? '#22c55e' : '#ef4444' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {matched
                  ? <polyline points="20 6 9 17 4 12" />
                  : <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                }
              </svg>
              {matched ? 'Passwords match' : 'Passwords don\'t match'}
            </span>
          </div>
        )}
      </div>
    )
  }

  const s = strength

  return (
    <div className="password-strength-tooltip" aria-live="polite">
      {focused && password && (
        <div className="password-strength-card">
          <span className="password-strength-value" style={{ color: s.color }}>
            {s.label}
          </span>
          <div className="password-strength-dashes">
            <span className={`password-strength-dash${s.level >= 2 ? ' active' : ''}`} style={{ background: s.level >= 2 ? s.color : undefined }} />
            <span className={`password-strength-dash${s.level >= 3 ? ' active' : ''}`} style={{ background: s.level >= 3 ? s.color : undefined }} />
            <span className={`password-strength-dash${s.level >= 4 ? ' active' : ''}`} style={{ background: s.level >= 4 ? s.color : undefined }} />
          </div>
          <span className="password-strength-label">Password must include</span>
          <ul className="password-strength-criteria">
            <li className={password.length >= 8 ? 'met' : ''}>
              {password.length >= 8 ? '✓' : '○'} At least 8 characters
            </li>
            <li className={/[a-z]/.test(password) && /[A-Z]/.test(password) ? 'met' : ''}>
              {/[a-z]/.test(password) && /[A-Z]/.test(password) ? '✓' : '○'} Uppercase &amp; lowercase
            </li>
            <li className={/[^a-zA-Z\d]/.test(password) ? 'met' : ''}>
              {/[^a-zA-Z\d]/.test(password) ? '✓' : '○'} At least one special character
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}

export default PasswordStrengthCard
