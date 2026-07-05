// ── AppContext ──────────────────────────────────────────────
// Global application state context providing modal visibility flags, trip builder data,
// financial data, channel connection flow, notifications, and various getters for mock data.
// All state is managed via useState/useCallback with useMemo for the context value.
//
// This context predates the real backend integration, so it still carries two kinds of
// data side by side:
//  - UI-only state (which modal is open, which builder tab is active, toast messages, the
//    billing/onboarding view toggles) — all real, all actively used.
//  - "getXxxData()" getters that return mock data from constants/app.ts for screens that
//    haven't been wired to the real API (financials stats, team/roles, guides, onboarding
//    tasks, ...). Several of these are now dead code because the pages that used to call
//    them were rewired to fetch real data directly instead — each is flagged as orphaned
//    (or not) in its own comment below and in constants/app.ts.
// Trips are the one area that's partially transitioned: getTripsData()/getTripDetail() still
// return mock TripItem/TripDetailData shapes, but fetchTripsList()/fetchTripDetail() below
// fetch real trips and adapt them into those same shapes (see apiTripToTripDetail() etc.),
// so the same UI components can render either source without knowing which one it's getting.

import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { ApiService } from '../services/api-service';
import type {
  BuilderTab, BillingPeriod, ConnectStep, SettingsTab,
  Day, DayBlock, TripItem, TripDetailData, Conversation,
  FinStat, ChartBar, InvoiceItem, InvoiceDetail,
  Plan, TravelerItem, TeamMember, RoleDef, Channel, NotifSetting,
  OnboardingTask, GuideCard, GuideArticle, StatusBanner, Flight, Stay, Activity,
  CallLog, CallDetail, AgentFeedItem, TripStatus,
  TripResponse, ItineraryResponse,
} from '../types/app';
import {
  convoData, tripsData, tripDetailData, agentFeed,
  flightsData, staysData, activitiesData, callLogs,
  finStats, chartData, invoicesData, plansData,
  travelersData, teamMembers, rolesData, channelsData,
  notifDefaults, notificationsData, onboardTasks,
  guidesData, connectChannelView,
} from '../constants/app';

// Derives the colored "status banner" (the headline strip above the itinerary builder) from
// a mock TripDetailData's status. Only used for mock/non-API trips — apiTripToStatusBanner()
// below is the equivalent for real trips.
export function computeStatusBanner(td: TripDetailData): StatusBanner {
  const s = td.status;
  const base = {
    showRefs: false, refs: [] as { label: string; value: string }[],
    showBuilder: false, showDraft: false, showDrafting: false, showOptions: false,
  };
  if (s === 'Draft') {
    return {
      bg: '#F4F7FF', border: '#C4D2FF', fg: '#2B63F6', iconBg: '#EAF0FF', icon: '✦',
      headline: 'Trip saved as draft',
      desc: 'When you\'re ready, generate itinerary options to share with your traveler.',
      descColor: '#5B6172', chipBorder: '#C4D2FF',
      ...base, showDraft: true, showBuilder: true,
    };
  }
  if (s === 'AI drafting') {
    return {
      bg: '#F4F7FF', border: '#C4D2FF', fg: '#2B63F6', iconBg: '#EAF0FF', icon: '✦',
      headline: 'Meridian is drafting your itinerary',
      desc: 'Processing your brief against flights, stays and experiences.',
      descColor: '#5B6172', chipBorder: '#C4D2FF',
      ...base, showDrafting: true,
    };
  }
  if (s === 'Awaiting review') {
    return {
      bg: '#F4F7FF', border: '#C4D2FF', fg: '#2B63F6', iconBg: '#EAF0FF', icon: '✦',
      headline: '3 itinerary options ready for review',
      desc: 'Review them, pick one, and share with your traveler.',
      descColor: '#5B6172', chipBorder: '#C4D2FF',
      ...base, showOptions: true, showBuilder: true,
    };
  }
  if (s === 'Shared') {
    return {
      bg: '#F0EBFF', border: '#D4C4F0', fg: '#6B46C1', iconBg: '#F0EBFF', icon: '✈️',
      headline: 'Shared with traveler — awaiting decision',
      desc: 'You\'ll be notified when they accept or request changes.',
      descColor: '#5B6172', chipBorder: '#D4C4F0',
      ...base, showOptions: true, showBuilder: true,
    };
  }
  if (s === 'Changes requested') {
    return {
      bg: '#FDECEC', border: '#F4C4C4', fg: '#D64545', iconBg: '#FDECEC', icon: '✏️',
      headline: 'Traveler requested changes',
      desc: td.requestNote || 'Your traveler has asked for some changes.',
      descColor: '#8A90A2', chipBorder: '#F4C4C4',
      ...base, showOptions: true, showBuilder: true,
    };
  }
  if (s === 'Confirmed') {
    return {
      bg: '#E3F7EF', border: '#B8E6D4', fg: '#0E9F6E', iconBg: '#E3F7EF', icon: '✓',
      headline: 'Trip confirmed — awaiting deposit',
      desc: td.depositInfo ? `Deposit required: ${td.depositInfo}` : 'Send the deposit link to secure bookings.',
      descColor: '#5B6172', chipBorder: '#B8E6D4',
      ...base, showOptions: true,
    };
  }
  if (s === 'Booked') {
    // `...base` must come before the explicit overrides (showRefs/refs) so those aren't
    // reset back to false/[] — matches the order every other branch above uses.
    return {
      bg: '#16143A', border: '#2D2B5E', fg: '#FFFFFF', iconBg: '#2D2B5E', icon: '✓',
      headline: 'All booked and confirmed',
      desc: td.depart ? `Departs ${td.depart}. Trip pack ready.` : 'Everything is confirmed and ready to go.',
      descColor: '#AEB3C2', chipBorder: '#2D2B5E',
      ...base, showOptions: true, showRefs: true, refs: td.bookingRefs || [],
    };
  }
  return {
    bg: '#EEF0F4', border: '#DDE0E8', fg: '#5B6172', iconBg: '#EEF0F4', icon: '•',
    headline: s, desc: '', descColor: '#8A90A2', chipBorder: '#DDE0E8',
    ...base,
  };
}

// ── API → Frontend transformers ──
// Everything in this section adapts real backend response shapes (TripResponse,
// ItineraryResponse and friends) into the same UI view-model shapes (Day, Flight, Stay,
// TripDetailData, StatusBanner) that the mock data in constants/app.ts already produces —
// so components like TripDetail.tsx can render either a real or a mock trip identically.

const blockKindMeta: Record<string, { icon: string; iconBg: string; kindColor: string }> = {
  Flight: { icon: '✈️', iconBg: '#EAF0FF', kindColor: '#2B63F6' },
  Transfer: { icon: '🚐', iconBg: '#E3F7EF', kindColor: '#0E9F6E' },
  Stay: { icon: '🏨', iconBg: '#F0EBFF', kindColor: '#6B46C1' },
  Dining: { icon: '🍽️', iconBg: '#FFF3E0', kindColor: '#B7791F' },
  Activity: { icon: '⭐', iconBg: '#E3F7EF', kindColor: '#0E9F6E' },
  Venue: { icon: '🏢', iconBg: '#EAF0FF', kindColor: '#2B63F6' },
};

// One itinerary day's linked destinations + free-text location become the list of DayBlocks
// (the little cards under each day in the itinerary builder). Every destination is rendered
// as an "Activity" block (the backend doesn't distinguish flight/stay/dining kinds for
// day-destinations — those come from the separate itinerary_flights/itinerary_accommodation
// arrays instead, handled by itineraryFlightsToFlights()/itineraryStaysToStays() below).
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

// Converts a real itinerary's day list into the mock-shaped Day[] the builder UI expects
// (day-of-week/day-number/month split out of the ISO date for the calendar-style day column).
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

// Real TripStatus enum values (from the backend) mapped to a display label + colors/gradient.
// This is the single source of truth for "what does `planning` look like in the UI" — shared
// logic duplicated (not imported) in TripDetail.tsx and Trips.tsx as their own local copies.
const apiStatusMeta: Record<string, { display: string; bg: string; fg: string; gradient: string }> = {
  planning:    { display: 'Draft',           bg: '#EEF0F4', fg: '#5B6172', gradient: 'linear-gradient(135deg,#334155,#7889A6)' },
  inquiry:     { display: 'Inquiry',         bg: '#FFF3E0', fg: '#B7791F', gradient: 'linear-gradient(135deg,#E08A2B,#F5C06B)' },
  booked:      { display: 'Booked',          bg: '#16143A', fg: '#FFFFFF', gradient: 'linear-gradient(135deg,#15803D,#5DBE7E)' },
  in_progress: { display: 'In Progress',     bg: '#E3F7EF', fg: '#0E9F6E', gradient: 'linear-gradient(135deg,#0E7C8F,#36C5C0)' },
  completed:   { display: 'Completed',       bg: '#EAF0FF', fg: '#2B63F6', gradient: 'linear-gradient(135deg,#1B5BBE,#5AA0FF)' },
  cancelled:   { display: 'Cancelled',       bg: '#FDECEC', fg: '#D64545', gradient: 'linear-gradient(135deg,#C2410C,#F59E5B)' },
};

// "4 Oct" for a single day, "4 Oct – 14 Oct 2026" for a range, "TBD" if there's no start date.
function fmtDateRange(start: string | null, end: string | null): string {
  if (!start) return 'TBD';
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (!e || s.getTime() === e.getTime()) return s.toLocaleDateString('en-US', opts);
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

// Builds a TripDetailData for a real trip by starting from a mock `fallback` (so all the
// still-mock-only fields like brief/briefChips/costs keep rendering something) and
// overwriting the fields we actually have real data for. `opt` picks which of the trip's
// itineraries (by A/B/C/D/E letter -> array index) to pull days from.
function apiTripToTripDetail(apiTrip: TripResponse, opt: string, fallback: TripDetailData): TripDetailData {
  const sm = apiStatusMeta[apiTrip.status] ?? { display: apiTrip.status, bg: '#EEF0F4', fg: '#5B6172', gradient: 'linear-gradient(135deg,#334155,#7889A6)' };
  const trav = apiTrip.customers?.[0]
    ? `${apiTrip.customers[0].first_name} ${apiTrip.customers[0].last_name}`
    : (typeof apiTrip.created_by === 'object' && apiTrip.created_by
      ? apiTrip.created_by.display_name
      : 'Traveler');
  const idx = ['A', 'B', 'C', 'D', 'E'].indexOf(opt);
  const itin = apiTrip.itineraries?.[idx >= 0 && idx < (apiTrip.itineraries?.length ?? 0) ? idx : 0] ?? null;
  const days = itin?.itinerary_days?.length ? itineraryDaysToDays(itin.itinerary_days) : fallback.days;
  return {
    ...fallback,
    name: apiTrip.trip_name,
    traveler: trav,
    dates: fmtDateRange(apiTrip.start_date, apiTrip.end_date),
    where: apiTrip.description?.split('.')[0] ?? apiTrip.trip_name,
    value: apiTrip.budget ? `GHS ${Number(apiTrip.budget).toLocaleString()}` : fallback.value,
    status: sm.display as TripStatus,
    statusBg: sm.bg,
    statusFg: sm.fg,
    gradient: sm.gradient,
    origin: apiTrip.customers?.[0]?.last_name ?? 'Traveler',
    days,
  };
}

// Real-trip equivalent of computeStatusBanner() above. Simpler than the mock version since
// a real trip only has two states worth distinguishing here: itineraries generated or not.
function apiTripToStatusBanner(apiTrip: TripResponse): StatusBanner {
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
}

// Everything exposed by useApp(). Grouped below (both here and in the provider) by feature:
// create-trip modal, generate-itinerary modal, itinerary builder (mock editing), connect-
// channel modal, invoice modal, billing/onboarding view toggles, notifications, then the
// data getters. See the top-of-file comment for the mock-vs-real split among the getters.
export interface AppContextType {
  createOpen: boolean;
  createStep: number;
  createFromConvo: string | null;
  createdTripId: string | null;
  genItinOpen: boolean;
  connectOpen: boolean;
  connectChannel: string | null;
  connectStep: ConnectStep;
  openInvoice: string | null;
  toast: string | null;
  toastAction: (m: string) => void;
  activeOption: string;
  builderTab: BuilderTab;
  activeCall: number;
  onboarded: boolean;
  billing: BillingPeriod;
  itinDays: Day[] | null;
  genState: string | null;
  notifs: Record<string, boolean>;

  invoiceOpen: boolean;
  billMoBg: string;
  billMoFg: string;
  billYrBg: string;
  billYrFg: string;
  obNewBg: string;
  obNewFg: string;
  obEstBg: string;
  obEstFg: string;
  ccView: string | null;
  ccPickList: boolean;
  ccPick: boolean;
  ccAuth: boolean;
  ccSync: boolean;
  ccDone: boolean;

  setActiveOption: (letter: string) => void;
  setBuilderTab: (tab: BuilderTab) => void;
  setActiveCall: (idx: number) => void;
  removeBlock: (di: number, bi: number) => void;
  addBlock: (di: number) => void;
  addSuggestion: (di: number) => void;
  addActivity: (ac: { name: string; meta: string; price: string }) => void;
  generateOptions: () => void;
  revealOptions: () => void;
  getDays: (tripId?: number | string, opt?: string) => Day[];
  cloneDays: (tripId?: number | string, opt?: string) => Day[];
  resetTripState: () => void;

  openGenItin: () => void;
  closeGenItin: () => void;
  openCreate: () => void;
  closeCreate: () => void;
  startSearch: (trip_id : string) => void;
  openConnect: () => void;
  closeConnect: () => void;
  pickChannel: (n: string) => void;
  connectGo: () => void;
  finishConnect: () => void;
  closeInvoice: () => void;
  recordPayment: () => void;
  sendReminder: () => void;
  downloadInvoice: () => void;
  createTripFromConvo: (convoName?: string) => void;

  setNewUser: () => void;
  setEstablished: () => void;
  setMonthly: () => void;
  setAnnual: () => void;
  inviteTeammate: () => void;
  addSeats: () => void;
  saveSettings: () => void;
  toggleNotif: (k: string) => void;
  stop: (e: React.MouseEvent) => void;

  getTripsData: () => TripItem[];
  fetchTripsList: () => Promise<void>;
  getTripDetail: (tripId: number | string, opt?: string) => { td: TripDetailData; tb: StatusBanner };
  fetchTripDetail: (tripId: string, opt?: string) => Promise<{ td: TripDetailData; tb: StatusBanner }>;
  getConversations: () => Conversation[];
  getFinancialData: () => { finStats: FinStat[]; chart: ChartBar[]; invoices: InvoiceItem[] };
  getInvoiceDetail: (invId: string) => InvoiceDetail | null;
  getPlans: () => Plan[];
  getTravelersData: () => TravelerItem[];
  getGuideList: () => { guideCards: GuideCard[]; worksCards: GuideCard[]; featured: GuideCard };
  getGuideArticle: (guideId: string) => GuideArticle;
  getOnboardTasks: () => OnboardingTask[];
  getTeamData: () => { team: TeamMember[]; roles: RoleDef[]; channels: Channel[]; notifSettings: NotifSetting[]; seatsUsed: number; seatsTotal: number };
  getDashboardStats: () => FinStat[];
  getAgentFeed: () => AgentFeedItem[];
  getFlights: () => Flight[];
  getStays: () => Stay[];
  getActivities: () => Activity[];
  getCallLogs: () => { calls: CallLog[]; callDetails: CallDetail[] };
  getSettingsTabs: () => { key: SettingsTab; label: string }[];
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // CreateTripModal: create-a-trip flow (createOpen/createStep) and the "from a conversation"
  // shortcut (createFromConvo). createdTripId holds the trip just created while step 2/3 of
  // the modal show its (currently simulated) generation progress.
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [createFromConvo, setCreateFromConvo] = useState<string | null>(null);
  const [createdTripId, setCreatedTripId] = useState<string | null>(null);
  // GenerateItineraryModal visibility.
  const [genItinOpen, setGenItinOpen] = useState(false);
  // TripDetail builder: which itinerary option letter (A/B/C/...) and which tab
  // (itinerary/flights/stays/activities/calls) is currently shown, plus which call log row
  // is selected in the Calls tab.
  const [activeOption, setActiveOption] = useState('A');
  const [builderTab, setBuilderTab] = useState<BuilderTab>('itinerary');
  const [activeCall, setActiveCall] = useState(0);
  // Dashboard "New user view" vs "Established view" toggle, and Pricing page monthly/annual
  // billing toggle.
  const [onboarded, setOnboarded] = useState(false);
  const [billing, setBilling] = useState<BillingPeriod>('monthly');
  // ConnectChannelModal (WhatsApp/Gmail/Instagram connect flow) state.
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectChannel, setConnectChannel] = useState<string | null>(null);
  const [connectStep, setConnectStep] = useState<ConnectStep>('pick');
  // InvoiceDetailModal: which invoice id (if any) is currently open.
  const [openInvoice, setOpenInvoice] = useState<string | null>(null);
  // Toast.tsx reads this to show/hide the bottom toast message.
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  // Locally-edited copy of the current mock trip's Day[] once the user starts adding/removing
  // blocks in the builder (see getDaysFn/cloneDaysFn below) — null means "not edited yet, use
  // the pristine mock/API data". genState drives the fake "drafting -> done" mock generation
  // animation (see generateOptions()/revealOptions() below).
  const [itinDays, setItinDays] = useState<Day[] | null>(null);
  const [genState, setGenState] = useState<string | null>(null);
  // Settings > Notifications toggle state (see notifDefaults() in constants/app.ts — this
  // whole path is orphaned since Settings.tsx's real Notifications tab keeps its own state).
  const [notifs, setNotifs] = useState<Record<string, boolean>>(notifDefaults());
  // Cache of real trips, keyed by trip_id, so getDaysFn/getTripDetail can synchronously look
  // up a previously-fetched trip without needing to be async themselves (they're called
  // during render). In practice this is only ever populated by fetchTripDetail() below,
  // which nothing in the app currently calls — so today this cache stays empty and
  // getDaysFn/getTripDetail's "cached" branches never actually hit for real trips; TripDetail.tsx
  // manages its own separate `apiTrip` state via ApiService.getTrip() instead of using this.
  const [apiTripCache, setApiTripCache] = useState<Record<string, TripResponse>>({});

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shows a message for 2.8s, restarting the timer if called again before it clears.
  const toastAction = useCallback((m: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(m);
    toastTimer.current = setTimeout(() => {
      setToastMsg(null);
      toastTimer.current = null;
    }, 2800);
  }, []);

  // Fake "AI drafting" delay for MOCK trips only (2.6s timeout, no network call) — this is
  // what TripDetail.tsx's brief-page "Generate 3 itinerary options" button triggers when
  // there's no real apiTrip loaded. For real trips, TripDetail.tsx instead calls
  // ApiService.generateItinerary() directly and shows its own `generatingItinerary` loading
  // state, bypassing this entirely.
  const generateOptions = useCallback(() => {
    setGenState('drafting');
    setTimeout(() => setGenState('done'), 2600);
  }, []);

  // "Skip & preview" button during the fake drafting animation above — jumps straight to done.
  const revealOptions = useCallback(() => {
    setGenState('done');
  }, []);

  // Resolves the Day[] to render for the itinerary builder tab, in priority order:
  // 1) a locally-edited copy (itinDays) if the user has already added/removed a block,
  // 2) for real (non-numeric) trip ids, days pulled from a previously-fetched apiTripCache
  //    entry — or [] if that trip hasn't been fetched/has no days yet,
  // 3) otherwise, the mock tripDetailData() days for the given numeric trip index.
  const getDaysFn = useCallback((tripId?: number | string, opt?: string): Day[] => {
    if (itinDays) return itinDays;
    const o = opt ?? 'A';

    if (tripId && typeof tripId === 'string' && !/^\d+$/.test(tripId)) {
      const cached = apiTripCache[tripId];
      if (cached?.itineraries && cached.itineraries.length > 0) {
        const idx = ['A', 'B', 'C', 'D', 'E'].indexOf(o);
        const itin = cached.itineraries[idx >= 0 && idx < cached.itineraries.length ? idx : 0];
        if (itin?.itinerary_days?.length) {
          return itineraryDaysToDays(itin.itinerary_days);
        }
      }
      return [];
    }

    const id = typeof tripId === 'number' ? tripId : (tripId ? parseInt(tripId, 10) : 0);
    return tripDetailData(id, o).days;
  }, [itinDays, apiTripCache]);

  // Deep-clones the current days (via JSON round-trip, so it's safe to mutate the result)
  // before every mock-only edit below (removeBlock/addBlock/addSuggestion/addActivity),
  // since React state must be replaced, not mutated in place.
  const cloneDaysFn = useCallback((tripId?: number | string, opt?: string): Day[] => {
    return JSON.parse(JSON.stringify(getDaysFn(tripId, opt)));
  }, [getDaysFn]);

  // Mock-only itinerary editing (no backend call) — removes one block from one day.
  // Real trips are edited via TripDetail.tsx's own handlers that call ApiService directly
  // (removeItineraryDay, removeFlight, etc.) instead of going through this.
  const removeBlock = useCallback((di: number, bi: number) => {
    const nd = cloneDaysFn();
    if (nd[di]?.blocks) nd[di].blocks.splice(bi, 1);
    setItinDays(nd);
  }, [cloneDaysFn]);

  const addBlock = useCallback((di: number) => {
    const nd = cloneDaysFn();
    nd[di]?.blocks.push({
      kind: 'Activity', kindColor: '#0E9F6E', icon: '⭐', iconBg: '#E3F7EF',
      meta: '', title: 'New activity', sub: '', price: '',
    });
    setItinDays(nd);
  }, [cloneDaysFn]);

  const addSuggestion = useCallback((di: number) => {
    const nd = cloneDaysFn();
    const day = nd[di];
    if (day?.hasSuggestion && day.suggestion) {
      day.blocks.push({
        kind: 'Activity', kindColor: '#0E9F6E', icon: '⭐', iconBg: '#E3F7EF',
        meta: 'Suggested', title: day.suggestion, sub: 'AI-suggested addition', price: '',
      });
      day.hasSuggestion = false;
      delete day.suggestion;
    }
    setItinDays(nd);
  }, [cloneDaysFn]);

  const addActivity = useCallback((ac: { name: string; meta: string; price: string }) => {
    const nd = cloneDaysFn();
    const last = nd[nd.length - 1];
    if (last) {
      last.blocks.push({
        kind: 'Activity', kindColor: '#0E9F6E', icon: '⭐', iconBg: '#E3F7EF',
        meta: ac.meta, title: ac.name, sub: '', price: ac.price,
      });
    }
    setItinDays(nd);
    setBuilderTab('itinerary');
  }, [cloneDaysFn]);

  // Clears the mock edit/generation state — called when navigating away from a trip so the
  // next one visited doesn't inherit stale itinDays/genState/builderTab/activeOption.
  const resetTripState = useCallback(() => {
    setItinDays(null);
    setGenState(null);
    setBuilderTab('itinerary');
    setActiveOption('A');
  }, []);

  const createTripFromConvo = useCallback((convoName?: string) => {
    setCreateOpen(true);
    setCreateFromConvo(convoName ?? '');
  }, []);

  const openGenItin = useCallback(() => setGenItinOpen(true), []);
  const closeGenItin = useCallback(() => setGenItinOpen(false), []);

  const openCreate = useCallback(() => {
    setCreateOpen(true);
    setCreateStep(1);
    setCreateFromConvo(null);
  }, []);

  const closeCreate = useCallback(() => {
    setCreateOpen(false);
    setCreateStep(1);
    setCreateFromConvo(null);
    setCreatedTripId(null);
  }, []);

  const startSearch = useCallback((trip_id: string) => {
    setCreatedTripId(trip_id);
    setCreateStep(2);
    setTimeout(() => setCreateStep(3), 2600);
  }, []);

  const openConnect = useCallback(() => {
    setConnectOpen(true);
    setConnectChannel(null);
    setConnectStep('pick');
  }, []);

  const closeConnect = useCallback(() => {
    setConnectOpen(false);
    setConnectChannel(null);
    setConnectStep('pick');
  }, []);

  const pickChannel = useCallback((n: string) => {
    setConnectChannel(n);
    setConnectStep('auth');
  }, []);

  const connectGo = useCallback(() => {
    setConnectStep('sync');
    setTimeout(() => setConnectStep('done'), 2400);
  }, []);

  const finishConnect = useCallback(() => {
    setConnectOpen(false);
    setConnectChannel(null);
    setConnectStep('pick');
    toastAction('Channel connected');
  }, [toastAction]);

  const closeInvoice = useCallback(() => setOpenInvoice(null), []);
  const recordPayment = useCallback(() => toastAction('Payment recorded'), [toastAction]);
  const sendReminder = useCallback(() => toastAction('Reminder sent'), [toastAction]);
  const downloadInvoice = useCallback(() => toastAction('Downloading invoice…'), [toastAction]);

  const setNewUser = useCallback(() => setOnboarded(false), []);
  const setEstablished = useCallback(() => setOnboarded(true), []);
  const setMonthly = useCallback(() => setBilling('monthly'), []);
  const setAnnual = useCallback(() => setBilling('annual'), []);
  const inviteTeammate = useCallback(() => toastAction('Invite link copied'), [toastAction]);
  const addSeats = useCallback(() => toastAction('Added seats'), [toastAction]);
  const saveSettings = useCallback(() => toastAction('Settings saved'), [toastAction]);

  const stop = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const toggleNotif = useCallback((k: string) => {
    setNotifs(prev => ({ ...prev, [k]: !prev[k] }));
  }, []);

  const invoiceOpen = openInvoice !== null;

  const [billMoBg, billMoFg, billYrBg, billYrFg] = useMemo((): [string, string, string, string] => {
    if (billing === 'monthly') return ['#2B63F6', '#fff', '#EEF0F4', '#5B6172'];
    return ['#EEF0F4', '#5B6172', '#2B63F6', '#fff'];
  }, [billing]);

  const [obNewBg, obNewFg, obEstBg, obEstFg] = useMemo((): [string, string, string, string] => {
    if (!onboarded) return ['#2B63F6', '#fff', '#EEF0F4', '#5B6172'];
    return ['#EEF0F4', '#5B6172', '#2B63F6', '#fff'];
  }, [onboarded]);

  const ccView = useMemo(() => {
    if (!connectOpen) return null;
    const cv = connectChannelView(connectChannel);
    return cv?.short ?? null;
  }, [connectOpen, connectChannel]);

  const ccPickList = connectOpen && connectStep === 'pick' && !connectChannel;
  const ccPick = connectOpen && connectStep === 'pick' && !!connectChannel;
  const ccAuth = connectOpen && connectStep === 'auth';
  const ccSync = connectOpen && connectStep === 'sync';
  const ccDone = connectOpen && connectStep === 'done';

  // Once fetchTripsList() below successfully loads real trips, this cache permanently
  // replaces the mock tripsData() for the rest of the session (there's no way to go back to
  // mock trips once real ones have loaded, short of a page refresh).
  const [tripsDataCache, setTripsDataCache] = useState<TripItem[] | null>(null);

  const getTripsData = useCallback((): TripItem[] => {
    return tripsDataCache ?? tripsData();
  }, [tripsDataCache]);

  // Fetches real trips and reshapes each into the mock TripItem shape, so existing
  // components that render getTripsData() don't need separate real/mock rendering paths.
  // Silently keeps showing mock data if the request fails (e.g. not logged in yet).
  const fetchTripsList = useCallback(async () => {
    try {
      const result = await ApiService.getTrips();
      const items: TripItem[] = result.data.map(t => {
        const trav = t.customers?.[0]
          ? `${t.customers[0].first_name} ${t.customers[0].last_name}`
          : (typeof t.created_by === 'object' && t.created_by ? t.created_by.display_name : 'Traveler');
        const initials = t.customers?.[0]
          ? (t.customers[0].first_name[0] + t.customers[0].last_name[0]).toUpperCase()
          : 'TT';
        const sm = apiStatusMeta[t.status] ?? { display: t.status, bg: '#EEF0F4', fg: '#5B6172', gradient: '' };
        const dates = fmtDateRange(t.start_date, t.end_date);
        return {
          id: t.trip_id,
          name: t.trip_name,
          traveler: trav,
          initials,
          avatarBg: '#2B63F6',
          where: t.description?.split('.')[0] ?? t.trip_name,
          dates,
          status: sm.display as TripStatus,
          statusBg: sm.bg,
          statusFg: sm.fg,
          value: t.budget ? `GHS ${Number(t.budget).toLocaleString()}` : '—',
          optsLabel: (t.itineraries?.length ?? 0) > 1 ? `${t.itineraries!.length} opts` : `${t.itineraries?.length ?? 0} opt`,
          cover: sm.gradient || 'linear-gradient(135deg,#334155,#7889A6)',
          next: '',
          open: () => {},
        };
      });
      setTripsDataCache(items);
    } catch {
      // fall back to mock
    }
  }, []);
  // Synchronous lookup: a real (non-numeric) tripId would return from apiTripCache if
  // something had populated it (see the comment on apiTripCache above — nothing currently
  // does), otherwise falls back to mock data by index 0. A numeric tripId always means mock.
  const getTripDetail = useCallback((tripId: number | string, opt?: string) => {
    const o = opt ?? 'A';

    if (typeof tripId === 'string' && !/^\d+$/.test(tripId)) {
      const cached = apiTripCache[tripId];
      if (cached) {
        const fallback = tripDetailData(0, o);
        const td = apiTripToTripDetail(cached, o, fallback);
        const tb = apiTripToStatusBanner(cached);
        return { td, tb };
      }
      const td = tripDetailData(0, o);
      const tb = computeStatusBanner(td);
      return { td, tb };
    }

    const id = typeof tripId === 'number' ? tripId : parseInt(tripId, 10);
    const td = tripDetailData(id, o);
    const tb = computeStatusBanner(td);
    return { td, tb };
  }, [apiTripCache]);
  // Would fetch a real trip and populate apiTripCache so subsequent getTripDetail()/
  // getDaysFn() calls for the same tripId could resolve synchronously — but nothing in the
  // app currently calls this (grep confirms zero callers outside this file). TripDetail.tsx
  // manages its own separate `apiTrip` state via ApiService.getTrip() directly instead.
  // Orphaned; kept in the exposed context API in case a future screen wants the mock-shaped
  // {td, tb} result without duplicating apiTripToTripDetail()/apiTripToStatusBanner().
  const fetchTripDetail = useCallback(async (tripId: string, opt?: string) => {
    const o = opt ?? 'A';
    const apiTrip = await ApiService.getTrip(tripId);
    setApiTripCache(prev => ({ ...prev, [tripId]: apiTrip }));
    const fallback = tripDetailData(0, o);
    const td = apiTripToTripDetail(apiTrip, o, fallback);
    const tb = apiTripToStatusBanner(apiTrip);
    return { td, tb };
  }, []);
  // Thin wrappers around the constants/app.ts mock-data generators — see that file's
  // per-function comments for which of these are actually rendered anywhere vs orphaned.
  const getConversations = useCallback(() => convoData(), []);
  const getFinancialData = useCallback(() => {
    const { list } = invoicesData();
    return { finStats: finStats(), chart: chartData(), invoices: list };
  }, []);
  const getInvoiceDetail = useCallback((invId: string) => {
    const { detail } = invoicesData();
    return detail(invId);
  }, []);
  const getPlans = useCallback(() => plansData(billing, 'Growth', toastAction), [billing, toastAction]);
  const getTravelersData = useCallback(() => travelersData(), []);
  const getGuideList = useCallback(() => {
    const { cards, worksCards, featured } = guidesData(() => {});
    return { guideCards: cards, worksCards, featured };
  }, []);
  const getGuideArticle = useCallback((guideId: string) => {
    return guidesData(() => {}).article(guideId);
  }, []);
  const getOnboardTasks = useCallback(() => onboardTasks(openGenItin), [openGenItin]);
  const getTeamData = useCallback(() => {
    const tm = teamMembers();
    const rd = rolesData();
    const cd = channelsData(toastAction, openConnect);
    const nd = notificationsData(notifs, toggleNotif);
    const seatsUsed = rd.reduce((sum, r) => sum + (r.name === 'Super admin' || r.name === 'Agent' || r.name === 'Finance' ? r.count : 0), 0);
    return { team: tm, roles: rd, channels: cd, notifSettings: nd, seatsUsed, seatsTotal: 5 };
  }, [toastAction, openConnect, notifs, toggleNotif]);
  const getDashboardStats = useCallback(() => finStats(), []);
  const getAgentFeed = useCallback(() => agentFeed(), []);
  const getFlights = useCallback(() => flightsData(), []);
  const getStays = useCallback(() => staysData(), []);
  const getActivities = useCallback(() => activitiesData(), []);
  const getCallLogs = useCallback(() => {
    const { logs, details } = callLogs();
    return { calls: logs, callDetails: details };
  }, []);
  const getSettingsTabs = useCallback(() => {
    return [
      { key: 'profile' as SettingsTab, label: 'Profile' },
      { key: 'workspace' as SettingsTab, label: 'Workspace' },
      { key: 'team' as SettingsTab, label: 'Team' },
      { key: 'roles' as SettingsTab, label: 'Roles' },
      { key: 'channels' as SettingsTab, label: 'Channels' },
      { key: 'notifications' as SettingsTab, label: 'Notifications' },
    ];
  }, []);

  const ctx = useMemo<AppContextType>(() => ({
    createOpen, createStep, createFromConvo, createdTripId, genItinOpen,
    connectOpen, connectChannel, connectStep,
    openInvoice, toast: toastMsg,
    activeOption, builderTab, activeCall,
    onboarded, billing, itinDays, genState, notifs,

    invoiceOpen,
    billMoBg, billMoFg, billYrBg, billYrFg,
    obNewBg, obNewFg, obEstBg, obEstFg,
    ccView, ccPickList, ccPick, ccAuth, ccSync, ccDone,

    setActiveOption, setBuilderTab, setActiveCall,
    removeBlock, addBlock, addSuggestion, addActivity,
    generateOptions, revealOptions,
    getDays: getDaysFn, cloneDays: cloneDaysFn,
    resetTripState,

    openGenItin, closeGenItin, openCreate, closeCreate, startSearch,
    openConnect, closeConnect, pickChannel, connectGo, finishConnect,
    closeInvoice, recordPayment, sendReminder, downloadInvoice,
    createTripFromConvo,

    setNewUser, setEstablished, setMonthly, setAnnual,
    inviteTeammate, addSeats, saveSettings, toggleNotif, stop,
    toastAction: toastAction,

    getTripsData, fetchTripsList, getTripDetail, fetchTripDetail, getConversations,
    getFinancialData, getInvoiceDetail, getPlans,
    getTravelersData, getGuideList, getGuideArticle,
    getOnboardTasks, getTeamData,
    getDashboardStats, getAgentFeed,
    getFlights, getStays, getActivities, getCallLogs, getSettingsTabs,
  }), [
    createOpen, createStep, createFromConvo, createdTripId, genItinOpen,
    connectOpen, connectChannel, connectStep,
    openInvoice, toastMsg,
    activeOption, builderTab, activeCall,
    onboarded, billing, itinDays, genState, notifs,
    invoiceOpen,
    billMoBg, billMoFg, billYrBg, billYrFg,
    obNewBg, obNewFg, obEstBg, obEstFg,
    ccView, ccPickList, ccPick, ccAuth, ccSync, ccDone,
    setActiveOption, setBuilderTab, setActiveCall,
    removeBlock, addBlock, addSuggestion, addActivity,
    generateOptions, revealOptions,
    getDaysFn, cloneDaysFn, resetTripState,
    openGenItin, closeGenItin, openCreate, closeCreate, startSearch,
    openConnect, closeConnect, pickChannel, connectGo, finishConnect,
    closeInvoice, recordPayment, sendReminder, downloadInvoice,
    createTripFromConvo,
    setNewUser, setEstablished, setMonthly, setAnnual,
    inviteTeammate, addSeats, saveSettings, toggleNotif, stop,
    toastAction,
    getTripsData, fetchTripsList, getTripDetail, fetchTripDetail, getConversations,
    getFinancialData, getInvoiceDetail, getPlans,
    getTravelersData, getGuideList, getGuideArticle,
    getOnboardTasks, getTeamData,
    getDashboardStats, getAgentFeed,
    getFlights, getStays, getActivities, getCallLogs, getSettingsTabs,
  ]);

  return (
    <AppContext.Provider value={ctx}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp() must be used within an AppProvider');
  return ctx;
}

export { AppContext };
