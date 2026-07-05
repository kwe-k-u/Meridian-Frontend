import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { ApiService } from '../services/api-service';
import type { TripResponse, Day } from '../types/app';
import logoM from '../assets/logo/logo_m.svg';
import '../styles/TravelerView.css';

// ── TravelerView ─────────────────────────────────────────────
// Purpose: The read-only, publicly-shareable "trip pack" page a traveler sees (day-by-day
// itinerary, total price, accept/request-changes buttons) — the equivalent of TripDetail.tsx
// but branded for the end customer rather than the agency. Deliberately keeps its own local
// copies of dayToBlocks/travDaysToDays/fmtDateRange instead of importing from AppContext.tsx
// or TripDetail.tsx, so this page renders independently even if those change.
// State: apiTrip (only for real, non-numeric trip ids).
// API: ApiService.getTrip (real trips only — mock trips fall back to ctx.getTripDetail/getDays).
export default function TravelerView() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const ctx = useApp();
  const isRealId = tripId ? !/^\d+$/.test(tripId) : false;

  const [apiTrip, setApiTrip] = useState<TripResponse | null>(null);

  useEffect(() => {
    if (!tripId || !isRealId) return;
    ApiService.getTrip(tripId).then(setApiTrip).catch(() => {});
  }, [tripId, isRealId]);

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
      </div>

      <div className="tv__footer">
        <div>
          <div className="tv__total-label">Total</div>
          <div className="tv__total-value">{td.value}</div>
        </div>
        <div className="tv__footer-actions">
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
        </div>
      </div>
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

function fmtDateRange(start: string | null, end: string | null): string {
  if (!start) return 'TBD';
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (!e || s.getTime() === e.getTime()) return s.toLocaleDateString('en-US', opts);
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
