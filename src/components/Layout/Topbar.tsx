import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';
import { ApiService } from '../../services/api-service';
import type { TransactionResponse } from '../../types/app';
import '../../styles/Topbar.css';

function usePageInfo() {
  const loc = useLocation();
  const path = loc.pathname;
  if (path.startsWith('/app/dashboard')) return ['Dashboard', 'Your agency at a glance'];
  if (path.startsWith('/app/trips')) {
    if (path === '/app/trips') return ['Trips', 'All trips and enquiries'];
    return ['Trip detail', ''];
  }
  if (path.startsWith('/app/messages')) return ['Messages', 'Unified inbox'];
  if (path.startsWith('/app/travelers')) return ['Travelers', 'Your travelers'];
  if (path.startsWith('/app/financials')) return ['Financials', 'Revenue, invoices & payouts'];
  if (path.startsWith('/app/pricing')) return ['Pricing', 'Choose your plan'];
  if (path.startsWith('/app/settings')) return ['Settings', 'Manage your workspace'];
  if (path.startsWith('/app/help')) {
    if (path === '/app/help') return ['Help & guides', 'How Meridian works'];
    return ['Guide', ''];
  }
  return ['', ''];
}

function fmtTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffM = Math.floor(diffMs / 60000);
  if (diffM < 1)  return 'just now';
  if (diffM < 60) return `${diffM}m ago`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

export default function Topbar() {
  const [pageTitle, pageSub] = usePageInfo();
  const { openCreate, openGenItin } = useApp();

  const [showNotifs, setShowNotifs] = useState(false);
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('_notif_read') ?? '[]')); } catch { return new Set(); }
  });
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = useCallback(async () => {
    setLoadingNotifs(true);
    try {
      const res = await ApiService.getTransactions();
      setTransactions(res.data.slice(0, 20));
    } catch {
      // no-op
    } finally {
      setLoadingNotifs(false);
    }
  }, []);

  useEffect(() => {
    if (showNotifs) fetchNotifs();
  }, [showNotifs, fetchNotifs]);

  useEffect(() => {
    if (!showNotifs) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setShowNotifs(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifs]);

  const markAllRead = () => {
    const ids = new Set(transactions.map(t => t.transaction_id));
    setReadIds(ids);
    localStorage.setItem('_notif_read', JSON.stringify([...ids]));
  };

  const markRead = (id: string) => {
    const next = new Set(readIds).add(id);
    setReadIds(next);
    localStorage.setItem('_notif_read', JSON.stringify([...next]));
  };

  const unreadCount = transactions.filter(t => !readIds.has(t.transaction_id)).length;

  return (
    <div className="topbar">
      <div className="topbar-title">
        <div className="topbar-title-text">{pageTitle}</div>
        <div className="topbar-title-sub">{pageSub}</div>
      </div>

      <div className="topbar-search">
        <div className="topbar-search-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A90A2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input placeholder="Search trips, travelers…" className="topbar-search-input" />
        </div>
      </div>

      <div className="topbar-actions">
        <button onClick={openGenItin} className="btn-primary" style={{ background: '#10B981', borderColor: '#10B981', marginRight: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          Generate itinerary
        </button>
        <button onClick={openCreate} className="btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New trip
        </button>

        <div className="topbar-notif-wrap" ref={panelRef}>
          <div className="topbar-notif" onClick={() => setShowNotifs(v => !v)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5B6172" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadCount > 0 && (
              <div className="topbar-notif-dot">
                {unreadCount > 9 ? '9+' : unreadCount > 1 ? unreadCount : ''}
              </div>
            )}
          </div>

          {showNotifs && (
            <div className="notif-panel">
              <div className="notif-panel-head">
                <span className="notif-panel-title">Notifications</span>
                {unreadCount > 0 && <button className="notif-mark-all" onClick={markAllRead}>Mark all read</button>}
              </div>

              {loadingNotifs ? (
                <div className="notif-loading">Loading…</div>
              ) : transactions.length === 0 ? (
                <div className="notif-empty">
                  <div className="notif-empty-icon">🔔</div>
                  <p>No notifications yet.</p>
                </div>
              ) : (
                <div className="notif-list">
                  {transactions.map(t => {
                    const isRead = readIds.has(t.transaction_id);
                    const isPaid = t.status === 'completed' || t.status === 'paid';
                    const clientName = t.client_name
                      ?? t.trip_payment?.trip?.customers?.[0]
                        ? `${t.trip_payment!.trip!.customers![0].first_name} ${t.trip_payment!.trip!.customers![0].last_name}`
                        : 'A traveler';
                    const tripName = t.trip_payment?.trip?.trip_name;
                    return (
                      <div key={t.transaction_id} className={`notif-item${isRead ? ' notif-item--read' : ''}`} onClick={() => markRead(t.transaction_id)}>
                        <div className={`notif-icon ${isPaid ? 'notif-icon--payment' : 'notif-icon--pending'}`}>
                          {isPaid ? '💳' : '⏳'}
                        </div>
                        <div className="notif-content">
                          <div className="notif-body">
                            {isPaid ? (
                              <><strong>{clientName}</strong> made a payment of <strong>{t.currency} {Number(t.amount).toLocaleString()}</strong>{tripName ? ` for ${tripName}` : ''}.</>
                            ) : (
                              <><strong>{t.currency} {Number(t.amount).toLocaleString()}</strong> payment from <strong>{clientName}</strong> is <span style={{ color: '#F59E0B' }}>{t.status}</span>.</>
                            )}
                          </div>
                          <div className="notif-time">{fmtTime(t.paid_at ?? t.created_at)}</div>
                        </div>
                        {!isRead && <div className="notif-unread-dot" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
