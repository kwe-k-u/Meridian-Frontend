import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import logoM from '../assets/logo/logo_m.svg';
import '../styles/TravelerView.css';

// ── TravelerView ─────────────────────────────────────────────
// Purpose: Read-only traveler-facing trip view with day-by-day itinerary, accept/request-change actions.
// Props: none (reads tripId from URL params and data from AppContext)
export default function TravelerView() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const ctx = useApp();
  const tid = tripId ? parseInt(tripId, 10) : 0;

  const days = ctx.getDays(tid, 'A');

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
            onClick={() => navigate('/app/trips/' + tid)}
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
            Greece & Italy · 10 nights
          </div>
          <h1 className="tv__hero-title">
            Your Honeymoon
          </h1>
          <p className="tv__hero-sub">
            4 – 14 October 2026 · for Ama & Kofi
          </p>
        </div>

        <div className="tv__info-row">
          <div className="tv__info-card">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <div>
              <div className="tv__info-label">Flights</div>
              <div className="tv__info-sub">Accra ⇄ Santorini · 1 stop</div>
            </div>
          </div>
          <div className="tv__info-card">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0E9F6E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <div>
              <div className="tv__info-label">Stays</div>
              <div className="tv__info-sub">Canaves Oia · Le Sirenuse</div>
            </div>
          </div>
          <div className="tv__info-card">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B7791F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <div>
              <div className="tv__info-label">Experiences</div>
              <div className="tv__info-sub">5 included</div>
            </div>
          </div>
        </div>

        <h2 className="tv__section-title">Day by day</h2>

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
                <div
                  key={bi}
                  className="tv__block"
                >
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
          <div className="tv__total-value">GHS 84,500</div>
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
              navigate('/app/trips/' + tid);
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
