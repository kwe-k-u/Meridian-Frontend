import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { ApiService } from '../services/api-service';
import type { TripOption, TripStatus, Day, DayBlock, Flight, Stay, ItineraryResponse, TripResponse, TripCostResponse } from '../types/app';
import AddItemModal from '../components/modals/AddItemModal';
import '../styles/TripDetail.css';

// ── TripDetail ─────────────────────────────────────────────────
// Purpose: Full trip workspace — hero banner, itinerary builder with
//          tabs (Itinerary/Flights/Stays/Activities/Calls), option selector,
//          cost summary sidebar, and agent activity feed.
// State: apiTrip, tripCosts, editing fields, activeOption, builderTab,
//        addItemDay, updatingStatus.
// API: ApiService.getTrip, .getTripCosts, .updateTrip, .updateTripStatus,
//      .createItinerary, .addItineraryDay, .removeItineraryDay.

// ── Helper functions / transformers ──

const blockKindMeta: Record<string, { icon: string; iconBg: string; kindColor: string }> = {
  Flight: { icon: '✈️', iconBg: '#EAF0FF', kindColor: '#2B63F6' },
  Transfer: { icon: '🚐', iconBg: '#E3F7EF', kindColor: '#0E9F6E' },
  Stay: { icon: '🏨', iconBg: '#F0EBFF', kindColor: '#6B46C1' },
  Dining: { icon: '🍽️', iconBg: '#FFF3E0', kindColor: '#B7791F' },
  Activity: { icon: '⭐', iconBg: '#E3F7EF', kindColor: '#0E9F6E' },
  Venue: { icon: '🏢', iconBg: '#EAF0FF', kindColor: '#2B63F6' },
};

function dayToBlocks(day: NonNullable<ItineraryResponse['itinerary_days']>[number]): DayBlock[] {
  const blocks: DayBlock[] = [];
  if (day.destinations) {
    day.destinations.forEach(d => {
      const meta = blockKindMeta.Activity;
      blocks.push({
        kind: 'Activity',
        kindColor: meta.kindColor,
        icon: meta.icon,
        iconBg: meta.iconBg,
        meta: d.destination?.country ?? '',
        title: d.destination?.name ?? d.activities ?? 'Activity',
        sub: d.activities ?? '',
        price: d.cost ? `${d.currency ?? ''} ${d.cost}` : '',
      });
    });
  }
  if (day.location) {
    const meta = blockKindMeta.Transfer;
    blocks.push({
      kind: 'Location',
      kindColor: meta.kindColor,
      icon: '📍',
      iconBg: meta.iconBg,
      meta: '',
      title: day.location,
      sub: day.description ?? '',
      price: '',
    });
  }
  return blocks;
}

function itineraryDaysToDays(itineraryDays: NonNullable<ItineraryResponse['itinerary_days']>): Day[] {
  return itineraryDays.map((d, i) => {
    const dt = d.date ? new Date(d.date) : null;
    const dow = dt ? dt.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() : '';
    const dayNum = dt ? String(dt.getDate()).padStart(2, '0') : String(d.day_number);
    const mon = dt ? dt.toLocaleDateString('en-US', { month: 'short' }) : '';
    return {
      di: i,
      dow,
      day: dayNum,
      mon,
      title: d.title ?? `Day ${d.day_number}`,
      blocks: dayToBlocks(d),
      hasSuggestion: false,
      addBlock: () => {},
    };
  });
}

function itineraryFlightsToFlights(flights: NonNullable<ItineraryResponse['itinerary_flights']>): Flight[] {
  return flights.map(f => ({
    code: (f.airline ?? 'XX').substring(0, 2).toUpperCase(),
    airline: f.airline ?? 'Unknown',
    route: `${f.departure_airport ?? '???'} → ${f.arrival_airport ?? '???'}`,
    duration: f.departure_datetime && f.arrival_datetime
      ? `${Math.round((new Date(f.arrival_datetime).getTime() - new Date(f.departure_datetime).getTime()) / 3600000)}h`
      : '',
    stops: 'Direct',
    price: f.cost ? `${f.currency ?? 'GHS'} ${Number(f.cost).toLocaleString()}` : '',
    cta: f.status === 'booked' ? 'Selected' : 'Select',
    logoBg: '#2B63F6',
    recDisplay: 'none',
    border: '#ECEDF2',
    bg: '#fff',
  }));
}

function itineraryStaysToStays(accommodation: NonNullable<ItineraryResponse['itinerary_accommodation']>): Stay[] {
  return accommodation.map(a => ({
    name: a.accommodation_name,
    loc: a.address ?? '',
    rating: '4.5',
    price: a.cost ? `${a.currency ?? 'GHS'} ${Number(a.cost).toLocaleString()}` : '',
    cover: '#EAF0FF',
    recDisplay: 'none',
    border: '#ECEDF2',
    bg: '#fff',
    tags: a.room_type ? [a.room_type] : [],
  }));
}

const apiStatusMeta: Record<string, { display: string; bg: string; fg: string; gradient: string }> = {
  planning:    { display: 'Draft',           bg: '#EEF0F4', fg: '#5B6172', gradient: 'linear-gradient(135deg,#334155,#7889A6)' },
  inquiry:     { display: 'Inquiry',         bg: '#FFF3E0', fg: '#B7791F', gradient: 'linear-gradient(135deg,#E08A2B,#F5C06B)' },
  booked:      { display: 'Booked',          bg: '#16143A', fg: '#FFFFFF', gradient: 'linear-gradient(135deg,#15803D,#5DBE7E)' },
  in_progress: { display: 'In Progress',     bg: '#E3F7EF', fg: '#0E9F6E', gradient: 'linear-gradient(135deg,#0E7C8F,#36C5C0)' },
  completed:   { display: 'Completed',       bg: '#EAF0FF', fg: '#2B63F6', gradient: 'linear-gradient(135deg,#1B5BBE,#5AA0FF)' },
  cancelled:   { display: 'Cancelled',       bg: '#FDECEC', fg: '#D64545', gradient: 'linear-gradient(135deg,#C2410C,#F59E5B)' },
};

function fmtDateRange(start: string | null, end: string | null): string {
  if (!start) return 'TBD';
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (!e || s.getTime() === e.getTime()) return s.toLocaleDateString('en-US', opts);
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export default function TripDetail() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const ctx = useApp();
  const isRealId = tripId ? !/^\d+$/.test(tripId) : false;
  const tid = tripId ? (isRealId ? 0 : parseInt(tripId, 10)) : 0;
  const { activeOption, setActiveOption, builderTab, setBuilderTab, activeCall, setActiveCall } = ctx;

  // ── Component state ──

  const [apiTrip, setApiTrip] = useState<TripResponse | null>(null);
  const [apiTripLoading, setApiTripLoading] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    setApiTripLoading(true);
    ApiService.getTrip(tripId)
      .then(setApiTrip)
      .catch(() => setApiTrip(null))
      .finally(() => setApiTripLoading(false));
  }, [tripId]);

  const [tripCosts, setTripCosts] = useState<TripCostResponse | null>(null);

  useEffect(() => {
    if (!tripId) return;
    ApiService.getTripCosts(tripId).then(setTripCosts).catch(() => {});
  }, [tripId]);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [addItemDay, setAddItemDay] = useState<number | null>(null);

  const refreshTrip = useCallback(() => {
    if (!tripId) return;
    ApiService.getTrip(tripId).then(setApiTrip);
  }, [tripId]);

  const startEditing = () => {
    setEditName(apiTrip?.trip_name ?? td.name);
    setEditStartDate(apiTrip?.start_date ?? '');
    setEditEndDate(apiTrip?.end_date ?? '');
    setEditBudget(apiTrip?.budget ?? '');
    setEditDescription(apiTrip?.description ?? '');
    setEditing(true);
  };

  const cancelEditing = () => setEditing(false);

  const saveEditing = async () => {
    if (!tripId || !apiTrip) return;
    await ApiService.updateTrip(tripId, {
      trip_name: editName,
      start_date: editStartDate || undefined,
      end_date: editEndDate || undefined,
      budget: editBudget || undefined,
      description: editDescription || undefined,
    });
    setEditing(false);
    refreshTrip();
  };

  const handleStatusTransition = async (status: string) => {
    if (!tripId || !apiTrip) return;
    setUpdatingStatus(true);
    try {
      await ApiService.updateTripStatus(tripId, status);
      refreshTrip();
    } finally {
      setUpdatingStatus(false);
    }
  };

  const { td: mockTd, tb: mockTb } = ctx.getTripDetail(tid, activeOption);

  // ── Derived data ──

  const tripTd = useMemo(() => {
    if (!apiTrip) return mockTd;
    const sm = apiStatusMeta[apiTrip.status] ?? { display: apiTrip.status, bg: '#EEF0F4', fg: '#5B6172', gradient: 'linear-gradient(135deg,#334155,#7889A6)' };
    const trav = apiTrip.customers?.[0]
      ? `${apiTrip.customers[0].first_name} ${apiTrip.customers[0].last_name}`
      : (typeof apiTrip.created_by === 'object' && apiTrip.created_by
        ? apiTrip.created_by.display_name
        : 'Traveler');
    return {
      ...mockTd,
      name: apiTrip.trip_name,
      traveler: trav,
      dates: fmtDateRange(apiTrip.start_date, apiTrip.end_date),
      where: apiTrip.description?.split('.')[0] ?? apiTrip.trip_name,
      value: apiTrip.budget ? `GHS ${Number(apiTrip.budget).toLocaleString()}` : mockTd.value,
      status: sm.display as TripStatus,
      statusBg: sm.bg,
      statusFg: sm.fg,
      gradient: sm.gradient,
      origin: apiTrip.customers?.[0]?.last_name ?? 'Traveler',
    };
  }, [apiTrip, mockTd]);

  const tripTb = useMemo(() => {
    if (!apiTrip) return mockTb;
    const ic = apiTrip.itineraries ?? [];
    const hasItins = ic.length > 0;
    return {
      icon: hasItins ? '✦' : '📋',
      iconBg: hasItins ? '#F4F7FF' : '#EEF0F4',
      headline: hasItins
        ? `${ic.length} itinerary option${ic.length > 1 ? 's' : ''} ready for review`
        : 'Start building your itinerary',
      desc: hasItins
        ? `Option${ic.length > 1 ? 's' : ''} ${ic.map((_, i) => String.fromCharCode(65 + i)).join(', ')}`
        : 'Generate itinerary options to get started',
      bg: hasItins ? '#F4F7FF' : '#EEF0F4',
      border: hasItins ? '#C4D2FF' : '#DDE0E8',
      fg: hasItins ? '#2B63F6' : '#5B6172',
      descColor: '#5B6172',
      chipBorder: '#C4D2FF',
      showDrafting: false,
      showBuilder: true,
      showDraft: apiTrip.status === 'planning' || apiTrip.status === 'inquiry',
      showOptions: hasItins,
      showRefs: false,
      refs: [],
    };
  }, [apiTrip, mockTb]);

  const td = tripTd;
  const tb = tripTb;

  const selectedItinerary = useMemo(() => {
    if (!apiTrip?.itineraries || apiTrip.itineraries.length === 0) return null;
    const idx = ['A', 'B', 'C', 'D', 'E'].indexOf(activeOption);
    return apiTrip.itineraries[idx >= 0 && idx < apiTrip.itineraries.length ? idx : 0] ?? null;
  }, [apiTrip, activeOption]);

  const hasApiData = selectedItinerary != null
    && (selectedItinerary.itinerary_days?.length ?? 0) > 0;

  const computedCosts = useMemo(() => {
    if (tripCosts) {
      const ic = tripCosts.itinerary_costs;
      const c = tripCosts.currency;
      const fmt = (n: number) => `${c} ${n.toLocaleString()}`;
      return {
        rows: [
          { label: 'Flights', value: fmt(ic.flights) },
          { label: 'Accommodation', value: fmt(ic.accommodation) },
          { label: 'Activities & transfers', value: fmt(ic.activities) },
        ],
        fee: `Service fee (5%) ${fmt(ic.service_fee)}`,
        total: fmt(ic.total),
        payments: tripCosts.payments,
        summary: tripCosts.summary,
      };
    }
    if (selectedItinerary) {
      const flightsCost = (selectedItinerary.itinerary_flights ?? []).reduce((s, f) => s + (f.cost ?? 0), 0);
      const staysCost = (selectedItinerary.itinerary_accommodation ?? []).reduce((s, a) => s + (a.cost ?? 0), 0);
      const activitiesCost = (selectedItinerary.itinerary_days ?? []).reduce((sum, d) =>
        sum + (d.destinations ?? []).reduce((s2, dst) => s2 + (dst.cost ?? 0), 0), 0);
      const currency = selectedItinerary.itinerary_flights?.[0]?.currency ?? selectedItinerary.itinerary_accommodation?.[0]?.currency ?? 'GHS';
      const fmt = (n: number) => `${currency} ${n.toLocaleString()}`;
      const subTotal = flightsCost + staysCost + activitiesCost;
      const fee = Math.round(subTotal * 0.05);
      const total = subTotal + fee;
      return {
        rows: [
          { label: 'Flights', value: fmt(flightsCost) },
          { label: 'Accommodation', value: fmt(staysCost) },
          { label: 'Activities & transfers', value: fmt(activitiesCost) },
        ],
        fee: `Service fee (5%) ${fmt(fee)}`,
        total: fmt(total),
      };
    }
    return null;
  }, [tripCosts, selectedItinerary]);

  const costs = computedCosts?.rows ?? td.costs ?? [];
  const costTotal = computedCosts?.total ?? td.total ?? '';
  const costFee = computedCosts?.fee ?? 'Service fee charged to traveller';
  const payments = computedCosts?.payments ?? [];
  const costSummary = computedCosts?.summary ?? null;
  const costCurrency = tripCosts?.currency ?? 'GHS';

  const rawDays = hasApiData && selectedItinerary?.itinerary_days
    ? itineraryDaysToDays(selectedItinerary.itinerary_days)
    : apiTrip
    ? [{ di: 0, dow: '', day: '01', mon: '', title: 'Day 1', blocks: [], addBlock: () => {} }]
    : ctx.getDays(tid, activeOption);

  // ── Event handlers ──

  const handleRemoveBlock = (di: number, bi: number) => {
    if (selectedItinerary?.itinerary_days?.[di]?.destinations) {
      const dst = selectedItinerary.itinerary_days[di].destinations!;
      if (dst[bi]?.destination_id) {
        const dayId = selectedItinerary.itinerary_days[di].itinerary_day_id;
        if (dayId) {
          ApiService.removeItineraryDay(dayId).then(() => refreshTrip());
          return;
        }
      }
    }
    ctx.removeBlock(di, bi);
  };

  const handleAddBlock = async (di: number) => {
    const day = selectedItinerary?.itinerary_days?.[di];

    if (day?.itinerary_day_id) {
      setAddItemDay(di);
      return;
    }

    if (!apiTrip) {
      ctx.addBlock(di);
      return;
    }

    try {
      let itnId: string;

      if (!selectedItinerary) {
        const itn = await ApiService.createItinerary({
          trip_id: apiTrip.trip_id,
          itinerary_name: `Option A`,
          description: `Auto-created itinerary`,
        });
        itnId = itn.itinerary_id;
      } else {
        itnId = selectedItinerary.itinerary_id;
      }

      await ApiService.addItineraryDay(itnId, {
        day_number: di + 1,
        date: apiTrip.start_date ? apiTrip.start_date.split('T')[0] : undefined,
        title: `Day ${di + 1}`,
      });

      await refreshTrip();
      setAddItemDay(di);
    } catch {
      ctx.addBlock(di);
    }
  };

  const days = rawDays.map((d, di) => ({
    ...d,
    di: d.di ?? di,
    blocks: d.blocks.map((b, bi) => ({
      ...b,
      remove: () => handleRemoveBlock(di, bi),
    })),
    addSuggestion: d.hasSuggestion ? () => ctx.addSuggestion(di) : undefined,
    addBlock: () => handleAddBlock(di),
  }));

  const flights = selectedItinerary?.itinerary_flights
    ? itineraryFlightsToFlights(selectedItinerary.itinerary_flights)
    : apiTrip ? [] : ctx.getFlights();

  const stays = selectedItinerary?.itinerary_accommodation
    ? itineraryStaysToStays(selectedItinerary.itinerary_accommodation)
    : apiTrip ? [] : ctx.getStays();

  const activitiesData = ctx.getActivities().map(a => ({
    ...a,
    add: () => ctx.addActivity({ name: a.name, meta: a.meta, price: a.price }),
  }));
  const { calls: callLogsArr, callDetails } = ctx.getCallLogs();
  const call = callDetails[activeCall] ?? null;
  const agentFeed = ctx.getAgentFeed();

  useEffect(() => {
    const state = location.state as { triggerGenerate?: boolean } | null;
    if (state?.triggerGenerate) {
      ctx.generateOptions();
      window.history.replaceState({}, '');
    }
  }, []);

  const tripAgent = ['Kweku Ansah', 'Adwoa Mensah', 'Yaw Boateng', 'Efua Osei'][tid % 4];

  const builderTabs = [
    { key: 'itinerary' as const, label: 'Itinerary' },
    { key: 'flights' as const, label: 'Flights' },
    { key: 'stays' as const, label: 'Stays' },
    { key: 'activities' as const, label: 'Activities' },
    { key: 'calls' as const, label: 'Calls' },
  ];

  const tabItin = builderTab === 'itinerary';
  const tabFlights = builderTab === 'flights';
  const tabStays = builderTab === 'stays';
  const tabActs = builderTab === 'activities';
  const tabCalls = builderTab === 'calls';

  const handleGenerateOptions = () => {
    ctx.openGenItin();
  };

  const handleMessageTraveler = () => {
    navigate('/app/messages');
  };

  const handleOpenTravelerView = () => {
    navigate('/travel/' + (isRealId && tripId ? tripId : tid));
  };

  const options: TripOption[] = useMemo(() => {
    if (apiTrip?.itineraries && apiTrip.itineraries.length > 0) {
      return apiTrip.itineraries.map((it, i) => {
        const letter = String.fromCharCode(65 + i);
        return {
          letter,
          name: it.itinerary_name ?? `Option ${letter}`,
          sub: it.description ?? '',
          cover: ['#2B63F6', '#13B981', '#EB8C2B', '#8B5CF6', '#EC4899'][i % 5],
          rec: i === 0,
          onClick: () => setActiveOption(letter),
        };
      });
    }
    return td.options.map(o => ({
      ...o,
      onClick: () => setActiveOption(o.letter),
    }));
  }, [apiTrip, td.options, setActiveOption]);

  const optLabel = options.length > 1
    ? `${options.length} itinerary options ready for review`
    : 'Itinerary option:';

  // ── Render ──

  return (
    <div className="td-page">
      <div className="td-inner">
        <button
          onClick={() => navigate('/app/trips')}
          className="td-back-btn"
        >
          ← All trips
        </button>

        <div className="td-card mb-24">
          <div className="td-hero-banner" style={{ background: td.gradient }}>
            <div className="td-hero-badge">
              <span className="td-hero-badge-text">
                {td.origin}
              </span>
            </div>
          </div>
          <div className="td-hero-body">
            <div className="td-hero-left">
              <div className="td-hero-title-row">
                {editing ? (
                  <input
                    className="td-edit-input td-edit-name"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Trip name"
                  />
                ) : (
                  <h1 className="td-hero-title">{td.name}</h1>
                )}
                <span className="td-hero-status" style={{ background: td.statusBg, color: td.statusFg }}>
                  {td.status}
                </span>
              </div>
              <div className="td-hero-meta">
                {editing ? (
                  <div className="td-edit-meta-row">
                    <label className="td-edit-label">
                      Start:
                      <input
                        type="date" className="td-edit-input td-edit-date"
                        value={editStartDate} onChange={e => setEditStartDate(e.target.value)}
                      />
                    </label>
                    <label className="td-edit-label">
                      End:
                      <input
                        type="date" className="td-edit-input td-edit-date"
                        value={editEndDate} onChange={e => setEditEndDate(e.target.value)}
                      />
                    </label>
                    <label className="td-edit-label">
                      Budget:
                      <input
                        className="td-edit-input td-edit-budget"
                        value={editBudget} onChange={e => setEditBudget(e.target.value)}
                        placeholder="e.g. 50000"
                      />
                    </label>
                  </div>
                ) : (
                  <>
                    <span>{td.traveler}</span>
                    <span className="td-hero-dot" />
                    <span>{td.where}</span>
                    <span className="td-hero-dot" />
                    <span>{td.dates}</span>
                    <span className="td-hero-dot" />
                    <span className="td-hero-value">{td.value}</span>
                  </>
                )}
              </div>
            </div>
            <div className="td-hero-actions">
              {editing && (
                <>
                  <label className="td-edit-label td-edit-desc-label">
                    Description:
                    <textarea
                      className="td-edit-input td-edit-desc"
                      value={editDescription} onChange={e => setEditDescription(e.target.value)}
                      placeholder="Trip description"
                      rows={2}
                    />
                  </label>
                  <button onClick={saveEditing} className="td-action-btn" style={{ background: '#13B981', color: '#fff', borderColor: '#13B981' }} disabled={!editName.trim()}>
                    Save
                  </button>
                  <button onClick={cancelEditing} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>
                    Cancel
                  </button>
                </>
              )}
              {!editing && apiTrip && (
                <>
                  <button onClick={startEditing} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>
                    Edit
                  </button>
                  {apiTrip.status === 'planning' && (
                    <>
                      <button onClick={handleGenerateOptions} className="td-action-btn" style={{ background: '#2B63F6', color: '#fff', borderColor: '#2B63F6' }} disabled={updatingStatus}>
                        ✦ Generate options
                      </button>
                      <button onClick={handleMessageTraveler} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>
                        Message {td.traveler.split(' ')[0]}
                      </button>
                    </>
                  )}
                  {apiTrip.status === 'inquiry' && (
                    <>
                      <button onClick={handleOpenTravelerView} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>Preview</button>
                      <button onClick={() => handleStatusTransition('booked')} className="td-action-btn" style={{ background: '#2B63F6', color: '#fff', borderColor: '#2B63F6' }} disabled={updatingStatus}>
                        Share & Book
                      </button>
                    </>
                  )}
                  {apiTrip.status === 'booked' && (
                    <>
                      <button onClick={handleOpenTravelerView} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>View trip pack</button>
                      <button onClick={handleMessageTraveler} className="td-action-btn" style={{ background: '#2B63F6', color: '#fff', borderColor: '#2B63F6' }}>
                        Message {td.traveler.split(' ')[0]}
                      </button>
                    </>
                  )}
                  {apiTrip.status === 'in_progress' && (
                    <>
                      <button onClick={handleOpenTravelerView} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>Preview</button>
                      <button onClick={() => handleStatusTransition('completed')} className="td-action-btn" style={{ background: '#13B981', color: '#fff', borderColor: '#13B981' }} disabled={updatingStatus}>
                        Complete trip
                      </button>
                    </>
                  )}
                  {apiTrip.status === 'completed' && (
                    <>
                      <button onClick={handleOpenTravelerView} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>View trip pack</button>
                      <button onClick={() => handleStatusTransition('in_progress')} className="td-action-btn" style={{ background: '#EB8C2B', color: '#fff', borderColor: '#EB8C2B' }} disabled={updatingStatus}>
                        Reopen
                      </button>
                    </>
                  )}
                  {apiTrip.status === 'cancelled' && (
                    <>
                      <button onClick={handleOpenTravelerView} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>Preview</button>
                      <button onClick={() => handleStatusTransition('planning')} className="td-action-btn" style={{ background: '#2B63F6', color: '#fff', borderColor: '#2B63F6' }} disabled={updatingStatus}>
                        Reactivate
                      </button>
                    </>
                  )}
                </>
              )}
              {!editing && !apiTrip && (
                <>
                  <button onClick={startEditing} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>
                    Edit
                  </button>
                  <button onClick={handleGenerateOptions} className="td-action-btn" style={{ background: '#2B63F6', color: '#fff', borderColor: '#2B63F6' }}>
                    ✦ Generate options
                  </button>
                  <button onClick={handleMessageTraveler} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>
                    Message traveler
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="td-tip-banner" style={{ background: tb.bg, borderColor: tb.border }}>
          <div className="td-tip-row">
            <div className="td-tip-icon" style={{ background: tb.iconBg }}>
              {tb.icon}
            </div>
            <div className="td-tip-content">
              <div className="td-tip-headline" style={{ color: tb.fg }}>
                {tb.headline}
              </div>
              <div className="td-tip-desc" style={{ color: tb.descColor, marginBottom: tb.showRefs ? 12 : 0 }}>
                {tb.desc}
              </div>
              {tb.showRefs && tb.refs.length > 0 && (
                <div className="td-tip-refs">
                  {tb.refs.map((r, i) => (
                    <span key={i} className="td-tip-ref" style={{ borderColor: tb.chipBorder }}>
                      <span className="td-tip-ref-label">{r.label}:</span>
                      <span className="td-tip-ref-value">{r.value}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {tb.showOptions && options.length > 0 && (
          <div className="mb-24">
            <div className="td-options-label">
              {optLabel}
            </div>
            <div className="td-options-row">
              {options.map((opt) => {
                const isActive = activeOption === opt.letter;
                return (
                  <div
                    key={opt.letter}
                    onClick={opt.onClick}
                    className="td-pill-container"
                    style={{
                      borderColor: isActive ? '#2B63F6' : '#ECEDF2',
                      background: isActive ? '#F4F7FF' : '#fff',
                    }}
                  >
                    <div className="td-option-letter" style={{ background: opt.cover }}>
                      {opt.letter}
                    </div>
                    <div className="td-option-info">
                      <div className="td-option-name" style={{ color: isActive ? '#2B63F6' : '#15161B' }}>
                        {opt.name}
                      </div>
                      <div className="td-option-sub">
                        {opt.sub}
                      </div>
                    </div>
                    {opt.rec && (
                      <span className="td-ai-pick">
                        ✦ AI pick
                      </span>
                    )}
                  </div>
                );
              })}
              <div className="td-add-option">
                <span className="td-add-option-plus">+</span>
                <span className="td-add-option-label">Add option</span>
              </div>
            </div>
          </div>
        )}

        {tb.showDrafting && (
          <div className="td-drafting-state">
            <div className="td-drafting-icon">
              ✦
            </div>
            <div className="td-drafting-title">
              Meridian is building options…
            </div>
            <div className="td-drafting-bar">
              <div className="td-drafting-fill" />
            </div>
            <button
              onClick={ctx.revealOptions}
              className="td-drafting-skip"
            >
              Skip & preview
            </button>
          </div>
        )}

        {tb.showDraft && td.brief && (
          <div className="td-brief-grid">
            <div className="td-card">
              <div className="td-brief-pad">
                <div className="td-brief-badge">
                  ✦ AI summary from discovery call
                </div>
                <p className="td-brief-text">
                  {td.brief}
                </p>
                <button
                  onClick={handleGenerateOptions}
                  className="td-brief-generate"
                >
                  ✦ Generate 3 itinerary options
                </button>
              </div>
            </div>
            {td.briefChips && td.briefChips.length > 0 && (
              <div className="td-card">
                <div className="td-brief-pad">
                  <div className="td-brief-chips-title">
                    From the brief
                  </div>
                  <div className="td-brief-chips">
                    {td.briefChips.map((chip, i) => (
                      <div key={i} className="td-chip" style={{ borderColor: '#DDE0E8' }}>
                        <span>{chip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tb.showBuilder && (
          <div className="td-builder-layout">
            <div className="td-card">
              <div className="td-tabs-bar">
                {builderTabs.map(t => (
                  <button key={t.key} className={'td-tab-btn' + (builderTab === t.key ? ' td-tab-btn--active' : '')} onClick={() => setBuilderTab(t.key)}>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="td-tab-content">
                {tabItin && (
                  <div>
                    {apiTripLoading && (
                      <div className="td-loading">Loading itinerary...</div>
                    )}
                    {days.map((day) => (
                      <div key={day.di} className="td-day-row">
                        <div className="td-day-col">
                          <span className="td-day-dow">
                            {day.dow}
                          </span>
                          <span className="td-day-num">
                            {day.day}
                          </span>
                          <span className="td-day-mon">
                            {day.mon}
                          </span>
                        </div>

                        <div className="td-timeline-col">
                          <div className="td-timeline-dot" />
                          <div className="td-timeline-line" />
                        </div>

                        <div className="td-day-body">
                          <div className="td-day-title">
                            {day.title}
                          </div>

                          <div className="td-day-blocks">
                            {day.blocks.map((block, bi) => (
                              <div key={bi} className="td-block-card">
                                <div className="td-block-icon" style={{ background: block.iconBg }}>
                                  {block.icon}
                                </div>
                                <div className="td-block-info">
                                  <div className="td-block-kind-row">
                                    <span className="td-block-kind" style={{ color: block.kindColor }}>
                                      {block.kind}
                                    </span>
                                    {block.meta && (
                                      <>
                                        <span className="td-block-dot" />
                                        <span className="td-block-meta">
                                          {block.meta}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  <div className="td-block-title">
                                    {block.title}
                                  </div>
                                  {block.sub && (
                                    <div className="td-block-sub">
                                      {block.sub}
                                    </div>
                                  )}
                                </div>
                                <div className="td-block-price-col">
                                  {block.price && (
                                    <div className="td-block-price">
                                      {block.price}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={block.remove}
                                  className="td-block-remove"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>

                          {day.hasSuggestion && day.suggestion && (
                            <div className="td-suggestion">
                              <span className="td-suggestion-icon">✦</span>
                              <div className="td-suggestion-text">
                                <span className="td-suggestion-label">
                                  Meridian suggests
                                </span>
                                <span className="td-suggestion-desc">
                                  {day.suggestion}
                                </span>
                              </div>
                              <button
                                onClick={day.addSuggestion}
                                className="td-suggestion-add"
                              >
                                + Add
                              </button>
                            </div>
                          )}

                          <button onClick={day.addBlock} className="td-dashed-btn">
                            + Add item to this day
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {tabFlights && (
                  <div>
                    <p className="td-flights-desc">
                      Select flights for this itinerary. Prices shown per person.
                    </p>
                    <div className="td-flights-list">
                      {flights.map((f, i) => (
                        <div
                          key={i}
                          className="td-flight-row"
                          style={{ borderColor: f.border, background: f.bg }}
                        >
                          <div className="td-flight-logo" style={{ background: f.logoBg }}>
                            {f.code}
                          </div>
                          <div className="td-flight-info">
                            <div className="td-flight-airline">
                              {f.airline}
                            </div>
                            <div className="td-flight-route">
                              {f.route}
                            </div>
                            <div className="td-flight-dur">
                              {f.duration} · {f.stops}
                            </div>
                          </div>
                          <div className="td-flight-price-col">
                            <div className="td-flight-price">
                              {f.price}
                            </div>
                            <button
                              className="td-flight-cta"
                              style={{
                                border: f.cta === 'Selected' ? '1px solid #C4D2FF' : 'none',
                                background: f.cta === 'Selected' ? '#fff' : '#2B63F6',
                                color: f.cta === 'Selected' ? '#5B6172' : '#fff',
                              }}
                            >
                              {f.cta}
                            </button>
                          </div>
                          {f.recDisplay === 'inline-block' && (
                            <span className="td-flight-rec">
                              Recommended
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tabStays && (
                  <div>
                    <p className="td-stays-desc">
                      Select stays for this itinerary. All prices shown per night.
                    </p>
                    <div className="td-stays-grid">
                      {stays.map((st, i) => (
                        <div
                          key={i}
                          className="td-stay-card"
                          style={{ border: `1px solid ${st.border}`, background: st.bg }}
                        >
                          <div className="td-stay-cover" style={{ background: st.cover }} />
                          <div className="td-stay-body">
                            <div className="td-stay-title-row">
                              <span className="td-stay-name">
                                {st.name}
                              </span>
                              <span className="td-stay-rating">
                                ★ {st.rating}
                              </span>
                            </div>
                            <div className="td-stay-loc">
                              {st.loc}
                            </div>
                            <div className="td-stay-tags">
                              {st.tags.map((tag, ti) => (
                                <span key={ti} className="td-stay-tag">
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <div className="td-stay-bottom">
                              <span className="td-stay-price">
                                {st.price}
                                <span className="td-stay-price-unit"> / night</span>
                              </span>
                              <button className="td-stay-select">
                                Select
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tabActs && (
                  <div>
                    <p className="td-acts-desc">
                      Add activities to this itinerary. They'll appear on the last day.
                    </p>
                    <div className="td-acts-grid">
                      {activitiesData.map((act, i) => (
                        <div
                          key={i}
                          className="td-act-card"
                        >
                          <div className="td-act-cover" style={{ background: act.cover }} />
                          <div className="td-act-body">
                            <div className="td-act-name">
                              {act.name}
                            </div>
                            <div className="td-act-meta">
                              {act.meta}
                            </div>
                            <div className="td-act-bottom">
                              <span className="td-act-price">
                                {act.price}
                              </span>
                              <button
                                onClick={act.add}
                                className="td-act-add"
                              >
                                + Add
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tabCalls && (
                  <div className="td-calls-grid">
                    <div>
                      {callLogsArr.map((cl, i) => (
                        <div
                          key={i}
                          onClick={() => setActiveCall(i)}
                          className="td-call-log"
                          style={{ background: cl.bg, borderColor: cl.border }}
                        >
                          <div className="td-call-log-icon">
                            {cl.icon}
                          </div>
                          <div className="td-call-log-info">
                            <div className="td-call-log-title">
                              {cl.title}
                            </div>
                            <div className="td-call-log-meta">
                              {cl.meta}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div>
                      {call ? (
                        <div>
                          <div className="td-call-detail-wrap">
                            <div className="td-call-detail-title">
                              {call.title}
                            </div>
                            <div className="td-call-detail-meta">
                              {call.meta}
                            </div>
                          </div>
                          <div className="td-call-badge">
                            ✓ AI transcript processed
                          </div>
                          <div className="td-call-section">
                            <div className="td-call-section-label">
                              Summary
                            </div>
                            <p className="td-summary-text">
                              {call.summary}
                            </p>
                          </div>
                          <div className="td-call-section">
                            <div className="td-call-section-label-mb8">
                              Action points
                            </div>
                            {call.actions.map((a, i) => (
                              <div key={i} className="td-call-action-row">
                                <span className="td-call-action-num">
                                  {a.n}
                                </span>
                                <span className="td-call-action-text">
                                  {a.text}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div>
                            <div className="td-call-section-label-mb8">
                              Decisions captured
                            </div>
                            <div className="td-call-decisions">
                              {call.decisions.map((d, i) => (
                                <span key={i} className="td-call-decision">
                                  {d}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="td-call-empty">
                          Select a call to view details
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="td-sticky-sidebar">
              <div className="td-right-card">
                <div className="td-right-card-header">
                  <div className="td-right-card-title">
                    Cost summary
                  </div>
                </div>
                <div className="td-cost-body">
                  {costs.map((c, i) => (
                    <div
                      key={i}
                      className="td-cost-row"
                    >
                      <span className="td-cost-label">
                        {c.label}
                      </span>
                      <span className="td-cost-value">
                        {c.value}
                      </span>
                    </div>
                  ))}
                  <div className="td-cost-total">
                    <span className="td-cost-total-label">
                      Total
                    </span>
                    <span className="td-cost-total-value">
                      {costTotal}
                    </span>
                  </div>
                  <div className="td-cost-fee">
                    {costFee}
                  </div>
                  {payments.length > 0 && (
                    <>
                      <div className="td-cost-divider" />
                      <div className="td-cost-pay-heading">Payments</div>
                      {payments.map((p, i) => (
                        <div key={i} className="td-pay-row">
                          <div className="td-pay-info">
                            <span className="td-pay-method">{p.payment_method ?? 'Unknown'}</span>
                            <span className="td-pay-status" data-status={p.status}>
                              {p.status}
                            </span>
                            {p.paid_at && (
                              <span className="td-pay-date">{new Date(p.paid_at).toLocaleDateString()}</span>
                            )}
                          </div>
                          <span className="td-pay-amount">{costCurrency} {Number(p.amount).toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="td-cost-divider" />
                      <div className="td-summary-rows">
                        {costSummary && (
                          <>
                            <div className="td-summary-row">
                              <span>Total paid</span>
                              <span className="td-summary-paid">{costCurrency} {Number(costSummary.total_paid).toLocaleString()}</span>
                            </div>
                            <div className="td-summary-row">
                              <span>Pending</span>
                              <span className="td-summary-pending">{costCurrency} {Number(costSummary.total_pending).toLocaleString()}</span>
                            </div>
                            <div className="td-summary-row td-summary-outstanding">
                              <span>Outstanding</span>
                              <span>{costCurrency} {Number(costSummary.outstanding).toLocaleString()}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="td-right-card">
                <div className="td-agent-header">
                  <span className="td-agent-dot" />
                  <span className="td-agent-title">
                    Agent activity
                  </span>
                </div>
                <div className="td-agent-name-row">
                  <span className="td-agent-name">
                    {tripAgent}
                  </span>
                </div>
                {agentFeed.map((f, i) => (
                  <div
                    key={i}
                    className="td-agent-item"
                    style={{
                      borderBottom: i < agentFeed.length - 1 ? '1px solid #F2F4F9' : 'none',
                    }}
                  >
                    <div className="td-agent-item-icon" style={{ background: f.iconBg }}>
                      {f.iconEl}
                    </div>
                    <div className="td-agent-item-content">
                      <div className="td-agent-item-title">
                        {f.title}
                      </div>
                      <div className="td-agent-item-detail">
                        {f.detail}
                      </div>
                      <div className="td-agent-item-bottom">
                        <button
                          onClick={f.action}
                          className="td-agent-item-action"
                        >
                          {f.actionLabel}
                        </button>
                        <span className="td-agent-item-time">
                          {f.time}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <AddItemModal
        open={addItemDay !== null}
        dayIndex={addItemDay ?? 0}
        dayId={addItemDay !== null
          ? selectedItinerary?.itinerary_days?.find(d => d.day_number === addItemDay + 1)?.itinerary_day_id ?? null
          : null}
        onClose={() => setAddItemDay(null)}
        onSaved={() => { refreshTrip(); setAddItemDay(null); }}
      />
    </div>
  );
}
