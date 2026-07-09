import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { ApiService } from '../services/api-service';
import type { TransactionResponse, FinStat, ChartBar } from '../types/app';
import '../styles/Financials.css';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const statusMeta: Record<string, { bg: string; fg: string }> = {
  pending: { bg: '#FFF3E0', fg: '#B7791F' },
  completed: { bg: '#E3F7EF', fg: '#0E9F6E' },
  failed: { bg: '#FDECEC', fg: '#D64545' },
  refunded: { bg: '#F0EBFF', fg: '#6B46C1' },
};

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// ── Financials ─────────────────────────────────────────────────
// Purpose: Displays revenue/outstanding/refund stats, monthly chart, and
//          transaction table.
// State: transactions, loading.
// API: ApiService.getTransactions.
//
// Every stat/chart on this page is computed client-side (via useMemo below) from the real
// `transactions` list — this page does NOT use AppContext's getFinancialData()/finStats()/
// chartData() mock generators, even though those still exist in constants/app.ts.

export default function Financials() {
  const navigate = useNavigate();
  const ctx = useApp();
  const { convert, format } = useCurrency();

  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ApiService.getTransactions();
      setTransactions(res.data);
    } catch {
      ctx.toastAction?.('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [ctx]);

  useEffect(() => { fetch(); }, [fetch]);

  const stats: FinStat[] = useMemo(() => {
    const completed = transactions.filter(t => t.status === 'completed');
    const pending = transactions.filter(t => t.status === 'pending');
    const refunded = transactions.filter(t => t.status === 'refunded');

    // Transactions can each carry their own currency (a trip payment might genuinely be
    // recorded in USD) — normalize every amount to GHS before summing, otherwise a mixed-
    // currency batch would just add raw numbers together regardless of what they're in.
    const sumGHS = (list: TransactionResponse[]) =>
      list.reduce((s, t) => s + convert(t.amount, t.currency, 'GHS'), 0);

    // Note: `revenue` and `paidOut` are computed identically (sum of all completed
    // transactions) — there's currently no distinction between "revenue recognized" and
    // "cash actually paid out to the agency" (e.g. minus a platform fee or payout delay).
    const revenue = sumGHS(completed);
    const outstanding = sumGHS(pending);
    const paidOut = sumGHS(completed);
    const refunds = sumGHS(refunded);

    return [
      { label: 'Revenue', value: format(revenue, 'GHS'), delta: `From ${completed.length} transactions`, deltaColor: '#1DB954' },
      { label: 'Outstanding', value: format(outstanding, 'GHS'), delta: `${pending.length} pending payments`, deltaColor: '#F59E0B' },
      { label: 'Paid out', value: format(paidOut, 'GHS'), delta: `${completed.length} completed`, deltaColor: '#2B63F6' },
      { label: 'Refunds', value: format(refunds, 'GHS'), delta: `${refunded.length} this period`, deltaColor: '#EF4444' },
    ];
  }, [transactions, convert, format]);

  const chart: ChartBar[] = useMemo(() => {
    const byMonth: Record<string, number> = {};
    transactions
      .filter(t => t.status === 'completed' && t.paid_at)
      .forEach(t => {
        const d = new Date(t.paid_at!);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        byMonth[key] = (byMonth[key] || 0) + convert(t.amount, t.currency, 'GHS');
      });

    const keys = Object.keys(byMonth).sort();
    if (keys.length === 0) {
      return monthNames.slice(0, 6).map(m => ({ label: m, h: '4px', value: '0', barBg: '#EEF0F4', barLabelColor: '#AEB3C2' }));
    }

    const maxVal = Math.max(...keys.map(k => byMonth[k]), 1);
    return keys.map(key => {
      const val = byMonth[key];
      const [, m] = key.split('-');
      const monthIdx = parseInt(m, 10) - 1;
      const pct = Math.max(4, (val / maxVal) * 180);
      return {
        label: monthNames[monthIdx] || key,
        h: `${pct}px`,
        value: format(val, 'GHS').replace(/^\S+\s/, ''),
        barBg: '#2B63F6',
        barLabelColor: '#15161B',
      };
    });
  }, [transactions, convert, format]);

  // Clicking a trip-payment row opens the linked trip; subscription payments have no trip
  // to open, so those just show a quick summary toast instead.
  const handleRowClick = (tx: TransactionResponse) => {
    const tripId = tx.trip_payment?.trip?.trip_id;
    if (tripId) {
      navigate(`/app/trips/${tripId}`);
      return;
    }
    ctx.toastAction?.(`Transaction: ${tx.transaction_id} — ${format(tx.amount, tx.currency)}`);
  };

  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  // Marks a pending transaction completed — e.g. once a bank transfer or manual payment has
  // actually cleared. Stops the row's own onClick (which would otherwise navigate away).
  const handleMarkPaid = async (e: React.MouseEvent, tx: TransactionResponse) => {
    e.stopPropagation();
    setMarkingPaidId(tx.transaction_id);
    try {
      await ApiService.updateTransactionStatus(tx.transaction_id, 'completed');
      await fetch();
      ctx.toastAction?.('Marked as paid');
    } catch {
      ctx.toastAction?.('Failed to update transaction');
    } finally {
      setMarkingPaidId(null);
    }
  };

  return (
    <div className="financials-page">
      <div className="grid-4 mb-24">
        {stats.map((st, i) => (
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
            <p className="payout-amount">
              {format(
                transactions.filter(t => t.status === 'completed').reduce((s, t) => s + convert(t.amount, t.currency, 'GHS'), 0),
                'GHS'
              )}
            </p>
            <p className="payout-date">Estimated processing soon</p>
          </div>
          <div className="badge">
            <span>●</span> {transactions.length} transactions
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="th-row">
          <span className="th-text">Transaction</span>
          <span className="th-text">Client</span>
          <span className="th-text">Trip</span>
          <span className="th-text">Method</span>
          <span className="th-text">Status</span>
          <span className="th-text">Amount</span>
        </div>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#8A90A2' }}>Loading...</div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#8A90A2' }}>No transactions yet</div>
        ) : (
          transactions.map((tx) => {
            const sm = statusMeta[tx.status] ?? { bg: '#EEF0F4', fg: '#5B6172' };
            return (
              <div key={tx.transaction_id} className="tr" onClick={() => handleRowClick(tx)}>
                <span className="td" title={tx.transaction_id}>
                  {tx.transaction_id.substring(0, 12)}…
                </span>
                <span className="td-gray">{tx.client_name || '—'}</span>
                <span className="td-gray">
                  {tx.trip_payment?.trip?.trip_name || '—'}
                </span>
                <span className="td-gray">{tx.payment_method || '—'}</span>
                <span>
                  <span className="status-pill" style={{ background: sm.bg, color: sm.fg }}>
                    {tx.status}
                  </span>
                  {tx.status === 'pending' && (
                    <button
                      onClick={(e) => handleMarkPaid(e, tx)}
                      disabled={markingPaidId === tx.transaction_id}
                      className="mark-paid-btn"
                    >
                      {markingPaidId === tx.transaction_id ? 'Saving...' : 'Mark as paid'}
                    </button>
                  )}
                </span>
                <span>
                  <span className="td">{format(tx.amount, tx.currency)}</span>
                  {tx.paid_at && <span className="hint">{fmtDate(tx.paid_at)}</span>}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
