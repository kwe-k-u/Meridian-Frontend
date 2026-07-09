import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { ApiService } from '../services/api-service';
import type { TripOption, TripStatus, Day, DayBlock, Flight, Stay, ItineraryResponse, TripResponse, TripCostResponse, CallResponse, ItineraryAccommodationResponse, ItineraryFlightResponse, SkippedProvider } from '../types/app';
import AddItemModal, { type EditingDayItem } from '../components/modals/AddItemModal';
import AddFlightModal from '../components/modals/AddFlightModal';
import AddStayModal from '../components/modals/AddStayModal';
import AssignTravelerModal from '../components/modals/AssignTravelerModal';
import EditTripModal from '../components/modals/EditTripModal';
import '../styles/TripDetail.css';

// ── TripDetail ─────────────────────────────────────────────────
// Purpose: Full trip workspace — hero banner, itinerary builder with
//          tabs (Itinerary/Flights/Stays/Activities/Calls), option selector,
//          cost summary sidebar, and agent activity feed.
// State: apiTrip, tripCosts, editTripOpen, activeOption, builderTab,
//        addItemDay, addFlightOpen, addingDay, generatingItinerary, updatingStatus.
// API: ApiService.getTrip, .getTripCosts, .updateTripStatus, .generateItinerary,
//      .createItinerary, .addItineraryDay, .removeItineraryDay, .removeFlight (add/edit flows
//      for the trip itself, flights, stays, destinations, and the traveler are all delegated
//      to EditTripModal/AddFlightModal/AddStayModal/AddItemModal/AssignTravelerModal, which
//      call ApiService themselves).
//
// The route param `tripId` can be either a real backend trip_id (a string like "TRP_...")
// or a legacy numeric mock trip index (e.g. "0", "3") — `isRealId`/`tid` below is how nearly
// every piece of derived state in this file branches between "fetch real data" and "render
// one of the hardcoded demo trips from constants/app.ts" behavior.

// ── Helper functions / transformers ──

const blockKindMeta: Record<string, { icon: string; iconBg: string; kindColor: string }> = {
  Flight: { icon: '✈️', iconBg: '#EAF0FF', kindColor: '#2B63F6' },
  Transfer: { icon: '🚐', iconBg: '#E3F7EF', kindColor: '#0E9F6E' },
  Stay: { icon: '🏨', iconBg: '#F0EBFF', kindColor: '#6B46C1' },
  Dining: { icon: '🍽️', iconBg: '#FFF3E0', kindColor: '#B7791F' },
  Activity: { icon: '⭐', iconBg: '#E3F7EF', kindColor: '#0E9F6E' },
  Venue: { icon: '🏢', iconBg: '#EAF0FF', kindColor: '#2B63F6' },
};

// Maps the backend's lowercase item_type (DestinationItemType enum) to the capitalized
// blockKindMeta key used for display — defaults to Activity for legacy rows saved before
// item_type existed (see the 2026_07_05_080154 migration's column default).
const itemTypeKind: Record<string, string> = {
  activity: 'Activity',
  dining: 'Dining',
  transfer: 'Transfer',
  venue: 'Venue',
};

function dayToBlocks(day: NonNullable<ItineraryResponse['itinerary_days']>[number]): DayBlock[] {
  const blocks: DayBlock[] = [];
  if (day.destinations) {
    day.destinations.forEach(d => {
      const kind = itemTypeKind[d.item_type ?? ''] ?? 'Activity';
      const meta = blockKindMeta[kind] ?? blockKindMeta.Activity;
      blocks.push({
        kind,
        kindColor: meta.kindColor,
        icon: meta.icon,
        iconBg: meta.iconBg,
        meta: d.destination?.country ?? '',
        title: d.destination?.name ?? d.activities ?? 'Activity',
        sub: d.activities ?? '',
        price: d.cost ? `${d.currency ?? ''} ${d.cost}` : '',
        entityType: 'destination',
        entityId: d.destination_id,
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

function itineraryDaysToDays(
  itineraryDays: NonNullable<ItineraryResponse['itinerary_days']>,
  flights?: ItineraryFlightResponse[],
  accommodation?: ItineraryAccommodationResponse[],
): Day[] {
  return itineraryDays.map((d, i) => {
    const dt = d.date ? new Date(d.date) : null;
    const dow = dt ? dt.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() : '';
    const dayNum = dt ? String(dt.getDate()).padStart(2, '0') : String(d.day_number);
    const mon = dt ? dt.toLocaleDateString('en-US', { month: 'short' }) : '';
    const dateStr = d.date ? d.date.split('T')[0] : null;

    const flightBlocks: DayBlock[] = (flights ?? [])
      .filter(f => f.departure_datetime && f.departure_datetime.split('T')[0] === dateStr)
      .map(f => ({
        kind: 'Flight',
        kindColor: blockKindMeta.Flight.kindColor,
        icon: blockKindMeta.Flight.icon,
        iconBg: blockKindMeta.Flight.iconBg,
        meta: f.departure_airport && f.arrival_airport ? `${f.departure_airport} → ${f.arrival_airport}` : '',
        title: f.airline ?? 'Flight',
        sub: f.flight_number ?? '',
        price: f.cost ? `${f.currency ?? ''} ${Number(f.cost).toLocaleString()}` : '',
        entityType: 'flight' as const,
        entityId: f.flight_id,
      }));

    const stayBlocks: DayBlock[] = (accommodation ?? [])
      .filter(a => a.check_in_date && a.check_in_date.split('T')[0] === dateStr)
      .map(a => ({
        kind: 'Stay',
        kindColor: blockKindMeta.Stay.kindColor,
        icon: blockKindMeta.Stay.icon,
        iconBg: blockKindMeta.Stay.iconBg,
        meta: a.address ?? '',
        title: a.accommodation_name,
        sub: a.room_type ? `${a.room_type}${a.check_out_date ? ` · Check-out ${a.check_out_date.split('T')[0]}` : ''}` : (a.check_out_date ? `Check-out ${a.check_out_date.split('T')[0]}` : ''),
        price: a.cost ? `${a.currency ?? ''} ${Number(a.cost).toLocaleString()}/night` : '',
        entityType: 'stay' as const,
        entityId: a.accommodation_id,
      }));

    return {
      di: i,
      dow,
      day: dayNum,
      mon,
      title: d.title ?? `Day ${d.day_number}`,
      blocks: [...flightBlocks, ...stayBlocks, ...dayToBlocks(d)],
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

function fmtRelativeTime(dt: string | null | undefined): string {
  if (!dt) return '';
  const diff = Date.now() - new Date(dt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

type GenerationSnapshot = {
  id: string;
  timestamp: Date;
  label: string;
  model: string;
  context: string;
  itineraries: ItineraryResponse[];
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
  // A real trip_id is a prefixed string like "TRP_..." (never all-digits), so "does the
  // param look like a plain number" is how we tell real trips apart from mock trip indices.
  const isRealId = tripId ? !/^\d+$/.test(tripId) : false;
  // `tid` is only meaningful for mock trips (passed to ctx.getTripDetail/getDays as the
  // index into constants/app.ts's demo trip array) — it's 0 and unused whenever isRealId is true.
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

  const refreshCosts = useCallback(() => {
    if (!tripId) return;
    ApiService.getTripCosts(tripId).then(setTripCosts).catch(() => {});
  }, [tripId]);

  useEffect(() => { refreshCosts(); }, [refreshCosts]);

  const [editTripOpen, setEditTripOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [addItemDay, setAddItemDay] = useState<number | null>(null);
  // The activity being edited (Activities tab's per-card "Edit" button) — reuses AddItemModal
  // rather than a separate one, so it's kept apart from `addItemDay`'s "add new" flow.
  const [editingActivity, setEditingActivity] = useState<{ dayIndex: number; item: EditingDayItem } | null>(null);
  const [addFlightOpen, setAddFlightOpen] = useState(false);
  const [addStayOpen, setAddStayOpen] = useState(false);
  // The accommodation being edited (Stays tab's per-card "Edit" button) — reuses AddStayModal.
  const [editingStay, setEditingStay] = useState<ItineraryAccommodationResponse | null>(null);
  const [assignTravelerOpen, setAssignTravelerOpen] = useState(false);
  const [editingStartCity, setEditingStartCity] = useState(false);
  const [startCityDraft, setStartCityDraft] = useState('');
  const [editingItinName, setEditingItinName] = useState<string | null>(null);
  const [itinNameDraft, setItinNameDraft] = useState('');
  const [editingDayTitle, setEditingDayTitle] = useState<string | null>(null);
  const [dayTitleDraft, setDayTitleDraft] = useState('');
  // Which days are expanded in the Itinerary tab's accordion (keyed by day index `di`).
  // Starts with just the first day open so a multi-day trip doesn't dump every day's blocks
  // on screen at once.
  const [expandedDays, setExpandedDays] = useState<Set<number>>(() => new Set([0]));
  const [addingDay, setAddingDay] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [generatingItinerary, setGeneratingItinerary] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const builderRef = useRef<HTMLDivElement>(null);
  const [removingDayId, setRemovingDayId] = useState<string | null>(null);
  const [removingItinerary, setRemovingItinerary] = useState(false);
  const [acceptedItineraryId, setAcceptedItineraryId] = useState<string | null>(null);
  const [acceptingItineraryId, setAcceptingItineraryId] = useState<string | null>(null);
  const [apiCalls, setApiCalls] = useState<CallResponse[]>([]);
  const [newCallTitle, setNewCallTitle] = useState('');
  const [addingCall, setAddingCall] = useState(false);
  const [newActionItemText, setNewActionItemText] = useState('');
  const [savingActionItem, setSavingActionItem] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [payingWithMoolre, setPayingWithMoolre] = useState(false);
  const [expandedChatOption, setExpandedChatOption] = useState<string | null>(null);
  const [shareMenuOption, setShareMenuOption] = useState<string | null>(null);
  const [shareAllOpen, setShareAllOpen] = useState(false);
  const [travelerPackages, setTravelerPackages] = useState<Record<string, string>>({});
  const [bookingAll, setBookingAll] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineText, setRefineText] = useState('');
  const [refineImageName, setRefineImageName] = useState<string | null>(null);
  const [refineModel, setRefineModel] = useState('claude-sonnet-5');
  const [refineFor, setRefineFor] = useState<'all' | string>('all');
  const [refineTitle, setRefineTitle] = useState('');
  const [refineIncludeEvents, setRefineIncludeEvents] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [generationHistory, setGenerationHistory] = useState<GenerationSnapshot[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [comparingSnap, setComparingSnap] = useState<GenerationSnapshot | null>(null);
  const refineImageRef = useRef<HTMLInputElement>(null);

  // Real calls for this trip (Calls tab) — kept separate from the trip/itinerary fetch above
  // since calls aren't nested under TripResponse.
  const refreshCalls = useCallback(() => {
    if (!tripId || !isRealId) return;
    ApiService.getCalls(tripId).then(res => setApiCalls(res.data)).catch(() => {});
  }, [tripId, isRealId]);

  useEffect(() => { refreshCalls(); }, [refreshCalls]);

  const refreshTrip = useCallback(async () => {
    if (!tripId) return;
    const trip = await ApiService.getTrip(tripId);
    setApiTrip(trip);
    return trip;
  }, [tripId]);


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

  const providerLabel = (id: string | undefined) => {
    const map: Record<string, string> = {
      gemini: 'Gemini', openai: 'ChatGPT', anthropic: 'Claude', ollama: 'Ollama',
    };
    return id ? (map[id] ?? id) : 'AI';
  };

  const handleGenerateItinerary = useCallback(async (prefs?: { budget?: string; style?: string; priorities?: string[]; notes?: string; start_city?: string; model?: string; snapshotTitle?: string; include_events?: boolean }) => {
    if (!tripId || !isRealId) {
      ctx.generateOptions();
      return;
    }
    setGeneratingItinerary(true);
    setGenerateError(null);
    try {
      const result = await ApiService.generateItinerary(tripId, prefs);

      // Notify if the requested model was unavailable and a fallback was used
      if (result.skipped_providers?.length && result.provider_used) {
        const rateLimited = (result.skipped_providers as SkippedProvider[]).filter(s => s.reason === 'rate_limited');
        if (rateLimited.length) {
          const skippedNames = rateLimited.map(s => providerLabel(s.name)).join(', ');
          const usedLabel = providerLabel(result.provider_used);
          const retryInfo = rateLimited[0].retry_after_seconds
            ? ` (available again in ~${rateLimited[0].retry_after_seconds}s)`
            : '';
          ctx.toastAction(`${skippedNames} is rate-limited${retryInfo} — used ${usedLabel} instead.`);
        }
      }

      if (result?.all_options?.length) {
        // Save the newly generated result as a named snapshot in the history timeline
        const userTitle = prefs?.snapshotTitle?.trim();
        setGenerationHistory(prev => [...prev, {
          id: Date.now().toString(),
          timestamp: new Date(),
          label: userTitle || (prev.length === 0 ? 'Original' : `Refinement ${prev.length}`),
          model: prefs?.model ?? 'claude-sonnet-5',
          context: prefs?.notes ?? '',
          itineraries: result.all_options,
        }]);
        // Refresh trip metadata (status, dates, etc.) but replace itineraries with the
        // exact set returned by generate — getTrip returns old confirmed options too,
        // which would mix with the new draft options and confuse the option selector.
        const freshTrip = await ApiService.getTrip(tripId).catch(() => null);
        setApiTrip(prev => {
          const base = freshTrip ?? prev;
          return base ? { ...base, itineraries: result.all_options } : prev;
        });
        setActiveOption('A');
        setBuilderTab('itinerary');
        setTimeout(() => {
          builderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
      refreshCosts();
    } catch {
      setGenerateError('Could not generate itinerary — check that meridian-ai is running, or try again.');
    } finally {
      setGeneratingItinerary(false);
    }
  }, [tripId, isRealId, ctx, refreshTrip, refreshCosts, setActiveOption, setBuilderTab]);

  const { td: mockTd, tb: mockTb } = ctx.getTripDetail(tid, activeOption);

  // ── Derived data ──
  // tripTd/tripTb overlay real apiTrip fields onto the mock td/tb (same pattern as
  // AppContext's apiTripToTripDetail/apiTripToStatusBanner) so the render below doesn't need
  // separate real/mock branches — it just always reads `td`/`tb`.

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

  // Maps the active option letter (A/B/C/D/E) to an index into apiTrip.itineraries. Each
  // itinerary the backend generates becomes the next letter in order (see
  // TripController::generateItinerary's `$optionLetter`), so this only needs array position,
  // not any special id-matching.
  const selectedItineraryIndex = useMemo(() => {
    if (!apiTrip?.itineraries || apiTrip.itineraries.length === 0) return -1;
    const idx = ['A', 'B', 'C', 'D', 'E'].indexOf(activeOption);
    return idx >= 0 && idx < apiTrip.itineraries.length ? idx : 0;
  }, [apiTrip, activeOption]);

  const selectedItinerary = useMemo(() => {
    if (selectedItineraryIndex < 0 || !apiTrip?.itineraries) return null;
    return apiTrip.itineraries[selectedItineraryIndex] ?? null;
  }, [apiTrip, selectedItineraryIndex]);

  const hasApiData = selectedItinerary != null
    && (selectedItinerary.itinerary_days?.length ?? 0) > 0;

  // Cost summary sidebar — always computed from the selected itinerary's live data so it
  // matches the option card total exactly. Payment/summary fields come from the costs API.
  const computedCosts = useMemo(() => {
    if (!selectedItinerary) return null;
    const flightsCost = (selectedItinerary.itinerary_flights ?? []).reduce((s, f) => s + (f.cost ?? 0), 0);
    const staysCost = (selectedItinerary.itinerary_accommodation ?? []).reduce((s, a) => s + (a.cost ?? 0), 0);
    const activitiesCost = (selectedItinerary.itinerary_days ?? []).reduce((sum, d) =>
      sum + (d.destinations ?? []).reduce((s2, dst) => s2 + Number(dst.cost ?? 0), 0), 0);
    const firstDestCurrency = selectedItinerary.itinerary_days?.flatMap(d => d.destinations ?? []).find(dst => dst.currency)?.currency;
    const currency = selectedItinerary.itinerary_flights?.[0]?.currency
      ?? selectedItinerary.itinerary_accommodation?.[0]?.currency
      ?? firstDestCurrency
      ?? 'USD';
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
      currency,
      payments: tripCosts?.payments ?? [] as TripCostResponse['payments'],
      summary: tripCosts?.summary,
    };
  }, [tripCosts, selectedItinerary]);

  const costs = computedCosts?.rows ?? (apiTrip ? [] : td.costs ?? []);
  const costTotal = computedCosts?.total ?? (apiTrip ? '' : td.total ?? '');
  const costFee = computedCosts?.fee ?? (apiTrip ? '' : 'Service fee charged to traveller');
  const payments = computedCosts?.payments ?? [];
  const costSummary = computedCosts?.summary ?? null;
  const costCurrency = computedCosts?.currency ?? 'GHS';

  const rawDays = hasApiData && selectedItinerary?.itinerary_days
    ? itineraryDaysToDays(
        selectedItinerary.itinerary_days,
        selectedItinerary.itinerary_flights,
        selectedItinerary.itinerary_accommodation,
      )
    : apiTrip
    ? [{ di: 0, dow: '', day: '01', mon: '', title: 'Day 1', blocks: [], addBlock: () => {} }]
    : ctx.getDays(tid, activeOption);

  // ── Event handlers ──

  // Removes a single destination block from a day by entity ID. Flight/stay blocks use their
  // own inline handlers set up in the `days` mapping below.
  const handleRemoveBlock = (di: number, entityId: string) => {
    const day = selectedItinerary?.itinerary_days?.[di];
    if (day?.itinerary_day_id) {
      ApiService.removeDestinationFromDay(day.itinerary_day_id, entityId).then(() => refreshTrip());
    }
  };

  // Appends the next-numbered day to the selected itinerary. Falls back to the mock-only
  // ctx.addBlock() if there's no real trip/itinerary yet to add a day to.
  const handleAddDay = async () => {
    if (!apiTrip || !selectedItinerary) {
      ctx.addBlock((ctx.getDays(tid, activeOption)?.length ?? 0) - 1);
      return;
    }
    setAddingDay(true);
    try {
      const nextNum = (selectedItinerary.itinerary_days?.length ?? 0) + 1;
      await ApiService.addItineraryDay(selectedItinerary.itinerary_id, {
        day_number: nextNum,
        date: apiTrip.start_date ? apiTrip.start_date.split('T')[0] : undefined,
        title: `Day ${nextNum}`,
      });
      await refreshTrip();
    } finally {
      setAddingDay(false);
    }
  };

  const handleRemoveFlight = async (idx: number) => {
    const flight = selectedItinerary?.itinerary_flights?.[idx];
    if (flight?.flight_id) {
      await ApiService.removeFlight(flight.flight_id);
      refreshTrip();
    }
  };

  const handleRemoveAccommodation = async (idx: number) => {
    const accommodation = selectedItinerary?.itinerary_accommodation?.[idx];
    if (accommodation?.accommodation_id) {
      await ApiService.removeAccommodation(accommodation.accommodation_id);
      refreshTrip();
    }
  };

  // Saves the selected itinerary's start_city (see AddFlightModal/AddStayModal, which default
  // their search fields from it) — a no-op if the value hasn't actually changed.
  const handleSaveStartCity = async () => {
    setEditingStartCity(false);
    if (!selectedItinerary) return;
    const trimmed = startCityDraft.trim();
    if (trimmed === (selectedItinerary.start_city ?? '')) return;
    await ApiService.updateItinerary(selectedItinerary.itinerary_id, { start_city: trimmed });
    refreshTrip();
  };

  // Renames an itinerary option (e.g. "Option A" -> "Beach-focused"). No-op if unchanged.
  const handleSaveItinName = async (itineraryId: string, original: string) => {
    setEditingItinName(null);
    const trimmed = itinNameDraft.trim();
    if (!trimmed || trimmed === original) return;
    await ApiService.updateItinerary(itineraryId, { itinerary_name: trimmed });
    refreshTrip();
  };

  // Renames a single day's title (e.g. "Day 1" -> "Arrival & check-in"). No-op if unchanged.
  const handleSaveDayTitle = async (dayId: string, original: string) => {
    setEditingDayTitle(null);
    const trimmed = dayTitleDraft.trim();
    if (!trimmed || trimmed === original) return;
    await ApiService.updateItineraryDay(dayId, { title: trimmed });
    refreshTrip();
  };

  const toggleDay = (di: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(di)) next.delete(di);
      else next.add(di);
      return next;
    });
  };

  // Deletes an entire day (and everything on it) from the selected itinerary.
  const handleRemoveDay = async (dayId: string) => {
    if (!window.confirm('Remove this day and everything on it? This cannot be undone.')) return;
    setRemovingDayId(dayId);
    try {
      await ApiService.removeItineraryDay(dayId);
      await refreshTrip();
    } finally {
      setRemovingDayId(null);
    }
  };

  // Deletes an entire itinerary option (e.g. "Option B"). Resets the active option back to
  // 'A' afterwards since the deleted option's letter/index may no longer exist.
  const handleRemoveItinerary = async (itineraryId: string) => {
    if (!window.confirm('Delete this itinerary option? This cannot be undone.')) return;
    setRemovingItinerary(true);
    try {
      await ApiService.deleteItinerary(itineraryId);
      if (acceptedItineraryId === itineraryId) setAcceptedItineraryId(null);
      setActiveOption('A');
      await refreshTrip();
    } finally {
      setRemovingItinerary(false);
    }
  };

  const handleDeclineItinerary = async (itineraryId: string) => {
    setRemovingItinerary(true);
    try {
      await ApiService.deleteItinerary(itineraryId);
      if (acceptedItineraryId === itineraryId) setAcceptedItineraryId(null);
      const remaining = (apiTrip?.itineraries ?? []).filter(it => it.itinerary_id !== itineraryId);
      setApiTrip(prev => prev ? { ...prev, itineraries: remaining } : prev);
      if (remaining.length > 0) setActiveOption('A');
    } finally {
      setRemovingItinerary(false);
    }
  };

  const handleAcceptItinerary = async (itineraryId: string) => {
    // Toggle off if clicking the already-accepted option
    if (acceptedItineraryId === itineraryId) {
      setAcceptedItineraryId(null);
      setAcceptingItineraryId(itineraryId);
      try { await ApiService.updateItinerary(itineraryId, { status: 'draft' }); } finally { setAcceptingItineraryId(null); }
      return;
    }
    setAcceptedItineraryId(itineraryId);
    setAcceptingItineraryId(itineraryId);
    try { await ApiService.updateItinerary(itineraryId, { status: 'confirmed' }); } finally { setAcceptingItineraryId(null); }
  };

  // Logs a new call against this trip (Calls tab).
  const handleAddCall = async () => {
    if (!apiTrip || !newCallTitle.trim()) return;
    setAddingCall(true);
    try {
      await ApiService.createCall({
        trip_id: apiTrip.trip_id,
        title: newCallTitle.trim(),
        started_at: new Date().toISOString(),
      });
      setNewCallTitle('');
      refreshCalls();
    } finally {
      setAddingCall(false);
    }
  };

  const handleEndCall = async (callId: string) => {
    await ApiService.endCall(callId);
    refreshCalls();
  };

  const handleAddActionItem = async (callId: string) => {
    if (!newActionItemText.trim()) return;
    setSavingActionItem(true);
    try {
      await ApiService.addCallActionItem(callId, newActionItemText.trim());
      setNewActionItemText('');
      refreshCalls();
    } finally {
      setSavingActionItem(false);
    }
  };

  // Toggles an action item between pending and checked (done).
  const handleToggleActionItem = async (itemId: string, currentStatus: string) => {
    const next = currentStatus === 'checked' ? 'pending' : 'checked';
    await ApiService.updateCallActionItem(itemId, { status: next });
    refreshCalls();
  };

  // Records a payment against this trip (cost summary sidebar). Marked completed
  // immediately — this app has no separate pending-payment-then-confirm flow yet.
  const handleRecordPayment = async () => {
    if (!apiTrip) return;
    const amount = Number(paymentAmount);
    if (!paymentAmount.trim() || Number.isNaN(amount) || amount <= 0) return;
    setSavingPayment(true);
    try {
      // Backend validates amount as a whole integer (no decimals) — round rather than reject.
      await ApiService.recordTripPayment({
        trip_id: apiTrip.trip_id,
        amount: Math.round(amount),
        currency: costCurrency,
        payment_method: paymentMethod.trim() || undefined,
        status: 'completed',
      });
      setPaymentAmount('');
      setPaymentMethod('');
      setShowPaymentForm(false);
      refreshCosts();
    } finally {
      setSavingPayment(false);
    }
  };

  // Starts a real mobile-money collection via Moolre (see MoolrePaymentController): creates a
  // pending transaction server-side and redirects the browser to Moolre's hosted checkout
  // page. On success the browser navigates away, so there's no "finally" to reset the loading
  // state — it only needs resetting if the request itself fails before any redirect happens.
  const handlePayWithMoolre = async () => {
    if (!apiTrip) return;
    const amount = Number(paymentAmount);
    if (!paymentAmount.trim() || Number.isNaN(amount) || amount <= 0) return;
    setPayingWithMoolre(true);
    try {
      const checkout = await ApiService.initiateMoolreTripPayment(apiTrip.trip_id, Math.round(amount));
      window.location.href = checkout.authorization_url;
    } catch {
      ctx.toastAction('Could not start the Moolre payment.');
      setPayingWithMoolre(false);
    }
  };

  // "+ Add item to this day" button. If the day already exists as a real backend row, this
  // just opens AddItemModal (which does the actual API call once the user fills the form).
  // If there's no real trip data at all yet — no itinerary, sometimes not even a day row for
  // this slot — it lazily creates whatever's missing first (an itinerary, then a day), then
  // opens the modal, so a brand-new trip can go straight from "no itinerary" to "adding an
  // activity" without a separate explicit "create itinerary" step.
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

  // Lazily creates a bare itinerary for this trip if one doesn't exist yet, mirroring
  // handleAddBlock's bootstrap above — shared by the Flights/Stays/Activities "+ Add" buttons
  // below, which previously only appeared once an itinerary already existed, leaving a
  // brand-new trip (no itinerary at all) with no visible way to add its first flight/stay/
  // activity. Returns the up-to-date itinerary straight from refreshTrip()'s response rather
  // than reading the (still-stale, pre-refresh) `selectedItinerary` closure variable.
  const ensureItinerary = async (): Promise<ItineraryResponse | null> => {
    if (selectedItinerary) return selectedItinerary;
    if (!apiTrip) return null;
    await ApiService.createItinerary({
      trip_id: apiTrip.trip_id,
      itinerary_name: 'Option A',
      description: 'Auto-created itinerary',
    });
    const trip = await refreshTrip();
    return trip?.itineraries?.[0] ?? null;
  };

  const handleOpenAddFlight = async () => {
    setBootstrapping(true);
    try {
      if (await ensureItinerary()) setAddFlightOpen(true);
    } finally {
      setBootstrapping(false);
    }
  };

  const handleOpenAddStay = async () => {
    setBootstrapping(true);
    try {
      if (await ensureItinerary()) setAddStayOpen(true);
    } finally {
      setBootstrapping(false);
    }
  };

  // Same bootstrap as above, plus ensuring at least one day exists — activities attach to a
  // specific day, not to the itinerary directly, so this defaults to the last day (matching
  // the tab's own copy: "They'll appear on the last day").
  const handleOpenAddActivity = async () => {
    setBootstrapping(true);
    try {
      const itn = await ensureItinerary();
      if (!itn || !apiTrip) return;
      let dayIndex: number;
      if (!itn.itinerary_days || itn.itinerary_days.length === 0) {
        await ApiService.addItineraryDay(itn.itinerary_id, {
          day_number: 1,
          date: apiTrip.start_date ? apiTrip.start_date.split('T')[0] : undefined,
          title: 'Day 1',
        });
        await refreshTrip();
        dayIndex = 0;
      } else {
        dayIndex = itn.itinerary_days.length - 1;
      }
      setAddItemDay(dayIndex);
    } finally {
      setBootstrapping(false);
    }
  };

  // Removes a single destination/activity attached to a specific day of the selected
  // itinerary — used by the Activities tab's real (non-mock) list below.
  const handleRemoveActivity = async (dayIndex: number, destinationId: string) => {
    const dayId = selectedItinerary?.itinerary_days?.[dayIndex]?.itinerary_day_id;
    if (!dayId) return;
    await ApiService.removeDestinationFromDay(dayId, destinationId);
    refreshTrip();
  };

  const handleRemoveTraveler = async (customerId: string) => {
    if (!tripId) return;
    await ApiService.removeCustomerFromTrip(tripId, customerId).catch(() => {});
    refreshTrip();
  };

  const handleConfirmBookingAll = async () => {
    if (!apiTrip) return;
    setBookingAll(true);
    try {
      await ApiService.updateTripStatus(apiTrip.trip_id, 'booked');
      refreshTrip();
    } finally {
      setBookingAll(false);
    }
  };

  const handleRefineSubmit = () => {
    setRefineOpen(false);
    const travelerCtx = refineFor !== 'all'
      ? (() => {
          const c = (apiTrip?.customers ?? []).find(cu => cu.customer_id === refineFor);
          return c ? `[Personalising for traveler: ${c.first_name} ${c.last_name}] ` : '';
        })()
      : '';
    const context = [travelerCtx + refineText.trim(), refineImageName ? `[Attachment: ${refineImageName}]` : ''].filter(Boolean).join(' ');
    handleGenerateItinerary({
      notes: context || undefined,
      model: refineModel,
      snapshotTitle: refineTitle.trim() || undefined,
      include_events: refineIncludeEvents,
    });
    setRefineText('');
    setRefineImageName(null);
    setRefineTitle('');
    setRefineFor('all');
  };

  const toggleVoice = () => {
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    if (!SR) { ctx.toastAction('Voice input is not supported in this browser.'); return; }
    if (isListening) { setIsListening(false); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SR as any)();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (e: { results: { [key: number]: { [key: number]: { transcript: string } } }; resultIndex: number }) => {
      const transcript = Array.from({ length: e.results.length - e.resultIndex }, (_, i) =>
        e.results[e.resultIndex + i][0].transcript
      ).join(' ');
      setRefineText(prev => (prev ? prev + ' ' : '') + transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  };

  const days = rawDays.map((d, di) => ({
    ...d,
    di: d.di ?? di,
    blocks: d.blocks.map((b, bi) => ({
      ...b,
      remove: b.entityType === 'flight' && b.entityId
        ? () => { ApiService.removeFlight(b.entityId!).then(() => refreshTrip()); }
        : b.entityType === 'stay' && b.entityId
        ? () => { ApiService.removeAccommodation(b.entityId!).then(() => refreshTrip()); }
        : b.entityType === 'destination' && b.entityId
        ? () => handleRemoveBlock(di, b.entityId!)
        : () => { ctx.removeBlock(di, bi); },
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

  // Real (non-mock) activities for the Activities tab — every destination attached to any day
  // of the selected itinerary, flattened into one list with which day it's on. Previously this
  // tab always showed a fixed mock catalog regardless of trip type, so its "+ Add" button did
  // nothing for real trips (ctx.addActivity only touches client-side mock state).
  const realActivities = apiTrip
    ? (selectedItinerary?.itinerary_days ?? []).flatMap((day, di) =>
        (day.destinations ?? []).map(d => ({
          dayIndex: di,
          destinationId: d.destination_id,
          name: d.destination?.name ?? d.activities ?? 'Activity',
          meta: `${day.title || 'Day ' + day.day_number}${d.destination?.country ? ' · ' + d.destination.country : ''}`,
          price: d.cost ? `${d.currency ?? ''} ${d.cost}` : '',
          item: d,
        })),
      )
    : null;
  const { calls: callLogsArr, callDetails } = ctx.getCallLogs();
  const call = callDetails[activeCall] ?? null;

  const realAgentFeed = useMemo((): AgentFeedItem[] => {
    if (!isRealId || !apiTrip) return [];
    const items: AgentFeedItem[] = [];

    (apiTrip.itineraries ?? []).forEach((itin, i) => {
      const letter = String.fromCharCode(65 + i);
      const days = itin.itinerary_days?.length ?? 0;
      const flights = itin.itinerary_flights?.length ?? 0;
      const stays = itin.itinerary_accommodation?.length ?? 0;
      const detail = [days > 0 && `${days} day${days !== 1 ? 's' : ''}`, flights > 0 && `${flights} flight${flights !== 1 ? 's' : ''}`, stays > 0 && `${stays} stay${stays !== 1 ? 's' : ''}`].filter(Boolean).join(' · ');
      items.push({
        iconEl: '✦',
        iconBg: '#EAF0FF',
        title: itin.itinerary_name ?? `Option ${letter} generated`,
        detail: detail || 'No items yet',
        time: fmtRelativeTime(itin.created_at),
        actionLabel: 'Review →',
        action: () => { setActiveOption(letter); setBuilderTab('itinerary'); setTimeout(() => builderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); },
      });
    });

    const tripCalls = (apiTrip.calls ?? apiCalls);
    tripCalls.forEach(call => {
      const total = call.action_items?.length ?? 0;
      const pending = (call.action_items ?? []).filter(a => a.status !== 'checked').length;
      items.push({
        iconEl: '🎙️',
        iconBg: '#F0EBFF',
        title: call.title ?? 'Call recorded',
        detail: total > 0 ? `${pending} action item${pending !== 1 ? 's' : ''} pending` : 'No action items captured',
        time: fmtRelativeTime(call.created_at),
        actionLabel: 'View call',
        action: () => setBuilderTab('calls'),
      });
    });

    (apiTrip.trip_payments ?? []).forEach(tp => {
      if (!tp.transaction) return;
      const t = tp.transaction;
      const paid = t.status === 'completed';
      items.push({
        iconEl: '💳',
        iconBg: paid ? '#E3F7EF' : '#FFF3E0',
        title: `${paid ? 'Payment received' : 'Payment pending'} · ${t.currency} ${Number(t.amount).toLocaleString()}`,
        detail: [t.payment_method?.replace(/_/g, ' '), tp.notes].filter(Boolean).join(' · '),
        time: fmtRelativeTime(t.paid_at ?? ''),
        actionLabel: 'Details',
        action: () => {},
      });
    });

    return items;
  }, [isRealId, apiTrip, apiCalls, setActiveOption, setBuilderTab]);

  const agentFeed = (isRealId && realAgentFeed.length > 0) ? realAgentFeed : ctx.getAgentFeed();

  const compareData = useMemo(() => {
    if (!comparingSnap || !apiTrip?.itineraries) return null;
    return comparingSnap.itineraries.map((oldItin, i) => {
      const letter = String.fromCharCode(65 + i);
      const newItin = apiTrip.itineraries![i];
      const oldDays = (oldItin.itinerary_days ?? []).map(d => d.title ?? `Day ${d.day_number}`);
      const newDays = (newItin?.itinerary_days ?? []).map(d => d.title ?? `Day ${d.day_number}`);
      const addedDays = newDays.filter(t => !oldDays.includes(t));
      const removedDays = oldDays.filter(t => !newDays.includes(t));
      const oldFlights = (oldItin.itinerary_flights ?? []).reduce((s, f) => s + (f.cost ?? 0), 0);
      const oldStays = (oldItin.itinerary_accommodation ?? []).reduce((s, a) => s + (a.cost ?? 0), 0);
      const oldActs = (oldItin.itinerary_days ?? []).reduce((s, d) => s + (d.destinations ?? []).reduce((s2, dst) => s2 + Number(dst.cost ?? 0), 0), 0);
      const oldSub = oldFlights + oldStays + oldActs;
      const oldTotal = oldSub > 0 ? `${oldItin.itinerary_flights?.[0]?.currency ?? 'USD'} ${(oldSub + Math.round(oldSub * 0.05)).toLocaleString()}` : null;
      const newFlights = (newItin?.itinerary_flights ?? []).reduce((s, f) => s + (f.cost ?? 0), 0);
      const newStays = (newItin?.itinerary_accommodation ?? []).reduce((s, a) => s + (a.cost ?? 0), 0);
      const newActs = (newItin?.itinerary_days ?? []).reduce((s, d) => s + (d.destinations ?? []).reduce((s2, dst) => s2 + Number(dst.cost ?? 0), 0), 0);
      const newSub = newFlights + newStays + newActs;
      const newTotal = newSub > 0 ? `${newItin?.itinerary_flights?.[0]?.currency ?? 'USD'} ${(newSub + Math.round(newSub * 0.05)).toLocaleString()}` : null;
      return { letter, name: oldItin.itinerary_name ?? `Option ${letter}`, addedDays, removedDays, oldTotal, newTotal };
    });
  }, [comparingSnap, apiTrip]);

  useEffect(() => {
    const state = location.state as {
      triggerGenerate?: boolean;
      travelerPrefs?: { budget?: string; style?: string; priorities?: string[]; notes?: string; start_city?: string };
    } | null;
    if (state?.triggerGenerate) {
      handleGenerateItinerary(state.travelerPrefs);
      window.history.replaceState({}, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const computeOptionCost = (itin: ItineraryResponse | undefined) => {
    if (!itin) return null;
    const fc = (itin.itinerary_flights ?? []).reduce((s, f) => s + (f.cost ?? 0), 0);
    const sc = (itin.itinerary_accommodation ?? []).reduce((s, a) => s + (a.cost ?? 0), 0);
    const ac = (itin.itinerary_days ?? []).reduce((s, d) =>
      s + (d.destinations ?? []).reduce((s2, dst) => s2 + Number(dst.cost ?? 0), 0), 0);
    const cur = itin.itinerary_flights?.[0]?.currency
      ?? itin.itinerary_accommodation?.[0]?.currency
      ?? itin.itinerary_days?.flatMap(d => d.destinations ?? []).find(dst => dst.currency)?.currency
      ?? 'USD';
    const sub = fc + sc + ac;
    const fee = Math.round(sub * 0.05);
    const total = sub + fee;
    const fmt = (n: number) => n > 0 ? `${cur} ${n.toLocaleString()}` : '—';
    return { flights: fmt(fc), accommodation: fmt(sc), activities: fmt(ac), fee: fmt(fee), total: fmt(total), hasData: total > 0, currency: cur };
  };

  const buildItineraryText = (itin: ItineraryResponse, rich = false): string => {
    const sep = rich ? '─'.repeat(40) : '---';
    const nl = '\n';
    const travelerNames = (apiTrip?.customers ?? []).map(c => `${c.first_name} ${c.last_name}`).join(', ');
    const dateRange = fmtDateRange(apiTrip?.start_date ?? null, apiTrip?.end_date ?? null);
    const cost = computeOptionCost(itin);

    const dayLines = (itin.itinerary_days ?? []).map(d => {
      const activities = (d.destinations ?? []).map(dst =>
        `    • ${dst.destination?.name ?? dst.activities ?? 'Activity'}${dst.cost ? ` (${dst.currency ?? ''} ${dst.cost})` : ''}`
      ).join(nl);
      return `${rich ? '📅 ' : ''}Day ${d.day_number}${d.title ? ': ' + d.title : ''}${d.location ? ' — ' + d.location : ''}${activities ? nl + activities : ''}`;
    }).join(nl + nl);

    const flightLines = (itin.itinerary_flights ?? []).map(f =>
      `${rich ? '✈️ ' : ''}${f.airline ?? 'Flight'}: ${f.departure_airport ?? '—'} → ${f.arrival_airport ?? '—'}${f.departure_datetime ? ' · ' + new Date(f.departure_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}${f.cost ? ' · ' + (f.currency ?? '') + ' ' + Number(f.cost).toLocaleString() : ''}`
    ).join(nl);

    const stayLines = (itin.itinerary_accommodation ?? []).map(a =>
      `${rich ? '🏨 ' : ''}${a.accommodation_name}${a.address ? ' — ' + a.address : ''}${a.cost ? ' · ' + (a.currency ?? '') + ' ' + Number(a.cost).toLocaleString() + '/night' : ''}`
    ).join(nl);

    const costBlock = cost?.hasData
      ? `${nl}${rich ? '💰 ' : ''}COST ESTIMATE${nl}${sep}${nl}Flights: ${cost.flights}${nl}Accommodation: ${cost.accommodation}${nl}Activities & transfers: ${cost.activities}${nl}Service fee (5%): ${cost.fee}${nl}Total: ${cost.total}`
      : '';

    return (
`Dear ${travelerNames || 'Traveler'},

I'm excited to share your personalised itinerary for ${td.name}! After considering your preferences and travel goals, we've put together what we believe will be an unforgettable journey.

${rich ? '🌍 ' : ''}TRIP OVERVIEW
${sep}
Destination: ${td.where}
Dates: ${dateRange}
Travelers: ${travelerNames || '—'}${apiTrip?.budget ? '\nBudget: GHS ' + Number(apiTrip.budget).toLocaleString() : ''}

${rich ? '✨ ' : ''}${(itin.itinerary_name ?? 'YOUR ITINERARY').toUpperCase()}
${sep}
${dayLines || 'No days planned yet.'}
${flightLines ? `\n${rich ? '✈️ ' : ''}FLIGHTS\n${sep}\n${flightLines}` : ''}
${stayLines ? `\n${rich ? '🏨 ' : ''}ACCOMMODATION\n${sep}\n${stayLines}` : ''}
${costBlock}

Every detail has been thoughtfully curated to balance exploration, comfort and value. Whether it's the hand-picked stays, the carefully timed activities, or the seamless transfers — this itinerary is designed to let you travel with zero stress.

${rich ? '📌 ' : ''}NEXT STEPS
${sep}
1. Review the itinerary above and let me know your thoughts
2. Share any adjustments — I'm happy to tailor anything to make this perfect
3. Once you're satisfied, we'll lock in bookings and send your full travel pack

I'm here to make this trip exceptional. Don't hesitate to reach out with any questions!

Warm regards,
${tripAgentName}
Meridian Travel`
    );
  };

  const handleShareEmail = (itin: ItineraryResponse) => {
    setShareMenuOption(null);
    const body = buildItineraryText(itin, true);
    const subject = encodeURIComponent(`Your ${td.name} Itinerary — ${itin.itinerary_name ?? 'Option A'} ✈️`);
    window.open(`mailto:?subject=${subject}&body=${encodeURIComponent(body)}`, '_blank');
  };

  const handleShareChat = (itin: ItineraryResponse) => {
    setShareMenuOption(null);
    // Build a concise but engaging message for the chat channel
    const cost = computeOptionCost(itin);
    const highlights = (itin.itinerary_days ?? []).slice(0, 5).map(d =>
      `Day ${d.day_number}${d.title ? ': ' + d.title : ''}${d.location ? ' in ' + d.location : ''}`
    ).join('\n');
    const extra = (itin.itinerary_days?.length ?? 0) > 5
      ? `\n...and ${(itin.itinerary_days?.length ?? 0) - 5} more days of adventure!`
      : '';
    const message = `✈️ Here's your personalised ${td.name} itinerary — ${itin.itinerary_name ?? 'Option A'}!\n\n${highlights}${extra}${cost?.hasData ? '\n\n💰 Estimated total: ' + cost.total : ''}\n\nI've handpicked every stay, activity and transfer to match what you're looking for. Let me know if you'd like any adjustments — I want this to be perfect for you! 🌍`;
    navigator.clipboard.writeText(message)
      .then(() => {
        ctx.toastAction('Itinerary copied! Head to Messages and paste it for your traveler.');
        navigate('/app/messages');
      })
      .catch(() => ctx.toastAction('Could not copy — please try again.'));
  };

  // Live shareable link for the traveler view — always reflects the latest itinerary
  const tripLink = isRealId && tripId ? `${window.location.origin}/travel/${tripId}` : null;

  const handleCopyTripLink = (option?: string) => {
    if (!tripLink) return;
    const link = option ? `${tripLink}?option=${option}` : tripLink;
    navigator.clipboard.writeText(link)
      .then(() => ctx.toastAction(option ? `Option ${option} link copied!` : 'Trip link copied to clipboard!'))
      .catch(() => ctx.toastAction('Could not copy link.'));
    setShareAllOpen(false);
    setShareMenuOption(null);
  };

  const handleShareAllWhatsApp = () => {
    if (!tripLink) return;
    const count = options.length;
    const travelerNames = (apiTrip?.customers ?? []).map(c => c.first_name).join(', ') || 'there';
    const msg = `Hi ${travelerNames}! 👋\n\nI've prepared ${count} itinerary option${count !== 1 ? 's' : ''} for your *${td.name}* trip. Take a look and let me know which one speaks to you:\n\n🔗 ${tripLink}\n\n_This link is always live — whenever I update your options, the link reflects the changes automatically. No need to ask for a new one!_ ✈️`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    setShareAllOpen(false);
  };

  const handleShareOptionWhatsApp = (itin: ItineraryResponse, optLetter: string, optName: string) => {
    const link = tripLink ? `${tripLink}?option=${optLetter}` : '';
    const cost = computeOptionCost(itin);
    const days = itin.itinerary_days?.length ?? 0;
    const highlights = (itin.itinerary_days ?? []).slice(0, 4).map(d => `• Day ${d.day_number}: ${d.title || d.location || ''}`).join('\n');
    const msg = `✈️ *${td.name}* — ${optName}\n\n${highlights}${days > 4 ? `\n• ...and ${days - 4} more days!` : ''}${cost?.hasData ? '\n\n💰 Est. total: ' + cost.total : ''}\n\nHere's Option ${optLetter} of your trip. What do you think?\n${link ? '\n🔗 ' + link : ''}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    setShareMenuOption(null);
  };

  const handleShareAllEmail = () => {
    if (!tripLink) return;
    const travelerNames = (apiTrip?.customers ?? []).map(c => `${c.first_name} ${c.last_name}`).join(', ') || 'Traveler';
    const optionsSummary = options.map((opt, i) => {
      const itin = apiTrip?.itineraries?.[i];
      const cost = itin ? computeOptionCost(itin) : null;
      const days = itin?.itinerary_days?.length ?? 0;
      const flights = itin?.itinerary_flights?.length ?? 0;
      const stays = itin?.itinerary_accommodation?.length ?? 0;
      return `  Option ${opt.letter}: ${opt.name}${days > 0 ? ` · ${days} days` : ''}${flights > 0 ? ` · ${flights} flight${flights !== 1 ? 's' : ''}` : ''}${stays > 0 ? ` · ${stays} stay${stays !== 1 ? 's' : ''}` : ''}${cost?.hasData ? ' · Est. ' + cost.total : ''}`;
    }).join('\n');
    const subject = encodeURIComponent(`Your ${td.name} Itinerary Options — Choose Your Perfect Trip ✈️`);
    const body = encodeURIComponent(
`Dear ${travelerNames},

I'm thrilled to present your personalised itinerary options for ${td.name}! I've curated ${options.length} distinct option${options.length !== 1 ? 's' : ''}, each with a different style and focus, so you can choose the experience that truly resonates with you.

YOUR ${options.length} OPTIONS AT A GLANCE
${'─'.repeat(50)}
${optionsSummary}
${'─'.repeat(50)}

👉 REVIEW ALL OPTIONS HERE (always up to date):
${tripLink}

This link is live — whenever I refine or update your itinerary based on your feedback, you'll see the latest version at the same link. No need to request a new one!

HOW IT WORKS
${'─'.repeat(50)}
1. Click the link above to see all options side by side
2. Browse each option's full day-by-day plan, flights, and stays
3. Click "Accept" on the option you love — or reply to this email with your thoughts
4. I'll lock in the bookings and send your full travel pack once you've confirmed

Every option has been personally crafted with your preferences in mind. Whether it's the pace of the days, the style of accommodation, or the balance of activities — these are built around you.

I can't wait to hear which one excites you most!

Warm regards,
${tripAgentName}
Meridian Travel

─────────────────────────────────────
Questions? Simply reply to this email or reach out directly.`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    setShareAllOpen(false);
  };

  const tripAgent = apiTrip?.created_by
    ? (typeof apiTrip.created_by === 'object' ? apiTrip.created_by.display_name : null)
    : null;
  const tripAgentName = tripAgent ?? ['Kweku Ansah', 'Adwoa Mensah', 'Yaw Boateng', 'Efua Osei'][tid % 4];

  const builderTabs = [
    { key: 'itinerary' as const, label: 'Itinerary' },
    { key: 'flights' as const, label: 'Flights' },
    { key: 'stays' as const, label: 'Stays' },
    { key: 'activities' as const, label: 'Activities' },
    // Calls is accessible via the "Client calls" button below the chat cards, not a builder tab
  ];

  const tabItin = builderTab === 'itinerary';
  const tabFlights = builderTab === 'flights';
  const tabStays = builderTab === 'stays';
  const tabActs = builderTab === 'activities';
  const tabCalls = builderTab === 'calls';

  const handleGenerateOptions = () => {
    if (isRealId) {
      handleGenerateItinerary();
    } else {
      ctx.openGenItin();
    }
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
          itineraryId: it.itinerary_id,
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
                <h1 className="td-hero-title">{td.name}</h1>
                <span className="td-hero-status" style={{ background: td.statusBg, color: td.statusFg }}>
                  {td.status}
                </span>
              </div>
              <div className="td-hero-meta">
                {apiTrip ? (
                  <>
                    {(apiTrip.customers ?? []).map(c => (
                      <span key={c.customer_id} className="td-traveler-chip">
                        {c.first_name} {c.last_name}
                        <button
                          className="td-traveler-chip-remove"
                          onClick={() => handleRemoveTraveler(c.customer_id)}
                          title="Remove traveler"
                        >×</button>
                      </span>
                    ))}
                    <button onClick={() => setAssignTravelerOpen(true)} className="td-traveler-add-btn">
                      + Add traveler
                    </button>
                  </>
                ) : (
                  <span>{td.traveler}</span>
                )}
                <span className="td-hero-dot" />
                <span>{td.where}</span>
                <span className="td-hero-dot" />
                <span>{td.dates}</span>
                <span className="td-hero-dot" />
                <span className="td-hero-value">{td.value}</span>
              </div>
            </div>
            <div className="td-hero-actions">
              {apiTrip && (
                <>
                  <button onClick={() => setEditTripOpen(true)} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>
                    Edit
                  </button>
                  {/* Free-form status change — lets any status be set directly (including
                      "Cancelled", which the contextual quick-action buttons below can never
                      reach), independent of the linear-flow shortcuts underneath. */}
                  <select
                    className="td-status-select"
                    value={apiTrip.status}
                    onChange={e => handleStatusTransition(e.target.value)}
                    disabled={updatingStatus}
                    aria-label="Change trip status"
                  >
                    {Object.entries(apiStatusMeta).map(([value, meta]) => (
                      <option key={value} value={value}>{meta.display}</option>
                    ))}
                  </select>
                  {apiTrip.status === 'planning' && (
                    <>
                      <button onClick={handleGenerateOptions} className="td-action-btn" style={{ background: '#2B63F6', color: '#fff', borderColor: '#2B63F6' }} disabled={updatingStatus || generatingItinerary}>
                        {generatingItinerary ? '✦ Generating…' : '✦ Generate options'}
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
              {!apiTrip && (
                <>
                  <button onClick={() => setEditTripOpen(true)} className="td-action-btn" style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}>
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

        {tb.showOptions && (options.length > 0 || apiTrip) && (
          <div className="td-chat-options-section mb-24">
            {/* AI intro + share-all trigger */}
            <div className="td-chat-ai-row">
              <div className="td-chat-ai-avatar">✦</div>
              <div className="td-chat-ai-bubble">
                {options.length === 0
                  ? 'All options were declined.'
                  : <>Here {options.length === 1 ? 'is' : 'are'} <strong>{options.length} itinerary option{options.length !== 1 ? 's' : ''}</strong> for <strong>{td.name}</strong>. Review each one below and accept the best fit.</>
                }
              </div>
              {isRealId && tripLink && options.length > 0 && (
                <button
                  className={`td-share-all-btn${shareAllOpen ? ' td-share-all-btn--open' : ''}`}
                  onClick={() => setShareAllOpen(o => !o)}
                >
                  ↗ Share with traveler
                </button>
              )}
            </div>

            {/* Live share panel */}
            {shareAllOpen && tripLink && (
              <div className="td-share-all-panel">
                <div className="td-share-all-top">
                  <div>
                    <div className="td-share-all-title">🔗 Live trip link</div>
                    <div className="td-share-all-subtitle">Always shows the latest options — no need to resend if the itinerary changes</div>
                  </div>
                  <button onClick={() => setShareAllOpen(false)} className="td-share-all-close">✕</button>
                </div>
                <div className="td-share-all-link-row">
                  <span className="td-share-all-link">{tripLink}</span>
                  <button className="td-share-all-copy-btn" onClick={() => handleCopyTripLink()}>Copy link</button>
                </div>
                <div className="td-share-all-actions">
                  <button className="td-share-all-action-btn" onClick={handleShareAllWhatsApp}>
                    📱 WhatsApp all options
                  </button>
                  <button className="td-share-all-action-btn" onClick={handleShareAllEmail}>
                    ✉ Email all options
                  </button>
                  <button className="td-share-all-action-btn td-share-all-preview-btn" onClick={() => { setShareAllOpen(false); navigate('/travel/' + tripId); }}>
                    Preview traveler view →
                  </button>
                </div>
              </div>
            )}

            {options.length === 0 && apiTrip && (
              <div className="td-options-all-declined">
                <span className="td-options-all-declined-msg">All options declined.</span>
                <button className="td-options-regen-btn" onClick={() => handleGenerateItinerary()} disabled={generatingItinerary}>
                  {generatingItinerary ? 'Generating…' : '↺ Generate new options'}
                </button>
              </div>
            )}

            {(apiTrip?.itineraries ?? []).map((itin, i) => {
              const opt = options[i];
              if (!opt) return null;
              const isExpanded = expandedChatOption === opt.letter;
              const isAccepted = acceptedItineraryId === itin.itinerary_id;
              const isBusy = removingItinerary || acceptingItineraryId === itin.itinerary_id;
              const cost = computeOptionCost(itin);

              return (
                <div key={opt.letter} className={`td-chat-card${isAccepted ? ' td-chat-card--accepted' : ''}`}>
                  {/* Header */}
                  <div className="td-chat-card-header" onClick={() => {
                    setExpandedChatOption(isExpanded ? null : opt.letter);
                    setActiveOption(opt.letter);
                    setShareMenuOption(null);
                  }}>
                    <div className="td-chat-letter" style={{ background: isAccepted ? '#13B981' : opt.cover }}>
                      {isAccepted ? '✓' : opt.letter}
                    </div>
                    <div className="td-chat-card-info">
                      {editingItinName === itin.itinerary_id ? (
                        <input
                          className="td-option-name-input"
                          value={itinNameDraft}
                          onChange={e => setItinNameDraft(e.target.value)}
                          onBlur={() => handleSaveItinName(itin.itinerary_id, opt.name)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          onClick={e => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <div className="td-chat-card-name" onDoubleClick={e => {
                          e.stopPropagation();
                          setItinNameDraft(opt.name);
                          setEditingItinName(itin.itinerary_id);
                        }}>
                          {opt.name}
                          {!isAccepted && <button className="td-edit-icon-btn" onClick={e => { e.stopPropagation(); setItinNameDraft(opt.name); setEditingItinName(itin.itinerary_id); }} title="Rename">✎</button>}
                        </div>
                      )}
                      <div className="td-chat-card-meta">
                        {opt.rec && <span className="td-ai-pick" style={{ marginRight: 6 }}>✦ AI pick</span>}
                        {(itin.itinerary_days?.length ?? 0) > 0 && `${itin.itinerary_days!.length} days`}
                      </div>
                    </div>
                    <div className="td-chat-card-cost">
                      {cost?.hasData ? (
                        <>
                          <div className="td-chat-card-cost-num">{cost.total}</div>
                          <div className="td-chat-card-cost-label">est. total</div>
                        </>
                      ) : (
                        <div className="td-chat-card-cost-label">review details</div>
                      )}
                    </div>
                    <div className={`td-chat-card-chevron${isExpanded ? ' open' : ''}`}>›</div>
                  </div>

                  {/* Expanded body */}
                  {isExpanded && (
                    <div className="td-chat-card-body">
                      {cost && (
                        <div className="td-chat-cost-table">
                          <div className="td-chat-cost-row"><span>Flights</span><span>{cost.flights}</span></div>
                          <div className="td-chat-cost-row"><span>Accommodation</span><span>{cost.accommodation}</span></div>
                          <div className="td-chat-cost-row"><span>Activities</span><span>{cost.activities}</span></div>
                          <div className="td-chat-cost-row td-chat-cost-fee"><span>Service fee (5%)</span><span>{cost.fee}</span></div>
                          <div className="td-chat-cost-row td-chat-cost-total"><span>Total</span><span>{cost.total}</span></div>
                        </div>
                      )}
                      {(itin.itinerary_days?.length ?? 0) > 0 && (
                        <div className="td-chat-day-list">
                          <div className="td-chat-day-list-label">Highlights</div>
                          {itin.itinerary_days!.slice(0, 5).map((day, di) => (
                            <div key={di} className="td-chat-day-row">
                              <span className="td-chat-day-num">Day {day.day_number}</span>
                              <span className="td-chat-day-title">{day.title}</span>
                              {day.destinations?.[0]?.destination?.name && (
                                <span className="td-chat-day-place">{day.destinations[0].destination.name}</span>
                              )}
                            </div>
                          ))}
                          {itin.itinerary_days!.length > 5 && (
                            <button className="td-chat-see-all" onClick={e => { e.stopPropagation(); setBuilderTab('itinerary'); }}>
                              + {itin.itinerary_days!.length - 5} more days — full itinerary ↓
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="td-chat-card-actions" onClick={e => e.stopPropagation()}>
                    {isAccepted ? (
                      <button className="td-opt-undo-btn" onClick={() => handleAcceptItinerary(itin.itinerary_id)} disabled={isBusy}>
                        ↩ Undo accept
                      </button>
                    ) : (
                      <>
                        <button className="td-opt-accept-btn" onClick={() => handleAcceptItinerary(itin.itinerary_id)} disabled={isBusy}>✓ Accept</button>
                        <button className="td-opt-decline-btn" onClick={() => handleDeclineItinerary(itin.itinerary_id)} disabled={isBusy}>✕ Decline</button>
                      </>
                    )}
                    <div className="td-share-wrap">
                      <button className="td-share-btn" onClick={() => setShareMenuOption(shareMenuOption === opt.letter ? null : opt.letter)}>
                        ↗ Share
                      </button>
                      {shareMenuOption === opt.letter && (
                        <div className="td-share-menu">
                          {tripLink && (
                            <button onClick={() => handleCopyTripLink(opt.letter)}>
                              🔗 Copy option link
                            </button>
                          )}
                          <button onClick={() => handleShareOptionWhatsApp(itin, opt.letter, opt.name)}>
                            📱 WhatsApp option
                          </button>
                          <button onClick={() => handleShareChat(itin)}>
                            💬 Copy for chat
                          </button>
                          <button onClick={() => handleShareEmail(itin)}>
                            ✉ Send via email
                          </button>
                        </div>
                      )}
                    </div>
                    <button className="td-view-builder-btn" onClick={() => { setActiveOption(opt.letter); setBuilderTab('itinerary'); }}>
                      View full →
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Start city + regen row */}
            {apiTrip && options.length > 0 && (
              <div className="td-chat-bottom-row">
                {selectedItinerary && (
                  <div className="td-start-city-row" style={{ margin: 0 }}>
                    <span className="td-start-city-label">Start city:</span>
                    {editingStartCity ? (
                      <input className="td-start-city-input" value={startCityDraft} onChange={e => setStartCityDraft(e.target.value)} onBlur={handleSaveStartCity} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} placeholder="e.g. Accra" autoFocus />
                    ) : (
                      <button className="td-start-city-value" onClick={() => { setStartCityDraft(selectedItinerary.start_city ?? ''); setEditingStartCity(true); }}>
                        {selectedItinerary.start_city || '+ Set start city'}
                      </button>
                    )}
                  </div>
                )}
                <button className="td-refine-btn" onClick={() => setRefineOpen(true)} disabled={generatingItinerary}>
                  ✦ Refine results
                </button>
                <button className="td-chat-regen-btn" onClick={() => handleGenerateItinerary()} disabled={generatingItinerary}>
                  ↺ {generatingItinerary ? 'Generating…' : 'Regenerate'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Generation history timeline */}
        {isRealId && generationHistory.length > 0 && (
          <div className="td-history-panel mb-24">
            <button className="td-history-toggle" onClick={() => setHistoryExpanded(e => !e)}>
              <span className="td-history-icon">⏱</span>
              <span>Generation history · {generationHistory.length} snapshot{generationHistory.length !== 1 ? 's' : ''}</span>
              <span className={`td-history-chevron${historyExpanded ? ' open' : ''}`}>›</span>
            </button>
            {historyExpanded && (
              <div className="td-history-list">
                {generationHistory.map((snap) => (
                  <div
                    key={snap.id}
                    className={`td-history-entry${comparingSnap?.id === snap.id ? ' td-history-entry--active' : ''}`}
                    onClick={() => setComparingSnap(comparingSnap?.id === snap.id ? null : snap)}
                  >
                    <div className="td-history-entry-dot" />
                    <div className="td-history-entry-info">
                      <div className="td-history-entry-label">{snap.label}</div>
                      <div className="td-history-entry-time">
                        {snap.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {snap.itineraries.length} option{snap.itineraries.length !== 1 ? 's' : ''}
                      </div>
                      {snap.context && (
                        <div className="td-history-entry-context">"{snap.context.slice(0, 80)}{snap.context.length > 80 ? '…' : ''}"</div>
                      )}
                    </div>
                    <button className="td-history-compare-btn" onClick={e => { e.stopPropagation(); setComparingSnap(comparingSnap?.id === snap.id ? null : snap); }}>
                      {comparingSnap?.id === snap.id ? 'Close' : 'Compare →'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {comparingSnap && compareData && (
              <div className="td-compare-panel">
                <div className="td-compare-header">
                  <span className="td-compare-title">Changes from <strong>{comparingSnap.label}</strong> → Current</span>
                  <button onClick={() => setComparingSnap(null)} className="td-compare-close">✕</button>
                </div>
                {compareData.map(opt => (
                  <div key={opt.letter} className="td-compare-option">
                    <div className="td-compare-option-label">Option {opt.letter}{opt.name !== `Option ${opt.letter}` ? ` · ${opt.name}` : ''}</div>
                    {opt.addedDays.length === 0 && opt.removedDays.length === 0 ? (
                      <div className="td-compare-no-change">No day changes detected</div>
                    ) : (
                      <>
                        {opt.addedDays.map((d, i) => <div key={`a${i}`} className="td-compare-row td-compare-row--added">+ {d}</div>)}
                        {opt.removedDays.map((d, i) => <div key={`r${i}`} className="td-compare-row td-compare-row--removed">− {d}</div>)}
                      </>
                    )}
                    {opt.oldTotal && opt.newTotal && opt.oldTotal !== opt.newTotal && (
                      <div className="td-compare-cost">
                        <span className="td-compare-cost-old">{opt.oldTotal}</span>
                        <span className="td-compare-arrow"> → </span>
                        <span className="td-compare-cost-new">{opt.newTotal}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Traveler responses panel — visible when there are multiple travelers and itinerary options */}
        {isRealId && apiTrip && (apiTrip.customers ?? []).length > 0 && options.length > 0 && (
          <div className="td-traveler-responses mb-24">
            <div className="td-traveler-responses-header">
              <span className="td-traveler-responses-title">Traveler responses</span>
              <span className="td-traveler-responses-sub">Track which package each traveler has accepted</span>
            </div>
            <div className="td-traveler-responses-list">
              {(apiTrip.customers ?? []).map(c => {
                const selectedPkg = travelerPackages[c.customer_id] ?? '';
                return (
                  <div key={c.customer_id} className="td-tr-row">
                    <div className="td-tr-avatar">{c.first_name[0]}{c.last_name[0]}</div>
                    <div className="td-tr-name">{c.first_name} {c.last_name}</div>
                    <select
                      className="td-tr-pkg-select"
                      value={selectedPkg}
                      onChange={e => setTravelerPackages(prev => ({ ...prev, [c.customer_id]: e.target.value }))}
                    >
                      <option value="">— Pending —</option>
                      {options.map(o => (
                        <option key={o.letter} value={o.letter}>Option {o.letter}{o.name !== `Option ${o.letter}` ? ' · ' + o.name : ''}</option>
                      ))}
                      <option value="cancelled">Cancelled</option>
                    </select>
                    {selectedPkg && selectedPkg !== 'cancelled' && (
                      <span className="td-tr-accepted">✓ Accepted {selectedPkg}</span>
                    )}
                    {selectedPkg === 'cancelled' && (
                      <span className="td-tr-cancelled">✕ Cancelled</span>
                    )}
                  </div>
                );
              })}
            </div>
            {(() => {
              const customers = apiTrip.customers ?? [];
              const allAccepted = customers.length > 0 && customers.every(c => travelerPackages[c.customer_id] && travelerPackages[c.customer_id] !== 'cancelled');
              const allSamePkg = allAccepted && new Set(customers.map(c => travelerPackages[c.customer_id])).size === 1;
              const anyActive = customers.some(c => !travelerPackages[c.customer_id] || travelerPackages[c.customer_id] !== 'cancelled');
              return (
                <div className="td-tr-actions">
                  {allSamePkg && apiTrip.status !== 'booked' && (
                    <button
                      className="td-tr-confirm-btn"
                      onClick={handleConfirmBookingAll}
                      disabled={bookingAll || updatingStatus}
                    >
                      {bookingAll ? 'Confirming…' : `✓ Confirm booking for all · Option ${customers[0] ? travelerPackages[customers[0].customer_id] : ''}`}
                    </button>
                  )}
                  {allAccepted && !allSamePkg && (
                    <span className="td-tr-mixed-note">Travelers have different packages — book separately or agree on one option.</span>
                  )}
                  {anyActive && apiTrip.status !== 'cancelled' && (
                    <button
                      className="td-tr-cancel-btn"
                      onClick={() => handleStatusTransition('cancelled')}
                      disabled={updatingStatus}
                    >
                      Cancel trip for all
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {(tb.showDrafting || generatingItinerary) && (
          <div className="td-generating-card">
            <div className="td-generating-icon">✦</div>
            <h2 className="td-generating-title">Meridian is building options…</h2>
            <p className="td-generating-sub">Searching flights, stays and experiences...</p>
            <div className="td-generating-progress-wrap">
              <div className="td-generating-progress-bar" />
            </div>
            <div className="td-generating-checklist">
              <div className="td-generating-check-item">
                <span className="td-generating-check-icon">✓</span>
                <span>Scanned flight routes</span>
              </div>
              <div className="td-generating-check-item">
                <span className="td-generating-check-icon">✓</span>
                <span>Matched stays & experiences</span>
              </div>
              <div className="td-generating-check-item">
                <div className="td-generating-spinner" />
                <span>Curating your itinerary…</span>
              </div>
            </div>
            {!generatingItinerary && (
              <button
                onClick={ctx.revealOptions}
                className="td-drafting-skip"
              >
                Skip & preview
              </button>
            )}
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

        {generateError && (
          <div className="td-generate-error" role="alert">
            <span className="td-generate-error-icon">⚠</span>
            <span>{generateError}</span>
            <button className="td-generate-error-close" onClick={() => setGenerateError(null)}>✕</button>
          </div>
        )}

        {tb.showBuilder && (
          <div className="td-builder-layout" ref={builderRef}>
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
                    {days.map((day) => {
                      const dayId = selectedItinerary?.itinerary_days?.[day.di ?? -1]?.itinerary_day_id;
                      const isOpen = expandedDays.has(day.di);
                      return (
                      <div key={day.di} className={'td-day-acc' + (isOpen ? ' td-day-acc--open' : '')}>
                        <div className="td-day-acc-header" onClick={() => toggleDay(day.di)}>
                          <div className="td-day-acc-date">
                            <span className="td-day-dow">{day.dow}</span>
                            <span className="td-day-num">{day.day}</span>
                            <span className="td-day-mon">{day.mon}</span>
                          </div>

                          <div className="td-day-acc-title-col" onClick={e => e.stopPropagation()}>
                            {dayId && editingDayTitle === dayId ? (
                              <input
                                className="td-day-title-input"
                                value={dayTitleDraft}
                                onChange={e => setDayTitleDraft(e.target.value)}
                                onBlur={() => handleSaveDayTitle(dayId, day.title)}
                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                autoFocus
                              />
                            ) : (
                              <div className="td-day-title-row">
                                <div
                                  className="td-day-title"
                                  onDoubleClick={() => {
                                    if (!dayId) return;
                                    setDayTitleDraft(day.title);
                                    setEditingDayTitle(dayId);
                                  }}
                                  title={dayId ? 'Double-click to rename' : undefined}
                                >
                                  {day.title}
                                </div>
                                {dayId && (
                                  <button
                                    onClick={() => {
                                      setDayTitleDraft(day.title);
                                      setEditingDayTitle(dayId);
                                    }}
                                    className="td-edit-icon-btn"
                                    title="Rename day"
                                  >
                                    ✎
                                  </button>
                                )}
                              </div>
                            )}
                            <div className="td-day-acc-summary">
                              {day.blocks.length === 0 ? 'No items yet' : `${day.blocks.length} item${day.blocks.length === 1 ? '' : 's'}`}
                            </div>
                          </div>

                          <div className="td-day-acc-actions">
                            {dayId && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveDay(dayId); }}
                                className="td-block-remove"
                                disabled={removingDayId === dayId}
                                title="Remove day"
                              >
                                ✕
                              </button>
                            )}
                            <span className={'td-day-acc-chevron' + (isOpen ? ' td-day-acc-chevron--open' : '')}>
                              ⌄
                            </span>
                          </div>
                        </div>

                        {isOpen && (
                          <div className="td-day-acc-body">
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
                        )}
                      </div>
                      );
                    })}
                    <button
                      onClick={handleAddDay}
                      className="td-dashed-btn"
                      disabled={addingDay}
                      style={{ marginTop: 16 }}
                    >
                      {addingDay ? '+ Adding...' : '+ Add day'}
                    </button>
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
                            {apiTrip && selectedItinerary?.itinerary_flights?.[i]?.flight_id && (
                              <button
                                onClick={() => handleRemoveFlight(i)}
                                className="td-flight-remove"
                                title="Remove flight"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                          {f.recDisplay === 'inline-block' && (
                            <span className="td-flight-rec">
                              Recommended
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    {apiTrip && (
                      <button
                        onClick={handleOpenAddFlight}
                        className="td-dashed-btn"
                        style={{ marginTop: 12 }}
                        disabled={bootstrapping}
                      >
                        {bootstrapping ? 'One moment…' : '+ Add flight'}
                      </button>
                    )}
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
                              {apiTrip && selectedItinerary?.itinerary_accommodation?.[i]?.accommodation_id ? (
                                <div className="td-stay-actions">
                                  <button
                                    onClick={() => setEditingStay(selectedItinerary.itinerary_accommodation![i])}
                                    className="td-stay-select"
                                    style={{ background: '#fff', color: '#5B6172', border: '1px solid #DDE0E8' }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleRemoveAccommodation(i)}
                                    className="td-stay-select"
                                    style={{ background: '#fff', color: '#D64545', border: '1px solid #FDECEC' }}
                                  >
                                    Remove
                                  </button>
                                </div>
                              ) : (
                                <button className="td-stay-select">
                                  Select
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {apiTrip && (
                      <button
                        onClick={handleOpenAddStay}
                        className="td-dashed-btn"
                        style={{ marginTop: 12 }}
                        disabled={bootstrapping}
                      >
                        {bootstrapping ? 'One moment…' : '+ Add stay'}
                      </button>
                    )}
                  </div>
                )}

                {tabActs && (
                  <div>
                    <p className="td-acts-desc">
                      {apiTrip
                        ? "Activities added across this itinerary's days."
                        : "Add activities to this itinerary. They'll appear on the last day."}
                    </p>
                    {apiTrip ? (
                      <>
                        {realActivities && realActivities.length > 0 ? (
                          <div className="td-acts-grid">
                            {realActivities.map((act) => (
                              <div
                                key={`${act.dayIndex}-${act.destinationId}`}
                                className="td-act-card"
                              >
                                <div className="td-act-cover" style={{ background: '#E3F7EF' }} />
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
                                    <div className="td-act-actions">
                                      <button
                                        onClick={() => setEditingActivity({ dayIndex: act.dayIndex, item: act.item })}
                                        className="td-act-add"
                                        style={{ background: '#fff', color: '#5B6172', border: '1px solid #DDE0E8' }}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => handleRemoveActivity(act.dayIndex, act.destinationId)}
                                        className="td-act-add"
                                        style={{ background: '#fff', color: '#D64545', border: '1px solid #FDECEC' }}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="td-acts-empty">No activities added yet.</p>
                        )}
                        <button
                          onClick={handleOpenAddActivity}
                          className="td-dashed-btn"
                          style={{ marginTop: 12 }}
                          disabled={bootstrapping}
                        >
                          {bootstrapping ? 'One moment…' : '+ Add activity'}
                        </button>
                      </>
                    ) : (
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
                    )}
                  </div>
                )}

                {tabCalls && (
                  <div className="td-calls-grid">
                    <div>
                      {apiTrip ? (
                        <>
                          {apiCalls.map((c, i) => (
                            <div
                              key={c.call_id}
                              onClick={() => setActiveCall(i)}
                              className="td-call-log"
                              style={{
                                background: activeCall === i ? '#F4F7FF' : 'transparent',
                                borderColor: activeCall === i ? '#C4D2FF' : 'transparent',
                              }}
                            >
                              <div className="td-call-log-icon">🎥</div>
                              <div className="td-call-log-info">
                                <div className="td-call-log-title">
                                  {c.title || 'Untitled call'}
                                </div>
                                <div className="td-call-log-meta">
                                  {c.started_at ? new Date(c.started_at).toLocaleString() : 'Not started'}
                                  {c.ended_at ? ' · Ended' : ''}
                                </div>
                              </div>
                            </div>
                          ))}
                          <div className="td-add-call-row">
                            <input
                              value={newCallTitle}
                              onChange={e => setNewCallTitle(e.target.value)}
                              placeholder="Call title (e.g. Discovery call)"
                              className="td-call-input"
                            />
                            <button
                              onClick={handleAddCall}
                              disabled={addingCall || !newCallTitle.trim()}
                              className="td-dashed-btn"
                            >
                              {addingCall ? 'Logging...' : '+ Log a call'}
                            </button>
                          </div>
                        </>
                      ) : (
                        callLogsArr.map((cl, i) => (
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
                        ))
                      )}
                    </div>

                    <div>
                      {apiTrip ? (
                        (() => {
                          const selectedCall = apiCalls[activeCall];
                          if (!selectedCall) {
                            return (
                              <div className="td-call-empty">
                                Select a call to view details, or log a new one.
                              </div>
                            );
                          }
                          const organizer = typeof selectedCall.organized_by === 'object' && selectedCall.organized_by
                            ? selectedCall.organized_by.display_name
                            : null;
                          return (
                            <div>
                              <div className="td-call-detail-wrap">
                                <div className="td-call-detail-title">
                                  {selectedCall.title || 'Untitled call'}
                                </div>
                                <div className="td-call-detail-meta">
                                  {organizer ? `Organized by ${organizer} · ` : ''}
                                  {selectedCall.started_at ? new Date(selectedCall.started_at).toLocaleString() : 'Not started yet'}
                                </div>
                              </div>
                              {selectedCall.ended_at ? (
                                <div className="td-call-badge">✓ Call ended</div>
                              ) : (
                                <button
                                  onClick={() => handleEndCall(selectedCall.call_id)}
                                  className="td-call-badge td-call-end-btn"
                                >
                                  End call
                                </button>
                              )}
                              {selectedCall.notes && (
                                <div className="td-call-section">
                                  <div className="td-call-section-label">
                                    Notes
                                  </div>
                                  <p className="td-summary-text">
                                    {selectedCall.notes}
                                  </p>
                                </div>
                              )}
                              <div className="td-call-section">
                                <div className="td-call-section-label-mb8">
                                  Action points
                                </div>
                                {(selectedCall.action_items ?? []).map((a, i) => (
                                  <div key={a.action_item_id} className="td-call-action-row">
                                    <button
                                      onClick={() => handleToggleActionItem(a.action_item_id, a.status)}
                                      className="td-call-action-num td-call-action-toggle"
                                      style={a.status === 'checked' ? { background: '#0E9F6E', color: '#fff' } : undefined}
                                      title="Toggle done"
                                    >
                                      {a.status === 'checked' ? '✓' : i + 1}
                                    </button>
                                    <span
                                      className="td-call-action-text"
                                      style={a.status === 'checked' ? { textDecoration: 'line-through', color: '#AEB3C2' } : undefined}
                                    >
                                      {a.description}
                                    </span>
                                  </div>
                                ))}
                                <div className="td-add-call-row">
                                  <input
                                    value={newActionItemText}
                                    onChange={e => setNewActionItemText(e.target.value)}
                                    placeholder="Add an action point..."
                                    className="td-call-input"
                                  />
                                  <button
                                    onClick={() => handleAddActionItem(selectedCall.call_id)}
                                    disabled={savingActionItem || !newActionItemText.trim()}
                                    className="td-dashed-btn"
                                  >
                                    + Add
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      ) : call ? (
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
                  {costs.length === 0 && apiTrip ? (
                    <div className="td-cost-empty">
                      Generate an itinerary to see cost estimates
                    </div>
                  ) : (
                    <>
                      {costs.map((c, i) => (
                        <div key={i} className="td-cost-row">
                          <span className="td-cost-label">{c.label}</span>
                          <span className="td-cost-value">{c.value}</span>
                        </div>
                      ))}
                      {costTotal && (
                        <div className="td-cost-total">
                          <span className="td-cost-total-label">Total</span>
                          <span className="td-cost-total-value">{costTotal}</span>
                        </div>
                      )}
                      {costFee && <div className="td-cost-fee">{costFee}</div>}
                    </>
                  )}
                  {/* Payment recording — only for booked/completed trips */}
                  {apiTrip && ['booked', 'in_progress', 'completed'].includes(apiTrip.status ?? '') && (
                    <div className="td-record-payment">
                      {showPaymentForm ? (
                        <div className="td-payment-form">
                          <input
                            value={paymentAmount}
                            onChange={e => setPaymentAmount(e.target.value)}
                            placeholder={`Amount (${costCurrency})`}
                            type="number"
                            className="td-call-input"
                          />
                          <input
                            value={paymentMethod}
                            onChange={e => setPaymentMethod(e.target.value)}
                            placeholder="Method (e.g. Paystack, bank transfer)"
                            className="td-call-input"
                          />
                          <div className="td-payment-form-actions">
                            <button
                              onClick={() => { setShowPaymentForm(false); setPaymentAmount(''); setPaymentMethod(''); }}
                              className="td-action-btn"
                              style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handlePayWithMoolre}
                              disabled={payingWithMoolre || savingPayment || !paymentAmount.trim()}
                              className="td-action-btn"
                              style={{ background: '#2B63F6', color: '#fff', borderColor: '#2B63F6' }}
                            >
                              {payingWithMoolre ? 'Redirecting…' : 'Pay with Mobile Money'}
                            </button>
                            <button
                              onClick={handleRecordPayment}
                              disabled={savingPayment || payingWithMoolre || !paymentAmount.trim()}
                              className="td-action-btn"
                              style={{ background: '#13B981', color: '#fff', borderColor: '#13B981' }}
                            >
                              {savingPayment ? 'Saving...' : 'Record manually'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setShowPaymentForm(true)} className="td-dashed-btn">
                          + Record payment
                        </button>
                      )}
                    </div>
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
                    {tripAgentName}
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
        open={addItemDay !== null || editingActivity !== null}
        dayIndex={editingActivity ? editingActivity.dayIndex : addItemDay ?? 0}
        dayId={(() => {
          const di = editingActivity ? editingActivity.dayIndex : addItemDay;
          return di !== null ? selectedItinerary?.itinerary_days?.[di]?.itinerary_day_id ?? null : null;
        })()}
        editing={editingActivity?.item ?? null}
        onClose={() => { setAddItemDay(null); setEditingActivity(null); }}
        onSaved={() => { refreshTrip(); setAddItemDay(null); setEditingActivity(null); }}
      />
      <AddFlightModal
        open={addFlightOpen}
        itineraryId={selectedItinerary?.itinerary_id ?? null}
        startCity={selectedItinerary?.start_city ?? null}
        onClose={() => setAddFlightOpen(false)}
        onSaved={() => { refreshTrip(); setAddFlightOpen(false); }}
      />
      <AddStayModal
        open={addStayOpen || editingStay !== null}
        itineraryId={selectedItinerary?.itinerary_id ?? null}
        startCity={selectedItinerary?.start_city ?? null}
        editing={editingStay}
        onClose={() => { setAddStayOpen(false); setEditingStay(null); }}
        onSaved={() => { refreshTrip(); setAddStayOpen(false); setEditingStay(null); }}
      />
      <AssignTravelerModal
        open={assignTravelerOpen}
        tripId={apiTrip?.trip_id ?? null}
        companyId={apiTrip?.company_id ?? null}
        currentCustomerId={null}
        onClose={() => setAssignTravelerOpen(false)}
        onAssigned={() => { refreshTrip(); setAssignTravelerOpen(false); }}
      />
      <EditTripModal
        open={editTripOpen}
        trip={apiTrip}
        fallbackName={td.name}
        onClose={() => setEditTripOpen(false)}
        onSaved={refreshTrip}
      />

      {/* Refine modal */}
      {refineOpen && (
        <div className="td-refine-overlay" onClick={e => { if (e.target === e.currentTarget) setRefineOpen(false); }}>
          <div className="td-refine-modal">
            <div className="td-refine-modal-header">
              <span className="td-refine-modal-title">✦ Refine itinerary</span>
              <button onClick={() => setRefineOpen(false)} className="td-refine-modal-close">✕</button>
            </div>
            <p className="td-refine-modal-desc">
              Add context, preferences, or corrections — the AI will use this to update the generated options.
            </p>
            <textarea
              className="td-refine-textarea"
              value={refineText}
              onChange={e => setRefineText(e.target.value)}
              placeholder="e.g. Prefer boutique hotels, add a cooking class on Day 3, keep the budget under USD 5,000, swap the beach day for a city tour…"
              rows={5}
              autoFocus
            />
            {/* Version title — names this result in the history timeline */}
            <input
              className="td-refine-version-input"
              value={refineTitle}
              onChange={e => setRefineTitle(e.target.value)}
              placeholder="Version title (e.g. Beach-focused, Budget option…)"
            />

            {/* Traveler context selector */}
            {(apiTrip?.customers ?? []).length > 0 && (
              <div className="td-refine-traveler-row">
                <label className="td-refine-label">Refine for</label>
                <select
                  className="td-refine-traveler-select"
                  value={refineFor}
                  onChange={e => setRefineFor(e.target.value)}
                >
                  <option value="all">All travelers</option>
                  {(apiTrip?.customers ?? []).map(c => (
                    <option key={c.customer_id} value={c.customer_id}>
                      {c.first_name} {c.last_name} only
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Events toggle */}
            <label className="td-refine-events-toggle">
              <input
                type="checkbox"
                checked={refineIncludeEvents}
                onChange={e => setRefineIncludeEvents(e.target.checked)}
              />
              <span>Include real events from Ticketmaster</span>
            </label>

            <div className="td-refine-toolbar">
              <button
                className={`td-refine-tool-btn${isListening ? ' td-refine-tool-btn--active' : ''}`}
                onClick={toggleVoice}
                title={isListening ? 'Stop recording' : 'Voice input'}
              >
                🎙️ {isListening ? 'Listening…' : 'Voice'}
              </button>
              <button
                className="td-refine-tool-btn"
                onClick={() => refineImageRef.current?.click()}
                title="Attach an image for context"
              >
                📎 {refineImageName ? refineImageName.slice(0, 22) : 'Attach image'}
              </button>
              <input
                ref={refineImageRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) setRefineImageName(f.name);
                  e.target.value = '';
                }}
              />
              <select
                className="td-refine-model-select"
                value={refineModel}
                onChange={e => setRefineModel(e.target.value)}
                title="AI model"
              >
                <optgroup label="Claude">
                  <option value="claude-haiku-4-5-20251001">Haiku · Fastest</option>
                  <option value="claude-sonnet-5">Sonnet · Balanced</option>
                  <option value="claude-opus-4-8">Opus · Most thorough</option>
                </optgroup>
                <optgroup label="Google">
                  <option value="gemini-2.0-flash">Gemini Flash · Fast</option>
                  <option value="gemini-1.5-pro">Gemini Pro · Balanced</option>
                </optgroup>
                <optgroup label="OpenAI">
                  <option value="gpt-4o-mini">GPT-4o mini · Fast</option>
                  <option value="gpt-4o">GPT-4o · Balanced</option>
                </optgroup>
              </select>
            </div>
            <div className="td-refine-modal-actions">
              <button
                onClick={() => { setRefineOpen(false); setRefineText(''); setRefineImageName(null); setRefineTitle(''); setRefineFor('all'); }}
                className="td-action-btn"
                style={{ background: '#fff', color: '#5B6172', borderColor: '#DDE0E8' }}
              >
                Cancel
              </button>
              <button
                onClick={handleRefineSubmit}
                disabled={!refineText.trim() && !refineImageName}
                className="td-action-btn"
                style={{ background: '#2B63F6', color: '#fff', borderColor: '#2B63F6' }}
              >
                ✦ Update itinerary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
