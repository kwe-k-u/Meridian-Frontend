import { useState, useEffect, useMemo } from 'react';
import { ApiService } from '../../services/api-service';
import type { DestinationResponse } from '../../types/app';
import '../../styles/AddItemModal.css';

const ITEM_TYPES = ['Activity', 'Dining', 'Transfer', 'Venue'] as const;
type ItemType = typeof ITEM_TYPES[number];

// The shape of one entry in ItineraryDayResponse.destinations — passed in when editing an
// existing item rather than adding a new one.
export interface EditingDayItem {
  destination_id: string;
  item_type: 'activity' | 'dining' | 'transfer' | 'venue' | null;
  cost: string | null;
  currency: string | null;
  activities: string | null;
  destination?: { destination_id: string; name: string; country: string };
}

interface Props {
  open: boolean;
  dayIndex: number;
  dayId: string | null;
  // When set, the modal opens prefilled from this item and saving updates it in place instead
  // of adding a new item — used by the Activities tab's per-card "Edit" button.
  editing?: EditingDayItem | null;
  onClose: () => void;
  onSaved: () => void;
}

// ── AddItemModal ─────────────────────────────────────────────
// Purpose: Modal to add a new item (Activity/Dining/Transfer/Venue) to a specific itinerary day,
// or edit an existing one (see `editing` above).
// Props: open: boolean; dayIndex: number; dayId: string | null; editing?: EditingDayItem | null; onClose: () => void; onSaved: () => void
export default function AddItemModal({ open, dayIndex, dayId, editing, onClose, onSaved }: Props) {
  const [destinations, setDestinations] = useState<DestinationResponse[]>([]);
  const [search, setSearch] = useState('');
  const [itemType, setItemType] = useState<ItemType>('Activity');
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState('');
  const [currency, setCurrency] = useState('GHS');
  const [saving, setSaving] = useState(false);
  const [selectedDest, setSelectedDest] = useState<DestinationResponse | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [creatingDest, setCreatingDest] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDestCountry, setNewDestCountry] = useState('');

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setSaving(false);
    setShowCreateForm(false);
    setNewDestCountry('');
    if (editing) {
      const cap = editing.item_type ? editing.item_type[0].toUpperCase() + editing.item_type.slice(1) : 'Activity';
      setItemType(ITEM_TYPES.includes(cap as ItemType) ? (cap as ItemType) : 'Activity');
      setTitle(editing.activities ?? '');
      setCost(editing.cost ?? '');
      setCurrency(editing.currency ?? 'GHS');
      setSelectedDest(editing.destination
        ? { destination_id: editing.destination.destination_id, name: editing.destination.name, country: editing.destination.country, url: null }
        : null);
    } else {
      setItemType('Activity');
      setTitle('');
      setCost('');
      setCurrency('GHS');
      setSelectedDest(null);
    }
    ApiService.getDestinations(1).then(r => {
      setDestinations(r.data);
    }).catch(() => {});
  }, [open, editing]);

  const filtered = useMemo(() => {
    if (!search.trim()) return destinations;
    const q = search.toLowerCase();
    return destinations.filter(d =>
      d.name.toLowerCase().includes(q) || (d.country ?? '').toLowerCase().includes(q)
    );
  }, [destinations, search]);

  const handleSave = async () => {
    if (!dayId || !selectedDest || !title.trim()) return;
    setSaving(true);
    try {
      // addDestinationToDay upserts on (day, destination_id), so editing in place just means
      // calling it again with the same destination_id. But if the user swapped the destination
      // while editing, that upsert would land on a *different* row and leave the original
      // attachment behind — so the old one has to be explicitly removed first.
      if (editing && editing.destination_id !== selectedDest.destination_id) {
        await ApiService.removeDestinationFromDay(dayId, editing.destination_id);
      }
      await ApiService.addDestinationToDay(dayId, {
        destination_id: selectedDest.destination_id,
        item_type: itemType.toLowerCase() as 'activity' | 'dining' | 'transfer' | 'venue',
        activities: title.trim(),
        cost: cost || undefined,
        currency: cost ? currency : undefined,
      });
      onSaved();
      onClose();
    } catch {
      // error handling
    } finally {
      setSaving(false);
    }
  };

  const showCreateOption = Boolean(search.trim() && !selectedDest && filtered.length === 0);

  // Destinations are always created with both a name and a location — the inline "Create X"
  // option only opens a small form (below) asking for the location before this actually runs.
  const handleCreateDestination = async () => {
    if (!search.trim() || !newDestCountry.trim()) return;
    setCreatingDest(true);
    try {
      const created = await ApiService.createDestination({ name: search.trim(), country: newDestCountry.trim() });
      setDestinations(prev => [...prev, created]);
      setSelectedDest(created);
      setSearch('');
      setNewDestCountry('');
      setShowCreateForm(false);
      setShowDropdown(false);
    } catch {
      // error handling
    } finally {
      setCreatingDest(false);
    }
  };

  if (!open) return null;

  return (
    <div className="aim-overlay" onClick={onClose}>
      <div className="aim-modal" onClick={e => e.stopPropagation()}>
        <div className="aim-header">
          <h2 className="aim-title">{editing ? `Edit item · Day ${dayIndex + 1}` : `Add item to Day ${dayIndex + 1}`}</h2>
          <button className="aim-close" onClick={onClose}>✕</button>
        </div>

        <div className="aim-body">
          <label className="aim-label">Item type</label>
          <div className="aim-type-row">
            {ITEM_TYPES.map(t => (
              <button
                key={t}
                className={'aim-type-btn' + (itemType === t ? ' aim-type-btn--active' : '')}
                onClick={() => setItemType(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <label className="aim-label">Title</label>
          <input
            className="aim-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Safari tour, Beach lunch"
          />

          <label className="aim-label">Destination</label>
          <div className="aim-dest-select">
            <input
              className="aim-input"
              value={selectedDest ? `${selectedDest.name}${selectedDest.country ? `, ${selectedDest.country}` : ''}` : search}
              onChange={e => { setSearch(e.target.value); setSelectedDest(null); setShowDropdown(true); setShowCreateForm(false); setNewDestCountry(''); }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search destinations..."
            />
            {showDropdown && (filtered.length > 0 || showCreateOption) && (
              <div className="aim-dest-dropdown">
                {filtered.map(d => (
                  <div
                    key={d.destination_id}
                    className={'aim-dest-opt' + (selectedDest?.destination_id === d.destination_id ? ' aim-dest-opt--active' : '')}
                    onClick={() => { setSelectedDest(d); setSearch(''); setShowDropdown(false); }}
                  >
                    <span className="aim-dest-name">{d.name}</span>
                    <span className="aim-dest-country">{d.country}</span>
                  </div>
                ))}
                {showCreateOption && !showCreateForm && (
                  <div
                    className="aim-dest-opt"
                    onClick={() => setShowCreateForm(true)}
                  >
                    <span className="aim-dest-name">{`Create "${search.trim()}"`}</span>
                  </div>
                )}
                {showCreateOption && showCreateForm && (
                  <div className="aim-dest-create-form" onClick={e => e.stopPropagation()}>
                    <div className="aim-dest-create-name">{search.trim()}</div>
                    <input
                      className="aim-input"
                      value={newDestCountry}
                      onChange={e => setNewDestCountry(e.target.value)}
                      placeholder="Location (e.g. Ghana)"
                      autoFocus
                    />
                    <div className="aim-dest-create-actions">
                      <button
                        type="button"
                        className="aim-dest-create-cancel"
                        onClick={() => { setShowCreateForm(false); setNewDestCountry(''); }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="aim-dest-create-confirm"
                        onClick={handleCreateDestination}
                        disabled={creatingDest || !newDestCountry.trim()}
                      >
                        {creatingDest ? 'Creating...' : 'Create'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="aim-cost-row">
            <div className="aim-cost-field">
              <label className="aim-label">Cost (optional)</label>
              <input
                className="aim-input"
                value={cost}
                onChange={e => setCost(e.target.value)}
                placeholder="e.g. 500"
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
            onClick={handleSave}
            disabled={!selectedDest || !title.trim() || saving}
          >
            {saving ? 'Saving...' : editing ? 'Save changes' : 'Add to day'}
          </button>
        </div>
      </div>
    </div>
  );
}
