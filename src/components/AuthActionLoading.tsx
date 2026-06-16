import logoWordmark from '../assets/logo/logo_wordmark.svg'

function AuthActionLoading({ primary, secondary }: { primary?: string; secondary?: string }) {
  return (
    <div className="auth-loading-overlay">
      <div className="auth-loading-top-right">
        <img src={logoWordmark} alt="Meridian" className="auth-loading-logo" />
      </div>
      <div className="auth-loading-center">
        <div className="auth-loading-spinner" />
        {primary && <p className="auth-loading-primary">{primary}</p>}
        {secondary && <p className="auth-loading-secondary">{secondary}</p>}
      </div>
    </div>
  )
}

export default AuthActionLoading
