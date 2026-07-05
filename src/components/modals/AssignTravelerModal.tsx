import { useState, useEffect, useMemo } from 'react';
import { ApiService } from '../../services/api-service';
import type { CustomerResponse } from '../../types/app';
import '../../styles/AddItemModal.css';

// ── AssignTravelerModal ──────────────────────────────────────
// Purpose: Assigns a customer as a trip's traveler — search existing customers or quick-create
// one, mirroring AddItemModal's destination search-and-create pattern. Was entirely missing
// before: TripController::addCustomer/removeCustomer were routed on the backend but never
// called from anywhere in the frontend, so there was no way to attach a real traveler to a
// trip (the "Traveler" column/label always fell back to whoever created the trip).
// Props: open: boolean; tripId: string | null; companyId: string | null; currentCustomerId: string | null; onClose: () => void; onAssigned: () => void
interface Props {
  open: boolean;
  tripId: string | null;
  companyId: string | null;
  // Assigning a new traveler replaces this one (detach then attach) rather than accumulating
  // multiple customers on the trip — the rest of the UI (td.traveler) only ever shows one.
  currentCustomerId: string | null;
  onClose: () => void;
  onAssigned: () => void;
}

export default function AssignTravelerModal({ open, tripId, companyId, currentCustomerId, onClose, onAssigned }: Props) {
  const [customers, setCustomers] = useState<CustomerResponse[]>([]);
  const [search, setSearch] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setShowCreateForm(false);
    setNewFirstName('');
    setNewLastName('');
    setNewEmail('');
    setError('');
    ApiService.getCustomers(1).then(r => setCustomers(r.data)).catch(() => {});
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(c =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q)
    );
  }, [customers, search]);

  if (!open) return null;

  const handleAssign = async (customerId: string) => {
    if (!tripId) return;
    setAssigningId(customerId);
    setError('');
    try {
      if (currentCustomerId && currentCustomerId !== customerId) {
        await ApiService.removeCustomerFromTrip(tripId, currentCustomerId);
      }
      await ApiService.addCustomerToTrip(tripId, customerId);
      onAssigned();
      onClose();
    } catch {
      setError('Could not assign this traveler.');
    } finally {
      setAssigningId(null);
    }
  };

  const handleCreateAndAssign = async () => {
    if (!tripId || !companyId || !newFirstName.trim() || !newLastName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const created = await ApiService.createCustomer({
        company_id: companyId,
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        email: newEmail.trim() || null,
      });
      if (currentCustomerId) {
        await ApiService.removeCustomerFromTrip(tripId, currentCustomerId);
      }
      await ApiService.addCustomerToTrip(tripId, created.customer_id);
      onAssigned();
      onClose();
    } catch {
      setError('Could not create and assign this traveler.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="aim-overlay" onClick={onClose}>
      <div className="aim-modal" onClick={e => e.stopPropagation()}>
        <div className="aim-header">
          <h2 className="aim-title">Assign traveler</h2>
          <button className="aim-close" onClick={onClose}>✕</button>
        </div>

        <div className="aim-body">
          <label className="aim-label">Search travelers</label>
          <input
            className="aim-input"
            value={search}
            onChange={e => { setSearch(e.target.value); setShowCreateForm(false); }}
            placeholder="Search by name or email..."
            autoFocus
          />

          {error && <p className="afm-error">{error}</p>}

          <div className="aim-dest-dropdown" style={{ position: 'static', margin: 0, maxHeight: 260, overflowY: 'auto' }}>
            {filtered.map(c => (
              <div
                key={c.customer_id}
                className={'aim-dest-opt' + (assigningId ? ' aim-dest-opt--disabled' : '')}
                onClick={assigningId ? undefined : () => handleAssign(c.customer_id)}
              >
                <span className="aim-dest-name">{c.first_name} {c.last_name}</span>
                <span className="aim-dest-country">{assigningId === c.customer_id ? 'Assigning…' : c.email ?? ''}</span>
              </div>
            ))}

            {search.trim() && !showCreateForm && (
              <div className="aim-dest-opt" onClick={() => setShowCreateForm(true)}>
                <span className="aim-dest-name">{`+ Create new traveler "${search.trim()}"`}</span>
              </div>
            )}

            {showCreateForm && (
              <div className="aim-dest-create-form" onClick={e => e.stopPropagation()}>
                <input
                  className="aim-input"
                  value={newFirstName}
                  onChange={e => setNewFirstName(e.target.value)}
                  placeholder="First name"
                  autoFocus
                />
                <input
                  className="aim-input"
                  value={newLastName}
                  onChange={e => setNewLastName(e.target.value)}
                  placeholder="Last name"
                />
                <input
                  className="aim-input"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="Email (optional)"
                />
                <div className="aim-dest-create-actions">
                  <button
                    type="button"
                    className="aim-dest-create-cancel"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="aim-dest-create-confirm"
                    onClick={handleCreateAndAssign}
                    disabled={creating || !newFirstName.trim() || !newLastName.trim()}
                  >
                    {creating ? 'Creating…' : 'Create & assign'}
                  </button>
                </div>
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
