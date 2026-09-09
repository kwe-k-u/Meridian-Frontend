import { useState, useEffect, useMemo } from 'react';
import { ApiService } from '../../services/api-service';
import type { TripResponse } from '../../types/app';
import '../../styles/AddItemModal.css';

// ── LinkTripModal ─────────────────────────────────────────────
// Purpose: Links a synced conversation (Messages page) to an existing trip — search trips by
// name or traveler, mirroring AssignTravelerModal's search-and-assign pattern. No "create new"
// sub-flow here (unlike AssignTravelerModal): creating a trip from a conversation is already
// the separate "Turn this chat into a trip" action (ctx.createTripFromConvo) next to this one.
// Props: open, conversationId, onClose, onLinked
interface Props {
  open: boolean;
  conversationId: string | null;
  onClose: () => void;
  onLinked: () => void;
}

export default function LinkTripModal({ open, conversationId, onClose, onLinked }: Props) {
  const [trips, setTrips] = useState<TripResponse[]>([]);
  const [search, setSearch] = useState('');
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setError('');
    ApiService.getTrips().then(r => setTrips(r.data)).catch(() => {});
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return trips;
    const q = search.toLowerCase();
    return trips.filter(t => {
      const travelers = (t.customers ?? []).map(c => `${c.first_name} ${c.last_name}`).join(' ');
      return t.trip_name.toLowerCase().includes(q) || travelers.toLowerCase().includes(q);
    });
  }, [trips, search]);

  if (!open) return null;

  const handleLink = async (tripId: string) => {
    if (!conversationId) return;
    setLinkingId(tripId);
    setError('');
    try {
      await ApiService.linkConversationToTrip(conversationId, tripId);
      onLinked();
      onClose();
    } catch {
      setError('Could not link this conversation to that trip.');
    } finally {
      setLinkingId(null);
    }
  };

  return (
    <div className="aim-overlay" onClick={onClose}>
      <div className="aim-modal" onClick={e => e.stopPropagation()}>
        <div className="aim-header">
          <h2 className="aim-title">Link to a trip</h2>
          <button className="aim-close" onClick={onClose}>✕</button>
        </div>

        <div className="aim-body">
          <label className="aim-label">Search trips</label>
          <input
            className="aim-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by trip name or traveler..."
            autoFocus
          />

          {error && <p className="afm-error">{error}</p>}

          <div className="aim-dest-dropdown" style={{ position: 'static', margin: 0, maxHeight: 260, overflowY: 'auto' }}>
            {filtered.map(t => {
              const travelers = (t.customers ?? []).map(c => `${c.first_name} ${c.last_name}`).join(', ');
              return (
                <div
                  key={t.trip_id}
                  className={'aim-dest-opt' + (linkingId ? ' aim-dest-opt--disabled' : '')}
                  onClick={linkingId ? undefined : () => handleLink(t.trip_id)}
                >
                  <span className="aim-dest-name">{t.trip_name}</span>
                  <span className="aim-dest-country">{linkingId === t.trip_id ? 'Linking…' : (travelers || t.status)}</span>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="aim-dest-opt" style={{ cursor: 'default' }}>
                <span className="aim-dest-country">No trips match "{search}".</span>
              </div>
            )}
          </div>
        </div>

        <div className="aim-footer">
          <button className="aim-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
