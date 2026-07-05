import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';
import '../../styles/CreateTripModal.css';
import { ApiService } from '../../services/api-service';
import { useAuth } from '../../contexts/AuthContext';

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

// ── CreateTripModal ──────────────────────────────────────────
// Purpose: Multi-step modal for creating a new trip with name, request, travelers, and dates.
// Props: none (reads/writes state from AppContext)
export default function CreateTripModal() {
  const navigate = useNavigate();
  const { createOpen, createStep, createFromConvo, createdTripId, closeCreate, startSearch } = useApp();
  const [tripName, setTripName] = useState('');
  const [request, setRequest] = useState('');
  // Collected but never sent to the backend — createTrip() has no field for traveler count/
  // names, so this input is currently decorative.
  const [travelers, setTravelers] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const ctx = useAuth();

  if (!createOpen) return null;

  const cs1 = createStep === 1;
  const cs2 = createStep === 2;
  const cs3 = createStep === 3;

  // Creates a real trip via the API (status 'planning', the traveler `request` text becomes
  // the trip description), then starts the multi-step "Meridian is building options…" modal
  // animation (startSearch — a fixed-timer UI simulation, not an actual generation call; the
  // real generation call happens later, from TripDetail.tsx, once the user opens the trip).
  const handleGenerate = async () => {
    if (!tripName.trim()) return;
    ApiService.createTrip({
    company_id: ctx.user!.companies.find((c)=>c.pivot.is_default)!.company_id,
    created_by: ctx.user?.user_id,
    trip_name: tripName,
    description: request,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    status: "planning",
    }).then((response)=>{
      startSearch(response.trip_id);
    })
  };

  const handleOpenCreatedTrip = () => {
    closeCreate();
    navigate('/app/trips/' + (createdTripId ?? '0'));
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
                    <input
                      className="ctm-input"
                      type="text"
                      placeholder="e.g. Asante–Mensah Honeymoon"
                      value={tripName}
                      onChange={e => setTripName(e.target.value)}
                    />
                  </div>
                  <div className="ctm-field">
                    <span className="ctm-label">Request</span>
                    <textarea
                      className="ctm-input ctm-textarea"
                      placeholder="e.g. 10-day honeymoon in early October..."
                      rows={3}
                      value={request}
                      onChange={e => setRequest(e.target.value)}
                    />
                  </div>
                  <div className="ctm-field">
                    <span className="ctm-label">Travelers</span>
                    <input
                      className="ctm-input"
                      type="text"
                      placeholder="e.g. 2 adults"
                      value={travelers}
                      onChange={e => setTravelers(e.target.value)}
                    />
                  </div>
                  <div className="ctm-field-row">
                    <div className="ctm-field">
                      <span className="ctm-label">Start date</span>
                      <input
                        className="ctm-input"
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="ctm-field">
                      <span className="ctm-label">End date</span>
                      <input
                        className="ctm-input"
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="ctm-footer">
                <button className="ctm-btn-secondary" onClick={closeCreate}>Cancel</button>
                <button
                  className="ctm-btn-primary"
                  onClick={handleGenerate}
                  style={{ opacity: tripName.trim() ? 1 : 0.5 }}
                >
                  Generate with Meridian
                </button>
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
