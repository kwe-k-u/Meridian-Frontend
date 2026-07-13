import { useState, useEffect } from 'react';
import { ApiService } from '../../services/api-service';
import type { FlightSearchResult, AirportResponse } from '../../types/app';
import '../../styles/AddItemModal.css';
import '../../styles/AddFlightModal.css';

// A city/country search box that resolves down to a specific airport, backed by the real
// `airports` table (see AirportController::search / AirportSeeder — an OpenFlights import, not
// a hand-picked list) — used for the "Search flights" From/To fields, which need a real IATA
// code for SerpApi's departure_id/arrival_id. Fully controlled: the parent owns the display
// text (`query`) so it can be reset/prefilled the same way as every other field in this modal,
// and clears the resolved code (via onQueryChange) whenever the text no longer matches a
// selection. Debounced so every keystroke doesn't fire its own request.
function AirportField({
  label, query, onQueryChange, onSelect, placeholder,
}: {
  label: string;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (airport: AirportResponse) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [matches, setMatches] = useState<AirportResponse[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setMatches([]);
      return;
    }
    const handle = setTimeout(() => {
      ApiService.searchAirports(q).then(res => setMatches(res.data)).catch(() => setMatches([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div>
      <label className="aim-label">{label}</label>
      <div className="aim-dest-select">
        <input
          className="aim-input"
          value={query}
          onChange={e => { onQueryChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder ?? 'e.g. Accra, or Ghana'}
        />
        {open && matches.length > 0 && (
          <div className="aim-dest-dropdown">
            {matches.map(a => (
              <div
                key={a.iata_code}
                className="aim-dest-opt"
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onSelect(a); setOpen(false); }}
              >
                <span className="aim-dest-name">{a.city} ({a.iata_code})</span>
                <span className="aim-dest-country">{a.country}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── AddFlightModal ───────────────────────────────────────────
// Purpose: Adds a flight booking to a real itinerary, either by searching real flights via
// SerpApi's Google Flights engine (ApiService.searchFlights — see
// ItineraryController::searchFlights) and picking one, or by typing one in by hand.
// Only used for real trips — TripDetail.tsx only renders the "+ Add flight" button that
// opens this when `apiTrip && selectedItinerary` are both present.
// Props: open: boolean; itineraryId: string | null; startCity: string | null; onClose: () => void; onSaved: () => void

interface Props {
  open: boolean;
  itineraryId: string | null;
  // Itinerary.start_city — a free-text city name (e.g. "Accra"), not an airport code, so it
  // can't be used as the actual "From" value (SerpApi's departure_id rejects anything that
  // isn't a 3-letter code — confirmed live: `departure_id ("ACCRA") should either be an
  // uppercase 3-letter code...`). Shown as a placeholder hint instead, just to remind the
  // agent which airport code they're looking for.
  startCity: string | null;
  onClose: () => void;
  onSaved: () => void;
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function stopsLabel(stops: number): string {
  if (stops === 0) return 'Nonstop';
  return stops === 1 ? '1 stop' : `${stops} stops`;
}

export default function AddFlightModal({ open, itineraryId, startCity, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<'search' | 'manual'>('search');

  // ── Search mode ──
  // departureId/arrivalId hold the resolved IATA code (what actually gets sent to SerpApi);
  // departureQuery/arrivalQuery hold the free-text the user typed/the "City (CODE)" label
  // shown once they've picked a match — see AirportField above.
  const [departureId, setDepartureId] = useState('');
  const [arrivalId, setArrivalId] = useState('');
  const [departureQuery, setDepartureQuery] = useState('');
  const [arrivalQuery, setArrivalQuery] = useState('');
  const [outboundDate, setOutboundDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [results, setResults] = useState<FlightSearchResult[] | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  // ── Manual mode ──
  const [airline, setAirline] = useState('');
  const [flightNumber, setFlightNumber] = useState('');
  const [departureAirport, setDepartureAirport] = useState('');
  const [arrivalAirport, setArrivalAirport] = useState('');
  const [departureDatetime, setDepartureDatetime] = useState('');
  const [arrivalDatetime, setArrivalDatetime] = useState('');
  const [cost, setCost] = useState('');
  const [currency, setCurrency] = useState('GHS');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode('search');
    setDepartureId('');
    setArrivalId('');
    setDepartureQuery('');
    setArrivalQuery('');
    setOutboundDate('');
    setReturnDate('');
    setResults(null);
    setSearchError('');
  }, [open]);

  if (!open) return null;

  const handleSearch = async () => {
    if (!itineraryId || !departureId.trim() || !arrivalId.trim() || !outboundDate) return;
    setSearching(true);
    setSearchError('');
    setResults(null);
    try {
      const res = await ApiService.searchFlights(itineraryId, {
        departure_id: departureId.trim(),
        arrival_id: arrivalId.trim(),
        outbound_date: outboundDate,
        return_date: returnDate || undefined,
      });
      if (res.error) {
        setSearchError(res.error);
      } else {
        setResults(res.results);
      }
    } catch {
      setSearchError('Could not search flights right now.');
    } finally {
      setSearching(false);
    }
  };

  // Saves every leg of the picked itinerary as its own ItineraryFlight row (a connecting
  // flight is 2+ legs in our schema, not one row) — the full price is attached to the first
  // leg only so the cost sidebar's sum doesn't double-count a single itinerary's price.
  const handleSelect = async (result: FlightSearchResult) => {
    if (!itineraryId) return;
    setSelectingId(result.id);
    try {
      for (let i = 0; i < result.legs.length; i++) {
        const leg = result.legs[i];
        await ApiService.addFlight(itineraryId, {
          airline: leg.airline,
          flight_number: leg.flight_number ?? undefined,
          departure_airport: leg.departure_airport ?? undefined,
          arrival_airport: leg.arrival_airport ?? undefined,
          departure_datetime: leg.departure_time ?? undefined,
          arrival_datetime: leg.arrival_time ?? undefined,
          cost: i === 0 ? (result.price ?? undefined) : 0,
          currency: result.currency,
        });
      }
      onSaved();
      onClose();
    } catch {
      setSearchError('Could not save the selected flight.');
    } finally {
      setSelectingId(null);
    }
  };

  const handleSaveManual = async () => {
    if (!itineraryId || !airline.trim() || !departureAirport.trim() || !arrivalAirport.trim()) return;
    setSaving(true);
    try {
      await ApiService.addFlight(itineraryId, {
        airline: airline.trim(),
        flight_number: flightNumber.trim() || undefined,
        departure_airport: departureAirport.trim().toUpperCase(),
        arrival_airport: arrivalAirport.trim().toUpperCase(),
        departure_datetime: departureDatetime || undefined,
        arrival_datetime: arrivalDatetime || undefined,
        cost: cost ? Number(cost) : undefined,
        currency: cost ? currency : undefined,
      });
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
          <h2 className="aim-title">Add flight</h2>
          <button className="aim-close" onClick={onClose}>✕</button>
        </div>

        <div className="afm-mode-row">
          <button
            className={'aim-type-btn' + (mode === 'search' ? ' aim-type-btn--active' : '')}
            onClick={() => setMode('search')}
          >
            Search flights
          </button>
          <button
            className={'aim-type-btn' + (mode === 'manual' ? ' aim-type-btn--active' : '')}
            onClick={() => setMode('manual')}
          >
            Enter manually
          </button>
        </div>

        {mode === 'search' ? (
          <>
            <div className="aim-body">
              <div className="afm-airport-row">
                <div className="aim-cost-field">
                  <AirportField
                    label="From"
                    query={departureQuery}
                    onQueryChange={q => { setDepartureQuery(q); setDepartureId(''); }}
                    onSelect={a => { setDepartureId(a.iata_code); setDepartureQuery(`${a.city} (${a.iata_code})`); }}
                    placeholder={startCity ? `e.g. ${startCity}` : 'e.g. Accra, or Ghana'}
                  />
                </div>
                <div className="aim-curr-field">
                  <AirportField
                    label="To"
                    query={arrivalQuery}
                    onQueryChange={q => { setArrivalQuery(q); setArrivalId(''); }}
                    onSelect={a => { setArrivalId(a.iata_code); setArrivalQuery(`${a.city} (${a.iata_code})`); }}
                    placeholder="e.g. London, or United Kingdom"
                  />
                </div>
              </div>
              <div className="aim-row-2">
                <div className="aim-cost-field">
                  <label className="aim-label">Depart</label>
                  <input
                    className="aim-input"
                    type="date"
                    value={outboundDate}
                    onChange={e => setOutboundDate(e.target.value)}
                  />
                </div>
                <div className="aim-curr-field">
                  <label className="aim-label">Return (optional)</label>
                  <input
                    className="aim-input"
                    type="date"
                    value={returnDate}
                    onChange={e => setReturnDate(e.target.value)}
                  />
                </div>
              </div>
              <button
                className="afm-search-btn"
                onClick={handleSearch}
                disabled={!departureId.trim() || !arrivalId.trim() || !outboundDate || searching}
              >
                {searching ? 'Searching…' : '✦ Search flights'}
              </button>

              {searchError && <p className="afm-error">{searchError}</p>}

              {results && (
                <div className="afm-results">
                  {results.length === 0 && <p className="afm-empty">No flights found for these dates.</p>}
                  {results.map(r => (
                    <div key={r.id} className="afm-result-card">
                      <img src={r.airline_logo ?? undefined} alt="" className="afm-result-logo" />
                      <div className="afm-result-info">
                        <div className="afm-result-route">
                          {r.legs[0]?.departure_airport} → {r.legs[r.legs.length - 1]?.arrival_airport}
                        </div>
                        <div className="afm-result-meta">
                          {r.legs.map(l => l.airline).filter((v, i, a) => a.indexOf(v) === i).join(', ')} · {formatDuration(r.total_duration)} · {stopsLabel(r.stops)}
                        </div>
                      </div>
                      <div className="afm-result-price-col">
                        <div className="afm-result-price">{r.currency} {r.price?.toLocaleString()}</div>
                        <button
                          className="afm-select-btn"
                          onClick={() => handleSelect(r)}
                          disabled={selectingId !== null}
                        >
                          {selectingId === r.id ? 'Saving…' : 'Select'}
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
              <label className="aim-label">Airline</label>
              <input
                className="aim-input"
                value={airline}
                onChange={e => setAirline(e.target.value)}
                placeholder="e.g. Delta, Emirates"
              />

              <label className="aim-label">Flight number (optional)</label>
              <input
                className="aim-input"
                value={flightNumber}
                onChange={e => setFlightNumber(e.target.value)}
                placeholder="e.g. DL 123"
              />

              <div className="aim-cost-row">
                <div className="aim-cost-field">
                  {/* Same city/country search as the "Search flights" From field, but bound
                      directly to the code text — free typing still works exactly as before,
                      picking a suggestion just fills in its IATA code. */}
                  <AirportField
                    label="Departure airport"
                    query={departureAirport}
                    onQueryChange={setDepartureAirport}
                    onSelect={a => setDepartureAirport(a.iata_code)}
                    placeholder="e.g. ACC, or Accra"
                  />
                </div>
                <div className="aim-curr-field">
                  <AirportField
                    label="Arrival airport"
                    query={arrivalAirport}
                    onQueryChange={setArrivalAirport}
                    onSelect={a => setArrivalAirport(a.iata_code)}
                    placeholder="e.g. JNB, or Johannesburg"
                  />
                </div>
              </div>

              <div className="aim-row-2">
                <div className="aim-cost-field">
                  <label className="aim-label">Departure</label>
                  <input
                    className="aim-input"
                    type="datetime-local"
                    value={departureDatetime}
                    onChange={e => setDepartureDatetime(e.target.value)}
                  />
                </div>
                <div className="aim-curr-field">
                  <label className="aim-label">Arrival</label>
                  <input
                    className="aim-input"
                    type="datetime-local"
                    value={arrivalDatetime}
                    onChange={e => setArrivalDatetime(e.target.value)}
                  />
                </div>
              </div>

              <div className="aim-cost-row">
                <div className="aim-cost-field">
                  <label className="aim-label">Cost (optional)</label>
                  <input
                    className="aim-input"
                    value={cost}
                    onChange={e => setCost(e.target.value)}
                    placeholder="e.g. 1200"
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
                disabled={!itineraryId || !airline.trim() || !departureAirport.trim() || !arrivalAirport.trim() || saving}
              >
                {saving ? 'Saving...' : 'Add flight'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
