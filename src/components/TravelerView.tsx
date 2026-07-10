import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { ApiService } from '../services/api-service';
import type { TripResponse, ItineraryResponse } from '../types/app';
import logoM from '../assets/logo/logo_m.svg';
import '../styles/TravelerView.css';

// ── TravelerView ─────────────────────────────────────────────
// Public shareable trip-pack page for travelers. Shows ALL itinerary options
// as expandable cards so travelers can compare and accept. No auth required.
// The ?option=A URL param pre-expands a specific option (used when the agent
// shares a targeted link). The "Request changes" form logs feedback to the trip
// (as a call note) so the agent can action it via TripDetail's Calls tab.

export default function TravelerView() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const ctx = useApp();
  const isRealId = tripId ? !/^\d+$/.test(tripId) : false;
  const mockTid = tripId ? (isRealId ? 0 : parseInt(tripId, 10)) : 0;

  // ?option=A → pre-expand that card
  const urlOption = new URLSearchParams(location.search).get('option')?.toUpperCase() ?? null;

  const [apiTrip, setApiTrip] = useState<TripResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedOption, setExpandedOption] = useState<string | null>(urlOption);
  const [acceptedOption, setAcceptedOption] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackName, setFeedbackName] = useState('');
  const [feedbackOptionLetter, setFeedbackOptionLetter] = useState<string | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    if (!tripId || !isRealId) { setLoading(false); return; }
    setLoading(true);
    ApiService.getTrip(tripId)
      .then(setApiTrip)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tripId, isRealId]);

  const { td: mockTd } = ctx.getTripDetail(mockTid, 'A');

  const tripName = apiTrip?.trip_name ?? mockTd.name;
  const tripWhere = apiTrip?.description?.split('.')[0] ?? apiTrip?.trip_name ?? mockTd.where;
  const travelerNames = apiTrip
    ? (apiTrip.customers ?? []).map(c => `${c.first_name} ${c.last_name}`).join(', ') || 'Traveler'
    : mockTd.traveler;
  const tripDates = apiTrip?.start_date ? fmtDateRange(apiTrip.start_date, apiTrip.end_date) : mockTd.dates;
  const agentName = apiTrip?.created_by
    ? (typeof apiTrip.created_by === 'object' ? (apiTrip.created_by as { display_name?: string }).display_name ?? 'Your travel agent' : 'Your travel agent')
    : 'Your travel agent';

  const itineraries: ItineraryResponse[] = apiTrip?.itineraries ?? [];
  const isAgent = !!(ctx as unknown as { user?: unknown }).user;

  const computeOptionCost = (itin: ItineraryResponse) => {
    const fc = (itin.itinerary_flights ?? []).reduce((s, f) => s + (f.cost ?? 0), 0);
    const sc = (itin.itinerary_accommodation ?? []).reduce((s, a) => s + (a.cost ?? 0), 0);
    const ac = (itin.itinerary_days ?? []).reduce((s, d) =>
      s + (d.destinations ?? []).reduce((s2, dst) => s2 + Number(dst.cost ?? 0), 0), 0);
    const cur = itin.itinerary_flights?.[0]?.currency
      ?? itin.itinerary_accommodation?.[0]?.currency
      ?? itin.itinerary_days?.flatMap(d => d.destinations ?? []).find(dst => dst.currency)?.currency
      ?? 'GHS';
    const sub = fc + sc + ac;
    const fee = Math.round(sub * 0.05);
    const total = sub + fee;
    const fmt = (n: number) => n > 0 ? `${cur} ${n.toLocaleString()}` : '—';
    return { flights: fmt(fc), accommodation: fmt(sc), activities: fmt(ac), fee: fmt(fee), total: fmt(total), hasData: total > 0 };
  };

  const handleAcceptOption = async (itin: ItineraryResponse, letter: string) => {
    setAccepting(true);
    try {
      if (isRealId) await ApiService.updateItinerary(itin.itinerary_id, { status: 'confirmed' });
    } catch { /* optimistic */ }
    finally {
      setAccepting(false);
      setAcceptedOption(letter);
    }
  };

  const openFeedback = (letter: string | null = null) => {
    setFeedbackOptionLetter(letter);
    setFeedbackSent(false);
    setFeedbackText('');
    setFeedbackName('');
    setFeedbackOpen(true);
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) return;
    setSubmittingFeedback(true);
    if (apiTrip) {
      try {
        await ApiService.createCall({
          trip_id: apiTrip.trip_id,
          title: `Traveler change request${feedbackOptionLetter ? ' · Option ' + feedbackOptionLetter : ''}${feedbackName ? ' from ' + feedbackName : ''}`,
          notes: feedbackText.trim(),
          started_at: new Date().toISOString(),
        });
      } catch { /* silent — agent can still see feedback in email */ }
    }
    setSubmittingFeedback(false);
    setFeedbackSent(true);
  };

  // ── Render ──

  if (loading) {
    return (
      <div className="tv">
        <div className="tv__loading">Loading your trip…</div>
      </div>
    );
  }

  return (
    <div className="tv">
      {/* Header */}
      <div className="tv__header">
        <div className="tv__logo">
          <img src={logoM} alt="Meridian" className="tv__logo-img" />
          <span className="tv__brand">Meridian</span>
        </div>
        <div className="tv__header-right">
          <span className="tv__prepared">Prepared for you by {agentName}</span>
          {isAgent && (
            <button
              onClick={() => navigate('/app/trips/' + (isRealId && tripId ? tripId : mockTid))}
              className="tv__back-btn"
            >
              ← Back to workspace
            </button>
          )}
        </div>
      </div>

      <div className="tv__container">
        {/* Hero */}
        <div className="tv__hero">
          <div className="tv__hero-badge">
            <span>📍</span>
            {tripWhere}
          </div>
          <h1 className="tv__hero-title">{tripName}</h1>
          <p className="tv__hero-sub">{tripDates} · {travelerNames}</p>
          {itineraries.length > 0 && (
            <div className="tv__hero-count">
              {itineraries.length} itinerary option{itineraries.length !== 1 ? 's' : ''} ready to explore
            </div>
          )}
        </div>

        {/* Trip overview — structured database fields */}
        {apiTrip && (
          <div className="tv__overview">
            <div className="tv__overview-fields">
              {(apiTrip.start_date || apiTrip.end_date) && (
                <div className="tv__ov-field">
                  <span className="tv__ov-key">Travel dates</span>
                  <span className="tv__ov-val">{fmtDateRange(apiTrip.start_date, apiTrip.end_date)}</span>
                </div>
              )}
              {apiTrip.start_date && apiTrip.end_date && (
                <div className="tv__ov-field">
                  <span className="tv__ov-key">Duration</span>
                  <span className="tv__ov-val">{tripDurationDays(apiTrip.start_date, apiTrip.end_date)} days</span>
                </div>
              )}
              {apiTrip.budget && (
                <div className="tv__ov-field">
                  <span className="tv__ov-key">Budget</span>
                  <span className="tv__ov-val">USD {Number(apiTrip.budget).toLocaleString()}</span>
                </div>
              )}
            </div>
            {itineraries.length > 0 && (
              <div className="tv__ov-includes">
                <span className="tv__ov-includes-label">What's covered:</span>
                <div className="tv__ov-chips">
                  {itineraries.some(it => (it.itinerary_flights ?? []).length > 0) && (
                    <span className="tv__ov-chip tv__ov-chip--flight">✈ Flights</span>
                  )}
                  {itineraries.some(it => (it.itinerary_accommodation ?? []).length > 0) && (
                    <span className="tv__ov-chip tv__ov-chip--hotel">🏨 Hotel</span>
                  )}
                  {itineraries.some(it => (it.itinerary_days ?? []).some(d => (d.destinations ?? []).length > 0)) && (
                    <span className="tv__ov-chip tv__ov-chip--events">🎟 Events & activities</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Accepted success banner */}
        {acceptedOption && (
          <div className="tv__accepted-banner">
            <span className="tv__accepted-icon">✓</span>
            <div>
              <div className="tv__accepted-title">Option {acceptedOption} accepted!</div>
              <div className="tv__accepted-sub">Your travel agent has been notified and will send your full booking confirmation shortly.</div>
            </div>
          </div>
        )}

        {/* Options section */}
        {itineraries.length > 0 ? (
          <>
            <div className="tv__options-intro">
              <h2 className="tv__section-title">Choose your itinerary</h2>
              <p className="tv__options-sub">
                We've crafted {itineraries.length} personalised option{itineraries.length !== 1 ? 's' : ''} just for you.
                {urlOption ? ` Option ${urlOption} has been highlighted for your review.` : ' Tap any card to explore the full details.'}
              </p>
            </div>

            {itineraries.map((itin, i) => {
              const letter = String.fromCharCode(65 + i);
              const isExpanded = expandedOption === letter;
              const isAccepted = acceptedOption === letter;
              const cost = computeOptionCost(itin);
              const days = itin.itinerary_days ?? [];
              const flights = itin.itinerary_flights ?? [];
              const stays = itin.itinerary_accommodation ?? [];
              const isHighlighted = urlOption === letter;

              return (
                <div
                  key={letter}
                  className={`tv__opt-card${isExpanded ? ' tv__opt-card--open' : ''}${isAccepted ? ' tv__opt-card--accepted' : ''}${isHighlighted && !isExpanded ? ' tv__opt-card--highlighted' : ''}`}
                >
                  {/* Card header — always visible, click to expand */}
                  <div className="tv__opt-header" onClick={() => setExpandedOption(isExpanded ? null : letter)}>
                    <div
                      className="tv__opt-letter"
                      style={{ background: isAccepted ? '#13B981' : ['#2B63F6','#13B981','#EB8C2B','#8B5CF6','#EC4899'][i % 5] }}
                    >
                      {isAccepted ? '✓' : letter}
                    </div>
                    <div className="tv__opt-info">
                      <div className="tv__opt-name">
                        {itin.itinerary_name ?? `Option ${letter}`}
                        {isHighlighted && !isAccepted && <span className="tv__opt-highlight-badge">Highlighted for you</span>}
                      </div>
                      <div className="tv__opt-meta">
                        {days.length > 0 && `${days.length} day${days.length !== 1 ? 's' : ''}`}
                        {flights.length > 0 && ` · ${flights.length} flight${flights.length !== 1 ? 's' : ''}`}
                        {stays.length > 0 && ` · ${stays.length} stay${stays.length !== 1 ? 's' : ''}`}
                      </div>
                    </div>
                    <div className="tv__opt-cost-col">
                      {cost.hasData ? (
                        <>
                          <div className="tv__opt-cost-num">{cost.total}</div>
                          <div className="tv__opt-cost-label">est. total</div>
                        </>
                      ) : (
                        <div className="tv__opt-cost-label">See details</div>
                      )}
                    </div>
                    <div className={`tv__opt-chevron${isExpanded ? ' open' : ''}`}>›</div>
                  </div>

                  {/* Expanded body */}
                  {isExpanded && (
                    <div className="tv__opt-body">
                      {/* Cost breakdown */}
                      {cost.hasData && (
                        <div className="tv__cost-table">
                          <div className="tv__cost-row"><span>Flights</span><span>{cost.flights}</span></div>
                          <div className="tv__cost-row"><span>Accommodation</span><span>{cost.accommodation}</span></div>
                          <div className="tv__cost-row"><span>Activities & transfers</span><span>{cost.activities}</span></div>
                          <div className="tv__cost-row tv__cost-fee"><span>Service fee (5%)</span><span>{cost.fee}</span></div>
                          <div className="tv__cost-row tv__cost-total"><span>Total</span><span>{cost.total}</span></div>
                        </div>
                      )}

                      {/* Day-by-day */}
                      {days.length > 0 && (
                        <div className="tv__section">
                          <div className="tv__sub-heading">Day by day</div>
                          {days.map((day, di) => {
                            const dt = day.date ? new Date(day.date) : null;
                            const dayBlocks = buildDayBlocks(day);
                            return (
                              <div key={di} className="tv__day-row">
                                <div className="tv__day-col">
                                  {dt ? (
                                    <>
                                      <div className="tv__day-dow">{dt.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</div>
                                      <div className="tv__day-num">{String(dt.getDate()).padStart(2, '0')}</div>
                                      <div className="tv__day-mon">{dt.toLocaleDateString('en-US', { month: 'short' })}</div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="tv__day-dow"></div>
                                      <div className="tv__day-num">{day.day_number}</div>
                                      <div className="tv__day-mon">Day</div>
                                    </>
                                  )}
                                </div>
                                <div className="tv__timeline"><div className="tv__timeline-dot" /></div>
                                <div className="tv__day-content">
                                  <div className="tv__day-title">{day.title ?? `Day ${day.day_number}`}</div>
                                  {day.location && <div className="tv__day-location">📍 {day.location}</div>}
                                  {dayBlocks.map((block, bi) => (
                                    <div key={bi} className="tv__block">
                                      <div className="tv__block-icon" style={{ background: block.iconBg }}>{block.icon}</div>
                                      <div className="tv__block-body">
                                        <div className="tv__block-meta-row">
                                          <span className="tv__block-kind" style={{ color: block.kindColor }}>{block.kind}</span>
                                          {block.meta && <span className="tv__block-meta">· {block.meta}</span>}
                                        </div>
                                        <div className="tv__block-title">{block.title}</div>
                                        {block.sub && <div className="tv__block-sub">{block.sub}</div>}
                                        {block.price && <div className="tv__block-price">{block.price}</div>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Flights */}
                      {flights.length > 0 && (
                        <div className="tv__section">
                          <div className="tv__sub-heading">✈️ Flights</div>
                          {flights.map((f, fi) => (
                            <div key={fi} className="tv__flight-row">
                              <div className="tv__flight-code">{(f.airline ?? 'XX').substring(0, 2).toUpperCase()}</div>
                              <div className="tv__flight-info">
                                <div className="tv__flight-route">{f.departure_airport ?? '—'} → {f.arrival_airport ?? '—'}</div>
                                <div className="tv__flight-meta">
                                  {f.airline ?? 'Flight'}
                                  {f.departure_datetime && ' · ' + new Date(f.departure_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                              {f.cost && <div className="tv__flight-price">{f.currency ?? ''} {Number(f.cost).toLocaleString()}</div>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Stays */}
                      {stays.length > 0 && (
                        <div className="tv__section">
                          <div className="tv__sub-heading">🏨 Accommodation</div>
                          {stays.map((s, si) => (
                            <div key={si} className="tv__stay-row">
                              <div className="tv__stay-icon">🏨</div>
                              <div className="tv__stay-info">
                                <div className="tv__stay-name">{s.accommodation_name}</div>
                                {s.address && <div className="tv__stay-loc">{s.address}</div>}
                                {s.room_type && <div className="tv__stay-room">{s.room_type}</div>}
                              </div>
                              {s.cost && <div className="tv__stay-price">{s.currency ?? ''} {Number(s.cost).toLocaleString()}<span>/night</span></div>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Accept / Feedback CTA */}
                      <div className="tv__opt-cta">
                        {isAccepted ? (
                          <div className="tv__opt-accepted-msg">
                            ✓ You've accepted this option — your agent will be in touch!
                          </div>
                        ) : (
                          <button
                            className="tv__accept-btn"
                            onClick={() => handleAcceptOption(itin, letter)}
                            disabled={accepting || !!acceptedOption}
                          >
                            {accepting ? 'Confirming…' : `✓ I want Option ${letter}`}
                          </button>
                        )}
                        <button className="tv__feedback-link" onClick={() => openFeedback(letter)}>
                          Something's not right? Let us know →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          <div className="tv__no-options">
            <div className="tv__no-options-icon">✦</div>
            <div className="tv__no-options-title">Your itinerary is being prepared</div>
            <div className="tv__no-options-sub">Your travel agent is crafting personalised options for you. Check back soon!</div>
          </div>
        )}

        {/* General request changes */}
        {itineraries.length > 0 && !acceptedOption && (
          <div className="tv__general-feedback">
            <span>Not seeing what you had in mind?</span>
            <button className="tv__general-feedback-btn" onClick={() => openFeedback(null)}>
              Share your preferences →
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="tv__page-footer">
          <img src={logoM} alt="Meridian" className="tv__footer-logo" />
          <span>Crafted by {agentName} · Powered by Meridian</span>
        </div>
      </div>

      {/* Feedback / change request modal */}
      {feedbackOpen && (
        <div className="tv__feedback-overlay" onClick={e => { if (e.target === e.currentTarget) setFeedbackOpen(false); }}>
          <div className="tv__feedback-modal">
            {feedbackSent ? (
              <div className="tv__feedback-sent">
                <div className="tv__feedback-sent-icon">✓</div>
                <div className="tv__feedback-sent-title">Message received!</div>
                <div className="tv__feedback-sent-sub">Your travel agent will review your feedback and update your options shortly.</div>
                <button className="tv__feedback-close-btn" onClick={() => setFeedbackOpen(false)}>Close</button>
              </div>
            ) : (
              <>
                <div className="tv__feedback-header">
                  <div className="tv__feedback-title">
                    {feedbackOptionLetter ? `Feedback on Option ${feedbackOptionLetter}` : 'Share your preferences'}
                  </div>
                  <button onClick={() => setFeedbackOpen(false)} className="tv__feedback-x">✕</button>
                </div>
                <p className="tv__feedback-desc">
                  Let your travel agent know what you'd like changed or clarified — they'll update your options and send you a fresh link.
                </p>
                <input
                  className="tv__feedback-name"
                  value={feedbackName}
                  onChange={e => setFeedbackName(e.target.value)}
                  placeholder="Your name (optional)"
                />
                <textarea
                  className="tv__feedback-textarea"
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  placeholder={feedbackOptionLetter
                    ? `e.g. I like Option ${feedbackOptionLetter} but could you swap the beach day for a city tour, and look for a hotel closer to the centre?`
                    : `e.g. I'd prefer a more relaxed pace, boutique hotels, and a budget under $5,000…`}
                  rows={5}
                  autoFocus
                />
                <div className="tv__feedback-actions">
                  <button onClick={() => setFeedbackOpen(false)} className="tv__feedback-cancel">Cancel</button>
                  <button
                    onClick={handleSubmitFeedback}
                    disabled={!feedbackText.trim() || submittingFeedback}
                    className="tv__feedback-submit"
                  >
                    {submittingFeedback ? 'Sending…' : 'Send to my agent →'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Local helpers ──

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
    item_type?: string | null;
    booking_url: string | null;
    destination?: { destination_id: string; name: string; country: string };
  }[];
}

const kindMeta: Record<string, { icon: string; iconBg: string; kindColor: string }> = {
  Activity: { icon: '⭐', iconBg: '#E3F7EF', kindColor: '#0E9F6E' },
  Dining:   { icon: '🍽️', iconBg: '#FFF3E0', kindColor: '#B7791F' },
  Transfer: { icon: '🚐', iconBg: '#E3F7EF', kindColor: '#0E9F6E' },
  Venue:    { icon: '🏢', iconBg: '#EAF0FF', kindColor: '#2B63F6' },
};

function buildDayBlocks(day: ItinDayLike) {
  const blocks: { kind: string; kindColor: string; icon: string; iconBg: string; meta: string; title: string; sub: string; price: string }[] = [];
  (day.destinations ?? []).forEach(d => {
    const itemKind = ({ activity: 'Activity', dining: 'Dining', transfer: 'Transfer', venue: 'Venue' } as Record<string, string>)[d.item_type ?? ''] ?? 'Activity';
    const m = kindMeta[itemKind] ?? kindMeta.Activity;
    blocks.push({
      kind: itemKind,
      kindColor: m.kindColor,
      icon: m.icon,
      iconBg: m.iconBg,
      meta: d.destination?.country ?? '',
      title: d.destination?.name ?? d.activities ?? 'Activity',
      sub: d.activities ?? '',
      price: d.cost ? `${d.currency ?? ''} ${d.cost}` : '',
    });
  });
  return blocks;
}

function tripDurationDays(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
}

function fmtDateRange(start: string | null, end: string | null): string {
  if (!start) return 'TBD';
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (!e || s.getTime() === e.getTime()) return s.toLocaleDateString('en-US', opts);
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
