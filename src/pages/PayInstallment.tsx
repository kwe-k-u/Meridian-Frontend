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

type PaymentChoice = 'USD' | 'GHS' | 'CRYPTO'

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
  const [choice, setChoice] = useState<PaymentChoice | null>(null)

  useEffect(() => {
    if (!reference) return
    setLoading(true)
    setError(null)
    ApiService.lookupWeWirePaymentByReference(reference)
      .then(res => {
        setData(res)
        // Default to whichever currency the plan is actually denominated in when it's
        // provisioned; otherwise just default to the first choice offered — the traveler can
        // always switch, this only picks what's shown first.
        const provisioned = res.payment_options.find(o => o.account)
        setChoice((provisioned ?? res.payment_options[0])?.currency as PaymentChoice ?? 'CRYPTO')
      })
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
    if (!reference || !choice || choice === 'CRYPTO') return
    setSimulating(true)
    setSimulateError(null)
    ApiService.attemptWeWirePayment(reference, choice)
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

  // The traveler always gets three choices — USD, GHS, or crypto — regardless of which of
  // those the agency has actually finished setting up; picking an unprovisioned one just shows
  // a "not ready yet" note scoped to that choice rather than hiding it (backend:
  // WeWirePaymentController::buildLookupResponse / PAYABLE_CURRENCIES).
  const selectedOption = choice && choice !== 'CRYPTO' ? data.payment_options.find(o => o.currency === choice) : undefined
  const account = selectedOption?.account ?? null
  // GHS virtual accounts on WeWire are mobile money accounts (MTN/Vodafone/AirtelTigo), not bank
  // accounts — there's no IBAN/sort code/routing number for this currency, so the pay page should
  // read as "pay with Mobile Money" rather than the generic "bank transfer" copy used for the
  // other (genuinely bank-account) currencies.
  const isMobileMoney = account?.currency === 'GHS'

  const handleSelectChoice = (next: PaymentChoice) => {
    setChoice(next)
    setVerified(false)
    setSimulateError(null)
  }

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
        ) : (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>Choose how you'd like to pay</p>

            {/* Currency/method picker — USD, GHS and crypto are always all offered, whether or
                not the agency has actually finished provisioning that one yet (the traveler
                picks first; an unprovisioned choice just shows a "not ready" note below instead
                of being hidden). */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {data.payment_options.map(o => (
                <button
                  key={o.currency}
                  onClick={() => handleSelectChoice(o.currency as PaymentChoice)}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: choice === o.currency ? '2px solid #2B63F6' : '1px solid #DDE0E8',
                    background: choice === o.currency ? '#EEF3FF' : '#fff',
                    color: choice === o.currency ? '#2B63F6' : '#3A3F4B',
                  }}
                >
                  {o.currency}
                </button>
              ))}
              <button
                onClick={() => handleSelectChoice('CRYPTO')}
                style={{
                  flex: 1, padding: '10px 8px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: choice === 'CRYPTO' ? '2px solid #2B63F6' : '1px solid #DDE0E8',
                  background: choice === 'CRYPTO' ? '#EEF3FF' : '#fff',
                  color: choice === 'CRYPTO' ? '#2B63F6' : '#3A3F4B',
                }}
              >
                Crypto
              </button>
            </div>

            {/* Bank transfer / mobile money — the standard, auto-reconciled route. */}
            {choice && choice !== 'CRYPTO' && (
              <div style={{ border: '1px solid #EEF0F4', borderRadius: 10, padding: 16 }}>
                {!account ? (
                  // No account for this currency exists at all yet — rather than a dead end,
                  // "Proceed anyway" still runs the same live-check-then-fallback flow every
                  // other option gets (see handleAttemptPayment). WeWire has nothing real to
                  // check here, so the "Response from wewire server" popup fires immediately,
                  // shows why, and offers to settle a simulated payment instead — same UX the
                  // fallback popup gives every other WeWire-backed action in this app.
                  <div style={{ padding: 12, background: '#FFF3E0', borderRadius: 8, fontSize: 13, textAlign: 'center' }}>
                    <p style={{ margin: 0 }}>Your agency hasn't finished setting up payments in {choice} yet. Please contact them directly, or choose a different payment option above.</p>
                    <button
                      onClick={handleAttemptPayment}
                      disabled={simulating}
                      style={{ width: '100%', marginTop: 12, border: 'none', cursor: simulating ? 'default' : 'pointer', background: simulating ? '#8FB0FA' : '#2B63F6', color: '#fff', padding: '12px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}
                    >
                      {simulating ? 'Checking with WeWire…' : 'Proceed anyway'}
                    </button>
                    {simulateError && (
                      <p style={{ fontSize: 12, color: '#F04438', marginTop: 8, textAlign: 'center' }}>{simulateError}</p>
                    )}
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{isMobileMoney ? 'Pay with Mobile Money' : 'Pay by bank transfer'}</p>
                    {selectedOption && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                        <span>Outstanding in {selectedOption.currency}</span>
                        <span style={{ fontWeight: 700 }}>{selectedOption.outstanding} {selectedOption.currency}</span>
                      </div>
                    )}
                    <div style={{ background: '#F7F8FA', borderRadius: 8, padding: 16, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {isMobileMoney ? (
                        account.account_number && <div><strong>Mobile Money number:</strong> {account.account_number}</div>
                      ) : (
                        <>
                          {account.account_number && <div><strong>Account number:</strong> {account.account_number}</div>}
                          {account.iban && <div><strong>IBAN:</strong> {account.iban}</div>}
                          {account.sort_code && <div><strong>Sort code:</strong> {account.sort_code}</div>}
                          {account.routing_number && <div><strong>Routing number:</strong> {account.routing_number}</div>}
                        </>
                      )}
                      <div><strong>Currency:</strong> {account.currency}</div>
                    </div>
                    <div style={{ marginTop: 12, padding: 12, background: '#FFF8E1', borderRadius: 8, fontSize: 13 }}>
                      <strong>Important:</strong> Include the reference code <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{data.payment_reference}</span> {isMobileMoney ? 'in your mobile money payment note' : 'in your transfer description'}, or your payment may not be matched to this trip automatically.
                    </div>
                    <p style={{ fontSize: 12, color: '#8A90A2', marginTop: 12, textAlign: 'center' }}>
                      {isMobileMoney
                        ? "Mobile money payments are usually quick, but can still take a little while to reflect. This page will show your payment as received once it's confirmed — check back or contact your agent for confirmation."
                        : "Bank transfers can take a little while to reflect. This page will show your payment as received once it's confirmed — check back or contact your agent for confirmation."}
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
                  </>
                )}
              </div>
            )}

            {/* Crypto — no "Proceed with payment" verify step here — crypto deposits can't be
                auto-matched to this trip (most chains have no memo/reference field), so a human
                on the agency's side always has to assign it by hand. Say that plainly rather
                than implying the same automatic confirmation the bank flow gets. */}
            {choice === 'CRYPTO' && (
              <div style={{ border: '1px solid #EEF0F4', borderRadius: 10, padding: 16 }}>
                {data.payment_wallets.length === 0 ? (
                  <div style={{ padding: 12, background: '#FFF3E0', borderRadius: 8, fontSize: 13, textAlign: 'center' }}>
                    Your agency hasn't set up a crypto wallet yet. Please contact them directly, or choose a different payment option above.
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Pay with crypto</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                      <span>Outstanding (approx.)</span>
                      <span style={{ fontWeight: 700 }}>{data.crypto_outstanding} USD</span>
                    </div>
                    {data.payment_wallets.map(w => (
                      <div key={`${w.asset}-${w.chain}`} style={{ background: '#F7F8FA', borderRadius: 8, padding: 16, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                        <div><strong>Asset:</strong> {w.asset} on {w.chain}</div>
                        {w.address && <div style={{ wordBreak: 'break-all' }}><strong>Deposit address:</strong> {w.address}</div>}
                      </div>
                    ))}
                    <div style={{ padding: 12, background: '#FFF8E1', borderRadius: 8, fontSize: 13 }}>
                      <strong>Important:</strong> Crypto deposits can't include your reference code the way a bank transfer can — after sending, let your agent know the amount and date so they can match it to your trip by hand.
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
