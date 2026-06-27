import { useNavigate } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';
import '../../styles/InvoiceDetailModal.css';

// ── InvoiceDetailModal ───────────────────────────────────────
// Purpose: Modal showing full invoice details — breakdown, payments, schedule — with action buttons.
// Props: none (reads invoice ID from AppContext)
export default function InvoiceDetailModal() {
  const navigate = useNavigate();
  const {
    invoiceOpen, openInvoice, closeInvoice,
    downloadInvoice, sendReminder, recordPayment,
  } = useApp();
  const ctx = useApp();
  const invoice = openInvoice ? ctx.getInvoiceDetail(openInvoice) : null;

  if (!invoiceOpen || !invoice) return null;

  return (
    <div className="inv-backdrop" onClick={closeInvoice}>
      <div className="inv-card" onClick={e => e.stopPropagation()}>
        <div className="inv-header">
          <div className="inv-header-left">
            <span className="inv-id">{invoice.id}</span>
            <span className="inv-status-badge" style={{ background: invoice.statusBg, color: invoice.statusFg }}>
              {invoice.status}
            </span>
            <span className="inv-dates">
              Issued {invoice.issued} · Due {invoice.due}
            </span>
          </div>
          <button className="inv-close-btn" onClick={closeInvoice}>✕</button>
        </div>

        <div className="inv-scroll">
          <div className="inv-amount-card">
            <div className="inv-amount-row">
              <span className="inv-total-label">Total</span>
              <span className="inv-total-value">{invoice.total}</span>
            </div>
            <div className="inv-paid-row">
              <span className="inv-paid-label">Paid</span>
              <span className="inv-paid-value">{invoice.paid}</span>
            </div>
            <div className="inv-summary-row">
              <span className="inv-summary-label" style={{ color: invoice.summaryColor }}>
                {invoice.summaryLabel}
              </span>
              <span style={{ color: invoice.summaryColor, fontWeight: 600 }}>
                {invoice.balance}
              </span>
            </div>
            <div className="inv-progress-wrap">
              <div className="inv-progress-bar" style={{ background: invoice.barColor, width: invoice.pct }} />
            </div>
          </div>

          <div className="inv-grid">
            <div className="inv-grid-card">
              <div className="inv-grid-label">Billed to</div>
              <div className="inv-billed-to">
                <div className="inv-avatar" style={{ background: invoice.avatarBg }}>{invoice.initials}</div>
                <div className="inv-billed-info">
                  <span className="inv-billed-name">{invoice.client}</span>
                  <span className="inv-billed-detail">{invoice.email}</span>
                  <span className="inv-billed-detail">{invoice.phone}</span>
                </div>
              </div>
            </div>
            <div className="inv-grid-card">
              <div className="inv-grid-label">Linked trip</div>
              <div className="inv-trip-info">
                <span className="inv-trip-name">{invoice.trip}</span>
                <span className="inv-trip-agent">Agent: {invoice.agent}</span>
                <button className="inv-trip-link" onClick={() => navigate('/app/trips/0')}>
                  Open trip →
                </button>
              </div>
            </div>
          </div>

          <div className="inv-breakdown">
            <h3 className="inv-section-title">Breakdown</h3>
            {invoice.items.map((item, i) => (
              <div key={i} className="inv-line-item">
                <span className="inv-line-label">{item.label}</span>
                <span className="inv-line-amount">{item.amount}</span>
              </div>
            ))}
            <div className="inv-total-line">
              <span>Total</span>
              <span>{invoice.total}</span>
            </div>
          </div>

          <div className="inv-payments">
            <h3 className="inv-section-title">Payments</h3>
            {invoice.payments.map((p, i) => (
              <div key={i} className="inv-pay-item">
                <div className="inv-pay-dot" style={{ background: p.dot }} />
                <div className="inv-pay-info">
                  <span className="inv-pay-label">{p.label}</span>
                  <span className="inv-pay-meta">
                    {p.date} · {p.method} · {p.ref}
                  </span>
                </div>
                <span className="inv-pay-amount" style={{ color: p.dot }}>{p.amount}</span>
              </div>
            ))}
            {invoice.hasSchedule && invoice.schedule.map((sch, i) => (
              <div key={i} className="inv-schedule-item">
                <div className="inv-schedule-dot" />
                <div className="inv-schedule-info">
                  <span className="inv-schedule-label">{sch.label}</span>
                  <span className="inv-schedule-due">Due {sch.due}</span>
                </div>
                <span className="inv-schedule-amount">{sch.amount}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="inv-footer">
          <button className="inv-btn-outline" onClick={downloadInvoice}>Download PDF</button>
          {invoice.hasBalance && (
            <>
              <button className="inv-btn-outline" onClick={sendReminder}>Send reminder</button>
              <button className="inv-btn-primary" onClick={recordPayment}>Record payment</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
