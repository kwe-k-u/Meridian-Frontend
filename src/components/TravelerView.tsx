import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { ApiService } from '../services/api-service';
import type { TripResponse, TripCostResponse, Day } from '../types/app';
import logoM from '../assets/logo/logo_m.svg';
import '../styles/TravelerView.css';

// ── TravelerView ─────────────────────────────────────────────
// Purpose: The read-only, publicly-shareable "trip pack" page a traveler sees (booked flights,
// booked stays, day-by-day itinerary, payment history, and either accept/request-changes or a
// Pay button depending on trip status) — the equivalent of TripDetail.tsx but branded for the
// end customer rather than the agency. Deliberately keeps its own local copies of
// dayToBlocks/travDaysToDays/fmtDateRange instead of importing from AppContext.tsx or
// TripDetail.tsx, so this page renders independently even if those change.
// State: apiTrip/tripCosts (only for real, non-numeric trip ids), pay modal state.
// API: ApiService.getPublicTrip/getPublicTripCosts (real trips only — mock trips fall back to
// ctx.getTripDetail/getDays and never show flights/stays/payment history or the Pay flow,
// since there's no real trip behind them), ApiService.initiatePublicMoolreTripPayment.
const MIN_CUSTOM_PAYMENT = 50;

export default function TravelerView() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const ctx = useApp();
  const isRealId = tripId ? !/^\d+$/.test(tripId) : false;

  const [apiTrip, setApiTrip] = useState<TripResponse | null>(null);
  const [tripCosts, setTripCosts] = useState<TripCostResponse | null>(null);

  useEffect(() => {
    if (!tripId || !isRealId) return;
    ApiService.getPublicTrip(tripId).then(setApiTrip).catch(() => {});
    ApiService.getPublicTripCosts(tripId).then(setTripCosts).catch(() => {});
  }, [tripId, isRealId]);

  // Pay flow — reachable once the trip is anything besides 'inquiry' (still being put
  // together, nothing to pay yet). Two modes: pay the outstanding balance in full, or a
  // traveler-chosen amount between MIN_CUSTOM_PAYMENT and the outstanding balance.
  const [payOpen, setPayOpen] = useState(false);
  const [payMode, setPayMode] = useState<'full' | 'custom'>('full');
  const [customAmount, setCustomAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  const outstanding = tripCosts?.summary.outstanding ?? 0;
  const payCurrency = tripCosts?.itineraries[0]?.currency ?? 'GHS';
  const canPayCustom = outstanding >= MIN_CUSTOM_PAYMENT;
  const showPayFlow = apiTrip != null && apiTrip.status !== 'inquiry';

  const openPay = () => {
    setPayMode('full');
    setCustomAmount('');
    setPayError('');
    setPayOpen(true);
  };

  const handlePay = async () => {
    if (!tripId) return;
    const amount = payMode === 'full' ? outstanding : Number(customAmount);

    if (payMode === 'custom') {
      if (!customAmount || Number.isNaN(amount)) {
        setPayError('Enter an amount.');
        return;
      }
      if (amount < MIN_CUSTOM_PAYMENT) {
        setPayError(`Minimum payment is ${payCurrency} ${MIN_CUSTOM_PAYMENT}.`);
        return;
      }
      if (amount > outstanding) {
        setPayError(`Amount can't exceed the outstanding balance of ${payCurrency} ${outstanding.toLocaleString()}.`);
        return;
      }
    }

    setPayError('');
    setPaying(true);
    try {
      const { authorization_url } = await ApiService.initiatePublicMoolreTripPayment(tripId, amount);
      window.location.href = authorization_url;
    } catch (error) {
      setPayError(error instanceof Error ? error.message : 'Could not start the payment. Please try again.');
      setPaying(false);
    }
  };

  const mockTid = tripId ? (isRealId ? 0 : parseInt(tripId, 10)) : 0;
  const { td: mockTd } = ctx.getTripDetail(mockTid, 'A');

  const td = useMemo(() => {
    if (!apiTrip) return mockTd;
    const trav = apiTrip.customers?.[0]
      ? `${apiTrip.customers[0].first_name} ${apiTrip.customers[0].last_name}`
      : 'Traveler';
    const where = apiTrip.description?.split('.')[0] ?? apiTrip.trip_name;
    return {
      ...mockTd,
      name: apiTrip.trip_name,
      traveler: trav,
      where,
      dates: apiTrip.start_date
        ? fmtDateRange(apiTrip.start_date, apiTrip.end_date)
        : mockTd.dates,
      value: apiTrip.budget ? `GHS ${Number(apiTrip.budget).toLocaleString()}` : mockTd.value,
    };
  }, [apiTrip, mockTd]);

  const rawDays = useMemo(() => {
    if (!apiTrip) return ctx.getDays(mockTid, 'A');
    const itin = apiTrip.itineraries?.[0];
    if (itin?.itinerary_days?.length) {
      return travDaysToDays(itin.itinerary_days);
    }
    return [];
  }, [apiTrip, ctx, mockTid]);

  const days = rawDays.map((d, di) => ({ ...d, di: d.di ?? di }));

  // Flights/stays booked for the trip — real trips only (see the file-header comment on why
  // mock trips don't surface this), pulled straight off the first itinerary option.
  const flights = apiTrip?.itineraries?.[0]?.itinerary_flights ?? [];
  const stays = apiTrip?.itineraries?.[0]?.itinerary_accommodation ?? [];

  // Itinerary/Payments toggle — mirrors TripDetail.tsx's builderTab tabs bar, but local state
  // here since TravelerView deliberately doesn't share AppContext's builder state with the
  // agency-facing page (see file-header comment).
  const [activeTab, setActiveTab] = useState<'itinerary' | 'payments'>('itinerary');
  const payments = tripCosts?.payments ?? [];

  return (
    <div className="tv">
      <div className="tv__header">
        <div className="tv__logo">
          <img src={logoM} alt="Meridian" className="tv__logo-img" />
          <span className="tv__brand">Meridian</span>
        </div>
        <div className="tv__header-right">
          <span className="tv__prepared">Prepared for you by Oasis Travel Agency</span>
          <button
            onClick={() => navigate('/app/trips/' + (isRealId && tripId ? tripId : mockTid))}
            className="tv__back-btn"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
            Back to workspace
          </button>
        </div>
      </div>

      <div className="tv__container">
        <div className="tv__hero">
          <div className="tv__hero-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="10" r="3"/>
              <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/>
            </svg>
            {td.where}
          </div>
          <h1 className="tv__hero-title">
            {td.name}
          </h1>
          <p className="tv__hero-sub">
            {td.dates} · for {td.traveler}
          </p>
        </div>

        <div className="tv__tabs-bar">
          <button
            className={'tv__tab-btn' + (activeTab === 'itinerary' ? ' tv__tab-btn--active' : '')}
            onClick={() => setActiveTab('itinerary')}
          >
            Itinerary
          </button>
          <button
            className={'tv__tab-btn' + (activeTab === 'payments' ? ' tv__tab-btn--active' : '')}
            onClick={() => setActiveTab('payments')}
          >
            Payments
          </button>
        </div>

        {activeTab === 'itinerary' ? (
          <>
            {flights.length > 0 && (
              <>
                <h2 className="tv__section-title">Flights</h2>
                <div className="tv__flights">
                  {flights.map((f) => (
                    <div key={f.flight_id} className="tv__travel-card">
                      <div className="tv__travel-icon">✈️</div>
                      <div className="tv__travel-body">
                        <div className="tv__travel-title">
                          {f.departure_airport ?? 'TBD'} → {f.arrival_airport ?? 'TBD'}
                        </div>
                        <div className="tv__travel-meta">
                          {[f.airline, f.flight_number].filter(Boolean).join(' ') || 'Airline TBD'}
                        </div>
                        <div className="tv__travel-sub">
                          {fmtFlightTime(f.departure_datetime)} – {fmtFlightTime(f.arrival_datetime)}
                        </div>
                      </div>
                      <div className="tv__travel-side">
                        {f.cost != null && (
                          <div className="tv__travel-price">{f.currency ?? 'GHS'} {Number(f.cost).toLocaleString()}</div>
                        )}
                        <span className={`tv__travel-status tv__travel-status--${f.status}`}>{f.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {stays.length > 0 && (
              <>
                <h2 className="tv__section-title">Stays</h2>
                <div className="tv__stays">
                  {stays.map((s) => (
                    <div key={s.accommodation_id} className="tv__travel-card">
                      <div className="tv__travel-icon">🏨</div>
                      <div className="tv__travel-body">
                        <div className="tv__travel-title">{s.accommodation_name}</div>
                        <div className="tv__travel-meta">
                          {[s.room_type, s.address].filter(Boolean).join(' · ') || 'Room details TBD'}
                        </div>
                        <div className="tv__travel-sub">{fmtDateRange(s.check_in_date, s.check_out_date)}</div>
                      </div>
                      <div className="tv__travel-side">
                        {s.cost != null && (
                          <div className="tv__travel-price">{s.currency ?? 'GHS'} {Number(s.cost).toLocaleString()}</div>
                        )}
                        <span className={`tv__travel-status tv__travel-status--${s.status}`}>{s.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <h2 className="tv__section-title">Day by day</h2>

            {days.length === 0 && (
              <p style={{ color: '#8A90A2', textAlign: 'center', padding: 40 }}>
                No itinerary days yet.
              </p>
            )}

            {days.map((day, di) => (
              <div key={di} className="tv__day-row">
                <div className="tv__day-col">
                  <div className="tv__day-dow">{day.dow}</div>
                  <div className="tv__day-num">{day.day}</div>
                  <div className="tv__day-mon">{day.mon}</div>
                </div>
                <div className="tv__timeline">
                  <div className="tv__timeline-dot" />
                </div>
                <div className="tv__day-content">
                  <div className="tv__day-title">{day.title}</div>
                  {day.blocks.map((block, bi) => (
                    <div key={bi} className="tv__block">
                      <div className="tv__block-icon" style={{ background: block.iconBg || '#EEF0F4' }}>
                        {block.icon}
                      </div>
                      <div className="tv__block-body">
                        <div className="tv__block-meta-row">
                          <span className="tv__block-kind" style={{ color: block.kindColor }}>{block.kind}</span>
                          {block.meta && (
                            <span className="tv__block-meta">· {block.meta}</span>
                          )}
                        </div>
                        <div className="tv__block-title">{block.title}</div>
                        {block.sub && (
                          <div className="tv__block-sub">{block.sub}</div>
                        )}
                        {block.price && (
                          <div className="tv__block-price">{block.price}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            {payments.length === 0 ? (
              <p style={{ color: '#8A90A2', textAlign: 'center', padding: 40 }}>
                No payments yet.
              </p>
            ) : (
              <div className="tv__payments">
                {payments.map((p) => (
                  <div key={p.transaction_id} className="tv__payment-row">
                    <div className="tv__payment-info">
                      <div className="tv__payment-amount">{p.currency} {p.amount.toLocaleString()}</div>
                      <div className="tv__payment-meta">
                        {p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Awaiting payment'}
                        {p.payment_method ? ` · ${p.payment_method}` : ''}
                      </div>
                    </div>
                    <span className={`tv__payment-status tv__payment-status--${p.status}`}>{p.status}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="tv__footer">
        <div>
          <div className="tv__total-label">{showPayFlow ? 'Outstanding balance' : 'Total'}</div>
          <div className="tv__total-value">{showPayFlow ? `${payCurrency} ${outstanding.toLocaleString()}` : td.value}</div>
        </div>
        <div className="tv__footer-actions">
          {showPayFlow ? (
            outstanding > 0 ? (
              <button onClick={openPay} className="tv__btn-accept">
                Pay now
              </button>
            ) : (
              <span className="tv__paid-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Fully paid
              </span>
            )
          ) : (
            <>
              <button
                onClick={() => ctx.toastAction('Change request sent')}
                className="tv__btn-secondary"
              >
                Request changes
              </button>
              <button
                onClick={() => {
                  ctx.toastAction('Trip accepted by traveler');
                  navigate('/app/trips/' + (isRealId && tripId ? tripId : mockTid));
                }}
                className="tv__btn-accept"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Accept this trip
              </button>
            </>
          )}
        </div>
      </div>

      {payOpen && (
        <div className="tv__pay-backdrop" onClick={() => !paying && setPayOpen(false)}>
          <div className="tv__pay-card" onClick={e => e.stopPropagation()}>
            <h3 className="tv__pay-title">Pay for your trip</h3>
            <p className="tv__pay-sub">Outstanding balance: {payCurrency} {outstanding.toLocaleString()}</p>

            <label className="tv__pay-option">
              <input type="radio" name="pay-mode" checked={payMode === 'full'} onChange={() => setPayMode('full')} />
              <span>Pay outstanding balance in full — {payCurrency} {outstanding.toLocaleString()}</span>
            </label>

            {canPayCustom && (
              <label className="tv__pay-option">
                <input type="radio" name="pay-mode" checked={payMode === 'custom'} onChange={() => setPayMode('custom')} />
                <span>Pay a different amount</span>
              </label>
            )}

            {payMode === 'custom' && canPayCustom && (
              <div className="tv__pay-amount-field">
                <span className="tv__pay-amount-prefix">{payCurrency}</span>
                <input
                  type="number"
                  min={MIN_CUSTOM_PAYMENT}
                  max={outstanding}
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value)}
                  placeholder={`${MIN_CUSTOM_PAYMENT} - ${outstanding}`}
                />
              </div>
            )}

            {payError && <div className="tv__pay-error">{payError}</div>}

            <div className="tv__pay-actions">
              <button onClick={() => setPayOpen(false)} className="tv__btn-secondary" disabled={paying}>Cancel</button>
              <button onClick={handlePay} className="tv__btn-accept" disabled={paying}>
                {paying ? 'Redirecting…' : 'Continue to payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Local helpers (mirror AppContext transformers for independence) ──

interface ItinDayLike {
  date: string | null;
  day_number: number;
  title: string | null;
  description: string | null;
  location: string | null;
  destinations?: {
    destination_id: string;
    cost: string | null;
    currency: string | null;
    activities: string | null;
    booking_url: string | null;
    destination?: { destination_id: string; name: string; country: string };
  }[];
}

const kindMeta: Record<string, { icon: string; iconBg: string; kindColor: string }> = {
  Flight: { icon: '✈️', iconBg: '#EAF0FF', kindColor: '#2B63F6' },
  Transfer: { icon: '🚐', iconBg: '#E3F7EF', kindColor: '#0E9F6E' },
  Stay: { icon: '🏨', iconBg: '#F0EBFF', kindColor: '#6B46C1' },
  Dining: { icon: '🍽️', iconBg: '#FFF3E0', kindColor: '#B7791F' },
  Activity: { icon: '⭐', iconBg: '#E3F7EF', kindColor: '#0E9F6E' },
  Venue: { icon: '🏢', iconBg: '#EAF0FF', kindColor: '#2B63F6' },
};

function dayToBlocks(day: ItinDayLike) {
  const blocks: { kind: string; kindColor: string; icon: string; iconBg: string; meta: string; title: string; sub: string; price: string }[] = [];
  if (day.destinations) {
    day.destinations.forEach(d => {
      const m = kindMeta.Activity;
      blocks.push({
        kind: 'Activity',
        kindColor: m.kindColor,
        icon: m.icon,
        iconBg: m.iconBg,
        meta: d.destination?.country ?? '',
        title: d.destination?.name ?? d.activities ?? 'Activity',
        sub: d.activities ?? '',
        price: d.cost ? `${d.currency ?? ''} ${d.cost}` : '',
      });
    });
  }
  if (day.location) {
    const m = kindMeta.Transfer;
    blocks.push({
      kind: 'Location',
      kindColor: m.kindColor,
      icon: '📍',
      iconBg: m.iconBg,
      meta: '',
      title: day.location,
      sub: day.description ?? '',
      price: '',
    });
  }
  return blocks;
}

function travDaysToDays(itineraryDays: ItinDayLike[]): Day[] {
  return itineraryDays.map((d, i) => {
    const dt = d.date ? new Date(d.date) : null;
    return {
      di: i,
      dow: dt ? dt.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() : '',
      day: dt ? String(dt.getDate()).padStart(2, '0') : String(d.day_number),
      mon: dt ? dt.toLocaleDateString('en-US', { month: 'short' }) : '',
      title: d.title ?? `Day ${d.day_number}`,
      blocks: dayToBlocks(d),
      hasSuggestion: false,
      addBlock: () => {},
    };
  });
}

function fmtFlightTime(dt: string | null): string {
  if (!dt) return 'TBD';
  const d = new Date(dt.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return 'TBD';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fmtDateRange(start: string | null, end: string | null): string {
  if (!start) return 'TBD';
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (!e || s.getTime() === e.getTime()) return s.toLocaleDateString('en-US', opts);
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
