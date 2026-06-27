import { useApp } from '../contexts/AppContext'
import '../styles/Pricing.css'

// ── Pricing ────────────────────────────────────────────────────
// Purpose: Displays current plan info, billing toggle (monthly/annual),
//          and a grid of available plans with features.
// State: billing period from AppContext.
// API: None (data from AppContext).

export default function Pricing() {
  const ctx = useApp()
  const {
    billMoBg, billMoFg, billYrBg, billYrFg, setMonthly, setAnnual, billing,
  } = ctx
  const plans = ctx.getPlans()

  return (
    <div className="pricing-container">
      <div className="current-plan-card">
        <div className="current-plan-left">
          <p className="current-plan-label">Current plan</p>
          <p className="current-plan-name">Growth</p>
          <p className="current-plan-meta">GHS 1,200/month · 5 of 5 seats · Renews 1 July</p>
        </div>
        <button className="manage-billing-btn">Manage billing</button>
      </div>
      <h2 className="pricing-heading">Scale Meridian with your agency</h2>
      <div className="toggle-row">
        <div className="toggle-inner">
          <button
            className={`toggle-pill${billing === 'monthly' ? ' toggle-pill--active' : ''}`}
            style={{ background: billMoBg, color: billMoFg }}
            onClick={setMonthly}
          >
            Monthly
          </button>
          <button
            className={`toggle-pill${billing === 'annual' ? ' toggle-pill--active' : ''}`}
            style={{ background: billYrBg, color: billYrFg }}
            onClick={setAnnual}
          >
            Annual
          </button>
        </div>
      </div>
      <div className="plans-grid">
        {plans.map((p, i) => (
          <div key={i} className="plan-card" style={{ border: `2px solid ${p.border}` }}>
            <div className="popular-badge" style={{ display: p.popDisplay }}>Most popular</div>
            <p className="plan-name">{p.name}</p>
            <p className="plan-tag">{p.tag}</p>
            <p className="plan-price">{p.price}</p>
            <p className="plan-per">{p.per}</p>
            <button
              className="plan-cta"
              style={{ background: p.ctaBg, border: `1px solid ${p.ctaBorder}`, color: p.ctaFg }}
              onClick={p.onClick}
            >
              {p.ctaLabel}
            </button>
            <ul className="feature-list">
              {p.features.map((f, j) => (
                <li key={j} className="feature-item">
                  <span className="check-icon">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
