import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ApiService } from '../services/api-service'
import type { WeWireLookupResponse } from '../types/app'
import '../styles/PaymentCallback.css'

// ── PayInstallment ──────────────────────────────────────────────
// Purpose: The public "payment link" page — WeWire has no hosted checkout of its own (see
// WeWireService docblock on the backend), so this Meridian-hosted page is what a customer
// actually pays through: they quote the trip's 8-char reference code, see the outstanding
// installment(s), and are shown the company's WeWire virtual account bank details to transfer
// into. Confirmation isn't instant (bank transfers aren't like a card charge) — it arrives
// later via the reconciliation flow (see WeWirePaymentController), so this page just shows
// instructions rather than polling for completion the way PaymentCallback.tsx does.
// State: reference (route param or typed in), lookup result, loading/error.
// API: ApiService.lookupWeWirePaymentByReference (public).

export default function PayInstallment() {
  const { reference } = useParams<{ reference: string }>()
  const navigate = useNavigate()
  const [codeInput, setCodeInput] = useState('')
  const [data, setData] = useState<WeWireLookupResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [simulating, setSimulating] = useState(false)
  const [simulateError, setSimulateError] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)

  useEffect(() => {
    if (!reference) return
    setLoading(true)
    setError(null)
    ApiService.lookupWeWirePaymentByReference(reference)
      .then(setData)
      .catch(() => setError("We couldn't find a payment matching that reference. Double-check the code and try again."))
      .finally(() => setLoading(false))
  }, [reference])

  const handleSubmitCode = (e: React.FormEvent) => {
    e.preventDefault()
    if (codeInput.trim()) {
      navigate(`/pay/${codeInput.trim().toUpperCase()}`)
    }
  }

  // Attempts the real WeWire flow first (is this account genuinely active?) — see
  // ApiService.attemptWeWirePayment. Only if that fails does the "Response from wewire server"
  // popup offer a simulated result; declining it just leaves this page as it was.
  const handleAttemptPayment = () => {
    if (!reference) return
    setSimulating(true)
    setSimulateError(null)
    ApiService.attemptWeWirePayment(reference)
      .then(res => { setData(res); setVerified(!!res.verified) })
      .catch(() => setSimulateError("Couldn't verify this payment with WeWire. Please try again."))
      .finally(() => setSimulating(false))
  }

  // ── Step 1: no reference yet — ask for it ──
  if (!reference) {
    return (
      <div className="pc-container">
        <div className="pc-card">
          <div className="pc-icon">💳</div>
          <h2 className="pc-heading">Pay your trip</h2>
          <p className="pc-body">Enter the payment reference code your travel agent gave you.</p>
          <form onSubmit={handleSubmitCode} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            <input
              value={codeInput}
              onChange={e => setCodeInput(e.target.value.toUpperCase())}
              placeholder="ABCDE123"
              maxLength={8}
              style={{ padding: '12px 16px', fontSize: 18, fontFamily: 'monospace', textAlign: 'center', letterSpacing: 2, border: '1px solid #DDE0E8', borderRadius: 8 }}
              autoFocus
            />
            <button type="submit" className="pc-back-link" style={{ border: 'none', cursor: 'pointer', background: '#2B63F6', color: '#fff', padding: '12px', borderRadius: 8 }} disabled={!codeInput.trim()}>
              Continue
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="pc-container">
        <div className="pc-card">
          <div className="pc-icon">⏳</div>
          <h2 className="pc-heading">Looking up your payment…</h2>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="pc-container">
        <div className="pc-card">
          <div className="pc-icon">⚠️</div>
          <h2 className="pc-heading">Payment not found</h2>
          <p className="pc-body">{error}</p>
          <button className="pc-back-link" style={{ border: 'none', cursor: 'pointer', background: 'transparent' }} onClick={() => navigate('/pay')}>
            Try a different code
          </button>
        </div>
      </div>
    )
  }

  const account = data.payment_account

  return (
    <div className="pc-container">
      <div className="pc-card" style={{ maxWidth: 480, textAlign: 'left' }}>
        <div className="pc-icon" style={{ textAlign: 'center' }}>🧳</div>
        <h2 className="pc-heading" style={{ textAlign: 'center' }}>{data.trip_name}</h2>
        <p className="pc-body" style={{ textAlign: 'center' }}>Paid to {data.company_name}</p>

        <div style={{ background: '#F7F8FA', borderRadius: 8, padding: 16, margin: '16px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
            <span>Total</span>
            <span style={{ fontWeight: 700 }}>{data.total_amount} {data.currency}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span>Outstanding</span>
            <span style={{ fontWeight: 700, color: data.outstanding > 0 ? '#F04438' : '#0E9F6E' }}>{data.outstanding} {data.currency}</span>
          </div>
        </div>

        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Installments</p>
        {data.installments.map(inst => (
          <div key={inst.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', borderBottom: '1px solid #EEF0F4' }}>
            <span>Installment {inst.sequence} {inst.due_date ? `— due ${new Date(inst.due_date).toLocaleDateString()}` : ''}</span>
            <span>
              {inst.outstanding > 0 ? `${inst.outstanding} ${inst.currency} due` : 'Paid'}
              {' '}<span style={{ color: '#8A90A2' }}>({inst.status})</span>
            </span>
          </div>
        ))}

        {data.outstanding <= 0 ? (
          <div style={{ marginTop: 20, textAlign: 'center', color: '#0E9F6E', fontWeight: 600 }}>
            ✅ This trip is fully paid. Thank you!
          </div>
        ) : account ? (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Pay by bank transfer</p>
            <div style={{ background: '#F7F8FA', borderRadius: 8, padding: 16, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {account.account_number && <div><strong>Account number:</strong> {account.account_number}</div>}
              {account.iban && <div><strong>IBAN:</strong> {account.iban}</div>}
              {account.sort_code && <div><strong>Sort code:</strong> {account.sort_code}</div>}
              {account.routing_number && <div><strong>Routing number:</strong> {account.routing_number}</div>}
              <div><strong>Currency:</strong> {account.currency}</div>
            </div>
            <div style={{ marginTop: 12, padding: 12, background: '#FFF8E1', borderRadius: 8, fontSize: 13 }}>
              <strong>Important:</strong> Include the reference code <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{data.payment_reference}</span> in your transfer description, or your payment may not be matched to this trip automatically.
            </div>
            <p style={{ fontSize: 12, color: '#8A90A2', marginTop: 12, textAlign: 'center' }}>
              Bank transfers can take a little while to reflect. This page will show your payment as received once it's confirmed — check back or contact your agent for confirmation.
            </p>

            {verified ? (
              <div style={{ marginTop: 16, padding: 12, background: '#E9F9F0', borderRadius: 8, fontSize: 13, textAlign: 'center', color: '#0E9F6E', fontWeight: 600 }}>
                ✓ WeWire confirms this account is active and ready — go ahead and make your transfer using the details above.
              </div>
            ) : (
              <button
                onClick={handleAttemptPayment}
                disabled={simulating}
                style={{ width: '100%', marginTop: 16, border: 'none', cursor: simulating ? 'default' : 'pointer', background: simulating ? '#8FB0FA' : '#2B63F6', color: '#fff', padding: '12px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}
              >
                {simulating ? 'Verifying…' : 'Proceed with payment'}
              </button>
            )}
            {simulateError && (
              <p style={{ fontSize: 12, color: '#F04438', marginTop: 8, textAlign: 'center' }}>{simulateError}</p>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 20, padding: 12, background: '#FFF3E0', borderRadius: 8, fontSize: 13, textAlign: 'center' }}>
            Your agency hasn't finished setting up payments in {data.currency} yet. Please contact them directly to pay.
          </div>
        )}
      </div>
    </div>
  )
}
