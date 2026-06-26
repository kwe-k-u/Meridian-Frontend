import { useNavigate } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';
import '../../styles/CreateTripModal.css';

const keyframes = `
@keyframes mfloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
@keyframes mbar {
  0% { width: 0; }
  50% { width: 65%; }
  100% { width: 100%; }
}
@keyframes mspin {
  to { transform: rotate(360deg); }
}
`;

export default function CreateTripModal() {
  const navigate = useNavigate();
  const { createOpen, createStep, createFromConvo, closeCreate, startSearch } = useApp();

  if (!createOpen) return null;

  const cs1 = createStep === 1;
  const cs2 = createStep === 2;
  const cs3 = createStep === 3;

  const handleOpenCreatedTrip = () => {
    closeCreate();
    navigate('/app/trips/0');
  };

  return (
    <>
      <style>{keyframes}</style>
      <div className="ctm-backdrop" onClick={closeCreate}>
        <div className="ctm-card" onClick={e => e.stopPropagation()}>
          {cs1 && (
            <>
              <div className="ctm-body">
                {createFromConvo && (
                  <div className="ctm-badge">
                    <span>💬</span>
                    <span>Creating from {createFromConvo}'s chat — links automatically</span>
                  </div>
                )}
                <h2 className="ctm-title">Create a trip</h2>
                <p className="ctm-sub">Give Meridian the basics...</p>
                <div className="ctm-field-group">
                  <div className="ctm-field">
                    <span className="ctm-label">Trip name</span>
                    <div className="ctm-field-box">Asante–Mensah Honeymoon</div>
                  </div>
                  <div className="ctm-field">
                    <span className="ctm-label">Request</span>
                    <div className="ctm-field-box ctm-field-box--tall">10-day honeymoon in early October...</div>
                  </div>
                  <div className="ctm-field">
                    <span className="ctm-label">Travelers</span>
                    <div className="ctm-field-box">2 adults</div>
                  </div>
                  <div className="ctm-field">
                    <span className="ctm-label">When</span>
                    <div className="ctm-field-box">4 – 14 Oct 2026</div>
                  </div>
                </div>
              </div>
              <div className="ctm-footer">
                <button className="ctm-btn-secondary" onClick={closeCreate}>Cancel</button>
                <button className="ctm-btn-primary" onClick={startSearch}>Generate with Meridian</button>
              </div>
            </>
          )}
          {cs2 && (
            <div className="ctm-centered">
              <div className="ctm-star">✦</div>
              <h2 className="ctm-load-title">Meridian is building options…</h2>
              <p className="ctm-load-sub">Searching flights, stays and experiences...</p>
              <div className="ctm-progress-wrap">
                <div className="ctm-progress-bar" />
              </div>
              <div className="ctm-checklist">
                <div className="ctm-check-item">
                  <span className="ctm-check-icon">✓</span>
                  <span>Scanned 6 flight routes</span>
                </div>
                <div className="ctm-check-item">
                  <span className="ctm-check-icon">✓</span>
                  <span>Matched 9 sea-view stays</span>
                </div>
                <div className="ctm-check-item">
                  <div className="ctm-spinner" />
                  <span>Curating experiences…</span>
                </div>
              </div>
            </div>
          )}
          {cs3 && (
            <div className="ctm-centered">
              <div className="ctm-success-icon">✓</div>
              <h2 className="ctm-success-title">3 itinerary options ready</h2>
              <p className="ctm-success-sub">
                Santorini + Amalfi, Maldives, and Zanzibar &amp; Safari...
              </p>
              <div className="ctm-btn-row">
                <button className="ctm-btn-secondary" onClick={closeCreate}>Later</button>
                <button className="ctm-btn-primary" onClick={handleOpenCreatedTrip}>Open trip workspace</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
