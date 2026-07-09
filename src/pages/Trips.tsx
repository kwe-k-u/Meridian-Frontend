import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrency } from '../contexts/CurrencyContext';
import { ApiService } from '../services/api-service';
import type { TripResponse, TripStatus } from '../types/app';
import '../styles/Trips.css';

// ── Trips ──────────────────────────────────────────────────────
// Purpose: Lists all trips with status filters, showing traveler,
//          destination, status badge, and value per trip.
// State: activeFilter, trips, loading, error.
// API: ApiService.getTrips.

// Same backend-status -> display-label mapping as AppContext.tsx's apiStatusMeta and
// TripDetail.tsx's local copy (kept separate rather than shared/imported).
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

export default function Trips() {
  const navigate = useNavigate();
  const { format } = useCurrency();
  const [activeFilter, setActiveFilter] = useState(0);
  const [trips, setTrips] = useState<TripResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    ApiService.getTrips()
      .then(res => { if (!cancelled) setTrips(res.data); })
      .catch(() => { if (!cancelled) setError('Failed to load trips'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = trips.filter(t => filterDefs[activeFilter].match(t.status));

  return (
    <div className="trips-container">
      <div className="filter-bar">
        {filterDefs.map((f, i) => (
          <button
            key={f.label}
            onClick={() => setActiveFilter(i)}
            className={`filter-pill${i === activeFilter ? ' active' : ''}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="trips-header trips-grid">
        {['Trip', 'Traveler', 'Destinations', 'Status', 'Value'].map(h => (
          <div
            key={h}
            className={`trips-header-cell${h === 'Value' ? ' trips-header-cell-right' : ''}`}
          >
            {h}
          </div>
        ))}
      </div>

      <div>
        {loading && <div className="trips-empty">Loading trips...</div>}
        {error && <div className="trips-empty">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="trips-empty">No trips found.</div>
        )}
        {filtered.map((t, i) => {
          const sm = statusMeta[t.status] ?? { display: t.status as TripStatus, bg: '#EEF0F4', fg: '#5B6172' };
          const trav = travelerName(t);
          const grad = avatarGradients[i % avatarGradients.length];
          const col = avatarColors[i % avatarColors.length];
          return (
            <div
              key={t.trip_id}
              onClick={() => navigate(`/app/trips/${t.trip_id}`)}
              className="trips-row trips-grid"
            >
              <div className="trip-name-group">
                <div className="trip-avatar-wrap">
                  <div className="trip-cover" style={{ background: grad }} />
                  <div className="trip-badge">1</div>
                </div>
                <div className="trip-text-group">
                  <div className="trip-name">{t.trip_name}</div>
                  <div className="trip-dates">{formatDates(t.start_date, t.end_date)}</div>
                </div>
              </div>

              <div className="trip-traveler-group">
                <div className="avatar-sm" style={{ background: col }}>
                  {initials(trav)}
                </div>
                <div className="trip-traveler-name">{trav}</div>
              </div>

              <div className="trip-destination trip-cell">{whereFrom(t)}</div>

              <div className="trip-cell">
                <div className="trip-status" style={{ background: sm.bg, color: sm.fg }}>
                  {sm.display}
                </div>
              </div>

              <div className="trip-value trip-cell">
                {t.budget ? format(Number(t.budget), 'GHS') : '—'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
