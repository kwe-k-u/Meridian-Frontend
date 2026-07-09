import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { ApiService } from '../services/api-service';
import type { TripOption, TripStatus, Day, DayBlock, Flight, Stay, ItineraryResponse, TripResponse, TripCostResponse, CallResponse, ItineraryAccommodationResponse } from '../types/app';
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

function dayToBlocks(day: NonNullable<ItineraryResponse['itinerary_days']>[number], format: (amount: number, from?: string) => string): DayBlock[] {
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
        price: d.cost ? format(Number(d.cost), d.currency ?? 'GHS') : '',
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

function itineraryDaysToDays(itineraryDays: NonNullable<ItineraryResponse['itinerary_days']>, format: (amount: number, from?: string) => string): Day[] {
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
      blocks: dayToBlocks(d, format),
      hasSuggestion: false,
      addBlock: () => {},
    };
  });
}

function itineraryFlightsToFlights(flights: NonNullable<ItineraryResponse['itinerary_flights']>, format: (amount: number, from?: string) => string): Flight[] {
  return flights.map(f => ({
    code: (f.airline ?? 'XX').substring(0, 2).toUpperCase(),
    airline: f.airline ?? 'Unknown',
    route: `${f.departure_airport ?? '???'} → ${f.arrival_airport ?? '???'}`,
    duration: f.departure_datetime && f.arrival_datetime
      ? `${Math.round((new Date(f.arrival_datetime).getTime() - new Date(f.departure_datetime).getTime()) / 3600000)}h`
      : '',
    stops: 'Direct',
    price: f.cost ? format(f.cost, f.currency ?? 'GHS') : '',
    cta: f.status === 'booked' ? 'Selected' : 'Select',
    logoBg: '#2B63F6',
    recDisplay: 'none',
    border: '#ECEDF2',
    bg: '#fff',
  }));
}

function itineraryStaysToStays(accommodation: NonNullable<ItineraryResponse['itinerary_accommodation']>, format: (amount: number, from?: string) => string): Stay[] {
  return accommodation.map(a => ({
    name: a.accommodation_name,
    loc: a.address ?? '',
    rating: '4.5',
    price: a.cost ? format(a.cost, a.currency ?? 'GHS') : '',
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
  const { format } = useCurrency();
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
  const [removingDayId, setRemovingDayId] = useState<string | null>(null);
  const [removingItinerary, setRemovingItinerary] = useState(false);
  const [addingOption, setAddingOption] = useState(false);
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
  // Sidebar tab (Cost summary / Payments / Agent activity) — these used to be two always-open
  // cards (with Payments nested inside Cost summary), switched to a single tabbed card so the
  // user can flip between them instead of scrolling a long stacked sidebar.
  const [sidebarTab, setSidebarTab] = useState<'cost' | 'payments' | 'activity'>('cost');

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

  // Kicks off itinerary generation. For a real trip this calls the backend (which sleeps ~4s
  // and returns a templated itinerary — see TripController::generateItinerary), showing the
  // `generatingItinerary` loading state below for the duration; for a mock trip it falls back
  // to the old client-only fake "drafting" animation (ctx.generateOptions()).
  const handleGenerateItinerary = useCallback(async (prefs?: { budget?: string; style?: string; priorities?: string[]; notes?: string; start_city?: string }) => {
    if (!tripId || !isRealId) {
      ctx.generateOptions();
      return;
    }
    setGeneratingItinerary(true);
    try {
      await ApiService.generateItinerary(tripId, prefs);
      await refreshTrip();
    } finally {
      setGeneratingItinerary(false);
    }
  }, [tripId, isRealId, ctx, refreshTrip]);

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
      value: apiTrip.budget ? format(Number(apiTrip.budget), 'GHS') : mockTd.value,
      status: sm.display as TripStatus,
      statusBg: sm.bg,
      statusFg: sm.fg,
      gradient: sm.gradient,
      origin: apiTrip.customers?.[0]?.last_name ?? 'Traveler',
    };
  }, [apiTrip, mockTd, format]);

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

  // The "X itinerary options ready for review" note (tip banner + the small label above the
  // option pills) is meant as a one-time nudge right after generation, not a permanent
  // fixture — for real trips tb.headline stays "ready for review" forever once any itinerary
  // exists, regardless of what the trip's status becomes afterwards (see tripTb above, which
  // only branches on hasItins). Auto-hide it a while after it first appears; every other
  // banner variant (drafting, confirmed, booked, etc.) is unaffected and keeps showing as before.
  const isReadyForReviewNotice = tb.headline.includes('ready for review');
  const [readyNoticeDismissed, setReadyNoticeDismissed] = useState(false);

  useEffect(() => {
    if (!isReadyForReviewNotice) {
      setReadyNoticeDismissed(false);
      return;
    }
    const timer = setTimeout(() => setReadyNoticeDismissed(true), 8000);
    return () => clearTimeout(timer);
  }, [isReadyForReviewNotice]);

  const showReadyNotice = !isReadyForReviewNotice || !readyNoticeDismissed;

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

  // Cost summary sidebar data, in priority order:
  // 1) the real /trips/{id}/costs response for the currently-selected itinerary (preferred —
  //    matches TripController::costs()'s server-side totals including payments/outstanding),
  // 2) a client-side recomputation from the selected itinerary's raw flights/accommodation/
  //    destinations (used if tripCosts hasn't loaded yet, e.g. right after generating),
  // 3) null, falling back further to the mock td.costs in the `costs` variable below.
  const computedCosts = useMemo(() => {
    // The costs endpoint returns one cost breakdown per itinerary, in the same order
    // as apiTrip.itineraries, so we match by index rather than itinerary_id.
    const ic = tripCosts?.itineraries[selectedItineraryIndex] ?? tripCosts?.itineraries[0];
    if (ic) {
      const c = ic.currency;
      // `currency` below stays the itinerary's native currency (what the record-payment form
      // and Moolre both submit amounts in) — only these displayed row/fee/total strings get
      // converted to the preferred currency, via `fmt`.
      const fmt = (n: number) => format(n, c);
      return {
        rows: [
          { label: 'Flights', value: fmt(ic.flights) },
          { label: 'Accommodation', value: fmt(ic.accommodation) },
          { label: 'Activities & transfers', value: fmt(ic.activities) },
        ],
        fee: `Service fee (5%) ${fmt(ic.service_fee)}`,
        total: fmt(ic.total),
        currency: c,
        payments: tripCosts?.payments ?? [],
        summary: tripCosts?.summary,
      };
    }
    if (selectedItinerary) {
      const flightsCost = (selectedItinerary.itinerary_flights ?? []).reduce((s, f) => s + (f.cost ?? 0), 0);
      const staysCost = (selectedItinerary.itinerary_accommodation ?? []).reduce((s, a) => s + (a.cost ?? 0), 0);
      const activitiesCost = (selectedItinerary.itinerary_days ?? []).reduce((sum, d) =>
        sum + (d.destinations ?? []).reduce((s2, dst) => s2 + Number(dst.cost ?? 0), 0), 0);
      const currency = selectedItinerary.itinerary_flights?.[0]?.currency ?? selectedItinerary.itinerary_accommodation?.[0]?.currency ?? 'GHS';
      const fmt = (n: number) => format(n, currency);
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
        payments: [] as TripCostResponse['payments'],
        summary: undefined as TripCostResponse['summary'] | undefined,
      };
    }
    return null;
  }, [tripCosts, selectedItinerary, selectedItineraryIndex, format]);

  const costs = computedCosts?.rows ?? td.costs ?? [];
  const costTotal = computedCosts?.total ?? td.total ?? '';
  const costFee = computedCosts?.fee ?? 'Service fee charged to traveller';
  const payments = computedCosts?.payments ?? [];
  const costSummary = computedCosts?.summary ?? null;
  const costCurrency = computedCosts?.currency ?? 'GHS';

  const rawDays = hasApiData && selectedItinerary?.itinerary_days
    ? itineraryDaysToDays(selectedItinerary.itinerary_days, format)
    : apiTrip
    ? [{ di: 0, dow: '', day: '01', mon: '', title: 'Day 1', blocks: [], addBlock: () => {} }]
    : ctx.getDays(tid, activeOption);

  // ── Event handlers ──

  // Removes a single destination/activity block from a day. For a real trip, this calls the
  // scoped removeDestinationFromDay endpoint — it must NOT call removeItineraryDay, which
  // would delete the whole day (and every other destination on it) instead of just this one.
  const handleRemoveBlock = (di: number, bi: number) => {
    if (selectedItinerary?.itinerary_days?.[di]?.destinations) {
      const dst = selectedItinerary.itinerary_days[di].destinations!;
      const destinationId = dst[bi]?.destination_id;
      if (destinationId) {
        const dayId = selectedItinerary.itinerary_days[di].itinerary_day_id;
        if (dayId) {
          ApiService.removeDestinationFromDay(dayId, destinationId).then(() => refreshTrip());
          return;
        }
      }
    }
    ctx.removeBlock(di, bi);
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
      setActiveOption('A');
      await refreshTrip();
    } finally {
      setRemovingItinerary(false);
    }
  };

  // Adds a brand-new blank itinerary option (e.g. "Option C") alongside whatever already
  // exists, named by the next unused letter — same letter-assignment scheme as the options
  // list itself (options[i].letter = A + i) and TripController::generateItinerary's own
  // auto-naming. Only meaningful for real trips; mock trips have no backend itinerary to add
  // to, so this just points the agent at "Generate options" instead.
  const handleAddOption = async () => {
    if (!apiTrip) {
      ctx.toastAction('Generate an itinerary first to add more options.');
      return;
    }
    setAddingOption(true);
    try {
      const letter = String.fromCharCode(65 + options.length);
      await ApiService.createItinerary({
        trip_id: apiTrip.trip_id,
        itinerary_name: `Option ${letter}`,
        start_city: selectedItinerary?.start_city ?? undefined,
        start_date: apiTrip.start_date ?? undefined,
        end_date: apiTrip.end_date ?? undefined,
      });
      await refreshTrip();
      setActiveOption(letter);
    } finally {
      setAddingOption(false);
    }
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
    ? itineraryFlightsToFlights(selectedItinerary.itinerary_flights, format)
    : apiTrip ? [] : ctx.getFlights();

  const stays = selectedItinerary?.itinerary_accommodation
    ? itineraryStaysToStays(selectedItinerary.itinerary_accommodation, format)
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
          price: d.cost ? format(Number(d.cost), d.currency ?? 'GHS') : '',
          item: d,
        })),
      )
    : null;
  const { calls: callLogsArr, callDetails } = ctx.getCallLogs();
  const call = callDetails[activeCall] ?? null;
  const agentFeed = ctx.getAgentFeed();

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

  // Opens the traveler's public trip-pack link in a new tab, for the agent to hand off to
  // the traveler (copy the URL, screen-share it, etc.) without losing their own place in the
  // dashboard — unlike handleOpenTravelerView above, which navigates the current tab away.
  const handleShareTravelerView = () => {
    window.open('/travel/' + (isRealId && tripId ? tripId : tid), '_blank', 'noopener,noreferrer');
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
                <span>{td.traveler}</span>
                {apiTrip && (
                  <button
                    onClick={() => setAssignTravelerOpen(true)}
                    className="td-traveler-change-btn"
                  >
                    {apiTrip.customers?.[0] ? 'Change' : '+ Assign traveler'}
                  </button>
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
                      <button onClick={handleShareTravelerView} className="td-action-btn" style={{ background: '#2B63F6', color: '#fff', borderColor: '#2B63F6' }}>
                        Share trip
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

        {showReadyNotice && (
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
        )}

        {tb.showOptions && options.length > 0 && (
          <div className="mb-24">
            {showReadyNotice && (
              <div className="td-options-label">
                {optLabel}
              </div>
            )}
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
                      {opt.itineraryId && editingItinName === opt.itineraryId ? (
                        <input
                          className="td-option-name-input"
                          value={itinNameDraft}
                          onChange={e => setItinNameDraft(e.target.value)}
                          onBlur={() => handleSaveItinName(opt.itineraryId!, opt.name)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          onClick={e => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <div className="td-option-name-row">
                          <div
                            className="td-option-name"
                            style={{ color: isActive ? '#2B63F6' : '#15161B' }}
                            onDoubleClick={(e) => {
                              if (!opt.itineraryId) return;
                              e.stopPropagation();
                              setItinNameDraft(opt.name);
                              setEditingItinName(opt.itineraryId);
                            }}
                            title={opt.itineraryId ? 'Double-click to rename' : undefined}
                          >
                            {opt.name}
                          </div>
                          {opt.itineraryId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setItinNameDraft(opt.name);
                                setEditingItinName(opt.itineraryId!);
                              }}
                              className="td-edit-icon-btn"
                              title="Rename option"
                            >
                              ✎
                            </button>
                          )}
                        </div>
                      )}
                      <div className="td-option-sub">
                        {opt.sub}
                      </div>
                    </div>
                    {opt.rec && (
                      <span className="td-ai-pick">
                        ✦ AI pick
                      </span>
                    )}
                    {opt.itineraryId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveItinerary(opt.itineraryId!); }}
                        className="td-block-remove"
                        disabled={removingItinerary}
                        title="Delete this option"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
              <div
                className="td-add-option"
                onClick={addingOption ? undefined : handleAddOption}
                style={addingOption ? { opacity: 0.6, cursor: 'default' } : undefined}
              >
                <span className="td-add-option-plus">+</span>
                <span className="td-add-option-label">{addingOption ? 'Adding…' : 'Add option'}</span>
              </div>
            </div>
            {apiTrip && selectedItinerary && (
              <div className="td-start-city-row">
                <span className="td-start-city-label">Start city:</span>
                {editingStartCity ? (
                  <input
                    className="td-start-city-input"
                    value={startCityDraft}
                    onChange={e => setStartCityDraft(e.target.value)}
                    onBlur={handleSaveStartCity}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    placeholder="e.g. Accra"
                    autoFocus
                  />
                ) : (
                  <button
                    className="td-start-city-value"
                    onClick={() => { setStartCityDraft(selectedItinerary.start_city ?? ''); setEditingStartCity(true); }}
                  >
                    {selectedItinerary.start_city || '+ Set start city'}
                  </button>
                )}
              </div>
            )}
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
                <div className="td-tabs-bar">
                  <button className={'td-tab-btn' + (sidebarTab === 'cost' ? ' td-tab-btn--active' : '')} onClick={() => setSidebarTab('cost')}>
                    Cost summary
                  </button>
                  <button className={'td-tab-btn' + (sidebarTab === 'payments' ? ' td-tab-btn--active' : '')} onClick={() => setSidebarTab('payments')}>
                    Payments
                  </button>
                  <button className={'td-tab-btn' + (sidebarTab === 'activity' ? ' td-tab-btn--active' : '')} onClick={() => setSidebarTab('activity')}>
                    Agent activity
                  </button>
                </div>

                {sidebarTab === 'cost' && (
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
                  </div>
                )}

                {sidebarTab === 'payments' && (
                  <div className="td-cost-body">
                    {apiTrip && (
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
                    {payments.length > 0 ? (
                      <>
                        <div className="td-cost-divider" />
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
                            <span className="td-pay-amount">{format(p.amount, p.currency)}</span>
                          </div>
                        ))}
                      </>
                    ) : (
                      <p style={{ color: '#8A90A2', textAlign: 'center', padding: '20px 0', fontSize: 13 }}>
                        No payments recorded yet.
                      </p>
                    )}
                    {costSummary && (
                      <>
                        <div className="td-cost-divider" />
                        <div className="td-summary-rows">
                          <div className="td-summary-row">
                            <span>Total paid</span>
                            <span className="td-summary-paid">{format(Number(costSummary.total_paid), costCurrency)}</span>
                          </div>
                          <div className="td-summary-row">
                            <span>Pending</span>
                            <span className="td-summary-pending">{format(Number(costSummary.total_pending), costCurrency)}</span>
                          </div>
                          <div className="td-summary-row td-summary-outstanding">
                            <span>Outstanding</span>
                            <span>{format(Number(costSummary.outstanding), costCurrency)}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {sidebarTab === 'activity' && (
                  <>
                    <div className="td-agent-name-row">
                      <span className="td-agent-dot" style={{ marginRight: 6 }} />
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
                  </>
                )}
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
        currentCustomerId={apiTrip?.customers?.[0]?.customer_id ?? null}
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
    </div>
  );
}
