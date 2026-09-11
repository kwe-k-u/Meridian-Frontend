import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../contexts/AppContext'
import { ApiService } from '../services/api-service'
import type { SubscriptionTierResponse, CompanySubscriptionResponse } from '../types/app'
import '../styles/Pricing.css'

// ── Pricing ────────────────────────────────────────────────────
// Purpose: Displays current plan info, billing toggle (monthly/annual),
//          and a grid of available plans with features.
// State: billing period from AppContext; real tiers/currentSub, loading, subscribingTierId.
// API: ApiService.getSubscriptionTiers, .getCompanySubscriptions,
//      .initiatePaystackSubscriptionPayment (creates the pending subscription and redirects to
//      Paystack's hosted checkout — see PaymentCallback.tsx for how the payment is confirmed
//      once the customer returns).
//
// Falls back to AppContext's mock getPlans() if the real tier fetch fails or returns no
// active tiers — the monthly/annual billing toggle only affects that mock fallback pricing
// (SubscriptionTier only has a single quarterly price, no separate monthly/annual rates).

const fmtCurrency = (n: number) => 'GHS ' + Number(n).toLocaleString('en-US')

export default function Pricing() {
  const ctx = useApp()
  const {
    billMoBg, billMoFg, billYrBg, billYrFg, setMonthly, setAnnual, billing,
  } = ctx

  const [tiers, setTiers] = useState<SubscriptionTierResponse[]>([])
  const [currentSub, setCurrentSub] = useState<CompanySubscriptionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [subscribingTierId, setSubscribingTierId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [tiersRes, subsRes] = await Promise.all([
        ApiService.getSubscriptionTiers(),
        ApiService.getCompanySubscriptions(),
      ])
      setTiers(tiersRes.data.filter(t => t.status))
      setCurrentSub(subsRes.data.find(s => s.status === 'active') ?? subsRes.data[0] ?? null)
    } catch {
      // Leave tiers empty — the render below falls back to ctx.getPlans() mock data.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Starts a subscription to a tier via Paystack — the backend creates the subscription as
  // `pending` (1-year term starting today) and returns Paystack's hosted checkout page to
  // redirect the customer to. PaymentCallback.tsx confirms the payment once the customer is
  // sent back, which is also what flips the subscription to `active`.
  const handleSubscribe = async (tier: SubscriptionTierResponse) => {
    setSubscribingTierId(tier.tier_id)
    try {
      const checkout = await ApiService.initiatePaystackSubscriptionPayment(tier.tier_id)
      window.location.href = checkout.authorization_url
    } catch {
      ctx.toastAction('Failed to start your subscription payment')
      setSubscribingTierId(null)
    }
  }

  const mockPlans = ctx.getPlans()
  const usingRealTiers = tiers.length > 0

  return (
    <div className="pricing-container">
      <div className="current-plan-card">
        <div className="current-plan-left">
          <p className="current-plan-label">Current plan</p>
          <p className="current-plan-name">
            {loading ? '…' : currentSub?.tier?.name ?? (usingRealTiers ? 'No active plan' : 'Growth')}
          </p>
          <p className="current-plan-meta">
            {currentSub
              ? `${fmtCurrency(currentSub.tier?.price_quarterly ?? 0)}/quarter · Renews ${new Date(currentSub.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
              : 'GHS 1,200/month · 5 of 5 seats · Renews 1 July'}
          </p>
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
        {usingRealTiers ? (
          tiers.map((tier) => {
            const isCurrent = currentSub?.tier_id === tier.tier_id
            return (
              <div key={tier.tier_id} className="plan-card" style={{ border: '2px solid #ECEDF2' }}>
                <p className="plan-name">{tier.name}</p>
                <p className="plan-price">{fmtCurrency(tier.price_quarterly)}</p>
                <p className="plan-per">/quarter</p>
                <button
                  className="plan-cta"
                  style={{
                    background: isCurrent ? '#EEF0F4' : '#2B63F6',
                    border: `1px solid ${isCurrent ? '#ECEDF2' : '#2B63F6'}`,
                    color: isCurrent ? '#8A90A2' : '#fff',
                  }}
                  onClick={() => handleSubscribe(tier)}
                  disabled={isCurrent || subscribingTierId === tier.tier_id}
                >
                  {isCurrent ? 'Current plan' : subscribingTierId === tier.tier_id ? 'Switching...' : `Choose ${tier.name}`}
                </button>
                <ul className="feature-list">
                  {(tier.features ?? []).map((f, j) => (
                    <li key={j} className="feature-item">
                      <span className="check-icon">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })
        ) : (
          mockPlans.map((p, i) => (
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
          ))
        )}
      </div>
    </div>
  )
}
