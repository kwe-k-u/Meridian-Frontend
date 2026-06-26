import '../styles/Financials.css'
import { useApp } from '../contexts/AppContext'

export default function Financials() {
  const ctx = useApp()
  const { finStats, chart, invoices } = ctx.getFinancialData()

  return (
    <div className="financials-page">
      <div className="grid-4 mb-24">
        {finStats.map((st, i) => (
          <div key={i} className="stat-card">
            <p className="stat-label">{st.label}</p>
            <p className="stat-value">{st.value}</p>
            <p className="stat-delta" style={{ color: st.deltaColor }}>{st.delta}</p>
          </div>
        ))}
      </div>
      <div className="grid-2 mb-24">
        <div className="chart-card">
          <p className="chart-title">Revenue</p>
          <div className="bar-row">
            {chart.map((b, i) => (
              <div key={i} className="bar-col">
                <span className="bar-value" style={{ color: b.barLabelColor }}>{b.value}</span>
                <div className="bar" style={{ height: b.h, background: b.barBg }} />
                <span className="bar-month-label">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="payout-card">
          <div>
            <p className="payout-label">Next payout</p>
            <p className="payout-amount">GHS 41,500</p>
            <p className="payout-date">Estimated payout 24 Jun 2026</p>
            <div className="bank-info">
              Access Bank · Accra<br />
              Account ****3421<br />
              Oasis Travel Agency
            </div>
          </div>
          <div className="badge">
            <span>●</span> Connected to Paystack
          </div>
        </div>
      </div>
      <div className="table-card">
        <div className="th-row">
          <span className="th-text">Invoice</span>
          <span className="th-text">Client</span>
          <span className="th-text">Trip</span>
          <span className="th-text">Method</span>
          <span className="th-text">Status</span>
          <span className="th-text">Amount</span>
        </div>
        {invoices.map((inv, i) => (
          <div key={i} className="tr" onClick={() => {}}>
            <span className="td">{inv.id}</span>
            <span className="td-gray">{inv.client}</span>
            <span className="td-gray">{inv.trip}</span>
            <span className="td-gray">{inv.method}</span>
            <span>
              <span className="status-pill" style={{ background: inv.statusBg, color: inv.statusFg }}>{inv.status}</span>
            </span>
            <span>
              <span className="td">{inv.amount}</span>
              {inv.balanceHint && <span className="hint">({inv.balanceHint})</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
