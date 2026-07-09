import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiService } from '../services/api-service';
import type { TripResponse, TripStatus, TripCostResponse } from '../types/app';
import '../styles/Trips.css';

const statusMeta: Record<string, { display: TripStatus; bg: string; fg: string }> = {
  planning:     { display: 'Draft',           bg: '#EEF0F4', fg: '#5B6172' },
  inquiry:      { display: 'Inquiry',         bg: '#FFF3E0', fg: '#B7791F' },
  booked:       { display: 'Booked',          bg: '#16143A', fg: '#FFFFFF' },
  in_progress:  { display: 'In Progress',     bg: '#E3F7EF', fg: '#0E9F6E' },
  completed:    { display: 'Completed',       bg: '#EAF0FF', fg: '#2B63F6' },
  cancelled:    { display: 'Cancelled',       bg: '#FDECEC', fg: '#D64545' },
};

const avatarGradients = [
  'linear-gradient(135deg,#1B5BBE,#5AA0FF)',
  'linear-gradient(135deg,#E08A2B,#F5C06B)',
  'linear-gradient(135deg,#0E7C8F,#36C5C0)',
  'linear-gradient(135deg,#C2410C,#F59E5B)',
  'linear-gradient(135deg,#7C3AED,#B58CF5)',
  'linear-gradient(135deg,#15803D,#5DBE7E)',
  'linear-gradient(135deg,#334155,#7889A6)',
];

const avatarColors = ['#6B46C1', '#2B63F6', '#0E9F6E', '#D64545', '#16143A', '#B7791F'];

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '??';
}

function formatDates(start: string | null, end: string | null): string {
  if (!start) return 'TBD';
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (!e || s.getTime() === e.getTime()) return s.toLocaleDateString('en-US', opts);
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function travelerName(trip: TripResponse): string {
  if (trip.customers && trip.customers.length > 0) {
    const c = trip.customers[0];
    return `${c.first_name} ${c.last_name}`;
  }
  return typeof trip.created_by === 'object' && trip.created_by
    ? trip.created_by.display_name
    : 'Unknown';
}

function whereFrom(trip: TripResponse): string {
  return trip.description?.split('.')[0] ?? trip.trip_name;
}

const filterDefs: { label: string; match: (status: string) => boolean }[] = [
  { label: 'All',          match: () => true },
  { label: 'Drafting',     match: (s) => s === 'planning' },
  { label: 'Active',       match: (s) => ['inquiry', 'in_progress'].includes(s) },
  { label: 'Booked',       match: (s) => s === 'booked' },
  { label: 'Completed',    match: (s) => s === 'completed' },
  { label: 'Cancelled',    match: (s) => s === 'cancelled' },
];

type TravelerPopup = {
  tripId: string;
  customers: NonNullable<TripResponse['customers']>;
  rect: DOMRect;
};

export default function Trips() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState(0);
  const [trips, setTrips] = useState<TripResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Multi-traveller popup
  const [travelerPopup, setTravelerPopup] = useState<TravelerPopup | null>(null);
  const [popupSearch, setPopupSearch] = useState('');
  const [popupAddMode, setPopupAddMode] = useState(false);
  const [popupAddSearch, setPopupAddSearch] = useState('');
  const [popupAllCustomers, setPopupAllCustomers] = useState<{ customer_id: string; first_name: string; last_name: string }[]>([]);
  const [popupRemoving, setPopupRemoving] = useState<string | null>(null);
  const [popupAdding, setPopupAdding] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Trip overview modal
  const [overviewTrip, setOverviewTrip] = useState<TripResponse | null>(null);
  const [overviewCosts, setOverviewCosts] = useState<TripCostResponse | null>(null);
  const [loadingCosts, setLoadingCosts] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    ApiService.getTrips()
      .then(res => { if (!cancelled) setTrips(res.data); })
      .catch(() => { if (!cancelled) setError('Failed to load trips'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Close popup on outside click
  useEffect(() => {
    if (!travelerPopup) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setTravelerPopup(null);
        setPopupAddMode(false);
        setPopupAddSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [travelerPopup]);

  const handlePopupRemoveTraveler = async (customerId: string) => {
    if (!travelerPopup) return;
    setPopupRemoving(customerId);
    try {
      await ApiService.removeCustomerFromTrip(travelerPopup.tripId, customerId);
      const updated = travelerPopup.customers.filter(c => c.customer_id !== customerId);
      setTravelerPopup(prev => prev ? { ...prev, customers: updated } : null);
      setTrips(prev => prev.map(t => t.trip_id === travelerPopup.tripId ? { ...t, customers: updated } : t));
    } finally {
      setPopupRemoving(null);
    }
  };

  const handlePopupAddTraveler = async (customer: { customer_id: string; first_name: string; last_name: string }) => {
    if (!travelerPopup) return;
    if (travelerPopup.customers.some(c => c.customer_id === customer.customer_id)) return;
    setPopupAdding(customer.customer_id);
    try {
      await ApiService.addCustomerToTrip(travelerPopup.tripId, customer.customer_id, 'companion');
      const updated = [...travelerPopup.customers, { ...customer, pivot: { role: 'companion' } }];
      setTravelerPopup(prev => prev ? { ...prev, customers: updated } : null);
      setTrips(prev => prev.map(t => t.trip_id === travelerPopup.tripId ? { ...t, customers: updated } : t));
      setPopupAddMode(false);
      setPopupAddSearch('');
    } finally {
      setPopupAdding(null);
    }
  };

  const openPopupAddMode = () => {
    setPopupAddMode(true);
    setPopupAddSearch('');
    if (popupAllCustomers.length === 0) {
      ApiService.getCustomers().then(r => setPopupAllCustomers(r.data)).catch(() => {});
    }
  };

  const openOverview = useCallback(async (trip: TripResponse, e: React.MouseEvent) => {
    e.stopPropagation();
    setOverviewTrip(trip);
    setOverviewCosts(null);
    if (['booked', 'in_progress', 'completed'].includes(trip.status ?? '')) {
      setLoadingCosts(true);
      try {
        const costs = await ApiService.getTripCosts(trip.trip_id);
        setOverviewCosts(costs);
      } catch { /* no-op */ }
      finally { setLoadingCosts(false); }
    }
  }, []);

  const filtered = trips.filter(t => filterDefs[activeFilter].match(t.status));
  const totalMembers = new Set(trips.flatMap(t => (t.customers ?? []).map(c => c.customer_id))).size;
  const totalGroups = trips.length;

  const isBooked = (status: string) => ['booked', 'in_progress', 'completed'].includes(status);

  return (
    <div className="trips-container">
      {!loading && !error && trips.length > 0 && (
        <div className="trips-summary-bar">
          <span className="trips-summary-stat">
            <span className="trips-summary-num">{totalGroups}</span>
            <span className="trips-summary-label">total {totalGroups === 1 ? 'trip' : 'trips'}</span>
          </span>
          <span className="trips-summary-divider" />
          <span className="trips-summary-stat">
            <span className="trips-summary-num">{totalMembers}</span>
            <span className="trips-summary-label">total {totalMembers === 1 ? 'traveler' : 'travelers'}</span>
          </span>
        </div>
      )}
      <div className="filter-bar">
        {filterDefs.map((f, i) => {
          const count = trips.filter(t => f.match(t.status)).length;
          return (
            <button key={f.label} onClick={() => setActiveFilter(i)} className={`filter-pill${i === activeFilter ? ' active' : ''}`}>
              {f.label}{trips.length > 0 ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>

      <div className="trips-header trips-grid">
        {['Trip', 'Traveler', 'Destinations', 'Status', 'Value', ''].map(h => (
          <div key={h} className={`trips-header-cell${h === 'Value' ? ' trips-header-cell-right' : ''}`}>{h}</div>
        ))}
      </div>

      <div>
        {loading && <div className="trips-empty">Loading trips...</div>}
        {error && <div className="trips-empty">{error}</div>}
        {!loading && !error && filtered.length === 0 && <div className="trips-empty">No trips found.</div>}
        {filtered.map((t, i) => {
          const sm = statusMeta[t.status] ?? { display: t.status as TripStatus, bg: '#EEF0F4', fg: '#5B6172' };
          const trav = travelerName(t);
          const grad = avatarGradients[i % avatarGradients.length];
          const col = avatarColors[i % avatarColors.length];
          const customerCount = t.customers?.length ?? 0;
          const hasMulti = customerCount > 1;

          return (
            <div key={t.trip_id} onClick={() => navigate(`/app/trips/${t.trip_id}`)} className="trips-row trips-grid">
              <div className="trip-name-group">
                <div className="trip-avatar-wrap">
                  <div className="trip-cover" style={{ background: grad }} />
                  {customerCount > 0 && <div className="trip-badge">{customerCount}</div>}
                </div>
                <div className="trip-text-group">
                  <div className="trip-name">{t.trip_name}</div>
                  <div className="trip-dates">{formatDates(t.start_date, t.end_date)}</div>
                </div>
              </div>

              {/* Traveler column — shows popup for multi-traveller trips */}
              <div
                className={`trip-traveler-group${hasMulti ? ' trip-traveler-group--multi' : ''}`}
                onClick={hasMulti ? (e) => {
                  e.stopPropagation();
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setPopupSearch('');
                  setTravelerPopup({ tripId: t.trip_id, customers: t.customers!, rect });
                } : undefined}
              >
                {hasMulti ? (
                  <>
                    <div className="trip-multi-avatars">
                      {t.customers!.slice(0, 3).map((c, ci) => (
                        <div key={c.customer_id} className="trip-multi-avatar" style={{ background: avatarColors[ci % avatarColors.length], zIndex: 3 - ci }}>
                          {initials(`${c.first_name} ${c.last_name}`)}
                        </div>
                      ))}
                    </div>
                    <span className="trip-multi-label">{customerCount} travelers ▾</span>
                  </>
                ) : (
                  <>
                    <div className="avatar-sm" style={{ background: col }}>{initials(trav)}</div>
                    <div className="trip-traveler-name">{trav}</div>
                  </>
                )}
              </div>

              <div className="trip-destination trip-cell">{whereFrom(t)}</div>

              <div className="trip-cell">
                <div className="trip-status" style={{ background: sm.bg, color: sm.fg }}>{sm.display}</div>
              </div>

              <div className="trip-value trip-cell">
                {t.budget ? `GHS ${Number(t.budget).toLocaleString()}` : '—'}
              </div>

              {/* Overview button */}
              <div className="trip-cell trip-actions-cell" onClick={e => e.stopPropagation()}>
                <button className="trip-overview-btn" onClick={(e) => openOverview(t, e)} title="Trip overview">
                  Overview
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Multi-traveller popup ── */}
      {travelerPopup && (
        <div
          ref={popupRef}
          className="trip-traveler-popup"
          style={{
            top: travelerPopup.rect.bottom + 8 + window.scrollY,
            left: travelerPopup.rect.left + window.scrollX,
          }}
        >
          <div className="trip-tp-header">
            <span className="trip-tp-title">{travelerPopup.customers.length} Travelers</span>
            <button className="trip-tp-close" onClick={() => setTravelerPopup(null)}>✕</button>
          </div>
          <div className="trip-tp-search-wrap">
            <input
              className="trip-tp-search"
              placeholder="Search by name…"
              value={popupSearch}
              onChange={e => setPopupSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="trip-tp-list">
            {travelerPopup.customers
              .filter(c => !popupSearch || `${c.first_name} ${c.last_name}`.toLowerCase().includes(popupSearch.toLowerCase()))
              .map((c, ci) => (
                <div key={c.customer_id} className="trip-tp-row">
                  <div className="trip-tp-avatar" style={{ background: avatarColors[ci % avatarColors.length] }}>
                    {initials(`${c.first_name} ${c.last_name}`)}
                  </div>
                  <span className="trip-tp-name">{c.first_name} {c.last_name}</span>
                  {c.pivot?.role && <span className="trip-tp-role">{c.pivot.role}</span>}
                  <button
                    className="trip-tp-remove-btn"
                    onClick={() => handlePopupRemoveTraveler(c.customer_id)}
                    disabled={popupRemoving === c.customer_id}
                    title="Remove from trip"
                  >
                    {popupRemoving === c.customer_id ? '…' : '×'}
                  </button>
                </div>
              ))
            }
          </div>

          {popupAddMode ? (
            <div className="trip-tp-add-section">
              <input
                className="trip-tp-search"
                placeholder="Search travelers…"
                value={popupAddSearch}
                onChange={e => setPopupAddSearch(e.target.value)}
                autoFocus
              />
              <div className="trip-tp-add-list">
                {popupAllCustomers
                  .filter(c => !travelerPopup.customers.some(e => e.customer_id === c.customer_id))
                  .filter(c => !popupAddSearch || `${c.first_name} ${c.last_name}`.toLowerCase().includes(popupAddSearch.toLowerCase()))
                  .slice(0, 6)
                  .map(c => (
                    <div
                      key={c.customer_id}
                      className="trip-tp-row trip-tp-add-opt"
                      onClick={() => handlePopupAddTraveler(c)}
                    >
                      <div className="trip-tp-avatar" style={{ background: avatarColors[0] }}>
                        {initials(`${c.first_name} ${c.last_name}`)}
                      </div>
                      <span className="trip-tp-name">{c.first_name} {c.last_name}</span>
                      {popupAdding === c.customer_id && <span className="trip-tp-role">Adding…</span>}
                    </div>
                  ))
                }
              </div>
              <button className="trip-tp-cancel-add" onClick={() => { setPopupAddMode(false); setPopupAddSearch(''); }}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="trip-tp-footer">
              <button className="trip-tp-add-traveler-btn" onClick={openPopupAddMode}>+ Add traveler</button>
              <button
                className="trip-tp-detail-btn"
                onClick={() => { setTravelerPopup(null); navigate(`/app/trips/${travelerPopup.tripId}`); }}
              >
                Open trip →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Trip overview modal ── */}
      {overviewTrip && (
        <div className="trips-modal-backdrop" onClick={() => setOverviewTrip(null)}>
          <div className="trips-overview-modal" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="tov-header">
              <div>
                <div className="tov-title">{overviewTrip.trip_name}</div>
                <div className="tov-meta">
                  {formatDates(overviewTrip.start_date, overviewTrip.end_date)}
                  {overviewTrip.description && <span> · {overviewTrip.description.split('.')[0]}</span>}
                </div>
              </div>
              <div className="tov-header-right">
                {(() => {
                  const sm = statusMeta[overviewTrip.status ?? ''] ?? { display: overviewTrip.status as TripStatus, bg: '#EEF0F4', fg: '#5B6172' };
                  return <span className="trip-status" style={{ background: sm.bg, color: sm.fg }}>{sm.display}</span>;
                })()}
                <button className="tov-close" onClick={() => setOverviewTrip(null)}>✕</button>
              </div>
            </div>

            {/* Stats row */}
            <div className="tov-stats">
              <div className="tov-stat">
                <div className="tov-stat-num">{overviewTrip.customers?.length ?? 0}</div>
                <div className="tov-stat-label">Travelers</div>
              </div>
              <div className="tov-stat">
                <div className="tov-stat-num">{overviewTrip.budget ? `GHS ${Number(overviewTrip.budget).toLocaleString()}` : '—'}</div>
                <div className="tov-stat-label">Trip budget</div>
              </div>
              {overviewCosts && (
                <>
                  <div className="tov-stat">
                    <div className="tov-stat-num tov-stat-num--green">GHS {Number(overviewCosts.summary.total_paid).toLocaleString()}</div>
                    <div className="tov-stat-label">Paid</div>
                  </div>
                  <div className="tov-stat">
                    <div className="tov-stat-num tov-stat-num--red">GHS {Number(overviewCosts.summary.outstanding).toLocaleString()}</div>
                    <div className="tov-stat-label">Outstanding</div>
                  </div>
                </>
              )}
            </div>

            <div className="tov-body">
              {/* Travelers section */}
              <div className="tov-section">
                <div className="tov-section-title">Travelers</div>
                {(overviewTrip.customers?.length ?? 0) === 0 ? (
                  <div className="tov-empty">No travelers assigned to this trip.</div>
                ) : overviewTrip.customers!.map((c, ci) => (
                  <div key={c.customer_id} className="tov-traveler-row">
                    <div className="tov-traveler-avatar" style={{ background: avatarColors[ci % avatarColors.length] }}>
                      {initials(`${c.first_name} ${c.last_name}`)}
                    </div>
                    <div className="tov-traveler-info">
                      <div className="tov-traveler-name">{c.first_name} {c.last_name}</div>
                      {c.pivot?.role && <div className="tov-traveler-role">{c.pivot.role}</div>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Payment status — only for booked/completed */}
              {isBooked(overviewTrip.status ?? '') && (
                <div className="tov-section">
                  <div className="tov-section-title">Payment activity</div>
                  {loadingCosts ? (
                    <div className="tov-empty">Loading payment data…</div>
                  ) : overviewCosts && overviewCosts.payments.length > 0 ? (
                    <>
                      {overviewCosts.payments.map((p, i) => (
                        <div key={i} className="tov-payment-row">
                          <div className="tov-payment-icon">💳</div>
                          <div className="tov-payment-info">
                            <div className="tov-payment-method">{p.payment_method ?? 'Payment'}</div>
                            {p.paid_at && <div className="tov-payment-date">{new Date(p.paid_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
                            {p.notes && <div className="tov-payment-notes">{p.notes}</div>}
                          </div>
                          <div className="tov-payment-amount">
                            <span className={`tov-payment-status tov-payment-status--${p.status}`}>{p.status}</span>
                            <span className="tov-payment-value">{p.currency} {Number(p.amount).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                      <div className="tov-payment-summary">
                        <div className="tov-ps-row"><span>Total paid</span><span className="tov-ps-paid">GHS {Number(overviewCosts.summary.total_paid).toLocaleString()}</span></div>
                        {overviewCosts.summary.total_pending > 0 && <div className="tov-ps-row"><span>Pending</span><span className="tov-ps-pending">GHS {Number(overviewCosts.summary.total_pending).toLocaleString()}</span></div>}
                        <div className="tov-ps-row tov-ps-row--outstanding"><span>Outstanding</span><span>GHS {Number(overviewCosts.summary.outstanding).toLocaleString()}</span></div>
                      </div>
                    </>
                  ) : (
                    <div className="tov-empty">No payments recorded yet.</div>
                  )}
                </div>
              )}

              {/* Reviews — only for completed trips */}
              {overviewTrip.status === 'completed' && (
                <div className="tov-section">
                  <div className="tov-section-title">Reviews</div>
                  <div className="tov-reviews-empty">
                    <div className="tov-reviews-icon">⭐</div>
                    <p>No reviews yet for this trip.</p>
                    <p>After the trip, travelers can submit feedback here.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="tov-footer">
              <button className="tov-open-btn" onClick={() => { setOverviewTrip(null); navigate(`/app/trips/${overviewTrip.trip_id}`); }}>
                Open full trip →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
