export type Screen = 'dashboard' | 'trips' | 'tripDetail' | 'messages' | 'travelers' | 'financials' | 'pricing' | 'settings' | 'help' | 'guide';

export type TripStatus = 'Draft' | 'AI drafting' | 'Awaiting review' | 'Shared' | 'Changes requested' | 'Confirmed' | 'Booked' | 'Completed';

export type BuilderTab = 'itinerary' | 'flights' | 'stays' | 'activities' | 'calls';

export type BillingPeriod = 'monthly' | 'annual';

export type ChannelType = 'whatsapp' | 'gmail' | 'instagram';

export type SettingsTab = 'workspace' | 'team' | 'roles' | 'channels' | 'notifications';

export type ConnectStep = 'pick' | 'auth' | 'sync' | 'done';

export type RoleType = 'Super admin' | 'Agent' | 'Finance' | 'Read-only';

export interface DayBlock {
  kind: string;
  kindColor: string;
  icon: string;
  iconBg: string;
  meta: string;
  title: string;
  sub: string;
  price: string;
  remove?: () => void;
}

export interface Day {
  di?: number;
  dow: string;
  day: string;
  mon: string;
  title: string;
  blocks: DayBlock[];
  hasSuggestion?: boolean;
  suggestion?: string;
  addSuggestion?: () => void;
  addBlock?: () => void;
}

export interface CostItem {
  label: string;
  value: string;
}

export interface TripOption {
  letter: string;
  name: string;
  sub: string;
  cover: string;
  rec: boolean;
  recDisplay?: string;
  border?: string;
  bg?: string;
  titleColor?: string;
  onClick?: () => void;
}

export interface TripItem {
  name: string;
  traveler: string;
  initials: string;
  avatarBg: string;
  where: string;
  dates: string;
  status: TripStatus;
  statusBg: string;
  statusFg: string;
  value: string;
  optsLabel: string;
  cover: string;
  next: string;
  open: () => void;
}

export interface TripDetailData {
  name: string;
  traveler: string;
  dates: string;
  where: string;
  value: string;
  status: TripStatus;
  statusBg: string;
  statusFg: string;
  gradient: string;
  origin: string;
  total: string;
  days: Day[];
  costs: CostItem[];
  options: TripOption[];
  optionsLabel: string;
  brief?: string;
  briefChips?: string[];
  sentInfo?: string;
  requestNote?: string;
  depositInfo?: string;
  depart?: string;
  bookingRefs?: { label: string; value: string }[];
  headerActions: HeaderAction[];
}

export interface HeaderAction {
  label: string;
  onClick: () => void;
  bg: string;
  fg: string;
  border: string;
}

export interface StatusBanner {
  bg: string;
  border: string;
  fg: string;
  iconBg: string;
  icon: string;
  headline: string;
  desc: string;
  descColor: string;
  chipBorder: string;
  showRefs: boolean;
  refs: { label: string; value: string }[];
  showBuilder: boolean;
  showDraft: boolean;
  showDrafting: boolean;
  showOptions: boolean;
}

export interface Flight {
  code: string;
  airline: string;
  route: string;
  duration: string;
  stops: string;
  price: string;
  cta: string;
  logoBg: string;
  recDisplay: string;
  border: string;
  bg: string;
}

export interface Stay {
  name: string;
  loc: string;
  rating: string;
  price: string;
  cover: string;
  recDisplay: string;
  border: string;
  bg: string;
  tags: string[];
}

export interface Activity {
  name: string;
  meta: string;
  price: string;
  cover: string;
  add: () => void;
}

export interface CallLog {
  title: string;
  meta: string;
  icon: string;
  onClick: () => void;
  bg: string;
  border: string;
}

export interface CallDetail {
  title: string;
  meta: string;
  summary: string;
  actions: { n: string; text: string }[];
  decisions: string[];
}

export interface Message {
  t: string;
  time: string;
  me: boolean;
  align?: string;
  textAlign?: string;
  bubbleBg?: string;
  bubbleFg?: string;
  bubbleBorder?: string;
}

export interface Conversation {
  name: string;
  ch: string;
  av: string;
  avBg: string;
  last: string;
  time: string;
  unread: number;
  trip: string | null;
  linkName: string | null;
  summary: string;
  msgs: Message[];
  chColor?: string;
  chIcon?: string;
  onClick?: () => void;
  rowBg?: string;
  unreadDisplay?: string;
  hasTrip?: boolean;
  noTrip?: boolean;
  linkLabel?: string;
  tripGradient?: string;
  tripStatus?: string;
  tripStatusBg?: string;
  tripStatusFg?: string;
  tripValue?: string;
  openLinkedTrip?: () => void;
}

export interface FinStat {
  label: string;
  value: string;
  delta: string;
  deltaColor: string;
}

export interface ChartBar {
  label: string;
  h: string;
  value: string;
  barBg: string;
  barLabelColor: string;
}

export interface InvoiceItem {
  id: string;
  client: string;
  trip: string;
  amount: string;
  status: string;
  statusBg: string;
  statusFg: string;
  method: string;
  date: string;
  balanceHint: string;
  open: () => void;
}

export interface InvoiceDetail {
  id: string;
  status: string;
  statusBg: string;
  statusFg: string;
  issued: string;
  due: string;
  method: string;
  agent: string;
  trip: string;
  client: string;
  initials: string;
  avatarBg: string;
  email: string;
  phone: string;
  total: string;
  paid: string;
  balance: string;
  pct: string;
  barColor: string;
  summaryLabel: string;
  summaryColor: string;
  hasBalance: boolean;
  items: { label: string; amount: string }[];
  payments: { date: string; label: string; amount: string; method: string; ref: string; dot: string }[];
  schedule: { label: string; amount: string; due: string }[];
  hasSchedule: boolean;
  openTrip: () => void;
}

export interface Plan {
  name: string;
  tag: string;
  price: string;
  per: string;
  features: string[];
  ctaLabel: string;
  ctaBg: string;
  ctaFg: string;
  ctaBorder: string;
  border: string;
  popDisplay: string;
  onClick: () => void;
}

export interface TravelerItem {
  name: string;
  initials: string;
  avatarBg: string;
  trip: string;
  status: string;
  statusBg: string;
  statusFg: string;
  value: string;
  where: string;
  open: () => void;
}

export interface TeamMember {
  name: string;
  email: string;
  initials: string;
  avatarBg: string;
  role: string;
  roleBg: string;
  roleFg: string;
  active: string;
  you: boolean;
  youDisplay: string;
  menu: () => void;
}

export interface RoleDef {
  name: string;
  count: number;
  icon: string;
  iconBg: string;
  desc: string;
  countLabel: string;
  perms: { icon: string; label: string; color: string }[];
}

export interface Channel {
  name: string;
  icon: string;
  iconBg: string;
  sub: string;
  connected: boolean;
  connDisplay: string;
  btnLabel: string;
  btnBg: string;
  btnFg: string;
  btnBorder: string;
  action: () => void;
}

export interface NotifSetting {
  key: string;
  title: string;
  desc: string;
  on: boolean;
  trackBg: string;
  knobX: string;
  toggle: () => void;
}

export interface OnboardingTask {
  slot: string;
  icon: string;
  title: string;
  desc: string;
  done: boolean;
  todo: boolean;
  cta?: string;
  action?: () => void;
  ph: string;
}

export interface GuideCard {
  title: string;
  excerpt: string;
  cover: string;
  cat: string;
  catBg: string;
  catFg: string;
  read: string;
  icon: string;
  open: () => void;
}

export interface GuideSection {
  h: string;
  paras: string[];
  hasShot: boolean;
  shotSlot?: string;
  shotLabel?: string;
  hasTip: boolean;
  tip?: string;
}

export interface GuideArticle {
  title: string;
  cat: string;
  catBg: string;
  catFg: string;
  cover: string;
  read: string;
  updated: string;
  videoTitle: string;
  videoSlot: string;
  sections: GuideSection[];
  nextTitle: string;
  nextCat: string;
  nextOpen: () => void;
}

export interface AgentFeedItem {
  iconEl: string;
  iconBg: string;
  title: string;
  detail: string;
  time: string;
  actionLabel: string;
  action: () => void;
}

export interface ConnectPickItem {
  name: string;
  icon: string;
  iconBg: string;
  sub: string;
  pick: () => void;
}

export interface ConnectChannelView {
  short: string;
  icon: string;
  iconBg: string;
  isQr: boolean;
  isAccount: boolean;
  authTitle: string;
  authBody: string;
  cta: string;
  synced: string;
  createdLabel: string;
  reviewLabel: string;
  moreLabel: string;
  contacts: { name: string; initials: string; avatarBg: string; source: string; tag: string; tagBg: string; tagFg: string }[];
}
