import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ApiService } from '../services/api-service';
import { useApp } from '../contexts/AppContext';
import type { CustomerResponse, TripResponse, TripCostResponse } from '../types/app';
import { TripStatus } from '../types/app';
import { apiStatusMeta } from '../constants/app';
import '../styles/Travelers.css';

type ViewMode = 'table' | 'card';
type DetailTab = 'overview' | 'trips' | 'finances' | 'messages';

const statusColors: Record<string, { bg: string; fg: string }> = {
  active:   { bg: '#E3F7EF', fg: '#0E9F6E' },
  inactive: { bg: '#EEF0F4', fg: '#8A90A2' },
  archived: { bg: '#FDECEC', fg: '#D64545' },
};

const BOOKED_LIKE_STATUSES: TripStatus[] = [TripStatus.BOOKED, TripStatus.IN_PROGRESS, TripStatus.COMPLETED];

const avatarColors = ['#2B63F6', '#0E9F6E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#0E7C8F', '#C13584'];

const getInitials = (first: string, last: string) => (first?.[0] ?? '') + (last?.[0] ?? '');

const emptyForm = { first_name: '', last_name: '', email: '', phone: '', nationality: '', notes: '' };

function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return avatarColors[h % avatarColors.length];
}

export default function Travelers() {
  const { user } = useAuth();
  const ctx = useApp();
  const navigate = useNavigate();
  const defaultCompanyId = (user?.companies?.find(c => c.pivot.is_default) ?? user?.companies?.[0])?.company_id ?? '';

  const [customers, setCustomers] = useState<CustomerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Detail panel
  const [selected, setSelected] = useState<CustomerResponse | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [travelerTrips, setTravelerTrips] = useState<TripResponse[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [tripSearch, setTripSearch] = useState('');
  const [msgText, setMsgText] = useState('');
  const msgEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<{ from: 'agent' | 'traveler'; text: string; time: string }[]>([]);
  // Per-trip payment data for Finances tab (only fetched for booked/completed trips)
  const [tripCostsMap, setTripCostsMap] = useState<Record<string, TripCostResponse | null>>({});
  const [expandedFinTrip, setExpandedFinTrip] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ApiService.getCustomers();
      setCustomers(res.data);
    } catch {
      ctx.toastAction?.('Failed to load travelers');
    } finally {
      setLoading(false);
    }
  }, [ctx]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const fetchTravelerTrips = useCallback(async (customerId: string) => {
    setLoadingTrips(true);
    try {
      const res = await ApiService.getTrips();
      const filtered = res.data.filter(t =>
        t.customers?.some(c => c.customer_id === customerId)
      );
      setTravelerTrips(filtered);
    } catch {
      setTravelerTrips([]);
    } finally {
      setLoadingTrips(false);
    }
  }, []);

  const openDetail = (c: CustomerResponse) => {
    setSelected(c);
    setDetailTab('overview');
    setTravelerTrips([]);
    setMessages([]);
    setTripSearch('');
    setTripCostsMap({});
    setExpandedFinTrip(null);
    fetchTravelerTrips(c.customer_id);
  };

  const fetchTripCosts = useCallback(async (tripId: string) => {
    if (tripCostsMap[tripId] !== undefined) return;
    setTripCostsMap(prev => ({ ...prev, [tripId]: null }));
    try {
      const costs = await ApiService.getTripCosts(tripId);
      setTripCostsMap(prev => ({ ...prev, [tripId]: costs }));
    } catch {
      setTripCostsMap(prev => ({ ...prev, [tripId]: null }));
    }
  }, [tripCostsMap]);

  const closeDetail = () => { setSelected(null); setTravelerTrips([]); };

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (c: CustomerResponse) => {
    setEditingId(c.customer_id);
    setForm({ first_name: c.first_name, last_name: c.last_name, email: c.email ?? '', phone: c.phone ?? '', nationality: c.nationality ?? '', notes: c.notes ?? '' });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditingId(null); setForm(emptyForm); };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) { ctx.toastAction?.('First and last name are required'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await ApiService.updateCustomer(editingId, { first_name: form.first_name, last_name: form.last_name, email: form.email || null, phone: form.phone || null, nationality: form.nationality || null, notes: form.notes || null });
        ctx.toastAction?.('Traveler updated');
        if (selected?.customer_id === editingId) {
          setSelected(prev => prev ? { ...prev, ...form } : prev);
        }
      } else {
        await ApiService.createCustomer({ company_id: defaultCompanyId, first_name: form.first_name, last_name: form.last_name, email: form.email || null, phone: form.phone || null, nationality: form.nationality || null, notes: form.notes || null });
        ctx.toastAction?.('Traveler created');
      }
      closeModal();
      fetchCustomers();
    } catch {
      ctx.toastAction?.('Failed to save traveler');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await ApiService.deleteCustomer(id);
      ctx.toastAction?.('Traveler deleted');
      setConfirmDelete(null);
      if (selected?.customer_id === id) closeDetail();
      fetchCustomers();
    } catch {
      ctx.toastAction?.('Failed to delete traveler');
    }
  };

  const sendMessage = () => {
    if (!msgText.trim()) return;
    setMessages(prev => [...prev, { from: 'agent', text: msgText.trim(), time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) }]);
    setMsgText('');
    setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const totalSpend = travelerTrips.reduce((s, t) => s + (t.budget ? Number(t.budget) : 0), 0);
  const currency = travelerTrips.find(t => t.budget)?.budget ? 'GHS' : '';

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    return `${c.first_name} ${c.last_name} ${c.email ?? ''} ${c.nationality ?? ''}`.toLowerCase().includes(q);
  });

  return (
    <div className={`travelers-page${selected ? ' travelers-page--split' : ''}`}>
      {/* ── Main list panel ── */}
      <div className="travelers-main">
        <div className="travelers-toolbar">
          <div className="travelers-toolbar-left">
            <h2 className="travelers-title">Travelers</h2>
            <span className="travelers-count">{customers.length}</span>
          </div>
          <div className="travelers-toolbar-right">
            <div className="travelers-search-wrap">
              <svg className="travelers-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="travelers-search" placeholder="Search travelers…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="travelers-view-toggle">
              <button className={`tvt-btn${viewMode === 'card' ? ' active' : ''}`} onClick={() => setViewMode('card')} title="Card view">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </button>
              <button className={`tvt-btn${viewMode === 'table' ? ' active' : ''}`} onClick={() => setViewMode('table')} title="Table view">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </button>
            </div>
            <button className="travelers-add-btn" onClick={openCreate}>+ Add traveler</button>
          </div>
        </div>

        {loading ? (
          <div className="travelers-loading">
            <div className="travelers-spinner" />
            <span>Loading travelers…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="travelers-empty">
            <div className="travelers-empty-icon">✈</div>
            <p className="travelers-empty-title">{search ? 'No results found' : 'No travelers yet'}</p>
            <p className="travelers-empty-sub">{search ? 'Try a different name or email.' : 'Add your first traveler to get started.'}</p>
            {!search && <button className="travelers-add-btn" onClick={openCreate}>Add traveler</button>}
          </div>
        ) : viewMode === 'card' ? (
          <div className="trav-card-grid">
            {filtered.map((c) => {
              const sc = statusColors[c.status] ?? { bg: '#EEF0F4', fg: '#5B6172' };
              const color = avatarColor(c.customer_id);
              const tripCount = c.trips?.length ?? 0;
              const isOpen = selected?.customer_id === c.customer_id;
              return (
                <div key={c.customer_id} className={`trav-card${isOpen ? ' trav-card--active' : ''}`} onClick={() => openDetail(c)}>
                  <div className="trav-card-top">
                    <div className="trav-card-avatar" style={{ background: color }}>
                      {getInitials(c.first_name, c.last_name)}
                    </div>
                    <div className="trav-card-status-wrap">
                      <span className="trav-card-status" style={{ background: sc.bg, color: sc.fg }}>{c.status}</span>
                    </div>
                  </div>
                  <div className="trav-card-name">{c.first_name} {c.last_name}</div>
                  {c.email && <div className="trav-card-email">{c.email}</div>}
                  {c.nationality && <div className="trav-card-nat">🌍 {c.nationality}</div>}
                  <div className="trav-card-stats">
                    <div className="trav-card-stat">
                      <span className="trav-card-stat-num">{tripCount}</span>
                      <span className="trav-card-stat-label">trips</span>
                    </div>
                    <div className="trav-card-stat-divider" />
                    <div className="trav-card-stat">
                      <span className="trav-card-stat-num trav-card-stat-num--muted">{c.phone ?? '—'}</span>
                      <span className="trav-card-stat-label">phone</span>
                    </div>
                  </div>
                  <div className="trav-card-actions" onClick={e => e.stopPropagation()}>
                    <button className="trav-card-action-btn" onClick={() => openEdit(c)}>Edit</button>
                    <button className="trav-card-action-btn trav-card-action-btn--danger" onClick={() => setConfirmDelete(c.customer_id)}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card">
            <div className="table-header travelers-table-header">
              <span className="table-th">Traveler</span>
              <span className="table-th">Email / Phone</span>
              <span className="table-th">Nationality</span>
              <span className="table-th">Status</span>
              <span className="table-th">Actions</span>
            </div>
            {filtered.map((c) => {
              const sc = statusColors[c.status] ?? { bg: '#EEF0F4', fg: '#5B6172' };
              return (
                <div key={c.customer_id} className="table-row travelers-table-row" style={{ cursor: 'pointer' }} onClick={() => openDetail(c)}>
                  <div className="flex-row gap-12">
                    <div className="avatar-circle" style={{ background: avatarColor(c.customer_id) }}>
                      {getInitials(c.first_name, c.last_name)}
                    </div>
                    <span className="traveler-name">{c.first_name} {c.last_name}</span>
                  </div>
                  <span className="traveler-cell-text">
                    {c.email && <div>{c.email}</div>}
                    {c.phone && <div className="traveler-phone">{c.phone}</div>}
                    {!c.email && !c.phone && <span className="text-muted">—</span>}
                  </span>
                  <span className="traveler-cell-text">{c.nationality || '—'}</span>
                  <span><span className="status-pill" style={{ background: sc.bg, color: sc.fg }}>{c.status}</span></span>
                  <span onClick={e => e.stopPropagation()}>
                    <button className="traveler-action-btn" onClick={() => openEdit(c)}>Edit</button>
                    <button className="traveler-action-btn traveler-action-delete" onClick={() => setConfirmDelete(c.customer_id)}>Delete</button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detail panel ── */}
      {selected && (
        <div className="trav-detail-panel">
          <div className="trav-detail-header">
            <div className="trav-detail-avatar" style={{ background: avatarColor(selected.customer_id) }}>
              {getInitials(selected.first_name, selected.last_name)}
            </div>
            <div className="trav-detail-identity">
              <div className="trav-detail-name">{selected.first_name} {selected.last_name}</div>
              <div className="trav-detail-meta">
                {selected.email && <span>{selected.email}</span>}
                {selected.phone && <span>{selected.phone}</span>}
                {selected.nationality && <span>🌍 {selected.nationality}</span>}
              </div>
            </div>
            <div className="trav-detail-header-actions">
              <button className="trav-detail-edit-btn" onClick={() => openEdit(selected)}>Edit</button>
              <button className="trav-detail-close-btn" onClick={closeDetail}>✕</button>
            </div>
          </div>

          {/* Stats row */}
          <div className="trav-detail-stats">
            <div className="trav-detail-stat">
              <div className="trav-detail-stat-num">{travelerTrips.length}</div>
              <div className="trav-detail-stat-label">Total trips</div>
            </div>
            <div className="trav-detail-stat">
              <div className="trav-detail-stat-num">
                {totalSpend > 0 ? `${currency} ${totalSpend.toLocaleString()}` : '—'}
              </div>
              <div className="trav-detail-stat-label">Total value</div>
            </div>
            <div className="trav-detail-stat">
              <div className="trav-detail-stat-num">
                {travelerTrips.filter(t => t.status === TripStatus.COMPLETED).length || '—'}
              </div>
              <div className="trav-detail-stat-label">Completed</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="trav-detail-tabs">
            {(['overview', 'trips', 'finances', 'messages'] as DetailTab[]).map(tab => (
              <button key={tab} className={`trav-detail-tab${detailTab === tab ? ' active' : ''}`} onClick={() => setDetailTab(tab)}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="trav-detail-body">
            {/* Overview */}
            {detailTab === 'overview' && (
              <div className="trav-detail-overview">
                <div className="trav-detail-section-title">Traveler profile</div>
                <div className="trav-detail-info-grid">
                  <div className="trav-info-row"><span className="trav-info-label">Status</span>
                    <span className="status-pill" style={{ background: (statusColors[selected.status] ?? statusColors.inactive).bg, color: (statusColors[selected.status] ?? statusColors.inactive).fg }}>{selected.status}</span>
                  </div>
                  <div className="trav-info-row"><span className="trav-info-label">Email</span><span className="trav-info-val">{selected.email ?? '—'}</span></div>
                  <div className="trav-info-row"><span className="trav-info-label">Phone</span><span className="trav-info-val">{selected.phone ?? '—'}</span></div>
                  <div className="trav-info-row"><span className="trav-info-label">Nationality</span><span className="trav-info-val">{selected.nationality ?? '—'}</span></div>
                  <div className="trav-info-row"><span className="trav-info-label">Passport</span><span className="trav-info-val">{selected.passport_number ?? '—'}</span></div>
                  <div className="trav-info-row"><span className="trav-info-label">Date of birth</span><span className="trav-info-val">{selected.date_of_birth ?? '—'}</span></div>
                </div>
                {selected.notes && (
                  <>
                    <div className="trav-detail-section-title" style={{ marginTop: 20 }}>Notes</div>
                    <div className="trav-detail-notes">{selected.notes}</div>
                  </>
                )}
                <div style={{ marginTop: 20 }}>
                  <div className="trav-detail-section-title">Recent trips</div>
                  {loadingTrips ? <div className="trav-trips-loading">Loading…</div> : travelerTrips.length === 0 ? (
                    <div className="trav-trips-empty">No trips linked to this traveler yet.</div>
                  ) : travelerTrips.slice(0, 3).map(t => (
                    <div key={t.trip_id} className="trav-trip-row" onClick={() => navigate(`/app/trips/${t.trip_id}`)}>
                      <div className="trav-trip-name">{t.trip_name}</div>
                      <div className="trav-trip-meta">{t.start_date ?? 'TBD'}</div>
                      {t.budget && <div className="trav-trip-value">GHS {Number(t.budget).toLocaleString()}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trips */}
            {detailTab === 'trips' && (
              <div>
                <div className="trav-trips-search-wrap">
                  <input
                    className="trav-trips-search"
                    placeholder="Search trips…"
                    value={tripSearch}
                    onChange={e => setTripSearch(e.target.value)}
                  />
                </div>
                {loadingTrips ? <div className="trav-trips-loading">Loading trips…</div>
                  : travelerTrips.length === 0 ? (
                    <div className="trav-trips-empty">No trips linked to this traveler.</div>
                  ) : travelerTrips
                      .filter(t => !tripSearch || t.trip_name.toLowerCase().includes(tripSearch.toLowerCase()) || (t.description ?? '').toLowerCase().includes(tripSearch.toLowerCase()))
                      .map(t => {
                        const sm = apiStatusMeta[t.status];
                        const otherTravelers = (t.customers ?? []).filter(c => c.customer_id !== selected?.customer_id);
                        return (
                          <div key={t.trip_id} className="trav-trip-card" onClick={() => navigate(`/app/trips/${t.trip_id}`)}>
                            <div className="trav-trip-card-header">
                              <div className="trav-trip-card-name">{t.trip_name}</div>
                              <span className="status-pill" style={{ background: sm.bg, color: sm.fg }}>{sm.display}</span>
                            </div>
                            {otherTravelers.length > 0 && (
                              <div className="trav-trip-multi-label">
                                <span className="trav-trip-multi-badge">+{otherTravelers.length} more</span>
                                <span className="trav-trip-multi-names">
                                  {otherTravelers.map(c => `${c.first_name} ${c.last_name}`).join(', ')}
                                </span>
                              </div>
                            )}
                            <div className="trav-trip-card-meta">
                              {t.start_date && <span>📅 {t.start_date}{t.end_date ? ` – ${t.end_date}` : ''}</span>}
                              {t.description && <span className="trav-trip-card-desc">{t.description.slice(0, 80)}{t.description.length > 80 ? '…' : ''}</span>}
                            </div>
                            {t.budget && (
                              <div className="trav-trip-card-value">GHS {Number(t.budget).toLocaleString()}</div>
                            )}
                          </div>
                        );
                      })
                }
              </div>
            )}

            {/* Finances */}
            {detailTab === 'finances' && (
              <div>
                <div className="trav-finance-summary">
                  <div className="trav-finance-card">
                    <div className="trav-finance-card-label">Total trip value</div>
                    <div className="trav-finance-card-num">{totalSpend > 0 ? `GHS ${totalSpend.toLocaleString()}` : '—'}</div>
                  </div>
                  <div className="trav-finance-card">
                    <div className="trav-finance-card-label">Trips booked</div>
                    <div className="trav-finance-card-num">{travelerTrips.filter(t => BOOKED_LIKE_STATUSES.includes(t.status)).length}</div>
                  </div>
                  <div className="trav-finance-card">
                    <div className="trav-finance-card-label">Avg per trip</div>
                    <div className="trav-finance-card-num">
                      {travelerTrips.length > 0 && totalSpend > 0
                        ? `GHS ${Math.round(totalSpend / travelerTrips.length).toLocaleString()}`
                        : '—'}
                    </div>
                  </div>
                </div>

                <div className="trav-detail-section-title" style={{ marginTop: 20 }}>Trip financial log</div>
                {travelerTrips.length === 0 ? (
                  <div className="trav-trips-empty">No trip data available.</div>
                ) : (
                  <div className="trav-fin-trip-list">
                    {travelerTrips.map(t => {
                      const isBookedTrip = BOOKED_LIKE_STATUSES.includes(t.status);
                      const statusBg = t.status === TripStatus.COMPLETED ? '#EAF0FF' : t.status === TripStatus.BOOKED ? '#16143A' : t.status === TripStatus.IN_PROGRESS ? '#E3F7EF' : '#EEF0F4';
                      const statusFg = t.status === TripStatus.COMPLETED ? '#2B63F6' : t.status === TripStatus.BOOKED ? '#fff' : t.status === TripStatus.IN_PROGRESS ? '#0E9F6E' : '#5B6172';
                      const isExpanded = expandedFinTrip === t.trip_id;
                      const costs = tripCostsMap[t.trip_id];

                      return (
                        <div key={t.trip_id} className="trav-fin-trip-card">
                          <div className="trav-fin-trip-header" onClick={() => {
                            if (!isExpanded) {
                              setExpandedFinTrip(t.trip_id);
                              if (isBookedTrip) fetchTripCosts(t.trip_id);
                            } else {
                              setExpandedFinTrip(null);
                            }
                          }}>
                            <div className="trav-fin-trip-info">
                              <div className="trav-fin-trip-name">{t.trip_name}</div>
                              <div className="trav-fin-trip-meta">
                                {t.start_date ?? 'TBD'}
                                {t.end_date ? ` – ${t.end_date}` : ''}
                              </div>
                            </div>
                            <div className="trav-fin-trip-right">
                              <span className="status-pill" style={{ background: statusBg, color: statusFg, fontSize: 11 }}>{t.status ?? 'Draft'}</span>
                              {t.budget && <span className="trav-fin-trip-value">GHS {Number(t.budget).toLocaleString()}</span>}
                              <span className={`trav-fin-chevron${isExpanded ? ' open' : ''}`}>›</span>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="trav-fin-trip-body">
                              {/* Itinerary cost breakdown (always shown) */}
                              <div className="trav-fin-section-label">Itinerary costs</div>
                              {costs?.itineraries?.[0] ? (() => {
                                const ic = costs.itineraries[0];
                                const fmt = (n: number) => `${ic.currency} ${n.toLocaleString()}`;
                                return (
                                  <div className="trav-fin-cost-rows">
                                    <div className="trav-fin-cost-row"><span>Flights</span><span>{fmt(ic.flights)}</span></div>
                                    <div className="trav-fin-cost-row"><span>Accommodation</span><span>{fmt(ic.accommodation)}</span></div>
                                    <div className="trav-fin-cost-row"><span>Activities & transfers</span><span>{fmt(ic.activities)}</span></div>
                                    <div className="trav-fin-cost-row trav-fin-cost-fee"><span>Service fee (5%)</span><span>{fmt(ic.service_fee)}</span></div>
                                    <div className="trav-fin-cost-row trav-fin-cost-total"><span>Total</span><span>{fmt(ic.total)}</span></div>
                                  </div>
                                );
                              })() : (
                                <div className="trav-fin-no-data">No itinerary costs calculated yet.</div>
                              )}

                              {/* Payments and outstanding — only for booked/completed */}
                              {isBookedTrip && (
                                <>
                                  <div className="trav-fin-section-label" style={{ marginTop: 14 }}>Payments & outstanding</div>
                                  {costs === undefined ? (
                                    <div className="trav-fin-no-data">Loading…</div>
                                  ) : costs === null ? (
                                    <div className="trav-fin-no-data">Could not load payment data.</div>
                                  ) : costs.payments.length === 0 ? (
                                    <div className="trav-fin-no-data">No payments recorded yet.</div>
                                  ) : (
                                    <>
                                      {costs.payments.map((p, pi) => (
                                        <div key={pi} className="trav-fin-payment-row">
                                          <div className="trav-fin-payment-left">
                                            <span className={`trav-fin-pay-status trav-fin-pay-status--${p.status}`}>{p.status}</span>
                                            <span className="trav-fin-pay-method">{p.payment_method ?? 'Payment'}</span>
                                            {p.paid_at && <span className="trav-fin-pay-date">{new Date(p.paid_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</span>}
                                          </div>
                                          <span className="trav-fin-pay-amount">{p.currency} {Number(p.amount).toLocaleString()}</span>
                                        </div>
                                      ))}
                                      {costs.summary && (
                                        <div className="trav-fin-summary">
                                          <div className="trav-fin-sum-row"><span>Total paid</span><span className="trav-fin-sum-paid">GHS {Number(costs.summary.total_paid).toLocaleString()}</span></div>
                                          {costs.summary.total_pending > 0 && <div className="trav-fin-sum-row"><span>Pending</span><span className="trav-fin-sum-pending">GHS {Number(costs.summary.total_pending).toLocaleString()}</span></div>}
                                          <div className="trav-fin-sum-row trav-fin-sum-outstanding"><span>Outstanding</span><span>GHS {Number(costs.summary.outstanding).toLocaleString()}</span></div>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </>
                              )}

                              <div className="trav-fin-trip-actions">
                                <button className="trav-finance-invoice-btn" onClick={() => navigate(`/app/trips/${t.trip_id}`)}>
                                  Open trip →
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {travelerTrips.length > 0 && totalSpend > 0 && (
                  <div className="trav-finance-invoice-row">
                    <button className="trav-finance-invoice-btn" onClick={() => {
                      const lines = [
                        `Invoice — ${selected.first_name} ${selected.last_name}`,
                        `Generated: ${new Date().toLocaleDateString()}`,
                        '',
                        'Trip\tDate\tStatus\tValue',
                        ...travelerTrips.map(t => `${t.trip_name}\t${t.start_date ?? '—'}\t${t.status ?? 'Draft'}\t${t.budget ? `GHS ${Number(t.budget).toLocaleString()}` : '—'}`),
                        '',
                        `Total: GHS ${totalSpend.toLocaleString()}`,
                      ].join('\n');
                      const blob = new Blob([lines], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `invoice-${selected.first_name}-${selected.last_name}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}>
                      ↓ Download invoice
                    </button>
                    <button className="trav-finance-invoice-btn trav-finance-invoice-btn--primary" onClick={() => {
                      const lines = travelerTrips.map(t =>
                        `${t.trip_name} — ${t.start_date ?? 'TBD'} — ${t.budget ? `GHS ${Number(t.budget).toLocaleString()}` : 'N/A'}`
                      ).join('\n');
                      window.open(`mailto:${selected.email ?? ''}?subject=Invoice — ${selected.first_name} ${selected.last_name}&body=${encodeURIComponent(lines)}`);
                    }}>
                      ✉ Email invoice
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            {detailTab === 'messages' && (
              <div className="trav-messages">
                <div className="trav-msg-thread">
                  {messages.length === 0 && (
                    <div className="trav-msg-empty">
                      <div className="trav-msg-empty-icon">💬</div>
                      <p>No messages yet.</p>
                      <p>Send a message to {selected.first_name} below.</p>
                    </div>
                  )}
                  {messages.map((m, i) => (
                    <div key={i} className={`trav-msg-row trav-msg-row--${m.from}`}>
                      {m.from === 'traveler' && (
                        <div className="trav-msg-avatar" style={{ background: avatarColor(selected.customer_id) }}>
                          {getInitials(selected.first_name, selected.last_name)}
                        </div>
                      )}
                      <div className="trav-msg-bubble-wrap">
                        <div className="trav-msg-bubble">{m.text}</div>
                        <div className="trav-msg-time">{m.time}</div>
                      </div>
                    </div>
                  ))}
                  <div ref={msgEndRef} />
                </div>
                <div className="trav-msg-compose">
                  <textarea
                    className="trav-msg-input"
                    placeholder={`Message ${selected.first_name}…`}
                    value={msgText}
                    onChange={e => setMsgText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    rows={2}
                  />
                  <button className="trav-msg-send-btn" onClick={sendMessage} disabled={!msgText.trim()}>
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create/Edit modal ── */}
      {showModal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit traveler' : 'Add traveler'}</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First name *</label>
                  <input className="form-input" name="first_name" value={form.first_name} onChange={handleChange} placeholder="First name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Last name *</label>
                  <input className="form-input" name="last_name" value={form.last_name} onChange={handleChange} placeholder="Last name" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" name="email" value={form.email} onChange={handleChange} placeholder="email@example.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" name="phone" value={form.phone} onChange={handleChange} placeholder="+233 50 000 0000" />
              </div>
              <div className="form-group">
                <label className="form-label">Nationality</label>
                <input className="form-input" name="nationality" value={form.nationality} onChange={handleChange} placeholder="e.g. Ghanaian" />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input form-textarea" name="notes" value={form.notes} onChange={handleChange} placeholder="Any notes..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="modal-card modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete traveler</h3>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this traveler? This cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
