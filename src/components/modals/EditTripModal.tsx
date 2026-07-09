import { useState, useEffect } from 'react';
import { ApiService } from '../../services/api-service';
import type { TripResponse } from '../../types/app';
import '../../styles/AddItemModal.css';

// ── EditTripModal ────────────────────────────────────────────
// Purpose: Edits a trip's name, description, dates, and budget. Replaces what used to be an
// inline field-swap directly in TripDetail's hero card — every other edit/create flow in the
// app (AddItemModal, AddFlightModal, AddStayModal, AssignTravelerModal, Travelers.tsx) uses a
// dedicated modal, so this brings trip editing in line with that instead of being the one
// place that mutated the page layout in place.
// Props: open: boolean; trip: TripResponse | null; fallbackName: string; onClose: () => void; onSaved: () => void
//
// `trip` is null for mock/demo trips (no tripId to save to) — Save is disabled in that case
// rather than silently no-oping the way the old inline editor did.
interface Props {
  open: boolean;
  trip: TripResponse | null;
  fallbackName: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditTripModal({ open, trip, fallbackName, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(trip?.trip_name ?? fallbackName);
    setDescription(trip?.description ?? '');
    setStartDate(trip?.start_date?.split('T')[0] ?? '');
    setEndDate(trip?.end_date?.split('T')[0] ?? '');
    setBudget(trip?.budget ?? '');
  }, [open, trip, fallbackName]);

  if (!open) return null;

  const handleSave = async () => {
    if (!trip || !name.trim()) return;
    setSaving(true);
    try {
      await ApiService.updateTrip(trip.trip_id, {
        trip_name: name.trim(),
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        budget: budget || undefined,
        description: description || undefined,
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="aim-overlay" onClick={onClose}>
      <div className="aim-modal" onClick={e => e.stopPropagation()}>
        <div className="aim-header">
          <h2 className="aim-title">Edit trip</h2>
          <button className="aim-close" onClick={onClose}>✕</button>
        </div>

        <div className="aim-body">
          <label className="aim-label">Trip name</label>
          <input
            className="aim-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Trip name"
          />

          <label className="aim-label">Description</label>
          <textarea
            className="aim-input"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Trip description"
            rows={3}
          />

          <div className="aim-row-2">
            <div className="aim-cost-field">
              <label className="aim-label">Start date</label>
              <input
                className="aim-input"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="aim-curr-field">
              <label className="aim-label">End date</label>
              <input
                className="aim-input"
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <label className="aim-label">Budget (optional)</label>
          <input
            className="aim-input"
            type="number"
            value={budget}
            onChange={e => setBudget(e.target.value)}
            placeholder="e.g. 50000"
          />
        </div>

        <div className="aim-footer">
          <button className="aim-cancel" onClick={onClose}>Cancel</button>
          <button
            className="aim-save"
            onClick={handleSave}
            disabled={!trip || !name.trim() || saving}
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
