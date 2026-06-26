import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import type { TripItem } from '../types/app';
import '../styles/Trips.css';

const filters: { label: string; filter: (t: TripItem) => boolean; bg: string; fg: string; border: string }[] = [
  { label: 'All', filter: () => true, bg: '#EEF0F4', fg: '#5B6172', border: '#DDE0E8' },
  { label: 'Drafting', filter: (t) => t.status === 'Draft' || t.status === 'AI drafting', bg: '#EAF0FF', fg: '#2B63F6', border: '#C4D2FF' },
  { label: 'Awaiting review', filter: (t) => t.status === 'Awaiting review', bg: '#FFF3E0', fg: '#B7791F', border: '#F5DDB0' },
  { label: 'Shared', filter: (t) => t.status === 'Shared', bg: '#F0EBFF', fg: '#6B46C1', border: '#D4C4F0' },
  { label: 'Confirmed', filter: (t) => t.status === 'Confirmed', bg: '#E3F7EF', fg: '#0E9F6E', border: '#B8E6D4' },
  { label: 'Booked', filter: (t) => t.status === 'Booked', bg: '#16143A', fg: '#FFFFFF', border: '#2D2B5E' },
];

export default function Trips() {
  const navigate = useNavigate();
  const ctx = useApp();
  const [activeFilter, setActiveFilter] = useState(0);

  const trips = ctx.getTripsData();
  const filtered = trips.filter(filters[activeFilter].filter);

  return (
    <div className="trips-container">
      <div className="filter-bar">
        {filters.map((f, i) => {
          const active = i === activeFilter;
          return (
            <button
              key={f.label}
              onClick={() => setActiveFilter(i)}
              className={`filter-pill${active ? ' active' : ''}`}
            >
              {f.label}
            </button>
          );
        })}
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
        {filtered.map((t, i) => (
          <div
            key={t.name}
            onClick={() => navigate(`/app/trips/${i}`)}
            className="trips-row trips-grid"
          >
            <div className="trip-name-group">
              <div className="trip-avatar-wrap">
                <div className="trip-cover" style={{ background: t.cover }} />
                <div className="trip-badge">
                  {parseInt(t.optsLabel, 10) || 1}
                </div>
              </div>
              <div className="trip-text-group">
                <div className="trip-name">{t.name}</div>
                <div className="trip-dates">{t.dates}</div>
              </div>
            </div>

            <div className="trip-traveler-group">
              <div className="avatar-sm" style={{ background: t.avatarBg }}>
                {t.initials}
              </div>
              <div className="trip-traveler-name">{t.traveler}</div>
            </div>

            <div className="trip-destination trip-cell">{t.where}</div>

            <div className="trip-cell">
              <div className="trip-status" style={{ background: t.statusBg, color: t.statusFg }}>
                {t.status}
              </div>
            </div>

            <div className="trip-value trip-cell">{t.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
