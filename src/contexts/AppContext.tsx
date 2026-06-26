import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import type {
  BuilderTab, BillingPeriod, ConnectStep, SettingsTab,
  Day, TripItem, TripDetailData, Conversation,
  FinStat, ChartBar, InvoiceItem, InvoiceDetail,
  Plan, TravelerItem, TeamMember, RoleDef, Channel, NotifSetting,
  OnboardingTask, GuideCard, GuideArticle, StatusBanner, Flight, Stay, Activity,
  CallLog, CallDetail, AgentFeedItem,
} from '../types/app';
import {
  convoData, tripsData, tripDetailData, agentFeed,
  flightsData, staysData, activitiesData, callLogs,
  finStats, chartData, invoicesData, plansData,
  travelersData, teamMembers, rolesData, channelsData,
  notifDefaults, notificationsData, onboardTasks,
  guidesData, connectChannelView,
} from '../constants/app';

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
    return {
      bg: '#16143A', border: '#2D2B5E', fg: '#FFFFFF', iconBg: '#2D2B5E', icon: '✓',
      headline: 'All booked and confirmed',
      desc: td.depart ? `Departs ${td.depart}. Trip pack ready.` : 'Everything is confirmed and ready to go.',
      descColor: '#AEB3C2', chipBorder: '#2D2B5E',
      showRefs: true, refs: td.bookingRefs || [],
      ...base, showOptions: true,
    };
  }
  return {
    bg: '#EEF0F4', border: '#DDE0E8', fg: '#5B6172', iconBg: '#EEF0F4', icon: '•',
    headline: s, desc: '', descColor: '#8A90A2', chipBorder: '#DDE0E8',
    ...base,
  };
}

export interface AppContextType {
  createOpen: boolean;
  createStep: number;
  createFromConvo: string | null;
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
  getDays: (tripId?: number, opt?: string) => Day[];
  cloneDays: (tripId?: number, opt?: string) => Day[];
  resetTripState: () => void;

  openGenItin: () => void;
  closeGenItin: () => void;
  openCreate: () => void;
  closeCreate: () => void;
  startSearch: () => void;
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
  getTripDetail: (tripId: number, opt?: string) => { td: TripDetailData; tb: StatusBanner };
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
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [createFromConvo, setCreateFromConvo] = useState<string | null>(null);
  const [genItinOpen, setGenItinOpen] = useState(false);
  const [activeOption, setActiveOption] = useState('A');
  const [builderTab, setBuilderTab] = useState<BuilderTab>('itinerary');
  const [activeCall, setActiveCall] = useState(0);
  const [onboarded, setOnboarded] = useState(false);
  const [billing, setBilling] = useState<BillingPeriod>('monthly');
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectChannel, setConnectChannel] = useState<string | null>(null);
  const [connectStep, setConnectStep] = useState<ConnectStep>('pick');
  const [openInvoice, setOpenInvoice] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [itinDays, setItinDays] = useState<Day[] | null>(null);
  const [genState, setGenState] = useState<string | null>(null);
  const [notifs, setNotifs] = useState<Record<string, boolean>>(notifDefaults());

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toastAction = useCallback((m: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(m);
    toastTimer.current = setTimeout(() => {
      setToastMsg(null);
      toastTimer.current = null;
    }, 2800);
  }, []);

  const generateOptions = useCallback(() => {
    setGenState('drafting');
    setTimeout(() => setGenState('done'), 2600);
  }, []);

  const revealOptions = useCallback(() => {
    setGenState('done');
  }, []);

  const getDaysFn = useCallback((tripId?: number, opt?: string): Day[] => {
    if (itinDays) return itinDays;
    const id = tripId ?? 0;
    const o = opt ?? 'A';
    return tripDetailData(id, o).days;
  }, [itinDays]);

  const cloneDaysFn = useCallback((tripId?: number, opt?: string): Day[] => {
    return JSON.parse(JSON.stringify(getDaysFn(tripId, opt)));
  }, [getDaysFn]);

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
  }, []);

  const startSearch = useCallback(() => {
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

  const getTripsData = useCallback(() => tripsData(), []);
  const getTripDetail = useCallback((tripId: number, opt?: string) => {
    const o = opt ?? 'A';
    const td = tripDetailData(tripId, o);
    const tb = computeStatusBanner(td);
    return { td, tb };
  }, []);
  const getConversations = useCallback(() => convoData(), []);
  const getFinancialData = useCallback(() => {
    const { list, detail } = invoicesData();
    return { finStats: finStats(), chart: chartData(), invoices: list };
  }, []);
  const getInvoiceDetail = useCallback((invId: string) => {
    const { detail } = invoicesData();
    return detail(invId);
  }, []);
  const getPlans = useCallback(() => plansData(billing, 'Growth', toastAction), [billing, toastAction]);
  const getTravelersData = useCallback(() => travelersData(), []);
  const getGuideList = useCallback(() => {
    const { cards, worksCards, featured, article } = guidesData(() => {});
    return { guideCards: cards, worksCards, featured };
  }, []);
  const getGuideArticle = useCallback((guideId: string) => {
    return guidesData(() => {}).article(guideId, []);
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
      { key: 'workspace' as SettingsTab, label: 'Workspace' },
      { key: 'team' as SettingsTab, label: 'Team' },
      { key: 'roles' as SettingsTab, label: 'Roles' },
      { key: 'channels' as SettingsTab, label: 'Channels' },
      { key: 'notifications' as SettingsTab, label: 'Notifications' },
    ];
  }, []);

  const ctx = useMemo<AppContextType>(() => ({
    createOpen, createStep, createFromConvo, genItinOpen,
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

    getTripsData, getTripDetail, getConversations,
    getFinancialData, getInvoiceDetail, getPlans,
    getTravelersData, getGuideList, getGuideArticle,
    getOnboardTasks, getTeamData,
    getDashboardStats, getAgentFeed,
    getFlights, getStays, getActivities, getCallLogs, getSettingsTabs,
  }), [
    createOpen, createStep, createFromConvo, genItinOpen,
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
    getTripsData, getTripDetail, getConversations,
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
