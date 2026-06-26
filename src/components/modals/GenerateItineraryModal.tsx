import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';
import type { TripItem } from '../../types/app';
import '../../styles/GenerateItineraryModal.css';

type GenStep = 'pick' | 'questions';

const budgetOptions = ['Budget', 'Mid-range', 'Luxury', 'No preference'];
const styleOptions = ['Adventure', 'Relaxation', 'Cultural', 'Mixed'];
const priorityOptions = ['Flights', 'Accommodation', 'Activities', 'Dining', 'Experiences'];

export default function GenerateItineraryModal() {
  const navigate = useNavigate();
  const { genItinOpen, closeGenItin, openCreate, getTripsData } = useApp();

  const [step, setStep] = useState<GenStep>('pick');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const [budget, setBudget] = useState('');
  const [style, setStyle] = useState('');
  const [priorities, setPriorities] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  if (!genItinOpen) return null;

  const trips = getTripsData().filter(t => t.status === 'Draft' || t.status === 'AI drafting');

  const handleSelectTrip = (idx: number) => {
    setSelectedIdx(idx);
    setStep('questions');
  };

  const handleCreateTrip = () => {
    closeGenItin();
    openCreate();
  };

  const handleBack = () => {
    setStep('pick');
  };

  const handleGenerate = () => {
    if (selectedIdx === null) return;
    closeGenItin();
    navigate(`/app/trips/${selectedIdx}`, {
      state: {
        triggerGenerate: true,
        travelerPrefs: { budget, style, priorities, notes },
      },
    });
  };

  const togglePriority = (opt: string) => {
    setPriorities(prev =>
      prev.includes(opt) ? prev.filter(p => p !== opt) : [...prev, opt],
    );
  };

  const selected = selectedIdx !== null ? getTripsData()[selectedIdx] : null;

  return (
    <div className="gim-backdrop" onClick={closeGenItin}>
      <div className="gim-card" onClick={e => e.stopPropagation()}>
        <div className="gim-header">
          {step === 'pick' ? (
            <>
              <h2 className="gim-title">Generate itinerary</h2>
              <p className="gim-sub">Select a trip to generate options for, or create a new one.</p>
            </>
          ) : (
            <>
              <h2 className="gim-title">Traveler preferences</h2>
              <p className="gim-sub">Tell us about the traveler to get the best itinerary options.</p>
            </>
          )}
          <div className="gim-step-indicator">
            <div className={'gim-step-dot' + (step === 'pick' ? ' active' : '')} />
            <div className={'gim-step-dot' + (step === 'questions' ? ' active' : '')} />
          </div>
        </div>

        {step === 'pick' && (
          <>
            {trips.length > 0 && (
              <div className="gim-section-label">
                Existing trips ({trips.length})
              </div>
            )}

            <div className="gim-trip-list">
              {trips.length === 0 ? (
                <div className="gim-empty">
                  No draft trips yet. Start by creating a new trip.
                </div>
              ) : (
                trips.map((t: TripItem) => {
                  const idx = getTripsData().indexOf(t);
                  return (
                    <div
                      key={t.name}
                      className="gim-trip-item"
                      onClick={() => handleSelectTrip(idx)}
                    >
                      <div className="gim-trip-avatar" style={{ background: t.cover }}>
                        {t.initials}
                      </div>
                      <div className="gim-trip-info">
                        <div className="gim-trip-name">{t.name}</div>
                        <div className="gim-trip-meta">{t.traveler} · {t.where} · {t.dates}</div>
                      </div>
                      <div className="gim-trip-status" style={{ background: t.statusBg, color: t.statusFg }}>
                        {t.status}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button className="gim-create-btn" onClick={handleCreateTrip}>
              <span className="gim-create-icon">+</span>
              Create a new trip
            </button>

            <div className="gim-footer">
              <button className="gim-cancel-btn" onClick={closeGenItin}>Cancel</button>
            </div>
          </>
        )}

        {step === 'questions' && selected && (
          <>
            <div className="gim-selected-trip-info">
              <div className="gim-selected-trip-avatar" style={{ background: selected.cover }}>
                {selected.initials}
              </div>
              <div className="gim-selected-trip-name">
                {selected.name}
              </div>
            </div>

            <div className="gim-questions">
              <div className="gim-q-group">
                <div className="gim-q-label">Budget range</div>
                <div className="gim-q-chips">
                  {budgetOptions.map(o => (
                    <div
                      key={o}
                      className={'gim-q-chip' + (budget === o ? ' selected' : '')}
                      onClick={() => setBudget(o)}
                    >
                      {o}
                    </div>
                  ))}
                </div>
              </div>

              <div className="gim-q-group">
                <div className="gim-q-label">Travel style</div>
                <div className="gim-q-chips">
                  {styleOptions.map(o => (
                    <div
                      key={o}
                      className={'gim-q-chip' + (style === o ? ' selected' : '')}
                      onClick={() => setStyle(o)}
                    >
                      {o}
                    </div>
                  ))}
                </div>
              </div>

              <div className="gim-q-group">
                <div className="gim-q-label">Key priorities</div>
                <div className="gim-q-chips">
                  {priorityOptions.map(o => (
                    <div
                      key={o}
                      className={'gim-q-chip' + (priorities.includes(o) ? ' selected' : '')}
                      onClick={() => togglePriority(o)}
                    >
                      {o}
                    </div>
                  ))}
                </div>
              </div>

              <div className="gim-q-group">
                <div className="gim-q-label">Additional notes</div>
                <textarea
                  className="gim-q-textarea"
                  placeholder="e.g. traveler prefers direct flights, needs wheelchair access..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="gim-footer">
              <button className="gim-back-btn" onClick={handleBack}>Back</button>
              <button className="gim-next-btn" onClick={handleGenerate}>
                Generate itinerary
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
