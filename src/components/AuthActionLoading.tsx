import logoWordmark from '../assets/logo/logo_wordmark.svg'

// ── AuthActionLoading ───────────────────────────────────────
// Purpose: Full-screen loading overlay shown during auth actions (login, registration).
// Props: primary?: string — main message; secondary?: string — subtext message
function AuthActionLoading({ primary, secondary }: { primary?: string; secondary?: string }) {
  return (
    <div className="loading-overlay">
      <div className="loading-top-right">
        <img src={logoWordmark} alt="Meridian" className="loading-logo" />
      </div>
      <div className="loading-center">
        <div className="loading-spinner" />
        {primary && <p className="loading-primary">{primary}</p>}
        {secondary && <p className="loading-secondary">{secondary}</p>}
      </div>
    </div>
  )
}

export default AuthActionLoading
