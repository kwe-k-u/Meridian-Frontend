import { useEffect, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { ApiService } from '../services/api-service'
import type { TransactionResponse } from '../types/app'
import '../styles/PaymentCallback.css'

// ── PaymentCallback ────────────────────────────────────────────
// Purpose: Landing page the customer is redirected to after paying (or cancelling) on
//          Moolre's hosted checkout page — see MoolrePaymentController::requestCheckoutLink's
//          `redirect` URL, which points here as `/app/payments/callback?ref=<transaction_id>`.
// State: transaction, pollCount ref, status ('checking' | 'completed' | 'failed' | 'pending').
// API: ApiService.checkMoolrePaymentStatus.
//
// The Moolre webhook is best-effort (it can't reach a plain localhost backend during
// development, and Moolre's docs don't document any way to verify it wasn't spoofed anyway),
// so this page is the actual confirmation mechanism: it polls our own backend, which in turn
// asks Moolre directly with our API keys — see MoolrePaymentController::status.

const MAX_POLLS = 10
const POLL_INTERVAL_MS = 3000

export default function PaymentCallback() {
  const [searchParams] = useSearchParams()
  const ref = searchParams.get('ref')
  const [transaction, setTransaction] = useState<TransactionResponse | null>(null)
  const [error, setError] = useState(false)
  const pollCount = useRef(0)

  useEffect(() => {
    if (!ref) return
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout>

    const poll = async () => {
      try {
        const tx = await ApiService.checkMoolrePaymentStatus(ref)
        if (cancelled) return
        setTransaction(tx)
        pollCount.current += 1
        if (tx.status === 'pending' && pollCount.current < MAX_POLLS) {
          timeoutId = setTimeout(poll, POLL_INTERVAL_MS)
        }
      } catch {
        if (!cancelled) setError(true)
      }
    }
    poll()

    return () => { cancelled = true; clearTimeout(timeoutId) }
  }, [ref])

  const backLink = transaction?.trip_payment?.trip_id
    ? { to: `/app/trips/${transaction.trip_payment.trip_id}`, label: 'Back to trip' }
    : { to: '/app/pricing', label: 'Back to Pricing' }

  let heading = 'Confirming your payment…'
  let body = "We're checking with Moolre — this only takes a few seconds."
  let icon = '⏳'

  if (error) {
    heading = 'Something went wrong'
    body = "We couldn't reach the server to confirm this payment. If money left your account, it will still be picked up shortly — check Financials in a few minutes."
    icon = '⚠️'
  } else if (transaction?.status === 'completed') {
    heading = 'Payment received'
    body = `Your payment of ${transaction.currency} ${transaction.amount.toLocaleString('en-US')} has been confirmed.`
    icon = '✅'
  } else if (transaction?.status === 'failed') {
    heading = 'Payment failed'
    body = "Moolre reported this payment didn't go through. No charge should have been made — you can try again."
    icon = '❌'
  } else if (transaction && pollCount.current >= MAX_POLLS) {
    heading = 'Still processing'
    body = "This is taking longer than usual. We'll keep confirming it in the background — check Financials shortly."
    icon = '⏳'
  }

  return (
    <div className="pc-container">
      <div className="pc-card">
        <div className="pc-icon">{icon}</div>
        <h2 className="pc-heading">{heading}</h2>
        <p className="pc-body">{body}</p>
        <Link to={backLink.to} className="pc-back-link">{backLink.label}</Link>
      </div>
    </div>
  )
}
