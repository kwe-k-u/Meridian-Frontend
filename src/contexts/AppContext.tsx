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
// Trips are the one area that's partially transitioned: getTripsData() still returns a mock
// TripItem[] shape as its "nothing loaded yet" fallback, but fetchTripsList() below fetches
// real trips and reshapes them into that same TripItem[] shape, so the same UI components can
// render either source without knowing which one it's getting. TripDetail.tsx/TravelerView.tsx
// build their real-trip view models directly from ApiService.getTrip() themselves rather than
// through this context (there is no more mock-trip-detail equivalent here).

import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { ApiService } from '../services/api-service';
import type {
  BuilderTab, BillingPeriod, ConnectStep, SettingsTab,
  Day, TripItem, Conversation,
  Plan, TeamMember, RoleDef, Channel, NotifSetting,
  OnboardingTask, GuideCard, GuideArticle, Flight, Stay, Activity,
  CallLog, CallDetail, AgentFeedItem, TripStatusLabel,
  InvoiceItem, InvoiceDetail,
} from '../types/app';
import {
  convoData, agentFeed, callLogs, plansData,
  teamMembers, rolesData, channelsData,
  notifDefaults, notificationsData, onboardTasks,
  guidesData, connectChannelView, apiStatusMeta,
  invoicesData,
} from '../constants/app';

// "4 Oct" for a single day, "4 Oct – 14 Oct 2026" for a range, "TBD" if there's no start date.
function fmtDateRange(start: string | null, end: string | null): string {
  if (!start) return 'TBD';
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (!e || s.getTime() === e.getTime()) return s.toLocaleDateString('en-US', opts);
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`;
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
  openInvoiceDetail: (invId: string) => void;
  closeInvoice: () => void;
  getInvoices: () => InvoiceItem[];
  getInvoiceDetail: (invId: string) => InvoiceDetail | null;
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
  getConversations: () => Conversation[];
  getPlans: () => Plan[];
  getGuideList: () => { guideCards: GuideCard[]; worksCards: GuideCard[]; featured: GuideCard };
  getGuideArticle: (guideId: string) => GuideArticle;
  getOnboardTasks: () => OnboardingTask[];
  getTeamData: () => { team: TeamMember[]; roles: RoleDef[]; channels: Channel[]; notifSettings: NotifSetting[]; seatsUsed: number; seatsTotal: number };
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

  // Resolves the Day[] to render for the itinerary builder tab: a locally-edited copy
  // (itinDays) if the user has already added/removed a block via the mock-editing helpers
  // below, or [] otherwise — there's no more mock-data source to fall back to; real trips
  // manage their own day data directly via ApiService, not through this.
  const getDaysFn = useCallback((): Day[] => {
    return itinDays ?? [];
  }, [itinDays]);

  // Deep-clones the current days (via JSON round-trip, so it's safe to mutate the result)
  // before every mock-only edit below (removeBlock/addBlock/addSuggestion/addActivity),
  // since React state must be replaced, not mutated in place.
  const cloneDaysFn = useCallback((): Day[] => {
    return JSON.parse(JSON.stringify(getDaysFn()));
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

  const openInvoiceDetail = useCallback((invId: string) => setOpenInvoice(invId), []);
  const closeInvoice = useCallback(() => setOpenInvoice(null), []);
  const getInvoices = useCallback(() => invoicesData().list, []);
  const getInvoiceDetail = useCallback((invId: string) => invoicesData().detail(invId), []);
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

  // Populated once fetchTripsList() below successfully loads real trips; until then,
  // getTripsData() returns [] (there's no more mock trip list to fall back to).
  const [tripsDataCache, setTripsDataCache] = useState<TripItem[] | null>(null);

  const getTripsData = useCallback((): TripItem[] => {
    return tripsDataCache ?? [];
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
          status: sm.display as TripStatusLabel,
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
  // Thin wrappers around the constants/app.ts mock-data generators — see that file's
  // per-function comments for which of these are actually rendered anywhere vs orphaned.
  const getConversations = useCallback(() => convoData(), []);
  const getPlans = useCallback(() => plansData(billing, 'Growth', toastAction), [billing, toastAction]);
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
  const getAgentFeed = useCallback(() => agentFeed(), []);
  // No mock generator backs these anymore — real trips render their own live
  // flights/stays/activities directly from apiTrip; these are just the "nothing loaded yet"
  // empty fallback TripDetail.tsx's mock-trip branch reads.
  const getFlights = useCallback((): Flight[] => [], []);
  const getStays = useCallback((): Stay[] => [], []);
  const getActivities = useCallback((): Activity[] => [], []);
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
    openInvoiceDetail, closeInvoice, getInvoices, getInvoiceDetail,
    recordPayment, sendReminder, downloadInvoice,
    createTripFromConvo,

    setNewUser, setEstablished, setMonthly, setAnnual,
    inviteTeammate, addSeats, saveSettings, toggleNotif, stop,
    toastAction: toastAction,

    getTripsData, fetchTripsList, getConversations,
    getPlans, getGuideList, getGuideArticle,
    getOnboardTasks, getTeamData, getAgentFeed,
    getFlights, getStays, getActivities,
    getCallLogs, getSettingsTabs,
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
    openInvoiceDetail, closeInvoice, getInvoices, getInvoiceDetail,
    recordPayment, sendReminder, downloadInvoice,
    createTripFromConvo,
    setNewUser, setEstablished, setMonthly, setAnnual,
    inviteTeammate, addSeats, saveSettings, toggleNotif, stop,
    toastAction,
    getTripsData, fetchTripsList, getConversations,
    getPlans, getGuideList, getGuideArticle,
    getOnboardTasks, getTeamData, getAgentFeed,
    getFlights, getStays, getActivities,
    getCallLogs, getSettingsTabs,
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
