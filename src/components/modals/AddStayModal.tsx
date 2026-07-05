import { useState, useEffect } from 'react';
import { ApiService } from '../../services/api-service';
import type { HotelSearchResult, ItineraryAccommodationResponse } from '../../types/app';
import '../../styles/AddItemModal.css';
import '../../styles/AddFlightModal.css';

// ── AddStayModal ─────────────────────────────────────────────
// Purpose: Adds accommodation to a real itinerary, either by searching real hotels via
// SerpApi's Google Hotels engine (ApiService.searchHotels — see
// ItineraryController::searchHotels) and picking one, or by typing one in by hand. Also
// doubles as the edit modal for an existing accommodation row (see `editing` below) — editing
// only ever goes through the manual fields since there's no "re-search" concept for a stay
// that's already booked.
// Only used for real trips — TripDetail.tsx only renders the "+ Add stay" button that
// opens this when `apiTrip && selectedItinerary` are both present.
// Props: open: boolean; itineraryId: string | null; startCity: string | null; editing?: ItineraryAccommodationResponse | null; onClose: () => void; onSaved: () => void

interface Props {
  open: boolean;
  itineraryId: string | null;
  // Itinerary.start_city — unlike AddFlightModal (which needs a strict airport code),
  // Google Hotels' `q` param is free text, so "<city> hotels" is a real, working prefill here
  // (confirmed live) rather than just a placeholder hint.
  startCity: string | null;
  // When set, the modal opens straight into the manual form prefilled from this row and
  // "Save" calls updateAccommodation instead of addAccommodation — used by the Stays tab's
  // per-card "Edit" button.
  editing?: ItineraryAccommodationResponse | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function AddStayModal({ open, itineraryId, startCity, editing, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<'search' | 'manual'>('search');

  // ── Search mode ──
  const [query, setQuery] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [results, setResults] = useState<HotelSearchResult[] | null>(null);
  const [selectingToken, setSelectingToken] = useState<string | null>(null);

  // ── Manual mode ──
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [roomType, setRoomType] = useState('');
  const [manualCheckIn, setManualCheckIn] = useState('');
  const [manualCheckOut, setManualCheckOut] = useState('');
  const [cost, setCost] = useState('');
  const [currency, setCurrency] = useState('GHS');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setMode('manual');
      setName(editing.accommodation_name);
      setAddress(editing.address ?? '');
      setRoomType(editing.room_type ?? '');
      setManualCheckIn(editing.check_in_date ? editing.check_in_date.split('T')[0] : '');
      setManualCheckOut(editing.check_out_date ? editing.check_out_date.split('T')[0] : '');
      setCost(editing.cost != null ? String(editing.cost) : '');
      setCurrency(editing.currency ?? 'GHS');
      return;
    }
    setMode('search');
    setQuery(startCity ? `${startCity} hotels` : '');
    setCheckInDate('');
    setCheckOutDate('');
    setResults(null);
    setSearchError('');
    setName('');
    setAddress('');
    setRoomType('');
    setManualCheckIn('');
    setManualCheckOut('');
    setCost('');
    setCurrency('GHS');
  }, [open, startCity, editing]);

  if (!open) return null;

  const handleSearch = async () => {
    if (!itineraryId || !query.trim() || !checkInDate || !checkOutDate) return;
    setSearching(true);
    setSearchError('');
    setResults(null);
    try {
      const res = await ApiService.searchHotels(itineraryId, {
        q: query.trim(),
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
      });
      if (res.error) {
        setSearchError(res.error);
      } else {
        setResults(res.results);
      }
    } catch {
      setSearchError('Could not search stays right now.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = async (result: HotelSearchResult) => {
    if (!itineraryId) return;
    setSelectingToken(result.property_token ?? result.name);
    try {
      await ApiService.addAccommodation(itineraryId, {
        accommodation_name: result.name,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        room_type: result.hotel_class ?? undefined,
        cost: result.rate_per_night ?? undefined,
        currency: result.currency,
        booking_url: result.link ?? undefined,
        booking_reference: result.property_token ?? undefined,
      });
      onSaved();
      onClose();
    } catch {
      setSearchError('Could not save the selected stay.');
    } finally {
      setSelectingToken(null);
    }
  };

  const handleSaveManual = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        accommodation_name: name.trim(),
        address: address.trim() || undefined,
        check_in_date: manualCheckIn || undefined,
        check_out_date: manualCheckOut || undefined,
        room_type: roomType.trim() || undefined,
        cost: cost ? Number(cost) : undefined,
        currency: cost ? currency : undefined,
      };
      if (editing) {
        await ApiService.updateAccommodation(editing.accommodation_id, payload);
      } else {
        if (!itineraryId) return;
        await ApiService.addAccommodation(itineraryId, payload);
      }
      onSaved();
      onClose();
    } catch {
      // error
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="aim-overlay" onClick={onClose}>
      <div className="aim-modal afm-modal" onClick={e => e.stopPropagation()}>
        <div className="aim-header">
          <h2 className="aim-title">{editing ? 'Edit stay' : 'Add stay'}</h2>
          <button className="aim-close" onClick={onClose}>✕</button>
        </div>

        {!editing && (
          <div className="afm-mode-row">
            <button
              className={'aim-type-btn' + (mode === 'search' ? ' aim-type-btn--active' : '')}
              onClick={() => setMode('search')}
            >
              Search stays
            </button>
            <button
              className={'aim-type-btn' + (mode === 'manual' ? ' aim-type-btn--active' : '')}
              onClick={() => setMode('manual')}
            >
              Enter manually
            </button>
          </div>
        )}

        {mode === 'search' ? (
          <>
            <div className="aim-body">
              <label className="aim-label">Destination</label>
              <input
                className="aim-input"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="e.g. Accra hotels, Dubai Marina"
              />

              <div className="aim-cost-row">
                <div className="aim-cost-field">
                  <label className="aim-label">Check-in</label>
                  <input
                    className="aim-input"
                    type="date"
                    value={checkInDate}
                    onChange={e => setCheckInDate(e.target.value)}
                  />
                </div>
                <div className="aim-curr-field">
                  <label className="aim-label">Check-out</label>
                  <input
                    className="aim-input"
                    type="date"
                    value={checkOutDate}
                    onChange={e => setCheckOutDate(e.target.value)}
                  />
                </div>
              </div>

              <button
                className="afm-search-btn"
                onClick={handleSearch}
                disabled={!query.trim() || !checkInDate || !checkOutDate || searching}
              >
                {searching ? 'Searching…' : '✦ Search stays'}
              </button>

              {searchError && <p className="afm-error">{searchError}</p>}

              {results && (
                <div className="afm-results">
                  {results.length === 0 && <p className="afm-empty">No stays found for this search.</p>}
                  {results.map(r => (
                    <div key={r.property_token ?? r.name} className="afm-stay-card">
                      {r.thumbnail && <img src={r.thumbnail} alt="" className="afm-stay-thumb" />}
                      <div className="afm-stay-info">
                        <div className="afm-stay-name">{r.name}</div>
                        <div className="afm-stay-meta">
                          {[r.hotel_class, r.overall_rating ? `★ ${r.overall_rating}` : null].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div className="afm-result-price-col">
                        <div className="afm-result-price">{r.currency} {r.rate_per_night?.toLocaleString()}/night</div>
                        <button
                          className="afm-select-btn"
                          onClick={() => handleSelect(r)}
                          disabled={selectingToken !== null}
                        >
                          {selectingToken === (r.property_token ?? r.name) ? 'Saving…' : 'Select'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="aim-footer">
              <button className="aim-cancel" onClick={onClose}>Close</button>
            </div>
          </>
        ) : (
          <>
            <div className="aim-body">
              <label className="aim-label">Property name</label>
              <input
                className="aim-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Kempinski Gold Coast City"
              />

              <label className="aim-label">Address (optional)</label>
              <input
                className="aim-input"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="e.g. Gamel Abdul Nasser Ave, Accra"
              />

              <label className="aim-label">Room type (optional)</label>
              <input
                className="aim-input"
                value={roomType}
                onChange={e => setRoomType(e.target.value)}
                placeholder="e.g. Deluxe king room"
              />

              <div className="aim-cost-row">
                <div className="aim-cost-field">
                  <label className="aim-label">Check-in</label>
                  <input
                    className="aim-input"
                    type="date"
                    value={manualCheckIn}
                    onChange={e => setManualCheckIn(e.target.value)}
                  />
                </div>
                <div className="aim-curr-field">
                  <label className="aim-label">Check-out</label>
                  <input
                    className="aim-input"
                    type="date"
                    value={manualCheckOut}
                    onChange={e => setManualCheckOut(e.target.value)}
                  />
                </div>
              </div>

              <div className="aim-cost-row">
                <div className="aim-cost-field">
                  <label className="aim-label">Cost per night (optional)</label>
                  <input
                    className="aim-input"
                    value={cost}
                    onChange={e => setCost(e.target.value)}
                    placeholder="e.g. 400"
                    type="number"
                  />
                </div>
                <div className="aim-curr-field">
                  <label className="aim-label">Currency</label>
                  <select className="aim-input aim-select" value={currency} onChange={e => setCurrency(e.target.value)}>
                    <option value="GHS">GHS</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="aim-footer">
              <button className="aim-cancel" onClick={onClose}>Cancel</button>
              <button
                className="aim-save"
                onClick={handleSaveManual}
                disabled={(!editing && !itineraryId) || !name.trim() || saving}
              >
                {saving ? 'Saving...' : editing ? 'Save changes' : 'Add stay'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
